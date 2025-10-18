from __future__ import annotations
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from pydantic import BaseModel
from typing import Dict, List, Optional
import numpy as np
import os
import logging
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logger = logging.getLogger(__name__)
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

from data_loader import (
    load_parquet_files_by_filter,
    filter_parquet_data,
    get_unique_combinations,
    get_available_filter_options,
    load_chart_data_single,
    load_chart_data_batch,
)
from db import init_db, init_filter_history_table, load_notes, save_note, load_notes_v2, save_note_v2

# Configuration from environment (V2 defaults)
DATA_DIR = os.getenv("DATA_DIR", ".")  # Current directory (V2: frame_data.parquet 위치)
CHART_DATA_DIR = os.getenv("CHART_DATA_DIR", "./temp/chart_data")  # Chart data directory
API_PORT = int(os.getenv("API_PORT", "8050"))

# Startup info
logger.info("=" * 60)
logger.info("🚀 Starting Dashboard API Server")
logger.info("=" * 60)
logger.info(f"📂 DATA_DIR: {DATA_DIR}")
logger.info(f"📈 CHART_DATA_DIR: {CHART_DATA_DIR}")
logger.info(f"🔌 API_PORT: {API_PORT}")
logger.info("=" * 60)


class Filters(BaseModel):
    line: str = "ALL"
    area: str = "ALL"
    sensors: Optional[str] = "ALL"  # Made optional for V2 (will be ignored)
    ai_result: str = "ALL"
    patterns: Optional[str] = "ALL"  # Made optional for V2 (will be ignored)
    period_from: Optional[str] = None
    period_to: Optional[str] = None


class QueryRequest(BaseModel):
    filters: Filters
    page: int = 1
    page_size: int = 10
    user_id: Optional[str] = None
    pattern: Optional[str] = None


class NotesLoadRequest(BaseModel):
    user_id: str
    pattern: str
    variant_ids: List[str]  # Will be master_task_ids in new schema


class NoteOut(BaseModel):
    note: str
    created_at: str
    updated_at: str
    created_by: str
    updated_by: str


class NotesSaveRequest(BaseModel):
    user_id: str
    pattern: str
    variant_id: str
    note: str
    current_session_user: str


class ChartDataRequest(BaseModel):
    """Request for batch chart data loading."""
    master_task_ids: List[str]
    days: int = 60  # Default to 60 days


class QueryMetrics(BaseModel):
    """Performance metrics for data query operations."""
    load_ms: float
    filter_ms: float
    aggregate_ms: float
    paginate_ms: float
    total_ms: float
    rows_total: int
    rows_page: int


class QueryResponse(BaseModel):
    """Response model for data query endpoint."""
    rows: List[Dict]
    page: int
    page_size: int
    total: int
    total_pages: int
    metrics: Optional[QueryMetrics] = None
    notes: Optional[Dict[str, Dict]] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup and shutdown events."""
    # Startup
    init_db()
    init_filter_history_table()
    yield
    # Shutdown (if needed in the future)


app = FastAPI(title="TS Dashboard API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1024)


@app.get("/health")
def health() -> Dict[str, str]:
    return {"status": "ok"}


@app.get("/filters/options")
def get_filters_options() -> Dict[str, List[str]]:
    return get_available_filter_options(DATA_DIR)


@app.post("/data/query", response_model=QueryResponse)
def data_query(req: QueryRequest) -> JSONResponse:
    try:
        filters_dict = req.filters.model_dump()
        
        # Handle comma-separated line filter (multi-select support)
        if "line" in filters_dict and isinstance(filters_dict["line"], str):
            if "," in filters_dict["line"]:
                filters_dict["line"] = [x.strip() for x in filters_dict["line"].split(",")]
        
        df = load_parquet_files_by_filter(filters_dict, DATA_DIR)
    except Exception as e:
        logger.error("Error loading parquet data", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Data loading failed: {str(e)}")
    if df.empty:
        return QueryResponse(
            rows=[],
            page=req.page,
            page_size=req.page_size,
            total=0,
            total_pages=0,
            metrics=QueryMetrics(
                load_ms=0.0,
                filter_ms=0.0,
                aggregate_ms=0.0,
                paginate_ms=0.0,
                total_ms=0.0,
                rows_total=0,
                rows_page=0
            )
        )
    df = filter_parquet_data(df, filters_dict)
    rows = get_unique_combinations(df)
    # server-side lightweight downsampling to limit payload size
    MAX_POINTS = 4000
    for r in rows:
        pdict = r.get("plot_data", {})
        values = pdict.get("value") or []
        if len(values) > MAX_POINTS:
            step = max(1, len(values)//MAX_POINTS)
            for k in ["act_date", "value", "spec_lower", "spec_upper"]:
                if pdict.get(k):
                    pdict[k] = pdict[k][::step]

    total = len(rows)
    if total == 0:
        return QueryResponse(
            rows=[],
            page=req.page,
            page_size=req.page_size,
            total=0,
            total_pages=0,
            metrics=QueryMetrics(
                load_ms=0.0,
                filter_ms=0.0,
                aggregate_ms=0.0,
                paginate_ms=0.0,
                total_ms=0.0,
                rows_total=0,
                rows_page=0
            )
        )

    page_size = max(1, min(req.page_size, 100))
    total_pages = (total + page_size - 1) // page_size
    page = max(1, min(req.page, total_pages))
    start = (page - 1) * page_size
    end = start + page_size
    rows_page = rows[start:end]

    # Load notes if user_id is provided
    notes_data = None
    if req.user_id:
        # Detect V2 schema
        is_v2 = rows_page and "MASTER_TASK_ID" in rows_page[0]
        
        if is_v2:
            # V2 Schema: Use new_notes table with task_id
            task_ids = [str(r.get("MASTER_TASK_ID")) for r in rows_page if r.get("MASTER_TASK_ID")]
            if task_ids:
                notes_dict = load_notes_v2(req.user_id, task_ids)
                notes_data = {
                    tid: {
                        "note": note_tuple[0],
                        "created_at": note_tuple[1],
                        "updated_at": note_tuple[2],
                        "created_by": note_tuple[3],
                        "updated_by": note_tuple[4],
                    }
                    for tid, note_tuple in notes_dict.items()
                }
        else:
            # Legacy: Use notes table with pattern + variant_id
            if req.pattern:
                variant_ids = [str(r.get("variant_id")) for r in rows_page if r.get("variant_id")]
                if variant_ids:
                    notes_dict = load_notes(req.user_id, req.pattern, variant_ids)
                    notes_data = {
                        vid: {
                            "note": note_tuple[0],
                            "created_at": note_tuple[1],
                            "updated_at": note_tuple[2],
                            "created_by": note_tuple[3],
                            "updated_by": note_tuple[4],
                        }
                        for vid, note_tuple in notes_dict.items()
                    }

    payload = QueryResponse(
        rows=rows_page,
        page=page,
        page_size=page_size,
        total=total,
        total_pages=total_pages,
        notes=notes_data,
        metrics=QueryMetrics(
            load_ms=0.0,
            filter_ms=0.0,
            aggregate_ms=0.0,
            paginate_ms=0.0,
            total_ms=0.0,
            rows_total=total,
            rows_page=len(rows_page),
        )
    )
    # Ensure all numpy scalars are converted to native Python types
    content = jsonable_encoder(
        payload.model_dump(),
        custom_encoder={
            np.bool_: lambda v: bool(v),
            np.generic: lambda v: v.item(),
        },
    )
    return JSONResponse(content=content)


@app.post("/notes/load")
def notes_load(req: NotesLoadRequest) -> Dict[str, NoteOut]:
    if not req.user_id:
        raise HTTPException(status_code=400, detail="user_id required")
    if not req.pattern:
        raise HTTPException(status_code=400, detail="pattern required")
    notes = load_notes(req.user_id, req.pattern, req.variant_ids)
    # map to variant_id -> {note, created_at, updated_at, created_by, updated_by}
    return {
        k: NoteOut(
            note=(v[0] or ""),
            created_at=(v[1] or ""),
            updated_at=(v[2] or ""),
            created_by=(v[3] or ""),
            updated_by=(v[4] or "")
        ) for k, v in notes.items()
    }


@app.post("/notes/save")
def notes_save(req: NotesSaveRequest) -> Dict[str, str]:
    if not req.user_id or not req.variant_id:
        raise HTTPException(status_code=400, detail="user_id and variant_id required")
    if not req.current_session_user:
        raise HTTPException(status_code=400, detail="current_session_user required")
    
    # V2 Schema: pattern == "ALL" means use new_notes table
    # Legacy: pattern != "ALL" means use notes table
    is_v2 = req.pattern == "ALL"
    
    if is_v2:
        # V2: Save to new_notes table
        created_at, updated_at, updated_by, created_by = save_note_v2(
            req.user_id,
            req.variant_id,  # This is actually MASTER_TASK_ID in V2
            req.note,
            req.current_session_user
        )
    else:
        # Legacy: Save to notes table
        if not req.pattern:
            raise HTTPException(status_code=400, detail="pattern required for legacy schema")
        created_at, updated_at, updated_by, created_by = save_note(
            req.user_id,
            req.pattern,
            req.variant_id,
            req.note,
            req.current_session_user
        )
    
    return {
        "variant_id": req.variant_id,
        "created_at": created_at,
        "updated_at": updated_at,
        "updated_by": updated_by,
        "created_by": created_by
    }


@app.get("/data/chart/{master_task_id}")
def get_chart_data_single(master_task_id: str, days: int = 60) -> Dict:
    """
    Get chart data for a single master_task_id.
    
    Args:
        master_task_id: The task ID to load chart data for
        days: Number of days to return (default 60)
        
    Returns:
        Chart data dictionary or error
    """
    chart_data = load_chart_data_single(master_task_id, days, CHART_DATA_DIR)
    
    if chart_data is None:
        raise HTTPException(
            status_code=404, 
            detail=f"Chart data not found for master_task_id: {master_task_id}"
        )
    
    return {
        "master_task_id": master_task_id,
        "data": chart_data,
        "days": days,
        "count": len(chart_data.get("act_date", []))
    }


@app.post("/data/chart/batch")
def get_chart_data_batch(req: ChartDataRequest) -> Dict[str, Dict]:
    """
    Get chart data for multiple master_task_ids in batch.
    
    Args:
        req: ChartDataRequest with master_task_ids and days
        
    Returns:
        Dictionary mapping master_task_id to chart data
    """
    if not req.master_task_ids:
        raise HTTPException(status_code=400, detail="master_task_ids required")
    
    chart_data_map = load_chart_data_batch(req.master_task_ids, req.days, CHART_DATA_DIR)
    
    return chart_data_map


# To run locally:
# uvicorn api:app --host $API_HOST --port $API_PORT
# Or with defaults:
# uvicorn api:app --host 115.136.116.145 --port 8050

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="115.136.116.13", port=API_PORT)

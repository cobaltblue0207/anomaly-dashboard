"""Data loading and filtering utilities (FastAPI-safe, no Streamlit deps)."""
from __future__ import annotations
import pandas as pd
import glob
import os
import time
import logging
from typing import List, Dict, Optional

# Configure logging
logger = logging.getLogger(__name__)
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)


def build_file_pattern(filters: Dict, data_dir: str = "./all_groups_parquet") -> str:
    """Build glob pattern based on filters.
    
    V2 Schema: Only LINE and AREA filters are used.
    File naming rule: {line}_{area}_{sensor}_{pattern}_v{numeric_variant_id}.parquet (legacy)
    Or: frame_data.parquet (V2 single file)
    
    Args:
        filters: Dictionary of filter criteria
        data_dir: Directory containing parquet files
        
    Returns:
        Glob pattern string
    """
    # V2 Schema: Check if frame_data.parquet exists (single file approach)
    frame_file = os.path.join(data_dir, "frame_data.parquet")
    if os.path.exists(frame_file):
        return frame_file
    
    # Legacy approach: Use line and area filters only
    line = filters.get("line", "ALL")
    area = filters.get("area", "ALL")
    sensor = filters.get("sensors", "*")  # Default to wildcard
    pattern = filters.get("patterns", "*")  # Default to wildcard

    if isinstance(line, list):
        if len(line) == 1:
            line_part = line[0]
        else:
            line_part = "*"
    else:
        line_part = line if line != "ALL" else "*"

    if isinstance(area, list):
        area_part = "*" if len(area) != 1 else area[0]
    else:
        area_part = area if area != "ALL" else "*"

    if isinstance(sensor, list):
        sensor_part = "*" if len(sensor) != 1 else sensor[0]
    else:
        sensor_part = sensor if sensor != "ALL" else "*"

    if isinstance(pattern, list):
        pattern_part = "*" if len(pattern) != 1 else pattern[0]
    else:
        pattern_part = pattern if pattern != "ALL" else "*"

    file_pattern = f"{line_part}_{area_part}_{sensor_part}_{pattern_part}_v*.parquet"
    return os.path.join(data_dir, file_pattern)


# naive TTL cache (1 hour) to avoid Streamlit cache in FastAPI runtime
_PARQUET_CACHE: Dict[str, Dict[str, object]] = {}

def _cleanup_expired_cache(ttl: int = 3600) -> None:
    """Remove expired cache entries to prevent memory bloat."""
    now = time.time()
    expired_keys = [
        k for k, v in _PARQUET_CACHE.items()
        if (now - float(v.get("ts", 0))) >= ttl
    ]
    for k in expired_keys:
        del _PARQUET_CACHE[k]

def load_parquet_files_by_filter(filters: Dict, data_dir: str = "./all_groups_parquet") -> pd.DataFrame:
    """Load only parquet files matching the filter criteria.
    
    V2 Schema: Supports both frame_data.parquet (single file) and legacy multi-file approach.
    
    Args:
        filters: Dictionary of filter criteria
        data_dir: Directory containing parquet files
        
    Returns:
        Concatenated DataFrame from matching parquet files
    """
    if not os.path.exists(data_dir):
        return pd.DataFrame()
    
    file_pattern = build_file_pattern(filters, data_dir)
    now = time.time()
    
    # Cleanup expired cache entries periodically
    _cleanup_expired_cache(ttl=3600)
    
    # V2 Schema: Single frame_data.parquet file
    if file_pattern.endswith("frame_data.parquet"):
        # Create unique cache key including filter values for V2
        line_val = filters.get("line", "ALL")
        area_val = filters.get("area", "ALL")
        ai_result_val = filters.get("ai_result", "ALL")
        cache_key = f"{file_pattern}|LINE:{line_val}|AREA:{area_val}|AI:{ai_result_val}"
        
        # Check cache with filter-specific key
        ent = _PARQUET_CACHE.get(cache_key)
        if ent and (now - float(ent.get("ts", 0))) < 3600:
            cached = ent.get("df")
            if isinstance(cached, pd.DataFrame):
                return cached
        
        try:
            df = pd.read_parquet(file_pattern)
            # Apply LINE and AREA filters to the DataFrame
            df = _apply_v2_filters(df, filters)
            _PARQUET_CACHE[cache_key] = {"ts": now, "df": df}
            return df
        except Exception as e:
            logger.error(f"Error loading V2 frame_data.parquet: {e}", exc_info=True)
            return pd.DataFrame()
    
    # Legacy: Check cache with file_pattern key
    ent = _PARQUET_CACHE.get(file_pattern)
    if ent and (now - float(ent.get("ts", 0))) < 3600:
        cached = ent.get("df")
        if isinstance(cached, pd.DataFrame):
            return cached
    
    # Legacy approach: Multiple parquet files
    # Handle multi-select line filter
    line_filter = filters.get("line", "ALL")
    if isinstance(line_filter, list) and len(line_filter) > 1:
        # Load files for each line separately and combine
        all_dfs = []
        for single_line in line_filter:
            single_filter = {**filters, "line": single_line}
            file_pattern = build_file_pattern(single_filter, data_dir)
            parquet_files = glob.glob(file_pattern)
            for file_path in parquet_files:
                try:
                    df = pd.read_parquet(file_path)
                    all_dfs.append(df)
                except Exception as e:
                    logger.error(f"Error loading parquet file {file_path}", exc_info=True)
        
        if all_dfs:
            out = pd.concat(all_dfs, ignore_index=True)
            _PARQUET_CACHE[file_pattern] = {"ts": now, "df": out}
            return out
        return pd.DataFrame()
    
    # Single line filter (original logic with cache)
    parquet_files = glob.glob(file_pattern)
    
    if not parquet_files:
        return pd.DataFrame()
    
    dfs = []
    for file_path in parquet_files:
        try:
            df = pd.read_parquet(file_path)
            dfs.append(df)
        except Exception as e:
            logger.error(f"Error loading parquet file {file_path}", exc_info=True)
    
    if dfs:
        out = pd.concat(dfs, ignore_index=True)
        _PARQUET_CACHE[file_pattern] = {"ts": now, "df": out}
        return out
    return pd.DataFrame()


def _apply_v2_filters(df: pd.DataFrame, filters: Dict) -> pd.DataFrame:
    """Apply V2 schema filters to DataFrame.
    
    Args:
        df: Source DataFrame
        filters: Dictionary of filter criteria
        
    Returns:
        Filtered DataFrame
    """
    if df.empty:
        return df
    
    filtered_df = df.copy()
    
    # LINE filter
    line_filter = filters.get("line", "ALL")
    if line_filter != "ALL":
        if isinstance(line_filter, list):
            filtered_df = filtered_df[filtered_df["LINE"].isin(line_filter)]
        else:
            filtered_df = filtered_df[filtered_df["LINE"] == line_filter]
    
    # AREA filter
    area_filter = filters.get("area", "ALL")
    if area_filter != "ALL":
        if isinstance(area_filter, list):
            filtered_df = filtered_df[filtered_df["AREA"].isin(area_filter)]
        else:
            filtered_df = filtered_df[filtered_df["AREA"] == area_filter]
    
    # AI_RESULT filter (MODEL_RESULT_INFO)
    ai_result = filters.get("ai_result", "ALL")
    if ai_result != "ALL":
        if ai_result == "TRUE":
            filtered_df = filtered_df[filtered_df["MODEL_RESULT_INFO"].str.contains("TRUE", na=False)]
        elif ai_result == "FALSE":
            filtered_df = filtered_df[~filtered_df["MODEL_RESULT_INFO"].str.contains("TRUE", na=False)]
    
    # PERIOD filter (if act_date column exists in frame data)
    if filters.get("period_from") and filters.get("period_to") and "act_date" in filtered_df.columns:
        try:
            from_date = pd.to_datetime(filters["period_from"])
            to_date = pd.to_datetime(filters["period_to"])
            filtered_df = filtered_df[
                (filtered_df["act_date"] >= from_date) & 
                (filtered_df["act_date"] <= to_date)
            ]
        except Exception as e:
            logger.error(f"Error filtering by date range: {filters.get('period_from')} to {filters.get('period_to')}", exc_info=True)
    
    return filtered_df


def get_available_filter_options(data_dir: str = "./all_groups_parquet") -> Dict[str, List]:
    """Extract available filter options from parquet files.
    
    V2 Schema: Only LINE and AREA options are returned.
    Legacy: Supports {line}_{area}_{sensor}_{pattern}_v{numeric_variant_id}.parquet
    
    Args:
        data_dir: Directory containing parquet files
        
    Returns:
        Dictionary of available options for each filter
    """
    if not os.path.exists(data_dir):
        return {
            "lines": ["ALL"],
            "areas": ["ALL"],
        }
    
    # V2 Schema: Check if frame_data.parquet exists
    frame_file = os.path.join(data_dir, "frame_data.parquet")
    if os.path.exists(frame_file):
        try:
            df = pd.read_parquet(frame_file)
            # Filter out 'ALL' from actual data values
            line_values = df["LINE"].dropna().unique().tolist() if "LINE" in df.columns else []
            area_values = df["AREA"].dropna().unique().tolist() if "AREA" in df.columns else []
            
            # Remove 'ALL' from actual data values and add it as first option
            lines = ["ALL"] + sorted([v for v in line_values if v != "ALL"])
            areas = ["ALL"] + sorted([v for v in area_values if v != "ALL"])
            return {
                "lines": lines,
                "areas": areas,
            }
        except Exception as e:
            logger.error(f"Error reading frame_data.parquet for filter options: {e}", exc_info=True)
    
    # Legacy approach: Parse file names
    parquet_files = glob.glob(os.path.join(data_dir, "*.parquet"))
    
    lines = set()
    areas = set()
    
    for file_path in parquet_files:
        filename = os.path.basename(file_path)
        # Skip frame_data.parquet as it's handled above
        if filename == "frame_data.parquet":
            continue
            
        # Parse: {line}_{area}_{sensor}_{pattern}_v{numeric_variant_id}.parquet
        parts = filename.replace('.parquet', '').split('_')
        
        if len(parts) >= 5:  # line_area_sensor_pattern_v...
            lines.add(parts[0])
            areas.add(parts[1])
    
    return {
        "lines": ["ALL"] + sorted(list(lines)),
        "areas": ["ALL"] + sorted(list(areas)),
    }


def filter_parquet_data(df: pd.DataFrame, filters: dict) -> pd.DataFrame:
    """Filter parquet data based on sidebar filters.
    
    V2 Schema: Only AI_RESULT and PERIOD filters are applied (LINE/AREA filtered by _apply_v2_filters).
    Legacy: LINE, AREA, SENSORS, PATTERNS are already filtered by file selection.
    
    Args:
        df: Source DataFrame
        filters: Dictionary of filter criteria
        
    Returns:
        Filtered DataFrame
    """
    if df.empty:
        return df
    
    # V2 Schema: Skip additional filtering as it's handled by _apply_v2_filters
    if "MASTER_TASK_ID" in df.columns:
        return df
    
    # Legacy approach: Apply AI_RESULT and PERIOD filters
    filtered_df = df.copy()
    
    # AI_RESULT filter (legacy approach)
    if filters.get("ai_result") != "ALL":
        if filters["ai_result"] == "TRUE":
            value_std = filtered_df.groupby(["line", "area", "sensor"])["value"].transform("std")
            value_mean = filtered_df.groupby(["line", "area", "sensor"])["value"].transform("mean")
            filtered_df = filtered_df[abs(filtered_df["value"] - value_mean) > 2 * value_std]
        elif filters["ai_result"] == "FALSE":
            value_std = filtered_df.groupby(["line", "area", "sensor"])["value"].transform("std")
            value_mean = filtered_df.groupby(["line", "area", "sensor"])["value"].transform("mean")
            filtered_df = filtered_df[abs(filtered_df["value"] - value_mean) <= 2 * value_std]
    
    # PERIOD filter
    if filters.get("period_from") and filters.get("period_to"):
        try:
            from_date = pd.to_datetime(filters["period_from"])
            to_date = pd.to_datetime(filters["period_to"])
            filtered_df = filtered_df[
                (filtered_df["act_date"] >= from_date) & 
                (filtered_df["act_date"] <= to_date)
            ]
        except Exception as e:
            logger.error(f"Error filtering by date range: {filters.get('period_from')} to {filters.get('period_to')}", exc_info=True)
    
    return filtered_df


def get_unique_combinations(df: pd.DataFrame) -> List[Dict]:
    """Get unique combinations from filtered data.
    
    V2 Schema: Returns rows based on MASTER_TASK_ID (one row per task).
    Legacy: Returns combinations of line, area, sensor.
    
    Args:
        df: Filtered DataFrame
        
    Returns:
        List of dictionaries containing combination metadata and stats
    """
    if df.empty:
        return []
    
    # V2 Schema: Check if V2 columns exist
    if "MASTER_TASK_ID" in df.columns:
        return _get_v2_combinations(df)
    
    # Legacy approach: Get unique combinations per variant
    group_cols = ["line", "area", "sensor"]
    if "variant_id" in df.columns:
        group_cols.append("variant_id")
    if "pattern" in df.columns:
        group_cols.append("pattern")
    unique_combos = df.groupby(group_cols).size().reset_index()
    
    rows = []
    for idx, row in unique_combos.iterrows():
        # Get data for this combination
        m = (
            (df["line"] == row["line"]) &
            (df["area"] == row["area"]) &
            (df["sensor"] == row["sensor"]) 
        )
        if "variant_id" in row:
            m = m & (df["variant_id"] == row["variant_id"])
        if "pattern" in row:
            m = m & (df["pattern"] == row["pattern"])
        combo_data = df[m]
        
        # Extract metadata
        pattern = (row["pattern"] if "pattern" in row else (
            combo_data["pattern"].iloc[0] if "pattern" in combo_data.columns else "unknown"
        ))
        variant_id = (str(row["variant_id"]) if "variant_id" in row else (
            str(combo_data["variant_id"].iloc[0]) if "variant_id" in combo_data.columns else "N/A"
        ))
        # ensure plain Python bool for serialization
        if "model_result" in combo_data.columns:
            try:
                model_result = bool(combo_data["model_result"].iloc[0])
            except Exception:
                model_result = False
        else:
            model_result = False
        
        # Calculate statistics
        is_real = len(combo_data) > 0
        
        # Store only necessary data (not the entire DataFrame)
        rows.append({
            "no": idx + 1,
            "is_real": bool(is_real),
            "sensor": row["sensor"],
            "machine": f"{row['line']}_{row['area']}",
            "tag": pattern,
            "variant_id": variant_id,
            "model_result": model_result,
            "info_text": f"LINE:{row['line']} {row['sensor']} {row['line']}_{row['area']} {pattern}",
            # Store only essential plot data
            "plot_data": {
                "act_date": combo_data["act_date"].tolist(),
                "value": combo_data["value"].tolist(),
                "spec_lower": combo_data["spec_lower"].tolist() if "spec_lower" in combo_data.columns else None,
                "spec_upper": combo_data["spec_upper"].tolist() if "spec_upper" in combo_data.columns else None,
            }
        })
    
    return rows


def _get_v2_combinations(df: pd.DataFrame) -> List[Dict]:
    """Get V2 schema combinations (one row per MASTER_TASK_ID).
    
    Args:
        df: V2 DataFrame with MASTER_TASK_ID column
        
    Returns:
        List of dictionaries for V2 schema
    """
    rows = []
    
    for idx, row in df.iterrows():
        # Extract V2 columns with fallback to legacy names
        master_task_id = row.get("MASTER_TASK_ID", str(row.get("variant_id", "N/A")))
        line = row.get("LINE", row.get("line", "N/A"))
        area = row.get("AREA", row.get("area", "N/A"))
        prod_eqp_id = row.get("PROD_EQP_ID", "")
        param_subitem = row.get("PARAM_SUBITEM", "")
        ppid = row.get("PPID", "")
        recipeid = row.get("RECIPEID", "")
        ch_step = row.get("CH_STEP", "")
        model_result_info = row.get("MODEL_RESULT_INFO", str(row.get("model_result", "")))
        comments = row.get("COMMENTS", "")
        notes = row.get("NOTES", "")
        
        # Get chart data (30D and 60D)
        chart_30d = row.get("30D", None)
        chart_60d = row.get("60D", None)
        
        # If no chart data in frame, set to None (will be loaded separately)
        if chart_30d is None:
            chart_30d = {"act_date": [], "value": [], "spec_lower": [], "spec_upper": []}
        if chart_60d is None:
            chart_60d = {"act_date": [], "value": [], "spec_lower": [], "spec_upper": []}
        
        rows.append({
            "no": idx + 1,
            "is_real": True,
            "MASTER_TASK_ID": master_task_id,
            "LINE": line,
            "AREA": area,
            "PROD_EQP_ID": prod_eqp_id,
            "PARAM_SUBITEM": param_subitem,
            "PPID": ppid,
            "RECIPEID": recipeid,
            "CH_STEP": ch_step,
            "MODEL_RESULT_INFO": model_result_info,
            "COMMENTS": comments,
            "NOTES": notes,
            "30D": chart_30d,
            "60D": chart_60d,
            "info_text": f"LINE:{line} AREA:{area} EQP:{prod_eqp_id} PARAM:{param_subitem}",
            # Legacy compatibility fields
            "sensor": param_subitem,  # Map PARAM_SUBITEM to sensor for compatibility
            "machine": f"{line}_{area}",
            "tag": ppid,  # Map PPID to tag for compatibility
            "variant_id": master_task_id,  # Map MASTER_TASK_ID to variant_id for compatibility
            "model_result": "TRUE" in str(model_result_info).upper(),
            "plot_data": chart_30d,  # Default to 30D for legacy compatibility
        })
    
    return rows


def load_chart_data_single(master_task_id: str, days: int = 60, chart_data_dir: str = "./chart_data") -> Optional[Dict]:
    """
    Load chart data for a single master_task_id.
    
    Args:
        master_task_id: The task ID to load data for
        days: Number of days to return (default 60, can be sliced to 30)
        chart_data_dir: Directory containing chart parquet files
        
    Returns:
        Dict with chart data or None if not found
        {
            "act_date": [str],
            "value": [float],
            "spec_lower": [float],
            "spec_upper": [float]
        }
    """
    import os
    import pandas as pd
    
    # Try individual file first
    individual_file = os.path.join(chart_data_dir, f"{master_task_id}.parquet")
    
    if os.path.exists(individual_file):
        try:
            df = pd.read_parquet(individual_file)
            # Convert act_date to datetime if it's not already
            df["act_date"] = pd.to_datetime(df["act_date"])
            
            # Get the maximum date and filter for the last N days
            max_date = df["act_date"].max()
            min_date = max_date - pd.Timedelta(days=days-1)
            
            # Filter data for the specified date range
            df = df[df["act_date"] >= min_date].sort_values(by="act_date", ascending=False)
            
            return {
                "act_date": df["act_date"].astype(str).tolist(),
                "value": df["value"].tolist(),
                "spec_lower": df["spec_lower"].tolist() if "spec_lower" in df.columns else [None] * len(df),
                "spec_upper": df["spec_upper"].tolist() if "spec_upper" in df.columns else [None] * len(df),
            }
        except Exception as e:
            logger.error(f"Error loading chart data for {master_task_id}: {e}")
            return None
    
    # Try combined file
    combined_file = os.path.join(chart_data_dir, "chart_data_all.parquet")
    if os.path.exists(combined_file):
        try:
            df = pd.read_parquet(combined_file)
            df = df[df["master_task_id"] == master_task_id]
            
            if len(df) > 0:
                # Convert act_date to datetime if it's not already
                df["act_date"] = pd.to_datetime(df["act_date"])
                
                # Get the maximum date and filter for the last N days
                max_date = df["act_date"].max()
                min_date = max_date - pd.Timedelta(days=days-1)
                
                # Filter data for the specified date range
                df = df[df["act_date"] >= min_date]
                
                if len(df) > 0:
                    return {
                        "act_date": df["act_date"].astype(str).tolist(),
                        "value": df["value"].tolist(),
                        "spec_lower": df["spec_lower"].tolist() if "spec_lower" in df.columns else [None] * len(df),
                        "spec_upper": df["spec_upper"].tolist() if "spec_upper" in df.columns else [None] * len(df),
                    }
        except Exception as e:
            logger.error(f"Error loading chart data from combined file for {master_task_id}: {e}")
    
    return None


def load_chart_data_batch(master_task_ids: List[str], days: int = 60, chart_data_dir: str = "./chart_data") -> Dict[str, Dict]:
    """
    Load chart data for multiple master_task_ids in batch.
    
    Args:
        master_task_ids: List of task IDs to load data for
        days: Number of days to return
        chart_data_dir: Directory containing chart parquet files
        
    Returns:
        Dict mapping master_task_id to chart data
        {
            "TASK001": {"act_date": [...], "value": [...], ...},
            "TASK002": {"act_date": [...], "value": [...], ...},
            ...
        }
    """
    result = {}
    
    for task_id in master_task_ids:
        chart_data = load_chart_data_single(task_id, days, chart_data_dir)
        if chart_data:
            result[task_id] = chart_data
    
    return result


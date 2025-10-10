"""Anomaly Review Dashboard - Main Application.

Performance optimizations:
- Load only files matching filter criteria (not all 1600 files!)
- Data loading with caching (@st.cache_data)
- Modular structure for better maintainability
- Efficient data handling (only store necessary data)
"""
from __future__ import annotations
import streamlit as st
from db import (
    init_db,
    init_filter_history_table,
    save_filter_history,
    load_notes,
)
from data_loader import (
    load_parquet_files_by_filter,
    filter_parquet_data,
    get_unique_combinations,
    get_available_filter_options,
)
from ui_components import (
    render_filter_sidebar,
    render_filter_history,
    render_view_mode_filter,
    render_column_filters,
    render_pagination,
    render_result_banner,
    render_table_header,
    render_data_row,
)

# -------------------- Page Configuration --------------------
st.set_page_config(page_title="Anomaly Review Dashboard (with Notes)", layout="wide")

# -------------------- Initialize Database --------------------
init_db()
init_filter_history_table()

# -------------------- Get Available Filter Options --------------------
# Extract filter options from parquet file names (fast, no file loading)
filter_options = get_available_filter_options("./all_groups_parquet")

# -------------------- Sidebar: Filters --------------------
filters, run_clicked = render_filter_sidebar(filter_options)

if run_clicked:
    st.session_state["filters"] = filters
            st.session_state["run_token"] = st.session_state.get("run_token", 0) + 1
    save_filter_history(filters, keep_last=10)

# Render filter history
render_filter_history()

# -------------------- Main Content Area --------------------
run_token = st.session_state.get("run_token")
filters = st.session_state.get("filters", {})

if run_token is None:
    st.info("사이드바에서 필터를 선택한 후 **RUN !!!**을 눌러주세요.")
    st.stop()

# -------------------- Load Data Based on Filters --------------------
# Only load files matching the filter criteria (efficient!)
filtered_data = load_parquet_files_by_filter(filters, "./all_groups_parquet")

if filtered_data.empty:
    st.warning("No data matches the current filters. Please adjust your filter settings.")
    st.stop()

# Apply additional filters (AI_RESULT, PERIOD)
filtered_data = filter_parquet_data(filtered_data, filters)

if filtered_data.empty:
    st.warning("No data matches the current filters after applying AI_RESULT/PERIOD filters.")
    st.stop()

# Get unique combinations (with optimized data storage)
rows_raw = get_unique_combinations(filtered_data)

# Apply AI_RESULT filter if specified
if filters.get("ai_result") == "TRUE":
    rows_raw = [r for r in rows_raw if r["is_real"]]
elif filters.get("ai_result") == "FALSE":
    rows_raw = [r for r in rows_raw if not r["is_real"]]

# -------------------- View Mode Filter --------------------
rows_raw, rows_before_view = render_view_mode_filter(rows_raw)

# -------------------- Column Filters --------------------
sensor_q, machine_q, notes_q = render_column_filters()

if sensor_q:
    rows_raw = [r for r in rows_raw if sensor_q in r.get("sensor", "").lower()]
if machine_q:
    rows_raw = [r for r in rows_raw if machine_q in r.get("machine", "").lower()]
if notes_q:
    candidate_variant_ids = [r.get("variant_id", "") for r in rows_raw]
    notes_map_all = load_notes(candidate_variant_ids)
    rows_raw = [r for r in rows_raw if notes_q in (notes_map_all.get(r.get("variant_id", ""), ("", ""))[0] or "").lower()]

# -------------------- Pagination --------------------
PAGE_SIZE = 10
rows_page, page, total_pages = render_pagination(rows_raw, PAGE_SIZE)

# -------------------- Result Banner --------------------
render_result_banner(rows_before_view)

# -------------------- Table Header --------------------
render_table_header()

# -------------------- Load Notes for Current Page --------------------
variant_ids = [r.get("variant_id", "") for r in rows_page]
notes_map = load_notes(variant_ids)

# -------------------- Render Data Rows --------------------
for row_data in rows_page:
    render_data_row(row_data, notes_map)

# -------------------- Footer --------------------
total = len(rows_raw)
start = (page - 1) * PAGE_SIZE
end = start + PAGE_SIZE
st.caption(f"Page {page}/{total_pages} · Showing {start+1}-{min(end, total)} of {total}")

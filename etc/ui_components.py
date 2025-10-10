"""UI components for the Anomaly Review Dashboard."""
from __future__ import annotations
import streamlit as st
import json
import time
from datetime import date, timedelta
from typing import Dict, List, Tuple
from db import (
    save_filter_history,
    load_filter_history,
    load_notes,
    save_note,
)
from utils import utc_iso_to_kst_label
from chart_utils import create_timeseries_chart, create_thumbnail_chart
try:
    from streamlit_plotly_events import plotly_events  # type: ignore
except Exception:
    plotly_events = None  # optional dependency

# Feature flag: set to True to enable click-to-activate. Kept False to ensure stability.
USE_CLICK_TO_ACTIVATE = False  # disable for stability; charts render interactively


def render_filter_sidebar(filter_options: Dict[str, List]) -> Tuple[Dict, bool]:
    """Render the filter sidebar and return selected filters.
    
    Args:
        filter_options: Available filter options
        
    Returns:
        Tuple of (filters dict, run_clicked bool)
    """
    st.sidebar.header("Filters")
    
    with st.sidebar.form("filter_form", clear_on_submit=False):
        line = st.selectbox("LINE", filter_options["lines"], index=0)
        area = st.selectbox("AREA", filter_options["areas"], index=0)
        sensors = st.selectbox("SENSORS", filter_options["sensors"], index=0)  # Changed from EQP_SDWT
        ai_result = st.selectbox(
            "AI_RESULT", 
            ["ALL", "TRUE", "FALSE"], 
            index=0
        )
        patterns = st.selectbox("PATTERNS", filter_options["patterns"], index=0)  # Changed from MODEL_NAME
        
        colp1, colp2 = st.columns(2)
        with colp1:
            # Default to today's date
            period_from = st.date_input("PERIOD(FROM)", value=date.today())
        with colp2:
            # Default to 30 days from today
            period_to = st.date_input("PERIOD(TO)", value=date.today() + timedelta(days=30))

        run_click = st.form_submit_button("RUN !!!", use_container_width=True)

        if run_click:
            # Validate and adjust dates
            actual_period_from = period_from
            actual_period_to = period_to
            
            # If period_to is before period_from, set period_to to period_from + 30 days
            if period_to < period_from:
                actual_period_to = period_from + timedelta(days=30)
                st.sidebar.warning(f"PERIOD(TO) was before PERIOD(FROM). Automatically adjusted to {actual_period_to}")
            
            filters = {
                "line": line,
                "area": area,
                "sensors": sensors,  # Changed from eqp_sdwt
                "ai_result": ai_result,
                "patterns": patterns,  # Changed from model_name
                "period_from": str(actual_period_from),
                "period_to": str(actual_period_to),
            }
            return filters, True
    
    return {}, False


def render_filter_history():
    """Render the filter history section in sidebar."""
    st.sidebar.markdown("---")
    st.sidebar.subheader("Recent filter history")
    
    hist = load_filter_history(10)
    if hist:
        options = []
        for h in hist:
            fid, fdict, created = h
            created_lbl = utc_iso_to_kst_label(created) if created else ""
            options.append(f"{fid} — {created_lbl}")

        sel = st.sidebar.selectbox("Load recent filter", options, index=0)
        sel_index = options.index(sel)
        fid, fdict, created = hist[sel_index]

        if created:
            created_kst = utc_iso_to_kst_label(created)
            st.sidebar.caption(f"Saved: {created_kst} (KST)")
        st.sidebar.caption(json.dumps(fdict, ensure_ascii=False))

        if st.sidebar.button("Load this filter"):
            st.session_state["filters"] = fdict
            st.session_state["run_token"] = st.session_state.get("run_token", 0) + 1
            st.rerun()
    else:
        st.sidebar.caption("No recent filters saved.")


def render_view_mode_filter(rows_raw: List[Dict]) -> Tuple[List[Dict], List[Dict]]:
    """Render view mode selector and apply filter.
    
    Args:
        rows_raw: List of all rows
        
    Returns:
        Tuple of (filtered rows, original rows for stats)
    """
    rows_before_view = rows_raw.copy()
    
    st.subheader("View Mode")
    show_mode = st.segmented_control(
        label="보기 모드", 
        options=["전체", "진성만", "가성만"], 
        default="전체"
    )

    if show_mode == "진성만":
        rows_raw = [r for r in rows_raw if r["model_result"]]
    elif show_mode == "가성만":
        rows_raw = [r for r in rows_raw if not r["model_result"]]
    
    return rows_raw, rows_before_view


def render_column_filters() -> Tuple[str, str, str]:
    """Render column filters and return filter values.
    
    Returns:
        Tuple of (sensor_q, machine_q, notes_q)
    """
    st.subheader("Column filters")
    
    if "notes_q" not in st.session_state:
        st.session_state["notes_q"] = ""

    colf1, colf2, colf3 = st.columns([1, 1, 1])
    with colf1:
        st.text_input(
            "Sensor contains (substring)", 
            value=st.session_state.get("colf_sensor_q", ""), 
            key="colf_sensor_q",
            help="부분 문자열로 센서 필터 (예: SNS1)"
        )
    with colf2:
        st.text_input(
            "Machine contains (substring)", 
            value=st.session_state.get("colf_machine_q", ""), 
            key="colf_machine_q",
            help="부분 문자열로 머신 필터 (예: EQP1)"
        )
    with colf3:
        st.text_input(
            "Notes contains (substring)", 
            key="notes_q", 
            placeholder="Search saved notes (case-insensitive)"
        )

    sensor_q = (st.session_state.get("colf_sensor_q", "") or "").strip().lower()
    machine_q = (st.session_state.get("colf_machine_q", "") or "").strip().lower()
    notes_q = (st.session_state.get("notes_q", "") or "").strip().lower()
    
    return sensor_q, machine_q, notes_q


def render_pagination(rows_raw: List[Dict], page_size: int = 10) -> Tuple[List[Dict], int, int]:
    """Render pagination controls and return page data.
    
    Args:
        rows_raw: List of all rows
        page_size: Number of rows per page
        
    Returns:
        Tuple of (rows for current page, page number, total pages)
    """
    total = len(rows_raw)
    total_pages = max(1, (total + page_size - 1) // page_size)
    
    if "page" not in st.session_state:
        st.session_state.page = 1

    page_list = list(range(1, total_pages + 1))
    page_labels = [f"Page {p}/{total_pages}" for p in page_list]
    default_index = max(0, min(st.session_state.get("page", 1) - 1, len(page_list) - 1))
    
    sel_label = st.selectbox("Page", page_labels, index=default_index)
    sel_index = page_labels.index(sel_label)
    page = page_list[sel_index]
    st.session_state["page"] = page
    
    start = (page - 1) * page_size
    end = start + page_size
    rows_page = rows_raw[start:end]
    
    return rows_page, page, total_pages


def render_result_banner(rows_before_view: List[Dict]):
    """Render the result summary banner.
    
    Args:
        rows_before_view: Original rows before view mode filter
    """
    total_all = len(rows_before_view)
    real_cnt_all = sum(1 for r in rows_before_view if r["model_result"])
    fake_cnt_all = total_all - real_cnt_all

    if total_all > 0:
        pct_real = real_cnt_all / total_all * 100
        pct_fake = fake_cnt_all / total_all * 100
        st.markdown(
            f"""
            <div style='background:#eef4ff;border:1px solid #cfe0ff;padding:10px 14px;border-radius:6px;\
            font-weight:600;font-size:18px;color:#1b2a4e;'>
            RESULT -> 총 {total_all}개 중 진성({real_cnt_all}개, {pct_real:.1f}%), 가성({fake_cnt_all}개, {pct_fake:.1f}%) 입니다.
            </div>
            """,
            unsafe_allow_html=True,
        )
    else:
        st.markdown(
            f"""
            <div style='background:#fff7e6;border:1px solid #ffe6b3;padding:10px 14px;border-radius:6px;\
            font-weight:600;font-size:16px;color:#7a4b00;'>
            RESULT -> 필터에 해당하는 항목이 없습니다. 필터를 확인하거나 초기화해 주세요.
            </div>
            """,
            unsafe_allow_html=True,
        )
        st.warning("필터에 해당하는 항목이 없습니다. 선택한 필터를 변경하거나 'RUN !!!'으로 초기화하세요.")


def render_table_header():
    """Render the table header."""
    h_no, h_chart, h_info, h_res, h_notes = st.columns([0.5, 2.4, 1.1, 1.0, 1.4])
    h_no.subheader("Id")
    h_chart.subheader("Chart")
    h_info.subheader("Informations")
    h_res.subheader("MODEL_RESULT")
    h_notes.subheader("Notes")


def render_data_row(row_data: Dict, notes_map: Dict):
    """Render a single data row.
    
    Args:
        row_data: Dictionary containing row data
        notes_map: Dictionary mapping row numbers to notes
    """
    row_no = int(row_data["no"])  # display only
    is_real = row_data.get("model_result", "N/A")

    c_no, c_chart, c_info, c_res, c_notes = st.columns([0.5, 2.4, 1.1, 1.0, 1.4], gap="medium")

    # Column 1: Variant ID
    with c_no:
        variant_id = row_data.get("variant_id", "N/A")
        st.caption(f"{variant_id}")

    # Column 2: Chart
    with c_chart:
        plot_data = row_data.get("plot_data", {})
        if plot_data and plot_data.get("value"):
            # Lazy activation per variant_id
            variant_id_for_chart = row_data.get("variant_id", "")
            active_key = f"active_chart_{variant_id_for_chart}"
            if active_key not in st.session_state:
                st.session_state[active_key] = False

            if USE_CLICK_TO_ACTIVATE and not st.session_state[active_key]:
                # Render lightweight thumbnail for preview
                preview_fig = create_thumbnail_chart(plot_data)

                if plotly_events is not None:
                    # Use plotly_events to detect a single left click on the chart area
                    events = plotly_events(
                        preview_fig,
                        click_event=True,
                        hover_event=False,
                        select_event=False,
                        override_height=220,
                        key=f"pe_{variant_id_for_chart}",
                    )
                    if events:
                        now = time.time()
                        ts_key = f"last_click_ts_{variant_id_for_chart}"
                        last = st.session_state.get(ts_key, 0.0)
                        # consider double-click if within 0.5s
                        if now - last <= 0.5:
                            st.session_state[active_key] = True
                            st.session_state[ts_key] = 0.0
                            st.rerun()
                        else:
                            st.session_state[ts_key] = now
                else:
                    # Fallback: show static thumbnail; user can press a small activate text button
                    st.plotly_chart(
                        preview_fig,
                        use_container_width=True,
                        config={"displayModeBar": False, "staticPlot": True},
                    )
                    if st.button("Activate", key=f"activate_{variant_id_for_chart}"):
                        st.session_state[active_key] = True
                        st.rerun()
            else:
                fig = create_timeseries_chart(plot_data)
                st.plotly_chart(
                    fig,
                    use_container_width=True,
                    config={
                        "displayModeBar": False,
                        "staticPlot": False,
                        "scrollZoom": False,
                        "doubleClick": "reset",
                        "responsive": True,
                    },
                )
        else:
            st.warning("No data available for plotting")

    # Column 3: Information
    with c_info:
        info_text = row_data.get("info_text", "")
        desc = row_data.get("desc", "")
        st.markdown(info_text)
        if desc:
            st.caption(desc)

    # Column 4: Model Result
    with c_res:
        verdict = True if is_real else "FALSE"
        color = "#2e7d32" if is_real else "#b71c1c"
        st.markdown(f"<b style='color:{color};'>{verdict}</b>", unsafe_allow_html=True)

    # Column 5: Notes
    with c_notes:
        variant_id = row_data.get("variant_id", "")
        existing, existing_updated = notes_map.get(variant_id, ("", ""))
        key = f"note_input_{variant_id}"
        key_updated = f"note_updated_{variant_id}"

        if key not in st.session_state:
            st.session_state[key] = existing
        if key_updated not in st.session_state:
            st.session_state[key_updated] = existing_updated

        if st.session_state.get(key_updated):
            kst_str = utc_iso_to_kst_label(st.session_state.get(key_updated))
            st.caption(f"Last saved: {kst_str}")

        st.text_area(
            f"Note for {variant_id}", 
            key=key, 
            height=120, 
            label_visibility="collapsed",
            placeholder="Text your comments here...",
        )

        if st.button("Save", key=f"save_{variant_id}"):
            current = st.session_state.get(key, "")
            updated = save_note(variant_id, current)
            st.session_state[key_updated] = updated
            st.success(f"Saved.")


"""Chart creation utilities for time series visualization."""
from __future__ import annotations
import plotly.express as px
import plotly.graph_objects as go
import pandas as pd
from typing import Dict, List


def create_timeseries_chart(plot_data: Dict, max_points: int = 4000) -> go.Figure:
    """Create a time series chart with spec bands.
    
    Args:
        plot_data: Dictionary containing:
            - act_date: list of dates
            - value: list of values
            - spec_lower: optional list of lower spec limits
            - spec_upper: optional list of upper spec limits
    
    Returns:
        Plotly Figure object
    """
    # Convert plot data to DataFrame
    values = plot_data["value"]
    acts = plot_data["act_date"]
    n = len(values)
    # Downsample for performance on very long series
    idxs = _downsample_indices(n, max_points)
    df_plot = pd.DataFrame({
        "act_date": [acts[i] for i in idxs],
        "value": [values[i] for i in idxs],
    })
    
    df_plot = df_plot.sort_values("act_date")
    df_plot["t"] = range(len(df_plot))
    
    # Add spec bands
    if plot_data.get("spec_lower") and plot_data.get("spec_upper"):
        lowers = plot_data["spec_lower"]
        uppers = plot_data["spec_upper"]
        df_plot["lower"] = [lowers[i] for i in idxs]
        df_plot["upper"] = [uppers[i] for i in idxs]
    else:
        # Create simple spec bands based on data statistics
        mean_val = df_plot["value"].mean()
        std_val = df_plot["value"].std()
        df_plot["lower"] = mean_val - 2 * std_val
        df_plot["upper"] = mean_val + 2 * std_val
    
    # Mark outliers
    df_plot["out"] = (df_plot["value"] < df_plot["lower"]) | (df_plot["value"] > df_plot["upper"])
    
    # Create scatter plot
    fig = px.scatter(
        df_plot, x="t", y="value",
        color="out", symbol="out",
        color_discrete_map={False: "#1f77b4", True: "#d62728"},
        symbol_map={False: "circle", True: "triangle-up"},
        render_mode="webgl",  # use WebGL for performance
    )
    
    # Add upper spec line
    fig.add_trace(go.Scatter(
        x=df_plot["t"], 
        y=df_plot["upper"], 
        mode="lines",
        line=dict(width=0.6, color="#88cc88"), 
        line_shape="hv", 
        showlegend=False
    ))
    
    # Add lower spec line with fill
    fig.add_trace(go.Scatter(
        x=df_plot["t"], 
        y=df_plot["lower"], 
        mode="lines",
        line=dict(width=0.6, color="#88cc88"), 
        fill="tonexty",
        fillcolor="rgba(179,255,179,0.20)", 
        line_shape="hv", 
        showlegend=False
    ))
    
    # Update layout for better appearance
    fig.update_layout(
        margin=dict(l=0, r=0, t=10, b=0), 
        height=220,
    )
    
    return fig


def _downsample_indices(n: int, max_points: int) -> List[int]:
    if n <= 0:
        return []
    if n <= max_points:
        return list(range(n))
    step = max(1, n // max_points)
    idxs = list(range(0, n, step))
    if idxs[-1] != n - 1:
        idxs.append(n - 1)
    return idxs


def create_thumbnail_chart(plot_data: Dict, max_points: int = 200) -> go.Figure:
    """Create a lightweight static thumbnail chart.
    - Downsamples to at most `max_points`
    - No legends, small height, static rendering
    """
    values = plot_data.get("value", [])
    acts = plot_data.get("act_date", [])
    n = len(values)
    idxs = _downsample_indices(n, max_points)

    df_plot = pd.DataFrame({
        "act_date": [acts[i] for i in idxs] if acts else [],
        "value": [values[i] for i in idxs] if values else [],
    })
    df_plot = df_plot.sort_values("act_date")
    df_plot["t"] = range(len(df_plot))

    fig = px.line(df_plot, x="t", y="value")
    fig.update_traces(line=dict(width=1.0), hoverinfo="skip")
    fig.update_layout(
        margin=dict(l=0, r=0, t=4, b=0), height=120, showlegend=False,
        xaxis=dict(visible=False), yaxis=dict(visible=False)
    )
    return fig


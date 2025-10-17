import ReactECharts from "echarts-for-react";
import React, { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { loadChartDataSingle } from "../../services/data";
import { buildChartOption } from "./chartOptions";

interface LazyChartProps {
  taskId: string;
  days: number;
  dataAttr: string;
  isActive: boolean;
  onActivate: () => void;
}

export const LazyChart = React.memo(({ 
  taskId, 
  days, 
  dataAttr, 
  isActive, 
  onActivate 
}: LazyChartProps) => {
  const chartRef = useRef<ReactECharts>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // All charts start as static, only clicked chart becomes interactive
  const isInteractive = isActive;
  
  const { data: chartData, isLoading, isError } = useQuery({
    queryKey: ["chartData", taskId, days],
    queryFn: () => loadChartDataSingle(taskId, days),
    enabled: !!taskId,
    staleTime: 5 * 60 * 1000,
  });

  const chartOption = useMemo(() => {
    if (isLoading || isError || !chartData || !chartData.data) {
      return {
        animation: false,
        backgroundColor: "var(--bg-card)",
        grid: { left: 50, right: 90, top: 50, bottom: 60 },
        xAxis: { type: "time" },
        yAxis: { type: "value" },
        series: []
      };
    }
    
    const data = chartData.data;
    
    // For performance, sample data for both static and initial interactive mode
    if (data.act_date.length > 2000) {
      const step = Math.max(1, Math.floor(data.act_date.length / 2000)); // Show max 2000 points
      const sampledData = {
        act_date: data.act_date.filter((_, i) => i % step === 0),
        value: data.value.filter((_, i) => i % step === 0),
        spec_lower: data.spec_lower ? data.spec_lower.filter((_, i) => i % step === 0) : [],
        spec_upper: data.spec_upper ? data.spec_upper.filter((_, i) => i % step === 0) : []
      };
      return buildChartOption(sampledData, isInteractive);
    }
    
    return buildChartOption(data, isInteractive);
  }, [chartData, isInteractive, isLoading, isError]);

  const handleChartClick = useCallback((e: any) => {
    onActivate();
  }, [onActivate, isInteractive, taskId, isActive]);

  // Add event listeners for mouse wheel and drag prevention
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (isInteractive) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (isInteractive) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    if (isInteractive) {
      container.addEventListener('wheel', handleWheel, { passive: false });
      container.addEventListener('mousedown', handleMouseDown, { passive: false });
    }

    return () => {
      container.removeEventListener('wheel', handleWheel);
      container.removeEventListener('mousedown', handleMouseDown);
    };
  }, [isInteractive]);

  if (isLoading) {
    return (
      <div style={{ 
        height: 300, 
        display: "flex", 
        alignItems: "center", 
        justifyContent: "center",
        color: "var(--text-secondary)",
        fontSize: 14
      }}>
        Loading chart...
      </div>
    );
  }

  if (isError || !chartData || !chartData.data) {
    return (
      <div style={{ 
        height: 300, 
        display: "flex", 
        alignItems: "center", 
        justifyContent: "center",
        color: "var(--text-secondary)",
        fontSize: 14
      }}>
        No data available
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      data-variant-id={dataAttr}
      onClick={handleChartClick}
      style={{
        cursor: "pointer",
        border: isActive ? "2px solid var(--primary)" : "2px solid transparent",
        borderRadius: "4px",
        transition: "border-color 0.2s ease",
        position: "relative"
      }}
    >
      {/* Mode indicator */}
      <div style={{
        position: "absolute",
        top: 4,
        right: 4,
        background: isInteractive ? "var(--primary)" : "var(--text-secondary)",
        color: "white",
        padding: "2px 6px",
        borderRadius: "3px",
        fontSize: 11,
        fontWeight: 600,
        zIndex: 10
      }}>
        {isInteractive ? "INTERACTIVE" : "STATIC"}
      </div>
      
      {/* Click to activate hint */}
      {!isInteractive && (
        <div style={{
          position: "absolute",
          top: 4,
          left: 4,
          background: "rgba(0,0,0,0.7)",
          color: "white",
          padding: "2px 6px",
          borderRadius: "3px",
          fontSize: 10,
          zIndex: 10
        }}>
          Click to activate
        </div>
      )}
      
      <ReactECharts
        ref={chartRef}
        option={chartOption}
        style={{ height: 300, width: "100%" }}
        onEvents={{
          click: handleChartClick
        }}
        opts={{
          renderer: "canvas"
        }}
        notMerge={true}
        lazyUpdate={true}
      />
    </div>
  );
});

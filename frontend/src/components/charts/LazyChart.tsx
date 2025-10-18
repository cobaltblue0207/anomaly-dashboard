import ReactECharts from "echarts-for-react";
import React, { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { loadChartDataSingle } from "../../services/data";
import { buildChartOption } from "./chartOptions";
import { useOptimizedChartQuery } from "../../utils/cacheStrategy";

interface LazyChartProps {
  taskId: string;
  days: number;
  dataAttr: string;
  isActive: boolean;
  onActivate: () => void;
  onLoadingStart?: (chartId: string) => void;
  onLoadingFinish?: (chartId: string) => void;
  isAllChartsCompleted?: boolean;
}

export const LazyChart = React.memo(({ 
  taskId, 
  days, 
  dataAttr, 
  isActive, 
  onActivate,
  onLoadingStart,
  onLoadingFinish,
  isAllChartsCompleted
}: LazyChartProps) => {
  const chartRef = useRef<ReactECharts>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // All charts start as static, only clicked chart becomes interactive
  const isInteractive = isActive;
  
  const { data: chartData, isLoading, isError } = useOptimizedChartQuery(taskId, days);
  
  const chartId = `${taskId}-${days}`;
  
  // 로딩 상태 추적 (한 번만 실행)
  const [hasReportedLoading, setHasReportedLoading] = useState(false);
  const [hasReportedFinish, setHasReportedFinish] = useState(false);

  // 컴포넌트 마운트 시 로딩 시작 보고 (한 번만 실행)
  useEffect(() => {
    if (onLoadingStart && !hasReportedLoading) {
      onLoadingStart(chartId);
      setHasReportedLoading(true);
    }
  }, [chartId, onLoadingStart, hasReportedLoading]);

  // 데이터 로딩 완료 시 완료 보고
  useEffect(() => {
    if (!isLoading && !isError && chartData && onLoadingFinish && !hasReportedFinish) {
      // 데이터가 있을 때만 완료로 처리
      onLoadingFinish(chartId);
      setHasReportedFinish(true);
    }
  }, [isLoading, isError, chartId, onLoadingFinish, chartData, hasReportedFinish]);

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
        act_date: data.act_date.filter((_: any, i: number) => i % step === 0),
        value: data.value.filter((_: any, i: number) => i % step === 0),
        spec_lower: data.spec_lower ? data.spec_lower.filter((_: any, i: number) => i % step === 0) : [],
        spec_upper: data.spec_upper ? data.spec_upper.filter((_: any, i: number) => i % step === 0) : []
      };
      return buildChartOption(sampledData, isInteractive);
    }
    
    return buildChartOption(data, isInteractive);
  }, [chartData, isInteractive, isLoading, isError]);

  const handleStaticLabelClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onActivate();
  }, [onActivate]);

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
      style={{
        cursor: isInteractive ? "grab" : "default",
        border: isActive ? "2px solid var(--primary)" : "2px solid transparent",
        borderRadius: "4px",
        transition: "border-color 0.2s ease",
        position: "relative"
      }}
    >
      {/* Mode indicator - only show when all charts are completed */}
      {isAllChartsCompleted && (
        <div 
          onClick={!isInteractive ? handleStaticLabelClick : undefined}
          style={{
            position: "absolute",
            top: 4,
            right: 4,
            background: isInteractive ? "var(--primary)" : "var(--text-secondary)",
            color: "white",
            padding: "2px 6px",
            borderRadius: "3px",
            fontSize: 11,
            fontWeight: 600,
            zIndex: 10,
            cursor: !isInteractive ? "pointer" : "default",
            userSelect: "none"
          }}
        >
          {isInteractive ? "INTERACTIVE" : "STATIC"}
        </div>
      )}
      
      {/* Click to activate hint - only show when all charts are completed */}
      {isAllChartsCompleted && !isInteractive && (
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
          Click STATIC to activate
        </div>
      )}
      
      <ReactECharts
        ref={chartRef}
        option={chartOption}
        style={{ height: 300, width: "100%" }}
        opts={{
          renderer: "canvas"
        }}
        notMerge={true}
        lazyUpdate={true}
      />
    </div>
  );
});

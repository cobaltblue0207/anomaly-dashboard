// Common utility functions
function getThemeColors() {
  return {
    textSecondary: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim(),
    bgCard: getComputedStyle(document.documentElement).getPropertyValue('--bg-card').trim(),
    primary: getComputedStyle(document.documentElement).getPropertyValue('--primary').trim(),
    errorColor: getComputedStyle(document.documentElement).getPropertyValue('--error-color').trim(),
  };
}

function processChartData(data: any) {
  const v: number[] = data?.value || [];
  const lower: number[] = data?.spec_lower || [];
  const upper: number[] = data?.spec_upper || [];
  const dates: string[] = data?.act_date || [];
  const n = v.length;

  const inside: number[][] = [];
  const outside: number[][] = [];
  const lowerPts: number[][] = [];
  const upperPts: number[][] = [];
  
  for (let i = 0; i < n; i++) {
    const lv = lower?.[i];
    const uv = upper?.[i];
    const val = v[i];
    const x = dates[i] ? Date.parse(dates[i]) : i;
    if (lv != null && uv != null) {
      lowerPts.push([x, lv]);
      upperPts.push([x, uv]);
      if (val < lv || val > uv) outside.push([x, val]);
      else inside.push([x, val]);
    } else {
      inside.push([x, val]);
    }
  }

  return { v, lower, upper, dates, inside, outside, lowerPts, upperPts };
}

function createBaseChartOption(isInteractive: boolean) {
  const { textSecondary, bgCard } = getThemeColors();
  
  return {
    animation: false,
    animationDuration: 0,
    animationEasing: 'linear' as const,
    backgroundColor: bgCard,
    grid: { left: 50, right: 90, top: 50, bottom: 60 },
    tooltip: isInteractive ? { 
      trigger: "axis" as const,
      backgroundColor: bgCard,
      borderColor: textSecondary,
      textStyle: { color: textSecondary }
    } : { show: false },
    xAxis: {
      type: "time" as const,
      name: "act_date",
      nameLocation: "middle" as const,
      nameGap: 44,
      nameTextStyle: { color: textSecondary },
      axisLabel: {
        color: textSecondary,
        rotate: 45,
        formatter(value: number) {
          const d = new Date(value);
          return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(
            d.getDate()
          ).padStart(2, "0")}`;
        },
      },
      axisLine: { lineStyle: { color: textSecondary } },
      splitLine: { lineStyle: { color: textSecondary, opacity: 0.1 } },
    },
    yAxis: {
      type: "value" as const,
      name: "value",
      nameTextStyle: { color: textSecondary },
      axisLabel: { color: textSecondary },
      axisLine: { lineStyle: { color: textSecondary } },
      splitLine: { lineStyle: { color: textSecondary, opacity: 0.1 } },
    },
    dataZoom: isInteractive ? [
      {
        type: "inside" as const,
        xAxisIndex: 0,
        filterMode: "none" as const,
        zoomOnMouseWheel: true,
        moveOnMouseMove: true,
        moveOnMouseWheel: false,
        preventDefaultMouseMove: true,
      },
      {
        type: "inside" as const,
        yAxisIndex: 0,
        filterMode: "none" as const,
        zoomOnMouseWheel: true,
        moveOnMouseMove: true,
        moveOnMouseWheel: false,
        preventDefaultMouseMove: true,
      },
    ] : [],
  };
}

function createChartSeries(v: number[], lower: number[], upper: number[], dates: string[], inside: number[][], outside: number[][], lowerPts: number[][]) {
  const { primary, errorColor } = getThemeColors();
  
  return [
    lowerPts.length > 0
      ? {
          name: "Spec Upper",
          type: "line" as const,
          data: dates.map((d, i) => [
            d ? Date.parse(d) : i,
            upper?.[i] ?? v[i],
          ]),
          symbol: "none" as const,
          lineStyle: { width: 0.8, color: "#10b981" },
          tooltip: { show: false },
          animation: false,
          animationDuration: 0
        }
      : null,
    lowerPts.length > 0
      ? {
          name: "Spec Lower",
          type: "line" as const,
          data: dates.map((d, i) => [
            d ? Date.parse(d) : i,
            lower?.[i] ?? v[i],
          ]),
          symbol: "none" as const,
          lineStyle: { width: 0.8, color: "#10b981" },
          tooltip: { show: false },
          animation: false,
          animationDuration: 0
        }
      : null,
    {
      name: "Value",
      type: "scatter" as const,
      data: inside,
      symbolSize: 5,
      itemStyle: { color: primary },
      animation: false,
      animationDuration: 0
    },
    {
      name: "Value",
      type: "scatter" as const,
      data: outside,
      symbolSize: 6,
      itemStyle: { color: errorColor },
      animation: false,
      animationDuration: 0
    },
  ].filter(Boolean);
}

export function buildChartOption(chartData: any, isInteractive: boolean = false) {
  const { v, lower, upper, dates, inside, outside, lowerPts } = processChartData(chartData);
  
  return {
    ...createBaseChartOption(isInteractive),
    series: createChartSeries(v, lower, upper, dates, inside, outside, lowerPts),
  };
}

export function buildOption(row: any, isActive: boolean = false, chartData?: any) {
  const isInteractive = isActive;
  const data = chartData || row.plot_data;
  const { v, lower, upper, dates, inside, outside, lowerPts } = processChartData(data);
  
  return {
    ...createBaseChartOption(isInteractive),
    series: createChartSeries(v, lower, upper, dates, inside, outside, lowerPts),
  };
}

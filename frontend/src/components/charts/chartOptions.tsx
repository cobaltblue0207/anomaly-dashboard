export function buildChartOption(chartData: any, isInteractive: boolean = false) {
  const v: number[] = chartData?.value || [];
  const lower: number[] = chartData?.spec_lower || [];
  const upper: number[] = chartData?.spec_upper || [];
  const dates: string[] = chartData?.act_date || [];
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

  // Get CSS variables for theme colors
  const textSecondary = getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim();
  const bgCard = getComputedStyle(document.documentElement).getPropertyValue('--bg-card').trim();
  const primary = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim();
  const errorColor = getComputedStyle(document.documentElement).getPropertyValue('--error-color').trim();

  return {
    animation: false,  // Disable animation for better performance
    animationDuration: 0,  // No animation duration
    animationEasing: 'linear',  // Fastest easing
    backgroundColor: bgCard,
    grid: { left: 50, right: 90, top: 50, bottom: 60 },
    tooltip: isInteractive ? { 
      trigger: "axis",
      backgroundColor: bgCard,
      borderColor: textSecondary,
      textStyle: { color: textSecondary }
    } : { show: false },
    xAxis: {
      type: "time",
      name: "act_date",
      nameLocation: "middle",
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
      type: "value",
      name: "value",
      nameTextStyle: { color: textSecondary },
      axisLabel: { color: textSecondary },
      axisLine: { lineStyle: { color: textSecondary } },
      splitLine: { lineStyle: { color: textSecondary, opacity: 0.1 } },
    },
    // Only enable dataZoom for interactive charts
    dataZoom: isInteractive ? [
      {
        type: "inside",
        xAxisIndex: 0,
        filterMode: "none", // Keep all data points
        zoomOnMouseWheel: true,
        moveOnMouseMove: true,
        moveOnMouseWheel: false,
        preventDefaultMouseMove: true,
      },
      {
        type: "inside",
        yAxisIndex: 0,
        filterMode: "none", // Keep all data points
        zoomOnMouseWheel: true,
        moveOnMouseMove: true,
        moveOnMouseWheel: false,
        preventDefaultMouseMove: true,
      },
    ] : [], // Disable dataZoom for static charts
    series: [
      lowerPts.length > 0
        ? {
            name: "Spec Upper",
            type: "line",
            data: dates.map((d, i) => [
              d ? Date.parse(d) : i,
              upper?.[i] ?? v[i],
            ]),
            symbol: "none",
            lineStyle: { width: 0.8, color: "#10b981" }, // Green
            tooltip: { show: false },
            animation: false,
            animationDuration: 0
          }
        : null,
      lowerPts.length > 0
        ? {
            name: "Spec Lower",
            type: "line",
            data: dates.map((d, i) => [
              d ? Date.parse(d) : i,
              lower?.[i] ?? v[i],
            ]),
            symbol: "none",
            lineStyle: { width: 0.8, color: "#10b981" }, // Green
            tooltip: { show: false },
            animation: false,
            animationDuration: 0
          }
        : null,
      {
        name: "Value",
        type: "scatter",
        data: inside,
        symbolSize: 5,
        itemStyle: { color: primary }, // Use theme primary color
        animation: false,
        animationDuration: 0
      },
      {
        name: "Value",
        type: "scatter",
        data: outside,
        symbolSize: 6,
        itemStyle: { color: errorColor }, // Use theme error color
        animation: false,
        animationDuration: 0
      },
    ].filter(Boolean),
  };
}

export function buildOption(row: any, isActive: boolean = false, chartData?: any) {
  const isInteractive = isActive;
  // Use provided chartData or fallback to row.plot_data
  const data = chartData || row.plot_data;
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

  // Get CSS variables for theme colors
  const textSecondary = getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim();
  const bgCard = getComputedStyle(document.documentElement).getPropertyValue('--bg-card').trim();
  const primary = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim();
  const errorColor = getComputedStyle(document.documentElement).getPropertyValue('--error-color').trim();

  return {
    animation: false,  // Disable animation for better performance
    animationDuration: 0,  // No animation duration
    animationEasing: 'linear',  // Fastest easing
    backgroundColor: bgCard,
    grid: { left: 50, right: 90, top: 50, bottom: 60 },
    tooltip: isInteractive ? { 
      trigger: "axis",
      backgroundColor: bgCard,
      borderColor: textSecondary,
      textStyle: { color: textSecondary }
    } : { show: false },
    xAxis: {
      type: "time",
      name: "act_date",
      nameLocation: "middle",
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
      type: "value",
      name: "value",
      nameTextStyle: { color: textSecondary },
      axisLabel: { color: textSecondary },
      axisLine: { lineStyle: { color: textSecondary } },
      splitLine: { lineStyle: { color: textSecondary, opacity: 0.1 } },
    },
    // Only enable dataZoom for active charts
    dataZoom: isInteractive ? [
      {
        type: "inside",
        xAxisIndex: 0,
        filterMode: "none", // Keep all data points
        zoomOnMouseWheel: true,
        moveOnMouseMove: true,
        moveOnMouseWheel: false,
        preventDefaultMouseMove: true,
      },
      {
        type: "inside",
        yAxisIndex: 0,
        filterMode: "none", // Keep all data points
        zoomOnMouseWheel: true,
        moveOnMouseMove: true,
        moveOnMouseWheel: false,
        preventDefaultMouseMove: true,
      },
    ] : [], // Disable dataZoom for static charts
    series: [
      lowerPts.length > 0
        ? {
            name: "Spec Upper",
            type: "line",
            data: dates.map((d, i) => [
              d ? Date.parse(d) : i,
              upper?.[i] ?? v[i],
            ]),
            symbol: "none",
            lineStyle: { width: 0.8, color: "#10b981" }, // Green
            tooltip: { show: false },
            animation: false,
            animationDuration: 0
          }
        : null,
      lowerPts.length > 0
        ? {
            name: "Spec Lower",
            type: "line",
            data: dates.map((d, i) => [
              d ? Date.parse(d) : i,
              lower?.[i] ?? v[i],
            ]),
            symbol: "none",
            lineStyle: { width: 0.8, color: "#10b981" }, // Green
            tooltip: { show: false },
            animation: false,
            animationDuration: 0
          }
        : null,
      {
        name: "Value",
        type: "scatter",
        data: inside,
        symbolSize: 5,
        itemStyle: { color: primary }, // Use theme primary color
        animation: false,
        animationDuration: 0
      },
      {
        name: "Value",
        type: "scatter",
        data: outside,
        symbolSize: 6,
        itemStyle: { color: errorColor }, // Use theme error color
        animation: false,
        animationDuration: 0
      },
    ].filter(Boolean),
  };
}

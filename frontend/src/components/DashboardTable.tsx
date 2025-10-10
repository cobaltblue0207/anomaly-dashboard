import ReactECharts from "echarts-for-react";
import React, { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { loadNotes, saveNote, loadChartDataSingle } from "../services/data";
import { exportToExcel } from "../utils/excelExport";
import {
  useReactTable,
  getCoreRowModel,
  createColumnHelper,
  flexRender,
  ColumnResizeMode,
  getSortedRowModel,
  SortingState,
  ColumnOrderState,
  VisibilityState,
  getFilteredRowModel,
  ColumnFiltersState,
} from "@tanstack/react-table";

// Lazy Chart Component
const LazyChart = React.memo(({ taskId, days, dataAttr }: { taskId: string; days: number; dataAttr: string }) => {
  const { data: chartData, isLoading, isError } = useQuery({
    queryKey: ["chartData", taskId, days],
    queryFn: () => loadChartDataSingle(taskId, days),
    enabled: !!taskId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

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

  const option = buildChartOption(chartData.data);

  return (
    <div data-variant-id={dataAttr}>
      <ReactECharts
        style={{
          height: 300,
          width: "100%",
          minWidth: 500,
        }}
        option={option}
        opts={{ renderer: "canvas" }}
        notMerge
        lazyUpdate
      />
    </div>
  );
});

function buildChartOption(chartData: any) {
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
    backgroundColor: bgCard,
    grid: { left: 50, right: 90, top: 50, bottom: 60 },
    tooltip: { 
      trigger: "axis",
      backgroundColor: bgCard,
      borderColor: textSecondary,
      textStyle: { color: textSecondary }
    },
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
    dataZoom: [
      {
        type: "inside",
        xAxisIndex: 0,
        zoomOnMouseWheel: true,
        moveOnMouseMove: true,
        moveOnMouseWheel: false,
        preventDefaultMouseMove: true,
      },
      {
        type: "inside",
        yAxisIndex: 0,
        zoomOnMouseWheel: true,
        moveOnMouseMove: true,
        moveOnMouseWheel: false,
        preventDefaultMouseMove: true,
      },
    ],
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
            tooltip: { show: false }
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
            tooltip: { show: false }
          }
        : null,
      {
        name: "Value",
        type: "scatter",
        data: inside,
        symbolSize: 5,
        itemStyle: { color: primary }, // Use theme primary color
      },
      {
        name: "Value",
        type: "scatter",
        data: outside,
        symbolSize: 6,
        itemStyle: { color: errorColor }, // Use theme error color
      },
    ].filter(Boolean),
  };
}

function buildOption(row: any, chartData?: any) {
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
    animation: false,
    backgroundColor: bgCard,
    grid: { left: 50, right: 90, top: 50, bottom: 60 },
    tooltip: { 
      trigger: "axis",
      backgroundColor: bgCard,
      borderColor: textSecondary,
      textStyle: { color: textSecondary }
    },
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
    dataZoom: [
      {
        type: "inside",
        xAxisIndex: 0,
        zoomOnMouseWheel: true,
        moveOnMouseMove: true,
        moveOnMouseWheel: false,
        preventDefaultMouseMove: true,
      },
      {
        type: "inside",
        yAxisIndex: 0,
        zoomOnMouseWheel: true,
        moveOnMouseMove: true,
        moveOnMouseWheel: false,
        preventDefaultMouseMove: true,
      },
    ],
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
            lineStyle: { width: 0.8, color: "#10b981" },
            sampling: "lttb",
            smooth: false,
            z: 1,
            tooltip: { show: false },
          }
        : {},
      lowerPts.length > 0
        ? {
            name: "Spec Lower",
            type: "line",
            data: lowerPts,
            symbol: "none",
            lineStyle: { width: 0.8, color: "#10b981" },
            sampling: "lttb",
            smooth: false,
            z: 1,
            tooltip: { show: false },
          }
        : {},
      {
        name: "Value",
        type: "scatter",
        data: inside,
        symbolSize: 4,
        itemStyle: { color: primary },
        large: true,
        progressive: 4000,
        z: 2,
      },
      {
        name: "Value",
        type: "scatter",
        data: outside,
        symbol: "triangle",
        symbolSize: 6,
        itemStyle: { color: errorColor },
        large: true,
        progressive: 4000,
        z: 2,
      },
    ].filter(Boolean as any),
  };
}

const columnHelper = createColumnHelper<any>();

interface DashboardTableProps {
  rows: any[];
  sessionUserId: string;
  filterUserId: string;
  notesData?: Record<string, any>;
}

export function DashboardTable({ rows, sessionUserId, filterUserId, notesData }: DashboardTableProps) {
  const qc = useQueryClient();
  // Detect schema version from first row
  const isV2Schema = rows.length > 0 && "MASTER_TASK_ID" in rows[0];
  
  const variantIds = useMemo(
    () => rows.map((r) => String(r.variant_id || r.MASTER_TASK_ID || "")),
    [rows]
  );
  
  // Extract pattern from first row (V2: use "ALL", Legacy: use tag)
  const pattern = useMemo(() => isV2Schema ? "ALL" : (rows[0]?.tag || ""), [rows, isV2Schema]);
  
  // Use filterUserId if provided, otherwise use sessionUserId
  const targetUserId = filterUserId || sessionUserId;
  
  // Use notes data from props if available (from combined API), otherwise fetch separately
  // Store in state to trigger column re-creation when notes are loaded
  const [notesMap, setNotesMap] = useState<Record<string, any>>({});
  
  // Initialize notesMap from props
  useEffect(() => {
    if (notesData) {
      setNotesMap(notesData);
    }
  }, [notesData]);

  // Use ref to store drafts and saving state to avoid re-creating columns
  const draftsRef = useRef<Record<string, string>>({});
  const isSavingRef = useRef<Record<string, boolean>>({});
  
  const mSave = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) => {
      return saveNote(targetUserId, pattern, id, note, sessionUserId);
    },
    onMutate: (vars) => {
      isSavingRef.current[vars.id] = true;
    },
    onSuccess: (data, vars) => {
      // Update notesMap with the response data
      setNotesMap(prev => ({
        ...prev,
        [vars.id]: {
          ...prev[vars.id],
          note: vars.note,
          created_at: data.created_at,
          updated_at: data.updated_at,
          updated_by: data.updated_by,
          created_by: data.created_by,
        }
      }));
      
      qc.invalidateQueries({ queryKey: ["notes", targetUserId, pattern] });
      draftsRef.current[vars.id] = vars.note;
      isSavingRef.current[vars.id] = false;
    },
    onError: (_error, vars) => {
      isSavingRef.current[vars.id] = false;
    },
  });

  // Detect schema version from first row
  const isV2 = rows.length > 0 && "MASTER_TASK_ID" in rows[0];

  const [columnResizeMode] = useState<ColumnResizeMode>("onChange");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  
  // Define column order based on schema version
  const defaultColumnOrder = isV2
    ? [
        "MASTER_TASK_ID",
        "LINE",
        "AREA",
        "PROD_EQP_ID",
        "PARAM_SUBITEM",
        "PPID",
        "RECIPEID",
        "CH_STEP",
        "MODEL_RESULT_INFO",
        "COMMENTS",
        "30D",
        "60D",
        "notes",
      ]
    : [
    "variant_id",
    "plot_data",
    "info_text",
    "pattern",
    "model_result",
    "notes",
      ];
  
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>(defaultColumnOrder);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [columnPinning, setColumnPinning] = useState<{
    left?: string[];
    right?: string[];
  }>({ left: [], right: [] });

  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);
  
  // Update column order when schema version changes
  useEffect(() => {
    setColumnOrder(defaultColumnOrder);
  }, [isV2]);

  const columns = useMemo<any[]>(
    () => {
      // V2 Schema columns - ordered to match frame_data.parquet
      if (isV2) {
        return [
          // 1. MASTER_TASK_ID
          columnHelper.accessor((row: any) => row.MASTER_TASK_ID || row.variant_id, {
            id: "MASTER_TASK_ID",
            header: "MASTER_TASK_ID",
            size: 180,
            minSize: 120,
            maxSize: 350,
            enableSorting: true,
            enableColumnFilter: true,
            filterFn: "includesString",
            cell: (info) => (
              <div className="variant-pill">{info.getValue()}</div>
            ),
          }),
          // 2. LINE
          columnHelper.accessor("LINE", {
            id: "LINE",
            header: "LINE",
            size: 100,
            minSize: 80,
            maxSize: 150,
            enableSorting: true,
            enableColumnFilter: true,
            filterFn: "includesString",
            cell: (info) => (
              <div style={{ textAlign: "center", fontWeight: 500 }}>{info.getValue()}</div>
            ),
          }),
          // 3. AREA
          columnHelper.accessor("AREA", {
            id: "AREA",
            header: "AREA",
            size: 100,
            minSize: 80,
            maxSize: 150,
            enableSorting: true,
            enableColumnFilter: true,
            filterFn: "includesString",
            cell: (info) => (
              <div style={{ textAlign: "center", fontWeight: 500 }}>{info.getValue()}</div>
            ),
          }),
          // 4. PROD_EQP_ID
          columnHelper.accessor("PROD_EQP_ID", {
            id: "PROD_EQP_ID",
            header: "Equipment",
            size: 120,
            minSize: 100,
            maxSize: 200,
            enableSorting: true,
            enableColumnFilter: true,
            filterFn: "includesString",
            cell: (info) => (
              <div style={{ textAlign: "center" }}>{info.getValue()}</div>
            ),
          }),
          // 5. PARAM_SUBITEM
          columnHelper.accessor("PARAM_SUBITEM", {
            id: "PARAM_SUBITEM",
            header: "Parameter",
            size: 200,
            minSize: 150,
            maxSize: 350,
            enableSorting: true,
            enableColumnFilter: true,
            filterFn: "includesString",
            cell: (info) => (
              <div style={{ fontSize: 13 }}>{info.getValue()}</div>
            ),
          }),
          // 6. PPID
          columnHelper.accessor("PPID", {
            id: "PPID",
            header: "PPID",
            size: 120,
            minSize: 100,
            maxSize: 200,
            enableSorting: true,
            enableColumnFilter: true,
            filterFn: "includesString",
            cell: (info) => (
              <div style={{ textAlign: "center" }}>{info.getValue()}</div>
            ),
          }),
          // 7. RECIPEID
          columnHelper.accessor("RECIPEID", {
            id: "RECIPEID",
            header: "Recipe",
            size: 120,
            minSize: 100,
            maxSize: 200,
            enableSorting: true,
            enableColumnFilter: true,
            filterFn: "includesString",
            cell: (info) => (
              <div style={{ textAlign: "center" }}>{info.getValue()}</div>
            ),
          }),
          // 8. CH_STEP
          columnHelper.accessor("CH_STEP", {
            id: "CH_STEP",
            header: "Step",
            size: 120,
            minSize: 100,
            maxSize: 200,
            enableSorting: true,
            enableColumnFilter: true,
            filterFn: "includesString",
            cell: (info) => (
              <div style={{ textAlign: "center" }}>{info.getValue()}</div>
            ),
          }),
          // 9. MODEL_RESULT_INFO
          columnHelper.accessor("MODEL_RESULT_INFO", {
            id: "MODEL_RESULT_INFO",
            header: "Model Result",
            size: 120,
            minSize: 100,
            maxSize: 200,
            enableSorting: true,
            enableColumnFilter: true,
            filterFn: "includesString",
            cell: (info) => (
              <div style={{ 
                textAlign: "center", 
                fontWeight: 600,
                color: info.getValue() === "TRUE" ? "var(--success-color)" : "var(--error-color)"
              }}>
                {info.getValue()}
              </div>
            ),
          }),
          // 10. COMMENTS
          columnHelper.accessor("COMMENTS", {
            id: "COMMENTS",
            header: "Comments",
            size: 200,
            minSize: 150,
            maxSize: 400,
            enableSorting: true,
            enableColumnFilter: true,
            filterFn: "includesString",
            cell: (info) => (
              <div style={{ fontSize: 13 }}>{info.getValue()}</div>
            ),
          }),
          // 11. 30D Chart
          columnHelper.accessor("30D", {
            id: "30D",
            header: "30D Chart",
            size: 600,
            minSize: 500,
            maxSize: 1500,
            enableSorting: false,
            enableColumnFilter: false,
            cell: (info) => {
              const taskId = info.row.original.MASTER_TASK_ID || info.row.original.variant_id;
              return <LazyChart taskId={taskId} days={30} dataAttr={`${taskId}-30d`} />;
            },
          }),
          // 12. 60D Chart
          columnHelper.accessor("60D", {
            id: "60D",
            header: "60D Chart",
            size: 600,
            minSize: 500,
            maxSize: 1500,
            enableSorting: false,
            enableColumnFilter: false,
            cell: (info) => {
              const taskId = info.row.original.MASTER_TASK_ID || info.row.original.variant_id;
              return <LazyChart taskId={taskId} days={60} dataAttr={`${taskId}-60d`} />;
            },
          }),
          // 13. Notes
          columnHelper.accessor((row: any) => {
            const id = row.MASTER_TASK_ID || row.variant_id;
            const noteData = notesMap[id];
            const serverNote = noteData?.note || "";
            const currentDraft = draftsRef.current[id] || "";
            return currentDraft || serverNote;
          }, {
            id: "notes",
            header: "Notes",
            size: 300,
            minSize: 250,
            maxSize: 500,
            enableSorting: false,
            enableColumnFilter: true,
            filterFn: "includesString",
            cell: (info) => {
              const id = info.row.original.MASTER_TASK_ID || info.row.original.variant_id;
              const noteData = notesMap[id];
              const serverNote = noteData?.note || "";
              const currentDraft = draftsRef.current[id] || "";
              const displayValue = currentDraft || serverNote;
              
              return (
                <div style={{ position: "relative" }}>
                  <textarea
                    key={id}
                    defaultValue={displayValue}
                    onChange={(e) => {
                      draftsRef.current[id] = e.target.value;
                    }}
                    onBlur={(e) => {
                      const currentValue = e.target.value;
                      if (currentValue !== serverNote && !isSavingRef.current[id]) {
                        mSave.mutate({ id, note: currentValue });
                      }
                    }}
                    placeholder="Text your comments here..."
                    style={{
                      width: "100%",
                      height: 200,
                      padding: 8,
                      border: "1px solid var(--border-color)",
                      borderRadius: 4,
                      fontSize: 13,
                      fontFamily: "inherit",
                      resize: "vertical",
                      backgroundColor: "var(--bg-color)",
                      color: "var(--text-primary)",
                    }}
                  />
                  {(noteData?.created_at || noteData?.updated_at || noteData?.created_by || noteData?.updated_by) && (
                    <div className="meta">
                      {noteData.created_at && (
                        <div style={{ fontSize: 11, marginBottom: 2 }}>
                          Created:{" "}
                          {noteData.created_at.replace("T", " ").split("+")[0].split(".")[0]}
                          {noteData.created_by && (
                            <span style={{ marginLeft: 8, opacity: 0.8 }}>
                              by <strong>{noteData.created_by}</strong>
                            </span>
                          )}
                        </div>
                      )}
                      {noteData.updated_at && (
                        <div style={{ fontSize: 11, marginTop: 2 }}>
                          Last saved:{" "}
                          {noteData.updated_at.replace("T", " ").split("+")[0].split(".")[0]}
                          {noteData.updated_by && (
                            <span style={{ marginLeft: 8, opacity: 0.8 }}>
                              by <strong>{noteData.updated_by}</strong>
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  {isSavingRef.current[id] && (
                    <div style={{ 
                      position: "absolute", 
                      top: 4, 
                      right: 4, 
                      fontSize: 11, 
                      color: "var(--text-secondary)",
                      backgroundColor: "var(--bg-color)",
                      padding: "2px 6px",
                      borderRadius: 3,
                      border: "1px solid var(--border-color)"
                    }}>
                      Saving...
                    </div>
                  )}
                </div>
              );
            },
          }),
        ];
      }
      
      // Legacy schema columns
      return [
      columnHelper.accessor("variant_id", {
        id: "variant_id",
        header: "Variant",
        size: 140,
        minSize: 100,
        maxSize: 300,
        enableSorting: true,
        enableColumnFilter: true,
        filterFn: "includesString",
        cell: (info) => (
          <div className="variant-pill">{info.getValue()}</div>
        ),
      }),
      columnHelper.accessor("plot_data", {
        id: "plot_data",
        header: "Chart",
        size: 600,
        minSize: 500,
        maxSize: 1500,
        enableSorting: false,
        enableColumnFilter: false,
        cell: (info) => (
          <div data-variant-id={info.row.original.variant_id}>
            <ReactECharts
              style={{
                height: 300,
                width: "100%",
                minWidth: 500,
              }}
              option={buildOption(info.row.original)}
              opts={{ renderer: "canvas" }}
              notMerge
              lazyUpdate
            />
          </div>
        ),
      }),
      columnHelper.accessor("info_text", {
        id: "info_text",
        header: "Informations",
        size: 250,
        minSize: 180,
        maxSize: 500,
        enableSorting: true,
        enableColumnFilter: true,
        filterFn: "includesString",
        cell: (info) => (
          <div className="info-text">
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {info
                .getValue()
                ?.split(/\s+/)
                .map((item: string, idx: number) => (
                  <li key={idx} style={{ marginBottom: 4 }}>
                    {item}
                  </li>
                ))}
            </ul>
          </div>
        ),
      }),
      columnHelper.accessor("tag", {
        id: "pattern",
        header: "Pattern",
        size: 150,
        minSize: 100,
        maxSize: 300,
        enableSorting: true,
        enableColumnFilter: true,
        filterFn: "includesString",
        cell: (info) => (
          <div style={{ 
            padding: "4px 8px",
            textAlign: "center",
            fontSize: 14,
            fontWeight: 500
          }}>
            {info.getValue()}
          </div>
        ),
      }),
      columnHelper.accessor("model_result", {
        id: "model_result",
        header: "Model Result",
        size: 160,
        minSize: 120,
        maxSize: 250,
        enableSorting: true,
        enableColumnFilter: true,
        filterFn: (row, columnId, filterValue) => {
          if (filterValue === "all") return true;
          return row.getValue(columnId) === (filterValue === "true");
        },
        cell: (info) => (
          <div style={{ width: 50 }}>
            <span
              className={`badge ${info.getValue() ? "success" : "danger"}`}
            >
              {info.getValue() ? "TRUE" : "FALSE"}
            </span>
          </div>
        ),
      }),
      columnHelper.accessor(
        (row) => {
          const id = String(row.variant_id || "");
          const noteData = notesMap?.[id];
          return noteData?.note ?? "";
        },
        {
          id: "notes",
          header: "Notes",
          size: 300,
          minSize: 200,
          maxSize: 600,
          enableSorting: false,
          enableColumnFilter: true,
          filterFn: "includesString",
          cell: (info) => {
            const id = String(info.row.original.variant_id || "");
            const noteData = notesMap?.[id];
            const serverNote = noteData?.note ?? "";
            const value = draftsRef.current[id] ?? serverNote;

          return (
            <div className="note-area">
              {(noteData?.created_at || noteData?.updated_at || noteData?.created_by || noteData?.updated_by) && (
                <div className="meta">
                  {noteData.created_at && (
                    <div style={{ fontSize: 11, marginBottom: 2 }}>
                      Created:{" "}
                      {noteData.created_at
                        .replace("T", " ")
                        .split("+")[0]
                        .split(".")[0]}
                      {noteData.created_by && (
                        <span style={{ marginLeft: 8, opacity: 0.8 }}>
                          by <strong>{noteData.created_by}</strong>
                        </span>
                      )}
                    </div>
                  )}
                  {noteData.updated_at && (
                    <div style={{ fontSize: 11, marginTop: 2 }}>
                  Last saved:{" "}
                  {noteData.updated_at
                    .replace("T", " ")
                    .split("+")[0]
                    .split(".")[0]}
                  {noteData.updated_by && (
                        <span style={{ marginLeft: 8, opacity: 0.8 }}>
                          by <strong>{noteData.updated_by}</strong>
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
              <textarea
                key={id}
                placeholder="Text your comments here..."
                defaultValue={value}
                onChange={(e) => {
                  draftsRef.current[id] = e.target.value;
                }}
                onBlur={(e) => {
                  // Auto-save on blur
                  const currentValue = e.target.value;
                  if (currentValue !== serverNote && !isSavingRef.current[id]) {
                    mSave.mutate({ id, note: currentValue });
                  }
                }}
              />
              {/* <button
                className="save-note-btn"
                onClick={() => {
                  const currentValue = draftsRef.current[id] ?? serverNote;
                  if (currentValue !== serverNote && !isSavingRef.current[id]) {
                    mSave.mutate({ id, note: currentValue });
                  }
                }}
                disabled={isSavingRef.current[id]}
              >
                {isSavingRef.current[id] ? "Saving..." : "Save"}
              </button> */}
            </div>
          );
        },
        }
      ),
      ];
    },
    [mSave, isV2, rows, notesMap] // Re-create columns when notes are loaded
  );

  const table = useReactTable({
    data: rows,
    columns,
    columnResizeMode,
    state: {
      sorting,
      columnFilters,
      columnOrder,
      columnVisibility,
      columnPinning,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnOrderChange: setColumnOrder,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnPinningChange: setColumnPinning,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    enableColumnResizing: false,
    enableSorting: true,
    enableFilters: true,
    defaultColumn: {
      minSize: 100,
      maxSize: 1000,
    },
  });

  const handleDragStart = (index: number) => {
    dragItem.current = index;
  };

  const handleDragEnter = (index: number) => {
    dragOverItem.current = index;
  };

  const handleDragEnd = () => {
    if (dragItem.current !== null && dragOverItem.current !== null) {
      const newOrder = [...columnOrder];
      const draggedItem = newOrder[dragItem.current];
      newOrder.splice(dragItem.current, 1);
      newOrder.splice(dragOverItem.current, 0, draggedItem);
      setColumnOrder(newOrder);
    }
    dragItem.current = null;
    dragOverItem.current = null;
  };

  const autoFitColumn = (columnId: string) => {
    const column = table.getColumn(columnId);
    if (!column) return;

    // Simple auto-fit: set to content-based optimal width
    // For demonstration, we'll just reset to default size
    column.resetSize();
  };

  const toggleColumnPin = (columnId: string, position: "left" | "right") => {
    const currentPinning = table.getState().columnPinning;
    const isPinned =
      currentPinning.left?.includes(columnId) ||
      currentPinning.right?.includes(columnId);

    if (isPinned) {
      // Unpin
      setColumnPinning({
        left: (currentPinning.left || []).filter((id) => id !== columnId),
        right: (currentPinning.right || []).filter((id) => id !== columnId),
      });
    } else {
      // Pin
      if (position === "left") {
        setColumnPinning({
          ...currentPinning,
          left: [...(currentPinning.left || []), columnId],
        });
      } else {
        setColumnPinning({
          ...currentPinning,
          right: [...(currentPinning.right || []), columnId],
        });
      }
    }
  };

  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const [pendingFilters, setPendingFilters] = useState<Record<string, string>>({});
  const [isExporting, setIsExporting] = useState(false);
  
  // Drag and drop for column reordering (use ref to avoid re-renders)
  const draggedColumnRef = useRef<string | null>(null);
  const dragOverColumnRef = useRef<string | null>(null);
  const [, setDragUpdate] = useState(0); // Trigger re-render when needed

  const handleExportToExcel = async () => {
    setIsExporting(true);
    try {
      // Get current page data with notes
      const exportRows = rows.map(row => ({
        ...row,
        notes: notesMap?.[String(row.variant_id || row.MASTER_TASK_ID)]?.note || ''
      }));
      
      const result = await exportToExcel(exportRows, sessionUserId);
      
      if (result.success) {
        alert(`✅ Excel file exported successfully!\n\nFilename: ${result.filename}`);
      } else {
        alert(`❌ Export failed: ${result.error}`);
      }
    } catch (error) {
      console.error('Export error:', error);
      alert(`❌ Export failed: ${error}`);
    } finally {
      setIsExporting(false);
    }
  };

  // Listen for custom events from App.tsx
  useEffect(() => {
    const handleOpenSettings = () => setShowColumnMenu(true);
    const handleExport = () => handleExportToExcel();
    
    window.addEventListener('openColumnSettings', handleOpenSettings);
    window.addEventListener('exportToExcel', handleExport);
    
    return () => {
      window.removeEventListener('openColumnSettings', handleOpenSettings);
      window.removeEventListener('exportToExcel', handleExport);
    };
  }, [rows, notesMap, sessionUserId]); // Re-attach when dependencies change

  return (
    <div>
      {/* Column Settings Modal */}
      <div style={{ position: "relative" }}>
        {showColumnMenu && (
          <>
            {/* Modal Overlay */}
            <div 
              style={{
                position: "fixed",
                top: 0,
            left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: "rgba(0, 0, 0, 0.5)",
                zIndex: 9998,
              }}
              onClick={() => setShowColumnMenu(false)}
            />
            
            {/* Modal Content */}
            <div style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              backgroundColor: "var(--bg-card)",
              color: "var(--text-primary)",
              borderRadius: "12px",
              boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)",
              zIndex: 9999,
              width: "600px",
              maxHeight: "80vh",
              overflow: "auto",
              padding: "24px"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <h3 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>⚙️ Column Settings</h3>
        <button
                  onClick={() => setShowColumnMenu(false)}
                  style={{
                    background: "none",
                    border: "none",
                    fontSize: 24,
                    cursor: "pointer",
                    color: "var(--text-secondary)",
                    padding: "4px 8px"
                  }}
                >
                  ×
        </button>
              </div>

              {/* Column Order Section */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--text-secondary)" }}>
                    🔄 Column Order (Drag to reorder)
                  </h4>
        <button
                    onClick={() => setColumnOrder(defaultColumnOrder)}
          style={{ 
                      padding: "4px 12px",
                      fontSize: 12,
                      border: "1px solid var(--border-color)",
                      borderRadius: "4px",
                      backgroundColor: "var(--bg-input)",
                      cursor: "pointer",
                      color: "var(--text-primary)"
                    }}
                  >
                    🔄 Reset
        </button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {table.getAllLeafColumns().map((column, index) => (
                    <div
                      key={column.id}
                      draggable
                      onDragStart={(e) => {
                        draggedColumnRef.current = column.id;
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        const draggedCol = draggedColumnRef.current;
                        const targetCol = column.id;
                        
                        if (draggedCol && targetCol && draggedCol !== targetCol) {
                          const currentOrder = table.getState().columnOrder;
                          const newOrder = [...currentOrder];
                          const draggedIndex = newOrder.indexOf(draggedCol);
                          const targetIndex = newOrder.indexOf(targetCol);
                          
                          if (draggedIndex !== -1 && targetIndex !== -1) {
                            newOrder.splice(draggedIndex, 1);
                            newOrder.splice(targetIndex, 0, draggedCol);
                            setColumnOrder(newOrder);
                          }
                        }
                        draggedColumnRef.current = null;
                      }}
                      style={{
                        padding: "10px 14px",
                        backgroundColor: "var(--bg-secondary)",
                        border: "1px solid var(--border-color)",
                        borderRadius: "6px",
                        cursor: "grab",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        userSelect: "none"
                      }}
                    >
                      <span style={{ fontSize: 16, color: "var(--text-secondary)" }}>☰</span>
                      <span style={{ flex: 1, fontWeight: 500 }}>{column.columnDef.header as string}</span>
                      <span style={{ fontSize: 11, color: "var(--text-secondary)", fontFamily: "monospace" }}>
                        #{index + 1}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Show/Hide Section */}
              <div style={{ marginBottom: 24 }}>
                <h4 style={{ marginBottom: 12, fontSize: 14, fontWeight: 600, color: "var(--text-secondary)" }}>
                  👁️ Show/Hide Columns
                </h4>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {table.getAllLeafColumns().map((column) => (
                    <label key={column.id} style={{ 
                      display: "flex", 
                      alignItems: "center", 
                      gap: 8,
                      padding: "8px 12px",
                      backgroundColor: "var(--bg-secondary)",
                      borderRadius: "4px",
                      cursor: "pointer"
                    }}>
                  <input
                    type="checkbox"
                    checked={column.getIsVisible()}
                    onChange={column.getToggleVisibilityHandler()}
                        style={{ cursor: "pointer" }}
                  />
                      <span style={{ fontSize: 13 }}>{column.columnDef.header as string}</span>
                </label>
              ))}
            </div>
              </div>

              {/* Pin Columns Section */}
              <div>
                <h4 style={{ marginBottom: 12, fontSize: 14, fontWeight: 600, color: "var(--text-secondary)" }}>
                  📌 Pin Columns
                </h4>
              {table.getAllLeafColumns().map((column) => {
                  const isPinnedLeft = table.getState().columnPinning.left?.includes(column.id);
                  const isPinnedRight = table.getState().columnPinning.right?.includes(column.id);
                return (
                    <div key={column.id} style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 12px",
                      backgroundColor: "var(--bg-secondary)",
                      borderRadius: "4px",
                      marginBottom: 4
                    }}>
                      <span style={{ fontSize: 13 }}>{column.columnDef.header as string}</span>
                      <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={() => toggleColumnPin(column.id, "left")}
                          style={{
                            padding: "4px 12px",
                            fontSize: 12,
                            border: "1px solid var(--border-color)",
                            borderRadius: "4px",
                            backgroundColor: isPinnedLeft ? "rgba(59, 130, 246, 0.2)" : "var(--bg-card)",
                            color: isPinnedLeft ? "var(--primary)" : "var(--text-primary)",
                            cursor: "pointer",
                            fontWeight: isPinnedLeft ? 600 : 400
                          }}
                        >
                          📌 Left
                      </button>
                      <button
                        onClick={() => toggleColumnPin(column.id, "right")}
                          style={{
                            padding: "4px 12px",
                            fontSize: 12,
                            border: "1px solid var(--border-color)",
                            borderRadius: "4px",
                            backgroundColor: isPinnedRight ? "rgba(59, 130, 246, 0.2)" : "var(--bg-card)",
                            color: isPinnedRight ? "var(--primary)" : "var(--text-primary)",
                            cursor: "pointer",
                            fontWeight: isPinnedRight ? 600 : 400
                          }}
                        >
                          Right 📌
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          </>
        )}
      </div>

      {/* Table */}
      <div className="tanstack-table-container">
        <table className="tanstack-table">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header, index) => {
                  const isPinnedLeft =
                    table.getState().columnPinning.left?.includes(header.column.id);
                  const isPinnedRight =
                    table.getState().columnPinning.right?.includes(header.column.id);
                  
                  return (
                    <th
                      key={header.id}
                      style={{
                        minWidth: header.column.columnDef.minSize,
                        maxWidth: header.column.columnDef.maxSize,
                        width: header.column.id === "plot_data" ? "auto" : header.getSize(),
                        position: isPinnedLeft || isPinnedRight ? "sticky" : "relative",
                        left: isPinnedLeft ? 0 : "auto",
                        right: isPinnedRight ? 0 : "auto",
                        zIndex: isPinnedLeft || isPinnedRight ? 10 : 1,
                        background: isPinnedLeft || isPinnedRight ? "rgba(148, 163, 184, 0.25)" : "rgba(148, 163, 184, 0.18)",
                      }}
                      className="table-header"
                      draggable={!header.column.getIsPinned()}
                      onDragStart={() => handleDragStart(index)}
                      onDragEnter={() => handleDragEnter(index)}
                      onDragEnd={handleDragEnd}
                      onDragOver={(e) => e.preventDefault()}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          cursor: header.column.getCanSort() ? "pointer" : "default",
                        }}
                        onClick={header.column.getToggleSortingHandler()}
                        onDoubleClick={() => autoFitColumn(header.column.id)}
                        title="Double-click to auto-fit"
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                        {header.column.getCanSort() && (
                          <span className="sort-indicator">
                            {{
                              asc: " 🔼",
                              desc: " 🔽",
                            }[header.column.getIsSorted() as string] ?? " ↕️"}
                          </span>
                        )}
                      </div>
                      {header.column.getCanFilter() ? (
                        <div className="filter-input-wrapper">
                          {header.column.id === "model_result" || header.column.id === "MODEL_RESULT_INFO" ? (
                            <select
                              value={(header.column.getFilterValue() ?? "all") as string}
                              onChange={(e) =>
                                header.column.setFilterValue(e.target.value === "all" ? undefined : e.target.value)
                              }
                              className="filter-select"
                            >
                              <option value="all">All</option>
                              <option value="true">TRUE</option>
                              <option value="false">FALSE</option>
                            </select>
                          ) : (
                            <input
                              type="text"
                              value={pendingFilters[header.column.id] ?? ""}
                              onChange={(e) => 
                                setPendingFilters((prev) => ({ ...prev, [header.column.id]: e.target.value }))
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  header.column.setFilterValue(pendingFilters[header.column.id] || undefined);
                                }
                              }}
                              placeholder={`Filter ${header.column.columnDef.header}... (Press Enter)`}
                              className="filter-input"
                            />
                          )}
                        </div>
                      ) : (
                        <div className="filter-input-wrapper filter-placeholder"></div>
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="table-row">
                {row.getVisibleCells().map((cell) => {
                  const isPinnedLeft =
                    table.getState().columnPinning.left?.includes(cell.column.id);
                  const isPinnedRight =
                    table.getState().columnPinning.right?.includes(cell.column.id);
                  
                  return (
                    <td
                      key={cell.id}
                      style={{
                        minWidth: cell.column.columnDef.minSize,
                        maxWidth: cell.column.columnDef.maxSize,
                        width: cell.column.id === "plot_data" ? "auto" : cell.column.getSize(),
                        position: isPinnedLeft || isPinnedRight ? "sticky" : "relative",
                        left: isPinnedLeft ? 0 : "auto",
                        right: isPinnedRight ? 0 : "auto",
                        zIndex: isPinnedLeft || isPinnedRight ? 9 : 1,
                        background: "var(--bg-card)",
                      }}
                      className="table-cell"
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

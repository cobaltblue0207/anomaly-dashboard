import ReactECharts from "echarts-for-react";
import { createColumnHelper } from "@tanstack/react-table";
import { LazyChart } from "../charts/LazyChart";
import { buildOption } from "../charts/chartOptions";

export function createTableColumns(
  isV2Schema: boolean,
  activeChartId: string | null,
  handleChartActivation: (chartId: string) => void
) {
  const columnHelper = createColumnHelper<any>();

  if (isV2Schema) {
    return [
      // 1. No
      columnHelper.accessor("no", {
        id: "no",
        header: "No",
        size: 60,
        enableSorting: true,
        enableColumnFilter: false,
      }),

      // 2. MASTER_TASK_ID
      columnHelper.accessor("MASTER_TASK_ID", {
        id: "MASTER_TASK_ID",
        header: "Task ID",
        size: 120,
        enableSorting: true,
        enableColumnFilter: true,
      }),

      // 3. LINE
      columnHelper.accessor("LINE", {
        id: "LINE",
        header: "Line",
        size: 80,
        enableSorting: true,
        enableColumnFilter: true,
      }),

      // 4. AREA
      columnHelper.accessor("AREA", {
        id: "AREA",
        header: "Area",
        size: 80,
        enableSorting: true,
        enableColumnFilter: true,
      }),

      // 5. PROD_EQP_ID
      columnHelper.accessor("PROD_EQP_ID", {
        id: "PROD_EQP_ID",
        header: "Equipment",
        size: 100,
        enableSorting: true,
        enableColumnFilter: true,
      }),

      // 6. PARAM_SUBITEM
      columnHelper.accessor("PARAM_SUBITEM", {
        id: "PARAM_SUBITEM",
        header: "Parameter",
        size: 120,
        enableSorting: true,
        enableColumnFilter: true,
      }),

      // 7. PPID
      columnHelper.accessor("PPID", {
        id: "PPID",
        header: "PPID",
        size: 100,
        enableSorting: true,
        enableColumnFilter: true,
      }),

      // 8. RECIPEID
      columnHelper.accessor("RECIPEID", {
        id: "RECIPEID",
        header: "Recipe",
        size: 100,
        enableSorting: true,
        enableColumnFilter: true,
      }),

      // 9. CH_STEP
      columnHelper.accessor("CH_STEP", {
        id: "CH_STEP",
        header: "Step",
        size: 80,
        enableSorting: true,
        enableColumnFilter: true,
      }),

      // 10. MODEL_RESULT_INFO
      columnHelper.accessor("MODEL_RESULT_INFO", {
        id: "MODEL_RESULT_INFO",
        header: "AI Result",
        size: 100,
        enableSorting: true,
        enableColumnFilter: true,
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
          const chartId = `${taskId}-30d`;
          const isActive = activeChartId === chartId;
          
          return (
            <LazyChart 
              taskId={taskId} 
              days={30} 
              dataAttr={chartId}
              isActive={isActive}
              onActivate={() => handleChartActivation(chartId)}
            />
          );
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
          const chartId = `${taskId}-60d`;
          const isActive = activeChartId === chartId;
          
          return (
            <LazyChart 
              taskId={taskId} 
              days={60} 
              dataAttr={chartId}
              isActive={isActive}
              onActivate={() => handleChartActivation(chartId)}
            />
          );
        },
      }),

      // 13. COMMENTS
      columnHelper.accessor("COMMENTS", {
        id: "COMMENTS",
        header: "Comments",
        size: 200,
        enableSorting: false,
        enableColumnFilter: true,
      }),

      // 14. NOTES
      columnHelper.accessor("NOTES", {
        id: "NOTES",
        header: "Notes",
        size: 200,
        enableSorting: false,
        enableColumnFilter: true,
      }),
    ];
  } else {
    // Legacy schema columns
    return [
      columnHelper.accessor("no", {
        id: "no",
        header: "No",
        size: 60,
        enableSorting: true,
        enableColumnFilter: false,
      }),
      columnHelper.accessor("sensor", {
        id: "sensor",
        header: "Sensor",
        size: 100,
        enableSorting: true,
        enableColumnFilter: true,
      }),
      columnHelper.accessor("machine", {
        id: "machine",
        header: "Machine",
        size: 120,
        enableSorting: true,
        enableColumnFilter: true,
      }),
      columnHelper.accessor("tag", {
        id: "tag",
        header: "Tag",
        size: 100,
        enableSorting: true,
        enableColumnFilter: true,
      }),
      columnHelper.accessor("variant_id", {
        id: "variant_id",
        header: "Variant ID",
        size: 100,
        enableSorting: true,
        enableColumnFilter: true,
      }),
      columnHelper.accessor("model_result", {
        id: "model_result",
        header: "Model Result",
        size: 100,
        enableSorting: true,
        enableColumnFilter: true,
        cell: (info) => (
          <span style={{ 
            color: info.getValue() ? "var(--success-color)" : "var(--error-color)",
            fontWeight: "bold"
          }}>
            {info.getValue() ? "TRUE" : "FALSE"}
          </span>
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
        cell: (info) => {
          const variantId = info.row.original.variant_id;
          const chartId = `legacy-${variantId}`;
          const isActive = activeChartId === chartId;
          
          return (
            <div 
              data-variant-id={variantId}
              onClick={() => handleChartActivation(chartId)}
              style={{
                cursor: "pointer",
                border: isActive ? "2px solid var(--primary)" : "2px solid transparent",
                borderRadius: "4px",
                transition: "border-color 0.2s ease",
                position: "relative"
              }}
            >
              {/* Active state indicator */}
              {isActive && (
                <div style={{
                  position: "absolute",
                  top: 4,
                  right: 4,
                  background: "var(--primary)",
                  color: "white",
                  padding: "2px 6px",
                  borderRadius: "3px",
                  fontSize: 11,
                  fontWeight: 600,
                  zIndex: 10
                }}>
                  ACTIVE
                </div>
              )}
              
              <ReactECharts
                style={{
                  height: 300,
                  width: "100%",
                  minWidth: 500,
                }}
                option={buildOption(info.row.original, isActive)}
                opts={{ 
                  renderer: "canvas"
                }}
                notMerge={false}
                lazyUpdate
                onEvents={{
                  click: (e: any) => {
                    e.stopPropagation();
                    handleChartActivation(chartId);
                  },
                  ...(isActive ? {
                    mousewheel: (e: any) => e.stopPropagation(),
                    mousemove: (e: any) => e.stopPropagation(),
                  } : {})
                }}
              />
            </div>
          );
        },
      }),
    ];
  }
}

import ReactECharts from "echarts-for-react";
import { createColumnHelper } from "@tanstack/react-table";
import { LazyChart } from "../charts/LazyChart";
import { buildOption } from "../charts/chartOptions";
import NotesInput from "../NotesInput";

// Common column configuration
const createBasicColumn = (columnHelper: any, accessor: string, config: {
  id: string;
  header: string;
  size: number;
  minSize?: number;
  maxSize?: number;
  enableSorting?: boolean;
  enableColumnFilter?: boolean;
  cell?: any;
}) => {
  const columnConfig: any = {
    id: config.id,
    header: config.header,
    size: config.size,
    minSize: config.minSize,
    maxSize: config.maxSize,
    enableSorting: config.enableSorting ?? true,
    enableColumnFilter: config.enableColumnFilter ?? true,
  };

  // Only add cell if it's provided, otherwise let TanStack Table handle default rendering
  if (config.cell) {
    columnConfig.cell = config.cell;
  }

  return columnHelper.accessor(accessor, columnConfig);
};

// Chart column creation helper
const createChartColumn = (
  columnHelper: any, 
  accessor: string, 
  header: string, 
  days: number, 
  activeChartId: string | null, 
  handleChartActivation: (chartId: string) => void,
  onLoadingStart?: (chartId: string) => void,
  onLoadingFinish?: (chartId: string) => void,
  isAllChartsCompleted?: boolean
) => {
  return createBasicColumn(columnHelper, accessor, {
    id: accessor,
    header,
    size: 600,
    minSize: 500,
    maxSize: 1500,
    enableSorting: false,
    enableColumnFilter: false,
    cell: (info: any) => {
      const taskId = info.row.original.MASTER_TASK_ID || info.row.original.variant_id;
      const chartId = `${taskId}-${days}d`;
      const isActive = activeChartId === chartId;
      
      return (
        <LazyChart 
          taskId={taskId} 
          days={days} 
          dataAttr={chartId}
          isActive={isActive}
          onActivate={() => handleChartActivation(chartId)}
          onLoadingStart={onLoadingStart}
          onLoadingFinish={onLoadingFinish}
          isAllChartsCompleted={isAllChartsCompleted}
        />
      );
    },
  });
};

export function createTableColumns(
  activeChartId: string | null,
  handleChartActivation: (chartId: string) => void,
  onLoadingStart?: (chartId: string) => void,
  onLoadingFinish?: (chartId: string) => void,
  isAllChartsCompleted?: boolean,
  notesData?: Record<string, string>,
  onNotesUpdate?: (rowId: string, value: string) => void
) {
  const columnHelper = createColumnHelper<any>();
    return [
      // 1. MASTER_TASK_ID
      columnHelper.accessor("MASTER_TASK_ID", {
        id: "MASTER_TASK_ID",
        header: "Task ID",
        size: 120,
        enableSorting: true,
        enableColumnFilter: true,
      }),
      
      // 2. LINE
      columnHelper.accessor("LINE", {
        id: "LINE",
        header: "Line",
        size: 80,
        enableSorting: true,
        enableColumnFilter: true,
      }),
      
      // 3. AREA
      columnHelper.accessor("AREA", {
        id: "AREA",
        header: "Area",
        size: 80,
        enableSorting: true,
        enableColumnFilter: true,
      }),
      
      // 4. EQUIPMENT
      columnHelper.accessor("PROD_EQP_ID", {
        id: "PROD_EQP_ID",
        header: "Equipment",
        size: 100,
        enableSorting: true,
        enableColumnFilter: true,
      }),
      
      // 5. PARAMETER
      columnHelper.accessor("PARAM_SUBITEM", {
        id: "PARAM_SUBITEM",
        header: "Parameter",
        size: 120,
        enableSorting: true,
        enableColumnFilter: true,
      }),
      
      // 6. PPID
      columnHelper.accessor("PPID", {
        id: "PPID",
        header: "PPID",
        size: 100,
        enableSorting: true,
        enableColumnFilter: true,
      }),
      
      // 7. RECIPEID
      columnHelper.accessor("RECIPEID", {
        id: "RECIPEID",
        header: "Recipe",
        size: 100,
        enableSorting: true,
        enableColumnFilter: true,
      }),
      
      // 8. CH_STEP
      columnHelper.accessor("CH_STEP", {
        id: "CH_STEP",
        header: "Step",
        size: 80,
        enableSorting: true,
        enableColumnFilter: true,
      }),
      
      // 9. AI_RESULT
      columnHelper.accessor("MODEL_RESULT_INFO", {
        id: "MODEL_RESULT_INFO",
        header: "AI Result",
        size: 100,
        enableSorting: true,
        enableColumnFilter: true,
      }),
      
      // 10. AI_INFERENCE_RESULT (추가 컬럼이 필요하면 여기에 추가)
      // columnHelper.accessor("AI_INFERENCE_RESULT", {
      //   id: "AI_INFERENCE_RESULT",
      //   header: "AI Inference",
      //   size: 120,
      //   enableSorting: true,
      //   enableColumnFilter: true,
      // }),
      
      // 11. COMMENTS
      columnHelper.accessor("COMMENTS", {
        id: "COMMENTS",
        header: "Comments",
        size: 200,
        enableSorting: false,
        enableColumnFilter: true,
      }),
      
      // 12. 30d Chart
      createChartColumn(columnHelper, "30D", "30D Chart", 30, activeChartId, handleChartActivation, onLoadingStart, onLoadingFinish, isAllChartsCompleted),
      
      // 13. 60d Chart
      createChartColumn(columnHelper, "60D", "60D Chart", 60, activeChartId, handleChartActivation, onLoadingStart, onLoadingFinish, isAllChartsCompleted),
      
      // 14. NOTES
      columnHelper.accessor("NOTES", {
        id: "NOTES",
        header: "Notes",
        size: 300,
        enableSorting: false,
        enableColumnFilter: true,
        cell: (info: any) => {
          const rowId = info.row.original.MASTER_TASK_ID || info.row.id;
          const noteData = notesData?.[rowId];
          const currentValue = typeof noteData === 'object' ? (noteData as any).note || '' : noteData || info.getValue() || '';
          const noteInfo = noteData && typeof noteData === 'object' ? {
            created_at: (noteData as any).created_at,
            updated_at: (noteData as any).updated_at,
            created_by: (noteData as any).created_by,
            updated_by: (noteData as any).updated_by
          } : undefined;
          
          return (
            <NotesInput 
              key={`notes-${rowId}`}
              rowId={rowId}
              initialValue={currentValue}
              onUpdate={onNotesUpdate}
              noteInfo={noteInfo}
            />
          );
        },
      }),
    ];
}

import React, { useMemo, useState, useEffect, useCallback } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  SortingState,
  ColumnFiltersState,
  VisibilityState,
  ColumnOrderState,
} from "@tanstack/react-table";
import { useQueryClient } from "@tanstack/react-query";
import { createTableColumns } from "./table/TableColumns";
import { getDefaultColumnOrder } from "../utils/tableUtils";
import { useChartLoadingProgress } from "../hooks/useChartLoadingProgress";
import { exportToExcel } from "../utils/excelExport";
import { ColumnSettingsModal } from "./ColumnSettingsModal";
import { saveNote } from "../services/data";

interface DashboardTableProps {
  rows: any[];
  sessionUserId: string;
  filterUserId: string;
  notesData: any;
  onProgressChange?: (progress: {
    isLoading: boolean;
    progress: number;
    loadedCharts: number;
    totalCharts: number;
    isCompleted: boolean;
    hasCachedCharts: boolean;
  }) => void;
}

export function DashboardTable({ 
  rows, 
  sessionUserId, 
  filterUserId, 
  notesData, 
  onProgressChange
}: DashboardTableProps) {
  const qc = useQueryClient();
  // Chart activation state management
  const [activeChartId, setActiveChartId] = useState<string | null>(null);
  
  // Column settings modal state
  const [isColumnSettingsOpen, setIsColumnSettingsOpen] = useState(false);
  
  // Notes data state
  const [localNotesData, setLocalNotesData] = useState<Record<string, any>>({});
  const [savingNotes, setSavingNotes] = useState<Set<string>>(new Set());
  
  // Query client for cache invalidation
  const queryClient = useQueryClient();
  
  // Initialize notes data from props (한 번만)
  useEffect(() => {
    if (notesData && Object.keys(notesData).length > 0) {
      // 기존 로컬 데이터와 병합 (덮어쓰지 않음)
      setLocalNotesData(prev => {
        const merged = { ...prev, ...notesData };
        return merged;
      });
    }
  }, [notesData]);

  // Notes update handler with API save (blur 이벤트에서만 호출)
  const handleNotesUpdate = useCallback(async (rowId: string, value: string) => {
    // 필수 파라미터 검증
    if (!filterUserId || !sessionUserId) {
      alert('사용자 정보가 없습니다. 페이지를 새로고침해주세요.');
      return;
    }
    
    // 중복 저장 방지: 이미 저장 중인지 확인
    if (savingNotes.has(rowId)) {
      return;
    }
    
    // 중복 저장 방지: 이미 같은 값으로 저장된 경우
    const currentNote = localNotesData[rowId];
    if (currentNote && typeof currentNote === 'object' && currentNote.note === value) {
      return;
    }
    
    setLocalNotesData(prev => {
      // 값이 실제로 변경된 경우에만 업데이트
      if (prev[rowId] !== value) {
  return {
          ...prev,
          [rowId]: value
        };
      }
      return prev;
    });

    // 빈 값이면 저장하지 않음
    if (!value.trim()) {
      return;
    }

    // API 호출로 서버에 저장
    try {
      // 저장 중 상태 설정
      setSavingNotes(prev => new Set(prev).add(rowId));
      
      
      // 실제 API 호출
      const result = await saveNote(
        filterUserId,  // user_id
        "ALL",        // pattern (V2 schema에서는 "ALL" 사용)
        rowId,        // variant_id (MASTER_TASK_ID)
        value,        // note
        sessionUserId // current_session_user
      );
      
      
      // 저장 성공 후 로컬 상태에 메타데이터 추가 (강제 업데이트)
      setLocalNotesData(prev => {
        const updated = {
          ...prev,
          [rowId]: {
            note: value,
            created_at: result.created_at,
            updated_at: result.updated_at,
            created_by: result.created_by,
            updated_by: result.updated_by
          }
        };
        return updated;
      });
      
      // Notes 저장 후 캐시 무효화 (선택적)
      // queryClient.invalidateQueries({
      //   queryKey: ["allRows"],
      //   exact: false
      // });
    } catch (error: any) {
      
      // 더 자세한 에러 메시지
      let errorMessage = '노트 저장에 실패했습니다.';
      if (error.response?.data?.detail) {
        errorMessage += ` (${error.response.data.detail})`;
      } else if (error.message) {
        errorMessage += ` (${error.message})`;
      }
      
      // 저장 실패 시 사용자에게 알림
      alert(errorMessage);
    } finally {
      // 저장 중 상태 해제
      setSavingNotes(prev => {
        const newSet = new Set(prev);
        newSet.delete(rowId);
        return newSet;
      });
    }
  }, [filterUserId, sessionUserId, localNotesData, savingNotes, queryClient]);
  
  // Chart loading progress tracking
  const totalCharts = rows.length * 2; // 30D + 60D 차트
  
  
  const {
    progress,
    isLoading: isChartLoading,
    isCompleted,
    loadedCharts,
    totalCharts: progressTotalCharts,
    hasCachedCharts,
    startChartLoading,
    finishChartLoading,
    resetProgress
  } = useChartLoadingProgress(totalCharts);

  
  
  
  
  // Table state
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>([]);
  const [columnPinning, setColumnPinning] = useState<{ left?: string[]; right?: string[] }>({});

  // Default column order
  const defaultColumnOrder = useMemo(() => getDefaultColumnOrder(), []);
  
  // Initialize column order
  useEffect(() => {
    if (columnOrder.length === 0) {
    setColumnOrder(defaultColumnOrder);
    }
  }, [defaultColumnOrder, columnOrder.length]);
  
  // Reset progress when rows change (new page) - but only if not cached
  useEffect(() => {
    // 캐시된 데이터인지 확인 (간단한 휴리스틱: rows가 즉시 로드되면 캐시된 것으로 간주)
    const isCached = rows.length > 0 && !isChartLoading;
    if (!isCached) {
      resetProgress();
    }
  }, [rows, resetProgress, isChartLoading]);

  // progress 상태 변경 시 부모 컴포넌트에 알림 (isLoading은 App.tsx에서 관리하므로 제외)
  useEffect(() => {
    if (onProgressChange) {
        onProgressChange({
          isLoading: false, // App.tsx에서 관리하므로 여기서는 false로 설정
          progress,
          loadedCharts,
          totalCharts: progressTotalCharts,
          isCompleted,
          hasCachedCharts
        });
    }
  }, [progress, loadedCharts, progressTotalCharts, isCompleted, hasCachedCharts, onProgressChange]);
  
  // Chart activation handler
  const handleChartActivation = useCallback((chartId: string) => {
    setActiveChartId(prev => prev === chartId ? null : chartId);
  }, []);

  // Excel export event handler
  useEffect(() => {
    const handleExportToExcel = async () => {
      if (rows.length === 0) {
        alert('No data to export');
        return;
      }
      
      try {
        const result = await exportToExcel(rows, sessionUserId, localNotesData);
        if (result.success) {
          console.log(`Excel file exported successfully: ${result.filename}`);
        } else {
          console.error('Excel export failed:', result.error);
          alert('Excel export failed. Please try again.');
        }
      } catch (error) {
        console.error('Excel export error:', error);
        alert('Excel export failed. Please try again.');
      }
    };

    // Add event listener
    window.addEventListener('exportToExcel', handleExportToExcel);
    
    // Cleanup
    return () => {
      window.removeEventListener('exportToExcel', handleExportToExcel);
    };
  }, [rows, sessionUserId]);

  // Column settings event handler
  useEffect(() => {
    const handleOpenColumnSettings = () => {
      setIsColumnSettingsOpen(true);
    };

    // Add event listener
    window.addEventListener('openColumnSettings', handleOpenColumnSettings);
    
    // Cleanup
    return () => {
      window.removeEventListener('openColumnSettings', handleOpenColumnSettings);
    };
  }, []);
  
  // Create columns with stable memoization
  const columns = useMemo(() => {
    return createTableColumns(activeChartId, handleChartActivation, startChartLoading, finishChartLoading, isCompleted, localNotesData, handleNotesUpdate);
  }, [activeChartId, handleChartActivation, startChartLoading, finishChartLoading, isCompleted, handleNotesUpdate]);
  
  // Create table instance
  const table = useReactTable({
    data: rows,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      columnOrder,
      columnPinning,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnOrderChange: setColumnOrder,
    onColumnPinningChange: setColumnPinning,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    // 서버 사이드 페이지네이션을 사용하므로 클라이언트 페이지네이션 비활성화
    // getPaginationRowModel: getPaginationRowModel(),
    enableRowSelection: true,
    enableMultiRowSelection: false,
    manualPagination: true, // 서버 사이드 페이지네이션 사용
  });
  
  // Optimize scroll performance when charts are active
  useEffect(() => {
    const handleScroll = () => {
      // Prevent chart re-rendering on scroll when no chart is active
      if (!activeChartId) {
        return;
      }
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [activeChartId]);

  return (
            <div style={{
      width: "100%", 
              overflow: "auto",
      position: "relative"
    }}>
      
      
      <table style={{ 
        width: "100%", 
        borderCollapse: "collapse",
        minWidth: "1200px" // 최소 너비 설정으로 횡스크롤 유도
      }}>
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      style={{
                    padding: "12px 8px",
                    textAlign: "left",
                    borderBottom: "1px solid var(--border-color)",
                    backgroundColor: "var(--bg-secondary)",
                    fontWeight: "600",
                    fontSize: "14px",
                    color: "var(--text-primary)",
                    minWidth: header.getSize(),
                    width: header.getSize(),
                    minHeight: "60px", // Filter box를 위한 최소 높이
                    position: header.column.getIsPinned() ? "sticky" : "relative",
                    top: 0,
                    left: header.column.getIsPinned() === 'left' ? `${header.column.getStart('left')}px` : undefined,
                    right: header.column.getIsPinned() === 'right' ? `${header.column.getAfter('right')}px` : undefined,
                    zIndex: header.column.getIsPinned() ? 20 : 10,
                    boxShadow: header.column.getIsPinned() 
                      ? header.column.getIsPinned() === 'left' 
                        ? '2px 0 4px rgba(0,0,0,0.1)' 
                        : '-2px 0 4px rgba(0,0,0,0.1)'
                      : undefined,
                  }}
                >
                  {header.isPlaceholder ? null : (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "8px",
                          width: "100%"
                        }}
                    >
                      <div
                        onClick={header.column.getToggleSortingHandler()}
                        style={{
                          cursor: header.column.getCanSort() ? "pointer" : "default",
                          userSelect: "none",
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {{
                          asc: " ↑",
                          desc: " ↓",
                        }[header.column.getIsSorted() as string] ?? null}
                      </div>
                      {header.column.getCanFilter() ? (
                        <div>
                            <input
                              type="text"
                            value={(header.column.getFilterValue() as string) ?? ""}
                            onChange={(e) => header.column.setFilterValue(e.target.value)}
                              placeholder={`Filter...`}
                            style={{
                              padding: "4px 8px",
                              border: "1px solid var(--border-color)",
                              borderRadius: "4px",
                              backgroundColor: "var(--bg-primary)",
                              color: "var(--text-primary)",
                              fontSize: "12px",
                              width: "100%",
                              minWidth: "80px"
                            }}
                          />
                        </div>
                      ) : null}
                    </div>
                      )}
                    </th>
              ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              style={{
                borderBottom: "1px solid var(--border-color)",
                backgroundColor: row.getIsSelected() ? "var(--bg-selected)" : "var(--bg-primary)",
              }}
            >
              {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      style={{
                    padding: "8px",
                    borderBottom: "1px solid var(--border-color)",
                    minWidth: cell.column.getSize(),
                    width: cell.column.getSize(),
                    position: cell.column.getIsPinned() ? "sticky" : "relative",
                    left: cell.column.getIsPinned() === 'left' ? `${cell.column.getStart('left')}px` : undefined,
                    right: cell.column.getIsPinned() === 'right' ? `${cell.column.getAfter('right')}px` : undefined,
                    zIndex: cell.column.getIsPinned() ? 15 : 1,
                    backgroundColor: cell.column.getIsPinned() ? "var(--bg-secondary)" : "inherit",
                    boxShadow: cell.column.getIsPinned() 
                      ? cell.column.getIsPinned() === 'left' 
                        ? '2px 0 4px rgba(0,0,0,0.1)' 
                        : '-2px 0 4px rgba(0,0,0,0.1)'
                      : undefined,
                  }}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
              ))}
              </tr>
            ))}
          </tbody>
        </table>
        
        {/* Column Settings Modal */}
        <ColumnSettingsModal
          isOpen={isColumnSettingsOpen}
          onClose={() => setIsColumnSettingsOpen(false)}
          columns={table.getAllColumns()}
          columnVisibility={columnVisibility}
          columnOrder={columnOrder}
          columnPinning={columnPinning}
          onVisibilityChange={setColumnVisibility}
          onOrderChange={setColumnOrder}
          onPinningChange={setColumnPinning}
        />
    </div>
  );
}
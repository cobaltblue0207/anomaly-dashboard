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
import { useNotesMutation, useNotesQuery, getDefaultColumnOrder } from "../utils/tableUtils";

interface DashboardTableProps {
  rows: any[];
  sessionUserId: string;
  filterUserId: string;
  notesData: any;
}

export function DashboardTable({ rows, sessionUserId, filterUserId, notesData }: DashboardTableProps) {
  const qc = useQueryClient();
  const isV2Schema = rows.length > 0 && "MASTER_TASK_ID" in rows[0];
  
  // Chart activation state management
  const [activeChartId, setActiveChartId] = useState<string | null>(null);
  
  // Table state
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>([]);
  
  // Default column order
  const defaultColumnOrder = useMemo(() => getDefaultColumnOrder(isV2Schema), [isV2Schema]);
  
  // Initialize column order
  useEffect(() => {
    if (columnOrder.length === 0) {
      setColumnOrder(defaultColumnOrder);
    }
  }, [defaultColumnOrder, columnOrder.length]);
  
  // Chart activation handler
  const handleChartActivation = useCallback((chartId: string) => {
    setActiveChartId(prev => prev === chartId ? null : chartId);
  }, []);
  
  // Create columns
  const columns = useMemo(() => {
    return createTableColumns(isV2Schema, activeChartId, handleChartActivation);
  }, [isV2Schema, activeChartId, handleChartActivation]);
  
  // Create table instance
  const table = useReactTable({
    data: rows,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      columnOrder,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnOrderChange: setColumnOrder,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    enableRowSelection: true,
    enableMultiRowSelection: false,
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
    <div style={{ width: "100%", overflow: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  style={{
                    padding: "8px",
                    textAlign: "left",
                    borderBottom: "1px solid var(--border-color)",
                    backgroundColor: "var(--bg-secondary)",
                    fontWeight: "600",
                    fontSize: "14px",
                    color: "var(--text-primary)",
                    minWidth: header.getSize(),
                    width: header.getSize(),
                    position: "sticky",
                    top: 0,
                    zIndex: 10,
                  }}
                >
                  {header.isPlaceholder ? null : (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
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
                              width: "100px",
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
                  }}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
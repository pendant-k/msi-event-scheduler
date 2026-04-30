"use client";

import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState
} from "@tanstack/react-table";
import { useMemo, useState } from "react";

export type SimpleColumn<T extends Record<string, unknown>> = {
  key: keyof T & string;
  label: string;
};

export function DataTable<T extends Record<string, unknown>>({
  rows,
  columns
}: {
  rows: T[];
  columns: Array<SimpleColumn<T>>;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const columnDefs = useMemo<Array<ColumnDef<T>>>(
    () =>
      columns.map((column) => ({
        accessorKey: column.key,
        header: column.label,
        cell: (info) => String(info.getValue() ?? "")
      })),
    [columns]
  );
  const table = useReactTable({
    data: rows,
    columns: columnDefs,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel()
  });

  return (
    <div className="overflow-x-auto">
      <table className="table table-zebra table-sm">
        <thead>
          {table.getHeaderGroups().map((group) => (
            <tr key={group.id}>
              {group.headers.map((header) => (
                <th key={header.id}>
                  <button
                    className="btn btn-ghost btn-xs"
                    type="button"
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {header.column.getIsSorted() === "asc" ? " ▲" : header.column.getIsSorted() === "desc" ? " ▼" : ""}
                  </button>
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 flex items-center gap-2">
        <button
          className="btn btn-outline btn-sm"
          type="button"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          이전
        </button>
        <span className="text-sm">
          {table.getState().pagination.pageIndex + 1} / {table.getPageCount() || 1}
        </span>
        <button
          className="btn btn-outline btn-sm"
          type="button"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          다음
        </button>
      </div>
    </div>
  );
}

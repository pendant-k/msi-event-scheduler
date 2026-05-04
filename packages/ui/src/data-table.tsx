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
import { ChevronLeft, ChevronRight, Inbox } from "lucide-react";
import { useMemo, useState } from "react";

export type SimpleColumn<T extends Record<string, unknown>> = {
  key: keyof T & string;
  label: string;
};

type PaginationItem = number | "ellipsis";

function getPaginationItems(currentPage: number, pageCount: number): PaginationItem[] {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }

  const pages = new Set<number>([1, pageCount, currentPage]);
  if (currentPage > 2) pages.add(currentPage - 1);
  if (currentPage < pageCount - 1) pages.add(currentPage + 1);
  if (currentPage <= 3) pages.add(2);
  if (currentPage >= pageCount - 2) pages.add(pageCount - 1);

  const sortedPages = Array.from(pages).sort((a, b) => a - b);
  return sortedPages.flatMap((page, index) => {
    const previous = sortedPages[index - 1];
    if (!previous || page - previous === 1) return [page];
    return ["ellipsis", page];
  });
}

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
  const pageCount = Math.max(1, table.getPageCount());
  const currentPage = table.getState().pagination.pageIndex + 1;
  const paginationItems = getPaginationItems(currentPage, pageCount);
  const hasRows = rows.length > 0;

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
          {hasRows ? (
            table.getRowModel().rows.map((row) => (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={columns.length}>
                <div className="flex min-h-48 flex-col items-center justify-center gap-3 py-14 text-center text-base-content/55">
                  <div className="rounded-full bg-base-200 p-3 text-base-content/35">
                    <Inbox aria-hidden="true" className="h-9 w-9" />
                  </div>
                  <div>
                    <div className="font-semibold text-base-content/70">표시할 데이터가 없습니다</div>
                    <div className="mt-1 text-sm">조건에 맞는 항목이 생기면 이 테이블에 표시됩니다.</div>
                  </div>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <div className="mt-4 flex items-center justify-center gap-1">
        <button
          className="btn btn-outline btn-sm btn-square"
          type="button"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
          aria-label="이전 페이지"
        >
          <ChevronLeft aria-hidden="true" className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-1 px-2">
          {paginationItems.map((item, index) =>
            item === "ellipsis" ? (
              <span key={`ellipsis-${index}`} className="px-1 text-sm font-semibold text-base-content/40">
                ...
              </span>
            ) : (
              <button
                key={item}
                className={`btn btn-sm btn-square ${item === currentPage ? "btn-primary" : "btn-ghost"}`}
                type="button"
                onClick={() => table.setPageIndex(item - 1)}
                aria-current={item === currentPage ? "page" : undefined}
              >
                {item}
              </button>
            )
          )}
        </div>
        <button
          className="btn btn-outline btn-sm btn-square"
          type="button"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
          aria-label="다음 페이지"
        >
          <ChevronRight aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

'use client';

/**
 * QueryResultTable.tsx
 *
 * A generic, dynamic table component for rendering LLM SQL query results.
 * Works with any table shape returned from the API
 */

import { useMemo, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

type SQLSnippet = {
  sql: string;
};

type TableSection = {
  type: 'table';
  columns: string[];
  data: Record<string, unknown>[];
};

type ConfirmationSection = {
  message: string;       // e.g. "1 row updated successfully."
  rowsAffected?: number;
};

export type StructuredResponse = {
  type: 'structured';
  sql?: SQLSnippet;
  explanation?: string;
  result?: TableSection;
  confirmation?: ConfirmationSection;
};

type GenericTableResponse = {
  type: 'table';
  columns: string[];
  data: Record<string, unknown>[];
};

export type LLMResponse = StructuredResponse | GenericTableResponse | string;

function isGenericTableResponse(val: unknown): val is GenericTableResponse {
  return (
    typeof val === 'object' &&
    val !== null &&
    (val as any).type === 'table' &&
    Array.isArray((val as any).columns) &&
    Array.isArray((val as any).data)
  );
}

function isTableSection(val: unknown): val is TableSection {
  return (
    typeof val === 'object' && val !== null &&
    (val as any).type === 'table' &&
    Array.isArray((val as any).columns) &&
    Array.isArray((val as any).data)
  );
}

function isStructuredResponse(val: unknown): val is StructuredResponse {
  return typeof val === 'object' && val !== null && (val as any).type === 'structured';
}

export function parseLLMResponse(raw: unknown): LLMResponse {
  if (typeof raw === 'object' && raw !== null) {
    if (isStructuredResponse(raw)) return raw;
    if (isGenericTableResponse(raw)) return raw;
    return String(raw);
  }

  if (typeof raw === 'string') {
    const stripped = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
    const jsonMatch = stripped.match(/\{[\s\S]*"type"\s*:\s*"(?:structured|table)"[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        if (isStructuredResponse(parsed) || isGenericTableResponse(parsed)) return parsed;
      } catch { /* fall through */ }
    }
    return raw;
  }

  return String(raw);
}


interface QueryResultTableProps {
  tableData: GenericTableResponse;
}

export function QueryResultTable({ tableData }: QueryResultTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);

  // Dynamically build columns from whatever the LLM returns
  const columns = useMemo<ColumnDef<Record<string, unknown>>[]>(
    () =>
      tableData.columns.map((col) => ({
        id: col,
        accessorKey: col,
        header: col,
        cell: ({ getValue }) => {
          const val = getValue();
          if (val === null || val === undefined) {
            return <span className="text-muted-foreground italic">null</span>;
          }
          return String(val);
        },
      })),
    [tableData.columns]
  );

  const table = useReactTable({
    data: tableData.data as Record<string, unknown>[],
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  });

  if (tableData.data.length === 0) {
    return (
      <div className="rounded-md border p-6 text-center text-sm text-muted-foreground">
        Query returned no results.
      </div>
    );
  }

  return (
    <div className="w-full space-y-2 overflow-hidden rounded-md border">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="whitespace-nowrap px-4 py-2 text-left font-medium text-muted-foreground"
                  >
                    {header.isPlaceholder ? null : (
                      <button
                        className={cn(
                          'flex items-center gap-1 hover:text-foreground transition-colors',
                          header.column.getCanSort() && 'cursor-pointer select-none'
                        )}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getIsSorted() === 'asc' ? (
                          <ChevronUp className="h-3 w-3" />
                        ) : header.column.getIsSorted() === 'desc' ? (
                          <ChevronDown className="h-3 w-3" />
                        ) : (
                          <ChevronsUpDown className="h-3 w-3 opacity-40" />
                        )}
                      </button>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row, i) => (
              <tr
                key={row.id}
                className={cn(
                  'border-t transition-colors hover:bg-muted/30',
                  i % 2 === 0 ? 'bg-background' : 'bg-muted/10'
                )}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-2 align-top">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-4 py-2 text-xs text-muted-foreground border-t">
        <span>
          {tableData.data.length} row{tableData.data.length !== 1 ? 's' : ''}
          {' · '}Page {table.getState().pagination.pageIndex + 1} of{' '}
          {table.getPageCount()}
        </span>
        <div className="flex gap-1">
          <button
            className="rounded px-2 py-1 hover:bg-muted disabled:opacity-40"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            ← Prev
          </button>
          <button
            className="rounded px-2 py-1 hover:bg-muted disabled:opacity-40"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Drop-in renderer for MessageBubble
// Replace: <pre className="...">{message.content}</pre>
// With:    {renderMessageContent(message.content)}
function StructuredResponseView({ data }: { data: StructuredResponse }) {
  return (
    <div className="space-y-3 text-sm">
      {data.sql && (
        <div className="rounded-md bg-zinc-900 text-zinc-100 px-4 py-3 font-mono text-xs overflow-x-auto">
          <p className="text-zinc-400 mb-1 font-sans text-xs uppercase tracking-wide">SQL</p>
          <pre className="whitespace-pre-wrap">{data.sql.sql}</pre>
        </div>
      )}
      {data.explanation && (
        <p className="text-muted-foreground">{data.explanation}</p>
      )}
      {data.result && isTableSection(data.result) && (
        <QueryResultTable tableData={data.result} />
      )}
      {data.confirmation && (
        <div className="flex items-center gap-2 rounded-md bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 px-4 py-2 text-green-800 dark:text-green-200">
          <span>✅</span>
          <span>{data.confirmation.message}</span>
          {data.confirmation.rowsAffected !== undefined && (
            <span className="ml-auto text-xs opacity-60">{data.confirmation.rowsAffected} row{data.confirmation.rowsAffected !== 1 ? 's' : ''} affected</span>
          )}
        </div>
      )}
    </div>
  );
}

export function renderMessageContent(content: unknown): React.ReactNode {
  const parsed = parseLLMResponse(content);

  if (typeof parsed === 'string') {
    return <pre className="whitespace-pre-wrap text-sm font-sans">{parsed}</pre>;
  }
  if (isStructuredResponse(parsed)) {
    return <StructuredResponseView data={parsed} />;
  }
  return <QueryResultTable tableData={parsed as GenericTableResponse} />;
}

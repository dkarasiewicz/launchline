'use client';

/**
 * DataTable Component
 *
 * A responsive data table with sorting, formatting, and mobile card view.
 */

import { useState, useMemo, useCallback, Component, ReactNode } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../ui/table';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../ui/tooltip';
import { Card, CardContent } from '../../ui/card';
import { ArrowUpDown, ArrowUp, ArrowDown, ExternalLink } from 'lucide-react';
import { cn } from '../../../lib/utils';
import type {
  Column,
  DataTableProps,
  FormatConfig,
  SortState,
  Tone,
} from './types';

// ============================================================================
// FORMAT VALUE COMPONENTS
// ============================================================================

function formatRelativeDate(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 30) return date.toLocaleDateString();
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
}

export function NumberValue({
  value,
  options,
  locale = 'en-US',
}: {
  value: number;
  options: Extract<FormatConfig, { kind: 'number' }>;
  locale?: string;
}) {
  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: options.decimals ?? 0,
    maximumFractionDigits: options.decimals ?? 0,
  }).format(value);
  return (
    <span>
      {formatted}
      {options.unit || ''}
    </span>
  );
}

export function CurrencyValue({
  value,
  options,
  locale = 'en-US',
}: {
  value: number;
  options: Extract<FormatConfig, { kind: 'currency' }>;
  locale?: string;
}) {
  const formatted = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: options.currency,
    minimumFractionDigits: options.decimals ?? 2,
    maximumFractionDigits: options.decimals ?? 2,
  }).format(value);
  return <span>{formatted}</span>;
}

export function PercentValue({
  value,
  options,
  locale = 'en-US',
}: {
  value: number;
  options: Extract<FormatConfig, { kind: 'percent' }>;
  locale?: string;
}) {
  const actualValue = options.basis === 'fraction' ? value * 100 : value;
  const sign = options.showSign && actualValue > 0 ? '+' : '';
  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: options.decimals ?? 0,
    maximumFractionDigits: options.decimals ?? 0,
  }).format(actualValue);
  return (
    <span>
      {sign}
      {formatted}%
    </span>
  );
}

export function DeltaValue({
  value,
  options,
}: {
  value: number;
  options: Extract<FormatConfig, { kind: 'delta' }>;
}) {
  const isPositive = value > 0;
  const isNegative = value < 0;
  const upIsGood = options.upIsPositive ?? true;

  const colorClass = isPositive
    ? upIsGood
      ? 'text-status-success'
      : 'text-status-error'
    : isNegative
      ? upIsGood
        ? 'text-status-error'
        : 'text-status-success'
      : 'text-muted-foreground';

  const sign = options.showSign && isPositive ? '+' : '';
  const formatted = value.toFixed(options.decimals ?? 2);

  return (
    <span className={colorClass}>
      {sign}
      {formatted}
    </span>
  );
}

export function DateValue({
  value,
  options,
  locale = 'en-US',
}: {
  value: string;
  options: Extract<FormatConfig, { kind: 'date' }>;
  locale?: string;
}) {
  const date = new Date(value);

  if (options.dateFormat === 'relative') {
    return <span>{formatRelativeDate(date)}</span>;
  }

  const formatted = date.toLocaleDateString(locale, {
    dateStyle: options.dateFormat === 'long' ? 'long' : 'short',
  });
  return <span>{formatted}</span>;
}

export function BooleanValue({
  value,
  options,
}: {
  value: boolean;
  options: Extract<FormatConfig, { kind: 'boolean' }>;
}) {
  const labels = options.labels ?? { true: 'Yes', false: 'No' };
  return <span>{value ? labels.true : labels.false}</span>;
}

export function LinkValue({
  value,
  row,
  options,
}: {
  value: string;
  row?: Record<string, unknown>;
  options: Extract<FormatConfig, { kind: 'link' }>;
}) {
  const href = options.hrefKey && row ? String(row[options.hrefKey]) : value;

  return (
    <a
      href={href}
      target={options.external ? '_blank' : undefined}
      rel={options.external ? 'noopener noreferrer' : undefined}
      className="text-primary hover:underline inline-flex items-center gap-1"
    >
      {value}
      {options.external && <ExternalLink className="h-3 w-3" />}
    </a>
  );
}

const toneStyles: Record<Tone, string> = {
  neutral: 'bg-muted text-muted-foreground',
  info: 'bg-status-info-muted text-status-info',
  success: 'bg-status-success-muted text-status-success',
  warning: 'bg-status-warning-muted text-status-warning',
  danger: 'bg-status-error-muted text-status-error',
};

export function BadgeValue({
  value,
  options,
}: {
  value: string;
  options: Extract<FormatConfig, { kind: 'badge' }>;
}) {
  const tone = options.colorMap?.[value] ?? 'neutral';
  return (
    <Badge
      variant="secondary"
      className={cn('text-xs font-medium', toneStyles[tone])}
    >
      {value}
    </Badge>
  );
}

export function StatusBadge({
  value,
  options,
}: {
  value: string;
  options: Extract<FormatConfig, { kind: 'status' }>;
}) {
  const status = options.statusMap[value];
  if (!status) return <span>{value}</span>;

  return (
    <Badge
      variant="secondary"
      className={cn('text-xs font-medium', toneStyles[status.tone])}
    >
      {status.label ?? value}
    </Badge>
  );
}

export function ArrayValue({
  value,
  options,
}: {
  value: unknown[];
  options: Extract<FormatConfig, { kind: 'array' }>;
}) {
  const maxVisible = options.maxVisible ?? 3;
  const visible = value.slice(0, maxVisible);
  const remaining = value.length - maxVisible;

  return (
    <div className="flex flex-wrap gap-1">
      {visible.map((item, i) => (
        <Badge key={i} variant="secondary" className="text-xs">
          {String(item)}
        </Badge>
      ))}
      {remaining > 0 && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="text-xs cursor-help">
                +{remaining}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              {value.slice(maxVisible).join(', ')}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}

// ============================================================================
// CELL RENDERER
// ============================================================================

function CellValue<T extends Record<string, unknown>>({
  value,
  column,
  row,
  locale,
}: {
  value: unknown;
  column: Column<T>;
  row: T;
  locale: string;
}) {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground">-</span>;
  }

  const format = column.format;

  if (!format) {
    const content = String(value);
    if (column.truncate) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="truncate block max-w-[200px]">{content}</span>
            </TooltipTrigger>
            <TooltipContent>{content}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }
    return <span>{content}</span>;
  }

  switch (format.kind) {
    case 'number':
      return (
        <NumberValue value={Number(value)} options={format} locale={locale} />
      );
    case 'currency':
      return (
        <CurrencyValue value={Number(value)} options={format} locale={locale} />
      );
    case 'percent':
      return (
        <PercentValue value={Number(value)} options={format} locale={locale} />
      );
    case 'delta':
      return <DeltaValue value={Number(value)} options={format} />;
    case 'date':
      return (
        <DateValue value={String(value)} options={format} locale={locale} />
      );
    case 'boolean':
      return <BooleanValue value={Boolean(value)} options={format} />;
    case 'link':
      return <LinkValue value={String(value)} row={row} options={format} />;
    case 'badge':
      return <BadgeValue value={String(value)} options={format} />;
    case 'status':
      return <StatusBadge value={String(value)} options={format} />;
    case 'array':
      return (
        <ArrayValue
          value={Array.isArray(value) ? value : [value]}
          options={format}
        />
      );
    default:
      return <span>{String(value)}</span>;
  }
}

// ============================================================================
// SORT BUTTON
// ============================================================================

function SortButton<T>({
  column,
  sort,
  onSort,
}: {
  column: Column<T>;
  sort: SortState<T>;
  onSort: (key: keyof T) => void;
}) {
  const isActive = sort.by === column.key;

  return (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-3 h-8 data-[state=open]:bg-accent"
      onClick={() => onSort(column.key)}
    >
      <span>{column.label}</span>
      {isActive ? (
        sort.direction === 'asc' ? (
          <ArrowUp className="ml-2 h-4 w-4" />
        ) : (
          <ArrowDown className="ml-2 h-4 w-4" />
        )
      ) : (
        <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />
      )}
    </Button>
  );
}

// ============================================================================
// MOBILE CARD VIEW
// ============================================================================

function MobileCardView<T extends Record<string, unknown>>({
  data,
  columns,
  rowIdKey,
  locale,
}: {
  data: T[];
  columns: Column<T>[];
  rowIdKey: keyof T;
  locale: string;
}) {
  const primaryColumns = columns.filter((c) => c.priority === 'primary');
  const otherColumns = columns.filter((c) => c.priority !== 'primary');

  return (
    <div className="space-y-3 md:hidden">
      {data.map((row) => (
        <Card key={String(row[rowIdKey])} className="overflow-hidden">
          <CardContent className="p-4 space-y-2">
            {primaryColumns.map((col) => (
              <div key={String(col.key)} className="font-medium">
                <CellValue
                  value={row[col.key]}
                  column={col}
                  row={row}
                  locale={locale}
                />
              </div>
            ))}
            {otherColumns.length > 0 && (
              <div className="grid grid-cols-2 gap-2 pt-2 border-t">
                {otherColumns.map((col) => (
                  <div key={String(col.key)}>
                    <div className="text-xs text-muted-foreground mb-0.5">
                      {col.label}
                    </div>
                    <CellValue
                      value={row[col.key]}
                      column={col}
                      row={row}
                      locale={locale}
                    />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ============================================================================
// MAIN DATA TABLE COMPONENT
// ============================================================================

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  rowIdKey,
  locale = 'en-US',
  defaultSort,
  sort: controlledSort,
  onSortChange,
  className,
}: DataTableProps<T>) {
  const [internalSort, setInternalSort] = useState<SortState<T>>(
    defaultSort ?? {},
  );

  const sort = controlledSort ?? internalSort;

  const handleSort = useCallback(
    (key: keyof T) => {
      const newSort: SortState<T> = {
        by: key,
        direction: sort.by === key && sort.direction === 'asc' ? 'desc' : 'asc',
      };
      if (onSortChange) {
        onSortChange(newSort);
      } else {
        setInternalSort(newSort);
      }
    },
    [sort, onSortChange],
  );

  const sortedData = useMemo(() => {
    if (!sort.by) return data;

    return [...data].sort((a, b) => {
      const aVal = a[sort.by!];
      const bVal = b[sort.by!];

      if (aVal === bVal) return 0;
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      const comparison = aVal < bVal ? -1 : 1;
      return sort.direction === 'desc' ? -comparison : comparison;
    });
  }, [data, sort]);

  return (
    <div className={cn('w-full', className)}>
      {/* Mobile Card View */}
      <MobileCardView
        data={sortedData}
        columns={columns}
        rowIdKey={rowIdKey}
        locale={locale}
      />

      {/* Desktop Table View */}
      <div className="hidden md:block rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              {columns.map((column) => (
                <TableHead
                  key={String(column.key)}
                  className={cn(
                    column.align === 'right' && 'text-right',
                    column.align === 'center' && 'text-center',
                  )}
                >
                  {column.sortable !== false ? (
                    <SortButton
                      column={column}
                      sort={sort}
                      onSort={handleSort}
                    />
                  ) : (
                    column.label
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedData.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  No data available
                </TableCell>
              </TableRow>
            ) : (
              sortedData.map((row) => (
                <TableRow key={String(row[rowIdKey])}>
                  {columns.map((column) => (
                    <TableCell
                      key={String(column.key)}
                      className={cn(
                        column.align === 'right' && 'text-right',
                        column.align === 'center' && 'text-center',
                      )}
                    >
                      <CellValue
                        value={row[column.key]}
                        column={column}
                        row={row}
                        locale={locale}
                      />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ============================================================================
// ERROR BOUNDARY
// ============================================================================

interface DataTableErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface DataTableErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class DataTableErrorBoundary extends Component<
  DataTableErrorBoundaryProps,
  DataTableErrorBoundaryState
> {
  constructor(props: DataTableErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): DataTableErrorBoundaryState {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <Card className="w-full border-destructive/50">
            <CardContent className="pt-6">
              <p className="text-sm text-destructive">
                Failed to render table: {this.state.error?.message}
              </p>
            </CardContent>
          </Card>
        )
      );
    }

    return this.props.children;
  }
}

// ============================================================================
// SERIALIZATION HELPER
// ============================================================================

export function parseSerializableDataTable<T extends Record<string, unknown>>(
  input: unknown,
): { columns: Column<T>[]; data: T[] } {
  if (typeof input === 'string') {
    return JSON.parse(input);
  }
  return input as { columns: Column<T>[]; data: T[] };
}

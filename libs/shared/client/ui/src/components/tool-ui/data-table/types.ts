/**
 * DataTable Types
 */

export type Tone = "neutral" | "info" | "success" | "warning" | "danger";

export type FormatConfig =
  | { kind: "number"; decimals?: number; unit?: string }
  | { kind: "currency"; currency: string; decimals?: number }
  | { kind: "percent"; basis: "fraction" | "unit"; decimals?: number; showSign?: boolean }
  | { kind: "delta"; decimals?: number; upIsPositive?: boolean; showSign?: boolean }
  | { kind: "date"; dateFormat?: "short" | "long" | "relative" }
  | { kind: "boolean"; labels?: { true: string; false: string } }
  | { kind: "link"; hrefKey?: string; external?: boolean }
  | { kind: "badge"; colorMap?: Record<string, Tone> }
  | { kind: "status"; statusMap: Record<string, { tone: Tone; label?: string }> }
  | { kind: "array"; maxVisible?: number };

export interface Column<T = Record<string, unknown>> {
  key: keyof T;
  label: string;
  format?: FormatConfig;
  priority?: "primary" | "secondary" | "tertiary";
  sortable?: boolean;
  align?: "left" | "right" | "center";
  truncate?: boolean;
}

export interface SortState<T = Record<string, unknown>> {
  by?: keyof T;
  direction?: "asc" | "desc";
}

export interface DataTableProps<T extends Record<string, unknown>> {
  columns: Column<T>[];
  data: T[];
  rowIdKey: keyof T;
  locale?: string;
  defaultSort?: SortState<T>;
  sort?: SortState<T>;
  onSortChange?: (sort: SortState<T>) => void;
  responseActions?: any;
  onResponseAction?: (actionId: string) => void;
  onBeforeResponseAction?: (actionId: string) => boolean | Promise<boolean>;
  className?: string;
}

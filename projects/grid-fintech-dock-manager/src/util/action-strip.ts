import type { IgrActionStrip } from "igniteui-react-grids";

/** The row an action strip is showing for, as the grid hands it over. */
interface StripContext<T> {
  key?: unknown;
  data?: T;
}

/**
 * The row the strip is currently attached to. The grid moves one strip from
 * row to row as the pointer or focus reaches them, and keeps the row it is
 * showing for on the element's `context`.
 */
export function stripRow<T>(strip: IgrActionStrip | null): StripContext<T> | undefined {
  return (strip as (IgrActionStrip & { context?: StripContext<T> }) | null)?.context;
}

/** The primary key of the row the strip is showing for. */
export function stripRowKey(strip: IgrActionStrip | null): unknown {
  return stripRow(strip)?.key;
}

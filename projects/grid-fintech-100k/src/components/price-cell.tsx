import { useEffect } from "react";
import { IgrIcon } from "igniteui-react";
import type { IgrColumn } from "igniteui-react-grids";
import { FINJS_ICON_COLLECTION } from "../services/finjs-icons";
import { trends } from "../services/finjs-trends";

const priceFormat = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
});

/** The arrow (1rem) and the gap before the price (0.25rem), in `rem`. */
const ARROW_SLOT_REM = 1.25;

const fittedColumns = new WeakSet<IgrColumn>();

/**
 * Sizes the Price column to its widest price, arrow included, once its cells
 * have been filled.
 *
 * The grid sizes a `fit-content` column when it first renders, and a template
 * column's cells are filled a task later, so that size is the header's alone.
 * Sizing it again afterwards still leaves out the arrow: the template's content
 * sits in a `display: contents` wrapper, and the grid measures a cell with a
 * `Range`, which counts text but not the boxes inside such a wrapper. So the
 * arrow's width is added here.
 */
function fitPriceColumn(column: IgrColumn): void {
  column.autosize();
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
  column.width = `${Math.ceil(parseFloat(column.width) + ARROW_SLOT_REM * rem)}px`;
}

interface PriceCellProps {
  column: IgrColumn;
  price: number;
  changeP: number;
}

/** The price, with an arrow when the day's change is not zero. */
export function PriceCell({ column, price, changeP }: PriceCellProps) {
  useEffect(() => {
    if (fittedColumns.has(column)) return;
    fittedColumns.add(column);
    // One frame on, so every visible cell has its content before it is measured.
    requestAnimationFrame(() => fitPriceColumn(column));
  }, [column]);

  return (
    <div className="finjs-icons">
      {trends.positive({ changeP }) && <IgrIcon name="arrow_upward" collection={FINJS_ICON_COLLECTION} aria-hidden="true" />}
      {trends.negative({ changeP }) && <IgrIcon name="arrow_downward" collection={FINJS_ICON_COLLECTION} aria-hidden="true" />}
      <span>{priceFormat.format(price)}</span>
    </div>
  );
}

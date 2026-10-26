import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IgrBadge, IgrButton, IgrChip, IgrIcon, IgrIconButton } from "igniteui-react";
import { IgrActionStrip, IgrColumn, IgrGrid, type IgrCellTemplateContext } from "igniteui-react-grids";
import type { Order, OrderStatus } from "../models/stock.model";
import { useDesk } from "../services/desk";
import { stripRow } from "../util/action-strip";
import { money, shortClock } from "../util/finance";
import { ICONS } from "../util/icons";
import { useStore } from "../util/use-store";

const STATUS_FILTERS = ["All", "Working", "Filled", "Cancelled"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

/** An order plus the single price the blotter shows for it. */
interface BlotterRow extends Order {
  /** Fill price once filled, otherwise the resting limit or stop. */
  displayPrice: number | null;
  priceKind: "Fill" | "Limit" | "Stop" | "Trail" | "Mkt";
}

function toBlotterRow(order: Order): BlotterRow {
  if (order.status === "Filled") {
    return { ...order, displayPrice: order.fillPrice, priceKind: "Fill" };
  }

  switch (order.type) {
    case "Market":
      return { ...order, displayPrice: null, priceKind: "Mkt" };
    case "Limit":
      return { ...order, displayPrice: order.limitPrice, priceKind: "Limit" };
    case "Trailing Stop":
      return { ...order, displayPrice: order.stopPrice, priceKind: "Trail" };
    default:
      return { ...order, displayPrice: order.stopPrice ?? order.limitPrice, priceKind: "Stop" };
  }
}

function countBy(orders: readonly Order[], status: OrderStatus): number {
  return orders.reduce((total, order) => total + (order.status === status ? 1 : 0), 0);
}

/** Order status → badge colour. */
function badgeVariant(status: OrderStatus): "warning" | "success" | "danger" | "primary" {
  switch (status) {
    case "Working":
      return "warning";
    case "Filled":
      return "success";
    case "Rejected":
      return "danger";
    default:
      return "primary";
  }
}

// ── Cell templates ──────────────────────────────────────────────────────────

const timeCell = (ctx: IgrCellTemplateContext) => <span>{shortClock(ctx.cell.value)}</span>;
const symbolCell = (ctx: IgrCellTemplateContext) => <span className="symbol-cell">{ctx.cell.value}</span>;
const sideCell = (ctx: IgrCellTemplateContext) => (
  <span className={`side-tag ${ctx.cell.value === "BUY" ? "side-buy" : "side-sell"}`}>{ctx.cell.value}</span>
);
const priceCell = (ctx: IgrCellTemplateContext) => (
  <>
    <span>{money(ctx.cell.value)}</span>
    <span className="price-kind">{(ctx.cell.row.data as BlotterRow).priceKind}</span>
  </>
);
const statusCell = (ctx: IgrCellTemplateContext) => (
  <IgrBadge className="status-badge" variant={badgeVariant(ctx.cell.value)}>
    <span className="badge-value">{ctx.cell.value}</span>
  </IgrBadge>
);
const noteCell = (ctx: IgrCellTemplateContext) => (
  <span className="note-cell" title={ctx.cell.value}>
    {ctx.cell.value}
  </span>
);

function Blotter() {
  const { trading, workspace } = useDesk();
  const stripRef = useRef<IgrActionStrip>(null);
  const [activeFilter, setActiveFilter] = useState<StatusFilter>("All");
  /** Whether the row the action strip is showing for can still be cancelled. */
  const [stripWorking, setStripWorking] = useState(false);

  const orders = useStore(trading, (state) => state.orders);

  const rows = useMemo(
    () => orders.filter((order) => activeFilter === "All" || order.status === activeFilter).map(toBlotterRow),
    [orders, activeFilter],
  );

  /** Per-status counts for the filter chips; rejections count as cancelled. */
  const counts: Record<StatusFilter, number> = {
    All: orders.length,
    Working: countBy(orders, "Working"),
    Filled: countBy(orders, "Filled"),
    Cancelled: countBy(orders, "Cancelled") + countBy(orders, "Rejected"),
  };
  const workingCount = counts.Working;

  /**
   * Single-choice filter, which a chip does not model on its own. A filter is
   * always applied, so a click on the active chip — which the chip has already
   * taken as a deselect — selects it again instead of clearing the filter.
   */
  const onFilterChipSelect = (filter: StatusFilter, event: CustomEvent<boolean>) => {
    if (!event.detail) {
      (event.target as IgrChip).selected = true;
      return;
    }
    setActiveFilter(filter);
  };

  // The strip moves to a row as the pointer or focus reaches it, and its cancel
  // action is enabled only while that row's order is working.
  const syncStrip = useCallback(() => {
    requestAnimationFrame(() => {
      setStripWorking(stripRow<BlotterRow>(stripRef.current)?.data?.status === "Working");
    });
  }, []);

  // An order can also stop working under a strip that stays put — it fills or
  // is cancelled from the toolbar — so every change to the book re-checks it.
  useEffect(() => syncStrip(), [orders, syncStrip]);

  const cancel = () => {
    const order = stripRow<BlotterRow>(stripRef.current)?.data;
    if (order?.status === "Working") {
      trading.cancelOrder(order.id);
    }
  };

  return (
    <div className="desk-pane blotter-pane">
      <header className="blotter-bar">
        <div className="blotter-filters" role="group" aria-label="Filter orders by status">
          {STATUS_FILTERS.map((filter) => (
            <IgrChip
              key={filter}
              className="blotter-chip"
              selectable
              selected={activeFilter === filter}
              onSelect={(event) => onFilterChipSelect(filter, event)}
            >
              {filter}
              <span slot="suffix" className="filter-count">
                {counts[filter]}
              </span>
            </IgrChip>
          ))}
        </div>

        <IgrButton variant="flat" className="cancel-all" disabled={workingCount === 0} onClick={() => trading.cancelAllWorking()}>
          <IgrIcon slot="prefix" name="cancel" collection={ICONS} aria-hidden="true" />
          Cancel all
        </IgrButton>
      </header>

      <div className="grid-host" onMouseOver={syncStrip} onFocus={syncStrip}>
        <IgrGrid
          className="blotter-grid desk-grid"
          data={rows}
          primaryKey="id"
          autoGenerate={false}
          hideRowSelectors
          rowHeight={36}
          height="100%"
          width="100%"
          emptyGridMessage="No orders yet — place one from the ticket."
          onRowClick={(event) => {
            const symbol = (event.detail.row.data as BlotterRow | undefined)?.symbol;
            if (symbol) {
              workspace.selectSymbol(symbol);
            }
          }}
        >
          <IgrColumn field="placedAt" header="Time" dataType="date" sortable width="70px" bodyTemplate={timeCell} />
          <IgrColumn field="symbol" header="Symbol" sortable width="82px" bodyTemplate={symbolCell} />
          <IgrColumn field="side" header="Side" sortable width="62px" bodyTemplate={sideCell} />
          <IgrColumn field="quantity" header="Qty" dataType="number" sortable width="62px" />
          <IgrColumn field="type" header="Type" sortable width="104px" />
          <IgrColumn field="displayPrice" header="Price" dataType="number" sortable width="112px" bodyTemplate={priceCell} />
          <IgrColumn field="timeInForce" header="TIF" sortable width="62px" />
          <IgrColumn field="status" header="Status" sortable width="96px" bodyTemplate={statusCell} />
          <IgrColumn field="note" header="Detail" width="240px" bodyTemplate={noteCell} />

          <IgrActionStrip ref={stripRef}>
            <IgrIconButton
              variant="flat"
              name="delete_outline"
              collection={ICONS}
              title="Cancel order"
              aria-label="Cancel order"
              disabled={!stripWorking}
              onClick={cancel}
            />
          </IgrActionStrip>
        </IgrGrid>
      </div>
    </div>
  );
}

export default memo(Blotter);

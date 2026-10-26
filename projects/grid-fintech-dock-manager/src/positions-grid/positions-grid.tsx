import { memo, useMemo, useRef } from "react";
import { IgrIconButton, IgrLinearProgress } from "igniteui-react";
import { IgrActionStrip, IgrColumn, IgrGrid, type IgrCellTemplateContext } from "igniteui-react-grids";
import type { Position } from "../models/stock.model";
import { useDesk } from "../services/desk";
import { stripRowKey } from "../util/action-strip";
import { money, price, signed } from "../util/finance";
import { ICONS } from "../util/icons";
import { useRefreshOnTick } from "../util/live-grid";
import { useStore } from "../util/use-store";
import { CurrencySumSummary } from "./positions-summaries";

// ── Cell templates ──────────────────────────────────────────────────────────

const symbolCell = (ctx: IgrCellTemplateContext) => <span className="symbol-cell">{ctx.cell.value}</span>;
const moneyCell = (ctx: IgrCellTemplateContext) => <span>{money(ctx.cell.value)}</span>;
const livePriceCell = (ctx: IgrCellTemplateContext) => <span className="live-price">{money(ctx.cell.value)}</span>;

/** A P&L amount over its percentage, tinted by direction. */
function PlCell({ amount, pct }: { amount: number; pct: number }) {
  return (
    <div className={`pl-cell ${amount >= 0 ? "pos-pnl" : "neg-pnl"}`}>
      <span className="pl-amount">{signed(amount, "money")}</span>
      <span className="pl-pct">{signed(pct, "pct")}</span>
    </div>
  );
}

const dayPlCell = (ctx: IgrCellTemplateContext) => (
  <PlCell amount={ctx.cell.value} pct={(ctx.cell.row.data as Position).dayChangePct} />
);
const openPlCell = (ctx: IgrCellTemplateContext) => (
  <PlCell amount={ctx.cell.value} pct={(ctx.cell.row.data as Position).openPlPct} />
);

const weightCell = (ctx: IgrCellTemplateContext) => (
  <div className="weight-cell" title={`${ctx.cell.value}% of gross exposure`}>
    <IgrLinearProgress className="weight-bar" value={ctx.cell.value} max={100} hideLabel animationDuration={0} />
    <span className="weight-value">{price(ctx.cell.value, 1)}%</span>
  </div>
);

function PositionsGrid() {
  const { trading, workspace } = useDesk();
  const gridRef = useRef<IgrGrid>(null);
  const stripRef = useRef<IgrActionStrip>(null);

  /** Stable across ticks — the engine marks these to market in place. */
  const positions = useStore(trading, (state) => state.positions);
  const selectedSymbol = useStore(workspace, (state) => state.selectedSymbol);
  const selectedRows = useMemo(() => [selectedSymbol], [selectedSymbol]);

  useRefreshOnTick(gridRef, trading, "marks");

  const selectSymbol = (symbol: unknown) => {
    if (typeof symbol === "string") {
      workspace.selectSymbol(symbol);
    }
  };

  /** Points the ticket at the row's symbol, on the buy side. */
  const addTo = () => {
    const symbol = stripRowKey(stripRef.current);
    if (typeof symbol === "string") {
      workspace.prepareOrder(symbol, "BUY");
    }
  };

  /** Sells the whole position at market — the desk's "flatten" shortcut. */
  const flatten = () => {
    const symbol = stripRowKey(stripRef.current);
    if (typeof symbol === "string") {
      trading.flatten(symbol);
    }
  };

  return (
    <div className="desk-pane positions-pane">
      <div className="grid-host">
        <IgrGrid
          ref={gridRef}
          className="positions-grid desk-grid"
          data={positions}
          primaryKey="symbol"
          autoGenerate={false}
          hideRowSelectors
          rowSelection="single"
          selectedRows={selectedRows}
          rowHeight={38}
          summaryRowHeight={42}
          height="100%"
          width="100%"
          emptyGridMessage="No open positions — place an order to build the book."
          onRowClick={(event) => selectSymbol(event.detail.row.key)}
        >
          <IgrColumn field="symbol" header="Symbol" sortable pinned width="88px" bodyTemplate={symbolCell} />
          <IgrColumn field="quantity" header="Qty" dataType="number" sortable width="64px" />
          <IgrColumn field="avgCost" header="Avg cost" dataType="number" sortable width="94px" bodyTemplate={moneyCell} />
          <IgrColumn field="last" header="Last" dataType="number" sortable width="94px" bodyTemplate={livePriceCell} />
          <IgrColumn
            field="marketValue"
            header="Market value"
            dataType="number"
            sortable
            hasSummary
            summaries={CurrencySumSummary}
            width="120px"
            bodyTemplate={moneyCell}
          />
          <IgrColumn
            field="dayChange"
            header="Day P&L"
            dataType="number"
            sortable
            hasSummary
            summaries={CurrencySumSummary}
            width="118px"
            bodyTemplate={dayPlCell}
          />
          <IgrColumn
            field="openPl"
            header="Open P&L"
            dataType="number"
            sortable
            hasSummary
            summaries={CurrencySumSummary}
            width="118px"
            bodyTemplate={openPlCell}
          />
          <IgrColumn field="weight" header="Weight" dataType="number" sortable width="96px" bodyTemplate={weightCell} />

          <IgrActionStrip ref={stripRef}>
            <IgrIconButton
              variant="flat"
              name="add"
              collection={ICONS}
              title="Add to position"
              aria-label="Add to position"
              onClick={addTo}
            />
            <IgrIconButton
              variant="flat"
              className="flatten-btn"
              name="close_fullscreen"
              collection={ICONS}
              title="Flatten position at market"
              aria-label="Flatten position at market"
              onClick={flatten}
            />
          </IgrActionStrip>
        </IgrGrid>
      </div>

      <AccountFooter />
    </div>
  );
}

export default memo(PositionsGrid);

/**
 * Net liq. and Day P&L are account-wide and already sit in the command bar.
 * What is left here is what the book itself says: unrealised, realised, and
 * how much of the account it uses. Its own component, as it changes on every
 * tick and the grid above it does not.
 */
function AccountFooter() {
  const { trading } = useDesk();
  const account = useStore(trading, (state) => state.account);

  return (
    <footer className="account-footer">
      <div className="footer-stat">
        <span className="footer-label section-label">Open P&amp;L</span>
        <span className={`footer-value mono ${account.openPl >= 0 ? "pos-pnl" : "neg-pnl"}`}>
          {signed(account.openPl, "money")}
        </span>
      </div>
      <div className="footer-stat">
        <span className="footer-label section-label">Realised</span>
        <span className={`footer-value mono ${account.realizedPl >= 0 ? "pos-pnl" : "neg-pnl"}`}>
          {signed(account.realizedPl, "money")}
        </span>
      </div>
      <div className="footer-stat">
        <span className="footer-label section-label">Exposure</span>
        <span className="footer-value mono">{price(account.utilisation, 1)}%</span>
      </div>
    </footer>
  );
}

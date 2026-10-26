import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import { IgrIcon, IgrIconButton, IgrInput } from "igniteui-react";
import {
  IgrColumn,
  IgrGrid,
  IgrGridToolbar,
  IgrGridToolbarActions,
  IgrGridToolbarExporter,
  IgrGridToolbarHiding,
  IgrGridToolbarPinning,
  IgrGridToolbarTitle,
  type IgrCellTemplateContext,
  type IgrColumnExportingEventArgsDetail,
  type IgrExporterEventArgsDetail,
} from "igniteui-react-grids";
import { FinanceViewContext, type FinanceViewState } from "../finance-view-context";
import { FINANCE_ICON_COLLECTION, registerFinanceIcons } from "../services/finance-icons";
import { LivePortfolio, type LivePortfolioRow } from "../services/live-portfolio";
import { matchesAsset } from "../services/text-matches";
import { AllocationCell, AssetCell, HoldingCell, MarketValueCell, NetProfitCell, PriceCell } from "./finance-cells";
import PriceTrend from "./price-trend";

/** Below this viewport width only the Asset, Price, Total Revenue and Allocation columns show. */
const NARROW_VIEWPORT = 700;

/** Columns that are left out of every export: the sparkline's series has no cell value to write. */
const NON_EXPORTABLE_FIELDS = new Set(["priceTrend"]);

const rowOf = (ctx: IgrCellTemplateContext): LivePortfolioRow => ctx.cell.row.data as LivePortfolioRow;

// The cell templates. The grid keeps the functions it is first given, so they
// read only the row; view state reaches the cells through FinanceViewContext.
const assetTemplate = (ctx: IgrCellTemplateContext) => {
  const row = rowOf(ctx);
  return <AssetCell ticker={row.ticker} company={row.company} tone={row.tone} />;
};

const priceTrendTemplate = (ctx: IgrCellTemplateContext) => {
  const row = rowOf(ctx);
  return <PriceTrend series={row.priceTrend} changePct={row.changePct} />;
};

const priceTemplate = (ctx: IgrCellTemplateContext) => {
  const row = rowOf(ctx);
  return <PriceCell lastPrice={row.lastPrice} changePct={row.changePct} direction={row.direction} />;
};

const holdingTemplate = (ctx: IgrCellTemplateContext) => <HoldingCell days={rowOf(ctx).holdingPeriodDays} />;

const marketValueTemplate = (ctx: IgrCellTemplateContext) => <MarketValueCell value={rowOf(ctx).marketValue} />;

const netProfitTemplate = (ctx: IgrCellTemplateContext) => {
  const row = rowOf(ctx);
  return <NetProfitCell netProfit={row.netProfit} netProfitPct={row.netProfitPct} direction={row.direction} />;
};

const allocationTemplate = (ctx: IgrCellTemplateContext) => <AllocationCell value={rowOf(ctx).allocationPct} />;

interface Subscribable<T> {
  subscribe(next: (value: T) => void): { unsubscribe(): void };
}

/**
 * The exporter the toolbar hands to `exportStarted`. Its typings describe DOM
 * events, but at runtime its events are emitters to subscribe to.
 */
interface ExporterEmitters {
  columnExporting: Subscribable<IgrColumnExportingEventArgsDetail>;
  exportEnded: Subscribable<unknown>;
}

/** Keeps the sparkline column out of an export, for as long as that export runs. */
function excludeChartColumns(event: CustomEvent<IgrExporterEventArgsDetail>): void {
  const exporter = event.detail.exporter as unknown as ExporterEmitters;
  const columns = exporter.columnExporting.subscribe((args) => {
    if (NON_EXPORTABLE_FIELDS.has(args.field)) {
      args.cancel = true;
    }
  });
  const ended = exporter.exportEnded.subscribe(() => {
    columns.unsubscribe();
    ended.unsubscribe();
  });
}

interface PortfolioGridProps {
  gridRef: RefObject<IgrGrid | null>;
  rows: LivePortfolioRow[];
  query: string;
  onQueryChange: (query: string) => void;
  hideMostColumns: boolean;
}

/**
 * The holdings grid. Memoized, so a theme or feed toggle does not hand the
 * grid its data again; the cells follow those through the context instead.
 *
 * `rowHeight` is set because three columns stack two rows of figures: an
 * outlined chip over a bar would clip in the large size's default row.
 */
const PortfolioGrid = memo(function PortfolioGrid({ gridRef, rows, query, onQueryChange, hideMostColumns }: PortfolioGridProps) {
  const priceTrendColumn = useRef<IgrColumn>(null);
  const holdingColumn = useRef<IgrColumn>(null);
  const marketValueColumn = useRef<IgrColumn>(null);

  // The narrow layout hides three columns when the breakpoint is crossed, and
  // only then: a column wrapper writes all of its props to the column again
  // whenever its cells re-render, which is on every live tick, so a `hidden`
  // prop would undo a column the user hid or showed from the toolbar.
  useLayoutEffect(() => {
    for (const column of [priceTrendColumn, holdingColumn, marketValueColumn]) {
      if (column.current) column.current.hidden = hideMostColumns;
    }
  }, [hideMostColumns]);

  // The grid works out its `aria-rowcount` once, when it first renders, which
  // is before it has been given any rows, and does not update it; so the count
  // (the rows plus the header row) is kept in step here.
  useEffect(() => {
    gridRef.current?.setAttribute("aria-rowcount", String(rows.length + 1));
  }, [gridRef, rows]);

  return (
    <IgrGrid
      ref={gridRef}
      className="finance-grid"
      data={rows}
      autoGenerate={false}
      showGroupArea
      rowSelection="none"
      primaryKey="ticker"
      height="100%"
      rowHeight={60}
    >
      <IgrGridToolbar>
        <IgrGridToolbarTitle>Holdings</IgrGridToolbarTitle>
        {/* A placeholder rather than a floating label, so the field stays one line high in the toolbar. */}
        <IgrInput
          className="finance-toolbar-search"
          id="finance-asset-filter"
          type="search"
          placeholder="Filter by asset"
          aria-label="Filter by asset"
          value={query}
          onInput={(event) => onQueryChange(event.detail)}
        >
          <IgrIcon slot="prefix" name="search" collection={FINANCE_ICON_COLLECTION} aria-hidden="true" />
        </IgrInput>
        <IgrGridToolbarActions>
          <IgrGridToolbarHiding />
          <IgrGridToolbarPinning />
          <IgrGridToolbarExporter onExportStarted={excludeChartColumns} />
        </IgrGridToolbarActions>
      </IgrGridToolbar>
      <IgrColumn field="ticker" header="Asset" sortable filterable={false} minWidth="260px" bodyTemplate={assetTemplate} />
      <IgrColumn
        ref={priceTrendColumn}
        field="priceTrend"
        header="Price Trend"
        sortable={false}
        filterable={false}
        minWidth="200px"
        bodyTemplate={priceTrendTemplate}
      />
      <IgrColumn
        field="lastPrice"
        header="Price (Change)"
        sortable
        filterable={false}
        minWidth="200px"
        dataType="number"
        bodyTemplate={priceTemplate}
      />
      <IgrColumn
        ref={holdingColumn}
        field="holdingPeriodDays"
        header="Holding Period"
        sortable
        filterable={false}
        minWidth="230px"
        bodyTemplate={holdingTemplate}
      />
      <IgrColumn
        ref={marketValueColumn}
        field="marketValue"
        header="Market Value"
        sortable
        filterable={false}
        minWidth="180px"
        dataType="number"
        bodyTemplate={marketValueTemplate}
      />
      <IgrColumn
        field="netProfit"
        header="Total Revenue"
        sortable
        filterable={false}
        minWidth="200px"
        dataType="number"
        bodyTemplate={netProfitTemplate}
      />
      <IgrColumn field="allocationPct" header="Allocation" sortable filterable={false} minWidth="170px" bodyTemplate={allocationTemplate} />
    </IgrGrid>
  );
});

/**
 * Financial Portfolio: holdings marked to a simulated live market, with the
 * day's change, the profit and loss, the holding period's tax line and each
 * position's share of the portfolio.
 */
export default function FinanceGrid() {
  const [portfolio] = useState(() => new LivePortfolio());
  const isLive = useSyncExternalStore(portfolio.subscribeLive, portfolio.getIsLive);
  const [isDark, setIsDark] = useState(false);
  const [query, setQuery] = useState("");
  const [hideMostColumns, setHideMostColumns] = useState(() => window.innerWidth < NARROW_VIEWPORT);
  const gridRef = useRef<IgrGrid>(null);

  // Before the first paint, so the icons never show empty.
  useLayoutEffect(() => {
    registerFinanceIcons();
  }, []);

  useEffect(() => {
    portfolio.start();
    return () => portfolio.stop();
  }, [portfolio]);

  // Rows are marked to market in place, so the grid never sees a new `data`
  // array to react to; `markForCheck()` re-runs the visible cell templates.
  useEffect(() => portfolio.onTick(() => gridRef.current?.markForCheck()), [portfolio]);

  useEffect(() => {
    const onResize = () => setHideMostColumns(window.innerWidth < NARROW_VIEWPORT);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const rows = useMemo(
    () => (query.trim() ? portfolio.rows.filter((row) => matchesAsset(row, query)) : portfolio.rows),
    [portfolio, query]
  );

  const view = useMemo<FinanceViewState>(
    () => ({ query, isDark, maxAllocationPct: portfolio.maxAllocationPct }),
    [query, isDark, portfolio]
  );

  const toggleLive = useCallback(() => portfolio.toggle(), [portfolio]);
  const toggleTheme = useCallback(() => setIsDark((dark) => !dark), []);

  const liveLabel = isLive ? "Pause live market updates" : "Resume live market updates";
  const themeLabel = isDark ? "Switch to light theme" : "Switch to dark theme";

  // The theme class sits on the section rather than on the sample's root, so
  // both palettes stay inside the sample and everything the grid renders,
  // its toolbar drop-downs included, resolves against the live one.
  return (
    <FinanceViewContext.Provider value={view}>
      <section className={`finance-shell${isDark ? " dark-theme" : ""}`} aria-label="Financial portfolio">
        <header className="finance-topbar">
          <div className="finance-title-wrap">
            <div className="sample-logo">
              <IgrIcon className="finance-title-icon" name="account_balance" collection={FINANCE_ICON_COLLECTION} aria-hidden="true" />
            </div>
            <h1>Financial Portfolio</h1>
          </div>

          <div className="finance-topbar-actions">
            {/* The feed's state in words, for anyone who cannot see the pulsing dot. */}
            <span className={`finance-feed-status${isLive ? "" : " is-paused"}`} role="status">
              <span className="finance-feed-dot" aria-hidden="true" />
              {isLive ? "Live" : "Paused"}
            </span>

            <IgrIconButton
              variant="flat"
              type="button"
              title={liveLabel}
              aria-label={liveLabel}
              name={isLive ? "pause" : "play_arrow"}
              collection={FINANCE_ICON_COLLECTION}
              onClick={toggleLive}
            />

            <IgrIconButton
              variant="flat"
              type="button"
              title={themeLabel}
              aria-label={themeLabel}
              name={isDark ? "light_mode" : "dark_mode"}
              collection={FINANCE_ICON_COLLECTION}
              onClick={toggleTheme}
            />
          </div>
        </header>

        <PortfolioGrid gridRef={gridRef} rows={rows} query={query} onQueryChange={setQuery} hideMostColumns={hideMostColumns} />
      </section>
    </FinanceViewContext.Provider>
  );
}

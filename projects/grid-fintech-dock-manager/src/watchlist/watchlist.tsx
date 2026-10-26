import { memo, useCallback, useEffect, useMemo, useRef, useState, type ComponentProps, type CSSProperties, type ReactElement } from "react";
import {
  IgrCombo,
  IgrIcon,
  IgrIconButton,
  IgrInput,
  IgrList,
  IgrListItem,
  IgrTab,
  IgrTabs,
} from "igniteui-react";
import {
  IgrActionStrip,
  IgrColumn,
  IgrGrid,
  IgrGridToolbar,
  IgrGridToolbarActions,
  IgrGridToolbarAdvancedFiltering,
  IgrGridToolbarExporter,
  IgrGridToolbarHiding,
  IgrGridToolbarPinning,
  type IgrCellTemplateContext,
} from "igniteui-react-grids";
import { TRADABLE_SYMBOLS } from "../data/market-seed";
import type { StockItem } from "../models/stock.model";
import { useDesk } from "../services/desk";
import { stripRowKey } from "../util/action-strip";
import { compact, price, rangePosition, signed } from "../util/finance";
import { ICONS } from "../util/icons";
import { useRefreshOnTick } from "../util/live-grid";
import { useStore } from "../util/use-store";

const MOVER_TABS = ["Gainers", "Losers", "Most Active"] as const;
type MoverTab = (typeof MOVER_TABS)[number];

/** How many rows each movers tab shows. */
const MOVERS_LIMIT = 5;

/** The strip's tab count for its stylesheet, which lays the tabs out in equal columns. */
const TAB_COUNT_STYLE = { "--tab-count": MOVER_TABS.length } as CSSProperties;

/** One entry of the add-symbol picker. */
interface SymbolOption {
  symbol: string;
  added: boolean;
}

// The picker's options render inside the combo's shadow root, out of reach of
// the desk's stylesheets, so they carry their styles inline. The colour still
// comes from the palette: custom properties inherit into the shadow root.
const OPTION_STYLE: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  width: "100%",
};

/** Present for context, not for picking. */
const ADDED_OPTION_STYLE: CSSProperties = { ...OPTION_STYLE, opacity: 0.45, cursor: "default" };

const OPTION_TAG_STYLE: CSSProperties = {
  fontSize: 9,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.6px",
  color: "var(--ig-gray-700)",
};

// ── Cell templates ──────────────────────────────────────────────────────────
// Each reads only its template context, so the grid can recycle cells freely.

const directionClass = (value: number): string => (value >= 0 ? "pos" : "neg");

const symbolCell = (ctx: IgrCellTemplateContext) => <span className="symbol-cell">{ctx.cell.value}</span>;
const priceCell = (ctx: IgrCellTemplateContext) => <span>{price(ctx.cell.value)}</span>;
const compactCell = (ctx: IgrCellTemplateContext) => <span>{compact(ctx.cell.value)}</span>;
const changePctCell = (ctx: IgrCellTemplateContext) => (
  <span className={directionClass(ctx.cell.value)}>{signed(ctx.cell.value, "pct")}</span>
);
const changeCell = (ctx: IgrCellTemplateContext) => (
  <span className={directionClass(ctx.cell.value)}>{signed(ctx.cell.value)}</span>
);

type Band = "day" | "week52";

/**
 * A band with the last price marked on it: the day's or the year's. The quote
 * is the row's live object, which the feed writes in place; the grid renders
 * the cell again on every tick.
 */
function RangeCell({ quote, band }: { quote: StockItem; band: Band }) {
  const [low, high] = band === "day" ? [quote.dayLow, quote.dayHigh] : [quote.week52Low, quote.week52High];

  return (
    <div className="range-cell">
      <span className="range-value">{price(low)}</span>
      <div className="range-track" aria-hidden="true">
        <div
          className={`range-marker ${quote.positive ? "pos" : "neg"}`}
          style={{ left: `${rangePosition(quote.lastPrice, low, high)}%` }}
        />
      </div>
      <span className="range-value">{price(high)}</span>
    </div>
  );
}

const dayRangeCell = (ctx: IgrCellTemplateContext) => <RangeCell quote={ctx.cell.row.data as StockItem} band="day" />;
const weekRangeCell = (ctx: IgrCellTemplateContext) => <RangeCell quote={ctx.cell.row.data as StockItem} band="week52" />;

/**
 * The grid's columns, declared once. The grid renders them as they are, and a
 * desk reset reads the hidden and pinned state back from the same declarations,
 * so the two cannot drift apart.
 */
const COLUMNS: ReactElement<ComponentProps<typeof IgrColumn>>[] = [
  <IgrColumn key="symbol" field="symbol" header="Symbol" sortable pinned disableHiding width="90px" bodyTemplate={symbolCell} />,
  <IgrColumn key="lastPrice" field="lastPrice" header="Last" dataType="number" sortable width="100px" bodyTemplate={priceCell} />,
  <IgrColumn key="changePct" field="changePct" header="Change %" dataType="number" sortable width="105px" bodyTemplate={changePctCell} />,
  <IgrColumn key="change" field="change" header="Change" dataType="number" sortable width="95px" bodyTemplate={changeCell} />,
  <IgrColumn key="bid" field="bid" header="Bid" dataType="number" sortable hidden width="95px" bodyTemplate={priceCell} />,
  <IgrColumn key="ask" field="ask" header="Ask" dataType="number" sortable hidden width="95px" bodyTemplate={priceCell} />,
  <IgrColumn key="sector" field="sector" header="Sector" sortable width="120px" />,
  <IgrColumn key="marketTime" field="marketTime" header="Market Time" sortable width="120px" />,
  <IgrColumn key="volume" field="volume" header="Volume" dataType="number" sortable width="105px" bodyTemplate={compactCell} />,
  <IgrColumn key="avgVol3M" field="avgVol3M" header="Avg Vol 3M" dataType="number" sortable hidden width="110px" bodyTemplate={compactCell} />,
  <IgrColumn key="dayHigh" field="dayHigh" header="Day Range" dataType="number" sortable width="230px" bodyTemplate={dayRangeCell} />,
  <IgrColumn key="week52High" field="week52High" header="52-Wk Range" dataType="number" sortable width="230px" bodyTemplate={weekRangeCell} />,
  <IgrColumn key="marketCap" field="marketCap" header="Market Cap" dataType="number" sortable width="110px" bodyTemplate={compactCell} />,
];

/**
 * Puts the columns back as declared.
 *
 * Properties are flipped on the live columns rather than replayed through a
 * saved grid state: restoring state rebuilds the column collection, which would
 * drop the cell templates every column in this grid depends on.
 */
function restoreColumns(grid: IgrGrid): void {
  for (const { props } of COLUMNS) {
    const column = props.field ? grid.getColumnByName(props.field) : undefined;
    if (!column) {
      continue;
    }

    const pinned = props.pinned === true;
    if (column.pinned !== pinned) {
      if (pinned) {
        column.pin();
      } else {
        column.unpin();
      }
    }

    column.hidden = props.hidden === true;
  }

  grid.clearSort();
  grid.clearFilter();
}

function Watchlist() {
  const { market, workspace } = useDesk();
  const gridRef = useRef<IgrGrid>(null);
  const comboRef = useRef<IgrCombo | null>(null);
  const stripRef = useRef<IgrActionStrip>(null);

  /**
   * Keeps the picker's element and makes it a single-select combo — once, here,
   * rather than through the `singleSelect` prop. igc-combo clears the text typed
   * into it whenever `singleSelect` is assigned, and the React wrapper assigns
   * every prop again each time it re-renders, which it does whenever the combo
   * renders an item template (that is, on every keystroke). As a prop, the
   * filter would reset itself after each key.
   */
  const attachCombo = useCallback((combo: IgrCombo | null) => {
    comboRef.current = combo;
    if (combo) {
      combo.singleSelect = true;
    }
  }, []);

  const watchlist = useStore(workspace, (state) => state.watchlist);
  const searchQuery = useStore(workspace, (state) => state.searchQuery);
  const selectedSymbol = useStore(workspace, (state) => state.selectedSymbol);

  // The watchlist joined against the live feed, in the trader's own order, and
  // narrowed by the pane's filter. Deliberately independent of the price tick:
  // these are the live quote objects, so a new price shows up through
  // `markForCheck()` rather than a new array — which would make the grid
  // re-measure and its scrollbar flicker once a second.
  const rows = useMemo(() => {
    const quotes = watchlist
      .map((symbol) => market.quoteOf(symbol))
      .filter((quote): quote is StockItem => quote !== undefined);

    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return quotes;
    }
    return quotes.filter((quote) => `${quote.symbol} ${quote.name} ${quote.sector}`.toLowerCase().includes(query));
  }, [market, watchlist, searchQuery]);

  /**
   * The whole universe, each entry flagged with whether it is already watched.
   *
   * Watched symbols stay in the list rather than being filtered out: the
   * drop-down then reads the same every time, and "already added" is stated
   * rather than left to be inferred from an absence.
   */
  const symbolOptions = useMemo<SymbolOption[]>(() => {
    const watched = new Set(watchlist);
    return TRADABLE_SYMBOLS.map((symbol) => ({ symbol, added: watched.has(symbol) }));
  }, [watchlist]);

  /** Bound to the grid so the shared symbol and the highlighted row cannot drift. */
  const selectedRows = useMemo(() => [selectedSymbol], [selectedSymbol]);

  useRefreshOnTick(gridRef, market, "tick");

  // Hiding, pinning, sorting and filtering live on the grid's own columns, out
  // of reach of the workspace, so a reset has to restore them here.
  useEffect(
    () =>
      workspace.watch(
        (state) => state.resetToken,
        () => {
          if (gridRef.current) {
            restoreColumns(gridRef.current);
          }
        },
      ),
    [workspace],
  );

  const focusSymbol = (symbol: string | undefined) => {
    if (symbol) {
      workspace.focusSymbol(symbol);
    }
  };

  /**
   * Enter opens a chart for the first row the filter leaves — the rows the
   * trader can actually see, rather than a match against the whole universe.
   */
  const submitSearch = () => focusSymbol(rows[0]?.symbol);

  /**
   * The combo is a picker rather than a value holder: it fires the add and keeps
   * no selection. A retained selection would seed the next open's filter with
   * the symbol just picked, narrowing the drop-down to that one entry.
   */
  const addSymbol = (event: CustomEvent<{ newValue: unknown[]; type: string }>) => {
    event.preventDefault();

    const [symbol] = event.detail.newValue;
    if (event.detail.type !== "selection" || typeof symbol !== "string" || !symbol || workspace.isWatched(symbol)) {
      return;
    }

    workspace.addToWatchlist(symbol);
    workspace.selectSymbol(symbol);
    void comboRef.current?.hide();
  };

  const removeFromWatchlist = () => {
    const symbol = stripRowKey(stripRef.current);
    if (typeof symbol === "string") {
      workspace.removeFromWatchlist(symbol);
    }
  };

  return (
    <div className="desk-pane watchlist-pane">
      <div className="wl-toolbar">
        {/* Scoped to this pane: the query filters the grid below and the movers
            tabs, and nothing outside the watchlist reads it. */}
        <IgrInput
          className="wl-search"
          type="search"
          placeholder="Filter — Enter opens a chart"
          aria-label="Filter the watchlist. Press Enter to open a chart for the first match."
          value={searchQuery}
          onInput={(event) => workspace.updateSearchQuery(event.detail)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              submitSearch();
            }
          }}
        >
          <IgrIcon slot="prefix" name="filter_alt" collection={ICONS} aria-hidden="true" />
        </IgrInput>

        <IgrCombo
          ref={attachCombo}
          className="wl-add"
          data={symbolOptions}
          valueKey="symbol"
          displayKey="symbol"
          placeholder="Add symbol"
          placeholderSearch="Search the universe…"
          itemTemplate={({ item }: { item: SymbolOption }) => (
            // Symbols already on the list stay visible so the universe reads the
            // same every time; they are just marked and inert.
            <div
              className={`wl-option${item.added ? " wl-option-added" : ""}`}
              style={item.added ? ADDED_OPTION_STYLE : OPTION_STYLE}
              aria-disabled={item.added}
            >
              <span>{item.symbol}</span>
              {item.added && (
                <span className="wl-option-tag" style={OPTION_TAG_STYLE}>
                  Added
                </span>
              )}
            </div>
          )}
          onChange={addSymbol}
        >
          <IgrIcon slot="prefix" name="add" collection={ICONS} aria-hidden="true" />
        </IgrCombo>
      </div>

      <div className="watchlist-grid-wrap">
        <IgrGrid
          ref={gridRef}
          className="watchlist-grid desk-grid"
          data={rows}
          primaryKey="symbol"
          autoGenerate={false}
          allowFiltering
          filterMode="excelStyleFilter"
          allowAdvancedFiltering
          moving
          rowSelection="single"
          hideRowSelectors
          selectedRows={selectedRows}
          rowHeight={38}
          width="100%"
          height="100%"
          onRowClick={(event) => focusSymbol(event.detail.row.key as string)}
        >
          <IgrGridToolbar>
            <IgrGridToolbarActions>
              <IgrGridToolbarAdvancedFiltering />
              <IgrGridToolbarPinning />
              <IgrGridToolbarHiding />
              <IgrGridToolbarExporter exportCSV exportExcel filename="watchlist" />
            </IgrGridToolbarActions>
          </IgrGridToolbar>

          {COLUMNS}

          {/* Removing the symbol is the only thing left that a row click cannot
              do for you: the click already opens the chart and narrows the wire. */}
          <IgrActionStrip ref={stripRef}>
            <IgrIconButton
              variant="flat"
              name="playlist_remove"
              collection={ICONS}
              title="Remove from watchlist"
              aria-label="Remove from watchlist"
              onClick={removeFromWatchlist}
            />
          </IgrActionStrip>
        </IgrGrid>
      </div>

      <Movers rows={rows} onFocusSymbol={focusSymbol} />
    </div>
  );
}

export default memo(Watchlist);

interface MoversProps {
  /** The filtered watchlist: live quote objects, ranked again on every tick. */
  rows: readonly StockItem[];
  onFocusSymbol: (symbol: string) => void;
}

/** The top five of the filtered watchlist, for the active movers tab. */
function moversOf(rows: readonly StockItem[], tab: MoverTab): StockItem[] {
  switch (tab) {
    case "Gainers":
      return rows
        .filter((row) => row.changePct > 0)
        .sort((a, b) => b.changePct - a.changePct)
        .slice(0, MOVERS_LIMIT);
    case "Losers":
      return rows
        .filter((row) => row.changePct < 0)
        .sort((a, b) => a.changePct - b.changePct)
        .slice(0, MOVERS_LIMIT);
    default:
      return [...rows].sort((a, b) => b.volume - a.volume).slice(0, MOVERS_LIMIT);
  }
}

/**
 * The movers strip. Unlike the grid, its ordering depends on prices, so it
 * re-ranks on every tick — the top five shuffle as the tape moves.
 */
function Movers({ rows, onFocusSymbol }: MoversProps) {
  const { market } = useDesk();
  const [activeTab, setActiveTab] = useState<MoverTab>("Gainers");
  // Re-ranks on every tick: the rows are the live quotes.
  useStore(market, (state) => state.tick);
  const movers = moversOf(rows, activeTab);

  return (
    <section className="movers-panel" aria-label="Market movers">
      <IgrTabs
        className="movers-tabs"
        alignment="justify"
        style={TAB_COUNT_STYLE}
        onChange={(event) => {
          const label = MOVER_TABS.find((tab) => tab === event.detail.label);
          if (label) {
            setActiveTab(label);
          }
        }}
      >
        {MOVER_TABS.map((tab) => (
          <IgrTab key={tab} label={tab} selected={tab === activeTab}>
            {tab === activeTab && (
              <IgrList className="movers-list">
                {movers.map((mover) => (
                  <IgrListItem key={mover.symbol} className="mover-item" onClick={() => onFocusSymbol(mover.symbol)}>
                    <div className="mover-row">
                      <span className="mover-symbol">{mover.symbol}</span>
                      <span className="mover-last">{price(mover.lastPrice)}</span>
                      <span className={`mover-change ${mover.changePct >= 0 ? "pos" : "neg"}`}>
                        {signed(mover.changePct, "pct")}
                      </span>
                    </div>
                  </IgrListItem>
                ))}
                {movers.length === 0 && <p className="movers-empty">No symbols match the current search.</p>}
              </IgrList>
            )}
          </IgrTab>
        ))}
      </IgrTabs>
    </section>
  );
}

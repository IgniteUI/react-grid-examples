import type { IgrDockManagerLayout } from "igniteui-react-dockmanager";
import { DEFAULT_CHART_SYMBOLS, DEFAULT_WATCHLIST } from "../data/market-seed";
import type { OrderSide } from "../models/stock.model";
import {
  DOCK_PANES,
  type DockPaneId,
  buildDefaultLayout,
  chartSymbolsOf,
  isPaneVisible,
  parsePersistedLayout,
  withChartDocument,
  withPaneVisibility,
} from "../util/dock-layout";
import { Store } from "../util/store";

export type ThemeMode = "dark" | "light";

/** A pane the nav rail can show or hide. */
export interface PaneToggle {
  id: DockPaneId;
  label: string;
  icon: string;
}

const STORAGE_PREFIX = "grid-fintech-dock-manager";
const LAYOUT_KEY = `${STORAGE_PREFIX}.layout`;
const THEME_KEY = `${STORAGE_PREFIX}.theme`;
const WATCHLIST_KEY = `${STORAGE_PREFIX}.watchlist`;

/** The viewport the default arrangement is sized for until the real one is known. */
export const FALLBACK_VIEWPORT = { width: 1440, height: 900 };
const KNOWN_PANE_IDS = Object.values(DOCK_PANES);

/** The panes the rail switches, in rail order. */
export const PANE_TOGGLES: readonly PaneToggle[] = [
  { id: DOCK_PANES.watchlist, label: "Watchlist", icon: "visibility" },
  { id: DOCK_PANES.orderTicket, label: "Order Ticket", icon: "add_shopping_cart" },
  { id: DOCK_PANES.positions, label: "Positions", icon: "account_balance_wallet" },
  { id: DOCK_PANES.blotter, label: "Blotter", icon: "assignment" },
  { id: DOCK_PANES.news, label: "News", icon: "newspaper" },
];

export interface WorkspaceState {
  theme: ThemeMode;
  /** The instrument the order ticket, chart focus and news filter follow. */
  selectedSymbol: string;
  /** Side the order ticket opens on — set by the Buy/Sell shortcuts in other panes. */
  ticketSide: OrderSide;
  searchQuery: string;
  /** Symbol the news wire is narrowed to; empty means the whole wire. */
  newsFilter: string;
  watchlist: readonly string[];
  /**
   * The layout pushed *into* the Dock Manager. It changes only on programmatic
   * edits (open a chart, toggle a pane, reset) — never in response to a drag,
   * because re-assigning it mid-gesture would re-render the whole dock.
   */
  layout: IgrDockManagerLayout;
  /** Chart documents currently open, read back out of the live layout. */
  chartSymbols: readonly string[];
  /** Pane visibility, read from the live layout so the rail cannot drift. */
  visiblePanes: ReadonlySet<DockPaneId>;
  /**
   * Bumped by {@link WorkspaceService.reset}. Panes holding state this service
   * cannot reach — a grid's own column layout, sorting and filters — watch this
   * to put themselves back.
   */
  resetToken: number;
}

/**
 * Session state for the desk: the Dock Manager layout, the selected instrument
 * that every pane follows, the watchlist and the theme. Layout, watchlist and
 * theme survive a reload, so a trader's arrangement is still there tomorrow.
 */
export class WorkspaceService extends Store<WorkspaceState> {
  readonly paneToggles = PANE_TOGGLES;

  /**
   * The arrangement actually on screen. The Dock Manager edits its layout in
   * place, so this is a plain field rather than state; `chartSymbols` and
   * `visiblePanes` are read out of it whenever it changes.
   */
  private live: IgrDockManagerLayout;

  /** The default arrangement is sized once, against the real viewport. */
  private sized: boolean;

  constructor() {
    const restored = parseStoredLayout();
    const layout =
      restored ?? buildDefaultLayout(FALLBACK_VIEWPORT.width, FALLBACK_VIEWPORT.height, DEFAULT_CHART_SYMBOLS);

    super({
      theme: readStored(THEME_KEY, isThemeMode) ?? "dark",
      selectedSymbol: DEFAULT_CHART_SYMBOLS[0],
      ticketSide: "BUY",
      searchQuery: "",
      newsFilter: "",
      watchlist: readStored(WATCHLIST_KEY, isStringArray) ?? [...DEFAULT_WATCHLIST],
      layout,
      chartSymbols: chartSymbolsOf(layout),
      visiblePanes: visiblePanesOf(layout),
      resetToken: 0,
    });
    this.live = layout;
    this.sized = restored !== null;

    // The stored copies follow the state on their own, starting with what the
    // desk opened on.
    const { theme, watchlist } = this.getSnapshot();
    writeStored(THEME_KEY, theme);
    writeStored(WATCHLIST_KEY, watchlist);
    this.watch((state) => state.theme, (value) => writeStored(THEME_KEY, value));
    this.watch((state) => state.watchlist, (value) => writeStored(WATCHLIST_KEY, value));
  }

  toggleTheme(): void {
    this.setState({ theme: this.getSnapshot().theme === "dark" ? "light" : "dark" });
  }

  updateSearchQuery(value: string): void {
    this.setState({ searchQuery: value });
  }

  selectSymbol(symbol: string): void {
    this.setState({ selectedSymbol: symbol });
  }

  setTicketSide(side: OrderSide): void {
    this.setState({ ticketSide: side });
  }

  setNewsFilter(symbol: string): void {
    this.setState({ newsFilter: symbol });
  }

  /**
   * Points the whole desk at one instrument: it becomes the selection every
   * pane follows, its chart comes up, and the wire narrows to it.
   *
   * This is what clicking a watchlist row does — one gesture, and the panes
   * that can say something about that symbol all do.
   */
  focusSymbol(symbol: string): void {
    this.setNewsFilter(symbol);
    this.openChart(symbol);
  }

  /** Points the order ticket at an instrument and side in one gesture. */
  prepareOrder(symbol: string, side: OrderSide): void {
    this.setState({ selectedSymbol: symbol, ticketSide: side });
  }

  /** Selects the symbol and brings its chart document up, opening it if needed. */
  openChart(symbol: string): void {
    this.selectSymbol(symbol);
    this.pushLayout(withChartDocument(this.live, symbol));
  }

  togglePane(id: DockPaneId): void {
    this.setPaneVisible(id, !this.getSnapshot().visiblePanes.has(id));
  }

  /**
   * Idempotent counterpart to {@link togglePane}, for controls that report a
   * state rather than an intent: re-applying the state the layout is already
   * in must not churn it.
   */
  setPaneVisible(id: DockPaneId, visible: boolean): void {
    if (this.getSnapshot().visiblePanes.has(id) === visible) {
      return;
    }

    this.pushLayout(withPaneVisibility(this.live, id, visible));
  }

  /**
   * Adopts the arrangement the Dock Manager reports after a drag, dock or close.
   * The layout input is deliberately left untouched — only the derived state and
   * the saved copy move.
   */
  applyLayout(layout: IgrDockManagerLayout): void {
    this.live = layout;
    this.setState(this.readLiveLayout());
    writeStored(LAYOUT_KEY, layout);
  }

  /**
   * Sizes the shipped default against the real viewport, once. Later resizes are
   * the Dock Manager's own business — rebuilding here would throw away whatever
   * arrangement the trader has since dragged into place.
   */
  initialiseViewport(width: number, height: number): void {
    if (this.sized) {
      return;
    }

    this.sized = true;
    this.pushLayout(buildDefaultLayout(width, height, this.getSnapshot().chartSymbols));
  }

  /**
   * Returns the whole workspace to its opening state — the arrangement plus the
   * watchlist, theme, selected instrument, ticket side and search box.
   *
   * The stored theme and watchlist follow on their own, and
   * {@link resetLayout} rewrites the saved layout.
   */
  reset(width: number, height: number): void {
    this.setState({
      theme: "dark",
      watchlist: [...DEFAULT_WATCHLIST],
      selectedSymbol: DEFAULT_CHART_SYMBOLS[0],
      ticketSide: "BUY",
      searchQuery: "",
      newsFilter: "",
    });
    this.resetLayout(width, height);
    this.setState({ resetToken: this.getSnapshot().resetToken + 1 });
  }

  /** Drops the saved arrangement and rebuilds the shipped default. */
  resetLayout(width: number, height: number): void {
    clearStored(LAYOUT_KEY);
    this.sized = true;
    this.pushLayout(buildDefaultLayout(width, height, DEFAULT_CHART_SYMBOLS));
  }

  isWatched(symbol: string): boolean {
    return this.getSnapshot().watchlist.includes(symbol);
  }

  addToWatchlist(symbol: string): void {
    const { watchlist } = this.getSnapshot();
    if (!watchlist.includes(symbol)) {
      this.setState({ watchlist: [symbol, ...watchlist] });
    }
  }

  removeFromWatchlist(symbol: string): void {
    const { watchlist } = this.getSnapshot();
    this.setState({ watchlist: watchlist.filter((entry) => entry !== symbol) });
  }

  /** Pushes a new arrangement into the Dock Manager and saves it. */
  private pushLayout(next: IgrDockManagerLayout): void {
    this.live = next;
    this.setState({ layout: next, ...this.readLiveLayout() });
    writeStored(LAYOUT_KEY, next);
  }

  /**
   * The open charts and visible panes of the live layout. A drag that moves
   * neither keeps the current values, so the panes that render them do not
   * re-render for it.
   */
  private readLiveLayout(): Pick<WorkspaceState, "chartSymbols" | "visiblePanes"> {
    const current = this.getSnapshot();
    const chartSymbols = chartSymbolsOf(this.live);
    const visiblePanes = visiblePanesOf(this.live);
    return {
      chartSymbols: sameMembers(current.chartSymbols, chartSymbols) ? current.chartSymbols : chartSymbols,
      visiblePanes: sameMembers([...current.visiblePanes], [...visiblePanes]) ? current.visiblePanes : visiblePanes,
    };
  }
}

function visiblePanesOf(layout: IgrDockManagerLayout): ReadonlySet<DockPaneId> {
  return new Set(PANE_TOGGLES.filter((pane) => isPaneVisible(layout, pane.id)).map((pane) => pane.id));
}

/** Whether two lists hold the same entries, in any order. */
function sameMembers<T>(a: readonly T[], b: readonly T[]): boolean {
  return a.length === b.length && a.every((entry) => b.includes(entry));
}

// ── Persistence ─────────────────────────────────────────────────────────────
// Storage is best effort: a private-mode browser must not break the desk, so
// every access is guarded and falls back to the defaults.

function storage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

function readStored<T>(key: string, guard: (value: unknown) => value is T): T | null {
  let raw: string | null | undefined;
  try {
    raw = storage()?.getItem(key);
  } catch {
    return null;
  }
  if (!raw) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    return guard(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeStored(key: string, value: unknown): void {
  try {
    storage()?.setItem(key, JSON.stringify(value));
  } catch {
    // Quota or private mode — the desk keeps working in memory.
  }
}

function clearStored(key: string): void {
  try {
    storage()?.removeItem(key);
  } catch {
    // Nothing to do.
  }
}

function parseStoredLayout(): IgrDockManagerLayout | null {
  let raw: string | null | undefined;
  try {
    raw = storage()?.getItem(LAYOUT_KEY);
  } catch {
    return null;
  }
  return raw ? parsePersistedLayout(raw, KNOWN_PANE_IDS) : null;
}

const isThemeMode = (value: unknown): value is ThemeMode => value === "dark" || value === "light";
const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === "string");

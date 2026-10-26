import * as signalR from "@microsoft/signalr";
import { SEED_INDICES, SEED_STOCKS } from "../data/market-seed";
import type { MarketIndex, StockItem } from "../models/stock.model";
import { formatClock, percentChange, round2 } from "../util/finance";
import { Store } from "../util/store";

/**
 * `live` — the Infragistics stream hub is connected and driving the clock.
 * `simulated` — the hub is unreachable, so the local simulator drives ticks.
 */
export type FeedStatus = "connecting" | "live" | "simulated" | "paused";

const HUB_URL = "https://www.infragistics.com/angular-apis/webapi/streamHub";
const DEFAULT_FREQUENCY = 1000;

/** Feed speeds offered in the command bar, in milliseconds per tick. */
export const FEED_SPEEDS: readonly { label: string; value: number }[] = [
  { label: "0.5×", value: 2000 },
  { label: "1×", value: DEFAULT_FREQUENCY },
  { label: "2×", value: 500 },
  { label: "5×", value: 200 },
];

/** Percentage move applied to a stock on a single tick, at most. */
const STOCK_VOLATILITY = 0.4;
const INDEX_VOLATILITY = 0.06;
/** Share of the universe that re-prices on any given tick. */
const TICK_COVERAGE = 0.35;
const SPREAD_BPS = 2;

/** Opening quote per symbol, used to put the tape back after a reset. */
const SEED_QUOTES: ReadonlyMap<string, StockItem> = new Map(SEED_STOCKS.map((stock) => [stock.symbol, stock]));

/** What the feed publishes besides the live quote objects. */
export interface MarketState {
  /**
   * Incremented after every re-pricing pass. The quotes are written in place,
   * so this — not the array — is what views of them watch.
   */
  tick: number;
  /** Indices feed the command bar, not a grid, so they are replaced rather than edited. */
  indices: readonly MarketIndex[];
  status: FeedStatus;
  /** Milliseconds per tick. */
  frequency: number;
}

/**
 * The market feed: one source of truth for prices.
 *
 * ## Why the quote objects are mutable
 *
 * The obvious design — a new `StockItem[]` on every tick — is wrong for a grid.
 * A new `data` array makes `IgrGrid` rebuild its row cache and re-measure the
 * virtualised viewport once a second, and the scrollbar visibly flickers as it
 * does. So the universe is a **stable array of mutable quotes**: prices are
 * written in place and `tick` is bumped, and each live grid responds by
 * calling `markForCheck()` (see `util/live-grid.ts`).
 *
 * Views outside a grid re-render on `tick` and read the quote they show then.
 */
export class MarketDataService extends Store<MarketState> {
  /**
   * The tradable universe. The array and its objects are reused for the whole
   * session — never reassign either; write fields and bump `tick`.
   */
  readonly stocks: readonly StockItem[] = SEED_STOCKS.map((stock) => ({ ...stock }));

  /** Symbol → quote. Built once; the universe is fixed. */
  readonly quotes: ReadonlyMap<string, StockItem> = new Map(this.stocks.map((stock) => [stock.symbol, stock]));

  private connection: signalR.HubConnection | undefined;
  private connectTimer: ReturnType<typeof setTimeout> | undefined;
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor() {
    super({ tick: 0, indices: seedIndices(), status: "connecting", frequency: DEFAULT_FREQUENCY });
  }

  get isPaused(): boolean {
    return this.getSnapshot().status === "paused";
  }

  /** The live quote object. Read it when rendering; never keep it as a rendered value. */
  quoteOf(symbol: string): StockItem | undefined {
    return this.quotes.get(symbol);
  }

  /** Opens the hub connection (best effort) and starts the tick loop. */
  start(): void {
    if (this.timer !== undefined) {
      return;
    }

    // The hub is dialled on the next task rather than now. A mount that React
    // undoes straight away (Strict Mode's extra effect pass in development)
    // then never starts a negotiation it would have to abort, which SignalR
    // reports as an error of its own.
    this.connectTimer = setTimeout(() => {
      this.connectTimer = undefined;
      this.connect();
    });
    this.restartTimer();
  }

  stop(): void {
    this.clearTimer();
    if (this.connectTimer !== undefined) {
      clearTimeout(this.connectTimer);
      this.connectTimer = undefined;
    }
    this.connection?.stop().catch(() => undefined);
    this.connection = undefined;
  }

  /** Freezes the tape without dropping the connection. */
  pause(): void {
    this.clearTimer();
    this.setState({ status: "paused" });
  }

  resume(): void {
    this.setState({ status: this.connection?.state === signalR.HubConnectionState.Connected ? "live" : "simulated" });
    this.restartTimer();
  }

  togglePlayback(): void {
    if (this.isPaused) {
      this.resume();
    } else {
      this.pause();
    }
  }

  /**
   * Puts the tape back to its opening state: seed prices, seed indices, default
   * speed, running.
   *
   * Quotes are rewritten **in place**. The stable-array contract the grids rely
   * on (see the class comment) holds through a reset too — replacing the array
   * here would make every live grid re-measure.
   */
  reset(): void {
    for (const stock of this.stocks) {
      const seed = SEED_QUOTES.get(stock.symbol);
      if (seed) {
        Object.assign(stock, seed);
      }
    }

    this.setState({ indices: seedIndices(), frequency: DEFAULT_FREQUENCY, tick: this.getSnapshot().tick + 1 });

    // A paused tape is not the opening state, so a reset always leaves it running.
    if (this.isPaused) {
      this.resume();
    } else {
      this.restartTimer();
    }
  }

  setFrequency(milliseconds: number): void {
    this.setState({ frequency: milliseconds });
    if (!this.isPaused) {
      this.restartTimer();
    }
  }

  // ── Connection ────────────────────────────────────────────────────────────

  private connect(): void {
    const connection = new signalR.HubConnectionBuilder()
      .configureLogging(signalR.LogLevel.Warning)
      .withUrl(HUB_URL)
      .build();
    this.connection = connection;

    connection.onclose(() => this.settleStatus("simulated"));

    connection
      .start()
      .then(() => {
        this.settleStatus("live");
        // Keeps the hub alive; its payload shape differs from this sample's
        // instruments, so the local simulator remains the price source.
        return connection.invoke("updateparameters", this.getSnapshot().frequency, 20, true, false);
      })
      .catch(() => this.settleStatus("simulated"));
  }

  /**
   * Reports what the connection settled on. A paused tape keeps saying
   * "paused" until it is resumed, which then reads the connection's state.
   */
  private settleStatus(status: FeedStatus): void {
    if (!this.isPaused) {
      this.setState({ status });
    }
  }

  private restartTimer(): void {
    this.clearTimer();
    this.timer = setInterval(() => this.advance(), this.getSnapshot().frequency);
  }

  private clearTimer(): void {
    if (this.timer !== undefined) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  // ── Simulation ────────────────────────────────────────────────────────────

  /**
   * Advances the tape one step: re-prices part of the universe in place and
   * bumps `tick`. The interval drives this.
   */
  advance(): void {
    const marketTime = formatClock(new Date());

    for (const stock of this.stocks) {
      if (Math.random() < TICK_COVERAGE) {
        repriceStock(stock, marketTime);
      }
    }

    const { indices, tick } = this.getSnapshot();
    this.setState({ indices: indices.map(repriceIndex), tick: tick + 1 });
  }
}

function seedIndices(): MarketIndex[] {
  return SEED_INDICES.map((index) => ({ ...index }));
}

/** Writes a new price onto the quote in place. */
function repriceStock(stock: StockItem, marketTime: string): void {
  const lastPrice = drift(stock.lastPrice, STOCK_VOLATILITY);
  const spread = Math.max(0.01, round2((lastPrice * SPREAD_BPS) / 10_000));
  const changePct = round2(percentChange(lastPrice, stock.previousClose));

  stock.lastPrice = lastPrice;
  stock.bid = round2(lastPrice - spread);
  stock.ask = round2(lastPrice + spread);
  stock.change = round2(lastPrice - stock.previousClose);
  stock.changePct = changePct;
  stock.positive = changePct >= 0;
  stock.dayHigh = Math.max(stock.dayHigh, lastPrice);
  stock.dayLow = Math.min(stock.dayLow, lastPrice);
  stock.volume += Math.round(stock.avgVol3M / 5_000);
  stock.marketTime = marketTime;
}

function repriceIndex(index: MarketIndex): MarketIndex {
  const value = drift(index.value, INDEX_VOLATILITY);
  const changePct = round2(percentChange(value, index.previousClose));

  return { ...index, value, changePct, positive: changePct >= 0 };
}

/** Random walk: a symmetric move of up to `volatility` percent. */
function drift(price: number, volatility: number): number {
  const changePct = (Math.random() * 2 - 1) * volatility;
  return round2(price * (1 + changePct / 100));
}

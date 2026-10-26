import { createFinanceRows, largestAllocationPct, type FinanceRow, type PriceTrendPoint } from "./finance-data";

/** Direction of a row's most recent re-pricing, or `null` while it is idle. */
export type TickDirection = "up" | "down" | null;

/** A holding that the simulator re-prices in place. */
export interface LivePortfolioRow extends FinanceRow {
  direction: TickDirection;
}

/** Milliseconds between re-pricing passes. */
const TICK_MS = 1200;

/** Share of the portfolio that re-prices on any given tick. */
const TICK_COVERAGE = 0.35;

/** Largest single-tick move, as a percentage of the last price. */
const VOLATILITY = 0.45;

/** How hard a price is pulled back toward its previous close each tick. */
const MEAN_REVERSION = 0.04;

/** Points kept in a row's sparkline: the length the seed data starts with. */
const TREND_POINTS = 30;

const round2 = (value: number): number => Math.round(value * 100) / 100;

type Listener = () => void;

/**
 * The portfolio's simulated market feed.
 *
 * The rows are a stable array of mutable holdings: every tick writes their
 * fields in place and notifies the tick listeners, and the grid answers with
 * `markForCheck()`. Handing the grid a new `data` array on every tick would make
 * it rebuild its row cache and re-measure the virtualized body each time.
 *
 * `priceTrend` is the exception: the sparkline redraws only when its data
 * source reference changes, so each re-priced row gets a freshly built series.
 */
export class LivePortfolio {
  /** The holdings. The array and its objects are reused for the whole session. */
  readonly rows: LivePortfolioRow[] = createFinanceRows().map((row) => ({ ...row, direction: null }));

  /** The largest allocation, which fills an allocation bar's whole track. */
  readonly maxAllocationPct = largestAllocationPct(this.rows);

  /**
   * Each row's reference price: the close the day's change is measured against.
   * Derived once from the seed so `changePct` keeps its opening value, and fixed
   * thereafter so the figure cannot drift away from what it means.
   */
  private readonly previousClose: ReadonlyMap<string, number> = new Map(
    this.rows.map((row) => [row.ticker, row.lastPrice / (1 + row.changePct / 100)])
  );

  private readonly tickListeners = new Set<Listener>();
  private readonly liveListeners = new Set<Listener>();
  private timer: ReturnType<typeof setInterval> | undefined;
  private live = false;

  start(): void {
    if (this.timer !== undefined) {
      return;
    }

    this.timer = setInterval(() => this.repriceBatch(), TICK_MS);
    this.setLive(true);
  }

  stop(): void {
    if (this.timer !== undefined) {
      clearInterval(this.timer);
      this.timer = undefined;
    }

    this.setLive(false);
  }

  toggle(): void {
    if (this.live) {
      this.stop();
    } else {
      this.start();
    }
  }

  /** Calls `listener` after every re-pricing pass; returns the unsubscribe function. */
  onTick(listener: Listener): () => void {
    this.tickListeners.add(listener);
    return () => this.tickListeners.delete(listener);
  }

  /** Calls `listener` when the feed starts or stops; shaped for `useSyncExternalStore`. */
  readonly subscribeLive = (listener: Listener): (() => void) => {
    this.liveListeners.add(listener);
    return () => this.liveListeners.delete(listener);
  };

  /** Whether the feed is running; the snapshot that goes with `subscribeLive`. */
  readonly getIsLive = (): boolean => this.live;

  private setLive(live: boolean): void {
    if (this.live === live) {
      return;
    }

    this.live = live;
    this.liveListeners.forEach((listener) => listener());
  }

  /**
   * Re-prices a random slice of the portfolio.
   *
   * Rows left out of the batch have their flash cleared, so a highlight lasts
   * exactly as long as the tick that caused it.
   */
  private repriceBatch(): void {
    const batchSize = Math.max(1, Math.round(this.rows.length * TICK_COVERAGE));
    const moved = new Set<number>();

    while (moved.size < batchSize) {
      moved.add(Math.floor(Math.random() * this.rows.length));
    }

    this.rows.forEach((row, index) => {
      if (moved.has(index)) {
        this.reprice(row);
      } else {
        row.direction = null;
      }
    });

    this.tickListeners.forEach((listener) => listener());
  }

  /** Marks one holding to a new market price and recomputes everything off it. */
  private reprice(row: LivePortfolioRow): void {
    const reference = this.previousClose.get(row.ticker) ?? row.lastPrice;

    // A random walk with a light pull back toward the reference price, so a
    // long session wanders without ever running away from its opening change.
    const drift = (Math.random() - 0.5) * 2 * VOLATILITY;
    const pull = ((reference - row.lastPrice) / row.lastPrice) * 100 * MEAN_REVERSION;
    const nextPrice = round2(Math.max(0.01, row.lastPrice * (1 + (drift + pull) / 100)));

    if (nextPrice === row.lastPrice) {
      row.direction = null;
      return;
    }

    row.direction = nextPrice > row.lastPrice ? "up" : "down";
    row.lastPrice = nextPrice;

    // The same identities the seed data satisfies, so a live row stays
    // arithmetically consistent with the ones that have not moved yet.
    row.changePct = round2((nextPrice / reference - 1) * 100);
    row.marketValue = round2(nextPrice * row.position);

    const costBasis = row.averageCost * row.position;
    row.netProfit = round2((nextPrice - row.averageCost) * row.position);
    row.netProfitPct = costBasis === 0 ? 0 : round2((row.netProfit / costBasis) * 100);

    row.priceTrend = appendTrendPoint(row.priceTrend, row.changePct);
  }
}

/** The trend series advanced by one point, as a new array so the sparkline redraws. */
function appendTrendPoint(series: readonly PriceTrendPoint[], value: number): PriceTrendPoint[] {
  const next = [...series, { value }];
  return next.length > TREND_POINTS ? next.slice(next.length - TREND_POINTS) : next;
}

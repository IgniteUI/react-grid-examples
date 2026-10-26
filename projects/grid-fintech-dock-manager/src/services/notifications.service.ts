import { NEWS_WIRE_POOL, SEED_NEWS } from "../data/market-seed";
import type { DeskNotification, NewsArticle, NotificationTone } from "../models/stock.model";
import { formatSignedPct } from "../util/finance";
import { Store } from "../util/store";
import type { MarketDataService } from "./market-data.service";

/** Intraday move that raises an "unusual move" alert, in percent. */
const UNUSUAL_MOVE_PCT = 2.5;
/** VIX level above which the desk gets a risk warning. */
const VIX_RISK_LEVEL = 20;
/** Minimum gap between two alerts about the same subject. */
const ALERT_COOLDOWN_MS = 45_000;
const NEWS_INTERVAL_MS = 18_000;
const CLOCK_INTERVAL_MS = 15_000;
const MAX_NOTIFICATIONS = 40;
const MAX_NEWS = 40;

export interface NotificationsState {
  /** Newest first, at most {@link MAX_NOTIFICATIONS}. */
  notifications: readonly DeskNotification[];
  /** Newest first, at most {@link MAX_NEWS}. */
  news: readonly NewsArticle[];
  /**
   * Coarse clock driving relative timestamps, so a "2m" label ages without
   * every list re-rendering each second.
   */
  now: number;
}

/** How many alerts the bell counts as unread. */
export const unreadCountOf = (notifications: readonly DeskNotification[]): number =>
  notifications.reduce((count, item) => count + (item.read ? 0 : 1), 0);

/**
 * The desk's alert and news feed. Fills are pushed in by the trading engine;
 * price alerts are derived here by watching the market feed.
 */
export class NotificationsService extends Store<NotificationsState> {
  private readonly lastAlertAt = new Map<string, number>();
  private readonly timers: ReturnType<typeof setInterval>[] = [];
  private sequence = 0;
  private newsCursor = 0;

  constructor(market: MarketDataService) {
    super({ notifications: [], news: seedNews(), now: Date.now() });

    // One scan of the opening tape, so the session starts with the moves it
    // already carries, then one per price tick.
    const scan = () => this.scanForAlerts(market.stocks, market.getSnapshot().indices);
    scan();
    market.watch((state) => state.tick, scan);
  }

  start(): void {
    if (this.timers.length > 0) {
      return;
    }

    this.timers.push(
      setInterval(() => this.publishWireItem(), NEWS_INTERVAL_MS),
      setInterval(() => this.setState({ now: Date.now() }), CLOCK_INTERVAL_MS),
    );
  }

  stop(): void {
    this.timers.splice(0).forEach(clearInterval);
  }

  push(notification: Omit<DeskNotification, "id" | "at" | "read">): void {
    const entry: DeskNotification = {
      ...notification,
      id: `n${++this.sequence}`,
      at: new Date(),
      read: false,
    };

    const { notifications } = this.getSnapshot();
    this.setState({ notifications: [entry, ...notifications].slice(0, MAX_NOTIFICATIONS), now: Date.now() });
  }

  markAllRead(): void {
    const { notifications } = this.getSnapshot();
    this.setState({ notifications: notifications.map((item) => (item.read ? item : { ...item, read: true })) });
  }

  /** Drops every alert and puts the wire back to the seeded stories. */
  reset(): void {
    // Cooldowns are per-session state too, or the first post-reset alert for a
    // subject the desk had already warned about would be swallowed.
    this.lastAlertAt.clear();
    this.sequence = 0;
    this.newsCursor = 0;
    this.setState({ notifications: [], news: seedNews(), now: Date.now() });
  }

  clear(): void {
    this.setState({ notifications: [] });
  }

  /** News for one instrument plus the untagged macro wire. */
  newsFor(symbol: string): NewsArticle[] {
    return this.getSnapshot().news.filter((article) => article.symbol === null || article.symbol === symbol);
  }

  // ── Derived alerts ────────────────────────────────────────────────────────

  private scanForAlerts(
    quotes: readonly { symbol: string; changePct: number }[],
    indices: readonly { name: string; value: number }[],
  ): void {
    for (const quote of quotes) {
      if (Math.abs(quote.changePct) < UNUSUAL_MOVE_PCT) {
        continue;
      }

      const gaining = quote.changePct > 0;
      this.pushThrottled(`move:${quote.symbol}`, {
        title: `${quote.symbol} unusual move`,
        detail: `Trading ${formatSignedPct(quote.changePct)} against yesterday's close`,
        icon: gaining ? "trending_up" : "trending_down",
        tone: gaining ? "success" : "error",
      });
    }

    const vix = indices.find((index) => index.name === "VIX");
    if (vix && vix.value >= VIX_RISK_LEVEL) {
      this.pushThrottled("risk:vix", {
        title: "Volatility warning",
        detail: `VIX at ${vix.value.toFixed(2)} — review position sizing`,
        icon: "warning",
        tone: "warn",
      });
    }
  }

  private pushThrottled(
    key: string,
    notification: { title: string; detail: string; icon: string; tone: NotificationTone },
  ): void {
    const now = Date.now();
    if (now - (this.lastAlertAt.get(key) ?? 0) < ALERT_COOLDOWN_MS) {
      return;
    }

    this.lastAlertAt.set(key, now);
    this.push(notification);
  }

  private publishWireItem(): void {
    const [headline, source, symbol] = NEWS_WIRE_POOL[this.newsCursor % NEWS_WIRE_POOL.length];
    this.newsCursor++;

    const article: NewsArticle = {
      id: `w${this.newsCursor}`,
      headline,
      source,
      symbol,
      at: new Date(),
    };

    const { news } = this.getSnapshot();
    this.setState({ news: [article, ...news].slice(0, MAX_NEWS), now: Date.now() });
  }
}

function seedNews(): NewsArticle[] {
  const now = Date.now();
  return SEED_NEWS.map(([headline, source, symbol, minutesAgo], index) => ({
    id: `s${index}`,
    headline,
    source,
    symbol,
    at: new Date(now - minutesAgo * 60_000),
  }));
}

import { OPENING_CASH, OPENING_LOTS } from "../data/market-seed";
import type {
  AccountSummary,
  Order,
  OrderDraft,
  Position,
  PositionLot,
  StockItem,
} from "../models/stock.model";
import { formatMoney, percentChange, round2 } from "../util/finance";
import { Store } from "../util/store";
import type { MarketDataService } from "./market-data.service";
import type { NotificationsService } from "./notifications.service";

/** Outcome of a ticket submission. `reason` is set only when rejected. */
export interface OrderResult {
  accepted: boolean;
  reason: string | null;
  order: Order;
}

export const COMMISSION_PER_SHARE = 0.005;
const MIN_COMMISSION = 1;
/** Reg-T style margin: cash buys twice its value in stock. */
const MARGIN_MULTIPLIER = 2;

/** Broker commission for a given size. Surfaced so the ticket can preview it. */
export function commissionFor(quantity: number): number {
  return round2(Math.max(MIN_COMMISSION, quantity * COMMISSION_PER_SHARE));
}

/** Orders still resting in the market. */
export const workingOrdersIn = (orders: readonly Order[]): Order[] =>
  orders.filter((order) => order.status === "Working");

/** Shares of `symbol` the book holds. */
export const heldQuantity = (lots: readonly PositionLot[], symbol: string): number =>
  lots.find((lot) => lot.symbol === symbol)?.quantity ?? 0;

export interface TradingState {
  /** The book: one aggregated lot per symbol. */
  lots: readonly PositionLot[];
  /** Newest first — the blotter renders this directly. */
  orders: readonly Order[];
  cash: number;
  realizedPl: number;
  /**
   * The book marked to the live market.
   *
   * The array is rebuilt only when the lots change — a fill, not a tick — so
   * the positions grid keeps the same `data` reference all session and never
   * re-measures. Each tick re-marks these rows in place and bumps `marks`.
   */
  positions: Position[];
  /** Incremented after every mark-to-market pass; what views of `positions` watch. */
  marks: number;
  account: AccountSummary;
}

/** The fields an engine step changes; `positions` and `account` follow from them. */
type BookChange = Partial<Pick<TradingState, "lots" | "orders" | "cash" | "realizedPl" | "marks">>;

/**
 * The trading engine: accepts drafts from the order ticket, keeps working
 * orders alive against the live feed, and books fills into the position lots
 * and cash balance that every P&L figure on the desk derives from.
 */
export class TradingService extends Store<TradingState> {
  private readonly market: MarketDataService;
  private readonly notifications: NotificationsService;
  private sequence = 0;

  constructor(market: MarketDataService, notifications: NotificationsService) {
    super(openingState(market.quotes));
    this.market = market;
    this.notifications = notifications;

    // One pass per price tick: re-mark the book, then re-evaluate working orders.
    market.watch(
      (state) => state.tick,
      () => this.markToMarket(),
    );
  }

  quantityHeld(symbol: string): number {
    return heldQuantity(this.getSnapshot().lots, symbol);
  }

  submitOrder(draft: OrderDraft): OrderResult {
    const quote = this.market.quoteOf(draft.symbol);
    const rejection = this.validate(draft, quote);
    const order: Order = {
      ...draft,
      id: `ORD-${(++this.sequence).toString().padStart(4, "0")}`,
      status: rejection ? "Rejected" : "Working",
      placedAt: new Date(),
      filledAt: null,
      fillPrice: null,
      note: rejection ?? "",
      peakPrice: draft.type === "Trailing Stop" ? (quote?.lastPrice ?? null) : null,
    };

    this.commit({ orders: [order, ...this.getSnapshot().orders] });

    if (rejection) {
      this.notifications.push({
        title: `Order rejected — ${order.symbol}`,
        detail: rejection,
        icon: "block",
        tone: "error",
      });
      return { accepted: false, reason: rejection, order };
    }

    // Market orders (and any resting order already through its trigger) fill
    // on this pass rather than waiting for the next tick.
    this.matchWorkingOrders();
    this.expireImmediateOrder(order.id);

    // Report the settled state so the ticket can say "filled" rather than "working".
    const settled = this.getSnapshot().orders.find((entry) => entry.id === order.id) ?? order;
    return { accepted: true, reason: null, order: settled };
  }

  /**
   * Returns the book to its opening state: seeded lots, opening cash, no
   * realised P&L and an empty blotter.
   */
  reset(): void {
    this.sequence = 0;
    // The positions are rebuilt from the new lots, and the bumped `marks` is
    // what tells the grids.
    this.commit({
      lots: openingLots(),
      orders: [],
      cash: OPENING_CASH,
      realizedPl: 0,
      marks: this.getSnapshot().marks + 1,
    });
  }

  cancelOrder(id: string): void {
    const { orders } = this.getSnapshot();
    this.commit({
      orders: orders.map((order) =>
        order.id === id && order.status === "Working"
          ? { ...order, status: "Cancelled", note: "Cancelled by user" }
          : order,
      ),
    });
  }

  cancelAllWorking(): void {
    const { orders } = this.getSnapshot();
    const count = workingOrdersIn(orders).length;
    if (count === 0) {
      return;
    }

    this.commit({
      orders: orders.map((order) =>
        order.status === "Working" ? { ...order, status: "Cancelled", note: "Cancelled by user" } : order,
      ),
    });

    this.notifications.push({
      title: "Working orders cancelled",
      detail: `${count} order${count === 1 ? "" : "s"} pulled from the market`,
      icon: "cancel",
      tone: "info",
    });
  }

  /** Sells the whole position at market. */
  flatten(symbol: string): OrderResult | null {
    const quantity = this.quantityHeld(symbol);
    if (quantity <= 0) {
      return null;
    }

    return this.submitOrder({
      symbol,
      side: "SELL",
      quantity,
      type: "Market",
      limitPrice: null,
      stopPrice: null,
      timeInForce: "Day",
    });
  }

  /**
   * Publishes an engine step as one change: the positions are rebuilt when the
   * lots moved, and the account is summed again.
   */
  private commit(change: BookChange): void {
    const next = { ...this.getSnapshot(), ...change };
    const positions = change.lots ? positionsOf(next.lots, this.market.quotes) : next.positions;
    this.setState({ ...change, positions, account: summarise(next, positions) });
  }

  /** The price tick's pass over the book. */
  private markToMarket(): void {
    const { positions, marks } = this.getSnapshot();
    markPositions(positions, this.market.quotes);
    this.commit({ marks: marks + 1 });
    this.matchWorkingOrders();
  }

  // ── Validation ────────────────────────────────────────────────────────────

  private validate(draft: OrderDraft, quote: StockItem | undefined): string | null {
    if (!quote) {
      return `${draft.symbol} is not tradable on this desk`;
    }
    if (!Number.isInteger(draft.quantity) || draft.quantity < 1) {
      return "Quantity must be a whole number of shares";
    }
    if ((draft.type === "Limit" || draft.type === "Stop Limit") && !(draft.limitPrice && draft.limitPrice > 0)) {
      return `${draft.type} orders require a limit price`;
    }
    if (draft.type !== "Market" && draft.type !== "Limit" && !(draft.stopPrice && draft.stopPrice > 0)) {
      return draft.type === "Trailing Stop"
        ? "Trailing stop orders require a trail amount"
        : `${draft.type} orders require a stop price`;
    }

    if (draft.side === "BUY") {
      const reference = draft.limitPrice ?? quote.ask;
      const required = round2(draft.quantity * reference + commissionFor(draft.quantity));
      const { buyingPower } = this.getSnapshot().account;
      if (required > buyingPower) {
        return `Needs ${formatMoney(required)} — buying power is ${formatMoney(buyingPower)}`;
      }
      return null;
    }

    const held = this.quantityHeld(draft.symbol);
    if (draft.quantity > held) {
      return held === 0
        ? `No ${draft.symbol} position to sell — short selling is disabled`
        : `Only ${held} ${draft.symbol} share${held === 1 ? "" : "s"} held`;
    }

    return null;
  }

  /** IOC and FOK orders do not rest: pull them if the first pass missed. */
  private expireImmediateOrder(id: string): void {
    const { orders } = this.getSnapshot();
    const order = orders.find((entry) => entry.id === id);
    if (!order || order.status !== "Working" || (order.timeInForce !== "IOC" && order.timeInForce !== "FOK")) {
      return;
    }

    this.commit({
      orders: orders.map((entry) =>
        entry.id === id
          ? { ...entry, status: "Cancelled", note: `Not filled immediately (${order.timeInForce})` }
          : entry,
      ),
    });
  }

  // ── Matching engine ───────────────────────────────────────────────────────

  /** Fills every working order the market has reached, and books the fills. */
  private matchWorkingOrders(): void {
    const book = this.getSnapshot();
    if (!book.orders.some((order) => order.status === "Working")) {
      return;
    }

    const fills: Order[] = [];
    const orders = book.orders.map((order) => {
      if (order.status !== "Working") {
        return order;
      }

      const quote = this.market.quoteOf(order.symbol);
      if (!quote) {
        return order;
      }

      // `peakPrice` is internal tracking state, never rendered, so it is
      // written in place — replacing the array on every tick would make the
      // blotter grid re-measure for the whole life of a trailing order.
      trackTrailingExtreme(order, quote);

      const fillPrice = resolveFillPrice(order, quote);
      if (fillPrice === null) {
        return order;
      }

      const filled: Order = {
        ...order,
        status: "Filled",
        filledAt: new Date(),
        fillPrice,
        note: `${order.type} filled at ${formatMoney(fillPrice)}`,
      };
      fills.push(filled);
      return filled;
    });

    if (fills.length === 0) {
      return;
    }

    let { lots, cash, realizedPl } = book;
    for (const order of fills) {
      const price = order.fillPrice ?? 0;
      const commission = commissionFor(order.quantity);
      const notional = round2(order.quantity * price);

      if (order.side === "BUY") {
        cash = round2(cash - notional - commission);
        lots = addToLot(lots, order.symbol, order.quantity, price);
      } else {
        const avgCost = lots.find((lot) => lot.symbol === order.symbol)?.avgCost ?? price;
        cash = round2(cash + notional - commission);
        realizedPl = round2(realizedPl + (price - avgCost) * order.quantity - commission);
        lots = reduceLot(lots, order.symbol, order.quantity);
      }
    }

    this.commit({ orders, lots, cash, realizedPl });

    for (const order of fills) {
      const price = order.fillPrice ?? 0;
      this.notifications.push({
        title: `${order.side} ${order.quantity} ${order.symbol} filled`,
        detail: `${order.type} at ${formatMoney(price)} · commission ${formatMoney(commissionFor(order.quantity))}`,
        icon: "receipt_long",
        tone: "success",
      });
    }
  }
}

// ── Pure engine helpers ─────────────────────────────────────────────────────

const openingLots = (): PositionLot[] => OPENING_LOTS.map((lot) => ({ ...lot }));

function openingState(quotes: ReadonlyMap<string, StockItem>): TradingState {
  const lots = openingLots();
  const book = { lots, orders: [], cash: OPENING_CASH, realizedPl: 0 };
  const positions = positionsOf(lots, quotes);
  return { ...book, positions, marks: 0, account: summarise(book, positions) };
}

/** The lots as position rows, marked to the market as it stands. */
function positionsOf(lots: readonly PositionLot[], quotes: ReadonlyMap<string, StockItem>): Position[] {
  const rows = lots.map(blankPosition);
  markPositions(rows, quotes);
  return rows;
}

/** Cash committed to unfilled buy orders, held back from buying power. */
function reservedCash(orders: readonly Order[]): number {
  return round2(workingOrdersIn(orders)
    .filter((order) => order.side === "BUY")
    .reduce((total, order) => total + order.quantity * (order.limitPrice ?? order.stopPrice ?? 0), 0));
}

/** The account figures the command bar and the positions footer show. */
function summarise(
  book: Pick<TradingState, "orders" | "cash" | "realizedPl">,
  positions: readonly Position[],
): AccountSummary {
  const { cash, realizedPl } = book;
  const marketValue = round2(positions.reduce((total, p) => total + p.marketValue, 0));
  const openPl = round2(positions.reduce((total, p) => total + p.openPl, 0));
  const dayPl = round2(positions.reduce((total, p) => total + p.dayChange, 0) + realizedPl);
  const netLiquidation = round2(cash + marketValue);

  return {
    cash,
    marketValue,
    netLiquidation,
    openPl,
    dayPl,
    realizedPl,
    buyingPower: round2(Math.max(0, cash - reservedCash(book.orders)) * MARGIN_MULTIPLIER),
    utilisation: netLiquidation === 0 ? 0 : round2((marketValue / netLiquidation) * 100),
  };
}

/** An unmarked row for a lot; {@link markPositions} fills in the live figures. */
function blankPosition(lot: PositionLot): Position {
  return {
    ...lot,
    name: lot.symbol,
    last: lot.avgCost,
    previousClose: lot.avgCost,
    marketValue: 0,
    dayChange: 0,
    dayChangePct: 0,
    openPl: 0,
    openPlPct: 0,
    weight: 0,
  };
}

/**
 * Marks rows to the live market **in place**. Mutation is deliberate: it is what
 * lets the positions grid hold one `data` array for the whole session.
 */
function markPositions(rows: readonly Position[], quotes: ReadonlyMap<string, StockItem>): void {
  let gross = 0;

  for (const row of rows) {
    const quote = quotes.get(row.symbol);
    const last = quote?.lastPrice ?? row.avgCost;
    const previousClose = quote?.previousClose ?? row.avgCost;

    row.name = quote?.name ?? row.symbol;
    row.last = last;
    row.previousClose = previousClose;
    row.marketValue = round2(last * row.quantity);
    row.dayChange = round2((last - previousClose) * row.quantity);
    row.dayChangePct = round2(percentChange(last, previousClose));
    row.openPl = round2((last - row.avgCost) * row.quantity);
    row.openPlPct = round2(percentChange(last, row.avgCost));

    gross += Math.abs(row.marketValue);
  }

  for (const row of rows) {
    row.weight = gross === 0 ? 0 : round2((Math.abs(row.marketValue) / gross) * 100);
  }
}

function addToLot(lots: readonly PositionLot[], symbol: string, quantity: number, price: number): PositionLot[] {
  const existing = lots.find((lot) => lot.symbol === symbol);
  if (!existing) {
    return [...lots, { symbol, quantity, avgCost: round2(price) }];
  }

  const total = existing.quantity + quantity;
  const avgCost = round2((existing.avgCost * existing.quantity + price * quantity) / total);
  return lots.map((lot) => (lot.symbol === symbol ? { ...lot, quantity: total, avgCost } : lot));
}

function reduceLot(lots: readonly PositionLot[], symbol: string, quantity: number): PositionLot[] {
  return lots
    .map((lot) => (lot.symbol === symbol ? { ...lot, quantity: lot.quantity - quantity } : lot))
    .filter((lot) => lot.quantity > 0);
}

/** Advances the high-water (or low-water) mark a trailing stop is measured from. */
function trackTrailingExtreme(order: Order, quote: StockItem): void {
  if (order.type !== "Trailing Stop") {
    return;
  }

  const current = order.peakPrice ?? quote.lastPrice;
  order.peakPrice = order.side === "SELL"
    ? Math.max(current, quote.lastPrice)
    : Math.min(current, quote.lastPrice);
}

/** The price this order would fill at right now, or `null` if it stays working. */
function resolveFillPrice(order: Order, quote: StockItem): number | null {
  const buying = order.side === "BUY";
  const aggressive = buying ? quote.ask : quote.bid;

  switch (order.type) {
    case "Market":
      return aggressive;

    case "Limit":
      return crossesLimit(order.limitPrice, aggressive, buying);

    case "Stop":
      return isTriggered(order.stopPrice, quote.lastPrice, buying) ? aggressive : null;

    case "Stop Limit":
      return isTriggered(order.stopPrice, quote.lastPrice, buying)
        ? crossesLimit(order.limitPrice, aggressive, buying)
        : null;

    case "Trailing Stop": {
      if (order.stopPrice === null || order.peakPrice === null) {
        return null;
      }
      const trigger = buying ? order.peakPrice + order.stopPrice : order.peakPrice - order.stopPrice;
      return isTriggered(trigger, quote.lastPrice, buying) ? aggressive : null;
    }
  }
}

function crossesLimit(limit: number | null, aggressive: number, buying: boolean): number | null {
  if (limit === null) {
    return null;
  }

  if (buying) {
    return aggressive <= limit ? Math.min(aggressive, limit) : null;
  }
  return aggressive >= limit ? Math.max(aggressive, limit) : null;
}

/** A stop is hit when the market trades up through it (buy) or down through it (sell). */
function isTriggered(stop: number | null, last: number, buying: boolean): boolean {
  if (stop === null) {
    return false;
  }

  return buying ? last >= stop : last <= stop;
}

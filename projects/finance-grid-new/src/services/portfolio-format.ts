import type { StyleVariant } from "igniteui-react";
import type { TickDirection } from "./live-portfolio";

/** Year length the elapsed figure is expressed in. */
const DAYS_PER_YEAR = 365;

/**
 * The line the tax code draws through a portfolio.
 *
 * A position held longer than a year is taxed as a long-term gain rather than
 * at the income rate, which makes this the most consequential thing about a
 * holding after its P&L. A day past the year, not the year itself: the rule is
 * "held *more* than one year", so a position at exactly 365 days is still short
 * term. Two of the seeded rows sit on 365 precisely and read "1 day to
 * long-term treatment".
 */
const LONG_TERM_DAYS = DAYS_PER_YEAR + 1;

/** Sparkline brushes per appearance. The chart paints to a canvas and cannot read a `var()`. */
const SPARKLINE_BRUSHES = {
  light: { up: "#1a9b62", down: "#d33a75" },
  dark: { up: "#34d399", down: "#ff7aae" },
} as const;

const currencyFormatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const percentFormatter = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** How one row's holding period reads: a tag, a figure, and progress to the line. */
export interface HoldingTerm {
  label: string;
  variant: StyleVariant;
  /** Elapsed period in the shortest honest form: `1y 287d`, or `94d`. */
  elapsed: string;
  /** Progress toward `LONG_TERM_DAYS` as a 0-100 value for the progress bar. */
  progressValue: number;
  /** The bar's colour: the same two states the tag above it carries. */
  barVariant: StyleVariant;
  /** What the tag and the bar convey, for anything that cannot see either. */
  hint: string;
}

export function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

/** An unsigned percentage with two decimals: the sign is carried by the arrow or the colour. */
export function formatPercent(value: number): string {
  return `${percentFormatter.format(Math.abs(value))}%`;
}

/** The figure as a chip shows it: an arrow for its direction, then the magnitude. */
export function badgeLabel(value: number): string {
  const arrow = value > 0 ? "\u2191 " : value < 0 ? "\u2193 " : "";
  return `${arrow}${formatPercent(value)}`;
}

/** The chip variant for a signed figure. */
export function chipVariant(value: number): StyleVariant {
  if (value > 0) return "success";
  if (value < 0) return "danger";
  return "info";
}

/**
 * The avatar initials: the ticker's first letters or digits.
 *
 * The avatar shows two characters, so the third the ticker may offer is left out.
 */
export function avatarInitials(ticker: string): string {
  const normalized = ticker.replace(/[^A-Z0-9]/gi, "").toUpperCase();
  return (normalized.slice(0, 3) || "EQ").slice(0, 2);
}

/** One row's holding period, resolved in a single call: tag, figure, bar and spoken description. */
export function holdingTerm(days: number): HoldingTerm {
  const held = Math.max(0, Math.trunc(days));
  const isLongTerm = held >= LONG_TERM_DAYS;
  const years = Math.floor(held / DAYS_PER_YEAR);
  const remainder = held % DAYS_PER_YEAR;
  const remaining = LONG_TERM_DAYS - held;

  // A sub-1% fill on a rounded 10px track renders as a dot rather than a bar,
  // so short holdings get a visible 6% floor, the same one the allocation bar
  // uses. Zero stays zero: a position opened today has not started counting.
  const scaled = held > 0 ? Math.min(100, Math.max(6, (held / LONG_TERM_DAYS) * 100)) : 0;

  return {
    label: isLongTerm ? "LONG TERM" : "SHORT TERM",
    // Not `danger` for the short-term case: holding a position under a year is
    // an ordinary state, not a fault.
    variant: isLongTerm ? "success" : "info",
    // `1y` rather than `1y 0d` on the anniversary.
    elapsed: years > 0 ? (remainder > 0 ? `${years}y ${remainder}d` : `${years}y`) : `${held}d`,
    progressValue: scaled,
    barVariant: isLongTerm ? "success" : "info",
    hint: isLongTerm
      ? "Long term \u2014 gains taxed at the long-term rate"
      : `Short term \u2014 ${remaining} ${remaining === 1 ? "day" : "days"} to long-term treatment`,
  };
}

/**
 * Allocation as a 0-100 bar value, scaled against the largest holding rather
 * than against 100: the biggest position fills the track and the rest read
 * relative to it, which is the only way a 0.21% holding is visible at all.
 * Floored at 6, because below that the fill is narrower than its own corner
 * radius and renders as a dot.
 */
export function allocationBarValue(value: number, maxAllocationPct: number): number {
  const magnitude = Math.abs(value);
  if (magnitude === 0 || maxAllocationPct <= 0) {
    return 0;
  }

  return Math.min(100, Math.max(6, (magnitude / maxAllocationPct) * 100));
}

/** The class that flashes a delta chip in the direction of the row's last re-pricing. */
export function tickClass(direction: TickDirection): string {
  return direction === "up" ? " is-up" : direction === "down" ? " is-down" : "";
}

/** The sparkline's line colour: the direction the holding is going. */
export function sparklineBrush(changePct: number, isDark: boolean): string {
  const brushes = isDark ? SPARKLINE_BRUSHES.dark : SPARKLINE_BRUSHES.light;
  return changePct < 0 ? brushes.down : brushes.up;
}

/** The colour of the stretch below zero, whichever way the session ends. */
export function sparklineNegativeBrush(isDark: boolean): string {
  return isDark ? SPARKLINE_BRUSHES.dark.down : SPARKLINE_BRUSHES.light.down;
}

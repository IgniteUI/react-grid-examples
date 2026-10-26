import { memo } from "react";
import { IgrAvatar, IgrChip, IgrLinearProgress } from "igniteui-react";
import { useFinanceView } from "../finance-view-context";
import type { FinanceTone } from "../services/finance-data";
import type { TickDirection } from "../services/live-portfolio";
import {
  allocationBarValue,
  avatarInitials,
  badgeLabel,
  chipVariant,
  formatCurrency,
  formatPercent,
  holdingTerm,
  tickClass,
} from "../services/portfolio-format";
import HighlightedText from "./highlighted-text";

// Every cell is memoized on the values it shows. The grid re-runs all visible
// templates on each live tick, and only the rows the tick re-priced change.
//
// The figures are read-only, so their chips are inert: no pointer target, no
// tab stop, and hidden from assistive technology.

export const AssetCell = memo(function AssetCell({ ticker, company, tone }: { ticker: string; company: string; tone: FinanceTone }) {
  return (
    <div className="ticker-cell">
      <IgrAvatar className={`ticker-logo tone-${tone}`} shape="circle" initials={avatarInitials(ticker)} />
      <div className="ticker-meta">
        <span className="ticker-symbol">
          <HighlightedText text={ticker} />
        </span>
        <span className="ticker-name">
          <HighlightedText text={company} />
        </span>
      </div>
    </div>
  );
});

/**
 * Percentage first in the DOM as well as on screen, so the reading order is
 * the order the cell is laid out in. The chip flashes in the direction of the
 * row's last re-pricing.
 */
export const PriceCell = memo(function PriceCell({ lastPrice, changePct, direction }: { lastPrice: number; changePct: number; direction: TickDirection }) {
  return (
    <div className="price-combined-cell">
      <IgrChip
        className={`finance-chip finance-delta-chip${tickClass(direction)}`}
        outlined
        variant={chipVariant(changePct)}
        inert
        aria-hidden="true"
      >
        {badgeLabel(changePct)}
      </IgrChip>
      <span className="numeric-cell price-combined-price">{formatCurrency(lastPrice)}</span>
    </div>
  );
});

export const HoldingCell = memo(function HoldingCell({ days }: { days: number }) {
  const term = holdingTerm(days);
  return (
    <div className="holding-cell">
      <div className="holding-head">
        <IgrChip className="finance-chip finance-term-chip" outlined variant={term.variant} inert aria-hidden="true">
          {term.label}
        </IgrChip>
        <span className="holding-elapsed">{term.elapsed}</span>
      </div>
      <IgrLinearProgress
        className="holding-bar"
        value={term.progressValue}
        max={100}
        variant={term.barVariant}
        hideLabel
        animationDuration={0}
        aria-hidden="true"
      />
      <span className="sr-only">{term.hint}</span>
    </div>
  );
});

export const MarketValueCell = memo(function MarketValueCell({ value }: { value: number }) {
  return <span className="numeric-cell">{formatCurrency(value)}</span>;
});

export const NetProfitCell = memo(function NetProfitCell({ netProfit, netProfitPct, direction }: { netProfit: number; netProfitPct: number; direction: TickDirection }) {
  return (
    <div className="net-profit-combined-cell">
      <IgrChip
        className={`finance-chip finance-delta-chip${tickClass(direction)}`}
        outlined
        variant={chipVariant(netProfitPct)}
        inert
        aria-hidden="true"
      >
        {badgeLabel(netProfitPct)}
      </IgrChip>
      <span tabIndex={-1} draggable={false} aria-hidden="true">
        {formatCurrency(netProfit)}
      </span>
    </div>
  );
});

/**
 * The bar is hidden from assistive technology: the value it would announce is
 * the share of the largest holding, not the percentage printed above it.
 */
export const AllocationCell = memo(function AllocationCell({ value }: { value: number }) {
  const { maxAllocationPct } = useFinanceView();
  return (
    <div className="allocation-cell">
      <span className="allocation-value">{formatPercent(value)}</span>
      <IgrLinearProgress
        className="allocation-bar"
        value={allocationBarValue(value, maxAllocationPct)}
        max={100}
        hideLabel
        animationDuration={0}
        aria-hidden="true"
      />
    </div>
  );
});

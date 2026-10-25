import { createContext, useContext } from "react";

/**
 * The view state the cell templates read.
 *
 * The grid keeps the template functions it was first given, so a template
 * cannot close over state that changes later. The cells it renders are portals
 * inside the grid's React tree, so they read this context instead and re-render
 * when the filter or the appearance changes.
 */
export interface FinanceViewState {
  /** The toolbar's asset filter, as typed. */
  query: string;
  isDark: boolean;
  /** The largest allocation, which fills an allocation bar's whole track. */
  maxAllocationPct: number;
}

export const FinanceViewContext = createContext<FinanceViewState>({ query: "", isDark: false, maxAllocationPct: 0 });

export function useFinanceView(): FinanceViewState {
  return useContext(FinanceViewContext);
}

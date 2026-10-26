import { createContext, useContext } from "react";

export type FinjsSize = "small" | "medium" | "large";

export const FINJS_SIZES: readonly FinjsSize[] = ["small", "medium", "large"];

/** The appearance and density the toolbar controls read and change. */
export interface FinjsViewState {
  size: FinjsSize;
  isDark: boolean;
  setSize: (size: FinjsSize) => void;
  toggleTheme: () => void;
}

/**
 * The size and theme live above the grid and reach the toolbar's controls
 * through this context. That keeps the grid itself out of their updates: a
 * grid element re-rendered by React is handed all of its props again, which
 * is wasted work for a 100,000-row grid and can undo what the user changed in
 * its own UI.
 */
export const FinjsViewContext = createContext<FinjsViewState | null>(null);

export function useFinjsView(): FinjsViewState {
  const view = useContext(FinjsViewContext);
  if (!view) {
    throw new Error("useFinjsView must be used inside the sample");
  }
  return view;
}

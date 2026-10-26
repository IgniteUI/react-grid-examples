import { useEffect, type RefObject } from "react";
import type { Store } from "./store";

/** The part of `IgrGrid` a live grid needs. */
interface RefreshableGrid {
  markForCheck(): void;
}

/**
 * Keeps a grid's rendered cells in step with row objects that are mutated in
 * place, without touching its `data` binding: the grid is told to re-render
 * the rows on screen each time `counter` moves in `store`.
 *
 * Replacing the data array on every price tick makes the grid rebuild its row
 * cache and re-measure the virtualised viewport, which shows up as a flickering
 * scrollbar. `markForCheck()` is the grid's own answer to this: mutate the
 * records, then ask it to re-render the rows currently on screen.
 */
export function useRefreshOnTick<State extends object>(
  grid: RefObject<RefreshableGrid | null>,
  store: Store<State>,
  counter: keyof State,
): void {
  useEffect(
    () => store.watch((state) => state[counter], () => grid.current?.markForCheck()),
    [grid, store, counter],
  );
}

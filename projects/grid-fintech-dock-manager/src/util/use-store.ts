import { useSyncExternalStore } from "react";
import type { Store } from "./store";

/**
 * Reads one slice of a desk store and re-renders the component when it changes.
 *
 * `select` has to return something the state already holds, or a primitive: a
 * new array or object on every call never compares equal, so React would keep
 * re-rendering. Derive those in the component, with `useMemo`.
 */
export function useStore<State extends object, Slice>(store: Store<State>, select: (state: State) => Slice): Slice {
  return useSyncExternalStore(store.subscribe, () => select(store.getSnapshot()));
}

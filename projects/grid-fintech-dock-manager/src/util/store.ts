/**
 * The state of one desk service, as React reads it: an immutable snapshot that
 * the service replaces, never edits, on every change, and the listeners told
 * about each replacement.
 *
 * Components read a slice of it with `useStore` (`useSyncExternalStore`
 * underneath). Services, and effects that drive a component imperatively — a
 * grid's `markForCheck()`, a chart's live candle — listen with {@link watch}.
 *
 * The live market is the one thing written in place: the quote and position
 * rows the grids bind are mutated on every tick, and a counter in the snapshot
 * says that they moved (see `MarketDataService`).
 */
export class Store<State extends object> {
  private state: State;
  private readonly listeners = new Set<() => void>();

  constructor(initial: State) {
    this.state = initial;
  }

  /** Adds a listener and returns its removal. Stable, so React subscribes once. */
  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /** The current snapshot. Stable, so React can hand it to `useSyncExternalStore`. */
  readonly getSnapshot = (): State => this.state;

  /**
   * Calls `onChange` with the new slice each time the slice `select` picks out
   * of the state changes. Returns the unsubscribe.
   */
  watch<Slice>(select: (state: State) => Slice, onChange: (slice: Slice) => void): () => void {
    let current = select(this.state);
    return this.subscribe(() => {
      const next = select(this.state);
      if (!Object.is(next, current)) {
        current = next;
        onChange(next);
      }
    });
  }

  /** Replaces the given fields and tells every listener. */
  protected setState(patch: Partial<State>): void {
    this.state = { ...this.state, ...patch };
    for (const listener of [...this.listeners]) {
      listener();
    }
  }
}

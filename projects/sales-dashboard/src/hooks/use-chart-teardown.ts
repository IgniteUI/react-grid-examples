import { useEffect, type RefObject } from "react";

/** The part of a chart the sample needs to take it down. */
interface Destroyable {
  destroy(): void;
}

/** Teardowns waiting for the end of the current task, by chart. */
const pendingTeardowns = new WeakMap<Destroyable, number>();

/**
 * Destroys a chart when its component goes away.
 *
 * The chart wrappers start a size watcher when they are constructed and do not
 * stop it on unmount: only `destroy()` does. The teardown waits for the end of
 * the current task, so that a StrictMode check, which runs the cleanup and the
 * effect again on the same live chart, finds it and keeps it.
 */
export function useChartTeardown(chartRef: RefObject<Destroyable | null>): void {
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    const pending = pendingTeardowns.get(chart);
    if (pending !== undefined) {
      window.clearTimeout(pending);
      pendingTeardowns.delete(chart);
    }

    return () => {
      pendingTeardowns.set(
        chart,
        window.setTimeout(() => {
          pendingTeardowns.delete(chart);
          chart.destroy();
        }),
      );
    };
  }, [chartRef]);
}

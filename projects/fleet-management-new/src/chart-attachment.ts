import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { useFleetDetailContext } from "./fleet-context";

type AttachmentListener = (attached: boolean) => void;

/**
 * Tells the detail charts when their host leaves or rejoins the page.
 *
 * The grid keeps an expanded row's detail when the row collapses or scrolls
 * out of view: it takes the detail's nodes out of the document and puts them
 * back later, without unmounting what is rendered inside. A chart in there
 * would go on polling its size the whole time, so the charts are destroyed
 * while their host is detached and created again when it returns.
 *
 * One observer on the grid covers every chart: the grid's own DOM changes as it
 * scrolls, so the checks are batched to one per frame and only look at the
 * hosts registered here.
 */
export class ChartAttachmentWatcher {
  private readonly listeners = new Map<HTMLElement, AttachmentListener>();
  private observer?: MutationObserver;
  private frame = 0;

  observe(root: HTMLElement): void {
    this.observer?.disconnect();
    this.observer = new MutationObserver(() => this.schedule());
    this.observer.observe(root, { childList: true, subtree: true });
  }

  disconnect(): void {
    this.observer?.disconnect();
    this.observer = undefined;
    cancelAnimationFrame(this.frame);
    this.frame = 0;
  }

  /** Registers a chart host; returns the function that unregisters it. */
  watch(host: HTMLElement, listener: AttachmentListener): () => void {
    this.listeners.set(host, listener);
    return () => {
      this.listeners.delete(host);
    };
  }

  private schedule(): void {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      for (const [host, listener] of this.listeners) listener(host.isConnected);
    });
  }
}

export interface DestroyableChart {
  destroy(): void;
}

/** Lets a chart report every instance of it that gets constructed. */
export interface ChartConstructionProps {
  onConstructed?: (chart: DestroyableChart) => void;
}

export interface ChartHostRefs<T extends DestroyableChart> {
  /** The element the chart is rendered into; it stays when the chart is removed. */
  hostRef: RefObject<HTMLDivElement | null>;
  chartRef: RefObject<T | null>;
  /**
   * Whether the chart should exist: false until what it needs is in place, and
   * while its host is out of the page.
   */
  exists: boolean;
  /** Hand to the chart, so every instance constructed for this host is known. */
  onConstructed: (chart: DestroyableChart) => void;
}

/**
 * The charts poll their own size every 100 ms from the moment they are
 * constructed until `destroy()` is called; unmounting them does not stop it.
 * This destroys a chart once it has left the page - when its tab closes, the
 * appearance flips and it is rebuilt, or its detail row collapses, is
 * recycled or unmounts - and renders it again when its host is back.
 *
 * `ready` holds the chart back until whatever it reads while it is being
 * constructed is in place.
 *
 * StrictMode replays effect cleanups on components that stay mounted, so the
 * cleanup only destroys a chart whose host is no longer in the document: on a
 * real removal React has already taken it out by the time the cleanup runs.
 * In development StrictMode also constructs every chart twice and keeps one;
 * the spare is never mounted, so it is destroyed as soon as the kept one is.
 */
export function useChartHost<T extends DestroyableChart>(ready: boolean): ChartHostRefs<T> {
  const { chartAttachments } = useFleetDetailContext();
  const hostRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<T>(null);
  const constructedRef = useRef<DestroyableChart[]>([]);
  const [attached, setAttached] = useState(true);
  const exists = ready && attached;

  const onConstructed = useCallback((chart: DestroyableChart) => {
    constructedRef.current.push(chart);
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    return host ? chartAttachments.watch(host, setAttached) : undefined;
  }, [chartAttachments]);

  useEffect(() => {
    if (!exists) return;
    const host = hostRef.current;
    const chart = chartRef.current;
    for (const spare of constructedRef.current) {
      if (spare !== chart) spare.destroy();
    }
    constructedRef.current = [];
    return () => {
      if (chart && !host?.isConnected) chart.destroy();
    };
  }, [exists]);

  return { hostRef, chartRef, exists, onConstructed };
}

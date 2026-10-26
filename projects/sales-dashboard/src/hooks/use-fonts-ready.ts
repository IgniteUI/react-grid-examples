import { useEffect, useState } from "react";

/** The longest the charts wait for a face that is slow to arrive. */
const FONT_WAIT_MS = 3000;

/**
 * True once `load` has settled, or has kept the page waiting for too long. It
 * never holds the charts back for good: an offline page gets them with the
 * fallback faces.
 *
 * @param load Starts loading the faces. It must be stable between renders, and
 *   a failure counts as settled, so the charts are still built.
 */
export function useFontsReady(load: () => Promise<unknown>): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timer = 0;
    const patience = new Promise<void>((resolve) => {
      timer = window.setTimeout(resolve, FONT_WAIT_MS);
    });

    void Promise.race([load().catch(() => undefined), patience]).then(() => {
      window.clearTimeout(timer);
      if (!cancelled) setReady(true);
    });

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [load]);

  return ready;
}

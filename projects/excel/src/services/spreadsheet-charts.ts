import type { IgrSpreadsheet } from "igniteui-react-spreadsheet";

/** What the Spreadsheet wrapper keeps for each container that the chart adapter asked it for. */
interface ChartContainer {
  container?: { getRootObject?: () => { destroy?: () => void } | null } | null;
}

/**
 * Destroys the charts that the chart adapter drew inside the Spreadsheet.
 *
 * A chart checks its size every 100 ms until it is destroyed. The Spreadsheet wrapper neither
 * destroys its charts nor lets go of them when it unmounts, so without this the watchers keep
 * running after the sample has left the page.
 *
 * The wrapper keeps the charts in its renderer containers and hands them out nowhere else, so
 * they are found there. That list is the wrapper's own, not part of its API: if it is not there
 * any more, the charts are left alone and only their watchers keep running. The containers lose
 * their charts when React unmounts them: call this while the Spreadsheet is still mounted, from
 * the cleanup of a layout effect.
 *
 * This can go, with the layout effect that calls it, once the wrapper destroys its charts itself.
 */
export function destroySpreadsheetCharts(spreadsheet: IgrSpreadsheet): void {
  const { _currentContainers: containers } = spreadsheet as unknown as {
    _currentContainers?: ChartContainer[];
  };
  if (!Array.isArray(containers)) {
    return;
  }

  for (const entry of containers) {
    entry?.container?.getRootObject?.()?.destroy?.();
  }
}

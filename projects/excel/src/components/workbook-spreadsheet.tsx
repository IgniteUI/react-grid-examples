import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import type { Workbook } from "igniteui-react-excel";
import { IgrSpreadsheet } from "igniteui-react-spreadsheet";
import { SpreadsheetChartAdapter } from "igniteui-react-spreadsheet-chart-adapter";
import { retainSystemChartFonts } from "../services/chart-fonts";
import { destroySpreadsheetCharts } from "../services/spreadsheet-charts";

/** Sets up the Spreadsheet's chart adapter and fonts, and lets go of everything on unmount. */
function useSpreadsheetLifecycle(spreadsheetRef: RefObject<IgrSpreadsheet | null>) {
  // A layout effect, because its cleanup runs before React unmounts the Spreadsheet's charts.
  useLayoutEffect(() => {
    const spreadsheet = spreadsheetRef.current;
    return () => {
      if (spreadsheet) {
        destroySpreadsheetCharts(spreadsheet);
      }
    };
  }, [spreadsheetRef]);

  useEffect(() => {
    const spreadsheet = spreadsheetRef.current;
    if (!spreadsheet) {
      return;
    }

    // Charts only show in the Spreadsheet when it has a chart adapter.
    spreadsheet.chartAdapter = new SpreadsheetChartAdapter();
    const releaseChartFonts = retainSystemChartFonts();

    // The wrapper does not release the Spreadsheet's size watcher when it unmounts, so it is
    // destroyed here. This can go once the wrapper does it itself.
    return () => {
      releaseChartFonts();
      spreadsheet.destroy();
    };
  }, [spreadsheetRef]);
}

interface WorkbookSpreadsheetProps {
  /** The workbook to show. The Spreadsheet shows its own empty sheet until there is one. */
  workbook?: Workbook;
}

/** The Spreadsheet, filling its container. Render it in a root of its own (see IsolatedRoot). */
export default function WorkbookSpreadsheet({ workbook }: WorkbookSpreadsheetProps) {
  const spreadsheetRef = useRef<IgrSpreadsheet>(null);

  useSpreadsheetLifecycle(spreadsheetRef);

  // The workbook is set through the ref, not as a prop, because the wrapper throws when it is
  // given a workbook prop that is still undefined. The Spreadsheet sizes its cell area from the
  // container's measured pixels and does not re-measure when a workbook is set: containerResized()
  // is its hook for "look again". This effect follows the lifecycle hook's, so the chart adapter
  // and the fonts are in place before the workbook is.
  useEffect(() => {
    const spreadsheet = spreadsheetRef.current;
    if (spreadsheet && workbook) {
      spreadsheet.workbook = workbook;
      spreadsheet.containerResized();
    }
  }, [workbook]);

  return <IgrSpreadsheet ref={spreadsheetRef} height="100%" width="100%" />;
}

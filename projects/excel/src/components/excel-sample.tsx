import { useEffect, useState } from "react";
import { IgrExcelModule, type Workbook } from "igniteui-react-excel";
import { IgrSpreadsheetModule } from "igniteui-react-spreadsheet";
import { IgrSpreadsheetChartAdapterModule } from "igniteui-react-spreadsheet-chart-adapter";
import { loadWorkbook } from "../services/excel-utility";
import { widenFilterableColumns } from "../services/workbook-layout";
import IsolatedRoot from "./isolated-root";
import WorkbookSpreadsheet from "./workbook-spreadsheet";

IgrExcelModule.register();
IgrSpreadsheetModule.register();
IgrSpreadsheetChartAdapterModule.register();

/** Served with the app, so the sample works offline and shows exactly the workbook file. */
const SAMPLE_WORKBOOK_URL = `${import.meta.env.BASE_URL}assets/excel/meridian-north-retail-fy2027-budget.xlsx`;

const WORKBOOK_TITLE = "Meridian North Retail Co. \u2014 FY2027 Budget Planning Workbook";

export default function ExcelSample() {
  const [workbook, setWorkbook] = useState<Workbook>();
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    const download = new AbortController();

    loadWorkbook(SAMPLE_WORKBOOK_URL, download.signal).then(
      (loaded) => {
        if (download.signal.aborted) {
          return;
        }

        widenFilterableColumns(loaded);
        setWorkbook(loaded);
      },
      (error: unknown) => {
        if (download.signal.aborted) {
          return;
        }

        console.error("Could not load the sample workbook.", error);
        setStatusMessage("Could not load the sample workbook.");
      }
    );

    return () => download.abort();
  }, []);

  return (
    <section className="excel" aria-label={WORKBOOK_TITLE}>
      {statusMessage && (
        <p className="excel-status" role="status">
          {statusMessage}
        </p>
      )}

      <IsolatedRoot className="excel-spreadsheet-container">
        <WorkbookSpreadsheet workbook={workbook} />
      </IsolatedRoot>
    </section>
  );
}

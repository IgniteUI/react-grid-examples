import type { Workbook } from "igniteui-react-excel";

/**
 * Extra room, in 256ths of a character width, added to a table's header columns after load.
 *
 * The workbook sizes those columns to fit the header text exactly, so the AutoFilter dropdown
 * icon the Spreadsheet draws over the header cell covers part of the label. This is true to how
 * Excel itself renders an exactly-fit filtered column, just easy to miss there.
 */
const FILTER_ICON_PADDING = 3 * 256;

/** Widens the header columns of every table in the workbook, to make room for the filter icons. */
export function widenFilterableColumns(workbook: Workbook): void {
  for (const worksheet of workbook.worksheets()) {
    for (const table of worksheet.tables()) {
      const header = table.headerRowRegion;
      for (let col = header.firstColumn; col <= header.lastColumn; col++) {
        const column = worksheet.columns(col);
        column.autoFitWidth();
        column.width = column.width + FILTER_ICON_PADDING;
      }
    }
  }
}

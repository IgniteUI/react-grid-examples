import { memo, useEffect, useLayoutEffect, useMemo, useRef, type RefObject } from "react";
import {
  IgrColumn,
  IgrGrid,
  IgrGridToolbar,
  IgrGridToolbarActions,
  IgrGridToolbarExporter,
  IgrGridToolbarHiding,
  IgrGridToolbarPinning,
  IgrGridToolbarTitle,
  type IgrCellTemplateContext,
  type IgrColumnExportingEventArgsDetail,
  type IgrColumnPipeArgs,
  type IgrExporterEventArgsDetail,
} from "igniteui-react-grids";
import { CONTRACT_TYPES, REGIONS, getFinjsRows, type FinjsRow } from "../services/finjs-data";
import { trends } from "../services/finjs-trends";
import { OptionEditor } from "./finjs-editors";
import { PriceCell } from "./price-cell";
import FinjsToolbarControls from "./finjs-toolbar-controls";

/** The fields the PDF export keeps; the other columns stay out of it. */
const PDF_FIELDS = new Set([
  "id", "category", "type", "contract", "settlement", "country", "region",
  "lastUpdated", "openPrice", "price", "change", "changeP", "buy", "sell",
]);

const COLUMN_FORMAT: IgrColumnPipeArgs = { digitsInfo: "1.3-3" };
const PERCENT_FORMAT: IgrColumnPipeArgs = { digitsInfo: "3.3-3" };

const REGION_NAMES = REGIONS.map((region) => region.name);

/** `1000000` -> `1M rows`, `100000` -> `100K rows`. Whole units only; the counts are round. */
function formatRowCount(count: number): string {
  if (count >= 1_000_000) return `${count / 1_000_000}M rows`;
  if (count >= 1_000) return `${count / 1_000}K rows`;
  return `${count} rows`;
}

// The cell templates. The grid keeps the functions it is first given, so they
// read only the cell's own row.
const priceTemplate = (ctx: IgrCellTemplateContext) => {
  const row = ctx.cell.row.data as FinjsRow;
  return <PriceCell column={ctx.cell.column as IgrColumn} price={row.price} changeP={row.changeP} />;
};

const contractEditor = (ctx: IgrCellTemplateContext) => <OptionEditor cell={ctx.cell} options={CONTRACT_TYPES} />;
const regionEditor = (ctx: IgrCellTemplateContext) => <OptionEditor cell={ctx.cell} options={REGION_NAMES} />;

interface Subscribable<T> {
  subscribe(next: (value: T) => void): { unsubscribe(): void };
}

/**
 * The exporter the toolbar hands to `exportStarted`. Its typings describe DOM
 * events, but at runtime its events are emitters to subscribe to.
 */
interface ExporterEmitters {
  columnExporting: Subscribable<IgrColumnExportingEventArgsDetail>;
  exportEnded: Subscribable<unknown>;
}

/**
 * A PDF export is set on A3 paper and keeps to the PDF_FIELDS columns, for as
 * long as that export runs. Excel exports every visible column.
 */
function onExportStarted(event: CustomEvent<IgrExporterEventArgsDetail>): void {
  const { exporter, options } = event.detail;
  if (!("pageSize" in options)) return;

  (options as { pageSize: string }).pageSize = "A3";

  const emitters = exporter as unknown as ExporterEmitters;
  const columns = emitters.columnExporting.subscribe((args) => {
    if (!PDF_FIELDS.has(args.field)) {
      args.cancel = true;
    }
  });
  const ended = emitters.exportEnded.subscribe(() => {
    columns.unsubscribe();
    ended.unsubscribe();
  });
}

interface FinjsGridProps {
  gridRef: RefObject<IgrGrid | null>;
}

/**
 * The 100,000-row instrument grid. It is memoized and takes only a stable ref,
 * so the sample's size and theme changes never re-render it; its toolbar
 * controls follow those through the view context instead.
 */
const FinjsGrid = memo(function FinjsGrid({ gridRef }: FinjsGridProps) {
  const rows = useMemo(() => getFinjsRows(), []);
  const rowCountLabel = formatRowCount(rows.length);
  const priceColumn = useRef<IgrColumn>(null);

  // Set here, once, rather than as a prop: the column's wrapper re-renders whenever
  // one of its cells does and writes every prop back to the column, which would
  // undo the width the Price cells settle on once they are filled.
  useLayoutEffect(() => {
    if (priceColumn.current) priceColumn.current.width = "fit-content";
  }, []);

  // The grid works out its `aria-rowcount` once, when it first renders, which is
  // before it has been given any rows, and never updates it; so the count (the
  // rows plus the header row) is stated here.
  useEffect(() => {
    gridRef.current?.setAttribute("aria-rowcount", String(rows.length + 1));
  }, [gridRef, rows]);

  return (
    <IgrGrid
      ref={gridRef}
      className="finjs-grid"
      width="100%"
      height="100%"
      primaryKey="id"
      autoGenerate={false}
      data={rows}
      rowSelection="multiple"
      allowFiltering
      moving
      filterMode="excelStyleFilter"
      onRowSelectionChanging={() => gridRef.current?.clearCellSelection()}
    >
      <IgrGridToolbar>
        <IgrGridToolbarTitle>
          <span className="finjs-title">
            <h1>FinTech Trading</h1>
            {/* Read off the data, so the toolbar cannot claim a row count the generator is not producing. */}
            <span className="finjs-row-count">{rowCountLabel}</span>
          </span>
        </IgrGridToolbarTitle>
        <IgrGridToolbarActions>
          <FinjsToolbarControls />
          <IgrGridToolbarHiding title="Indicators" />
          <IgrGridToolbarPinning />
          <IgrGridToolbarExporter exportCSV={false} onExportStarted={onExportStarted} />
        </IgrGridToolbarActions>
      </IgrGridToolbar>

      <IgrColumn field="id" header="Id" sortable hidden />
      <IgrColumn field="category" header="Category" width="fit-content" sortable />
      <IgrColumn field="type" header="Type" width="fit-content" sortable filterable={false} />
      <IgrColumn field="contract" header="Contract" width="fit-content" sortable editable inlineEditorTemplate={contractEditor} />
      <IgrColumn field="settlement" header="Settlement" width="fit-content" sortable />
      <IgrColumn field="country" header="Country" width="fit-content" sortable editable />
      <IgrColumn field="region" header="Region" width="fit-content" sortable editable inlineEditorTemplate={regionEditor} />
      <IgrColumn field="lastUpdated" header="Last Update" width="fit-content" dataType="date" editable />
      <IgrColumn field="openPrice" header="Open Price" width="fit-content" dataType="currency" pipeArgs={COLUMN_FORMAT} sortable />
      <IgrColumn ref={priceColumn} field="price" header="Price" cellClasses={trends} sortable bodyTemplate={priceTemplate} />
      <IgrColumn field="change" header="Change" width="fit-content" sortable cellClasses={trends} />
      <IgrColumn field="changeP" header="Change %" width="fit-content" dataType="percent" pipeArgs={PERCENT_FORMAT} sortable cellClasses={trends} />
      <IgrColumn field="buy" header="Buy" width="fit-content" dataType="currency" pipeArgs={COLUMN_FORMAT} sortable />
      <IgrColumn field="sell" header="Sell" width="fit-content" dataType="currency" pipeArgs={COLUMN_FORMAT} sortable />
      <IgrColumn field="spread" header="Spread" width="fit-content" pipeArgs={COLUMN_FORMAT} />
      <IgrColumn field="volume" header="Volume" width="fit-content" pipeArgs={COLUMN_FORMAT} sortable />
      <IgrColumn field="highD" header="High (Day)" width="fit-content" dataType="currency" pipeArgs={COLUMN_FORMAT} sortable />
      <IgrColumn field="lowD" header="Low (Day)" width="fit-content" dataType="currency" pipeArgs={COLUMN_FORMAT} sortable />
      <IgrColumn field="highY" header="High (Year)" width="fit-content" dataType="currency" pipeArgs={COLUMN_FORMAT} sortable />
      <IgrColumn field="lowY" header="Low (Year)" width="fit-content" dataType="currency" pipeArgs={COLUMN_FORMAT} sortable />
      <IgrColumn field="startY" header="Start (Year)" width="fit-content" dataType="currency" pipeArgs={COLUMN_FORMAT} sortable />

      <IgrColumn field="indGroup" header="Industry Group" width="fit-content" filterable={false} />
      <IgrColumn field="indSector" header="Industry Sector" width="fit-content" filterable={false} resizable />
      <IgrColumn field="indSubgroup" header="Industry Subgroup" width="fit-content" filterable={false} />
      <IgrColumn field="secType" header="Security Type" width="fit-content" filterable={false} />
      <IgrColumn field="issuerName" header="Issuer" width="fit-content" filterable={false} resizable />
      <IgrColumn field="moodys" header="Moody's" width="fit-content" filterable={false} />
      <IgrColumn field="fitch" header="Fitch" width="fit-content" filterable={false} />
      <IgrColumn field="dbrs" header="DBRS" width="fit-content" filterable={false} />
      <IgrColumn field="collateralType" header="Collateral Type" width="fit-content" filterable={false} />
      <IgrColumn field="currency" header="Currency" width="fit-content" filterable={false} />
      <IgrColumn field="security" header="Security" width="fit-content" filterable={false} />
      <IgrColumn field="sector" header="Sector" width="fit-content" filterable={false} />
      <IgrColumn field="cusip" header="CUSIP" width="fit-content" filterable={false} />
      <IgrColumn field="ticker" header="Ticker" width="fit-content" filterable={false} />
      <IgrColumn field="coupon" header="Coupon" width="fit-content" filterable={false} />
      <IgrColumn field="maturity" header="Maturity" width="fit-content" filterable={false} />
      <IgrColumn field="krd3Yr" header="KRD 3YR" width="fit-content" filterable={false} />
      <IgrColumn field="zSpread" header="Z-Spread" width="fit-content" filterable={false} />
      <IgrColumn field="krd5Yr" header="KRD 5YR" width="fit-content" filterable={false} />
      <IgrColumn field="krd1Yr" header="KRD 1YR" width="fit-content" filterable={false} />
    </IgrGrid>
  );
});

export default FinjsGrid;

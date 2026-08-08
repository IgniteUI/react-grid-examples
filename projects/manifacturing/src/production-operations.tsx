import { useEffect, useRef, useState, lazy, Suspense } from "react";
import {
  IgrGrid,
  IgrColumn,
  IgrPaginator,
  IgrStringFilteringOperand,
  type IgrCellTemplateContext,
  type IgrGridMasterDetailContext,
} from "igniteui-react-grids";
import {
  IgrCard,
  IgrButton,
  IgrInput,
  IgrTabs,
  IgrTab,
  IgrDropdown,
  IgrDropdownItem,
} from "igniteui-react";
import styles from "./production-operations.module.css";
import EquipmentView from "./equipment-view";
import { VibrationChart, ParetoChart, TrendChart } from "./charts";

// Heavy tabs (ApexGantt / DV charts) are code-split so they load on demand.
const ShiftHandoffView = lazy(() => import("./shift-handoff-view"));
const DowntimeView = lazy(() => import("./downtime-view"));
import {
  workOrders,
  kpis,
  detailMetrics,
  sensorStats,
  recentEvents,
  gridSummary,
  STATUS_TONE,
  LINE_OPTIONS,
  STATUS_OPTIONS,
  DUE_OPTIONS,
  type WorkOrder,
} from "./data";

/* ----------------------------- inline icons ----------------------------- */
const SearchIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
    <path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zm10 17-5-5" />
  </svg>
);
const ChevronDown = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
    <path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
  </svg>
);
const ExportIcon = () => (
  <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
    <path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m0-12L8 7m4-4 4 4M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" />
  </svg>
);

const PAGE_TABS = ["Work Orders", "Equipment", "Downtime", "Shift Handoff"];
const numberFmt = (v: unknown) => Number(v).toLocaleString("en-US");

const csvCell = (v: unknown) => {
  const text = String(v ?? "").replace(/"/g, '""');
  return `"${text}"`;
};

/* --------------------------- grid cell templates --------------------------- */
const completedCell = (ctx: IgrCellTemplateContext) => {
  const row = ctx.cell.row.data as WorkOrder;
  const pct = Math.min(100, Math.round((row.completed / row.planned) * 100));
  return (
    <div className={styles.completedCell}>
      <span className={styles.completedValue}>{numberFmt(row.completed)}</span>
      <span className={styles.progressTrack}>
        <span className={styles.progressFill} style={{ width: `${pct}%` }} />
      </span>
    </div>
  );
};

const scrapCell = (ctx: IgrCellTemplateContext) => {
  const scrap = ctx.cell.value as number;
  const high = scrap >= 3;
  return <span className={high ? styles.scrapHigh : styles.scrapNormal}>{scrap.toFixed(1)}%</span>;
};

const statusCell = (ctx: IgrCellTemplateContext) => {
  const label = ctx.cell.value as string;
  const tone = STATUS_TONE[label] ?? "running";
  return (
    <span className={`${styles.statusBadge} ${styles[`tone_${tone}`]}`}>
      <span className={styles.statusDot} />
      {label}
    </span>
  );
};

/* --------------------- master-detail: measurement + pareto --------------------- */
const detailTemplate = (ctx: IgrGridMasterDetailContext) => {
  const row = ctx.implicit as WorkOrder;
  return (
    <div className={styles.detailRow}>
      {/* measurement results */}
      <div className={styles.mdBlock}>
        <div className={styles.mdTitle}>
          Measurement Results <span className={styles.mdDot}>·</span> {row.product}
        </div>
        <table className={styles.mdTable}>
          <thead>
            <tr>
              <th>Characteristic</th>
              <th>Nominal</th>
              <th>Tolerance</th>
              <th>Measured</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {row.detail.measurements.map((m) => (
              <tr key={m.characteristic} className={m.pass ? undefined : styles.mdFailRow}>
                <td className={m.pass ? undefined : styles.mdFailText}>{m.characteristic}</td>
                <td>{m.nominal}</td>
                <td>{m.tolerance}</td>
                <td className={m.pass ? undefined : styles.mdFailText}>{m.measured}</td>
                <td>
                  <span className={m.pass ? styles.mdPass : styles.mdFail}>
                    <span className={styles.statusDot} />
                    {m.pass ? "Pass" : "Fail"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className={styles.mdNote}>
          {row.detail.failed} of {row.detail.sampled} sampled units exceeded specification. Similar
          failures occurred in the prior supplier lot.
        </p>
      </div>

      {/* defect pareto */}
      <div className={styles.mdBlock}>
        <div className={styles.mdTitle}>
          Defect Pareto <span className={styles.mdDot}>·</span> This Lot
        </div>
        <ParetoChart defects={row.detail.defects} />
        <div className={styles.trendBlock}>
          <TrendChart points={row.detail.trend} />
          <span className={styles.trendCaption}>Previous 10 lots</span>
        </div>
      </div>
    </div>
  );
};

/* ----------------------------- filter dropdown ----------------------------- */
function FilterDropdown({
  label,
  value,
  options,
  onSelect,
}: {
  label: string;
  value: string;
  options: string[];
  onSelect: (v: string) => void;
}) {
  return (
    <IgrDropdown
      className={styles.filterDrop}
      sameWidth={false}
      onChange={(e: CustomEvent<{ value?: string }>) => {
        const v = e.detail?.value;
        if (v) onSelect(v);
      }}
    >
      <button type="button" slot="target" className={styles.filter}>
        <span className={styles.filterLabel}>{label}:</span> {value}
        <ChevronDown />
      </button>
      {options.map((opt) => (
        <IgrDropdownItem key={opt} value={opt} selected={opt === value}>
          {opt}
        </IgrDropdownItem>
      ))}
    </IgrDropdown>
  );
}

/* --------------------------------- view --------------------------------- */
export default function ProductionOperations() {
  const gridRef = useRef<IgrGrid>(null);
  const [activeTab, setActiveTab] = useState("Work Orders");
  const [lineFilter, setLineFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [dueFilter, setDueFilter] = useState("All");

  useEffect(() => {
    gridRef.current?.selectRows(["WO-48192"], true);
  }, []);

  // Full-text search using the grid's built-in find/highlight API.
  const onSearch = (raw: unknown) => {
    const grid = gridRef.current;
    if (!grid) return;
    const term = typeof raw === "string" ? raw : "";
    if (term.trim()) {
      grid.findNext(term.trim());
    } else {
      grid.clearSearch();
    }
  };

  const applyFilter = (field: string, value: string) => {
    const grid = gridRef.current;
    if (!grid) return;
    if (value === "All") {
      grid.clearFilter(field);
    } else {
      grid.filter(field, value, IgrStringFilteringOperand.instance().condition("equals"));
    }
  };

  const onExportExcel = () => {
    const headers = [
      "Work Order",
      "Product",
      "Line",
      "Machine",
      "Planned",
      "Completed",
      "Scrap",
      "Cycle",
      "Status",
      "Due",
      "Updated",
    ];
    const lines = workOrders.map((row) =>
      [
        row.workOrder,
        row.product,
        row.line,
        row.machine,
        row.planned,
        row.completed,
        `${row.scrap.toFixed(1)}%`,
        `${row.cycle}s`,
        row.status,
        row.due,
        row.updated,
      ]
        .map(csvCell)
        .join(",")
    );

    const csv = [headers.map(csvCell).join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "WorkOrders.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <div className={`${styles.page} ig-typography`}>
      {/* ============ top bar ============ */}
      <header className={styles.topbar}>
        <div className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true">
            <svg viewBox="0 0 24 24" width="18" height="18">
              <path fill="#fff" d="M12 4 4 19h16z" />
            </svg>
          </span>
          <span className={styles.brandText}>
            <span className={styles.brandTitle}>NORTHSTAR OPERATIONS</span>
            <span className={styles.brandSub}>MANUFACTURING EXECUTION</span>
          </span>
        </div>
        <div className={styles.topbarRight}>
          <button type="button" className={styles.selector}>
            Plant 04 · Columbus <ChevronDown />
          </button>
          <button type="button" className={styles.selector}>
            Shift 2 · 2–10 PM <ChevronDown />
          </button>
          <span className={styles.live}>
            <span className={styles.liveDot} /> LIVE
          </span>
        </div>
      </header>

      {/* ============ content ============ */}
      <main className={styles.content}>
        <div className={styles.pageHead}>
          <div>
            <h1 className={styles.pageTitle}>Production Operations</h1>
            <p className={styles.pageSubtitle}>
              Monitor active work orders, line performance, and production exceptions.
            </p>
          </div>
          <span className={styles.synced}>Last synchronized 3 sec ago</span>
        </div>

        <IgrTabs
          className={styles.tabs}
          onChange={(e: CustomEvent<{ label?: string }>) => setActiveTab(e.detail?.label ?? "Work Orders")}
        >
          {PAGE_TABS.map((t) => (
            <IgrTab key={t} label={t} selected={t === activeTab} />
          ))}
        </IgrTabs>

        {/* ===== Equipment tab ===== */}
        {activeTab === "Equipment" && <EquipmentView />}

        {/* ===== Shift Handoff (ApexGantt + Ignite grid) ===== */}
        {activeTab === "Shift Handoff" && (
          <Suspense fallback={<div className={styles.placeholder}><span className={styles.placeholderText}>Loading shift handoff…</span></div>}>
            <ShiftHandoffView />
          </Suspense>
        )}

        {/* ===== Downtime ===== */}
        {activeTab === "Downtime" && (
          <Suspense fallback={<div className={styles.placeholder}><span className={styles.placeholderText}>Loading downtime…</span></div>}>
            <DowntimeView />
          </Suspense>
        )}

        {/* ===== Work Orders tab (kept mounted to preserve grid state) ===== */}
        <div
          className={styles.woPane}
          style={{ display: activeTab === "Work Orders" ? undefined : "none" }}
        >
        {/* KPI row */}
        <section className={styles.kpiRow} aria-label="Key performance indicators">
          {kpis.map((kpi) => (
            <IgrCard key={kpi.label} className={styles.card}>
              <div className={styles.kpiInner}>
                <div className={styles.kpiTop}>
                  <span className={styles.kpiLabel}>{kpi.label}</span>
                  <span className={`${styles.kpiPill} ${styles[`pill_${kpi.tone}`]}`}>{kpi.delta}</span>
                </div>
                <span className={styles.kpiValue}>{kpi.value}</span>
              </div>
            </IgrCard>
          ))}
        </section>

        {/* main two-column area */}
        <section className={styles.mainArea}>
          {/* orders panel */}
          <IgrCard className={`${styles.card} ${styles.ordersPanel}`}>
            <div className={styles.ordersToolbar}>
              <IgrInput
                className={styles.search}
                placeholder="Search work orders"
                type="search"
                onInput={(e: CustomEvent<string>) => onSearch(e.detail)}
              >
                <span slot="prefix" className={styles.searchIcon}>
                  <SearchIcon />
                </span>
              </IgrInput>
              <FilterDropdown label="Line" value={lineFilter} options={LINE_OPTIONS} onSelect={(v) => { setLineFilter(v); applyFilter("line", v); }} />
              <FilterDropdown label="Status" value={statusFilter} options={STATUS_OPTIONS} onSelect={(v) => { setStatusFilter(v); applyFilter("status", v); }} />
              <FilterDropdown label="Due" value={dueFilter} options={DUE_OPTIONS} onSelect={(v) => { setDueFilter(v); applyFilter("dueWindow", v); }} />
              <span className={styles.toolbarSpacer} />
              <IgrDropdown className={styles.exportDrop} sameWidth={false} onChange={onExportExcel}>
                <IgrButton slot="target" variant="contained" className={styles.exportBtn}>
                  <span slot="prefix" className={styles.exportIcon}>
                    <ExportIcon />
                  </span>
                  Export
                </IgrButton>
                <IgrDropdownItem value="excel">Excel (.xlsx)</IgrDropdownItem>
              </IgrDropdown>
            </div>

            <div className={styles.gridWrap}>
              <IgrGrid
                ref={gridRef}
                className={styles.grid}
                data={workOrders}
                primaryKey="workOrder"
                autoGenerate={false}
                rowSelection="single"
                hideRowSelectors={true}
                allowFiltering={false}
                height="560px"
                detailTemplate={detailTemplate}
              >
                <IgrColumn field="workOrder" header="Work Order" width="118px" />
                <IgrColumn field="product" header="Product" />
                <IgrColumn field="line" header="Line" width="76px" />
                <IgrColumn field="machine" header="Machine" width="80px" />
                <IgrColumn field="planned" header="Planned" width="76px" dataType="number" formatter={numberFmt} />
                <IgrColumn field="completed" header="Completed" bodyTemplate={completedCell} />
                <IgrColumn field="scrap" header="Scrap" width="62px" bodyTemplate={scrapCell} />
                <IgrColumn field="cycle" header="Cycle" width="64px" formatter={(v: unknown) => `${v}s`} />
                <IgrColumn field="status" header="Status" bodyTemplate={statusCell} />
                <IgrColumn field="due" header="Due" width="74px" />
                <IgrColumn field="updated" header="Updated" width="80px" />
                <IgrPaginator perPage={50} selectOptions={[25, 50, 100]} />
              </IgrGrid>
            </div>

            <div className={styles.ordersFooter}>
              <span>
                {numberFmt(gridSummary.total)} work orders
                <span className={styles.footDivider} />
                Planned: {numberFmt(gridSummary.planned)}
                <span className={styles.footDivider} />
                Completed: {numberFmt(gridSummary.completed)}
                <span className={styles.footDivider} />
                Weighted scrap: {gridSummary.weightedScrap}
              </span>
              <span className={styles.footRight}>Expand a row for measurement &amp; defect analysis</span>
            </div>
          </IgrCard>

          {/* detail panel */}
          <IgrCard className={`${styles.card} ${styles.detailPanel}`}>
            <div className={styles.detailBody}>
              <div className={styles.detailHead}>
                <h2 className={styles.detailTitle}>WO-48192</h2>
                <p className={styles.detailSub}>Drive Housing · Line 03 · MC-307</p>
              </div>

              <div className={styles.detailMetrics}>
                {detailMetrics.map((m) => (
                  <div key={m.label} className={styles.metricBox}>
                    <span className={styles.metricLabel}>{m.label}</span>
                    <span className={styles.metricValue}>{m.value}</span>
                  </div>
                ))}
              </div>

              <div className={styles.chartBlock}>
                <div className={styles.chartHead}>
                  <span className={styles.chartTitle}>Spindle vibration · last 30 min</span>
                  <span className={styles.chartValue}>4.2</span>
                </div>
                <VibrationChart />
              </div>

              <div className={styles.sensorRow}>
                {sensorStats.map((s) => (
                  <div key={s.label} className={styles.sensorBox}>
                    <span className={styles.sensorValue}>{s.value}</span>
                    <span className={styles.sensorLabel}>{s.label}</span>
                  </div>
                ))}
              </div>

              <div className={styles.eventsBlock}>
                <span className={styles.sectionLabel}>Recent Events</span>
                <ul className={styles.eventsList}>
                  {recentEvents.map((ev) => (
                    <li key={ev.time} className={styles.eventItem}>
                      <span className={styles.eventTime}>{ev.time}</span>
                      <span className={styles.eventText}>{ev.text}</span>
                      <span className={styles.eventAgo}>{ev.ago}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className={styles.noteBlock}>
                <span className={styles.sectionLabel}>Operator Note</span>
                <div className={styles.noteBox}>
                  Vibration trending upward after tool change. Maintenance notified for post-shift
                  inspection.
                </div>
              </div>
            </div>
          </IgrCard>
        </section>
        </div>
      </main>
    </div>
  );
}

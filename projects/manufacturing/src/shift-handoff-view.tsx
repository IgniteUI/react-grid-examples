import { useRef } from "react";
import ApexGanttChart from "./apex-gantt";
import {
  IgrGrid,
  IgrColumn,
  type IgrCellTemplateContext,
  type IgrGridMasterDetailContext,
} from "igniteui-react-grids";
import { IgrCard } from "igniteui-react";
import styles from "./production-operations.module.css";
import { STATUS_TONE } from "./data";
import {
  handoffTasks,
  buildGanttTasks,
  shiftSummary,
  STATUS_COLOR,
  type HandoffTask,
  type HandoffState,
} from "./ops-extra-data";

const ganttTasks = buildGanttTasks();

const CheckIcon = ({ on }: { on: boolean }) => (
  <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
    {on ? (
      <path fill="none" stroke="#1f9d55" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" d="M20 6 9 17l-5-5" />
    ) : (
      <circle cx="12" cy="12" r="8" fill="none" stroke="#c2c6cf" strokeWidth="2" />
    )}
  </svg>
);

/* ---- grid cell templates ---- */
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

const progressCell = (ctx: IgrCellTemplateContext) => {
  const pct = ctx.cell.value as number;
  return (
    <div className={styles.completedCell}>
      <span className={styles.completedValue}>{pct}%</span>
      <span className={styles.progressTrack}>
        <span className={styles.progressFill} style={{ width: `${pct}%` }} />
      </span>
    </div>
  );
};

const handoffToneClass: Record<HandoffState, string> = {
  Acknowledged: styles.tone_running,
  Ready: styles.tone_setup,
  Pending: styles.tone_hold,
};
const handoffCell = (ctx: IgrCellTemplateContext) => {
  const v = ctx.cell.value as HandoffState;
  return (
    <span className={`${styles.statusBadge} ${handoffToneClass[v]}`}>
      <span className={styles.statusDot} />
      {v}
    </span>
  );
};

const crewCell = (ctx: IgrCellTemplateContext) => {
  const row = ctx.cell.row.data as HandoffTask;
  return (
    <span className={styles.crewCell}>
      {row.outgoing} <span className={styles.crewArrow}>→</span> {row.incoming}
    </span>
  );
};

const detailTemplate = (ctx: IgrGridMasterDetailContext) => {
  const row = ctx.implicit as HandoffTask;
  return (
    <div className={styles.detailRow}>
      <div className={styles.mdBlock}>
        <div className={styles.mdTitle}>Handoff Checklist <span className={styles.mdDot}>·</span> {row.id}</div>
        <ul className={styles.checklist}>
          {row.detail.checklist.map((c) => (
            <li key={c.label} className={styles.checkItem}>
              <CheckIcon on={c.done} />
              <span className={c.done ? styles.checkDone : undefined}>{c.label}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className={styles.mdBlock}>
        <div className={styles.mdTitle}>Notes &amp; Open Issues</div>
        <div className={styles.noteBox}>{row.detail.notes}</div>
        {row.detail.issues.length > 0 ? (
          <ul className={styles.issueList}>
            {row.detail.issues.map((i) => (
              <li key={i} className={styles.issueItem}>
                <span className={styles.issueDot} /> {i}
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.mdNote}>No open issues — clean handoff.</p>
        )}
      </div>
    </div>
  );
};

export default function ShiftHandoffView() {
  const gridRef = useRef<IgrGrid>(null);

  return (
    <div className={styles.woPane}>
      {/* summary cards */}
      <section className={styles.kpiRow} aria-label="Shift summary">
        {[
          { label: "Units Produced", value: shiftSummary.unitsProduced.toLocaleString(), delta: `Scrap ${shiftSummary.scrap}`, tone: "positive" as const },
          { label: "Downtime", value: `${shiftSummary.downtimeMin} min`, delta: "this shift", tone: "warning" as const },
          { label: "To Hand Off", value: `${shiftSummary.toHandoff}`, delta: "crossing shift end", tone: "warning" as const },
          { label: "Unresolved Issues", value: `${shiftSummary.unresolved}`, delta: "need attention", tone: "negative" as const },
        ].map((k) => (
          <IgrCard key={k.label} className={styles.card}>
            <div className={styles.kpiInner}>
              <div className={styles.kpiTop}>
                <span className={styles.kpiLabel}>{k.label}</span>
                <span className={`${styles.kpiPill} ${styles[`pill_${k.tone}`]}`}>{k.delta}</span>
              </div>
              <span className={styles.kpiValue}>{k.value}</span>
            </div>
          </IgrCard>
        ))}
      </section>

      {/* Gantt timeline */}
      <IgrCard className={`${styles.card} ${styles.ganttCard}`}>
        <div className={styles.sectionHead}>
          <div>
            <span className={styles.sectionTitle}>Shift Schedule · 2–10 PM</span>
            <span className={styles.sectionSub}>
              {shiftSummary.outgoingSupervisor} → {shiftSummary.incomingSupervisor} · click a bar to inspect the work order
            </span>
          </div>
          <span className={styles.ganttLegend}>
            {(["running", "setup", "hold", "stopped"] as const).map((t) => (
              <span key={t} className={styles.legendItem}>
                <span className={styles.legendDot} style={{ background: STATUS_COLOR[t] }} />
                {t === "running" ? "Running" : t === "setup" ? "Setup" : t === "hold" ? "Hold" : "Stopped"}
              </span>
            ))}
          </span>
        </div>
        <div className={styles.ganttWrap}>
          <ApexGanttChart
            tasks={ganttTasks}
            height={340}
            options={{ inputDateFormat: "YYYY-MM-DD HH:mm", pixelsPerDay: 1500 }}
            onSelectionChange={(ids) => {
              const id = ids[0];
              if (id) gridRef.current?.selectRows([id], true);
            }}
          />
        </div>
      </IgrCard>

      {/* Handoff grid with master-detail */}
      <IgrCard className={`${styles.card} ${styles.ordersPanel}`}>
        <div className={styles.sectionHead}>
          <span className={styles.sectionTitle}>Work Order Handoff</span>
          <span className={styles.sectionSub}>Expand a row for the handoff checklist &amp; open issues</span>
        </div>
        <IgrGrid
          ref={gridRef}
          className={styles.grid}
          data={handoffTasks}
          primaryKey="id"
          autoGenerate={false}
          rowSelection="single"
          hideRowSelectors={true}
          height="420px"
          detailTemplate={detailTemplate}
        >
          <IgrColumn field="id" header="Work Order" width="120px" />
          <IgrColumn field="line" header="Line" width="80px" />
          <IgrColumn field="machine" header="Machine" width="90px" />
          <IgrColumn field="product" header="Product" />
          <IgrColumn field="status" header="Status" width="130px" bodyTemplate={statusCell} />
          <IgrColumn field="progress" header="Progress" width="120px" bodyTemplate={progressCell} />
          <IgrColumn field="remaining" header="Remaining" width="96px" dataType="number" />
          <IgrColumn field="handoff" header="Handoff" width="140px" bodyTemplate={handoffCell} />
          <IgrColumn field="outgoing" header="Crew (out → in)" bodyTemplate={crewCell} />
        </IgrGrid>
      </IgrCard>
    </div>
  );
}

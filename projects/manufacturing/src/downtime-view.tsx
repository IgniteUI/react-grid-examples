import {
  IgrGrid,
  IgrColumn,
  type IgrCellTemplateContext,
  type IgrGridMasterDetailContext,
} from "igniteui-react-grids";
import { IgrCard } from "igniteui-react";
import styles from "./production-operations.module.css";
import { ParetoComboChart, ColumnChart, AreaTrendChart, MiniTrend } from "./charts";
import { MachineArtImg } from "./equipment-view";
import {
  downtimeKpis,
  downtimeEvents,
  downtimePareto,
  downtimeByLine,
  downtimeTrend,
  downtimeSplit,
  offenders,
  type DowntimeEvent,
  type DowntimeCategory,
} from "./ops-extra-data";

const CATEGORY_TONE: Record<DowntimeCategory, string> = {
  Mechanical: styles.tone_stopped,
  Electrical: styles.tone_setup,
  Material: styles.tone_hold,
  Changeover: styles.tone_running,
  Quality: styles.tone_hold,
};

const categoryCell = (ctx: IgrCellTemplateContext) => {
  const c = ctx.cell.value as DowntimeCategory;
  return <span className={`${styles.statusBadge} ${CATEGORY_TONE[c]}`}><span className={styles.statusDot} />{c}</span>;
};

const statusCell = (ctx: IgrCellTemplateContext) => {
  const v = ctx.cell.value as string;
  const cls = v === "Resolved" ? styles.tone_running : styles.tone_stopped;
  return <span className={`${styles.statusBadge} ${cls}`}><span className={styles.statusDot} />{v}</span>;
};

const durationCell = (ctx: IgrCellTemplateContext) => {
  const m = ctx.cell.value as number;
  return <span className={m >= 40 ? styles.scrapHigh : styles.scrapNormal}>{m} min</span>;
};

const detailTemplate = (ctx: IgrGridMasterDetailContext) => {
  const row = ctx.implicit as DowntimeEvent;
  return (
    <div className={styles.detailRow}>
      <div className={styles.mdBlock}>
        <div className={styles.mdTitle}>Root Cause &amp; Correction <span className={styles.mdDot}>·</span> {row.id}</div>
        <div className={styles.dtDetailGrid}>
          <div><span className={styles.metricLabel}>Root cause</span><p className={styles.dtDetailText}>{row.detail.rootCause}</p></div>
          <div><span className={styles.metricLabel}>Corrective action</span><p className={styles.dtDetailText}>{row.detail.correctiveAction}</p></div>
          <div><span className={styles.metricLabel}>Parts used</span><p className={styles.dtDetailText}>{row.detail.parts}</p></div>
          <div><span className={styles.metricLabel}>Window</span><p className={styles.dtDetailText}>{row.start} – {row.end} · {row.machine}</p></div>
        </div>
      </div>
      <div className={styles.mdBlock}>
        <div className={styles.mdTitle}>Classification</div>
        <div className={styles.sensorRow}>
          <div className={styles.sensorBox}><span className={styles.sensorValue}>{row.durationMin}m</span><span className={styles.sensorLabel}>Duration</span></div>
          <div className={styles.sensorBox}><span className={styles.sensorValue}>{row.category}</span><span className={styles.sensorLabel}>Category</span></div>
          <div className={styles.sensorBox}><span className={styles.sensorValue}>{row.planned ? "Planned" : "Unplanned"}</span><span className={styles.sensorLabel}>Type</span></div>
        </div>
      </div>
    </div>
  );
};

export default function DowntimeView() {
  return (
    <div className={styles.woPane}>
      {/* KPI cards */}
      <section className={styles.kpiRow} aria-label="Downtime KPIs">
        {downtimeKpis.map((k) => (
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

      {/* charts */}
      <section className={styles.dtCharts}>
        <IgrCard className={`${styles.card} ${styles.dtWide}`}>
          <div className={styles.chartCardBody}>
            <span className={styles.sectionTitle}>Downtime Pareto · by reason</span>
            <ParetoComboChart points={downtimePareto} />
          </div>
        </IgrCard>

        <IgrCard className={styles.card}>
          <div className={styles.chartCardBody}>
            <span className={styles.sectionTitle}>Downtime by line</span>
            <ColumnChart data={downtimeByLine} labelPath="line" valuePath="minutes" height="240px" />
          </div>
        </IgrCard>

        <IgrCard className={`${styles.card} ${styles.dtWide}`}>
          <div className={styles.chartCardBody}>
            <span className={styles.sectionTitle}>Downtime trend · last 12 shifts</span>
            <AreaTrendChart data={downtimeTrend} valuePath="minutes" height="200px" />
          </div>
        </IgrCard>

        <IgrCard className={styles.card}>
          <div className={styles.chartCardBody}>
            <span className={styles.sectionTitle}>Planned vs unplanned</span>
            <div className={styles.donutWrap}>
              <div
                className={styles.donut}
                style={{ background: `conic-gradient(var(--ops-violet) 0 ${downtimeSplit.plannedPct}%, #e0556b 0 100%)` }}
              >
                <span className={styles.donutHole}>
                  <b>{downtimeSplit.plannedPct}%</b>
                  <small>planned</small>
                </span>
              </div>
              <div className={styles.donutLegend}>
                <span className={styles.legendItem}><span className={styles.legendDot} style={{ background: "var(--ops-violet)" }} />Planned · {downtimeSplit.planned}m</span>
                <span className={styles.legendItem}><span className={styles.legendDot} style={{ background: "#e0556b" }} />Unplanned · {downtimeSplit.unplanned}m</span>
              </div>
            </div>
          </div>
        </IgrCard>
      </section>

      {/* top offenders */}
      <div>
        <span className={styles.sectionTitle}>Top offenders</span>
        <section className={styles.eqGrid} style={{ marginTop: 12 }} aria-label="Top offending machines">
          {offenders.map((o) => (
            <IgrCard key={o.id} className={`${styles.card} ${styles.eqCard}`}>
              <div className={styles.offMedia}>
                <div className={styles.eqMediaInner}>
                  <MachineArtImg art={o.art} />
                  <img className={styles.eqPhoto} src={`${import.meta.env.BASE_URL}equipment/${o.id.toLowerCase()}.jpg`} alt={`${o.id} ${o.type}`} loading="lazy" onError={(ev) => { ev.currentTarget.style.display = "none"; }} />
                  <span className={styles.eqScrim} />
                  <span className={styles.offMinutes}>{o.downtimeMin}<small>min</small></span>
                </div>
              </div>
              <div className={styles.offBody}>
                <div className={styles.offHead}>
                  <span className={styles.eqTitle}>{o.id} · {o.type}</span>
                  <span className={styles.eqSub}>{o.line} · {o.events} stoppages · top: {o.topReason}</span>
                </div>
                <MiniTrend points={o.trend} />
              </div>
            </IgrCard>
          ))}
        </section>
      </div>

      {/* event log grid */}
      <IgrCard className={`${styles.card} ${styles.ordersPanel}`}>
        <div className={styles.sectionHead}>
          <span className={styles.sectionTitle}>Downtime Event Log</span>
          <span className={styles.sectionSub}>Expand a row for root cause &amp; corrective action</span>
        </div>
        <IgrGrid
          className={styles.grid}
          data={downtimeEvents}
          primaryKey="id"
          autoGenerate={false}
          height="420px"
          detailTemplate={detailTemplate}
        >
          <IgrColumn field="id" header="Event" width="96px" />
          <IgrColumn field="start" header="Start" width="72px" />
          <IgrColumn field="end" header="End" width="72px" />
          <IgrColumn field="durationMin" header="Duration" width="96px" bodyTemplate={durationCell} />
          <IgrColumn field="line" header="Line" width="80px" />
          <IgrColumn field="machine" header="Machine" width="90px" />
          <IgrColumn field="reason" header="Reason" />
          <IgrColumn field="category" header="Category" width="132px" bodyTemplate={categoryCell} />
          <IgrColumn field="operator" header="Operator" width="100px" />
          <IgrColumn field="status" header="Status" width="116px" bodyTemplate={statusCell} />
        </IgrGrid>
      </IgrCard>
    </div>
  );
}

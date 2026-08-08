import { useState, type ReactNode } from "react";
import {
  IgrCard,
  IgrCardMedia,
  IgrCardHeader,
  IgrCardContent,
  IgrCardActions,
  IgrButton,
  IgrDialog,
} from "igniteui-react";
import styles from "./production-operations.module.css";
import { equipment, type Equipment, type MachineArt } from "./data";

/* Themed gradient + line-art glyph used as each equipment card's fallback
 * "product image" (shown until a real photo exists in /public/equipment). */
const ART: Record<MachineArt, { from: string; to: string; glyph: ReactNode }> = {
  cnc: {
    from: "#6d4aff", to: "#4322b8",
    glyph: (
      <g fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <rect x="16" y="20" width="56" height="40" rx="4" opacity="0.9" />
        <path d="M28 20v-6h20v6M44 30v12M36 42h16" />
        <circle cx="44" cy="30" r="4" />
      </g>
    ),
  },
  lathe: {
    from: "#0ea5a5", to: "#0b6e73",
    glyph: (
      <g fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 44h60" />
        <rect x="18" y="30" width="14" height="14" rx="2" />
        <path d="M32 37h30l6 7H32z" opacity="0.9" />
        <circle cx="25" cy="37" r="3" />
      </g>
    ),
  },
  press: {
    from: "#f0983a", to: "#c76512",
    glyph: (
      <g fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M24 16h40M30 16v14h28V16M38 30v10h12V30M32 52h24" />
        <path d="M44 40v12" />
      </g>
    ),
  },
  robot: {
    from: "#2f78d6", to: "#1b4f95",
    glyph: (
      <g fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 56V30l14-8 16 10" />
        <circle cx="22" cy="56" r="4" />
        <circle cx="36" cy="22" r="4" />
        <path d="M52 32l10 4-4 10" />
      </g>
    ),
  },
  furnace: {
    from: "#e0556b", to: "#a11f3c",
    glyph: (
      <g fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <rect x="22" y="18" width="44" height="44" rx="5" opacity="0.9" />
        <path d="M44 30c-5 5-6 10-2 14 1-2 2-3 4-4-1 4 1 7 4 8 4-3 5-9 1-14-1 2-3 3-5 4 1-4 0-8-2-12z" />
      </g>
    ),
  },
  conveyor: {
    from: "#7c5cff", to: "#3a2a9c",
    glyph: (
      <g fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="26" cy="46" r="8" />
        <circle cx="62" cy="46" r="8" />
        <path d="M26 38h36M26 54h36" />
        <rect x="34" y="24" width="12" height="10" rx="2" />
      </g>
    ),
  },
};

const statusToneClass: Record<Equipment["status"], string> = {
  Running: styles.tone_running,
  Idle: styles.tone_hold,
  Maintenance: styles.tone_setup,
};

export function MachineArtImg({ art }: { art: MachineArt }) {
  const a = ART[art];
  const gid = `eqg-${art}`;
  return (
    <svg viewBox="0 0 88 76" className={styles.eqArt} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={a.from} />
          <stop offset="100%" stopColor={a.to} />
        </linearGradient>
      </defs>
      <rect width="88" height="76" fill={`url(#${gid})`} />
      <g transform="translate(0,4)">{a.glyph}</g>
    </svg>
  );
}

function OeeRing({ value, size = 48 }: { value: number; size?: number }) {
  const r = size === 48 ? 15 : 26;
  const c = 2 * Math.PI * r;
  const dash = (value / 100) * c;
  const cx = size / 2;
  return (
    <span className={size === 48 ? styles.eqOee : styles.eqOeeLg} style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className={styles.eqOeeSvg} style={{ width: size, height: size }} aria-hidden="true">
        <circle cx={cx} cy={cx} r={r} className={styles.eqOeeTrack} />
        <circle cx={cx} cy={cx} r={r} className={styles.eqOeeValue} strokeDasharray={`${dash} ${c}`} transform={`rotate(-90 ${cx} ${cx})`} />
      </svg>
      <span className={styles.eqOeeText}>
        <b>{value}</b>
        <small>OEE</small>
      </span>
    </span>
  );
}

function EquipmentMedia({ e, tall = false }: { e: Equipment; tall?: boolean }) {
  return (
    // Single inner wrapper: IgrCardMedia stretches its one slotted child to fill,
    // and we position the photo/art/overlays absolutely inside it.
    <div className={`${styles.eqMediaInner} ${tall ? styles.eqMediaTall : ""}`}>
      <MachineArtImg art={e.art} />
      <img
        className={styles.eqPhoto}
        src={`${import.meta.env.BASE_URL}equipment/${e.id.toLowerCase()}.jpg`}
        alt={`${e.id} ${e.type}`}
        loading="lazy"
        onError={(ev) => { ev.currentTarget.style.display = "none"; }}
      />
      <span className={styles.eqScrim} />
      <span className={`${styles.statusBadge} ${styles.eqStatus} ${statusToneClass[e.status]}`}>
        <span className={styles.statusDot} />
        {e.status}
      </span>
      <OeeRing value={e.oee} size={tall ? 64 : 48} />
    </div>
  );
}

function EquipmentCard({ e, onView }: { e: Equipment; onView: (e: Equipment) => void }) {
  const outputPct = Math.min(100, Math.round((e.output / e.target) * 100));
  return (
    <IgrCard className={`${styles.card} ${styles.eqCard}`}>
      <IgrCardMedia className={styles.eqMedia}>
        <EquipmentMedia e={e} />
      </IgrCardMedia>

      <IgrCardHeader>
        <span slot="title" className={styles.eqTitle}>{e.id} · {e.type}</span>
        <span slot="subtitle" className={styles.eqSub}>{e.line} · Operator {e.operator}</span>
      </IgrCardHeader>

      <IgrCardContent>
        <div className={styles.eqMeters}>
          <div className={styles.eqMeter}>
            <div className={styles.eqMeterTop}><span>Utilization</span><b>{e.utilization}%</b></div>
            <span className={styles.eqBar}><span className={styles.eqBarFill} style={{ width: `${e.utilization}%` }} /></span>
          </div>
          <div className={styles.eqMeter}>
            <div className={styles.eqMeterTop}><span>Output vs target</span><b>{e.output.toLocaleString()} / {e.target.toLocaleString()}</b></div>
            <span className={styles.eqBar}><span className={styles.eqBarFill} style={{ width: `${outputPct}%` }} /></span>
          </div>
        </div>
        <div className={styles.eqStats}>
          <div className={styles.eqStat}><span className={styles.eqStatValue}>{e.temp}°C</span><span className={styles.eqStatLabel}>Spindle temp</span></div>
          <div className={styles.eqStat}><span className={styles.eqStatValue}>{e.nextMaintenance}</span><span className={styles.eqStatLabel}>Next service</span></div>
        </div>
      </IgrCardContent>

      <IgrCardActions>
        <IgrButton variant="outlined" className={styles.eqBtn} onClick={() => onView(e)}>View details</IgrButton>
      </IgrCardActions>
    </IgrCard>
  );
}

export default function EquipmentView() {
  const [selected, setSelected] = useState<Equipment | null>(null);
  const close = () => setSelected(null);

  return (
    <>
      <section className={styles.eqGrid} aria-label="Equipment overview">
        {equipment.map((e) => (
          <EquipmentCard key={e.id} e={e} onView={setSelected} />
        ))}
      </section>

      <IgrDialog
        className={styles.eqDialog}
        open={!!selected}
        hideDefaultAction={true}
        onClosing={close}
        onClosed={close}
      >
        <span slot="title">{selected ? `${selected.id} · ${selected.type}` : ""}</span>
        {selected && (
          <div className={styles.dlgBody}>
            <div className={styles.dlgHero}>
              <EquipmentMedia e={selected} tall />
            </div>

            <div className={styles.dlgMeta}>
              <span>{selected.line} · Operator {selected.operator}</span>
            </div>

            <div className={styles.dlgStats}>
              {[
                { label: "OEE", value: `${selected.oee}%` },
                { label: "Utilization", value: `${selected.utilization}%` },
                { label: "Output today", value: selected.output.toLocaleString() },
                { label: "Target", value: selected.target.toLocaleString() },
                { label: "Spindle temp", value: `${selected.temp}°C` },
                { label: "Next service", value: selected.nextMaintenance },
              ].map((s) => (
                <div key={s.label} className={styles.dlgStat}>
                  <span className={styles.dlgStatLabel}>{s.label}</span>
                  <span className={styles.dlgStatValue}>{s.value}</span>
                </div>
              ))}
            </div>

            <div className={styles.dlgOutput}>
              <div className={styles.eqMeterTop}>
                <span>Output vs target</span>
                <b>{Math.round((selected.output / selected.target) * 100)}%</b>
              </div>
              <span className={styles.eqBar}>
                <span className={styles.eqBarFill} style={{ width: `${Math.min(100, (selected.output / selected.target) * 100)}%` }} />
              </span>
            </div>
          </div>
        )}
        <div slot="footer" className={styles.dlgFooter}>
          <IgrButton variant="flat" onClick={close}>Close</IgrButton>
          <IgrButton variant="contained" className={styles.exportBtn} onClick={close}>Acknowledge</IgrButton>
        </div>
      </IgrDialog>
    </>
  );
}

// Data models for the Shift Handoff and Downtime tabs.
import { STATUS_TONE, type StatusTone } from "./data";

const SHIFT_DATE = "2026-07-20"; // matches the app's "today"

/* mulberry32 deterministic PRNG (same approach as data.ts) */
function makeRng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ======================= SHIFT HANDOFF ======================= */

export const STATUS_COLOR: Record<StatusTone, string> = {
  running: "#1f9d55",
  setup: "#2f78d6",
  hold: "#c98a12",
  stopped: "#d64545",
};

export type HandoffState = "Acknowledged" | "Ready" | "Pending";

export interface HandoffChecklistItem {
  label: string;
  done: boolean;
}

export interface HandoffTask {
  id: string; // work order id
  line: string;
  machine: string;
  product: string;
  status: string; // Running / Setup / ...
  start: string; // "HH:mm"
  end: string; // "HH:mm"
  progress: number; // 0-100
  remaining: number;
  handoff: HandoffState;
  outgoing: string;
  incoming: string;
  crossesShift: boolean;
  detail: {
    notes: string;
    checklist: HandoffChecklistItem[];
    issues: string[];
  };
}

const OUTGOING = ["A. Reyes", "J. Okafor", "M. Chen", "S. Patel", "T. Novak", "L. Braun"];
const INCOMING = ["R. Silva", "K. Ito", "D. Meyer", "P. Hale", "N. Fischer", "G. Adler"];
const PRODUCTS = ["Drive Housing", "Pump Rotor", "Valve Body", "Gear Set A", "Compressor Ring", "Shaft Collar", "Seal Plate", "Fan Hub"];
const STATUSES = ["Running", "Running", "Setup", "Quality Hold", "Material Hold", "Stopped"];

function hhmm(h: number, m: number) {
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

function buildHandoff(): HandoffTask[] {
  const rng = makeRng(70720);
  const rows: HandoffTask[] = [];
  let woId = 48230;
  for (let li = 1; li <= 6; li++) {
    const line = `Line 0${li}`;
    const count = 1 + Math.floor(rng() * 2); // 1-2 WOs per line
    let cursor = 14 * 60 + Math.floor(rng() * 40); // minutes from midnight, start ~14:00
    for (let k = 0; k < count; k++) {
      const dur = 120 + Math.floor(rng() * 220); // 2h - ~6h
      const startMin = cursor;
      const endMin = Math.min(22 * 60, startMin + dur);
      cursor = endMin + 10 + Math.floor(rng() * 20);
      const status = STATUSES[Math.floor(rng() * STATUSES.length)];
      const progress = status === "Setup" ? 5 + Math.floor(rng() * 20) : 30 + Math.floor(rng() * 65);
      const crosses = endMin >= 22 * 60;
      const handoff: HandoffState = crosses ? (rng() > 0.5 ? "Pending" : "Ready") : rng() > 0.6 ? "Acknowledged" : "Ready";
      rows.push({
        id: `WO-${woId++}`,
        line,
        machine: `MC-${100 + Math.floor(rng() * 800)}`,
        product: PRODUCTS[Math.floor(rng() * PRODUCTS.length)],
        status,
        start: hhmm(Math.floor(startMin / 60), startMin % 60),
        end: hhmm(Math.floor(endMin / 60), endMin % 60),
        progress,
        remaining: 40 + Math.floor(rng() * 900),
        handoff,
        outgoing: OUTGOING[li - 1],
        incoming: INCOMING[li - 1],
        crossesShift: crosses,
        detail: {
          notes:
            status === "Stopped"
              ? "Line stopped pending maintenance callout. Do not restart until inspection is signed off."
              : crosses
              ? "In progress at shift end — continue run, verify first-off part on resume."
              : "Run completing this shift. Stage next changeover kit for incoming crew.",
          checklist: [
            { label: "Quality sign-off on last lot", done: rng() > 0.4 },
            { label: "Tooling / consumables staged", done: rng() > 0.5 },
            { label: "Open alarms cleared", done: status !== "Stopped" && rng() > 0.3 },
            { label: "Handoff notes reviewed with incoming", done: handoff === "Acknowledged" },
          ],
          issues:
            status === "Quality Hold"
              ? ["Dimensional drift on OD — awaiting QA disposition"]
              : status === "Material Hold"
              ? ["Raw stock shortage — replenishment ETA next shift"]
              : status === "Stopped"
              ? ["Spindle fault code E-207", "Maintenance ticket #4821 open"]
              : [],
        },
      });
    }
  }
  return rows;
}

export const handoffTasks: HandoffTask[] = buildHandoff();

/** ApexGantt task input derived from handoff rows (grouped by line). */
export interface GanttTaskInput {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  progress?: number;
  parentId?: string;
  barBackgroundColor?: string;
  showSummaryBar?: boolean;
}

export function buildGanttTasks(): GanttTaskInput[] {
  const lines = Array.from(new Set(handoffTasks.map((t) => t.line)));
  const groups: GanttTaskInput[] = lines.map((line) => ({
    id: line,
    name: line,
    startTime: `${SHIFT_DATE} 14:00`,
    endTime: `${SHIFT_DATE} 22:00`,
    showSummaryBar: true,
  }));
  const tasks: GanttTaskInput[] = handoffTasks.map((t) => ({
    id: t.id,
    name: `${t.id} · ${t.product}`,
    startTime: `${SHIFT_DATE} ${t.start}`,
    endTime: `${SHIFT_DATE} ${t.end}`,
    progress: t.progress,
    parentId: t.line,
    barBackgroundColor: STATUS_COLOR[STATUS_TONE[t.status] ?? "running"],
  }));
  return [...groups, ...tasks];
}

export const shiftSummary = {
  unitsProduced: 12846,
  scrap: "2.1%",
  downtimeMin: 74,
  toHandoff: handoffTasks.filter((t) => t.crossesShift).length,
  unresolved: handoffTasks.reduce((s, t) => s + t.detail.issues.length, 0),
  outgoingSupervisor: "M. Delgado",
  incomingSupervisor: "H. Vance",
};

/* ======================= DOWNTIME ======================= */

export type DowntimeCategory = "Mechanical" | "Electrical" | "Material" | "Changeover" | "Quality";

export interface DowntimeEvent {
  id: string;
  start: string;
  end: string;
  durationMin: number;
  line: string;
  machine: string;
  reason: string;
  category: DowntimeCategory;
  operator: string;
  status: "Open" | "Resolved";
  planned: boolean;
  detail: {
    rootCause: string;
    correctiveAction: string;
    parts: string;
  };
}

const REASONS: Array<{ reason: string; category: DowntimeCategory; planned: boolean }> = [
  { reason: "Tool change", category: "Changeover", planned: true },
  { reason: "Material shortage", category: "Material", planned: false },
  { reason: "Part feed jam", category: "Mechanical", planned: false },
  { reason: "Sensor fault", category: "Electrical", planned: false },
  { reason: "Changeover", category: "Changeover", planned: true },
  { reason: "Quality check", category: "Quality", planned: true },
  { reason: "Power dip", category: "Electrical", planned: false },
  { reason: "Spindle fault", category: "Mechanical", planned: false },
];

function buildDowntimeEvents(): DowntimeEvent[] {
  const rng = makeRng(31415);
  const rows: DowntimeEvent[] = [];
  for (let i = 0; i < 22; i++) {
    const r = REASONS[Math.floor(rng() * REASONS.length)];
    const dur = 6 + Math.floor(rng() * 55);
    const startMin = 14 * 60 + Math.floor(rng() * 420);
    const endMin = startMin + dur;
    rows.push({
      id: `DT-${5100 + i}`,
      start: hhmm(Math.floor(startMin / 60) % 24, startMin % 60),
      end: hhmm(Math.floor(endMin / 60) % 24, endMin % 60),
      durationMin: dur,
      line: `Line 0${1 + Math.floor(rng() * 8)}`,
      machine: `MC-${100 + Math.floor(rng() * 800)}`,
      reason: r.reason,
      category: r.category,
      operator: OUTGOING[Math.floor(rng() * OUTGOING.length)],
      status: rng() > 0.55 ? "Resolved" : "Open",
      planned: r.planned,
      detail: {
        rootCause:
          r.category === "Mechanical"
            ? "Worn component exceeded wear limit; vibration signature confirmed."
            : r.category === "Material"
            ? "Upstream buffer depleted; replenishment lagged demand."
            : r.category === "Electrical"
            ? "Intermittent sensor signal traced to loose connector."
            : "Scheduled activity per standard work.",
        correctiveAction: "Component replaced / reset; verified first-off part within spec.",
        parts: r.category === "Mechanical" ? "Bearing kit, seal" : r.category === "Electrical" ? "Proximity sensor" : "—",
      },
    });
  }
  return rows;
}

export const downtimeEvents: DowntimeEvent[] = buildDowntimeEvents();

/** Pareto of downtime minutes by reason (desc) with cumulative %. */
export interface ParetoPoint {
  reason: string;
  minutes: number;
  cumulative: number;
}
export function buildDowntimePareto(): ParetoPoint[] {
  const byReason = new Map<string, number>();
  downtimeEvents.forEach((e) => byReason.set(e.reason, (byReason.get(e.reason) ?? 0) + e.durationMin));
  const sorted = [...byReason.entries()].sort((a, b) => b[1] - a[1]);
  const total = sorted.reduce((s, [, m]) => s + m, 0);
  let run = 0;
  return sorted.map(([reason, minutes]) => {
    run += minutes;
    return { reason, minutes, cumulative: Math.round((run / total) * 100) };
  });
}
export const downtimePareto = buildDowntimePareto();

/** Downtime minutes by line. */
export interface LineMinutes {
  line: string;
  minutes: number;
}
export function buildDowntimeByLine(): LineMinutes[] {
  const byLine = new Map<string, number>();
  downtimeEvents.forEach((e) => byLine.set(e.line, (byLine.get(e.line) ?? 0) + e.durationMin));
  return [...byLine.entries()].map(([line, minutes]) => ({ line, minutes })).sort((a, b) => a.line.localeCompare(b.line));
}
export const downtimeByLine = buildDowntimeByLine();

/** Downtime minutes per shift over the last 12 shifts. */
export function buildDowntimeTrend(): Array<{ label: string; minutes: number }> {
  const rng = makeRng(2718);
  return Array.from({ length: 12 }, (_, i) => ({ label: `S${i + 1}`, minutes: 40 + Math.round(rng() * 90) }));
}
export const downtimeTrend = buildDowntimeTrend();

/** Category split for the planned/unplanned donut. */
export const downtimeSplit = (() => {
  const planned = downtimeEvents.filter((e) => e.planned).reduce((s, e) => s + e.durationMin, 0);
  const unplanned = downtimeEvents.filter((e) => !e.planned).reduce((s, e) => s + e.durationMin, 0);
  const total = planned + unplanned || 1;
  return { planned, unplanned, plannedPct: Math.round((planned / total) * 100) };
})();

/** Top-offender machine cards (reuse equipment art keys). */
export interface Offender {
  id: string;
  type: string;
  line: string;
  art: "cnc" | "lathe" | "press" | "robot" | "furnace" | "conveyor";
  downtimeMin: number;
  events: number;
  topReason: string;
  trend: number[];
}
export const offenders: Offender[] = [
  { id: "MC-115", type: "Heat Furnace", line: "Line 01", art: "furnace", downtimeMin: 118, events: 5, topReason: "Sensor fault", trend: [12, 18, 15, 22, 19, 26, 24, 31] },
  { id: "MC-714", type: "Turning Lathe", line: "Line 07", art: "lathe", downtimeMin: 96, events: 4, topReason: "Material shortage", trend: [20, 16, 22, 18, 24, 21, 25, 23] },
  { id: "MC-304", type: "Injection Press", line: "Line 03", art: "press", downtimeMin: 84, events: 6, topReason: "Changeover", trend: [10, 14, 12, 16, 15, 18, 17, 20] },
  { id: "MC-503", type: "Robotic Cell", line: "Line 05", art: "robot", downtimeMin: 61, events: 3, topReason: "Spindle fault", trend: [8, 12, 10, 14, 11, 16, 13, 15] },
];

const totalDowntime = downtimeEvents.reduce((s, e) => s + e.durationMin, 0);
export const downtimeKpis = [
  { label: "Total Downtime", value: `${totalDowntime} min`, delta: "-8% vs last shift", tone: "positive" as const },
  { label: "Stoppages", value: `${downtimeEvents.length}`, delta: `${downtimeEvents.filter((e) => e.status === "Open").length} open`, tone: "warning" as const },
  { label: "MTTR", value: `${Math.round(totalDowntime / downtimeEvents.length)} min`, delta: "mean time to repair", tone: "warning" as const },
  { label: "Availability", value: "91.4%", delta: "+1.2 pts", tone: "positive" as const },
];

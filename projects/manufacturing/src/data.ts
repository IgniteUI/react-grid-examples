// Domain types and mock data for the Production Operations dashboard.

/** Visual tone used to color status badges. */
export type StatusTone = "running" | "hold" | "setup" | "stopped";

/** Status label -> badge tone. `status` is stored as a plain string so the
 *  grid's built-in string filtering works directly on the column. */
export const STATUS_TONE: Record<string, StatusTone> = {
  Running: "running",
  Setup: "setup",
  "Quality Hold": "hold",
  "Material Hold": "hold",
  Stopped: "stopped",
};

export interface Measurement {
  characteristic: string;
  nominal: string;
  tolerance: string;
  measured: string;
  pass: boolean;
}

export interface Defect {
  label: string;
  count: number;
}

export interface WorkOrderDetail {
  measurements: Measurement[];
  defects: Defect[];
  trend: number[]; // "previous 10 lots" mini trend
  sampled: number;
  failed: number;
}

export interface WorkOrder {
  workOrder: string;
  product: string;
  line: string;
  machine: string;
  planned: number;
  completed: number;
  scrap: number; // percentage, e.g. 1.4 => 1.4%
  cycle: number; // seconds
  status: string;
  due: string;
  dueWindow: string; // filter bucket
  updated: string;
  detail: WorkOrderDetail;
}

/* ----------------------- deterministic PRNG (mulberry32) ----------------------- */
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

const PRODUCTS = [
  "Drive Housing", "Pump Rotor", "Valve Body", "Gear Set A", "Compressor Ring",
  "Shaft Collar", "Seal Plate", "Fan Hub", "Motor Bracket", "Impeller 6in",
  "Bearing Cap", "Coupling Flange", "Idler Pulley", "Thrust Washer", "Cam Follower",
];
const STATUSES = ["Running", "Setup", "Quality Hold", "Material Hold", "Stopped"];
const STATUS_WEIGHTS = [0.55, 0.12, 0.12, 0.11, 0.1];
const DUE_WINDOWS = ["This shift", "Next shift", "Overdue"];
const DEFECT_LABELS = ["Shaft runout", "Surface finish", "Burr / edge", "Diameter"];

const pick = <T,>(rng: () => number, arr: T[]) => arr[Math.floor(rng() * arr.length)];
const weighted = (rng: () => number, arr: string[], weights: number[]) => {
  let r = rng();
  for (let i = 0; i < arr.length; i++) {
    if ((r -= weights[i]) <= 0) return arr[i];
  }
  return arr[arr.length - 1];
};

function buildDetail(rng: () => number, scrap: number, failing: boolean): WorkOrderDetail {
  const runoutMeasured = failing ? 0.03 + rng() * 0.03 : rng() * 0.028;
  const finishMeasured = failing ? 1.6 + rng() * 0.7 : 1.2 + rng() * 0.35;
  const odMeasured = 42 + (rng() - 0.5) * 0.04;
  const keyMeasured = 6 + (rng() - 0.5) * 0.03;

  const measurements: Measurement[] = [
    { characteristic: "Outer diameter", nominal: "42.000 mm", tolerance: "±0.025", measured: odMeasured.toFixed(3), pass: Math.abs(odMeasured - 42) <= 0.025 },
    { characteristic: "Shaft runout", nominal: "0.000 mm", tolerance: "≤0.030", measured: runoutMeasured.toFixed(3), pass: runoutMeasured <= 0.03 },
    { characteristic: "Keyway width", nominal: "6.000 mm", tolerance: "±0.020", measured: keyMeasured.toFixed(3), pass: Math.abs(keyMeasured - 6) <= 0.02 },
    { characteristic: "Surface finish", nominal: "1.60 Ra", tolerance: "≤1.60", measured: finishMeasured.toFixed(2), pass: finishMeasured <= 1.6 },
  ];

  const defects: Defect[] = DEFECT_LABELS
    .map((label, i) => ({ label, count: Math.max(0, Math.round((4 - i) * (0.6 + scrap / 5) * (0.7 + rng() * 0.6))) }))
    .sort((a, b) => b.count - a.count);

  const trend: number[] = [];
  let v = 1.4 + rng() * 0.6;
  for (let i = 0; i < 11; i++) {
    v += (rng() - 0.45) * 0.35;
    trend.push(Math.max(0.6, v));
  }

  const failed = measurements.filter((m) => !m.pass).length + Math.round(scrap / 1.5);
  return { measurements, defects, trend, sampled: 20, failed: Math.min(20, Math.max(1, failed)) };
}

function buildRow(rng: () => number, id: number): WorkOrder {
  const product = pick(rng, PRODUCTS);
  const planned = 400 + Math.floor(rng() * 1600);
  const completed = Math.floor(planned * (0.1 + rng() * 0.85));
  const status = weighted(rng, STATUSES, STATUS_WEIGHTS);
  const scrap = Math.round((0.3 + rng() * 4.7) * 10) / 10;
  const cycle = Math.round((20 + rng() * 40) * 10) / 10;
  const failing = scrap >= 3 || status === "Quality Hold" || status === "Stopped";
  const hour = 3 + Math.floor(rng() * 6);
  const minute = Math.floor(rng() * 12) * 5;
  const updatedSec = Math.floor(rng() * 59) + 1;
  const updated = rng() > 0.7 ? `${Math.floor(rng() * 9) + 1} min` : `${updatedSec} sec`;

  return {
    workOrder: `WO-${45000 + id}`,
    product,
    line: `Line 0${1 + Math.floor(rng() * 8)}`,
    machine: `MC-${100 + Math.floor(rng() * 800)}`,
    planned,
    completed,
    scrap,
    cycle,
    status,
    due: `${hour}:${minute.toString().padStart(2, "0")} PM`,
    dueWindow: weighted(rng, DUE_WINDOWS, [0.5, 0.35, 0.15]),
    updated,
    detail: buildDetail(rng, scrap, failing),
  };
}

/* Curated top rows so the header of the grid mirrors the reference design and
 * the preselected/detail-linked WO-48192 stays consistent. */
const CURATED: Array<Partial<WorkOrder> & { workOrder: string; product: string; line: string; machine: string; planned: number; completed: number; scrap: number; cycle: number; status: string; due: string; dueWindow: string; updated: string }> = [
  { workOrder: "WO-48192", product: "Drive Housing", line: "Line 03", machine: "MC-307", planned: 1200, completed: 908, scrap: 1.4, cycle: 41.8, status: "Running", due: "5:20 PM", dueWindow: "This shift", updated: "3 sec" },
  { workOrder: "WO-48201", product: "Pump Rotor", line: "Line 07", machine: "MC-714", planned: 640, completed: 332, scrap: 4.8, cycle: 36.1, status: "Quality Hold", due: "4:45 PM", dueWindow: "Overdue", updated: "12 sec" },
  { workOrder: "WO-48176", product: "Valve Body", line: "Line 02", machine: "MC-221", planned: 900, completed: 814, scrap: 1.1, cycle: 32.4, status: "Running", due: "4:10 PM", dueWindow: "This shift", updated: "5 sec" },
  { workOrder: "WO-48211", product: "Gear Set A", line: "Line 05", machine: "MC-503", planned: 480, completed: 105, scrap: 0.8, cycle: 58.2, status: "Setup", due: "7:30 PM", dueWindow: "Next shift", updated: "1 min" },
  { workOrder: "WO-48188", product: "Compressor Ring", line: "Line 01", machine: "MC-115", planned: 1800, completed: 1092, scrap: 3.9, cycle: 22.7, status: "Stopped", due: "5:05 PM", dueWindow: "This shift", updated: "23 sec" },
  { workOrder: "WO-48195", product: "Shaft Collar", line: "Line 06", machine: "MC-612", planned: 725, completed: 510, scrap: 1.7, cycle: 44.9, status: "Running", due: "5:55 PM", dueWindow: "This shift", updated: "7 sec" },
  { workOrder: "WO-48159", product: "Seal Plate", line: "Line 04", machine: "MC-409", planned: 1100, completed: 1044, scrap: 0.6, cycle: 28.5, status: "Running", due: "3:55 PM", dueWindow: "Overdue", updated: "4 sec" },
  { workOrder: "WO-48217", product: "Fan Hub", line: "Line 08", machine: "MC-803", planned: 550, completed: 92, scrap: 1.0, cycle: 51.3, status: "Setup", due: "8:15 PM", dueWindow: "Next shift", updated: "2 min" },
  { workOrder: "WO-48183", product: "Motor Bracket", line: "Line 03", machine: "MC-304", planned: 850, completed: 602, scrap: 3.2, cycle: 39.6, status: "Material Hold", due: "5:40 PM", dueWindow: "This shift", updated: "36 sec" },
  { workOrder: "WO-48191", product: "Impeller 6in", line: "Line 07", machine: "MC-711", planned: 760, completed: 588, scrap: 1.9, cycle: 34.2, status: "Running", due: "5:15 PM", dueWindow: "This shift", updated: "8 sec" },
];

function buildAll(): WorkOrder[] {
  const rng = makeRng(20260720);
  const rows: WorkOrder[] = CURATED.map((c) => ({
    ...c,
    detail: buildDetail(rng, c.scrap, c.scrap >= 3 || c.status === "Quality Hold" || c.status === "Stopped"),
  }));
  for (let i = 0; rows.length < 500; i++) {
    rows.push(buildRow(rng, i));
  }
  return rows;
}

export const workOrders: WorkOrder[] = buildAll();

/* ----------------------- filter option lists ----------------------- */
export const LINE_OPTIONS = ["All", "Line 01", "Line 02", "Line 03", "Line 04", "Line 05", "Line 06", "Line 07", "Line 08"];
export const STATUS_OPTIONS = ["All", "Running", "Setup", "Quality Hold", "Material Hold", "Stopped"];
export const DUE_OPTIONS = ["All", "This shift", "Next shift", "Overdue"];

/* ----------------------- equipment (Equipment tab) ----------------------- */
export type EquipmentStatus = "Running" | "Idle" | "Maintenance";
export type MachineArt = "cnc" | "lathe" | "press" | "robot" | "furnace" | "conveyor";

export interface Equipment {
  id: string;
  type: string;
  line: string;
  operator: string;
  status: EquipmentStatus;
  oee: number; // %
  utilization: number; // %
  output: number; // units today
  target: number; // units target
  temp: number; // °C
  nextMaintenance: string;
  art: MachineArt;
}

export const equipment: Equipment[] = [
  { id: "MC-307", type: "CNC Mill", line: "Line 03", operator: "A. Reyes", status: "Running", oee: 86, utilization: 92, output: 908, target: 1200, temp: 78, nextMaintenance: "in 3 days", art: "cnc" },
  { id: "MC-714", type: "Turning Lathe", line: "Line 07", operator: "J. Okafor", status: "Maintenance", oee: 61, utilization: 44, output: 332, target: 640, temp: 69, nextMaintenance: "in progress", art: "lathe" },
  { id: "MC-221", type: "Stamping Press", line: "Line 02", operator: "M. Chen", status: "Running", oee: 91, utilization: 95, output: 814, target: 900, temp: 74, nextMaintenance: "in 8 days", art: "press" },
  { id: "MC-503", type: "Robotic Cell", line: "Line 05", operator: "S. Patel", status: "Idle", oee: 72, utilization: 38, output: 105, target: 480, temp: 58, nextMaintenance: "in 5 days", art: "robot" },
  { id: "MC-115", type: "Heat Furnace", line: "Line 01", operator: "T. Novak", status: "Running", oee: 68, utilization: 81, output: 1092, target: 1800, temp: 214, nextMaintenance: "in 2 days", art: "furnace" },
  { id: "MC-612", type: "Surface Grinder", line: "Line 06", operator: "L. Braun", status: "Running", oee: 84, utilization: 88, output: 510, target: 725, temp: 71, nextMaintenance: "in 11 days", art: "cnc" },
  { id: "MC-409", type: "Conveyor Line", line: "Line 04", operator: "R. Silva", status: "Running", oee: 95, utilization: 97, output: 1044, target: 1100, temp: 42, nextMaintenance: "in 14 days", art: "conveyor" },
  { id: "MC-803", type: "Robotic Welder", line: "Line 08", operator: "K. Ito", status: "Idle", oee: 70, utilization: 33, output: 92, target: 550, temp: 63, nextMaintenance: "in 6 days", art: "robot" },
  { id: "MC-304", type: "Injection Press", line: "Line 03", operator: "D. Meyer", status: "Maintenance", oee: 64, utilization: 51, output: 602, target: 850, temp: 88, nextMaintenance: "in progress", art: "press" },
];

/* ----------------------- KPI + detail-panel data ----------------------- */
export interface Kpi {
  label: string;
  value: string;
  delta: string;
  tone: "positive" | "warning" | "negative";
}

export const kpis: Kpi[] = [
  { label: "Active Work Orders", value: "28", delta: "+4 this shift", tone: "positive" },
  { label: "At Risk", value: "5", delta: "2 need action", tone: "warning" },
  { label: "Units Completed", value: "12,846", delta: "94% plan", tone: "positive" },
  { label: "Scrap Rate", value: "2.1%", delta: "+0.4 pts", tone: "negative" },
];

export const detailMetrics = [
  { label: "Progress", value: "75.7%" },
  { label: "OEE", value: "86.4%" },
  { label: "Target Cycle", value: "40.0 sec" },
  { label: "Actual Cycle", value: "41.8 sec" },
];

export const sensorStats = [
  { value: "78°C", label: "Temperature" },
  { value: "4.2", label: "Vibration" },
  { value: "92%", label: "Load" },
];

export const vibrationSeries: number[] = [
  2.6, 2.7, 2.6, 2.8, 2.7, 2.9, 2.8, 3.0, 3.1, 3.0, 3.2, 3.3, 3.2, 3.4, 3.5,
  3.4, 3.6, 3.5, 3.7, 3.6, 3.8, 3.9, 3.8, 4.0, 3.9, 4.05, 4.0, 4.1, 4.15, 4.2,
];
export const vibrationTarget = 3.6;

export interface OpsEvent {
  time: string;
  text: string;
  ago: string;
}
export const recentEvents: OpsEvent[] = [
  { time: "3:31 PM", text: "Part feed jam", ago: "4m" },
  { time: "2:54 PM", text: "Cycle time above target", ago: "11m" },
  { time: "2:12 PM", text: "Changeover completed", ago: "18m" },
];

/** Footer summary aggregated across the full 500-row data set. */
export const gridSummary = {
  total: workOrders.length,
  planned: workOrders.reduce((s, w) => s + w.planned, 0),
  completed: workOrders.reduce((s, w) => s + w.completed, 0),
  weightedScrap:
    (
      workOrders.reduce((s, w) => s + w.scrap * w.planned, 0) /
      workOrders.reduce((s, w) => s + w.planned, 0)
    ).toFixed(1) + "%",
};

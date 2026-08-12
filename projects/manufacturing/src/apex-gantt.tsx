import { useEffect, useRef } from "react";
import ApexGantt from "apexgantt";
import type { GanttUserOptions, TaskInput } from "apexgantt";

/**
 * Thin React wrapper around the core `apexgantt` class.
 * (We bypass the official `react-apexgantt` wrapper because its 1.1.0 build
 * re-exports a `ViewMode` symbol that isn't present in the current apexgantt ESM
 * bundle, which breaks the Rolldown/Vite production build.)
 */
interface ApexGanttChartProps {
  tasks: TaskInput[];
  height?: number | string;
  options?: Omit<GanttUserOptions, "series">;
  onSelectionChange?: (selectedIds: string[]) => void;
}

export default function ApexGanttChart({ tasks, height = 340, options, onSelectionChange }: ApexGanttChartProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const selRef = useRef(onSelectionChange);
  selRef.current = onSelectionChange;
  const optsRef = useRef(options);
  optsRef.current = options;

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const gantt = new ApexGantt(el, { ...(optsRef.current as object), height, series: tasks } as GanttUserOptions);
    gantt.render();

    const handler = (e: Event) => {
      const ids = (e as CustomEvent<{ selectedIds?: string[] }>).detail?.selectedIds ?? [];
      selRef.current?.(ids);
    };
    el.addEventListener("selectionChange", handler as EventListener);

    return () => {
      el.removeEventListener("selectionChange", handler as EventListener);
      gantt.destroy();
    };
    // tasks/height are stable for a given mount; options & handler read via refs.
  }, [tasks, height]);

  return <div ref={hostRef} />;
}

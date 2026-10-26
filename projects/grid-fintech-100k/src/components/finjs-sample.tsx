import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { IgrGrid } from "igniteui-react-grids";
import { FinjsViewContext, type FinjsSize, type FinjsViewState } from "../finjs-view-context";
import { registerFinjsIcons } from "../services/finjs-icons";
import FinjsGrid from "./finjs-grid";

const DEFAULT_SIZE: FinjsSize = "medium";

/**
 * The sample's root: it owns the density and the light/dark appearance, which
 * are classes on its root element. The styles key every colour and the grid's
 * row height off those classes.
 */
export default function FinjsSample() {
  const [size, setSize] = useState<FinjsSize>(DEFAULT_SIZE);
  const [isDark, setIsDark] = useState(false);
  const gridRef = useRef<IgrGrid>(null);
  const appliedSize = useRef<FinjsSize>(DEFAULT_SIZE);

  // Before the first paint, so the icons never show empty.
  useLayoutEffect(() => {
    registerFinjsIcons();
  }, []);

  // Row height derives from --ig-size, and at this row count the grid is fully
  // virtualized: it caches the height it measured and keeps scrolling against
  // the old one until told otherwise. The first run is skipped because the grid
  // measures itself on init and cannot reflow before that.
  useEffect(() => {
    if (size === appliedSize.current) return;

    appliedSize.current = size;
    gridRef.current?.reflow();
  }, [size]);

  const view = useMemo<FinjsViewState>(
    () => ({ size, isDark, setSize, toggleTheme: () => setIsDark((dark) => !dark) }),
    [size, isDark]
  );

  const classes = ["grid-fintech-100k", size === DEFAULT_SIZE ? "" : `finjs-size-${size}`, isDark ? "dark-theme" : ""].filter(Boolean).join(" ");

  return (
    <FinjsViewContext.Provider value={view}>
      <div className={classes}>
        <div className="finjs-grid-wrapper">
          <FinjsGrid gridRef={gridRef} />
        </div>
      </div>
    </FinjsViewContext.Provider>
  );
}

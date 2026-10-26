import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { IgrButton, IgrDialog, IgrIcon } from "igniteui-react";
import {
  IgrDockManager,
  type IgrDockManagerLayout,
  type IgrPaneCloseEventArgs,
} from "igniteui-react-dockmanager";
import AlertsPanel from "../alerts-panel/alerts-panel";
import Blotter from "../blotter/blotter";
import ChartPanel from "../chart-panel/chart-panel";
import NewsPanel from "../news-panel/news-panel";
import OrderTicket from "../order-ticket/order-ticket";
import PositionsGrid from "../positions-grid/positions-grid";
import { useDesk } from "../services/desk";
import { chartContentId, isFixedPaneId } from "../util/dock-layout";
import { ICONS } from "../util/icons";
import { useMediaQuery } from "../util/use-media-query";
import { useStore } from "../util/use-store";
import Watchlist from "../watchlist/watchlist";
import CommandBar from "./command-bar";
import PaneRail from "./pane-rail";

/** The drawer's own pin threshold: narrower than this, the rail floats over the desk. */
const RAIL_PIN_QUERY = "(min-width: 1024px)";

/** The Dock Manager's `layoutChange` event, whose type the React package does not export. */
type LayoutChangeEvent = CustomEvent<{ layout: IgrDockManagerLayout }>;

/**
 * Signal Desk — the sample's application shell.
 *
 * The shell owns no trading state: it wires the Dock Manager to the workspace
 * service, mounts one component per pane, and hosts the two dialogs.
 */
export default function DeskShell() {
  const desk = useDesk();
  const { workspace, notifications } = desk;

  const hostRef = useRef<HTMLDivElement>(null);
  const dockRef = useRef<IgrDockManager>(null);
  const resetDialogRef = useRef<IgrDialog>(null);
  const alertsDialogRef = useRef<IgrDialog>(null);

  const isDark = useStore(workspace, (state) => state.theme === "dark");
  const layout = useStore(workspace, (state) => state.layout);
  const chartSymbols = useStore(workspace, (state) => state.chartSymbols);
  const railPinned = useMediaQuery(RAIL_PIN_QUERY);

  /** Expanded state of the rail; it stays pinned either way on a wide screen. */
  const [navExpanded, setNavExpanded] = useState(false);
  const toggleNav = useCallback(() => setNavExpanded((open) => !open), []);
  const dismissNav = useCallback(() => setNavExpanded(false), []);

  // The shipped default arrangement is sized against the real viewport once.
  useLayoutEffect(() => {
    const rect = hostRef.current?.getBoundingClientRect();
    if (rect) {
      workspace.initialiseViewport(rect.width, rect.height);
    }
  }, [workspace]);

  // The layout is pushed into the Dock Manager only when the workspace
  // replaces it (a chart opened, a pane toggled, a reset). It is not a React
  // prop: the wrapper re-assigns every prop on every render, and the Dock
  // Manager swaps its own copy of the layout during a drag.
  useLayoutEffect(() => {
    const dock = dockRef.current;
    if (dock) {
      dock.layout = layout;
    }
  }, [layout]);

  const onLayoutChange = useCallback(
    (event: LayoutChangeEvent) => {
      if (event.detail?.layout) {
        workspace.applyLayout(event.detail.layout);
      }
    },
    [workspace],
  );

  /**
   * The pane header's X *removes* a pane from the layout, and a pane that is no
   * longer in the layout cannot be brought back by the rail.
   *
   * So for the fixed panes the close is cancelled and turned into a hide, which
   * is exactly the state the rail already drives. Chart documents keep the
   * default behaviour: they are meant to be closed for good and reopened from
   * the watchlist or the search box.
   *
   * A close never mixes the two — a tab group holds either the fixed panes or
   * the chart documents, never both — so this either claims the whole event or
   * leaves it alone.
   */
  const onPaneClose = useCallback((event: IgrPaneCloseEventArgs) => {
    const panes = event.detail?.panes ?? [];
    if (panes.length === 0 || !panes.every((pane) => isFixedPaneId(pane.contentId))) {
      return;
    }

    event.preventDefault();
    for (const pane of panes) {
      pane.hidden = true;
    }
  }, []);

  /**
   * Alerts open in a dialog rather than a pane, and showing them is what marks
   * them read — the panel itself stays mounted, so it cannot own that.
   */
  const showAlerts = useCallback(() => {
    notifications.markAllRead();
    alertsDialogRef.current?.show();
  }, [notifications]);

  /** Reset discards the whole session — the book and the blotter included — so it asks first. */
  const resetDesk = useCallback(() => {
    resetDialogRef.current?.show();
  }, []);

  const confirmReset = () => {
    resetDialogRef.current?.hide();
    const rect = hostRef.current?.getBoundingClientRect();
    desk.reset(rect ? { width: rect.width, height: rect.height } : undefined);
  };

  return (
    <div ref={hostRef} className={`grid-fintech-dock-manager${isDark ? "" : " light-theme"}`}>
      <div className="app-shell">
        <PaneRail
          expanded={navExpanded}
          pinned={railPinned}
          onToggle={toggleNav}
          onDismiss={dismissNav}
          onReset={resetDesk}
        />

        <div className="workspace">
          <CommandBar onShowAlerts={showAlerts} />

          <div className="main-area">
            <IgrDockManager
              ref={dockRef}
              className="dock-area ig-scrollbar"
              onLayoutChange={onLayoutChange}
              onPaneClose={onPaneClose}
            >
              <div slot="watchlist" className="pane-host">
                <Watchlist />
              </div>
              <div slot="orderTicket" className="pane-host">
                <OrderTicket />
              </div>
              <div slot="positions" className="pane-host">
                <PositionsGrid />
              </div>
              <div slot="blotter" className="pane-host">
                <Blotter />
              </div>
              <div slot="news" className="pane-host">
                <NewsPanel />
              </div>

              {/* One slot per open chart document; the layout is the source of truth. */}
              {chartSymbols.map((symbol) => (
                <div key={symbol} slot={chartContentId(symbol)} className="pane-host">
                  <ChartPanel symbol={symbol} />
                </div>
              ))}
            </IgrDockManager>
          </div>
        </div>
      </div>

      {/* Zero-sized and out of flow: it only gives the dialogs a home inside the
          desk's palette scope, and turns on the desk's scrollbars for them. */}
      <div className="desk-overlay-host ig-scrollbar">
        <IgrDialog ref={resetDialogRef} title="Reset the desk?" closeOnOutsideClick>
          <span className="dialog-message">
            The layout, watchlist, theme, book and alerts all go back to how they opened. Orders you have placed and
            positions you have opened are discarded.
          </span>
          <div slot="footer" className="dialog-actions">
            <IgrButton variant="flat" onClick={() => resetDialogRef.current?.hide()}>
              Cancel
            </IgrButton>
            <IgrButton variant="contained" onClick={confirmReset}>
              Reset
            </IgrButton>
          </div>
        </IgrDialog>

        <IgrDialog ref={alertsDialogRef} closeOnOutsideClick>
          <div slot="title" className="notifications-title">
            <IgrIcon name="notifications" collection={ICONS} aria-hidden="true" />
            <span>Alerts</span>
          </div>

          <div className="notifications-body">
            <AlertsPanel />
          </div>

          <div slot="footer" className="dialog-actions">
            <IgrButton variant="flat" onClick={() => alertsDialogRef.current?.hide()}>
              Close
            </IgrButton>
          </div>
        </IgrDialog>
      </div>
    </div>
  );
}

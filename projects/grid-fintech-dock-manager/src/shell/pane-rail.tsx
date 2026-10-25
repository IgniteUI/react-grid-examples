import { memo, useEffect, useRef, type KeyboardEvent, type RefObject } from "react";
import { IgrIcon, IgrIconButton, IgrNavDrawer, IgrNavDrawerItem, IgrSwitch } from "igniteui-react";
import { useDesk } from "../services/desk";
import type { DockPaneId } from "../util/dock-layout";
import { ICONS } from "../util/icons";
import { useStore } from "../util/use-store";

interface PaneRailProps {
  expanded: boolean;
  /**
   * Pinned, the rail sits beside the desk; unpinned (a narrow viewport) it
   * floats over it, and the expanded rail dims the desk behind it.
   */
  pinned: boolean;
  onToggle: () => void;
  /** The floating rail closed itself: a click on its backdrop, or Escape. */
  onDismiss: () => void;
  onReset: () => void;
}

/**
 * The pane rail: a navigation drawer, mini by default and expanded on demand.
 * Both states render the same item list; only the expanded one carries labels
 * and switches.
 */
function PaneRail({ expanded, pinned, onToggle, onDismiss, onReset }: PaneRailProps) {
  const drawerRef = useRef<IgrNavDrawer>(null);
  const toggleRef = useRef<IgrIconButton>(null);
  const restoreFocus = useRef(false);

  // The mini and the expanded rail are separate subtrees, so changing state
  // destroys the toggle button that has focus, and the next Tab would start from
  // the end of the drawer instead of from the rail. Once the drawer has applied
  // the new state — an unopened drawer is inert — focus goes to the new toggle.
  useEffect(() => {
    if (!restoreFocus.current) {
      return;
    }
    restoreFocus.current = false;
    void drawerRef.current?.updateComplete.then(() => toggleRef.current?.focus());
  }, [expanded]);

  const toggle = () => {
    restoreFocus.current = true;
    onToggle();
  };

  return (
    // The floating rail closes itself on a click on its backdrop or on Escape,
    // and says so, so the shell's state follows.
    <IgrNavDrawer
      ref={drawerRef}
      className="platform-rail"
      position={pinned ? "relative" : "start"}
      open={expanded}
      onClosed={() => {
        restoreFocus.current = true;
        onDismiss();
      }}
    >
      {expanded && <RailItems expanded toggleRef={toggleRef} onToggle={toggle} onReset={onReset} />}
      {!expanded && (
        <div slot="mini" className="rail-mini">
          <RailItems expanded={false} toggleRef={toggleRef} onToggle={toggle} onReset={onReset} />
        </div>
      )}
    </IgrNavDrawer>
  );
}

export default memo(PaneRail);

interface RailItemsProps {
  expanded: boolean;
  /** Reaches the toggle button, so the rail can put focus back on it. */
  toggleRef: RefObject<IgrIconButton | null>;
  onToggle: () => void;
  onReset: () => void;
}

/**
 * An ARIA state as the string a screen reader expects. The rail's items are
 * custom elements, and React writes a boolean `true` on one as an empty
 * attribute, which states nothing, so the state is passed as a string.
 */
const ariaState = (on: boolean): "true" | "false" => (on ? "true" : "false");

/** Enter and Space activate a rail row, as they would a native button. */
function activateOnKey(event: KeyboardEvent<HTMLElement>, action: () => void): void {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    action();
  }
}

function RailItems({ expanded, toggleRef, onToggle, onReset }: RailItemsProps) {
  const { workspace } = useDesk();
  const visiblePanes = useStore(workspace, (state) => state.visiblePanes);
  const togglePane = (id: DockPaneId) => workspace.togglePane(id);

  return (
    <>
      <div className={`rail-head${expanded ? " rail-head-expanded" : ""}`}>
        <IgrIconButton
          ref={toggleRef}
          variant="flat"
          className="rail-toggle"
          name={expanded ? "chevron_left" : "chevron_right"}
          collection={ICONS}
          // An icon button hands only its label to the button inside it, so
          // `aria-expanded` would never be exposed: the name carries the state.
          aria-label={expanded ? "Collapse the pane rail" : "Expand the pane rail"}
          onClick={onToggle}
        />
      </div>

      <nav className="rail-nav" aria-label="Show or hide panes">
        {workspace.paneToggles.map((pane) => {
          const visible = visiblePanes.has(pane.id);
          return (
            <IgrNavDrawerItem
              key={pane.id}
              className="rail-item"
              role="switch"
              tabIndex={0}
              active={visible}
              aria-checked={ariaState(visible)}
              aria-label={expanded ? undefined : pane.label}
              title={expanded ? "" : pane.label}
              onClick={() => togglePane(pane.id)}
              onKeyDown={(event) => activateOnKey(event, () => togglePane(pane.id))}
            >
              <IgrIcon slot="icon" name={pane.icon} collection={ICONS} aria-hidden="true" />
              {expanded && (
                <span slot="content" className="rail-content">
                  <span className="rail-label">{pane.label}</span>

                  {/* Indicator only — the row is the control, so a click anywhere
                      on the item flips it. `pointer-events: none` keeps the
                      switch from toggling itself as well, and `inert` with
                      `aria-hidden` keeps it out of the tab order and off the
                      accessibility tree, where the row's `role="switch"`
                      already reports the state. */}
                  <IgrSwitch className="rail-switch" aria-hidden="true" inert checked={visible} />
                </span>
              )}
            </IgrNavDrawerItem>
          );
        })}
      </nav>

      <div className="rail-footer">
        <IgrNavDrawerItem
          className="rail-item"
          role="button"
          tabIndex={0}
          title="Restore the desk to its opening state"
          aria-label="Reset the desk"
          onClick={onReset}
          onKeyDown={(event) => activateOnKey(event, onReset)}
        >
          <IgrIcon slot="icon" name="restart_alt" collection={ICONS} aria-hidden="true" />
          {expanded && (
            <span slot="content" className="rail-content">
              <span className="rail-label">Reset desk</span>
            </span>
          )}
        </IgrNavDrawerItem>
      </div>
    </>
  );
}

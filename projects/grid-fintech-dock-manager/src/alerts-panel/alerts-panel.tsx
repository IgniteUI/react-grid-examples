import { memo } from "react";
import { IgrButton, IgrIcon, IgrList, IgrListItem } from "igniteui-react";
import { useDesk } from "../services/desk";
import { since } from "../util/finance";
import { ICONS } from "../util/icons";
import { useStore } from "../util/use-store";

/**
 * Desk alerts — fills, rejections and unusual moves.
 *
 * The body of the command bar's alerts dialog rather than a docked pane: alerts
 * are glanced at when the bell says there is something new, not kept on
 * screen. Marking them read belongs to whoever opens the dialog; this panel
 * stays mounted, so doing it here would only ever mark once.
 */
function AlertsPanel() {
  const { notifications } = useDesk();
  const alerts = useStore(notifications, (state) => state.notifications);
  const now = useStore(notifications, (state) => state.now);

  return (
    <div className="alerts-panel">
      <IgrButton
        className="clear-btn"
        variant="outlined"
        disabled={alerts.length === 0}
        title="Clear alerts"
        onClick={() => notifications.clear()}
      >
        <IgrIcon slot="prefix" name="clear_all" collection={ICONS} aria-hidden="true" />
        Clear
      </IgrButton>

      <IgrList className="item-list">
        {alerts.map((alert) => (
          <IgrListItem key={alert.id} className={`tone-${alert.tone}`}>
            <IgrIcon slot="start" className="alert-icon" name={alert.icon} collection={ICONS} aria-hidden="true" />
            <span slot="title">{alert.title}</span>
            <span slot="subtitle">{alert.detail}</span>
            <small slot="end">
              <time className="alert-time">{since(alert.at, now)}</time>
            </small>
          </IgrListItem>
        ))}
        {alerts.length === 0 && <p className="list-empty">No alerts. Fills and unusual moves will land here.</p>}
      </IgrList>
    </div>
  );
}

export default memo(AlertsPanel);

import { memo, useEffect, useRef, type ReactNode } from "react";
import { IgrAvatar, IgrBadge, IgrButtonGroup, IgrIconButton, IgrToggleButton } from "igniteui-react";
import { FEED_SPEEDS, type FeedStatus } from "../services/market-data.service";
import { useDesk } from "../services/desk";
import { unreadCountOf } from "../services/notifications.service";
import { workingOrdersIn } from "../services/trading.service";
import { money, price, signed } from "../util/finance";
import { ICONS } from "../util/icons";
import { useStore } from "../util/use-store";

/**
 * How many copies of the figure ribbon the ticker stamps.
 *
 * A CSS-only loop slides the track by one run and restarts, so it needs enough
 * copies that the ones still ahead of the frame cover the bar at that moment —
 * see `.bar-ticker`. This is the same number as `--ticker-runs` in the
 * stylesheet and has to move with it.
 */
const TICKER_RUNS = [0, 1, 2, 3];

type BadgeVariant = "success" | "info" | "warning" | "primary";

/** Maps the feed's state onto a badge colour. */
function feedBadgeVariant(status: FeedStatus): BadgeVariant {
  switch (status) {
    case "live":
      return "success";
    case "simulated":
      return "info";
    case "connecting":
      return "warning";
    default:
      return "primary";
  }
}

interface CommandBarProps {
  /** Opens the alerts dialog; the shell owns it. */
  onShowAlerts: () => void;
}

/**
 * The desk's command bar, in three hairline-separated zones: who we are and
 * what the tape is doing, then the market, then the account and its controls.
 */
function CommandBar({ onShowAlerts }: CommandBarProps) {
  const { market, notifications, workspace } = useDesk();
  const feedStatus = useStore(market, (state) => state.status);
  const frequency = useStore(market, (state) => state.frequency);
  const unreadAlerts = useStore(notifications, (state) => unreadCountOf(state.notifications));
  const isDark = useStore(workspace, (state) => state.theme === "dark");
  const isPaused = feedStatus === "paused";

  // The bell's name carries the unread count. igc-icon-button hands `aria-label`
  // to its inner button, but the label is not a reactive property of the
  // component, so a changed count would never reach that button on its own.
  // Asking for another render once the count changes keeps the name current.
  const bellRef = useRef<IgrIconButton>(null);
  useEffect(() => {
    bellRef.current?.requestUpdate();
  }, [unreadAlerts]);

  const playbackLabel = isPaused ? "Resume the market feed" : "Pause the market feed";
  const themeLabel = isDark ? "Switch to light mode" : "Switch to dark mode";

  return (
    <header className="command-bar" role="banner">
      <div className="bar-zone bar-lead">
        <div className="brand">SignalDesk</div>

        <div className="feed-controls" role="group" aria-label="Market feed">
          <IgrBadge
            className="feed-status"
            variant={feedBadgeVariant(feedStatus)}
            aria-label={`Feed status: ${feedStatus}`}
          >
            <span className="badge-value">{feedStatus}</span>
          </IgrBadge>

          <IgrIconButton
            variant="flat"
            name={isPaused ? "play_arrow" : "pause"}
            collection={ICONS}
            aria-label={playbackLabel}
            title={playbackLabel}
            onClick={() => market.togglePlayback()}
          />

          <IgrButtonGroup
            className="speed-group"
            selection="single-required"
            onSelect={(event) => {
              const value = Number(event.detail);
              if (FEED_SPEEDS.some((speed) => speed.value === value)) {
                market.setFrequency(value);
              }
            }}
          >
            {FEED_SPEEDS.map((speed) => (
              <IgrToggleButton
                key={speed.value}
                value={String(speed.value)}
                selected={frequency === speed.value}
                title={`Tick every ${speed.value}ms`}
              >
                <span>{speed.label}</span>
              </IgrToggleButton>
            ))}
          </IgrButtonGroup>
        </div>
      </div>

      {/* The figure ribbon: indices and account summary on one endless loop.
          `tabIndex` is what makes the pause reachable without a mouse — see
          `.bar-ticker` for both halves of that. */}
      <div
        className="bar-zone bar-ticker"
        role="region"
        aria-label="Market indices and account summary — hover or focus to pause"
        tabIndex={0}
      >
        {/* The same figures over and over. The copies are not redundant: the
            loop resets the instant copy two stands where copy one began, so
            there is never a blank stretch in frame, and it takes more than two
            of them to fill a wide bar. Only the first is read out — a screen
            reader should hear the ribbon once. */}
        <div className="ticker-track">
          {TICKER_RUNS.map((run) => (
            <div key={run} className="ticker-run" aria-hidden={run === 0 ? undefined : "true"}>
              <TickerFigures />
            </div>
          ))}
        </div>
      </div>

      <div className="bar-zone bar-actions">
        <IgrAvatar initials="S" shape="circle" className="user-avatar" />

        <div className="notification-controls" role="group" aria-label="Alerts">
          <IgrIconButton
            ref={bellRef}
            variant="flat"
            className="alert-bell"
            name="notifications"
            collection={ICONS}
            aria-label={`${unreadAlerts} unread alerts — show alerts`}
            title="Show alerts"
            onClick={onShowAlerts}
          >
            {unreadAlerts > 0 && (
              <IgrBadge className="bell-badge" variant="danger">
                <span className="badge-value">{unreadAlerts}</span>
              </IgrBadge>
            )}
          </IgrIconButton>
        </div>

        <IgrIconButton
          variant="flat"
          name={isDark ? "light_mode" : "dark_mode"}
          collection={ICONS}
          title={themeLabel}
          aria-label={themeLabel}
          onClick={() => workspace.toggleTheme()}
        />
      </div>
    </header>
  );
}

export default memo(CommandBar);

/** One label-over-value figure in the ribbon. */
function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <span className="stat-line">{children}</span>
    </div>
  );
}

/**
 * One run of the ticker: the four indices, then the account summary, divided
 * the way the bar's zones are.
 */
function TickerFigures() {
  const { market, trading } = useDesk();
  const indices = useStore(market, (state) => state.indices);
  const account = useStore(trading, (state) => state.account);
  const workingCount = useStore(trading, (state) => workingOrdersIn(state.orders).length);

  return (
    <>
      {indices.map((index) => (
        <Stat key={index.name} label={index.name}>
          <span className="stat-value mono">{price(index.value)}</span>
          <span className={`stat-delta mono ${index.positive ? "pos" : "neg"}`}>{signed(index.changePct, "pct")}</span>
        </Stat>
      ))}

      <dl className="ticker-account" aria-label="Account summary">
        <div className="stat">
          <dt className="stat-label">Net liq.</dt>
          <dd className="stat-line">
            <span className="stat-value mono">{money(account.netLiquidation)}</span>
          </dd>
        </div>
        <div className="stat">
          <dt className="stat-label">Day P&amp;L</dt>
          <dd className="stat-line">
            <span className={`stat-value mono ${account.dayPl >= 0 ? "pos" : "neg"}`}>{signed(account.dayPl, "money")}</span>
          </dd>
        </div>
        <div className="stat">
          <dt className="stat-label">Buying power</dt>
          <dd className="stat-line">
            <span className="stat-value mono">{money(account.buyingPower)}</span>
          </dd>
        </div>
        <div className="stat">
          <dt className="stat-label">Working</dt>
          <dd className="stat-line">
            <span className="stat-value mono">{workingCount}</span>
          </dd>
        </div>
      </dl>
    </>
  );
}

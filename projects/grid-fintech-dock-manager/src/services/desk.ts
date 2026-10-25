import { createContext, useContext } from "react";
import { MarketDataService } from "./market-data.service";
import { NotificationsService } from "./notifications.service";
import { TradingService } from "./trading.service";
import { FALLBACK_VIEWPORT, WorkspaceService } from "./workspace.service";

/**
 * One desk session: the four services every pane shares.
 *
 * Panes never talk to each other; they read and write these. The shell creates
 * one desk per mount and starts the feeds while it is on screen.
 */
export class Desk {
  readonly market = new MarketDataService();
  readonly notifications = new NotificationsService(this.market);
  readonly trading = new TradingService(this.market, this.notifications);
  readonly workspace = new WorkspaceService();

  start(): void {
    this.market.start();
    this.notifications.start();
  }

  stop(): void {
    this.market.stop();
    this.notifications.stop();
  }

  /**
   * Puts the whole sample back to how it opened — arrangement, book, tape and
   * alerts, not just the layout.
   *
   * Each service owns its own reset; the desk only composes them. Order
   * matters: the tape goes last, because its reset tick drives a pass over the
   * book and an alert scan straight away. The book is restored first, so that
   * pass marks the opening positions rather than the ones being replaced; and
   * the alerts are cleared first, so the scan starts from no alerts and no
   * cooldowns and raises the opening moves again.
   */
  reset(viewport: { width: number; height: number } = FALLBACK_VIEWPORT): void {
    this.workspace.reset(viewport.width, viewport.height);
    this.trading.reset();
    this.notifications.reset();
    this.market.reset();
  }
}

export const DeskContext = createContext<Desk | null>(null);

/** The desk the surrounding shell provides. */
export function useDesk(): Desk {
  const desk = useContext(DeskContext);
  if (!desk) {
    throw new Error("useDesk must be used inside the desk shell");
  }
  return desk;
}

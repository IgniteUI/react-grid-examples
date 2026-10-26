import { useEffect, useState } from "react";
import { Desk, DeskContext } from "./services/desk";
import DeskShell from "./shell/desk-shell";
import { registerDeskIcons } from "./util/icons";

// Once per page. In the samples shell this module loads in a chunk of its own,
// only when the desk's route opens.
registerDeskIcons();

/**
 * Signal Desk: a working trading desk in a Dock Manager. Place an order and the
 * position, cash, P&L, blotter and alerts all move.
 */
export default function GridFintechDockManager() {
  const [desk] = useState(() => new Desk());

  // The tape and the news wire run while the desk is on screen.
  useEffect(() => {
    desk.start();
    return () => desk.stop();
  }, [desk]);

  return (
    <DeskContext value={desk}>
      <DeskShell />
    </DeskContext>
  );
}

import { IgrBadge, IgrIconButton } from "igniteui-react";
import { SALES_ICON_COLLECTION } from "../theme/icons";

interface DashboardHeaderProps {
  isDark: boolean;
  onToggleTheme: () => void;
}

/** The page title, the live status and the appearance switch. */
export default function DashboardHeader({ isDark, onToggleTheme }: DashboardHeaderProps) {
  const label = isDark ? "Switch to light mode" : "Switch to dark mode";

  return (
    <header className="title-row">
      <h1>Sales Overview</h1>
      <div className="status-row">
        <IgrBadge variant="success" shape="square" dot={true} aria-label="Live status" className="success-badge" />
        <span>LIVE · UPDATED JUST NOW</span>
        <IgrIconButton
          variant="flat"
          type="button"
          className="theme-toggle"
          name={isDark ? "light_mode" : "dark_mode"}
          collection={SALES_ICON_COLLECTION}
          title={label}
          aria-label={label}
          onClick={onToggleTheme}
        />
      </div>
    </header>
  );
}

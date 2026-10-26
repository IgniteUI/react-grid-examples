import { IgrButtonGroup, IgrIconButton, IgrToggleButton } from "igniteui-react";
import { FINJS_SIZES, useFinjsView, type FinjsSize } from "../finjs-view-context";
import { FINJS_ICON_COLLECTION } from "../services/finjs-icons";

/** The size selector and the light/dark switch, in the grid toolbar's actions. */
export default function FinjsToolbarControls() {
  const { size, isDark, setSize, toggleTheme } = useFinjsView();
  const themeLabel = isDark ? "Switch to light mode" : "Switch to dark mode";

  return (
    <>
      {/* A single-selection group is a radio group: one tab stop, and the arrow keys move the selection. */}
      <IgrButtonGroup
        className="finjs-size-group"
        selection="single-required"
        aria-label="Component size"
        onSelect={(event) => setSize(event.detail as FinjsSize)}
      >
        {FINJS_SIZES.map((option) => (
          <IgrToggleButton key={option} value={option} selected={size === option} title={`Render the sample at ${option} size`}>
            <span>{option}</span>
          </IgrToggleButton>
        ))}
      </IgrButtonGroup>

      <IgrIconButton
        className="finjs-theme-toggle"
        variant="outlined"
        type="button"
        name={isDark ? "light_mode" : "dark_mode"}
        collection={FINJS_ICON_COLLECTION}
        title={themeLabel}
        aria-label={themeLabel}
        onClick={toggleTheme}
      />
    </>
  );
}

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

// The desk runs on the light Fluent component schema in both appearances: its
// own palettes (src/styles/palette.css) supply the dark and light colours.
import "igniteui-webcomponents/themes/light/fluent.css";
import "igniteui-react-grids/grids/themes/light/fluent.css";
import "./app.css";

import GridFintechDockManager from "./app";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <GridFintechDockManager />
  </StrictMode>
);

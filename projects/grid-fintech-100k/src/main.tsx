import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

// The sample themes its components through its own palettes on top of the
// light Fluent theme, for both of its appearances.
import "igniteui-webcomponents/themes/light/fluent.css";
import "igniteui-react-grids/grids/themes/light/fluent.css";
import "./styles/grid-fintech-100k.scss";

import GridFintech100k from "./app";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <GridFintech100k />
  </StrictMode>
);

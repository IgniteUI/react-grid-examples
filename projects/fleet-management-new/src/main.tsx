import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

// The sample themes its components through its own palette on top of the light
// Fluent theme, for both of its appearances.
import "igniteui-webcomponents/themes/light/fluent.css";
import "igniteui-react-grids/grids/themes/light/fluent.css";
import "./styles/fleet-management.scss";

import NewFleetManagement from "./app";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <NewFleetManagement />
  </StrictMode>
);

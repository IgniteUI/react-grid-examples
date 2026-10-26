import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "igniteui-webcomponents/themes/light/fluent.css";
import "./app.css";

import Excel from "./app";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Excel />
  </StrictMode>
);

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "react-app-polyfill/ie11";

import "igniteui-webcomponents/themes/light/indigo.css";
import "igniteui-react-grids/grids/themes/light/indigo.css";
import "./theme.css";

import App from "./app";

Number.isNaN =
  Number.isNaN ||
  function (value) {
    return value !== value;
  };

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

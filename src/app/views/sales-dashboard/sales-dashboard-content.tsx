import SalesDashboard from "../../../../projects/sales-dashboard/src/app";

import lightFluentWc from "igniteui-webcomponents/themes/light/fluent.css?inline";
import lightFluentGrid from "igniteui-react-grids/grids/themes/light/fluent.css?inline";
import appStyles from "../../../../projects/sales-dashboard/src/styles/sales-dashboard.scss?inline";

// The theme <style> renders in the same commit as the app, because the components read the
// theme once, when the first of them connects. The dashboard adds its own fonts stylesheet and
// builds its charts once the faces are loaded.
export default function SalesDashboardContent() {
  return (
    <>
      <style>
        {lightFluentWc}
        {lightFluentGrid}
        {appStyles}
      </style>
      <SalesDashboard />
    </>
  );
}

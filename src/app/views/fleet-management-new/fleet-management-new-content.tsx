import NewFleetManagement from "../../../../projects/fleet-management-new/src/app";

import lightFluentWc from "igniteui-webcomponents/themes/light/fluent.css?inline";
import lightFluentGrid from "igniteui-react-grids/grids/themes/light/fluent.css?inline";
import appStyles from "../../../../projects/fleet-management-new/src/styles/fleet-management.scss?inline";

// The theme <style> renders in the same commit as the app, because the components read the
// theme once, when the first of them connects. The sample's own stylesheet goes in a <style>
// of its own, because it starts with the @import of its font.
export default function NewFleetManagementContent() {
  return (
    <>
      <style>
        {lightFluentWc}
        {lightFluentGrid}
      </style>
      <style>{appStyles}</style>
      <NewFleetManagement />
    </>
  );
}

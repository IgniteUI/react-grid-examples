import ProductionOperations from "../../../../projects/manifacturing/src/production-operations";

import lightIndigoGrid from "igniteui-react-grids/grids/themes/light/indigo.css?inline";
import lightIndigoWc from "igniteui-webcomponents/themes/light/indigo.css?inline";
import sampleTheme from "../../../../projects/manifacturing/src/theme.css?inline";

export default function ManifacturingView() {
  return (
    <>
      <style>
        {lightIndigoWc}
        {lightIndigoGrid}
        {sampleTheme}
      </style>
      <ProductionOperations />
    </>
  );
}

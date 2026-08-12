import ProductionOperations from "../../../../projects/manufacturing/src/production-operations";

import lightIndigoGrid from "igniteui-react-grids/grids/themes/light/indigo.css?inline";
import lightIndigoWc from "igniteui-webcomponents/themes/light/indigo.css?inline";
import sampleTheme from "../../../../projects/manufacturing/src/theme.css?inline";

export default function ManufacturingView() {
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

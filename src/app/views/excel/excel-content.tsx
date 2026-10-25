import Excel from "../../../../projects/excel/src/app";

import lightFluentWc from "igniteui-webcomponents/themes/light/fluent.css?inline";
import appStyles from "../../../../projects/excel/src/app.css?inline";

// The theme <style> renders in the same commit as the app, so the page-level Fluent rules
// (typography, scrollbars, custom properties) are in place before the Spreadsheet is created.
export default function ExcelContent() {
  return (
    <>
      <style>
        {lightFluentWc}
        {appStyles}
      </style>
      <Excel />
    </>
  );
}

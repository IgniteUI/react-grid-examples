import GridFintechDockManager from "../../../../projects/grid-fintech-dock-manager/src/app";

import lightFluentWc from "igniteui-webcomponents/themes/light/fluent.css?inline";
import lightFluentGridTheme from "igniteui-react-grids/grids/themes/light/fluent.css?inline";
import appStyles from "../../../../projects/grid-fintech-dock-manager/src/app.css?inline";

// A cascade layer keeps the place of its first mention on the page. The shell loads other grid
// themes first (the first of them declares `ig.reset, ig.base, ig.material, ig.derived`), so
// Fluent's own `ig.fluent` layer would land after `ig.derived`, and every override in
// `ig.derived` (the Excel-style filter's button groups, for one) would lose to Fluent's base
// rules. Fluent's theme and derived layers are renamed so that they follow the shell's. The reset
// and base layers stay shared: the components bring structural styles of their own to `ig.base`,
// which must not be outranked by a layer of its own.
const lightFluentGrid = lightFluentGridTheme
  .replace(
    /@layer\s+ig\.reset\s*,\s*ig\.base\s*,\s*ig\.fluent\s*,\s*ig\.derived\s*;/,
    "@layer ig.reset, ig.base, app.fluent, app.derived;"
  )
  .replace(/@layer\s+ig\.(fluent|derived)\s*\{/g, "@layer app.$1{");

// The desk's font, DM Sans; the shell page already loads Titillium Web. An @import counts only at the
// start of a stylesheet, so the font gets a <style> of its own. The standalone page requests the same
// stylesheet from its index.html.
const FONTS = '@import url("https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&display=swap");';

// The theme <style> renders in the same commit as the app, because the components read the
// theme once, when the first of them connects. The desk runs on the light Fluent schema in both
// appearances; its own palette supplies the dark one.
export default function GridFintechDockManagerContent() {
  return (
    <>
      <style>{FONTS}</style>
      <style>
        {lightFluentWc}
        {lightFluentGrid}
        {appStyles}
      </style>
      <GridFintechDockManager />
    </>
  );
}

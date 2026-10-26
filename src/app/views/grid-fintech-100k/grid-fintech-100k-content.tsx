import GridFintech100k from "../../../../projects/grid-fintech-100k/src/app";

import lightFluentWc from "igniteui-webcomponents/themes/light/fluent.css?inline";
import lightFluentGridTheme from "igniteui-react-grids/grids/themes/light/fluent.css?inline";
import appStyles from "../../../../projects/grid-fintech-100k/src/styles/grid-fintech-100k.scss?inline";

// A cascade layer keeps the place of its first mention on the page. The shell loads other grid
// themes first (the first of them declares `ig.reset, ig.base, ig.material, ig.derived`), so
// Fluent's own `ig.fluent` layer would land after `ig.derived`, and every override in
// `ig.derived` (Excel-style filter, column actions, toolbar, grid tokens) would lose to Fluent's
// base rules. Fluent's theme and derived layers are renamed so that they follow the shell's.
// The reset and base layers stay shared: the components bring structural styles of their own
// to `ig.base`, which must not be outranked by a layer of its own.
const lightFluentGrid = lightFluentGridTheme
  .replace(
    /@layer\s+ig\.reset\s*,\s*ig\.base\s*,\s*ig\.fluent\s*,\s*ig\.derived\s*;/,
    "@layer ig.reset, ig.base, app.fluent, app.derived;"
  )
  .replace(/@layer\s+ig\.(fluent|derived)\s*\{/g, "@layer app.$1{");

// The theme <style> renders in the same commit as the app, because the components read the
// theme once, when the first of them connects.
export default function GridFintech100kContent() {
  return (
    <>
      <style>
        {lightFluentWc}
        {lightFluentGrid}
        {appStyles}
      </style>
      <GridFintech100k />
    </>
  );
}

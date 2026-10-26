import { DataChartStylingDefaults } from "igniteui-react-charts";

export type SalesTheme = "light" | "dark";

/**
 * Chart colours, one set per appearance.
 *
 * The charts paint to canvas, so unlike everything else in the sample they
 * cannot read the palette through a CSS variable: every value below is a
 * literal, mostly a copy of a palette shade, and has to change alongside
 * `styles/_palette.scss`:
 *
 * | | light | dark |
 * | --- | --- | --- |
 * | `series` | primary-500, then deeper than the warn, secondary, success 500s | primary, warn, secondary, success -500 |
 * | `label`, `sliceLabel` | gray-700 | gray-500 |
 * | `gridline` | gray-300 | gray-100 |
 * | `chip` | transparent | transparent |
 * | `bubble`, `bubbleText` | primary-500 + white | primary-500 + near-black |
 *
 * `series` is in the donut's slice order, which is also the legend's. On the white
 * light panel the 500s of warn, secondary and success are too pale for series ink,
 * so the light set uses `#b8690c`, `#d84b98` and `#17835f` (4.15:1, 3.90:1, 4.72:1).
 *
 * The tooltip and the axis bubbles are two different elements and take two
 * different fills, which is worth stating because they look like one thing:
 *
 * - `chip` is the canvas rectangle the item tooltip paints *under* the DOM box,
 *   and it is the callout, leg and all. Transparent, so it draws nothing and the
 *   DOM box is the whole tooltip: that is what lets all three look identical,
 *   since the donut's tooltip has no canvas half to disagree with.
 * - `bubble` is the value chip the crosshairs park on the axis. It takes the
 *   accent rather than the tooltip's fill: the chip has no border input, so a
 *   fill a step off the panel would be barely visible (1.05:1 on the light
 *   theme). The accent is 4.9:1 / 5.7:1 against the panel and it is the colour
 *   of the series the bubble annotates.
 *
 *   The ink flips with it, because the accent does not: primary-500 is the same
 *   value in both palettes, light enough on the dark set that white falls to
 *   2.7:1 and deep enough on the light set that near-black falls to 3.3:1. White
 *   over the light accent is 4.9:1; near-black over the dark one is 6.0:1.
 */
export interface SalesChartPalette {
  series: string[];
  trend: string[];
  deals: string[];
  label: string;
  gridline: string;
  sliceLabel: string;
  chip: string;
  bubble: string;
  bubbleText: string;
}

export const SALES_CHART_THEMES: Readonly<Record<SalesTheme, SalesChartPalette>> = {
  light: {
    series: ["#7f4cf6", "#b8690c", "#d84b98", "#17835f"],
    trend: ["#7f4cf6", "#17835f"],
    deals: ["#7f4cf6"],
    label: "#445d7e",
    gridline: "#d7dfe9",
    sliceLabel: "#445d7e",
    chip: "transparent",
    bubble: "#7f4cf6",
    bubbleText: "#ffffff",
  },
  dark: {
    series: ["#a78bfa", "#e0a33c", "#f07cb8", "#35c48c"],
    trend: ["#a78bfa", "#35c48c"],
    deals: ["#a78bfa"],
    label: "#a3bad6",
    gridline: "#29405c",
    sliceLabel: "#a3bad6",
    chip: "transparent",
    bubble: "#a78bfa",
    bubbleText: "#17202b",
  },
};

/** The font the charts draw their axis labels in. */
export const CHART_LABEL_FONT = "500 13px 'Barlow', sans-serif";

/**
 * The chart engine's lookup key for the rectangle it paints behind a tooltip.
 * A CSS class name in shape only: nothing in the document carries it.
 */
const SALES_POINTER_TOOLTIP_KEY = "ui-chart-pointer-tooltip";

/** `DataChartStylingDefaults` is declared with the engine's own keys only. */
const stylingDefaults = DataChartStylingDefaults as Record<string, unknown>;

/**
 * Themes the rectangle the engine paints behind every chart tooltip.
 *
 * There is no input for it: the fill comes from a CSS-shaped lookup the engine
 * makes through its renderer, and `DataChartStylingDefaults` is the table it
 * reads. It reads that table once, while the chart is being constructed, so the
 * entry has to be in place before the charts are created: the dashboard calls
 * this while it renders and gives every chart a key per appearance, so an
 * appearance change builds new charts after the entry is updated.
 *
 * The DOM tooltip that `.ig-tooltip-container-background` themes floats on top of this rectangle
 * at the same size, so the two have to agree; the border is dropped here and
 * left to the box above.
 */
export function applySalesTooltipTheme(palette: SalesChartPalette): void {
  stylingDefaults[SALES_POINTER_TOOLTIP_KEY] = {
    "background-color": palette.chip,
    "border-top-color": palette.chip,
    "border-top-width": "0",
  };
}

/** Live dashboards, so the table entry outlives exactly this sample. */
let openDashboards = 0;

/**
 * Keeps the table entry for as long as a dashboard is on the page and takes it
 * down again with the last one, so the package default applies to whatever
 * opens next. `DataChartStylingDefaults` is the charts package's own table,
 * shared by every chart on the page. Returns the release, for an effect cleanup.
 */
export function retainSalesTooltipTheme(): () => void {
  openDashboards++;
  return () => {
    if (--openDashboards === 0) {
      delete stylingDefaults[SALES_POINTER_TOOLTIP_KEY];
    }
  };
}

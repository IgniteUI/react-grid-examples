import { DataChartStylingDefaults } from "igniteui-react-charts";

export type FleetTheme = "dark" | "light";

export const FLEET_DEFAULT_THEME: FleetTheme = "dark";

export interface FleetChartPalette {
  /** Slice brushes, in the donut's own order: fuel, maintenance, insurance, tolls. */
  cost: string[];
  /**
   * Text the engine draws *on top of* a series brush - the percentage inside
   * every donut slice, and the value in the axis bubble under the cursor. One
   * colour serves all of them; see the note below.
   */
  onBrush: string;
  spend: string[];
  /** Column brushes, in the comparison chart's order: current year, prior year. */
  utilization: string[];
  label: string;
  gridline: string;
  tooltipBackground: string;
  tooltipBorder: string;
}

/**
 * Chart colours, one set per appearance.
 *
 * The charts paint to canvas, so unlike everything else in the sample they
 * cannot read the palette through a CSS variable and need their own values.
 * Every one below is a literal copy of a palette shade, so it has to change
 * alongside `_palette.scss`:
 *
 * | | dark | light |
 * | --- | --- | --- |
 * | `cost` | primary, warn, success, error -500 | same |
 * | `onBrush` | surface-500 | white |
 * | `spend` | primary-500 | same |
 * | `utilization` | primary-500, success-500 | same |
 * | `label` | gray-700 | gray-700 |
 * | `gridline` | gray-200 | gray-600 |
 * | `tooltipBackground` | surface-100 | surface-600 |
 * | `tooltipBorder` | gray-100 | surface-700 |
 *
 * Info is the one family the charts do not draw with, on purpose: it sits too
 * close to the accent to plot beside it. On the light palette the two are 3°
 * apart in hue (info 216°, accent 219°) and on the dark one 41°, so a slice of
 * each would read as one colour at the light end and as a near-miss at the
 * dark. Info still carries the Active status, where it is a badge rather than a
 * plot and never shares an edge with the accent.
 *
 * Maintenance is orange and tolls red rather than the other way round: those
 * two are 15° apart on the light palette, which is close enough that the pair
 * has to stay non-adjacent in the ring, and the data order puts insurance
 * between them.
 *
 * `onBrush` contrasts with a series brush rather than with the appearance, so
 * it does not flip with the theme for the usual reason - it flips because the
 * brushes do. One value covers every place the engine paints text on a brush,
 * because each appearance's brushes all sit on the same side of the line: the
 * dark palette's are mid-tone or brighter, so the surface's own near-black
 * clears AA on all of them (5.6:1 at worst, on tolls), and the light palette's
 * are deep, so white does (6.5:1 at worst, also tolls).
 *
 * Every piece of text on either chart clears AA. Light maintenance used to be
 * the exception, at 2.4:1 under white - closing it is what moved the light warn
 * shade to a deep burnt orange, and the legend dot followed on its own, because
 * `.fleet-cost-tone-maintenance` is a `--ig-warn-500` reference.
 *
 * The two grays are chosen rather than derived. `label` is gray-700 in both:
 * the ramp inverts off the surface's luminance, and 700 is the shallowest tone
 * that clears AA on each - gray-600 reads fine over near-black but falls to
 * 4.1:1 on paper. `gridline` is not text, so it is held to 1.4.11's 3:1
 * instead, and it cannot take one shade for both: the tone that reads as a
 * hairline over near-black is a bright line on paper, so the two appearances
 * take different ends of the ramp (3.2:1 dark, 4.1:1 light). This is the same
 * split the sample's border token makes in CSS, where `light-dark()` can
 * express it - and the light half is 600 for the same reason it is there: 500
 * measures 2.997:1, just under the bar.
 */
export const FLEET_CHART_THEMES: Readonly<Record<FleetTheme, FleetChartPalette>> = {
  dark: {
    cost: ["#5099f9", "#ed8936", "#85ec97", "#ed546f"],
    onBrush: "#0a0e10",
    spend: ["#5099f9"],
    utilization: ["#5099f9", "#85ec97"],
    label: "#e9eef1",
    gridline: "#4b6477",
    tooltipBackground: "#12171a",
    tooltipBorder: "#334451",
  },
  light: {
    cost: ["#1145a8", "#9a3412", "#166534", "#b91c1c"],
    onBrush: "#ffffff",
    spend: ["#1145a8"],
    utilization: ["#1145a8", "#166534"],
    label: "#3f5083",
    gridline: "#6075b3",
    tooltipBackground: "#b8dbfe",
    tooltipBorder: "#91c7fe",
  },
};

/**
 * The chart engine's lookup key for the box it paints behind a tooltip. A CSS
 * class name in shape only - nothing in the document carries it.
 */
const FLEET_POINTER_TOOLTIP_KEY = "ui-chart-pointer-tooltip";

/** The styling table is typed by its default entries; the sample adds one of its own. */
const chartStylingDefaults = DataChartStylingDefaults as unknown as Record<string, unknown>;

/** Chart hosts that rely on the table entry below, so it outlives exactly the charts it themes. */
let fleetTooltipThemeHolders = 0;

/**
 * Themes the rectangle the engine paints behind every chart tooltip.
 *
 * There is no input for it. The fill and border come from a CSS-shaped lookup
 * the engine makes through its renderer, and the category and doughnut charts
 * are both constructed with their defaults source on - so that lookup never
 * touches the document and `DataChartStylingDefaults`, the table the chart is
 * handed at construction, is the only thing it can see.
 *
 * The DOM tooltip that `.ig-tooltip-container-background` themes floats on top
 * of this rectangle at the same size, so the two have to agree: the border is
 * dropped here and left to the box above, and only the fill is stated, to keep
 * a stray hairline of the wrong colour from showing at the edges.
 *
 * The engine reads the table while a chart is being constructed, and the
 * default tooltips read its fill again each time they show. So the entry has to
 * be in place before a chart is created and stay for as long as one is on the
 * page; the charts are re-created when the appearance flips.
 *
 * `DataChartStylingDefaults` is the charts package's own table, shared by every
 * chart on the page, so the entry is counted: the first holder puts it in and
 * the last one to let go takes it down, leaving the package's default for
 * whatever opens next. Call it from an effect, and return the result from it.
 */
export function retainFleetTooltipTheme(palette: FleetChartPalette): () => void {
  chartStylingDefaults[FLEET_POINTER_TOOLTIP_KEY] = {
    "background-color": palette.tooltipBackground,
    "border-top-color": palette.tooltipBackground,
    "border-top-width": "0",
  };
  fleetTooltipThemeHolders++;

  return () => {
    if (--fleetTooltipThemeHolders === 0) {
      delete chartStylingDefaults[FLEET_POINTER_TOOLTIP_KEY];
    }
  };
}

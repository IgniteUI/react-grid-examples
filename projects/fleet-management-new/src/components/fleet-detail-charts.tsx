import { useLayoutEffect, useState } from "react";
import {
  IgrCategoryChart,
  IgrCategoryChartModule,
  IgrDoughnutChart,
  IgrDoughnutChartModule,
  IgrRingSeries,
  IgrRingSeriesModule,
  LabelsPosition,
  type IIgrCategoryChartProps,
  type IIgrDoughnutChartProps,
} from "igniteui-react-charts";
import { Visibility, type IChartTooltipProps } from "igniteui-react-core";
import { retainFleetTooltipTheme, type FleetChartPalette } from "../services/fleet-chart-theme";
import {
  fleetCurrencyAxisLabel,
  type FleetCostDistributionPoint,
  type FleetMonthlySpendPoint,
  type FleetUtilizationComparisonPoint,
} from "../services/fleet-detail";
import { useChartHost, type ChartConstructionProps, type DestroyableChart } from "../chart-attachment";

IgrCategoryChartModule.register();
IgrDoughnutChartModule.register();
IgrRingSeriesModule.register();

// The two charts as the sample uses them: each reports the instances it is
// constructed as, so a spare one that never mounts is destroyed too.
//
// That only matters in development. StrictMode constructs every chart twice and
// mounts one; the spare has no `componentWillUnmount` to stop it, and the
// package's charts keep polling their size until `destroy()`. A production
// build constructs each chart once and the instance reported is the mounted
// one, so the subclasses change nothing there. They depend on the constructor
// and `props` contract of igniteui-react-charts 19.6.0: drop them once the
// wrappers call `destroy()` when they unmount.
class FleetCategoryChart extends IgrCategoryChart {
  declare props: Readonly<IIgrCategoryChartProps & ChartConstructionProps>;

  constructor(props: IIgrCategoryChartProps & ChartConstructionProps) {
    super(props);
    props.onConstructed?.(this);
  }
}

class FleetDoughnutChart extends IgrDoughnutChart {
  declare props: Readonly<IIgrDoughnutChartProps & ChartConstructionProps>;

  constructor(props: IIgrDoughnutChartProps & ChartConstructionProps) {
    super(props);
    props.onConstructed?.(this);
  }
}

const FLEET_CHART_LABEL_FONT = "500 12px 'DM Sans', sans-serif";

/**
 * Puts the sample's tooltip entry in the charts' styling table, which the engine
 * reads while a chart is being constructed, and reports once it is there. The
 * entry goes in from a layout effect, so the chart is created in the render that
 * follows and before the first paint; rendering stays free of the global write.
 */
function useTooltipTheme(palette: FleetChartPalette): boolean {
  const [themed, setThemed] = useState(false);

  useLayoutEffect(() => {
    setThemed(true);
    return retainFleetTooltipTheme(palette);
  }, [palette]);

  return themed;
}

/** What each chart host needs: its tooltip entry in place, then the attach and destroy bookkeeping. */
function useFleetChartHost<T extends DestroyableChart>(palette: FleetChartPalette) {
  return useChartHost<T>(useTooltipTheme(palette));
}

/**
 * The donut's own tooltip. The package default reads "value : 812" off the
 * member paths; the slice already carries its share as a label, so the tooltip
 * is the one place the money itself can be named.
 */
function FleetCostSliceTooltip({ dataContext }: IChartTooltipProps) {
  const item = dataContext?.item as FleetCostDistributionPoint | undefined;
  if (!item) return null;

  return (
    <div className="fleet-chart-tooltip">
      <span className="fleet-chart-tooltip-label">{item.label}</span>
      <span className="fleet-chart-tooltip-value">
        {fleetCurrencyAxisLabel(item.value)} · {item.percentage}
      </span>
    </div>
  );
}

interface FleetCostDonutProps {
  data: FleetCostDistributionPoint[];
  palette: FleetChartPalette;
}

/**
 * Re-created whenever the appearance flips (the parent keys it on the theme):
 * the engine reads the tooltip styling table while the chart is being
 * constructed, so a chart built for the other palette would keep its colours.
 */
export function FleetCostDonut({ data, palette }: FleetCostDonutProps) {
  const { hostRef, chartRef, exists, onConstructed } = useFleetChartHost<FleetDoughnutChart>(palette);

  return (
    <div className="fleet-cost-donut" ref={hostRef}>
      {exists && (
        <FleetDoughnutChart ref={chartRef} onConstructed={onConstructed} width="100%" height="280px" allowSliceSelection={false} allowSliceExplosion={false} innerExtent={62}>
          <IgrRingSeries
            name="fleetCostRing"
            dataSource={data}
            valueMemberPath="value"
            labelMemberPath="displayLabel"
            labelsPosition={LabelsPosition.Center}
            leaderLineVisibility={Visibility.Collapsed}
            labelInnerColor={palette.onBrush}
            tooltipTemplate={FleetCostSliceTooltip}
            brushes={palette.cost}
            outlines={palette.cost}
            textStyle="600 12px 'DM Sans', sans-serif"
          />
        </FleetDoughnutChart>
      )}
    </div>
  );
}

interface FleetMonthlySpendChartProps {
  data: FleetMonthlySpendPoint[];
  palette: FleetChartPalette;
}

/**
 * `crosshairsAnnotation*TextColor` is set on both category charts. The bubble
 * the crosshair puts on the axis under the cursor is painted in the series
 * brush, and left alone the engine auto-contrasts its text between a hardcoded
 * #666 and white - which on the accent picks the gray and lands at 2.7:1.
 * Naming the colour outright skips that choice. The background stays the
 * brush, so the bubble is still colour-coded to the series it is reading.
 */
export function FleetMonthlySpendChart({ data, palette }: FleetMonthlySpendChartProps) {
  const { hostRef, chartRef, exists, onConstructed } = useFleetChartHost<FleetCategoryChart>(palette);

  return (
    <div className="fleet-cost-column-chart" ref={hostRef}>
      {exists && (
        <FleetCategoryChart
          ref={chartRef}
          onConstructed={onConstructed}
          width="100%"
          height="280px"
          dataSource={data}
          chartType="Column"
          xAxisLabel="month"
          includedProperties={["spend"]}
          yAxisMinimumValue={0}
          yAxisFormatLabel={fleetCurrencyAxisLabel}
          crosshairsAnnotationXAxisTextColor={palette.onBrush}
          crosshairsAnnotationYAxisTextColor={palette.onBrush}
          isTransitionInEnabled={false}
          brushes={palette.spend}
          outlines={palette.spend}
          xAxisLabelTextStyle={FLEET_CHART_LABEL_FONT}
          yAxisLabelTextStyle={FLEET_CHART_LABEL_FONT}
          xAxisLabelTextColor={palette.label}
          yAxisLabelTextColor={palette.label}
          xAxisMajorStroke={palette.gridline}
          yAxisMajorStroke={palette.gridline}
          xAxisMajorStrokeThickness={1}
          yAxisMajorStrokeThickness={1}
          isHorizontalZoomEnabled={false}
          isVerticalZoomEnabled={false}
          thickness={1}
        />
      )}
    </div>
  );
}

interface FleetUtilizationChartProps {
  data: FleetUtilizationComparisonPoint[];
  palette: FleetChartPalette;
}

export function FleetUtilizationChart({ data, palette }: FleetUtilizationChartProps) {
  const { hostRef, chartRef, exists, onConstructed } = useFleetChartHost<FleetCategoryChart>(palette);

  return (
    <div className="fleet-utilization-comparison-chart" ref={hostRef}>
      {exists && (
        <FleetCategoryChart
          ref={chartRef}
          onConstructed={onConstructed}
          width="100%"
          height="320px"
          dataSource={data}
          chartType="Column"
          xAxisLabel="month"
          includedProperties={["currentYear", "priorYear"]}
          yAxisMinimumValue={0}
          crosshairsAnnotationXAxisTextColor={palette.onBrush}
          crosshairsAnnotationYAxisTextColor={palette.onBrush}
          isTransitionInEnabled={false}
          brushes={palette.utilization}
          outlines={palette.utilization}
          xAxisLabelTextStyle={FLEET_CHART_LABEL_FONT}
          yAxisLabelTextStyle={FLEET_CHART_LABEL_FONT}
          xAxisLabelTextColor={palette.label}
          yAxisLabelTextColor={palette.label}
          xAxisMajorStroke={palette.gridline}
          yAxisMajorStroke={palette.gridline}
          xAxisMajorStrokeThickness={1}
          yAxisMajorStrokeThickness={1}
          isHorizontalZoomEnabled={false}
          isVerticalZoomEnabled={false}
          thickness={1}
        />
      )}
    </div>
  );
}

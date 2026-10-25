import { useRef } from "react";
import { IgrCategoryChart, IgrCategoryChartModule } from "igniteui-react-charts";
import type { IChartTooltipProps } from "igniteui-react-core";
import { revenueTrend, type RevenuePoint } from "../data/sales-data";
import { CHART_LABEL_FONT, type SalesChartPalette } from "../theme/chart-theme";
import { useChartTeardown } from "../hooks/use-chart-teardown";

IgrCategoryChartModule.register();

/** The series whose tooltip speaks for the point: both lines show the same text. */
const SPEAKING_SERIES = "revenue" satisfies keyof RevenuePoint;

function TrendTooltip({ dataContext }: IChartTooltipProps) {
  const series = dataContext.series as { valueMemberPath: string };
  if (series.valueMemberPath !== SPEAKING_SERIES) return null;

  const item = dataContext.item as RevenuePoint;
  return (
    <div className="chart-tip">
      <span className="chart-tip-label">{item.month}</span>
      <span className="chart-tip-value">
        Revenue {item.revenue}K · Target {item.targetLine}K
      </span>
    </div>
  );
}

interface RevenueTrendChartProps {
  palette: SalesChartPalette;
}

/** Revenue and target by month, as two lines. */
export default function RevenueTrendChart({ palette }: RevenueTrendChartProps) {
  const chartRef = useRef<IgrCategoryChart>(null);
  useChartTeardown(chartRef);

  return (
    <IgrCategoryChart
      ref={chartRef}
      width="100%"
      height="100%"
      dataSource={revenueTrend}
      xAxisLabelTextStyle={CHART_LABEL_FONT}
      yAxisLabelTextStyle={CHART_LABEL_FONT}
      xAxisLabelTextColor={palette.label}
      yAxisLabelTextColor={palette.label}
      xAxisMajorStroke={palette.gridline}
      yAxisMajorStroke={palette.gridline}
      crosshairsAnnotationXAxisBackground={palette.bubble}
      crosshairsAnnotationXAxisTextColor={palette.bubbleText}
      crosshairsAnnotationYAxisBackground={palette.bubble}
      crosshairsAnnotationYAxisTextColor={palette.bubbleText}
      xAxisLabel="month"
      includedProperties={["month", "revenue", "targetLine"]}
      brushes={palette.trend}
      outlines={palette.trend}
      markerBrushes={palette.trend}
      markerOutlines={palette.trend}
      chartType="line"
      toolTipType="Item"
      tooltipTemplate={TrendTooltip}
      isItemHighlightingEnabled={false}
      isHorizontalZoomEnabled={false}
      isVerticalZoomEnabled={false}
      thickness={2}
      yAxisInterval={25}
      yAxisMinimumValue={620}
      yAxisMaximumValue={810}
    />
  );
}

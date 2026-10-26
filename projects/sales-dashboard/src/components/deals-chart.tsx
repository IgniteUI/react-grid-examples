import { useRef } from "react";
import { IgrCategoryChart, IgrCategoryChartModule } from "igniteui-react-charts";
import type { IChartTooltipProps } from "igniteui-react-core";
import { weeklyDeals, type WeeklyDeals } from "../data/sales-data";
import { CHART_LABEL_FONT, type SalesChartPalette } from "../theme/chart-theme";
import { useChartTeardown } from "../hooks/use-chart-teardown";

IgrCategoryChartModule.register();

function DealsTooltip({ dataContext }: IChartTooltipProps) {
  const item = dataContext.item as WeeklyDeals;
  return (
    <div className="chart-tip">
      <span className="chart-tip-label">{item.day}</span>
      <span className="chart-tip-value">{item.deals} deals</span>
    </div>
  );
}

interface DealsChartProps {
  palette: SalesChartPalette;
}

/** Deals closed per weekday, as columns. */
export default function DealsChart({ palette }: DealsChartProps) {
  const chartRef = useRef<IgrCategoryChart>(null);
  useChartTeardown(chartRef);

  return (
    <IgrCategoryChart
      ref={chartRef}
      width="100%"
      height="100%"
      dataSource={weeklyDeals}
      xAxisLabel="day"
      brushes={palette.deals}
      outlines={palette.deals}
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
      toolTipType="Item"
      tooltipTemplate={DealsTooltip}
      chartType="column"
      isHorizontalZoomEnabled={false}
      isVerticalZoomEnabled={false}
      thickness={1}
      yAxisInterval={10}
      yAxisMinimumValue={0}
      yAxisMaximumValue={50}
    />
  );
}

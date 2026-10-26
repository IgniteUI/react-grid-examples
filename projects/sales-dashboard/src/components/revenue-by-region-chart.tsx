import { useRef } from "react";
import { IgrDoughnutChart, IgrDoughnutChartModule, IgrRingSeries, IgrRingSeriesModule } from "igniteui-react-charts";
import type { IChartTooltipProps } from "igniteui-react-core";
import { revenueByRegion, type RegionShare } from "../data/sales-data";
import type { SalesChartPalette } from "../theme/chart-theme";
import { useChartTeardown } from "../hooks/use-chart-teardown";

IgrDoughnutChartModule.register();
IgrRingSeriesModule.register();

function RegionTooltip({ dataContext }: IChartTooltipProps) {
  const item = dataContext.item as RegionShare;
  return (
    <div className="chart-tip">
      <span className="chart-tip-label">{item.region}</span>
      <span className="chart-tip-value">{item.value}% of revenue</span>
    </div>
  );
}

interface RevenueByRegionChartProps {
  palette: SalesChartPalette;
}

/** Each region's share of the revenue, as a doughnut. */
export default function RevenueByRegionChart({ palette }: RevenueByRegionChartProps) {
  const chartRef = useRef<IgrDoughnutChart>(null);
  useChartTeardown(chartRef);

  return (
    <IgrDoughnutChart
      ref={chartRef}
      width="100%"
      height="100%"
      allowSliceSelection={true}
      allowSliceExplosion={true}
      innerExtent={55}
    >
      <IgrRingSeries
        name="regionRing"
        dataSource={revenueByRegion}
        valueMemberPath="value"
        labelMemberPath="region"
        labelsPosition="outsideEnd"
        tooltipTemplate={RegionTooltip}
        brushes={palette.series}
        outlines={palette.series}
        labelOuterColor={palette.sliceLabel}
        labelInnerColor={palette.sliceLabel}
      />
    </IgrDoughnutChart>
  );
}

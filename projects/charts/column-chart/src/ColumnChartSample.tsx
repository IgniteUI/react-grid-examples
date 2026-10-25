import {
  IgrCategoryChart,
  IgrCategoryChartModule,
  IgrLegend,
  IgrLegendModule,
} from "igniteui-react-charts";
import "./ColumnChartSample.scss";
import { useState } from "react";

IgrCategoryChartModule.register();
IgrLegendModule.register();

function ColumnChartSample() {

  const [legend, setLegend] = useState<IgrLegend | null>(null);

  const chartData = [
    { month: "January", temperature: 3 },
    { month: "February", temperature: 4 },
    { month: "March", temperature: 9 },
    { month: "April", temperature: 15 },
    { month: "May", temperature: 21 },
    { month: "June", temperature: 26 },
    { month: "July", temperature: 29 },
    { month: "August", temperature: 28 },
    { month: "September", temperature: 24 },
    { month: "October", temperature: 18 },
    { month: "November", temperature: 11 },
    { month: "December", temperature: 5 },
  ];

  return (
    <div className="container">
      <div className="legend-title">Average Max Temperature</div>

      <div className="legend">
        <IgrLegend orientation="Horizontal" ref={setLegend} />
      </div>

      <IgrCategoryChart
        width="100%"
        height="100%"
        dataSource={chartData}
        legend={legend}
        chartType="Column"
        yAxisTitle="Temperature in °C"
        yAxisTitleLeftMargin={10}
        yAxisTitleRightMargin={5}
        yAxisLabelLeftMargin={0}
        highlightingMode="FadeOthersSpecific"
        highlightingBehavior="NearestItemsAndSeries"
        isHorizontalZoomEnabled={false}
        isVerticalZoomEnabled={false}
      />
    </div>
  );
}

export default ColumnChartSample;

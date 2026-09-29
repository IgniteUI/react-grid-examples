import {
  IgrCategoryChart,
  IgrCategoryChartModule,
  IgrDataChart,
  IgrDataChartCoreModule,
  IgrDataChartCategoryCoreModule,
  IgrDataChartCategoryModule,
  IgrDataChartVerticalCategoryModule,
  IgrDataChartInteractivityModule,
  IgrCategoryXAxis,
  IgrNumericYAxis,
  IgrCategoryYAxis,
  IgrNumericXAxis,
  IgrAreaSeries,
  IgrLineSeries,
  IgrBarSeries,
  IgrColumnSeries,
  IgrDataToolTipLayer,
} from "igniteui-react-charts";
import { vibrationSeries, vibrationTarget, type Defect } from "./data";

// DV charts require one-time module registration at module scope.
[
  IgrCategoryChartModule,
  IgrDataChartCoreModule,
  IgrDataChartCategoryCoreModule,
  IgrDataChartCategoryModule,
  IgrDataChartVerticalCategoryModule,
  IgrDataChartInteractivityModule,
].forEach((m) => m.register());

const VIOLET = "#6d4aff";
const VIOLET_FILL = "rgba(109, 74, 255, 0.16)";
const AMBER = "#c98a12";
const AXIS_LABEL = "#8a909c";

/* --- Spindle vibration: area series + amber target line (IgrDataChart) --- */
export function VibrationChart() {
  const data = vibrationSeries.map((v, i) => ({ t: `${i + 1}`, value: v, target: vibrationTarget }));
  return (
    <IgrDataChart
      dataSource={data}
      width="100%"
      height="84px"
      isHorizontalZoomEnabled={false}
      isVerticalZoomEnabled={false}
    >
      <IgrCategoryXAxis name="vx" label="t" dataSource={data} labelVisibility="Collapsed" majorStroke="transparent" />
      <IgrNumericYAxis name="vy" minimumValue={2} maximumValue={4.7} labelVisibility="Collapsed" majorStroke="transparent" minorStroke="transparent" />
      <IgrAreaSeries name="vArea" xAxisName="vx" yAxisName="vy" dataSource={data} valueMemberPath="value" brush={VIOLET_FILL} outline={VIOLET} thickness={2} markerType="None" isTransitionInEnabled={false} />
      <IgrLineSeries name="vTarget" xAxisName="vx" yAxisName="vy" dataSource={data} valueMemberPath="target" brush={AMBER} thickness={1.5} markerType="None" />
    </IgrDataChart>
  );
}

/* --- Defect Pareto: horizontal bars (IgrDataChart) --- */
export function ParetoChart({ defects }: { defects: Defect[] }) {
  return (
    <IgrDataChart
      dataSource={defects}
      width="100%"
      height="150px"
      isHorizontalZoomEnabled={false}
      isVerticalZoomEnabled={false}
    >
      <IgrCategoryYAxis name="py" label="label" dataSource={defects} isInverted={true} gap={0.55} labelTextColor="#42474f" majorStroke="transparent" />
      <IgrNumericXAxis name="px" minimumValue={0} labelVisibility="Collapsed" majorStroke="transparent" minorStroke="transparent" />
      <IgrBarSeries name="pBars" xAxisName="px" yAxisName="py" dataSource={defects} valueMemberPath="count" brush={VIOLET} outline={VIOLET} showDefaultTooltip={true} isTransitionInEnabled={false} />
      <IgrDataToolTipLayer name="pTip" />
    </IgrDataChart>
  );
}

/* --- Previous-10-lots trend line (IgrCategoryChart) --- */
export function TrendChart({ points }: { points: number[] }) {
  const data = points.map((v, i) => ({ label: `${i + 1}`, v }));
  return (
    <IgrCategoryChart
      dataSource={data}
      chartType="Line"
      includedProperties={["v"]}
      width="100%"
      height="46px"
      isTransitionInEnabled={false}
      isHorizontalZoomEnabled={false}
      isVerticalZoomEnabled={false}
      brushes={[VIOLET]}
      outlines={[VIOLET]}
      markerTypes="None"
      thickness={2}
      xAxisLabelVisibility="Collapsed"
      yAxisLabelVisibility="Collapsed"
      xAxisMajorStroke="transparent"
      yAxisMajorStroke="transparent"
      yAxisMinorStroke="transparent"
      xAxisTitleTextColor={AXIS_LABEL}
    />
  );
}

/* --- Downtime Pareto: columns (minutes) + cumulative % line (IgrDataChart) --- */
export function ParetoComboChart({ points }: { points: { reason: string; minutes: number; cumulative: number }[] }) {
  return (
    <IgrDataChart dataSource={points} width="100%" height="240px" isHorizontalZoomEnabled={false} isVerticalZoomEnabled={false}>
      <IgrCategoryXAxis name="rx" label="reason" dataSource={points} labelAngle={-18} labelTextColor={AXIS_LABEL} majorStroke="transparent" gap={0.5} />
      <IgrNumericYAxis name="ry" minimumValue={0} labelTextColor={AXIS_LABEL} majorStroke="#eceef2" minorStroke="transparent" />
      <IgrNumericYAxis name="ry2" minimumValue={0} maximumValue={100} labelLocation="OutsideRight" labelTextColor={AXIS_LABEL} majorStroke="transparent" minorStroke="transparent" />
      <IgrColumnSeries name="dtCols" xAxisName="rx" yAxisName="ry" dataSource={points} valueMemberPath="minutes" brush={VIOLET} outline={VIOLET} showDefaultTooltip={true} isTransitionInEnabled={false} />
      <IgrLineSeries name="dtCum" xAxisName="rx" yAxisName="ry2" dataSource={points} valueMemberPath="cumulative" brush={AMBER} thickness={2} markerType="Circle" markerBrush={AMBER} isTransitionInEnabled={false} />
      <IgrDataToolTipLayer name="paretoTip" />
    </IgrDataChart>
  );
}

/* --- Generic column chart (IgrDataChart) --- */
export function ColumnChart({ data, labelPath, valuePath, height = "200px" }: { data: object[]; labelPath: string; valuePath: string; height?: string }) {
  return (
    <IgrDataChart dataSource={data} width="100%" height={height} isHorizontalZoomEnabled={false} isVerticalZoomEnabled={false}>
      <IgrCategoryXAxis name="cx" label={labelPath} dataSource={data} labelTextColor={AXIS_LABEL} majorStroke="transparent" gap={0.55} />
      <IgrNumericYAxis name="cy" minimumValue={0} labelTextColor={AXIS_LABEL} majorStroke="#eceef2" minorStroke="transparent" />
      <IgrColumnSeries name="cser" xAxisName="cx" yAxisName="cy" dataSource={data} valueMemberPath={valuePath} brush={VIOLET} outline={VIOLET} showDefaultTooltip={true} isTransitionInEnabled={false} />
      <IgrDataToolTipLayer name="colTip" />
    </IgrDataChart>
  );
}

/* --- Generic area trend (IgrCategoryChart) --- */
export function AreaTrendChart({ data, valuePath = "minutes", height = "200px" }: { data: object[]; valuePath?: string; height?: string }) {
  return (
    <IgrCategoryChart
      dataSource={data}
      chartType="Area"
      includedProperties={[valuePath]}
      width="100%"
      height={height}
      isTransitionInEnabled={false}
      isHorizontalZoomEnabled={false}
      isVerticalZoomEnabled={false}
      brushes={[VIOLET_FILL]}
      outlines={[VIOLET]}
      markerTypes="None"
      thickness={2}
      xAxisLabelTextColor={AXIS_LABEL}
      yAxisLabelTextColor={AXIS_LABEL}
      yAxisMajorStroke="#eceef2"
      xAxisMajorStroke="transparent"
    />
  );
}

/* Mini sparkline reused by the downtime offender cards. */
export function MiniTrend({ points }: { points: number[] }) {
  return <TrendChart points={points} />;
}

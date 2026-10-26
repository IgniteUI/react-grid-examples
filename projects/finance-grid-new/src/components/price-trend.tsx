import { memo, useCallback, useEffect, useRef } from "react";
import { IgrSparkline, IgrSparklineModule, SparklineDisplayType, type IIgrSparklineProps } from "igniteui-react-charts";
import { useFinanceView } from "../finance-view-context";
import type { PriceTrendPoint } from "../services/finance-data";
import { sparklineBrush, sparklineNegativeBrush } from "../services/portfolio-format";

IgrSparklineModule.register();

interface TrackedSparklineProps extends IIgrSparklineProps {
  onConstructed?: (chart: IgrSparkline) => void;
}

/**
 * A sparkline that reports every instance React constructs.
 *
 * The chart starts polling its size in its constructor and stops only in
 * `destroy()`. In development StrictMode constructs each class component twice
 * and mounts one of them; the spare is never mounted, so it is only reachable
 * through this report.
 */
class TrackedSparkline extends IgrSparkline {
  declare props: Readonly<TrackedSparklineProps>;

  constructor(props: TrackedSparklineProps) {
    super(props);
    props.onConstructed?.(this);
  }
}

interface PriceTrendProps {
  series: PriceTrendPoint[];
  changePct: number;
}

/**
 * The Price Trend cell: the row's intraday line, coloured by the day's direction.
 *
 * Unmounting the chart does not stop its size polling, and the grid unmounts
 * a cell's content whenever it recycles or drops the cell, so the chart is
 * destroyed once it has really left. StrictMode replays the effect cleanup on a
 * component that stays mounted and runs the effect again straight away, so the
 * destroy waits for a microtask and is skipped if the effect has come back.
 */
function PriceTrend({ series, changePct }: PriceTrendProps) {
  const { isDark } = useFinanceView();
  const chartRef = useRef<IgrSparkline>(null);
  const constructedRef = useRef<IgrSparkline[]>([]);
  const mountedRef = useRef(false);

  const onConstructed = useCallback((chart: IgrSparkline) => {
    constructedRef.current.push(chart);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    const chart = chartRef.current;
    for (const spare of constructedRef.current) {
      if (spare !== chart) spare.destroy();
    }
    constructedRef.current = [];

    return () => {
      mountedRef.current = false;
      queueMicrotask(() => {
        if (!mountedRef.current) chart?.destroy();
      });
    };
  }, []);

  return (
    <div className="price-trend-spark">
      <TrackedSparkline
        ref={chartRef}
        onConstructed={onConstructed}
        width="100%"
        height="100%"
        dataSource={series}
        valueMemberPath="value"
        displayType={SparklineDisplayType.Line}
        lineThickness={1.8}
        brush={sparklineBrush(changePct, isDark)}
        negativeBrush={sparklineNegativeBrush(isDark)}
      />
    </div>
  );
}

export default memo(PriceTrend);

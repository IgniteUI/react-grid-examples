import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { IgrButtonGroup, IgrIcon, IgrToggleButton } from "igniteui-react";
import {
  DataChartStylingDefaults,
  FinancialIndicatorType,
  IgrFinancialChart,
  IgrFinancialChartModule,
  IgrFinancialIndicatorTypeCollection,
} from "igniteui-react-charts";
import { SEED_STOCKS } from "../data/market-seed";
import { useDesk } from "../services/desk";
import type { ThemeMode } from "../services/workspace.service";
import { compact, percentChange, price, signed } from "../util/finance";
import { ICONS } from "../util/icons";
import { useStore } from "../util/use-store";
import { buildHistory, nextCandle, type CandlePoint } from "./price-history";

IgrFinancialChartModule.register();

const SECOND = 1_000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

/**
 * The windows the chart offers, each with the bar it is drawn from.
 *
 * A window implies an interval, so the short ones step in seconds and the long
 * ones in days or weeks. The bar counts keep every window between 60 and 260
 * candles — enough shape to read, few enough to redraw on a tick.
 *
 * Weekends come out of the daily windows only. The intraday ones are drawn as a
 * continuous tape, and the five-year window steps a whole week at a time, so
 * every one of its bars falls on the same weekday.
 */
const RANGE_STEPS = {
  "1 min": { step: SECOND, bars: 60, skipWeekends: false },
  "1 hour": { step: MINUTE, bars: 60, skipWeekends: false },
  "1 week": { step: HOUR, bars: 168, skipWeekends: false },
  "1 month": { step: DAY, bars: 22, skipWeekends: true },
  "3 months": { step: DAY, bars: 63, skipWeekends: true },
  "1 year": { step: DAY, bars: 252, skipWeekends: true },
  "5 years": { step: WEEK, bars: 260, skipWeekends: false },
} as const;

type Range = keyof typeof RANGE_STEPS;
type RangeStep = (typeof RANGE_STEPS)[Range];
const RANGES = Object.keys(RANGE_STEPS) as Range[];

const CHART_TYPES = ["Candle", "Line", "Column", "Bar"] as const;
type ChartType = (typeof CHART_TYPES)[number];

/**
 * Chart colours per theme.
 *
 * The financial chart paints to a canvas and takes plain colour strings, so it
 * cannot read the `--ig-*` tokens. These are literal copies of the palette —
 * success and error for the series, gray-700 for the axis labels, the hairline
 * for the gridlines, gray-100/300/900 for the tooltip and gray-50 for the
 * final-value badges — and have to be changed alongside it.
 */
const CHART_THEMES = {
  dark: {
    up: "#34d399",
    down: "#ff4d6a",
    label: "#7a93b5",
    gridline: "#1e2d44",
    tooltipBackground: "#141e2e",
    tooltipBorder: "#273d58",
    tooltipText: "#e2e8f0",

    // The badges the engine paints in the series brush — the final-value one on
    // each axis and the crosshair's price bubble — so this contrasts with the
    // brush rather than with the desk.
    annotationText: "#0a0d14",

    // The crosshair's time bubble, under the x axis, is not brushed, so both
    // halves are stated to make it a neutral desk chip.
    axisChipBackground: "#273d58",
    axisChipText: "#e2e8f0",
  },
  light: {
    // Same hue angles as the dark pair, deepened for a white ground.
    up: "#147b55",
    down: "#a60722",
    label: "#646a78",
    gridline: "#eeeff2",
    tooltipBackground: "#f8f9fb",
    tooltipBorder: "#cad0d8",
    tooltipText: "#212936",
    annotationText: "#ffffff",
    axisChipBackground: "#cad0d8",
    axisChipText: "#212936",
  },
} as const;

type ChartPalette = (typeof CHART_THEMES)[ThemeMode];

/** Tooltip type, as CSS font shorthands — the engine hands them to the canvas. */
const TOOLTIP_FONT = "11px 'DM Sans', sans-serif";
const TOOLTIP_HEADER_FONT = "700 11px 'DM Sans', sans-serif";

/**
 * The chart engine's lookup key for the tooltip box. A CSS class name in shape
 * only — nothing in the document carries it.
 */
const POINTER_TOOLTIP_KEY = "ui-chart-pointer-tooltip";

/** Charts holding the tooltip entry, so the styling table is cleaned up after the last. */
let tooltipHolders = 0;

/**
 * Themes the box the `Data` tooltip draws, for the next chart to be built.
 *
 * There is no input for it: the box's fill, border and thickness come from a
 * CSS-shaped lookup the engine makes against `DataChartStylingDefaults`, a
 * table shared by every chart on the page, which a chart reads once, while it
 * is being constructed — nothing makes a built chart read it again. The engine
 * reads one border edge and applies it to all four, and draws square corners
 * whatever the table says.
 */
function holdPointerTooltipTheme(palette: ChartPalette): void {
  tooltipHolders++;
  (DataChartStylingDefaults as Record<string, unknown>)[POINTER_TOOLTIP_KEY] = {
    "background-color": palette.tooltipBackground,
    "border-top-color": palette.tooltipBorder,
    "border-top-width": "1px",
  };
}

/** The entry comes back out with the last chart, so it outlives exactly this sample. */
function releasePointerTooltipTheme(): void {
  if (--tooltipHolders === 0) {
    delete (DataChartStylingDefaults as Record<string, unknown>)[POINTER_TOOLTIP_KEY];
  }
}

/** Opening close from the seed table — static, so the history stays stable. */
function anchorPriceOf(symbol: string): number {
  return SEED_STOCKS.find((stock) => stock.symbol === symbol)?.previousClose ?? 200;
}

interface ChartPanelProps {
  symbol: string;
}

function ChartPanel({ symbol }: ChartPanelProps) {
  const [selectedRange, setSelectedRange] = useState<Range>("1 min");
  const [chartType, setChartType] = useState<ChartType>("Line");
  const [showVolume, setShowVolume] = useState(true);
  const [showRsi, setShowRsi] = useState(false);

  /**
   * The visible window — the chart's `dataSource`.
   *
   * Synthetic history, anchored on the instrument's opening close, so it is
   * deterministic per symbol and window and never regenerates on a price tick:
   * its identity changes only with the symbol or the range. Handing the chart a
   * new array once a second would make it re-bind and redraw the whole series;
   * instead the window is rolled and its last candle updated item by item.
   */
  const chartData = useMemo<CandlePoint[]>(
    () => buildHistory(symbol, anchorPriceOf(symbol), RANGE_STEPS[selectedRange]),
    [symbol, selectedRange],
  );

  /** The studies group is multi-select, so both of its events route through here. */
  const toggleStudy = (study: string | undefined, selected: boolean) => {
    if (study === "volume") {
      setShowVolume(selected);
    } else if (study === "rsi") {
      setShowRsi(selected);
    }
  };

  return (
    <div className="desk-pane chart-pane">
      <div className="chart-panel">
        <ChartHeader symbol={symbol} chartData={chartData} range={selectedRange} />

        <div className="chart-toolbar">
          <IgrButtonGroup
            className="chart-group"
            selection="single-required"
            aria-label="Time range"
            onSelect={(event) => {
              const range = RANGES.find((entry) => entry === event.detail);
              if (range) {
                setSelectedRange(range);
              }
            }}
          >
            {RANGES.map((range) => (
              <IgrToggleButton key={range} value={range} selected={selectedRange === range}>
                <span>{range}</span>
              </IgrToggleButton>
            ))}
          </IgrButtonGroup>

          <IgrButtonGroup
            className="chart-group"
            selection="single-required"
            aria-label="Chart type"
            onSelect={(event) => {
              const type = CHART_TYPES.find((entry) => entry === event.detail);
              if (type) {
                setChartType(type);
              }
            }}
          >
            {CHART_TYPES.map((type) => (
              <IgrToggleButton key={type} value={type} selected={chartType === type}>
                <span>{type}</span>
              </IgrToggleButton>
            ))}
          </IgrButtonGroup>

          {/* Multi-select: each study switches on and off on its own. */}
          <IgrButtonGroup
            className="chart-group"
            selection="multiple"
            aria-label="Studies"
            onSelect={(event) => toggleStudy(event.detail, true)}
            onDeselect={(event) => toggleStudy(event.detail, false)}
          >
            <IgrToggleButton value="volume" selected={showVolume}>
              <IgrIcon name="bar_chart" collection={ICONS} aria-hidden="true" />
              <span>Volume</span>
            </IgrToggleButton>
            <IgrToggleButton value="rsi" selected={showRsi}>
              <IgrIcon name="show_chart" collection={ICONS} aria-hidden="true" />
              <span>RSI</span>
            </IgrToggleButton>
          </IgrButtonGroup>
        </div>

        <div className="chart-area">
          <PriceChart
            symbol={symbol}
            chartData={chartData}
            range={selectedRange}
            chartType={chartType}
            showVolume={showVolume}
            showRsi={showRsi}
          />
        </div>
      </div>
    </div>
  );
}

export default memo(ChartPanel);

interface ChartHeaderProps {
  symbol: string;
  chartData: readonly CandlePoint[];
  range: Range;
}

/**
 * Name, price, change, session figures and the position chip. Its own
 * component because it changes on every tick and the chart below does not.
 */
function ChartHeader({ symbol, chartData, range }: ChartHeaderProps) {
  const { market, trading } = useDesk();
  // Re-renders on every tick, and reads the quote, the window and the position
  // as they stand: the feed, the chart and the engine all write in place.
  useStore(market, (state) => state.tick);
  const positions = useStore(trading, (state) => state.positions);
  const quote = market.quoteOf(symbol);
  const position = positions.find((entry) => entry.symbol === symbol);

  const latest = chartData.length > 0 ? chartData[chartData.length - 1] : undefined;
  const currentPrice = quote?.lastPrice ?? latest?.Close ?? 0;
  // Change over the visible window, not just the trading day.
  const rangeChangePct = chartData.length < 2 ? 0 : percentChange(currentPrice, chartData[0].Close);
  const session = {
    open: latest?.Open ?? null,
    high: quote?.dayHigh ?? latest?.High ?? null,
    low: quote?.dayLow ?? latest?.Low ?? null,
    volume: quote?.volume ?? latest?.Volume ?? null,
  };
  const direction = quote ? (quote.positive ? "pos" : "neg") : "";

  return (
    <header className="chart-header">
      <div className="price-block">
        <div className="chart-symbol">
          <span className="chart-ticker">{symbol}</span>
          <span className="chart-name">{quote?.name}</span>
        </div>
        <div className="price-line">
          <span className="current-price mono">{price(currentPrice)}</span>
          <span className={`price-change ${direction}`}>
            {signed(quote?.change)} ({signed(quote?.changePct, "pct")})
          </span>
        </div>
      </div>

      <ul className="ohlc-stats">
        <li className="stat-item">
          <div className="ohlc-stats__label">O</div>
          <span>{price(session.open)}</span>
        </li>
        <li className="stat-item">
          <div className="ohlc-stats__label">H</div>
          <span>{price(session.high)}</span>
        </li>
        <li className="stat-item">
          <div className="ohlc-stats__label">L</div>
          <span>{price(session.low)}</span>
        </li>
        <li className="stat-item">
          <div className="ohlc-stats__label">Vol</div>
          <span>{compact(session.volume)}</span>
        </li>
        <li className="stat-item">
          <div className="ohlc-stats__label">{range}</div>
          <span className={rangeChangePct >= 0 ? "pos" : "neg"}>{signed(rangeChangePct, "pct")}</span>
        </li>
      </ul>

      {position && (
        <div className={`position-chip ${position.openPl >= 0 ? "pos" : "neg"}`}>
          <span className="chip-qty">
            {position.quantity} @ {price(position.avgCost)}
          </span>
          <span className="chip-pl mono">{signed(position.openPl, "money")}</span>
        </div>
      )}
    </header>
  );
}

interface PriceChartProps {
  symbol: string;
  chartData: CandlePoint[];
  range: Range;
  chartType: ChartType;
  showVolume: boolean;
  showRsi: boolean;
}

/**
 * The financial chart. It is built once and re-themed in place: every colour
 * below follows the theme, apart from the price tooltip's, which keeps the
 * theme the chart was built in (see `holdPointerTooltipTheme`).
 */
function PriceChart({ symbol, chartData, range, chartType, showVolume, showRsi }: PriceChartProps) {
  const { market, workspace } = useDesk();
  const chartRef = useRef<IgrFinancialChart>(null);
  const isDark = useStore(workspace, (state) => state.theme === "dark");
  const palette = CHART_THEMES[isDark ? "dark" : "light"];

  /**
   * The colours of the price tooltip. Its box comes from the styling table,
   * which the chart reads only while it is being built, so the entry is
   * written first and the chart mounts once it is in place. The tooltip's text
   * keeps the same theme as its box, or a flip would leave dark text on a dark
   * box.
   */
  const [tooltip, setTooltip] = useState<ChartPalette | null>(null);
  useLayoutEffect(() => {
    const theme = CHART_THEMES[workspace.getSnapshot().theme];
    holdPointerTooltipTheme(theme);
    setTooltip(theme);
    return releasePointerTooltipTheme;
  }, [workspace]);

  /**
   * A typed collection rather than a string: there is no "none" indicator type,
   * and an empty collection is how the chart is told to show no studies.
   */
  const indicatorTypes = useMemo(
    () => new IgrFinancialIndicatorTypeCollection(showRsi ? [FinancialIndicatorType.RelativeStrengthIndex] : []),
    [showRsi],
  );

  // One pass per tick: roll the window as its bars come due, then mark the live
  // candle. Also as soon as the chart is built, and right after a symbol or
  // range change rebuilds the window, so the newest candle is never a tick
  // behind the tape.
  useEffect(() => {
    if (!tooltip) {
      return undefined;
    }
    const update = () => {
      const chart = chartRef.current;
      if (!chart || chartData.length === 0) {
        return;
      }
      const live = market.quoteOf(symbol)?.lastPrice;
      rollWindow(chart, chartData, RANGE_STEPS[range], live);
      markLiveCandle(chart, chartData, live);
    };
    update();
    return market.watch((state) => state.tick, update);
  }, [market, symbol, chartData, range, tooltip]);

  /**
   * A chart must be destroyed explicitly: unmounting it leaves its size watcher
   * and document listener running. The host element goes with the chart, so
   * the chart is destroyed once its host has left the page. Strict Mode replays
   * this cleanup without removing anything, which is why it checks rather than
   * destroying outright.
   */
  const holdChart = useCallback((host: HTMLDivElement | null) => {
    const chart = chartRef.current;
    if (!host || !chart) {
      return undefined;
    }
    return () => {
      setTimeout(() => {
        if (!host.isConnected) {
          chart.destroy();
        }
      });
    };
  }, []);

  if (!tooltip) {
    return null;
  }

  return (
    // `xAxisMode` is Ordinal rather than Time: a true time scale leaves a
    // two-day hole at every weekend the daily windows skip. Ordinal spaces the
    // bars evenly and still labels the axis with their timestamps.
    //
    // `toolTipType="Data"` is the tooltip the engine draws itself, and so the
    // one the styling table reaches. It covers the price pane only; the volume
    // and RSI panes keep the package's own tooltip, themed in the stylesheet.
    <div ref={holdChart} className="chart-host">
      <IgrFinancialChart
        ref={chartRef}
        dataSource={chartData}
        chartType={chartType}
        volumeType={showVolume ? "Column" : "None"}
        indicatorTypes={indicatorTypes}
        xAxisMode="Ordinal"
        zoomSliderType="None"
        isToolbarVisible={false}
        brushes={palette.up}
        outlines={palette.up}
        negativeBrushes={palette.down}
        negativeOutlines={palette.down}
        xAxisLabelTextColor={palette.label}
        yAxisLabelTextColor={palette.label}
        xAxisMajorStroke={palette.gridline}
        yAxisMajorStroke={palette.gridline}
        finalValueAnnotationsTextColor={palette.annotationText}
        crosshairsAnnotationXAxisBackground={palette.axisChipBackground}
        crosshairsAnnotationXAxisTextColor={palette.axisChipText}
        crosshairsAnnotationYAxisTextColor={palette.annotationText}
        toolTipType="Data"
        dataToolTipHeaderTextColor={tooltip.tooltipText}
        dataToolTipTitleTextColor={tooltip.tooltipText}
        dataToolTipLabelTextColor={tooltip.label}
        dataToolTipValueTextColor={tooltip.tooltipText}
        dataToolTipHeaderTextStyle={TOOLTIP_HEADER_FONT}
        dataToolTipTitleTextStyle={TOOLTIP_HEADER_FONT}
        dataToolTipLabelTextStyle={TOOLTIP_FONT}
        dataToolTipValueTextStyle={TOOLTIP_FONT}
        height="100%"
        width="100%"
      />
    </div>
  );
}

/**
 * Advances the window as its bars come due: seals the live bar, appends a new
 * one and drops the oldest, so the window stays the length it claims to be.
 *
 * This is what makes the short windows live rather than a frozen snapshot with
 * one growing candle on the end; the long windows simply never come due. Bars
 * are pushed and shifted in place and the chart is told item by item — a new
 * array would re-bind and redraw the series.
 */
function rollWindow(chart: IgrFinancialChart, data: CandlePoint[], spec: RangeStep, live: number | undefined): void {
  // A backgrounded tab can come back hours later. Rolling a whole window's
  // worth of bars one at a time would just rebuild it, so that is the cap.
  const newest = data[data.length - 1].Date.getTime();
  const due = Math.min(Math.floor((Date.now() - newest) / spec.step), spec.bars);
  if (due <= 0) {
    return;
  }

  for (let index = 1; index <= due; index++) {
    const previous = data[data.length - 1];
    // Only the bar that is still open takes the live price. Any bars behind it
    // are ones nobody watched, so they close where they opened.
    const close = index === due && live !== undefined ? live : previous.Close;
    const candle = nextCandle(previous, spec, close, newest + index * spec.step);

    data.push(candle);
    chart.notifyInsertItem(data, data.length - 1, candle);

    const dropped = data[0];
    data.shift();
    chart.notifyRemoveItem(data, 0, dropped);
  }
}

/**
 * Rolls the live price into the last candle and tells the chart about that one
 * item — the chart's equivalent of the grid's `markForCheck()`.
 */
function markLiveCandle(chart: IgrFinancialChart, data: CandlePoint[], live: number | undefined): void {
  if (live === undefined) {
    return;
  }

  const index = data.length - 1;
  const previous = data[index];
  if (previous.Close === live) {
    return;
  }

  const updated: CandlePoint = {
    ...previous,
    Close: live,
    High: Math.max(previous.High, live),
    Low: Math.min(previous.Low, live),
  };

  data[index] = updated;
  chart.notifySetItem(data, index, previous, updated);
}

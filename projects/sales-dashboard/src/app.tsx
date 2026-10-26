import { useEffect, useLayoutEffect, useState } from "react";
import DashboardHeader from "./components/dashboard-header";
import DealsChart from "./components/deals-chart";
import Leaderboard from "./components/leaderboard";
import MetricCards from "./components/metric-cards";
import RecentActivityGrid from "./components/recent-activity-grid";
import RevenueByRegionChart from "./components/revenue-by-region-chart";
import RevenueTrendChart from "./components/revenue-trend-chart";
import { useFontsReady } from "./hooks/use-fonts-ready";
import { revenueByRegion } from "./data/sales-data";
import { applySalesTooltipTheme, retainSalesTooltipTheme, SALES_CHART_THEMES } from "./theme/chart-theme";
import { loadChartFonts } from "./theme/fonts";
import { registerSalesIcons } from "./theme/icons";

export default function SalesDashboard() {
  const [isDark, setIsDark] = useState(false);
  const appearance = isDark ? "dark" : "light";
  const palette = SALES_CHART_THEMES[appearance];

  // The charts lay their labels out once, when they are built, so they wait for the faces.
  const chartsReady = useFontsReady(loadChartFonts);

  // The charts read the tooltip styling table when they are constructed, which
  // happens after this component has rendered, so the entry has to be set here.
  applySalesTooltipTheme(palette);

  // Registered before the first paint, so no icon shows up empty.
  useLayoutEffect(registerSalesIcons, []);
  useEffect(retainSalesTooltipTheme, []);

  // The tooltip DOM is moved to `<body>`, out of reach of the dashboard's palette
  // and of its `.dark-theme` class, so the appearance is mirrored there for the
  // tooltip styles to key off. Taken down again on unmount, since the class
  // outlives the dashboard otherwise.
  useEffect(() => {
    document.body.classList.toggle("sd-dark", isDark);
    return () => document.body.classList.remove("sd-dark");
  }, [isDark]);

  return (
    <div className={isDark ? "sales-dashboard dark-theme" : "sales-dashboard"}>
      <DashboardHeader isDark={isDark} onToggleTheme={() => setIsDark((dark) => !dark)} />

      <MetricCards />

      <section className="upper-panels">
        <article className="panel trend-panel">
          <header className="panel-title split">
            <span>Revenue Trend</span>
            <div className="trend-legend" aria-label="Revenue trend legend">
              <span className="trend-legend-item">
                <span className="trend-legend-swatch" style={{ background: palette.trend[0] }} />
                <span>Revenue</span>
              </span>
              <span className="trend-legend-item">
                <span className="trend-legend-swatch" style={{ background: palette.trend[1] }} />
                <span>Target</span>
              </span>
            </div>
          </header>
          <div className="panel-body">
            {/* A chart per appearance: the charts take their colours when they are built. */}
            <div className="chart-box">{chartsReady && <RevenueTrendChart key={appearance} palette={palette} />}</div>
          </div>
        </article>

        <article className="panel region-panel">
          <header className="panel-title">Revenue by Region</header>
          <div className="panel-body">
            <p className="subtle">$842K total</p>
            <div className="donut-box">{chartsReady && <RevenueByRegionChart key={appearance} palette={palette} />}</div>

            <ul className="legend-list" aria-label="Revenue by region legend">
              {revenueByRegion.map((region, index) => (
                <li key={region.region}>
                  <span className="legend-name-wrap">
                    <span className="legend-swatch" style={{ background: palette.series[index] }} />
                    <span className="legend-name">{region.region}</span>
                  </span>
                  <span className="legend-value">{`${region.value}%`}</span>
                </li>
              ))}
            </ul>
          </div>
        </article>

        <article className="panel deals-panel">
          <header className="panel-title split">
            <span>Deals Closed This Week</span>
            <span className="subtle">37 total</span>
          </header>
          <div className="panel-body">
            <div className="deals-chart">{chartsReady && <DealsChart key={appearance} palette={palette} />}</div>
          </div>
        </article>
      </section>

      <section className="lower-panels">
        <section className="panel activity-panel">
          <header className="panel-title split">
            <span>Recent Activity</span>
          </header>
          <div className="panel-body">
            <RecentActivityGrid />
          </div>
        </section>

        <article className="panel leaderboard-panel">
          <header className="panel-title">Leaderboard</header>
          <div className="panel-body">
            <Leaderboard />
          </div>
        </article>
      </section>
    </div>
  );
}

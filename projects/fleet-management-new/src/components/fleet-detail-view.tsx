import { useState } from "react";
import { IgrCard, IgrCardContent, IgrIcon, IgrTab, IgrTabs } from "igniteui-react";
import { useFleetDetailContext } from "../fleet-context";
import { fleetCostToneClass, fleetMaintenanceStatusClass, type FleetDetail } from "../services/fleet-detail";
import { FLEET_ICON_COLLECTION } from "../services/fleet-icons";
import { fleetVehicleColor, type FleetVehicle } from "../services/fleet-service";
import { FleetCostDonut, FleetMonthlySpendChart, FleetUtilizationChart } from "./fleet-detail-charts";

const FLEET_DETAIL_TABS = ["Details", "Trip History", "Maintenance", "Cost", "Utilization"] as const;

type FleetDetailTab = (typeof FLEET_DETAIL_TABS)[number];

/**
 * Everything inside an expanded grid row. Only the selected tab's panel is
 * rendered, so the charts exist only while their tab is open.
 */
export default function FleetDetailView({ vehicle }: { vehicle: FleetVehicle }) {
  const [selectedTab, setSelectedTab] = useState<FleetDetailTab>("Details");

  return (
    <div className="fleet-detail-wrap">
      <IgrTabs
        className="fleet-detail-tabs"
        onChange={(event) => {
          const tab = FLEET_DETAIL_TABS.find((candidate) => candidate === event.detail.label);
          if (tab) setSelectedTab(tab);
        }}
      >
        {FLEET_DETAIL_TABS.map((tab) => (
          <IgrTab key={tab} label={tab} selected={tab === selectedTab}>
            {tab === selectedTab ? <FleetDetailPanel tab={tab} vehicle={vehicle} /> : null}
          </IgrTab>
        ))}
      </IgrTabs>
    </div>
  );
}

function FleetDetailPanel({ tab, vehicle }: { tab: FleetDetailTab; vehicle: FleetVehicle }) {
  const { detailOf } = useFleetDetailContext();
  const detail = detailOf(vehicle);

  switch (tab) {
    case "Details":
      return <FleetDetailsPanel vehicle={vehicle} />;
    case "Trip History":
      return <FleetTripHistoryPanel detail={detail} />;
    case "Maintenance":
      return <FleetMaintenancePanel detail={detail} />;
    case "Cost":
      return <FleetCostPanel detail={detail} />;
    case "Utilization":
      return <FleetUtilizationPanel detail={detail} />;
  }
}

function FleetDetailsPanel({ vehicle }: { vehicle: FleetVehicle }) {
  const { photoOf, skipPhoto } = useFleetDetailContext();
  // Steps through the shots in the pinned folder. Every file there is the same
  // car, so a fallback changes the angle and never the colour.
  const photo = photoOf(vehicle);
  const color = fleetVehicleColor(vehicle);
  const [doors, seats] = vehicle.specs.doorsSeats.split(" / ");

  return (
    <div className="fleet-detail-content">
      <IgrCard className="fleet-vehicle-card">
        <IgrCardContent>
          <div className="fleet-vehicle-illustration">
            {photo ? (
              <img
                className="fleet-vehicle-photo"
                src={photo.url}
                // Colour first, so the alt text says what the picture shows.
                alt={`${color.name} ${vehicle.make} ${vehicle.model}`}
                loading="lazy"
                decoding="async"
                onError={() => skipPhoto(photo)}
              />
            ) : (
              <div className="fleet-vehicle-photo fleet-vehicle-photo-empty">
                <IgrIcon name="directions_car" collection={FLEET_ICON_COLLECTION} aria-hidden="true" />
                <span>Photo unavailable</span>
              </div>
            )}
          </div>
        </IgrCardContent>
      </IgrCard>

      <div className="fleet-spec-grid">
        <FleetSpec label="Make" value={vehicle.make} />
        <FleetSpec label="Engine" value={vehicle.specs.engine} />
        <FleetSpec label="Generation" value={vehicle.specs.generation} />
        <FleetSpec label="Year" value={vehicle.specs.year} />
        <FleetSpec label="Fuel Type" value={vehicle.specs.fuelType} />
        <FleetSpec label="Power" value={vehicle.specs.power} />
        <FleetSpec label="Mileage" value={vehicle.specs.mileage} />
        <FleetSpec label="Doors" value={doors} />
        <FleetSpec label="Seats" value={seats} />
        <FleetSpec label="Engine Displacement" value={vehicle.specs.cubature} />
        <div className="fleet-spec-item">
          <span>Color</span>
          <strong className="fleet-spec-color">
            {/* The swatch is decorative: the colour name beside it carries the meaning. */}
            <span className="fleet-color-swatch" style={{ backgroundColor: color.hex }} aria-hidden="true" />
            {color.name}
          </strong>
        </div>
        <FleetSpec label="Transmission" value={vehicle.specs.transmission} />
        <FleetSpec label="MSRP" value={vehicle.specs.msrp} />
        <FleetSpec label="Toll Pass ID" value={vehicle.specs.tollPassId} />
        <FleetSpec label="Body Type" value={vehicle.type} />
      </div>
    </div>
  );
}

function FleetSpec({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="fleet-spec-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function FleetKpi({ label, value, accent = false }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="fleet-tab-kpi">
      <span>{label}</span>
      <strong className={accent ? "fleet-accent-value" : undefined}>{value}</strong>
    </div>
  );
}

function FleetTripHistoryPanel({ detail }: { detail: FleetDetail }) {
  return (
    <div className="fleet-tab-panel">
      <div className="fleet-tab-kpis fleet-tab-kpis-3up">
        <FleetKpi label="Trips — Last 30 Days" value={detail.tripSummary.trips} />
        <FleetKpi label="Total distance" value={detail.tripSummary.totalDistance} />
        <FleetKpi label="Avg trip" value={detail.tripSummary.avgTrip} />
      </div>

      <table className="fleet-detail-table fleet-trip-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>From</th>
            <th>To</th>
            <th>Driver</th>
            <th>Start Odometer</th>
            <th>End Odometer</th>
            <th>Distance</th>
            <th className="fleet-status-cell">Duration</th>
          </tr>
        </thead>
        <tbody>
          {detail.tripRows.map((trip) => (
            <tr key={trip.date + trip.from + trip.to}>
              <td>{trip.date}</td>
              <td>{trip.from}</td>
              <td>{trip.to}</td>
              <td>{trip.driver}</td>
              <td>{trip.startMeter}</td>
              <td>{trip.endMeter}</td>
              <td>{trip.distance}</td>
              <td className="fleet-status-cell">{trip.duration}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FleetMaintenancePanel({ detail }: { detail: FleetDetail }) {
  return (
    <div className="fleet-tab-panel">
      <div className="fleet-maintenance-alert">
        <IgrIcon name="build" collection={FLEET_ICON_COLLECTION} />
        <span>{detail.maintenanceNotice}</span>
      </div>

      <table className="fleet-detail-table fleet-maintenance-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Service</th>
            <th>Odometer</th>
            <th>Cost</th>
            <th className="fleet-status-cell">Status</th>
          </tr>
        </thead>
        <tbody>
          {detail.maintenanceRows.map((entry) => (
            <tr key={entry.date + entry.service}>
              <td>{entry.date}</td>
              <td>{entry.service}</td>
              <td>{entry.odometer}</td>
              <td>{entry.cost}</td>
              <td className="fleet-status-cell">
                <span className={`fleet-detail-pill ${fleetMaintenanceStatusClass(entry.status)}`}>{entry.status}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FleetCostPanel({ detail }: { detail: FleetDetail }) {
  const { theme, chartPalette } = useFleetDetailContext();

  return (
    <div className="fleet-tab-panel">
      <div className="fleet-tab-kpis fleet-tab-kpis-3up">
        <FleetKpi label="Total cost — YTD" value={detail.totalCost} accent />
        <FleetKpi label="Largest category" value={detail.topCostCategory} />
        <FleetKpi label="Peak month" value={detail.peakSpendMonth} />
      </div>

      <div className="fleet-cost-charts">
        <section className="fleet-cost-panel">
          <div className="fleet-cost-donut-layout">
            <div className="fleet-cost-donut-legend" aria-label="Cost distribution legend">
              <div className="fleet-cost-panel-title">Cost Breakdown — YTD</div>
              {detail.costDistribution.map((item) => (
                <div className="fleet-cost-donut-legend-item" key={item.label}>
                  <span className="fleet-cost-donut-legend-main">
                    <span className={`fleet-cost-dot ${fleetCostToneClass(item.tone)}`} />
                    <span>{item.label}</span>
                  </span>
                  <strong>{item.percentage}</strong>
                </div>
              ))}
            </div>

            <FleetCostDonut key={theme} data={detail.costDistribution} palette={chartPalette} />
          </div>
        </section>

        <section className="fleet-cost-panel">
          <div className="fleet-cost-panel-title">Monthly Operating Cost</div>
          <FleetMonthlySpendChart key={theme} data={detail.monthlySpend} palette={chartPalette} />
        </section>
      </div>
    </div>
  );
}

function FleetUtilizationPanel({ detail }: { detail: FleetDetail }) {
  const { theme, chartPalette, utilizationYears } = useFleetDetailContext();

  return (
    <div className="fleet-tab-panel">
      <div className="fleet-tab-kpis fleet-tab-kpis-4up">
        <FleetKpi label="Utilization rate" value={detail.utilization.rate} accent />
        <FleetKpi label="Active hours" value={detail.utilization.activeHours} />
        <FleetKpi label="Idle hours" value={detail.utilization.idleHours} />
        <FleetKpi label="Trips this month" value={detail.utilization.trips} />
      </div>

      <div className="fleet-utilization-wrap">
        <div className="fleet-utilization-title">
          Monthly Active Hours — {utilizationYears.current} vs {utilizationYears.prior} {detail.utilizationYoY}
        </div>
        <div className="fleet-utilization-legend" aria-label="Utilization comparison legend">
          <span className="fleet-utilization-legend-item">
            <span className="fleet-utilization-legend-swatch fleet-utilization-legend-swatch-current" />
            <span>{utilizationYears.current}</span>
          </span>
          <span className="fleet-utilization-legend-item">
            <span className="fleet-utilization-legend-swatch fleet-utilization-legend-swatch-prior" />
            <span>{utilizationYears.prior}</span>
          </span>
        </div>
        <FleetUtilizationChart key={theme} data={detail.utilizationSeries} palette={chartPalette} />
      </div>
    </div>
  );
}

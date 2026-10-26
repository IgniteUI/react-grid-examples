import { createContext, useContext } from "react";
import type { ChartAttachmentWatcher } from "./chart-attachment";
import type { FleetChartPalette, FleetTheme } from "./services/fleet-chart-theme";
import type { FleetDetail } from "./services/fleet-detail";
import type { FleetVehicle } from "./services/fleet-service";

/** One shot of a vehicle, and its place in the vehicle's fallback order. */
export interface FleetVehiclePhoto {
  vehicleId: string;
  url: string;
  index: number;
}

/**
 * What the grid's detail rows read from the sample. The grid renders its
 * templates through portals, so they sit under this provider like any other
 * child and stay in step with the sample's state.
 */
export interface FleetDetailContextValue {
  theme: FleetTheme;
  chartPalette: FleetChartPalette;
  utilizationYears: { current: number; prior: number };
  detailOf: (vehicle: FleetVehicle) => FleetDetail;
  /** The shot to show; `undefined` means "show the placeholder". */
  photoOf: (vehicle: FleetVehicle) => FleetVehiclePhoto | undefined;
  /** Called when a shot fails to load: the vehicle moves on to its next shot, or to the placeholder after the last. */
  skipPhoto: (photo: FleetVehiclePhoto) => void;
  /** Tells the detail charts when the grid takes their row out of the page and puts it back. */
  chartAttachments: ChartAttachmentWatcher;
}

export const FleetDetailContext = createContext<FleetDetailContextValue | null>(null);

export function useFleetDetailContext(): FleetDetailContextValue {
  const value = useContext(FleetDetailContext);
  if (!value) throw new Error("Fleet detail views render inside the fleet management sample.");
  return value;
}

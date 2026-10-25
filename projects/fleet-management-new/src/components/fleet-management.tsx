import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import {
  IgrBadge,
  IgrButton,
  IgrButtonGroup,
  IgrChip,
  IgrDialog,
  IgrIcon,
  IgrIconButton,
  IgrInput,
  IgrSnackbar,
  IgrToggleButton,
} from "igniteui-react";
import {
  IgrActionStrip,
  IgrColumn,
  IgrGrid,
  IgrGridState,
  IgrGridToolbar,
  IgrGridToolbarActions,
  IgrGridToolbarAdvancedFiltering,
  IgrGridToolbarHiding,
  IgrGridToolbarPinning,
  IgrGridToolbarTitle,
  type IgrCellTemplateContext,
  type IgrGridMasterDetailContext,
  type IgrRowType,
} from "igniteui-react-grids";
import { ChartAttachmentWatcher } from "../chart-attachment";
import { FleetDetailContext, type FleetDetailContextValue } from "../fleet-context";
import { FLEET_CHART_THEMES, FLEET_DEFAULT_THEME, type FleetTheme } from "../services/fleet-chart-theme";
import { buildFleetDetail, fleetDetailKey, type FleetDetail } from "../services/fleet-detail";
import { FLEET_ICON_COLLECTION, registerFleetIcons } from "../services/fleet-icons";
import {
  createFleetVehicles,
  fleetVehiclePhotoUrls,
  loadFleetVehicleImageCatalog,
  withVehicleStatus,
  type FleetCarImageCatalog,
  type FleetStatus,
  type FleetVehicle,
} from "../services/fleet-service";
import FleetDetailView from "./fleet-detail-view";

type FleetStatusFilter = "all" | FleetStatus;

type FleetSize = "small" | "medium" | "large";

/**
 * How each status presents. The badge is a bare dot, sized off `--ig-size`
 * with the rest of the sample, and the status word beside it carries the
 * meaning. The dot is `aria-hidden`, so the cell reads as its text to a screen
 * reader, and colour is never the only channel.
 */
interface FleetStatusBadge {
  variant: "info" | "success" | "warning";
  /** Only the state that needs acting on draws attention to itself. */
  pulse: boolean;
}

const FLEET_STATUS_BADGES: Readonly<Record<FleetStatus, FleetStatusBadge>> = {
  Active: { variant: "info", pulse: false },
  Available: { variant: "success", pulse: false },
  "In Maintenance": { variant: "warning", pulse: true },
};

/**
 * The row class each status puts on its grid row. The action strip moves into
 * the row it is shown for, so the stylesheet hides the one action that would
 * set the status the row is already in - every status stays reachable from
 * every other one.
 */
const FLEET_STATUS_ROW_CLASSES = {
  "fleet-row-status-active": (row: IgrRowType) => (row.data as FleetVehicle).status === "Active",
  "fleet-row-status-available": (row: IgrRowType) => (row.data as FleetVehicle).status === "Available",
  "fleet-row-status-maintenance": (row: IgrRowType) => (row.data as FleetVehicle).status === "In Maintenance",
};

const FLEET_SIZES: readonly FleetSize[] = ["small", "medium", "large"];

const FLEET_DEFAULT_SIZE: FleetSize = "medium";

/** The snackbar stays up this long after the latest notice, like a restarted auto-hide. */
const FLEET_NOTICE_DISPLAY_TIME = 3000;

const FLEET_RESET_MESSAGE =
  "Vehicle statuses, the status filter, the search, the component size and the theme all go back to how they opened, along with the grid's sorting, filters, column order, pinning and expanded rows.";

/** Grid templates render through portals, so they read the sample's state from context. */
function fleetDetailTemplate(ctx: IgrGridMasterDetailContext): ReactNode {
  const vehicle = ctx.implicit as FleetVehicle;
  // Keyed by vehicle, so a detail row the grid reuses for another vehicle
  // starts over - tab, photo and charts included.
  return <FleetDetailView key={vehicle.id} vehicle={vehicle} />;
}

function fleetStatusCellTemplate(ctx: IgrCellTemplateContext): ReactNode {
  const status = ctx.cell.value as FleetStatus;
  const badge = FLEET_STATUS_BADGES[status];
  return (
    <span className="fleet-status-display">
      <IgrBadge
        className={badge.pulse ? "fleet-status-badge fleet-status-badge-pulse" : "fleet-status-badge"}
        variant={badge.variant}
        dot={true}
        aria-hidden="true"
      />
      <span className="fleet-badge-text">{status}</span>
    </span>
  );
}

export default function FleetManagement() {
  const [vehicles, setVehicles] = useState<FleetVehicle[]>(createFleetVehicles);
  const [catalog, setCatalog] = useState<FleetCarImageCatalog>({});
  /**
   * How far each vehicle has got through its shots: the index of the one to
   * show, and past the last one once every shot has failed. It is kept here
   * rather than in the Details panel, which unmounts whenever another tab
   * opens, so a shot that failed is not requested again on the next visit.
   */
  const [photoProgress, setPhotoProgress] = useState<ReadonlyMap<string, number>>(() => new Map<string, number>());
  const [theme, setTheme] = useState<FleetTheme>(FLEET_DEFAULT_THEME);
  const [size, setSize] = useState<FleetSize>(FLEET_DEFAULT_SIZE);
  const [statusFilter, setStatusFilter] = useState<FleetStatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [notice, setNotice] = useState("");

  /** Relative to today so the sample does not date itself. */
  const [utilizationYears] = useState(() => {
    const current = new Date().getFullYear();
    return { current, prior: current - 1 };
  });

  const gridRef = useRef<IgrGrid>(null);
  const gridStateRef = useRef<IgrGridState>(null);
  const actionStripRef = useRef<IgrActionStrip>(null);
  const snackbarRef = useRef<IgrSnackbar>(null);
  const resetDialogRef = useRef<IgrDialog>(null);
  const resetCancelRef = useRef<IgrButton>(null);
  const resetConfirmRef = useRef<IgrButton>(null);
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  /** The untouched grid layout, serialized so every restore parses its own copy. */
  const pristineGridStateRef = useRef<string>(undefined);
  const appliedSizeRef = useRef<FleetSize>(FLEET_DEFAULT_SIZE);
  /**
   * Everything an expanded row renders, built once per vehicle and status. The
   * charts compare their data by identity, so rebuilding the arrays on every
   * render would make them redraw continuously.
   */
  const detailCacheRef = useRef(new Map<string, FleetDetail>());
  const [chartAttachments] = useState(() => new ChartAttachmentWatcher());

  useEffect(() => {
    registerFleetIcons();
  }, []);

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    chartAttachments.observe(grid);
    return () => chartAttachments.disconnect();
  }, [chartAttachments]);

  useEffect(() => {
    const abort = new AbortController();
    void loadFleetVehicleImageCatalog(abort.signal).then((loaded) => {
      if (loaded) setCatalog(loaded);
    });
    return () => abort.abort();
  }, []);

  useEffect(() => () => clearTimeout(noticeTimerRef.current), []);

  /** Everything the search matches, before the status chips narrow it further. */
  const searchedVehicles = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return vehicles;

    return vehicles.filter((vehicle) => {
      const target = [vehicle.id, vehicle.licensePlate, vehicle.vin, vehicle.make, vehicle.model, vehicle.locationCity];
      return target.join(" ").toLowerCase().includes(query);
    });
  }, [vehicles, searchQuery]);

  const filteredVehicles = useMemo(
    () => (statusFilter === "all" ? searchedVehicles : searchedVehicles.filter((vehicle) => vehicle.status === statusFilter)),
    [searchedVehicles, statusFilter],
  );

  // Counted off the search results so the chips and the rows always agree.
  const metrics = useMemo(() => {
    const countOf = (status: FleetStatus): number => searchedVehicles.filter((vehicle) => vehicle.status === status).length;
    return {
      all: searchedVehicles.length,
      active: countOf("Active"),
      available: countOf("Available"),
      maintenance: countOf("In Maintenance"),
    };
  }, [searchedVehicles]);

  // The query filters the rows; the grid's own search marks where each row
  // matched. An effect, so it runs once the filtered rows are in the grid.
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;

    const query = searchQuery.trim();
    grid.clearSearch();
    if (query) grid.findNext(query);
  }, [searchQuery]);

  // Row height derives from --ig-size and virtualization caches it, so the grid
  // has to be told once a new density has been applied. The first run is
  // skipped: the grid measures itself when it renders.
  useEffect(() => {
    if (size === appliedSizeRef.current) return;

    appliedSizeRef.current = size;
    gridRef.current?.reflow();
  }, [size]);

  const notify = useCallback((message: string) => {
    setNotice(message);
    void snackbarRef.current?.show();
    clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = setTimeout(() => void snackbarRef.current?.hide(), FLEET_NOTICE_DISPLAY_TIME);
  }, []);

  const setVehicleStatus = useCallback(
    (vehicle: FleetVehicle, status: FleetStatus) => {
      if (vehicle.status === status) return;

      setVehicles((current) => withVehicleStatus(current, vehicle.id, status));
      notify(`${vehicle.id} — ${vehicle.make} ${vehicle.model} set to ${status}`);
    },
    [notify],
  );

  /**
   * The row actions act on the row the strip is shown for: the strip's
   * `context`, which the grid sets to the hovered row.
   */
  const setHoveredVehicleStatus = (status: FleetStatus) => {
    const vehicle = actionStripRef.current?.context?.data as FleetVehicle | undefined;
    if (vehicle) setVehicleStatus(vehicle, status);
  };

  const toggleTheme = () => setTheme((current) => (current === "dark" ? "light" : "dark"));

  /**
   * Reset throws away everything the user has done to the sample, so it asks
   * first. The dialog opens on its Reset button, so Enter confirms; Escape and
   * Cancel back out.
   */
  const askResetFleet = () => {
    void resetDialogRef.current?.show().then(() => resetConfirmRef.current?.focus());
  };

  /** Tab and Shift+Tab wrap between the dialog's two buttons, so focus stays in the dialog. */
  const wrapResetDialogFocus = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== "Tab") return;
    const first = resetCancelRef.current;
    const last = resetConfirmRef.current;
    const [from, to] = event.shiftKey ? [first, last] : [last, first];
    if (!from || event.target !== from) return;
    event.preventDefault();
    to?.focus();
  };

  /** Puts sorting, filters, column order, pinning, hiding and expanded rows back. */
  const resetGridLayout = () => {
    const grid = gridRef.current;
    const state = gridStateRef.current;
    const pristine = pristineGridStateRef.current;
    if (!grid || !state || !pristine) return;

    // Cell ranges are the one piece the state restores on top of rather than
    // replacing, so they are cleared first.
    grid.clearCellSelection();
    state.applyStateFromString(pristine);
    grid.clearSearch();
  };

  const confirmResetFleet = () => {
    void resetDialogRef.current?.hide();
    setTheme(FLEET_DEFAULT_THEME);
    setVehicles(createFleetVehicles());
    setStatusFilter("all");
    setSearchQuery("");
    setSize(FLEET_DEFAULT_SIZE);
    resetGridLayout();
    notify("Fleet reset to its opening state");
  };

  // Sorting, pinning, hiding, column order, filters and expanded rows live on
  // the grid rather than in the data, so reset needs a snapshot of them taken
  // before the user can touch anything. The grid sets its columns up after it
  // first renders, so the snapshot waits for the first data view that has them.
  const captureGridState = () => {
    if (pristineGridStateRef.current !== undefined || !gridRef.current?.columns.length) return;
    pristineGridStateRef.current = gridStateRef.current?.getStateAsString();
  };

  const detailContext = useMemo<FleetDetailContextValue>(
    () => ({
      theme,
      chartPalette: FLEET_CHART_THEMES[theme],
      utilizationYears,
      detailOf: (vehicle) => {
        const key = fleetDetailKey(vehicle);
        let detail = detailCacheRef.current.get(key);
        if (!detail) {
          detail = buildFleetDetail(vehicle);
          detailCacheRef.current.set(key, detail);
        }
        return detail;
      },
      // The photo and the colour both come from `vehicle.photoKey`, so they
      // cannot contradict each other. No photo means "nothing to show": the
      // catalog has not loaded, does not carry the folder, or every shot in it
      // failed - and the detail draws a neutral placeholder rather than a
      // stand-in car whose colour would be a lie.
      photoOf: (vehicle) => {
        const index = photoProgress.get(vehicle.id) ?? 0;
        const url = fleetVehiclePhotoUrls(catalog, vehicle)[index];
        return url ? { vehicleId: vehicle.id, url, index } : undefined;
      },
      // Moves on from the shot that failed, once: a late error from a shot the
      // vehicle has already moved past changes nothing.
      skipPhoto: ({ vehicleId, index }) =>
        setPhotoProgress((progress) =>
          (progress.get(vehicleId) ?? 0) === index ? new Map(progress).set(vehicleId, index + 1) : progress,
        ),
      chartAttachments,
    }),
    [theme, utilizationYears, catalog, photoProgress, chartAttachments],
  );

  const selectedSizes = useMemo(() => [size], [size]);

  const isDark = theme === "dark";
  const themeToggleLabel = isDark ? "Switch to light mode" : "Switch to dark mode";
  const rootClassName = [
    "fleet-management-new",
    isDark ? "" : "light-theme",
    size === "small" ? "fleet-size-small" : "",
    size === "large" ? "fleet-size-large" : "",
  ]
    .filter(Boolean)
    .join(" ");

  // The `active` class marks the selected filter in the DOM. No stylesheet
  // reads it: the chips look the same selected or not.
  const chip = (filter: FleetStatusFilter, label: string, count: number, variant?: "info" | "success" | "warning") => (
    <IgrChip
      className={statusFilter === filter ? "fleet-chip active" : "fleet-chip"}
      variant={variant}
      outlined={true}
      onClick={() => setStatusFilter(filter)}
    >
      {label} ({count})
    </IgrChip>
  );

  return (
    <div className={rootClassName}>
      <FleetDetailContext.Provider value={detailContext}>
        <section className="fleet-shell ig-scrollbar" aria-label="Fleet management page">
          <section className="fleet-chip-row" aria-label="Fleet status filters">
            {chip("all", "All vehicles", metrics.all)}
            {chip("Active", "Active", metrics.active, "info")}
            {chip("Available", "Available", metrics.available, "success")}
            {chip("In Maintenance", "In Maintenance", metrics.maintenance, "warning")}

            <IgrButton variant="outlined" type="button" className="fleet-reset" onClick={askResetFleet}>
              <IgrIcon slot="prefix" name="restart_alt" collection={FLEET_ICON_COLLECTION} aria-hidden="true" />
              <span>Reset</span>
            </IgrButton>

            <IgrButtonGroup
              className="fleet-size-group"
              selection="single-required"
              aria-label="Component size"
              // The group owns its buttons' selection; setting it on the group keeps
              // the buttons from re-syncing the group while they update.
              selectedItems={selectedSizes}
              onSelect={(event) => {
                const selected = FLEET_SIZES.find((candidate) => candidate === event.detail);
                if (selected) setSize(selected);
              }}
            >
              {FLEET_SIZES.map((candidate) => (
                <IgrToggleButton
                  key={candidate}
                  value={candidate}
                  title={`Render the sample at ${candidate} size`}
                >
                  <span>{candidate}</span>
                </IgrToggleButton>
              ))}
            </IgrButtonGroup>

            <IgrIconButton
              variant="contained"
              type="button"
              className="fleet-theme-toggle"
              name={isDark ? "light_mode" : "dark_mode"}
              collection={FLEET_ICON_COLLECTION}
              title={themeToggleLabel}
              aria-label={themeToggleLabel}
              onClick={toggleTheme}
            />
          </section>

          <IgrGrid
            ref={gridRef}
            className="fleet-master-grid"
            data={filteredVehicles}
            primaryKey="id"
            autoGenerate={false}
            moving={true}
            showGroupArea={false}
            rowClasses={FLEET_STATUS_ROW_CLASSES}
            detailTemplate={fleetDetailTemplate}
            onDataChanged={captureGridState}
          >
            <IgrGridState ref={gridStateRef} />
            <IgrGridToolbar>
              <IgrGridToolbarTitle>
                <span className="fleet-title-wrap">
                  <span className="fleet-title-icon-wrap">
                    <IgrIcon className="fleet-title-icon" name="directions_car" collection={FLEET_ICON_COLLECTION} aria-hidden="true" />
                    <IgrIcon className="fleet-title-icon" name="directions_car" collection={FLEET_ICON_COLLECTION} aria-hidden="true" />
                    <IgrIcon className="fleet-title-icon" name="directions_car" collection={FLEET_ICON_COLLECTION} aria-hidden="true" />
                  </span>
                  <h1>Fleet Management</h1>
                </span>
              </IgrGridToolbarTitle>
              <IgrGridToolbarActions>
                <IgrInput
                  type="search"
                  className="fleet-search"
                  placeholder="Search fleet"
                  aria-label="Search vehicles by ID, plate, VIN, make, model or location"
                  value={searchQuery}
                  onInput={(event) => setSearchQuery(event.detail)}
                >
                  <IgrIcon slot="prefix" name="search" collection={FLEET_ICON_COLLECTION} aria-hidden="true" />
                </IgrInput>
                <IgrGridToolbarHiding />
                <IgrGridToolbarPinning />
                <IgrGridToolbarAdvancedFiltering />
              </IgrGridToolbarActions>
            </IgrGridToolbar>

            <IgrColumn field="id" header="Vehicle ID" sortable={true} filterable={false} />
            <IgrColumn field="licensePlate" header="License Plate" sortable={true} filterable={true} />
            <IgrColumn field="make" header="Make" sortable={true} filterable={true} />
            <IgrColumn field="model" header="Model" sortable={true} filterable={true} />
            <IgrColumn field="type" header="Type" sortable={true} filterable={true} />
            <IgrColumn field="vin" header="VIN" sortable={true} filterable={false} />
            <IgrColumn field="status" header="Status" sortable={true} filterable={true} bodyTemplate={fleetStatusCellTemplate} />
            <IgrColumn field="locationCity" header="Location" sortable={true} filterable={true} width="12%" />

            <IgrActionStrip ref={actionStripRef}>
              <IgrIconButton
                variant="flat"
                type="button"
                className="fleet-row-action fleet-row-action-active"
                name="play_circle"
                collection={FLEET_ICON_COLLECTION}
                title="Put back in service"
                aria-label="Put back in service"
                onClick={() => setHoveredVehicleStatus("Active")}
              />
              <IgrIconButton
                variant="flat"
                type="button"
                className="fleet-row-action fleet-row-action-available"
                name="check_circle"
                collection={FLEET_ICON_COLLECTION}
                title="Mark available"
                aria-label="Mark available"
                onClick={() => setHoveredVehicleStatus("Available")}
              />
              <IgrIconButton
                variant="flat"
                type="button"
                className="fleet-row-action fleet-row-action-maintenance"
                name="build"
                collection={FLEET_ICON_COLLECTION}
                title="Send to maintenance"
                aria-label="Send to maintenance"
                onClick={() => setHoveredVehicleStatus("In Maintenance")}
              />
            </IgrActionStrip>
          </IgrGrid>

          <IgrSnackbar ref={snackbarRef} className="fleet-snackbar" keepOpen={true}>
            {notice}
          </IgrSnackbar>

          <IgrDialog
            ref={resetDialogRef}
            className="fleet-reset-dialog"
            title="Reset the fleet?"
            closeOnOutsideClick={true}
            onKeyDown={wrapResetDialogFocus}
          >
            <span slot="message">{FLEET_RESET_MESSAGE}</span>
            <IgrButton ref={resetCancelRef} slot="footer" variant="flat" type="button" onClick={() => void resetDialogRef.current?.hide()}>
              Cancel
            </IgrButton>
            <IgrButton ref={resetConfirmRef} slot="footer" variant="contained" type="button" onClick={confirmResetFleet}>
              Reset
            </IgrButton>
          </IgrDialog>
        </section>
      </FleetDetailContext.Provider>
    </div>
  );
}

import { IgrCellTemplateContext, IgrCellType, IgrColumn, IgrGrid, IgrGridMasterDetailContext, IgrGridToolbar, IgrGridToolbarActions, IgrGridToolbarAdvancedFiltering, IgrGridToolbarHiding, IgrGridToolbarPinning, IgrGridToolbarTitle } from 'igniteui-react-grids';
import './fleet-management-grid.scss';
import { IgrAvatar, IgrBadge, IgrButton, IgrCard, IgrCardActions, IgrCardContent, IgrCardHeader, IgrCarousel, IgrCarouselSlide, IgrDivider, IgrIcon, IgrTab, IgrTabs, registerIconFromText, StyleVariant } from 'igniteui-react';
import { useEffect, useRef, useState } from 'react';
import { check, delivery, wrench } from '@igniteui/material-icons-extended';
import CAR_PHOTO_MANIFEST from '../../assets/car_photo_manifest.json';
import CAR_IMAGES from '../../assets/car_images.json';
import DRIVER_CATEGORIES from '../../assets/driver_categories.json';
import VEHICLE_DETAILS from '../../assets/vehicle_details.json';
import { dataService } from '../../services/data.service';
import { IgrCategoryChartModule, IgrLegendModule } from 'igniteui-react-charts';
import TripHistoryGrid from '../trip-history-grid/trip-history-grid';
import MaintenanceGrid from '../maintenance-grid/maintenance-grid';
import { flip, offset, shift, useFloating } from '@floating-ui/react-dom';
import { MarkerPoint, OverlayVehicle, Vehicle } from '../../models/vehicle.model';
import { IgrGeographicMap, IgrGeographicMapModule, IgrGeographicSymbolSeries } from 'igniteui-react-maps';
import { DataTemplateMeasureInfo, DataTemplateRenderInfo, IgDataTemplate } from 'igniteui-react-core';
import CostPerTypeChartComponent from '../cost-per-type-chart/cost-per-type-chart';
import CostPerMeterChartComponent from '../cost-per-meter-chart/cost-per-meter-chart';
import FuelCostChartComponent from '../fuel-cost-chart/fuel-cost-chart';
import UtilizationChartComponent from '../utilization-chart/utilization-chart';
import { Driver } from '../../models/driver.model';
import { CLEAR } from '../../assets/icons/icons';

IgrLegendModule.register();
IgrCategoryChartModule.register();
IgrGeographicMapModule.register();

const useOverlayControl = (ref: React.RefObject<HTMLElement | null>, onClose: () => void) => {
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const path = event.composedPath?.() || (event as any).path || [];
      if (!ref.current || !path.includes(ref.current)) {
        onClose();
      }
    }

    window.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("wheel", handleClickOutside, { passive: true, capture: true });

    return () => {
      window.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("wheel", handleClickOutside);
    };
  }, [ref, onClose]);
}

export default function FleetManagement() {
  const [vehiclesData, setVehiclesData] = useState<Vehicle[]>([]);

  const [isVisible, setIsVisible] = useState(false);
  const [isLocationOverlayActive, setIsLocationOverlayActive] = useState(false);
  const [isDriverOverlayActive, setIsDriverOverlayActive] = useState(false);
  const [isSorted, setIsSorted] = useState(false);

  const [vehicleDetails, setVehicleDetails] = useState<OverlayVehicle>({
    vehiclePhoto: '',
    make: '',
    model: '',
    mileage: '',
    markerLocations: []
  });

  const [driverDetails, setDriverDetails] = useState<Driver>({
    name: "",
    license: "",
    address: "",
    city: "",
    phone: "",
    email: "",
    photo: ""
  });

  const gridRef = useRef<IgrGrid>(null);
  const mapRef = useRef<IgrGeographicMap>(null);

  const { refs: locationRefs, floatingStyles: locationFloatingStyles } = useFloating({
    placement: 'left-start',
    middleware: [offset(8), flip(), shift()],
  });

  const { refs: driverRefs, floatingStyles: driverFloatingStyles } = useFloating({
    placement: 'left-start',
    middleware: [offset(8), flip(), shift()],
  });

  useOverlayControl(locationRefs.floating, () => setIsLocationOverlayActive(false));
  useOverlayControl(driverRefs.floating, () => setIsDriverOverlayActive(false));

  useEffect(() => {
    registerIconFromText(check.name, check.value, "imx-icons");
    registerIconFromText(wrench.name, wrench.value, "imx-icons");
    registerIconFromText(delivery.name, delivery.value, "imx-icons");
    registerIconFromText("clear", CLEAR, "material");

    dataService.getVehiclesData().then(() => {
      setVehiclesData(dataService.vehicleList);
      dataService.loadOptionalData();
    });

  }, []);

  useEffect(() => {
    if (!mapRef.current || vehicleDetails.markerLocations.length === 0) return;

    mapRef.current.series.clear();
    addSeriesWith(vehicleDetails.markerLocations, "Red");
    const lon = vehicleDetails.markerLocations[0].longitude;
    const lat = vehicleDetails.markerLocations[0].latitude;
    const centerPoint = {
      left: lon - 0.01,
      top: lat - 0.01,
      width: 0.01,
      height: 0.01
    };

    mapRef.current.zoomToGeographic(centerPoint);
  }, [vehicleDetails.markerLocations]);

  useEffect(() => {
    if (isLocationOverlayActive) {
      requestAnimationFrame(() => {
        setIsVisible(true);
      });
    } else {
      setIsVisible(false);
      const timeout = setTimeout(() => 200);
      return () => clearTimeout(timeout);
    }
  }, [isLocationOverlayActive]);

  useEffect(() => {
    if (isDriverOverlayActive) {
      requestAnimationFrame(() => {
        setIsVisible(true);
      });
    } else {
      setIsVisible(false);
      const timeout = setTimeout(() => 200);
      return () => clearTimeout(timeout);
    }
  }, [isDriverOverlayActive]);

  /** Templates */

  const masterDetailTemplate = (ctx: IgrGridMasterDetailContext) => {
    const vehicleId: string = ctx.implicit.vehicleId;
    const images: string[] = getPathToCarImage(vehicleId);

    return (
      <IgrTabs key="tabs">
        <IgrTab key="details-tab">
          <span slot="label">Details</span>

          <div className='details-container'>
            <div className="carousel-container">
              <IgrCarousel>
                {images.map((image, index) => (
                  <IgrCarouselSlide key={index}>
                    <div className="image-container">
                      <img src={image} alt={`Vehicle ${index}`} />
                    </div>
                  </IgrCarouselSlide>
                ))}
              </IgrCarousel>
            </div>

            <div className="details-table">
              {[VEHICLE_DETAILS.detailsCategories, VEHICLE_DETAILS.engineCategories].map((categorySet, index) => (
                <div className="detail-block-container" key={index}>
                  <div className="detail-category-container">
                    {categorySet.map((category, index) => (
                      <div className="detail-item" key={index}>
                        <span className="detail-category">{category.label}:</span>
                        <IgrDivider></IgrDivider>
                      </div>
                    ))}
                  </div>
                  <div className="detail-content-container">
                    {categorySet.map((category, index) => (
                      <div className="detail-item" key={index}>
                        <span className="detail-value">{getValueByPath(ctx.implicit, category.key)}</span>
                        <IgrDivider></IgrDivider>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </IgrTab>
        <IgrTab key="trip-history-tab">
          <span slot="label">Trip History</span>

          <TripHistoryGrid vehicleId={vehicleId} onDriverClick={showDriverOverlay}></TripHistoryGrid>
        </IgrTab>
        <IgrTab key="maintenance-tab">
          <span slot="label">Maintenance</span>

          <MaintenanceGrid vehicleId={vehicleId}></MaintenanceGrid>
        </IgrTab>
        <IgrTab key="cost-tab">
          <span slot="label">Cost</span>

          <div className="dashboard">
            <CostPerTypeChartComponent vehicleId={vehicleId} />
            <CostPerMeterChartComponent vehicleId={vehicleId} />
            <FuelCostChartComponent vehicleId={vehicleId} />
          </div>
        </IgrTab>
        <IgrTab key="utilization-tab">
          <span slot="label">Utilization</span>

          <UtilizationChartComponent vehicleId={vehicleId} />
        </IgrTab>
      </IgrTabs>
    )
  }

  const makeCellTemplate = (ctx: IgrCellTemplateContext) => {
    return (
      <>
        <IgrAvatar className='logo-avatar' shape='rounded' src={getPathToLogoImage(ctx.implicit)}></IgrAvatar>
        <span className='status-value'>{ctx.implicit}</span>
      </>
    );
  }

  const statusCellTemplate = (ctx: IgrCellTemplateContext) => {
    return (
      <>
        <IgrBadge variant={getStatusType(ctx.implicit)}>
          <IgrIcon className='icon-style' collection='imx-icons' name={getStatusIcon(ctx.implicit)}></IgrIcon>
        </IgrBadge>
        <span className="status-value">{ctx.implicit}</span>
      </>
    );
  }

  const locationCellTemplate = (ctx: IgrCellTemplateContext) => {
    return (
      <a className='link-style' href='#' onClick={(event) => showLocationOverlay(event, ctx.cell)}>{ctx.implicit}</a>
    );
  }

  /** Overlay Logic */

  const showLocationOverlay = (event: React.MouseEvent<HTMLElement>, cell: IgrCellType) => {
    event.preventDefault();

    const vehicleId = cell.row?.cells?.find((c: IgrCellType) => c.column.field === 'vehicleId')?.value;

    if (!vehicleId) {
      console.error('Vehicle ID not found in data');
      return;
    }

    const vehicle = dataService.vehicleList.find(v => v.vehicleId === vehicleId)

    if (!vehicle) {
      console.error(`No vehicle found for ID: ${vehicleId}`);
      return;
    }

    setVehicleDetails({
      vehiclePhoto: getPathToCarImage(vehicleId)[0],
      make: vehicle.make,
      model: vehicle.model,
      mileage: vehicle.details.mileage,
      markerLocations: [{
        latitude: parseFloat(vehicle.locationGps.split(',')[0]),
        longitude: parseFloat(vehicle.locationGps.split(',')[1]),
      }]
    });

    const target = event.currentTarget;

    locationRefs.setReference(target);

    setIsLocationOverlayActive(true);
  }

  const showDriverOverlay = (details: Driver, event: MouseEvent) => {
    event.preventDefault();

    setDriverDetails({
      name: details.name,
      license: details.license,
      address: details.address,
      city: details.city,
      phone: details.phone,
      email: details.email,
      photo: `people/${details.photo}.jpg`
    });

    const target = event.currentTarget as Element;

    driverRefs.setReference(target);

    setIsDriverOverlayActive(true);
  }

  /** Utility Functions */

  const getPathToLogoImage = (value: string): string => {
    return `cars/logos/${value}.png`
  }

  const getStatusType = (status: string): StyleVariant => {
    const types: Record<string, StyleVariant> = {
      "Available": "success",
      "In Maintenance": "danger",
      "Active": "info",
    };
    return types[status] || "primary";
  }

  const getStatusIcon = (status: string): string => {
    const icons: Record<string, string> = {
      "Available": "check",
      "In Maintenance": "wrench",
      "Active": "delivery"
    };
    return icons[status] || "info";
  }

  const getPathToCarImage = (vehicleId: string): string[] => {
    const carEntry = CAR_PHOTO_MANIFEST.find(car => car.id === vehicleId);

    if (!carEntry) {
      console.warn(`No vehicle found with ID: ${vehicleId}`)
      return [];
    }

    const folderName = carEntry.folder;
    const carPhotoNames = (CAR_IMAGES as Record<string, string[]>)[folderName];
    const carPathsToPhotos = carPhotoNames.map(photo => `cars/photos/${folderName}/${photo}`);

    return carPathsToPhotos;
  }

  const getValueByPath = (obj: any, path: string) => {
    return path.split('.').reduce((o, key) => (o && o[key] !== undefined) ? o[key] : 'N/A', obj);
  }

  const addSeriesWith = (locations: MarkerPoint[], brush: string) => {
    const symbolSeries = new IgrGeographicSymbolSeries({ name: "symbolSeries" });
    symbolSeries.dataSource = locations;
    symbolSeries.latitudeMemberPath = "latitude";
    symbolSeries.longitudeMemberPath = "longitude";
    symbolSeries.markerBrush = "White";
    symbolSeries.markerOutline = brush;
    symbolSeries.markerTemplate = {
      measure: (measureInfo: DataTemplateMeasureInfo) => {
        measureInfo.width = 24;
        measureInfo.height = 24;
      },
      render: (renderInfo: DataTemplateRenderInfo) => {
        const ctx = renderInfo.context;
        const x = renderInfo.xPosition;
        const y = renderInfo.yPosition;

        const img = new Image();
        img.src = 'location_pin.svg';
        img.onload = () => {
          ctx.drawImage(img, x - 12, y - 12, 32, 32);
        };
      }
    } as IgDataTemplate;
    if (mapRef.current instanceof IgrGeographicMap) {
      mapRef.current.series.add(symbolSeries);
    }
  }

  const clearSorting = () => {
    if (gridRef.current) {
      gridRef.current.sortingExpressions = [];
    }
    setIsSorted(false);
  }

  const handleSortingChanged = () => {
    if (gridRef.current) {
      setIsSorted(gridRef.current.sortingExpressions.length > 0);
    }
  }

  return (
    <>
      <div className="row-layout fleet-management-container">
        <IgrGrid
          data={vehiclesData}
          isLoading={!vehiclesData.length}
          primaryKey="vehicleId"
          detailTemplate={masterDetailTemplate}
          className="ig-typography ig-scrollbar main-grid"
          allowAdvancedFiltering={true}
          ref={gridRef}
          onSortingExpressionsChange={handleSortingChanged}>
          <IgrGridToolbar>
            <IgrGridToolbarActions>
              {isSorted && (
                <IgrButton variant="flat" onClick={clearSorting}>
                  <IgrIcon name="clear" collection="material" />
                  Clear Sort
                </IgrButton>
              )}
              <IgrGridToolbarPinning></IgrGridToolbarPinning>
              <IgrGridToolbarHiding></IgrGridToolbarHiding>
              <IgrGridToolbarAdvancedFiltering></IgrGridToolbarAdvancedFiltering>
            </IgrGridToolbarActions>
            <IgrGridToolbarTitle>
              <span key="grid">Fleet Management</span>
            </IgrGridToolbarTitle>
          </IgrGridToolbar>
          <IgrColumn field="vehicleId" dataType="string" header="Vehicle ID" sortable={true}></IgrColumn>
          <IgrColumn field="licensePlate" dataType="string" header="License Plate" sortable={true}></IgrColumn>
          <IgrColumn field="make" dataType="string" header="Make" sortable={true} bodyTemplate={makeCellTemplate}></IgrColumn>
          <IgrColumn field="model" dataType="string" header="Model" sortable={true}></IgrColumn>
          <IgrColumn field="type" dataType="string" header="Type" sortable={true}></IgrColumn>
          <IgrColumn field="vin" dataType="string" header="VIN" sortable={true}></IgrColumn>
          <IgrColumn field="status" dataType="string" header="Status" sortable={true} bodyTemplate={statusCellTemplate}></IgrColumn>
          <IgrColumn field="locationCity" dataType="string" header="Location (City)" sortable={true}></IgrColumn>
          <IgrColumn field="locationGps" dataType="string" header="Location (GPS)" sortable={true} bodyTemplate={locationCellTemplate}></IgrColumn>
        </IgrGrid>
      </div>

      {isLocationOverlayActive && (
        <>
          <div className="overlay-backdrop"></div>
          <div className={`overlay-wrapper ${isVisible ? 'visible' : ''}`} ref={locationRefs.setFloating} style={locationFloatingStyles}>
            <div>
              <IgrCard elevated className="overlay overlay-location">
                <IgrCardHeader className="overlay-location-header">
                  <div className="overlay-header-content">
                    <IgrAvatar className="overlay-avatar" shape="circle" src={vehicleDetails.vehiclePhoto}></IgrAvatar>
                    <h6 className="overlay-title" slot="title">{vehicleDetails.make} {vehicleDetails.model}</h6>
                    <span className="overlay-text" slot="subtitle">Mileage: {vehicleDetails.mileage}</span>
                  </div>
                </IgrCardHeader>
                <IgrCardContent className="overlay-location-content">
                  <IgrGeographicMap width="360px" height="190px"
                    ref={mapRef}
                    zoomable="false"
                    dataSource={vehicleDetails.markerLocations}></IgrGeographicMap>
                </IgrCardContent>
                <IgrCardActions className="overlay-location-actions">
                  <IgrButton variant="flat" onClick={() => setIsLocationOverlayActive(false)}>Close</IgrButton>
                </IgrCardActions>
              </IgrCard>
            </div>
          </div>
        </>
      )}

      {isDriverOverlayActive && (
        <>
          <div className="overlay-backdrop"></div>
          <div className={`overlay-wrapper ${isVisible ? 'visible' : ''}`} ref={driverRefs.setFloating} style={driverFloatingStyles}>
            <div>
              <IgrCard elevated className="overlay overlay-driver">
                <IgrCardHeader className="overlay-driver-header">
                  <div className="overlay-header-content">
                    <IgrAvatar className="overlay-avatar" shape="circle" src={driverDetails.photo}></IgrAvatar>
                    <h6 className="overlay-title" slot="title">{driverDetails.name}</h6>
                  </div>
                </IgrCardHeader>
                <IgrCardContent className="overlay-driver-content">
                  <div className="driver-block-container">
                    <div className="driver-category-container">
                      {DRIVER_CATEGORIES.driverCategories.map((category, index) => (
                        <div className="detail-item" key={index}>
                          <span className="detail-category">{category.label}:</span>
                          <IgrDivider></IgrDivider>
                        </div>
                      ))}
                    </div>
                    <div className="driver-content-container">
                      {DRIVER_CATEGORIES.driverCategories.map((category, index) => (
                        <div className="detail-item" key={index}>
                          <span className="detail-value">{driverDetails[category.key]}</span>
                          <IgrDivider></IgrDivider>
                        </div>
                      ))}
                    </div>
                  </div>
                </IgrCardContent>
                <IgrCardActions className="overlay-location-actions">
                  <IgrButton variant="flat" onClick={() => setIsDriverOverlayActive(false)}>Close</IgrButton>
                </IgrCardActions>
              </IgrCard>
            </div>
          </div>
        </>
      )}

    </>
  );
}

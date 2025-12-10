import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { IgrButton, IgrIcon, registerIcon } from "igniteui-react";
import "igniteui-react-grids/grids/themes/light/material.css";
import "./home-view.scss";

import FILE_DOWNLOAD from "../../data/icons/file_download.svg";
import VIEW_MORE from "../../data/icons/view_more.svg";
import FULL_SCREEN from "../../data/icons/full_screen.svg";
import EXIT_FULL_SCREEN from "../../data/icons/exit_full_screen.svg";

export interface TabInfo {
  title: string;
  content: string;
  theme: string;
  themeMode: string;
  moreLink: string;
  downloadLink: string;
}

export interface TabItemProps {
  isActive?: boolean;
  tabInfo?: TabInfo;
}

export interface TabItemInfoProps {
  tabName: string;
  tabInfo: Map<string, TabInfo>;
  isFullscreen: boolean;
  onDownloadClick: (event: MouseEvent, tabName: string) => void;
  onViewMoreClick: (event: MouseEvent, tabName: string) => void;
  onToggleFullscreen: (event: MouseEvent) => void;
}

export function TabItem({ isActive, tabInfo }: TabItemProps) {
  return (
    <div className="tab-item-container">
      <div className={"tab-item" + (isActive ? " tab-item--selected" : "")}>
        <div
          className={"tab-header" + (!isActive ? " tab-header--disabled" : "")}
        >
          {tabInfo?.title.toUpperCase()}
        </div>
      </div>
    </div>
  );
}

export function TabItemInfo({
  tabName,
  tabInfo,
  isFullscreen,
  onDownloadClick,
  onViewMoreClick,
  onToggleFullscreen,
}: TabItemInfoProps) {
  const info = tabInfo.get(tabName);

  return (
    <div className="current-tab-info">
      <div className="sample-info">
        <div className="tab-header">{info?.title}</div>
        <div className="tab-description">{info?.content}</div>
      </div>

      <div className="sample-actions">
        <div className="theme-info">Theme: {info?.theme}</div>
        <div className="theme-info">Mode: {info?.themeMode}</div>

        <div className="action-buttons">
          <IgrButton
            variant="outlined"
            className="custom-button"
            onClick={(e) =>
              onDownloadClick(e.nativeEvent as MouseEvent, tabName)
            }
          >
            <IgrIcon
              key="downloadIcon"
              name="file_download"
              collection="custom"
            ></IgrIcon>
            Download
          </IgrButton>

          <IgrButton
            variant="outlined"
            className="custom-button"
            onClick={(e) =>
              onViewMoreClick(e.nativeEvent as MouseEvent, tabName)
            }
          >
            <IgrIcon
              key="viewMoreIcon"
              name="view_more"
              collection="custom"
            ></IgrIcon>
            View More
          </IgrButton>

          <IgrButton
            variant="outlined"
            className="custom-button"
            onClick={(e) => onToggleFullscreen(e.nativeEvent as MouseEvent)}
          >
            <IgrIcon
              key="fullscreenIcon"
              name={isFullscreen ? "exit_full_screen" : "full_screen"}
              collection="custom"
            ></IgrIcon>
            {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          </IgrButton>
        </div>
      </div>
    </div>
  );
}

const tabsGrids = [
  { key: "inventory" },
  { key: "hr-portal" },
  { key: "finance" },
  { key: "sales" },
  { key: "fleet" },
];

const tabsCharts = [
  { key: "column-chart" },
  { key: "bar-chart" },
  { key: "line-chart" },
  { key: "pie-chart" },
  { key: "step-chart" },
  { key: "polar-chart" },
];

const tabInfoGrids = new Map<string, TabInfo>([
  [
    "inventory",
    {
      title: "ERP/ Inventory",
      theme: "Material",
      themeMode: "Light",
      content:
        "Tracking and managing quantity, location and details of products in stock.",
      moreLink:
        "https://www.infragistics.com/products/ignite-ui-react/react/components/grids/hierarchical-grid/overview",
      downloadLink:
        "https://www.infragistics.com/resources/sample-applications/erp-inventory-sample-app-react",
    },
  ],
  [
    "hr-portal",
    {
      title: "Org Chart/HR Portal",
      theme: "Fluent",
      themeMode: "Light",
      content:
        "Displaying company's hierarchical structure and showing employees data.",
      moreLink:
        "https://www.infragistics.com/products/ignite-ui-react/react/components/grids/tree-grid/overview",
      downloadLink:
        "https://www.infragistics.com/resources/sample-applications/org-charthr-portal-sample-app-react",
    },
  ],
  [
    "finance",
    {
      title: "Financial Portfolio",
      theme: "Bootstrap",
      themeMode: "Light",
      content:
        "Asset tracking, profit and loss analysis, featuring interactive dynamic charts.",
      moreLink:
        "https://www.infragistics.com/products/ignite-ui-react/react/components/grids/data-grid",
      downloadLink:
        "https://www.infragistics.com/resources/sample-applications/financial-portfolio-sample-app-react",
    },
  ],
  [
    "sales",
    {
      title: "Sales Dashboard",
      theme: "Indigo",
      themeMode: "Light",
      content:
        "For trend analysis, KPIs and viewing sales summaries by region, product, etc.",
      moreLink:
        "https://www.infragistics.com/products/ignite-ui-react/react/components/grids/pivot-grid/overview",
      downloadLink:
        "https://www.infragistics.com/resources/sample-applications/sales-grid-sample-app-react",
    },
  ],
  [
    "fleet",
    {
      title: "Fleet Management",
      theme: "Material",
      themeMode: "Dark",
      content:
        "A master-detail grid for managing vehicle acquisition, operations, and maintenance.",
      moreLink:
        "https://www.infragistics.com/products/ignite-ui-react/react/components/grids/grid/master-detail",
      downloadLink:
        "https://www.infragistics.com/resources/sample-applications/fleet-management-sample-app-react",
    },
  ],
]);

const tabInfoCharts = new Map<string, TabInfo>([
  [
    "charts/column-chart",
    {
      title: "Column Chart",
      theme: "Material",
      themeMode: "Light",
      content:
        "Render a collection of data points connected by a straight line to emphasize the amount of change over a period of time",
      moreLink:
        "https://www.infragistics.com/products/ignite-ui-react/react/components/charts/types/column-chart",
      downloadLink:
        "https://www.infragistics.com/resources/sample-applications/column-chart-sample-app-react",
    },
  ],
  [
    "charts/bar-chart",
    {
      title: "Bar Chart",
      theme: "Material",
      themeMode: "Light",
      content:
        "Quickly compare frequency, count, total, or average of data in different categories",
      moreLink:
        "https://www.infragistics.com/products/ignite-ui-react/react/components/charts/types/bar-chart",
      downloadLink:
        "https://www.infragistics.com/resources/sample-applications/bar-chart-sample-app-react",
    },
  ],
  [
    "charts/line-chart",
    {
      title: "Line Chart",
      theme: "Material",
      themeMode: "Light",
      content:
        "Show trends and perform comparative analysis of one or more quantities over a period of time",
      moreLink:
        "https://www.infragistics.com/products/ignite-ui-react/react/components/charts/types/line-chart",
      downloadLink:
        "https://www.infragistics.com/resources/sample-applications/line-chart-sample-app-react",
    },
  ],
  [
    "charts/pie-chart",
    {
      title: "Pie Chart",
      theme: "Material",
      themeMode: "Light",
      content:
        "Part-to-whole chart that shows how categories (parts) of a data set add up to a total (whole) value.",
      moreLink:
        "https://www.infragistics.com/products/ignite-ui-react/react/components/charts/types/pie-chart",
      downloadLink:
        "https://www.infragistics.com/resources/sample-applications/pie-chart-sample-app-react",
    },
  ],
  [
    "charts/step-chart",
    {
      title: "Step Chart",
      theme: "Material",
      themeMode: "Light",
      content:
        "Emphasizes the amount of change over a period of time or compares multiple items at once.",
      moreLink:
        "https://www.infragistics.com/products/ignite-ui-react/react/components/charts/types/step-chart",
      downloadLink:
        "https://www.infragistics.com/resources/sample-applications/step-chart-sample-app-react",
    },
  ],
  [
    "charts/polar-chart",
    {
      title: "Polar Chart",
      theme: "Material",
      themeMode: "Light",
      content:
        "Emphasizes the amount of change over a period of time or compares multiple items at once.",
      moreLink:
        "https://www.infragistics.com/products/ignite-ui-react/react/components/charts/types/polar-chart",
      downloadLink:
        "https://www.infragistics.com/resources/sample-applications/polar-chart-sample-app-react",
    },
  ],
]);

export default function HomeView() {

  const location = useLocation();
  const [activeView, setActiveView] = useState("inventory");
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isChartsSection, setIsChartsSection] = useState<boolean>(false);
  const [tabInfo, setTabInfo] = useState(tabInfoGrids);
  const [activeTabs, setActiveTabs] = useState(tabsGrids);
  const fullscreenRef = useRef<HTMLDivElement>(null);
  const iframeSrc = import.meta.env.BASE_URL + activeView;

  const requestFullscreen = (el: HTMLElement) =>
    el.requestFullscreen?.() || (el as any).webkitRequestFullscreen?.();

  const exitFullscreen = () =>
    document.exitFullscreen?.() ||
    (document as any).webkitExitFullscreen?.();

  const checkFullscreen = () =>
    !!(
      document.fullscreenElement ||
      (document as any).webkitFullscreenElement ||
      (window.innerHeight === screen.height &&
        window.innerWidth === screen.width)
    );

  useEffect(() => {
    registerIcon("file_download", FILE_DOWNLOAD, "custom");
    registerIcon("view_more", VIEW_MORE, "custom");
    registerIcon("full_screen", FULL_SCREEN, "custom");
    registerIcon("exit_full_screen", EXIT_FULL_SCREEN, "custom");
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;

    const onFullscreenChange = () => {
      setIsFullscreen(checkFullscreen());
    };

    const onResize = () => {
      setIsFullscreen(checkFullscreen());
    };

    document.addEventListener("fullscreenchange", onFullscreenChange);
    document.addEventListener("webkitfullscreenchange", onFullscreenChange); // Safari / Mac
    window.addEventListener("resize", onResize);

    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", onFullscreenChange);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  // Update tabs based on current route
  useEffect(() => {
    const path = location.pathname.replace("/home/", "");
    if (path.startsWith("charts")) {
      setTabInfo(tabInfoCharts);
      setActiveTabs(tabsCharts);
      setIsChartsSection(true);
    } else {
      setTabInfo(tabInfoGrids);
      setActiveTabs(tabsGrids);
      setIsChartsSection(false);
    }

    setActiveView(path);
  }, [location]);


  const onDownloadClick = (event: MouseEvent, tabName: string) => {
    event.preventDefault();
    event.stopPropagation();

    if (typeof window === "undefined") return;

    const downloadLink = tabInfo.get(tabName)?.downloadLink;
    if (downloadLink) {
      window.open(downloadLink, "_blank")?.focus();
    }
  };

  const onViewMoreClick = (event: MouseEvent, tabName: string) => {
    event.preventDefault();
    event.stopPropagation();

    if (typeof window === "undefined") return;

    const moreLink = tabInfo.get(tabName)?.moreLink;
    if (moreLink) {
      window.open(moreLink, "_blank")?.focus();
    }
  };

  const onToggleFullscreen = async () => {
    const el = fullscreenRef.current;
    if (!el) return;

    try {
      if (!isFullscreen) {
        await requestFullscreen(el);
      } else {
        await exitFullscreen();
      }

    } catch (err) {
      console.error("Fullscreen toggle failed", err);
    }
  };

  return (
    <div className="demo-container" ref={fullscreenRef}>
      {!isFullscreen && (
        <div className="tab-container">
          {isChartsSection
            ? activeTabs.map(({ key }) => (
                <NavLink key={key} to={`/home/charts/${key}`}>
                  {({ isActive }) => (
                    <TabItem
                      isActive={isActive}
                      tabInfo={tabInfo?.get(`charts/${key}`)}
                    />
                  )}
                </NavLink>
              ))
            : activeTabs.map(({ key }) => (
                <NavLink key={key} to={`/home/${key}`}>
                  {({ isActive }) => (
                    <TabItem isActive={isActive} tabInfo={tabInfo?.get(key)} />
                  )}
                </NavLink>
              ))}
        </div>
      )}

      <TabItemInfo
        tabName={activeView}
        tabInfo={tabInfo}
        isFullscreen={isFullscreen}
        onDownloadClick={onDownloadClick}
        onViewMoreClick={onViewMoreClick}
        onToggleFullscreen={onToggleFullscreen}
      ></TabItemInfo>

      <div className="router-container">
        <iframe
          src={iframeSrc}
          height="100%"
          width="100%"
          style={{ border: 0 }}
        />
      </div>
    </div>
  );
}
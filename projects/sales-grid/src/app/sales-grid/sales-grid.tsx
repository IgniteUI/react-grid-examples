import { useEffect, useState } from 'react';
import { IgrButton, IgrDropdown, IgrDropdownItem, IgrIcon, registerIcon } from 'igniteui-react';
import {
  FilteringLogic,
  IgrColumn,
  IgrFilteringExpressionsTree,
  IgrPivotConfiguration,
  IgrPivotDataSelector,
  IgrPivotDateDimension,
  IgrPivotGrid,
  IgrPivotValue,
  IgrStringFilteringOperand,
  SortingDirection
} from 'igniteui-react-grids';
import { SalesDataService } from '../services/data.service';

import './sales-grid.scss';

import ARROW_DOWN_SVG from "../data/icons/arrow_drop_down.svg";
import ARROW_UP_SVG from "../data/icons/arrow_drop_up.svg";
import VISIBILITY_SVG from "../data/icons/visibility.svg";
import FILE_DOWNLOAD_SVG from "../data/icons/file_download.svg";
import FLAGS from "../data/flags.json";
import { html } from 'lit';

enum PivotViews {
  BrandsSeparate = 'brandsOr',
  BrandsCombined = 'jeansAnd',
  Stores = 'stores'
}

class IgrSaleProfitAggregate {
  public static totalProfit = (_: any, data: any[] | undefined) =>
    data?.reduce((accumulator, value) => accumulator + (value.Sale - value.Cost), 0) || 0;

  public static averageProfit = (_: any, data: any[] | undefined) => {
    let average = 0;
    if (data?.length === 1) {
      average = data[0].Sale - data[0].Cost;
    } else if (data && data.length > 1) {
      const mappedData = data.map(x => x.Sale - x.Cost);
      average = mappedData.reduce((a, b) => a + b) / mappedData.length;
    }
    return average;
  }

  public static minProfit = (_: any, data: any[] | undefined) => {
    let min = 0;
    if (data?.length === 1) {
      min = data[0].Sale - data[0].Cost;
    } else if (data && data.length > 1) {
      const mappedData = data.map(x => x.Sale - x.Cost);
      min = mappedData.reduce((a, b) => Math.min(a, b));
    }
    return min;
  };

  public static maxProfit = (_: any, data: any[] | undefined) => {
    let max = 0;
    if (data?.length === 1) {
      max = data[0].Sale - data[0].Cost;
    } else if (data && data.length > 1) {
      const mappedData = data.map(x => x.Sale - x.Cost);
      max = mappedData.reduce((a, b) => Math.max(a, b));
    }
    return max;
  };
}

// Shows the full-date leaves as they are in the data (M/d/yyyy) instead of the locale's short date.
const dateAsInData = (value: string) => value;

export default function SalesGrid() {
  const [viewDropdown, setViewDropdown] = useState<IgrDropdown>();
  function viewDropdownRef(ref: IgrDropdown) {
    setViewDropdown(ref);
  }

  const [pivotGrid, setPivotGrid] = useState<IgrPivotGrid>();
  function pivotGridRef(ref: IgrPivotGrid) {
    setPivotGrid(ref);
  }

  const [salesData, setSalesData] = useState<any[]>([]);
  const [viewDropdownOpen, setViewDropdownOpen] = useState(false);

  const flagsData = FLAGS;
  const brandFilter: IgrFilteringExpressionsTree = {
    operator: FilteringLogic.Or,
    fieldName: 'Brand',
    filteringOperands: [
      {
        operator: FilteringLogic.Or,
        fieldName: 'Brand',
        filteringOperands: [
          {
            condition: IgrStringFilteringOperand.instance().condition('equals'),
            fieldName: 'Brand',
            searchVal: 'HM'
          },
          {
            condition: IgrStringFilteringOperand.instance().condition('equals'),
            fieldName: 'Brand',
            searchVal: 'HM Home'
          },
        ]
      }
    ]
  };
  const bulgariaCountryFilter = {
    operator: FilteringLogic.And,
    filteringOperands: [
      {
        condition: IgrStringFilteringOperand.instance().condition('equals'),
        fieldName: 'Country',
        searchVal: 'Bulgaria'
      },
    ]
  };
  //const fileName = 'SalesGridApp';

  const saleValue: IgrPivotValue = {
    enabled: true,
    member: 'Sale',
    displayName: 'Sales',
    aggregate: {
      key: 'SUM',
      aggregatorName: 'SUM',
      label: 'Sum'
    },
    aggregateList: [
      {
        key: 'AVG',
        aggregatorName: 'AVG',
        label: 'Average'
      },
      {
        key: 'COUNT',
        aggregatorName: 'COUNT',
        label: 'Count'
      },
      {
        key: 'MAX',
        aggregatorName: 'MAX',
        label: 'Maximum'
      },
      {
        key: 'MIN',
        aggregatorName: 'MIN',
        label: 'Minimum'
      },
      {
        key: 'SUM',
        aggregatorName: 'SUM',
        label: 'Sum'
      },
    ],
    formatter: (value: any, _: any, __: any) => {
      return currencyFormatter(value, 'Sale');
    }
  };
  const profitValue: IgrPivotValue = {
    enabled: true,
    member: 'Cost',
    displayName: 'Profit',
    aggregate: {
      key: 'SUM',
      aggregator: IgrSaleProfitAggregate.totalProfit,
      label: 'Sum'
    },
    aggregateList: [
      {
        key: 'AVG',
        aggregator: IgrSaleProfitAggregate.averageProfit,
        label: 'Average'
      },
      {
        key: 'COUNT',
        aggregatorName: 'COUNT',
        label: 'Count'
      },
      {
        key: 'MAX',
        aggregator: IgrSaleProfitAggregate.maxProfit,
        label: 'Maximum'
      },
      {
        key: 'MIN',
        aggregator: IgrSaleProfitAggregate.minProfit,
        label: 'Minimum'
      },
      {
        key: 'SUM',
        aggregator: IgrSaleProfitAggregate.totalProfit,
        label: 'Sum'
      },
    ],
    formatter: (value: any, _: any, __: any) => {
      return currencyFormatter(value, 'Cost');
    }
  };
  const pivotConfigBrands: IgrPivotConfiguration = {
    columns: [
      {
        enabled: true,
        memberName: 'Country',
        displayName: 'Country'
      },
      {
        enabled: true,
        memberName: 'Brand',
        displayName: 'Brand'
      },
      {
        enabled: false,
        memberName: 'Store',
        displayName: 'Store'
      },
    ],
    rows: [
      new IgrPivotDateDimension({
        memberName: 'Date',
        displayName: 'All Periods',
        enabled: true,
        headerFormatter: dateAsInData
      },
        {
          fullDate: true,
          quarters: true,
          months: false,
        })
    ],
    values: [
      saleValue,
      profitValue
    ],
    filters: [
      {
        enabled: true,
        memberName: 'Brand',
        displayName: 'Brand',
        filter: brandFilter
      },
    ]
  };
  const pivotConfigBrandsCombined: IgrPivotConfiguration = {
    columns: [
      {
        enabled: true,
        memberName: 'Country',
        displayName: 'Country'
      },
      {
        enabled: false,
        memberName: 'Store',
        displayName: 'Store'
      },
    ],
    rows: [
      new IgrPivotDateDimension({
        memberName: 'Date',
        displayName: 'All Periods',
        enabled: true,
        headerFormatter: dateAsInData
      },
        {
          fullDate: true,
          quarters: true,
          months: false,
        })
    ],
    values: [
      saleValue,
      profitValue
    ],
    filters: [
      {
        enabled: true,
        memberName: 'Brand',
        displayName: 'Brand',
        filter: brandFilter
      },
    ]
  };
  const pivotConfigStores: IgrPivotConfiguration = {
    columns: [
      new IgrPivotDateDimension({
        memberName: 'Date',
        displayName: 'All Periods',
        enabled: true
      },
        {
          months: false,
          fullDate: false,
          quarters: true
        })
    ],
    rows: [
      {
        memberName: 'Store',
        displayName: 'Store',
        enabled: true,
        sortDirection: SortingDirection.Asc,
        width: "140px"
      },
      {
        memberName: 'Brand',
        displayName: 'Brand',
        enabled: true,
        sortDirection: SortingDirection.Asc,
        width: "140px"
      }
    ],
    values: [
      saleValue,
      profitValue
    ],
    filters: [
      {
        memberName: "Country",
        displayName: 'Country',
        filter: bulgariaCountryFilter,
        enabled: true
      }
    ]
  };

  const availableConfigs = new Map<PivotViews, { title: string, config: IgrPivotConfiguration }>([
    [PivotViews.BrandsSeparate, { title: 'Brands: HM and HM Home', config: pivotConfigBrands }],
    [PivotViews.BrandsCombined, { title: 'Brands: HM + HM Home', config: pivotConfigBrandsCombined }],
    [PivotViews.Stores, { title: 'Stores: Bulgaria', config: pivotConfigStores }]
  ]);
  const [selectedConfigRef, setSelectedConfigRef] = useState(availableConfigs.get(PivotViews.BrandsSeparate));

  useEffect(() => {
    SalesDataService.getSalesData().then(data => {
      setSalesData(data);
    });

    registerIcon("arrow_down", ARROW_DOWN_SVG, "material");
    registerIcon("arrow_up", ARROW_UP_SVG, "material");
    registerIcon("visibility", VISIBILITY_SVG, "material");
    registerIcon("file_download", FILE_DOWNLOAD_SVG, "custom");
  }, []);

  function onViewDropdownButton(event: React.MouseEvent<IgrButton, MouseEvent>) {
    viewDropdown?.toggle(event.currentTarget as HTMLElement);
    setViewDropdownOpen(!viewDropdownOpen);
  }

  function onExportDropdownButton(event: React.MouseEvent<IgrButton, MouseEvent>) {
    console.log("Export to Excel temporary not available.", event);
    // TO DO
    // Once Excel and CSV exporter are available in React
    // let options!: IgrExporterOptionsBase;
    // const newId = event.detail.id;
    // if (newId === 'csv') {
    //     options = new IgrCsvExporterOptions(this.fileName, CsvFileTypes.CSV);
    //     this.csvExporter.export(this.pivotGrid, options);
    // } else if (newId === 'excel') {
    //     options = new IgrExcelExporterOptions(this.fileName);
    //     this.excelExporter.export(this.pivotGrid, options);
    // }
  }

  function onViewDropdownVisibility(_: CustomEvent<void>) {
    setViewDropdownOpen(!viewDropdownOpen);
  }

  function onViewSelection(event: CustomEvent<IgrDropdownItem>) {
    setSelectedConfigRef(availableConfigs.get(event.detail.id as PivotViews));
  }

  function onColumnInit(event: CustomEvent<IgrColumn>) {
    const col = event.detail;
    const countryKeys = Object.keys(flagsData);

    // TO DO: Change this with React templates instead of lit html
    if (countryKeys.includes(col.field)) {
      col.headerTemplate = () => {
        return (
          html`<div class="countryHeader">
            <img
              class="countryImage"
              .src=${flagsData[col.field as keyof typeof flagsData]}
              .alt=${col.field}
            />
            <span>${col.field}</span>
          </div>`
        );
      };
    }
  }

  function currencyFormatter(value: any, field: string) {
    if (value === undefined || value === null){
      return "";
    }
    const valueConfig = selectedConfigRef?.config.values.find(value => value.member === field);
    if (!valueConfig || valueConfig.aggregate.key === "COUNT") {
      return value;
    }
    const roundedValue = (Math.round(value * 100) / 100).toString();
    const numLength = roundedValue.split('').length;
    const separatedValue = roundedValue.split('').reverse()
      .reduce((prev, curr, index) => prev + curr + ((index + 1) % 3 === 0 && index < numLength - 1 ? "," : ""))
      .split('').reverse().join("");
    return "$" + separatedValue;
  }

  return (
    <div className="rootSample">
      <div className="pivotToolbar igx-grid__tr-pivot">
        <span className="igx-grid-toolbar__title">Sales Dashboard</span>
        <div>
          <IgrButton variant="contained" style={{ marginRight: "10px" }} onClick={onViewDropdownButton}>
            <IgrIcon name="visibility" collection="material"></IgrIcon>
            {selectedConfigRef?.title}
            <IgrIcon key={'viewDropdown-' + viewDropdownOpen} name={viewDropdownOpen ? "arrow_up" : "arrow_down"} collection="material"></IgrIcon>
          </IgrButton>
          <IgrButton variant="outlined" onClick={onExportDropdownButton}>
            <IgrIcon name="file_download" collection="custom"></IgrIcon>
            Export to Excel
          </IgrButton>
          <IgrDropdown id="viewDropdown" ref={viewDropdownRef} onChange={onViewSelection} onClosed={onViewDropdownVisibility}>
            {Array.from(availableConfigs.entries()).map(([key, value]) =>
              <IgrDropdownItem id={key} key={key} selected={selectedConfigRef?.title === value.title}><span>{value.title}</span></IgrDropdownItem>
            )}
          </IgrDropdown>
        </div>
      </div>
      <div className="pivotRow">
        <div className="pivotContainer" key="sales-grid">
          <IgrPivotGrid
            ref={pivotGridRef}
            isLoading={!salesData.length}
            data={salesData}
            superCompactMode={true}
            defaultExpandState={true}
            pivotConfiguration={selectedConfigRef?.config}
            onColumnInit={onColumnInit}>
          </IgrPivotGrid>
        </div>
        <div className="selectorContainer" key="pivot-data-selector">
          <IgrPivotDataSelector grid={pivotGrid}></IgrPivotDataSelector>
        </div>
      </div>
    </div>
  );
}

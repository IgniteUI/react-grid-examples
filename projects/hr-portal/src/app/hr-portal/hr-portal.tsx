import { useState, useEffect, useRef } from "react";
import "./hr-portal.scss";

import {
  IgrTreeGrid,
  IgrGridToolbar,
  IgrGridToolbarTitle,
  IgrGridToolbarActions,
  IgrGridToolbarAdvancedFiltering,
  IgrGridToolbarHiding,
  IgrGridToolbarPinning,
  IgrGridToolbarExporter,
  IgrColumn,
  IgrPaginator,
  IgrCellTemplateContext,
} from "igniteui-react-grids";
import {
  IgrIcon,
  IgrAvatar,
  IgrIconButton,
  IgrButton,
  registerIcon,
} from "igniteui-react";
import { dataService } from "./../services/data.service";
import { icons } from "../data/icons/Icons";
import { Employee } from "../data/Models/Employee";

export default function HRPortal() {
  const [data, setData] = useState<Employee[]>([]);
  const [isSorted, setIsSorted] = useState(false);
  const gridRef = useRef<IgrTreeGrid | null>(null);

  useEffect(() => {
    dataService.fetchData().then((fetchedData: Employee[]) => {
      setData(fetchedData);
    });

    icons.forEach(
      (element: { name: string; path: string; category: string }) => {
        const normalizedPath = `${import.meta.env.BASE_URL}${element.path.slice(1)}`;
        registerIcon(element.name, normalizedPath, element.category);
      }
    );
  }, []);

  const avatarTemplate = ({ cell }: IgrCellTemplateContext) => {
    const data = cell.row.data;
    return (
      <div className="employeeDiv">
        <IgrAvatar shape="rounded" src={data.Picture} className="small" />
        <span>{data.Name}</span>
      </div>
    );
  };

  const countryIconTemplate = ({ cell }: IgrCellTemplateContext) => {
    const data = cell.row?.data;
    if (!data) {
      return <div>No Data</div>; // Fallback for missing data
    }
    return (
      <div className="flagDiv">
        <IgrIcon collection="country-icons" name={data.Country} />
        <span>
          {data.Location}, {data.Country}
        </span>
      </div>
    );
  };

  const contactsTemplate = ({ cell }: IgrCellTemplateContext) => {
    const data = cell.row.data;
    return (
      <div className="center-content small">
        <a href={`mailto:${data.Email}`}>
          <IgrIconButton collection="hr-icons" name="mail" variant="flat" />
        </a>
        <a href={`tel:${data.Phone}`}>
          <IgrIconButton collection="hr-icons" name="tel" variant="flat" />
        </a>
        <a href="https://www.linkedin.com" target="_blank" rel="noreferrer">
          <IgrIconButton collection="hr-icons" name="linkedIn" variant="flat" />
        </a>
      </div>
    );
  };

  const dateTemplate = ({ cell }: IgrCellTemplateContext) => {
    const formattedDate = new Date(cell.value).toISOString().split("T")[0];
    return <>{formattedDate}</>;
  };

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
    <IgrTreeGrid
      id="treeGrid"
      autoGenerate={false}
      ref={gridRef}
      data={data}
      isLoading={!data.length}
      primaryKey="ID"
      childDataKey="Employees"
      rowSelection="multipleCascade"
      allowFiltering={true}
      filterMode="excelStyleFilter"
      className="gridStyle"
      onSortingExpressionsChange={handleSortingChanged}
    >
      <IgrPaginator perPage={20} />
      <IgrGridToolbar>
        <IgrGridToolbarTitle key="toolbarTitle">
          <span key="toolbarTitleText">HR Portal</span>
        </IgrGridToolbarTitle>
        <IgrGridToolbarActions>
          {isSorted && (
            <div className="icon-button-group">
              <IgrButton variant="flat" onClick={clearSorting}>
                <IgrIcon
                  name="close"
                  collection="hr-icons"
                  className="medium"
                />
                Clear Sort
              </IgrButton>
            </div>
          )}
          <IgrGridToolbarHiding />
          <IgrGridToolbarPinning />
          <IgrGridToolbarExporter>
            <span slot="excelText">Export</span>
          </IgrGridToolbarExporter>
          <IgrGridToolbarAdvancedFiltering />
        </IgrGridToolbarActions>
      </IgrGridToolbar>

      <IgrColumn
        field="Name"
        width="300px"
        sortable={true}
        pinned={true}
        bodyTemplate={avatarTemplate}
      />
      <IgrColumn
        field="JobTitle"
        header="Job Title"
        dataType="string"
        minWidth="200px"
        sortable={true}
      />
      <IgrColumn
        field="Department"
        dataType="string"
        minWidth="200px"
        sortable={true}
      />
      <IgrColumn
        field="Location"
        dataType="string"
        sortable={true}
        bodyTemplate={countryIconTemplate}
      />
      <IgrColumn
        field="Contacts"
        dataType="string"
        minWidth="200px"
        filterable={false}
        bodyTemplate={contactsTemplate}
      />
      <IgrColumn
        field="HireDate"
        header="Hire Date"
        dataType="date"
        minWidth="100px"
        sortable={true}
        bodyTemplate={dateTemplate}
      />
      <IgrColumn
        field="GrossSalary"
        header="Gross Salary"
        dataType="currency"
        minWidth="100px"
        sortable={true}
      />
    </IgrTreeGrid>
  );
}

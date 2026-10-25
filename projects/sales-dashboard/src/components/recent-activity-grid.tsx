import { useEffect, useRef } from "react";
import { IgrColumn, IgrGrid, type IgrCellTemplateContext } from "igniteui-react-grids";
import { activityRows, stageClassFor } from "../data/sales-data";

/** The deal stage as a pill in its own semantic colour. */
function StageCell(ctx: IgrCellTemplateContext) {
  const stage = ctx.cell.value as string;
  return <span className={`stage-pill ${stageClassFor(stage)}`}>{stage}</span>;
}

/** The latest deals, one row each. */
export default function RecentActivityGrid() {
  const gridRef = useRef<IgrGrid>(null);

  // The grid works out its `aria-rowcount` once, when it first renders, which is
  // before it has been given any rows, and never updates it; so the count (the
  // rows plus the header row) is stated here.
  useEffect(() => {
    gridRef.current?.setAttribute("aria-rowcount", String(activityRows.length + 1));
  }, []);

  return (
    <IgrGrid ref={gridRef} className="activity-grid" data={activityRows} autoGenerate={false}>
      <IgrColumn field="company" header="COMPANY" sortable={false} filterable={false} />
      <IgrColumn field="region" header="REGION" sortable={false} filterable={false} />
      <IgrColumn field="stage" header="STAGE" sortable={false} filterable={false} bodyTemplate={StageCell} />
      <IgrColumn field="value" header="VALUE" sortable={false} filterable={false} />
      <IgrColumn field="rep" header="REP" sortable={false} filterable={false} />
      <IgrColumn field="source" header="SOURCE" sortable={false} filterable={false} />
      <IgrColumn field="when" header="WHEN" sortable={false} filterable={false} />
    </IgrGrid>
  );
}

import { IgrAvatar, IgrBadge, IgrCard, IgrCardContent, IgrIcon } from "igniteui-react";
import { metrics } from "../data/sales-data";
import { SALES_ICON_COLLECTION } from "../theme/icons";

/** The four headline numbers. */
export default function MetricCards() {
  return (
    <section className="metrics-grid" aria-label="KPI metrics">
      {metrics.map((item) => (
        <IgrCard className="metric-tile" key={item.label}>
          <IgrCardContent className="metric-body">
            <div className="metric-head">
              <span className="metric-label">{item.label}</span>
              <IgrAvatar className={`metric-icon ${item.iconClass}`} aria-hidden="true">
                <IgrIcon name={item.icon} collection={SALES_ICON_COLLECTION} aria-hidden="true" />
              </IgrAvatar>
            </div>
            <div className="metric-value">{item.value}</div>
            <IgrBadge
              className={item.positive ? "metric-delta" : "metric-delta negative"}
              variant={item.positive ? "success" : "danger"}
            >
              <IgrIcon
                name={item.positive ? "arrow_upward" : "arrow_downward"}
                collection={SALES_ICON_COLLECTION}
                aria-hidden="true"
              />
              {item.delta}
            </IgrBadge>
          </IgrCardContent>
        </IgrCard>
      ))}
    </section>
  );
}

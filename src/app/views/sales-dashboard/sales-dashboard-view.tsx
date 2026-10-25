import { lazy, Suspense } from "react";

// The sample and its styles load in their own chunk when the route opens, so the shell's
// main bundle, which every page loads, does not carry them.
const SalesDashboardContent = lazy(() => import("./sales-dashboard-content"));

export default function SalesDashboardView() {
  return (
    <div data-app="sales-dashboard" style={{ height: "100%" }}>
      <Suspense fallback={null}>
        <SalesDashboardContent />
      </Suspense>
    </div>
  );
}

import { lazy, Suspense } from "react";

// The sample and its styles load in their own chunk when the route opens, so the shell's
// main bundle, which every page loads, does not carry them.
const NewFleetManagementContent = lazy(() => import("./fleet-management-new-content"));

export default function NewFleetManagementView() {
  return (
    <div data-app="fleet-management-new" style={{ height: "100%" }}>
      <Suspense fallback={null}>
        <NewFleetManagementContent />
      </Suspense>
    </div>
  );
}

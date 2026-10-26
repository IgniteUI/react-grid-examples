import { lazy, Suspense } from "react";

// The sample and its styles load in their own chunk when the route opens, so the shell's
// main bundle, which every page loads, does not carry them.
const ExcelContent = lazy(() => import("./excel-content"));

export default function ExcelView() {
  return (
    <div data-app="excel" style={{ height: "100%" }}>
      <Suspense fallback={null}>
        <ExcelContent />
      </Suspense>
    </div>
  );
}

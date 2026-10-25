import { lazy, Suspense } from "react";

// The sample and its styles load in their own chunk when the route opens, so the shell's
// main bundle, which every page loads, does not carry them.
const NewFinanceGridContent = lazy(() => import("./finance-grid-new-content"));

export default function NewFinanceGridView() {
  return (
    <div data-app="finance-grid-new" style={{ height: "100%" }}>
      <Suspense fallback={null}>
        <NewFinanceGridContent />
      </Suspense>
    </div>
  );
}

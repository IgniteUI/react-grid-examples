import { lazy, Suspense } from "react";

// The sample and its styles load in their own chunk when the route opens, so the shell's
// main bundle, which every page loads, does not carry them.
const GridFintech100kContent = lazy(() => import("./grid-fintech-100k-content"));

export default function GridFintech100kView() {
  return (
    <div data-app="grid-fintech-100k" style={{ height: "100%" }}>
      <Suspense fallback={null}>
        <GridFintech100kContent />
      </Suspense>
    </div>
  );
}

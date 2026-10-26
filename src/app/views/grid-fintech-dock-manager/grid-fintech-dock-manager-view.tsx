import { lazy, Suspense } from "react";

// The sample and its styles load in their own chunk when the route opens, so the shell's
// main bundle, which every page loads, does not carry them.
const GridFintechDockManagerContent = lazy(() => import("./grid-fintech-dock-manager-content"));

export default function GridFintechDockManagerView() {
  return (
    <div data-app="grid-fintech-dock-manager" style={{ height: "100%" }}>
      <Suspense fallback={null}>
        <GridFintechDockManagerContent />
      </Suspense>
    </div>
  );
}

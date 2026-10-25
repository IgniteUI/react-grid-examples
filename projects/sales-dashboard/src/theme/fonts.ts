/**
 * The fonts the dashboard draws with. Barlow and Barlow Condensed set the page,
 * and Titillium Web is the face the charts give their doughnut slice labels
 * unless they are told otherwise.
 *
 * The standalone project's `index.html` links the same URL, so keep the two in
 * step. Inside the demo shell there is no such link and `loadFontStylesheet()`
 * adds one.
 */
const SALES_FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700&family=Barlow+Condensed:wght@600;700&family=Titillium+Web:wght@400&display=swap";

/**
 * The faces the charts measure and paint their labels in. They are canvas text:
 * a chart lays its labels out once, with the metrics of whatever face is there
 * when it is built, and never again.
 */
const CHART_FONTS: readonly string[] = ["500 13px Barlow", "13px 'Titillium Web'"];

/** The stylesheet this module added, while it is loading or loaded. */
let addedStylesheet: Promise<void> | undefined;

/**
 * Resolves once the fonts stylesheet has loaded or failed to.
 *
 * Until a stylesheet has declared its faces, `document.fonts.load()` has
 * nothing to wait for and resolves at once. A link that the host page carries
 * has settled before any script runs; one added here is dropped again when it
 * fails, so that the next call tries it afresh.
 */
function loadFontStylesheet(): Promise<void> {
  const present = document.head.querySelector(`link[rel="stylesheet"][href="${SALES_FONTS_HREF}"]`);
  if (present) return addedStylesheet ?? Promise.resolve();

  addedStylesheet = new Promise<void>((resolve) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = SALES_FONTS_HREF;
    link.addEventListener("load", () => resolve(), { once: true });
    link.addEventListener(
      "error",
      () => {
        link.remove();
        addedStylesheet = undefined;
        resolve();
      },
      { once: true },
    );
    document.head.append(link);
  });
  return addedStylesheet;
}

/** Resolves once the faces the charts draw their labels in have loaded or failed to. */
export async function loadChartFonts(): Promise<void> {
  await loadFontStylesheet();
  await Promise.allSettled(CHART_FONTS.map((font) => document.fonts.load(font)));
}

import { DataChartStylingDefaults } from "igniteui-react-charts";

/** The styling table is typed by its default entries, but its text entries have a font family. */
const stylingDefaults = DataChartStylingDefaults as unknown as Record<string, unknown>;

/** The web font the charts package puts first in its font stacks. */
const PREFERRED_FONT = /"?Titillium Web"?,\s*/;

/** An object in the styling table that holds a font family, with the value it started with. */
interface FontFamilyHolder {
  holder: Record<string, unknown>;
  family: string;
}

/**
 * Every holder of a font family in the table that can be changed. An entry that is not an
 * object, has no string font family or is read-only is left out, so a change to the table in
 * the charts package costs the sample this adjustment, and nothing else.
 */
function fontFamilyHolders(): FontFamilyHolder[] {
  if (typeof stylingDefaults !== "object" || stylingDefaults === null) {
    return [];
  }

  const holders: FontFamilyHolder[] = [];
  for (const entry of [stylingDefaults, ...Object.values(stylingDefaults)]) {
    if (typeof entry !== "object" || entry === null) {
      continue;
    }

    const property = Object.getOwnPropertyDescriptor(entry, "font-family");
    if (property?.writable && typeof property.value === "string") {
      holders.push({ holder: entry as Record<string, unknown>, family: property.value });
    }
  }

  return holders;
}

/**
 * Takes the charts package's preferred web font out of the font stacks that its charts use for
 * their axis labels and titles, leaving Verdana, Arial and the generic family.
 *
 * The charts measure their text in the first font of the stack that the page has loaded. A page
 * that loads that web font, as the samples page does, would size the plots of the Spreadsheet's
 * charts differently from a page that does not.
 *
 * The table is shared by every chart on the page, and the charts read it when they are created,
 * so call this before the workbook is set. Call it from an effect and return the result from it:
 * the function it returns puts the original stacks back.
 *
 * This can go once the Spreadsheet's charts lay out the same with or without that web font.
 */
export function retainSystemChartFonts(): () => void {
  const original = fontFamilyHolders();
  for (const { holder, family } of original) {
    holder["font-family"] = family.replace(PREFERRED_FONT, "");
  }

  return () => {
    for (const { holder, family } of original) {
      holder["font-family"] = family;
    }
  };
}

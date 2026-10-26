interface TrendRow {
  changeP: number;
}

/**
 * Grid cell classes reflecting the magnitude and direction of the daily percent
 * change. Each key is a class name and each predicate decides whether the cell
 * carries it; the styles are in styles/_finjs-trends.scss.
 */
export const trends = {
  positive: (rowData: TrendRow): boolean => rowData.changeP > 0,
  negative: (rowData: TrendRow): boolean => rowData.changeP < 0,
  changePos: (rowData: TrendRow): boolean => rowData.changeP > 0 && rowData.changeP < 1,
  changeNeg: (rowData: TrendRow): boolean => rowData.changeP < 0 && rowData.changeP > -1,
  strongPositive: (rowData: TrendRow): boolean => rowData.changeP >= 1,
  strongNegative: (rowData: TrendRow): boolean => rowData.changeP <= -1,
};

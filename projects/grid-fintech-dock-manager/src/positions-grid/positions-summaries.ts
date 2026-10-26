import { IgrNumberSummaryOperand, type IgrSummaryResult } from "igniteui-react-grids";
import { formatMoney } from "../util/finance";

/**
 * Summary operand for the positions grid's money columns. Keeping it out of the
 * component keeps the totals formatted like the rest of the desk.
 */
export class CurrencySumSummary extends IgrNumberSummaryOperand {
  override operate(data: number[] = []): IgrSummaryResult[] {
    const total = data.reduce((sum, value) => sum + value, 0);

    return [
      { key: "total", label: "Total", summaryResult: formatMoney(total) },
      { key: "count", label: "Positions", summaryResult: data.length },
    ];
  }
}

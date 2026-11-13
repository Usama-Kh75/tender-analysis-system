import type { BOQItem, TenderProject } from '../types/tender';

export interface UnitOutlier {
  bidderId: string;
  itemId: string;
  itemNo: BOQItem['itemNo'];
  unitPrice: number;
  reference: number;
  factor: number;
  direction: 'high' | 'low';
}

// المفرد المدون في الخلية فقط؛ لا نستبدله بالمبلغ ÷ الكمية أو بسعر العرض الموزون.
const validPrice = (item: BOQItem | undefined): item is BOQItem & { enteredUnitPrice: number } =>
  !!item && !item.unpriced && Number.isFinite(item.enteredUnitPrice) && (item.enteredUnitPrice ?? 0) > 0;

/** تنبيه للمراجعة، لا تصحيح ولا علامة محفوظة في بيانات العطاء. */
export function unitPriceOutliers(project: TenderProject): UnitOutlier[] {
  const result: UnitOutlier[] = [];
  for (const bidder of project.bidders) {
    bidder.items.forEach((item, index) => {
      if (!validPrice(item)) return;
      const others = project.bidders
        .filter(other => other.id !== bidder.id)
        .map(other => other.items[index])
        .filter(other => validPrice(other) && other.itemNo === item.itemNo)
        .map(other => other.enteredUnitPrice!)
        .sort((a, b) => a - b);
      if (others.length < 2) return;
      const middle = Math.floor(others.length / 2);
      const reference = others.length % 2 ? others[middle] : others[middle - 1] / 2 + others[middle] / 2;
      const factor = item.enteredUnitPrice / reference;
      // السماح نسبي إلى الأس العشري نفسه، وحدّاه داخلان في المجال.
      const decimal = [-3, -2, -1, 1, 2, 3].some(power => {
        const relative = factor / 10 ** power;
        return relative >= 0.85 - Number.EPSILON && relative <= 1.15 + Number.EPSILON;
      });
      if (decimal) result.push({ bidderId: bidder.id, itemId: item.id, itemNo: item.itemNo,
        unitPrice: item.enteredUnitPrice, reference, factor, direction: factor > 1 ? 'high' : 'low' });
    });
  }
  return result;
}

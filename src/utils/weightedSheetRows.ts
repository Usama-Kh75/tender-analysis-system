import type { Bidder, BOQItem } from '../types/tender';

export type WeightedSource = 'offer' | 'formula';

export interface WeightedSheetRow {
  item: BOQItem;
  /** فقرة بلا سعر في الجدول: تُعرض شرطة بدل المفرد والمبلغ */
  dash: boolean;
  unit: number;
  total: number;
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** صفوف «الجدول الموزون»: مصدر واحد لورقة Excel وللجدول على الشاشة. عرض فقط، لا حساب جديد. */
export function weightedSheetRows(bidder: Bidder, source: WeightedSource): { rows: WeightedSheetRow[]; sum: number } {
  const byFormula = source === 'formula';
  const rows = bidder.items.map<WeightedSheetRow>(item => {
    const unit = byFormula ? item.weightedUnitPrice
      : item.offerUnitPrice ?? (item.quantity > 0 ? item.bidderTotal / item.quantity : item.bidderTotal);
    const total = byFormula ? item.newPrice : item.offerTotal ?? item.bidderTotal;
    const dash = byFormula ? !(item.estimatedTotal > 0) : !!item.unpriced && !((item.offerTotal ?? 0) > 0);
    return { item, dash, unit, total };
  });
  const sum = round2(rows.reduce((s, r) => s + (byFormula && r.dash ? 0 : r.total), 0));
  return { rows, sum };
}

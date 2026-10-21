import { calculateBOQMetrics } from '../utils/calculations';
import { Bidder, BOQItem, ReadingField } from '../types/tender';

// فقرة بلا أي سعر للمجهز (للتصفير ولشركة جديدة): تُصفَّر حقول السعر كلها معاً، لأن تصفير الإجمالي
// وحده يجعل calculateBOQMetrics يعيد بناءه من سعر المفرد × الكمية فتبقى المبالغ أو تُنسخ لشركة أخرى
export const withoutBidderPrices = (item: BOQItem): Partial<BOQItem> => ({
  ...item,
  bidderTotal: 0,
  bidderUnitPrice: 0,
  enteredUnitPrice: 0,
  originalUnitPrice: undefined,
  enteredBidderTotal: 0,
  writtenText: undefined,
  hasMathError: undefined,
  hasTextDiscrepancy: undefined,
  correctionRationale: undefined,
  unpriced: undefined,
  // تأشيرات اللجنة وعرضها الموزون خاصة بالأسعار المصفَّرة: لا تُنسخ إلى شركة جديدة ولا تبقى بلا أسعار
  offerUnitPrice: undefined,
  offerTotal: undefined,
  unreasonablePrice: undefined,
  bidderSignedAt: undefined
});

// حقول هوية الفقرة والكلفة التخمينية مشتركة لكل المجهزين (الكلفة التخمينية واحدة للمشروع)
// بينما حقول السعر والتدقيق (bidderTotal, enteredUnitPrice, writtenText...) خاصة بكل مجهز على حدة
export const SHARED_ESTIMATE_FIELDS: (keyof BOQItem)[] = ['itemNo', 'description', 'unit', 'quantity', 'estimatedUnitPrice', 'estimatedTotal'];

// يوحّد حقول هوية الفقرة والكلفة التخمينية عبر كل المجهزين انطلاقاً من قائمة فقرات مرجعية (بعد استيراد Excel أو استخراج صورة)
// مع الحفاظ التام على سعر كل مجهز الخاص للفقرات الموجودة مسبقاً، وتصفير سعر الفقرات الجديدة له فقط
export const syncSharedFieldsToAllBidders = (
  bidders: Bidder[],
  referenceItems: Partial<BOQItem>[],
  deviationThreshold: number,
  excludeBidderId?: string
): Bidder[] => {
  return bidders.map(b => {
    if (b.id === excludeBidderId) return b;

    const updatedRaw: Partial<BOQItem>[] = referenceItems.map((ref, i) => {
      const existing = b.items[i];
      const merged: Partial<BOQItem> = { ...(existing || {}) };
      SHARED_ESTIMATE_FIELDS.forEach(f => { (merged as any)[f] = (ref as any)[f]; });
      if (!existing) {
        merged.bidderTotal = 0;
      }
      return merged;
    });

    const recalc = calculateBOQMetrics(updatedRaw, deviationThreshold);
    return { ...b, items: recalc.items, totals: recalc.totals };
  });
};

export const READING_FIELD_LABELS: Record<ReadingField, string> = {
  quantity: 'الكمية',
  unitPrice: 'سعر المفرد',
  total: 'مبلغ الفقرة',
  writtenText: 'التفقيط'
};

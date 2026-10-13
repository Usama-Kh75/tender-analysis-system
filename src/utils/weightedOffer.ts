import type { BOQItem } from '../types/tender';

/**
 * اختبار توازن العطاء — ضوابط رقم (4) سادساً/5 (ص69): «...وفي حالة ورود عطاء مستجيب والأنسب سعراً مع وجود نسبة
 * انحراف بالتحليل السعري ببعض الفقرات (غير متوازنة) بنسبة تتجاوز (20%) زيادة لكل فقرة على حدة والتي تشكل مجموعها
 * نسبة لا تتجاوز (10%) من مجموع عدد الفقرات الكلية فيتم قبول مبلغ العطاء كما هو، وفي حالة تجاوز نسبة الانحراف في
 * الفقرات (غير المتوازنة) نسبة ال (10%) من عدد الفقرات الكلية فيتم قبول الإحالة لهذا العطاء مع اعتماد جدول الكميات
 * المسعر من قبل جهة التعاقد بدلاً عن جدول كميات ذلك العطاء على أن يتم تعديل سعر الفقرات بنفس نسبة مبلغ العطاء
 * الفائز بالزيادة أو النقصان مع استدعاء مقدم العطاء لغرض التوضيح وختم الجداول المعدلة».
 * تُعدّ الفقرات المنحرفة بالزيادة وحدها كما في النص («زيادة»)؛ المنحرفة بالنقصان تُعرض للإحاطة فقط
 */
export const UNBALANCED_ITEMS_LIMIT_PERCENT = 10;

export interface BalanceRow { description?: string; estimatedTotal: number; amount: number }
export type BalanceVerdict = 'no-estimate' | 'excluded' | 'accept-as-is' | 'weighting-required';
export interface BalanceAssessment {
  verdict: BalanceVerdict;
  itemCount: number;          // مجموع عدد الفقرات (بلا الصفوف الفارغة)
  unbalancedCount: number;    // منحرفة بالزيادة فوق الحد
  unbalancedPercent: number;
  belowCount: number;         // منحرفة بالنقصان فوق الحد (للإحاطة)
  totalDeviationPercent: number;
}

export const BALANCE_VERDICT_LABEL: Record<BalanceVerdict, string> = {
  'no-estimate': 'بانتظار الكلفة التخمينية',
  excluded: 'العطاء منحرف بمبلغه الكلي فيُستبعد',
  'accept-as-is': 'يُقبل مبلغ العطاء كما هو (سادساً/5)',
  'weighting-required': 'يلزم اعتماد الجدول الموزون (سادساً/5)'
};

const round2 = (v: number) => Math.round(v * 100) / 100;
// صف لم يُملأ (الأول في مناقصة جديدة أو «+ إضافة فقرة»): ليس فقرة من جدول الكميات
const isPlaceholder = (r: BalanceRow) => (r.description || '').startsWith('فقرة ') && !(r.estimatedTotal > 0) && !(r.amount > 0);

export function assessBalance(rows: BalanceRow[], threshold: number): BalanceAssessment {
  const counted = rows.filter(r => !isPlaceholder(r));
  const est = counted.reduce((s, r) => s + r.estimatedTotal, 0);
  const amt = counted.reduce((s, r) => s + r.amount, 0);
  // مقرّب كما في totals.totalDeviationPercent الذي يستعمله isCommerciallyExcluded، فلا يختلف الحكمان عند الحد
  const totalDeviationPercent = est > 0 ? round2(((amt - est) / est) * 100) : 0;
  const deviation = (r: BalanceRow) => ((r.amount - r.estimatedTotal) / r.estimatedTotal) * 100;
  const withEstimate = counted.filter(r => r.estimatedTotal > 0);
  const unbalancedCount = withEstimate.filter(r => deviation(r) > threshold).length;
  const belowCount = withEstimate.filter(r => deviation(r) < -threshold).length;
  const unbalancedPercent = counted.length > 0 ? round2((unbalancedCount / counted.length) * 100) : 0;
  const verdict: BalanceVerdict = !(est > 0) ? 'no-estimate'
    : Math.abs(totalDeviationPercent) > threshold ? 'excluded'
    : unbalancedPercent > UNBALANCED_ITEMS_LIMIT_PERCENT ? 'weighting-required'
    : 'accept-as-is';
  return { verdict, itemCount: counted.length, unbalancedCount, unbalancedPercent, belowCount, totalDeviationPercent };
}

export const correctedBalanceRows = (items: BOQItem[]): BalanceRow[] =>
  items.map(i => ({ description: i.description, estimatedTotal: i.estimatedTotal, amount: i.bidderTotal }));

export const offerBalanceRows = (items: BOQItem[]): BalanceRow[] =>
  items.map(i => ({ description: i.description, estimatedTotal: i.estimatedTotal, amount: i.offerTotal ?? i.bidderTotal }));

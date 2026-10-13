import type { BOQItem, Bidder, TenderProject } from '../types/tender';
import { hasBidAmounts } from './recommendation';

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

// العرض الفعّال أو المعتمد يقفل أرقام عطائه والتعديلات المشتركة؛ الموقوف لا يقفل (أُوقف لتصحيح قراءة)
export const isOfferLocked = (b: Bidder) => b.weightedOffer?.status === 'active' || b.weightedOffer?.status === 'adopted';

/** سبب منع بدء العرض الموزون، أو null إن جاز */
export function startOfferBlocker(b: Bidder, threshold: number): string | null {
  if (!hasBidAmounts(b)) return 'لا مبالغ في هذا العطاء بعد.';
  if (!(b.totals.totalEstimatedAmount > 0)) return 'لم تُدخل الكلفة التخمينية بعد، فلا نسبة سعرية ولا انحراف.';
  if (Math.abs(b.totals.totalDeviationPercent) > threshold) {
    return `العطاء منحرف بمبلغه الكلي (${b.totals.totalDeviationPercent.toFixed(2)}%) عن الكلفة التخمينية فيُستبعد، ولا يُعدّ له عرض موزون (سادساً/5).`;
  }
  const pending = b.items.filter(i => i.hasMathError || i.hasTextDiscrepancy).length;
  if (pending > 0) return `(${pending}) فقرة بانتظار قرار اللجنة في التصحيح الحسابي؛ يُعدّ العرض الموزون بعد اكتماله.`;
  return null;
}

/** نقطة انطلاق: أسعار العطاء بعد التصحيح كما هي، ثم تُعدَّل الفقرات التي غيّرها المجهز */
export const offerFieldsFromCorrected = (items: BOQItem[]) =>
  items.map(i => ({ offerUnitPrice: i.quantity > 0 ? i.bidderTotal / i.quantity : i.bidderTotal, offerTotal: i.bidderTotal }));

/** نقطة انطلاق: المعادلة (التخميني × النسبة)، وهي الأسعار الموزونة المسوّاة التي حسبها calculateBOQMetrics */
export const offerFieldsFromFormula = (items: BOQItem[]) =>
  items.map(i => ({ offerUnitPrice: i.weightedUnitPrice, offerTotal: i.newPrice }));

/** تعديل مفرد فقرة في العرض: المبلغ = الكمية × المفرد مقرّباً لمنزلتين، فلا يتولد خطأ ضرب */
export const offerUnitPatch = (item: BOQItem, unit: number) =>
  ({ offerUnitPrice: unit, offerTotal: Math.round((item.quantity > 0 ? item.quantity : 1) * unit * 100) / 100 });

export const isOfferEdited = (i: BOQItem) => i.offerTotal !== undefined && Math.abs(i.offerTotal - i.bidderTotal) >= 0.005;

export interface OfferStatus {
  offerSum: number;
  bidTotal: number;
  diff: number;             // مجموع العرض − مبلغ العطاء؛ يجب أن يكون صفراً للاعتماد
  editedCount: number;
  markedNotEdited: number;  // مؤشرة «سعر غير معقول» ولم يُعدَّل سعرها في العرض
  stale: boolean;           // تغيّر مبلغ العطاء بعد البدء أو الاستئناف
  canAdopt: boolean;
}

export function offerStatus(b: Bidder): OfferStatus | null {
  if (!b.weightedOffer) return null;
  const offerSum = round2(b.items.reduce((s, i) => s + (i.offerTotal ?? i.bidderTotal), 0));
  const bidTotal = b.totals.totalBidderAmount;
  const diff = round2(offerSum - bidTotal);
  const stale = Math.abs(b.weightedOffer.bidTotal - bidTotal) >= 0.005;
  return {
    offerSum, bidTotal, diff,
    editedCount: b.items.filter(isOfferEdited).length,
    markedNotEdited: b.items.filter(i => i.unreasonablePrice && !isOfferEdited(i)).length,
    stale,
    canAdopt: !stale && Math.abs(diff) < 0.005
  };
}

/**
 * سبب رفض تعديل يغيّر أرقام عطاء له عرض موزون فعّال أو معتمد. shared: التعديل مشترك بين العطاءات كلها
 * (الكمية، التخميني، إضافة فقرة أو حذفها، الاستيراد)، فيقفله عرض أي مجهز
 */
export function offerLockReason(project: TenderProject, scope: { bidderId?: string; shared?: boolean }): string | null {
  const locked = project.bidders.filter(b => isOfferLocked(b) && (scope.shared || b.id === scope.bidderId));
  if (locked.length === 0) return null;
  const names = locked.map(b => b.name).join('، ');
  return `أرقام العطاء مقفلة أثناء العرض الموزون (${names})${scope.shared ? '، وهذا التعديل مشترك بين كل العطاءات' : ''}.
`
    + 'أوقف مرحلة العرض الموزون أولاً (تُحفظ تعديلاتها وتعود عند الاستئناف).';
}

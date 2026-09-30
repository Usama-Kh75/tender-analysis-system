import type { Bidder, TenderProject } from '../types/tender';

/**
 * محرك توصية لجنة التحليل — مصدر واحد تستخدمه خلاصة الترسية والمحضر المطبوع معاً،
 * فلا تختلف التوصية بين الشاشة والورق. كل حالة مسندة إلى نص تعليمات تنفيذ العقود
 * الحكومية رقم (1) لسنة 2025 وضوابطها (منقولة حرفياً من النص الرسمي):
 *
 * - المادة (13)/ثالثاً/أ: استبعاد العطاء الذي يزيد أو يقل عن (20%) من الكلفة التخمينية.
 * - المادة (13)/ثالثاً/ب: للجنة التحليل التوصية للجنة المركزية بالتفاوض لتخفيض الأسعار
 *   إذا كان أقل العطاءات المطابقة يزيد على الحدود المقبولة. التفاوض نفسه ليس من اختصاصها.
 * - ضوابط رقم (5) — معايير المفاضلة: تُطبَّق عند تساوي أسعار العطاءات المستجيبة أو
 *   تقاربها لغاية (1%) من الكلفة التخمينية، وتحوَّل لقيمة مالية لأغراض المفاضلة.
 * - المادة (15)/رابعاً/أ: لجهة التعاقد إرساء المناقصة على أكثر من متقدم إذا تساوت
 *   الأسعار والشروط، على أن يُذكر ذلك في شروط المناقصة.
 * - المادة (20)/أولاً وثالثاً ورابعاً: حالات جواز إعادة الإعلان أو الدعوة.
 * - المادة (10)/أولاً/هـ: جهة التعاقد غير ملزمة بقبول أوطأ العطاءات.
 *
 * النظام لا يقرر: يصوغ التوصية، ويبقى القرار للجنة والجهة المخولة بالمصادقة.
 */

// ضوابط رقم (5): نطاق التقارب الذي تُطبق عنده معايير المفاضلة (نسبة من الكلفة التخمينية)
export const PREFERENCE_BAND_PERCENT = 1;

// المبالغ تُعد متساوية حين يقل فرقها عن أصغر فئة نقدية معتبرة
const SAME_AMOUNT_TOLERANCE = 0.01;

export type RecommendationKind = 'award' | 'tie' | 'referral' | 'retender';

export interface Recommendation {
  kind: RecommendationKind;
  /** العطاءات المؤهلة تجارياً (ضمن الحدود وغير مستبعدة من اللجنة)، مرتبة من الأوطأ */
  eligible: Bidder[];
  /** العطاء المعني بالتوصية: الموصى به (award)، أو الأوطأ بين المتقاربة (tie)، أو المحال للتفاوض (referral) */
  primary?: Bidder;
  /** العطاءات المتقاربة ضمن نطاق المفاضلة، ويشمل الأوطأ نفسه (tie فقط، أو تنبيه مرافق لـ award) */
  closeBids: Bidder[];
  /** هل تساوت مبالغ العطاءات المتقاربة تماماً (لا مجرد تقارب ضمن 1%) */
  exactTie: boolean;
  /** العطاء الموصى به جاء باختيار صريح من اللجنة («اختيار للترسية») لا بالترتيب الآلي */
  chosenByCommittee: boolean;
  /** اختارت اللجنة عطاءً مؤهلاً غير الأوطأ — يستلزم تثبيت المسوغات في التقرير */
  chosenNotLowest: boolean;
  /** سبب إعادة الإعلان المقترح (retender فقط) */
  retenderReason?: 'all-below' | 'all-rejected';
}

export const isCommerciallyExcluded = (bidder: Bidder, threshold: number): boolean =>
  Math.abs(bidder.totals.totalDeviationPercent) > threshold;

const isRejectedByCommittee = (bidder: Bidder): boolean => bidder.status === 'disqualified';

const byAmount = (a: Bidder, b: Bidder) => a.totals.totalBidderAmount - b.totals.totalBidderAmount;

export function buildRecommendation(project: TenderProject): Recommendation {
  const threshold = project.deviationThreshold;
  const candidates = project.bidders.filter(b => !isRejectedByCommittee(b));
  const eligible = candidates.filter(b => !isCommerciallyExcluded(b, threshold)).sort(byAmount);

  const none = { closeBids: [], exactTie: false, chosenByCommittee: false, chosenNotLowest: false };

  if (eligible.length === 0) {
    // المادة (13)/ثالثاً/ب: الاستثناء يخص حالة الزيادة على الحدود فقط، لا النقصان عنها
    const aboveLimit = candidates
      .filter(b => b.totals.totalDeviationPercent > threshold)
      .sort(byAmount);
    if (aboveLimit.length > 0) {
      return { ...none, kind: 'referral', eligible, primary: aboveLimit[0] };
    }
    return { ...none, kind: 'retender', eligible, retenderReason: candidates.length > 0 ? 'all-below' : 'all-rejected' };
  }

  const lowest = eligible[0];
  const band = lowest.totals.totalEstimatedAmount * PREFERENCE_BAND_PERCENT / 100;
  const closeBids = eligible.filter(
    b => b.totals.totalBidderAmount - lowest.totals.totalBidderAmount <= Math.max(band, SAME_AMOUNT_TOLERANCE)
  );
  const exactTie = closeBids.length > 1 && closeBids.every(
    b => Math.abs(b.totals.totalBidderAmount - lowest.totals.totalBidderAmount) < SAME_AMOUNT_TOLERANCE
  );

  // اختيار اللجنة الصريح («اختيار للترسية») يتقدم على الترتيب الآلي، بشرط أن يكون اختياراً واحداً.
  // تعدد الاختيارات (بيانات قديمة قبل أن يصبح الاختيار حصرياً) يُعد التباساً فيُتجاهل
  const chosenAll = eligible.filter(b => b.status === 'recommended' || b.status === 'awarded');
  const chosen = chosenAll.length === 1 ? chosenAll[0] : undefined;

  if (chosen) {
    return {
      kind: 'award',
      eligible,
      primary: chosen,
      closeBids: closeBids.length > 1 ? closeBids : [],
      exactTie,
      chosenByCommittee: true,
      chosenNotLowest: chosen.id !== lowest.id && !closeBids.some(b => b.id === chosen.id)
    };
  }

  if (closeBids.length > 1) {
    return { ...none, kind: 'tie', eligible, primary: lowest, closeBids, exactTie };
  }

  return { ...none, kind: 'award', eligible, primary: lowest };
}

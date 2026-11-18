// تقييم العطاءات تجارياً: دالة نقية مشتركة بين «الدراسة والتوصية» و«المحضر» (2026-11-18)
// عرض فقط: لا تكتب في بيانات المناقصة ولا تحسب التوصية (buildRecommendation هو مصدرها الوحيد)
import { Bidder, TenderProject } from '../types/tender';
import { formatPercent } from './calculations';
import { hasBidAmounts, hasNoEstimate, exclusionThresholdOf } from './recommendation';
import { exclusionLabels } from './exclusionReasons';
import { isOfferFinal, assessBalance, correctedBalanceRows, UNBALANCED_ITEMS_LIMIT_PERCENT } from './weightedOffer';

export type CommercialStatus = 'recommended' | 'qualified' | 'excluded' | 'pending';
export type EvaluatedBid = Bidder & { commercialStatus: CommercialStatus; commercialReason: string; unbalancedItems: boolean; diff: number };

/** العطاءات ذوات المبالغ وحدها، مرتبة: المستبعد في الأسفل، ثم الأقل مبلغاً (totals.totalBidderAmount) */
export function evaluateBids(project: TenderProject): EvaluatedBid[] {
  const noEstimate = hasNoEstimate(project);
  const exclusionThreshold = exclusionThresholdOf(project);

  const evaluated: EvaluatedBid[] = project.bidders.filter(hasBidAmounts).map((bidder) => {
    const totalDev = bidder.totals.totalDeviationPercent;
    const partialDev = bidder.totals.partialDeviationPercent;
    // فرق كل مجهز عن كلفته التخمينية الخاصة به (وليس عن كلفة أول مجهز في القائمة)
    const diff = bidder.totals.overallDiffAmount;

    // معيار الاستبعاد التجاري الوحيد المعتمد في الجدول المرجعي: تجاوز الانحراف الكلي لحد الانحراف المعتمد
    // (الانحراف الجزئي مؤشر استرشادي فقط في الجدول المعتمد ولا يُستخدم فيه كسبب استبعاد أو تحذير مستقل)
    let commercialStatus: CommercialStatus = 'qualified';
    let commercialReason = '';
    let unbalancedItems = false;

    if (bidder.status === 'disqualified') {
      commercialStatus = 'excluded';
      const why = exclusionLabels(bidder);
      commercialReason = why ? `مستبعد بقرار اللجنة: ${why}` : 'مستبعد بقرار اللجنة';
    } else if (noEstimate) {
      // كان يُكتب «عطاء متوازن تجارياً وضمن الحدود المقبولة قانونياً» قبل أي مقارنة ممكنة
      commercialStatus = 'pending';
      commercialReason = 'بانتظار الكلفة التخمينية: لا يُحكم بالانحراف ولا بالتوازن قبل إدخالها';
    } else if (Math.abs(totalDev) > exclusionThreshold) {
      commercialStatus = 'excluded';
      commercialReason = `مستبعد تجارياً: تجاوز الانحراف الإجمالي الحدود القانونية (±${exclusionThreshold}%) حيث بلغ (${formatPercent(totalDev, 2, exclusionThreshold).replace('+', '')})`;
    } else {
      commercialStatus = bidder.status === 'recommended' ? 'recommended' : 'qualified';
      // «متوازن» حكم على الفقرات (سادساً/5)، و«ضمن الحدود» حكم على المبلغ الكلي (13/ثالثاً/أ)؛ فلا يُكتب
      // «متوازن» لعطاء تتجاوز فقراته المنحرفة بالزيادة حد 10% من عددها
      const balance = assessBalance(correctedBalanceRows(bidder.items), project.deviationThreshold, exclusionThreshold);
      const guide = partialDev > 0 ? ` (انحراف جزئي استرشادي: ${partialDev.toFixed(2)}%)` : '';
      unbalancedItems = balance.verdict === 'weighting-required';
      commercialReason = (unbalancedItems
        ? `عطاء ضمن الحدود المقبولة قانونياً بمبلغه الكلي، وغير متوازن بفقراته: (${balance.unbalancedCount}) من (${balance.itemCount}) فقرة منحرفة بالزيادة أكثر من (${project.deviationThreshold}%) تتجاوز (${UNBALANCED_ITEMS_LIMIT_PERCENT}%) من عددها، فيلزم الجدول الموزون (ضوابط رقم (4) سادساً/5)${guide}`
        : `عطاء متوازن تجارياً وضمن الحدود المقبولة قانونياً بمبلغه الكلي${guide}`)
        + (isOfferFinal(bidder) ? '، واعتمدت اللجنة له العرض الموزون' : '');
    }

    return { ...bidder, commercialStatus, commercialReason, unbalancedItems, diff };
  });

  // ترتيب العطاءات المؤهلة من الأقل مبلغاً والأكثر اتزاناً
  return [...evaluated].sort((a, b) => {
    // المستبعد في الأسفل
    if (a.commercialStatus === 'excluded' && b.commercialStatus !== 'excluded') return 1;
    if (b.commercialStatus === 'excluded' && a.commercialStatus !== 'excluded') return -1;
    return a.totals.totalBidderAmount - b.totals.totalBidderAmount;
  });
}

// «الخطوة التالية» تحت العنوان وحالة كل شركة في بطاقتها.
// كل ما هنا يُستنتج من بيانات المناقصة ولا يُخزَّن، فلا تحويل للمناقصات القديمة،
// وإن رجعت اللجنة عن خطوة (ألغت اختيار الترسية) رجع الشريط إليها.
import type { Bidder, TenderProject } from '../types/tender';
import { isPending } from './tableFilters';
import { itemsCountText } from './arabicCount';
import { buildRecommendation, hasBidAmounts, hasNoEstimate } from './recommendation';

export type BidderAuditState = { kind: 'empty' } | { kind: 'pending'; count: number } | { kind: 'done' };

/** فقرات فيها أخطاء لم تُعالج (خطأ ضرب، خلاف تفقيط، اختلاف قراءتين)، والفقرة التي فيها أكثر من واحد تُعدّ مرة */
const pendingCount = (b: Bidder): number => b.items.filter(isPending).length;

export function bidderAuditState(b: Bidder): BidderAuditState {
  if (!hasBidAmounts(b)) return { kind: 'empty' };
  const count = pendingCount(b);
  return count > 0 ? { kind: 'pending', count } : { kind: 'done' };
}

export interface TenderPath {
  hasEstimate: boolean;
  /** entered: الشركات التي لها مبالغ؛ registered: الشركات المسجّلة في المناقصة؛
   *  expected للعرض: الأكبر من العطاءات المستلمة (إن أُدخلت) والمسجّلة، فالمستلمة قد تزيد على المحلَّلة بحق */
  bids: { entered: number; registered: number; expected: number };
  /** pending في الشركات ذوات المبالغ وحدها؛ firstBidderId أولها بترتيب الشركات */
  audit: { pending: number; firstBidderId: string | null };
  /** من اختارته اللجنة للترسية، وnull قبل اختيارها */
  award: { name: string } | null;
}

export function tenderPath(p: TenderProject): TenderPath {
  const withAmounts = p.bidders.filter(hasBidAmounts);
  const pendingBidders = withAmounts.filter(b => pendingCount(b) > 0);
  const rec = buildRecommendation(p);
  return {
    hasEstimate: !hasNoEstimate(p),
    bids: { entered: withAmounts.length, registered: p.bidders.length, expected: Math.max(p.receivedBidsCount ?? 0, p.bidders.length) },
    audit: {
      pending: withAmounts.reduce((n, b) => n + pendingCount(b), 0),
      firstBidderId: pendingBidders[0]?.id ?? null
    },
    award: rec.chosenByCommittee && rec.primary ? { name: rec.primary.name } : null
  };
}

export type NextStepTarget = 'bids' | 'importEstimate' | 'audit' | 'recommendation' | 'status';
export interface NextStepAction { label: string; target: NextStepTarget; bidderId?: string }
export interface NextStep {
  kind: 'estimate' | 'audit' | 'bids' | 'award' | 'report';
  text: string;
  actions: NextStepAction[];
}

/** الخطوة الواحدة التالية: أول شرط يتحقق، وnull حين لا شيء ينتظر. مستنتجة ولا تُخزَّن */
export function nextStep(p: TenderProject): NextStep | null {
  const path = tenderPath(p);
  if (!path.hasEstimate) {
    return {
      kind: 'estimate',
      text: 'الخطوة التالية: استيراد كشف الكلف التخمينية',
      actions: [{ label: 'استيراد كشف الكلف التخمينية', target: 'importEstimate' }]
    };
  }
  if (path.audit.pending > 0) {
    const action: NextStepAction = { label: 'عرض الفقرات التي فيها أخطاء', target: 'audit' };
    if (path.audit.firstBidderId) action.bidderId = path.audit.firstBidderId;
    return {
      kind: 'audit',
      text: `الخطوة التالية: ${itemsCountText(path.audit.pending)} فيها أخطاء لم تُعالج`,
      actions: [action]
    };
  }
  const empty = p.bidders.find(b => !hasBidAmounts(b));
  if (empty) {
    const action: NextStepAction = { label: 'إدخال العطاء', target: 'bids', bidderId: empty.id };
    return {
      kind: 'bids',
      text: `الخطوة التالية: إدخال عطاء «${empty.name}»`,
      actions: [action]
    };
  }
  if (!path.award) {
    return {
      kind: 'award',
      text: `اكتمل إدخال العطاءات (${path.bids.entered} من ${path.bids.expected}) والكلفة التخمينية. الخطوة التالية: دراسة العطاءات والتوصية بالإحالة`
        + (path.bids.expected > path.bids.registered
          ? `. استُلمت (${path.bids.expected}) عطاءات، وأُدخل منها (${path.bids.entered}) للتحليل التجاري. العطاء الذي فيه نقص جوهري (كالتأمينات الأولية) يُعدّ مستلماً ولا يُحلَّل تجارياً، وإن لم يكن فيه نقص فأضفه من «إضافة مجهز».`
          : ''),
      actions: [{ label: 'الانتقال إلى التوصية والمحضر', target: 'recommendation' }]
    };
  }
  if (!p.statusLog || p.statusLog.length === 0) {
    return {
      kind: 'report',
      text: `اختارت اللجنة «${path.award.name}». الخطوة التالية: طباعة محضر التحليل`,
      actions: [
        { label: 'فتح المحضر', target: 'recommendation' },
        { label: 'تسجيل الموقف', target: 'status' }
      ]
    };
  }
  return null;
}

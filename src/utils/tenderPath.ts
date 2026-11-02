// «الخطوة التالية» تحت العنوان وحالة كل شركة في بطاقتها.
// كل ما هنا يُستنتج من بيانات المناقصة ولا يُخزَّن، فلا تحويل للمناقصات القديمة،
// وإن رجعت اللجنة عن خطوة (ألغت اختيار الترسية) رجع الشريط إليها.
import type { Bidder, TenderProject } from '../types/tender';
import { buildRecommendation, hasBidAmounts, hasNoEstimate } from './recommendation';

export type BidderAuditState = { kind: 'empty' } | { kind: 'pending'; count: number } | { kind: 'done' };

/** فقرات بانتظار قرار اللجنة: خطأ ضرب أو خلاف تفقيط، والفقرة التي فيها الاثنان تُعدّ مرة */
const pendingCount = (b: Bidder): number => b.items.filter(i => i.hasMathError || i.hasTextDiscrepancy).length;

export function bidderAuditState(b: Bidder): BidderAuditState {
  if (!hasBidAmounts(b)) return { kind: 'empty' };
  const count = pendingCount(b);
  return count > 0 ? { kind: 'pending', count } : { kind: 'done' };
}

export interface TenderPath {
  hasEstimate: boolean;
  /** entered: الشركات التي لها مبالغ؛ expected: العطاءات المستلمة إن أُدخلت، وإلا عدد الشركات */
  bids: { entered: number; expected: number };
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
    bids: { entered: withAmounts.length, expected: p.receivedBidsCount ?? p.bidders.length },
    audit: {
      pending: withAmounts.reduce((n, b) => n + pendingCount(b), 0),
      firstBidderId: pendingBidders[0]?.id ?? null
    },
    award: rec.chosenByCommittee && rec.primary ? { name: rec.primary.name } : null
  };
}

export type NextStepTarget = 'bids' | 'audit' | 'analysis' | 'status';
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
      text: 'الخطوة التالية: إدخال الكلفة التخمينية',
      actions: [{ label: 'إدخال الكلفة التخمينية', target: 'bids' }]
    };
  }
  if (path.audit.pending > 0) {
    const action: NextStepAction = { label: 'فتح التدقيق', target: 'audit' };
    if (path.audit.firstBidderId) action.bidderId = path.audit.firstBidderId;
    return {
      kind: 'audit',
      text: `الخطوة التالية: تصحيح الأخطاء الحسابية، ${path.audit.pending} فقرة بانتظار قرار اللجنة`,
      actions: [action]
    };
  }
  const empty = p.bidders.find(b => !hasBidAmounts(b));
  if (empty || path.bids.entered < path.bids.expected) {
    const action: NextStepAction = { label: 'إدخال العطاء', target: 'bids' };
    if (empty) action.bidderId = empty.id;
    return {
      kind: 'bids',
      text: empty
        ? `الخطوة التالية: إدخال عطاء «${empty.name}»`
        : `الخطوة التالية: إدخال العطاء الباقي (${path.bids.entered} من ${path.bids.expected})`,
      actions: [action]
    };
  }
  if (!path.award) {
    return {
      kind: 'award',
      text: 'الخطوة التالية: دراسة العطاءات والتوصية بالإحالة',
      actions: [{ label: 'الانتقال إلى التحليل والتوصية', target: 'analysis' }]
    };
  }
  if (!p.statusLog || p.statusLog.length === 0) {
    return {
      kind: 'report',
      text: `اختارت اللجنة «${path.award.name}». الخطوة التالية: طباعة محضر التحليل`,
      actions: [
        { label: 'فتح المحضر', target: 'analysis' },
        { label: 'تسجيل الموقف', target: 'status' }
      ]
    };
  }
  return null;
}

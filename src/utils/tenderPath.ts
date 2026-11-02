// سطر «الموقف + مسار المناقصة» تحت العنوان وحالة كل شركة في بطاقتها.
// كل ما هنا يُستنتج من بيانات المناقصة ولا يُخزَّن، فلا تحويل للمناقصات القديمة،
// وإن رجعت اللجنة عن خطوة (ألغت اختيار الترسية) رجعت في السطر.
import type { Bidder, TenderProject } from '../types/tender';
import { buildRecommendation, hasBidAmounts, hasNoEstimate } from './recommendation';
import { currentStatus, statusText } from './orderStatus';

export type BidderAuditState = { kind: 'empty' } | { kind: 'pending'; count: number } | { kind: 'done' };

/** فقرات بانتظار قرار اللجنة: خطأ ضرب أو خلاف تفقيط، والفقرة التي فيها الاثنان تُعدّ مرة */
const pendingCount = (b: Bidder): number => b.items.filter(i => i.hasMathError || i.hasTextDiscrepancy).length;

export function bidderAuditState(b: Bidder): BidderAuditState {
  if (!hasBidAmounts(b)) return { kind: 'empty' };
  const count = pendingCount(b);
  return count > 0 ? { kind: 'pending', count } : { kind: 'done' };
}

export interface TenderPath {
  /** نص آخر موقف مسجّل، وnull إن لم يُسجَّل موقف */
  status: string | null;
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
  const status = currentStatus(p);
  const rec = buildRecommendation(p);
  return {
    status: status ? statusText(status) : null,
    hasEstimate: !hasNoEstimate(p),
    bids: { entered: withAmounts.length, expected: p.receivedBidsCount ?? p.bidders.length },
    audit: {
      pending: withAmounts.reduce((n, b) => n + pendingCount(b), 0),
      firstBidderId: pendingBidders[0]?.id ?? null
    },
    award: rec.chosenByCommittee && rec.primary ? { name: rec.primary.name } : null
  };
}

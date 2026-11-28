import { Bidder, TenderProject } from '../types/tender';
import { hasBidAmounts } from './recommendation';

/** اسم المجهز الحامل الذي يضعه النظام حين تُنشأ مناقصة بلا أسماء شركات، أو عند تصفير المجهزين. */
export const PLACEHOLDER_BIDDER_NAME = 'شركة جديدة';

/**
 * مجهز حامل لم يُمسّ: الكشف التخميني يُحفظ داخل فقرات كل مجهز، فلا تُعرض مناقصة بلا مجهز، ولذلك يضع النظام
 * «شركة جديدة» حاملاً له. يبقى حاملاً ما دام اسمه كما وضعه النظام، بلا مبالغ ولا حالة ولا أسباب استبعاد ولا
 * نفاذية ولا عرض موزون ولا مبادرات ولا ملاحظات. أي شيء من ذلك يجعله مجهزاً حقيقياً لا يُمسّ.
 */
export function isPlaceholderBidder(project: TenderProject, bidder: Bidder): boolean {
  return bidder.name.trim() === PLACEHOLDER_BIDDER_NAME
    && !hasBidAmounts(bidder)
    && !(bidder.statedTotal && bidder.statedTotal > 0)
    && bidder.status === 'pending'
    && !(bidder.exclusionReasons && bidder.exclusionReasons.length > 0)
    && bidder.validityDays === undefined
    && bidder.validityExtendedTo === undefined
    && !bidder.weightedOffer
    && !bidder.commercialRecord?.trim()
    && !bidder.notes?.trim()
    && !(project.preferenceInitiatives ?? []).some(r => r.bidderId === bidder.id);
}

/**
 * يضيف المجهز الجديد إلى القائمة، أو يضعه في موضع أول مجهز حامل لم يُمسّ بدل أن يضيفه بجانبه (أسامة 2026-11-28:
 * مناقصة 9012 صار فيها خمسة مجهزين لأربعة عطاءات). bidders قد تكون نسخة محدَّثة من project.bidders (بالمعرّفات نفسها)؛
 * الحامل يُعرف من project. replaced = اسم الحامل الذي حلّ محله، أو undefined إن أُضيف.
 */
export function addOrReplacePlaceholder(
  project: TenderProject,
  bidders: Bidder[],
  newBidder: Bidder
): { bidders: Bidder[]; replaced?: string } {
  const placeholderIds = new Set(project.bidders.filter(b => isPlaceholderBidder(project, b)).map(b => b.id));
  const index = bidders.findIndex(b => placeholderIds.has(b.id));
  if (index < 0) return { bidders: [...bidders, newBidder] };
  const replaced = bidders[index].name;
  return { bidders: bidders.map((b, i) => (i === index ? newBidder : b)), replaced };
}

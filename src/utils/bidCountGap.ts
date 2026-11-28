import type { TenderProject } from '../types/tender';
import { isPlaceholderBidder } from './placeholderBidder';
import { receivedBidsCountOf } from './tenderDetails';

/**
 * فرق عدد العطاءات المستلمة (معلومات المناقصة) عن المجهزين المسجَّلين، مستنتج ولا يُخزَّن. تذكير للجنة لا مانع:
 *  - missing: المسجَّلون أقل من المستلمة (عطاء لم يُدخل بعد، أو استُبعد قبل التحليل، أو العدد مكتوب خطأً).
 *  - extra: المسجَّلون أكثر من المستلمة (العدد خطأ، أو مجهز زائد يُحذف من «مقارنة المجهزين»).
 * المجهز الحامل «شركة جديدة» الذي لم يُمسّ لا يُعدّ مسجَّلاً (isPlaceholderBidder). null حين لا عدد مُدخل أو يتساويان.
 */
export interface BidCountGap { kind: 'missing' | 'extra'; received: number; registered: number; diff: number }

export function bidCountGap(project: TenderProject): BidCountGap | null {
  const received = receivedBidsCountOf(project);
  if (received === undefined) return null;
  const registered = project.bidders.filter(b => !isPlaceholderBidder(project, b)).length;
  if (registered === received) return null;
  return registered < received
    ? { kind: 'missing', received, registered, diff: received - registered }
    : { kind: 'extra', received, registered, diff: registered - received };
}

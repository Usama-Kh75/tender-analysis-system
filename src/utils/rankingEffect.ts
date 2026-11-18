import type { TenderProject } from '../types/tender';
import { hasBidAmounts } from './recommendation';
import { isCommitteeCorrected, submittedTotal } from './bidderAuditEngine';

export interface RankingEffectRow {
  bidderId: string;
  name: string;
  submittedTotal: number;
  correctedTotal: number;
  rankBefore: number;
  rankAfter: number;
  hasCorrections: boolean;
}

// رتبة تنافسية تصاعدية بالمبلغ (الأقل أولاً)؛ المتساويان رتبة واحدة (1، 1، 3)
const competitionRanks = (totals: number[]): number[] =>
  totals.map(t => 1 + totals.filter(o => o < t).length);

/**
 * أثر التصحيح الحسابي على تسلسل المجهزين (ضوابط رقم (4) خامساً/ب/6): الترتيب بالمبلغ وحده
 * قبل التصحيح (كما دوّنه المجهز) وبعده. لا استبعاد هنا ولا تغيير لأي رقم مخزَّن.
 * null إن قلّ المجهزون ذوو المبالغ عن اثنين أو لم تُصحَّح أي فقرة.
 */
export const rankingEffect = (project: TenderProject): { rows: RankingEffectRow[]; changed: boolean } | null => {
  const bidders = project.bidders.filter(hasBidAmounts);
  if (bidders.length < 2) return null;
  const corrected = bidders.map(b => b.items.some(isCommitteeCorrected));
  if (!corrected.some(Boolean)) return null;
  const before = bidders.map(b => submittedTotal(b.items));
  const after = bidders.map(b => b.totals.totalBidderAmount);
  const rb = competitionRanks(before);
  const ra = competitionRanks(after);
  const rows = bidders.map((b, i) => ({
    bidderId: b.id, name: b.name, submittedTotal: before[i], correctedTotal: after[i],
    rankBefore: rb[i], rankAfter: ra[i], hasCorrections: corrected[i]
  }));
  return { rows, changed: rows.some(r => r.rankBefore !== r.rankAfter) };
};

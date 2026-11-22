import type { TenderProject } from '../types/tender';
import { buildRecommendation } from './recommendation';

// اسم العطاء الذي اختارته اللجنة للترسية؛ null قبل الاختيار أو في التعادل والإحالة وإعادة الإعلان.
// مساعدة إدخال فقط: لا تكتب موقفاً ولا تدخل في أي حساب
export function chosenWinnerName(project: TenderProject): string | null {
  const rec = buildRecommendation(project);
  if (rec.kind !== 'award' || !rec.chosenByCommittee) return null;
  const name = rec.primary?.name?.trim();
  return name ? name : null;
}

// مراحل يُملأ تفصيلها باسم الفائز إن كان فارغاً
export const WINNER_DETAIL_STAGES = ['referralPending', 'referred'] as const;

export interface StatusFormPreset {
  seq: number;
  stage: 'referralPending';
  customText: string;
  memoDate: string;
}

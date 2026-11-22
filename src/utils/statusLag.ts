// تنبيه تأخر الموقف المسجَّل عن عمل اللجنة في النظام (عرض فقط: لا يكتب موقفاً ولا يغيّر تاريخاً ولا سجلاً)
import type { TenderProject, StatusStage } from '../types/tender';
import { buildRecommendation } from './recommendation';

export interface StatusLag {
  kind: 'award' | 'preference';
  text: string;
}

/** مواقف تسبق الترسية: إن بقي أحدها بعد اختيار اللجنة فالموقف متأخر */
export const PRE_AWARD_STAGES: StatusStage[] = ['analysis', 'awaitingBidders', 'readvertise'];

export function isPreAwardStatus(project: TenderProject): boolean {
  const last = project.statusLog?.at(-1);
  return !last || PRE_AWARD_STAGES.includes(last.stage);
}

const stamp = (iso?: string) => (iso ? Date.parse(iso) : NaN);

function newestLog(project: TenderProject, test: (action: string, details: string) => boolean): number {
  let best = NaN;
  for (const l of project.auditLogs ?? []) {
    if (!test(l.action, l.details ?? '')) continue;
    const t = stamp(l.timestamp);
    if (!Number.isNaN(t) && (Number.isNaN(best) || t > best)) best = t;
  }
  return best;
}

export function statusLag(project: TenderProject): StatusLag | null {
  const last = project.statusLog?.at(-1);
  const lastAt = stamp(last?.recordedAt);

  const rec = buildRecommendation(project);
  if (rec.kind === 'award' && rec.chosenByCommittee && rec.primary && isPreAwardStatus(project)) {
    const choiceAt = newestLog(project, (a, d) => a === 'تحديث حالة العطاء' && (d.includes('إلى (recommended)') || d.includes('إلى (awarded)')));
    if (!last || Number.isNaN(choiceAt) || Number.isNaN(lastAt) || choiceAt > lastAt) {
      const name = rec.primary.name;
      return {
        kind: 'award',
        text: last
          ? `اختارت اللجنة في النظام الترسية على «${name}» بعد تسجيل هذا الموقف: حدّث الموقف إن تغيّر`
          : `اختارت اللجنة في النظام الترسية على «${name}» ولم يُسجَّل موقف للطلبية`
      };
    }
  }

  if (last?.stage === 'awaitingBidders' && !Number.isNaN(lastAt)) {
    const prefAt = newestLog(project, a => a === 'تسجيل أساس المفاضلة');
    if (!Number.isNaN(prefAt) && prefAt > lastAt) {
      return { kind: 'preference', text: 'سجّلت اللجنة في النظام أساس المفاضلة (المبادرات) بعد تسجيل هذا الموقف: حدّث الموقف إن تغيّر' };
    }
  }
  return null;
}

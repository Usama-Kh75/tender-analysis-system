import { addAuditLog } from '../utils/storageService';
import { cleanPreferenceRecord, isCompletePreferenceRecord } from '../utils/preferenceBasis';
import { initiativesCountText } from '../utils/arabicCount';
import type { PreferenceRecord, TenderProject } from '../types/tender';

/**
 * أساس المفاضلة بين العطاءات المتساوية أو المتقاربة (ضوابط رقم (5)): سجل وطباعة فقط، لا يمس حساباً ولا ترتيباً.
 * يُستبدل سجل كل عطاء ورد في records وتبقى سجلات غيره.
 */
export function createPreferenceHandlers(project: TenderProject, saveProject: (p: TenderProject) => void) {
  /** يعيد رسالة خطأ عربية، أو null عند الحفظ (أو عدم التغيير) */
  // source 'bid': إدخال أولي من تبويب العطاءات (إجراء مستقل لا يحسبه تنبيه تأخر الموقف)؛ 'study': من «الدراسة والتوصية»
  const handleSavePreferenceInitiatives = (records: PreferenceRecord[], source: 'study' | 'bid' = 'study'): string | null => {
    const clean: PreferenceRecord[] = [];
    for (const raw of records) {
      const r = cleanPreferenceRecord(raw);
      if (!r) continue;
      const name = project.bidders.find(b => b.id === r.bidderId)?.name ?? 'عطاء';
      if (r.hasInitiative && !isCompletePreferenceRecord(r)) return `اكتب نوع المبادرة ووصفها لعطاء (${name}) أو اختر «لا»`;
      if (!r.hasInitiative) r.items = [];
      clean.push(r);
    }
    const ids = new Set(clean.map(r => r.bidderId));
    const kept = (project.preferenceInitiatives ?? []).filter(r => !ids.has(r.bidderId));
    const next = [...kept, ...clean];
    if (JSON.stringify(next) === JSON.stringify(project.preferenceInitiatives ?? [])) return null;

    const details = clean.map(r => {
      const name = project.bidders.find(b => b.id === r.bidderId)?.name ?? 'عطاء';
      return `${name}: ${r.hasInitiative ? initiativesCountText(r.items.length) : 'لم يقدّم مبادرات'}`;
    }).join('؛ ');
    saveProject(addAuditLog(
      { ...project, preferenceInitiatives: next, updatedAt: new Date().toISOString() },
      source === 'bid' ? 'تسجيل مبادرات العطاء' : 'تسجيل أساس المفاضلة',
      details,
      { oldValue: project.preferenceInitiatives ?? [], newValue: next }
    ));
    return null;
  };
  return { handleSavePreferenceInitiatives };
}

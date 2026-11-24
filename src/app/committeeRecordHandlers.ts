import { addAuditLog } from '../utils/storageService';
import { cleanDissentNote, candidatesCheckDateOf } from '../utils/committeeRecords';
import { formatSheetDate } from '../utils/orderStatus';
import type { TenderProject } from '../types/tender';

/**
 * سجلان صغيران للجنة (تسجيل فقط، لا يمسان حساباً ولا ترتيباً ولا توصية):
 * تاريخ إيعاز التحقق من المرشحين الثلاثة الأوائل، وأوجه الخلاف في الرأي. كلاهما يعيد رسالة خطأ عربية أو null.
 */
export function createCommitteeRecordHandlers(project: TenderProject, saveProject: (p: TenderProject) => void) {
  /** date فارغ = مسح التاريخ؛ بلا تغيير لا يُكتب شيء */
  const handleSaveCandidatesCheck = (date: string): string | null => {
    const value = date.trim();
    if (value && formatSheetDate(value) === '') return 'اكتب تاريخاً صحيحاً';
    const old = candidatesCheckDateOf(project);
    if ((value || undefined) === old) return null;
    const { candidatesCheckDate: _drop, ...rest } = project;
    void _drop;
    const next: TenderProject = { ...rest, ...(value ? { candidatesCheckDate: value } : {}), updatedAt: new Date().toISOString() };
    saveProject(addAuditLog(
      next,
      'تسجيل إيعاز التحقق من المرشحين',
      value ? `تاريخ الإيعاز: ${formatSheetDate(value)}` : 'مُسح تاريخ الإيعاز',
      { oldValue: old ?? null, newValue: value || null }
    ));
    return null;
  };

  /** نص فارغ بعد القص = مسح الحقل */
  const handleSaveDissent = (text: string): string | null => {
    const value = cleanDissentNote(text);
    const old = cleanDissentNote(project.dissentNote);
    if (value === old) return null;
    const { dissentNote: _drop, ...rest } = project;
    void _drop;
    const next: TenderProject = { ...rest, ...(value ? { dissentNote: value } : {}), updatedAt: new Date().toISOString() };
    saveProject(addAuditLog(
      next,
      'تسجيل أوجه الخلاف',
      value ? 'سُجّلت أوجه الخلاف في الرأي بين أعضاء اللجنة' : 'مُسحت أوجه الخلاف',
      { oldValue: old ?? null, newValue: value ?? null }
    ));
    return null;
  };

  return { handleSaveCandidatesCheck, handleSaveDissent };
}

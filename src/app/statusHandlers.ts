import { addAuditLog } from '../utils/storageService';
import { formatSheetDate, statusText, validateStatusEntry } from '../utils/orderStatus';
import type { StatusEntry, TenderProject } from '../types/tender';
import type { EditContext } from './editContext';

export type StatusInput = Omit<StatusEntry, 'id' | 'recordedAt'>;

// وصف الإدخال في سجل التدقيق: الإجراء والمذكرة وتاريخها
const describe = (e: StatusEntry): string =>
  `${statusText(e) || 'غير محدد'}${e.memoNo ? ` — مذكرة رقم (${e.memoNo})` : ''} — بتاريخ ${formatSheetDate(e.memoDate)}`;

// ينظّف المدخل: فراغات الأطراف، والحقول الفارغة تُحذف، والنص الحر لإجراء «آخر» وحده
const clean = (input: StatusInput): StatusInput => ({
  stage: input.stage,
  branch: input.branch || undefined,
  customText: input.stage === 'other' ? input.customText?.trim() || undefined : undefined,
  memoNo: input.memoNo?.trim() || undefined,
  memoDate: input.memoDate,
  note: input.note?.trim() || undefined
});

// معالجات موقف الطلبية: سجل فقط، لا تأثير على أي حساب. تُبنى المناقصة من currentProject وقت العرض
export function createStatusHandlers(ctx: EditContext) {
  const { currentProject, saveProject } = ctx;
  const log = currentProject.statusLog ?? [];

  const commit = (statusLog: StatusEntry[], action: string, details: string, extra?: { oldValue?: string; newValue?: string }) => {
    const updated: TenderProject = addAuditLog(
      { ...currentProject, statusLog, updatedAt: new Date().toISOString() },
      action, details, extra
    );
    saveProject(updated);
  };

  const handleAddStatus = (input: StatusInput): string | null => {
    const data = clean(input);
    const error = validateStatusEntry(data);
    if (error) return error;
    const now = Date.now();
    const entry: StatusEntry = { ...data, id: `status-${now}-${Math.random().toString(36).substring(2, 6)}`, recordedAt: new Date(now).toISOString() };
    commit([...log, entry], 'إضافة موقف للطلبية', `سُجّل الموقف: ${describe(entry)}`, { newValue: describe(entry) });
    return null;
  };

  const handleEditStatus = (id: string, input: StatusInput): string | null => {
    const old = log.find(e => e.id === id);
    if (!old) return 'الموقف المطلوب تعديله غير موجود';
    const data = clean(input);
    const error = validateStatusEntry(data);
    if (error) return error;
    const entry: StatusEntry = { ...data, id: old.id, recordedAt: old.recordedAt };
    commit(
      log.map(e => e.id === id ? entry : e),
      'تعديل موقف الطلبية',
      `عُدّل الموقف من (${describe(old)}) إلى (${describe(entry)})`,
      { oldValue: describe(old), newValue: describe(entry) }
    );
    return null;
  };

  const handleDeleteStatus = (id: string): void => {
    const old = log.find(e => e.id === id);
    if (!old) return;
    commit(log.filter(e => e.id !== id), 'حذف موقف من الطلبية', `حُذف الموقف: ${describe(old)}`, { oldValue: describe(old) });
  };

  return { handleAddStatus, handleEditStatus, handleDeleteStatus };
}

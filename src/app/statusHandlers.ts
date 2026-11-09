import { addAuditLog } from '../utils/storageService';
import { formatSheetDate, isValidDate, statusText, validateStatusEntry } from '../utils/orderStatus';
import { announcementLabel } from '../utils/tenderDetails';
import type { StatusEntry, TenderProject } from '../types/tender';

export type StatusInput = Omit<StatusEntry, 'id' | 'recordedAt'>;

// وصف الإدخال في سجل التدقيق: الإجراء والمذكرة وتاريخها إن وُجد
export const describeStatus = (e: StatusEntry): string =>
  `${statusText(e) || 'غير محدد'}${e.memoNo ? ` — مذكرة رقم (${e.memoNo})` : ''}${e.memoDate ? ` — بتاريخ ${formatSheetDate(e.memoDate)}` : ''}`;

// ينظّف المدخل: فراغات الأطراف، والحقول الفارغة تُحذف (والتاريخ الفارغ أيضاً)، والتفصيل النصي لكل إجراء
const clean = (input: StatusInput): StatusInput => ({
  stage: input.stage,
  branch: input.branch || undefined,
  customText: input.customText?.trim() || undefined,
  memoNo: input.memoNo?.trim() || undefined,
  memoDate: input.memoDate?.trim() || undefined,
  note: input.note?.trim() || undefined
});

// عمليات السجل النقية، مشتركة بين المناقصات والطلبيات بلا تحليل: ترجع الخطأ أو السجل الجديد
export type LogChange = { error: string } | { log: StatusEntry[]; entry: StatusEntry; old?: StatusEntry };

export function applyStatusAdd(log: StatusEntry[], input: StatusInput): LogChange {
  const data = clean(input);
  const error = validateStatusEntry(data);
  if (error) return { error };
  const now = Date.now();
  const entry: StatusEntry = { ...data, id: `status-${now}-${Math.random().toString(36).substring(2, 6)}`, recordedAt: new Date(now).toISOString() };
  return { log: [...log, entry], entry };
}

export function applyStatusEdit(log: StatusEntry[], id: string, input: StatusInput): LogChange {
  const old = log.find(e => e.id === id);
  if (!old) return { error: 'الموقف المطلوب تعديله غير موجود' };
  const data = clean(input);
  const error = validateStatusEntry(data);
  if (error) return { error };
  const entry: StatusEntry = { ...data, id: old.id, recordedAt: old.recordedAt };
  return { log: log.map(e => e.id === id ? entry : e), entry, old };
}

export function applyStatusDelete(log: StatusEntry[], id: string): { log: StatusEntry[]; old: StatusEntry } | null {
  const old = log.find(e => e.id === id);
  return old ? { log: log.filter(e => e.id !== id), old } : null;
}

// معالجات موقف الطلبية: سجل فقط، لا تأثير على أي حساب. تعمل على أي مناقصة تُمرَّر (لا الحالية وحدها)،
// فيحرّر كشف الموقف مناقصات أخرى. تُبنى من المناقصة وقت العرض
export function createStatusHandlers(project: TenderProject, saveProject: (p: TenderProject) => void) {
  const log = project.statusLog ?? [];

  const commit = (statusLog: StatusEntry[], action: string, details: string, extra?: { oldValue?: string; newValue?: string }) => {
    const updated: TenderProject = addAuditLog(
      { ...project, statusLog, updatedAt: new Date().toISOString() },
      action, details, extra
    );
    saveProject(updated);
  };

  const handleAddStatus = (input: StatusInput): string | null => {
    const r = applyStatusAdd(log, input);
    if ('error' in r) return r.error;
    commit(r.log, 'إضافة موقف للطلبية', `سُجّل الموقف: ${describeStatus(r.entry)}`, { newValue: describeStatus(r.entry) });
    return null;
  };

  const handleEditStatus = (id: string, input: StatusInput): string | null => {
    const r = applyStatusEdit(log, id, input);
    if ('error' in r) return r.error;
    commit(
      r.log,
      'تعديل موقف الطلبية',
      `عُدّل الموقف من (${describeStatus(r.old!)}) إلى (${describeStatus(r.entry)})`,
      { oldValue: describeStatus(r.old!), newValue: describeStatus(r.entry) }
    );
    return null;
  };

  const handleDeleteStatus = (id: string): void => {
    const r = applyStatusDelete(log, id);
    if (!r) return;
    commit(r.log, 'حذف موقف من الطلبية', `حُذف الموقف: ${describeStatus(r.old)}`, { oldValue: describeStatus(r.old) });
  };

  // الإعلان وتاريخ الاستلام من كشف الموقف: بصياغة حفظ الإعدادات نفسها، ولا يمسّان statusLog أبداً
  const handleSaveDetails = (d: { announcementNo?: number; receivedAt?: string }): string | null => {
    const receivedAt = d.receivedAt?.trim() || undefined;
    if (receivedAt && !isValidDate(receivedAt)) return 'تاريخ الاستلام غير صالح';
    const changes: string[] = [];
    const change = (label: string, a?: string, b?: string) => {
      if ((a ?? '') !== (b ?? '')) changes.push(` — ${label}: ${b ?? 'غير محدد'}`);
    };
    change('الإعلان', announcementLabel(project.announcementNo), announcementLabel(d.announcementNo));
    change('تاريخ الاستلام', formatSheetDate(project.receivedAt) || undefined, formatSheetDate(receivedAt) || undefined);
    if (changes.length === 0) return null;
    const updated = addAuditLog(
      { ...project, announcementNo: d.announcementNo, receivedAt, updatedAt: new Date().toISOString() },
      'تعديل إعدادات المناقصة',
      `تم تحديث بيانات المناقصة من كشف الموقف${changes.join('')}`
    );
    saveProject(updated);
    return null;
  };

  return { handleAddStatus, handleEditStatus, handleDeleteStatus, handleSaveDetails };
}

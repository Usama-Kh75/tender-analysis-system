import { COMMITTEE_NAME_KEY, isSaveBlocked } from './storageService';

/** اسم اللجنة المحفوظ في هذا المتصفح؛ null = لم يُدخل بعد (المحفوظ الفارغ يعدّ غير مُدخل). */
export function getCommitteeName(): string | null {
  try {
    const v = localStorage.getItem(COMMITTEE_NAME_KEY)?.trim();
    return v ? v : null;
  } catch {
    return null;
  }
}

export function saveCommitteeName(name: string): void {
  if (isSaveBlocked()) return;
  // بلا التقاط صامت: فشل التخزين يظهر كما في saveStatusOrders
  localStorage.setItem(COMMITTEE_NAME_KEY, name.trim());
}

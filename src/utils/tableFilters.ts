// مرشحات جدول العطاء في العرضين: العادي (المراجعة) وعرض التدقيق والتصحيح الحسابي
import type { BOQItem } from '../types/tender';
import { isCommitteeCorrected } from './bidderAuditEngine';

export type NormalFilter = 'all' | 'deviated' | 'savings';
export type AuditFilter = 'all' | 'pending' | 'corrected';

/** فقرة بانتظار قرار اللجنة: خطأ ضرب أو خلاف تفقيط */
export const isPending = (i: BOQItem): boolean => !!(i.hasMathError || i.hasTextDiscrepancy);

/**
 * معرّفات الفقرات المعلّقة لحظة اختيار مرشح «بانتظار قرار». الفقرة لا تختفي من تحت يد من يصححها:
 * تبقى في القائمة بعلامة «✓ عولجت» حتى يغيّر المستخدم المرشح أو يغلق العرض أو يبدّل الشركة
 */
export function pinPending(items: BOQItem[]): Set<string> {
  return new Set(items.filter(isPending).map(i => i.id));
}

export function auditFilterMatch(i: BOQItem, f: AuditFilter, pinned: Set<string>): boolean {
  if (f === 'pending') return isPending(i) || pinned.has(i.id);
  if (f === 'corrected') return isCommitteeCorrected(i);
  return true;
}

/** فقرة مثبَّتة في «بانتظار قرار» زالت علامتها بقرار أو تصحيح قراءة */
export function isHandled(i: BOQItem, pinned: Set<string>): boolean {
  return pinned.has(i.id) && !isPending(i);
}

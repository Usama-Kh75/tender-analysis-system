// «إشعار تصحيح المجهز للتوقيع» (ضوابط رقم (4) خامساً/ب/3): الفقرات التي صحّحتها اللجنة في عطاء مجهز.
// دالة نقية تشتق من البيانات ولا تغيّر شيئاً مخزّناً
import type { AuditLogEntry, Bidder } from '../types/tender';
import { ADOPTION_ACTIONS, asSubmitted, findAdoption, isCommitteeCorrected, unitLostOf } from './bidderAuditEngine';

export interface CorrectionNoticeRow {
  itemNo: string | number;
  description: string;
  unit: string;
  quantity: number;
  submittedUnit: number | null; // null: لم يُحفظ ما دوّنه المجهز
  submittedTotal: number;
  writtenText?: string;
  adoptedUnit: number;
  adoptedTotal: number;
  basis: string;
  signed: boolean;
}

export interface CorrectionNotice {
  rows: CorrectionNoticeRow[];
  pending: number;
  totalDifference: number;
}

const BASIS: Record<string, string> = {
  [ADOPTION_ACTIONS.math]: 'اعتماد حاصل الضرب (الكمية × سعر المفرد)',
  [ADOPTION_ACTIONS.unit]: 'اعتماد سعر المفرد المكتوب كتابةً',
  [ADOPTION_ACTIONS.amount]: 'اعتماد المبلغ المكتوب كتابةً',
  [ADOPTION_ACTIONS.thousands]: 'إضافة «آلاف» إلى التفقيط',
  [ADOPTION_ACTIONS.decimal]: 'اعتماد المبلغ وتصحيح سعر المفرد (العلامة العشرية)'
};

export const correctionNoticeRows = (bidder: Bidder, logs: AuditLogEntry[]): CorrectionNotice => {
  const rows: CorrectionNoticeRow[] = [];
  let pending = 0;
  for (const item of bidder.items) {
    if (!isCommitteeCorrected(item)) {
      if (item.hasMathError || item.hasTextDiscrepancy) pending++;
      continue;
    }
    const adoption = findAdoption(item, bidder.id, logs);
    const sub = asSubmitted(item);
    rows.push({
      itemNo: item.itemNo,
      description: item.description,
      unit: item.unit,
      quantity: item.quantity,
      submittedUnit: unitLostOf(item, adoption) ? null : sub.unit,
      submittedTotal: sub.total,
      writtenText: sub.writtenText,
      adoptedUnit: item.enteredUnitPrice ?? 0,
      adoptedTotal: item.bidderTotal,
      basis: (adoption && BASIS[adoption.action]) || 'تصحيح بقرار اللجنة',
      signed: !!item.bidderSignedAt
    });
  }
  const totalDifference = rows.reduce((s, r) => s + r.adoptedTotal - r.submittedTotal, 0);
  return { rows, pending, totalDifference };
};

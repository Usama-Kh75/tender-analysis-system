// موثوقية قراءة عطاء المجهز بالذكاء الاصطناعي: الفقرات التي تُطابَق بالورقة أولاً، وما عدّلته اللجنة بعد القراءة
// (مقياس الخطأ الفعلي في هذه المناقصة). عرض فقط: لا يدخل في حساب ولا ترتيب ولا توصية ولا محضر ولا Excel
import type { Bidder } from '../types/tender';
import { isCommitteeCorrected } from './bidderAuditEngine';

export interface ReadingRiskRow {
  index: number;
  itemNo: number | string;
  description: string;
  amount: number;
  reasons: string[];
  // اختلاف القراءتين وحده تُنهيه اللجنة بزر «طابقتُ الورقة»؛ غيره يزول بتصحيح الرقم أو بقرار اللجنة
  canConfirm: boolean;
}

export interface ReadingReliability {
  engine: 'ai' | 'ocr' | 'mixed';
  readRows: number;
  corrected: number;
  checkRows: number;
  riskRows: ReadingRiskRow[];
}

// null لعطاء لم يُقرأ آلياً (إدخال يدوي أو Excel): لا بطاقة له
export function readingReliability(bidder: Bidder): ReadingReliability | null {
  const read = bidder.items.map((item, index) => ({ item, index })).filter(r => r.item.readBy);
  if (read.length === 0) return null;
  const ai = read.filter(r => r.item.readBy === 'ai').length;
  const engine = ai === read.length ? 'ai' : ai === 0 ? 'ocr' : 'mixed';
  const riskRows: ReadingRiskRow[] = [];
  read.forEach(({ item, index }) => {
    if (item.unpriced || isCommitteeCorrected(item)) return;
    const reasons: string[] = [];
    if (item.readCheck) reasons.push(`اختلفت القراءتان في (${item.readCheck.fields.join('، ')}) — الثانية: ${item.readCheck.second}`);
    if (item.hasMathError) reasons.push('كمية × مفرد لا تساوي المبلغ: قارنها بالورقة');
    if (item.hasTextDiscrepancy) reasons.push('تعارض بين التفقيط والرقم: قارنه بالورقة');
    if (reasons.length === 0) return;
    riskRows.push({
      index, itemNo: item.itemNo, description: item.description,
      amount: item.enteredBidderTotal || item.bidderTotal, reasons, canConfirm: !!item.readCheck
    });
  });
  // الأكبر مبلغاً أولاً: يتحقق منه من يطابق بالورقة قبل غيره
  riskRows.sort((a, b) => b.amount - a.amount || a.index - b.index);
  return {
    engine,
    readRows: read.length,
    corrected: read.filter(r => r.item.readCorrected).length,
    checkRows: riskRows.filter(r => r.canConfirm).length,
    riskRows
  };
}

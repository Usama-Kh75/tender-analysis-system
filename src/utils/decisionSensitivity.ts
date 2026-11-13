// حساسية القرار: هل الفقرات التي لم تُطابَق بالورقة بعد قراءتها آلياً بحجم يكفي لقلب الترسية؟
// عرض فقط: لا يدخل في حساب ولا ترتيب ولا توصية ولا محضر ولا Excel. يُستنتج ولا يُخزَّن
import type { TenderProject } from '../types/tender';
import { buildRecommendation } from './recommendation';
import { readingReliability } from './readingReliability';

export interface BidderExposure {
  bidderId: string;
  name: string;
  rows: number;
  // مجموع مبالغ الفقرات المعلَّمة «طابِقها بالورقة»: أكبر ما قد تتحرك به قراءتها الخاطئة، حداً أعلى متحفظاً
  amount: number;
}

export interface DecisionSensitivity {
  primary: BidderExposure;
  rival: BidderExposure;
  // الفرق بين مبلغَي العطاءين (مطلق): ما يلزم أن تتحرك به المبالغ ليتبدّل الأقرب منهما
  gap: number;
}

const exposureOf = (b: TenderProject['bidders'][number]): BidderExposure => {
  const rows = readingReliability(b)?.riskRows ?? [];
  return { bidderId: b.id, name: b.name, rows: rows.length, amount: rows.reduce((s, r) => s + r.amount, 0) };
};

/**
 * العطاء المعني بالتوصية (الأوطأ أو ما اختارته اللجنة) مقابل أقرب عطاء مؤهل آخر بالمبلغ.
 * تحذير إن بلغ مجموع الفقرات غير المطابقة عندهما الفرق بينهما، أي أن خطأ قراءة بهذا الحجم يكفي لتبديلهما.
 * null إن لم يوجد عطاءان مؤهلان، أو لم تبقَ فقرات تنتظر المطابقة، أو كان مجموعها دون الفرق.
 * حد أعلى متحفظ: يعدّ المبلغ كله معرَّضاً للخطأ، ولا يقدّر احتمال الخطأ ولا اتجاهه.
 */
export function decisionSensitivity(project: TenderProject): DecisionSensitivity | null {
  const rec = buildRecommendation(project);
  const primary = rec.primary;
  if (!primary || !rec.eligible.some(b => b.id === primary.id)) return null;
  const others = rec.eligible.filter(b => b.id !== primary.id);
  if (others.length === 0) return null;
  const dist = (b: typeof primary) => Math.abs(b.totals.totalBidderAmount - primary.totals.totalBidderAmount);
  const rival = others.reduce((best, b) => (dist(b) < dist(best) ? b : best));
  const p = exposureOf(primary);
  const r = exposureOf(rival);
  const gap = dist(rival);
  if (p.rows + r.rows === 0 || p.amount + r.amount < gap) return null;
  return { primary: p, rival: r, gap };
}

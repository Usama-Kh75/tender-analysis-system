import { BOQItem } from '../types/tender';
import { toLatinDigits } from './calculations';

/** فقرة الجدول القائم كما تُمرَّر لنوافذ الاستيراد: كمية الفقرة الفارغة («فقرة N» بلا مبالغ) صفر */
export type EstimateTableRow = { itemNo: number | string; quantity: number; description?: string };

type Change = { itemNo: number | string; from: string | number; to: string | number };

export interface EstimateMergePlan {
  /** طوبقت القراءة برقم الفقرة؛ false: بالترتيب (جدول فارغ تبنيه الكلفة التخمينية، أو قراءة بلا أرقام) */
  byItemNo: boolean;
  /** صفوف القراءة مرتبة على فقرات الجدول (الموضع i للفقرة i، undefined: تبقى كما هي)، ثم الفقرات الجديدة */
  rows: (Partial<BOQItem> | undefined)[];
  matched: number;
  missing: string[];    // فقرات في الجدول لم تُقرأ: يبقى تخمينيها القائم
  duplicates: string[]; // قُرئت أكثر مما في الجدول: لا يُدرج أي منها، فلا يُعرف أيها الصحيح
  extras: string[];     // أرقام ليست في الجدول: تُضاف فقرات جديدة في آخره
  unnumbered: number;   // صفوف بلا رقم فقرة: لا تُدرج
  quantityChanges: Change[];
  descriptionChanges: Change[];
}

// «١٧٦» و«176» و«176.» و«0176» رقم واحد؛ «1.15» يبقى كما هو
const itemKey = (n: unknown) => {
  const s = toLatinDigits(String(n ?? '')).replace(/\s+/g, '').replace(/[.\-–]+$/, '');
  return /^\d+$/.test(s) ? String(Number(s)) : s;
};
const squash = (s?: string) => (s || '').replace(/\s+/g, ' ').trim();
const realDesc = (s?: string) => !!s && !s.startsWith('فقرة ');

/**
 * يطابق قراءة جدول الكلفة التخمينية مع فقرات الجدول القائم برقم الفقرة لا بالترتيب: كانت فقرة واحدة تسقط من
 * القراءة فتصعد كلفة كل فقرة بعدها إلى الفقرة التي قبلها (الفقرة 176 في 2026-10-12). تستعمله المعاينة
 * والإدراج (handleApplyExtractedItems) معاً فيتطابقان. الكلفة التخمينية تضع الكمية والوصف (قرار المستخدم)،
 * فيُعرض ما ستغيّره منهما قبل الإدراج
 */
export const planEstimateMerge = (extracted: Partial<BOQItem>[], table: EstimateTableRow[]): EstimateMergePlan => {
  const empty = { missing: [], duplicates: [], extras: [], unnumbered: 0 };
  const numbered = extracted.filter(e => itemKey(e.itemNo) !== '');
  const tableHasItems = table.some(r => r.quantity > 0);

  let plan: Omit<EstimateMergePlan, 'quantityChanges' | 'descriptionChanges'>;
  if (!tableHasItems || numbered.length === 0) {
    plan = { byItemNo: false, rows: [...extracted], matched: Math.min(extracted.length, table.length), ...empty };
  } else {
    const readByKey = new Map<string, Partial<BOQItem>[]>();
    numbered.forEach(e => {
      const k = itemKey(e.itemNo);
      readByKey.set(k, [...(readByKey.get(k) || []), e]);
    });
    const tableCount = new Map<string, number>();
    table.forEach(r => tableCount.set(itemKey(r.itemNo), (tableCount.get(itemKey(r.itemNo)) || 0) + 1));

    const duplicates = [...readByKey.entries()]
      .filter(([k, reads]) => reads.length > (tableCount.get(k) || 1))
      .map(([k]) => k);
    // رقم مكرر في الجدول نفسه: يُطابق ظهوره الأول بالقراءة الأولى، والثاني بالثانية
    const used = new Map<string, number>();
    const missing: string[] = [];
    const rows: (Partial<BOQItem> | undefined)[] = table.map(r => {
      const k = itemKey(r.itemNo);
      const n = used.get(k) || 0;
      used.set(k, n + 1);
      const ext = duplicates.includes(k) ? undefined : readByKey.get(k)?.[n];
      if (!ext && !duplicates.includes(k)) missing.push(String(r.itemNo));
      return ext;
    });
    const matched = rows.filter(Boolean).length;
    const extraRows = numbered.filter(e => !tableCount.has(itemKey(e.itemNo)) && !duplicates.includes(itemKey(e.itemNo)));
    plan = {
      byItemNo: true,
      rows: [...rows, ...extraRows],
      matched,
      missing,
      duplicates,
      extras: extraRows.map(e => String(e.itemNo)),
      unnumbered: extracted.length - numbered.length
    };
  }

  const quantityChanges: Change[] = [];
  const descriptionChanges: Change[] = [];
  table.forEach((r, i) => {
    const ext = plan.rows[i];
    if (!ext || r.quantity <= 0) return; // فقرة فارغة: لا كمية ولا وصف قائمان
    if ((ext.quantity || 0) > 0 && Math.abs(ext.quantity! - r.quantity) > 1e-9) {
      quantityChanges.push({ itemNo: r.itemNo, from: r.quantity, to: ext.quantity! });
    }
    // فروق المسافات لا تُعرض
    if (realDesc(ext.description) && realDesc(r.description) && squash(ext.description) !== squash(r.description)) {
      descriptionChanges.push({ itemNo: r.itemNo, from: squash(r.description), to: squash(ext.description) });
    }
  });

  return { ...plan, quantityChanges, descriptionChanges };
};

const listNos = (nos: string[], max = 15) =>
  nos.slice(0, max).join('، ') + (nos.length > max ? ` و(${nos.length - max}) غيرها` : '');

/** نص تأكيد الإدراج إن لم تُطابق القراءة الجدول فقرة بفقرة، وإلا null */
export const estimateMergeConfirmText = (plan: EstimateMergePlan): string | null => {
  const lines = [
    plan.missing.length > 0 && `• (${plan.missing.length}) فقرة لم تُقرأ، فيبقى تخمينيها القائم: ${listNos(plan.missing)}`,
    plan.duplicates.length > 0 && `• (${plan.duplicates.length}) رقم قُرئ أكثر من مرة، فلا يُدرج أي منها: ${listNos(plan.duplicates)}`,
    plan.extras.length > 0 && `• (${plan.extras.length}) فقرة ليست في الجدول، فتُضاف في آخره: ${listNos(plan.extras)}`,
    plan.unnumbered > 0 && `• (${plan.unnumbered}) صف بلا رقم فقرة، فلا يُدرج`
  ].filter(Boolean);
  if (lines.length === 0) return null;
  return 'طوبقت القراءة مع الجدول برقم الفقرة، ولم تتطابق كلها:\n' + lines.join('\n')
    + '\n\nقد تكون فقرة سقطت عند القراءة أو قُرئ رقمها خطأً. هل طابقتها مع الأصل وتريد الإدراج؟';
};

/** ملخص المطابقة لسجل التدقيق */
export const estimateMergeLogNote = (plan: EstimateMergePlan): string => {
  if (!plan.byItemNo) return '';
  const parts = [
    `طوبقت (${plan.matched}) فقرة برقم الفقرة`,
    plan.missing.length > 0 && `لم تُقرأ: ${listNos(plan.missing)}`,
    plan.duplicates.length > 0 && `مكررة لم تُدرج: ${listNos(plan.duplicates)}`,
    plan.extras.length > 0 && `أضيفت: ${listNos(plan.extras)}`,
    plan.unnumbered > 0 && `(${plan.unnumbered}) صف بلا رقم لم يُدرج`,
    plan.quantityChanges.length > 0 && `تغيرت كمية (${plan.quantityChanges.length}) فقرة: ${plan.quantityChanges.slice(0, 15).map(c => `${c.itemNo} من ${c.from} إلى ${c.to}`).join('، ')}${plan.quantityChanges.length > 15 ? '…' : ''}`,
    plan.descriptionChanges.length > 0 && `تغير وصف (${plan.descriptionChanges.length}) فقرة`
  ].filter(Boolean);
  return ' — ' + parts.join('؛ ');
};

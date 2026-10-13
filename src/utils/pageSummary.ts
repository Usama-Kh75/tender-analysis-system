import type { BOQItem } from '../types/tender';
import { toLatinDigits } from './calculations';

/**
 * صفحات عطاء المجهز كما قدّمه: رقم صفحة لكل فقرة (pageNo، لكل مجهز ترقيمه)، وملخص بمبلغ كل صفحة في الطبقات
 * الثلاث (كما دوّنه المجهز، بعد التصحيح الحسابي، العرض الموزون). مجموع الصفحات يساوي مجموع العطاء دائماً:
 * الفقرات بلا صفحة صف مستقل لا تُسقط
 */

const round2 = (v: number) => Math.round(v * 100) / 100;
// الأرقام الهندية تُطابق اللاتينية: «٢٧» تُصيب الفقرة 27 وتُقبل رقماً للصفحة
const key = (v: unknown) => toLatinDigits(String(v ?? '').trim());

/** أرقام أول فقرة في كل صفحة (كما أدخلتها اللجنة) إلى مواضع في الجدول، أو سبب الرفض */
export function resolvePageStarts(items: BOQItem[], itemNos: string[]): { starts: number[] } | { error: string } {
  const wanted = itemNos.map(key);
  if (wanted.length === 0 || wanted.some(n => !n)) return { error: 'أدخل رقم أول فقرة لكل صفحة.' };
  const starts: number[] = [];
  for (let p = 0; p < wanted.length; p++) {
    const from = p === 0 ? 0 : starts[p - 1] + 1;
    const idx = items.findIndex((it, i) => i >= from && key(it.itemNo) === wanted[p]);
    if (idx === -1) {
      const exists = items.some(it => key(it.itemNo) === wanted[p]);
      return { error: exists
        ? `الصفحة (${p + 1}): الفقرة (${wanted[p]}) يجب أن تأتي بعد أول فقرة في الصفحة (${p}).`
        : `الصفحة (${p + 1}): لا توجد فقرة رقمها (${wanted[p]}) في الجدول.` };
    }
    starts.push(idx);
  }
  return { starts };
}

/**
 * رقم صفحة كل فقرة من مواضع بدايات الصفحات. الصفحة الأولى تبدأ من أول فقرة دائماً.
 * pageNumbers أرقام الصفحات الفعلية في العطاء (غلاف يسبق الجدول، أو صفحة شروط بين صفحتين)، وإلا 1..ن
 */
export function pagesFromStarts(itemCount: number, starts: number[], pageNumbers?: number[]): (number | undefined)[] {
  const s = [0, ...starts.slice(1)];
  return Array.from({ length: itemCount }, (_, i) => {
    const idx = s.filter(x => x <= i).length;
    return pageNumbers?.[idx - 1] ?? idx;
  });
}

/** أرقام الصفحات المدخلة: أعداد صحيحة موجبة متصاعدة بصرامة، أو سبب الرفض */
export function resolvePageNumbers(raw: string[]): { numbers: number[] } | { error: string } {
  const numbers: number[] = [];
  for (let p = 0; p < raw.length; p++) {
    const text = key(raw[p]);
    const n = Number(text);
    if (!text || !Number.isInteger(n) || n < 1) return { error: `الصفحة (${p + 1}): رقم الصفحة (${text || '—'}) يجب أن يكون عدداً صحيحاً موجباً.` };
    if (p > 0 && n <= numbers[p - 1]) return { error: `الصفحة (${p + 1}): رقمها (${n}) يجب أن يزيد على رقم الصفحة التي قبلها (${numbers[p - 1]}).` };
    numbers.push(n);
  }
  return { numbers };
}

// أول فقرة لكل صفحة مسندة حالياً، بترتيب الصفحات
function currentStarts(items: BOQItem[]): { page: number; itemNo: string }[] {
  const seen = new Set<number>();
  const out: { page: number; itemNo: string }[] = [];
  items.forEach(it => {
    if (it.pageNo !== undefined && !seen.has(it.pageNo)) {
      seen.add(it.pageNo);
      out.push({ page: it.pageNo, itemNo: key(it.itemNo) });
    }
  });
  return out.sort((a, b) => a.page - b.page);
}

/** أرقام أول فقرة لكل صفحة مسندة حالياً، لتعبئة نافذة فواصل الصفحات */
export function startItemNos(items: BOQItem[]): string[] {
  return currentStarts(items).map(x => x.itemNo);
}

/** أرقام الصفحات المسندة حالياً بالترتيب نفسه، فلا تُعاد ترقيمتها من 1 عند تصحيح فاصل واحد */
export function startPages(items: BOQItem[]): number[] {
  return currentStarts(items).map(x => x.page);
}

export interface PageSummaryRow { page: number | null; itemCount: number; stated: number; corrected: number; offer: number }
export interface PageSummary { rows: PageSummaryRow[]; totals: { stated: number; corrected: number; offer: number }; unassigned: number }

export interface PageRangeRow { page: number; from: string; to: string; itemCount: number; stated: number }

/**
 * معاينة فواصل الصفحات قبل الإسناد: لكل صفحة أول فقرة فيها وآخرها (بترتيب الجدول) وعددها ومبلغها كما دوّنه المجهز.
 * المبالغ من summarizePages نفسها فلا تختلف عن الملخص بعد الإسناد
 */
export function previewPageRanges(items: BOQItem[], pages: (number | undefined)[]): PageRangeRow[] {
  const summary = summarizePages(items.map((it, i) => ({ ...it, pageNo: pages[i] })));
  if (!summary) return [];
  const bounds = new Map<number, { from: string; to: string }>();
  items.forEach((it, i) => {
    const page = pages[i];
    if (page === undefined) return;
    const b = bounds.get(page);
    if (b) b.to = key(it.itemNo);
    else bounds.set(page, { from: key(it.itemNo), to: key(it.itemNo) });
  });
  return summary.rows.flatMap(r => {
    const b = r.page === null ? undefined : bounds.get(r.page);
    return r.page !== null && b ? [{ page: r.page, from: b.from, to: b.to, itemCount: r.itemCount, stated: r.stated }] : [];
  });
}

export function summarizePages(items: BOQItem[]): PageSummary | null {
  if (!items.some(i => i.pageNo !== undefined)) return null;
  const groups = new Map<number | null, PageSummaryRow>();
  items.forEach(i => {
    const page = i.pageNo ?? null;
    const row = groups.get(page) ?? { page, itemCount: 0, stated: 0, corrected: 0, offer: 0 };
    row.itemCount += 1;
    row.stated += i.enteredBidderTotal || i.bidderTotal;
    row.corrected += i.bidderTotal;
    row.offer += i.offerTotal ?? i.bidderTotal;
    groups.set(page, row);
  });
  const rows = [...groups.values()]
    .map(r => ({ ...r, stated: round2(r.stated), corrected: round2(r.corrected), offer: round2(r.offer) }))
    .sort((a, b) => (a.page ?? Infinity) - (b.page ?? Infinity));
  const sum = (f: 'stated' | 'corrected' | 'offer') => round2(rows.reduce((s, r) => s + r[f], 0));
  return {
    rows,
    totals: { stated: sum('stated'), corrected: sum('corrected'), offer: sum('offer') },
    unassigned: groups.get(null)?.itemCount ?? 0
  };
}

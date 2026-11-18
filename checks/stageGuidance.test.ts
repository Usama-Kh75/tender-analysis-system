// «ما تقرره التعليمات هنا»: المواد المنطبقة بحسب حال المناقصة والتبويب (عرض فقط)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createNewTenderProject } from '../src/utils/storageService';
import { calculateBOQMetrics } from '../src/utils/calculations';
import { stageGuidance } from '../src/utils/stageGuidance';
import { LEGAL_TEXTS, type LegalKey } from '../src/utils/legalTexts';
import type { Bidder, BOQItem, TenderProject } from '../src/types/tender';

const row = (id: string, bidderTotal: number, est = 1000): Partial<BOQItem> => ({
  id, itemNo: id, description: id, quantity: 1, estimatedTotal: est,
  bidderTotal, enteredBidderTotal: bidderTotal, enteredUnitPrice: bidderTotal
});
// الأعلام والحقول الإضافية تُضبط بعد الحساب كي يبقى الفحص على القراءة وحدها
const mk = (base: Bidder, rows: Partial<BOQItem>[], over: Partial<BOQItem>[] = [], extra: Partial<Bidder> = {}): Bidder => {
  const calc = calculateBOQMetrics(rows, 20);
  const items = calc.items.map((it, i) => ({ ...it, hasMathError: false, hasTextDiscrepancy: false, ...(over[i] ?? {}) }));
  return { ...base, items, totals: calc.totals, ...extra };
};
const proj = (amounts: (number | Partial<BOQItem>[])[], extras: Partial<TenderProject> = {}): TenderProject => {
  const p = createNewTenderProject({ title: 'ط', referenceNumber: '1', contractType: 'supply', budgetType: 'operating', bidderNames: amounts.map((_, i) => `ش${i + 1}`) });
  return { ...p, ...extras, bidders: p.bidders.map((b, i) => mk(b, typeof amounts[i] === 'number' ? [row('1', amounts[i] as number)] : amounts[i] as Partial<BOQItem>[])) };
};
const withBidder = (p: TenderProject, i: number, over: Partial<BOQItem>[], extra: Partial<Bidder> = {}): TenderProject => ({
  ...p, bidders: p.bidders.map((b, k) => k === i ? { ...b, items: b.items.map((it, j) => ({ ...it, ...(over[j] ?? {}) })), ...extra } : b)
});
const keys = (p: TenderProject, tab: string) => stageGuidance(p, tab).map(g => g.key);
const TABS = ['bids', 'study', 'recommendation'];

test('العطاءات: خطأ ضرب يظهر معه ن وب/2 لا ب/1', () => {
  const p = withBidder(proj([900, 950]), 0, [{ hasMathError: true }]);
  const k = keys(p, 'bids');
  assert.ok(k.includes('art10_1_n') && k.includes('ann4_5_b2') && !k.includes('ann4_5_b1'));
});

test('العطاءات: تعارض تفقيط يظهر معه ن وب/1 لا ب/2', () => {
  const p = withBidder(proj([900, 950]), 1, [{ hasTextDiscrepancy: true }]);
  const k = keys(p, 'bids');
  assert.ok(k.includes('art10_1_n') && k.includes('ann4_5_b1') && !k.includes('ann4_5_b2'));
});

test('العطاءات: خطأ صحّحته اللجنة لا يُعدّ خطأً قائماً، ويظهر ب/3 وب/5', () => {
  const p = withBidder(proj([900, 950]), 0, [{ hasMathError: true, enteredBidderTotal: 800 }]);
  const k = keys(p, 'bids');
  assert.ok(k.includes('ann4_5_b3') && k.includes('ann4_5_b5'));
  assert.ok(!k.includes('art10_1_n') && !k.includes('ann4_5_b2'));
});

test('العطاءات: فقرة غير مسعّرة تظهر معها ط، وب/6 لعطاءين بمبالغ فأكثر', () => {
  const one = withBidder(proj([900]), 0, [{ unpriced: true }]);
  assert.deepEqual(keys(one, 'bids'), ['art10_1_t']);
  assert.ok(keys(proj([900, 950]), 'bids').includes('ann4_5_b6'));
  assert.deepEqual(keys(proj([900, 0]), 'bids'), []);
});

test('العطاءات: خطأ في شركة بلا مبالغ لا يُعدّ', () => {
  const p = withBidder(proj([900, 0]), 1, [{ hasMathError: true }]);
  assert.deepEqual(keys(p, 'bids'), []);
});

test('الدراسة: استبعاد بالحد، ومع حد معتمد غير 20 يُذكر الحد', () => {
  const p = proj([900, 1500]);
  const g = stageGuidance(p, 'study').find(x => x.key === 'art13_3a');
  assert.ok(g && !g.ruling.includes('الحد المعتمد'));
  const g2 = stageGuidance({ ...p, exclusionThreshold: 30 }, 'study').find(x => x.key === 'art13_3a');
  assert.ok(g2 && g2.ruling.includes('(30%)'));
  assert.ok(!keys(proj([900, 950]), 'study').includes('art13_3a'));
});

// عشر فقرات: اثنتان بزيادة 30% والبقية 94%، فمجموعه +1.2% (ضمن الحد) وفقراته المنحرفة 20% > 10%
const unbalanced = (): Partial<BOQItem>[] => Array.from({ length: 10 }, (_, i) => row(String(i + 1), i < 2 ? 1300 : 940));

test('الدراسة: عطاء مؤهل فقراته غير متوازنة يظهر معه سادساً/5', () => {
  const p = proj([unbalanced(), 900 as number]);
  // الثاني بفقرة واحدة تخمينها 1000 ومجموعه لا يقارن بالأول؛ يكفي أن الأول مؤهل
  assert.ok(keys(p, 'study').includes('ann4_6_5'));
  assert.ok(!keys(proj([900, 950]), 'study').includes('ann4_6_5'));
});

test('الدراسة والتوصية: التقارب يظهر معه مفتاح المفاضلة، والتساوي يضيف ب/15 والمبادرات', () => {
  const close = proj([900, 905]);
  const prefKey = keys(close, 'study')[0];
  assert.ok(prefKey.startsWith('ann5_'));
  assert.deepEqual(keys(close, 'recommendation').slice(0, 1), [prefKey]);
  assert.ok(!keys(close, 'recommendation').includes('art15_4a'));
  const tie = proj([900, 900]);
  const g = stageGuidance(tie, 'recommendation');
  assert.ok(g[0].ruling.includes('المبادرات'));
  assert.ok(g.some(x => x.key === 'art15_4a'));
  assert.ok(!stageGuidance(close, 'recommendation')[0].ruling.includes('المبادرات'));
});

test('التوصية: اختيار عطاء غير الأوطأ يظهر معه 10/أولاً/هـ', () => {
  let p = proj([900, 980]);
  p = { ...p, bidders: p.bidders.map((b, i) => i === 1 ? { ...b, status: 'recommended' as const } : b) };
  assert.ok(keys(p, 'recommendation').includes('art10_1_h'));
  assert.ok(!keys(proj([900, 980]), 'recommendation').includes('art10_1_h'));
});

test('التوصية: العرض الموزون للفائز، بعدم التوازن أو بعرض مسجَّل', () => {
  assert.ok(keys(proj([unbalanced()]), 'recommendation').includes('ann4_6_5'));
  const withOffer = withBidder(proj([900]), 0, [], { weightedOffer: { status: 'active', origin: 'corrected', startedAt: '2026-11-18', bidTotal: 900 } });
  assert.ok(keys(withOffer, 'recommendation').includes('ann4_6_5'));
  assert.ok(!keys(proj([900]), 'recommendation').includes('ann4_6_5'));
});

test('التوصية: زيادة على الكلفة تظهر معها مادة نوع الموازنة، ولا شيء بلا زيادة', () => {
  assert.deepEqual(keys(proj([1050]), 'recommendation'), ['ann2_4_2']);
  assert.deepEqual(keys(proj([1050], { budgetType: 'investment' }), 'recommendation'), ['ann2_4_1a']);
  assert.deepEqual(keys(proj([950]), 'recommendation'), []);
  // نوع غير محدد: تذكير على الشاشة فقط، لا مادة
  assert.deepEqual(keys(proj([1050], { budgetType: undefined }), 'recommendation'), []);
});

test('التوصية: إحالة، وإعادة طرح (الأقل ناقص، وكل العطاءات مستبعدة)', () => {
  assert.deepEqual(keys(proj([1300]), 'recommendation'), ['art13_3b']);
  assert.deepEqual(keys(proj([500]), 'recommendation'), ['art20_4']);
  const all = proj([900]);
  const rejected = { ...all, bidders: all.bidders.map(b => ({ ...b, status: 'disqualified' as const })) };
  assert.deepEqual(keys(rejected, 'recommendation'), ['art20_3']);
});

test('مناقصة فارغة: لا شيء في أي تبويب', () => {
  const p = createNewTenderProject({ title: 'ط', referenceNumber: '1', contractType: 'works', budgetType: 'operating', bidderNames: ['أ', 'ب'] });
  for (const t of TABS) assert.deepEqual(stageGuidance(p, t), [], t);
  assert.deepEqual(stageGuidance(p, 'غير معروف'), []);
});

test('بلا كلفة تخمينية: لا شيء في الدراسة والتوصية', () => {
  const p = proj([[row('1', 900, 0)], [row('1', 905, 0)]]);
  assert.deepEqual(stageGuidance(p, 'study'), []);
  assert.deepEqual(stageGuidance(p, 'recommendation'), []);
  assert.ok(stageGuidance(p, 'bids').length > 0);
});

test('بلا تكرار مفاتيح، وكل مفتاح له نص رسمي', () => {
  const scenarios = [
    withBidder(proj([900, 900]), 0, [{ hasMathError: true, hasTextDiscrepancy: true, unpriced: true }]),
    proj([unbalanced(), unbalanced()]), proj([1300]), proj([500]), proj([1050, 1100]), proj([900, 905])
  ];
  for (const p of scenarios) for (const t of TABS) {
    const k = keys(p, t);
    assert.equal(new Set(k).size, k.length, t);
    for (const key of k) assert.ok(LEGAL_TEXTS[key as LegalKey]?.text, key);
  }
});

test('المفاتيح الجديدة: نصها يطابق officialText في JSON بعد تقليص المسافات', () => {
  const dir = 'E:/Claude Projects/تعليمات 2025/contract-instructions-2025-offline/src/units/';
  const map: [LegalKey, string, string][] = [
    ['art10_1_n', 'article-10.json', 'أولاً / ن'], ['art10_1_t', 'article-10.json', 'أولاً / ط'], ['art10_1_h', 'article-10.json', 'أولاً / هـ'],
    ['ann4_5_b1', 'annex-04.json', 'خامساً / ب / 1'], ['ann4_5_b2', 'annex-04.json', 'خامساً / ب / 2'],
    ['ann4_5_b3', 'annex-04.json', 'خامساً / ب / 3'], ['ann4_5_b6', 'annex-04.json', 'خامساً / ب / 6']
  ];
  for (const [key, file, clause] of map) {
    const c = JSON.parse(fs.readFileSync(dir + file, 'utf8')).clauses.find((x: { clause: string }) => x.clause === clause);
    assert.equal(LEGAL_TEXTS[key].text, c.officialText.replace(/\s+/g, ' ').trim(), key);
    assert.equal(LEGAL_TEXTS[key].page, c.printedPage, key);
  }
});

// أثر التصحيح الحسابي على ترتيب المجهزين (ضوابط رقم (4) خامساً/ب/6): يُستنتج ولا يُخزَّن
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNewTenderProject } from '../src/utils/storageService';
import { calculateBOQMetrics } from '../src/utils/calculations';
import { rankingEffect } from '../src/utils/rankingEffect';
import type { Bidder, BOQItem, TenderProject } from '../src/types/tender';

// submitted = ما دوّنه المجهز، adopted = المعتمد بعد تصحيح اللجنة (يختلف فتُعدّ الفقرة مصحّحة)
const row = (id: string, submitted: number, adopted = submitted): Partial<BOQItem> => ({
  id, itemNo: id, description: id, quantity: 1, estimatedTotal: 1000,
  bidderTotal: adopted, enteredBidderTotal: submitted, enteredUnitPrice: submitted
});

const bidder = (base: Bidder, rows: Partial<BOQItem>[]): Bidder => {
  const calc = calculateBOQMetrics(rows, 20);
  return { ...base, items: calc.items, totals: calc.totals };
};

const make = (specs: Partial<BOQItem>[][]): TenderProject => {
  const p = createNewTenderProject({ title: 'ط', referenceNumber: '1', contractType: 'supply', budgetType: 'operating', bidderNames: specs.map((_, i) => `م${i + 1}`) });
  return { ...p, bidders: p.bidders.map((b, i) => bidder(b, specs[i])) };
};

test('لا تصحيحات: null', () => {
  assert.equal(rankingEffect(make([[row('1', 900)], [row('1', 950)]])), null);
});

test('مجهز واحد: null', () => {
  assert.equal(rankingEffect(make([[row('1', 900, 1000)], [row('1', 0)]])), null);
});

test('تصحيح يقلب الترتيب', () => {
  const r = rankingEffect(make([[row('1', 900, 1000)], [row('1', 950)]]))!;
  assert.equal(r.changed, true);
  const [a, b] = r.rows;
  assert.deepEqual([a.submittedTotal, a.correctedTotal, a.rankBefore, a.rankAfter, a.hasCorrections], [900, 1000, 1, 2, true]);
  assert.deepEqual([b.submittedTotal, b.correctedTotal, b.rankBefore, b.rankAfter, b.hasCorrections], [950, 950, 2, 1, false]);
});

test('تصحيح لا يقلب الترتيب', () => {
  const r = rankingEffect(make([[row('1', 900, 920)], [row('1', 950)]]))!;
  assert.equal(r.changed, false);
  assert.deepEqual(r.rows.map(x => [x.rankBefore, x.rankAfter]), [[1, 1], [2, 2]]);
});

test('التعادل رتبة واحدة (1،1،3)', () => {
  const r = rankingEffect(make([[row('1', 900, 950)], [row('1', 950)], [row('1', 1000)]]))!;
  assert.deepEqual(r.rows.map(x => x.rankBefore), [1, 2, 3]);
  assert.deepEqual(r.rows.map(x => x.rankAfter), [1, 1, 3]);
  assert.equal(r.changed, true);
});

test('مجهز بلا مبالغ يُهمل', () => {
  const r = rankingEffect(make([[row('1', 900, 1000)], [row('1', 950)], [row('1', 0)]]))!;
  assert.equal(r.rows.length, 2);
  assert.equal(r.rows.some(x => x.name === 'م3'), false);
});

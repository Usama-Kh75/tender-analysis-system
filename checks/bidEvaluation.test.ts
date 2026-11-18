// تقييم العطاءات تجارياً (evaluateBids): الدالة النقية المشتركة بين تبويبي الدراسة والتوصية (2026-11-18)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNewTenderProject } from '../src/utils/storageService';
import { calculateBOQMetrics } from '../src/utils/calculations';
import { evaluateBids } from '../src/utils/bidEvaluation';
import type { Bidder, BOQItem, TenderProject } from '../src/types/tender';

const row = (id: string, bidderTotal: number, estimatedTotal = 1000): Partial<BOQItem> => ({
  id, itemNo: id, description: id, quantity: 1, estimatedTotal,
  bidderTotal, enteredBidderTotal: bidderTotal, enteredUnitPrice: bidderTotal
});

const bidder = (base: Bidder, rows: Partial<BOQItem>[]): Bidder => {
  const calc = calculateBOQMetrics(rows, 20);
  return { ...base, items: calc.items, totals: calc.totals };
};

// الأول 900، الثاني 800 (الأقل)، الثالث 950، الرابعة بلا مبالغ؛ الكلفة التخمينية 1000
const setup = (): TenderProject => {
  const p = createNewTenderProject({ title: 'ط', referenceNumber: '1', contractType: 'supply', budgetType: 'operating', bidderNames: ['أ', 'ب', 'ج', 'د'] });
  const [a, b, c, d] = p.bidders;
  return { ...p, bidders: [bidder(a, [row('1', 900)]), bidder(b, [row('1', 800)]), bidder(c, [row('1', 950)]), bidder(d, [row('1', 0)])] };
};

test('الشركة بلا مبالغ لا تدخل التقييم', () => {
  const p = setup();
  assert.equal(evaluateBids(p).length, 3);
  assert.ok(!evaluateBids(p).some(b => b.id === p.bidders[3].id));
});

test('المستبعد في الأسفل ثم الأقل مبلغاً', () => {
  const p = setup();
  // الأقل مبلغاً (الثاني) مستبعد بقرار اللجنة
  const q = { ...p, bidders: p.bidders.map((b, i) => i === 1 ? { ...b, status: 'disqualified' as const } : b) };
  assert.deepEqual(evaluateBids(q).map(b => b.id), [p.bidders[0].id, p.bidders[2].id, p.bidders[1].id]);
});

test('المستبعد بقرار اللجنة', () => {
  const p = setup();
  const q = { ...p, bidders: p.bidders.map((b, i) => i === 0 ? { ...b, status: 'disqualified' as const } : b) };
  const ev = evaluateBids(q).find(b => b.id === p.bidders[0].id)!;
  assert.equal(ev.commercialStatus, 'excluded');
  assert.ok(ev.commercialReason.startsWith('مستبعد بقرار اللجنة'));
});

test('قبل الكلفة التخمينية', () => {
  const p = setup();
  const blank = { ...p, bidders: p.bidders.map(b => bidder(b, b.items.map(it => ({ ...it, estimatedTotal: 0, estimatedUnitPrice: 0 })))) };
  const ev = evaluateBids(blank);
  assert.equal(ev.length, 3);
  for (const b of ev) {
    assert.equal(b.commercialStatus, 'pending');
    assert.equal(b.commercialReason, 'بانتظار الكلفة التخمينية: لا يُحكم بالانحراف ولا بالتوازن قبل إدخالها');
  }
});

test('تجاوز حد الاستبعاد', () => {
  const p = setup();
  const q = { ...p, bidders: p.bidders.map((b, i) => i === 0 ? bidder(b, [row('1', 1300)]) : b) };
  const ev = evaluateBids(q).find(b => b.id === p.bidders[0].id)!;
  assert.equal(ev.commercialStatus, 'excluded');
  assert.ok(ev.commercialReason.startsWith('مستبعد تجارياً: تجاوز الانحراف الإجمالي'));
});

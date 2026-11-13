// «مسار التحليل» المشتق لتبويب الموقف (v6، 2026-11-13)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNewTenderProject } from '../src/utils/storageService';
import { calculateBOQMetrics } from '../src/utils/calculations';
import { analysisPath } from '../src/utils/analysisPath';
import type { Bidder, BOQItem, TenderProject } from '../src/types/tender';

const row = (id: string, bidderTotal: number, estimatedTotal = 1000): Partial<BOQItem> => ({
  id, itemNo: id, description: id, quantity: 1, estimatedTotal, bidderTotal, enteredBidderTotal: bidderTotal, enteredUnitPrice: bidderTotal
});
const bidder = (base: Bidder, rows: Partial<BOQItem>[], flags: Partial<BOQItem>[] = []): Bidder => {
  const calc = calculateBOQMetrics(rows, 20);
  const items = calc.items.map((it, i) => ({ ...it, hasMathError: false, hasTextDiscrepancy: false, ...(flags[i] ?? {}) }));
  return { ...base, items, totals: calc.totals };
};
const blank = () => createNewTenderProject({ title: 'ط', referenceNumber: '1', contractType: 'supply', budgetType: 'operating', bidderNames: ['أ', 'ب'] });
const states = (p: TenderProject) => analysisPath(p).flatMap(s => s.steps.map(x => x.state));
const find = (p: TenderProject, text: string) => analysisPath(p).flatMap(s => s.steps).find(x => x.text.includes(text))!;

test('مناقصة بلا كلفة: ثلاث مراحل، والحالية هي الكلفة وما بعدها ينتظر', () => {
  const p = { ...blank(), receivedAt: '2026-11-01' };
  const path = analysisPath(p);
  assert.deepEqual(path.map(s => s.title), ['الاستلام والإدخال', 'التدقيق الحسابي', 'التحليل والتوصية']);
  assert.equal(find(p, 'استلام العطاءات').state, 'done');
  assert.equal(find(p, 'استلام العطاءات').date, '2026-11-01');
  assert.equal(find(p, 'الكلفة التخمينية').state, 'current');
  assert.equal(states(p).filter(s => s === 'current').length, 1);
  assert.equal(find(p, 'اختيار الإحالة').state, 'pending');
});

test('فقرات معلقة: المتبقي في النص، والخطوة الحالية قرارات اللجنة، والفاعل مذكور', () => {
  const b = blank();
  const p: TenderProject = { ...b, bidders: [
    bidder(b.bidders[0], [row('1', 900), row('2', 900)], [{ hasMathError: true }, { hasTextDiscrepancy: true }]),
    bidder(b.bidders[1], [row('1', 950), row('2', 950)])
  ] };
  const s = find(p, 'قرارات اللجنة');
  assert.equal(s.state, 'current');
  assert.match(s.text, /2 متبقية/);
  assert.equal(s.actor, 'اللجنة');
  assert.equal(find(p, 'الفحص الحسابي الآلي').actor, 'النظام');
  assert.equal(find(p, 'الفحص الحسابي الآلي').state, 'done');
  assert.equal(find(p, 'إدخال العطاءات').text, 'إدخال العطاءات (2 من 2)');
  assert.equal(find(p, 'ترتيب العطاءات').state, 'pending');
});

test('إحالة مختارة بلا سجل موقف: المعاينة هي الحالية؛ وبالسجل يكتمل المسار', () => {
  const b = blank();
  let p: TenderProject = { ...b, bidders: [
    { ...bidder(b.bidders[0], [row('1', 900)]), status: 'recommended' as const },
    bidder(b.bidders[1], [row('1', 950)])
  ] };
  assert.equal(find(p, 'اختيار الإحالة').state, 'done');
  assert.match(find(p, 'اختيار الإحالة').text, /أ/);
  assert.equal(find(p, 'معاينة المحضر').state, 'current');
  p = { ...p, statusLog: [{ id: 's', stage: 'analysis', recordedAt: '2026-11-01T00:00:00.000Z' }] };
  assert.ok(states(p).every(s => s === 'done'));
});

test('الاشتقاق لا يغيّر المناقصة', () => {
  const p = blank();
  const before = JSON.stringify(p);
  analysisPath(p);
  assert.equal(JSON.stringify(p), before);
});

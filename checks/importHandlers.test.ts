// مسارات الاستيراد في createImportHandlers (src/app/importHandlers.ts): الدمج بالموضع والرقم، والكمية والهوية المشتركة، وقفل العرض الموزون
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateBOQMetrics } from '../src/utils/calculations';
import { createNewTenderProject } from '../src/utils/storageService';
import { createEditContext } from '../src/app/editContext';
import { createImportHandlers } from '../src/app/importHandlers';
import { Bidder, BOQItem, TenderProject } from '../src/types/tender';

const alerts: string[] = [];
(globalThis as any).window = { alert: (m: string) => { alerts.push(m); }, confirm: () => true };

const rows = (bid: number[]): Partial<BOQItem>[] => [
  { itemNo: 1, description: 'أ', unit: 'م', quantity: 10, estimatedTotal: 1000, bidderTotal: bid[0] },
  { itemNo: 2, description: 'ب', unit: 'م', quantity: 5, estimatedTotal: 500, bidderTotal: bid[1] },
  { itemNo: 3, description: 'ج', unit: 'م', quantity: 2, estimatedTotal: 200, bidderTotal: bid[2] }
];
const mkBidder = (id: string, name: string, bid: number[], extra?: (r: Partial<BOQItem>[]) => void): Bidder => {
  const r = rows(bid);
  extra?.(r);
  const c = calculateBOQMetrics(r, 20);
  return { id, name, submissionDate: '2026-01-01', items: c.items, totals: c.totals, status: 'pending' };
};
const mkProject = (a: Bidder = mkBidder('A', 'أ', [1000, 500, 200])): TenderProject => ({
  ...createNewTenderProject({ title: 'ت', referenceNumber: '1', contractType: 'works', bidderNames: ['x'] }),
  bidders: [a, mkBidder('B', 'ب', [900, 450, 180])],
  activeBidderId: 'A'
});
// يشغّل apply على مشروع ويعيد المشروع المحفوظ (undefined إن لم يُحفظ شيء)
const run = (project: TenderProject, ...args: Parameters<ReturnType<typeof createImportHandlers>['handleApplyExtractedItems']>) => {
  let saved: TenderProject | undefined;
  const ctx = createEditContext(project, project.bidders[0], (fn: any) => { saved = fn([project])[0]; });
  createImportHandlers(ctx).handleApplyExtractedItems(...args);
  return saved;
};

test('new_bidder: تبقى كمية الجدول ويُضاف المجهز نشطاً', () => {
  const out = run(mkProject(), [
    { itemNo: 1, quantity: 99, enteredUnitPrice: 90, enteredBidderTotal: 900, bidderTotal: 900 },
    { itemNo: 2, quantity: 99, enteredUnitPrice: 100, enteredBidderTotal: 500, bidderTotal: 500 },
    { itemNo: 3, quantity: 99, enteredUnitPrice: 100, enteredBidderTotal: 200, bidderTotal: 200 }
  ], 'new_bidder', 'ج');
  assert.ok(out);
  assert.equal(out.bidders.length, 3);
  const added = out.bidders[2];
  assert.equal(out.activeBidderId, added.id);
  assert.equal(added.name, 'ج');
  assert.deepEqual(added.items.map(i => i.quantity), [10, 5, 2]);
  assert.deepEqual(added.items.map(i => i.estimatedTotal), [1000, 500, 200]);
});

test('estimated_only: مطابقة برقم الفقرة، المفقودة تُبقي تخمينها وأسعار المجهزين لا تُمس', () => {
  const out = run(mkProject(), [
    { itemNo: 1, description: 'أ', quantity: 10, estimatedTotal: 2000 },
    { itemNo: 3, description: 'ج', quantity: 2, estimatedTotal: 300 }
  ], 'estimated_only');
  assert.ok(out);
  for (const b of out.bidders) assert.deepEqual(b.items.map(i => i.estimatedTotal), [2000, 500, 300]);
  assert.deepEqual(out.bidders[0].items.map(i => i.bidderTotal), [1000, 500, 200]);
  assert.deepEqual(out.bidders[1].items.map(i => i.bidderTotal), [900, 450, 180]);
});

test('bidder_only: يُبقي التخميني وكمية الجدول ويحفظ unreasonablePrice', () => {
  const mark = { note: 'غير معقول', markedAt: '2026-01-01T00:00:00.000Z' };
  const a = mkBidder('A', 'أ', [1000, 500, 200], r => { r[0].unreasonablePrice = mark; });
  const out = run(mkProject(a), [
    { itemNo: 1, quantity: 77, estimatedTotal: 9999, bidderTotal: 1100, enteredBidderTotal: 1100 },
    { itemNo: 2, quantity: 77, estimatedTotal: 9999, bidderTotal: 550, enteredBidderTotal: 550 },
    { itemNo: 3, quantity: 77, estimatedTotal: 9999, bidderTotal: 220, enteredBidderTotal: 220 }
  ], 'bidder_only');
  assert.ok(out);
  const items = out.bidders[0].items;
  assert.deepEqual(items.map(i => i.bidderTotal), [1100, 550, 220]);
  assert.deepEqual(items.map(i => i.estimatedTotal), [1000, 500, 200]);
  assert.deepEqual(items.map(i => i.quantity), [10, 5, 2]);
  assert.deepEqual(items[0].unreasonablePrice, mark);
});

test('full_replace: يوحّد الهوية لدى بقية المجهزين', () => {
  const out = run(mkProject(), [
    { itemNo: 1, description: 'جديد', unit: 'طن', quantity: 4, estimatedTotal: 400, bidderTotal: 420 },
    { itemNo: 2, description: 'ب', unit: 'م', quantity: 5, estimatedTotal: 500, bidderTotal: 500 }
  ], 'full_replace');
  assert.ok(out);
  assert.equal(out.bidders[0].items.length, 2);
  const other = out.bidders[1];
  assert.equal(other.items.length, 2);
  assert.equal(other.items[0].description, 'جديد');
  assert.equal(other.items[0].unit, 'طن');
  assert.equal(other.items[0].quantity, 4);
  assert.equal(other.items[0].estimatedTotal, 400);
  // سعر المجهز الآخر الخاص يبقى
  assert.equal(other.items[0].bidderTotal, 900);
});

test('يرفض الاستيراد حين يكون عرض موزون فعّالاً: لا حفظ', () => {
  const p = mkProject();
  p.bidders[0] = { ...p.bidders[0], weightedOffer: { status: 'active', origin: 'corrected', startedAt: '2026-01-01T00:00:00.000Z', bidTotal: 1700 } };
  alerts.length = 0;
  const out = run(p, [{ itemNo: 1, estimatedTotal: 5 }], 'estimated_only');
  assert.equal(out, undefined);
  assert.equal(alerts.length, 1);
});

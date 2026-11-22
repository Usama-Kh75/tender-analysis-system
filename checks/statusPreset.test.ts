// تعبئة نموذج الموقف باسم الفائز (src/utils/statusPreset.ts): عرض فقط
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateBOQMetrics } from '../src/utils/calculations';
import { createNewTenderProject } from '../src/utils/storageService';
import { chosenWinnerName } from '../src/utils/statusPreset';
import type { Bidder, BOQItem, TenderProject } from '../src/types/tender';

const mkBidder = (id: string, name: string, total: number, status: Bidder['status'] = 'pending'): Bidder => {
  const each = total / 10;
  const rows: Partial<BOQItem>[] = Array.from({ length: 10 }, (_, i) => ({
    itemNo: i + 1, description: `فقرة ${i + 1}`, unit: 'عدد', quantity: 1, estimatedTotal: 100,
    enteredUnitPrice: each, enteredBidderTotal: each, bidderTotal: each
  }));
  const c = calculateBOQMetrics(rows, 20);
  return { id, name, submissionDate: '2026-01-01', items: c.items, totals: c.totals, status };
};
const mk = (bidders: Bidder[]): TenderProject => ({
  ...createNewTenderProject({ title: 'ت', referenceNumber: '1', contractType: 'works', budgetType: 'operating', bidderNames: ['x'] }),
  deviationThreshold: 20, currency: 'د.ع', bidders, activeBidderId: bidders[0].id
});

test('بلا اختيار من اللجنة لا اسم', () => {
  assert.equal(chosenWinnerName(mk([mkBidder('A', 'أ', 1000), mkBidder('B', 'ب', 1100)])), null);
});

test('اختيار اللجنة يعطي اسم الفائز', () => {
  assert.equal(chosenWinnerName(mk([mkBidder('A', 'أ', 1000), mkBidder('B', 'ب', 1100, 'recommended')])), 'ب');
});

test('اسم بمسافات يُقصّ، والاسم الفارغ يعطي null', () => {
  assert.equal(chosenWinnerName(mk([mkBidder('A', 'أ', 1000), mkBidder('B', '  شركة النور  ', 1100, 'recommended')])), 'شركة النور');
  assert.equal(chosenWinnerName(mk([mkBidder('A', 'أ', 1000), mkBidder('B', '   ', 1100, 'recommended')])), null);
});

test('تعادل قبل الاختيار لا اسم', () => {
  assert.equal(chosenWinnerName(mk([mkBidder('A', 'أ', 1000), mkBidder('B', 'ب', 1000)])), null);
});

test('بلا كلفة تخمينية لا اسم', () => {
  const p = mk([mkBidder('A', 'أ', 1000, 'recommended'), mkBidder('B', 'ب', 1100)]);
  const noEst: TenderProject = {
    ...p,
    bidders: p.bidders.map(b => ({ ...b, items: b.items.map(i => ({ ...i, estimatedTotal: 0 })), totals: { ...b.totals, totalEstimatedAmount: 0 } }))
  };
  assert.equal(chosenWinnerName(noEst), null);
});

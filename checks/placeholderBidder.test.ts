// المجهز الحامل «شركة جديدة» (src/utils/placeholderBidder.ts): أول مجهز يُضاف يحلّ محله إن لم يُمسّ (أسامة 2026-11-28)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateBOQMetrics } from '../src/utils/calculations';
import { createNewTenderProject } from '../src/utils/storageService';
import { createEditContext } from '../src/app/editContext';
import { createImportHandlers } from '../src/app/importHandlers';
import { createBidderHandlers } from '../src/app/bidderHandlers';
import { isPlaceholderBidder, addOrReplacePlaceholder, PLACEHOLDER_BIDDER_NAME } from '../src/utils/placeholderBidder';
import { Bidder, BOQItem, TenderProject } from '../src/types/tender';

(globalThis as any).window = { alert: () => {}, confirm: () => true };

const blankProject = (names: string[] = []): TenderProject =>
  createNewTenderProject({ title: 'ت', referenceNumber: '1', contractType: 'works', budgetType: 'operating', receivedBidsCount: 4, bidderNames: names });

const priced = (id: string, name: string): Bidder => {
  const c = calculateBOQMetrics([{ itemNo: 1, description: 'أ', quantity: 1, estimatedTotal: 100, bidderTotal: 90 }], 20);
  return { id, name, submissionDate: '2026-01-01', items: c.items, totals: c.totals, status: 'pending' };
};

const capture = (project: TenderProject) => {
  let saved: TenderProject | undefined;
  const ctx = createEditContext(project, project.bidders[0], (fn: any) => { saved = fn([project])[0]; });
  return { ctx, get: () => saved };
};

test('مناقصة بلا أسماء: المجهز الوحيد حامل', () => {
  const p = blankProject();
  assert.equal(p.bidders.length, 1);
  assert.equal(p.bidders[0].name, PLACEHOLDER_BIDDER_NAME);
  assert.ok(isPlaceholderBidder(p, p.bidders[0]));
});

test('لا يُعدّ حاملاً إن مُسّ: اسم آخر، مبالغ، استبعاد، نفاذية، مبادرات', () => {
  const p = blankProject();
  const b = p.bidders[0];
  assert.equal(isPlaceholderBidder(p, { ...b, name: 'شركة النور' }), false);
  assert.equal(isPlaceholderBidder(p, { ...priced(b.id, PLACEHOLDER_BIDDER_NAME) }), false);
  assert.equal(isPlaceholderBidder(p, { ...b, status: 'disqualified' }), false);
  assert.equal(isPlaceholderBidder(p, { ...b, exclusionReasons: [{ ground: 'bidBond' }] as any }), false);
  assert.equal(isPlaceholderBidder(p, { ...b, validityDays: 90 }), false);
  assert.equal(isPlaceholderBidder({ ...p, preferenceInitiatives: [{ bidderId: b.id, hasInitiative: false, items: [] }] }, b), false);
});

test('addOrReplacePlaceholder: يحلّ محل الحامل في موضعه، ويضيف إن لم يوجد حامل', () => {
  const p = blankProject();
  const n = priced('N', 'ج');
  const r1 = addOrReplacePlaceholder(p, p.bidders, n);
  assert.deepEqual(r1.bidders.map(b => b.id), ['N']);
  assert.equal(r1.replaced, PLACEHOLDER_BIDDER_NAME);
  const q = { ...p, bidders: [priced('A', 'أ')] };
  const r2 = addOrReplacePlaceholder(q, q.bidders, n);
  assert.deepEqual(r2.bidders.map(b => b.id), ['A', 'N']);
  assert.equal(r2.replaced, undefined);
});

test('«+ مجهز» في مناقصة بلا أسماء: لا يبقى الحامل، ويحمل المجهز الكشف التخميني', () => {
  const base = blankProject();
  const est = calculateBOQMetrics([{ itemNo: 1, description: 'أ', quantity: 2, estimatedTotal: 500, bidderTotal: 0 }], 20);
  const p = { ...base, bidders: [{ ...base.bidders[0], items: est.items, totals: est.totals }] };
  const { ctx, get } = capture(p);
  createBidderHandlers(ctx, { closeSettings: () => {} }).handleAddNewBidder('شركة النور');
  const out = get()!;
  assert.deepEqual(out.bidders.map(b => b.name), ['شركة النور']);
  assert.equal(out.activeBidderId, out.bidders[0].id);
  assert.equal(out.bidders[0].items[0].estimatedTotal, 500);
  assert.match(out.auditLogs[0].details, /في موضع المجهز الفارغ/);
});

test('استيراد مجهز جديد ثم ثانٍ: مجهزان لا ثلاثة', () => {
  const rows: Partial<BOQItem>[] = [{ itemNo: 1, description: 'أ', quantity: 1, enteredUnitPrice: 90, enteredBidderTotal: 90, bidderTotal: 90 }];
  const first = capture(blankProject());
  createImportHandlers(first.ctx).handleApplyExtractedItems(rows, 'new_bidder', 'أ');
  const p1 = first.get()!;
  assert.deepEqual(p1.bidders.map(b => b.name), ['أ']);
  const second = capture(p1);
  createImportHandlers(second.ctx).handleApplyExtractedItems(rows, 'new_bidder', 'ب');
  assert.deepEqual(second.get()!.bidders.map(b => b.name), ['أ', 'ب']);
});

test('الإدخال اليدوي لمجهز جديد يحلّ محل الحامل أيضاً', () => {
  const { ctx, get } = capture(blankProject());
  createImportHandlers(ctx).handleApplyExtractedItems([{ itemNo: 1, quantity: 1, enteredBidderTotal: 50, bidderTotal: 50 }], 'new_bidder', 'يدوي', undefined, 'manual');
  assert.deepEqual(get()!.bidders.map(b => b.name), ['يدوي']);
});

test('مناقصة بأسماء: لا حامل، فالإضافة تبقى إضافة', () => {
  const { ctx, get } = capture(blankProject(['أ', 'ب']));
  createBidderHandlers(ctx, { closeSettings: () => {} }).handleAddNewBidder('ج');
  assert.deepEqual(get()!.bidders.map(b => b.name), ['أ', 'ب', 'ج']);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateBOQMetrics } from '../src/utils/calculations';
import {
  isOfferLocked, startOfferBlocker, offerFieldsFromCorrected, offerFieldsFromFormula, offerUnitPatch,
  isOfferEdited, offerStatus, offerLockReason
} from '../src/utils/weightedOffer';
import type { Bidder, BOQItem, TenderProject, WeightedOfferState } from '../src/types/tender';

const bidder = (raw: Partial<BOQItem>[], extra: Partial<Bidder> = {}): Bidder => {
  const { items, totals } = calculateBOQMetrics(raw, 20);
  return { id: 'b1', name: 'شركة أ', submissionDate: '2026-10-10', items, totals, status: 'pending', ...extra };
};
const base: Partial<BOQItem>[] = [
  { itemNo: 1, description: 'أ', quantity: 2, estimatedTotal: 1000, bidderTotal: 1100, enteredUnitPrice: 550, enteredBidderTotal: 1100 },
  { itemNo: 2, description: 'ب', quantity: 1, estimatedTotal: 500, bidderTotal: 480, enteredUnitPrice: 480, enteredBidderTotal: 480 }
];
const offer = (o: Partial<WeightedOfferState>): WeightedOfferState =>
  ({ status: 'active', origin: 'corrected', startedAt: '2026-10-10', bidTotal: 1580, ...o });

test('موانع البدء: بلا تخميني، منحرف كلياً، ملاحظات معلقة', () => {
  assert.equal(startOfferBlocker(bidder(base), 20), null);
  assert.match(startOfferBlocker(bidder(base.map(i => ({ ...i, estimatedTotal: 0 }))), 20)!, /التخمينية/);
  assert.match(startOfferBlocker(bidder(base.map(i => ({ ...i, bidderTotal: (i.bidderTotal || 0) * 2, enteredBidderTotal: (i.bidderTotal || 0) * 2 }))), 20)!, /منحرف/);
  assert.match(startOfferBlocker(bidder([{ ...base[0], hasMathError: true }, base[1]]), 20)!, /بانتظار قرار اللجنة/);
});

test('البدء من أسعار العطاء يطابق المبلغ، وبالمعادلة يساوي الأسعار الموزونة', () => {
  const b = bidder(base);
  assert.deepEqual(offerFieldsFromCorrected(b.items), [{ offerUnitPrice: 550, offerTotal: 1100 }, { offerUnitPrice: 480, offerTotal: 480 }]);
  const f = offerFieldsFromFormula(b.items);
  assert.equal(f.reduce((s, x) => s + (x.offerTotal || 0), 0), b.totals.totalBidderAmount);
});

test('تعديل المفرد: المبلغ = الكمية × المفرد مقرّباً', () => {
  const b = bidder(base);
  assert.deepEqual(offerUnitPatch(b.items[0], 333.335), { offerUnitPrice: 333.335, offerTotal: 666.67 });
});

test('حالة العرض: الفرق والمعدّل والمؤشر غير المعدّل والقدم', () => {
  const b = bidder([{ ...base[0], offerUnitPrice: 600, offerTotal: 1200 }, { ...base[1], offerUnitPrice: 480, offerTotal: 480,
    unreasonablePrice: { note: 'س', markedAt: 'x' } }], { weightedOffer: offer({}) });
  const s = offerStatus(b)!;
  assert.equal(s.offerSum, 1680);
  assert.equal(s.diff, 100);
  assert.equal(s.editedCount, 1);
  assert.equal(s.markedNotEdited, 1);
  assert.equal(s.stale, false);
  assert.equal(s.canAdopt, false);
  assert.ok(isOfferEdited(b.items[0]));
  const balanced = bidder([{ ...base[0], offerUnitPrice: 500, offerTotal: 1000 }, { ...base[1], offerUnitPrice: 580, offerTotal: 580 }], { weightedOffer: offer({}) });
  assert.equal(offerStatus(balanced)!.canAdopt, true);
  const stale = bidder(base, { weightedOffer: offer({ bidTotal: 9999 }) });
  assert.equal(offerStatus(stale)!.stale, true);
  assert.equal(offerStatus(bidder(base)), null);
});

test('القفل: العرض الفعّال أو المعتمد يقفل عطاءه والتعديلات المشتركة، والموقوف لا يقفل', () => {
  const a = bidder(base, { id: 'a', name: 'أ', weightedOffer: offer({ status: 'adopted' }) });
  const c = bidder(base, { id: 'c', name: 'ج' });
  const project = { bidders: [a, c] } as TenderProject;
  assert.ok(isOfferLocked(a));
  assert.match(offerLockReason(project, { bidderId: 'a' })!, /أ/);
  assert.equal(offerLockReason(project, { bidderId: 'c' }), null);
  assert.match(offerLockReason(project, { bidderId: 'c', shared: true })!, /مشترك/);
  const paused = { bidders: [bidder(base, { weightedOffer: offer({ status: 'paused' }) })] } as TenderProject;
  assert.equal(offerLockReason(paused, { shared: true }), null);
});

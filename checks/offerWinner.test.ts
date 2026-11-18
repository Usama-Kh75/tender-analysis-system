import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateBOQMetrics } from '../src/utils/calculations';
import { buildRecommendation, offerWinner } from '../src/utils/recommendation';
import type { Bidder, TenderProject } from '../src/types/tender';

const proj = (bidders: Bidder[]): TenderProject => ({
  id: 'p', title: 'مناقصة', referenceNumber: '5 / 26 / 100', deviationThreshold: 20, currency: 'IQD', bidders, auditLogs: []
} as unknown as TenderProject);

// الكلفة التخمينية 1000 للفقرة الواحدة
const mkAmount = (id: string, name: string, amount: number, extra: Partial<Bidder> = {}): Bidder => {
  const { items, totals } = calculateBOQMetrics(
    [{ itemNo: 1, description: 'أ', quantity: 1, estimatedTotal: 1000, bidderTotal: amount, enteredUnitPrice: amount, enteredBidderTotal: amount }], 20);
  return { id, name, submissionDate: '2026-10-10', items, totals, status: 'pending', ...extra };
};

test('الفائز: الأقل سعراً بين المؤهلين', () => {
  const p = proj([mkAmount('a', 'أ', 900), mkAmount('b', 'ب', 1000)]);
  assert.equal(buildRecommendation(p).kind, 'award');
  assert.equal(offerWinner(p)?.id, 'a');
});

test('الفائز: اختيار اللجنة يغلب الأقل سعراً', () => {
  const p = proj([mkAmount('a', 'أ', 900), mkAmount('b', 'ب', 1000, { status: 'recommended' })]);
  assert.equal(buildRecommendation(p).kind, 'award');
  assert.equal(offerWinner(p)?.id, 'b');
});

test('لا فائز عند تقارب العطاءات قبل اختيار اللجنة', () => {
  const p = proj([mkAmount('a', 'أ', 900), mkAmount('b', 'ب', 905)]);
  assert.equal(buildRecommendation(p).kind, 'tie');
  assert.equal(offerWinner(p), undefined);
});

test('لا فائز عند الإحالة (عطاء وحيد بانحراف +30%)', () => {
  const p = proj([mkAmount('a', 'أ', 1300)]);
  assert.equal(buildRecommendation(p).kind, 'referral');
  assert.equal(offerWinner(p), undefined);
});

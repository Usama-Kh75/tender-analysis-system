import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eligibilityCounts } from '../src/utils/recommendation';
import { bidCountsLabel } from '../src/utils/tenderDetails';
import type { TenderProject } from '../src/types/tender';

const bidder = (amount: number, dev: number, status = 'submitted') =>
  ({ id: `b${amount}${dev}`, status, totals: { totalBidderAmount: amount, totalEstimatedAmount: amount ? 100 : 100, totalDeviationPercent: dev } });
const proj = (bidders: unknown[], extra: object = {}) =>
  ({ deviationThreshold: 20, bidders, ...extra }) as unknown as TenderProject;

test('أعداد المؤهلة وغير المؤهلة (بطاقتا الملخص) تشمل مستبعد اللجنة والمتجاوز للحد، وتُهمل الشركة بلا مبالغ', () => {
  const p = proj([bidder(100, 5), bidder(110, 8), bidder(150, 50), bidder(90, 1, 'disqualified'), bidder(0, 0)], { receivedBidsCount: 6 });
  assert.deepEqual(eligibilityCounts(p), { analyzed: 4, eligible: 2, excluded: 2 });
});

test('ملصق الرأس: المستلمة والمحلَّلة تجارياً وما لم يُحلَّل (بلا سبب مسجَّل)، بلا مؤهلة/غير مؤهلة', () => {
  const p = proj([bidder(100, 5), bidder(110, 8), bidder(150, 50), bidder(90, 1, 'disqualified'), bidder(0, 0)], { receivedBidsCount: 6 });
  assert.equal(bidCountsLabel(p), 'العطاءات: 6 مستلمة · 4 محلَّلة تجارياً · 2 لم يُسجَّل سببه');
});

test('المستلمة تُحذف إن لم تُدخل، وما لم يُحلَّل يُحذف عند التساوي', () => {
  assert.equal(bidCountsLabel(proj([bidder(100, 5), bidder(110, 8)])), 'العطاءات: 2 محلَّلة تجارياً');
  assert.equal(bidCountsLabel(proj([bidder(100, 5), bidder(110, 8)], { receivedBidsCount: 2 })), 'العطاءات: 2 مستلمة · 2 محلَّلة تجارياً');
});

test('قبل الكلفة التخمينية: الأهلية غير معروفة، والملصق يعدّ المحلَّلة وحدها', () => {
  const b = { ...bidder(100, 0), totals: { totalBidderAmount: 100, totalEstimatedAmount: 0, totalDeviationPercent: 0 } };
  const p = proj([b]);
  assert.equal(eligibilityCounts(p), null);
  assert.equal(bidCountsLabel(p), 'العطاءات: 1 محلَّلة تجارياً');
});

test('ملصق الرأس: المستبعد قبل التحليل (مستبعد بلا مبالغ) يُسمّى، وما بقي من الفرق «لم يُسجَّل سببه»', () => {
  const noAmounts = (status: string) => ({ ...bidder(0, 0), id: `x${status}`, status });
  const one = proj([bidder(100, 5), bidder(110, 8), noAmounts('disqualified')], { receivedBidsCount: 3 });
  assert.equal(bidCountsLabel(one), 'العطاءات: 3 مستلمة · 2 محلَّلة تجارياً · 1 استُبعدت قبل التحليل');
  const two = proj([bidder(100, 5), bidder(110, 8), noAmounts('disqualified')], { receivedBidsCount: 5 });
  assert.equal(bidCountsLabel(two), 'العطاءات: 5 مستلمة · 2 محلَّلة تجارياً · 1 استُبعدت قبل التحليل · 2 لم يُسجَّل سببه');
  // مستبعد بلا مبالغ أكثر من الفرق لا يزيد على الفرق
  const capped = proj([bidder(100, 5), noAmounts('disqualified'), { ...noAmounts('disqualified'), id: 'y' }], { receivedBidsCount: 2 });
  assert.equal(bidCountsLabel(capped), 'العطاءات: 2 مستلمة · 1 محلَّلة تجارياً · 1 استُبعدت قبل التحليل');
});

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

test('ملصق الرأس: المستلمة والمحلَّلة تجارياً وما لم يُحلَّل لنقص جوهري، بلا مؤهلة/غير مؤهلة', () => {
  const p = proj([bidder(100, 5), bidder(110, 8), bidder(150, 50), bidder(90, 1, 'disqualified'), bidder(0, 0)], { receivedBidsCount: 6 });
  assert.equal(bidCountsLabel(p), 'العطاءات: 6 مستلمة · 4 محلَّلة تجارياً · 2 لم تُحلَّل لنقص جوهري');
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

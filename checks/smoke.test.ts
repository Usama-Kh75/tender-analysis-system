import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateBOQMetrics } from '../src/utils/calculations';

test('calculateBOQMetrics يجمع مبلغ المجهز', () => {
  const { totals } = calculateBOQMetrics([
    { itemNo: 1, description: 'أ', quantity: 2, estimatedTotal: 100, bidderTotal: 110 },
    { itemNo: 2, description: 'ب', quantity: 1, estimatedTotal: 50, bidderTotal: 40 }
  ], 20);
  assert.equal(totals.totalBidderAmount, 150);
});

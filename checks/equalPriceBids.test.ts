import { test } from 'node:test';
import assert from 'node:assert/strict';
import { equalPriceBids } from '../src/utils/recommendation';
import type { Bidder } from '../src/types/tender';

const bids = (amounts: number[]): Bidder[] =>
  amounts.map((a, i) => ({ id: `b${i}`, name: `شركة ${i + 1}`, totals: { totalBidderAmount: a } }) as unknown as Bidder);
const names = (amounts: number[]) => equalPriceBids(bids(amounts)).map(b => b.name);

test('العطاءات المتساوية لأصغر فئة نقدية بين المتقاربة', () => {
  assert.deepEqual(names([100, 100, 99.5]), ['شركة 1', 'شركة 2']);
  assert.deepEqual(names([100, 100.005]), ['شركة 1', 'شركة 2']);
  assert.deepEqual(names([100, 99.5]), []);
  assert.deepEqual(names([100, 100, 100]), ['شركة 1', 'شركة 2', 'شركة 3']);
});

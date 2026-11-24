import test from 'node:test';
import assert from 'node:assert/strict';
import { weightedSheetRows } from '../src/utils/weightedSheetRows';
import type { Bidder } from '../src/types/tender';

const item = (o: Record<string, unknown>) => ({ id: 'i', quantity: 2, estimatedTotal: 100, bidderTotal: 90, newPrice: 80, weightedUnitPrice: 40, ...o });
const bidder = (items: unknown[]) => ({ items } as unknown as Bidder);

test('formula: المصدر newPrice والفقرة بلا تخميني شرطة وخارج المجموع', () => {
  const r = weightedSheetRows(bidder([item({}), item({ id: 'j', estimatedTotal: 0, newPrice: 5, weightedUnitPrice: 5 })]), 'formula');
  assert.equal(r.rows[0].unit, 40);
  assert.equal(r.rows[0].total, 80);
  assert.equal(r.rows[1].dash, true);
  assert.equal(r.sum, 80);
});

test('offer: مفرد العرض ومبلغه، وبدونهما مبلغ العطاء ÷ الكمية', () => {
  const r = weightedSheetRows(bidder([item({ offerUnitPrice: 50, offerTotal: 100 }), item({ id: 'j' })]), 'offer');
  assert.equal(r.rows[0].unit, 50);
  assert.equal(r.rows[1].unit, 45);
  assert.equal(r.rows[1].total, 90);
  assert.equal(r.sum, 190);
});

test('offer: غير مسعّرة بلا سعر شرطة لكنها تدخل المجموع كما في ورقة Excel', () => {
  const r = weightedSheetRows(bidder([item({ unpriced: true, bidderTotal: 0 })]), 'offer');
  assert.equal(r.rows[0].dash, true);
  assert.equal(r.sum, 0);
});

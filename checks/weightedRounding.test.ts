import { test } from 'node:test';
import assert from 'node:assert/strict';
import { settleWeightedPrices } from '../src/utils/weightedRounding';
import { calculateBOQMetrics } from '../src/utils/calculations';

const cents = (v: number) => Math.round(v * 100);

test('النسبة 1: الأسعار الموزونة هي التخمينية بلا تسوية', () => {
  const r = settleWeightedPrices([{ quantity: 1, estimatedTotal: 100 }, { quantity: 2, estimatedTotal: 200 }], 1, 300);
  assert.deepEqual(r.rows.map(x => x.amount), [100, 200]);
  assert.deepEqual(r.rows.map(x => x.unitPrice), [100, 100]);
  assert.equal(r.residual, 0);
  assert.ok(r.rows.every(x => x.adjustment === 0));
});

test('فلس باقٍ يُحمَّل على فقرة كميتها 1', () => {
  const ratio = 1000 / 300;
  const r = settleWeightedPrices(
    [{ quantity: 3, estimatedTotal: 100 }, { quantity: 1, estimatedTotal: 100 }, { quantity: 3, estimatedTotal: 100 }], ratio, 1000);
  assert.equal(r.total, 1000);
  assert.equal(r.residual, 0);
  assert.deepEqual(r.rows.map(x => x.adjustment), [0, 0.01, 0]);
  assert.equal(r.rows[1].amount, 333.34);
});

test('فرق لا تغلقه الكميات يبقى ظاهراً', () => {
  const r = settleWeightedPrices([{ quantity: 3, estimatedTotal: 100 }, { quantity: 3, estimatedTotal: 100 }, { quantity: 3, estimatedTotal: 100 }], 1000 / 300, 1000);
  assert.equal(r.total, 999.99);
  assert.equal(r.residual, 0.01);
  assert.ok(r.rows.every(x => x.adjustment === 0));
});

test('فقرة تخمينيها صفر لا تُسعَّر ولا تُحرَّك، والنسبة صفر لا تسوية', () => {
  const r = settleWeightedPrices([{ quantity: 1, estimatedTotal: 0 }, { quantity: 1, estimatedTotal: 100 }], 1.5, 150);
  assert.deepEqual(r.rows[0], { unitPrice: 0, amount: 0, adjustment: 0 });
  const z = settleWeightedPrices([{ quantity: 1, estimatedTotal: 100 }], 0, 0);
  assert.equal(z.residual, 0);
  assert.equal(z.total, 0);
});

test('جدول كبير بكميات كبيرة وفقرة واحدة كميتها 1: يُغلق الفرق، والمبلغ = الكمية × المفرد في كل فقرة', () => {
  const items = Array.from({ length: 120 }, (_, k) => ({
    quantity: k === 57 ? 1 : 7 + ((k * 37) % 1650),
    estimatedTotal: 1000 + ((k * 7919) % 900000)
  }));
  const est = items.reduce((s, i) => s + i.estimatedTotal, 0);
  const target = 1234567890.12;
  const r = settleWeightedPrices(items, target / est, target);
  assert.equal(r.residual, 0);
  assert.equal(cents(r.total), cents(target));
  r.rows.forEach((row, k) => assert.equal(cents(row.amount), Math.round(items[k].quantity * cents(row.unitPrice))));
});

test('جدول كمياته كلها كبيرة: الباقي أصغر من أصغر أثر ممكن', () => {
  const items = Array.from({ length: 40 }, (_, k) => ({ quantity: 1650 + k * 10, estimatedTotal: 7425000 + k * 1000 }));
  const est = items.reduce((s, i) => s + i.estimatedTotal, 0);
  const target = 312345678.9;
  const r = settleWeightedPrices(items, target / est, target);
  assert.ok(Math.abs(cents(r.residual)) < 1650);
  assert.equal(cents(r.total) + cents(r.residual), cents(target));
});

test('calculateBOQMetrics: مجموع الأسعار الموزونة = مبلغ العطاء، والحقول الجديدة تبقى', () => {
  const { items, totals } = calculateBOQMetrics([
    { itemNo: 1, description: 'أ', quantity: 3, estimatedTotal: 100, bidderTotal: 400, pageNo: 1, offerUnitPrice: 130, offerTotal: 390,
      unreasonablePrice: { note: 'ملاحظة', markedAt: '2026-10-10' } },
    { itemNo: 2, description: 'ب', quantity: 1, estimatedTotal: 100, bidderTotal: 300, pageNo: 2 },
    { itemNo: 3, description: 'ج', quantity: 3, estimatedTotal: 100, bidderTotal: 300, pageNo: 2 }
  ], 20);
  assert.equal(totals.newPricesTotal, totals.totalBidderAmount);
  assert.equal(totals.weightedRoundingResidual, 0);
  assert.equal(items[0].pageNo, 1);
  assert.equal(items[0].offerTotal, 390);
  assert.equal(items[0].offerUnitPrice, 130);
  assert.equal(items[0].unreasonablePrice?.note, 'ملاحظة');
  assert.equal(items[1].weightedAdjustment, 0.01);
  assert.equal(items[0].weightedAdjustment, undefined);
});

test('فرق كبير تمتصه فقرة كميتها 1 يُغلق ولو تجاوز عدد الجولات', () => {
  const r = settleWeightedPrices([{ quantity: 10000, estimatedTotal: 50 }, { quantity: 1, estimatedTotal: 100 }], 1, 150);
  assert.equal(r.residual, 0);
  assert.equal(r.total, 150);
  r.rows.forEach((row, k) => assert.equal(cents(row.amount), Math.round([10000, 1][k] * cents(row.unitPrice))));
});

test("كمية كسرية: الباقي يُغلق بخطوة أكبر مما يقدّره الحد الأدنى", () => {
  const r = settleWeightedPrices([{ quantity: 0.6, estimatedTotal: 0.006 }], 1, 0.11);
  assert.equal(r.residual, 0);
  assert.equal(r.total, 0.11);
});

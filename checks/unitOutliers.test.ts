import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNewTenderProject } from '../src/utils/storageService';
import { calculateBOQMetrics } from '../src/utils/calculations';
import { unitPriceOutliers } from '../src/utils/unitOutliers';

const make = (prices: number[][]) => {
  const p = createNewTenderProject({ title: 'اختبار', referenceNumber: '1', contractType: 'supply', budgetType: 'operating', bidderNames: prices.map((_, i) => `م${i}`) });
  p.bidders = p.bidders.map((b, i) => ({ ...b, ...calculateBOQMetrics(prices[i].map((price, j) => ({
    id: `${i}-${j}`, itemNo: j + 1, quantity: 1, enteredUnitPrice: price, bidderTotal: price
  })), 20) }));
  return p;
};

test('المفرد الشاذ: مجهزان فقط لا يكفيان', () => {
  assert.deepEqual(unitPriceOutliers(make([[1000], [100]])), []);
});

test('المفرد الشاذ: عشرة أضعاف وسيط الآخرين دون تغيير المشروع', () => {
  const p = make([[1000], [90], [110]]);
  const before = structuredClone(p);
  assert.deepEqual(unitPriceOutliers(p), [{ bidderId: p.bidders[0].id, itemId: '0-0', itemNo: 1, unitPrice: 1000, reference: 100, factor: 10, direction: 'high' }]);
  assert.deepEqual(p, before);
});

test('المفرد الشاذ: القسمة على مئة', () => {
  const r = unitPriceOutliers(make([[1], [100], [100]]));
  assert.equal(r.length, 1);
  assert.equal(r[0].direction, 'low');
  assert.equal(r[0].factor, 0.01);
});

test('المفرد الشاذ: فرق ثلاثين بالمئة طبيعي', () => {
  assert.deepEqual(unitPriceOutliers(make([[130], [100], [100]])), []);
});

test('المفرد الشاذ: غير المسعرة لا تكون مرجعاً ولا شاذاً', () => {
  for (const index of [0, 1]) {
    const p = make([[1000], [100], [100]]);
    p.bidders[index].items[0].unpriced = true;
    assert.deepEqual(unitPriceOutliers(p), []);
  }
});

test('المفرد الشاذ: اختلاف رقم الفقرة في الموضع نفسه يُهمل', () => {
  const p = make([[1000], [100], [100]]);
  p.bidders[1].items[0].itemNo = 2;
  assert.deepEqual(unitPriceOutliers(p), []);
});

test('المفرد الشاذ: فقرتان مختلفتان ومجهزان مختلفان', () => {
  const p = make([[1000, 100], [100, 1], [100, 100]]);
  assert.deepEqual(unitPriceOutliers(p).map(r => [r.itemId, r.direction]), [['0-0', 'high'], ['1-1', 'low']]);
});

test('المفرد الشاذ: حدود السماح لكل أس عشري شاملة', () => {
  for (const power of [-3, -2, -1, 1, 2, 3]) {
    for (const margin of [0.85, 1, 1.15]) {
      const p = make([[100 * 10 ** power * margin], [100], [100]]);
      assert.ok(unitPriceOutliers(p).some(r => r.bidderId === p.bidders[0].id));
    }
    for (const margin of [0.849, 1.151]) {
      const p = make([[100 * 10 ** power * margin], [100], [100]]);
      assert.ok(!unitPriceOutliers(p).some(r => r.bidderId === p.bidders[0].id));
    }
  }
});

test('المفرد الشاذ: السعر المخزن فقط والصفر والسالب وغير المحدود تُهمل', () => {
  for (const price of [undefined, 0, -1, NaN, Infinity]) {
    const p = make([[1000], [100], [100]]);
    p.bidders[1].items[0].enteredUnitPrice = price;
    assert.deepEqual(unitPriceOutliers(p), []);
  }
});

test('المفرد الشاذ: لا بحث عن رقم الفقرة في موضع آخر', () => {
  const p = make([[1000, 100], [100, 100], [100, 100]]);
  p.bidders[2].items.reverse();
  assert.deepEqual(unitPriceOutliers(p), []);
});

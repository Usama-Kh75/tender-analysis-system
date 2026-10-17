import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateBOQMetrics } from '../src/utils/calculations';
import { offerItemView, offerFieldsFromFormula, assessBalance, offerBalanceRows, offerDeviationTotals } from '../src/utils/weightedOffer';
import type { BOQItem } from '../src/types/tender';

// عطاء مجموعه −20% بالضبط (على الحد) وفقراته منحرفة بالزيادة والنقصان: يلزم له الجدول الموزون
const raw: Partial<BOQItem>[] = [
  { itemNo: 1, description: 'أ', quantity: 1, estimatedTotal: 192_000_000, bidderTotal: 60_000_000, enteredUnitPrice: 60_000_000, enteredBidderTotal: 60_000_000 },
  { itemNo: 2, description: 'ب', quantity: 1, estimatedTotal: 8_640_000, bidderTotal: 70_000_000, enteredUnitPrice: 70_000_000, enteredBidderTotal: 70_000_000 },
  { itemNo: 3, description: 'ج', quantity: 1, estimatedTotal: 289_360_000, bidderTotal: 262_000_000, enteredUnitPrice: 262_000_000, enteredBidderTotal: 262_000_000 }
];

test('بلا عرض: الانحراف الأصلي كما هو', () => {
  const { items } = calculateBOQMetrics(raw, 20);
  assert.equal(items[0].isDeviated, true);
  assert.ok(items[0].deviationPercent < -68 && items[1].deviationPercent > 700);
});

test('عرض بالمعادلة: كل فقرة على −20% فلا منحرفة، وتطابق الشاشة شريط التوازن', () => {
  const { items } = calculateBOQMetrics(raw, 20);
  const offered = items.map((i, k) => ({ ...i, ...offerFieldsFromFormula(items)[k] }));
  const views = offered.map(i => offerItemView(i, 20));
  assert.equal(views.filter(v => v.isDeviated).length, 0);
  views.forEach(v => assert.ok(Math.abs(v.deviationPercent + 20) < 0.01, String(v.deviationPercent)));
  // الشاشة والشريط على القاعدة نفسها: لا فقرة منحرفة بالزيادة ولا بالنقصان
  const a = assessBalance(offerBalanceRows(offered), 20);
  assert.equal(a.unbalancedCount, 0);
  assert.equal(a.belowCount, 0);
  assert.equal(a.verdict, 'accept-as-is');
});

test('فقرة بلا offerTotal تُقاس على مبلغ المجهز، وتعديل مفرد يُعيد الانحراف', () => {
  const { items } = calculateBOQMetrics(raw, 20);
  const v = offerItemView(items[0], 20);
  assert.equal(v.amount, 60_000_000);
  assert.equal(v.isDeviated, true);
  const edited = offerItemView({ ...items[0], offerTotal: 300_000_000 }, 20);
  assert.equal(edited.isDeviated, true);
  assert.ok(edited.deviationPercent > 50);
  assert.equal(offerItemView({ ...items[0], estimatedTotal: 0 }, 20).deviationPercent, 0);
});

test('بطاقات المؤشرات: بلا عرض تطابق totals، وبالعرض تُحسب على مبالغه', () => {
  const { items, totals } = calculateBOQMetrics(raw, 20);
  // فقرات بلا offerTotal تُقاس على مبلغ المجهز فتطابق totals كما حسبها calculateBOQMetrics
  assert.deepEqual(offerDeviationTotals(items, 20), {
    partialDeviationPercent: totals.partialDeviationPercent,
    deviatedItemsSum: totals.deviatedItemsSum,
    deviatedItemsCount: totals.deviatedItemsCount
  });
  assert.equal(totals.deviatedItemsCount, 2);
  // بالمعادلة كل فقرة على −20% (على الحد) فلا منحرفة
  const offered = items.map((i, k) => ({ ...i, ...offerFieldsFromFormula(items)[k] }));
  assert.deepEqual(offerDeviationTotals(offered, 20), { partialDeviationPercent: 0, deviatedItemsSum: 0, deviatedItemsCount: 0 });
  // فقرة واحدة معدّلة فوق الحد: الفرق المطلق ÷ مجموع مبالغ العرض
  const one = offered.map((i, k) => (k === 1 ? { ...i, offerTotal: 17_280_000 } : i));
  const t = offerDeviationTotals(one, 20);
  assert.equal(t.deviatedItemsCount, 1);
  assert.equal(t.deviatedItemsSum, 8_640_000);
  const sum = one.reduce((s, i) => s + (i.offerTotal ?? i.bidderTotal), 0);
  assert.equal(t.partialDeviationPercent, Math.round((8_640_000 / sum) * 100 * 100) / 100);
});

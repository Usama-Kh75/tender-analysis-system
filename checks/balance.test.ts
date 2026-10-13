import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assessBalance, correctedBalanceRows, offerBalanceRows } from '../src/utils/weightedOffer';
import type { BOQItem } from '../src/types/tender';

// عشر فقرات تخمين كل منها 100؛ amounts تحدد مبلغ المجهز
const rows = (amounts: number[]) => amounts.map((amount, k) => ({ description: `مادة ${k + 1}`, estimatedTotal: 100, amount }));

test('فقرة واحدة منحرفة بالزيادة من عشر = 10% فيُقبل العطاء كما هو', () => {
  const a = assessBalance(rows([125, 100, 100, 100, 100, 100, 100, 100, 100, 95]), 20);
  assert.equal(a.unbalancedCount, 1);
  assert.equal(a.itemCount, 10);
  assert.equal(a.unbalancedPercent, 10);
  assert.equal(a.verdict, 'accept-as-is');
});

test('فقرتان منحرفتان بالزيادة من عشر = 20% فيلزم الموزون', () => {
  const a = assessBalance(rows([125, 125, 90, 90, 90, 100, 100, 100, 100, 100]), 20);
  assert.equal(a.unbalancedCount, 2);
  assert.equal(a.verdict, 'weighting-required');
});

test('المنحرفة بالنقصان تُعدّ منفصلة ولا تدخل في النسبة', () => {
  const a = assessBalance(rows([50, 50, 50, 130, 130, 130, 130, 130, 100, 100]), 20);
  assert.equal(a.belowCount, 3);
  assert.equal(a.unbalancedCount, 5);
  const b = assessBalance(rows([70, 70, 70, 110, 110, 110, 110, 110, 110, 110]), 20);
  assert.equal(b.belowCount, 3);
  assert.equal(b.unbalancedCount, 0);
  assert.equal(b.verdict, 'accept-as-is');
});

test('العطاء المنحرف بمبلغه الكلي مستبعد، وبلا تخميني بانتظار', () => {
  assert.equal(assessBalance(rows([200, 200, 200, 200, 200, 200, 200, 200, 200, 200]), 20).verdict, 'excluded');
  assert.equal(assessBalance([{ estimatedTotal: 0, amount: 100 }], 20).verdict, 'no-estimate');
});

test('صف فارغ («فقرة N» بلا مبالغ) لا يُعدّ في مجموع الفقرات', () => {
  const a = assessBalance([...rows([125, 100, 100, 100, 100, 100, 100, 100, 100, 95]), { description: 'فقرة 11', estimatedTotal: 0, amount: 0 }], 20);
  assert.equal(a.itemCount, 10);
});

test('صفوف الطبقتين: المصحح من bidderTotal، والعرض من offerTotal إن وُجد', () => {
  const items = [
    { description: 'أ', estimatedTotal: 100, bidderTotal: 130, offerTotal: 110 },
    { description: 'ب', estimatedTotal: 100, bidderTotal: 90 }
  ] as BOQItem[];
  assert.deepEqual(correctedBalanceRows(items).map(r => r.amount), [130, 90]);
  assert.deepEqual(offerBalanceRows(items).map(r => r.amount), [110, 90]);
});

test('الانحراف الكلي بدقته الكاملة: 10.004% عن حد 10% يُستبعد كما في isCommerciallyExcluded', () => {
  const a = assessBalance([{ description: 'مادة', estimatedTotal: 100000, amount: 110004 }], 10);
  assert.equal(a.verdict, 'excluded');
});

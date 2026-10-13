// الكمية 1 تُفحص كغيرها (v1.15.3): تجربة العطاءات الحقيقية 2026-10-14 أظهرت فقرتين مبلغهما 9,700 و6 أضعاف المفرد
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateBOQMetrics } from '../src/utils/calculations';
import { auditRowAmounts, auditBidderRows } from '../src/utils/bidderAuditEngine';

const flagsOf = (row: Record<string, unknown>) => calculateBOQMetrics([row as any], 20).items[0].hasMathError;

test('كمية 1 ومبلغ يساوي 6 أضعاف المفرد: خطأ ضرب', () => {
  assert.equal(flagsOf({ itemNo: '1.16', quantity: 1, enteredUnitPrice: 23000, bidderUnitPrice: 23000, enteredBidderTotal: 138000, bidderTotal: 138000 }), true);
  assert.equal(auditRowAmounts(1, 8750, 84875000).hasMathError, true);
});

test('كمية 1 والمفرد يساوي المبلغ: لا خطأ، وبلا مفرد مدون لا فحص', () => {
  assert.equal(flagsOf({ itemNo: 1, quantity: 1, enteredUnitPrice: 5000, bidderUnitPrice: 5000, enteredBidderTotal: 5000, bidderTotal: 5000 }), false);
  assert.equal(flagsOf({ itemNo: 2, quantity: 1, enteredBidderTotal: 7000, bidderTotal: 7000 }), false);
  assert.equal(auditRowAmounts(1, 0, 7000).hasMathError, false);
});

test('كمية 1 بفرق فلس واحد أو أقل لا يُؤشَّر', () => {
  assert.equal(auditRowAmounts(1, 100, 100.005).hasMathError, false);
});

test('تدقيق الجدول المستورد يشمل الكمية 1', () => {
  const report = auditBidderRows([{ itemNo: 1, description: 'أ', unitPrice: 23000, quantity: 1, enteredTotal: 138000 }]);
  assert.equal(report.rows[0].hasMathError, true);
});

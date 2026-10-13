// تفقيط فقرة صحّحتها اللجنة: لا يُوصف «مطابقاً» وقد تبدّلت أرقامها (ب/2 واعتماد حاصل الضرب)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateBOQMetrics } from '../src/utils/calculations';
import { committeeResolvedTextMismatch } from '../src/utils/bidderAuditEngine';
import type { BOQItem } from '../src/types/tender';

// الفقرة 277: مفرد 2,160، كمية 240، مبلغ 5,184,000، تفقيط المفرد
const row277: Partial<BOQItem> = {
  itemNo: '277', quantity: 240, estimatedTotal: 4320000,
  enteredUnitPrice: 2160, bidderUnitPrice: 2160, enteredBidderTotal: 5184000, bidderTotal: 5184000,
  writtenText: 'الفان ومائة وستون', hasMathError: true, hasTextDiscrepancy: false
};
const recalc = (patch: Partial<BOQItem>) => calculateBOQMetrics([{ ...row277, ...patch }], 20).items[0];

test('قبل قرار اللجنة: التفقيط يطابق المفرد المدون فلا تعارض معروض', () => {
  assert.equal(committeeResolvedTextMismatch(recalc({})), null);
});

test('بعد ب/2 (المفرد 21,600): التفقيط 2,160 لا يطابق المعتمد، والعلامة تبقى false', () => {
  const item = recalc({ originalUnitPrice: 2160, enteredUnitPrice: 21600, bidderUnitPrice: 21600, hasMathError: false });
  assert.equal(item.hasTextDiscrepancy, false);
  assert.deepEqual(committeeResolvedTextMismatch(item), { written: 2160, unit: 21600, total: 5184000 });
});

test('بعد اعتماد حاصل الضرب: تفقيط المبلغ المدون لا يطابق المعتمد 518,400', () => {
  const item = recalc({ writtenText: 'خمسة ملايين ومائة وأربعة وثمانون ألف', bidderTotal: 518400, hasMathError: false });
  assert.equal(item.hasTextDiscrepancy, false);
  const r = committeeResolvedTextMismatch(item);
  assert.ok(r && r.written === 5184000 && r.total === 518400);
});

test('فقرة لم تصحّحها اللجنة لا تدخل هذا الفحص ولو اختلفت الأرقام', () => {
  const item = recalc({ enteredUnitPrice: 2160, writtenText: 'الف ومائة', hasTextDiscrepancy: false, hasMathError: false });
  assert.equal(committeeResolvedTextMismatch(item), null);
});

test('فقرة بعلامة تعارض قائمة تبقى بطاقتها الكهرمانية لا هذه', () => {
  const item = recalc({ originalUnitPrice: 2160, enteredUnitPrice: 21600, hasTextDiscrepancy: true });
  assert.equal(committeeResolvedTextMismatch(item), null);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { attachPages, mapGeminiRow, mergeContinuationRows } from '../src/utils/ocrService';

test('رقم الصفحة داخل الدفعة يُحوَّل إلى رقمها في الملف', () => {
  const rows = attachPages([{ page: 1 }, { page: 3 }], 8, 3);
  assert.deepEqual(rows.map(r => r.__page), [9, 11]);
});

test('رقم خارج الدفعة أو غير صحيح لا يُسنَد', () => {
  const rows = attachPages([{ page: 0 }, { page: 4 }, { page: '2' }, { page: 1.5 }, {}], 0, 3);
  assert.deepEqual(rows.map(r => r.__page), [undefined, undefined, 2, undefined, undefined]);
});

test('الوصف الممتد يبقى على صفحة بدايته، والصف المحوّل يحمل pageNo', () => {
  const merged = mergeContinuationRows(attachPages([
    { itemNo: '5', description: 'أنبوب', quantity: 2, unitPrice: 10, total: 20, unpriced: false, page: 1 },
    { itemNo: null, description: 'تكملة', quantity: null, unitPrice: null, total: null, unpriced: false, page: 2 }
  ], 0, 2));
  assert.equal(merged.length, 1);
  assert.equal(mapGeminiRow(merged[0], 0).pageNo, 1);
  assert.equal(mapGeminiRow({ description: 'x', unpriced: false }, 0).pageNo, undefined);
});

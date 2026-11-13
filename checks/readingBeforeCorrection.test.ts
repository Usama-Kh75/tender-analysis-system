// ما قُرئ قبل تصحيح القراءة: مدخل مطابق، مجهز آخر، بلا bidderId، وأحدث مدخلين
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readingBeforeCorrection } from '../src/utils/bidderAuditEngine';
import type { AuditLogEntry, BOQItem } from '../src/types/tender';

const item = { id: 'r1', itemNo: '12' } as BOQItem;
const log = (p: Partial<AuditLogEntry>): AuditLogEntry => ({ id: 'l', timestamp: '', userName: '', action: 'تصحيح قراءة', details: '', itemNo: '12', ...p });

test('مدخل مطابق للمجهز والفقرة', () => {
  const r = readingBeforeCorrection(item, 'b1', [log({ bidderId: 'b1', fieldName: 'total', oldValue: 67500, newValue: 76500 })]);
  assert.deepEqual(r, { field: 'total', value: 67500 });
  const u = readingBeforeCorrection(item, 'b1', [log({ bidderId: 'b1', fieldName: 'unitPrice', oldValue: 2250, newValue: 3250 })]);
  assert.deepEqual(u, { field: 'unitPrice', value: 2250 });
});
test('مدخل لمجهز آخر أو بلا bidderId أو لفقرة أخرى لا يُستعمل', () => {
  assert.equal(readingBeforeCorrection(item, 'b1', [log({ bidderId: 'b2', fieldName: 'total', oldValue: 1, newValue: 2 })]), null);
  assert.equal(readingBeforeCorrection(item, 'b1', [log({ fieldName: 'total', oldValue: 1, newValue: 2 })]), null);
  assert.equal(readingBeforeCorrection(item, 'b1', [log({ bidderId: 'b1', itemNo: '13', fieldName: 'total', oldValue: 1, newValue: 2 })]), null);
});
test('الكمية والتفقيط والأعمال الأخرى لا تُستعمل، والمدخل القديم بلا fieldName مبلغ', () => {
  assert.equal(readingBeforeCorrection(item, 'b1', [log({ bidderId: 'b1', fieldName: 'quantity', oldValue: 1, newValue: 2 })]), null);
  assert.equal(readingBeforeCorrection(item, 'b1', [log({ bidderId: 'b1', fieldName: 'writtenText', oldValue: 'أ', newValue: 'ب' })]), null);
  assert.equal(readingBeforeCorrection(item, 'b1', [log({ bidderId: 'b1', action: 'مطابقة قراءة بالورقة', oldValue: 5, newValue: 6 })]), null);
  assert.deepEqual(readingBeforeCorrection(item, 'b1', [log({ bidderId: 'b1', oldValue: 100, newValue: 200 })]), { field: 'total', value: 100 });
});
test('الأحدث (الأول في السجل) يُؤخذ، وما لا تغيّر فيه يُتخطى', () => {
  const r = readingBeforeCorrection(item, 'b1', [
    log({ bidderId: 'b1', fieldName: 'total', oldValue: 300, newValue: 300 }),
    log({ bidderId: 'b1', fieldName: 'total', oldValue: 200, newValue: 300 }),
    log({ bidderId: 'b1', fieldName: 'total', oldValue: 100, newValue: 200 })
  ]);
  assert.deepEqual(r, { field: 'total', value: 200 });
});

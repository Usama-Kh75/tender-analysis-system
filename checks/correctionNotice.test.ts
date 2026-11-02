// إشعار تصحيح المجهز للتوقيع: الفقرات التي صحّحتها اللجنة، وسببها، وما بقي معلّقاً
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { correctionNoticeRows } from '../src/utils/correctionNotice';
import { ADOPTION_ACTIONS } from '../src/utils/bidderAuditEngine';
import type { AuditLogEntry, Bidder, BOQItem } from '../src/types/tender';

const item = (itemNo: string, p: Partial<BOQItem> = {}): BOQItem => ({
  id: itemNo, itemNo, description: 'فقرة ' + itemNo, unit: 'عدد', quantity: 10,
  bidderTotal: 1000, enteredBidderTotal: 1000, enteredUnitPrice: 100,
  hasMathError: false, hasTextDiscrepancy: false, ...p
} as BOQItem);
const bidderOf = (items: BOQItem[]): Bidder => ({ id: 'b1', name: 'أ', items } as unknown as Bidder);
const log = (action: string, itemNo: string, newValue: number): AuditLogEntry =>
  ({ id: 'l' + itemNo, timestamp: '', userName: '', action, details: '', itemNo, bidderId: 'b1', newValue });

test('بلا تصحيحات: مصفوفة فارغة', () => {
  const r = correctionNoticeRows(bidderOf([item('1'), item('2')]), []);
  assert.deepEqual(r.rows, []);
  assert.equal(r.totalDifference, 0);
});

test('تصحيح حاصل الضرب: السبب math والفرق', () => {
  // المجهز كتب 1200 والكمية 10 × 100 = 1000
  const b = bidderOf([item('1'), item('2', { enteredBidderTotal: 1200, bidderTotal: 1000 })]);
  const r = correctionNoticeRows(b, [log(ADOPTION_ACTIONS.math, '2', 1000)]);
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0].itemNo, '2');
  assert.equal(r.rows[0].submittedTotal, 1200);
  assert.equal(r.rows[0].adoptedTotal, 1000);
  assert.equal(r.rows[0].submittedUnit, 100);
  assert.equal(r.rows[0].basis, 'اعتماد حاصل الضرب (الكمية × سعر المفرد)');
  assert.equal(r.totalDifference, -200);
});

test('تصحيح المفرد من التفقيط مع حفظ الأصل', () => {
  const b = bidderOf([item('3', { originalUnitPrice: 90, enteredUnitPrice: 100, writtenText: 'مائة' })]);
  const r = correctionNoticeRows(b, [log(ADOPTION_ACTIONS.unit, '3', 1000)]);
  assert.equal(r.rows[0].submittedUnit, 90);
  assert.equal(r.rows[0].adoptedUnit, 100);
  assert.equal(r.rows[0].basis, 'اعتماد سعر المفرد المكتوب كتابةً');
});

test('الأصل غير محفوظ: submittedUnit null', () => {
  const b = bidderOf([item('4', { enteredBidderTotal: 900, bidderTotal: 1000, writtenText: 'مائة', enteredUnitPrice: 100 })]);
  const r = correctionNoticeRows(b, [log(ADOPTION_ACTIONS.unit, '4', 1000)]);
  assert.equal(r.rows[0].submittedUnit, null);
});

test('المعلّق يُعدّ ولا يدخل، والتوقيع يُنقل، وبلا سجل سببه عام', () => {
  const b = bidderOf([
    item('1', { hasMathError: true }),
    item('2', { hasTextDiscrepancy: true }),
    item('3', { enteredBidderTotal: 800, bidderTotal: 1000, bidderSignedAt: '2026-11-02' } as Partial<BOQItem>)
  ]);
  const r = correctionNoticeRows(b, []);
  assert.equal(r.pending, 2);
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0].signed, true);
  assert.equal(r.rows[0].basis, 'تصحيح بقرار اللجنة');
  assert.equal(r.totalDifference, 200);
});

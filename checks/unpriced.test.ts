// الفقرات غير المسعّرة: عرض فقط (المادة 10/أولاً/ط)، لا تدخل حالة التدقيق
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNewTenderProject } from '../src/utils/storageService';
import { calculateBOQMetrics } from '../src/utils/calculations';
import { isUnpricedRow } from '../src/utils/tableFilters';
import { bidderAuditState, unpricedCount } from '../src/utils/tenderPath';
import { unpricedCountText } from '../src/utils/arabicCount';
import type { BOQItem } from '../src/types/tender';

const bidderWith = (rows: Partial<BOQItem>[]) => {
  const p = createNewTenderProject({ title: 'ت', referenceNumber: '1 / 26 / 1', contractType: 'works', budgetType: 'operating', bidderNames: ['x'] });
  const calc = calculateBOQMetrics(rows, 20);
  return { ...p.bidders[0], items: calc.items, totals: calc.totals };
};

const row = (o: Partial<BOQItem>): Partial<BOQItem> => ({ itemNo: 1, description: 'ف', unit: 'عدد', quantity: 1, ...o });

test('isUnpricedRow: الحالات الأربع', () => {
  const mk = (o: Partial<BOQItem>) => o as BOQItem;
  assert.equal(isUnpricedRow(mk({ estimatedTotal: 100, bidderTotal: 0 })), true);
  assert.equal(isUnpricedRow(mk({ estimatedTotal: 0, bidderTotal: 0 })), false);
  assert.equal(isUnpricedRow(mk({ estimatedTotal: 100, bidderTotal: 90 })), false);
  assert.equal(isUnpricedRow(mk({ estimatedTotal: 100, bidderTotal: 0, unpriced: true })), true);
});

test('unpricedCount: صفر لمن لا مبالغ له، والعدّ لمن له مبالغ', () => {
  const none = bidderWith([row({ estimatedTotal: 100, estimatedUnitPrice: 100 })]);
  assert.equal(unpricedCount(none), 0);
  const some = bidderWith([
    row({ itemNo: 1, estimatedTotal: 100, estimatedUnitPrice: 100, bidderTotal: 90, bidderUnitPrice: 90 }),
    row({ itemNo: 2, estimatedTotal: 50, estimatedUnitPrice: 50 }),
    row({ itemNo: 3, estimatedTotal: 70, estimatedUnitPrice: 70, unpriced: true }),
  ]);
  assert.equal(unpricedCount(some), 2);
});

test('unpricedCountText: صيغ العدد', () => {
  assert.equal(unpricedCountText(1), 'فقرة واحدة غير مسعّرة');
  assert.equal(unpricedCountText(2), 'فقرتان غير مسعّرتين');
  assert.equal(unpricedCountText(3), '3 فقرات غير مسعّرة');
  assert.equal(unpricedCountText(11), '11 فقرة غير مسعّرة');
});

test('غير المسعّرة لا تجعل حالة التدقيق معلّقة', () => {
  const b = bidderWith([
    row({ itemNo: 1, estimatedTotal: 100, estimatedUnitPrice: 100, bidderTotal: 90, bidderUnitPrice: 90 }),
    row({ itemNo: 2, estimatedTotal: 50, estimatedUnitPrice: 50 }),
  ]);
  assert.equal(unpricedCount(b), 1);
  assert.equal(bidderAuditState(b).kind, 'done');
});

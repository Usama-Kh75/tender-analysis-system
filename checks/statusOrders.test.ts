// طلبيات كشف الموقف بلا تحليل: التوحيد، المعالجات، والنسخة الاحتياطية الشاملة
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeStatusOrders } from '../src/utils/statusOrders';
import { createStatusOrderHandlers } from '../src/app/statusOrderHandlers';
import { createNewTenderProject, parseAllBackupText } from '../src/utils/storageService';
import type { StatusOrder } from '../src/types/tender';

const mkOrder = (o: Partial<StatusOrder> = {}): StatusOrder =>
  ({ id: 'o1', referenceNumber: '7', title: 'ت', statusLog: [], createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z', ...o });

test('توحيد القائمة الخام: التالف يُتخطى والحقول الفاسدة تُهمل', () => {
  assert.deepEqual(normalizeStatusOrders('x'), []);
  assert.deepEqual(normalizeStatusOrders(null), []);
  const out = normalizeStatusOrders([
    null, 5, { title: 'بلا معرّف' }, { id: 'a' }, { id: 'b', title: '  ', referenceNumber: '' },
    { id: 'c', title: 'سليمة', announcementNo: 9, receivedAt: '2026-02-30', statusLog: 'x' },
    { id: 'c', title: 'مكررة' },
    { id: 'd', referenceNumber: '12', announcementNo: 2, receivedAt: '2026-10-05', statusLog: [{ id: 's', stage: 'referred', recordedAt: 'x' }] }
  ]);
  assert.deepEqual(out.map(o => o.id), ['c', 'd']);
  assert.equal(out[0].announcementNo, undefined);
  assert.equal(out[0].receivedAt, undefined);
  assert.deepEqual(out[0].statusLog, []);
  assert.equal(out[1].announcementNo, 2);
  assert.equal(out[1].receivedAt, '2026-10-05');
  assert.equal(out[1].statusLog.length, 1);
});

// بيئة معالجات بحالة بسيطة
const env = (initial: StatusOrder[] = []) => {
  let orders = initial;
  const h = () => createStatusOrderHandlers(orders, f => { orders = f(orders); });
  return { get orders() { return orders; }, h };
};

test('إضافة طلبية تتطلب رقماً أو موضوعاً', () => {
  const e = env();
  assert.match((e.h().handleAddOrder({ referenceNumber: ' ', title: '' }) as { error: string }).error, /[؀-ۿ]/);
  assert.equal(e.orders.length, 0);
  const r = e.h().handleAddOrder({ referenceNumber: ' 55 ', title: '', announcementNo: 2, receivedAt: '2026-10-01' });
  assert.ok('id' in r);
  assert.equal(e.orders[0].referenceNumber, '55');
  assert.deepEqual(e.orders[0].statusLog, []);
  assert.ok('error' in e.h().handleAddOrder({ referenceNumber: '1', title: '', receivedAt: 'x' }));
  assert.ok('error' in e.h().handleAddOrder({ referenceNumber: '1', title: '', announcementNo: 9 }));
  assert.equal(e.orders.length, 1);
  assert.ok('id' in e.h().handleAddOrder({ referenceNumber: '', title: 'موضوع فقط' }));
});

test('تعديل بيانات الطلبية وحذفها يحدّثان updatedAt', () => {
  const e = env([mkOrder()]);
  assert.equal(e.h().handleEditOrder('o1', { referenceNumber: '8', title: 'جديد' }), null);
  assert.equal(e.orders[0].referenceNumber, '8');
  assert.notEqual(e.orders[0].updatedAt, '2026-10-01T00:00:00.000Z');
  assert.notEqual(e.h().handleEditOrder('o1', { referenceNumber: '', title: '' }), null);
  assert.notEqual(e.h().handleEditOrder('nope', { referenceNumber: '1', title: '' }), null);
  e.h().handleDeleteOrder('o1');
  assert.equal(e.orders.length, 0);
});

test('مواقف الطلبية: إضافة وتعديل وحذف بلا تاريخ، وتحديث updatedAt', () => {
  const e = env([mkOrder()]);
  assert.equal(e.h().handleAddOrderStatus('o1', { stage: 'readvertise', customText: 'لعدم الاستيفاء' }), null);
  assert.equal(e.orders[0].statusLog.length, 1);
  assert.equal(e.orders[0].statusLog[0].memoDate, undefined);
  assert.notEqual(e.orders[0].updatedAt, '2026-10-01T00:00:00.000Z');
  assert.notEqual(e.h().handleAddOrderStatus('o1', { stage: 'other' }), null);
  const sid = e.orders[0].statusLog[0].id;
  assert.equal(e.h().handleEditOrderStatus('o1', sid, { stage: 'referred', customText: 'شركة', memoDate: '2026-10-09' }), null);
  assert.equal(e.orders[0].statusLog[0].stage, 'referred');
  assert.equal(e.orders[0].statusLog[0].id, sid);
  assert.notEqual(e.h().handleEditOrderStatus('o1', 'nope', { stage: 'audit' }), null);
  assert.notEqual(e.h().handleAddOrderStatus('zz', { stage: 'audit' }), null);
  e.h().handleDeleteOrderStatus('o1', sid);
  assert.equal(e.orders[0].statusLog.length, 0);
});

const projectJson = () => createNewTenderProject({ title: 'ت', referenceNumber: '1', contractType: 'works', budgetType: 'operating', bidderNames: ['x'] });

test('الاستعادة الشاملة: حقل الطلبيات يُقرأ إن وُجد، وغيابه (نسخة قديمة) يعني تركها', () => {
  const p = projectJson();
  const withOrders = parseAllBackupText(JSON.stringify({ __type: 'boc-tender-backup-all', __version: 1, projects: [p], statusOrders: [mkOrder()] }));
  assert.equal(withOrders.projects.length, 1);
  assert.equal(normalizeStatusOrders(withOrders.statusOrders).length, 1);
  const old = parseAllBackupText(JSON.stringify({ __type: 'boc-tender-backup-all', __version: 1, projects: [p] }));
  assert.equal(old.statusOrders, undefined);
  const empty = parseAllBackupText(JSON.stringify({ __type: 'boc-tender-backup-all', __version: 1, projects: [p], statusOrders: [] }));
  assert.deepEqual(empty.statusOrders, []);
  assert.equal(parseAllBackupText(JSON.stringify([p])).statusOrders, undefined);
  assert.throws(() => parseAllBackupText('{'), /تعذر/);
  assert.throws(() => parseAllBackupText('{"projects":[]}'), /ليس نسخة/);
});

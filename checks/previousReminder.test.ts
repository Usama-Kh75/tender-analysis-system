// رفع تذكير «السابق» من كشف الموقف (hiddenAsPrevious): الصفوف، المعالجات، التنظيف عند التحميل
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNewTenderProject } from '../src/utils/storageService';
import { statusSheetRows } from '../src/utils/orderStatus';
import { createStatusHandlers } from '../src/app/statusHandlers';
import { createStatusOrderHandlers } from '../src/app/statusOrderHandlers';
import { normalizeStatusOrders } from '../src/utils/statusOrders';
import { sanitizeHiddenAsPrevious } from '../src/utils/tenderDetails';
import { buildStatusSheetWorkbook } from '../src/utils/statusSheetExcel';
import * as XLSX from 'xlsx-js-style';
import type { StatusEntry, StatusOrder, TenderProject } from '../src/types/tender';

const entry = (o: Partial<StatusEntry> = {}): StatusEntry => ({ id: 'e', stage: 'analysis', memoDate: '2026-10-05', recordedAt: '2026-10-05T00:00:00.000Z', ...o });
const tender = (ref: string, o: Partial<TenderProject> = {}): TenderProject => ({
  ...createNewTenderProject({ title: 'ت', referenceNumber: ref, contractType: 'works', budgetType: 'operating', bidderNames: ['x'] }),
  updatedAt: '2020-01-01T00:00:00.000Z', ...o
});
const order = (ref: string, o: Partial<StatusOrder> = {}): StatusOrder =>
  ({ id: 'o1', referenceNumber: ref, title: 'ت', statusLog: [], createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z', ...o });

test('السجل الأقدم المرفوع لا يدخل previous ويُعدّ في hiddenPrevious', () => {
  const old = tender('3 / 26 / 9001', { announcementNo: 1, statusLog: [entry()], hiddenAsPrevious: true });
  const old2 = tender('3 / 26 / 9001', { announcementNo: 1, statusLog: [entry()] });
  const cur = tender('3 / 26 / 9001', { announcementNo: 2, statusLog: [entry({ stage: 'audit' })] });
  const o = order('3 / 26 / 9001', { announcementNo: 1, hiddenAsPrevious: true });
  const rows = statusSheetRows([old, old2, cur], [o]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, cur.id);
  assert.deepEqual(rows[0].previous.map(p => p.id), [old2.id]);
  assert.equal(rows[0].hiddenPrevious, 2);
  assert.deepEqual(rows[0].hiddenPreviousIds.map(h => h.id).sort(), [old.id, 'o1'].sort());
});

test('السجل المرفوع إن كان الأساسي أو الوحيد يظهر صفاً عادياً', () => {
  const only = tender('4 / 26 / 9001', { hiddenAsPrevious: true });
  assert.equal(statusSheetRows([only]).length, 1);
  assert.equal(statusSheetRows([only])[0].hiddenPrevious, 0);
  const flaggedNewest = tender('5 / 26 / 9001', { announcementNo: 2, hiddenAsPrevious: true, statusLog: [entry()] });
  const older = tender('5 / 26 / 9001', { announcementNo: 1, statusLog: [entry()] });
  const rows = statusSheetRows([flaggedNewest, older]);
  assert.equal(rows[0].id, flaggedNewest.id);
  assert.equal(rows[0].previous.length, 1);
});

test('خلية الإجراء في Excel بلا أسطر السابق', () => {
  const old = tender('6 / 26 / 9001', { announcementNo: 1, statusLog: [entry({ stage: 'readvertise' })] });
  const cur = tender('6 / 26 / 9001', { announcementNo: 2, statusLog: [entry({ stage: 'audit' })] });
  const rows = statusSheetRows([old, cur]);
  assert.equal(rows[0].previous.length, 1);
  const ws = buildStatusSheetWorkbook(rows, '2026-11-22').Sheets['موقف الطلبيات'];
  const data = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 });
  const col = data[1].indexOf('الإجراء');
  assert.equal(ws[XLSX.utils.encode_cell({ r: 2, c: col })].v, rows[0].action);
});

test('معالج المناقصة: يضع العلم ويزيله بقيد تدقيق واحد ولا يغيّر updatedAt', () => {
  const p = tender('7');
  let saved: TenderProject | undefined;
  const h = createStatusHandlers(p, x => { saved = x; });
  assert.equal(h.handleSetHiddenAsPrevious(true), null);
  assert.equal(saved!.hiddenAsPrevious, true);
  assert.equal(saved!.updatedAt, p.updatedAt);
  assert.equal(saved!.auditLogs.length, p.auditLogs.length + 1);
  const hidden = saved!;
  saved = undefined;
  createStatusHandlers(hidden, x => { saved = x; }).handleSetHiddenAsPrevious(false);
  assert.equal('hiddenAsPrevious' in saved!, false);
  assert.equal(saved!.auditLogs.length, hidden.auditLogs.length + 1);
});

test('معالج الطلبية: يضع العلم ويزيله ولا يغيّر updatedAt', () => {
  let orders = [order('8')];
  const h = () => createStatusOrderHandlers(orders, f => { orders = f(orders); });
  assert.equal(h().handleSetHiddenAsPrevious('o1', true), null);
  assert.equal(orders[0].hiddenAsPrevious, true);
  assert.equal(orders[0].updatedAt, '2026-10-01T00:00:00.000Z');
  h().handleSetHiddenAsPrevious('o1', false);
  assert.equal('hiddenAsPrevious' in orders[0], false);
  assert.match(h().handleSetHiddenAsPrevious('zz', true) ?? '', /[؀-ۿ]/);
});

test('التنظيف عند التحميل: غير true يُحذف بلا تغيير updatedAt، وtrue يبقى', () => {
  const bad = { ...tender('9'), hiddenAsPrevious: 'yes' } as unknown as TenderProject;
  const clean = sanitizeHiddenAsPrevious(bad);
  assert.equal('hiddenAsPrevious' in clean, false);
  assert.equal(clean.updatedAt, bad.updatedAt);
  assert.equal(sanitizeHiddenAsPrevious(tender('9', { hiddenAsPrevious: true })).hiddenAsPrevious, true);
  const out = normalizeStatusOrders([
    { id: 'a', referenceNumber: '1', hiddenAsPrevious: true, updatedAt: '2026-01-01T00:00:00.000Z' },
    { id: 'b', referenceNumber: '2', hiddenAsPrevious: 1, updatedAt: '2026-01-01T00:00:00.000Z' }
  ]);
  assert.equal(out[0].hiddenAsPrevious, true);
  assert.equal('hiddenAsPrevious' in out[1], false);
  assert.equal(out[1].updatedAt, '2026-01-01T00:00:00.000Z');
});

test('الرفع والإعادة لا يقدّمان السجل القديم عند تعادل الإعلان ووقت الموقف (مراجعة Codex)', () => {
  let orders = [order('9', { id: 'new' }), order('9', { id: 'old' })];
  const h = () => createStatusOrderHandlers(orders, f => { orders = f(orders); });
  const primary = () => statusSheetRows([], orders)[0].id;
  const before = primary();
  const older = before === 'new' ? 'old' : 'new';
  h().handleSetHiddenAsPrevious(older, true);
  assert.equal(primary(), before);
  assert.deepEqual(statusSheetRows([], orders)[0].hiddenPreviousIds, [{ kind: 'order', id: older }]);
  h().handleSetHiddenAsPrevious(older, false);
  assert.equal(primary(), before);
  assert.equal(statusSheetRows([], orders)[0].previous.length, 1);
});

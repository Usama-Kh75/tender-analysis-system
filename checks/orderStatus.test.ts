import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNewTenderProject, sanitizeStatusFields } from '../src/utils/storageService';
import {
  statusText, branchesOf, validateStatusEntry, sanitizeStatusLog, currentStatus, formatSheetDate, statusSheetRows
} from '../src/utils/orderStatus';
import * as XLSX from 'xlsx-js-style';
import { buildStatusSheetWorkbook } from '../src/utils/statusSheetExcel';
import type { StatusEntry, TenderProject } from '../src/types/tender';

const entry = (o: Partial<StatusEntry>): StatusEntry => ({ id: 'e', stage: 'analysis', memoDate: '2026-10-05', recordedAt: '2026-10-05T00:00:00.000Z', ...o });
const tender = (ref: string, o: Partial<TenderProject> = {}): TenderProject =>
  ({ ...createNewTenderProject({ title: `عنوان ${ref}`, referenceNumber: ref, contractType: 'supply', budgetType: 'operating', bidderNames: ['أ'] }), ...o });

test('الفرع يُطبع مع أصله', () => {
  assert.equal(statusText(entry({ stage: 'analysis', branch: 'commercial' })), 'قيد التحليل: التحليل التجاري');
});

test('إجراء آخر يُطبع بنصه', () => {
  assert.equal(statusText(entry({ stage: 'other', customText: 'كتاب إلى الوزارة' })), 'كتاب إلى الوزارة');
});

test('الموقف الحالي هو آخر إدخال لا الأحدث تاريخاً', () => {
  const p = tender('1', { statusLog: [entry({ id: 'a', memoDate: '2026-10-20' }), entry({ id: 'b', stage: 'audit', memoDate: '2026-10-01' })] });
  assert.equal(currentStatus(p)?.id, 'b');
});

test('إجراء آخر بلا نص يُرفض', () => {
  assert.match(validateStatusEntry({ stage: 'other', memoDate: '2026-10-05' }) ?? '', /[؀-ۿ]/);
});

test('فرع لا يتبع إجراءه يُرفض', () => {
  assert.match(validateStatusEntry({ stage: 'analysis', branch: 'negotiation', memoDate: '2026-10-05' }) ?? '', /[؀-ۿ]/);
});

test('تاريخ غير صالح يُرفض', () => {
  for (const d of ['', 'x', '2026-02-30', '2026-13-01']) {
    assert.match(validateStatusEntry({ stage: 'analysis', memoDate: d }) ?? '', /[؀-ۿ]/);
  }
  assert.equal(validateStatusEntry({ stage: 'analysis', branch: 'technical', memoDate: '2026-10-05' }), null);
});

test('التنظيف يتجاوز الفاسد ولا يتعطل', () => {
  assert.deepEqual(sanitizeStatusLog('x'), []);
  assert.deepEqual(sanitizeStatusLog(null), []);
  assert.deepEqual(sanitizeStatusLog([{ stage: 'analysis', memoDate: '' }, { memoDate: '2026-10-05' }, null, 5]), []);
  const out = sanitizeStatusLog([entry({ id: 'a', branch: 'negotiation' }), entry({ id: 'b', stage: 'audit' })]);
  assert.equal(out.length, 2);
  assert.equal(out[0].id, 'a');
  assert.equal(out[0].branch, undefined);
  assert.equal(out[1].id, 'b');
});

test('ترتيب الكشف', () => {
  const rows = statusSheetRows([
    tender('9', { receivedAt: '2026-10-10' }),
    tender('3'),
    tender('5', { receivedAt: '2026-09-01' })
  ]);
  assert.deepEqual(rows.map(r => r.referenceNumber), ['5', '9', '3']);
  assert.deepEqual(rows.map(r => r.no), [1, 2, 3]);
  const tie = statusSheetRows([tender('10', { receivedAt: '2026-10-10' }), tender('2', { receivedAt: '2026-10-10' })]);
  assert.deepEqual(tie.map(r => r.referenceNumber), ['2', '10']);
});

test('صف سليم لعنوان ورقم فارغين وبلا موقف', () => {
  const rows = statusSheetRows([tender('', { title: '' })]);
  assert.equal(rows.length, 1);
  assert.deepEqual(
    [rows[0].referenceNumber, rows[0].title, rows[0].receivedAt, rows[0].action, rows[0].memoNo, rows[0].date, rows[0].note],
    ['', '', '', '', '', '', '']
  );
});

test('تنسيق تاريخ الكشف', () => {
  assert.equal(formatSheetDate('2026-10-05'), '05/10/2026');
  assert.equal(formatSheetDate(''), '');
  assert.equal(formatSheetDate('x'), '');
});

test('مرحلة مجهولة تبقى وتُعرض «غير محدد» ويبقى الأخير هو الحالي', () => {
  const unknown = { ...entry({ id: 'u', memoDate: '2026-10-06' }), stage: 'future' as unknown as StatusEntry['stage'], branch: 'commercial' as const };
  const out = sanitizeStatusLog([entry({ id: 'a' }), unknown]);
  assert.equal(out.length, 2);
  assert.equal(out[1].branch, undefined);
  assert.equal(statusText(out[1]), 'غير محدد');
  assert.equal(currentStatus(tender('1', { statusLog: out }))?.id, 'u');
  assert.notEqual(validateStatusEntry({ stage: 'future' as unknown as StatusEntry['stage'], memoDate: '2026-10-05' }), null);
});

test('إجراء آخر بلا نص يُطبع فارغاً', () => {
  assert.equal(statusText(entry({ stage: 'other' })), '');
});

test('تنظيف الحقول عند التحميل', () => {
  const old = tender('1');
  const same = sanitizeStatusFields(old);
  assert.equal(same, old);
  assert.equal('statusLog' in same, false);
  assert.equal('receivedAt' in same, false);
  const bad = sanitizeStatusFields({ ...old, receivedAt: '2026-02-30' });
  assert.equal(bad.receivedAt, undefined);
  assert.equal(bad.auditLogs, old.auditLogs);
  const kept = sanitizeStatusFields({ ...old, statusLog: [{ ...entry({}), stage: 'future' as unknown as StatusEntry['stage'] }] });
  assert.equal(kept.statusLog?.length, 1);
  assert.equal(kept.auditLogs, old.auditLogs);
});

const create = (receivedAt?: string) =>
  createNewTenderProject({ title: 'ت', referenceNumber: '1', contractType: 'supply', budgetType: 'operating', bidderNames: ['أ'], receivedAt });

test('المناقصة الجديدة بتاريخ استلام تبدأ بقيد التحليل بتاريخه', () => {
  const p = create('2026-10-05');
  assert.equal(p.receivedAt, '2026-10-05');
  assert.equal(p.statusLog?.length, 1);
  const s = p.statusLog![0];
  assert.equal(s.stage, 'analysis');
  assert.equal(s.memoDate, '2026-10-05');
  assert.equal(s.branch, undefined);
  assert.equal(s.memoNo, undefined);
  assert.ok(s.id && s.recordedAt);
  assert.equal(statusText(s), 'قيد التحليل');
});

test('بلا تاريخ استلام لا موقف ولا خطأ', () => {
  for (const r of [undefined, '', 'x', '2026-02-30']) {
    const p = create(r);
    assert.equal(p.receivedAt, undefined);
    assert.equal(p.statusLog, undefined);
  }
});

test('ورقة Excel: العنوان والرأس والصفوف', () => {
  const rows = statusSheetRows([
    tender('9', { receivedAt: '2026-10-10', statusLog: [entry({ memoNo: '77', memoDate: '2026-10-12' })] }),
    tender('3')
  ]);
  const wb = buildStatusSheetWorkbook(rows, '2026-11-01');
  assert.equal(wb.SheetNames.length, 1);
  const ws = wb.Sheets[wb.SheetNames[0]];
  assert.equal(ws.A1.v, 'موقف الطلبيات لغاية 01/11/2026');
  const data = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 });
  assert.deepEqual(data[1], ['ت', 'رقم الطلبية', 'الموضوع', 'الإعلان', 'تاريخ الاستلام', 'الإجراء', 'رقم المذكرة', 'التاريخ', 'الملاحظات']);
  // بعد صفوف الطلبيات: سطر فارغ ثم «رئيس اللجنة» ثم سطر التوقيع
  assert.equal(data.length - 2, rows.length + 3);
  assert.equal(data[2 + rows.length + 1][0], 'رئيس اللجنة');
  assert.equal(data[2 + rows.length + 2][0], 'التوقيع: .....................');
  assert.equal(data[2][6], '77');
  assert.equal(data[2][7], '12/10/2026');
});

test('فروع إجراء مجهول فارغة ولا ترمي', () => {
  assert.deepEqual(branchesOf('future'), []);
  assert.deepEqual(branchesOf('reviewCommittee'), ['negotiation']);
});

test('التنظيف: معرّف مكرر أو مفقود يُصلح، ونص غير نصي يُحذف، والسليم يبقى بمراجعه', () => {
  const good = [entry({ id: 'a' }), entry({ id: 'b', stage: 'audit' })];
  const same = sanitizeStatusLog(good);
  assert.equal(same[0], good[0]);
  assert.equal(same[1], good[1]);
  const bad = sanitizeStatusLog([entry({ id: 'a' }), entry({ id: 'a' }), { ...entry({}), id: undefined, memoNo: 5, note: {} }]);
  assert.equal(new Set(bad.map(e => e.id)).size, 3);
  assert.equal(bad[2].memoNo, undefined);
  assert.equal(bad[2].note, undefined);
});

test('sanitizeStatusFields تعيد الكائن نفسه حين لا يتغير شيء', () => {
  const p = tender('1', { receivedAt: '2026-10-05', statusLog: [entry({ id: 'a' })] });
  assert.equal(sanitizeStatusFields(p), p);
});

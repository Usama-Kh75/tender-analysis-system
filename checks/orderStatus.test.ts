import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNewTenderProject, sanitizeStatusFields } from '../src/utils/storageService';
import {
  statusText, branchesOf, validateStatusEntry, sanitizeStatusLog, currentStatus, formatSheetDate, statusSheetRows
} from '../src/utils/orderStatus';
import { compareOrderNumbers, orderNumberParts } from '../src/utils/orderNumber';
import * as XLSX from 'xlsx-js-style';
import { buildStatusSheetWorkbook, defaultStatusColumns } from '../src/utils/statusSheetExcel';
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

test('تاريخ غير صالح يُرفض، وغيابه مقبول', () => {
  assert.equal(validateStatusEntry({ stage: 'audit' }), null);
  assert.equal(validateStatusEntry({ stage: 'audit', memoDate: '' }), null);
  for (const d of ['x', '2026-02-30', '2026-13-01']) {
    assert.match(validateStatusEntry({ stage: 'analysis', memoDate: d }) ?? '', /[؀-ۿ]/);
  }
  assert.equal(validateStatusEntry({ stage: 'analysis', branch: 'technical', memoDate: '2026-10-05' }), null);
});

test('التنظيف يتجاوز الفاسد ولا يتعطل', () => {
  assert.deepEqual(sanitizeStatusLog('x'), []);
  assert.deepEqual(sanitizeStatusLog(null), []);
  // الإدخال بلا مرحلة نصية يُحذف؛ وبلا تاريخ يبقى لأن التاريخ اختياري
  assert.deepEqual(sanitizeStatusLog([{ memoDate: '2026-10-05' }, { stage: 5 }, null, 5]), []);
  assert.equal(sanitizeStatusLog([{ stage: 'analysis', memoDate: '' }]).length, 1);
  const out = sanitizeStatusLog([entry({ id: 'a', branch: 'negotiation' }), entry({ id: 'b', stage: 'audit' })]);
  assert.equal(out.length, 2);
  assert.equal(out[0].id, 'a');
  assert.equal(out[0].branch, undefined);
  assert.equal(out[1].id, 'b');
});

test('ترتيب الكشف برقم الطلبية: السنة ثم التسلسل ثم الرمز', () => {
  const rows = statusSheetRows([
    tender('2 / 26 / 9012'),
    tender('19 / 25 / 9030'),
    tender('11 / 26 / 9014'),
    tender('11 / 26 / 9009')
  ]);
  assert.deepEqual(rows.map(r => r.referenceNumber), ['19 / 25 / 9030', '2 / 26 / 9012', '11 / 26 / 9009', '11 / 26 / 9014']);
  assert.deepEqual(rows.map(r => r.no), [1, 2, 3, 4]);
  // تاريخ الاستلام لا يدخل في الترتيب
  const byNumber = statusSheetRows([tender('3 / 26 / 9001', { receivedAt: '2026-01-01' }), tender('1 / 26 / 9001', { receivedAt: '2026-09-01' })]);
  assert.deepEqual(byNumber.map(r => r.referenceNumber), ['1 / 26 / 9001', '3 / 26 / 9001']);
});

test('غير الموحَّد بعد الموحَّد، والفارغ أخيراً', () => {
  const rows = statusSheetRows([tender(''), tender('ب'), tender('5 / 26 / 9001'), tender('أ')]);
  assert.deepEqual(rows.map(r => r.referenceNumber), ['5 / 26 / 9001', 'أ', 'ب', '']);
  assert.equal(compareOrderNumbers('9 / 26 / 1', '10 / 26 / 1') < 0, true);
  assert.equal(orderNumberParts('x'), null);
  assert.deepEqual(orderNumberParts('2 / 26 / 9012'), { seq: 2, year: 26, code: 9012 });
});

test('ترتيب الكشف بالإجراء: مجموعات بترتيب المراحل، والمجهول بعد «آخر»، وبلا موقف أخيراً', () => {
  const unknown = { ...entry({}), stage: 'future' as unknown as StatusEntry['stage'] };
  const rows = statusSheetRows([
    tender('1 / 26 / 9001'),
    tender('2 / 26 / 9001', { statusLog: [unknown] }),
    tender('3 / 26 / 9001', { statusLog: [entry({ stage: 'audit' })] }),
    tender('4 / 26 / 9001', { statusLog: [entry({ stage: 'other', customText: 'س' })] }),
    tender('6 / 26 / 9001', { statusLog: [entry({ stage: 'analysis' })] }),
    tender('5 / 26 / 9001', { statusLog: [entry({ stage: 'analysis' })] })
  ], [], 'stage');
  assert.deepEqual(rows.map(r => r.referenceNumber), ['5 / 26 / 9001', '6 / 26 / 9001', '3 / 26 / 9001', '4 / 26 / 9001', '2 / 26 / 9001', '1 / 26 / 9001']);
  assert.deepEqual(rows.map(r => r.no), [1, 2, 3, 4, 5, 6]);
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
    tender('1', { receivedAt: '2026-10-10', statusLog: [entry({ memoNo: '77', memoDate: '2026-10-12' })] }),
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
  // التوقيع في آخر الأعمدة (يسار الصفحة) لا في العمود الأول
  const signRow = 2 + rows.length + 1;
  assert.equal(ws[XLSX.utils.encode_cell({ r: signRow, c: 7 })].v, 'رئيس اللجنة');
  assert.equal(ws[XLSX.utils.encode_cell({ r: signRow + 1, c: 7 })].v, 'التوقيع: .....................');
  assert.equal(ws[XLSX.utils.encode_cell({ r: signRow, c: 0 })]?.v ?? '', '');
  assert.ok(ws['!merges']!.some(m => m.s.r === signRow && m.s.c === 7 && m.e.c === 8));
  assert.equal(data[2][6], '77');
  assert.equal(data[2][7], '12/10/2026');
  // رقم الطلبية سطر واحد لا يلتفّ (B3)، والموضوع يلتفّ كما كان (C3)
  assert.equal(ws.B3.s.alignment.wrapText, false);
  assert.equal(ws.C3.s.alignment.wrapText, true);
});

test('الأعمدة الافتراضية: ما فيه بيانات فقط', () => {
  const rows = statusSheetRows([
    tender('1', { receivedAt: '2026-10-10', statusLog: [entry({ memoNo: '77', memoDate: '2026-10-12' })] }),
    tender('3')
  ]);
  assert.deepEqual(defaultStatusColumns(rows), ['receivedAt', 'memoNo', 'date']);
  assert.deepEqual(defaultStatusColumns([]), []);
});

test('ورقة Excel بلا عمودي الإعلان وتاريخ الاستلام', () => {
  const rows = statusSheetRows([
    tender('1', { receivedAt: '2026-10-10', statusLog: [entry({ memoNo: '77', memoDate: '2026-10-12' })] }),
    tender('3')
  ]);
  const wb = buildStatusSheetWorkbook(rows, '2026-11-01', ['memoNo', 'date', 'note']);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 });
  assert.deepEqual(data[1], ['ت', 'رقم الطلبية', 'الموضوع', 'الإجراء', 'رقم المذكرة', 'التاريخ', 'الملاحظات']);
  assert.equal(data[2].length, 7);
  const signRow = 2 + rows.length + 1;
  assert.equal(ws[XLSX.utils.encode_cell({ r: signRow, c: 5 })].v, 'رئيس اللجنة');
  assert.equal(ws[XLSX.utils.encode_cell({ r: signRow + 1, c: 6 })]?.v ?? '', '');
  assert.ok(ws['!merges']!.some(m => m.s.r === signRow && m.s.c === 5 && m.e.c === 6));
  assert.ok(ws['!merges']!.some(m => m.s.r === 0 && m.e.c === 6));
});

test('ورقة Excel باسم اللجنة: سطر مدموج فوق العنوان وتنزاح الصفوف', () => {
  const rows = statusSheetRows([tender('9'), tender('3')]);
  const wb = buildStatusSheetWorkbook(rows, '2026-11-01', undefined, '  لجنة التحليل  ');
  const ws = wb.Sheets[wb.SheetNames[0]];
  assert.equal(ws.A1.v, 'لجنة التحليل');
  assert.equal(ws.A2.v, 'موقف الطلبيات لغاية 01/11/2026');
  const data = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 });
  assert.equal(data[2][1], 'رقم الطلبية');
  assert.equal(data.length - 3, rows.length + 3);
  const signRow = 3 + rows.length + 1;
  assert.equal(ws[XLSX.utils.encode_cell({ r: signRow, c: 7 })].v, 'رئيس اللجنة');
  assert.ok(ws['!merges']!.some(m => m.s.r === 0 && m.e.c === 8));
  assert.ok(ws['!merges']!.some(m => m.s.r === 1 && m.e.c === 8));
  assert.ok(ws['!merges']!.some(m => m.s.r === signRow && m.s.c === 7 && m.e.c === 8));
  // بلا اسم: الورقة كما كانت
  assert.equal(buildStatusSheetWorkbook(rows, '2026-11-01', undefined, '  ').Sheets['موقف الطلبيات'].A1.v, 'موقف الطلبيات لغاية 01/11/2026');
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

test('نصوص الإجراءات الجديدة والتفصيل', () => {
  assert.equal(statusText(entry({ stage: 'referred', customText: 'شركة الرافدين' })), 'تمت الإحالة إلى شركة الرافدين');
  assert.equal(statusText(entry({ stage: 'referred' })), 'تمت الإحالة');
  assert.equal(statusText(entry({ stage: 'referralPending' })), 'قيد الإحالة');
  assert.equal(statusText(entry({ stage: 'awaitingBidders', customText: 'على تقديم الأعمال المماثلة' })), 'بانتظار إجابة الشركات على تقديم الأعمال المماثلة');
  assert.equal(statusText(entry({ stage: 'readvertise', customText: ' لعدم الانسجام مع معايير التأهيل ' })), 'إعادة إعلان لعدم الانسجام مع معايير التأهيل');
  assert.equal(statusText(entry({ stage: 'analysis', branch: 'commercial', customText: 'تفصيل' })), 'قيد التحليل: التحليل التجاري تفصيل');
  assert.equal(statusText(entry({ stage: 'audit', customText: '  ' })), 'لدى قسم الرقابة والتدقيق الداخلي');
});

test('التنظيف: تاريخ باطل يُحذف ويبقى الإدخال، والسليم بمراجعه', () => {
  const good = entry({ id: 'a' });
  const undated = { ...entry({ id: 'b' }), memoDate: undefined };
  const out = sanitizeStatusLog([good, undated, { ...entry({ id: 'c' }), memoDate: '2026-02-30' }]);
  assert.equal(out.length, 3);
  assert.equal(out[0], good);
  assert.equal(out[2].memoDate, undefined);
  assert.equal(out[2].id, 'c');
});

test('كشف الموقف يدمج المناقصات والطلبيات بلا تحليل مرتبةً وبنوعها ومعرّفها', () => {
  const order = { id: 'o1', referenceNumber: '4', title: 'طلبية بلا تحليل', announcementNo: 2, receivedAt: '2026-09-15', createdAt: 'x', updatedAt: 'x', statusLog: [entry({ stage: 'readvertise', customText: 'لعدم الاستيفاء', memoDate: undefined })] };
  const t = tender('9', { receivedAt: '2026-10-10' });
  const rows = statusSheetRows([t, tender('3')], [order]);
  assert.deepEqual(rows.map(r => r.referenceNumber), ['3', '4', '9']);
  assert.deepEqual(rows.map(r => r.no), [1, 2, 3]);
  assert.deepEqual(rows.map(r => r.kind), ['tender', 'order', 'tender']);
  assert.equal(rows[1].id, 'o1');
  assert.equal(rows[2].id, t.id);
  assert.equal(rows[1].action, 'إعادة إعلان لعدم الاستيفاء');
  assert.equal(rows[1].date, '');
  assert.equal(rows[1].announcement, 'الإعلان الثاني');
  assert.equal(statusSheetRows([], [order]).length, 1);
});

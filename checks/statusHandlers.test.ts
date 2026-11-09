// معالجات موقف الطلبية (src/app/statusHandlers.ts): الإضافة آخراً، والتعديل والحذف، والتسجيل في سجل التدقيق
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNewTenderProject } from '../src/utils/storageService';
import { createStatusHandlers } from '../src/app/statusHandlers';
import { currentStatus } from '../src/utils/orderStatus';
import type { TenderProject } from '../src/types/tender';

const mk = (receivedAt?: string): TenderProject => ({
  ...createNewTenderProject({ title: 'ت', referenceNumber: '1', contractType: 'works', budgetType: 'operating', bidderNames: ['x'], receivedAt }),
  updatedAt: '2020-01-01T00:00:00.000Z'
});

// ينفّذ عملية ويعيد المحفوظ (undefined إن لم يُحفظ شيء) ونتيجة المعالج
const run = <T,>(project: TenderProject, fn: (h: ReturnType<typeof createStatusHandlers>) => T) => {
  let saved: TenderProject | undefined;
  const result = fn(createStatusHandlers(project, p => { saved = p; }));
  return { saved, result };
};

const input = { stage: 'audit' as const, memoNo: ' 55 ', memoDate: '2026-10-20' };

test('إضافة موقف تلحقه آخراً وتسجل في سجل التدقيق وتحدّث updatedAt', () => {
  const p = mk('2026-10-05');
  const { saved, result } = run(p, h => h.handleAddStatus(input));
  assert.equal(result, null);
  assert.equal(saved!.statusLog!.length, 2);
  assert.equal(saved!.statusLog![0].stage, 'analysis');
  assert.equal(currentStatus(saved!)?.stage, 'audit');
  assert.equal(currentStatus(saved!)?.memoNo, '55');
  assert.equal(saved!.auditLogs.length, p.auditLogs.length + 1);
  assert.match(saved!.auditLogs[0].details, /55/);
  assert.match(saved!.auditLogs[0].details, /20\/10\/2026/);
  assert.notEqual(saved!.updatedAt, p.updatedAt);
});

test('إضافة موقف غير صالح (إجراء آخر بلا نص) ترجع رسالة ولا تحفظ', () => {
  const { saved, result } = run(mk(), h => h.handleAddStatus({ stage: 'other', customText: '  ', memoDate: '2026-10-20' }));
  assert.match(result ?? '', /[؀-ۿ]/);
  assert.equal(saved, undefined);
});

test('تعديل موقف يغيّر عنصره وحده ويسجل القديم والجديد', () => {
  const p = mk('2026-10-05');
  const first = p.statusLog![0];
  const added = run(p, h => h.handleAddStatus(input)).saved!;
  const second = added.statusLog![1];
  const { saved, result } = run(added, h => h.handleEditStatus(second.id, { stage: 'reviewCommittee', branch: 'negotiation', memoDate: '2026-10-25' }));
  assert.equal(result, null);
  assert.deepEqual(saved!.statusLog![0], first);
  assert.equal(saved!.statusLog![1].id, second.id);
  assert.equal(saved!.statusLog![1].recordedAt, second.recordedAt);
  assert.equal(saved!.statusLog![1].stage, 'reviewCommittee');
  assert.equal(saved!.statusLog![1].memoNo, undefined);
  assert.match(saved!.auditLogs[0].details, /لدى قسم الرقابة/);
  assert.match(saved!.auditLogs[0].details, /قيد التفاوض/);
  assert.equal(run(added, h => h.handleEditStatus('nope', input)).saved, undefined);
  assert.notEqual(run(added, h => h.handleEditStatus(second.id, { stage: 'analysis', branch: 'negotiation', memoDate: '2026-10-25' })).result, null);
});

test('حذف آخر موقف يجعل السابق هو الحالي', () => {
  const added = { ...run(mk('2026-10-05'), h => h.handleAddStatus(input)).saved!, updatedAt: '2020-01-01T00:00:00.000Z' };
  const { saved } = run(added, h => h.handleDeleteStatus(added.statusLog![1].id));
  assert.equal(currentStatus(saved!)?.stage, 'analysis');
  assert.equal(saved!.auditLogs.length, added.auditLogs.length + 1);
  assert.notEqual(saved!.updatedAt, added.updatedAt);
});

test('حذف الكل يعطي currentStatus غير معرّف', () => {
  const p = mk('2026-10-05');
  const { saved } = run(p, h => h.handleDeleteStatus(p.statusLog![0].id));
  assert.equal(currentStatus(saved!), undefined);
});

test('إضافة بتاريخ باطل لا تُحفظ وترجع رسالة', () => {
  for (const memoDate of ['x', '2026-02-30']) {
    const { saved, result } = run(mk(), h => h.handleAddStatus({ stage: 'audit', memoDate }));
    assert.match(result ?? '', /[؀-ۿ]/);
    assert.equal(saved, undefined);
  }
});

test('تنظيف المدخل: trim وحذف الفارغ والتفصيل النصي يُحفظ لكل إجراء', () => {
  const { saved } = run(mk(), h => h.handleAddStatus({ stage: 'audit', branch: '' as any, customText: 'نص', memoNo: '  ', memoDate: '2026-10-20', note: '  ملاحظة  ' }));
  const e = currentStatus(saved!)!;
  assert.equal(e.customText, 'نص');
  assert.equal(e.branch, undefined);
  assert.equal(e.memoNo, undefined);
  assert.equal(e.note, 'ملاحظة');
  const other = currentStatus(run(mk(), h => h.handleAddStatus({ stage: 'other', customText: '  كتاب  ', memoDate: '2026-10-20' })).saved!)!;
  assert.equal(other.customText, 'كتاب');
});

test('إضافة بلا تاريخ تُحفظ، والتاريخ الفارغ يصير غائباً، ووصف السجل بلا «بتاريخ»', () => {
  for (const memoDate of [undefined, '', '  ']) {
    const { saved, result } = run(mk(), h => h.handleAddStatus({ stage: 'referred', customText: ' شركة س ', memoDate }));
    assert.equal(result, null);
    const e = currentStatus(saved!)!;
    assert.equal(e.memoDate, undefined);
    assert.equal(e.customText, 'شركة س');
    assert.doesNotMatch(saved!.auditLogs[0].details, /بتاريخ/);
    assert.match(saved!.auditLogs[0].details, /تمت الإحالة إلى شركة س/);
  }
});

test('التفصيل النصي يُحفظ لكل إجراء', () => {
  const e = currentStatus(run(mk(), h => h.handleAddStatus({ stage: 'awaitingBidders', customText: ' على الأعمال المماثلة ' })).saved!)!;
  assert.equal(e.customText, 'على الأعمال المماثلة');
});

test('المعالجات تعمل على أي مناقصة تُمرَّر لا الحالية وحدها', () => {
  const other = mk('2026-10-05');
  let saved: TenderProject | undefined;
  const h = createStatusHandlers(other, p => { saved = p; });
  assert.equal(h.handleAddStatus({ stage: 'audit' }), null);
  assert.equal(saved!.id, other.id);
  assert.equal(saved!.statusLog!.length, 2);
});

test('حفظ الإعلان وتاريخ الاستلام من الكشف: يُسجَّل ولا يمس السجل، وبلا تغيير لا يُحفظ شيء', () => {
  const p = mk('2026-10-05');
  const { saved, result } = run(p, h => h.handleSaveDetails({ announcementNo: 2, receivedAt: '2026-10-07' }));
  assert.equal(result, null);
  assert.equal(saved!.announcementNo, 2);
  assert.equal(saved!.receivedAt, '2026-10-07');
  assert.deepEqual(saved!.statusLog, p.statusLog);
  assert.notEqual(saved!.updatedAt, p.updatedAt);
  assert.match(saved!.auditLogs[0].details, /الإعلان: الإعلان الثاني/);
  assert.match(saved!.auditLogs[0].details, /07\/10\/2026/);
  assert.equal(run(p, h => h.handleSaveDetails({ announcementNo: p.announcementNo, receivedAt: p.receivedAt })).saved, undefined);
  assert.notEqual(run(p, h => h.handleSaveDetails({ receivedAt: '2026-02-30' })).result, null);
  const cleared = run(p, h => h.handleSaveDetails({ receivedAt: '' })).saved!;
  assert.equal(cleared.receivedAt, undefined);
});

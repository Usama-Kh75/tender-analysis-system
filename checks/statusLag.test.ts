// تنبيه تأخر الموقف عن عمل اللجنة (src/utils/statusLag.ts): عرض فقط
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateBOQMetrics } from '../src/utils/calculations';
import { createNewTenderProject } from '../src/utils/storageService';
import { statusLag } from '../src/utils/statusLag';
import { statusSheetRows } from '../src/utils/orderStatus';
import type { AuditLogEntry, Bidder, BOQItem, StatusEntry, StatusStage, TenderProject } from '../src/types/tender';

const mkBidder = (id: string, total: number, status: Bidder['status'] = 'pending'): Bidder => {
  const each = total / 10;
  const rows: Partial<BOQItem>[] = Array.from({ length: 10 }, (_, i) => ({
    itemNo: i + 1, description: `فقرة ${i + 1}`, unit: 'عدد', quantity: 1, estimatedTotal: 100,
    enteredUnitPrice: each, enteredBidderTotal: each, bidderTotal: each
  }));
  const c = calculateBOQMetrics(rows, 20);
  return { id, name: id, submissionDate: '2026-01-01', items: c.items, totals: c.totals, status };
};
const t = (h: number) => new Date(Date.UTC(2026, 10, 20, h)).toISOString();
const entry = (stage: StatusStage, h: number): StatusEntry => ({ id: `s${h}`, stage, recordedAt: t(h) });
const log = (action: string, details: string, h: number): AuditLogEntry => ({ id: `l${h}`, timestamp: t(h), userName: 'م', action, details });
const mk = (statusLog: StatusEntry[] | undefined, auditLogs: AuditLogEntry[], awarded = true): TenderProject => ({
  ...createNewTenderProject({ title: 'ت', referenceNumber: '1', contractType: 'works', budgetType: 'operating', bidderNames: ['x'] }),
  deviationThreshold: 20, currency: 'د.ع', updatedAt: '2020-01-01T00:00:00.000Z',
  bidders: [mkBidder('A', 900, awarded ? 'recommended' : 'pending'), mkBidder('B', 1000)],
  activeBidderId: 'A', statusLog, auditLogs
});
const choice = (h: number) => log('تحديث حالة العطاء', 'تم تعديل حالة المجهز (A) إلى (recommended)', h);

test('ترسية بعد موقف «بانتظار إجابة الشركات» تُنبّه', () => {
  const l = statusLag(mk([entry('awaitingBidders', 1)], [choice(5)]));
  assert.equal(l?.kind, 'award');
  assert.match(l!.text, /«A» بعد تسجيل هذا الموقف/);
});

test('موقف سُجّل بعد اختيار الترسية لا ينبّه', () => {
  assert.equal(statusLag(mk([entry('awaitingBidders', 6)], [choice(5)])), null);
});

test('ترسية بلا أي موقف مسجَّل تنبّه بنص خاص', () => {
  const l = statusLag(mk([], [choice(5)]));
  assert.equal(l?.kind, 'award');
  assert.match(l!.text, /ولم يُسجَّل موقف/);
});

test('موقف «لدى الرقابة» مع ترسية لا ينبّه', () => {
  assert.equal(statusLag(mk([entry('audit', 1)], [choice(5)])), null);
});

test('أساس المفاضلة بعد «بانتظار إجابة الشركات» بلا ترسية ينبّه، وقبله لا', () => {
  const pref = (h: number) => log('تسجيل أساس المفاضلة', 'x', h);
  const l = statusLag(mk([entry('awaitingBidders', 1)], [pref(5)], false));
  assert.equal(l?.kind, 'preference');
  assert.equal(statusLag(mk([entry('awaitingBidders', 6)], [pref(5)], false)), null);
});

test('لا ترسية ولا مفاضلة: لا تنبيه', () => {
  assert.equal(statusLag(mk([entry('awaitingBidders', 1)], [], false)), null);
});

test('صف كشف الموقف يحمل التنبيه للمناقصة لا للطلبية بلا تحليل', () => {
  const p = mk([entry('awaitingBidders', 1)], [choice(5)]);
  const order = { id: 'o', referenceNumber: '2', title: 'ط', statusLog: [entry('awaitingBidders', 1)], createdAt: t(1), updatedAt: t(1) };
  const rows = statusSheetRows([p], [order]);
  assert.match(rows.find(r => r.kind === 'tender')!.lag ?? '', /اختارت اللجنة/);
  assert.equal(rows.find(r => r.kind === 'order')!.lag, undefined);
});

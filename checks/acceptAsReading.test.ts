// «الأرقام كما في الورقة»: فقرة عليها تصحيح حسابي تبيّن أن خطأها قراءة لا خطأ مجهز (2026-11-01، الفقرة 33 في طلبية المواد الغذائية)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNewTenderProject } from '../src/utils/storageService';
import { calculateBOQMetrics } from '../src/utils/calculations';
import { createEditContext } from '../src/app/editContext';
import { createItemHandlers } from '../src/app/itemHandlers';
import { isCommitteeCorrected, hasNumericCommitteeCorrection } from '../src/utils/bidderAuditEngine';
import type { TenderProject } from '../src/types/tender';

const setup = () => {
  const p = createNewTenderProject({ title: 'ط', referenceNumber: '1', contractType: 'supply', budgetType: 'operating', bidderNames: ['أ'] });
  // قراءة خاطئة (260 و1,248,000) ثم اعتماد اللجنة التفقيط مفرداً (280) والمبلغ 1,344,000، وعليه توقيع المجهز
  const raw = [{
    id: 'r1', itemNo: '33', description: 'روبة', quantity: 4800, estimatedTotal: 1128000,
    bidderTotal: 1344000, enteredBidderTotal: 1248000, enteredUnitPrice: 280, originalUnitPrice: 260,
    bidderUnitPrice: 280, writtenText: 'مئتان وثمانون دينار', bidderSignedAt: '2026-11-01T00:00:00.000Z'
  }];
  const calc = calculateBOQMetrics(raw, p.deviationThreshold);
  return { ...p, bidders: [{ ...p.bidders[0], items: calc.items, totals: calc.totals }] } as TenderProject;
};

test('اعتماد الأرقام كما في الورقة يجعل المعتمد مدوَّناً ويُسقط التصحيح والتوقيع ويسجَّل', () => {
  const project = setup();
  assert.ok(hasNumericCommitteeCorrection(project.bidders[0].items[0]));
  (globalThis as any).window = { confirm: () => true };
  let saved!: TenderProject;
  const ctx = createEditContext(project, project.bidders[0], (fn: any) => { saved = fn([project])[0]; });
  createItemHandlers(ctx).handleAcceptAsReading(0);
  const it = saved.bidders[0].items[0];
  assert.equal(it.enteredBidderTotal, 1344000);
  assert.equal(it.bidderTotal, 1344000);
  assert.equal(it.enteredUnitPrice, 280);
  assert.equal(it.originalUnitPrice, undefined);
  assert.equal(it.bidderSignedAt, undefined);
  assert.equal(isCommitteeCorrected(it), false);
  assert.ok(!it.hasMathError);
  const last = saved.auditLogs[saved.auditLogs.length - 1];
  assert.equal(last.action, 'تصحيح قراءة');
  assert.match(last.details, /1,248,000/);
});

test('الإلغاء في النافذة لا يغيّر شيئاً', () => {
  const project = setup();
  (globalThis as any).window = { confirm: () => false };
  let called = false;
  const ctx = createEditContext(project, project.bidders[0], () => { called = true; });
  createItemHandlers(ctx).handleAcceptAsReading(0);
  assert.equal(called, false);
});

test('فقرة بلا تصحيح حسابي لا يُعرض لها الاعتماد ولا يفعل الدالة شيئاً', () => {
  const project = setup();
  const plain = { ...project.bidders[0].items[0], enteredBidderTotal: 1344000, originalUnitPrice: undefined };
  assert.equal(hasNumericCommitteeCorrection(plain), false);
});

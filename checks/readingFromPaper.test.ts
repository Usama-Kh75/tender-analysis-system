// «الورقة تقول»: معالج واحد يطبّق رقمين في استدعاء واحد ولا يُعدّ تصحيح لجنة
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNewTenderProject } from '../src/utils/storageService';
import { calculateBOQMetrics } from '../src/utils/calculations';
import { createEditContext } from '../src/app/editContext';
import { createItemHandlers } from '../src/app/itemHandlers';
import { isCommitteeCorrected } from '../src/utils/bidderAuditEngine';
import type { BOQItem, TenderProject } from '../src/types/tender';

const setup = (raw: Partial<BOQItem>[]) => {
  const p = createNewTenderProject({ title: 'ط', referenceNumber: '1', contractType: 'supply', budgetType: 'operating', bidderNames: ['أ'] });
  const calc = calculateBOQMetrics(raw, p.deviationThreshold);
  return { ...p, bidders: [{ ...p.bidders[0], items: calc.items, totals: calc.totals }] } as TenderProject;
};

const run = (project: TenderProject, paper: { unitPrice?: number; total?: number }, confirm = true) => {
  (globalThis as any).window = { confirm: () => confirm, alert: () => {} };
  let saved: TenderProject | undefined;
  const ctx = createEditContext(project, project.bidders[0], (fn: any) => { saved = fn([project])[0]; });
  createItemHandlers(ctx).handleReadingFromPaper(0, paper);
  return saved;
};

// الفقرة 173: قُرئ المفرد 2,250 والورقة 3,250 بتفقيط «ثلاثة آلاف ومئتان وخمسون»
const row173 = (): Partial<BOQItem> => ({
  id: 'r1', itemNo: '173', description: 'ص', quantity: 4, estimatedTotal: 13000,
  bidderTotal: 9000, enteredBidderTotal: 9000, enteredUnitPrice: 2250, bidderUnitPrice: 2250,
  writtenText: 'ثلاثة آلاف ومئتان وخمسون دينار', readBy: 'ai', readCheck: { fields: ['unitPrice'], second: '3250' }
});

test('المفرد والمبلغ يصيران المدوَّنين في استدعاء واحد، وتُمسح العلامات ولا تعدّ تصحيح لجنة', () => {
  const project = setup([row173()]);
  const saved = run(project, { unitPrice: 3250, total: 13000 })!;
  const it = saved.bidders[0].items[0];
  assert.equal(it.enteredUnitPrice, 3250);
  assert.equal(it.bidderUnitPrice, 3250);
  assert.equal(it.bidderTotal, 13000);
  assert.equal(it.enteredBidderTotal, 13000);
  assert.ok(!it.hasMathError);
  assert.ok(!it.hasTextDiscrepancy);
  assert.equal(it.readCorrected, true);
  assert.equal(it.readCheck, undefined);
  assert.equal(it.writtenText, 'ثلاثة آلاف ومئتان وخمسون دينار');
  assert.equal(isCommitteeCorrected(it), false);
  const last = saved.auditLogs[saved.auditLogs.length - 1];
  assert.equal(last.action, 'تصحيح قراءة');
  assert.equal(last.bidderId, project.bidders[0].id);
  assert.match(last.details, /2,250/);
  assert.match(last.details, /3,250/);
  assert.notEqual(saved.updatedAt, project.updatedAt);
});

test('المبلغ وحده يترك المفرد كما هو', () => {
  const project = setup([{ ...row173(), enteredBidderTotal: 8000, bidderTotal: 8000 }]);
  const saved = run(project, { total: 9000 })!;
  const it = saved.bidders[0].items[0];
  assert.equal(it.enteredUnitPrice, 2250);
  assert.equal(it.bidderTotal, 9000);
  assert.ok(!it.hasMathError);
});

test('فقرة عليها تصحيح لجنة: الإلغاء في النافذة لا يغيّر شيئاً، والتأكيد يلغيه علناً', () => {
  const corrected: Partial<BOQItem> = { ...row173(), bidderTotal: 13000, enteredBidderTotal: 9000, originalUnitPrice: 2250, enteredUnitPrice: 3250, bidderUnitPrice: 3250 };
  const project = setup([corrected]);
  assert.ok(isCommitteeCorrected(project.bidders[0].items[0]));
  assert.equal(run(project, { unitPrice: 3250, total: 13000 }, false), undefined);
  const saved = run(project, { unitPrice: 3250, total: 13000 })!;
  const it = saved.bidders[0].items[0];
  assert.equal(isCommitteeCorrected(it), false);
  assert.equal(it.originalUnitPrice, undefined);
  assert.ok(saved.auditLogs.some(l => l.action === 'إلغاء تصحيح اللجنة لتصحيح قراءة'));
});

test('رقم غير موجب لا يفعل شيئاً', () => {
  const project = setup([row173()]);
  assert.equal(run(project, {}), undefined);
  assert.equal(run(project, { total: 0 }), undefined);
});

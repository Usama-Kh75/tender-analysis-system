// موثوقية القراءة الآلية: ما يُطابَق بالورقة أولاً وما عدّلته اللجنة (عرض فقط)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNewTenderProject } from '../src/utils/storageService';
import { calculateBOQMetrics } from '../src/utils/calculations';
import { createEditContext } from '../src/app/editContext';
import { createItemHandlers } from '../src/app/itemHandlers';
import { createImportHandlers } from '../src/app/importHandlers';
import { readingReliability } from '../src/utils/readingReliability';
import type { Bidder, BOQItem, TenderProject } from '../src/types/tender';

(globalThis as any).window = { alert: () => {}, confirm: () => true };

const row = (id: string, amount: number, extra: Partial<BOQItem> = {}): Partial<BOQItem> => ({
  id, itemNo: id, description: `فقرة ${id}`, quantity: 1, estimatedTotal: 1000,
  bidderTotal: amount, enteredBidderTotal: amount, enteredUnitPrice: amount, ...extra
});
const mk = (rows: Partial<BOQItem>[]): TenderProject => {
  const p = createNewTenderProject({ title: 'ط', referenceNumber: '1', contractType: 'supply', budgetType: 'operating', bidderNames: ['أ'] });
  const c = calculateBOQMetrics(rows, p.deviationThreshold);
  return { ...p, bidders: [{ ...p.bidders[0], items: c.items, totals: c.totals }] };
};
const diff = { fields: ['المبلغ'], second: 'خانة المبلغ وحدها: 900' };

test('عطاء بلا readBy: null', () => {
  assert.equal(readingReliability(mk([row('1', 500)]).bidders[0]), null);
});

test('العدّ والترتيب بالمبلغ والمحرك المختلط', () => {
  const p = mk([
    row('1', 500, { readBy: 'ai', readCheck: diff }),
    row('2', 9000, { readBy: 'ai', readCheck: diff, readCorrected: true }),
    row('3', 700, { readBy: 'ocr' }),
    row('4', 100, { readBy: 'ai', unpriced: true, readCheck: diff }),
    row('5', 800) // بلا readBy: خارج العدّ
  ]);
  const r = readingReliability(p.bidders[0])!;
  assert.equal(r.readRows, 4);
  assert.equal(r.corrected, 1);
  assert.equal(r.engine, 'mixed');
  assert.equal(r.checkRows, 2);
  assert.deepEqual(r.riskRows.map(x => x.itemNo), ['2', '1']);
  assert.ok(r.riskRows[0].canConfirm);
  assert.match(r.riskRows[0].reasons[0], /اختلفت القراءتان في \(المبلغ\)/);
});

test('محرك واحد، وخطأ الضرب يُدرج بلا زر مطابقة، والفقرة المصحَّحة باللجنة تُستبعد', () => {
  const p = mk([
    row('1', 500, { readBy: 'ai', quantity: 2, enteredUnitPrice: 100, bidderUnitPrice: 100 }),
    row('2', 300, { readBy: 'ai', readCheck: diff, bidderTotal: 400 }) // المعتمد يخالف المدوَّن: قرار لجنة
  ]);
  const r = readingReliability(p.bidders[0])!;
  assert.equal(r.engine, 'ai');
  assert.deepEqual(r.riskRows.map(x => x.itemNo), ['1']);
  assert.equal(r.riskRows[0].canConfirm, false);
});

test('handleCorrectReading يضع readCorrected ويمسح readCheck، وhandleConfirmReadCheck يمسحه ويسجّل', () => {
  const project = mk([row('1', 500, { readBy: 'ai', readCheck: diff }), row('2', 600, { readBy: 'ai', readCheck: diff })]);
  let saved!: TenderProject;
  const drive = (p: TenderProject) => createItemHandlers(createEditContext(p, p.bidders[0], (fn: any) => { saved = fn([p])[0]; }));
  drive(project).handleCorrectReading(0, 'total', 450);
  assert.equal(saved.bidders[0].items[0].readCorrected, true);
  assert.equal(saved.bidders[0].items[0].readCheck, undefined);
  assert.ok(saved.bidders[0].items[1].readCheck);
  drive(project).handleConfirmReadCheck(1);
  const it = saved.bidders[0].items[1];
  assert.equal(it.readCheck, undefined);
  assert.equal(it.bidderTotal, 600);
  assert.equal(saved.auditLogs[saved.auditLogs.length - 1].action, 'مطابقة قراءة بالورقة');
});

test('استيراد bidder_only ينقل readBy وreadCheck إلى الفقرة المخزّنة', () => {
  const project = mk([row('1', 0), row('2', 0)]);
  let saved!: TenderProject;
  const ctx = createEditContext(project, project.bidders[0], (fn: any) => { saved = fn([project])[0]; });
  createImportHandlers(ctx).handleApplyExtractedItems([
    { itemNo: '1', quantity: 1, enteredUnitPrice: 90, enteredBidderTotal: 90, bidderTotal: 90, readBy: 'ai', readCheck: diff },
    { itemNo: '2', quantity: 1, enteredUnitPrice: 80, enteredBidderTotal: 80, bidderTotal: 80, readBy: 'ai' }
  ] as any, 'bidder_only');
  const items = (saved.bidders[0] as Bidder).items;
  assert.equal(items[0].readBy, 'ai');
  assert.deepEqual(items[0].readCheck, diff);
  assert.equal(items[1].readCheck, undefined);
});

// قيد سجل التدقيق عند اختيار مجهز للترسية: حال التصحيح والتوقيع (createBidderHandlers في src/app/bidderHandlers.ts)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateBOQMetrics } from '../src/utils/calculations';
import { createNewTenderProject } from '../src/utils/storageService';
import { createEditContext } from '../src/app/editContext';
import { createBidderHandlers } from '../src/app/bidderHandlers';
import { Bidder, BOQItem, TenderProject } from '../src/types/tender';

(globalThis as any).window = { alert: () => {}, confirm: () => true };

const SIGNED = '2026-10-18T09:00:00.000Z';
// فقرة صحّحتها اللجنة باعتماد حاصل الضرب: 100 × 50 = 5,000 بدل 5,500 المدون
const corrected = (itemNo: string, signed: boolean): Partial<BOQItem> => ({
  itemNo, quantity: 100, estimatedTotal: 5000,
  enteredUnitPrice: 50, bidderUnitPrice: 50, enteredBidderTotal: 5500, bidderTotal: 5000, hasMathError: false,
  ...(signed ? { bidderSignedAt: SIGNED } : {})
});
const clean: Partial<BOQItem> = { itemNo: '9', quantity: 10, estimatedTotal: 1000, enteredUnitPrice: 100, bidderUnitPrice: 100, enteredBidderTotal: 1000, bidderTotal: 1000 };
const mk = (id: string, rows: Partial<BOQItem>[]): Bidder => {
  const c = calculateBOQMetrics(rows, 20);
  return { id, name: id, submissionDate: '2026-01-01', items: c.items, totals: c.totals, status: 'pending' };
};
const project = (): TenderProject => ({
  ...createNewTenderProject({ title: 'ت', referenceNumber: '1', contractType: 'works', bidderNames: ['x'] }),
  bidders: [mk('A', [corrected('20', true), corrected('21', false), clean]), mk('B', [clean])],
  activeBidderId: 'A'
});
const select = (id: string) => {
  const p = project();
  let saved: TenderProject | undefined;
  const ctx = createEditContext(p, p.bidders[0], (fn: any) => { saved = fn([p])[0]; });
  createBidderHandlers(ctx, { closeSettings: () => {} }).handleUpdateBidderStatus(id, 'recommended');
  assert.ok(saved);
  return saved.auditLogs[0];
};

test('اختيار مجهز فيه تصحيح للترسية: القيد يذكر التصحيحات والتوقيع وغير الموقّع', () => {
  const log = select('A');
  assert.match(log.details, /وعند اختياره للترسية: صحّحت اللجنة \(2\) فقرة/);
  assert.match(log.details, /ووقّع المجهز وختم إزاء \(1\) منها/);
  assert.match(log.details, /ولم يُؤشَّر توقيعه إزاء الفقرة: 21/);
});

test('اختيار مجهز بلا تصحيح لا يضيف العبارة', () => {
  assert.doesNotMatch(select('B').details, /وعند اختياره للترسية/);
});

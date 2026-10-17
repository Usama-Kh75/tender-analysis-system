// توقيع المجهز وختمه إزاء تصحيح اللجنة الحسابي (ضوابط رقم (4) خامساً/ب/3)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateBOQMetrics } from '../src/utils/calculations';
import { correctionSignatures, isSignedCorrection } from '../src/utils/bidderAuditEngine';
import { buildBidderAuditWorkbook } from '../src/utils/bidderAuditExcel';
import type { BOQItem, Bidder, TenderProject } from '../src/types/tender';

// الفقرة 277 بعد ب/2: المفرد 2,160 صار 21,600 × 240 = 5,184,000
const row277: Partial<BOQItem> = {
  itemNo: '277', quantity: 240, estimatedTotal: 4320000,
  originalUnitPrice: 2160, enteredUnitPrice: 21600, bidderUnitPrice: 21600,
  enteredBidderTotal: 5184000, bidderTotal: 5184000, hasMathError: false
};
// الفقرة 20: اعتماد حاصل الضرب 100 × 50 = 5,000 بدل 5,500 المدون
const row20: Partial<BOQItem> = {
  itemNo: '20', quantity: 100, estimatedTotal: 5000,
  enteredUnitPrice: 50, bidderUnitPrice: 50, enteredBidderTotal: 5500, bidderTotal: 5000, hasMathError: false
};
const clean: Partial<BOQItem> = {
  itemNo: '21', quantity: 10, estimatedTotal: 1000, enteredUnitPrice: 100, bidderUnitPrice: 100,
  enteredBidderTotal: 1000, bidderTotal: 1000
};
const SIGNED = '2026-10-18T09:00:00.000Z';
const recalc = (rows: Partial<BOQItem>[]) => calculateBOQMetrics(rows, 20).items;

test('الحقل يبقى بعد إعادة الحساب', () => {
  const [item] = recalc([{ ...row277, bidderSignedAt: SIGNED }]);
  assert.equal(item.bidderSignedAt, SIGNED);
  assert.equal(isSignedCorrection(item), true);
});

test('توقيع على فقرة لم تصحّحها اللجنة لا يُحسب', () => {
  const [item] = recalc([{ ...clean, bidderSignedAt: SIGNED }]);
  assert.equal(isSignedCorrection(item), false);
});

test('خلاصة العطاء: المصحَّحة والموقَّعة وأرقام ما بقي بلا توقيع', () => {
  const items = recalc([{ ...row20 }, clean, { ...row277, bidderSignedAt: SIGNED }]);
  assert.deepEqual(correctionSignatures(items), { corrected: 2, signed: 1, unsigned: ['20'] });
  assert.deepEqual(correctionSignatures(recalc([clean])), { corrected: 0, signed: 0, unsigned: [] });
});

const bidderOf = (items: BOQItem[]): Bidder => ({
  id: 'b1', name: 'المجهز', submissionDate: '', status: 'pending', items,
  totals: calculateBOQMetrics(items, 20).totals
});
const projectOf = (bidder: Bidder): TenderProject => ({
  id: 'p1', title: 'مناقصة', referenceNumber: '', entityName: '', committeeChairman: '', committeeMembers: [],
  currency: 'د.ع', deviationThreshold: 20, activeBidderId: bidder.id, bidders: [bidder], auditLogs: [
    { id: 'l1', timestamp: '', userName: '', action: 'اعتماد المبلغ وتصحيح سعر المفرد لخطأ فادح في العلامة العشرية', details: '', itemNo: '277', bidderId: 'b1', newValue: 5184000 },
    { id: 'l2', timestamp: '', userName: '', action: 'اعتماد تصحيح خطأ الضرب بقرار اللجنة', details: '', itemNo: '20', bidderId: 'b1', newValue: 5000 }
  ], createdAt: '', updatedAt: ''
});
const cellText = (ws: Record<string, any>, row: number, col: number) =>
  String(ws[String.fromCharCode(65 + col) + row]?.v ?? '');

test('Excel: «قرار اللجنة» في أخطاء المجهز و«التصحيح المعتمد» يذكران حالة التوقيع', () => {
  const bidder = bidderOf(recalc([{ ...row20 }, { ...row277, bidderSignedAt: SIGNED }]));
  const wb = buildBidderAuditWorkbook(projectOf(bidder), bidder);
  const errors = wb.Sheets['أخطاء المجهز'];
  // الصف 6 أول بيانات، والعمود K (10) «قرار اللجنة»
  const decision20 = cellText(errors, 6, 10);
  const decision277 = cellText(errors, 7, 10);
  assert.match(decision20, /اعتماد حاصل ضرب/);
  assert.match(decision20, /بانتظار توقيع المجهز/);
  assert.match(decision277, /وقّع المجهز وختم إزاء التصحيح/);
  const adjusted = wb.Sheets['الجدول المعدل'];
  // العمود O (14) «التصحيح المعتمد»
  assert.match(cellText(adjusted, 7, 14), /وقّع المجهز وختم إزاء التصحيح/);
  assert.match(cellText(adjusted, 6, 14), /بانتظار توقيع المجهز/);
});

test('Excel: فقرة لم تحسمها اللجنة يبقى «قرار اللجنة» فارغاً للتعبئة', () => {
  const pending = { ...row20, bidderTotal: 5500, hasMathError: true };
  const bidder = bidderOf(recalc([pending]));
  const wb = buildBidderAuditWorkbook(projectOf(bidder), bidder);
  assert.equal(cellText(wb.Sheets['أخطاء المجهز'], 6, 10), '');
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateBOQMetrics } from '../src/utils/calculations';
import { buildBidderAuditWorkbook } from '../src/utils/bidderAuditExcel';
import type { Bidder, TenderProject } from '../src/types/tender';

const make = (withPages: boolean, withOffer: boolean) => {
  const { items, totals } = calculateBOQMetrics([
    { itemNo: 1, description: 'أ', quantity: 2, estimatedTotal: 1000, bidderTotal: 1100, enteredUnitPrice: 550, enteredBidderTotal: 1100,
      pageNo: withPages ? 1 : undefined, offerUnitPrice: withOffer ? 600 : undefined, offerTotal: withOffer ? 1200 : undefined },
    { itemNo: 2, description: 'ب', quantity: 1, estimatedTotal: 500, bidderTotal: 480, enteredUnitPrice: 480, enteredBidderTotal: 480,
      pageNo: withPages ? 2 : undefined, offerUnitPrice: withOffer ? 380 : undefined, offerTotal: withOffer ? 380 : undefined }
  ], 20);
  const bidder: Bidder = { id: 'b', name: 'شركة', submissionDate: '', items, totals, status: 'pending',
    weightedOffer: withOffer ? { status: 'adopted', origin: 'corrected', startedAt: '', bidTotal: 1580 } : undefined };
  const project = { title: 'م', referenceNumber: '', entityName: '', deviationThreshold: 20, bidders: [bidder], auditLogs: [] } as unknown as TenderProject;
  return buildBidderAuditWorkbook(project, bidder);
};

test('ورقة ملخص الصفحات تظهر مع الصفحات فقط، ومجموعها مجموع العطاء', () => {
  assert.ok(!make(false, false).SheetNames.includes('ملخص الصفحات'));
  const wb = make(true, true);
  assert.ok(wb.SheetNames.includes('ملخص الصفحات'));
  const ws = wb.Sheets['ملخص الصفحات'];
  const values = Object.values(ws).filter((c: any) => c && c.t === 'n').map((c: any) => c.v);
  assert.ok(values.includes(1580));
});

test('ورقة اعتماد العرض الموزون تظهر مع العرض فقط، بأعمدة الوصف والوحدة والكمية ومفرد العرض ومبلغه', () => {
  assert.ok(!make(false, false).SheetNames.includes('اعتماد العرض الموزون'));
  const ws = make(false, true).Sheets['اعتماد العرض الموزون'] as any;
  assert.ok(ws);
  const text = Object.values(ws).map((c: any) => c?.v).filter(v => typeof v === 'string');
  for (const h of ['وصف الفقرة', 'الوحدة', 'الكمية', 'مفرد العرض الموزون', 'مبلغ العرض الموزون']) assert.ok(text.includes(h), h);
  // أسعار العرض لا أسعار المجهز: مفرد 600 ومبلغ 1200، ثم 380 و380؛ المجموع 1580 بصيغة SUM
  assert.equal(ws.E6.v, 600); assert.equal(ws.F6.v, 1200);
  assert.equal(ws.E7.v, 380); assert.equal(ws.F7.v, 380);
  assert.equal(ws.F9.v, 1580); assert.equal(ws.F9.f, 'SUM(F6:F7)');
  // لا أعمدة تخمين ولا انحراف في ورقة المجهز
  for (const h of ['المفرد التخميني', 'نسبة الانحراف', 'التصحيح المعتمد']) assert.ok(!text.includes(h), h);
});

test('ورقة الاعتماد: مفرد العرض غير مقرّب، وغير المسعّرة التي سُعّرت في العرض تظهر بسعرها', () => {
  const { items, totals } = calculateBOQMetrics([
    { itemNo: 1, description: 'أ', quantity: 1000, estimatedTotal: 300000, bidderTotal: 333335, enteredUnitPrice: 333.335, enteredBidderTotal: 333335,
      offerUnitPrice: 333.335, offerTotal: 333335 },
    { itemNo: 2, description: 'ب', quantity: 1, estimatedTotal: 500, bidderTotal: 0, unpriced: true, offerUnitPrice: 450, offerTotal: 450 },
    { itemNo: 3, description: 'ج', quantity: 1, estimatedTotal: 500, bidderTotal: 0, unpriced: true }
  ], 20);
  const bidder: Bidder = { id: 'b', name: 'شركة', submissionDate: '', items, totals, status: 'pending',
    weightedOffer: { status: 'adopted', origin: 'corrected', startedAt: '', bidTotal: totals.totalBidderAmount } };
  const project = { title: 'م', referenceNumber: '', entityName: '', deviationThreshold: 20, bidders: [bidder], auditLogs: [] } as unknown as TenderProject;
  const ws = buildBidderAuditWorkbook(project, bidder).Sheets['اعتماد العرض الموزون'] as any;
  assert.equal(ws.E6.v, 333.335);            // بلا تقريب إلى 333.34
  assert.equal(ws.F6.v, 333335);
  assert.equal(ws.E7.v, 450); assert.equal(ws.F7.v, 450);   // سُعّرت في العرض فلا شرطة
  assert.equal(ws.E8.v, '-'); assert.equal(ws.F8.v, '-');   // لم تُسعَّر في العرض
});

test('الجدول المعدل يضم عمودي العرض الموزون حين يوجد عرض', () => {
  const header = (wb: ReturnType<typeof make>) => Object.values(wb.Sheets['الجدول المعدل']).map((c: any) => c?.v).filter(v => typeof v === 'string');
  assert.ok(header(make(false, true)).includes('مبلغ العرض الموزون'));
  assert.ok(!header(make(false, false)).includes('مبلغ العرض الموزون'));
});

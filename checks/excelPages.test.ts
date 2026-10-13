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

test('الجدول المعدل يضم عمودي العرض الموزون حين يوجد عرض', () => {
  const header = (wb: ReturnType<typeof make>) => Object.values(wb.Sheets['الجدول المعدل']).map((c: any) => c?.v).filter(v => typeof v === 'string');
  assert.ok(header(make(false, true)).includes('مبلغ العرض الموزون'));
  assert.ok(!header(make(false, false)).includes('مبلغ العرض الموزون'));
});

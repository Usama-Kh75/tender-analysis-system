// مسائل صغيرة مؤجلة من مراجعة v1.15.0: الأرقام الهندية في فواصل الصفحات، و«نهائي» لا يُقال عن عرض متقادم
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateBOQMetrics } from '../src/utils/calculations';
import { buildBidderAuditWorkbook } from '../src/utils/bidderAuditExcel';
import { resolvePageNumbers, resolvePageStarts } from '../src/utils/pageSummary';
import type { Bidder, TenderProject } from '../src/types/tender';

const build = (bidTotal: number) => {
  const { items, totals } = calculateBOQMetrics([
    { itemNo: 1, description: 'أ', quantity: 2, estimatedTotal: 1000, bidderTotal: 1100, enteredUnitPrice: 550, enteredBidderTotal: 1100, pageNo: 1, offerUnitPrice: 600, offerTotal: 1200 },
    { itemNo: 2, description: 'ب', quantity: 1, estimatedTotal: 500, bidderTotal: 480, enteredUnitPrice: 480, enteredBidderTotal: 480, pageNo: 2, offerUnitPrice: 380, offerTotal: 380 }
  ], 20);
  const bidder: Bidder = { id: 'b', name: 'شركة', submissionDate: '', items, totals, status: 'pending',
    weightedOffer: { status: 'adopted', origin: 'corrected', startedAt: '', bidTotal } };
  const project = { title: 'م', referenceNumber: '', entityName: '', deviationThreshold: 20, bidders: [bidder], auditLogs: [] } as unknown as TenderProject;
  return buildBidderAuditWorkbook(project, bidder);
};
const pagesNote = (wb: ReturnType<typeof build>) => String((wb.Sheets['ملخص الصفحات'] as any).A3.v);

test('ورقة الصفحات: عرض معتمد غير متقادم نهائي، والمتقادم «غير نهائي»', () => {
  assert.ok(!pagesNote(build(1580)).includes('غير نهائي'));
  assert.ok(pagesNote(build(1000)).includes('غير نهائي'));
});

test('فواصل الصفحات: رقم الفقرة ورقم الصفحة بالأرقام الهندية', () => {
  const items = [{ itemNo: '26' }, { itemNo: '27' }, { itemNo: '٢٨' }] as any[];
  assert.deepEqual(resolvePageStarts(items, ['26', '٢٧']), { starts: [0, 1] });
  assert.deepEqual(resolvePageStarts(items, ['26', '28']), { starts: [0, 2] });
  assert.deepEqual(resolvePageNumbers(['١', '٢']), { numbers: [1, 2] });
});

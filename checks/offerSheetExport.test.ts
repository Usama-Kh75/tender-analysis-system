import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateBOQMetrics } from '../src/utils/calculations';
import { buildOfferApprovalWorkbook, offerSheetTarget } from '../src/utils/bidderAuditExcel';
import type { Bidder, BOQItem, TenderProject, WeightedOfferState } from '../src/types/tender';

const raw: Partial<BOQItem>[] = [
  { itemNo: 1, description: 'أ', quantity: 2, estimatedTotal: 1000, bidderTotal: 1100, enteredUnitPrice: 550, enteredBidderTotal: 1100 },
  { itemNo: 2, description: 'ب', quantity: 1, estimatedTotal: 500, bidderTotal: 480, enteredUnitPrice: 480, enteredBidderTotal: 480 }
];
const offer = (status: WeightedOfferState['status']): WeightedOfferState =>
  ({ status, origin: 'corrected', startedAt: '2026-10-10', bidTotal: 1580 });
const mk = (id: string, name: string, extra: Partial<Bidder> = {}): Bidder => {
  const { items, totals } = calculateBOQMetrics(raw, 20);
  return { id, name, submissionDate: '2026-10-10', items, totals, status: 'pending', ...extra };
};
const proj = (bidders: Bidder[]): TenderProject => ({
  id: 'p', title: 'مناقصة', deviationThreshold: 20, currency: 'IQD', bidders, auditLogs: []
} as unknown as TenderProject);

test('المصنف: null بلا عرض أو مع عرض موقوف، وورقة واحدة مع عرض فعّال', () => {
  assert.equal(buildOfferApprovalWorkbook(proj([mk('a', 'أ')]), mk('a', 'أ')), null);
  const paused = mk('a', 'أ', { weightedOffer: offer('paused') });
  assert.equal(buildOfferApprovalWorkbook(proj([paused]), paused), null);
  const b = mk('a', 'أ', { weightedOffer: offer('active') });
  const wb = buildOfferApprovalWorkbook(proj([b]), b)!;
  assert.deepEqual(wb.SheetNames, ['اعتماد العرض الموزون']);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const cells = Object.values(ws).map((c: any) => c && c.v).filter(Boolean);
  for (const h of ['ت', 'وصف الفقرة', 'مبلغ العرض الموزون']) assert.ok(cells.includes(h), h);
});

test('هدف الورقة: أسباب التعطيل والمجهز عند الصلاحية', () => {
  assert.match(offerSheetTarget(proj([])).reason!, /لا عطاء موصى به/);
  assert.match(offerSheetTarget(proj([mk('a', 'شركة أ')])).reason!, /لا عرض موزون.*شركة أ/);
  assert.match(offerSheetTarget(proj([mk('a', 'أ', { weightedOffer: offer('paused') })])).reason!, /موقوف/);
  const ok = offerSheetTarget(proj([mk('a', 'أ', { weightedOffer: offer('active') })]));
  assert.equal(ok.bidder?.id, 'a');
  assert.equal(ok.reason, undefined);
});

// مجهز بمبلغ الفقرة الواحدة المعطى (الكلفة التخمينية 1000): 1300 = +30% (إحالة)، 500 = -50% (إعادة طرح)
const mkAmount = (id: string, name: string, amount: number, extra: Partial<Bidder> = {}): Bidder => {
  const { items, totals } = calculateBOQMetrics(
    [{ itemNo: 1, description: 'أ', quantity: 1, estimatedTotal: 1000, bidderTotal: amount, enteredUnitPrice: amount, enteredBidderTotal: amount }], 20);
  return { id, name, submissionDate: '2026-10-10', items, totals, status: 'pending', ...extra };
};

test('هدف الورقة: لا مجهز في الإحالة ولا إعادة الطرح ولا التعادل ولا غير المؤهل', () => {
  const withOffer = { weightedOffer: offer('active') };
  const referral = offerSheetTarget(proj([mkAmount('a', 'أ', 1300, withOffer)]));
  assert.equal(referral.bidder, undefined);
  assert.match(referral.reason!, /لا عطاء موصى به/);
  const retender = offerSheetTarget(proj([mkAmount('a', 'أ', 500, withOffer)]));
  assert.equal(retender.bidder, undefined);
  assert.match(retender.reason!, /لا عطاء موصى به/);
  const tie = offerSheetTarget(proj([mkAmount('a', 'أ', 1000, withOffer), mkAmount('b', 'ب', 1000, withOffer)]));
  assert.equal(tie.bidder, undefined);
  assert.match(tie.reason!, /تعادل/);
  // بعد اختيار اللجنة يصير المختار هو الهدف حتى مع التعادل
  const chosen = offerSheetTarget(proj([mkAmount('a', 'أ', 1000, withOffer), mkAmount('b', 'ب', 1000, { ...withOffer, status: 'recommended' })]));
  assert.equal(chosen.bidder?.id, 'b');
});

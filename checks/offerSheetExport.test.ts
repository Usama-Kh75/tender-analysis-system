import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateBOQMetrics } from '../src/utils/calculations';
import { offerSheetTarget } from '../src/utils/bidderAuditExcel';
import { buildTenderWorkbook, WEIGHTED_SHEET } from '../src/utils/excelService';
import type { Bidder, TenderProject, WeightedOfferState } from '../src/types/tender';

const raw = [
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
  id: 'p', title: 'مناقصة', referenceNumber: '5 / 26 / 100', deviationThreshold: 20, currency: 'IQD', bidders, auditLogs: []
} as unknown as TenderProject);

// مجهز بمبلغ الفقرة الواحدة المعطى (الكلفة التخمينية 1000): 1300 = +30% (إحالة)، 500 = -50% (إعادة طرح)
const mkAmount = (id: string, name: string, amount: number, extra: Partial<Bidder> = {}): Bidder => {
  const { items, totals } = calculateBOQMetrics(
    [{ itemNo: 1, description: 'أ', quantity: 1, estimatedTotal: 1000, bidderTotal: amount, enteredUnitPrice: amount, enteredBidderTotal: amount }], 20);
  return { id, name, submissionDate: '2026-10-10', items, totals, status: 'pending', ...extra };
};

test('مصنف الخلاصة: «الجدول الموزون» أولى الأوراق مع عرض فعّال وتبقى بقية الأوراق', () => {
  const a = mkAmount('a', 'أ', 900, { weightedOffer: offer('active') });
  const b = mkAmount('b', 'ب', 1000);
  const p = proj([a, b]);
  const wb = buildTenderWorkbook(p, a);
  assert.deepEqual(wb.SheetNames, [WEIGHTED_SHEET, 'أ', 'ب', 'مقارنة المجهزين']);
  assert.equal(WEIGHTED_SHEET, 'الجدول الموزون');
  const ws = wb.Sheets[WEIGHTED_SHEET];
  const cells = Object.values(ws).map((c: any) => c && c.v).filter(Boolean);
  for (const h of ['ت', 'وصف الفقرة', 'مفرد العرض الموزون', 'مبلغ العرض الموزون']) assert.ok(cells.includes(h), h);
  assert.ok(cells.some(v => typeof v === 'string' && v.includes('أ') && v.includes('مناقصة') && v.includes('5 / 26 / 100')), 'العنوان');
  // لا تنسيق علمي E+ في أي خلية، والمجموع بصيغة SUM
  for (const [k, c] of Object.entries(ws) as [string, any][]) {
    if (k.startsWith('!') || !c) continue;
    if (c.z) assert.ok(!/E\+/i.test(c.z), `${k}: ${c.z}`);
  }
  assert.ok(Object.values(ws).some((c: any) => c && typeof c.f === 'string' && c.f.startsWith('SUM(')));
  assert.equal((wb.Workbook as any).Views[0].RTL, true);
});

test('مصنف الخلاصة: لا ورقة موزونة بلا عرض أو مع عرض موقوف، والمصنف كما كان', () => {
  const none = mk('a', 'أ');
  assert.deepEqual(buildTenderWorkbook(proj([none]), none).SheetNames, ['أ']);
  const paused = mk('a', 'أ', { weightedOffer: offer('paused') });
  assert.deepEqual(buildTenderWorkbook(proj([paused]), paused).SheetNames, ['أ']);
});

test('هدف الورقة: المجهز عند الصلاحية، وغيابه بلا عرض أو موقوف', () => {
  assert.equal(offerSheetTarget(proj([])).bidder, undefined);
  assert.equal(offerSheetTarget(proj([mk('a', 'شركة أ')])).bidder, undefined);
  assert.equal(offerSheetTarget(proj([mk('a', 'أ', { weightedOffer: offer('paused') })])).bidder, undefined);
  assert.equal(offerSheetTarget(proj([mk('a', 'أ', { weightedOffer: offer('active') })])).bidder?.id, 'a');
});

test('لا ورقة موزونة في الإحالة ولا إعادة الطرح ولا التعادل، وتُكتب بعد اختيار اللجنة', () => {
  const withOffer = { weightedOffer: offer('active') };
  const referral = proj([mkAmount('a', 'أ', 1300, withOffer)]);
  assert.equal(offerSheetTarget(referral).bidder, undefined);
  assert.ok(!buildTenderWorkbook(referral, referral.bidders[0]).SheetNames.includes(WEIGHTED_SHEET));
  const retender = proj([mkAmount('a', 'أ', 500, withOffer)]);
  assert.equal(offerSheetTarget(retender).bidder, undefined);
  assert.ok(!buildTenderWorkbook(retender, retender.bidders[0]).SheetNames.includes(WEIGHTED_SHEET));
  const tie = proj([mkAmount('a', 'أ', 1000, withOffer), mkAmount('b', 'ب', 1000, withOffer)]);
  assert.equal(offerSheetTarget(tie).bidder, undefined);
  assert.ok(!buildTenderWorkbook(tie, tie.bidders[0]).SheetNames.includes(WEIGHTED_SHEET));
  const chosen = proj([mkAmount('a', 'أ', 1000, withOffer), mkAmount('b', 'ب', 1000, { ...withOffer, status: 'recommended' })]);
  assert.equal(offerSheetTarget(chosen).bidder?.id, 'b');
  assert.equal(buildTenderWorkbook(chosen, chosen.bidders[0]).SheetNames[0], WEIGHTED_SHEET);
});

// عطاء يلزمه التوزين: فقرتان من ثلاث منحرفتان للأعلى فوق 20% (أكثر من 10% من الفقرات) والانحراف الكلي دون حد الاستبعاد
const weightingRaw = [
  { itemNo: 1, description: 'أ', quantity: 1, estimatedTotal: 1000, bidderTotal: 1300, enteredUnitPrice: 1300, enteredBidderTotal: 1300 },
  { itemNo: 2, description: 'ب', quantity: 1, estimatedTotal: 1000, bidderTotal: 1300, enteredUnitPrice: 1300, enteredBidderTotal: 1300 },
  { itemNo: 3, description: 'ج', quantity: 1, estimatedTotal: 1000, bidderTotal: 800, enteredUnitPrice: 800, enteredBidderTotal: 800 }
];
const mkWeighting = (extra: Partial<Bidder> = {}): Bidder => {
  const { items, totals } = calculateBOQMetrics(weightingRaw, 20);
  return { id: 'w', name: 'نبض', submissionDate: '2026-10-10', items, totals, status: 'pending', ...extra };
};

test('بلا عرض موزون: الجدول الموزون بالمعادلة يُكتب حين يلزم التوزين كما في المحضر، وبقبول العطاء كما هو لا', () => {
  const w = mkWeighting();
  const p = proj([w]);
  const t = offerSheetTarget(p);
  assert.equal(t.bidder?.id, 'w');
  assert.equal(t.source, 'formula');
  const wb = buildTenderWorkbook(p, w);
  assert.equal(wb.SheetNames[0], WEIGHTED_SHEET);
  const ws = wb.Sheets[WEIGHTED_SHEET];
  const cells = Object.values(ws).map((c: any) => c && c.v).filter(Boolean);
  for (const h of ['ت', 'وصف الفقرة', 'المفرد الموزون', 'المبلغ الموزون']) assert.ok(cells.includes(h), h);
  const sum = Object.values(ws).find((c: any) => c && typeof c.f === 'string' && c.f.startsWith('SUM(')) as any;
  assert.equal(sum.v, w.items.reduce((s, i) => s + i.newPrice, 0));
  // قبول العطاء كما هو (حالة mk): لا ورقة
  assert.equal(offerSheetTarget(proj([mk('a', 'أ')])).source, undefined);
  // عرض موقوف يعود إلى المعادلة، وعرض فعّال يغلب المعادلة
  assert.equal(offerSheetTarget(proj([mkWeighting({ weightedOffer: offer('paused') })])).source, 'formula');
  assert.equal(offerSheetTarget(proj([mkWeighting({ weightedOffer: offer('active') })])).source, 'offer');
});

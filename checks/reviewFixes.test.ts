// فحوص جولة إصلاح المراجعة النهائية للفرع (v1.15.0)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { settleWeightedPrices } from '../src/utils/weightedRounding';
import { calculateBOQMetrics } from '../src/utils/calculations';
import { assessBalance, pauseOfferPatch, resumeOfferPatch, pricingClause } from '../src/utils/weightedOffer';
import { pagesFromStarts, resolvePageNumbers, startPages } from '../src/utils/pageSummary';
import { refreshWeightedPrices } from '../src/utils/storageService';
import type { Bidder, BOQItem, TenderProject } from '../src/types/tender';

const cents = (v: number) => Math.round(v * 100);

test('تسوية التقريب: تحريك متعاكس لفقرتين يغلق فلساً لا تغلقه فقرة واحدة', () => {
  // بعد التقريب: 1650×3.33 و1651×3.33؛ الهدف فلس زائد: +0.01 على 1651 (يزيد 16.51) و−0.01 على 1650 (ينقص 16.50)
  const items = [{ quantity: 1650, estimatedTotal: 1650 * 3.33 }, { quantity: 1651, estimatedTotal: 1651 * 3.33 }];
  const target = (1650 * 333 + 1651 * 333 + 1) / 100;
  const r = settleWeightedPrices(items, 1, target);
  assert.equal(r.residual, 0);
  assert.equal(cents(r.total), cents(target));
  r.rows.forEach((row, k) => assert.equal(cents(row.amount), Math.round(items[k].quantity * cents(row.unitPrice))));
});

test('تسوية التقريب: كميات كبيرة متقاربة تُسوّى إلى أقل من 0.02', () => {
  const qs = [1650, 1651, 2400, 1800, 5000, 3200, 1750, 2600];
  const items = qs.map((quantity, k) => ({ quantity, estimatedTotal: quantity * (3.1 + k * 0.37) }));
  const est = items.reduce((s, i) => s + i.estimatedTotal, 0);
  for (const target of [est * 1.0731, est * 0.9417, est * 1.1109]) {
    const t = Math.round(target * 100) / 100;
    const r = settleWeightedPrices(items, t / est, t);
    assert.ok(Math.abs(r.residual) < 0.02, `الباقي ${r.residual}`);
  }
});

test('التوازن: النسبة تُقارَن بالعدد لا بالمقرَّب (201 من 2009 تتجاوز 10%)', () => {
  const rows = Array.from({ length: 2009 }, (_, k) => ({ description: `مادة ${k + 1}`, estimatedTotal: 100, amount: k < 201 ? 130 : 100 }));
  const a = assessBalance(rows, 20);
  assert.equal(a.unbalancedCount, 201);
  assert.equal(a.verdict, 'weighting-required');
});

const item = (p: Partial<BOQItem>): BOQItem => ({ quantity: 1, bidderTotal: 100, newPrice: 120, weightedUnitPrice: 120, ...p } as BOQItem);

test('إيقاف العرض: الفقرة التي لم تُعدَّل تُسقط حقول العرض لتتبع المبلغ بعد التصحيح', () => {
  const same = item({ offerUnitPrice: 100, offerTotal: 100 });
  assert.deepEqual(pauseOfferPatch(same, 'corrected'), { offerUnitPrice: undefined, offerTotal: undefined });
  const edited = item({ offerUnitPrice: 90, offerTotal: 90 });
  assert.deepEqual(pauseOfferPatch(edited, 'corrected'), { offerUnitPrice: 90, offerTotal: 90 });
  // عرض المعادلة: خط الأساس الأسعار الموزونة لا المبلغ بعد التصحيح
  const formulaSame = item({ offerUnitPrice: 120, offerTotal: 120 });
  assert.deepEqual(pauseOfferPatch(formulaSame, 'formula'), { offerUnitPrice: undefined, offerTotal: undefined });
  assert.deepEqual(pauseOfferPatch(item({ offerUnitPrice: 100, offerTotal: 100 }), 'formula'), { offerUnitPrice: 100, offerTotal: 100 });
});

test('استئناف العرض: المعدَّل يبقى، وبالمعادلة تُملأ الفقرات الساقطة من الأسعار الموزونة الحالية', () => {
  assert.deepEqual(resumeOfferPatch(item({ offerUnitPrice: 90, offerTotal: 90 }), 'corrected'), { offerUnitPrice: 90, offerTotal: 90 });
  assert.deepEqual(resumeOfferPatch(item({}), 'corrected'), { offerUnitPrice: undefined, offerTotal: undefined });
  assert.deepEqual(resumeOfferPatch(item({}), 'formula'), { offerUnitPrice: 120, offerTotal: 120 });
});

test('صياغة المحضر: لا تُنسب إلى سادساً/5 ما لا تقوله', () => {
  assert.match(pricingClause('accept-as-is', { final: true, origin: 'corrected' }), /بقرار اللجنة/);
  assert.match(pricingClause('accept-as-is', { final: false }), /كما هي/);
  assert.match(pricingClause('weighting-required', { final: true, origin: 'corrected' }), /المسعّر من جهة التعاقد معدلاً بنسبة مبلغ العطاء/);
  assert.notEqual(pricingClause('weighting-required', { final: true, origin: 'corrected' }), pricingClause('weighting-required', { final: true, origin: 'formula' }));
  assert.match(pricingClause('weighting-required', { final: false }), /ختم الجداول المعدلة/);
});

test('أرقام الصفحات: تُحفظ كما هي ولا تُعاد من 1', () => {
  assert.deepEqual(pagesFromStarts(5, [0, 2, 4], [2, 3, 7]), [2, 2, 3, 3, 7]);
  assert.deepEqual(pagesFromStarts(4, [0, 2]), [1, 1, 2, 2]);
  assert.deepEqual(resolvePageNumbers(['2', '3', '7']), { numbers: [2, 3, 7] });
  assert.ok('error' in resolvePageNumbers(['2', '2']));
  assert.ok('error' in resolvePageNumbers(['3', '2']));
  assert.ok('error' in resolvePageNumbers(['0']));
  assert.ok('error' in resolvePageNumbers(['x']));
  const its = [2, 2, 3, 7].map((pageNo, k) => ({ itemNo: String(k + 1), pageNo })) as BOQItem[];
  assert.deepEqual(startPages(its), [2, 3, 7]);
});

test('تحميل مشروع قديم: تُعاد الأسعار الموزونة المقرّبة دون مس أي مبلغ أو علامة', () => {
  const { items, totals } = calculateBOQMetrics([
    { itemNo: 1, description: 'أ', quantity: 3, estimatedTotal: 100, bidderTotal: 400, hasMathError: true },
    { itemNo: 2, description: 'ب', quantity: 1, estimatedTotal: 100, bidderTotal: 300 },
    { itemNo: 3, description: 'ج', quantity: 3, estimatedTotal: 100, bidderTotal: 300 }
  ], 20);
  // كما كانت تُخزَّن قبل 1.15.0: أسعار غير مقرّبة وبلا باقٍ
  const legacyItems = items.map(i => ({ ...i, newPrice: 333.3333333, weightedUnitPrice: 111.1111111, weightedAdjustment: undefined }));
  const { weightedRoundingResidual: _r, ...legacyTotals } = totals;
  const bidder = { id: 'b', name: 'ش', submissionDate: '', items: legacyItems, totals: { ...legacyTotals, newPricesTotal: 1000.0000001 }, status: 'pending' } as Bidder;
  const project = { deviationThreshold: 20, bidders: [bidder], auditLogs: [] } as unknown as TenderProject;
  const out = refreshWeightedPrices(project).bidders[0];
  assert.equal(out.totals.newPricesTotal, out.totals.totalBidderAmount);
  assert.equal(out.totals.weightedRoundingResidual, 0);
  assert.equal(out.items.reduce((s, i) => s + i.newPrice, 0).toFixed(2), out.totals.totalBidderAmount.toFixed(2));
  assert.equal(out.items[0].hasMathError, true);
  assert.deepEqual(out.items.map(i => i.bidderTotal), [400, 300, 300]);
  // المحدَّث لا يُعاد حسابه
  assert.equal(refreshWeightedPrices({ ...project, bidders: [out] } as TenderProject).bidders[0], out);
});

test("أداء التسوية: ألفا فقرة بكميات كبيرة تُسوّى في أقل من ثانية", () => {
  const items = Array.from({ length: 2000 }, (_, k) => ({ quantity: 500 + ((k * 7919) % 4000), estimatedTotal: 5000 + ((k * 104729) % 900000) }));
  const est = items.reduce((s, i) => s + i.estimatedTotal, 0);
  const target = Math.round(est * 1.0371 * 100) / 100;
  const t0 = Date.now();
  const r = settleWeightedPrices(items, target / est, target);
  const ms = Date.now() - t0;
  assert.ok(ms < 1000, `استغرقت ${ms}ms`);
  assert.ok(Math.abs(r.residual) < 0.05, `الباقي ${r.residual}`);
});

// موانع الترسية (src/utils/awardBlockers.ts) وأساس المفاضلة وتنظيفه
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateBOQMetrics } from '../src/utils/calculations';
import { createNewTenderProject } from '../src/utils/storageService';
import { awardBlockers, needsAwardDialog } from '../src/utils/awardBlockers';
import { hasCompletePreferenceRecord, parseInitiativeValue, sanitizePreferenceInitiatives } from '../src/utils/preferenceBasis';

test('قيمة المبادرة: فارغة بلا قيمة، والأرقام الهندية وفواصل الآلاف تُقرأ، والنص غير الرقمي يُرفض لا يصير صفراً', () => {
  assert.equal(parseInitiativeValue('  '), undefined);
  assert.equal(parseInitiativeValue('٢٥٠٠'), 2500);
  assert.equal(parseInitiativeValue('1,250.5'), 1250.5);
  assert.equal(parseInitiativeValue('١٬٠٠٠'), 1000);
  assert.equal(parseInitiativeValue('0'), 0);
  assert.equal(parseInitiativeValue('abc'), null);
  assert.equal(parseInitiativeValue('-5'), null);
  assert.equal(parseInitiativeValue('12abc'), null);
});
import { preferenceInitiativeTypes } from '../src/utils/contractTypes';
import { createPreferenceHandlers } from '../src/app/preferenceHandlers';
import type { Bidder, BOQItem, PreferenceRecord, TenderProject } from '../src/types/tender';

const mkBidder = (id: string, total: number, status: Bidder['status'] = 'pending'): Bidder => {
  const each = total / 10;
  const rows: Partial<BOQItem>[] = Array.from({ length: 10 }, (_, i) => ({
    itemNo: i + 1, description: `فقرة ${i + 1}`, unit: 'عدد', quantity: 1, estimatedTotal: 100,
    enteredUnitPrice: each, enteredBidderTotal: each, bidderTotal: each
  }));
  const c = calculateBOQMetrics(rows, 20);
  return { id, name: id, submissionDate: '2026-01-01', items: c.items, totals: c.totals, status };
};
const mkProject = (bidders: Bidder[], extra: Partial<TenderProject> = {}): TenderProject => ({
  ...createNewTenderProject({ title: 'ت', referenceNumber: '1', contractType: 'works', budgetType: 'operating', bidderNames: ['x'] }),
  deviationThreshold: 20, currency: 'د.ع', bidders, activeBidderId: bidders[0].id, updatedAt: '2020-01-01T00:00:00.000Z', ...extra
});
// العلامات توضع مباشرة بعد الحساب
const flagged = (b: Bidder, patch: Partial<BOQItem>, n = 1): Bidder => ({ ...b, items: b.items.map((i, k) => (k < n ? { ...i, ...patch } : i)) });

test('خطأ ضرب أو تفقيط لم تُبتّ فيه في عطاء مؤهل غير المختار يمنع', () => {
  const p = mkProject([mkBidder('A', 900), flagged(mkBidder('B', 1000), { hasMathError: true }, 2)]);
  const r = awardBlockers(p, 'A');
  const b = r.blocks.find(x => x.kind === 'pendingErrors');
  assert.ok(b && b.kind === 'pendingErrors');
  assert.deepEqual(b.bidders, [{ id: 'B', name: 'B', count: 2 }]);
  assert.equal(b.firstBidderId, 'B');
  assert.equal(b.legalKey, 'ann4_5_b6');
  const t = mkProject([mkBidder('A', 900), flagged(mkBidder('B', 1000), { hasTextDiscrepancy: true })]);
  assert.ok(awardBlockers(t, 'A').blocks.some(x => x.kind === 'pendingErrors'));
});

test('الفقرة المصحَّحة أو غير المسعّرة أو عطاء مستبعد لا يمنع', () => {
  const corrected = { hasMathError: true, enteredBidderTotal: 5, bidderTotal: 90 };
  const p1 = mkProject([mkBidder('A', 900), flagged(mkBidder('B', 1000), corrected)]);
  assert.equal(awardBlockers(p1, 'A').blocks.length, 0);
  const p2 = mkProject([mkBidder('A', 900), flagged(mkBidder('B', 1000), { hasMathError: true, unpriced: true })]);
  assert.equal(awardBlockers(p2, 'A').blocks.length, 0);
  const p3 = mkProject([mkBidder('A', 900), flagged(mkBidder('B', 1000, 'disqualified'), { hasMathError: true })]);
  assert.equal(awardBlockers(p3, 'A').blocks.length, 0);
});

test('اختلاف القراءتين تنبيه لا مانع', () => {
  const p = mkProject([mkBidder('A', 900), flagged(mkBidder('B', 1000), { readCheck: true }, 3)]);
  const r = awardBlockers(p, 'A');
  assert.equal(r.blocks.length, 0);
  assert.deepEqual(r.warnings, [{ kind: 'readCheck', count: 3 }]);
  assert.equal(needsAwardDialog(r), true);
});

test('شركة مسجَّلة بلا مبالغ تمنع', () => {
  const empty: Bidder = mkBidder('E', 0);
  const r = awardBlockers(mkProject([mkBidder('A', 900), empty]), 'A');
  const b = r.blocks.find(x => x.kind === 'emptyBidders');
  assert.ok(b && b.kind === 'emptyBidders' && b.bidders[0].id === 'E');
});

test('العطاءات المتقاربة تتطلب سجلاً مكتملاً لكل منها', () => {
  const bids = [mkBidder('A', 900), mkBidder('B', 905)];
  const base = mkProject(bids);
  const j = (p: TenderProject) => awardBlockers(p, 'A').justify.find(x => x.kind === 'preference');
  const none = j(base);
  assert.ok(none && none.kind === 'preference' && !none.met);
  assert.equal(none.legalKey, 'ann5_works');
  const rec = (bidderId: string, hasInitiative: boolean, items: PreferenceRecord['items']): PreferenceRecord => ({ bidderId, hasInitiative, items });
  const ok = (items: PreferenceRecord['items']) => mkProject(bids, { preferenceInitiatives: [rec('A', false, []), rec('B', true, items)] });
  const yes = j(ok([{ type: 'مدة العقد', description: 'أقصر بشهر' }]));
  assert.ok(yes && yes.kind === 'preference' && yes.met);
  const noItems = j(ok([]));
  assert.ok(noItems && noItems.kind === 'preference' && !noItems.met);
  const blank = j(ok([{ type: 'مدة العقد', description: '  ' }]));
  assert.ok(blank && blank.kind === 'preference' && !blank.met);
  const missing = j(mkProject(bids, { preferenceInitiatives: [rec('A', false, [])] }));
  assert.ok(missing && missing.kind === 'preference' && !missing.met);
  assert.equal(hasCompletePreferenceRecord(base, 'A'), false);
  // وإن اكتمل السجل لا حاجة لنافذة
  const done = mkProject(bids, { preferenceInitiatives: [rec('A', false, []), rec('B', false, [])] });
  assert.equal(needsAwardDialog(awardBlockers(done, 'A')), false);
});

test('اختيار غير الأوطأ يتطلب مبرراً، والأوطأ بلا تقارب لا يتطلب', () => {
  const p = mkProject([mkBidder('A', 800), mkBidder('B', 1000)]);
  const r = awardBlockers(p, 'B');
  const n = r.justify.find(x => x.kind === 'notLowest');
  assert.ok(n && n.kind === 'notLowest' && n.lowest.id === 'A' && n.legalKey === 'art10_1_h');
  const low = awardBlockers(p, 'A');
  assert.equal(low.justify.length, 0);
  assert.equal(needsAwardDialog(low), false);
});

test('معالج أساس المفاضلة يحفظ بسجل واحد ويرفض مبادرة ناقصة', () => {
  const p = mkProject([mkBidder('A', 900), mkBidder('B', 905)]);
  let saved: TenderProject | undefined;
  const h = createPreferenceHandlers(p, x => { saved = x; });
  assert.ok(h.handleSavePreferenceInitiatives([{ bidderId: 'A', hasInitiative: true, items: [{ type: 'مدة العقد', description: '' }] }]));
  assert.equal(saved, undefined);
  assert.equal(h.handleSavePreferenceInitiatives([
    { bidderId: 'A', hasInitiative: false, items: [] },
    { bidderId: 'B', hasInitiative: true, items: [{ type: 'مدة الصيانة', description: 'سنتان', value: 5000 }] }
  ]), null);
  assert.equal(saved!.preferenceInitiatives!.length, 2);
  assert.equal(saved!.auditLogs.filter(l => l.action === 'تسجيل أساس المفاضلة').length, 1);
});

test('تنظيف أساس المفاضلة عند التحميل', () => {
  const p = mkProject([mkBidder('A', 900)]);
  assert.equal(sanitizePreferenceInitiatives(p), p);
  const bad = { ...p, preferenceInitiatives: 'x' as unknown as PreferenceRecord[] };
  assert.equal('preferenceInitiatives' in sanitizePreferenceInitiatives(bad), false);
  const mixed = { ...p, preferenceInitiatives: [
    null, 5, { bidderId: '' },
    { bidderId: 'A', hasInitiative: true, items: [{ type: 'نوع غير معروف', description: 'د', value: -3 }, { type: '', description: 'x' }, 'q', { type: 'مدة', description: 'ص', value: 7, completedOnRequest: true }] }
  ] as unknown as PreferenceRecord[] };
  const clean = sanitizePreferenceInitiatives(mixed);
  assert.deepEqual(clean.preferenceInitiatives, [{ bidderId: 'A', hasInitiative: true, items: [
    { type: 'نوع غير معروف', description: 'د' }, { type: 'مدة', description: 'ص', value: 7, completedOnRequest: true }] }]);
  assert.equal(sanitizePreferenceInitiatives(clean), clean);
});

test('أنواع المبادرات بحسب نوع العقد', () => {
  assert.deepEqual(preferenceInitiativeTypes('works'), ['مدة العقد', 'مدة الصيانة', 'مبادرة أخرى']);
  assert.equal(preferenceInitiativeTypes('supply').length, 4);
  assert.equal(preferenceInitiativeTypes(undefined).at(-1), 'مبادرة أخرى');
});

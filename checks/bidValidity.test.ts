// نفاذية العطاءات (src/utils/bidValidity.ts): عرض فقط
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateBOQMetrics } from '../src/utils/calculations';
import { createNewTenderProject } from '../src/utils/storageService';
import { addDays, bidExpiry, sanitizeBidValidity, validityAlert, validityMissing } from '../src/utils/bidValidity';
import { statusSheetRows } from '../src/utils/orderStatus';
import type { Bidder, BOQItem, StatusStage, TenderProject } from '../src/types/tender';

const mkBidder = (id: string, total: number, extra: Partial<Bidder> = {}): Bidder => {
  const each = total / 10;
  const rows: Partial<BOQItem>[] = Array.from({ length: 10 }, (_, i) => ({
    itemNo: i + 1, description: `فقرة ${i + 1}`, unit: 'عدد', quantity: 1, estimatedTotal: 100,
    enteredUnitPrice: each, enteredBidderTotal: each, bidderTotal: each
  }));
  const c = calculateBOQMetrics(rows, 20);
  return { id, name: id, submissionDate: '2026-01-01', items: c.items, totals: c.totals, status: 'pending', ...extra };
};
const mk = (bidders: Bidder[], extra: Partial<TenderProject> = {}): TenderProject => ({
  ...createNewTenderProject({ title: 'ت', referenceNumber: '1', contractType: 'works', budgetType: 'operating', bidderNames: ['x'] }),
  currency: 'د.ع', bidders, activeBidderId: bidders[0].id, closingDate: '2026-01-01', ...extra
});

test('الانتهاء = تاريخ الغلق + المدة، والتمديد يحل محله', () => {
  const p = mk([mkBidder('A', 1000, { validityDays: 90 }), mkBidder('B', 1000, { validityDays: 90, validityExtendedTo: '2026-06-30' }), mkBidder('C', 1000)]);
  assert.equal(bidExpiry(p, p.bidders[0]), '2026-04-01');
  assert.equal(bidExpiry(p, p.bidders[1]), '2026-06-30');
  assert.equal(bidExpiry(p, p.bidders[2]), null);
  assert.equal(bidExpiry({ ...p, closingDate: undefined }, p.bidders[0]), null);
});

test('حساب الأيام عبر حدود الشهر والسنة والكبيسة', () => {
  assert.equal(addDays('2026-12-15', 30), '2027-01-14');
  assert.equal(addDays('2026-01-31', 1), '2026-02-01');
  assert.equal(addDays('2028-02-28', 1), '2028-02-29');
  assert.equal(addDays('2026-03-01', -30), '2026-01-30');
});

test('الأقرب انتهاءً بين العطاءات، ويُهمل المستبعد وبلا مبالغ', () => {
  const empty = mkBidder('E', 0, { validityDays: 10 });
  const p = mk([
    mkBidder('A', 1000, { validityDays: 100 }), mkBidder('B', 1000, { validityDays: 60 }),
    mkBidder('D', 1000, { validityDays: 20, status: 'disqualified' }), empty
  ]);
  const a = validityAlert(p, '2026-02-01')!;
  assert.equal(a.bidderId, 'B');
  assert.equal(a.expiry, '2026-03-02');
});

test('المستويات عند الحدود: 46 لا شيء، 45 تحذير، 30 تحذير، 29 فات الموعد، يوم الانتهاء لم تنتهِ، بعده منتهية', () => {
  const p = mk([mkBidder('A', 1000, { validityDays: 100 })]); // ينتهي 2026-04-11
  const at = (left: number) => validityAlert(p, addDays('2026-04-11', -left));
  assert.equal(at(46), null);
  assert.equal(at(45)?.level, 'warn');
  assert.equal(at(30)?.level, 'warn');
  assert.equal(at(29)?.level, 'late');
  assert.equal(at(0)?.level, 'late');
  assert.equal(at(-1)?.level, 'expired');
  const w = at(45)!;
  assert.equal(w.reportDue, '2026-03-12');
  assert.match(w.text, /تنتهي نفاذية عطاء «A» في 11\/04\/2026: يُقدَّم تقرير اللجنة قبل 12\/03\/2026/);
  assert.match(at(-1)!.text, /انتهت نفاذية عطاء «A» في 11\/04\/2026/);
  assert.ok(at(29)!.legalKeys.includes('ann4_11_3'));
});

test('لا تنبيه بعد خروج الطلبية من اللجنة', () => {
  const stage = (s: StatusStage) => ({ statusLog: [{ id: 's', stage: s, recordedAt: '2026-01-02T00:00:00.000Z' }] });
  const bs = [mkBidder('A', 1000, { validityDays: 100 })];
  assert.ok(validityAlert(mk(bs, stage('analysis')), '2026-04-01'));
  assert.equal(validityAlert(mk(bs, stage('audit')), '2026-04-01'), null);
  assert.equal(validityAlert(mk(bs, stage('referred')), '2026-04-01'), null);
});

test('validityMissing: يُعدّ العطاء بلا نفاذية حين تُستعمل الميزة فقط', () => {
  const bs = [mkBidder('A', 1000, { validityDays: 100 }), mkBidder('B', 1000)];
  assert.equal(validityMissing(mk(bs)), 1);
  assert.equal(validityMissing(mk([mkBidder('A', 1000), mkBidder('B', 1000)], { closingDate: undefined })), 0);
  assert.equal(validityMissing(mk([mkBidder('A', 1000), mkBidder('B', 1000)])), 2);
});

test('التنظيف عند التحميل يُسقط القيم الفاسدة ويُبقي الصالحة', () => {
  const bad = mk([mkBidder('A', 1000, { validityDays: 0 }), mkBidder('B', 1000, { validityDays: 2.5, validityExtendedTo: '2026-13-40' }), mkBidder('C', 1000, { validityDays: 45, validityExtendedTo: '2026-05-01' })],
    { closingDate: 'غلط' });
  const s = sanitizeBidValidity(bad);
  assert.equal(s.closingDate, undefined);
  assert.equal(s.bidders[0].validityDays, undefined);
  assert.equal(s.bidders[1].validityDays, undefined);
  assert.equal(s.bidders[1].validityExtendedTo, undefined);
  assert.equal(s.bidders[2].validityDays, 45);
  assert.equal(s.bidders[2].validityExtendedTo, '2026-05-01');
  assert.equal(s.updatedAt, bad.updatedAt);
  const good = mk([mkBidder('A', 1000, { validityDays: 30 })]);
  assert.equal(sanitizeBidValidity(good), good);
});

test('صف كشف الموقف يحمل تنبيه النفاذية للمناقصات وحدها', () => {
  const today = new Date();
  const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const p = mk([mkBidder('A', 1000, { validityDays: 100 })], { closingDate: addDays(iso, -90) }); // تنتهي بعد 10 أيام
  const rows = statusSheetRows([p], []);
  assert.equal(rows[0].validity?.level, 'late');
  assert.match(rows[0].validity!.text, /«A»/);
  const none = statusSheetRows([mk([mkBidder('A', 1000)])], []);
  assert.equal(none[0].validity, undefined);
  const orderRows = statusSheetRows([], [{ id: 'o1', referenceNumber: '5 / 26 / 1', title: 'طلبية', statusLog: [] } as never]);
  assert.equal(orderRows[0].validity, undefined);
});

test('مدة مفرطة (أكثر من 3650 يوماً) لا تُقبل ولا تُسقط الحساب (مراجعة Codex)', () => {
  const p = mk([mkBidder('A', 1000, { validityDays: 999_999_999 }), mkBidder('B', 1000, { validityDays: 3650 })], { closingDate: '2026-01-01' });
  assert.equal(bidExpiry(p, p.bidders[0]), null);
  assert.equal(bidExpiry(p, p.bidders[1]), addDays('2026-01-01', 3650));
  assert.doesNotThrow(() => validityAlert(p, '2026-11-22'));
  assert.equal(sanitizeBidValidity(p).bidders[0].validityDays, undefined);
  assert.equal(sanitizeBidValidity(p).bidders[1].validityDays, 3650);
});

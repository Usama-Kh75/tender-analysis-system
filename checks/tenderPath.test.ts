// سطر «الموقف + مسار المناقصة» وحالة كل شركة: يُستنتج من بيانات المناقصة ولا يُخزَّن (تبويبات العمل، 2026-11-02)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNewTenderProject } from '../src/utils/storageService';
import { calculateBOQMetrics } from '../src/utils/calculations';
import { statusText } from '../src/utils/orderStatus';
import { bidderAuditState, tenderPath } from '../src/utils/tenderPath';
import type { Bidder, BOQItem, StatusEntry, TenderProject } from '../src/types/tender';

const row = (id: string, bidderTotal: number, flags: Partial<BOQItem> = {}): Partial<BOQItem> => ({
  id, itemNo: id, description: id, quantity: 1, estimatedTotal: 1000,
  bidderTotal, enteredBidderTotal: bidderTotal, enteredUnitPrice: bidderTotal, ...flags
});

// الأعلام تُضبط بعد الحساب كي يبقى الفحص على عدّها وحده
const bidder = (base: Bidder, rows: Partial<BOQItem>[], flags: Partial<BOQItem>[] = []): Bidder => {
  const calc = calculateBOQMetrics(rows, 20);
  const items = calc.items.map((it, i) => ({ ...it, hasMathError: false, hasTextDiscrepancy: false, ...(flags[i] ?? {}) }));
  return { ...base, items, totals: calc.totals };
};

const setup = (): TenderProject => {
  const p = createNewTenderProject({ title: 'ط', referenceNumber: '1', contractType: 'supply', budgetType: 'operating', bidderNames: ['أ', 'ب', 'ج'] });
  const [a, b, c] = p.bidders;
  return {
    ...p,
    bidders: [
      bidder(a, [row('1', 900), row('2', 900)]),
      bidder(b, [row('1', 950), row('2', 950), row('3', 950)], [{ hasMathError: true }, { hasMathError: true, hasTextDiscrepancy: true }, { hasTextDiscrepancy: true }]),
      // شركة بلا مبالغ، وعلى فقرتها علامة قديمة لا تُعدّ
      bidder(c, [row('1', 0)], [{ hasMathError: true }])
    ]
  };
};

test('حالة الشركة: بلا مبالغ، ومعلّقة بعدد فقراتها، ومدقَّقة', () => {
  const p = setup();
  assert.deepEqual(bidderAuditState(p.bidders[2]), { kind: 'empty' });
  assert.deepEqual(bidderAuditState(p.bidders[1]), { kind: 'pending', count: 3 });
  assert.deepEqual(bidderAuditState(p.bidders[0]), { kind: 'done' });
});

test('العطاءات n من m: m عدد الشركات أو العطاءات المستلمة', () => {
  const p = setup();
  assert.deepEqual(tenderPath(p).bids, { entered: 2, expected: 3 });
  assert.deepEqual(tenderPath({ ...p, receivedBidsCount: 4 }).bids, { entered: 2, expected: 4 });
});

test('التدقيق: لا يعدّ شركة بلا مبالغ، وأول شركة معلّقة بترتيبها', () => {
  const p = setup();
  assert.deepEqual(tenderPath(p).audit, { pending: 3, firstBidderId: p.bidders[1].id });
  const clean = { ...p, bidders: [p.bidders[0], p.bidders[2]] };
  assert.deepEqual(tenderPath(clean).audit, { pending: 0, firstBidderId: null });
});

test('الكلفة التخمينية', () => {
  const p = setup();
  assert.equal(tenderPath(p).hasEstimate, true);
  const blank = createNewTenderProject({ title: 'ط', referenceNumber: '1', contractType: 'supply', budgetType: 'operating', bidderNames: ['أ'] });
  assert.equal(tenderPath(blank).hasEstimate, false);
});

test('التوصية: لا شيء قبل اختيار اللجنة، واسم المختار بعده', () => {
  const p = setup();
  assert.equal(tenderPath(p).award, null);
  const chosen = { ...p, bidders: p.bidders.map((b, i) => (i === 0 ? { ...b, status: 'recommended' as const } : b)) };
  assert.deepEqual(tenderPath(chosen).award, { name: 'أ' });
});

test('الموقف: null بلا سجل، ونص آخر إدخال', () => {
  const p = setup();
  assert.equal(tenderPath(p).status, null);
  const e: StatusEntry = { id: 's1', stage: 'analysis', branch: 'commercial', memoDate: '2026-11-01', recordedAt: '2026-11-01T00:00:00.000Z' };
  assert.equal(tenderPath({ ...p, statusLog: [e] }).status, statusText(e));
});

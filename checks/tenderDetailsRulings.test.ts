// تفاصيل المناقصة تغذّي الأحكام: فرق العدد، الإعلان الثالث، أسلوب الدعوة والتأمينات الأولية (بعد 1.32.6)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateBOQMetrics } from '../src/utils/calculations';
import { createNewTenderProject } from '../src/utils/storageService';
import { createEditContext } from '../src/app/editContext';
import { createBidderHandlers } from '../src/app/bidderHandlers';
import { bidCountGap } from '../src/utils/bidCountGap';
import { stageGuidance } from '../src/utils/stageGuidance';
import { thirdAnnouncementNote } from '../src/utils/budgetTypes';
import { bidBondExempt } from '../src/utils/tenderDetails';
import { validateReasons, bidBondReasonConflicts } from '../src/utils/exclusionReasons';
import { recommendationPieces } from '../src/utils/recommendationText';
import { stageStates, nextStep, tenderPath } from '../src/utils/tenderPath';
import { isPlaceholderBidder } from '../src/utils/placeholderBidder';
import type { Bidder, TenderProject } from '../src/types/tender';

(globalThis as any).window = { alert: () => {}, confirm: () => true };

const priced = (id: string, name: string, amount: number, est = 1000): Bidder => {
  const c = calculateBOQMetrics([{ itemNo: 1, description: 'أ', quantity: 1, estimatedTotal: est, bidderTotal: amount }], 20);
  return { id, name, submissionDate: '2026-01-01', items: c.items, totals: c.totals, status: 'pending' };
};
const base = (extra: Partial<TenderProject> = {}): TenderProject => ({
  ...createNewTenderProject({ title: 'ت', referenceNumber: '1', contractType: 'works', budgetType: 'operating', bidderNames: [] }),
  ...extra
});
const withBidders = (bs: Bidder[], extra: Partial<TenderProject> = {}): TenderProject => ({ ...base(extra), bidders: bs, activeBidderId: bs[0].id });
const empty = (id: string, status: Bidder['status'] = 'pending'): Bidder => ({ ...priced(id, 'م' + id, 0), status });

test('bidCountGap: بلا عدد أو متساوٍ null، ونقص وزيادة، والحامل لا يُعدّ', () => {
  const a = priced('A', 'أ', 900), b = priced('B', 'ب', 950);
  assert.equal(bidCountGap(withBidders([a, b])), null);
  assert.equal(bidCountGap(withBidders([a, b], { receivedBidsCount: 2 })), null);
  assert.deepEqual(bidCountGap(withBidders([a, b], { receivedBidsCount: 4 })), { kind: 'missing', received: 4, registered: 2, diff: 2 });
  assert.deepEqual(bidCountGap(withBidders([a, b], { receivedBidsCount: 1 })), { kind: 'extra', received: 1, registered: 2, diff: 1 });
  const fresh = base({ receivedBidsCount: 3 });
  assert.ok(isPlaceholderBidder(fresh, fresh.bidders[0]));
  assert.equal(bidCountGap(fresh)?.registered, 0);
});

test('مستبعد بلا مبالغ لا يمنع اكتمال المرحلة الأولى ولا يُطلب إدخاله', () => {
  const p = withBidders([priced('A', 'أ', 900), priced('B', 'ب', 950), empty('C', 'disqualified')], { receivedBidsCount: 3 });
  const path = tenderPath(p);
  assert.equal(path.bids.registered, 2);
  assert.equal(path.bids.excludedBefore, 1);
  assert.equal(path.bids.expected, 3);
  assert.equal(stageStates(p).bids, 'done');
  assert.equal(nextStep(p)?.kind, 'award');
  const q = withBidders([priced('A', 'أ', 900), empty('C')]);
  assert.equal(stageStates(q).bids, 'current');
  assert.equal(nextStep(q)?.kind, 'bids');
});

test('art20_2: عطاء واحد مستلم في الإعلان الأول فقط', () => {
  const a = priced('A', 'أ', 900);
  const keys = (x: TenderProject) => stageGuidance(x, 'bids').map(g => g.key);
  assert.ok(keys(withBidders([a], { announcementNo: 1, receivedBidsCount: 1 })).includes('art20_2'));
  assert.ok(!keys(withBidders([a], { announcementNo: 2, receivedBidsCount: 1 })).includes('art20_2'));
  assert.ok(!keys(withBidders([a], { announcementNo: 1, receivedBidsCount: 2 })).includes('art20_2'));
  assert.ok(!keys(withBidders([a], { announcementNo: 1 })).includes('art20_2'));
});

test('إعادة الإعلان في الإعلان الثالث: إلغاء وإعادة في السنة اللاحقة ومعها ann2_3_7', () => {
  const dq: Bidder = { ...priced('A', 'أ', 900), status: 'disqualified', exclusionReasons: [{ ground: 'technical' }] };
  const third = withBidders([dq], { announcementNo: 3 });
  const pieces = recommendationPieces(third, dq);
  assert.equal(pieces.rec.kind, 'retender');
  assert.ok(pieces.systemText.includes('بإلغاء المناقصة وإعادة الإعلان عنها في السنة التقويمية اللاحقة'));
  assert.ok(pieces.legalKeys.includes('ann2_3_7') && pieces.legalKeys.includes('art20_3'));
  assert.ok(stageGuidance(third, 'study').some(g => g.key === 'ann2_3_7'));
  const second = recommendationPieces(withBidders([dq], { announcementNo: 2 }), dq);
  assert.ok(second.systemText.includes('إعادة الإعلان أو الدعوة') && !second.legalKeys.includes('ann2_3_7'));
});

test('thirdAnnouncementNote: استثمارية ثالثاً/5، تشغيلية ثالثاً/6، وغيرها null', () => {
  assert.equal(thirdAnnouncementNote({ announcementNo: 3, budgetType: 'investment' }, 5)?.ref, 'ann2_3_5');
  assert.equal(thirdAnnouncementNote({ announcementNo: 4, budgetType: 'operating' }, 0.1)?.ref, 'ann2_3_6');
  assert.equal(thirdAnnouncementNote({ announcementNo: 3 }, 5), null);
  assert.equal(thirdAnnouncementNote({ announcementNo: 3, budgetType: 'operating' }, 0), null);
  assert.equal(thirdAnnouncementNote({ announcementNo: 3, budgetType: 'operating' }, -3), null);
  assert.equal(thirdAnnouncementNote({ announcementNo: 2, budgetType: 'operating' }, 5), null);
  assert.equal(thirdAnnouncementNote({ budgetType: 'operating' }, 5), null);
});

test('bidBondExempt وvalidateReasons وتعارض الأسباب', () => {
  for (const t of ['limited', 'twoStage', 'direct', 'singleSource'] as const) assert.equal(bidBondExempt({ invitationType: t }), true);
  assert.equal(bidBondExempt({ invitationType: 'general' }), false);
  assert.equal(bidBondExempt({}), false);
  assert.equal(validateReasons([{ ground: 'bidBond' }]), null);
  assert.match(validateReasons([{ ground: 'bidBond' }], true)!, /المادة \(27\)\/أولاً\/هـ/);
  assert.match(validateReasons([{ ground: 'bondInvalid', detail: 'س' }], true)!, /التأمينات الأولية/);
  assert.equal(validateReasons([{ ground: 'technical' }], true), null);
  const dq: Bidder = { ...priced('A', 'أ', 0), status: 'disqualified', exclusionReasons: [{ ground: 'bidBond' }] };
  assert.equal(bidBondReasonConflicts(withBidders([dq], { invitationType: 'direct' })).length, 1);
  assert.equal(bidBondReasonConflicts(withBidders([dq], { invitationType: 'general' })).length, 0);
});

test('handleAddExcludedBeforeAnalysis: مستبعد بلا مبالغ بقيد واحد، ويحلّ محل الحامل', () => {
  const p = base({ receivedBidsCount: 2 });
  let saved: TenderProject | undefined;
  const ctx = createEditContext(p, p.bidders[0], (fn: any) => { saved = fn([p])[0]; });
  const h = createBidderHandlers(ctx, { closeSettings: () => {} });
  assert.equal(h.handleAddExcludedBeforeAnalysis('   '), undefined);
  assert.equal(saved, undefined);
  const id = h.handleAddExcludedBeforeAnalysis(' شركة النور ');
  assert.ok(id && saved);
  const out = saved as TenderProject;
  assert.equal(out.bidders.length, 1);
  const nb = out.bidders[0];
  assert.equal(nb.id, id);
  assert.equal(nb.name, 'شركة النور');
  assert.equal(nb.status, 'disqualified');
  assert.equal(nb.totals.totalBidderAmount, 0);
  assert.equal(out.activeBidderId, id);
  assert.equal((out.auditLogs ?? []).filter(l => l.action === 'إضافة مجهز مستبعد قبل التحليل').length, 1);
  assert.equal(bidCountGap(out)?.registered, 1);
});

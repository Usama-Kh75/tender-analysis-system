// أسباب استبعاد العطاء (src/utils/exclusionReasons.ts): الصياغة، والنصوص الرسمية، والتحقق، والتنظيف عند التحميل، وتوصية إعادة الإعلان
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateBOQMetrics } from '../src/utils/calculations';
import { createNewTenderProject } from '../src/utils/storageService';
import { createExclusionHandlers } from '../src/app/exclusionHandlers';
import { recommendationPieces } from '../src/utils/recommendationText';
import { LEGAL_TEXTS } from '../src/utils/legalTexts';
import {
  EXCLUSION_GROUNDS, INCOMPLETE_ITEMS, exclusionLabels, exclusionLegalKeys, exclusionLegalLabels, needsOpinionSource,
  opinionClause, reasonLine, sanitizeExclusionFields, validateReasons
} from '../src/utils/exclusionReasons';
import type { Bidder, ExclusionReason, TenderProject } from '../src/types/tender';

const mkBidder = (id: string, name: string, total: number, reasons?: ExclusionReason[], status: Bidder['status'] = 'disqualified'): Bidder => {
  const each = total / 10;
  const rows = Array.from({ length: 10 }, (_, i) => ({
    itemNo: i + 1, description: `فقرة ${i + 1}`, unit: 'عدد', quantity: 1, estimatedTotal: 100,
    enteredUnitPrice: each, enteredBidderTotal: each, bidderTotal: each
  }));
  const c = calculateBOQMetrics(rows, 20);
  return { id, name, submissionDate: '2026-01-01', items: c.items, totals: c.totals, status, ...(reasons ? { exclusionReasons: reasons } : {}) };
};
const mkProject = (bidders: Bidder[], extra: Partial<TenderProject> = {}): TenderProject => ({
  ...createNewTenderProject({ title: 'ت', referenceNumber: '1', contractType: 'supply', budgetType: 'operating', bidderNames: ['x'] }),
  deviationThreshold: 20, currency: 'د.ع', bidders, activeBidderId: bidders[0].id, updatedAt: '2020-01-01T00:00:00.000Z', ...extra
});
const opinion = { source: 'الفنيين من قسم الصيانة', letterNo: '55', letterDate: '2026-03-07' };

test('reasonLine: فني مع رأي ومن غيره', () => {
  const p = mkProject([mkBidder('A', 'A', 1000)]);
  assert.equal(reasonLine({ ground: 'technical', detail: 'الفقرة 3' }, p),
    `عدم مطابقة عرضه الفني للمواصفات الفنية المطلوبة في وثائق المناقصة (${LEGAL_TEXTS.ann4_6_6.label}): الفقرة 3.`);
  const q = { ...p, technicalOpinion: opinion };
  assert.equal(reasonLine({ ground: 'technical' }, q),
    `عدم مطابقة عرضه الفني للمواصفات الفنية المطلوبة في وثائق المناقصة (${LEGAL_TEXTS.ann4_6_6.label})، استناداً إلى الرأي الفني المقدَّم من (الفنيين من قسم الصيانة) بالكتاب المرقم (55) في (07/03/2026)، الذي طلبته اللجنة وفق المادة (13)/ثانياً.`);
});

test('reasonLine: استكمال وآخر وغير معروف وبقية البنود', () => {
  const p = mkProject([mkBidder('A', 'A', 1000)]);
  assert.equal(reasonLine({ ground: 'incomplete', item: 4, detail: 'كتاب 9' }, p),
    `عدم استكماله ${INCOMPLETE_ITEMS[3]} خلال المدة التي حددتها اللجنة (${LEGAL_TEXTS.ann4_7_4.label}): كتاب 9.`);
  assert.equal(reasonLine({ ground: 'other', detail: 'سبب خاص' }, p), 'سبب خاص.');
  assert.equal(reasonLine({ ground: 'zzz', detail: 'ت' }, p), 'سبب غير محدد: ت.');
  assert.equal(reasonLine({ ground: 'zzz' }, p), 'سبب غير محدد.');
  assert.ok(reasonLine({ ground: 'bidBond' }, p).endsWith(`(${LEGAL_TEXTS.ann4_6_1.label}).`));
});

test('opinionClause: المصدر وحده، ومع الرقم، ومع التاريخ، وفارغ', () => {
  assert.equal(opinionClause({}), '');
  assert.equal(opinionClause({ technicalOpinion: { source: ' ' } }), '');
  assert.equal(opinionClause({ technicalOpinion: { source: 'س' } }), '، استناداً إلى الرأي الفني المقدَّم من (س)، الذي طلبته اللجنة وفق المادة (13)/ثانياً');
  assert.equal(opinionClause({ technicalOpinion: { source: 'س', letterNo: '5' } }), '، استناداً إلى الرأي الفني المقدَّم من (س) بالكتاب المرقم (5)، الذي طلبته اللجنة وفق المادة (13)/ثانياً');
  assert.equal(opinionClause({ technicalOpinion: { source: 'س', letterNo: '5', letterDate: '2026-03-07' } }),
    '، استناداً إلى الرأي الفني المقدَّم من (س) بالكتاب المرقم (5) في (07/03/2026)، الذي طلبته اللجنة وفق المادة (13)/ثانياً');
});

test('exclusionLegalKeys: الترتيب وعدم التكرار وart13_2 والمستبعد بلا مبالغ والحالة', () => {
  const p = mkProject([
    mkBidder('A', 'A', 1000, [{ ground: 'bidBond' }, { ground: 'technical' }, { ground: 'other', detail: 'x' }]),
    mkBidder('B', 'B', 1000, [{ ground: 'conditions' }, { ground: 'incomplete', item: 2 }]),
    mkBidder('C', 'C', 0, [{ ground: 'blacklist' }]),
    mkBidder('D', 'D', 1000, [{ ground: 'refusedCorrection' }], 'pending')
  ], { technicalOpinion: opinion });
  assert.deepEqual(exclusionLegalKeys(p), ['ann4_6_1', 'ann4_6_6', 'art13_2', 'ann4_7_2']);
  assert.deepEqual(exclusionLegalKeys({ ...p, technicalOpinion: undefined }), ['ann4_6_1', 'ann4_6_6', 'ann4_7_2']);
  assert.equal(exclusionLabels(p.bidders[0]), 'عدم إرفاق التأمينات الأولية، عدم المطابقة الفنية، سبب آخر');
  assert.equal(exclusionLegalLabels(p.bidders[0]), `${LEGAL_TEXTS.ann4_6_1.label}، ${LEGAL_TEXTS.ann4_6_6.label}`);
  assert.equal(exclusionLabels(p.bidders[3]), '');
});

test('validateReasons', () => {
  assert.equal(validateReasons([{ ground: 'technical' }, { ground: 'bidBond' }]), null);
  assert.ok(validateReasons([{ ground: 'other' }]));
  assert.ok(validateReasons([{ ground: 'other', detail: '  ' }]));
  assert.ok(validateReasons([{ ground: 'bondInvalid' }]));
  assert.equal(validateReasons([{ ground: 'bondInvalid', detail: 'المدة' }]), null);
  assert.ok(validateReasons([{ ground: 'incomplete' }]));
  assert.ok(validateReasons([{ ground: 'technical' }, { ground: 'technical', detail: 'ب' }]));
  assert.equal(validateReasons([{ ground: 'incomplete', item: 1 }, { ground: 'incomplete', item: 2 }]), null);
  assert.ok(validateReasons([{ ground: 'incomplete', item: 1 }, { ground: 'incomplete', item: 1 }]));
});

test('needsOpinionSource', () => {
  const p = mkProject([mkBidder('A', 'A', 1000, [{ ground: 'technical' }])]);
  assert.equal(needsOpinionSource(p), true);
  assert.equal(needsOpinionSource({ ...p, technicalOpinion: opinion }), false);
  assert.equal(needsOpinionSource(mkProject([mkBidder('A', 'A', 1000, [{ ground: 'bidBond' }])])), false);
});

test('التنظيف عند التحميل', () => {
  const bad = mkBidder('A', 'A', 1000);
  (bad as any).exclusionReasons = 'نص';
  const p1 = sanitizeExclusionFields(mkProject([bad], { technicalOpinion: 5 as any }));
  assert.equal('exclusionReasons' in p1.bidders[0], false);
  assert.equal('technicalOpinion' in p1, false);

  const messy = mkBidder('A', 'A', 1000);
  (messy as any).exclusionReasons = [null, 3, [], { ground: 'weird', detail: '  تفصيل ', item: 4 },
    { ground: 'incomplete', item: 12, detail: 7 }, { ground: 'incomplete', item: 3 }];
  const p2 = sanitizeExclusionFields(mkProject([messy], { technicalOpinion: { source: ' س ', letterDate: '2026-13-45' } }));
  assert.deepEqual(p2.bidders[0].exclusionReasons, [
    { ground: 'weird', item: 4, detail: 'تفصيل' }, { ground: 'incomplete' }, { ground: 'incomplete', item: 3 }
  ]);
  assert.deepEqual(p2.technicalOpinion, { source: 'س' });
  assert.equal(p2.updatedAt, '2020-01-01T00:00:00.000Z');
  assert.equal(p2.auditLogs.length, 0);
  assert.equal(reasonLine(p2.bidders[0].exclusionReasons![0], p2), 'سبب غير محدد: تفصيل.');

  const clean = mkProject([mkBidder('A', 'A', 1000, [{ ground: 'technical', detail: 'د' }])], { technicalOpinion: opinion });
  assert.equal(sanitizeExclusionFields(clean), clean);
});

test('توصية إعادة الإعلان عند استبعاد الجميع', () => {
  const withReasons = mkProject([mkBidder('A', 'A', 1000, [{ ground: 'technical' }]), mkBidder('B', 'B', 1000, [{ ground: 'bidBond' }])]);
  const t = recommendationPieces(withReasons, withReasons.bidders[0]).systemText;
  assert.equal(t, 'استبعدت اللجنة جميع العطاءات المقدمة للأسباب المبينة في (أولاً)، وعليه توصي لجنة التحليل بعرض الموضوع على جهة التعاقد للنظر في إعادة الإعلان أو الدعوة استناداً إلى المادة (20)/ثالثاً.');
  const partial = mkProject([mkBidder('A', 'A', 1000, [{ ground: 'technical' }]), mkBidder('B', 'B', 1000)]);
  assert.ok(recommendationPieces(partial, partial.bidders[0]).systemText.startsWith('استبعدت اللجنة جميع العطاءات المقدمة. وإذا'));
});

test('كل مفتاح في الكتالوج موجود في LEGAL_TEXTS', () => {
  for (const g of EXCLUSION_GROUNDS) if (g.legalKey) assert.ok(LEGAL_TEXTS[g.legalKey], g.ground);
  INCOMPLETE_ITEMS.forEach((_, i) => assert.ok((LEGAL_TEXTS as any)[`ann4_7_${i + 1}`]));
  assert.ok(LEGAL_TEXTS.art13_2);
});

test('المعالج: حفظ، وسجل تدقيق، وبلا تغيير لا حفظ، والحالة لا تتغير', () => {
  const p = mkProject([mkBidder('A', 'A', 1000), mkBidder('B', 'B', 1000)]);
  let saved: TenderProject | null = null;
  const h = createExclusionHandlers(p, x => { saved = x; });
  h.handleSaveExclusionReasons('A', [{ ground: 'technical', detail: ' د ' }], opinion);
  const s = saved as unknown as TenderProject;
  assert.deepEqual(s.bidders[0].exclusionReasons, [{ ground: 'technical', detail: 'د' }]);
  assert.equal(s.bidders[0].status, 'disqualified');
  assert.equal(s.bidders[1].exclusionReasons, undefined);
  assert.deepEqual(s.technicalOpinion, opinion);
  assert.equal(s.auditLogs.at(-1)!.action, 'أسباب الاستبعاد');
  assert.ok(s.auditLogs.at(-1)!.details.startsWith('عطاء (A): عدم المطابقة الفنية — ومصدر الرأي الفني:'));
  assert.notEqual(s.updatedAt, p.updatedAt);
  saved = null;
  createExclusionHandlers(s, x => { saved = x; }).handleSaveExclusionReasons('A', [{ ground: 'technical', detail: 'د' }], opinion);
  assert.equal(saved, null);
});

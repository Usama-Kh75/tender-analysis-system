// «الخطوة التالية» وحالة كل شركة: يُستنتج من بيانات المناقصة ولا يُخزَّن (تبويبات العمل، 2026-11-02)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNewTenderProject } from '../src/utils/storageService';
import { calculateBOQMetrics } from '../src/utils/calculations';
import { bidderAuditState, nextStep, stageStates, stageStep, tenderPath } from '../src/utils/tenderPath';
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
  assert.deepEqual(tenderPath(p).bids, { entered: 2, registered: 3, expected: 3 });
  assert.deepEqual(tenderPath({ ...p, receivedBidsCount: 4 }).bids, { entered: 2, registered: 3, expected: 4 });
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

const blankTender = () => createNewTenderProject({ title: 'ط', referenceNumber: '1', contractType: 'supply', budgetType: 'operating', bidderNames: ['أ', 'ب'] });
const clean = (p: TenderProject): TenderProject => ({ ...p, bidders: p.bidders.map(b => ({ ...b, items: b.items.map(i => ({ ...i, hasMathError: false, hasTextDiscrepancy: false })) })) });
const allIn = (): TenderProject => {
  const p = setup();
  return clean({ ...p, bidders: [p.bidders[0], p.bidders[1]] });
};
const chosen = (p: TenderProject): TenderProject => ({ ...p, bidders: p.bidders.map((b, i) => (i === 0 ? { ...b, status: 'recommended' as const } : b)) });

test('الخطوة 1: بلا كلفة تخمينية، ولها الأولوية على المعلّق', () => {
  const blank = blankTender();
  const s = nextStep(blank)!;
  assert.equal(s.kind, 'estimate');
  assert.equal(s.text, 'الخطوة التالية: استيراد كشف الكلف التخمينية');
  assert.deepEqual(s.actions, [{ label: 'استيراد كشف الكلف التخمينية', target: 'importEstimate' }]);
  // كلفة مفقودة مع معلّق ← estimate
  const p0 = setup();
  const noEst: TenderProject = { ...p0, bidders: [
    bidder(p0.bidders[0], [row('1', 900, { estimatedTotal: 0 })]),
    bidder(p0.bidders[1], [row('1', 950, { estimatedTotal: 0 })], [{ hasMathError: true }])
  ] };
  assert.equal(tenderPath(noEst).hasEstimate, false);
  assert.equal(tenderPath(noEst).audit.pending > 0, true);
  assert.equal(nextStep(noEst)!.kind, 'estimate');
});

test('الخطوة 2: فقرات بانتظار قرار، ويفتح أول شركة معلّقة', () => {
  const p = setup();
  const s = nextStep(p)!;
  assert.equal(s.kind, 'audit');
  assert.equal(s.text, 'الخطوة التالية: 3 فقرات فيها أخطاء لم تُعالج');
  assert.deepEqual(s.actions, [{ label: 'عرض الفقرات التي فيها أخطاء', target: 'audit', bidderId: p.bidders[1].id }]);
});

test('الخطوة 3: شركة بلا مبالغ باسمها', () => {
  const p = clean(setup());
  const s = nextStep(p)!;
  assert.equal(s.kind, 'bids');
  assert.equal(s.text, 'الخطوة التالية: إدخال عطاء «ج»');
  assert.deepEqual(s.actions, [{ label: 'إدخال العطاء', target: 'bids', bidderId: p.bidders[2].id }]);
});

test('المستلمة أكثر من المسجّلين وكلهم بمبالغ: لا يعلق الشريط ويظهر التنبيه', () => {
  const p = { ...allIn(), receivedBidsCount: 4 };
  const s = nextStep(p)!;
  assert.equal(s.kind, 'award');
  assert.match(s.text, /^اكتمل إدخال العطاءات \(2 من 4\) والكلفة التخمينية\. الخطوة التالية: دراسة العطاءات والتوصية بالإحالة/);
  assert.match(s.text, /استُلمت \(4\) عطاءات، وأُدخل منها \(2\) للتحليل التجاري\. العطاء الذي فيه نقص جوهري \(كالتأمينات الأولية\) يُعدّ مستلماً ولا يُحلَّل تجارياً، وإن لم يكن فيه نقص فأضفه من «إضافة مجهز»\./);
  assert.deepEqual(s.actions, [{ label: 'الانتقال إلى الدراسة والتوصية', target: 'study' }]);
});

test('مسجّل 3 واثنان بمبالغ: إدخال عطاء باسم صاحبه ولو زادت المستلمة', () => {
  const p = { ...clean(setup()), receivedBidsCount: 5 };
  const s = nextStep(p)!;
  assert.equal(s.kind, 'bids');
  assert.equal(s.text, 'الخطوة التالية: إدخال عطاء «ج»');
});

test('الكل مكتمل: اكتمل إدخال العطاءات، بلا ملاحظة حين لا فرق', () => {
  const s = nextStep(allIn())!;
  assert.equal(s.text, 'اكتمل إدخال العطاءات (2 من 2) والكلفة التخمينية. الخطوة التالية: دراسة العطاءات والتوصية بالإحالة');
});

test('الخطوة 3: لا عطاء مدخلاً بعد وفيه كلفة ← إدخال عطاء، لا تدقيق ولا ترسية', () => {
  const p = blankTender();
  const withEst = { ...p, bidders: p.bidders.map(b => bidder(b, [row('1', 0)])) };
  const s = nextStep(withEst)!;
  assert.equal(s.kind, 'bids');
  assert.equal(s.text, 'الخطوة التالية: إدخال عطاء «أ»');
});

test('الخطوة 4: عطاءات مدخلة بلا ترسية', () => {
  const s = nextStep(allIn())!;
  assert.equal(s.kind, 'award');
  assert.equal(s.text, 'اكتمل إدخال العطاءات (2 من 2) والكلفة التخمينية. الخطوة التالية: دراسة العطاءات والتوصية بالإحالة');
  assert.deepEqual(s.actions, [{ label: 'الانتقال إلى الدراسة والتوصية', target: 'study' }]);
});

test('الخطوة 5: الترسية مختارة بلا سجل موقف', () => {
  const s = nextStep(chosen(allIn()))!;
  assert.equal(s.kind, 'report');
  assert.equal(s.text, 'اختارت اللجنة «أ». الخطوة التالية: معاينة المحضر وطباعته من الشريط أدناه، ثم تسجيل الموقف عند إرساله من شارة الموقف أعلاه أو «كشف الموقف»');
  // لا زر للموقف في الشريط (أسامة 2026-11-19)
  assert.deepEqual(s.actions, []);
  assert.equal(nextStep({ ...chosen(allIn()), statusLog: [] })!.kind, 'report');
});

test('الموقف يُسجَّل من أول يوم: «قيد التحليل» أو «معادة من التدقيق» أو «إجراء آخر» تُبقي خطوة المحضر بنص «تحديث الموقف»', () => {
  for (const stage of ['analysis', 'awaitingBidders', 'returnedFromAudit', 'other'] as const) {
    const e: StatusEntry = { id: 's1', stage, customText: stage === 'other' ? 'س' : undefined, recordedAt: '2026-11-01T00:00:00.000Z' };
    const s = nextStep({ ...chosen(allIn()), statusLog: [e] })!;
    assert.equal(s.kind, 'report', stage);
    assert.equal(s.text, 'اختارت اللجنة «أ». الخطوة التالية: معاينة المحضر وطباعته من الشريط أدناه، ثم تحديث الموقف عند إرساله من شارة الموقف أعلاه أو «كشف الموقف»');
    assert.deepEqual(s.actions, []);
    assert.equal(stageStates({ ...chosen(allIn()), statusLog: [e] }).report, 'current', stage);
  }
});

test('الحالة الأخيرة: ترسية وخروج الطلبية من اللجنة ← null، والتراجع عن الترسية يعيد الخطوة 4', () => {
  const first: StatusEntry = { id: 's0', stage: 'analysis', branch: 'commercial', recordedAt: '2026-10-01T00:00:00.000Z' };
  for (const stage of ['audit', 'reviewCommittee', 'referralPending', 'referred', 'sentToContracts'] as const) {
    const e: StatusEntry = { id: 's1', stage, recordedAt: '2026-11-01T00:00:00.000Z' };
    assert.equal(nextStep({ ...chosen(allIn()), statusLog: [first, e] }), null, stage);
  }
  // الحالي هو آخر عنصر: الرجوع إلى «قيد التحليل» بعد الإرسال يعيد خطوة المحضر
  const sent: StatusEntry = { id: 's1', stage: 'sentToContracts', recordedAt: '2026-11-01T00:00:00.000Z' };
  assert.equal(nextStep({ ...chosen(allIn()), statusLog: [sent, first] })!.kind, 'report');
  const done = { ...chosen(allIn()), statusLog: [first, sent] };
  assert.equal(nextStep(done), null);
  assert.equal(nextStep({ ...done, bidders: done.bidders.map(b => ({ ...b, status: 'qualified' as const })) })!.kind, 'award');
});

test('اختلاف القراءتين يُعدّ فقرة فيها أخطاء مرة واحدة، ولا تُعدّ المسعّرة بلا سعر ولا المصحَّحة', () => {
  const p = setup();
  const diff = { fields: ['unitPrice'], second: '1' };
  const [a] = p.bidders;
  const withCheck = { ...a, items: a.items.map((it, i) => i === 0 ? { ...it, readCheck: diff } : i === 1 ? { ...it, readCheck: diff, unpriced: true } : it) };
  const q = { ...p, bidders: [withCheck, ...p.bidders.slice(1)] };
  assert.deepEqual(bidderAuditState(withCheck), { kind: 'pending', count: 1 });
  assert.equal(tenderPath(q).audit.pending, 4);
  assert.equal(tenderPath(q).audit.firstBidderId, a.id);
  // فقرة فيها خطأ ضرب واختلاف قراءتين تُعدّ مرة
  const both = { ...a, items: a.items.map((it, i) => i === 0 ? { ...it, readCheck: diff, hasMathError: true } : it) };
  assert.deepEqual(bidderAuditState(both), { kind: 'pending', count: 1 });
});

test('حال المراحل: الأولى قيد العمل بلا كلفة أو مع فقرات معلّقة أو شركة بلا مبالغ', () => {
  assert.deepEqual(stageStates(blankTender()), { bids: 'current', study: 'upcoming', report: 'upcoming' });
  assert.deepEqual(stageStates(setup()), { bids: 'current', study: 'upcoming', report: 'upcoming' });
  assert.deepEqual(stageStates(clean(setup())), { bids: 'current', study: 'upcoming', report: 'upcoming' });
  // المستلمة أكثر من المسجّلة لا تمنع اكتمال الأولى (كالخطوة التالية)
  assert.equal(stageStates({ ...allIn(), receivedBidsCount: 4 }).bids, 'done');
});

test('حال المراحل: الدراسة قيد العمل، ثم التوصية، ثم الكل مكتمل', () => {
  assert.deepEqual(stageStates(allIn()), { bids: 'done', study: 'current', report: 'upcoming' });
  assert.deepEqual(stageStates(chosen(allIn())), { bids: 'done', study: 'done', report: 'current' });
  const e: StatusEntry = { id: 's1', stage: 'referred', memoDate: '2026-11-01', recordedAt: '2026-11-01T00:00:00.000Z' };
  assert.deepEqual(stageStates({ ...chosen(allIn()), statusLog: [e] }), { bids: 'done', study: 'done', report: 'done' });
  // موقف مسجّل بلا ترسية لا يُكمل الثالثة
  assert.equal(stageStates({ ...allIn(), statusLog: [e] }).report, 'upcoming');
});

test('stageStep: خطوة التبويب المفتوح وحده', () => {
  // العطاءات والتدقيق: خطوات مرحلتها فقط، ولا فائز ولا زر غريب
  const p0 = setup();
  assert.deepEqual(stageStep(p0, 'bids'), nextStep(p0));
  // بعد اكتمالها: سطر ختام وزر إلى الدراسة، بلا اسم الفائز ولو اختير؛ والانتقال يدوي
  const done = stageStep(allIn(), 'bids')!;
  assert.equal(done.kind, 'stageDone');
  assert.equal(done.text, 'اكتملت مرحلة العطاءات والتدقيق: أُدخلت العطاءات (2 من 2) ودُقّقت. المرحلة التالية: الدراسة والتوصية');
  assert.deepEqual(done.actions, [{ label: 'الانتقال إلى الدراسة والتوصية', target: 'study' }]);
  assert.deepEqual(stageStep(chosen(allIn()), 'bids'), done);
  // العطاءات المستلمة أكثر من المسجّلة: ملاحظتها في سطر الختام لا في الدراسة
  assert.match(stageStep({ ...allIn(), receivedBidsCount: 4 }, 'bids')!.text, /\(2 من 4\).*استُلمت \(4\) عطاءات، وأُدخل منها \(2\)/);
  // الدراسة والتوصية: قبل اختيار الفائز نص بلا أزرار
  assert.equal(stageStep(setup(), 'study'), null);
  const study = stageStep(allIn(), 'study')!;
  assert.equal(study.kind, 'award');
  assert.deepEqual(study.actions, []);
  assert.equal(study.text, 'الخطوة التالية: دراسة العطاءات ومقارنتها، ثم اختيار العطاء الفائز بزر «اختيار للترسية» في جدول «قرار اللجنة»');
  assert.equal(stageStep({ ...allIn(), receivedBidsCount: 4 }, 'study')!.text, study.text);
  // بعد اختيار الفائز: سطر ختام وزر إلى المحضر
  const studyDone = stageStep(chosen(allIn()), 'study')!;
  assert.equal(studyDone.kind, 'stageDone');
  assert.equal(studyDone.text, 'اكتملت مرحلة الدراسة والتوصية: اختارت اللجنة «أ». المرحلة التالية: المحضر');
  assert.deepEqual(studyDone.actions, [{ label: 'الانتقال إلى المحضر', target: 'report' }]);
  // المحضر
  const early = stageStep(setup(), 'report')!;
  assert.deepEqual(early.actions, []);
  assert.equal(early.text, 'لم تكتمل مرحلة العطاءات والتدقيق (3 فقرات فيها أخطاء لم تُعالج)، فالمحضر قبل إكمالها غير نهائي');
  // قبل اختيار الفائز: خطوة المحضر زرها إلى الدراسة والتوصية
  const pick = stageStep(allIn(), 'report')!;
  assert.deepEqual(pick.actions, [{ label: 'الانتقال إلى الدراسة والتوصية', target: 'study' }]);
  assert.equal(pick.text, 'الخطوة التالية: اختيار العطاء الفائز في «الدراسة والتوصية»');
  const p1 = chosen(allIn());
  assert.deepEqual(stageStep(p1, 'report'), nextStep(p1));
  // ترسية وخروج الطلبية من اللجنة: لا شيء في المحضر، ويبقى سطرا الختام للمرحلتين الأوليين في تبويبيهما
  const e: StatusEntry = { id: 's1', stage: 'sentToContracts', memoDate: '2026-11-01', recordedAt: '2026-11-01T00:00:00.000Z' };
  const closed = { ...chosen(allIn()), statusLog: [e] };
  assert.equal(stageStep(closed, 'report'), null);
  assert.deepEqual(stageStep(closed, 'study'), studyDone);
  assert.equal(stageStep(closed, 'bids')!.kind, 'stageDone');
});

test('حال المراحل: كل مرحلة بشرطها، فالترسية المختارة تبقى مكتملة إن عادت فقرة معلّقة', () => {
  const p = chosen(allIn());
  const reopened = { ...p, bidders: p.bidders.map((b, i) => (i === 1 ? { ...b, items: b.items.map((it, j) => (j === 0 ? { ...it, hasMathError: true } : it)) } : b)) };
  assert.deepEqual(stageStates(reopened), { bids: 'current', study: 'done', report: 'upcoming' });
});

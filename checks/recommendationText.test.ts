// نص توصية المحضر (src/utils/recommendationText.ts): صياغة النظام، وتغيّر أساس صياغة اللجنة، وحفظها واستعادتها، وملف التصدير
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateBOQMetrics } from '../src/utils/calculations';
import { createNewTenderProject } from '../src/utils/storageService';
import { createEditContext } from '../src/app/editContext';
import { createRecommendationHandlers } from '../src/app/recommendationHandlers';
import {
  recommendationPieces, recommendationEditChanges, savedRecommendationEdit, recommendationEditsExport
} from '../src/utils/recommendationText';
import { Bidder, RecommendationBasis, RecommendationEdit, TenderProject } from '../src/types/tender';

// عشر فقرات بكمية 1 وتخميني 100 للفقرة، والمبلغ الكلي موزع بالتساوي
const mkBidder = (id: string, name: string, total: number): Bidder => {
  const each = total / 10;
  const rows = Array.from({ length: 10 }, (_, i) => ({
    itemNo: i + 1, description: `فقرة ${i + 1}`, unit: 'عدد', quantity: 1, estimatedTotal: 100,
    enteredUnitPrice: each, enteredBidderTotal: each, bidderTotal: each
  }));
  const c = calculateBOQMetrics(rows, 20);
  return { id, name, submissionDate: '2026-01-01', items: c.items, totals: c.totals, status: 'pending' };
};
const mkProject = (bidders: Bidder[]): TenderProject => ({
  ...createNewTenderProject({ title: 'ت', referenceNumber: '1', contractType: 'supply', budgetType: 'operating', bidderNames: ['x'] }),
  deviationThreshold: 20,
  currency: 'د.ع',
  bidders,
  activeBidderId: bidders[0].id,
  updatedAt: '2020-01-01T00:00:00.000Z'
});

const award = () => mkProject([mkBidder('A', 'شركة A', 950), mkBidder('B', 'شركة B', 1100)]);
const tie = () => mkProject([mkBidder('A', 'شركة A', 1000), mkBidder('B', 'شركة B', 1005)]);

test('systemText: توصية الإحالة على أوطأ عطاء مؤهل', () => {
  const p = award();
  const t = recommendationPieces(p, p.bidders[0]).systemText;
  assert.ok(t.startsWith('بعد التحليل التجاري والمالي'));
  assert.ok(t.includes('توصي لجنة التحليل بإحالة المناقصة على العطاء المقدم من (شركة A) بمبلغ إجمالي قدره'));
  assert.ok(t.includes('، لكونه أوطأ العطاءات المؤهلة، مع مراعاة'));
  assert.ok(t.endsWith('وفق المادة (13)/أولاً.'));
});

test('systemText: المفاضلة بين عطاءين متقاربين تُسرد في قائمة', () => {
  const p = tie();
  const r = recommendationPieces(p, p.bidders[0]);
  assert.ok(r.systemText.split('\n').length >= 3);
  assert.ok(r.systemText.split('\n').some(l => l.startsWith('• شركة A — ')));
  assert.equal(r.basis.kind, 'tie');
  assert.equal(r.basis.bids.length, 2);
});

const basis = (over: Partial<RecommendationBasis> = {}): RecommendationBasis => ({
  kind: 'award', bids: [{ id: 'A', name: 'شركة A', amount: 950 }], ...over
});
const edit = (b = basis(), systemText = 'نص النظام'): RecommendationEdit => ({ text: 'صياغة اللجنة', systemText, basis: b, editedAt: '2026-10-23T00:00:00.000Z' });

test('recommendationEditChanges: كل تغيّر في الأساس يُوصف', () => {
  const e = edit();
  const now = (b: RecommendationBasis, systemText = 'نص النظام') => recommendationEditChanges(e, { basis: b, systemText });
  assert.deepEqual(now(basis()), []);
  assert.ok(now(basis({ bids: [{ id: 'A', name: 'شركة A', amount: 960 }] }))[0].includes('تغيّر مبلغ'));
  const kind = now(basis({ kind: 'tie' }));
  assert.equal(kind.length, 1);
  assert.ok(kind[0].includes('صارت التوصية'));
  assert.ok(now(basis({ bids: [{ id: 'B', name: 'شركة B', amount: 950 }] }))[0].includes('العطاء المعني صار'));
  assert.ok(now(basis({ bids: [{ id: 'A', name: 'شركة س', amount: 950 }] }))[0].includes('تغيّر اسم المجهز'));
  assert.ok(now(basis(), 'نص آخر')[0].includes('تغيّرت صياغة النظام'));
});

test('savedRecommendationEdit: يرفض النص الفارغ والأساس الناقص ويقبل السليم', () => {
  const p = award();
  assert.equal(savedRecommendationEdit(p), undefined);
  assert.equal(savedRecommendationEdit({ ...p, recommendationEdit: { ...edit(), text: '   ' } }), undefined);
  assert.equal(savedRecommendationEdit({ ...p, recommendationEdit: { ...edit(), basis: undefined as any } }), undefined);
  assert.equal(savedRecommendationEdit({ ...p, recommendationEdit: { ...edit(), basis: { kind: 'award' } as any } }), undefined);
  assert.ok(savedRecommendationEdit({ ...p, recommendationEdit: edit() }));
});

// يشغّل المعالج على مشروع ويعيد المشروع المحفوظ (undefined إن لم يُحفظ شيء)
const run = (project: TenderProject, e: RecommendationEdit | null, systemText = 'نص النظام') => {
  let saved: TenderProject | undefined;
  const ctx = createEditContext(project, project.bidders[0], (fn: any) => { saved = fn([project])[0]; });
  createRecommendationHandlers(ctx).handleSaveRecommendationEdit(e, systemText);
  return saved;
};

test('handleSaveRecommendationEdit: الحفظ والاستعادة يسجَّلان', () => {
  const p = award();
  const saved = run(p, edit());
  assert.ok(saved);
  assert.equal(saved!.recommendationEdit?.text, 'صياغة اللجنة');
  assert.notEqual(saved!.updatedAt, p.updatedAt);
  assert.ok(saved!.auditLogs.some(l => l.action === 'تعديل صياغة التوصية'));

  const restored = run(saved!, null);
  assert.ok(restored);
  assert.equal(restored!.recommendationEdit, undefined);
  assert.ok(restored!.auditLogs.some(l => l.action === 'استعادة صياغة النظام للتوصية'));

  assert.equal(run(p, null), undefined);
});

test('recommendationEditsExport: المناقصات المعدّلة وحدها مع صياغة النظام', () => {
  const plain = award();
  const p = award();
  const sys = recommendationPieces(p, p.bidders[0]);
  p.recommendationEdit = { text: 'صياغة اللجنة', systemText: sys.systemText, basis: sys.basis, editedAt: '2026-10-23T00:00:00.000Z' };
  const out = recommendationEditsExport([plain, p], '1.21.0');
  assert.equal(out.entries.length, 1);
  const en = out.entries[0];
  assert.equal(en.committeeText, 'صياغة اللجنة');
  assert.equal(en.systemTextAtEdit, sys.systemText);
  assert.equal(en.systemTextNow, sys.systemText);
  assert.deepEqual(en.changedSince, []);
  assert.equal(out.appVersion, '1.21.0');
});

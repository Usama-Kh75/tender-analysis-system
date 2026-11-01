// معرّفات الفقرات: إضافة مجهز لطلبية كبيرة لا تكرر معرّفاً، وما كُرّر في بيانات محفوظة يُصلَح عند التحميل (2026-11-01)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNewTenderProject, uniqueItemIds } from '../src/utils/storageService';
import { calculateBOQMetrics } from '../src/utils/calculations';
import { createEditContext } from '../src/app/editContext';
import { createBidderHandlers } from '../src/app/bidderHandlers';
import type { TenderProject } from '../src/types/tender';

const bigTender = (rows: number): TenderProject => {
  const p = createNewTenderProject({ title: 'كبيرة', referenceNumber: '1', contractType: 'supply', budgetType: 'operating', bidderNames: ['أ'] });
  const raw = Array.from({ length: rows }, (_, i) => ({
    id: `item-${i + 1}-x`, itemNo: String(i + 1), description: `مادة ${i + 1}`, quantity: 1, estimatedTotal: 100, bidderTotal: 100
  }));
  const recalc = calculateBOQMetrics(raw, p.deviationThreshold);
  return { ...p, bidders: [{ ...p.bidders[0], items: recalc.items, totals: recalc.totals }] };
};

test('استنساخ 464 فقرة لمجهز جديد لا يكرر معرّفاً (مراراً لأن التصادم كان عشوائياً)', () => {
  const g = globalThis as any;
  g.prompt = () => 'ب';
  for (let k = 0; k < 20; k++) {
    const project = bigTender(464);
    let saved!: TenderProject;
    const ctx = createEditContext(project, project.bidders[0], (fn: any) => { saved = fn([project])[0]; });
    createBidderHandlers(ctx, { closeSettings: () => {} }).handleAddNewBidder('ب');
    const added = saved.bidders[1];
    assert.equal(added.items.length, 464);
    assert.equal(new Set(added.items.map(i => i.id)).size, 464);
  }
});

test('المعرّف المكرر داخل مجهز يأخذ معرّفاً جديداً ولا يتغير شيء آخر', () => {
  const p = bigTender(5);
  const items = p.bidders[0].items.map((it, i) => (i === 4 ? { ...it, id: p.bidders[0].items[1].id } : it));
  const broken = { ...p, bidders: [{ ...p.bidders[0], items }] };
  const fixed = uniqueItemIds(broken);
  const ids = fixed.bidders[0].items.map(i => i.id);
  assert.equal(new Set(ids).size, 5);
  assert.equal(ids[1], items[1].id, 'الأول يبقى كما هو');
  assert.deepEqual(fixed.bidders[0].items.map(i => [i.itemNo, i.description, i.bidderTotal]), items.map(i => [i.itemNo, i.description, i.bidderTotal]));
  assert.equal(fixed.auditLogs.length, broken.auditLogs.length + 1);
});

test('بيانات بلا تكرار تُرجَع كما هي بلا قيد في السجل', () => {
  const p = bigTender(5);
  assert.equal(uniqueItemIds(p), p);
});

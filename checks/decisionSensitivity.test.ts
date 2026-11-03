// حساسية القرار: فقرات تنتظر المطابقة بالورقة بحجم يكفي لقلب الترسية (عرض فقط)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNewTenderProject } from '../src/utils/storageService';
import { calculateBOQMetrics } from '../src/utils/calculations';
import { decisionSensitivity } from '../src/utils/decisionSensitivity';
import type { BOQItem, TenderProject } from '../src/types/tender';

const diff = { fields: ['المبلغ'], second: 'خانة المبلغ وحدها: 1' };
const row = (id: string, amount: number, extra: Partial<BOQItem> = {}): Partial<BOQItem> => ({
  id, itemNo: id, description: `فقرة ${id}`, quantity: 1, estimatedTotal: 1000,
  bidderTotal: amount, enteredBidderTotal: amount, enteredUnitPrice: amount, ...extra
});

const make = (specs: Partial<BOQItem>[][], statuses: Record<number, 'disqualified' | 'recommended'> = {}): TenderProject => {
  const p = createNewTenderProject({ title: 'ط', referenceNumber: '1', contractType: 'supply', budgetType: 'operating', bidderNames: specs.map((_, i) => `م${i + 1}`) });
  return {
    ...p,
    bidders: p.bidders.map((b, i) => {
      const c = calculateBOQMetrics(specs[i], p.deviationThreshold);
      return { ...b, items: c.items, totals: c.totals, status: statuses[i] ?? b.status };
    })
  };
};

// الكلفة التخمينية 2000 للجميع (فقرتان): العطاء 1900 = ‎-5%‎ ضمن الحدود
const clean = (a: number, b: number) => [row('1', a), row('2', b)];
const flagged = (a: number, b: number) => [row('1', a, { readBy: 'ai', readCheck: diff }), row('2', b, { readBy: 'ai' })];

test('لا فقرات تنتظر المطابقة: null', () => {
  assert.equal(decisionSensitivity(make([clean(900, 1000), clean(950, 1000)])), null);
});

test('فقرات معلَّمة لكن مجموعها دون الفرق: null', () => {
  // 1900 مقابل 1990: الفرق 90، والفقرة المعلَّمة 50
  assert.equal(decisionSensitivity(make([[row('1', 50, { readBy: 'ai', readCheck: diff }), row('2', 1850, { readBy: 'ai' })], clean(990, 1000)])), null);
});

test('مجموع الفقرات المعلَّمة يبلغ الفرق: تحذير بالأرقام', () => {
  const s = decisionSensitivity(make([flagged(900, 1000), clean(950, 1000)]))!;
  assert.ok(s);
  assert.equal(s.primary.name, 'م1');
  assert.equal(s.rival.name, 'م2');
  assert.equal(s.gap, 50);
  assert.deepEqual([s.primary.rows, s.primary.amount, s.rival.rows, s.rival.amount], [1, 900, 0, 0]);
});

test('الفقرات المعلَّمة عند المنافس تُحسب أيضاً', () => {
  const s = decisionSensitivity(make([clean(900, 1000), flagged(950, 1000)]))!;
  assert.deepEqual([s.primary.rows, s.rival.rows, s.rival.amount], [0, 1, 950]);
});

test('عطاء واحد مؤهل: null', () => {
  assert.equal(decisionSensitivity(make([flagged(900, 1000), clean(950, 1000)], { 1: 'disqualified' })), null);
});

test('اختيار اللجنة لغير الأوطأ: المقارنة مع الأقرب إليه مبلغاً', () => {
  const s = decisionSensitivity(make([clean(900, 1000), flagged(950, 1000), clean(990, 1000)], { 1: 'recommended' }))!;
  assert.equal(s.primary.name, 'م2');
  assert.equal(s.rival.name, 'م3'); // المنافس الأقرب مبلغاً (فرق 40) لا الأوطأ (فرق 50)
  assert.equal(s.gap, 40);
});

// فصل حد استبعاد العطاء عن حد الفقرة المنحرفة (exclusionThresholdOf وbuildRecommendation) ونصوص الفقرات القانونية
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRecommendation, exclusionThresholdOf } from '../src/utils/recommendation';
import { LEGAL_TEXTS } from '../src/utils/legalTexts';
import type { Bidder, TenderProject } from '../src/types/tender';

const bidder = (id: string, amount: number, dev: number): Bidder =>
  ({ id, name: id, status: 'pending', items: [], totals: { totalBidderAmount: amount, totalEstimatedAmount: 100, totalDeviationPercent: dev } }) as unknown as Bidder;
const project = (extra: Partial<TenderProject>, bidders: Bidder[]) =>
  ({ deviationThreshold: 20, bidders, ...extra }) as unknown as TenderProject;

test('exclusionThresholdOf يرجع إلى حد الفقرة حين لا حد استبعاد', () => {
  assert.equal(exclusionThresholdOf({ deviationThreshold: 20 }), 20);
  assert.equal(exclusionThresholdOf({ deviationThreshold: 15 }), 15);
  assert.equal(exclusionThresholdOf({ deviationThreshold: 20, exclusionThreshold: 10 }), 10);
});

test('حد استبعاد 10 وحد فقرة 20: عطاء بانحراف 15% يُستبعد', () => {
  const bs = [bidder('a', 115, 15)];
  assert.equal(buildRecommendation(project({ exclusionThreshold: 10 }, bs)).kind, 'referral');
  assert.equal(buildRecommendation(project({}, bs)).kind, 'award');
  // حد الفقرة وحده لا يستبعد
  assert.equal(buildRecommendation(project({ deviationThreshold: 10 }, bs)).kind, 'referral');
  assert.equal(buildRecommendation(project({ deviationThreshold: 10, exclusionThreshold: 20 }, bs)).kind, 'award');
});

test('النصوص القانونية منسوخة ولها صفحات', () => {
  for (const t of Object.values(LEGAL_TEXTS)) assert.ok(t.text.length > 20 && t.page && t.label);
  assert.ok(LEGAL_TEXTS.art20_4.text.startsWith('لجهة التعاقد اعادة الإعلان'));
});

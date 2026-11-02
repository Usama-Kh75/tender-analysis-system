// قراءة التبويب المحفوظ عبر «حفظ والتحديث»: القيم القديمة (table/summary/charts) تُقرأ على مقابلها الجديد
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeResumeTab } from '../src/resume';

test('القيم الجديدة تبقى كما هي', () => {
  assert.equal(normalizeResumeTab('bids'), 'bids');
  assert.equal(normalizeResumeTab('analysis'), 'analysis');
  assert.equal(normalizeResumeTab('status'), 'status');
});

test('القيم القديمة تُقرأ على مقابلها', () => {
  assert.equal(normalizeResumeTab('table'), 'bids');
  assert.equal(normalizeResumeTab('summary'), 'analysis');
  assert.equal(normalizeResumeTab('charts'), 'analysis');
});

test('ما سواها يفتح «العطاءات»', () => {
  assert.equal(normalizeResumeTab(undefined), 'bids');
  assert.equal(normalizeResumeTab(42), 'bids');
});

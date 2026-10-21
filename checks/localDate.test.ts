// أسماء ملفات النسخ وتاريخ المناقصة الافتراضي بتوقيت الجهاز لا UTC
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { localDate } from '../src/utils/localDate';

test('آخر الليل يأخذ تاريخ اليوم المحلي', () => {
  assert.equal(localDate(new Date(2026, 9, 18, 1, 37)), '2026-10-18');
  assert.equal(localDate(new Date(2026, 9, 18, 23, 59)), '2026-10-18');
});

test('الشهر واليوم برقمين', () => {
  assert.equal(localDate(new Date(2026, 0, 5, 12, 0)), '2026-01-05');
});

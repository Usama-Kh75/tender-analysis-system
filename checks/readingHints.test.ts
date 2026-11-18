// تلميح «الأرجح خطأ قراءة» (ملاحظات أسامة على عطاء مكتوب بخط اليد، 2026-11-13)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readingHint } from '../src/utils/readingHints';

test('تبادل ٢/٣ فقط', () => {
  assert.equal(readingHint(2250, 3250)?.kind, 'swap23');
  assert.equal(readingHint(2500, 3500)?.kind, 'swap23');
  assert.equal(readingHint(2250, 2350)?.kind, 'swap23');
});

test('عدد الأصفار فقط', () => {
  assert.equal(readingHint(400000, 40000)?.kind, 'zeros');
  assert.equal(readingHint(1500, 15000)?.kind, 'zeros');
});

test('غير ذلك لا تلميح', () => {
  assert.equal(readingHint(1234, 5678), null);
  assert.equal(readingHint(2250, 4250), null);
  assert.equal(readingHint(2250, 2250), null);
  assert.equal(readingHint(0, 100), null);
  assert.equal(readingHint(12.5, 13.5), null);
});

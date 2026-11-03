// نصائح ما قبل القراءة: دقة المسح الأصلية وتصنيف نوع الكتابة (عرض فقط)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scanLongEdge, lowResolutionPages, LOW_RESOLUTION_EDGE } from '../src/utils/readAdvice';
import { parseWritingCheck } from '../src/utils/ocrService';

const A4_LANDSCAPE = { width: 842, height: 595 };

test('مسح بحجم الصفحة (ولو مدوَّر): أطول بُعد للصورة', () => {
  assert.equal(scanLongEdge([{ width: 2784, height: 4040 }], A4_LANDSCAPE), 4040);
  assert.equal(scanLongEdge([{ width: 1700, height: 1200 }], A4_LANDSCAPE), 1700);
});

test('شعار أو ختم صغير لا يُعدّ مسحاً: صفحة رقمية null', () => {
  assert.equal(scanLongEdge([{ width: 300, height: 300 }], A4_LANDSCAPE), null);
  assert.equal(scanLongEdge([], A4_LANDSCAPE), null);
});

test('عدة صور: الأكبر المطابقة لنسبة الصفحة', () => {
  assert.equal(scanLongEdge([{ width: 300, height: 300 }, { width: 1200, height: 850 }, { width: 1700, height: 1200 }], A4_LANDSCAPE), 1700);
});

test('الدقة المنخفضة: دون الحد فقط، والمجهول لا يُعدّ منخفضاً', () => {
  assert.deepEqual(lowResolutionPages([2000, LOW_RESOLUTION_EDGE - 1, null, undefined, LOW_RESOLUTION_EDGE, 900]), [1, 5]);
});

test('تصنيف الكتابة: القيم الثلاث، وغيرها يُرفض', () => {
  assert.equal(parseWritingCheck('{"writing":"handwritten"}').rows[0].writing, 'handwritten');
  assert.equal(parseWritingCheck('```json\n{"writing":"mixed"}\n```').rows[0].writing, 'mixed');
  assert.equal(parseWritingCheck('نص {"writing":"printed"} نص').rows[0].writing, 'printed');
  assert.throws(() => parseWritingCheck('{"writing":"scribble"}'));
  assert.throws(() => parseWritingCheck('لا JSON'));
});

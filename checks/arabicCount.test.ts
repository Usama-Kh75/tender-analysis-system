import { test } from 'node:test';
import assert from 'node:assert/strict';
import { errorsCountText, itemsCountText, itemsWithErrorsText } from '../src/utils/arabicCount';

test('العدد بالعربية: مفرد ومثنى وجمع قلة وتمييز منصوب', () => {
  assert.deepEqual([1, 2, 3, 10, 11, 25].map(itemsCountText), ['فقرة واحدة', 'فقرتان', '3 فقرات', '10 فقرات', '11 فقرة', '25 فقرة']);
  assert.deepEqual([1, 2, 3, 10, 11].map(errorsCountText), ['خطأ واحد', 'خطآن', '3 أخطاء', '10 أخطاء', '11 خطأ']);
  assert.equal(itemsWithErrorsText(3), '3 فقرات فيها أخطاء');
});

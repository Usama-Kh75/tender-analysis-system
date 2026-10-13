import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolvePageStarts, pagesFromStarts, startItemNos, summarizePages } from '../src/utils/pageSummary';
import type { BOQItem } from '../src/types/tender';

const items = (n: number) => Array.from({ length: n }, (_, k) => ({ itemNo: String(k + 1), bidderTotal: 10 * (k + 1) })) as BOQItem[];

test('فواصل الصفحات: أرقام الفقرات إلى مواضع، والإسناد بالترتيب', () => {
  const r = resolvePageStarts(items(6), ['1', '3', '6']);
  assert.deepEqual(r, { starts: [0, 2, 5] });
  assert.deepEqual(pagesFromStarts(6, [0, 2, 5]), [1, 1, 2, 2, 2, 3]);
});

test('فواصل غير صحيحة: رقم غير موجود، أو غير متصاعد، أو مكرر، أو قائمة فارغة', () => {
  assert.match((resolvePageStarts(items(6), ['1', '9']) as { error: string }).error, /9/);
  assert.match((resolvePageStarts(items(6), ['1', '4', '3']) as { error: string }).error, /بعد/);
  assert.match((resolvePageStarts(items(6), ['1', '1']) as { error: string }).error, /بعد/);
  assert.ok('error' in resolvePageStarts(items(6), []));
});

test('الصفحة الأولى تبدأ من أول فقرة دائماً حتى لو أُدخل غيرها', () => {
  assert.deepEqual(pagesFromStarts(4, [2]), [1, 1, 1, 1]);
});

test('أرقام أول فقرة لكل صفحة من الإسناد الحالي', () => {
  const its = items(5).map((it, k) => ({ ...it, pageNo: [1, 1, 2, 2, 3][k] }));
  assert.deepEqual(startItemNos(its), ['1', '3', '5']);
  assert.deepEqual(startItemNos(items(3)), []);
});

test('الملخص: مجموع الصفحات = مجموع العطاء، وفقرات بلا صفحة في صف مستقل', () => {
  const its = [
    { itemNo: '1', pageNo: 1, enteredBidderTotal: 100, bidderTotal: 90, offerTotal: 95 },
    { itemNo: '2', pageNo: 1, enteredBidderTotal: 50, bidderTotal: 50 },
    { itemNo: '3', pageNo: 2, enteredBidderTotal: 30, bidderTotal: 30, offerTotal: 25 },
    { itemNo: '4', bidderTotal: 20 }
  ] as BOQItem[];
  const s = summarizePages(its)!;
  assert.deepEqual(s.rows.map(r => r.page), [1, 2, null]);
  assert.deepEqual(s.rows[0], { page: 1, itemCount: 2, stated: 150, corrected: 140, offer: 145 });
  assert.equal(s.unassigned, 1);
  assert.deepEqual(s.totals, { stated: 200, corrected: 190, offer: 190 });
  assert.equal(summarizePages(items(3)), null);
});

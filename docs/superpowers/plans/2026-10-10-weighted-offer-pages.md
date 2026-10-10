# العرض الموزون واختبار التوازن وملخص الصفحات — خطة التنفيذ

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** اختبار توازن العطاء وفق ضوابط رقم (4) سادساً/5، ومرحلة «العرض الموزون» في نفس جدول الفقرات بطبقة مستقلة، وتسوية تقريب الأسعار الموزونة، ورقم صفحة لكل فقرة وملخص صفحات في الشاشة والمحضر وExcel.

**Architecture:** المنطق كله دوال نقية في `src/utils/weightedRounding.ts` و`src/utils/weightedOffer.ts` و`src/utils/pageSummary.ts`، تُفحص بـ `npm run check` (rolldown + `node --test`). `calculateBOQMetrics` تستعمل التسوية وتحمل الحقول الجديدة. `App.tsx` يملك المعالجات والقفل كالعادة، والمكونات تعرض فقط.

**Tech Stack:** React 19 + TypeScript، Vite 8 (rolldown)، xlsx-js-style، Node 24 (`node --test`).

**Spec:** `docs/superpowers/specs/2026-10-10-weighted-bid-pages-design.md`

## Global Constraints

- الملف المنفرد يبقى بلا تثبيت ولا خادم؛ لا اعتمادية جديدة في `dependencies` ولا `devDependencies` (rolldown موجود مع Vite).
- كل نص يراه المستخدم بالعربية. التعليقات في الكود بالعربية كبقية المشروع.
- لا يُكتب العرض الموزون فوق `enteredUnitPrice`/`enteredBidderTotal`/`bidderTotal` أبداً.
- التسلسل والتوصية يبقيان على `totals.totalBidderAmount` (بعد التصحيح، خامساً/ب/6).
- اختبار 10%: الفقرات المنحرفة **بالزيادة** فقط (`deviationPercent > threshold`)، والحد `UNBALANCED_ITEMS_LIMIT_PERCENT = 10`، والنسبة ≤ 10 تعني «يُقبل مبلغ العطاء كما هو».
- كل تغيير يمر بـ `addAuditLog`.
- النص القانوني المقتبس من سادساً/5 يُنقل حرفياً من `E:/Claude Projects/تعليمات 2025/contract-instructions-2025-offline/src/units/annex-04.json` (id `a4-exclusion-20-percent-unbalanced`).
- `npm run build` و`npm run check` يجب أن ينجحا في نهاية كل مهمة.
- نافذة جديدة تحمل عملاً غير مطبّق تُضاف إلى `blockingWork` في `App.tsx`.

## Review Focus

1. **عطاء جداوله بكميات كبيرة (مثل 1,650) بلا فقرة كميتها 1**: التسوية يجب أن تقترب من الصفر قدر الإمكان، وما يبقى يظهر «فرق تقريب متبقٍ» لا يُخفى — فحص في المهمة 1.
2. **تعديل مشترك من تبويب مجهز آخر بينما لمجهز عرض موزون فعّال** (كمية، تخميني، استيراد، إضافة فقرة): يُرفض برسالة — فحص `offerLockReason` في المهمة 3، ومعالجات App في المهمة 5.
3. **فقرات لم يُسنَد لها رقم صفحة في عطاء مُسنَد جزئياً**: تظهر في صف «فقرات بلا صفحة» ولا يختل المجموع — فحص في المهمة 4.
4. **رقم فقرة مكرر أو غير موجود أو غير متصاعد في نافذة فواصل الصفحات**: رسالة خطأ ولا يُطبَّق شيء — فحص `resolvePageStarts` في المهمة 4.
5. **رد Gemini برقم صفحة خارج الدفعة أو غير صحيح أو بعد تقسيم دفعة مقطوعة**: لا يُسنَد رقم خاطئ — فحص `attachPages` في المهمة 8.

---

## خريطة الملفات

| الملف | المسؤولية |
|---|---|
| `checks/run.mjs` (جديد) | يجمّع `checks/*.test.ts` إلى `checks/.out` ويشغّلها بـ `node --test` |
| `checks/*.test.ts` (جديد) | فحوص الدوال النقية |
| `src/types/tender.ts` | الحقول الجديدة |
| `src/utils/weightedRounding.ts` (جديد) | `settleWeightedPrices` — بلا أي import |
| `src/utils/calculations.ts` | التسوية في `calculateBOQMetrics` وحمل الحقول الجديدة |
| `src/utils/weightedOffer.ts` (جديد) | `assessBalance`، حالة العرض، القفل |
| `src/utils/pageSummary.ts` (جديد) | فواصل الصفحات وملخصها |
| `src/App.tsx` | المعالجات، القفل، تمرير الخصائص، النافذة الجديدة |
| `src/components/WeightedOfferBar.tsx` (جديد) | حكم التوازن وأزرار المرحلة والشريط الحي |
| `src/components/BOQTable.tsx` | وضع العرض، عمود «ص»، علامة السعر غير المعقول، مرشّح التبليغ |
| `src/components/modals/PageBreaksModal.tsx` (جديد) | نافذة فواصل الصفحات |
| `src/components/PageSummaryTable.tsx` (جديد) | جدول ملخص الصفحات على الشاشة |
| `src/utils/ocrService.ts` | حقل `page` في قراءة Gemini |
| `src/components/modals/PrintReportModal.tsx` | الحكم، العرض الموزون، الصفحات، قائمة التبليغ، صياغة التوصية |
| `src/utils/bidderAuditExcel.ts` | ورقة «ملخص الصفحات»، أعمدة العرض، دالة بناء قابلة للفحص |
| `CLAUDE.md`، `src/changelog.ts`، `package.json` | التوثيق والإصدار |

---

### Task 0: مشغّل الفحوص

**Files:**
- Create: `checks/run.mjs`
- Create: `checks/smoke.test.ts`
- Modify: `package.json` (scripts)
- Modify: `.gitignore`

**Interfaces:**
- Produces: `npm run check [filter]` — يشغّل كل `checks/*.test.ts` (أو ما يحوي اسمه `filter`).

- [ ] **Step 1: اكتب الفحص الأول**

`checks/smoke.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateBOQMetrics } from '../src/utils/calculations';

test('calculateBOQMetrics يجمع مبلغ المجهز', () => {
  const { totals } = calculateBOQMetrics([
    { itemNo: 1, description: 'أ', quantity: 2, estimatedTotal: 100, bidderTotal: 110 },
    { itemNo: 2, description: 'ب', quantity: 1, estimatedTotal: 50, bidderTotal: 40 }
  ], 20);
  assert.equal(totals.totalBidderAmount, 150);
});
```

- [ ] **Step 2: اكتب المشغّل**

`checks/run.mjs`:
```js
// فحوص الدوال النقية: يجمّع كل checks/*.test.ts بـ rolldown (مثبّت مع Vite، فلا اعتمادية جديدة) إلى
// checks/.out ثم يشغّلها بـ node --test. الحزم الخارجية تبقى import عادياً فتُحل من node_modules.
// الاستعمال: npm run check  أو  npm run check -- weighted  (ما يحوي اسمه الكلمة)
import { build } from 'rolldown';
import { readdirSync, rmSync, mkdirSync } from 'node:fs';
import { join, dirname, basename, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '.out');
const only = process.argv[2];
const tests = readdirSync(here).filter(f => f.endsWith('.test.ts') && (!only || f.includes(only)));
if (tests.length === 0) {
  console.error('لا فحوص مطابقة');
  process.exit(1);
}
rmSync(out, { recursive: true, force: true });
mkdirSync(out);
for (const t of tests) {
  await build({
    input: join(here, t),
    platform: 'node',
    external: id => !id.startsWith('.') && !isAbsolute(id),
    logLevel: 'silent',
    output: { file: join(out, basename(t, '.ts') + '.mjs'), format: 'esm' }
  });
}
const r = spawnSync(process.execPath, ['--test', ...tests.map(t => join(out, basename(t, '.ts') + '.mjs'))], { stdio: 'inherit' });
process.exitCode = r.status ?? 1;
```

- [ ] **Step 3: أضف السكربت والتجاهل**

في `package.json` ضمن `scripts` بعد `"lint"`:
```json
    "check": "node checks/run.mjs",
```
وفي `.gitignore` سطر:
```
checks/.out
```

- [ ] **Step 4: شغّل**

Run: `npm run check`
Expected: `ℹ pass 1` و`ℹ fail 0`.

- [ ] **Step 5: Commit**

```bash
git add checks/run.mjs checks/smoke.test.ts package.json .gitignore
git commit -m "فحوص آلية للدوال النقية: npm run check"
```

---

### Task 1: تسوية تقريب الأسعار الموزونة والحقول الجديدة

**Files:**
- Modify: `src/types/tender.ts`
- Create: `src/utils/weightedRounding.ts`
- Modify: `src/utils/calculations.ts:127-236`
- Test: `checks/weightedRounding.test.ts`

**Interfaces:**
- Produces:
  - في `BOQItem`: `pageNo?: number; offerUnitPrice?: number; offerTotal?: number; weightedAdjustment?: number; unreasonablePrice?: { note: string; markedAt: string }`
  - في `TenderTotals`: `weightedRoundingResidual?: number`
  - في `Bidder`: `weightedOffer?: WeightedOfferState`
  - `export interface WeightedOfferState { status: 'active' | 'adopted' | 'paused'; origin: 'corrected' | 'formula'; startedAt: string; adoptedAt?: string; bidTotal: number }`
  - `settleWeightedPrices(items: { quantity: number; estimatedTotal: number }[], ratio: number, target: number): { rows: { unitPrice: number; amount: number; adjustment: number }[]; total: number; residual: number }`

- [ ] **Step 1: اكتب الفحوص**

`checks/weightedRounding.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { settleWeightedPrices } from '../src/utils/weightedRounding';
import { calculateBOQMetrics } from '../src/utils/calculations';

const cents = (v: number) => Math.round(v * 100);

test('النسبة 1: الأسعار الموزونة هي التخمينية بلا تسوية', () => {
  const r = settleWeightedPrices([{ quantity: 1, estimatedTotal: 100 }, { quantity: 2, estimatedTotal: 200 }], 1, 300);
  assert.deepEqual(r.rows.map(x => x.amount), [100, 200]);
  assert.deepEqual(r.rows.map(x => x.unitPrice), [100, 100]);
  assert.equal(r.residual, 0);
  assert.ok(r.rows.every(x => x.adjustment === 0));
});

test('فلس باقٍ يُحمَّل على فقرة كميتها 1', () => {
  const ratio = 1000 / 300;
  const r = settleWeightedPrices(
    [{ quantity: 3, estimatedTotal: 100 }, { quantity: 1, estimatedTotal: 100 }, { quantity: 3, estimatedTotal: 100 }], ratio, 1000);
  assert.equal(r.total, 1000);
  assert.equal(r.residual, 0);
  assert.deepEqual(r.rows.map(x => x.adjustment), [0, 0.01, 0]);
  assert.equal(r.rows[1].amount, 333.34);
});

test('فرق لا تغلقه الكميات يبقى ظاهراً', () => {
  const r = settleWeightedPrices([{ quantity: 3, estimatedTotal: 100 }, { quantity: 3, estimatedTotal: 100 }, { quantity: 3, estimatedTotal: 100 }], 1000 / 300, 1000);
  assert.equal(r.total, 999.99);
  assert.equal(r.residual, 0.01);
  assert.ok(r.rows.every(x => x.adjustment === 0));
});

test('فقرة تخمينيها صفر لا تُسعَّر ولا تُحرَّك، والنسبة صفر لا تسوية', () => {
  const r = settleWeightedPrices([{ quantity: 1, estimatedTotal: 0 }, { quantity: 1, estimatedTotal: 100 }], 1.5, 150);
  assert.deepEqual(r.rows[0], { unitPrice: 0, amount: 0, adjustment: 0 });
  const z = settleWeightedPrices([{ quantity: 1, estimatedTotal: 100 }], 0, 0);
  assert.equal(z.residual, 0);
  assert.equal(z.total, 0);
});

test('جدول كبير بكميات كبيرة وفقرة واحدة كميتها 1: يُغلق الفرق، والمبلغ = الكمية × المفرد في كل فقرة', () => {
  const items = Array.from({ length: 120 }, (_, k) => ({
    quantity: k === 57 ? 1 : 7 + ((k * 37) % 1650),
    estimatedTotal: 1000 + ((k * 7919) % 900000)
  }));
  const est = items.reduce((s, i) => s + i.estimatedTotal, 0);
  const target = 1234567890.12;
  const r = settleWeightedPrices(items, target / est, target);
  assert.equal(r.residual, 0);
  assert.equal(cents(r.total), cents(target));
  r.rows.forEach((row, k) => assert.equal(cents(row.amount), Math.round(items[k].quantity * cents(row.unitPrice))));
});

test('جدول كمياته كلها كبيرة: الباقي أصغر من أصغر أثر ممكن', () => {
  const items = Array.from({ length: 40 }, (_, k) => ({ quantity: 1650 + k * 10, estimatedTotal: 7425000 + k * 1000 }));
  const est = items.reduce((s, i) => s + i.estimatedTotal, 0);
  const target = 312345678.9;
  const r = settleWeightedPrices(items, target / est, target);
  assert.ok(Math.abs(cents(r.residual)) < 1650);
  assert.equal(cents(r.total) + cents(r.residual), cents(target));
});

test('calculateBOQMetrics: مجموع الأسعار الموزونة = مبلغ العطاء، والحقول الجديدة تبقى', () => {
  const { items, totals } = calculateBOQMetrics([
    { itemNo: 1, description: 'أ', quantity: 3, estimatedTotal: 100, bidderTotal: 400, pageNo: 1, offerUnitPrice: 130, offerTotal: 390,
      unreasonablePrice: { note: 'ملاحظة', markedAt: '2026-10-10' } },
    { itemNo: 2, description: 'ب', quantity: 1, estimatedTotal: 100, bidderTotal: 300, pageNo: 2 },
    { itemNo: 3, description: 'ج', quantity: 3, estimatedTotal: 100, bidderTotal: 300, pageNo: 2 }
  ], 20);
  assert.equal(totals.newPricesTotal, totals.totalBidderAmount);
  assert.equal(totals.weightedRoundingResidual, 0);
  assert.equal(items[0].pageNo, 1);
  assert.equal(items[0].offerTotal, 390);
  assert.equal(items[0].offerUnitPrice, 130);
  assert.equal(items[0].unreasonablePrice?.note, 'ملاحظة');
  assert.equal(items[1].weightedAdjustment, 0.01);
  assert.equal(items[0].weightedAdjustment, undefined);
});
```

- [ ] **Step 2: شغّل وتأكد من الفشل**

Run: `npm run check -- weightedRounding`
Expected: فشل التجميع أو الفحوص (`weightedRounding` غير موجود).

- [ ] **Step 3: الأنواع**

في `src/types/tender.ts` داخل `BOQItem` بعد `unpriced?: boolean;`:
```ts
  pageNo?: number;                 // رقم صفحة الفقرة في عطاء المجهز كما قدّمه (لكل مجهز ترقيمه)
  // طبقة العرض الموزون (ضوابط رقم (4) سادساً/5): لا تمس ما دوّنه المجهز ولا ما بعد التصحيح الحسابي
  offerUnitPrice?: number;
  offerTotal?: number;
  // ما حُرّك به المفرد الموزون المرجعي لتسوية التقريب (weightedRounding.ts)، مثل 0.01
  weightedAdjustment?: number;
  // تأشير اللجنة على سعر غير معقول (خطأ تسعير لا حسابي)، للإحاطة والتبليغ فقط ولا يدخل في أي حساب
  unreasonablePrice?: { note: string; markedAt: string };
```
وفي `TenderTotals` بعد `newPricesTotal`:
```ts
  weightedRoundingResidual?: number;  // ما تعذّرت تسويته من فرق تقريب الأسعار الموزونة (يظهر صراحة)
```
وقبل `export interface Bidder`:
```ts
// مرحلة العرض الموزون لعطاء (ضوابط رقم (4) سادساً/5). paused: أُوقفت وبقيت تعديلاتها لتُستأنف
export interface WeightedOfferState {
  status: 'active' | 'adopted' | 'paused';
  origin: 'corrected' | 'formula';   // من أسعار العطاء بعد التصحيح، أو بالمعادلة (التخميني × النسبة)
  startedAt: string;
  adoptedAt?: string;
  bidTotal: number;                  // مبلغ العطاء بعد التصحيح عند البدء أو الاستئناف — مرجع المطابقة
}
```
وفي `Bidder` بعد `statedTotal?: number;`:
```ts
  weightedOffer?: WeightedOfferState;
```

- [ ] **Step 4: دالة التسوية**

`src/utils/weightedRounding.ts`:
```ts
/**
 * الأسعار الموزونة (ضوابط رقم (4) سادساً/5): مفرد كل فقرة = النسبة السعرية × مبلغها التخميني ÷ كميتها، مقرّباً
 * لمنزلتين، ومبلغها = الكمية × المفرد. تقريب كل فقرة على حدة يترك فرقاً عن مبلغ العطاء، فيُسوّى بتحريك مفرد بعض
 * الفقرات 0.01 بجولات: كل جولة من الأكبر كمية إلى الأصغر، وتُحرَّك الفقرة إن لم يتجاوز أثرها الباقي. الأكبر أولاً
 * يقلل الفقرات المحرّكة، والصغيرة تكمل الفلوس الأخيرة. ما يتعذر يبقى في residual ويظهر صراحة.
 * الحساب بالفلس (أعداد صحيحة) لتفادي كسور الفاصلة العائمة. بلا import كي تستعملها calculations.ts دون دوران
 */
export interface WeightedInput { quantity: number; estimatedTotal: number }
export interface WeightedRow { unitPrice: number; amount: number; adjustment: number }
export interface WeightedPrices { rows: WeightedRow[]; total: number; residual: number }

const toCents = (v: number) => Math.round(v * 100);
const MAX_ROUNDS = 1000;

export function settleWeightedPrices(items: WeightedInput[], ratio: number, target: number): WeightedPrices {
  const priced = (i: WeightedInput) => i.estimatedTotal > 0 && i.quantity > 0;
  const unit = items.map(i => priced(i) ? toCents(ratio * i.estimatedTotal / i.quantity) : 0);
  const amount = items.map((i, k) => priced(i) ? Math.round(i.quantity * unit[k])
    : i.estimatedTotal > 0 ? toCents(ratio * i.estimatedTotal) : 0);
  const moved = items.map(() => 0);
  let residual = ratio > 0 ? toCents(target) - amount.reduce((s, c) => s + c, 0) : 0;

  const order = items.map((_, k) => k).filter(k => priced(items[k]))
    .sort((a, b) => items[b].quantity - items[a].quantity || a - b);
  for (let round = 0; residual !== 0 && round < MAX_ROUNDS; round++) {
    let progressed = false;
    for (const k of order) {
      if (residual === 0) break;
      const step = Math.sign(residual);
      if (unit[k] + step < 0) continue;
      const delta = Math.round(items[k].quantity * (unit[k] + step)) - amount[k];
      if (delta === 0 || Math.sign(delta) !== step || Math.abs(delta) > Math.abs(residual)) continue;
      unit[k] += step;
      amount[k] += delta;
      moved[k] += step;
      residual -= delta;
      progressed = true;
    }
    if (!progressed) break;
  }

  return {
    rows: items.map((_, k) => ({ unitPrice: unit[k] / 100, amount: amount[k] / 100, adjustment: moved[k] / 100 })),
    total: amount.reduce((s, c) => s + c, 0) / 100,
    residual: residual / 100
  };
}
```

- [ ] **Step 5: الربط في `calculateBOQMetrics`**

في `src/utils/calculations.ts` أضف في أعلى الملف:
```ts
import { settleWeightedPrices } from './weightedRounding';
```
وفي كائن الإرجاع داخل `preppedItems` (بعد `unpriced: item.unpriced`) أضف — الكائن مبني حقلاً حقلاً فأي حقل غير مذكور يضيع:
```ts
      unpriced: item.unpriced,
      pageNo: item.pageNo,
      offerUnitPrice: item.offerUnitPrice,
      offerTotal: item.offerTotal,
      unreasonablePrice: item.unreasonablePrice
```
واستبدل الجزء من `let newPricesTotal = 0;` حتى نهاية `finalItems` بـ:
```ts
  // الأسعار الموزونة مقرّبة لمنزلتين ومسوّاة لتساوي مبلغ العطاء (weightedRounding.ts)
  const weighted = settleWeightedPrices(
    preppedItems.map(i => ({ quantity: i.quantity, estimatedTotal: i.estimatedTotal })),
    overallPriceRatio,
    Math.round(totalBidder * 100) / 100
  );

  const finalItems: BOQItem[] = preppedItems.map((item, index) => {
    const { unitPrice, amount, adjustment } = weighted.rows[index];

    if (item.isDeviated) {
      deviatedItemsSum += item.deviatedAmount;
      deviatedItemsCount += 1;
    }

    return {
      ...item,
      priceRatio: overallPriceRatio,
      newPrice: amount,
      weightedUnitPrice: unitPrice,
      weightedAdjustment: adjustment !== 0 ? adjustment : undefined
    };
  });
```
(أبقِ تعريفي `deviatedItemsSum` و`deviatedItemsCount` كما هما، واحذف `let newPricesTotal = 0;`.) وفي `totals` استبدل سطر `newPricesTotal`:
```ts
    newPricesTotal: weighted.total,
    weightedRoundingResidual: weighted.residual
```

- [ ] **Step 6: شغّل**

Run: `npm run check`
Expected: كل الفحوص تمر.

Run: `npm run build`
Expected: ينجح بلا أخطاء أنواع.

- [ ] **Step 7: Commit**

```bash
git add src/types/tender.ts src/utils/weightedRounding.ts src/utils/calculations.ts checks/weightedRounding.test.ts
git commit -m "الأسعار الموزونة بمنزلتين ومجموعها يساوي مبلغ العطاء (تسوية التقريب)، وحقول العرض الموزون والصفحة"
```

---

### Task 2: اختبار التوازن (سادساً/5)

**Files:**
- Create: `src/utils/weightedOffer.ts`
- Test: `checks/balance.test.ts`

**Interfaces:**
- Consumes: `BOQItem` (Task 1).
- Produces:
  - `UNBALANCED_ITEMS_LIMIT_PERCENT = 10`
  - `interface BalanceRow { description?: string; estimatedTotal: number; amount: number }`
  - `type BalanceVerdict = 'no-estimate' | 'excluded' | 'accept-as-is' | 'weighting-required'`
  - `interface BalanceAssessment { verdict: BalanceVerdict; itemCount: number; unbalancedCount: number; unbalancedPercent: number; belowCount: number; totalDeviationPercent: number }`
  - `assessBalance(rows: BalanceRow[], threshold: number): BalanceAssessment`
  - `correctedBalanceRows(items: BOQItem[]): BalanceRow[]` و`offerBalanceRows(items: BOQItem[]): BalanceRow[]`
  - `BALANCE_VERDICT_LABEL: Record<BalanceVerdict, string>`

- [ ] **Step 1: اكتب الفحوص**

`checks/balance.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assessBalance, correctedBalanceRows, offerBalanceRows } from '../src/utils/weightedOffer';
import type { BOQItem } from '../src/types/tender';

// عشر فقرات تخمين كل منها 100؛ amounts تحدد مبلغ المجهز
const rows = (amounts: number[]) => amounts.map((amount, k) => ({ description: `مادة ${k + 1}`, estimatedTotal: 100, amount }));

test('فقرة واحدة منحرفة بالزيادة من عشر = 10% فيُقبل العطاء كما هو', () => {
  const a = assessBalance(rows([125, 100, 100, 100, 100, 100, 100, 100, 100, 95]), 20);
  assert.equal(a.unbalancedCount, 1);
  assert.equal(a.itemCount, 10);
  assert.equal(a.unbalancedPercent, 10);
  assert.equal(a.verdict, 'accept-as-is');
});

test('فقرتان منحرفتان بالزيادة من عشر = 20% فيلزم الموزون', () => {
  const a = assessBalance(rows([125, 125, 90, 90, 90, 100, 100, 100, 100, 100]), 20);
  assert.equal(a.unbalancedCount, 2);
  assert.equal(a.verdict, 'weighting-required');
});

test('المنحرفة بالنقصان تُعدّ منفصلة ولا تدخل في النسبة', () => {
  const a = assessBalance(rows([50, 50, 50, 130, 130, 130, 130, 130, 100, 100]), 20);
  assert.equal(a.belowCount, 3);
  assert.equal(a.unbalancedCount, 5);
  const b = assessBalance(rows([70, 70, 70, 110, 110, 110, 110, 110, 110, 110]), 20);
  assert.equal(b.belowCount, 3);
  assert.equal(b.unbalancedCount, 0);
  assert.equal(b.verdict, 'accept-as-is');
});

test('العطاء المنحرف بمبلغه الكلي مستبعد، وبلا تخميني بانتظار', () => {
  assert.equal(assessBalance(rows([200, 200, 200, 200, 200, 200, 200, 200, 200, 200]), 20).verdict, 'excluded');
  assert.equal(assessBalance([{ estimatedTotal: 0, amount: 100 }], 20).verdict, 'no-estimate');
});

test('صف فارغ («فقرة N» بلا مبالغ) لا يُعدّ في مجموع الفقرات', () => {
  const a = assessBalance([...rows([125, 100, 100, 100, 100, 100, 100, 100, 100, 95]), { description: 'فقرة 11', estimatedTotal: 0, amount: 0 }], 20);
  assert.equal(a.itemCount, 10);
});

test('صفوف الطبقتين: المصحح من bidderTotal، والعرض من offerTotal إن وُجد', () => {
  const items = [
    { description: 'أ', estimatedTotal: 100, bidderTotal: 130, offerTotal: 110 },
    { description: 'ب', estimatedTotal: 100, bidderTotal: 90 }
  ] as BOQItem[];
  assert.deepEqual(correctedBalanceRows(items).map(r => r.amount), [130, 90]);
  assert.deepEqual(offerBalanceRows(items).map(r => r.amount), [110, 90]);
});
```

- [ ] **Step 2: شغّل وتأكد من الفشل**

Run: `npm run check -- balance`
Expected: فشل (الوحدة غير موجودة).

- [ ] **Step 3: التنفيذ**

`src/utils/weightedOffer.ts`:
```ts
import type { BOQItem } from '../types/tender';

/**
 * اختبار توازن العطاء — ضوابط رقم (4) سادساً/5 (ص69): «...وفي حالة ورود عطاء مستجيب والأنسب سعراً مع وجود نسبة
 * انحراف بالتحليل السعري ببعض الفقرات (غير متوازنة) بنسبة تتجاوز (20%) زيادة لكل فقرة على حدة والتي تشكل مجموعها
 * نسبة لا تتجاوز (10%) من مجموع عدد الفقرات الكلية فيتم قبول مبلغ العطاء كما هو، وفي حالة تجاوز نسبة الانحراف في
 * الفقرات (غير المتوازنة) نسبة ال (10%) من عدد الفقرات الكلية فيتم قبول الإحالة لهذا العطاء مع اعتماد جدول الكميات
 * المسعر من قبل جهة التعاقد بدلاً عن جدول كميات ذلك العطاء على أن يتم تعديل سعر الفقرات بنفس نسبة مبلغ العطاء
 * الفائز بالزيادة أو النقصان مع استدعاء مقدم العطاء لغرض التوضيح وختم الجداول المعدلة».
 * تُعدّ الفقرات المنحرفة بالزيادة وحدها كما في النص («زيادة»)؛ المنحرفة بالنقصان تُعرض للإحاطة فقط
 */
export const UNBALANCED_ITEMS_LIMIT_PERCENT = 10;

export interface BalanceRow { description?: string; estimatedTotal: number; amount: number }
export type BalanceVerdict = 'no-estimate' | 'excluded' | 'accept-as-is' | 'weighting-required';
export interface BalanceAssessment {
  verdict: BalanceVerdict;
  itemCount: number;          // مجموع عدد الفقرات (بلا الصفوف الفارغة)
  unbalancedCount: number;    // منحرفة بالزيادة فوق الحد
  unbalancedPercent: number;
  belowCount: number;         // منحرفة بالنقصان فوق الحد (للإحاطة)
  totalDeviationPercent: number;
}

export const BALANCE_VERDICT_LABEL: Record<BalanceVerdict, string> = {
  'no-estimate': 'بانتظار الكلفة التخمينية',
  excluded: 'العطاء منحرف بمبلغه الكلي فيُستبعد',
  'accept-as-is': 'يُقبل مبلغ العطاء كما هو (سادساً/5)',
  'weighting-required': 'يلزم اعتماد الجدول الموزون (سادساً/5)'
};

const round2 = (v: number) => Math.round(v * 100) / 100;
// صف لم يُملأ (الأول في مناقصة جديدة أو «+ إضافة فقرة»): ليس فقرة من جدول الكميات
const isPlaceholder = (r: BalanceRow) => (r.description || '').startsWith('فقرة ') && !(r.estimatedTotal > 0) && !(r.amount > 0);

export function assessBalance(rows: BalanceRow[], threshold: number): BalanceAssessment {
  const counted = rows.filter(r => !isPlaceholder(r));
  const est = counted.reduce((s, r) => s + r.estimatedTotal, 0);
  const amt = counted.reduce((s, r) => s + r.amount, 0);
  // مقرّب كما في totals.totalDeviationPercent الذي يستعمله isCommerciallyExcluded، فلا يختلف الحكمان عند الحد
  const totalDeviationPercent = est > 0 ? round2(((amt - est) / est) * 100) : 0;
  const deviation = (r: BalanceRow) => ((r.amount - r.estimatedTotal) / r.estimatedTotal) * 100;
  const withEstimate = counted.filter(r => r.estimatedTotal > 0);
  const unbalancedCount = withEstimate.filter(r => deviation(r) > threshold).length;
  const belowCount = withEstimate.filter(r => deviation(r) < -threshold).length;
  const unbalancedPercent = counted.length > 0 ? round2((unbalancedCount / counted.length) * 100) : 0;
  const verdict: BalanceVerdict = !(est > 0) ? 'no-estimate'
    : Math.abs(totalDeviationPercent) > threshold ? 'excluded'
    : unbalancedPercent > UNBALANCED_ITEMS_LIMIT_PERCENT ? 'weighting-required'
    : 'accept-as-is';
  return { verdict, itemCount: counted.length, unbalancedCount, unbalancedPercent, belowCount, totalDeviationPercent };
}

export const correctedBalanceRows = (items: BOQItem[]): BalanceRow[] =>
  items.map(i => ({ description: i.description, estimatedTotal: i.estimatedTotal, amount: i.bidderTotal }));

export const offerBalanceRows = (items: BOQItem[]): BalanceRow[] =>
  items.map(i => ({ description: i.description, estimatedTotal: i.estimatedTotal, amount: i.offerTotal ?? i.bidderTotal }));
```

- [ ] **Step 4: شغّل**

Run: `npm run check -- balance`
Expected: PASS. ثم `npm run build` ينجح.

- [ ] **Step 5: Commit**

```bash
git add src/utils/weightedOffer.ts checks/balance.test.ts
git commit -m "اختبار توازن العطاء وفق ضوابط رقم (4) سادساً/5"
```

---

### Task 3: حالة العرض الموزون والقفل

**Files:**
- Modify: `src/utils/weightedOffer.ts`
- Test: `checks/offer.test.ts`

**Interfaces:**
- Consumes: `Bidder`, `BOQItem`, `TenderProject`, `WeightedOfferState` (Task 1)؛ `hasBidAmounts` من `src/utils/recommendation.ts`.
- Produces:
  - `isOfferLocked(b: Bidder): boolean` — status `active` أو `adopted`
  - `startOfferBlocker(b: Bidder, threshold: number): string | null`
  - `offerFieldsFromCorrected(items: BOQItem[]): Pick<BOQItem, 'offerUnitPrice' | 'offerTotal'>[]`
  - `offerFieldsFromFormula(items: BOQItem[]): Pick<BOQItem, 'offerUnitPrice' | 'offerTotal'>[]`
  - `offerUnitPatch(item: BOQItem, unit: number): Pick<BOQItem, 'offerUnitPrice' | 'offerTotal'>`
  - `isOfferEdited(item: BOQItem): boolean`
  - `interface OfferStatus { offerSum: number; bidTotal: number; diff: number; editedCount: number; markedNotEdited: number; stale: boolean; canAdopt: boolean }`
  - `offerStatus(b: Bidder): OfferStatus | null`
  - `offerLockReason(project: TenderProject, scope: { bidderId?: string; shared?: boolean }): string | null`

- [ ] **Step 1: اكتب الفحوص**

`checks/offer.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateBOQMetrics } from '../src/utils/calculations';
import {
  isOfferLocked, startOfferBlocker, offerFieldsFromCorrected, offerFieldsFromFormula, offerUnitPatch,
  isOfferEdited, offerStatus, offerLockReason
} from '../src/utils/weightedOffer';
import type { Bidder, BOQItem, TenderProject, WeightedOfferState } from '../src/types/tender';

const bidder = (raw: Partial<BOQItem>[], extra: Partial<Bidder> = {}): Bidder => {
  const { items, totals } = calculateBOQMetrics(raw, 20);
  return { id: 'b1', name: 'شركة أ', submissionDate: '2026-10-10', items, totals, status: 'pending', ...extra };
};
const base: Partial<BOQItem>[] = [
  { itemNo: 1, description: 'أ', quantity: 2, estimatedTotal: 1000, bidderTotal: 1100, enteredUnitPrice: 550, enteredBidderTotal: 1100 },
  { itemNo: 2, description: 'ب', quantity: 1, estimatedTotal: 500, bidderTotal: 480, enteredUnitPrice: 480, enteredBidderTotal: 480 }
];
const offer = (o: Partial<WeightedOfferState>): WeightedOfferState =>
  ({ status: 'active', origin: 'corrected', startedAt: '2026-10-10', bidTotal: 1580, ...o });

test('موانع البدء: بلا تخميني، منحرف كلياً، ملاحظات معلقة', () => {
  assert.equal(startOfferBlocker(bidder(base), 20), null);
  assert.match(startOfferBlocker(bidder(base.map(i => ({ ...i, estimatedTotal: 0 }))), 20)!, /التخمينية/);
  assert.match(startOfferBlocker(bidder(base.map(i => ({ ...i, bidderTotal: (i.bidderTotal || 0) * 2, enteredBidderTotal: (i.bidderTotal || 0) * 2 }))), 20)!, /منحرف/);
  assert.match(startOfferBlocker(bidder([{ ...base[0], hasMathError: true }, base[1]]), 20)!, /بانتظار قرار اللجنة/);
});

test('البدء من أسعار العطاء يطابق المبلغ، وبالمعادلة يساوي الأسعار الموزونة', () => {
  const b = bidder(base);
  assert.deepEqual(offerFieldsFromCorrected(b.items), [{ offerUnitPrice: 550, offerTotal: 1100 }, { offerUnitPrice: 480, offerTotal: 480 }]);
  const f = offerFieldsFromFormula(b.items);
  assert.equal(f.reduce((s, x) => s + (x.offerTotal || 0), 0), b.totals.totalBidderAmount);
});

test('تعديل المفرد: المبلغ = الكمية × المفرد مقرّباً', () => {
  const b = bidder(base);
  assert.deepEqual(offerUnitPatch(b.items[0], 333.335), { offerUnitPrice: 333.335, offerTotal: 666.67 });
});

test('حالة العرض: الفرق والمعدّل والمؤشر غير المعدّل والقدم', () => {
  const b = bidder([{ ...base[0], offerUnitPrice: 600, offerTotal: 1200 }, { ...base[1], offerUnitPrice: 480, offerTotal: 480,
    unreasonablePrice: { note: 'س', markedAt: 'x' } }], { weightedOffer: offer({}) });
  const s = offerStatus(b)!;
  assert.equal(s.offerSum, 1680);
  assert.equal(s.diff, 100);
  assert.equal(s.editedCount, 1);
  assert.equal(s.markedNotEdited, 1);
  assert.equal(s.stale, false);
  assert.equal(s.canAdopt, false);
  assert.ok(isOfferEdited(b.items[0]));
  const balanced = bidder([{ ...base[0], offerUnitPrice: 500, offerTotal: 1000 }, { ...base[1], offerUnitPrice: 580, offerTotal: 580 }], { weightedOffer: offer({}) });
  assert.equal(offerStatus(balanced)!.canAdopt, true);
  const stale = bidder(base, { weightedOffer: offer({ bidTotal: 9999 }) });
  assert.equal(offerStatus(stale)!.stale, true);
  assert.equal(offerStatus(bidder(base)), null);
});

test('القفل: العرض الفعّال أو المعتمد يقفل عطاءه والتعديلات المشتركة، والموقوف لا يقفل', () => {
  const a = bidder(base, { id: 'a', name: 'أ', weightedOffer: offer({ status: 'adopted' }) });
  const c = bidder(base, { id: 'c', name: 'ج' });
  const project = { bidders: [a, c] } as TenderProject;
  assert.ok(isOfferLocked(a));
  assert.match(offerLockReason(project, { bidderId: 'a' })!, /أ/);
  assert.equal(offerLockReason(project, { bidderId: 'c' }), null);
  assert.match(offerLockReason(project, { bidderId: 'c', shared: true })!, /مشترك/);
  const paused = { bidders: [bidder(base, { weightedOffer: offer({ status: 'paused' }) })] } as TenderProject;
  assert.equal(offerLockReason(paused, { shared: true }), null);
});
```

- [ ] **Step 2: شغّل وتأكد من الفشل**

Run: `npm run check -- offer`
Expected: فشل (الدوال غير مصدّرة).

- [ ] **Step 3: التنفيذ** — أضف إلى نهاية `src/utils/weightedOffer.ts`، وعدّل سطر الاستيراد في أعلاه:

```ts
import type { BOQItem, Bidder, TenderProject } from '../types/tender';
import { hasBidAmounts } from './recommendation';
```
```ts
// العرض الفعّال أو المعتمد يقفل أرقام عطائه والتعديلات المشتركة؛ الموقوف لا يقفل (أُوقف لتصحيح قراءة)
export const isOfferLocked = (b: Bidder) => b.weightedOffer?.status === 'active' || b.weightedOffer?.status === 'adopted';

/** سبب منع بدء العرض الموزون، أو null إن جاز */
export function startOfferBlocker(b: Bidder, threshold: number): string | null {
  if (!hasBidAmounts(b)) return 'لا مبالغ في هذا العطاء بعد.';
  if (!(b.totals.totalEstimatedAmount > 0)) return 'لم تُدخل الكلفة التخمينية بعد، فلا نسبة سعرية ولا انحراف.';
  if (Math.abs(b.totals.totalDeviationPercent) > threshold) {
    return `العطاء منحرف بمبلغه الكلي (${b.totals.totalDeviationPercent.toFixed(2)}%) عن الكلفة التخمينية فيُستبعد، ولا يُعدّ له عرض موزون (سادساً/5).`;
  }
  const pending = b.items.filter(i => i.hasMathError || i.hasTextDiscrepancy).length;
  if (pending > 0) return `(${pending}) فقرة بانتظار قرار اللجنة في التصحيح الحسابي؛ يُعدّ العرض الموزون بعد اكتماله.`;
  return null;
}

/** نقطة انطلاق: أسعار العطاء بعد التصحيح كما هي، ثم تُعدَّل الفقرات التي غيّرها المجهز */
export const offerFieldsFromCorrected = (items: BOQItem[]) =>
  items.map(i => ({ offerUnitPrice: i.quantity > 0 ? i.bidderTotal / i.quantity : i.bidderTotal, offerTotal: i.bidderTotal }));

/** نقطة انطلاق: المعادلة (التخميني × النسبة)، وهي الأسعار الموزونة المسوّاة التي حسبها calculateBOQMetrics */
export const offerFieldsFromFormula = (items: BOQItem[]) =>
  items.map(i => ({ offerUnitPrice: i.weightedUnitPrice, offerTotal: i.newPrice }));

/** تعديل مفرد فقرة في العرض: المبلغ = الكمية × المفرد مقرّباً لمنزلتين، فلا يتولد خطأ ضرب */
export const offerUnitPatch = (item: BOQItem, unit: number) =>
  ({ offerUnitPrice: unit, offerTotal: Math.round((item.quantity > 0 ? item.quantity : 1) * unit * 100) / 100 });

export const isOfferEdited = (i: BOQItem) => i.offerTotal !== undefined && Math.abs(i.offerTotal - i.bidderTotal) >= 0.005;

export interface OfferStatus {
  offerSum: number;
  bidTotal: number;
  diff: number;             // مجموع العرض − مبلغ العطاء؛ يجب أن يكون صفراً للاعتماد
  editedCount: number;
  markedNotEdited: number;  // مؤشرة «سعر غير معقول» ولم يُعدَّل سعرها في العرض
  stale: boolean;           // تغيّر مبلغ العطاء بعد البدء أو الاستئناف
  canAdopt: boolean;
}

export function offerStatus(b: Bidder): OfferStatus | null {
  if (!b.weightedOffer) return null;
  const offerSum = round2(b.items.reduce((s, i) => s + (i.offerTotal ?? i.bidderTotal), 0));
  const bidTotal = b.totals.totalBidderAmount;
  const diff = round2(offerSum - bidTotal);
  const stale = Math.abs(b.weightedOffer.bidTotal - bidTotal) >= 0.005;
  return {
    offerSum, bidTotal, diff,
    editedCount: b.items.filter(isOfferEdited).length,
    markedNotEdited: b.items.filter(i => i.unreasonablePrice && !isOfferEdited(i)).length,
    stale,
    canAdopt: !stale && Math.abs(diff) < 0.005
  };
}

/**
 * سبب رفض تعديل يغيّر أرقام عطاء له عرض موزون فعّال أو معتمد. shared: التعديل مشترك بين العطاءات كلها
 * (الكمية، التخميني، إضافة فقرة أو حذفها، الاستيراد)، فيقفله عرض أي مجهز
 */
export function offerLockReason(project: TenderProject, scope: { bidderId?: string; shared?: boolean }): string | null {
  const locked = project.bidders.filter(b => isOfferLocked(b) && (scope.shared || b.id === scope.bidderId));
  if (locked.length === 0) return null;
  const names = locked.map(b => b.name).join('، ');
  return `أرقام العطاء مقفلة أثناء العرض الموزون (${names})${scope.shared ? '، وهذا التعديل مشترك بين كل العطاءات' : ''}.\n`
    + 'أوقف مرحلة العرض الموزون أولاً (تُحفظ تعديلاتها وتعود عند الاستئناف).';
}
```

- [ ] **Step 4: شغّل**

Run: `npm run check`
Expected: PASS للجميع. ثم `npm run build` و`npm run lint` بلا أخطاء جديدة.

- [ ] **Step 5: Commit**

```bash
git add src/utils/weightedOffer.ts checks/offer.test.ts
git commit -m "حالة العرض الموزون: موانع البدء ونقطتا الانطلاق والمطابقة والقفل"
```

---

### Task 4: الصفحات — الإسناد والملخص

**Files:**
- Create: `src/utils/pageSummary.ts`
- Test: `checks/pages.test.ts`

**Interfaces:**
- Produces:
  - `resolvePageStarts(items: BOQItem[], itemNos: string[]): { starts: number[] } | { error: string }`
  - `pagesFromStarts(itemCount: number, starts: number[]): (number | undefined)[]`
  - `startItemNos(items: BOQItem[]): string[]` — رقم أول فقرة لكل صفحة مسندة حالياً
  - `interface PageSummaryRow { page: number | null; itemCount: number; stated: number; corrected: number; offer: number }`
  - `interface PageSummary { rows: PageSummaryRow[]; totals: { stated: number; corrected: number; offer: number }; unassigned: number }`
  - `summarizePages(items: BOQItem[]): PageSummary | null`

- [ ] **Step 1: اكتب الفحوص**

`checks/pages.test.ts`:
```ts
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
```

- [ ] **Step 2: شغّل وتأكد من الفشل**

Run: `npm run check -- pages`
Expected: فشل.

- [ ] **Step 3: التنفيذ**

`src/utils/pageSummary.ts`:
```ts
import type { BOQItem } from '../types/tender';

/**
 * صفحات عطاء المجهز كما قدّمه: رقم صفحة لكل فقرة (pageNo، لكل مجهز ترقيمه)، وملخص بمبلغ كل صفحة في الطبقات
 * الثلاث (كما دوّنه المجهز، بعد التصحيح الحسابي، العرض الموزون). مجموع الصفحات يساوي مجموع العطاء دائماً:
 * الفقرات بلا صفحة صف مستقل لا تُسقط
 */

const round2 = (v: number) => Math.round(v * 100) / 100;
const key = (v: unknown) => String(v ?? '').trim();

/** أرقام أول فقرة في كل صفحة (كما أدخلتها اللجنة) إلى مواضع في الجدول، أو سبب الرفض */
export function resolvePageStarts(items: BOQItem[], itemNos: string[]): { starts: number[] } | { error: string } {
  const wanted = itemNos.map(key);
  if (wanted.length === 0 || wanted.some(n => !n)) return { error: 'أدخل رقم أول فقرة لكل صفحة.' };
  const starts: number[] = [];
  for (let p = 0; p < wanted.length; p++) {
    const from = p === 0 ? 0 : starts[p - 1] + 1;
    const idx = items.findIndex((it, i) => i >= from && key(it.itemNo) === wanted[p]);
    if (idx === -1) {
      const exists = items.some(it => key(it.itemNo) === wanted[p]);
      return { error: exists
        ? `الصفحة (${p + 1}): الفقرة (${wanted[p]}) يجب أن تأتي بعد أول فقرة في الصفحة (${p}).`
        : `الصفحة (${p + 1}): لا توجد فقرة رقمها (${wanted[p]}) في الجدول.` };
    }
    starts.push(idx);
  }
  return { starts };
}

/** رقم صفحة كل فقرة من مواضع بدايات الصفحات. الصفحة الأولى تبدأ من أول فقرة دائماً */
export function pagesFromStarts(itemCount: number, starts: number[]): (number | undefined)[] {
  const s = [0, ...starts.slice(1)];
  return Array.from({ length: itemCount }, (_, i) => s.filter(x => x <= i).length);
}

/** أرقام أول فقرة لكل صفحة مسندة حالياً، لتعبئة نافذة فواصل الصفحات */
export function startItemNos(items: BOQItem[]): string[] {
  const seen = new Set<number>();
  const out: { page: number; itemNo: string }[] = [];
  items.forEach(it => {
    if (it.pageNo !== undefined && !seen.has(it.pageNo)) {
      seen.add(it.pageNo);
      out.push({ page: it.pageNo, itemNo: key(it.itemNo) });
    }
  });
  return out.sort((a, b) => a.page - b.page).map(x => x.itemNo);
}

export interface PageSummaryRow { page: number | null; itemCount: number; stated: number; corrected: number; offer: number }
export interface PageSummary { rows: PageSummaryRow[]; totals: { stated: number; corrected: number; offer: number }; unassigned: number }

export function summarizePages(items: BOQItem[]): PageSummary | null {
  if (!items.some(i => i.pageNo !== undefined)) return null;
  const groups = new Map<number | null, PageSummaryRow>();
  items.forEach(i => {
    const page = i.pageNo ?? null;
    const row = groups.get(page) ?? { page, itemCount: 0, stated: 0, corrected: 0, offer: 0 };
    row.itemCount += 1;
    row.stated += i.enteredBidderTotal || i.bidderTotal;
    row.corrected += i.bidderTotal;
    row.offer += i.offerTotal ?? i.bidderTotal;
    groups.set(page, row);
  });
  const rows = [...groups.values()]
    .map(r => ({ ...r, stated: round2(r.stated), corrected: round2(r.corrected), offer: round2(r.offer) }))
    .sort((a, b) => (a.page ?? Infinity) - (b.page ?? Infinity));
  const sum = (f: 'stated' | 'corrected' | 'offer') => round2(rows.reduce((s, r) => s + r[f], 0));
  return {
    rows,
    totals: { stated: sum('stated'), corrected: sum('corrected'), offer: sum('offer') },
    unassigned: groups.get(null)?.itemCount ?? 0
  };
}
```

- [ ] **Step 4: شغّل**

Run: `npm run check`
Expected: PASS. ثم `npm run build`.

- [ ] **Step 5: Commit**

```bash
git add src/utils/pageSummary.ts checks/pages.test.ts
git commit -m "صفحات العطاء: إسناد بفواصل الصفحات وملخص بمبالغ كل صفحة"
```

---

### Task 5: معالجات App والقفل

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: كل ما في المهام 1–4.
- Produces (تُمرَّر للمكونات في المهام 6 و7):
  - `handleStartOffer(origin: 'corrected' | 'formula' | 'resume'): void`
  - `handlePauseOffer(): void`
  - `handleAdoptOffer(): void` و`handleUnadoptOffer(): void`
  - `handleEditOfferUnit(index: number, unit: number): void`
  - `handleMarkUnreasonable(index: number, note: string | null): void`
  - `handleSetItemPage(index: number, page: number | undefined): void`
  - `handleApplyPageBreaks(pages: (number | undefined)[]): void`
  - حالة `isPageBreaksOpen` و`setIsPageBreaksOpen`

- [ ] **Step 1: الاستيرادات**

أضف بعد استيراد `isCommitteeCorrected`:
```ts
import { isOfferLocked, offerLockReason, startOfferBlocker, offerFieldsFromCorrected, offerFieldsFromFormula,
  offerUnitPatch, offerStatus } from './utils/weightedOffer';
```
(`addAuditLog` يقبل `extra.bidderId` أصلاً — `storageService.ts:366`، فلا تعديل هناك.)

- [ ] **Step 2: الحالة و`blockingWork`**

بعد `const [isWhatsNewOpen, ...]`:
```ts
  const [isPageBreaksOpen, setIsPageBreaksOpen] = useState(false);
```
وفي `blockingWork` قبل `: null`:
```ts
    : isPageBreaksOpen ? 'فواصل الصفحات'
```

- [ ] **Step 3: مساعد الحفظ والتنسيق** — بعد تعريف `activeBidder`:

```ts
  const fmtNum = (v?: number) => v === undefined ? '—' : v.toLocaleString('en-US', { maximumFractionDigits: 2 });
  // تعديل عطاء واحد بلا إعادة حساب (حقول العرض والصفحة والتأشير لا تدخل في calculateBOQMetrics)، مع قيد في السجل
  const commitBidder = (bidderId: string, update: (b: Bidder) => Bidder, action: string, details: string, meta?: Parameters<typeof addAuditLog>[3]) => {
    let updatedProj: TenderProject = {
      ...currentProject,
      bidders: currentProject.bidders.map(b => b.id === bidderId ? update(b) : b),
      updatedAt: new Date().toISOString()
    };
    updatedProj = addAuditLog(updatedProj, action, details, { bidderId, ...meta });
    setProjects(prev => prev.map(p => p.id === updatedProj.id ? updatedProj : p));
  };
  // يرفض تعديلاً يغيّر أرقام عطاء له عرض موزون فعّال أو معتمد، برسالة السبب
  const blockedByOffer = (scope: { bidderId?: string; shared?: boolean }) => {
    const reason = offerLockReason(currentProject, scope);
    if (reason) window.alert(reason);
    return !!reason;
  };
```

- [ ] **Step 4: الحراسة في المعالجات القائمة**

أضف في أول كل معالج (بعد التحقق من وجود الفقرة إن وُجد):

- `handleCorrectReading`:
```ts
    if (blockedByOffer({ bidderId: activeBidder.id, shared: field === 'quantity' })) return;
```
- `handleUpdateItemFields` (بعد حساب `fields`):
```ts
    // هوية الفقرة والملاحظات لا تغيّر أرقاماً، فلا يقفلها العرض الموزون
    const lockFree: (keyof BOQItem)[] = ['itemNo', 'description', 'unit', 'notes'];
    const priced = fields.filter(f => !lockFree.includes(f));
    if (priced.length > 0 && blockedByOffer({ bidderId: activeBidder.id, shared: priced.some(f => SHARED_ESTIMATE_FIELDS.includes(f)) })) return;
```
(انقل `SHARED_ESTIMATE_FIELDS` فوق `handleUpdateItemFields` إن لم يكن قبله؛ هو معرّف قبله في السطر 315.)
- `handleApplyExtractedItems` (أول سطر): `if (blockedByOffer({ shared: true })) return;`
- `handleAddItem`، `handleDeleteItem`، `handleDuplicateItem`، `handleResetAllBidders`: `if (blockedByOffer({ shared: true })) return;`
- `handleClearBidderPrices`: `if (blockedByOffer({ bidderId: activeBidder.id })) return;`

- [ ] **Step 5: حمل رقم الصفحة في الدمج**

في `handleApplyExtractedItems`، فرع `isNew` داخل `mergedItems.push({...})` بعد `unpriced: ext?.unpriced`:
```ts
          pageNo: ext?.pageNo
```
وفي فرع `isBidderOnly` (الصف الجديد):
```ts
          unpriced: ext?.unpriced,
          // صفحة الفقرة في هذا العطاء: من القراءة إن وُجدت، وإلا تبقى المسندة سابقاً (استيراد Excel بلا صفحات)
          pageNo: ext?.pageNo ?? existing?.pageNo
```

- [ ] **Step 6: معالجات العرض الموزون** — بعد `handleUpdateStatedTotal`:

```ts
  // بدء العرض الموزون (سادساً/5): من أسعار العطاء بعد التصحيح، أو بالمعادلة، أو استئناف عرض موقوف بتعديلاته
  const handleStartOffer = (origin: 'corrected' | 'formula' | 'resume') => {
    const blocker = startOfferBlocker(activeBidder, currentProject.deviationThreshold);
    if (blocker) { window.alert(blocker); return; }
    const prev = activeBidder.weightedOffer;
    if (origin !== 'resume' && activeBidder.items.some(i => i.offerTotal !== undefined) && !window.confirm(
      'لهذا العطاء تعديلات عرض موزون سابقة، وستُستبدل ببداية جديدة. هل تريد المتابعة؟')) return;
    const fields = origin === 'resume' ? null
      : origin === 'formula' ? offerFieldsFromFormula(activeBidder.items) : offerFieldsFromCorrected(activeBidder.items);
    const bidTotal = activeBidder.totals.totalBidderAmount;
    const label = origin === 'resume' ? 'استئناف العرض الموزون'
      : origin === 'formula' ? 'بدء العرض الموزون بالمعادلة (التخميني × النسبة السعرية)'
      : 'بدء العرض الموزون من أسعار العطاء بعد التصحيح';
    commitBidder(activeBidder.id, b => ({
      ...b,
      items: fields ? b.items.map((it, i) => ({ ...it, ...fields[i] })) : b.items,
      weightedOffer: {
        status: 'active',
        origin: origin === 'resume' ? (prev?.origin ?? 'corrected') : origin,
        startedAt: origin === 'resume' && prev ? prev.startedAt : new Date().toISOString(),
        bidTotal
      }
    }), label, `${label} لعطاء (${activeBidder.name}) — مبلغ العطاء بعد التصحيح (${fmtNum(bidTotal)})`);
  };

  // إيقاف المرحلة لتصحيح قراءة أو غيره: تُحفظ تعديلات العرض وتعود عند الاستئناف، ويسقط الاعتماد إن وُجد
  const handlePauseOffer = () => {
    const offer = activeBidder.weightedOffer;
    if (!offer || offer.status === 'paused') return;
    if (!window.confirm(`إيقاف مرحلة العرض الموزون لعطاء (${activeBidder.name})؟\n\n`
      + 'تُفتح أرقام العطاء للتعديل، وتُحفظ تعديلات العرض لتعود عند الاستئناف'
      + (offer.status === 'adopted' ? '، ويسقط اعتماد العرض الموزون.' : '.'))) return;
    commitBidder(activeBidder.id, b => ({ ...b, weightedOffer: { ...offer, status: 'paused', adoptedAt: undefined } }),
      'إيقاف العرض الموزون', `أُوقفت مرحلة العرض الموزون لعطاء (${activeBidder.name})${offer.status === 'adopted' ? ' وسقط اعتماده' : ''}`);
  };

  const handleAdoptOffer = () => {
    const s = offerStatus(activeBidder);
    if (!s || activeBidder.weightedOffer?.status !== 'active') return;
    if (!s.canAdopt) {
      window.alert(s.stale
        ? 'تغيّر مبلغ العطاء بعد بدء العرض الموزون. أوقف المرحلة ثم استأنفها لتُعاد المطابقة.'
        : `مجموع العرض الموزون (${fmtNum(s.offerSum)}) لا يساوي مبلغ العطاء (${fmtNum(s.bidTotal)}): الفرق (${fmtNum(s.diff)}).`);
      return;
    }
    commitBidder(activeBidder.id, b => ({ ...b, weightedOffer: { ...b.weightedOffer!, status: 'adopted', adoptedAt: new Date().toISOString() } }),
      'اعتماد العرض الموزون', `اعتُمد العرض الموزون لعطاء (${activeBidder.name}) بمجموع (${fmtNum(s.offerSum)}) مساوٍ لمبلغ العطاء، و(${s.editedCount}) فقرة معدّلة`);
  };

  const handleUnadoptOffer = () => {
    if (activeBidder.weightedOffer?.status !== 'adopted') return;
    if (!window.confirm('إلغاء اعتماد العرض الموزون والعودة إلى تعديله؟')) return;
    commitBidder(activeBidder.id, b => ({ ...b, weightedOffer: { ...b.weightedOffer!, status: 'active', adoptedAt: undefined } }),
      'إلغاء اعتماد العرض الموزون', `أُلغي اعتماد العرض الموزون لعطاء (${activeBidder.name})`);
  };

  // تعديل مفرد فقرة في العرض الموزون: طبقة مستقلة، لا تمس ما دوّنه المجهز ولا ما بعد التصحيح
  const handleEditOfferUnit = (index: number, unit: number) => {
    const before = activeBidder.items[index];
    if (!before || activeBidder.weightedOffer?.status !== 'active') return;
    const patch = offerUnitPatch(before, unit);
    commitBidder(activeBidder.id, b => ({ ...b, items: b.items.map((it, i) => i === index ? { ...it, ...patch } : it) }),
      'تعديل بالعرض الموزون',
      `سعر مفرد الفقرة رقم (${before.itemNo}) في العرض الموزون لعطاء (${activeBidder.name}) من (${fmtNum(before.offerUnitPrice)}) إلى (${fmtNum(unit)})، ومبلغها (${fmtNum(patch.offerTotal)})`,
      { itemNo: before.itemNo, oldValue: before.offerUnitPrice, newValue: unit });
  };

  // تأشير سعر غير معقول (خطأ تسعير لا حسابي): للإحاطة والتبليغ، لا يغيّر رقماً
  const handleMarkUnreasonable = (index: number, note: string | null) => {
    const before = activeBidder.items[index];
    if (!before) return;
    commitBidder(activeBidder.id,
      b => ({ ...b, items: b.items.map((it, i) => i === index
        ? { ...it, unreasonablePrice: note ? { note, markedAt: new Date().toISOString() } : undefined } : it) }),
      note ? 'تأشير سعر غير معقول' : 'إزالة تأشير سعر غير معقول',
      note ? `أُشّر سعر الفقرة رقم (${before.itemNo}) في عطاء (${activeBidder.name}) غير معقول: ${note}`
        : `أُزيل تأشير السعر غير المعقول عن الفقرة رقم (${before.itemNo}) في عطاء (${activeBidder.name})`,
      { itemNo: before.itemNo, oldValue: before.unreasonablePrice?.note, newValue: note ?? undefined });
  };

  const handleSetItemPage = (index: number, page: number | undefined) => {
    const before = activeBidder.items[index];
    if (!before || before.pageNo === page) return;
    commitBidder(activeBidder.id, b => ({ ...b, items: b.items.map((it, i) => i === index ? { ...it, pageNo: page } : it) }),
      'تعديل صفحة فقرة', `صفحة الفقرة رقم (${before.itemNo}) في عطاء (${activeBidder.name}) من (${before.pageNo ?? '—'}) إلى (${page ?? '—'})`,
      { itemNo: before.itemNo, oldValue: before.pageNo, newValue: page });
  };

  const handleApplyPageBreaks = (pages: (number | undefined)[]) => {
    const count = Math.max(0, ...pages.map(p => p ?? 0));
    commitBidder(activeBidder.id, b => ({ ...b, items: b.items.map((it, i) => ({ ...it, pageNo: pages[i] })) }),
      'فواصل صفحات العطاء', `أُسندت فقرات عطاء (${activeBidder.name}) إلى (${count}) صفحة حسب فواصل الصفحات`);
    setIsPageBreaksOpen(false);
  };
```

- [ ] **Step 7: تحقق**

Run: `npm run build`
Expected: ينجح (المعالجات غير الممررة بعد قد تُنبّه كمتغيرات غير مستعملة في oxlint فقط؛ تُمرَّر في المهمة 6).

- [ ] **Step 8: Commit**

```bash
git add src/App.tsx
git commit -m "معالجات العرض الموزون والصفحات وتأشير السعر غير المعقول، وقفل التعديلات أثناء العرض"
```

---

### Task 6: واجهة العرض الموزون في الجدول

**Files:**
- Create: `src/components/WeightedOfferBar.tsx`
- Modify: `src/components/BOQTable.tsx`
- Modify: `src/App.tsx` (تمرير الخصائص)

**Interfaces:**
- Consumes: معالجات المهمة 5؛ `assessBalance`, `correctedBalanceRows`, `offerBalanceRows`, `offerStatus`, `startOfferBlocker`, `isOfferEdited`, `BALANCE_VERDICT_LABEL`, `UNBALANCED_ITEMS_LIMIT_PERCENT`.
- Produces: خصائص `BOQTable` الجديدة: `offerMode: 'none' | 'active' | 'adopted'`, `sharedLocked: boolean`, `onEditOfferUnit?`, `onMarkUnreasonable?`, `onSetItemPage?`, `onOpenPageBreaks?`.

- [ ] **Step 1: الشريط**

`src/components/WeightedOfferBar.tsx`:
```tsx
import React from 'react';
import { Scale, Play, Pause, CheckCircle2, RotateCcw, AlertTriangle } from 'lucide-react';
import type { Bidder } from '../types/tender';
import { formatNumber } from '../utils/calculations';
import {
  assessBalance, correctedBalanceRows, offerBalanceRows, offerStatus, startOfferBlocker,
  BALANCE_VERDICT_LABEL, UNBALANCED_ITEMS_LIMIT_PERCENT
} from '../utils/weightedOffer';

interface Props {
  bidder: Bidder;
  threshold: number;
  onStart: (origin: 'corrected' | 'formula' | 'resume') => void;
  onPause: () => void;
  onAdopt: () => void;
  onUnadopt: () => void;
}

// حكم التوازن (سادساً/5) ومرحلة العرض الموزون للعطاء النشط: البدء، الشريط الحي، الاعتماد
export const WeightedOfferBar: React.FC<Props> = ({ bidder, threshold, onStart, onPause, onAdopt, onUnadopt }) => {
  const balance = assessBalance(correctedBalanceRows(bidder.items), threshold);
  const offer = bidder.weightedOffer;
  const status = offerStatus(bidder);
  const blocker = startOfferBlocker(bidder, threshold);
  const offerBalance = offer ? assessBalance(offerBalanceRows(bidder.items), threshold) : null;
  if (balance.verdict === 'no-estimate') return null;

  const verdictTone = balance.verdict === 'excluded' ? 'border-rose-300 bg-rose-50 text-rose-950'
    : balance.verdict === 'weighting-required' ? 'border-amber-300 bg-amber-50 text-amber-950'
    : 'border-emerald-300 bg-emerald-50 text-emerald-950';
  const btn = 'flex items-center gap-1.5 text-xs font-black px-3 py-1.5 rounded-xl transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';

  return (
    <div className={`rounded-3xl border-2 p-4 space-y-3 ${verdictTone}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Scale className="w-5 h-5 shrink-0" />
          <div>
            <div className="font-black text-sm">توازن العطاء (ضوابط رقم (4) سادساً/5): {BALANCE_VERDICT_LABEL[balance.verdict]}</div>
            <div className="text-xs font-bold mt-0.5">
              الفقرات المنحرفة بالزيادة أكثر من {threshold}%: ({balance.unbalancedCount}) من ({balance.itemCount}) = {balance.unbalancedPercent.toFixed(2)}%
              {' '}— الحد {UNBALANCED_ITEMS_LIMIT_PERCENT}%
              {balance.belowCount > 0 && <> — والمنحرفة بالنقصان للإحاطة: ({balance.belowCount})</>}
            </div>
          </div>
        </div>

        {(!offer || offer.status === 'paused') && balance.verdict !== 'excluded' && (
          <div className="flex flex-wrap items-center gap-2">
            {offer?.status === 'paused' && (
              <button className={`${btn} bg-purple-700 hover:bg-purple-800 text-white`} disabled={!!blocker} title={blocker ?? ''} onClick={() => onStart('resume')}>
                <Play className="w-3.5 h-3.5" /> استئناف العرض الموزون
              </button>
            )}
            <button className={`${btn} bg-white hover:bg-purple-50 text-purple-900 border border-purple-400`} disabled={!!blocker} title={blocker ?? 'تبدأ بأسعار العطاء بعد التصحيح، ثم تُعدَّل الفقرات التي غيّرها المجهز في جدوله المعدل'} onClick={() => onStart('corrected')}>
              <Play className="w-3.5 h-3.5" /> بدء العرض الموزون من أسعار العطاء
            </button>
            <button className={`${btn} bg-white hover:bg-purple-50 text-purple-900 border border-purple-400`} disabled={!!blocker} title={blocker ?? 'كل فقرة = مبلغها التخميني × النسبة السعرية، مع تسوية التقريب (نص سادساً/5)'} onClick={() => onStart('formula')}>
              <Play className="w-3.5 h-3.5" /> بدء العرض الموزون بالمعادلة
            </button>
          </div>
        )}
      </div>

      {blocker && (!offer || offer.status === 'paused') && balance.verdict !== 'excluded' && (
        <div className="text-xs font-bold">{blocker}</div>
      )}
      {!offer && balance.verdict === 'accept-as-is' && (
        <div className="text-[11px] font-bold opacity-80">إعداد العرض الموزون هنا اختياري بقرار اللجنة؛ النص يقبل مبلغ العطاء كما هو.</div>
      )}

      {offer && offer.status !== 'paused' && status && (
        <div className="bg-white/70 rounded-2xl border border-purple-300 p-3 space-y-2 text-purple-950">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="font-black text-sm">
              {offer.status === 'adopted' ? '✓ العرض الموزون معتمد' : 'مرحلة العرض الموزون — أرقام العطاء مقفلة'}
              <span className="text-xs font-bold opacity-70"> ({offer.origin === 'formula' ? 'بالمعادلة' : 'من أسعار العطاء'})</span>
            </div>
            <div className="flex items-center gap-2">
              {offer.status === 'active' ? (
                <button className={`${btn} bg-emerald-700 hover:bg-emerald-800 text-white`} disabled={!status.canAdopt} onClick={onAdopt}
                  title={status.canAdopt ? '' : 'يُعتمد حين يساوي مجموع العرض مبلغ العطاء تماماً'}>
                  <CheckCircle2 className="w-3.5 h-3.5" /> اعتماد العرض الموزون
                </button>
              ) : (
                <button className={`${btn} bg-white text-purple-900 border border-purple-400`} onClick={onUnadopt}>
                  <RotateCcw className="w-3.5 h-3.5" /> إلغاء الاعتماد
                </button>
              )}
              <button className={`${btn} bg-white text-slate-700 border border-slate-300`} onClick={onPause}>
                <Pause className="w-3.5 h-3.5" /> إيقاف المرحلة
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-bold">
            <div>مبلغ العطاء بعد التصحيح: <span className="font-mono">{formatNumber(status.bidTotal)}</span></div>
            <div>مجموع العرض الموزون: <span className="font-mono">{formatNumber(status.offerSum)}</span></div>
            <div className={Math.abs(status.diff) < 0.005 ? 'text-emerald-700' : 'text-rose-700'}>
              الفرق: <span className="font-mono">{formatNumber(status.diff)}</span>{Math.abs(status.diff) < 0.005 ? ' ✓' : ''}
            </div>
            <div>الفقرات المعدّلة: ({status.editedCount})</div>
          </div>
          {offerBalance && (
            <div className="text-xs font-bold">
              توازن العرض الموزون: ({offerBalance.unbalancedCount}) فقرة منحرفة بالزيادة = {offerBalance.unbalancedPercent.toFixed(2)}% — {BALANCE_VERDICT_LABEL[offerBalance.verdict]}
            </div>
          )}
          {status.markedNotEdited > 0 && (
            <div className="text-xs font-bold text-orange-800">⚑ ({status.markedNotEdited}) فقرة مؤشرة «سعر غير معقول» لم يُعدَّل سعرها في العرض.</div>
          )}
          {status.stale && (
            <div className="text-xs font-black text-rose-800 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" /> تغيّر مبلغ العطاء بعد بدء العرض الموزون؛ أوقف المرحلة ثم استأنفها لتُعاد المطابقة.
            </div>
          )}
          {balance.verdict === 'weighting-required' && offer.origin === 'corrected' && (
            <div className="text-[11px] font-bold text-amber-900">
              تنبيه: الفقرات غير المتوازنة تتجاوز 10%، والنص (سادساً/5) يعتمد جدول جهة التعاقد معدلاً بنسبة مبلغ العطاء (البدء بالمعادلة).
            </div>
          )}
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 2: `BOQTable` — الخصائص و`AmountInput`**

في `AmountInput` أضف خاصية `readOnly?: boolean`:
```tsx
const AmountInput: React.FC<{ value: number; onChange: (v: number) => void; className: string; label: string; placeholder?: string; readOnly?: boolean }> = ({ value, onChange, className, label, placeholder = '0.00', readOnly }) => {
```
وفي `<input`: أضف `readOnly={readOnly}` و`title={readOnly ? 'مقفل أثناء العرض الموزون' : undefined}`، واجعل `onFocus` يبدأ بـ `if (readOnly) return;`، و`className={readOnly ? `${className} opacity-60 cursor-not-allowed` : className}`.

أضف الاستيرادات:
```tsx
import { isOfferEdited } from '../utils/weightedOffer';
```
وأيقونة `Flag` و`FileStack` إلى استيراد lucide.

في `BOQTableProps` أضف:
```ts
  // العرض الموزون للعطاء النشط: active يُعدَّل فيه المفرد، adopted للعرض فقط، none الجدول العادي
  offerMode?: 'none' | 'active' | 'adopted';
  // عطاء آخر في المناقصة عرضه الموزون فعّال: الكمية والتخميني مقفلان (مشتركان)
  sharedLocked?: boolean;
  onEditOfferUnit?: (index: number, unit: number) => void;
  onMarkUnreasonable?: (index: number, note: string | null) => void;
  onSetItemPage?: (index: number, page: number | undefined) => void;
  onOpenPageBreaks?: () => void;
```
وأضفها إلى التفكيك مع `offerMode = 'none'` و`sharedLocked = false`، ثم:
```tsx
  const locked = offerMode !== 'none';
  const sharedReadOnly = locked || sharedLocked;
```

- [ ] **Step 3: خلايا العرض** — فوق `interface BOQTableProps`:

```tsx
// مفرد الفقرة في العرض الموزون: الجديد بارزاً بشارة، وتحته مفرد ما بعد التصحيح مشطوباً
const OfferUnitCell: React.FC<{ item: BOQItem; editable: boolean; onChange: (v: number) => void }> = ({ item, editable, onChange }) => {
  const correctedUnit = item.quantity > 0 ? item.bidderTotal / item.quantity : item.bidderTotal;
  const unit = item.offerUnitPrice ?? correctedUnit;
  const edited = isOfferEdited(item);
  const show = (v: number) => formatNumber(v, Number.isInteger(v) ? 0 : 2);
  return (
    <div className="flex flex-col items-center gap-0.5">
      <AmountInput value={unit} onChange={onChange} readOnly={!editable} label={`سعر المفرد في العرض الموزون للفقرة ${item.itemNo}`}
        className={`w-full min-w-[7rem] text-center rounded-lg p-1.5 font-mono font-black text-xs shadow-2xs border ${edited ? 'bg-purple-50 border-purple-400 text-purple-950' : 'bg-white border-indigo-200 text-indigo-950'}`} />
      {edited && (<>
        <span className="text-[10px] font-black text-purple-800 bg-purple-100 px-1.5 rounded">معدّل بالعرض الموزون</span>
        <span className="text-[10px] text-slate-500 line-through font-mono">{show(correctedUnit)}</span>
      </>)}
    </div>
  );
};

const OfferAmountCell: React.FC<{ item: BOQItem }> = ({ item }) => {
  const edited = isOfferEdited(item);
  const total = item.offerTotal ?? item.bidderTotal;
  const show = (v: number) => formatNumber(v, Number.isInteger(v) ? 0 : 2);
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className={`font-mono font-black text-xs ${edited ? 'text-purple-950' : 'text-indigo-950'}`}>{show(total)}</span>
      {edited && <span className="text-[10px] text-slate-500 line-through font-mono">{show(item.bidderTotal)}</span>}
    </div>
  );
};
```

- [ ] **Step 4: الأعمدة**

1. رأس الجدول: بعد `<th ...>ت</th>` أضف:
```tsx
<th className="p-3 w-14 text-center border-l border-slate-800" title="رقم صفحة الفقرة في عطاء المجهز كما قدّمه">ص</th>
```
وغيّر عنوان عمود المفرد إلى `{locked ? 'سعر المفرد — العرض الموزون' : 'سعر المفرد للمجهز ✏️'}` وعنوان المبلغ إلى `{locked ? 'مبلغ العرض الموزون' : 'مبلغ المجهز الإجمالي 💰'}`.
2. خلية «ص» بعد خلية رقم الفقرة:
```tsx
<td className="p-2 text-center border-l border-slate-200 bg-slate-50/50">
  <AmountInput value={item.pageNo ?? 0} onChange={(v) => onSetItemPage?.(actualIndex, v > 0 ? Math.round(v) : undefined)}
    label={`صفحة الفقرة ${item.itemNo} في العطاء`} placeholder="—"
    className="w-12 text-center bg-white border border-slate-200 rounded-lg p-1 font-mono font-bold text-slate-700 text-xs" />
</td>
```
3. الكمية: أضف `readOnly={sharedReadOnly}` إلى `AmountInput` الكمية؛ والتخميني: `readOnly={sharedReadOnly}`.
4. خلية المفرد: اجعل محتواها
```tsx
{locked
  ? <OfferUnitCell item={item} editable={offerMode === 'active'} onChange={(v) => onEditOfferUnit?.(actualIndex, v)} />
  : (/* AmountInput القائم كما هو */)}
```
5. خلية المبلغ: `{locked ? <OfferAmountCell item={item} /> : (/* AmountInput القائم */)}`.
6. عمود المفرد الموزون: بعد القيمة أضف
```tsx
{item.weightedAdjustment ? <div className="text-[10px] text-purple-700" title="سُوّي التقريب ليساوي مجموع الأسعار الموزونة مبلغ العطاء">سُوّي التقريب ({item.weightedAdjustment > 0 ? '+' : ''}{item.weightedAdjustment})</div> : null}
```
7. عمود التدقيق: في آخر `<div className="space-y-1.5">` أضف:
```tsx
{onMarkUnreasonable && (item.unreasonablePrice ? (
  <div className="bg-orange-50 text-orange-900 border border-orange-300 px-2 py-0.5 rounded-lg text-[11px] font-bold flex items-start gap-1">
    <Flag className="w-3 h-3 text-orange-600 shrink-0 mt-0.5" />
    <span className="flex-1"><strong>سعر غير معقول:</strong> {item.unreasonablePrice.note}</span>
    <button type="button" onClick={() => onMarkUnreasonable(actualIndex, null)}
      className="shrink-0 px-1 rounded text-orange-700 hover:bg-white cursor-pointer" aria-label={`إزالة تأشير السعر غير المعقول عن الفقرة ${item.itemNo}`}>✕</button>
  </div>
) : (
  <button type="button"
    onClick={() => {
      const note = window.prompt(`ملاحظة اللجنة على سعر الفقرة رقم (${item.itemNo})، مثل: «سعر 10 كغم يساوي سعر 350 غم»`);
      if (note && note.trim()) onMarkUnreasonable(actualIndex, note.trim());
    }}
    className="flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-orange-700 cursor-pointer">
    <Flag className="w-3 h-3" /> تأشير سعر غير معقول
  </button>
))}
```
8. `colSpan` الجدول الفارغ: `hasEstimate ? 12 : 9`. وفي `tfoot` أول خلية `colSpan={4}`، وخلية المبلغ في الوضع المقفل تعرض مجموع `offerTotal ?? bidderTotal`:
```tsx
{(locked ? items.reduce((s, i) => s + (i.offerTotal ?? i.bidderTotal), 0) : items.reduce((s, i) => s + i.bidderTotal, 0)).toLocaleString()} د.ع
```

- [ ] **Step 5: مرشّح التبليغ وأزرار الشريط**

- غيّر نوع `filterMode` إلى `'all' | 'deviated' | 'savings' | 'errors' | 'notify'`، وأضف قبل `filteredItems`:
```tsx
  // فقرات يُبلَّغ بها المجهز: المنحرفة (بالاتجاهين) والمؤشرة «سعر غير معقول» — لمراجعة عطاء كبير بلا تمرير كله
  const isNotify = (i: BOQItem) => (i.estimatedTotal > 0 && i.isDeviated) || !!i.unreasonablePrice;
  const notifyCount = items.filter(isNotify).length;
```
وفي المرشّح: `if (filterMode === 'notify') return isNotify(item);`، وزر بجانب «المنحرفة»:
```tsx
<button onClick={() => setFilterMode('notify')}
  className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer ${filterMode === 'notify' ? 'bg-orange-600 text-white shadow-xs' : 'bg-white text-orange-800 border border-orange-200 hover:bg-orange-50'}`}>
  للتبليغ ({notifyCount})
</button>
```
- في شريط الشركة: أخفِ أزرار الاستيراد و«تصفير مبالغ المجهز» حين `locked` (`{onOpenSmartImport && !locked && (...)}`)، وأضف زر:
```tsx
{onOpenPageBreaks && (
  <button type="button" onClick={onOpenPageBreaks}
    className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-bold px-3.5 py-2 rounded-xl border border-slate-600 transition cursor-pointer"
    title="إسناد الفقرات إلى صفحات عطاء المجهز كما قدّمه، برقم أول فقرة في كل صفحة">
    <FileStack className="w-3.5 h-3.5" /> فواصل الصفحات
  </button>
)}
```
- زر «+ إضافة فقرة»: `disabled={sharedReadOnly}` مع `disabled:opacity-50 disabled:cursor-not-allowed`.

- [ ] **Step 6: التمرير في `App.tsx`**

استورد `WeightedOfferBar` و`hasBidAmounts` (موجود). فوق `<BOQTable` في فرع `activeTab === 'table'`:
```tsx
<>
  {hasBidAmounts(activeBidder) && (
    <div className="mb-4">
      <WeightedOfferBar bidder={activeBidder} threshold={currentProject.deviationThreshold}
        onStart={handleStartOffer} onPause={handlePauseOffer} onAdopt={handleAdoptOffer} onUnadopt={handleUnadoptOffer} />
    </div>
  )}
  <BOQTable ... />
</>
```
وأضف إلى `<BOQTable`:
```tsx
offerMode={activeBidder.weightedOffer?.status === 'active' ? 'active' : activeBidder.weightedOffer?.status === 'adopted' ? 'adopted' : 'none'}
sharedLocked={currentProject.bidders.some(isOfferLocked)}
onEditOfferUnit={handleEditOfferUnit}
onMarkUnreasonable={handleMarkUnreasonable}
onSetItemPage={handleSetItemPage}
onOpenPageBreaks={() => setIsPageBreaksOpen(true)}
```

- [ ] **Step 7: تحقق**

Run: `npm run build` ثم `npm run lint`
Expected: بلا أخطاء.

يدوياً (`npm run dev`، مناقصة فيها عطاء غير منحرف بلا ملاحظات معلقة):
1. يظهر حكم التوازن بعدد الفقرات ونسبتها.
2. «بدء العرض الموزون من أسعار العطاء»: الفرق 0؛ تعديل مفرد فقرة يُظهر الشارة والمشطوب والفرق ≠ 0؛ زر الاعتماد معطّل.
3. تعديل مفرد فقرة أخرى بما يعوض الفرق → الفرق 0 ✓ → اعتماد يعمل.
4. محاولة تعديل كمية أو تخميني أو استيراد → رسالة القفل.
5. «إيقاف المرحلة» يفتح الأرقام، و«استئناف» يعيد التعديلات.
6. «بالمعادلة»: مجموع العرض = مبلغ العطاء والفرق 0.
7. تأشير سعر غير معقول وإزالته، ومرشّح «للتبليغ».

- [ ] **Step 8: Commit**

```bash
git add src/components/WeightedOfferBar.tsx src/components/BOQTable.tsx src/App.tsx
git commit -m "العرض الموزون في نفس الجدول: حكم التوازن، شريط حي، اعتماد، قفل، تأشير سعر غير معقول، مرشّح التبليغ، عمود الصفحة"
```

---

### Task 7: نافذة فواصل الصفحات وملخص الصفحات على الشاشة

**Files:**
- Create: `src/components/modals/PageBreaksModal.tsx`
- Create: `src/components/PageSummaryTable.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `resolvePageStarts`, `pagesFromStarts`, `startItemNos`, `summarizePages` (Task 4)؛ `handleApplyPageBreaks`, `isPageBreaksOpen` (Task 5).

- [ ] **Step 1: النافذة**

`src/components/modals/PageBreaksModal.tsx`:
```tsx
import React, { useState } from 'react';
import { X, Plus, Minus, FileStack } from 'lucide-react';
import type { BOQItem } from '../../types/tender';
import { resolvePageStarts, pagesFromStarts, startItemNos } from '../../utils/pageSummary';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  items: BOQItem[];
  bidderName: string;
  onApply: (pages: (number | undefined)[]) => void;
}

// فواصل صفحات عطاء المجهز كما قدّمه: رقم أول فقرة في كل صفحة، فتُسند الفقرات إلى صفحاتها بالترتيب.
// لا يمس أي مبلغ. للعطاءات المُدخلة قبل أن تقرأ القراءة الآلية أرقام الصفحات
export const PageBreaksModal: React.FC<Props> = ({ isOpen, onClose, items, bidderName, onApply }) => {
  const [starts, setStarts] = useState<string[]>(() => {
    const current = startItemNos(items);
    return current.length > 0 ? current : [String(items[0]?.itemNo ?? '1')];
  });
  if (!isOpen) return null;

  const resolved = resolvePageStarts(items, starts);
  const error = 'error' in resolved ? resolved.error : null;
  const pages = 'starts' in resolved ? pagesFromStarts(items.length, resolved.starts) : null;
  const countOf = (p: number) => pages ? pages.filter(x => x === p).length : 0;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="فواصل الصفحات">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        <div className="p-4 bg-slate-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold"><FileStack className="w-5 h-5 text-amber-400" /> فواصل صفحات عطاء ({bidderName})</div>
          <button onClick={onClose} aria-label="إغلاق" className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 overflow-y-auto space-y-2 text-sm">
          <p className="text-xs text-slate-600 font-bold">أدخل رقم أول فقرة في كل صفحة كما في العطاء الأصلي. الصفحة الأولى تبدأ من أول فقرة في الجدول.</p>
          {starts.map((v, p) => (
            <label key={p} className="flex items-center gap-2">
              <span className="w-40 font-bold text-slate-800">الصفحة ({p + 1}) تبدأ بالفقرة</span>
              <input type="text" dir="ltr" value={v} disabled={p === 0}
                onChange={(e) => setStarts(s => s.map((x, i) => i === p ? e.target.value : x))}
                className="w-24 text-center border border-slate-300 rounded-lg p-1 font-mono font-bold disabled:bg-slate-100" />
              {pages && <span className="text-xs text-slate-500">({countOf(p + 1)}) فقرة</span>}
            </label>
          ))}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={() => setStarts(s => [...s, ''])}
              className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 cursor-pointer"><Plus className="w-3.5 h-3.5" /> صفحة</button>
            <button type="button" disabled={starts.length <= 1} onClick={() => setStarts(s => s.slice(0, -1))}
              className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 cursor-pointer disabled:opacity-50"><Minus className="w-3.5 h-3.5" /> آخر صفحة</button>
          </div>
          {error && <div className="text-xs font-bold text-rose-800 bg-rose-50 border border-rose-200 rounded-lg p-2">{error}</div>}
        </div>
        <div className="p-4 border-t border-slate-200 flex justify-end gap-2">
          <button onClick={onClose} className="text-xs font-bold px-4 py-2 rounded-xl border border-slate-300 cursor-pointer">إلغاء</button>
          <button disabled={!pages} onClick={() => pages && onApply(pages)}
            className="text-xs font-black px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer disabled:opacity-50">إسناد الفقرات إلى ({starts.length}) صفحة</button>
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: جدول الملخص**

`src/components/PageSummaryTable.tsx`:
```tsx
import React from 'react';
import { FileStack } from 'lucide-react';
import type { BOQItem } from '../types/tender';
import { summarizePages } from '../utils/pageSummary';
import { formatNumber } from '../utils/calculations';

interface Props { items: BOQItem[]; showOffer: boolean; offerFinal: boolean; onOpenPageBreaks: () => void }

// ملخص صفحات عطاء المجهز: مبلغ كل صفحة كما دوّنه، وبعد التصحيح، وفي العرض الموزون؛ مجموعها مجموع العطاء
export const PageSummaryTable: React.FC<Props> = ({ items, showOffer, offerFinal, onOpenPageBreaks }) => {
  const summary = summarizePages(items);
  if (!summary) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-3 text-xs font-bold text-slate-600">
        <span>ملخص صفحات العطاء يظهر بعد إسناد الفقرات إلى صفحاتها.</span>
        <button onClick={onOpenPageBreaks} className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 rounded-xl cursor-pointer">
          <FileStack className="w-3.5 h-3.5" /> فواصل الصفحات
        </button>
      </div>
    );
  }
  const n = (v: number) => formatNumber(v, Number.isInteger(v) ? 0 : 2);
  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-3 bg-slate-50 border-b border-slate-200 font-black text-sm text-slate-900 flex items-center justify-between">
        <span>ملخص صفحات العطاء ({summary.rows.filter(r => r.page !== null).length} صفحة)</span>
        {showOffer && !offerFinal && <span className="text-xs text-amber-700">العرض الموزون غير نهائي</span>}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-right border-collapse">
          <thead className="bg-slate-900 text-slate-100 font-black">
            <tr>
              <th className="p-2 text-center">الصفحة</th>
              <th className="p-2 text-center">عدد الفقرات</th>
              <th className="p-2 text-center">كما دوّنه المجهز</th>
              <th className="p-2 text-center">بعد التصحيح الحسابي</th>
              {showOffer && <th className="p-2 text-center bg-purple-950">العرض الموزون</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 font-mono font-bold">
            {summary.rows.map(r => (
              <tr key={r.page ?? 'none'} className={r.page === null ? 'bg-amber-50' : ''}>
                <td className="p-2 text-center font-sans">{r.page ?? 'فقرات بلا صفحة'}</td>
                <td className="p-2 text-center">{r.itemCount}</td>
                <td className="p-2 text-center">{n(r.stated)}</td>
                <td className="p-2 text-center">{n(r.corrected)}</td>
                {showOffer && <td className="p-2 text-center text-purple-950">{n(r.offer)}</td>}
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-100 font-black font-mono">
            <tr>
              <td className="p-2 text-center font-sans">المجموع</td>
              <td className="p-2 text-center">{items.length}</td>
              <td className="p-2 text-center">{n(summary.totals.stated)}</td>
              <td className="p-2 text-center">{n(summary.totals.corrected)}</td>
              {showOffer && <td className="p-2 text-center text-purple-950">{n(summary.totals.offer)}</td>}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};
```

- [ ] **Step 3: الربط في `App.tsx`**

استورد المكونين. بعد `<BOQTable ... />` داخل نفس الـ fragment:
```tsx
<div className="mt-4">
  <PageSummaryTable items={activeBidder.items}
    showOffer={!!activeBidder.weightedOffer && activeBidder.weightedOffer.status !== 'paused'}
    offerFinal={activeBidder.weightedOffer?.status === 'adopted' && !offerStatus(activeBidder)?.stale}
    onOpenPageBreaks={() => setIsPageBreaksOpen(true)} />
</div>
```
وبجانب بقية النوافذ:
```tsx
<PageBreaksModal
  key={`${activeBidder.id}-${isPageBreaksOpen}`}
  isOpen={isPageBreaksOpen}
  onClose={() => setIsPageBreaksOpen(false)}
  items={activeBidder.items}
  bidderName={activeBidder.name}
  onApply={handleApplyPageBreaks}
/>
```
(`key` يعيد تهيئة الحقول مع كل فتح ومع كل مجهز، كما في `ProjectSettingsModal`.)

- [ ] **Step 4: تحقق**

Run: `npm run build`، `npm run lint`.
يدوياً: فواصل صفحات لعطاء المثال (3 صفحات مثلاً)؛ رقم غير موجود يُظهر الخطأ ويعطّل الزر؛ بعد الإسناد يظهر الملخص ومجموعه = مجموع الجدول؛ تعديل «ص» لفقرة واحدة يحركها بين الصفحات؛ مسح «ص» لفقرة يُظهر «فقرات بلا صفحة».

- [ ] **Step 5: Commit**

```bash
git add src/components/modals/PageBreaksModal.tsx src/components/PageSummaryTable.tsx src/App.tsx
git commit -m "نافذة فواصل الصفحات وجدول ملخص صفحات العطاء"
```

---

### Task 8: رقم الصفحة من قراءة Gemini

**Files:**
- Modify: `src/utils/ocrService.ts`
- Test: `checks/ocrPages.test.ts`

**Interfaces:**
- Produces: `export function attachPages(rows: any[], start: number, count: number): any[]` — يضع `__page` (رقم الصفحة في الملف من 1) أو يحذفه؛ و`mapGeminiRow` (مُصدَّرة الآن) تضع `pageNo` من `__page`.

- [ ] **Step 1: اكتب الفحوص**

`checks/ocrPages.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { attachPages, mapGeminiRow, mergeContinuationRows } from '../src/utils/ocrService';

test('رقم الصفحة داخل الدفعة يُحوَّل إلى رقمها في الملف', () => {
  const rows = attachPages([{ page: 1 }, { page: 3 }], 8, 3);
  assert.deepEqual(rows.map(r => r.__page), [9, 11]);
});

test('رقم خارج الدفعة أو غير صحيح لا يُسنَد', () => {
  const rows = attachPages([{ page: 0 }, { page: 4 }, { page: '2' }, { page: 1.5 }, {}], 0, 3);
  assert.deepEqual(rows.map(r => r.__page), [undefined, undefined, 2, undefined, undefined]);
});

test('الوصف الممتد يبقى على صفحة بدايته، والصف المحوّل يحمل pageNo', () => {
  const merged = mergeContinuationRows(attachPages([
    { itemNo: '5', description: 'أنبوب', quantity: 2, unitPrice: 10, total: 20, unpriced: false, page: 1 },
    { itemNo: null, description: 'تكملة', quantity: null, unitPrice: null, total: null, unpriced: false, page: 2 }
  ], 0, 2));
  assert.equal(merged.length, 1);
  assert.equal(mapGeminiRow(merged[0], 0).pageNo, 1);
  assert.equal(mapGeminiRow({ description: 'x', unpriced: false }, 0).pageNo, undefined);
});
```

- [ ] **Step 2: شغّل وتأكد من الفشل**

Run: `npm run check -- ocrPages`
Expected: فشل (`attachPages` غير موجودة).

- [ ] **Step 3: التنفيذ**

في `GEMINI_RESPONSE_SCHEMA` ضمن خصائص الفقرة:
```ts
          unpriced: { type: 'BOOLEAN' },
          page: { type: 'INTEGER', nullable: true }
```
و`propertyOrdering` يضيف `'page'` في آخرها.

في `geminiPrompt` بعد القاعدة 8:
```
9. page: رقم الصورة (الصفحة) التي يبدأ فيها صف الفقرة بين الصور المرفقة، بالترتيب من 1.
```
وأضف `"page":1` إلى مثال JSON في أول التعليمات (بعد `"unpriced":false`).

بعد `mergeContinuationRows`:
```ts
/**
 * رقم صفحة كل صف في الملف كله: النموذج يرى صور الدفعة وحدها فيعيد ترتيب الصورة داخلها (من 1)، فيُضاف موضع
 * أول صفحاتها. رقم خارج الدفعة أو غير صحيح لا يُسنَد (يبقى بلا صفحة ظاهراً في الملخص بدل صفحة خاطئة)
 */
export function attachPages(rows: any[], start: number, count: number): any[] {
  return rows.map(r => {
    const p = typeof r?.page === 'string' ? Number(r.page) : r?.page;
    const ok = Number.isInteger(p) && p >= 1 && p <= count;
    const { page: _page, ...rest } = r ?? {};
    return { ...rest, __page: ok ? start + p : undefined };
  });
}
```
اجعل `mapGeminiRow` مُصدَّرة (`export function mapGeminiRow`) وأضف في كائن الإرجاع:
```ts
    unpriced: unpriced || undefined,
    pageNo: typeof r?.__page === 'number' ? r.__page : undefined
```
وفي `readBatch` داخل `extractBOQWithGeminiVision` استبدل `if (!r.truncated) return r;` بـ:
```ts
    // الصفحات تُسند هنا عند أصغر دفعة قُرئت فعلاً، فلا تتضاعف الإزاحة بعد تقسيم دفعة مقطوعة
    if (!r.truncated) return { ...r, rows: attachPages(r.rows, start, imgs.length) };
```

- [ ] **Step 4: شغّل**

Run: `npm run check` ثم `npm run build`
Expected: PASS ونجاح البناء.

- [ ] **Step 5: Commit**

```bash
git add src/utils/ocrService.ts checks/ocrPages.test.ts
git commit -m "قراءة Gemini تحفظ رقم صفحة كل فقرة في العطاء"
```

---

### Task 9: المحضر المطبوع

**Files:**
- Modify: `src/components/modals/PrintReportModal.tsx`

**Interfaces:**
- Consumes: `assessBalance`, `correctedBalanceRows`, `BALANCE_VERDICT_LABEL`, `UNBALANCED_ITEMS_LIMIT_PERCENT`, `offerStatus`, `isOfferEdited` (weightedOffer.ts)؛ `summarizePages` (pageSummary.ts).

- [ ] **Step 1: الحسابات** — بعد تعريف `words`:

```tsx
  // توازن العطاء موضوع المحضر (سادساً/5)، وعرضه الموزون، وصفحاته، وفقرات التبليغ
  const balance = assessBalance(correctedBalanceRows(subject.items), threshold);
  const offer = subject.weightedOffer && subject.weightedOffer.status !== 'paused' ? subject.weightedOffer : undefined;
  const offerState = offer ? offerStatus(subject) : null;
  const offerFinal = offer?.status === 'adopted' && !offerState?.stale;
  const editedItems = offer ? subject.items.filter(isOfferEdited) : [];
  const pages = summarizePages(subject.items);
  const notifyItems = subject.items.filter(i => (i.estimatedTotal > 0 && i.isDeviated) || i.unreasonablePrice);
  const adjustedCount = subject.items.filter(i => i.weightedAdjustment).length;
  const residual = subject.totals.weightedRoundingResidual ?? 0;
  const pricingClause = offerFinal
    ? '، واعتماد أسعار العرض الموزون المعتمد المثبتة في (رابعاً) وفق ضوابط رقم (4) سادساً/5'
    : balance.verdict === 'accept-as-is'
      ? '، واعتماد أسعار العطاء كما هي لعدم تجاوز الفقرات غير المتوازنة نسبة (10%) من مجموع الفقرات وفق ضوابط رقم (4) سادساً/5'
      : '، واعتماد جدول الكميات المسعّر من جهة التعاقد معدلاً بنسبة مبلغ العطاء (الأسعار الموزونة المثبتة أعلاه) وفق ضوابط رقم (4) سادساً/5، مع استدعاء مقدم العطاء لختم الجداول المعدلة';
```

- [ ] **Step 2: حكم التوازن** — بعد `</table>` جدول «ثانياً» وقبل إغلاق `div` القسم:

```tsx
            {rec.kind !== 'no-estimate' && (
              <div className="border border-slate-300 rounded-xl p-3 text-xs leading-relaxed bg-white">
                <strong>توازن العطاء (ضوابط رقم (4) سادساً/5):</strong> عدد الفقرات المنحرفة بالزيادة أكثر من ({threshold}%) هو ({balance.unbalancedCount}) من مجموع ({balance.itemCount}) فقرة، أي ({balance.unbalancedPercent.toFixed(2)}%) مقابل حد ({UNBALANCED_ITEMS_LIMIT_PERCENT}%)
                {balance.belowCount > 0 && <>، وعدد المنحرفة بالنقصان ({balance.belowCount}) للإحاطة</>}.
                {' '}<strong>الحكم: {BALANCE_VERDICT_LABEL[balance.verdict]}.</strong>
                {adjustedCount > 0 && <> سُوّيت فروقات تقريب الأسعار الموزونة بتحميل أجزاء من الفلس على مفرد ({adjustedCount}) فقرة ليساوي مجموعها مبلغ العطاء.</>}
                {Math.abs(residual) >= 0.005 && <> وبقي فرق تقريب قدره ({formatNumber(residual)}) تعذّرت تسويته بكميات الفقرات.</>}
              </div>
            )}
```

- [ ] **Step 3: صياغة التوصية**

في فقرة `rec.kind === 'award'` استبدل `، مع مراعاة نتائج التقييم الفني والقانوني، واعتماد الأسعار والمفردات الموزونة المثبتة أعلاه عند إصدار أوامر التغيير وفق المادة (25)/ثالثاً.` بـ:
```tsx
                ، مع مراعاة نتائج التقييم الفني والقانوني{rec.primary.id === subject.id ? pricingClause : ''}، واعتماد الأسعار والمفردات الموزونة عند إصدار أوامر التغيير وفق المادة (25)/ثالثاً.
```

- [ ] **Step 4: الأقسام الجديدة** — بعد إغلاق `div` «ثالثاً» وقبل التوقيعات:

```tsx
          {offer && (
            <div className="mb-6">
              <h3 className="font-black text-slate-900 text-xs mb-2 bg-slate-100 p-2 rounded border border-slate-300">
                رابعاً: العرض الموزون لعطاء ({subject.name}) — {offer.origin === 'formula' ? 'بالمعادلة (التخميني × النسبة السعرية)' : 'جدول المجهز المعدل'}{offerFinal ? '' : ' (غير نهائي)'}:
              </h3>
              <p className="text-xs mb-2">
                مجموع العرض الموزون ({formatNumber(offerState?.offerSum ?? 0)}) {Math.abs(offerState?.diff ?? 0) < 0.005 ? 'مساوٍ لمبلغ العطاء بعد التصحيح' : `يختلف عن مبلغ العطاء بعد التصحيح بمقدار (${formatNumber(offerState?.diff ?? 0)})`}، وعدد الفقرات المعدّلة ({editedItems.length}).
              </p>
              {editedItems.length > 0 && (
                <table className="w-full text-xs text-right border-collapse border border-slate-400">
                  <thead className="bg-slate-100 font-bold">
                    <tr>
                      <th className="border border-slate-300 p-2 text-center">ت</th>
                      <th className="border border-slate-300 p-2">الوصف</th>
                      <th className="border border-slate-300 p-2 text-center">الكمية</th>
                      <th className="border border-slate-300 p-2 text-center">المبلغ بعد التصحيح</th>
                      <th className="border border-slate-300 p-2 text-center">مفرد العرض الموزون</th>
                      <th className="border border-slate-300 p-2 text-center">مبلغ العرض الموزون</th>
                    </tr>
                  </thead>
                  <tbody>
                    {editedItems.map(i => (
                      <tr key={i.id}>
                        <td className="border border-slate-300 p-2 text-center">{i.itemNo}</td>
                        <td className="border border-slate-300 p-2">{i.description}</td>
                        <td className="border border-slate-300 p-2 text-center">{formatNumber(i.quantity)}</td>
                        <td className="border border-slate-300 p-2 text-center">{formatNumber(i.bidderTotal)}</td>
                        <td className="border border-slate-300 p-2 text-center font-bold">{formatNumber(i.offerUnitPrice ?? 0)}</td>
                        <td className="border border-slate-300 p-2 text-center font-bold">{formatNumber(i.offerTotal ?? 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {pages && (
            <div className="mb-6">
              <h3 className="font-black text-slate-900 text-xs mb-2 bg-slate-100 p-2 rounded border border-slate-300">
                ملخص صفحات عطاء ({subject.name}):
              </h3>
              <table className="w-full text-xs text-right border-collapse border border-slate-400">
                <thead className="bg-slate-100 font-bold">
                  <tr>
                    <th className="border border-slate-300 p-2 text-center">الصفحة</th>
                    <th className="border border-slate-300 p-2 text-center">عدد الفقرات</th>
                    <th className="border border-slate-300 p-2 text-center">كما دوّنه المجهز</th>
                    <th className="border border-slate-300 p-2 text-center">بعد التصحيح الحسابي</th>
                    {offer && <th className="border border-slate-300 p-2 text-center">العرض الموزون{offerFinal ? '' : ' (غير نهائي)'}</th>}
                  </tr>
                </thead>
                <tbody>
                  {pages.rows.map(r => (
                    <tr key={r.page ?? 'none'}>
                      <td className="border border-slate-300 p-2 text-center">{r.page ?? 'فقرات بلا صفحة'}</td>
                      <td className="border border-slate-300 p-2 text-center">{r.itemCount}</td>
                      <td className="border border-slate-300 p-2 text-center">{formatNumber(r.stated)}</td>
                      <td className="border border-slate-300 p-2 text-center">{formatNumber(r.corrected)}</td>
                      {offer && <td className="border border-slate-300 p-2 text-center font-bold">{formatNumber(r.offer)}</td>}
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-100 font-black">
                  <tr>
                    <td className="border border-slate-400 p-2 text-center">المجموع</td>
                    <td className="border border-slate-400 p-2 text-center">{subject.items.length}</td>
                    <td className="border border-slate-400 p-2 text-center">{formatNumber(pages.totals.stated)}</td>
                    <td className="border border-slate-400 p-2 text-center">{formatNumber(pages.totals.corrected)}</td>
                    {offer && <td className="border border-slate-400 p-2 text-center">{formatNumber(pages.totals.offer)}</td>}
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {notifyItems.length > 0 && (
            <div className="mb-6">
              <h3 className="font-black text-slate-900 text-xs mb-2 bg-slate-100 p-2 rounded border border-slate-300">
                فقرات يُبلَّغ بها المجهز ({subject.name}) — للإحاطة بنقاط الضعف في العطاء ({notifyItems.length} فقرة):
              </h3>
              <table className="w-full text-xs text-right border-collapse border border-slate-400">
                <thead className="bg-slate-100 font-bold">
                  <tr>
                    <th className="border border-slate-300 p-2 text-center">ت</th>
                    <th className="border border-slate-300 p-2">الوصف</th>
                    <th className="border border-slate-300 p-2 text-center">نسبة الانحراف</th>
                    <th className="border border-slate-300 p-2">الملاحظة</th>
                  </tr>
                </thead>
                <tbody>
                  {notifyItems.map(i => (
                    <tr key={i.id}>
                      <td className="border border-slate-300 p-2 text-center">{i.itemNo}</td>
                      <td className="border border-slate-300 p-2">{i.description}</td>
                      <td className="border border-slate-300 p-2 text-center">{i.estimatedTotal > 0 ? `${i.deviationPercent > 0 ? '+' : ''}${i.deviationPercent.toFixed(2)}%` : '—'}</td>
                      <td className="border border-slate-300 p-2">
                        {[i.estimatedTotal > 0 && i.isDeviated ? (i.deviationPercent > 0 ? 'منحرفة بالزيادة' : 'منحرفة بالنقصان') : '',
                          i.unreasonablePrice ? `سعر غير معقول: ${i.unreasonablePrice.note}` : ''].filter(Boolean).join('؛ ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
```

- [ ] **Step 5: الاستيرادات**

```tsx
import { assessBalance, correctedBalanceRows, offerStatus, isOfferEdited, BALANCE_VERDICT_LABEL, UNBALANCED_ITEMS_LIMIT_PERCENT } from '../../utils/weightedOffer';
import { summarizePages } from '../../utils/pageSummary';
```

- [ ] **Step 6: تحقق**

Run: `npm run build`.
يدوياً: معاينة المحضر لعطاء بلا عرض (حكم + «اعتماد أسعار العطاء كما هي» إن ≤10%)، وبعرض معتمد (رابعاً + صياغة العرض)، وبصفحات مسندة (الملخص ومجموعه)، وبفقرات مؤشرة (قائمة التبليغ). تحقق أن عبارة «Beta» لا تظهر في المحضر.

- [ ] **Step 7: Commit**

```bash
git add src/components/modals/PrintReportModal.tsx
git commit -m "المحضر: حكم التوازن (سادساً/5)، العرض الموزون، ملخص الصفحات، فقرات التبليغ"
```

---

### Task 10: Excel — ورقة ملخص الصفحات وأعمدة العرض

**Files:**
- Modify: `src/utils/bidderAuditExcel.ts`
- Test: `checks/excelPages.test.ts`

**Interfaces:**
- Produces: `export function buildBidderAuditWorkbook(project: TenderProject, bidder: Bidder): XLSX.WorkBook` — `exportBidderAuditToExcel` تبنيه ثم تكتبه.

- [ ] **Step 1: اكتب الفحص**

`checks/excelPages.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateBOQMetrics } from '../src/utils/calculations';
import { buildBidderAuditWorkbook } from '../src/utils/bidderAuditExcel';
import type { Bidder, TenderProject } from '../src/types/tender';

const make = (withPages: boolean, withOffer: boolean) => {
  const { items, totals } = calculateBOQMetrics([
    { itemNo: 1, description: 'أ', quantity: 2, estimatedTotal: 1000, bidderTotal: 1100, enteredUnitPrice: 550, enteredBidderTotal: 1100,
      pageNo: withPages ? 1 : undefined, offerUnitPrice: withOffer ? 600 : undefined, offerTotal: withOffer ? 1200 : undefined },
    { itemNo: 2, description: 'ب', quantity: 1, estimatedTotal: 500, bidderTotal: 480, enteredUnitPrice: 480, enteredBidderTotal: 480,
      pageNo: withPages ? 2 : undefined, offerUnitPrice: withOffer ? 380 : undefined, offerTotal: withOffer ? 380 : undefined }
  ], 20);
  const bidder: Bidder = { id: 'b', name: 'شركة', submissionDate: '', items, totals, status: 'pending',
    weightedOffer: withOffer ? { status: 'adopted', origin: 'corrected', startedAt: '', bidTotal: 1580 } : undefined };
  const project = { title: 'م', referenceNumber: '', entityName: '', deviationThreshold: 20, bidders: [bidder], auditLogs: [] } as unknown as TenderProject;
  return buildBidderAuditWorkbook(project, bidder);
};

test('ورقة ملخص الصفحات تظهر مع الصفحات فقط، ومجموعها مجموع العطاء', () => {
  assert.ok(!make(false, false).SheetNames.includes('ملخص الصفحات'));
  const wb = make(true, true);
  assert.ok(wb.SheetNames.includes('ملخص الصفحات'));
  const ws = wb.Sheets['ملخص الصفحات'];
  const values = Object.values(ws).filter((c: any) => c && c.t === 'n').map((c: any) => c.v);
  assert.ok(values.includes(1580));
});

test('الجدول المعدل يضم عمودي العرض الموزون حين يوجد عرض', () => {
  const header = (wb: ReturnType<typeof make>) => Object.values(wb.Sheets['الجدول المعدل']).map((c: any) => c?.v).filter(v => typeof v === 'string');
  assert.ok(header(make(false, true)).includes('مبلغ العرض الموزون'));
  assert.ok(!header(make(false, false)).includes('مبلغ العرض الموزون'));
});
```

- [ ] **Step 2: شغّل وتأكد من الفشل**

Run: `npm run check -- excelPages`
Expected: فشل (`buildBidderAuditWorkbook` غير مصدّرة).

- [ ] **Step 3: التنفيذ**

1. استورد: `import { summarizePages } from './pageSummary';` و`import { isOfferEdited } from './weightedOffer';`
2. في `correctionText` قبل `return`:
```ts
  if (item.weightedAdjustment) parts.push(`سُوّي تقريب المفرد الموزون (${item.weightedAdjustment > 0 ? '+' : ''}${item.weightedAdjustment})`);
  if (item.unreasonablePrice) parts.push(`سعر غير معقول: ${item.unreasonablePrice.note}`);
  if (isOfferEdited(item)) parts.push(`معدّل بالعرض الموزون: المبلغ ${fmt(item.offerTotal ?? 0)}`);
```
3. في `buildAdjustedSheet`: عرّف `const hasOffer = !!bidder.weightedOffer && bidder.weightedOffer.status !== 'paused';`. أضف إلى كل صف بعد `correctionText(row)`:
```ts
      ...(hasOffer ? [amount(item.offerUnitPrice ?? (item.quantity > 0 ? item.bidderTotal / item.quantity : item.bidderTotal)), amount(item.offerTotal ?? item.bidderTotal)] : [])
```
وإلى صف الرؤوس بعد `'التصحيح المعتمد'`: `...(hasOffer ? ['مفرد العرض الموزون', 'مبلغ العرض الموزون'] : [])`، وإلى `widths`: `...(hasOffer ? [15, 17] : [])`. سطر `المجموع` ينتهي اليوم عند العمود M (13 خانة)؛ الأعمدة بعده: N المفرد الموزون، O التصحيح المعتمد، P مفرد العرض، Q مبلغ العرض. أضف في آخره:
```ts
      ...(hasOffer ? ['', '', '', sum('Q', round2(bidder.items.reduce((s, i) => s + (i.offerTotal ?? i.bidderTotal), 0)))] : [])
```
4. ورقة جديدة:
```ts
// ملخص صفحات العطاء: مبلغ كل صفحة كما دوّنه المجهز، وبعد التصحيح، وفي العرض الموزون؛ المجموع بصيغ Excel
function buildPagesSheet(project: TenderProject, bidder: Bidder): XLSX.WorkSheet | null {
  const pages = summarizePages(bidder.items);
  if (!pages) return null;
  const hasOffer = !!bidder.weightedOffer && bidder.weightedOffer.status !== 'paused';
  const final = bidder.weightedOffer?.status === 'adopted';
  const last = FIRST + pages.rows.length - 1;
  const data: Cell[][] = pages.rows.map(r => [
    r.page === null ? 'فقرات بلا صفحة' : count(r.page), count(r.itemCount), amount(r.stated), amount(r.corrected),
    ...(hasOffer ? [amount(r.offer)] : [])
  ]);
  const sum = (col: string, v: number) => formula(`SUM(${col}${FIRST}:${col}${last})`, v);
  return buildSheet([
    [`ملخص صفحات العطاء: ${bidder.name}`],
    [projectLine(project)],
    ['مبلغ كل صفحة من عطاء المجهز كما قدّمه: كما دوّنه، وبعد التصحيح الحسابي (ضوابط رقم (4) خامساً/ب)'
      + (hasOffer ? `، وفي العرض الموزون (سادساً/5)${final ? '' : ' — غير نهائي'}` : '') + '. مجموع الصفحات مجموع العطاء.'],
    [],
    ['الصفحة', 'عدد الفقرات', 'كما دوّنه المجهز', 'بعد التصحيح الحسابي', ...(hasOffer ? ['العرض الموزون'] : [])],
    ...data,
    [],
    ['المجموع', sum('B', bidder.items.length), sum('C', pages.totals.stated), sum('D', pages.totals.corrected),
      ...(hasOffer ? [sum('E', pages.totals.offer)] : [])]
  ], {
    widths: [16, 12, 20, 20, ...(hasOffer ? [20] : [])],
    dataFrom: HEADER_ROWS + 1, dataTo: HEADER_ROWS + pages.rows.length,
    center: [0, 1]
  });
}
```
5. استبدل `exportBidderAuditToExcel` بـ:
```ts
export function buildBidderAuditWorkbook(project: TenderProject, bidder: Bidder): XLSX.WorkBook {
  const logs = project.auditLogs || [];
  const rows = bidder.items.map(item => analyseRow(item, bidder.id, logs));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, buildAsIsSheet(project, bidder, rows), AS_IS_SHEET);
  XLSX.utils.book_append_sheet(wb, buildErrorsSheet(project, bidder, rows), 'أخطاء المجهز');
  XLSX.utils.book_append_sheet(wb, buildAdjustedSheet(project, bidder, rows), 'الجدول المعدل');
  const pagesSheet = buildPagesSheet(project, bidder);
  if (pagesSheet) XLSX.utils.book_append_sheet(wb, pagesSheet, 'ملخص الصفحات');
  wb.Workbook = { Views: [{ RTL: true }] };
  return wb;
}

export function exportBidderAuditToExcel(project: TenderProject, bidder: Bidder) {
  const wb = buildBidderAuditWorkbook(project, bidder);
  const safe = (s: string) => s.replace(/[\\/:*?"<>|]/g, ' ').trim();
  XLSX.writeFile(wb, `${safe(`جدول عطاء ${bidder.name} - ${project.title || 'تحليل العطاءات'}`)}.xlsx`);
}
```

- [ ] **Step 4: شغّل**

Run: `npm run check` ثم `npm run build`
Expected: PASS.

يدوياً: «تصدير الجدول» لعطاء بصفحات وعرض معتمد؛ افتح الملف وتحقق أن صيغ المجموع في «ملخص الصفحات» تساوي مبلغ العطاء، وأن عمودي العرض في «الجدول المعدل» ومجموعهما صحيح.

- [ ] **Step 5: Commit**

```bash
git add src/utils/bidderAuditExcel.ts checks/excelPages.test.ts
git commit -m "تصدير Excel: ورقة ملخص الصفحات وعمودا العرض الموزون"
```

---

### Task 11: التوثيق والإصدار

**Files:**
- Modify: `CLAUDE.md`
- Modify: `src/changelog.ts`
- Modify: `package.json` (version)

- [ ] **Step 1: CLAUDE.md**

- في «Commands»: أضف `npm run check        # فحوص الدوال النقية (checks/*.test.ts عبر rolldown + node --test)` واستبدل «There is no test suite in this repo.» بـ: «`npm run check` runs the pure-function checks in `checks/` (bundled with rolldown, which ships with Vite, into `checks/.out`, then `node --test`). UI is still verified by hand.»
- تحت «The financial engine» أضف بنداً:
  - `src/utils/weightedRounding.ts` — `settleWeightedPrices()`: weighted unit prices rounded to 2 decimals, item amount = qty × unit, and the rounding gap settled by moving some unit prices 0.01 (largest quantity first, in rounds) so Σ weighted = bid total; an unclosable gap is `totals.weightedRoundingResidual`, shown, never hidden.
  - `src/utils/weightedOffer.ts` — `assessBalance()` (ضوابط رقم (4) سادساً/5: items deviating **upward** beyond the threshold, ≤10% of items → «يُقبل مبلغ العطاء كما هو», else the weighted table) and the weighted-offer layer (`offerUnitPrice`/`offerTotal`, `Bidder.weightedOffer` active/adopted/paused). The offer never writes over `entered*`/`bidderTotal`. While an offer is active or adopted, `offerLockReason` blocks that bid's number edits and every shared edit (quantity, estimate, rows, imports) in the `App.tsx` handlers.
  - `src/utils/pageSummary.ts` — `BOQItem.pageNo` per bidder (Gemini `page`, or «فواصل الصفحات»), `summarizePages()` for the screen, the محضر and the «ملخص الصفحات» Excel sheet.
- نبّه: `calculateBOQMetrics` builds each item field by field — a new `BOQItem` field must be added there or it is dropped on every recalculation.

- [ ] **Step 2: الإصدار وما الجديد**

- `package.json`: `"version": "1.15.0"`.
- `src/changelog.ts`: أضف في أعلى `CHANGELOG` (بنية المدخلات القائمة؛ ما يستطيع المستخدم فعله الآن، بلا شرح):
```ts
  {
    version: '1.15.0',
    date: '<تاريخ يوم الإصدار>',
    notes: [
      'يمكنك إعداد العرض الموزون في نفس جدول الفقرات، من أسعار العطاء أو بالمعادلة، واعتماده حين يساوي مجموعه مبلغ العطاء، مع بقاء العطاء الأصلي كما هو.',
      'يظهر حكم توازن العطاء وفق ضوابط رقم (4) سادساً/5 في الجدول والمحضر.',
      'يمكنك إسناد فقرات العطاء إلى صفحاته وطباعة ملخص بمبلغ كل صفحة.',
      'يمكنك تأشير سعر غير معقول على أي فقرة، وطباعة قائمة الفقرات التي يُبلَّغ بها المجهز.'
    ]
  },
```

- [ ] **Step 3: البناء والتحقق النهائي**

Run: `npm run check` ثم `npm run lint` ثم `npm run build`
Expected: كلها تنجح.
Run: `cp dist/index.html "نظام_تحليل_العطاءات.html"`
افتح الملف المنفرد من `file://` وكرر الفحص اليدوي المختصر (حكم التوازن، بدء عرض واعتماده، فواصل صفحات، المحضر، Excel).

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md src/changelog.ts package.json
git commit -m "v1.15.0: العرض الموزون واختبار التوازن (سادساً/5) وملخص صفحات العطاء"
```

- [ ] **Step 5: النشر — بعد موافقة المستخدم صراحة فقط**

```bash
git tag v1.15.0 && git push origin master v1.15.0
gh release create v1.15.0 "نظام_تحليل_العطاءات.html" --title v1.15.0
```

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { attachPages, mapGeminiRow, mergeContinuationRows, geminiFailureKind, compareAmountColumn, parseAmountColumn, extractBOQWithGeminiVision } from '../src/utils/ocrService';

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

test('أخطاء Gemini تُصنَّف: الرصيد قبل المفتاح قبل الحصة', () => {
  assert.equal(geminiFailureKind('نفد رصيد حسابك في Google (402) أو لم يُفعَّل الدفع فيه'), 'credit');
  assert.equal(geminiFailureKind('gemini-3.8-flash: (402) {"error":{"status":"PAYMENT_REQUIRED"'), 'credit');
  assert.equal(geminiFailureKind('API key not valid'), 'key');
  assert.equal(geminiFailureKind('نفدت حصة الطلبات (429)'), 'quota');
  assert.equal(geminiFailureKind('تعذر الاتصال بالنماذج: رد فارغ'), null);
});

const amountRow = (itemNo: number | string, t: number, unpriced = false) =>
  mapGeminiRow({ itemNo, description: 'x', quantity: 1, unitPrice: t, total: t, unpriced }, 0);

test('مقارنة عمود المبلغ: اختلاف الأرقام يُعلَّم، واختلاف الحجم وحده لا يُعلَّم', () => {
  const first = [amountRow(1, 144000), amountRow(2, 7200000)];
  const { items, onlyInSecond } = compareAmountColumn(first, [
    { itemNo: '1', amountDigits: '114000' },
    { itemNo: '2', amountDigits: '720000' }
  ]);
  assert.deepEqual(items[0].readDiff?.fields, ['المبلغ']);
  assert.match(items[0].readDiff!.second, /114,000/);
  assert.equal(items[0].bidderTotal, 144000); // تبقى قيم القراءة الأولى
  assert.equal(items[1].readDiff, undefined);
  assert.equal(onlyInSecond, 0);
});

test('مقارنة عمود المبلغ: أرقام عربية في الثانية تُقارَن، وكذلك رقم الفقرة العربي', () => {
  const { items } = compareAmountColumn([amountRow(3, 144000), amountRow(4, 114000)], [
    { itemNo: '٣', amountDigits: '١١٤٠٠٠' },
    { itemNo: '٤', amountDigits: '١١٤٠٠٠' }
  ]);
  assert.deepEqual(items[0].readDiff?.fields, ['المبلغ']);
  assert.equal(items[1].readDiff, undefined);
});

test('مقارنة عمود المبلغ: الغائبة والخانة الفارغة وغير المسعّرة لا تُعلَّم، وصف المبلغ وحده يُعدّ', () => {
  const first = [amountRow(1, 500), amountRow(2, 600), amountRow(3, 700, true)];
  const { items, onlyInSecond } = compareAmountColumn(first, [
    { itemNo: '2', amountDigits: '' },
    { itemNo: '3', amountDigits: '999' },
    { itemNo: '9', amountDigits: '123' },
    { itemNo: '10', amountDigits: '' }
  ]);
  assert.ok(items.every(i => i.readDiff === undefined));
  assert.equal(onlyInSecond, 1);
});

test('مقارنة عمود المبلغ: رقم فقرة مكرر يُقابَل بترتيب ورودهما', () => {
  const { items } = compareAmountColumn([amountRow(1, 5), amountRow(1, 7)], [
    { itemNo: '1', amountDigits: '5' },
    { itemNo: '1', amountDigits: '8' }
  ]);
  assert.equal(items[0].readDiff, undefined);
  assert.deepEqual(items[1].readDiff?.fields, ['المبلغ']);
});

test('parseAmountColumn: يقبل {rows} ويرفض ردّاً بلا مصفوفة', () => {
  assert.deepEqual(parseAmountColumn('{"rows":[{"itemNo":"1","amountDigits":"200"}]}').rows, [{ itemNo: '1', amountDigits: '200' }]);
  assert.throws(() => parseAmountColumn('{"items":5}'));
  assert.throws(() => parseAmountColumn('ليس json'));
});

// طلبات Gemini مُحاكاة: تتابع الردود بترتيب الاستدعاء
function mockGemini(replies: (object | number)[]) {
  const calls: string[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (url: string) => {
    calls.push(String(url));
    const r = replies.shift();
    if (typeof r === 'number') return new Response('{"error":{}}', { status: r });
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(r) }] }, finishReason: 'STOP' }] }), { status: 200 });
  }) as typeof fetch;
  return { calls, restore: () => { globalThis.fetch = original; } };
}
const geminiReply = (total: number) => ({ items: [{ itemNo: '1', description: 'x', quantity: 1, unitPrice: total, total, unpriced: false }], grandTotal: null });

test('القراءة المزدوجة عبر Gemini: قراءتان وتعليم الاختلاف', async () => {
  const m = mockGemini([geminiReply(100), { rows: [{ itemNo: '1', amountDigits: '200' }] }]);
  try {
    const r = await extractBOQWithGeminiVision(['data:image/jpeg;base64,AA'], 'k', undefined, ['gemini-x'], true);
    assert.equal(m.calls.length, 2);
    assert.deepEqual(r.items[0].readDiff?.fields, ['المبلغ']);
    assert.equal(r.items[0].bidderTotal, 100);
  } finally { m.restore(); }
});

test('Gemini 402: يتوقف عند أول طلب برسالة الرصيد ولا تُجرى قراءة ثانية', async () => {
  const m = mockGemini([402, 402, 402]);
  try {
    await assert.rejects(extractBOQWithGeminiVision(['data:image/jpeg;base64,AA'], 'k', undefined, ['m1', 'm2'], true), /\(402\)/);
    assert.equal(m.calls.length, 1);
  } finally { m.restore(); }
});

// ردّ يعتمد على الصفحة المرسلة لا على ترتيب الاستدعاء (الطلبات متزامنة)؛ الصفحة الأولى أبطأ لتنتهي الطلبات بغير ترتيبها
function mockGeminiByPage(failOn?: string) {
  const bodies: string[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (_url: string, init: { body: string }) => {
    bodies.push(init.body);
    const page = /"data":"P(\d+)"/.exec(init.body)?.[1] || '';
    await new Promise(r => setTimeout(r, page === '1' ? 30 : 1));
    if (failOn && page === failOn) return new Response('{"error":{}}', { status: 402 });
    const n = Number(page);
    const reply = { items: [{ itemNo: String(n), description: 'x', quantity: 1, unitPrice: n * 10, total: n * 10, unpriced: false, page: 1 }], grandTotal: null };
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(reply) }] }, finishReason: 'STOP' }] }), { status: 200 });
  }) as typeof fetch;
  return { bodies, restore: () => { globalThis.fetch = original; } };
}
const pageImages = (n: number) => Array.from({ length: n }, (_, i) => `data:image/jpeg;base64,P${i + 1}`);

test('Gemini: صفحة واحدة في كل طلب، والفقرات بترتيب الصفحات ولو انتهت الطلبات بغيره', async () => {
  const m = mockGeminiByPage();
  try {
    const r = await extractBOQWithGeminiVision(pageImages(6), 'k', undefined, ['gemini-x']);
    assert.equal(m.bodies.length, 6);
    assert.ok(m.bodies.every(b => (b.match(/"inlineData"/g) || []).length === 1));
    assert.deepEqual(r.items.map(i => i.bidderTotal), [10, 20, 30, 40, 50, 60]);
    assert.deepEqual(r.items.map(i => i.pageNo), [1, 2, 3, 4, 5, 6]);
    assert.equal(r.stoppedAtPage, undefined);
  } finally { m.restore(); }
});

test('Gemini: فشل صفحة في الوسط يُبقي ما قبلها ويُبلَّغ عن موضع التوقف', async () => {
  const m = mockGeminiByPage('3');
  try {
    const r = await extractBOQWithGeminiVision(pageImages(6), 'k', undefined, ['gemini-x']);
    assert.equal(r.stoppedAtPage, 3);
    assert.deepEqual(r.items.map(i => i.bidderTotal), [10, 20]);
  } finally { m.restore(); }
});

test('القراءة المزدوجة: الطلب الثاني هو طلب عمود المبلغ، وطلبان لصفحة واحدة', async () => {
  const bodies: string[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (_url: string, init: { body: string }) => {
    bodies.push(init.body);
    const reply = init.body.includes('عمود واحد فقط') ? { rows: [{ itemNo: '1', amountDigits: '10' }] } : geminiReply(10);
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(reply) }] }, finishReason: 'STOP' }] }), { status: 200 });
  }) as typeof fetch;
  try {
    const r = await extractBOQWithGeminiVision(['data:image/jpeg;base64,P1'], 'k', undefined, ['gemini-x'], true);
    assert.equal(bodies.length, 2);
    assert.ok(!bodies[0].includes('عمود واحد فقط'));
    assert.ok(bodies[1].includes('عمود واحد فقط') && bodies[1].includes('مبلغ الفقرة'));
    assert.equal(r.items[0].readDiff, undefined);
  } finally { globalThis.fetch = original; }
});

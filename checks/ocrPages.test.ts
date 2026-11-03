import { test } from 'node:test';
import assert from 'node:assert/strict';
import { attachPages, mapGeminiRow, mergeContinuationRows, geminiFailureKind, compareReads, extractBOQWithGeminiVision } from '../src/utils/ocrService';

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

test('القراءة المزدوجة: تعليم الفقرة المختلفة والغائبة وعدّ ما انفردت به الثانية', () => {
  const row = (itemNo: number, q: number, u: number, t: number, w?: string) => mapGeminiRow({ itemNo, description: 'x', quantity: q, unitPrice: u, total: t, writtenText: w }, itemNo - 1);
  const first = [row(1, 10, 100, 1000), row(2, 260, 4800, 1248000), row(3, 5, 10, 50)];
  const second = [row(1, 10, 100, 1000), row(2, 280, 4800, 1344000), row(4, 1, 1, 1)];
  const { items, onlyInSecond } = compareReads(first, second);
  assert.equal(items[0].readDiff, undefined);
  assert.deepEqual(items[1].readDiff?.fields, ['الكمية', 'المبلغ']);
  assert.match(items[1].readDiff!.second, /280/);
  assert.equal(items[1].bidderTotal, 1248000); // تبقى قيم القراءة الأولى
  assert.deepEqual(items[2].readDiff?.fields, ['غابت عن القراءة الثانية']);
  assert.equal(onlyInSecond, 1);
});

test('القراءة المزدوجة: رقم فقرة مكرر يُقابَل بترتيب ورودهما', () => {
  const row = (t: number) => mapGeminiRow({ itemNo: 1, description: 'x', quantity: 1, unitPrice: t, total: t }, 0);
  const { items } = compareReads([row(5), row(7)], [row(5), row(8)]);
  assert.equal(items[0].readDiff, undefined);
  assert.deepEqual(items[1].readDiff?.fields, ['المفرد', 'المبلغ']);
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
  const m = mockGemini([geminiReply(100), geminiReply(200)]);
  try {
    const r = await extractBOQWithGeminiVision(['data:image/jpeg;base64,AA'], 'k', undefined, ['gemini-x'], true);
    assert.equal(m.calls.length, 2);
    assert.deepEqual(r.items[0].readDiff?.fields, ['المفرد', 'المبلغ']);
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

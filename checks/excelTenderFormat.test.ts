import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inflateRawSync } from 'node:zlib';
import * as XLSX from 'xlsx-js-style';
import { calculateBOQMetrics } from '../src/utils/calculations';
import { buildTenderWorkbook, WEIGHTED_SHEET } from '../src/utils/excelService';
import { buildBidderAuditWorkbook } from '../src/utils/bidderAuditExcel';
import type { Bidder, TenderProject, WeightedOfferState } from '../src/types/tender';

// قارئ zip صغير (الدليل المركزي) لفحص XML الملف المكتوب فعلاً، بلا اعتمادية جديدة
function unzip(buf: Uint8Array): Record<string, string> {
  const b = Buffer.from(buf);
  let eocd = b.length - 22;
  while (b.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  const count = b.readUInt16LE(eocd + 10);
  let p = b.readUInt32LE(eocd + 16);
  const out: Record<string, string> = {};
  for (let i = 0; i < count; i++) {
    const method = b.readUInt16LE(p + 10);
    const csize = b.readUInt32LE(p + 20);
    const nlen = b.readUInt16LE(p + 28), elen = b.readUInt16LE(p + 30), clen = b.readUInt16LE(p + 32);
    const local = b.readUInt32LE(p + 42);
    const name = b.toString('utf8', p + 46, p + 46 + nlen);
    const dataAt = local + 30 + b.readUInt16LE(local + 26) + b.readUInt16LE(local + 28);
    const data = b.subarray(dataAt, dataAt + csize);
    out[name] = (method === 0 ? data : inflateRawSync(data)).toString('utf8');
    p += 46 + nlen + elen + clen;
  }
  return out;
}

const raw = [
  { itemNo: 1, description: 'وصف طويل جداً للفقرة الأولى يحتاج إلى التفاف النص داخل الخلية', quantity: 2.5, estimatedTotal: 190000000, bidderTotal: 192000000, enteredUnitPrice: 76800000, enteredBidderTotal: 192000000 },
  { itemNo: 2, description: 'ب', quantity: 1, estimatedTotal: 500, bidderTotal: 480.5, enteredUnitPrice: 480.5, enteredBidderTotal: 480.5 }
];
const offer = (status: WeightedOfferState['status']): WeightedOfferState =>
  ({ status, origin: 'corrected', startedAt: '2026-10-10', bidTotal: 192000480.5 });
const mk = (id: string, name: string, extra: Partial<Bidder> = {}, top = 192000000): Bidder => {
  const { items, totals } = calculateBOQMetrics([{ ...raw[0], bidderTotal: top, enteredBidderTotal: top, enteredUnitPrice: top / 2.5 }, raw[1]], 20);
  return { id, name, submissionDate: '2026-10-10', items, totals, status: 'pending', ...extra };
};
const proj = (bidders: Bidder[]): TenderProject => ({
  id: 'p', title: 'مناقصة', referenceNumber: '5 / 26 / 100', deviationThreshold: 20, currency: 'IQD', bidders,
  auditLogs: [{ id: 'l', timestamp: '2026-11-01T10:00:00Z', userName: 'عضو', action: 'إجراء', details: 'تفاصيل طويلة '.repeat(10) }]
} as unknown as TenderProject);

const cases: [string, TenderProject, string[]][] = (() => {
  const a = mk('a', 'أ', { weightedOffer: offer('active') });
  const b = mk('b', 'ب', {}, 200000000);
  const withOffer = proj([a, b]);
  const c = mk('c', 'ج');
  const d = mk('d', 'د');
  const noOffer = proj([c, d]);
  return [
    ['بعرض موزون', withOffer, [WEIGHTED_SHEET, 'أ', 'ب', 'مقارنة المجهزين', 'سجل التتبع']],
    ['بلا عرض موزون', noOffer, ['ج', 'د', 'مقارنة المجهزين', 'سجل التتبع']]
  ];
})();

for (const [label, p, names] of cases) {
  test(`مصنف الخلاصة ${label}: الأوراق منسقة ولا E+ وعروض الأعمدة كافية`, () => {
    const wb = buildTenderWorkbook(p, p.bidders[0]);
    assert.deepEqual(wb.SheetNames, names);
    for (const name of wb.SheetNames) {
      const ws = wb.Sheets[name];
      for (const [k, c] of Object.entries(ws) as [string, any][]) {
        if (k.startsWith('!') || !c) continue;
        // كل خلية رقمية بتنسيق صريح (العام يُظهر 1.92E+08 للكبير)، ولا تنسيق علمي
        if (c.t === 'n' && !c.f) assert.ok(c.z && !/E\+/i.test(c.z), `${name}!${k} بلا تنسيق رقم`);
        if (c.z) assert.ok(!/E\+/i.test(c.z), `${name}!${k}: ${c.z}`);
      }
      const cols = ws['!cols'] as { wch: number }[];
      assert.ok(cols && cols.length > 0, `${name}: !cols`);
      assert.ok(cols.every(c => c.wch >= 6), `${name}: عمود أضيق من 6`);
    }
    // الوصف عمود التفاف عريض في ورقة المجهز، وتنسيق مبلغ كبير بفواصل آلاف
    const sheet = wb.Sheets[names.find(n => n === 'أ' || n === 'ج')!];
    assert.ok((sheet['!cols'] as any)[1].wch >= 40);
    assert.equal(sheet['B5'].s.alignment.wrapText, true);
    assert.equal(sheet['H5'].v, 192000000);
    assert.match(sheet['H5'].z, /#,##0/);
    assert.equal(sheet['D5'].v, 2.5);
    assert.match(sheet['D5'].z, /0\.00/);
    assert.equal(sheet['A1'].v.startsWith('مشروع:'), true);
    // رأس الجدول بالأسلوب المرجعي
    assert.equal(sheet['A4'].s.fill.fgColor.rgb, 'FF1F4E78');
    assert.equal(sheet['A4'].s.font.name, 'Arial');
  });

  test(`مصنف الخلاصة ${label}: كل ورقة من اليمين إلى اليسار في الملف المكتوب`, () => {
    const wb = buildTenderWorkbook(p, p.bidders[0]);
    const files = unzip(XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' }));
    const sheets = Object.keys(files).filter(f => /^xl\/worksheets\/sheet\d+\.xml$/.test(f));
    assert.equal(sheets.length, names.length);
    for (const f of sheets) {
      assert.match(files[f], /<sheetView [^>]*rightToLeft="1"/, f);
    }
  });
}

test('مصنف تصدير الجدول: كل ورقة من اليمين إلى اليسار في الملف المكتوب', () => {
  const a = mk('a', 'أ', { weightedOffer: offer('active') });
  const wb = buildBidderAuditWorkbook(proj([a]), a);
  const files = unzip(XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' }));
  const sheets = Object.keys(files).filter(f => /^xl\/worksheets\/sheet\d+\.xml$/.test(f));
  assert.ok(sheets.length >= 4);
  for (const f of sheets) assert.match(files[f], /<sheetView [^>]*rightToLeft="1"/, f);
});

// وجدها فحص الملف في Excel: تنسيق «0» لرقم الفقرة كان يُظهر 1.1 «1» و1.5 «2»
test('رقم الفقرة العشري (1.1) يُكتب بتنسيق لا يقرّبه في كل أوراق الخلاصة', () => {
  const { items, totals } = calculateBOQMetrics([
    { itemNo: 1, description: 'أ', quantity: 1, estimatedTotal: 100, bidderTotal: 100, enteredUnitPrice: 100, enteredBidderTotal: 100 },
    { itemNo: 1.1, description: 'ب', quantity: 1, estimatedTotal: 100, bidderTotal: 100, enteredUnitPrice: 100, enteredBidderTotal: 100 },
    { itemNo: 1.5, description: 'ج', quantity: 1, estimatedTotal: 100, bidderTotal: 100, enteredUnitPrice: 100, enteredBidderTotal: 100 }
  ], 20);
  const a: Bidder = { id: 'a', name: 'أ', submissionDate: '2026-10-10', items, totals, status: 'pending', weightedOffer: offer('active') };
  const wb = buildTenderWorkbook(proj([a]), a);
  for (const name of [WEIGHTED_SHEET, 'أ']) {
    const cells = Object.values(wb.Sheets[name]).filter((c: any) => c && c.t === 'n' && (c.v === 1.1 || c.v === 1.5)) as any[];
    assert.ok(cells.length >= 2, `${name}: لم أجد خليتي 1.1 و1.5`);
    for (const c of cells) assert.equal(c.z, 'General', `${name}: ${c.v} بتنسيق ${c.z}`);
  }
});

test('ورقة المجهز: الكمية والمفرد بقيمتهما الكاملة بلا تقريب إلى أربع منازل (مراجعة Codex)', () => {
  const { items, totals } = calculateBOQMetrics([
    { itemNo: 1, description: 'أ', quantity: 1.234567, estimatedTotal: 100, bidderTotal: 100, enteredUnitPrice: 81.0001234, enteredBidderTotal: 100 }
  ], 20);
  const a: Bidder = { id: 'a', name: 'أ', submissionDate: '2026-10-10', items, totals, status: 'pending' };
  const sheet = buildTenderWorkbook(proj([a]), a).Sheets['أ'] as any;
  const vals = Object.values(sheet).filter((c: any) => c && c.t === 'n').map((c: any) => c.v);
  assert.ok(vals.includes(1.234567), 'الكمية قُرّبت');
});

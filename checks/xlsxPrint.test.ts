import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unzipSync } from 'fflate';
import * as XLSX from 'xlsx-js-style';
import { calculateBOQMetrics } from '../src/utils/calculations';
import { buildTenderWorkbook, WEIGHTED_SHEET } from '../src/utils/excelService';
import { xlsxBytes } from '../src/utils/xlsxPrint';
import { buildStatusSheetWorkbook } from '../src/utils/statusSheetExcel';
import type { Bidder, TenderProject } from '../src/types/tender';

const raw = [
  { itemNo: 1, description: 'وصف طويل جداً للفقرة الأولى يحتاج إلى التفاف النص داخل الخلية', quantity: 2.5, estimatedTotal: 190000000, bidderTotal: 192000000, enteredUnitPrice: 76800000, enteredBidderTotal: 192000000 },
  { itemNo: 2, description: 'ب', quantity: 1, estimatedTotal: 500, bidderTotal: 480.5, enteredUnitPrice: 480.5, enteredBidderTotal: 480.5 }
];
const mk = (id: string, name: string, extra: Partial<Bidder> = {}, top = 192000000): Bidder => {
  const { items, totals } = calculateBOQMetrics([{ ...raw[0], bidderTotal: top, enteredBidderTotal: top, enteredUnitPrice: top / 2.5 }, raw[1]], 20);
  return { id, name, submissionDate: '2026-10-10', items, totals, status: 'pending', ...extra };
};
const proj = (bidders: Bidder[]): TenderProject => ({
  id: 'p', title: "مناقصة 'اختبار'", referenceNumber: '5 / 26 / 100', deviationThreshold: 20, currency: 'IQD', bidders,
  auditLogs: [{ id: 'l', timestamp: '2026-11-01T10:00:00Z', userName: 'عضو', action: 'إجراء', details: 'تفاصيل طويلة '.repeat(10) }]
} as unknown as TenderProject);

const build = () => {
  const a = mk('a', 'أ', { weightedOffer: { status: 'active', origin: 'corrected', startedAt: '2026-10-10', bidTotal: 192000480.5 } });
  const b = mk('b', 'ب', {}, 200000000);
  const p = proj([a, b]);
  return buildTenderWorkbook(p, a);
};

const read = (wb: XLSX.WorkBook) => {
  const files = unzipSync(xlsxBytes(wb));
  const dec = new TextDecoder();
  const text = (f: string) => dec.decode(files[f]);
  return { files, text };
};

test('إعداد الطباعة: A4 وملاءمة العرض وتكرار الرؤوس والترقيم في XML الملف المكتوب', () => {
  const wb = build();
  const { text } = read(wb);
  const wbXml = text('xl/workbook.xml');
  wb.SheetNames.forEach((name, i) => {
    const xml = text(`xl/worksheets/sheet${i + 1}.xml`);
    const portrait = name === WEIGHTED_SHEET;
    assert.match(xml, /<sheetPr><pageSetUpPr fitToPage="1"\/><\/sheetPr>/, name);
    assert.ok(xml.search(/<sheetPr/) < xml.search(/<dimension|<sheetViews/), `${name}: sheetPr ليس أول ابن`);
    assert.match(xml, new RegExp(`<pageSetup paperSize="9" orientation="${portrait ? 'portrait' : 'landscape'}" fitToWidth="1" fitToHeight="0"/>`), name);
    const iOpt = xml.indexOf('<printOptions'), iMar = xml.indexOf('<pageMargins'), iSet = xml.indexOf('<pageSetup'), iFoot = xml.indexOf('<headerFooter');
    assert.ok(iOpt >= 0 && iOpt < iMar && iMar < iSet && iSet < iFoot, `${name}: ترتيب العناصر`);
    assert.match(xml, /<oddFooter>[^<]*صفحة &amp;P من &amp;N<\/oddFooter>/);
    assert.match(xml, /<sheetView [^>]*rightToLeft="1"/, `${name}: RTL`);
    // تسمية تكرار الصف بفهرس الورقة الصحيح وإحالة صحيحة (الرأس في الصف 5 لأوراق المجهز والموزون)
    const re = new RegExp(`<definedName name="_xlnm.Print_Titles" localSheetId="${i}">([^<]*)</definedName>`);
    const m = wbXml.match(re);
    assert.ok(m, `${name}: لا Print_Titles`);
    const ref = m![1].replace(/&apos;/g, "'").replace(/&amp;/g, '&');
    assert.match(ref, /^'.+'!\$\d+:\$\d+$/);
    assert.ok(ref.startsWith(`'${name.replace(/'/g, "''")}'!`), `${name}: ${ref}`);
    const row = Number(ref.match(/\$(\d+):/)![1]);
    const ws = wb.Sheets[name] as any;
    assert.equal(row, ws['!print'].repeatRow + 1);
  });
  assert.equal(wb.SheetNames[0], WEIGHTED_SHEET);
});

test('إعداد الطباعة: استدعاء xlsxBytes مرتين لا يكرر التسميات، والملف يُقرأ وقيم الخلايا كما هي', () => {
  const wb = build();
  xlsxBytes(wb);
  const names = (wb.Workbook!.Names || []).filter(n => n.Name === '_xlnm.Print_Titles');
  assert.equal(names.length, wb.SheetNames.length);
  const back = XLSX.read(xlsxBytes(wb), { type: 'array' });
  assert.deepEqual(back.SheetNames, wb.SheetNames);
  for (const name of wb.SheetNames) {
    const orig = wb.Sheets[name], got = back.Sheets[name];
    for (const [k, c] of Object.entries(orig) as [string, any][]) {
      if (k.startsWith('!') || !c || c.v === '' || c.v === undefined) continue;
      assert.equal(got[k]?.v, c.v, `${name}!${k}`);
    }
  }
});

test('كشف الموقف: A4 أفقي وملاءمة العرض وتكرار صف الرؤوس (يتبع اسم اللجنة) والترقيم', () => {
  const rows = [
    { kind: 'tender', id: 'a', no: 1, referenceNumber: '1 / 26 / 100', title: 'طلبية', announcement: '', receivedAt: '', action: 'قيد التحليل', memoNo: '', date: '', note: '' },
    { kind: 'tender', id: 'b', no: 2, referenceNumber: '2 / 26 / 100', title: 'طلبية ثانية', announcement: '', receivedAt: '', action: 'تدقيق', memoNo: '', date: '', note: '' }
  ] as unknown as Parameters<typeof buildStatusSheetWorkbook>[0];
  for (const [committee, headerRow] of [[null, 2], ['لجنة التحليل', 3]] as const) {
    const wb = buildStatusSheetWorkbook(rows, '2026-11-17', undefined, committee);
    const { text } = read(wb);
    const xml = text('xl/worksheets/sheet1.xml');
    assert.match(xml, /<sheetPr><pageSetUpPr fitToPage="1"\/><\/sheetPr>/);
    assert.match(xml, /<pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"\/>/);
    assert.match(xml, /<oddFooter>[^<]*صفحة &amp;P من &amp;N<\/oddFooter>/);
    assert.match(xml, /<sheetView [^>]*rightToLeft="1"/);
    const ref = text('xl/workbook.xml').match(/<definedName name="_xlnm.Print_Titles" localSheetId="0">([^<]*)<\/definedName>/);
    assert.ok(ref, 'لا Print_Titles');
    assert.match(ref![1], new RegExp(`\\$${headerRow}:\\$${headerRow}$`), `صف الرؤوس ${headerRow} عند ${committee ?? 'بلا اسم'}`);
  }
});

test('ارتفاع صف الملاحظة يتناسب مع طولها، وصف الرؤوس لا يقل عن 32', () => {
  const wb = build();
  const ws = wb.Sheets[WEIGHTED_SHEET] as any;
  const note: string = ws['A3'].v;
  const hpt = ws['!rows'][2].hpt;
  const width = (ws['!cols'] as { wch: number }[]).reduce((s, c) => s + c.wch, 0);
  const lines = Math.ceil(note.length / (width * (10 / 9) * 0.95));
  assert.ok(lines >= 2, 'الملاحظة تحتاج سطرين على الأقل في هذا الاختبار');
  assert.ok(hpt >= lines * 9 * 1.35, `${hpt} < ${lines} أسطر`);
  assert.equal(ws['A3'].s.alignment.wrapText, true);
  assert.equal(ws['A1'].s.alignment.wrapText, true);
  assert.ok(ws['!rows'][4].hpt >= 32);
  assert.deepEqual(ws['!margins'], { left: 0.4, right: 0.4, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 });
});

// إعداد الطباعة لملفات xlsx: xlsx-js-style (SheetJS 0.18.5) لا تكتب pageSetup ولا fitToPage، وتكتب هوامش الصفحة
// وتسميات المصنف (definedNames) فقط. فنكتب الملف بها ثم نعدّل XML الأوراق التي تحمل ws['!print'] (مفتاح مخصص تتجاهله المكتبة):
// A4، اتجاه الورقة، ملاءمة العرض على صفحة واحدة، تكرار صف الرؤوس في كل صفحة، وترقيم الصفحات.
import * as XLSX from 'xlsx-js-style';
import { unzipSync, zipSync } from 'fflate';

export interface PrintSetup {
  orientation: 'portrait' | 'landscape';
  repeatRow?: number; // صف الرؤوس من الصفر
}

type PrintedSheet = XLSX.WorkSheet & { '!print'?: PrintSetup };

const TITLES = '_xlnm.Print_Titles';
const FOOTER = '<headerFooter><oddFooter>&amp;C&amp;"Arial,Regular"&amp;9صفحة &amp;P من &amp;N</oddFooter></headerFooter>';

function addPrintTitles(wb: XLSX.WorkBook) {
  wb.SheetNames.forEach((name, i) => {
    const repeat = (wb.Sheets[name] as PrintedSheet)['!print']?.repeatRow;
    if (repeat === undefined) return;
    const wbk = (wb.Workbook = wb.Workbook || {});
    const names = (wbk.Names = wbk.Names || []);
    if (names.some(n => n.Name === TITLES && n.Sheet === i)) return;
    names.push({ Name: TITLES, Sheet: i, Ref: `'${name.replace(/'/g, "''")}'!$${repeat + 1}:$${repeat + 1}` });
  });
}

// ترتيب عناصر CT_Worksheet: sheetPr أولاً، ثم printOptions، pageMargins، pageSetup، headerFooter قبل drawing وغيرها
function patchSheetXml(xml: string, setup: PrintSetup): string {
  let out = xml;
  const fit = '<pageSetUpPr fitToPage="1"/>';
  if (/<sheetPr\b[^>]*\/>/.test(out)) {
    out = out.replace(/<sheetPr\b([^>]*)\/>/, `<sheetPr$1>${fit}</sheetPr>`);
  } else if (/<sheetPr\b/.test(out)) {
    if (!/<pageSetUpPr\b/.test(out)) out = out.replace('</sheetPr>', `${fit}</sheetPr>`);
    else out = out.replace(/<pageSetUpPr\b[^>]*\/>/, fit);
  } else {
    out = out.replace(/(<worksheet\b[^>]*>)/, `$1<sheetPr>${fit}</sheetPr>`);
  }
  const setupXml = `<pageSetup paperSize="9" orientation="${setup.orientation}" fitToWidth="1" fitToHeight="0"/>${FOOTER}`;
  const printOptions = '<printOptions horizontalCentered="1"/>';
  if (/<pageMargins\b[^>]*\/>/.test(out)) {
    out = out.replace(/<pageMargins\b[^>]*\/>/, m => `${printOptions}${m}${setupXml}`);
  } else {
    const at = out.search(/<(ignoredErrors|drawing|legacyDrawing|tableParts|extLst)\b|<\/worksheet>/);
    const margins = '<pageMargins left="0.4" right="0.4" top="0.6" bottom="0.6" header="0.3" footer="0.3"/>';
    out = out.slice(0, at) + printOptions + margins + setupXml + out.slice(at);
  }
  return out;
}

export function xlsxBytes(wb: XLSX.WorkBook): Uint8Array {
  addPrintTitles(wb);
  const written = new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer);
  const files = unzipSync(written);
  const dec = new TextDecoder();
  const enc = new TextEncoder();
  let changed = false;
  wb.SheetNames.forEach((name, i) => {
    const setup = (wb.Sheets[name] as PrintedSheet)['!print'];
    const path = `xl/worksheets/sheet${i + 1}.xml`;
    if (!setup || !files[path]) return;
    files[path] = enc.encode(patchSheetXml(dec.decode(files[path]), setup));
    changed = true;
  });
  return changed ? zipSync(files) : written;
}

export function downloadXlsx(wb: XLSX.WorkBook, filename: string) {
  const blob = new Blob([xlsxBytes(wb) as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

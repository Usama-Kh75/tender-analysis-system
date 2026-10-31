// كشف موقف الطلبيات إلى Excel بأسلوب ملفات اللجنة (Arial، رأس أبيض غامق على 1F4E78، حدود رفيعة، RTL).
// وثيقة رسمية: بتوقيع رئيس اللجنة وحده. الصفوف من statusSheetRows نفسها التي تُبنى منها الطباعة
import * as XLSX from 'xlsx-js-style';
import { formatSheetDate } from './orderStatus';
import type { StatusSheetRow } from './orderStatus';

const FONT = 'Arial';
const THIN = { style: 'thin', color: { rgb: 'FF000000' } };
const BOX = { top: THIN, bottom: THIN, left: THIN, right: THIN };

export const STATUS_SHEET_HEADERS = ['ت', 'رقم الطلبية', 'الموضوع', 'الإعلان', 'تاريخ الاستلام', 'الإجراء', 'رقم المذكرة', 'التاريخ', 'الملاحظات'];
const WIDTHS = [5, 14, 40, 14, 14, 40, 14, 14, 30];

export const statusSheetTitle = (asOf: string): string => `موقف الطلبيات لغاية ${formatSheetDate(asOf)}`;

export function buildStatusSheetWorkbook(rows: StatusSheetRow[], asOf: string): XLSX.WorkBook {
  const lastCol = STATUS_SHEET_HEADERS.length - 1;
  const aoa: (string | number)[][] = [
    [statusSheetTitle(asOf)],
    STATUS_SHEET_HEADERS,
    ...rows.map(r => [r.no, r.referenceNumber, r.title, r.announcement, r.receivedAt, r.action, r.memoNo, r.date, r.note])
  ];
  const signRow = aoa.length + 1;
  aoa.push([], ['رئيس اللجنة'], ['التوقيع: .....................']);
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = WIDTHS.map(wch => ({ wch }));
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: lastCol } }];

  const style = (r: number, c: number, s: object) => {
    const ref = XLSX.utils.encode_cell({ r, c });
    if (!ws[ref]) ws[ref] = { t: 's', v: '' };
    ws[ref].s = s;
  };
  for (let c = 0; c <= lastCol; c++) {
    style(0, c, { font: { name: FONT, sz: 14, bold: true }, alignment: { horizontal: 'center', vertical: 'center' } });
    style(1, c, {
      font: { name: FONT, sz: 10, bold: true, color: { rgb: 'FFFFFFFF' } },
      fill: { patternType: 'solid', fgColor: { rgb: 'FF1F4E78' } },
      border: BOX,
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true }
    });
    for (let r = 2; r < aoa.length; r++) {
      style(r, c, {
        font: { name: FONT, sz: 10 },
        border: BOX,
        alignment: { horizontal: c === 2 || c === 5 || c === 8 ? 'right' : 'center', vertical: 'center', wrapText: true },
        // أرقام الطلبية والمذكرة والتواريخ نصوص تُحفظ كما كُتبت؛ عمود «ت» رقم فلا يُنسَّق نصاً
        ...(c === 0 ? {} : { numFmt: '@' })
      });
    }
  }

  // توقيع رئيس اللجنة تحت الجدول في العمود الأول، بلا حدود
  for (const r of [signRow, signRow + 1]) {
    style(r, 0, { font: { name: FONT, sz: 10, bold: r === signRow }, alignment: { horizontal: 'right', vertical: 'center' } });
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'موقف الطلبيات');
  wb.Workbook = { Views: [{ RTL: true }] };
  return wb;
}

export function exportStatusSheetToExcel(rows: StatusSheetRow[], asOf: string): void {
  XLSX.writeFile(buildStatusSheetWorkbook(rows, asOf), `موقف الطلبيات ${asOf}.xlsx`);
}

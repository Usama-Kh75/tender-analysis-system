// كشف موقف الطلبيات إلى Excel بأسلوب ملفات اللجنة (Arial، رأس أبيض غامق على 1F4E78، حدود رفيعة، RTL).
// وثيقة رسمية: بتوقيع رئيس اللجنة وحده. الصفوف من statusSheetRows نفسها التي تُبنى منها الطباعة
import * as XLSX from 'xlsx-js-style';
import { formatSheetDate } from './orderStatus';
import type { StatusSheetRow } from './orderStatus';

const FONT = 'Arial';
const THIN = { style: 'thin', color: { rgb: 'FF000000' } };
const BOX = { top: THIN, bottom: THIN, left: THIN, right: THIN };

export type StatusColumnKey = 'no' | 'referenceNumber' | 'title' | 'announcement' | 'receivedAt' | 'action' | 'memoNo' | 'date' | 'note';
export type OptionalStatusColumnKey = 'announcement' | 'receivedAt' | 'memoNo' | 'date' | 'note';

export interface StatusColumnDef {
  key: StatusColumnKey;
  header: string;
  wch: number;
  align: 'right' | 'center';
  optional: boolean;
}

// تعريف أعمدة الكشف: مصدر واحد للمعاينة والطباعة وExcel. الأعمدة الاختيارية تُعرض أو تُخفى
export const STATUS_COLUMNS: StatusColumnDef[] = [
  { key: 'no', header: 'ت', wch: 5, align: 'center', optional: false },
  { key: 'referenceNumber', header: 'رقم الطلبية', wch: 14, align: 'center', optional: false },
  { key: 'title', header: 'الموضوع', wch: 40, align: 'right', optional: false },
  { key: 'announcement', header: 'الإعلان', wch: 14, align: 'center', optional: true },
  { key: 'receivedAt', header: 'تاريخ الاستلام', wch: 14, align: 'center', optional: true },
  { key: 'action', header: 'الإجراء', wch: 40, align: 'right', optional: false },
  { key: 'memoNo', header: 'رقم المذكرة', wch: 14, align: 'center', optional: true },
  { key: 'date', header: 'التاريخ', wch: 14, align: 'center', optional: true },
  { key: 'note', header: 'الملاحظات', wch: 30, align: 'right', optional: true }
];

export const STATUS_SHEET_HEADERS = STATUS_COLUMNS.map(c => c.header);

/** الأعمدة الاختيارية التي فيها قيمة غير فارغة في صف واحد على الأقل (الافتراضي عند فتح الكشف). */
export function defaultStatusColumns(rows: StatusSheetRow[]): OptionalStatusColumnKey[] {
  return STATUS_COLUMNS
    .filter(c => c.optional && rows.some(r => String(r[c.key as keyof StatusSheetRow] ?? '').trim() !== ''))
    .map(c => c.key as OptionalStatusColumnKey);
}

/** الأعمدة المعروضة: الثابتة دائماً، والاختيارية المختارة فقط (بلا تحديد = كلها). */
export function shownStatusColumns(optional?: Iterable<OptionalStatusColumnKey>): StatusColumnDef[] {
  const chosen = optional ? new Set<string>(optional) : null;
  return STATUS_COLUMNS.filter(c => !c.optional || !chosen || chosen.has(c.key));
}

export const statusSheetTitle = (asOf: string): string => `موقف الطلبيات لغاية ${formatSheetDate(asOf)}`;

export function buildStatusSheetWorkbook(rows: StatusSheetRow[], asOf: string, columns?: Iterable<OptionalStatusColumnKey>): XLSX.WorkBook {
  const cols = shownStatusColumns(columns);
  const lastCol = cols.length - 1;
  const aoa: (string | number)[][] = [
    [statusSheetTitle(asOf)],
    cols.map(c => c.header),
    ...rows.map(r => cols.map(c => r[c.key]))
  ];
  const signRow = aoa.length + 1;
  const pad = Array<string>(cols.length - 2).fill('');
  aoa.push([], [...pad, 'رئيس اللجنة'], [...pad, 'التوقيع: .....................']);
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = cols.map(c => ({ wch: c.wch }));
  // توقيع رئيس اللجنة في آخر عمودين (يسار الصفحة في ورقة RTL): كل سطر دمج الأخيرين
  const signCol = lastCol - 1;
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: lastCol } },
    ...[signRow, signRow + 1].map(r => ({ s: { r, c: signCol }, e: { r, c: lastCol } }))
  ];

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
        alignment: { horizontal: cols[c].align, vertical: 'center', wrapText: true },
        // أرقام الطلبية والمذكرة والتواريخ نصوص تُحفظ كما كُتبت؛ عمود «ت» رقم فلا يُنسَّق نصاً
        ...(cols[c].key === 'no' ? {} : { numFmt: '@' })
      });
    }
  }

  // توقيع رئيس اللجنة تحت الجدول في آخر عمودين، بلا حدود
  for (const r of [signRow, signRow + 1]) {
    for (const c of [signCol, lastCol]) {
      style(r, c, { font: { name: FONT, sz: 10, bold: r === signRow }, alignment: { horizontal: 'center', vertical: 'center' } });
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'موقف الطلبيات');
  wb.Workbook = { Views: [{ RTL: true }] };
  return wb;
}

export function exportStatusSheetToExcel(rows: StatusSheetRow[], asOf: string, columns?: Iterable<OptionalStatusColumnKey>): void {
  XLSX.writeFile(buildStatusSheetWorkbook(rows, asOf, columns),`موقف الطلبيات ${asOf}.xlsx`);
}

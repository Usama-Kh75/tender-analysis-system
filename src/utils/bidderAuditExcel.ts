// xlsx-js-style: نسخة من SheetJS 0.18.5 نفسها تكتب تنسيق الخلايا (الخط والتعبئة والحدود والمحاذاة)، فيخرج
// التصدير بمواصفات «عرض_المجهز_..._مطابق_للأصل.xlsx» التي اعتمدتها اللجنة. الاستيراد يبقى على xlsx
import * as XLSX from 'xlsx-js-style';
import { AuditLogEntry, BOQItem, Bidder, TenderProject } from '../types/tender';
import { auditRowAmounts, isCommitteeCorrected, parseArabicTextToNumber } from './bidderAuditEngine';

/**
 * تصدير عطاء مجهز واحد إلى Excel بثلاث أوراق:
 * - «واقع الحال»: العطاء كما قدّمه المجهز بعيوبه، وكل عيب مؤشَّر ومشروح في فقرته. العيوب تُشتق من الأرقام
 *   الأصلية (المبلغ المدون، والمفرد المدون قبل أن يحل محله التفقيط)، فتبقى الفقرة التي صحّحتها اللجنة مؤشرة هنا.
 * - «أخطاء المجهز»: فقرات خطأ الضرب وتعارض التفقيط وحدها، بأرقام المجهز كما دوّنها، وعمود «قرار اللجنة» للتعبئة.
 * - «الجدول المعدل»: العطاء بعد تصحيحات اللجنة في النظام، بالانحراف والأسعار الموزونة، والتصحيح المعتمد لكل
 *   فقرة كما سُجّل في سجل التدقيق.
 * التنسيق كملف «مطابق للأصل»: خط Arial، ورؤوس بيضاء على أزرق داكن، وأرقام المجهز كما دوّنها بالأزرق والمحسوبة
 * بالأسود، والصفوف المؤشرة ملوّنة. تثبيت الأعمدة لا تكتبه المكتبة المجانية.
 */

// أزرار الاعتماد في BOQTable تسجّل هذه الإجراءات، وسند كل منها في ضوابط رقم (4) خامساً/ب
const ADOPTIONS: Record<string, string> = {
  'اعتماد تصحيح خطأ الضرب بقرار اللجنة':
    'اعتماد حاصل ضرب سعر المفرد في الكمية (ضوابط رقم (4) خامساً/ب/2)',
  'اعتماد سعر المفرد المكتوب كتابةً بقرار اللجنة':
    'اعتماد سعر المفرد المكتوب كتابةً (ضوابط رقم (4) خامساً/ب/1) والمبلغ حاصل ضربه في الكمية (خامساً/ب/2)',
  'اعتماد المبلغ المكتوب كتابةً بقرار اللجنة':
    'اعتماد مبلغ الفقرة المكتوب كتابةً (ضوابط رقم (4) خامساً/ب/1)',
  'اعتماد المبلغ وتصحيح سعر المفرد لخطأ فادح في العلامة العشرية':
    'اعتماد مبلغ الفقرة كما دوّنه المجهز وتصحيح سعر المفرد لخطأ فادح في العلامة العشرية (ضوابط رقم (4) خامساً/ب/2، الاستثناء)'
};
const MATH_ADOPTION = 'اعتماد تصحيح خطأ الضرب بقرار اللجنة';

const fmt = (v: number) => v.toLocaleString('en-US', { maximumFractionDigits: 2 });
const round2 = (v: number) => Math.round(v * 100) / 100;

// ألوان «مطابق للأصل» وتنسيق أرقامه، والأحمر لخطأ الضرب كما نصّت ملاحظته
const FONT = 'Arial';
const INPUT = 'FF0000FF';      // رقم كما دوّنه المجهز
const TEXT = 'FF000000';
const HEADER_FILL = 'FF1F4E78';
const NOTE_COLOR = 'FF555555';
const FILL = { math: 'FFF8D7DA', text: 'FFFFF3CD', muted: 'FFF2F2F2', done: 'FFE2EFDA' };
const THIN = { style: 'thin', color: { rgb: 'FF000000' } };
const BOX = { top: THIN, bottom: THIN, left: THIN, right: THIN };
const AMOUNT_FMT = '#,##0;\\(#,##0\\);\\-';
const AMOUNT_FMT_DEC = '#,##0.00;\\(#,##0.00\\);\\-';

type Cell = string | number | XLSX.CellObject | null | undefined;

const amount = (v: number, color = TEXT): XLSX.CellObject => {
  const numFmt = Number.isInteger(v) ? AMOUNT_FMT : AMOUNT_FMT_DEC;
  return { t: 'n', v, z: numFmt, s: { font: { name: FONT, sz: 10, color: { rgb: color } }, numFmt } };
};
const input = (v: number) => amount(v, INPUT);
const formula = (f: string, v: number): XLSX.CellObject => ({ ...amount(v), f });
const pct = (v: number): XLSX.CellObject => ({ t: 'n', v: v / 100, z: '0.00%', s: { numFmt: '0.00%' } });
const ratio = (v: number): XLSX.CellObject => ({ t: 'n', v, z: '0.0000', s: { numFmt: '0.0000' } });
const count = (v: number): XLSX.CellObject => ({ t: 'n', v });

// رقم الفقرة رقماً إن كان رقماً صرفاً (بلا فواصل آلاف)، وإلا نصاً كما هو («12 (مكرر)»)
const itemNoCell = (itemNo: number | string): Cell => {
  const n = Number(itemNo);
  return Number.isFinite(n) && String(n) === String(itemNo).trim() ? { t: 'n', v: n } : String(itemNo);
};

interface SheetLayout {
  widths: number[];
  dataFrom: number;                        // أول صف بيانات (من الصفر)، والرؤوس قبله مباشرة
  dataTo: number;
  fillOf?: (r: number) => string | undefined;
  center?: number[];                       // أعمدة تُوسَّط
  wrap?: number[];                         // أعمدة نص طويل يلتف
  filter?: boolean;
}

// العنوان (الصف 1) وسطرا التعريف والشرح (2 و3) مدمجة بعرض الجدول، ثم الرؤوس، ثم البيانات بحدود، ثم أسطر المجاميع
function buildSheet(rows: Cell[][], layout: SheetLayout): XLSX.WorkSheet {
  const { widths, dataFrom, dataTo } = layout;
  const lastCol = widths.length - 1;
  const header = dataFrom - 1;
  const ws: XLSX.WorkSheet = {};
  rows.forEach((row, r) => {
    const isData = r >= dataFrom && r <= dataTo;
    const span = isData || r === header ? widths.length : row.length;
    for (let c = 0; c < span; c++) {
      const val = row[c];
      const empty = val === null || val === undefined || val === '';
      if (empty && !isData && r !== header) continue;
      const cell: XLSX.CellObject = empty ? { t: 's', v: '' }
        : typeof val === 'object' ? { ...val }
        : typeof val === 'number' ? amount(val) : { t: 's', v: val };
      const own = cell.s || {};
      const font = { name: FONT, sz: 10, color: { rgb: TEXT }, ...(own.font || {}) };
      if (r === 0) {
        cell.s = { font: { name: FONT, sz: 14, bold: true }, alignment: { horizontal: 'center', vertical: 'center' } };
      } else if (r < header) {
        cell.s = { font: { name: FONT, sz: 9, color: { rgb: NOTE_COLOR } }, alignment: { horizontal: 'center', vertical: 'center', wrapText: true } };
      } else if (r === header) {
        cell.s = {
          font: { name: FONT, sz: 10, bold: true, color: { rgb: 'FFFFFFFF' } },
          fill: { patternType: 'solid', fgColor: { rgb: HEADER_FILL } },
          border: BOX, alignment: { horizontal: 'center', vertical: 'center', wrapText: true }
        };
      } else if (isData) {
        const fill = layout.fillOf?.(r);
        cell.s = {
          ...own, font, border: BOX,
          ...(fill ? { fill: { patternType: 'solid', fgColor: { rgb: fill } } } : {}),
          alignment: {
            horizontal: layout.center?.includes(c) ? 'center' : 'right', vertical: 'center',
            wrapText: !!layout.wrap?.includes(c)
          }
        };
      } else {
        // أسطر المجاميع: العنوان بخط عريض، والقيمة الرقمية بخط عريض داخل إطار
        const numeric = cell.t === 'n';
        cell.s = { ...own, font: { ...font, bold: true }, ...(numeric ? { border: BOX } : {}) };
      }
      ws[XLSX.utils.encode_cell({ r, c })] = cell;
    }
  });
  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length - 1, c: lastCol } });
  ws['!cols'] = widths.map(wch => ({ wch }));
  ws['!merges'] = [0, 1, 2].filter(r => r < header).map(r => ({ s: { r, c: 0 }, e: { r, c: lastCol } }));
  ws['!rows'] = [{ hpt: 22 }, { hpt: 18 }, { hpt: 30 }];
  ws['!rows'][header] = { hpt: 32 };
  if (layout.filter && dataTo >= dataFrom) {
    ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: header, c: 0 }, e: { r: dataTo, c: lastCol } }) };
  }
  return ws;
}

// آخر اعتماد للجنة على الفقرة (السجل من الأحدث): يطابق المجهز ورقم الفقرة والمبلغ الذي انتهى إليه. سجلات ما
// قبل 1.12.0 بلا مجهز تُطابق بالرقم والمبلغ وحدهما، وإلا التبس تصحيح مجهزين انتهيا إلى المبلغ نفسه
const findAdoption = (item: BOQItem, bidderId: string, logs: AuditLogEntry[]) =>
  logs.find(l => ADOPTIONS[l.action] && (!l.bidderId || l.bidderId === bidderId)
    && String(l.itemNo) === String(item.itemNo) && Math.abs(Number(l.newValue) - item.bidderTotal) < 0.01);

interface RowAnalysis {
  item: BOQItem;
  corrected: boolean;
  adoption?: AuditLogEntry;
  stated: number;            // مبلغ الفقرة كما دوّنه المجهز
  unit: number;              // سعر المفرد كما دوّنه المجهز رقماً
  unitLost: boolean;         // اعتُمد التفقيط سعراً للمفرد قبل أن يحفظ النظام الرقم الأصلي
  defects: string[];
  explanation: string[];
  pending: string[];         // علامات قائمة في النظام لم تحسمها اللجنة
}

function analyseRow(item: BOQItem, bidderId: string, logs: AuditLogEntry[]): RowAnalysis {
  const corrected = isCommitteeCorrected(item);
  const adoption = corrected ? findAdoption(item, bidderId, logs) : undefined;
  const written = item.writtenText ? parseArabicTextToNumber(item.writtenText) : null;
  const stated = item.enteredBidderTotal || item.bidderTotal;
  // اعتماد التفقيط سعراً للمفرد كان يكتب فوق المفرد المدون: إن لم يُحفظ الأصل فالمفرد الحالي هو التفقيط نفسه
  const unitLost = corrected && item.originalUnitPrice === undefined && !!adoption
    && adoption.action !== MATH_ADOPTION && written !== null && Math.abs((item.enteredUnitPrice || 0) - written) < 0.01;
  const unit = item.originalUnitPrice ?? item.enteredUnitPrice ?? 0;
  const qty = item.quantity;

  const defects: string[] = [];
  const explanation: string[] = [];
  if (item.unpriced) {
    defects.push('غير مسعّرة');
    explanation.push('لم يسعّر المجهز هذه الفقرة («-» في العطاء)');
  } else if (!(stated > 0)) {
    defects.push('بلا سعر');
    explanation.push('لا مبلغ لهذه الفقرة في الجدول');
  } else if (unitLost) {
    defects.push('تعارض تفقيط');
    explanation.push(`اعتمدت اللجنة التفقيط «${item.writtenText}» سعراً للمفرد قبل أن يحفظ النظام سعر المفرد المدون رقماً؛ يُرجع إليه في العطاء الأصلي`);
  } else {
    const flags = auditRowAmounts(qty, unit, stated, item.writtenText);
    if (flags.hasMathError) {
      defects.push('خطأ ضرب');
      explanation.push(`المبلغ المدون ${fmt(stated)} لا يساوي الكمية × المفرد (${fmt(qty)} × ${fmt(unit)} = ${fmt(qty * unit)})`);
    }
    if (flags.hasTextDiscrepancy && written !== null) {
      defects.push('تعارض تفقيط');
      explanation.push(unit > 0 && qty !== 1
        ? `التفقيط «${item.writtenText}» (${fmt(written)}) لا يساوي سعر المفرد المدون ${fmt(unit)} ولا مبلغ الفقرة ${fmt(stated)}`
        : `التفقيط «${item.writtenText}» (${fmt(written)}) لا يساوي المبلغ المدون ${fmt(stated)}`);
    }
  }

  const pending = [
    ...(item.hasMathError ? ['خطأ ضرب'] : []),
    ...(item.hasTextDiscrepancy ? ['تعارض تفقيط'] : [])
  ];
  return { item, corrected, adoption, stated, unit, unitLost, defects, explanation, pending };
}

const isError = (r: RowAnalysis) => r.defects.includes('خطأ ضرب') || r.defects.includes('تعارض تفقيط');
// لون صف في «واقع الحال» و«أخطاء المجهز»: الأحمر لخطأ الضرب، والكهرماني لتعارض التفقيط، والرمادي لغير المسعّرة
const defectFill = (r: RowAnalysis) => r.defects.includes('خطأ ضرب') ? FILL.math
  : r.defects.includes('تعارض تفقيط') ? FILL.text : r.defects.length > 0 ? FILL.muted : undefined;
const LEGEND = 'الصفوف الحمراء: خطأ ضرب، والكهرمانية: تعارض تفقيط، والرمادية: غير مسعّرة أو بلا سعر. أرقام المجهز كما دوّنها بالأزرق، والمحسوبة بالأسود.';

const projectLine = (project: TenderProject) =>
  `المناقصة: ${project.title}`
  + (project.referenceNumber ? ` — رقم المناقصة: ${project.referenceNumber}` : '')
  + (project.entityName ? ` — الجهة: ${project.entityName}` : '')
  + ` — تاريخ التصدير: ${new Date().toLocaleDateString('ar-EG')}`;

const HEADER_ROWS = 4; // عنوان، مناقصة، شرح، سطر فارغ، ثم رؤوس الأعمدة
const FIRST = HEADER_ROWS + 2; // أول صف بيانات بترقيم Excel
const AS_IS_SHEET = 'واقع الحال';

function buildAsIsSheet(project: TenderProject, bidder: Bidder, rows: RowAnalysis[]): XLSX.WorkSheet {
  const last = FIRST + rows.length - 1;

  const data: Cell[][] = rows.map((row, i) => {
    const n = FIRST + i;
    const { item, stated, unit, unitLost } = row;
    const hasUnit = unit > 0 && !unitLost;
    const product = item.quantity * unit;
    return [
      itemNoCell(item.itemNo),
      item.description,
      item.unit,
      input(item.quantity),
      unitLost ? 'غير محفوظ' : hasUnit ? input(unit) : '',
      item.writtenText || '',
      stated > 0 ? input(stated) : item.unpriced ? '-' : '',
      hasUnit && stated > 0 ? formula(`D${n}*E${n}`, product) : '',
      hasUnit && stated > 0 ? formula(`G${n}-H${n}`, stated - product) : '',
      row.defects.join(' + '),
      row.explanation.join('؛ ')
    ];
  });

  const counted = (label: string) => rows.filter(r => r.defects.includes(label)).length;
  const withDefects = rows.filter(r => r.defects.length > 0).length;
  const breakdown = [['خطأ ضرب', counted('خطأ ضرب')], ['تعارض تفقيط', counted('تعارض تفقيط')],
    ['غير مسعّرة', counted('غير مسعّرة')], ['بلا سعر', counted('بلا سعر')]]
    .filter(([, c]) => (c as number) > 0).map(([l, c]) => `${l}: ${c}`).join('، ');

  const sumRow = last + 2;
  const statedRow = sumRow + 1;
  const sumEntered = rows.reduce((s, r) => s + (r.stated > 0 ? r.stated : 0), 0);
  const statedTotal = bidder.statedTotal && bidder.statedTotal > 0 ? bidder.statedTotal : undefined;
  const footer: Cell[][] = [
    [],
    ['مجموع مبالغ الفقرات كما دُوّنت', '', '', '', '', '', formula(`SUM(G${FIRST}:G${last})`, sumEntered)],
    ['المبلغ الإجمالي المدون في العطاء', '', '', '', '', '', statedTotal ? input(statedTotal) : 'غير مسجل في النظام'],
    ...(statedTotal ? [['الفرق (المدون في العطاء − مجموع الفقرات)', '', '', '', '', '',
      formula(`G${statedRow}-G${sumRow}`, statedTotal - sumEntered)] as Cell[]] : []),
    ['الفقرات ذات الملاحظات', '', '', '', '', '', count(withDefects), breakdown]
  ];

  return buildSheet([
    [`عرض المجهز كما ورد في عطائه (واقع الحال): ${bidder.name}`],
    [projectLine(project)],
    ['الكمية من جدول الكميات، وسعر المفرد والتفقيط والمبلغ كما دوّنها المجهز قبل أي تصحيح. الملاحظات مشتقة من هذه الأرقام نفسها، والتصحيح الحسابي قرار اللجنة (ضوابط رقم (4) خامساً/ب). ' + LEGEND],
    [],
    ['ت', 'وصف الفقرة', 'الوحدة', 'الكمية', 'سعر المفرد رقماً', 'التفقيط (كتابةً)', 'مبلغ الفقرة كما دوّنه المجهز',
      'الكمية × المفرد', 'الفرق (المدون − الحاصل)', 'الملاحظة', 'الشرح'],
    ...data,
    ...footer
  ], {
    widths: [6, 34, 9, 11, 12, 28, 17, 17, 15, 18, 60],
    dataFrom: HEADER_ROWS + 1, dataTo: HEADER_ROWS + rows.length,
    fillOf: r => defectFill(rows[r - HEADER_ROWS - 1]),
    center: [0, 2, 9], wrap: [1, 5, 9, 10], filter: true
  });
}

// أخطاء المجهز وحدها (خطأ ضرب أو تعارض تفقيط) بأرقامه كما دوّنها، بأعمدة ورقة «أخطاء المجهز للجنة» في ملف
// «مطابق للأصل» وعمود «قرار اللجنة» للتعبئة. فرق الإجمالي المكتوب عن مجموع مبالغ الفقرات كما دوّنها المجهز خطأ
// جمع منه، فيُحسب من ورقة «واقع الحال» نفسها
function buildErrorsSheet(project: TenderProject, bidder: Bidder, rows: RowAnalysis[]): XLSX.WorkSheet {
  const errors = rows.filter(isError);
  const last = FIRST + Math.max(errors.length, 1) - 1;
  const data: Cell[][] = errors.length > 0
    ? errors.map((row, i) => {
      const n = FIRST + i;
      const { item, stated, unit, unitLost } = row;
      const hasUnit = unit > 0 && !unitLost;
      const product = item.quantity * unit;
      return [
        itemNoCell(item.itemNo),
        item.description,
        input(item.quantity),
        unitLost ? 'غير محفوظ' : hasUnit ? input(unit) : '',
        item.writtenText || '',
        input(stated),
        hasUnit ? formula(`C${n}*D${n}`, product) : '',
        hasUnit ? formula(`F${n}-G${n}`, stated - product) : '',
        row.defects.join(' + '),
        row.explanation.join('؛ '),
        ''
      ];
    })
    : [['لا خطأ ضرب ولا تعارض تفقيط في هذا العطاء']];

  const counted = (label: string) => errors.filter(r => r.defects.includes(label)).length;
  const notErrors = rows.filter(r => r.defects.length > 0 && !isError(r)).length;
  const asIsLast = FIRST + rows.length - 1;
  const sumEntered = rows.reduce((s, r) => s + (r.stated > 0 ? r.stated : 0), 0);
  const statedTotal = bidder.statedTotal && bidder.statedTotal > 0 ? bidder.statedTotal : undefined;
  const statedRow = last + 3 + (notErrors > 0 ? 1 : 0);
  const sumRow = statedRow + 1;
  const footer: Cell[][] = [
    [],
    ['عدد الفقرات الخاطئة', '', '', '', '', count(errors.length), `خطأ ضرب: ${counted('خطأ ضرب')}، تعارض تفقيط: ${counted('تعارض تفقيط')}`],
    ...(notErrors > 0 ? [['غير مسعّرة أو بلا سعر (ليست أخطاءً، وتُراجع في «واقع الحال»)', '', '', '', '', count(notErrors)] as Cell[]] : []),
    ...(statedTotal ? [
      ['الإجمالي المكتوب في العطاء', '', '', '', '', input(statedTotal)],
      ['مجموع مبالغ الفقرات كما دوّنها المجهز', '', '', '', '', formula(`SUM('${AS_IS_SHEET}'!G${FIRST}:G${asIsLast})`, sumEntered)],
      ['الفرق (خطأ جمع من المجهز إن لم يكن صفراً)', '', '', '', '', formula(`F${statedRow}-F${sumRow}`, statedTotal - sumEntered)]
    ] as Cell[][] : [['الإجمالي المكتوب في العطاء', '', '', '', '', 'غير مسجل في النظام']])
  ];

  return buildSheet([
    [`ملاحظات على عطاء المجهز تحتاج قرار اللجنة: ${bidder.name}`],
    [projectLine(project)],
    ['الفقرات التي فيها خطأ ضرب أو تعارض تفقيط، بأرقام المجهز كما دوّنها قبل أي تصحيح. التصحيح الحسابي قرار اللجنة ويُبلَّغ به المجهز (ضوابط رقم (4) خامساً/ب). عمود «قرار اللجنة» للتعبئة. الصفوف الحمراء: خطأ ضرب، والكهرمانية: تعارض تفقيط.'],
    [],
    ['ت', 'وصف الفقرة', 'الكمية', 'المفرد رقماً', 'التفقيط (كتابةً)', 'المبلغ المدون', 'الكمية × المفرد', 'الفرق',
      'نوع الملاحظة', 'التفصيل', 'قرار اللجنة'],
    ...data,
    ...footer
  ], {
    widths: [6, 26, 10, 11, 24, 14, 15, 14, 12, 52, 22],
    dataFrom: HEADER_ROWS + 1, dataTo: HEADER_ROWS + data.length,
    fillOf: r => errors.length > 0 ? defectFill(errors[r - HEADER_ROWS - 1]) : undefined,
    center: [0, 8], wrap: [1, 4, 8, 9, 10], filter: errors.length > 0
  });
}

// التصحيح المعتمد للفقرة كما يظهر في الجدول المعدل
function correctionText(row: RowAnalysis): string {
  const { item, corrected, adoption, stated } = row;
  const parts: string[] = [];
  if (corrected) {
    const changes: string[] = [];
    if (Math.abs(item.bidderTotal - stated) > 0.01) changes.push(`المبلغ من ${fmt(stated)} إلى ${fmt(item.bidderTotal)}`);
    if (item.originalUnitPrice !== undefined) changes.push(`المفرد من ${fmt(item.originalUnitPrice)} إلى ${fmt(item.enteredUnitPrice || 0)}`);
    const rule = adoption ? ADOPTIONS[adoption.action] : 'تصحيح حسابي بقرار اللجنة';
    parts.push(changes.length ? `${rule}: ${changes.join('، و')}` : rule);
  }
  if (row.pending.length) parts.push(`بانتظار قرار اللجنة: ${row.pending.join(' + ')}`);
  if (item.unpriced) parts.push('غير مسعّرة في العطاء');
  return parts.join('؛ ');
}

function buildAdjustedSheet(project: TenderProject, bidder: Bidder, rows: RowAnalysis[]): XLSX.WorkSheet {
  const last = FIRST + rows.length - 1;
  const t = bidder.totals;
  const hasEstimate = t.totalEstimatedAmount > 0;
  const pendingCount = rows.filter(r => r.pending.length > 0).length;
  // بلا كلفة تخمينية لا معنى للانحراف والأسعار الموزونة، فتبقى خاناتها فارغة
  const est = (cell: Cell): Cell => hasEstimate ? cell : '';

  const data: Cell[][] = rows.map(row => {
    const { item, corrected } = row;
    // مفرد التصحيح: المبلغ المعتمد ÷ الكمية (اعتماد التفقيط مبلغاً للفقرة يغيّر المفرد ضمناً)
    const unitAfter = corrected && item.quantity > 0 ? round2(item.bidderTotal / item.quantity) : item.bidderUnitPrice;
    return [
      itemNoCell(item.itemNo),
      item.description,
      item.unit,
      amount(item.quantity),
      est(amount(item.estimatedUnitPrice)),
      est(amount(item.estimatedTotal)),
      unitAfter > 0 ? amount(unitAfter) : '',
      item.bidderTotal > 0 ? amount(item.bidderTotal) : item.unpriced ? '-' : '',
      est(amount(item.diffAmount)),
      est(item.estimatedTotal > 0 ? pct(item.deviationPercent) : ''),
      est(amount(item.deviatedAmount)),
      est(ratio(item.priceRatio)),
      est(amount(item.newPrice)),
      est(amount(round2(item.weightedUnitPrice))),
      correctionText(row)
    ];
  });

  const sumRow = last + 2;
  const sum = (col: string, v: number) => formula(`SUM(${col}${FIRST}:${col}${last})`, v);
  const sumEntered = rows.reduce((s, r) => s + (r.stated > 0 ? r.stated : 0), 0);
  const statedTotal = bidder.statedTotal && bidder.statedTotal > 0 ? bidder.statedTotal : undefined;
  const line = (label: string, value: Cell): Cell[] => [label, '', '', '', '', '', '', value];

  const footer: Cell[][] = [
    [],
    ['المجموع', '', '', '', '', est(sum('F', t.totalEstimatedAmount)), '', sum('H', t.totalBidderAmount),
      est(sum('I', t.overallDiffAmount)), '', est(sum('K', t.deviatedItemsSum)), '',
      est(sum('M', t.newPricesTotal))],
    [],
    line('مبلغ العطاء بعد التصحيح الحسابي (أساس التسلسل — خامساً/ب/6)', formula(`H${sumRow}`, t.totalBidderAmount)),
    line('مجموع مبالغ الفقرات كما دوّنها المجهز', amount(sumEntered)),
    line('المبلغ الإجمالي المدون في العطاء (قبل التصحيح)', statedTotal ? input(statedTotal) : 'غير مسجل في النظام'),
    ...(hasEstimate ? [
      line('الكلفة التخمينية', amount(t.totalEstimatedAmount)),
      line('الانحراف الكلي', pct(t.totalDeviationPercent)),
      line('الانحراف الجزئي', pct(t.partialDeviationPercent)),
      line('النسبة السعرية', ratio(t.overallPriceRatio)),
      line(`عدد الفقرات المنحرفة (أكثر من ${project.deviationThreshold}%)`, count(t.deviatedItemsCount))
    ] : [])
  ];

  const note = 'مبالغ المجهز بعد تصحيحات اللجنة (ضوابط رقم (4) خامساً/ب)، وعليها يُحسب الانحراف والأسعار الموزونة.'
    + (pendingCount > 0 ? ` تنبيه: (${pendingCount}) فقرة مؤشرة لم تحسمها اللجنة بعد، ومبالغها كما دوّنها المجهز.` : '')
    + (hasEstimate ? '' : ' لا كلفة تخمينية بعد، فأعمدة الانحراف والأسعار الموزونة فارغة.')
    + ' الصفوف الخضراء: صحّحتها اللجنة، والكهرمانية: بانتظار قرار اللجنة.';

  return buildSheet([
    [`الجدول المعدل بعد التصحيح الحسابي: ${bidder.name}`],
    [projectLine(project)],
    [note],
    [],
    ['ت', 'وصف الفقرة', 'الوحدة', 'الكمية', 'المفرد التخميني', 'المبلغ التخميني', 'مفرد المجهز', 'مبلغ المجهز',
      'فرق المبلغ', 'نسبة الانحراف', 'الفقرة المنحرفة', 'النسبة السعرية', 'السعر الجديد (للمجهز)', 'المفرد المجهز الموزون',
      'التصحيح المعتمد'],
    ...data,
    ...footer
  ], {
    widths: [6, 34, 9, 11, 13, 16, 13, 16, 15, 11, 15, 11, 17, 15, 60],
    dataFrom: HEADER_ROWS + 1, dataTo: HEADER_ROWS + rows.length,
    fillOf: r => {
      const row = rows[r - HEADER_ROWS - 1];
      return row.pending.length > 0 ? FILL.text : row.corrected ? FILL.done : undefined;
    },
    center: [0, 2], wrap: [1, 14], filter: true
  });
}

export function exportBidderAuditToExcel(project: TenderProject, bidder: Bidder) {
  const logs = project.auditLogs || [];
  const rows = bidder.items.map(item => analyseRow(item, bidder.id, logs));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, buildAsIsSheet(project, bidder, rows), AS_IS_SHEET);
  XLSX.utils.book_append_sheet(wb, buildErrorsSheet(project, bidder, rows), 'أخطاء المجهز');
  XLSX.utils.book_append_sheet(wb, buildAdjustedSheet(project, bidder, rows), 'الجدول المعدل');
  wb.Workbook = { Views: [{ RTL: true }] };

  const safe = (s: string) => s.replace(/[\\/:*?"<>|]/g, ' ').trim();
  XLSX.writeFile(wb, `${safe(`جدول عطاء ${bidder.name} - ${project.title || 'تحليل العطاءات'}`)}.xlsx`);
}

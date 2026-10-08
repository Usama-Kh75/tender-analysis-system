import * as XLSX from 'xlsx';
import { AuditLogEntry, BOQItem, Bidder, TenderProject } from '../types/tender';
import { auditRowAmounts, isCommitteeCorrected, parseArabicTextToNumber } from './bidderAuditEngine';

/**
 * تصدير عطاء مجهز واحد إلى Excel بورقتين:
 * - «واقع الحال»: العطاء كما قدّمه المجهز بعيوبه، وكل عيب مؤشَّر ومشروح في فقرته. العيوب تُشتق من الأرقام
 *   الأصلية (المبلغ المدون، والمفرد المدون قبل أن يحل محله التفقيط)، فتبقى الفقرة التي صحّحتها اللجنة مؤشرة هنا.
 * - «الجدول المعدل»: العطاء بعد تصحيحات اللجنة في النظام، بالانحراف والأسعار الموزونة، والتصحيح المعتمد لكل
 *   فقرة كما سُجّل في سجل التدقيق.
 * مكتبة xlsx المجانية لا تلوّن الخلايا، فالملاحظة تُكتب نصاً وتُفرز بالفلتر.
 */

// أزرار الاعتماد في BOQTable تسجّل هذه الإجراءات، وسند كل منها في ضوابط رقم (4) خامساً/ب
const ADOPTIONS: Record<string, string> = {
  'اعتماد تصحيح خطأ الضرب بقرار اللجنة':
    'اعتماد حاصل ضرب سعر المفرد في الكمية (ضوابط رقم (4) خامساً/ب/2)',
  'اعتماد سعر المفرد المكتوب كتابةً بقرار اللجنة':
    'اعتماد سعر المفرد المكتوب كتابةً (ضوابط رقم (4) خامساً/ب/1) والمبلغ حاصل ضربه في الكمية (خامساً/ب/2)',
  'اعتماد المبلغ المكتوب كتابةً بقرار اللجنة':
    'اعتماد مبلغ الفقرة المكتوب كتابةً (ضوابط رقم (4) خامساً/ب/1)'
};
const MATH_ADOPTION = 'اعتماد تصحيح خطأ الضرب بقرار اللجنة';

const fmt = (v: number) => v.toLocaleString('en-US', { maximumFractionDigits: 2 });
const round2 = (v: number) => Math.round(v * 100) / 100;

type Cell = string | number | XLSX.CellObject | null | undefined;

const amount = (v: number): XLSX.CellObject => ({ t: 'n', v, z: Number.isInteger(v) ? '#,##0' : '#,##0.00' });
const formula = (f: string, v: number): XLSX.CellObject => ({ ...amount(v), f });

// رقم الفقرة رقماً إن كان رقماً صرفاً (بلا فواصل آلاف)، وإلا نصاً كما هو («12 (مكرر)»)
const itemNoCell = (itemNo: number | string): Cell => {
  const n = Number(itemNo);
  return Number.isFinite(n) && String(n) === String(itemNo).trim() ? { t: 'n', v: n } : String(itemNo);
};

function buildSheet(rows: Cell[][], widths: number[], filterRange?: string): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {};
  rows.forEach((row, r) => row.forEach((val, c) => {
    if (val === null || val === undefined || val === '') return;
    ws[XLSX.utils.encode_cell({ r, c })] = typeof val === 'object' ? val
      : typeof val === 'number' ? amount(val) : { t: 's', v: val };
  }));
  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length - 1, c: widths.length - 1 } });
  ws['!cols'] = widths.map(wch => ({ wch }));
  if (filterRange) ws['!autofilter'] = { ref: filterRange };
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

const projectLine = (project: TenderProject) =>
  `المناقصة: ${project.title}`
  + (project.referenceNumber ? ` — رقم المناقصة: ${project.referenceNumber}` : '')
  + (project.entityName ? ` — الجهة: ${project.entityName}` : '')
  + ` — تاريخ التصدير: ${new Date().toLocaleDateString('ar-EG')}`;

const HEADER_ROWS = 4; // عنوان، مناقصة، شرح، سطر فارغ، ثم رؤوس الأعمدة

function buildAsIsSheet(project: TenderProject, bidder: Bidder, rows: RowAnalysis[]): XLSX.WorkSheet {
  const first = HEADER_ROWS + 2; // أول صف بيانات بترقيم Excel
  const last = first + rows.length - 1;

  const data: Cell[][] = rows.map((row, i) => {
    const n = first + i;
    const { item, stated, unit, unitLost } = row;
    const hasUnit = unit > 0 && !unitLost;
    const product = item.quantity * unit;
    return [
      itemNoCell(item.itemNo),
      item.description,
      item.unit,
      amount(item.quantity),
      unitLost ? 'غير محفوظ' : hasUnit ? amount(unit) : '',
      item.writtenText || '',
      stated > 0 ? amount(stated) : item.unpriced ? '-' : '',
      hasUnit && stated > 0 ? formula(`D${n}*E${n}`, product) : '',
      hasUnit && stated > 0 ? formula(`G${n}-H${n}`, stated - product) : '',
      row.defects.join(' + '),
      row.explanation.join('؛ ')
    ];
  });

  const count = (label: string) => rows.filter(r => r.defects.includes(label)).length;
  const withDefects = rows.filter(r => r.defects.length > 0).length;
  const breakdown = [['خطأ ضرب', count('خطأ ضرب')], ['تعارض تفقيط', count('تعارض تفقيط')],
    ['غير مسعّرة', count('غير مسعّرة')], ['بلا سعر', count('بلا سعر')]]
    .filter(([, c]) => (c as number) > 0).map(([l, c]) => `${l}: ${c}`).join('، ');

  const sumRow = last + 2;
  const statedRow = sumRow + 1;
  const sumEntered = rows.reduce((s, r) => s + (r.stated > 0 ? r.stated : 0), 0);
  const statedTotal = bidder.statedTotal && bidder.statedTotal > 0 ? bidder.statedTotal : undefined;
  const footer: Cell[][] = [
    [],
    ['مجموع مبالغ الفقرات كما دُوّنت', '', '', '', '', '', formula(`SUM(G${first}:G${last})`, sumEntered)],
    ['المبلغ الإجمالي المدون في العطاء', '', '', '', '', '', statedTotal ? amount(statedTotal) : 'غير مسجل في النظام'],
    ...(statedTotal ? [['الفرق (المدون في العطاء − مجموع الفقرات)', '', '', '', '', '',
      formula(`G${statedRow}-G${sumRow}`, statedTotal - sumEntered)] as Cell[]] : []),
    ['الفقرات ذات الملاحظات', '', '', '', '', '', { t: 'n', v: withDefects }, breakdown]
  ];

  return buildSheet([
    [`جدول عطاء المجهز كما قدّمه (واقع الحال): ${bidder.name}`],
    [projectLine(project)],
    ['الكمية من جدول الكميات، وسعر المفرد والتفقيط والمبلغ كما دوّنها المجهز قبل أي تصحيح. الملاحظات مشتقة من هذه الأرقام نفسها، والتصحيح الحسابي قرار اللجنة (ضوابط رقم (4) خامساً/ب).'],
    [],
    ['ت', 'وصف الفقرة', 'الوحدة', 'الكمية', 'سعر المفرد رقماً', 'التفقيط (كتابةً)', 'مبلغ الفقرة كما دوّنه',
      'الكمية × المفرد', 'الفرق (المدون − الحاصل)', 'الملاحظة', 'الشرح'],
    ...data,
    ...footer
  ], [6, 40, 10, 12, 14, 28, 18, 18, 16, 20, 70], `A${first - 1}:K${last}`);
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
  const first = HEADER_ROWS + 2;
  const last = first + rows.length - 1;
  const t = bidder.totals;
  const hasEstimate = t.totalEstimatedAmount > 0;
  const pendingCount = rows.filter(r => r.pending.length > 0).length;
  const pct = (v: number): XLSX.CellObject => ({ t: 'n', v: v / 100, z: '0.00%' });
  const ratio = (v: number): XLSX.CellObject => ({ t: 'n', v, z: '0.0000' });
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
  const sum = (col: string, v: number) => formula(`SUM(${col}${first}:${col}${last})`, v);
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
    line('المبلغ الإجمالي المدون في العطاء (قبل التصحيح)', statedTotal ? amount(statedTotal) : 'غير مسجل في النظام'),
    ...(hasEstimate ? [
      line('الكلفة التخمينية', amount(t.totalEstimatedAmount)),
      line('الانحراف الكلي', pct(t.totalDeviationPercent)),
      line('الانحراف الجزئي', pct(t.partialDeviationPercent)),
      line('النسبة السعرية', ratio(t.overallPriceRatio)),
      line(`عدد الفقرات المنحرفة (أكثر من ${project.deviationThreshold}%)`, { t: 'n', v: t.deviatedItemsCount })
    ] : [])
  ];

  const note = 'مبالغ المجهز بعد تصحيحات اللجنة (ضوابط رقم (4) خامساً/ب)، وعليها يُحسب الانحراف والأسعار الموزونة.'
    + (pendingCount > 0 ? ` تنبيه: (${pendingCount}) فقرة مؤشرة لم تحسمها اللجنة بعد، ومبالغها كما دوّنها المجهز.` : '')
    + (hasEstimate ? '' : ' لا كلفة تخمينية بعد، فأعمدة الانحراف والأسعار الموزونة فارغة.');

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
  ], [6, 40, 10, 12, 14, 18, 14, 18, 16, 12, 16, 12, 18, 16, 70], `A${first - 1}:O${last}`);
}

export function exportBidderAuditToExcel(project: TenderProject, bidder: Bidder) {
  const logs = project.auditLogs || [];
  const rows = bidder.items.map(item => analyseRow(item, bidder.id, logs));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, buildAsIsSheet(project, bidder, rows), 'واقع الحال');
  XLSX.utils.book_append_sheet(wb, buildAdjustedSheet(project, bidder, rows), 'الجدول المعدل');
  wb.Workbook = { Views: [{ RTL: true }] };

  const safe = (s: string) => s.replace(/[\\/:*?"<>|]/g, ' ').trim();
  XLSX.writeFile(wb, `${safe(`جدول عطاء ${bidder.name} - ${project.title || 'تحليل العطاءات'}`)}.xlsx`);
}

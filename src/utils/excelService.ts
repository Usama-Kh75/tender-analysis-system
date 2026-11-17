import * as XLSX from 'xlsx-js-style'; // SheetJS 0.18.5 نفسها، ومعها كتابة التنسيق (bidderAuditExcel)
import { BOQItem, TenderProject, Bidder } from '../types/tender';
import { hasBidAmounts, exclusionThresholdOf } from './recommendation';
import { percentDecimals } from './calculations';
import { tenderDetailParts } from './tenderDetails';
import { buildOfferApprovalSheet, offerSheetTarget, buildSheet, amount, unitCell, markRtl, type Cell } from './bidderAuditExcel';

// أسماء أوراق Excel محدودة بـ 31 محرفاً ولا تقبل الرموز \ / ? * [ ]
function sanitizeSheetName(name: string, usedNames: Set<string>): string {
  let clean = name.replace(/[\\/?*[\]:]/g, ' ').trim().substring(0, 28) || 'مجهز';
  let finalName = clean;
  let suffix = 2;
  while (usedNames.has(finalName)) {
    finalName = `${clean} (${suffix})`.substring(0, 31);
    suffix++;
  }
  usedNames.add(finalName);
  return finalName;
}

function buildBidderDetailSheet(project: TenderProject, bidder: Bidder, isActive: boolean) {
  const headers = [
    'ت',
    'وصف الفقرة',
    'الوحدة',
    'الكمية',
    'المفرد التخميني',
    'المبلغ التخميني',
    'مفرد المجهز',
    'مبلغ المجهز',
    'فرق المبلغ',
    'نسبة الانحراف %',
    'الفقرة المنحرفة',
    'النسبة السعرية',
    'السعر الجديد (للمجهز)',
    'المفرد المجهز الموزون',
    'ملاحظات'
  ];

  // القيم كما كانت تماماً (النسب نص)، والتنسيق وحده جديد: الأرقام بفواصل آلاف بلا E+، والمفردات والكميات بحتى أربع منازل عرضاً فقط، والقيمة المخزّنة كما هي بلا تقريب (مراجعة Codex)
  const num = (v: number | undefined, unit = false): Cell => (v === undefined || !Number.isFinite(v)) ? v : unit ? { ...unitCell(v), v } : amount(v);
  const rows: Cell[][] = bidder.items.map(item => [
    typeof item.itemNo === 'number' ? { t: 'n' as const, v: item.itemNo, z: Number.isInteger(item.itemNo) ? '0' : 'General' } : item.itemNo,
    item.description,
    item.unit,
    num(item.quantity, true),
    num(item.estimatedUnitPrice, true),
    num(item.estimatedTotal),
    num(item.bidderUnitPrice, true),
    num(item.bidderTotal),
    num(item.diffAmount),
    `${item.deviationPercent.toFixed(2)}%`,
    num(item.deviatedAmount),
    item.priceRatio.toFixed(4),
    num(item.newPrice),
    num(Number(item.weightedUnitPrice.toFixed(2))),
    item.notes || ''
  ]);
  const dataTo = 3 + rows.length;

  rows.push([]);
  // المسمّيات تلتف داخل عمود ت الضيق، ومؤشرات الانحراف تلتف في أعمدتها
  const label = (v: string): Cell => ({ t: 's', v, s: { alignment: { horizontal: 'center', vertical: 'center', wrapText: true } } });
  rows.push([
    label('المجموع الإجمالي'),
    '',
    '',
    '',
    '',
    num(bidder.totals.totalEstimatedAmount),
    '',
    num(bidder.totals.totalBidderAmount),
    num(bidder.totals.overallDiffAmount),
    '',
    num(bidder.totals.deviatedItemsSum),
    '',
    num(bidder.totals.newPricesTotal),
    '',
    ''
  ]);

  rows.push([
    label('مؤشرات الانحراف'),
    label(`الانحراف الكلي: ${bidder.totals.totalDeviationPercent.toFixed(percentDecimals(bidder.totals.totalDeviationPercent, exclusionThresholdOf(project)))}%`),
    label(`الانحراف الجزئي: ${bidder.totals.partialDeviationPercent.toFixed(2)}%`),
    label(`النسبة السعرية: ${bidder.totals.overallPriceRatio.toFixed(4)}`),
    label(`عدد الفقرات المنحرفة: ${bidder.totals.deviatedItemsCount}`),
    '', '', '', '', '', '', '', '', '', ''
  ]);

  const ws = buildSheet([
    [`مشروع: ${project.title} - رقم الطلبية/المناقصة: ${project.referenceNumber}${tenderDetailParts(project).map(part => ` — ${part}`).join('')}`],
    [`المجهز: ${bidder.name}${isActive ? ' (النشط حالياً)' : ''} - تاريخ التحليل: ${new Date().toLocaleDateString('ar-EG')}`],
    [],
    headers,
    ...rows
  ], {
    widths: [10, 42, 14, 14, 16, 17, 16, 17, 16, 13, 16, 12, 18, 16, 32],
    dataFrom: 4, dataTo,
    center: [0, 2, 9, 11, 13], wrap: [1, 14], vertical: 'top'
  });
  ws['!rows'] = [{ hpt: 22 }, { hpt: 18 }, { hpt: 6 }, { hpt: 32 }];
  return ws;
}

export const WEIGHTED_SHEET = 'الجدول الموزون';

// مصنف «تصدير Excel» من الخلاصة. «الجدول الموزون» أولى الأوراق، للمجهز الموصى بترسيته بعرض موزون غير موقوف؛
// وإن لم يوجد بقي المصنف كما كان
export function buildTenderWorkbook(project: TenderProject, activeBidder: Bidder): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const usedSheetNames = new Set<string>();

  const target = offerSheetTarget(project).bidder;
  const weightedSheet = target ? buildOfferApprovalSheet(project, target) : null;
  if (weightedSheet) {
    usedSheetNames.add(WEIGHTED_SHEET);
    XLSX.utils.book_append_sheet(wb, weightedSheet, WEIGHTED_SHEET);
  }

  // ورقة تفصيلية كاملة لكل مجهز على حدة (المجهز النشط أولاً)
  const orderedBidders = [activeBidder, ...project.bidders.filter(b => b.id !== activeBidder.id)];
  orderedBidders.forEach(bidder => {
    const sheetName = sanitizeSheetName(bidder.name, usedSheetNames);
    const ws = buildBidderDetailSheet(project, bidder, bidder.id === activeBidder.id);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  });

  // المقارنة بين العروض فقط: شركة بلا مبالغ ليست عرضاً (كما في الخلاصة والمحضر — hasBidAmounts)
  const bids = project.bidders.filter(hasBidAmounts);
  if (bids.length > 1) {
    const compHeaders = [
      'اسم المجهز',
      'إجمالي مبلغ العرض',
      'مبلغ الكلفة التخمينية',
      'فرق المبلغ',
      'نسبة الانحراف الكلي %',
      'نسبة الانحراف الجزئي %',
      'عدد الفقرات المنحرفة',
      'النسبة السعرية',
      'حالة العطاء'
    ];

    const compRows: Cell[][] = bids.map(b => [
      b.name,
      amount(b.totals.totalBidderAmount),
      amount(b.totals.totalEstimatedAmount),
      amount(b.totals.overallDiffAmount),
      `${b.totals.totalDeviationPercent.toFixed(percentDecimals(b.totals.totalDeviationPercent, exclusionThresholdOf(project)))}%`,
      `${b.totals.partialDeviationPercent.toFixed(2)}%`,
      { t: 'n' as const, v: b.totals.deviatedItemsCount, z: '0' },
      b.totals.overallPriceRatio.toFixed(4),
      b.status === 'recommended' ? 'موصى بالترسية' : b.status === 'qualified' ? 'مؤهل' : 'قيد التدقيق'
    ]);

    const compWs = buildSheet([
      [`مقارنة عروض الأسعار والمناقصين - ${project.title}`],
      [],
      compHeaders,
      ...compRows
    ], {
      widths: [30, 20, 20, 16, 18, 18, 16, 14, 18],
      dataFrom: 3, dataTo: 2 + compRows.length,
      center: [4, 5, 6, 7, 8], wrap: [0], vertical: 'top'
    });
    compWs['!rows'] = [{ hpt: 22 }, { hpt: 6 }, { hpt: 32 }];

    XLSX.utils.book_append_sheet(wb, compWs, 'مقارنة المجهزين');
  }

  if (project.auditLogs && project.auditLogs.length > 0) {
    const auditHeaders = ['التاريخ والوقت', 'المستخدم / العضو', 'نوع الإجراء', 'التفاصيل'];
    const auditRows: Cell[][] = project.auditLogs.map(log => [
      new Date(log.timestamp).toLocaleString('ar-EG'),
      log.userName,
      log.action,
      log.details
    ]);

    const auditWs = buildSheet([
      [`سجل التدقيق والتتبع للمناقصة - ${project.title}`],
      [],
      auditHeaders,
      ...auditRows
    ], {
      widths: [24, 22, 34, 80],
      dataFrom: 3, dataTo: 2 + auditRows.length,
      wrap: [1, 2, 3], vertical: 'top'
    });
    auditWs['!rows'] = [{ hpt: 22 }, { hpt: 6 }, { hpt: 32 }];

    XLSX.utils.book_append_sheet(wb, auditWs, 'سجل التتبع');
  }

  return markRtl(wb);
}

export function exportTenderToExcel(project: TenderProject, activeBidder: Bidder) {
  XLSX.writeFile(buildTenderWorkbook(project, activeBidder), `${project.title || 'تحليل_العطاءات'}.xlsx`);
}

export async function importBOQFromExcel(file: File, _threshold: number = 20): Promise<Partial<BOQItem>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        const sheetName = workbook.SheetNames.find(s => s.includes('جدول') || s.includes('نهائي') || s.includes('تحليل')) || workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        if (rows.length === 0) {
          throw new Error('الملف فارغ لا يحتوي على بيانات');
        }

        let headerRowIndex = -1;
        for (let i = 0; i < Math.min(rows.length, 15); i++) {
          const r = rows[i];
          if (!r) continue;
          const text = r.join(' ').toLowerCase();
          if (text.includes('فقرة') || text.includes('مجهز') || text.includes('تخميني') || text.includes('كمية') || text.includes('مبلغ')) {
            headerRowIndex = i;
            break;
          }
        }

        const items: Partial<BOQItem>[] = [];

        if (headerRowIndex !== -1) {
          const header = rows[headerRowIndex].map(h => String(h || '').trim());
          
          let itemNoIdx = header.findIndex(h => h.includes('فقرة') || h.includes('ت') || h === '1' || h.includes('item'));
          let descIdx = header.findIndex(h => h.includes('وصف') || h.includes('تفاصيل') || h.includes('بيان'));
          let unitIdx = header.findIndex(h => h.includes('وحدة') || h.includes('unit'));
          let qtyIdx = header.findIndex(h => h.includes('كمية') || h.includes('qty'));
          let estTotalIdx = header.findIndex(h => h.includes('المبلغ التخميني') || h.includes('تخميني إجمالي') || h.includes('كلفة تخمينية'));
          let bidTotalIdx = header.findIndex(h => h.includes('مبلغ المجهز') || h.includes('إجمالي المجهز') || h.includes('سعر العرض'));

          if (bidTotalIdx === -1 && header.length >= 2) bidTotalIdx = 1;
          if (estTotalIdx === -1 && header.length >= 3) estTotalIdx = 2;
          if (qtyIdx === -1 && header.length >= 9) qtyIdx = 8;

          for (let i = headerRowIndex + 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row || row.length === 0) continue;

            const itemNoRaw = itemNoIdx !== -1 ? row[itemNoIdx] : i - headerRowIndex;
            const itemNo = Number(itemNoRaw) || i - headerRowIndex;
            
            const rowStr = row.join(' ');
            if (rowStr.includes('مجموع') || rowStr.includes('انحراف كلي') || rowStr.includes('انحراف جزئي') || isNaN(itemNo)) {
              continue;
            }

            const bidderTotal = bidTotalIdx !== -1 ? Number(row[bidTotalIdx]) || 0 : 0;
            const estimatedTotal = estTotalIdx !== -1 ? Number(row[estTotalIdx]) || 0 : 0;
            const quantity = qtyIdx !== -1 ? Number(row[qtyIdx]) || 1 : 1;
            const description = descIdx !== -1 && row[descIdx] ? String(row[descIdx]) : `فقرة ${itemNo}`;
            const unit = unitIdx !== -1 && row[unitIdx] ? String(row[unitIdx]) : 'عدد';

            if (bidderTotal > 0 || estimatedTotal > 0 || quantity > 0) {
              items.push({
                itemNo,
                description,
                unit,
                quantity,
                estimatedTotal,
                estimatedUnitPrice: quantity > 0 ? estimatedTotal / quantity : estimatedTotal,
                bidderTotal,
                bidderUnitPrice: quantity > 0 ? bidderTotal / quantity : bidderTotal,
              });
            }
          }
        }

        resolve(items);
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
}

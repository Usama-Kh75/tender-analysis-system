import * as XLSX from 'xlsx';
import { BOQItem, TenderProject, Bidder } from '../types/tender';

export function exportTenderToExcel(project: TenderProject, activeBidder: Bidder) {
  const wb = XLSX.utils.book_new();

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

  const rows: any[][] = activeBidder.items.map(item => [
    item.itemNo,
    item.description,
    item.unit,
    item.quantity,
    item.estimatedUnitPrice,
    item.estimatedTotal,
    item.bidderUnitPrice,
    item.bidderTotal,
    item.diffAmount,
    `${item.deviationPercent.toFixed(2)}%`,
    item.deviatedAmount,
    item.priceRatio.toFixed(4),
    item.newPrice,
    item.weightedUnitPrice.toFixed(2),
    item.notes || ''
  ]);

  rows.push([]);
  rows.push([
    'المجموع الإجمالي',
    '',
    '',
    '',
    '',
    activeBidder.totals.totalEstimatedAmount,
    '',
    activeBidder.totals.totalBidderAmount,
    activeBidder.totals.overallDiffAmount,
    '',
    activeBidder.totals.deviatedItemsSum,
    '',
    activeBidder.totals.newPricesTotal,
    '',
    ''
  ]);

  rows.push([
    'مؤشرات الانحراف',
    `الانحراف الكلي: ${activeBidder.totals.totalDeviationPercent.toFixed(2)}%`,
    `الانحراف الجزئي: ${activeBidder.totals.partialDeviationPercent.toFixed(2)}%`,
    `النسبة السعرية: ${activeBidder.totals.overallPriceRatio.toFixed(4)}`,
    `عدد الفقرات المنحرفة: ${activeBidder.totals.deviatedItemsCount}`,
    '', '', '', '', '', '', '', '', '', ''
  ]);

  const ws = XLSX.utils.aoa_to_sheet([
    [`مشروع: ${project.title} - رقم الإحالة: ${project.referenceNumber}`],
    [`المجهز: ${activeBidder.name} - تاريخ التحليل: ${new Date().toLocaleDateString('ar-EG')}`],
    [],
    headers,
    ...rows
  ]);

  XLSX.utils.book_append_sheet(wb, ws, 'التحليل المالي التفصيلي');

  if (project.bidders.length > 1) {
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

    const compRows = project.bidders.map(b => [
      b.name,
      b.totals.totalBidderAmount,
      b.totals.totalEstimatedAmount,
      b.totals.overallDiffAmount,
      `${b.totals.totalDeviationPercent.toFixed(2)}%`,
      `${b.totals.partialDeviationPercent.toFixed(2)}%`,
      b.totals.deviatedItemsCount,
      b.totals.overallPriceRatio.toFixed(4),
      b.status === 'recommended' ? 'موصى بالترسية' : b.status === 'qualified' ? 'مؤهل' : 'قيد التدقيق'
    ]);

    const compWs = XLSX.utils.aoa_to_sheet([
      [`مقارنة عروض الأسعار والمناقصين - ${project.title}`],
      [],
      compHeaders,
      ...compRows
    ]);

    XLSX.utils.book_append_sheet(wb, compWs, 'مقارنة المجهزين');
  }

  if (project.auditLogs && project.auditLogs.length > 0) {
    const auditHeaders = ['التاريخ والوقت', 'المستخدم / العضو', 'نوع الإجراء', 'التفاصيل'];
    const auditRows = project.auditLogs.map(log => [
      new Date(log.timestamp).toLocaleString('ar-EG'),
      log.userName,
      log.action,
      log.details
    ]);

    const auditWs = XLSX.utils.aoa_to_sheet([
      [`سجل التدقيق والتتبع للمناقصة - ${project.title}`],
      [],
      auditHeaders,
      ...auditRows
    ]);

    XLSX.utils.book_append_sheet(wb, auditWs, 'سجل التتبع');
  }

  XLSX.writeFile(wb, `${project.title || 'تحليل_العطاءات'}_${activeBidder.name}.xlsx`);
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

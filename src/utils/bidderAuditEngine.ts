import { parseArabicNumber, tafqeetArabic } from './calculations';

export interface BidderRowAudit {
  itemNo: string | number;
  description: string;
  unitPrice: number;
  quantity: number;
  enteredNumberTotal: number;
  writtenText?: string;
  calculatedMathTotal: number;
  hasMathError: boolean;
  mathDifference: number; // calculatedMathTotal - enteredNumberTotal
  hasTextDiscrepancy: boolean;
  textParsedTotal?: number;
  legalCorrectionApplied: number;
  auditNotes: string[];
}

export interface BidderAuditReport {
  bidderName: string;
  totalItemsChecked: number;
  itemsWithErrorsCount: number;
  mathErrorsCount: number;
  textDiscrepanciesCount: number;
  originalTotalEntered: number;
  correctedLegalTotal: number;
  totalVariance: number;
  rows: BidderRowAudit[];
}

// دالة متقدمة لتحويل الكلمات المكتوبة باللغة العربية إلى أرقام
export const parseArabicTextToNumber = (text: string): number | null => {
  if (!text || typeof text !== 'string') return null;

  let clean = text
    .replace(/دینار|دينار|عراقي|فقط|لا|غير|مبلغ|قدره|وقدره/gi, '')
    .replace(/[،,]/g, ' ')
    .trim();

  if (!clean) return null;

  const numberMap: { [key: string]: number } = {
    'صفر': 0,
    'واحد': 1, 'واحدة': 1, 'احد': 1, 'إحدى': 1, 'احدى': 1,
    'اثنان': 2, 'اثنين': 2, 'اثنتان': 2, 'اثنتين': 2,
    'ثلاثة': 3, 'ثلاث': 3,
    'اربعة': 4, 'أربعة': 4, 'اربع': 4, 'أربع': 4,
    'خمسة': 5, 'خمس': 5,
    'ستة': 6, 'ست': 6,
    'سبعة': 7, 'سبع': 7,
    'ثمانية': 8, 'ثمان': 8, 'ثماني': 8,
    'تسعة': 9, 'تسع': 9,
    'عشرة': 10, 'عشر': 10,
    'احد عشر': 11, 'أحد عشر': 11, 'إحدى عشرة': 11,
    'اثنا عشر': 12, 'اثني عشر': 12, 'اثنتا عشرة': 12,
    'ثلاثة عشر': 13, 'ثلاث عشر': 13,
    'اربعة عشر': 14, 'أربعة عشر': 14, 'أربع عشر': 14,
    'خمسة عشر': 15, 'خمس عشر': 15,
    'ستة عشر': 16, 'ست عشر': 16,
    'سبعة عشر': 17, 'سبع عشر': 17,
    'ثمانية عشر': 18, 'ثماني عشر': 18,
    'تسعة عشر': 19, 'تسع عشر': 19,
    'عشرون': 20, 'عشرين': 20,
    'ثلاثون': 30, 'ثلاثين': 30,
    'اربعون': 40, 'أربعون': 40, 'اربعين': 40, 'أربعين': 40,
    'خمسون': 50, 'خمسين': 50,
    'ستون': 60, 'ستين': 60,
    'سبعون': 70, 'سبعين': 70,
    'ثمانون': 80, 'ثمانين': 80,
    'تسعون': 90, 'تسعين': 90,
    'مئة': 100, 'مائة': 100, 'مئتان': 200, 'مائتان': 200, 'مئتين': 200, 'مائتين': 200,
    'ثلاثمئة': 300, 'ثلاثمائة': 300, 'ثلاث مئة': 300, 'ثلاث مائة': 300,
    'اربعمئة': 400, 'أربعمائة': 400, 'أربعمئة': 400, 'أربع مائة': 400,
    'خمسمئة': 500, 'خمسمائة': 500, 'خمس مئة': 500, 'خمس مائة': 500,
    'ستمئة': 600, 'ستمائة': 600, 'ست مئة': 600, 'ست مائة': 600,
    'سبعمئة': 700, 'سبعمائة': 700, 'سبع مئة': 700, 'سبع مائة': 700,
    'ثمانمئة': 800, 'ثمانمائة': 800, 'ثمان مئة': 800, 'ثمان مائة': 800,
    'تسعمئة': 900, 'تسعمائة': 900, 'تسع مئة': 900, 'تسع مائة': 900,
    'الف': 1000, 'ألف': 1000, 'الفان': 2000, 'ألفان': 2000, 'الفين': 2000, 'ألفين': 2000,
    'ملايين': 1000000, 'مليون': 1000000, 'مليونان': 2000000, 'مليونين': 2000000,
    'مليار': 1000000000, 'مليارات': 1000000000
  };

  // تفكيك وتحليل الجملة
  try {
    let total = 0;
    let currentScale = 0;
    
    // تقسيم النص وفق الفئات الكبرى (مليار، مليون، ألف)
    const thousandsSplit = clean.split(/\b(?:ألف|الف|آلاف|الاف)\b/i);
    if (thousandsSplit.length > 1) {
      const thousandsPart = thousandsSplit[0];
      const remainderPart = thousandsSplit.slice(1).join(' ');

      let thousandsVal = parseSubHundred(thousandsPart, numberMap) || 1;
      total += thousandsVal * 1000;

      if (remainderPart.trim()) {
        total += parseSubHundred(remainderPart, numberMap);
      }
      return total;
    }

    return parseSubHundred(clean, numberMap);
  } catch {
    return null;
  }
};

const parseSubHundred = (str: string, map: { [key: string]: number }): number => {
  let subTotal = 0;
  const words = str.split(/\s+|\s*و\s*/).filter(w => w.trim().length > 0);

  for (const w of words) {
    const cleanW = w.trim();
    if (map[cleanW] !== undefined) {
      subTotal += map[cleanW];
    } else {
      // تجربة فك الواو مثل وثمانون -> ثمانون
      const strippedW = cleanW.startsWith('و') ? cleanW.substring(1) : cleanW;
      if (map[strippedW] !== undefined) {
        subTotal += map[strippedW];
      }
    }
  }
  return subTotal;
};

// تشغيل الفحص والتدقيق الحسابي والقانوني الشامل
export const auditBidderRows = (
  rawRows: any[],
  bidderName: string = 'المجهز'
): BidderAuditReport => {
  let originalTotalEntered = 0;
  let correctedLegalTotal = 0;
  let mathErrorsCount = 0;
  let textDiscrepanciesCount = 0;
  const auditedRows: BidderRowAudit[] = [];

  rawRows.forEach((row, idx) => {
    const itemNo = row.itemNo || String(idx + 1);
    const description = row.description || `فقرة ${itemNo}`;
    const unitPrice = parseArabicNumber(row.unitPrice || row.rate || 0);
    const quantity = parseArabicNumber(row.quantity || row.qty || 1) || 1;
    const enteredNumberTotal = parseArabicNumber(row.enteredTotal || row.bidderTotal || row.total || (unitPrice * quantity));
    const writtenText = row.writtenText ? String(row.writtenText).trim() : undefined;

    const calculatedMathTotal = unitPrice > 0 ? (unitPrice * quantity) : enteredNumberTotal;
    
    // 1. فحص خطأ الضرب الحسابي
    const hasMathError = unitPrice > 0 && Math.abs(calculatedMathTotal - enteredNumberTotal) > 0.01;
    const mathDifference = calculatedMathTotal - enteredNumberTotal;

    // 2. فحص تعارض التفقيط المكتوب مع الرقم
    let hasTextDiscrepancy = false;
    let textParsedTotal: number | undefined = undefined;

    if (writtenText && writtenText.length > 3) {
      const parsedText = parseArabicTextToNumber(writtenText);
      if (parsedText !== null && parsedText > 0) {
        textParsedTotal = parsedText;
        if (Math.abs(textParsedTotal - enteredNumberTotal) > 0.01) {
          hasTextDiscrepancy = true;
        }
      }
    }

    // الملاحظات التدقيقية
    const auditNotes: string[] = [];
    if (hasMathError) {
      mathErrorsCount++;
      auditNotes.push(
        `خطأ ضرب حسابي: حاصل ضرب (${unitPrice.toLocaleString()} × ${quantity}) = ${calculatedMathTotal.toLocaleString()} د.ع، بينما دوّن المجهز (${enteredNumberTotal.toLocaleString()} د.ع)`
      );
    }

    if (hasTextDiscrepancy) {
      textDiscrepanciesCount++;
      auditNotes.push(
        `تعارض تفقيط: المكتوب كتابةً (${writtenText}) يمثل [${textParsedTotal?.toLocaleString()} د.ع] بينما المكتوب رقماً هو [${enteredNumberTotal.toLocaleString()} د.ع]`
      );
    }

    // التطبيق القانوني الإلزامي وفق المادة 13/ثانياً:
    // (سعر المفرد هو الحاكم والمعتمد لتصحيح مبلغ الفقرة)
    const legalCorrectionApplied = unitPrice > 0 ? calculatedMathTotal : enteredNumberTotal;

    originalTotalEntered += enteredNumberTotal;
    correctedLegalTotal += legalCorrectionApplied;

    auditedRows.push({
      itemNo,
      description,
      unitPrice,
      quantity,
      enteredNumberTotal,
      writtenText,
      calculatedMathTotal,
      hasMathError,
      mathDifference,
      hasTextDiscrepancy,
      textParsedTotal,
      legalCorrectionApplied,
      auditNotes
    });
  });

  const itemsWithErrorsCount = auditedRows.filter(r => r.hasMathError || r.hasTextDiscrepancy).length;

  return {
    bidderName,
    totalItemsChecked: auditedRows.length,
    itemsWithErrorsCount,
    mathErrorsCount,
    textDiscrepanciesCount,
    originalTotalEntered,
    correctedLegalTotal,
    totalVariance: correctedLegalTotal - originalTotalEntered,
    rows: auditedRows
  };
};

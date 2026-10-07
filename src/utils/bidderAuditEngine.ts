import { parseArabicNumber } from './calculations';

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

const rawNumberMap: { [key: string]: number } = {
  'صفر': 0,
  'واحد': 1, 'واحدة': 1, 'واحده': 1, 'احد': 1, 'أحد': 1, 'إحدى': 1, 'احدى': 1,
  'اثنان': 2, 'اثنين': 2, 'اثنتان': 2, 'اثنتين': 2,
  'ثلاثة': 3, 'ثلاثه': 3, 'ثلاث': 3,
  'اربعة': 4, 'أربعة': 4, 'اربعه': 4, 'أربعه': 4, 'اربع': 4, 'أربع': 4,
  'خمسة': 5, 'خمسه': 5, 'خمس': 5,
  'ستة': 6, 'سته': 6, 'ست': 6,
  'سبعة': 7, 'سبعه': 7, 'سبع': 7,
  'ثمانية': 8, 'ثمانيه': 8, 'ثمان': 8, 'ثماني': 8,
  'تسعة': 9, 'تسعه': 9, 'تسع': 9,
  'عشرة': 10, 'عشره': 10, 'عشر': 10,
  'عشرون': 20, 'عشرين': 20,
  'ثلاثون': 30, 'ثلاثين': 30,
  'اربعون': 40, 'أربعون': 40, 'اربعين': 40, 'أربعين': 40,
  'خمسون': 50, 'خمسين': 50,
  'ستون': 60, 'ستين': 60,
  'سبعون': 70, 'سبعين': 70,
  'ثمانون': 80, 'ثمانين': 80,
  'تسعون': 90, 'تسعين': 90,
  'مئة': 100, 'مئه': 100, 'مائة': 100, 'مائه': 100, 
  'مئتان': 200, 'مائتان': 200, 'مئتين': 200, 'مائتين': 200,
  'ثلاثمئة': 300, 'ثلاثمائه': 300, 'ثلاثمائة': 300, 'ثلاثمئه': 300,
  'اربعمئة': 400, 'أربعمائة': 400, 'أربعمئة': 400, 'اربعمائة': 400,
  'خمسمئة': 500, 'خمسمائة': 500, 'خمسمئه': 500, 'خمسمائه': 500,
  'ستمئة': 600, 'ستمائة': 600, 'ستمئه': 600, 'ستمائه': 600,
  'سبعمئة': 700, 'سبعمائة': 700, 'سبعمئه': 700, 'سبعمائه': 700,
  'ثمانمئة': 800, 'ثمانمائة': 800, 'ثمانمئه': 800, 'ثمانمائه': 800,
  'تسعمئة': 900, 'تسعمائة': 900, 'تسعمئه': 900, 'تسعمائه': 900,
  'الف': 1000, 'ألف': 1000, 'الفان': 2000, 'ألفان': 2000, 'الفين': 2000, 'ألفين': 2000,
  'ملايين': 1000000, 'مليون': 1000000, 'مليونان': 2000000, 'مليونين': 2000000,
  'مليار': 1000000000, 'مليارات': 1000000000
};

// الأعداد المركبة (11 - 19)
const teenPrefixes = [
  ['احد', 1], ['أحد', 1], ['اثنا', 2], ['اثني', 2], ['ثلاثة', 3], ['ثلاثه', 3], ['ثلاث', 3],
  ['اربعة', 4], ['أربعة', 4], ['اربعه', 4], ['أربعه', 4], ['اربع', 4], ['أربع', 4],
  ['خمسة', 5], ['خمسه', 5], ['خمس', 5], ['ستة', 6], ['سته', 6], ['ست', 6],
  ['سبعة', 7], ['سبعه', 7], ['سبع', 7], ['ثمانية', 8], ['ثمانيه', 8], ['ثمان', 8],
  ['تسعة', 9], ['تسعه', 9], ['تسع', 9]
] as const;

teenPrefixes.forEach(([prefix, val]) => {
  rawNumberMap[`${prefix} عشر`] = val + 10;
  rawNumberMap[`${prefix} عشره`] = val + 10;
  rawNumberMap[`${prefix} عشرة`] = val + 10;
});

const normalizeArabicWord = (w: string): string => {
  if (!w) return '';
  return w
    .trim()
    .replace(/[إأآا]/g, 'ا')
    .replace(/[ىي]/g, 'ي')
    .replace(/[ة]/g, 'ه');
};

const normMap: { [key: string]: number } = {};
Object.entries(rawNumberMap).forEach(([k, v]) => {
  normMap[normalizeArabicWord(k)] = v;
});

const stopWords = new Set([
  'دينار', 'دینار', 'عراقي', 'فقط', 'لا', 'غير', 'مبلغ', 'وقدره', 'قدره', 'سعر', 'المجموع'
].map(normalizeArabicWord));

/**
 * دالة متقدمة لتحويل التفقيط المكتوب باللغة العربية إلى أرقام بدقة 100%
 */
export const parseArabicTextToNumber = (text: string): number | null => {
  if (!text || typeof text !== 'string') return null;

  const clean = text.replace(/[،,]/g, ' ').trim();
  const rawTokens = clean.split(/\s+/).filter(t => t.trim().length > 0);

  // تصفية الكلمات الزائدة ككلمات كاملة حصراً لمنع تشويه الحروف
  const tokens: string[] = [];
  for (const t of rawTokens) {
    const normT = normalizeArabicWord(t);
    const normTNoWaw = normT.startsWith('و') && normT.length > 2 ? normT.substring(1) : normT;
    if (!stopWords.has(normT) && !stopWords.has(normTNoWaw)) {
      tokens.push(t);
    }
  }

  if (tokens.length === 0) return null;

  let total = 0;
  let current = 0;
  let i = 0;

  while (i < tokens.length) {
    const w = tokens[i];
    const normW = normalizeArabicWord(w);

    // فحص الكلمات المركبة مثل "أربعة عشر"
    if (i + 1 < tokens.length) {
      const nextNorm = normalizeArabicWord(tokens[i + 1]);
      const pair = `${normW} ${nextNorm}`;
      const pairNoWaw = `${normW.startsWith('و') ? normW.substring(1) : normW} ${nextNorm}`;

      if (normMap[pair] !== undefined) {
        current += normMap[pair];
        i += 2;
        continue;
      }
      if (normMap[pairNoWaw] !== undefined) {
        current += normMap[pairNoWaw];
        i += 2;
        continue;
      }
    }

    let cleanNorm = normW;
    if (normMap[cleanNorm] === undefined && cleanNorm.startsWith('و') && cleanNorm.length > 2) {
      cleanNorm = cleanNorm.substring(1);
    }

    if (cleanNorm === 'الف' || cleanNorm === 'الاف' || cleanNorm === 'الافا') {
      if (current === 0) current = 1;
      total += current * 1000;
      current = 0;
    } else if (cleanNorm === 'مليون' || cleanNorm === 'ملايين') {
      if (current === 0) current = 1;
      total += current * 1000000;
      current = 0;
    } else if (cleanNorm === 'مليار' || cleanNorm === 'مليارات') {
      if (current === 0) current = 1;
      total += current * 1000000000;
      current = 0;
    } else if (normMap[cleanNorm] !== undefined) {
      current += normMap[cleanNorm];
    } else if (normMap[normW] !== undefined) {
      current += normMap[normW];
    }

    i++;
  }

  total += current;
  return total > 0 ? total : null;
};

/**
 * التفقيط في العطاء يُكتب لسعر المفرد أحياناً (جداول «سعر الفقرة: رقماً / كتابةً») ولمبلغ الفقرة أحياناً:
 * يُنسب إلى الأقرب منهما بالنسبة لا بالفرق (260 أقرب إلى مفرد 250 منه إلى مبلغ 15,062,500)
 */
export const writtenAmountTarget = (written: number, unitPrice: number, total: number): 'unit' | 'total' => {
  if (!(written > 0) || !(unitPrice > 0) || !(total > 0)) return 'total';
  return Math.abs(Math.log(written / unitPrice)) < Math.abs(Math.log(written / total)) ? 'unit' : 'total';
};

/**
 * علامتا التدقيق لفقرة كما كتبها المجهز: خطأ ضرب (المفرد × الكمية ≠ المبلغ، بشرط الكمية نفسه في
 * calculateBOQMetrics)، وتعارض تفقيط (المكتوب كتابةً لا يساوي المفرد ولا المبلغ)
 */
export const auditRowAmounts = (quantity: number, unitPrice: number, total: number, writtenText?: string) => {
  const hasMathError = unitPrice > 0 && quantity > 1 && Math.abs(unitPrice * quantity - total) > 0.01;
  let hasTextDiscrepancy = false;
  if (writtenText && writtenText.length > 2) {
    const textNum = parseArabicTextToNumber(writtenText);
    hasTextDiscrepancy = textNum !== null && textNum > 0
      && Math.abs(textNum - (unitPrice || total)) > 0.01 && Math.abs(textNum - total) > 0.01;
  }
  return { hasMathError, hasTextDiscrepancy };
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
    const itemNo = row.itemNo || idx + 1;
    const description = row.description || `فقرة ${itemNo}`;
    const unitPrice = parseArabicNumber(row.unitPrice);
    const quantity = Math.max(1, parseArabicNumber(row.quantity) || 1);
    const enteredNumberTotal = parseArabicNumber(row.enteredTotal !== undefined ? row.enteredTotal : row.bidderTotal);
    const writtenText = row.writtenText ? String(row.writtenText).trim() : undefined;

    // 1. تدقيق الخطأ الحسابي في حاصل الضرب (سعر المفرد * العدد - يطبق فقط عند وجود كمية أكبر من 1)
    const calculatedMathTotal = unitPrice > 0 && quantity > 1 ? (unitPrice * quantity) : enteredNumberTotal;
    const hasMathError = unitPrice > 0 && quantity > 1 && Math.abs(calculatedMathTotal - enteredNumberTotal) > 0.01;
    const mathDifference = calculatedMathTotal - enteredNumberTotal;

    // 2. تدقيق التناقض بين المكتوب رقماً والمكتوب كتابةً (التفقيط)
    let hasTextDiscrepancy = false;
    let textParsedTotal: number | undefined = undefined;

    if (writtenText && writtenText.length > 2) {
      const parsed = parseArabicTextToNumber(writtenText);
      if (parsed !== null && parsed > 0) {
        textParsedTotal = parsed;
        if (Math.abs(parsed - enteredNumberTotal) > 0.01) {
          hasTextDiscrepancy = true;
        }
      }
    }

    // 3. تحديد الإجراء والتصحيح القانوني
    const legalCorrectionApplied = calculatedMathTotal;
    const auditNotes: string[] = [];

    if (hasMathError) {
      mathErrorsCount++;
      auditNotes.push(
        `خطأ ضرب: المدون (${enteredNumberTotal.toLocaleString()} د.ع) ≠ حاصل المفرد × العدد (${calculatedMathTotal.toLocaleString()} د.ع)`
      );
    }

    if (hasTextDiscrepancy) {
      textDiscrepanciesCount++;
      auditNotes.push(
        `تعارض تفقيط: المكتوب كتابةً (${writtenText}) يختلف عن الرقم المدون (${enteredNumberTotal.toLocaleString()} د.ع)`
      );
    }

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

  const totalVariance = correctedLegalTotal - originalTotalEntered;
  const itemsWithErrorsCount = auditedRows.filter(r => r.hasMathError || r.hasTextDiscrepancy).length;

  return {
    bidderName,
    totalItemsChecked: rawRows.length,
    itemsWithErrorsCount,
    mathErrorsCount,
    textDiscrepanciesCount,
    originalTotalEntered,
    correctedLegalTotal,
    totalVariance,
    rows: auditedRows
  };
};

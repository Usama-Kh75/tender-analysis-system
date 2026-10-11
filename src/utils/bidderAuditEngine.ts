import { parseArabicNumber } from './calculations';
import { BOQItem } from '../types/tender';

// فقرة صحّحتها اللجنة (باعتماد حاصل الضرب أو المكتوب كتابةً): مبلغها المعتمد غير الذي دوّنه المجهز،
// والأخير محفوظ في enteredBidderTotal دليلاً، أو حلّ التفقيط محل سعر المفرد المدون (originalUnitPrice).
// تصحيح القراءة يُبقي المبلغين متساويين
export const isCommitteeCorrected = (item: BOQItem) =>
  ((item.enteredBidderTotal || 0) > 0 && Math.abs(item.bidderTotal - (item.enteredBidderTotal || 0)) > 0.01)
  || item.originalUnitPrice !== undefined;

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
  'مئتان': 200, 'مائتان': 200, 'مئتين': 200, 'مائتين': 200, 'مئتا': 200, 'مائتا': 200,
  'ثلاثمئة': 300, 'ثلاثمائه': 300, 'ثلاثمائة': 300, 'ثلاثمئه': 300, 'ثلثمائة': 300, 'ثلثمئة': 300,
  'اربعمئة': 400, 'أربعمائة': 400, 'أربعمئة': 400, 'اربعمائة': 400,
  'خمسمئة': 500, 'خمسمائة': 500, 'خمسمئه': 500, 'خمسمائه': 500,
  'ستمئة': 600, 'ستمائة': 600, 'ستمئه': 600, 'ستمائه': 600,
  'سبعمئة': 700, 'سبعمائة': 700, 'سبعمئه': 700, 'سبعمائه': 700,
  'ثمانمئة': 800, 'ثمانمائة': 800, 'ثمانمئه': 800, 'ثمانمائه': 800, 'ثمنمائة': 800, 'ثمنمئة': 800,
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
    .replace(/[ً-ْـ]/g, '') // التشكيل والتطويل: «ألفاً» تصير «الفا»
    .replace(/[إأآا]/g, 'ا')
    .replace(/[ىي]/g, 'ي')
    .replace(/[ة]/g, 'ه');
};

const normMap: { [key: string]: number } = {};
Object.entries(rawNumberMap).forEach(([k, v]) => {
  normMap[normalizeArabicWord(k)] = v;
});

const HUNDRED_WORDS = new Set(['مئة', 'مائة'].map(normalizeArabicWord));

const stopWords = new Set([
  'دينار', 'دینار', 'عراقي', 'فقط', 'لا', 'غير', 'مبلغ', 'وقدره', 'قدره', 'سعر', 'المجموع'
].map(normalizeArabicWord));

// الدينار العراقي ألف فلس: «422.100» تُكتب «أربعمائة واثنان وعشرون ديناراً ومئة فلس» أو دون كلمتي
// دينار وفلس، والمئة الثانية فيها فلوس لا مئة دينار (كانت تُقرأ 522 فيُعلَّم الصف ويُقترح رقم لا صلة له به)
const FILS_PER_DINAR = 1000;

const wordMatches = (token: string, pattern: RegExp) => {
  const n = normalizeArabicWord(token);
  return pattern.test(n) || (n.startsWith('و') && pattern.test(n.substring(1)));
};
const isDinarWord = (token: string) => wordMatches(token, /^(دينار|دینار|دنانير)/);
const isFilsWord = (token: string) => wordMatches(token, /^(فلس|فلوس)/);

const GROUP_RESET_WORDS = /^(الف|الفا|الاف|الافا|الفان|الفين|مليون|مليونا|مليونان|مليونين|ملايين|مليار|مليارا|مليارات)$/;

// موضع المئة الثانية داخل المجموعة الواحدة (دون الألف)، فالعدد الصحيح لا يحمل مئتين في مجموعته،
// وما بعدها فلوس. -1 إن لم توجد
const secondHundredsAt = (tokens: string[]): number => {
  let hasHundreds = false;
  for (let i = 0; i < tokens.length; i++) {
    const n = normalizeArabicWord(tokens[i]);
    const base = normMap[n] === undefined && n.startsWith('و') ? n.substring(1) : n;
    if (GROUP_RESET_WORDS.test(base)) { hasHundreds = false; continue; }
    const v = normMap[base];
    if (v !== undefined && v >= 100 && v < 1000) {
      if (hasHundreds) return i;
      hasHundreds = true;
    }
  }
  return -1;
};

const splitDinarsAndFils = (tokens: string[]): { dinars: string[]; fils: string[] } => {
  const filsAt = tokens.findIndex(isFilsWord);
  if (filsAt >= 0) {
    // «… ديناراً ومئة فلس»: الفلوس ما بين كلمة الدينار وكلمة الفلس
    const before = tokens.slice(0, filsAt);
    const dinarAt = before.map(isDinarWord).lastIndexOf(true);
    if (dinarAt >= 0) return { dinars: before.slice(0, dinarAt), fils: before.slice(dinarAt + 1) };
    const cut = secondHundredsAt(before);
    return cut > 0
      ? { dinars: before.slice(0, cut), fils: before.slice(cut) }
      : { dinars: [], fils: before };
  }
  const dinarAt = tokens.findIndex(isDinarWord);
  if (dinarAt > 0) return { dinars: tokens.slice(0, dinarAt), fils: tokens.slice(dinarAt + 1) };
  const cut = secondHundredsAt(tokens);
  return cut > 0 ? { dinars: tokens.slice(0, cut), fils: tokens.slice(cut) } : { dinars: tokens, fils: [] };
};

/**
 * دالة متقدمة لتحويل التفقيط المكتوب باللغة العربية إلى أرقام بدقة 100%
 */
export const parseArabicTextToNumber = (text: string): number | null => {
  if (!text || typeof text !== 'string') return null;

  const rawTokens = text.replace(/[،,]/g, ' ').trim().split(/\s+/).filter(t => t.length > 0);
  const { dinars, fils } = splitDinarsAndFils(rawTokens);
  if (fils.length > 0) {
    const filsValue = sumArabicWords(fils);
    if (filsValue > 0 && filsValue < FILS_PER_DINAR) {
      const value = Math.round((sumArabicWords(dinars) + filsValue / FILS_PER_DINAR) * 1000) / 1000;
      return value > 0 ? value : null;
    }
  }
  const total = sumArabicWords(rawTokens);
  return total > 0 ? total : null;
};

// مجموع الكلمات العددية في قائمة كلمات (0 إن لم تكن فيها كلمة عددية)
const sumArabicWords = (rawTokens: string[]): number => {
  if (rawTokens.length === 0) return 0;

  // تصفية الكلمات الزائدة ككلمات كاملة حصراً لمنع تشويه الحروف
  const tokens: string[] = [];
  for (const t of rawTokens) {
    const normT = normalizeArabicWord(t);
    const normTNoWaw = normT.startsWith('و') && normT.length > 2 ? normT.substring(1) : normT;
    if (!stopWords.has(normT) && !stopWords.has(normTNoWaw)) {
      tokens.push(t);
    }
  }

  if (tokens.length === 0) return 0;

  // العُرف التجاري العراقي: «ثلاثة وخمسمائة» تعني 3,500 (حُذفت «آلاف»). آحاد مفردة تسبق مئات وليس في النص
  // ألف ولا مليون: ترتيب العدد الصحيح مئاته قبل آحاده («خمسمائة وثلاثة» = 503)، فلا تُقرأ 503. كانت الفقرة 98
  // («ثلاثة وخمسمائة» والأرقام 3,500 و350,000) تُؤشَّر تعارض تفقيط وتُقترح 503
  const baseOf = (t: string) => {
    const n = normalizeArabicWord(t);
    return normMap[n] === undefined && n.startsWith('و') && n.length > 2 ? n.substring(1) : n;
  };
  if (tokens.length >= 2 && !tokens.some(t => GROUP_RESET_WORDS.test(baseOf(t)))) {
    const first = normMap[baseOf(tokens[0])];
    const second = normMap[baseOf(tokens[1])];
    const secondIsHundredsWord = second !== undefined && second >= 200 && second < 1000 && !HUNDRED_WORDS.has(baseOf(tokens[1]));
    if (first !== undefined && first >= 1 && first <= 9 && secondIsHundredsWord) {
      return first * 1000 + sumArabicWords(tokens.slice(1));
    }
  }

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
      // المئات بكلمتين: «تسعة مائة» و«وثلاث مئة» (كانت تُجمع 9 + 100 = 109)
      const unitNorm = normMap[normW] === undefined && normW.startsWith('و') ? normW.substring(1) : normW;
      const unit = normMap[unitNorm];
      if (HUNDRED_WORDS.has(nextNorm) && unit !== undefined && unit >= 3 && unit <= 9) {
        current += unit * 100;
        i += 2;
        continue;
      }
    }

    let cleanNorm = normW;
    if (normMap[cleanNorm] === undefined && cleanNorm.startsWith('و') && cleanNorm.length > 2) {
      cleanNorm = cleanNorm.substring(1);
    }

    // صيغة النصب («تسعة وثلاثون ألفاً») كانت تُهمل فتُقرأ 39,500 على أنها 539
    if (cleanNorm === 'الف' || cleanNorm === 'الفا' || cleanNorm === 'الاف' || cleanNorm === 'الافا') {
      if (current === 0) current = 1;
      total += current * 1000;
      current = 0;
    } else if (cleanNorm === 'مليون' || cleanNorm === 'مليونا' || cleanNorm === 'ملايين') {
      if (current === 0) current = 1;
      total += current * 1000000;
      current = 0;
    } else if (cleanNorm === 'مليار' || cleanNorm === 'مليارا' || cleanNorm === 'مليارات') {
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

  return total + current;
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

/**
 * فقرات مستوردة لعطاء مجهز تختلف كميتها عن كمية الجدول في الموضع نفسه (الدمج بالترتيب). الكمية مشتركة بين
 * الكلفة التخمينية والمجهزين، فتبقى كمية الجدول ويُفحص بها الضرب (handleApplyExtractedItems)، وتُعرض هذه
 * الفقرات قبل الإدراج لتصحّح اللجنة كمية الجدول إن كانت هي الخاطئة
 */
export const quantityMismatches = (
  items: { quantity?: number }[],
  tableRows: { itemNo: number | string; quantity: number }[]
) => items.flatMap((item, i) => {
  const table = tableRows[i]?.quantity || 0;
  const file = item.quantity || 0;
  return table > 0 && file > 0 && Math.abs(file - table) > 1e-9
    ? [{ itemNo: tableRows[i].itemNo, file, table }]
    : [];
});

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
    const mathDifference = calculatedMathTotal - enteredNumberTotal;

    // 2. العلامتان من auditRowAmounts كالقراءة بالذكاء الاصطناعي: التفقيط يُقبل إن ساوى المفرد أو المبلغ
    // (كان يُقارن بالمبلغ وحده فيُعلَّم كل صف تفقيطه لسعر المفرد)
    const { hasMathError, hasTextDiscrepancy } = auditRowAmounts(quantity, unitPrice, enteredNumberTotal, writtenText);
    const parsedText = writtenText && writtenText.length > 2 ? parseArabicTextToNumber(writtenText) : null;
    const textParsedTotal = parsedText !== null && parsedText > 0 ? parsedText : undefined;

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
        `تعارض تفقيط: المكتوب كتابةً (${writtenText}) لا يساوي سعر المفرد (${unitPrice.toLocaleString()} د.ع) ولا مبلغ الفقرة (${enteredNumberTotal.toLocaleString()} د.ع)`
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

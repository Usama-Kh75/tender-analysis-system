import { parseArabicTextToNumber } from './bidderAuditEngine';
import { BOQItem, TenderTotals } from '../types/tender';

/**
 * تحويل الأرقام المكتوبة بالأرقام المشرقية/الهندية (٠١٢٣٤٥٦٧٨٩) والفارسية إلى أرقام قياسية
 * وإزالة الفواصل والرموز النصية والعملات لتجهيزها للحسابات الرياضية
 */
export function parseArabicNumber(input: string | number | null | undefined): number {
  if (input === null || input === undefined) return 0;
  if (typeof input === 'number') return isNaN(input) ? 0 : input;

  let str = String(input).trim();
  if (!str) return 0;

  // خريطة تحويل الأرقام الهندية/المشرقية والفارسية
  const arabicHindiDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

  for (let i = 0; i < 10; i++) {
    str = str.split(arabicHindiDigits[i]).join(String(i));
    str = str.split(persianDigits[i]).join(String(i));
  }

  // استبدال فواصل الكسور العشرية العربية والأجنبية
  str = str.replace(/٫/g, '.');
  str = str.replace(/،/g, ''); // إزالة فواصل الآلاف
  str = str.replace(/,/g, '');

  // إزالة الكلمات والعملات النصية الملحقة
  str = str.replace(/دينار|د\.ع|دولار|IQD|USD|\$/gi, '').trim();

  const parsed = parseFloat(str);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * محرك التفقيط القانوني الرسمي باللغة العربية (تحويل الأرقام إلى كلمات بالحروف)
 * يستخدم في توثيق المحاضر الرسمية لمنع التلاعب وتطبيق القاعدة القانونية
 */
export function tafqeetArabic(number: number, currencyName: string = 'دينار عراقي'): string {
  if (number === 0) return `صفر ${currencyName} فقط لا غير`;
  if (isNaN(number)) return '';

  const ones = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة', 'عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
  const tens = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
  const hundreds = ['', 'مائة', 'مئتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];

  function convertGroup(n: number): string {
    let output = '';
    const h = Math.floor(n / 100);
    const remainder = n % 100;
    const t = Math.floor(remainder / 10);
    const o = remainder % 10;

    if (h > 0) output += hundreds[h];

    if (remainder > 0) {
      if (output !== '') output += ' و';
      if (remainder < 20) {
        output += ones[remainder];
      } else {
        if (o > 0) output += ones[o] + ' و';
        output += tens[t];
      }
    }
    return output;
  }

  const intPart = Math.floor(Math.abs(number));
  const decPart = Math.round((Math.abs(number) - intPart) * 100);

  const billions = Math.floor(intPart / 1000000000);
  const millions = Math.floor((intPart % 1000000000) / 1000000);
  const thousands = Math.floor((intPart % 1000000) / 1000);
  const rest = intPart % 1000;

  const parts: string[] = [];

  if (billions > 0) {
    if (billions === 1) parts.push('مليار');
    else if (billions === 2) parts.push('ملياران');
    else if (billions >= 3 && billions <= 10) parts.push(`${convertGroup(billions)} مليارات`);
    else parts.push(`${convertGroup(billions)} مليار`);
  }

  if (millions > 0) {
    if (millions === 1) parts.push('مليون');
    else if (millions === 2) parts.push('مليونان');
    else if (millions >= 3 && millions <= 10) parts.push(`${convertGroup(millions)} ملايين`);
    else parts.push(`${convertGroup(millions)} مليون`);
  }

  if (thousands > 0) {
    if (thousands === 1) parts.push('ألف');
    else if (thousands === 2) parts.push('ألفان');
    else if (thousands >= 3 && thousands <= 10) parts.push(`${convertGroup(thousands)} آلاف`);
    else parts.push(`${convertGroup(thousands)} ألف`);
  }

  if (rest > 0) {
    parts.push(convertGroup(rest));
  }

  let text = parts.join(' و');
  if (number < 0) text = 'سالب ' + text;

  let result = `فقط ${text} ${currencyName}`;

  if (decPart > 0) {
    result += ` و ${convertGroup(decPart)} فلس/سنت`;
  }

  result += ' لا غير';
  return result;
}

/**
 * دالة إعادة الحسابات الرياضية والمالية بدقة 100% مطابقة لملف Excel
 */
export function calculateBOQMetrics(
  rawItems: Partial<BOQItem>[],
  threshold: number = 20
): { items: BOQItem[]; totals: TenderTotals } {
  let totalEstimated = 0;
  let totalBidder = 0;

  const preppedItems = rawItems.map((item, index) => {
    const itemNo = item.itemNo ?? index + 1;
    const quantity = Math.max(0, parseArabicNumber(item.quantity) || 0);
    const estimatedUnitPrice = parseArabicNumber(item.estimatedUnitPrice) || 0;
    const bidderUnitPrice = parseArabicNumber(item.bidderUnitPrice) || 0;

    const rawEstTotal = parseArabicNumber(item.estimatedTotal);
    const rawBidTotal = parseArabicNumber(item.bidderTotal);

    const estimatedTotal = rawEstTotal !== 0
      ? rawEstTotal
      : (quantity > 0 && estimatedUnitPrice > 0 ? quantity * estimatedUnitPrice : rawEstTotal);

    const bidderTotal = rawBidTotal !== 0
      ? rawBidTotal
      : (quantity > 0 && bidderUnitPrice > 0 ? quantity * bidderUnitPrice : rawBidTotal);

    totalEstimated += estimatedTotal;
    totalBidder += bidderTotal;

    const diffAmount = bidderTotal - estimatedTotal;
    const deviationPercent = estimatedTotal > 0 ? (diffAmount / estimatedTotal) * 100 : 0;
    const isDeviated = Math.abs(deviationPercent) > threshold;
    const deviatedAmount = isDeviated ? Math.abs(diffAmount) : 0;

    const enteredUnit = item.enteredUnitPrice !== undefined ? item.enteredUnitPrice : (bidderUnitPrice || (quantity > 0 ? bidderTotal / quantity : 0));
    const enteredTotal = item.enteredBidderTotal !== undefined ? item.enteredBidderTotal : bidderTotal;
    const writtenTxt = item.writtenText;

    const mathCalcTotal = enteredUnit > 0 && quantity > 1 ? (enteredUnit * quantity) : bidderTotal;
    const isMathError = item.hasMathError !== undefined 
      ? item.hasMathError 
      : (enteredUnit > 0 && quantity > 1 && Math.abs(mathCalcTotal - enteredTotal) > 0.01);

    let isTextDiscrepancy = item.hasTextDiscrepancy !== undefined ? item.hasTextDiscrepancy : false;
    if (writtenTxt && writtenTxt.length > 2 && item.hasTextDiscrepancy === undefined) {
      const parsedFromText = parseArabicTextToNumber(writtenTxt);
      if (parsedFromText !== null && parsedFromText > 0 && Math.abs(parsedFromText - enteredTotal) > 0.01) {
        isTextDiscrepancy = true;
      }
    }

    return {
      id: item.id || `item-${index + 1}-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      itemNo,
      description: item.description || `فقرة ${itemNo}`,
      unit: item.unit || 'عدد',
      quantity,
      estimatedUnitPrice: estimatedUnitPrice || (quantity > 0 ? estimatedTotal / quantity : 0),
      estimatedTotal,
      bidderUnitPrice: enteredUnit,
      bidderTotal,
      diffAmount,
      deviationPercent,
      isDeviated,
      deviatedAmount,
      priceRatio: 0,
      newPrice: 0,
      weightedUnitPrice: 0,
      sourcePage: item.sourcePage,
      sourceBox: item.sourceBox,
      notes: item.notes || '',
      flags: {
        isZeroPrice: bidderTotal === 0 && estimatedTotal > 0,
        isHighDeviation: deviationPercent > threshold,
        isAbnormallyLow: deviationPercent < -threshold,
        hasMathMismatch: isMathError
      },
      enteredUnitPrice: enteredUnit,
      enteredBidderTotal: enteredTotal,
      writtenText: writtenTxt,
      hasMathError: isMathError,
      hasTextDiscrepancy: isTextDiscrepancy,
      correctionRationale: isMathError ? 'تصحيح خطأ ضرب بالاعتداد بسعر المفرد (مادة 13/2)' : undefined
    };
  });

  const overallPriceRatio = totalEstimated > 0 ? totalBidder / totalEstimated : 0;

  let deviatedItemsSum = 0;
  let deviatedItemsCount = 0;
  let newPricesTotal = 0;

  const finalItems: BOQItem[] = preppedItems.map((item) => {
    const newPrice = Math.round((overallPriceRatio * item.estimatedTotal) * 100) / 100;
    const weightedUnitPrice = item.quantity > 0 ? newPrice / item.quantity : 0;

    if (item.isDeviated) {
      deviatedItemsSum += item.deviatedAmount;
      deviatedItemsCount += 1;
    }
    newPricesTotal += newPrice;

    return {
      ...item,
      priceRatio: overallPriceRatio,
      newPrice,
      weightedUnitPrice
    };
  });

  const overallDiffAmount = totalBidder - totalEstimated;
  const totalDeviationPercent = totalEstimated > 0 ? (overallDiffAmount / totalEstimated) * 100 : 0;
  const partialDeviationPercent = totalBidder > 0 ? (deviatedItemsSum / totalBidder) * 100 : 0;

  const totals: TenderTotals = {
    totalEstimatedAmount: Math.round(totalEstimated * 100) / 100,
    totalBidderAmount: Math.round(totalBidder * 100) / 100,
    overallDiffAmount: Math.round(overallDiffAmount * 100) / 100,
    overallPriceRatio,
    totalDeviationPercent: Math.round(totalDeviationPercent * 100) / 100,
    partialDeviationPercent: Math.round(partialDeviationPercent * 100) / 100,
    deviatedItemsSum: Math.round(deviatedItemsSum * 100) / 100,
    deviatedItemsCount,
    newPricesTotal: Math.round(newPricesTotal * 100) / 100
  };

  return { items: finalItems, totals };
}

export function formatNumber(val: number, decimals: number = 2): string {
  if (val === undefined || val === null || isNaN(val)) return '0.00';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(val);
}

export function formatPercent(val: number, decimals: number = 2): string {
  if (val === undefined || val === null || isNaN(val)) return '0.00%';
  const prefix = val > 0 ? '+' : '';
  return `${prefix}${formatNumber(val, decimals)}%`;
}

export function formatCurrency(val: number, currency: string = 'د.ع'): string {
  return `${formatNumber(val)} ${currency}`;
}

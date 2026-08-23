export interface BOQItem {
  id: string;
  itemNo: number | string;
  description: string;
  unit: string;
  quantity: number;
  estimatedUnitPrice: number;
  estimatedTotal: number;       // المبلغ التخميني
  bidderUnitPrice: number;
  bidderTotal: number;          // مبلغ المجهز
  diffAmount: number;           // فرق المبلغ = مبلغ المجهز - المبلغ التخميني
  deviationPercent: number;     // نسبة الانحراف = (فرق المبلغ / المبلغ التخميني) * 100
  isDeviated: boolean;          // هل انحرفت عن الحد المسموح
  deviatedAmount: number;       // الفقرة المنحرفة = IF(ABS(الانحراف) > الحد, ABS(فرق المبلغ), 0)
  priceRatio: number;           // النسبة السعرية الكلية (إجمالي المجهز / إجمالي التخميني)
  newPrice: number;             // السعر الجديد للمجهز = النسبة السعرية * المبلغ التخميني
  weightedUnitPrice: number;    // المفرد المجهز الموزون = السعر الجديد / الكمية
  sourcePage?: number;
  sourceBox?: { x: number; y: number; w: number; h: number };
  notes?: string;
  enteredUnitPrice?: number;       // سعر المفرد المدون
  enteredBidderTotal?: number;     // المبلغ المدون رقماً
  writtenText?: string;            // المبلغ المكتوب كتابةً
  hasMathError?: boolean;          // خطأ ضرب حسابي
  hasTextDiscrepancy?: boolean;    // تعارض تفقيط مع الرقم
  correctionRationale?: string;    // السند القانوني للتصحيح
  flags?: {
    isZeroPrice?: boolean;
    isHighDeviation?: boolean;
    isAbnormallyLow?: boolean;
    hasMathMismatch?: boolean;
  };
}

export interface TenderTotals {
  totalEstimatedAmount: number;
  totalBidderAmount: number;
  overallDiffAmount: number;
  overallPriceRatio: number;          // النسبة السعرية الإجمالية = مجموع المجهز / مجموع التخميني
  totalDeviationPercent: number;      // الانحراف الكلي = (مجموع المجهز - مجموع التخميني) / مجموع التخميني * 100
  partialDeviationPercent: number;    // الانحراف الجزئي = مجموع الفقرات المنحرفة / مجموع المجهز * 100
  deviatedItemsSum: number;           // مجموع مبالغ الفقرات المنحرفة
  deviatedItemsCount: number;         // عدد الفقرات المنحرفة
  newPricesTotal: number;             // مجموع الأسعار الجديدة الموزونة
}

export interface Bidder {
  id: string;
  name: string;
  commercialRecord?: string;
  taxNumber?: string;
  submissionDate: string;
  items: BOQItem[];
  totals: TenderTotals;
  status: 'pending' | 'qualified' | 'disqualified' | 'recommended' | 'awarded';
  technicalScore?: number;
  disqualificationReason?: string;
  notes?: string;
  enteredUnitPrice?: number;       // سعر المفرد المدون
  enteredBidderTotal?: number;     // المبلغ المدون رقماً
  writtenText?: string;            // المبلغ المكتوب كتابةً
  hasMathError?: boolean;          // خطأ ضرب حسابي
  hasTextDiscrepancy?: boolean;    // تعارض تفقيط مع الرقم
  correctionRationale?: string;    // السند القانوني للتصحيح
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userName: string;
  action: string;
  details: string;
  itemNo?: number | string;
  fieldName?: string;
  oldValue?: any;
  newValue?: any;
}

export interface TenderProject {
  id: string;
  title: string;
  referenceNumber: string;
  entityName: string;                 // الجهة المعلنة (الوزارة / المحافظة / الشركة)
  committeeChairman: string;          // رئيس لجنة التحليل
  committeeMembers: string[];         // أعضاء اللجنة
  currency: string;                   // العملة (د.ع / $ / ر.س ...)
  deviationThreshold: number;         // حد الانحراف المسموح (افتراضياً 20%)
  maxAllowedTotalDeviation?: number;  // الحد الأقصى المسموح للانحراف الكلي (مثلاً 15%)
  activeBidderId: string;
  bidders: Bidder[];
  auditLogs: AuditLogEntry[];
  originalDocument?: {
    name: string;
    type: 'image' | 'pdf' | 'excel';
    dataUrl?: string;
    uploadedAt: string;
  };
  createdAt: string;
  updatedAt: string;
}

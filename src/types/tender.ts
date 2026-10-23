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
  notes?: string;
  enteredUnitPrice?: number;       // سعر المفرد المدون
  // سعر المفرد كما دوّنه المجهز رقماً، يُحفظ حين تعتمد اللجنة التفقيط سعراً للمفرد فيحل محل enteredUnitPrice
  // (كان يُمحى فلا يبقى له أثر في جدول واقع الحال)، ويعود إليه السعر إن أُلغي التصحيح بتصحيح قراءة
  originalUnitPrice?: number;
  // التفقيط كما كتبه المجهز، يُحفظ حين تعتمد اللجنة تفقيطاً بعد إضافة «آلاف» الناقصة فيحل المعتمد محل writtenText
  originalWrittenText?: string;
  enteredBidderTotal?: number;     // المبلغ المدون رقماً
  writtenText?: string;            // المبلغ المكتوب كتابةً
  hasMathError?: boolean;          // خطأ ضرب حسابي
  hasTextDiscrepancy?: boolean;    // تعارض تفقيط مع الرقم
  correctionRationale?: string;    // السند القانوني للتصحيح
  unpriced?: boolean;              // الفقرة غير مسعّرة في العطاء نفسه («-» في خانة السعر)، كما قرأها الاستخراج
  pageNo?: number;                 // رقم صفحة الفقرة في عطاء المجهز كما قدّمه (لكل مجهز ترقيمه)
  // طبقة العرض الموزون (ضوابط رقم (4) سادساً/5): لا تمس ما دوّنه المجهز ولا ما بعد التصحيح الحسابي
  offerUnitPrice?: number;
  offerTotal?: number;
  // ما حُرّك به المفرد الموزون المرجعي لتسوية التقريب (weightedRounding.ts)، مثل 0.01
  weightedAdjustment?: number;
  // تأشير اللجنة على سعر غير معقول (خطأ تسعير لا حسابي)، للإحاطة والتبليغ فقط ولا يدخل في أي حساب
  unreasonablePrice?: { note: string; markedAt: string };
  // تأشير اللجنة أن المجهز حضر ووقّع وختم إزاء تصحيحها الحسابي لهذه الفقرة (ضوابط رقم (4) خامساً/ب/3)، بتاريخ
  // التأشير. لا معنى له إلا على فقرة مصحَّحة (isSignedCorrection)، ويسقط مع إلغاء التصحيح
  bidderSignedAt?: string;
}

// الحقول التي يُعدّ تعديلها اليدوي في الجدول تصحيحاً لما قُرئ من العطاء (handleCorrectReading في App.tsx)
export type ReadingField = 'quantity' | 'unitPrice' | 'total' | 'writtenText';

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
  weightedRoundingResidual?: number;  // ما تعذّرت تسويته من فرق تقريب الأسعار الموزونة (يظهر صراحة)
}

// مرحلة العرض الموزون لعطاء (ضوابط رقم (4) سادساً/5). paused: أُوقفت وبقيت تعديلاتها لتُستأنف
export interface WeightedOfferState {
  status: 'active' | 'adopted' | 'paused';
  origin: 'corrected' | 'formula';   // من أسعار العطاء بعد التصحيح، أو بالمعادلة (التخميني × النسبة)
  startedAt: string;
  adoptedAt?: string;
  bidTotal: number;                  // مبلغ العطاء بعد التصحيح عند البدء أو الاستئناف — مرجع المطابقة
}

export interface Bidder {
  id: string;
  name: string;
  commercialRecord?: string;
  submissionDate: string;
  items: BOQItem[];
  totals: TenderTotals;
  // المبلغ الإجمالي كما كتبه المجهز في عطائه، قبل التصحيح الحسابي (totals بعده — ضوابط رقم (4) خامساً/ب/6)
  statedTotal?: number;
  weightedOffer?: WeightedOfferState;
  status: 'pending' | 'qualified' | 'disqualified' | 'recommended' | 'awarded';
  notes?: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userName: string;
  action: string;
  details: string;
  itemNo?: number | string;
  bidderId?: string;      // المجهز الذي يخصه تعديل سعر (منذ 1.12.0)، ليُنسب اعتماد اللجنة إلى عطائه في التصدير
  fieldName?: string;
  oldValue?: any;
  newValue?: any;
}

/**
 * نوع العقد وفق تعليمات تنفيذ العقود الحكومية رقم (1) لسنة 2025 (المادة 1).
 * الخدمات الاستشارية غير مدعومة عمداً: تُفتح عروضها الفنية ثم التجارية بعد اكتمال التقييم
 * الفني (ضوابط رقم 4 ثانياً/3) ولا تُطرح بمناقصة عامة (المادة 6)، فلا يناسبها منطق «الأوطأ ضمن الحدود».
 */
export type ContractType = 'works' | 'supply' | 'services';

export type BudgetType = 'investment' | 'operating';

/** أسلوب التعاقد (المادة 6)، للعرض فقط. */
export type InvitationType = 'general' | 'limited' | 'twoStage' | 'direct' | 'singleSource';

export interface TenderProject {
  id: string;
  title: string;
  contractType?: ContractType;        // غير محدد في المناقصات المنشأة قبل الإصدار 1.4.0
  budgetType?: BudgetType;            // غير محدد في المناقصات المنشأة قبل الإصدار 1.18.0
  referenceNumber: string;
  entityName: string;                 // الجهة المعلنة (الوزارة / المحافظة / الشركة)
  // بيانات اختيارية للعرض فقط (منذ 1.19.0، انظر utils/tenderDetails.ts)
  announcementNo?: number;            // مرة الإعلان: 1 = الأول، 2 = الثاني …
  invitationType?: InvitationType;
  receivedBidsCount?: number;         // العطاءات المستلمة، وقد تزيد على المحلَّلة تجارياً
  beneficiaryEntity?: string;
  committeeChairman: string;          // رئيس لجنة التحليل
  committeeMembers: string[];         // أعضاء اللجنة
  currency: string;                   // العملة (د.ع / $ / ر.س ...)
  deviationThreshold: number;         // حد الفقرة المنحرفة (افتراضياً 20%)
  exclusionThreshold?: number;        // حد استبعاد العطاء بانحرافه الكلي؛ غائب = deviationThreshold (exclusionThresholdOf)
  thresholdBasis?: string;            // سند الحد المعتمد إن اختلف أحد الحدّين عن نص التعليمات (20%)
  activeBidderId: string;
  bidders: Bidder[];
  auditLogs: AuditLogEntry[];
  createdAt: string;
  updatedAt: string;
}

import { TenderProject, Bidder, AuditLogEntry, BOQItem } from '../types/tender';
import { calculateBOQMetrics, normalizeItemNo } from './calculations';
import { auditRowAmounts, isCommitteeCorrected } from './bidderAuditEngine';
import { localDate } from './localDate';

const STORAGE_KEY = 'antigravity_tenders_projects_v2';
const ACTIVE_PROJECT_KEY = 'antigravity_active_project_id_v2';

// البيانات الافتراضية الأولية من جدول التحليل
const SEED_ITEMS_SAMPLE: Partial<BOQItem>[] = [
  { itemNo: 1, description: 'أعمال تجهيز ونصب محولات كهربائية ومحطات ضخ سعة 400 KVA', unit: 'عدد', quantity: 30, estimatedUnitPrice: 303, estimatedTotal: 9090, bidderUnitPrice: 415, bidderTotal: 12450 },
  { itemNo: 2, description: 'أعمال مد أنابيب نفطية وكابلات أرضية مسلحة', unit: 'متر', quantity: 70, estimatedUnitPrice: 281, estimatedTotal: 19670, bidderUnitPrice: 360, bidderTotal: 25200 },
  { itemNo: 3, description: 'أعمال تجهيز وربط صمامات التحكم ولوحات توزيع رئيسية', unit: 'مجموعة', quantity: 80, estimatedUnitPrice: 165, estimatedTotal: 13200, bidderUnitPrice: 150, bidderTotal: 12000 },
  { itemNo: 4, description: 'فحص وتشغيل تجريبي لمنظومات السلامة والحماية من الحريق', unit: 'فقرة', quantity: 20, estimatedUnitPrice: 204, estimatedTotal: 4080, bidderUnitPrice: 235, bidderTotal: 4700 },
];

const SEED_BIDDER_2_SAMPLE: Partial<BOQItem>[] = [
  { itemNo: 1, description: 'أعمال تجهيز ونصب محولات كهربائية ومحطات ضخ سعة 400 KVA', unit: 'عدد', quantity: 30, estimatedUnitPrice: 303, estimatedTotal: 9090, bidderUnitPrice: 320, bidderTotal: 9600 },
  { itemNo: 2, description: 'أعمال مد أنابيب نفطية وكابلات أرضية مسلحة', unit: 'متر', quantity: 70, estimatedUnitPrice: 281, estimatedTotal: 19670, bidderUnitPrice: 290, bidderTotal: 20300 },
  { itemNo: 3, description: 'أعمال تجهيز وربط صمامات التحكم ولوحات توزيع رئيسية', unit: 'مجموعة', quantity: 80, estimatedUnitPrice: 165, estimatedTotal: 13200, bidderUnitPrice: 160, bidderTotal: 12800 },
  { itemNo: 4, description: 'فحص وتشغيل تجريبي لمنظومات السلامة والحماية من الحريق', unit: 'فقرة', quantity: 20, estimatedUnitPrice: 204, estimatedTotal: 4080, bidderUnitPrice: 210, bidderTotal: 4200 },
];

export function createDefaultProject(): TenderProject {
  const calc1 = calculateBOQMetrics(SEED_ITEMS_SAMPLE, 20);
  const calc2 = calculateBOQMetrics(SEED_BIDDER_2_SAMPLE, 20);

  const bidder1: Bidder = {
    id: 'bidder-1',
    name: 'شركة النور للمقاولات العامة والتجهيزات',
    commercialRecord: 'CR-98421',
    submissionDate: localDate(),
    items: calc1.items,
    totals: calc1.totals,
    status: 'pending',
    notes: 'العطاء مكتمل الوثائق والمستمسكات الفنية والضمان الابتدائي'
  };

  const bidder2: Bidder = {
    id: 'bidder-2',
    name: 'شركة الفرات للتجارة والمقاولات الهندسية',
    commercialRecord: 'CR-11204',
    submissionDate: localDate(),
    items: calc2.items,
    totals: calc2.totals,
    status: 'recommended',
    notes: 'أسعار متوازنة مع انحراف كلي وجزئي منخفض جداً'
  };

  const initialLog: AuditLogEntry = {
    id: 'log-seed-1',
    timestamp: new Date().toISOString(),
    userName: 'المهندس أسامة خليل هاشم',
    action: 'إنشاء المناقصة',
    details: 'تم استيراد الكلفة التخمينية وعطاءات المجهزين الأولية بنجاح'
  };

  return {
    id: 'project-1',
    title: 'مشروع تطوير وتجهيز محطات العزل والضخ المركزية',
    referenceNumber: 'TND-2026-084',
    entityName: 'الجهة المتعاقدة',
    committeeChairman: 'المهندس أسامة خليل هاشم (رئيس لجنة التحليل والتقييم)',
    committeeMembers: [
      'م. علي جاسم محمد (عضو فني ومقرر)', 
      'الحقوقي حيدر عبد الكريم (عضو قانوني)', 
      'المحاسب كرار عبد الرضا (عضو مالي)'
    ],
    currency: 'د.ع',
    deviationThreshold: 20,
    activeBidderId: bidder1.id,
    bidders: [bidder1, bidder2],
    auditLogs: [initialLog],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

/**
 * مناقصة جديدة يُنشئها المستخدم: فارغة تماماً (لا بيانات تجريبية ولا بيانات مناقصة أخرى)،
 * بشركة لكل اسم مُدخل وجدول مصفّر. كانت تُنشأ سابقاً من createDefaultProject فتحمل
 * شركتي العرض التجريبي وفقراته وأعضاء لجنته.
 */
export function createNewTenderProject(opts: {
  title: string;
  referenceNumber: string;
  contractType: TenderProject['contractType'];
  budgetType: TenderProject['budgetType'];
  bidderNames: string[];
}): TenderProject {
  const now = Date.now();
  // فقرة أولى فارغة موحّدة الهوية بين الشركات (calculateBOQMetrics يفترض تطابق الفقرات)
  const blankItem: Partial<BOQItem> = { itemNo: 1, description: 'فقرة 1', quantity: 1, estimatedTotal: 0, bidderTotal: 0 };
  const names = opts.bidderNames.map(n => n.trim()).filter(Boolean);

  const bidders: Bidder[] = (names.length > 0 ? names : ['شركة جديدة']).map((name, i) => {
    const calc = calculateBOQMetrics([blankItem], 20);
    return {
      id: `bidder-${now}-${i}`,
      name,
      submissionDate: localDate(),
      items: calc.items,
      totals: calc.totals,
      status: 'pending'
    };
  });

  return {
    id: `project-${now}`,
    title: opts.title,
    contractType: opts.contractType,
    budgetType: opts.budgetType,
    referenceNumber: opts.referenceNumber,
    entityName: '',
    committeeChairman: '',
    committeeMembers: [],
    currency: 'د.ع',
    deviationThreshold: 20,
    activeBidderId: bidders[0].id,
    bidders,
    auditLogs: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

/**
 * إعادة ضبط النظام بالكامل: مسح كل المشاريع والمناقصات المخزنة محلياً. يبقى النظام بلا أي مناقصة
 * (تظهر شاشة البداية) ولا تُنشأ مناقصة فارغة تلقائياً
 */
export function resetAllData(): void {
  localStorage.removeItem(ACTIVE_PROJECT_KEY);
  saveAllProjects([]);
}

// حقول هوية الفقرة والكلفة التخمينية يجب أن تكون موحّدة بين كل مجهزي المشروع (راجع calculateBOQMetrics وApp.tsx)
const SHARED_ESTIMATE_FIELDS: (keyof BOQItem)[] = ['itemNo', 'description', 'unit', 'quantity', 'estimatedUnitPrice', 'estimatedTotal'];

/**
 * توحيد هوية الفقرات والكلفة التخمينية بين كل مجهزي مشروع محفوظ مسبقاً (قد تكون بيانات قديمة
 * سبقت اعتماد مبدأ "كلفة تخمينية واحدة للمشروع" فتباعدت بين المجهزين). تُطبَّق تلقائياً عند كل تحميل
 * دون المساس بأسعار أي مجهز الخاصة به، وترجع المشروع كما هو إن لم يوجد أي تباعد فعلي.
 */
function reconcileProjectSharedFields(project: TenderProject): TenderProject {
  if (!project.bidders || project.bidders.length <= 1) return project;

  const maxLen = Math.max(...project.bidders.map(b => b.items?.length || 0));
  if (maxLen === 0) return project;

  // القيمة المرجعية لكل فقرة = قيمها لدى أول مجهز يملكها (بترتيب المجهزين في المشروع)
  const referenceItems: Partial<BOQItem>[] = [];
  for (let i = 0; i < maxLen; i++) {
    const source = project.bidders.find(b => b.items[i])?.items[i];
    referenceItems.push(source || {});
  }

  let changed = false;
  const updatedBidders = project.bidders.map(b => {
    const updatedRaw: Partial<BOQItem>[] = referenceItems.map((ref, i) => {
      const existing = b.items[i];
      const merged: Partial<BOQItem> = { ...(existing || {}) };
      SHARED_ESTIMATE_FIELDS.forEach(f => {
        if ((existing as any)?.[f] !== (ref as any)[f]) changed = true;
        (merged as any)[f] = (ref as any)[f];
      });
      if (!existing) {
        merged.bidderTotal = 0;
        changed = true;
      }
      return merged;
    });

    const recalc = calculateBOQMetrics(updatedRaw, project.deviationThreshold);
    return { ...b, items: recalc.items, totals: recalc.totals };
  });

  if (!changed) return project;

  return addAuditLog(
    { ...project, bidders: updatedBidders, updatedAt: new Date().toISOString() },
    'توحيد الكلفة التخمينية تلقائياً',
    'اكتُشف تباعد في هوية الفقرات أو الكلفة التخمينية بين المجهزين (من بيانات سابقة لاعتماد التوحيد)، وتمت مزامنتها تلقائياً دون المساس بأسعار أي مجهز'
  );
}

/**
 * علامتا التدقيق تُخزَّنان ولا يعيد calculateBOQMetrics حسابهما، فتبقى علامة حسبها محلل أقدم وإن صارت خاطئة
 * (الفقرة 41)، وقد تغيب علامة. عند كل تحميل واستعادة يُعاد فحص الفقرات التي لم تمسها اللجنة بأرقامها المسجلة،
 * ويُسجَّل كل تغيير. لا تُمس الفقرة المصحَّحة (isCommitteeCorrected)، ولا فقرة لها مبلغ بلا رقم مدون (قد يكون
 * من إدخال اللجنة)
 */
function recheckStoredFlags(project: TenderProject): TenderProject {
  const changes: { bidder: Bidder; itemNo: number | string; details: string[] }[] = [];
  const bidders = project.bidders.map(b => {
    let changed = false;
    const items = b.items.map(item => {
      if (isCommitteeCorrected(item)) return item;
      const stated = item.enteredBidderTotal ?? item.bidderTotal;
      if (!(stated > 0) && item.bidderTotal > 0) return item;
      const flags = auditRowAmounts(item.quantity, item.enteredUnitPrice || 0, stated, item.writtenText);
      const details: string[] = [];
      if (!!item.hasMathError !== flags.hasMathError) details.push(flags.hasMathError ? 'أُشّر خطأ ضرب' : 'أُزيلت علامة خطأ الضرب');
      if (!!item.hasTextDiscrepancy !== flags.hasTextDiscrepancy) details.push(flags.hasTextDiscrepancy ? 'أُشّر تعارض تفقيط' : 'أُزيلت علامة تعارض التفقيط');
      if (details.length === 0) return item;
      changed = true;
      changes.push({ bidder: b, itemNo: item.itemNo, details });
      return {
        ...item,
        ...flags,
        correctionRationale: flags.hasMathError ? 'تصحيح خطأ ضرب بالاعتداد بسعر المفرد' : undefined
      };
    });
    return changed ? { ...b, items } : b;
  });
  if (changes.length === 0) return project;

  return changes.reduce((p, c) => addAuditLog(
    p,
    'إعادة فحص تلقائية',
    `أُعيد فحص الفقرة رقم (${c.itemNo}) في عطاء (${c.bidder.name}) بأرقامها المسجلة: ${c.details.join('، و')}`,
    { itemNo: c.itemNo, bidderId: c.bidder.id }
  ), { ...project, bidders, updatedAt: new Date().toISOString() });
}

// أرقام فقرات قُرئت قبل توحيدها (normalizeItemNo) بالأرقام المشرقية في صفحات وبالإنجليزية في أخرى.
// يمس رقم الفقرة وحده لا أي مبلغ، ويسبق توحيد الحقول المشتركة فلا يُعدّ «١٩٧» و«197» تباعداً بين المجهزين.
// السجل يبقى بأرقامه كما كُتب، ويطابقه التصدير بعد توحيد الطرفين (findAdoption)
function latinizeItemNumbers(project: TenderProject): TenderProject {
  const rows = new Set<number>(); // الفقرة مشتركة بين المجهزين فتُعد مرة واحدة
  const bidders = project.bidders.map(b => {
    let changed = false;
    const items = b.items.map((item, i) => {
      const itemNo = normalizeItemNo(item.itemNo);
      if (itemNo === item.itemNo) return item;
      changed = true;
      rows.add(i);
      return { ...item, itemNo };
    });
    return changed ? { ...b, items } : b;
  });
  if (rows.size === 0) return project;

  return addAuditLog(
    { ...project, bidders, updatedAt: new Date().toISOString() },
    'توحيد أرقام الفقرات',
    `كُتبت أرقام (${rows.size}) فقرة بالأرقام الإنجليزية بدل المشرقية كباقي الجدول، دون المساس بأي مبلغ`
  );
}

// الانحراف الكلي كان يُخزَّن بمنزلتين فيُستبعد بالمقارنة المقرَّبة: 20.004% تُخزَّن 20.00 فلا تتجاوز الحد.
// تُعاد النسبة إلى دقتها من المبلغين المخزَّنين دون مس أي مبلغ أو علامة، ويُسجَّل في السجل فقط ما انقلب حكمه
function refreshDeviationPrecision(project: TenderProject): TenderProject {
  const threshold = project.deviationThreshold;
  const flips: { bidder: Bidder; was: number; now: number }[] = [];
  const bidders = project.bidders.map(b => {
    const t = b.totals;
    if (!t || !(t.totalEstimatedAmount > 0)) return b;
    const now = Math.round(((t.totalBidderAmount - t.totalEstimatedAmount) / t.totalEstimatedAmount) * 100 * 1e6) / 1e6;
    if (!Number.isFinite(now) || now === t.totalDeviationPercent) return b;
    if ((Math.abs(t.totalDeviationPercent) > threshold) !== (Math.abs(now) > threshold)) {
      flips.push({ bidder: b, was: t.totalDeviationPercent, now });
    }
    return { ...b, totals: { ...t, totalDeviationPercent: now } };
  });
  if (bidders.every((b, i) => b === project.bidders[i])) return project;

  return flips.reduce((p, f) => addAuditLog(
    p,
    'إعادة فحص تلقائية',
    `الانحراف الكلي لعطاء (${f.bidder.name}) بدقته الكاملة ${f.now}% لا ${f.was}% المخزَّنة مقرَّبة، فتغيّر حكم الاستبعاد بالنسبة إلى الحد (±${threshold}%)`,
    { bidderId: f.bidder.id }
  ), { ...project, bidders, updatedAt: new Date().toISOString() });
}

// قبل 1.15.0 كانت الأسعار الموزونة تُخزَّن غير مقرّبة ولا تساوي مجموعها مبلغ العطاء (ولا باقي مخزَّن). تُعاد حسابها
// بالتسوية الحالية لتبدأ منها «بدء العرض بالمعادلة» والمحضر، دون مس أي مبلغ أو علامة: حقولها فقط
export function refreshWeightedPrices(project: TenderProject): TenderProject {
  let changed = false;
  const bidders = project.bidders.map(b => {
    if (!b.totals || b.totals.weightedRoundingResidual !== undefined || b.items.length === 0) return b;
    const fresh = calculateBOQMetrics(b.items, project.deviationThreshold);
    changed = true;
    return {
      ...b,
      items: b.items.map((it, i) => ({
        ...it,
        newPrice: fresh.items[i].newPrice,
        weightedUnitPrice: fresh.items[i].weightedUnitPrice,
        weightedAdjustment: fresh.items[i].weightedAdjustment
      })),
      totals: { ...b.totals, newPricesTotal: fresh.totals.newPricesTotal, weightedRoundingResidual: fresh.totals.weightedRoundingResidual }
    };
  });
  return changed ? { ...project, bidders } : project;
}

// نوع الموازنة أُضيف في 1.18.0، وكل مناقصات المستخدم قبله على الموازنة التشغيلية (قراره 2026-10-21)، فتأخذه
// المناقصة التي لا نوع لها مرة واحدة مع قيد في السجل، ويُغيَّر من الإعدادات. القيمة غير المعروفة (من إصدار أحدث) لا تُمس
export function defaultLegacyBudgetType(project: TenderProject): TenderProject {
  if (project.budgetType !== undefined) return project;
  return addAuditLog(
    { ...project, budgetType: 'operating', updatedAt: new Date().toISOString() },
    'تعديل إعدادات المناقصة',
    'حُدد نوع الموازنة (تشغيلية) تلقائياً لمناقصة أُنشئت قبل إضافة هذا الحقل؛ يُغيَّر من إعدادات المناقصة إن كانت استثمارية'
  );
}

// كل مشروع يُحمَّل أو يُستعاد: توحيد أرقام الفقرات والحقول المشتركة ثم إعادة فحص العلامات المخزنة
const normalizeLoadedProject = (project: TenderProject) =>
  defaultLegacyBudgetType(refreshWeightedPrices(refreshDeviationPrecision(recheckStoredFlags(reconcileProjectSharedFields(latinizeItemNumbers(project))))));

// نسخ من نص مخزَّن لم يُقرأ كمشاريع: لا يُكتب فوق شيء قبل حفظه هنا، وتُعرض للمستخدم لينزّله
const RECOVERY_KEY = 'antigravity_tenders_recovery_v1';
const RECOVERY_LIMIT = 5;

export interface RecoveredData {
  at: string;
  reason: string;
  raw: string;
}

// ما تعذّر حفظه في التخزين (امتلاء/حظر) يُبقى في الذاكرة ليُنزَّل، ويُوقَف الحفظ ما دامت النسخة الوحيدة
// هي النص الأصلي: حفظ قائمة المشاريع فوقه كان سيُتلفه دون نسخة
let memoryRecovered: RecoveredData[] = [];
let saveBlocked = false;

export const isSaveBlocked = (): boolean => saveBlocked;

function storedRecovered(): RecoveredData[] {
  try {
    const list = JSON.parse(localStorage.getItem(RECOVERY_KEY) || '[]');
    return Array.isArray(list) ? list : [];
  } catch { return []; }
}

export function getRecoveredData(): RecoveredData[] {
  return [...storedRecovered(), ...memoryRecovered];
}

// يُستدعى بعد أن نزّل المستخدم النسخة أو تجاهلها: يُستأنف الحفظ العادي
export function clearRecoveredData(): void {
  memoryRecovered = [];
  saveBlocked = false;
  try { localStorage.removeItem(RECOVERY_KEY); } catch { /* تخزين محظور: لا شيء */ }
}

function stashRecovered(raw: string, reason: string): void {
  const entry: RecoveredData = { at: new Date().toISOString(), reason, raw };
  try {
    const list = storedRecovered();
    if (list.some(e => e.raw === raw)) return; // القراءة تتكرر في الجلسة نفسها
    list.push(entry);
    localStorage.setItem(RECOVERY_KEY, JSON.stringify(list.slice(-RECOVERY_LIMIT)));
  } catch {
    if (!memoryRecovered.some(e => e.raw === raw)) memoryRecovered.push(entry);
    saveBlocked = true;
  }
}

const looksLikeProject = (p: unknown): p is TenderProject =>
  !!p && typeof p === 'object' && Array.isArray((p as TenderProject).bidders);

export function getAllProjects(): TenderProject[] {
  const data = localStorage.getItem(STORAGE_KEY);
  if (!data) {
    const defaultProject = createDefaultProject();
    saveAllProjects([defaultProject]);
    return [defaultProject];
  }

  // نص لا يُقرأ قائمة مشاريع: يُحفظ كما هو في مفتاح الاسترداد قبل أن يكتب App فوقه قائمة فارغة
  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch {
    stashRecovered(data, 'نص البيانات المحفوظة تالف ولا يُقرأ');
    return [];
  }
  if (!Array.isArray(parsed)) {
    stashRecovered(data, 'البيانات المحفوظة ليست قائمة مناقصات');
    return [];
  }

  // كل مشروع على حدة: عطل في واحد لا يُسقط المناقصات الأخرى
  const projects: TenderProject[] = [];
  const unusable: unknown[] = [];
  parsed.forEach(entry => {
    if (!looksLikeProject(entry)) { unusable.push(entry); return; }
    try {
      projects.push(normalizeLoadedProject(entry));
    } catch {
      projects.push(entry); // فشل التوحيد لا يمنع عرض المشروع كما حُفظ
    }
  });

  if (unusable.length > 0) {
    stashRecovered(JSON.stringify(unusable), `${unusable.length} عنصر محفوظ لا يُقرأ كمناقصة`);
  }
  if (unusable.length > 0 || projects.some((p, i) => p !== parsed[i])) {
    saveAllProjects(projects);
  }
  return projects;
}

export function saveAllProjects(projects: TenderProject[]): void {
  if (saveBlocked) return; // انظر stashRecovered: النص الأصلي لم تُحفظ له نسخة بعد
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}

export function getActiveProjectId(): string {
  const id = localStorage.getItem(ACTIVE_PROJECT_KEY);
  if (id) return id;
  const all = getAllProjects();
  return all[0]?.id || 'project-1';
}

export function setActiveProjectId(id: string): void {
  localStorage.setItem(ACTIVE_PROJECT_KEY, id);
}

interface SavePickerWindow {
  showSaveFilePicker?: (options: object) => Promise<FileSystemFileHandle>;
}

// نافذة «حفظ باسم» إن دعمها المتصفح (Chrome/Edge): يختار المستخدم مجلد النسخ الاحتياطية مرة،
// ويفتح عليه المتصفح في المرات التالية (id). وإلا يُنزَّل الملف كما كان. يعيد false إن ألغى المستخدم الحفظ.
// النص يُبنى قبل فتح النافذة: النافذة تحتاج ضغطة المستخدم نفسها، والنسخة تحوي البيانات لحظة الضغط.
async function saveJsonFile(fileName: string, data: unknown, description = 'نسخة احتياطية (JSON)'): Promise<boolean> {
  const text = JSON.stringify(data, null, 2);
  const w = window as unknown as SavePickerWindow;
  if (w.showSaveFilePicker) {
    try {
      const handle = await w.showSaveFilePicker({
        suggestedName: fileName,
        id: 'tender-backups',
        types: [{ description, accept: { 'application/json': ['.json'] } }]
      });
      const writable = await handle.createWritable();
      await writable.write(text);
      await writable.close();
      return true;
    } catch (err) {
      if ((err as DOMException)?.name === 'AbortError') return false;
      // النافذة غير مسموحة هنا أو تعذّرت الكتابة: التنزيل العادي
    }
  }

  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return true;
}

// تنزيل البيانات التي تعذّرت قراءتها بنافذة الحفظ نفسها: يعيد false إن ألغى المستخدم الحفظ، فلا تُعدّ منزّلة
// ويبقى تأكيد ✕ قبل حذفها. كان التنزيل بالرابط يعدّها منزّلة ولو أُلغي أو مُنع
export function downloadRecoveredData(entries: RecoveredData[]): Promise<boolean> {
  return saveJsonFile(`بيانات_مناقصات_تعذرت_قراءتها_${localDate()}.json`, entries, 'بيانات تعذّرت قراءتها (JSON)');
}

/**
 * تنزيل نسخة احتياطية كاملة لمشروع واحد كملف JSON
 * يتيح نقل المشروع بكامل بياناته (المجهزين، الأسعار، سجل التدقيق) إلى جهاز آخر
 * دون الاعتماد على localStorage للجهاز الحالي فقط.
 * يعيد وقت النسخة إن حُفظت، أو null إن ألغى المستخدم الحفظ.
 */
export async function downloadProjectBackup(project: TenderProject): Promise<string | null> {
  const exportedAt = new Date().toISOString();
  const backup = { __type: 'boc-tender-backup', __version: 1, exportedAt, project };
  const safeTitle = (project.title || 'مناقصة').replace(/[\\/:*?"<>|]/g, '_');
  const saved = await saveJsonFile(`نسخة_احتياطية_${safeTitle}_${localDate(new Date(exportedAt))}.json`, backup);
  return saved ? exportedAt : null;
}

/**
 * تنزيل نسخة احتياطية شاملة لكل المناقصات/الطلبيات المحفوظة محلياً في ملف JSON واحد
 * (بديل عن downloadProjectBackup التي تُصدّر مناقصة واحدة فقط).
 * يعيد وقت النسخة إن حُفظت، أو null إن ألغى المستخدم الحفظ.
 */
export async function downloadAllProjectsBackup(projects: TenderProject[]): Promise<string | null> {
  const exportedAt = new Date().toISOString();
  const backup = { __type: 'boc-tender-backup-all', __version: 1, exportedAt, projectsCount: projects.length, projects };
  const saved = await saveJsonFile(`نسخة_احتياطية_شاملة_كل_المناقصات_${localDate(new Date(exportedAt))}.json`, backup);
  return saved ? exportedAt : null;
}

/**
 * قراءة والتحقق من صحة ملف نسخة احتياطية شاملة (كل المناقصات) قبل استعادتها
 */
export function parseAllProjectsBackupFile(file: File): Promise<TenderProject[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const raw = JSON.parse(e.target?.result as string);
        const projects: TenderProject[] = raw?.__type === 'boc-tender-backup-all' && Array.isArray(raw.projects)
          ? raw.projects
          : (Array.isArray(raw) ? raw : null);

        if (!projects || projects.length === 0 || !projects.every(p => p && typeof p === 'object' && Array.isArray(p.bidders) && p.title)) {
          reject(new Error('الملف المختار ليس نسخة احتياطية شاملة صالحة لهذا النظام'));
          return;
        }

        resolve(projects.map(normalizeLoadedProject));
      } catch {
        reject(new Error('تعذر قراءة الملف: تأكد من أنه ملف نسخة احتياطية (JSON) سليم'));
      }
    };
    reader.onerror = () => reject(new Error('تعذر قراءة الملف من القرص'));
    reader.readAsText(file);
  });
}

/**
 * قراءة والتحقق من صحة ملف نسخة احتياطية (JSON) قبل استيراده كمشروع جديد
 */
export function parseProjectBackupFile(file: File): Promise<TenderProject> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const raw = JSON.parse(e.target?.result as string);
        const project: TenderProject = raw?.project && raw?.__type === 'boc-tender-backup' ? raw.project : raw;

        if (!project || typeof project !== 'object' || !Array.isArray(project.bidders) || !project.title) {
          reject(new Error('الملف المختار ليس نسخة احتياطية صالحة لهذا النظام'));
          return;
        }

        resolve(normalizeLoadedProject(project));
      } catch {
        reject(new Error('تعذر قراءة الملف: تأكد من أنه ملف نسخة احتياطية (JSON) سليم'));
      }
    };
    reader.onerror = () => reject(new Error('تعذر قراءة الملف من القرص'));
    reader.readAsText(file);
  });
}

export function addAuditLog(
  project: TenderProject,
  action: string,
  details: string,
  extra?: { itemNo?: string | number; bidderId?: string; oldValue?: any; newValue?: any; userName?: string }
): TenderProject {
  const newLog: AuditLogEntry = {
    id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    timestamp: new Date().toISOString(),
    userName: extra?.userName || 'م. أسامة خليل هاشم',
    action,
    details,
    itemNo: extra?.itemNo,
    bidderId: extra?.bidderId,
    oldValue: extra?.oldValue,
    newValue: extra?.newValue
  };

  return {
    ...project,
    auditLogs: [newLog, ...(project.auditLogs || [])],
    updatedAt: new Date().toISOString()
  };
}

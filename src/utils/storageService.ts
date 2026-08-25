import { TenderProject, Bidder, AuditLogEntry, BOQItem } from '../types/tender';
import { calculateBOQMetrics } from './calculations';

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
    name: 'شركة النور للمقاولات العامة والتجهيزات النفطية',
    commercialRecord: 'CR-98421-BOC',
    submissionDate: new Date().toISOString().split('T')[0],
    items: calc1.items,
    totals: calc1.totals,
    status: 'pending',
    notes: 'العطاء مكتمل الوثائق والمستمسكات الفنية والضمان الابتدائي'
  };

  const bidder2: Bidder = {
    id: 'bidder-2',
    name: 'شركة الفرات للتجارة والمقاولات الهندسية',
    commercialRecord: 'CR-11204-BOC',
    submissionDate: new Date().toISOString().split('T')[0],
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
    id: 'project-boc-1',
    title: 'مشروع تطوير وتجهيز محطات العزل والضخ المركزية - هيأة حقول النفط',
    referenceNumber: 'BOC-TND-2026-084',
    entityName: 'وزارة النفط - شركة نفط البصرة (BOC)',
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
 * مشروع فارغ تماماً بلا بيانات تجريبية (مجهز واحد فارغ، كلفة تخمينية صفرية)
 * يُستخدم عند إعادة ضبط النظام بالكامل استعداداً لتسليمه لجهاز/مستخدم جديد
 */
export function createBlankProject(): TenderProject {
  const blankItem: Partial<BOQItem> = { itemNo: 1, description: 'فقرة 1', quantity: 1, estimatedTotal: 0, bidderTotal: 0 };
  const calc = calculateBOQMetrics([blankItem], 20);

  const bidder: Bidder = {
    id: `bidder-${Date.now()}`,
    name: 'شركة جديدة',
    submissionDate: new Date().toISOString().split('T')[0],
    items: calc.items,
    totals: calc.totals,
    status: 'pending'
  };

  return {
    id: `project-${Date.now()}`,
    title: 'طلبية / مناقصة جديدة',
    referenceNumber: '',
    entityName: 'وزارة النفط - شركة نفط البصرة (BOC)',
    committeeChairman: '',
    committeeMembers: [],
    currency: 'د.ع',
    deviationThreshold: 20,
    activeBidderId: bidder.id,
    bidders: [bidder],
    auditLogs: [{
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      userName: 'النظام',
      action: 'إعادة ضبط النظام',
      details: 'تم مسح كافة البيانات السابقة والبدء بمشروع فارغ جديد'
    }],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

/**
 * إعادة ضبط النظام بالكامل: مسح كل المشاريع والمناقصات المخزنة محلياً
 * والبدء بمشروع فارغ واحد فقط (بلا بيانات تجريبية)
 */
export function resetAllData(): TenderProject {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(ACTIVE_PROJECT_KEY);
  const blank = createBlankProject();
  saveAllProjects([blank]);
  setActiveProjectId(blank.id);
  return blank;
}

export function getAllProjects(): TenderProject[] {
  const data = localStorage.getItem(STORAGE_KEY);
  if (!data) {
    const defaultProject = createDefaultProject();
    saveAllProjects([defaultProject]);
    return [defaultProject];
  }
  try {
    return JSON.parse(data);
  } catch {
    const defaultProject = createDefaultProject();
    saveAllProjects([defaultProject]);
    return [defaultProject];
  }
}

export function saveAllProjects(projects: TenderProject[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}

export function getActiveProjectId(): string {
  const id = localStorage.getItem(ACTIVE_PROJECT_KEY);
  if (id) return id;
  const all = getAllProjects();
  return all[0]?.id || 'project-boc-1';
}

export function setActiveProjectId(id: string): void {
  localStorage.setItem(ACTIVE_PROJECT_KEY, id);
}

/**
 * تنزيل نسخة احتياطية كاملة لمشروع واحد كملف JSON
 * يتيح نقل المشروع بكامل بياناته (المجهزين، الأسعار، سجل التدقيق) إلى جهاز آخر
 * دون الاعتماد على localStorage للجهاز الحالي فقط
 */
export function downloadProjectBackup(project: TenderProject): void {
  const backup = {
    __type: 'boc-tender-backup',
    __version: 1,
    exportedAt: new Date().toISOString(),
    project
  };

  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const safeTitle = (project.title || 'مناقصة').replace(/[\\/:*?"<>|]/g, '_');

  const link = document.createElement('a');
  link.href = url;
  link.download = `نسخة_احتياطية_${safeTitle}_${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
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

        resolve(project);
      } catch (err) {
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
  extra?: { itemNo?: string | number; oldValue?: any; newValue?: any; userName?: string }
): TenderProject {
  const newLog: AuditLogEntry = {
    id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    timestamp: new Date().toISOString(),
    userName: extra?.userName || 'م. أسامة خليل هاشم',
    action,
    details,
    itemNo: extra?.itemNo,
    oldValue: extra?.oldValue,
    newValue: extra?.newValue
  };

  return {
    ...project,
    auditLogs: [newLog, ...(project.auditLogs || [])],
    updatedAt: new Date().toISOString()
  };
}

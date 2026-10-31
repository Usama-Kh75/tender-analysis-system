import type { StatusBranch, StatusEntry, StatusStage, TenderProject } from '../types/tender';
import { announcementLabel } from './tenderDetails';

/**
 * موقف الطلبية: سجل وعرض فقط، لا يدخل في أي حساب أو توصية.
 * الموقف الحالي هو آخر إدخال في السجل لا الأحدث تاريخاً.
 */

export const STAGE_ORDER: StatusStage[] = ['analysis', 'audit', 'returnedFromAudit', 'reviewCommittee', 'sentToContracts', 'readvertise', 'other'];

export const STAGE_LABELS: Record<StatusStage, string> = {
  analysis: 'قيد التحليل',
  audit: 'لدى قسم الرقابة والتدقيق الداخلي',
  returnedFromAudit: 'معادة من التدقيق إلى اللجنة',
  reviewCommittee: 'لدى لجنة المراجعة',
  sentToContracts: 'أُرسلت إلى العقود',
  readvertise: 'إعادة إعلان',
  other: 'إجراء آخر'
};

export const BRANCHES_OF: Record<StatusStage, StatusBranch[]> = {
  analysis: ['technical', 'commercial', 'documents'],
  audit: [],
  returnedFromAudit: [],
  reviewCommittee: ['negotiation'],
  sentToContracts: [],
  readvertise: [],
  other: []
};

export const BRANCH_LABELS: Record<StatusBranch, string> = {
  technical: 'بانتظار نتيجة التحليل الفني من الجهة الطالبة',
  commercial: 'التحليل التجاري',
  documents: 'استكمال الوثائق (مخاطبة المشتريات المحلية)',
  negotiation: 'قيد التفاوض'
};

const isStage = (v: unknown): v is StatusStage => typeof v === 'string' && Object.hasOwn(STAGE_LABELS, v);

/** تاريخ صالح = YYYY-MM-DD يقرؤه Date ويعيد كتابته بالتنسيق نفسه. */
function isValidDate(v: unknown): v is string {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

export function statusText(e: StatusEntry): string {
  if (e.stage === 'other') return e.customText ?? '';
  // مرحلة غير معروفة (من نسخة أحدث) تُعامل «غير محدد» ولا تُحذف
  if (!isStage(e.stage)) return 'غير محدد';
  const label = STAGE_LABELS[e.stage];
  return e.branch ? `${label}: ${BRANCH_LABELS[e.branch]}` : label;
}

export function validateStatusEntry(e: Pick<StatusEntry, 'stage' | 'branch' | 'customText' | 'memoDate'>): string | null {
  if (!isStage(e.stage)) return 'الإجراء غير معروف';
  if (e.stage === 'other' && !e.customText?.trim()) return 'اكتب نص الإجراء الآخر';
  if (e.branch && !BRANCHES_OF[e.stage].includes(e.branch)) return 'الفرع المختار لا يتبع هذا الإجراء';
  if (!isValidDate(e.memoDate)) return 'تاريخ المذكرة أو الإجراء غير صالح';
  return null;
}

/** فروع الإجراء؛ فارغة لإجراء مجهول (من نسخة أحدث) بدل أن ترمي. */
export const branchesOf = (stage: string): StatusBranch[] => (isStage(stage) ? BRANCHES_OF[stage] : []);

const isText = (v: unknown): v is string => typeof v === 'string';

/**
 * ينظّف السجل المحمَّل. يُبقي عناصره نفسها (مراجعها) حين لا يتغير شيء، فلا تُنسخ مناقصة سليمة.
 * المرحلة المجهولة تبقى (تُعرض «غير محدد») كي لا يتحول الموقف الحالي بصمت إلى إدخال سابق؛ والمعرّف
 * المفقود أو المكرر يُستبدل بمعرّف جديد؛ والفرع الذي لا يتبع إجراءه، والنص الذي ليس نصاً، يُحذفان.
 */
export function sanitizeStatusLog(raw: unknown): StatusEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: StatusEntry[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const e = item as StatusEntry;
    if (typeof e.stage !== 'string' || !isValidDate(e.memoDate)) continue;
    let copy: Record<string, unknown> | null = null;
    const edit = () => (copy ??= { ...e });
    if (!isText(e.id) || e.id === '' || seen.has(e.id)) edit().id = `status-fix-${out.length}-${Math.random().toString(36).substring(2, 8)}`;
    if (e.branch !== undefined && !(isStage(e.stage) && BRANCHES_OF[e.stage].includes(e.branch))) delete edit().branch;
    for (const key of ['memoNo', 'note', 'customText'] as const) {
      if (e[key] !== undefined && !isText(e[key])) delete edit()[key];
    }
    const result = (copy ?? e) as unknown as StatusEntry;
    seen.add(result.id);
    out.push(result);
  }
  return out;
}

export function currentStatus(p: TenderProject): StatusEntry | undefined {
  return p.statusLog?.at(-1);
}

export function formatSheetDate(iso?: string): string {
  if (!isValidDate(iso)) return '';
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}

export interface StatusSheetRow {
  no: number;
  referenceNumber: string;
  title: string;
  announcement: string;
  receivedAt: string;
  action: string;
  memoNo: string;
  date: string;
  note: string;
}

export function statusSheetRows(projects: TenderProject[]): StatusSheetRow[] {
  const received = (p: TenderProject) => (isValidDate(p.receivedAt) ? p.receivedAt : undefined);
  const sorted = [...projects].sort((a, b) => {
    const ra = received(a);
    const rb = received(b);
    if (ra !== rb) {
      if (!ra) return 1;
      if (!rb) return -1;
      return ra < rb ? -1 : 1;
    }
    return (a.referenceNumber ?? '').localeCompare(b.referenceNumber ?? '', 'ar', { numeric: true });
  });
  return sorted.map((p, i) => {
    const s = currentStatus(p);
    return {
      no: i + 1,
      referenceNumber: p.referenceNumber ?? '',
      title: p.title ?? '',
      announcement: announcementLabel(p.announcementNo) ?? '',
      receivedAt: formatSheetDate(p.receivedAt),
      action: s ? statusText(s) : '',
      memoNo: s?.memoNo ?? '',
      date: s ? formatSheetDate(s.memoDate) : '',
      note: s?.note ?? ''
    };
  });
}

import type { StatusBranch, StatusEntry, StatusOrder, StatusStage, TenderProject } from '../types/tender';
import { announcementLabel } from './tenderDetails';
import { compareOrderNumbers } from './orderNumber';

/**
 * موقف الطلبية: سجل وعرض فقط، لا يدخل في أي حساب أو توصية.
 * الموقف الحالي هو آخر إدخال في السجل لا الأحدث تاريخاً.
 */

export const STAGE_ORDER: StatusStage[] = ['analysis', 'awaitingBidders', 'audit', 'returnedFromAudit', 'reviewCommittee', 'referralPending', 'referred', 'sentToContracts', 'readvertise', 'other'];

export const STAGE_LABELS: Record<StatusStage, string> = {
  analysis: 'قيد التحليل',
  awaitingBidders: 'بانتظار إجابة الشركات',
  audit: 'لدى قسم الرقابة والتدقيق الداخلي',
  returnedFromAudit: 'معادة من التدقيق إلى اللجنة',
  reviewCommittee: 'لدى لجنة المراجعة',
  referralPending: 'قيد الإحالة',
  referred: 'تمت الإحالة',
  sentToContracts: 'أُرسلت إلى العقود',
  readvertise: 'إعادة إعلان',
  other: 'إجراء آخر'
};

export const BRANCHES_OF: Record<StatusStage, StatusBranch[]> = {
  analysis: ['technical', 'commercial', 'documents'],
  awaitingBidders: [],
  audit: [],
  returnedFromAudit: [],
  reviewCommittee: ['negotiation'],
  referralPending: [],
  referred: [],
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

export function statusText(e: Pick<StatusEntry, 'stage' | 'branch' | 'customText'>): string {
  const detail = typeof e.customText === 'string' ? e.customText.trim() : '';
  if (e.stage === 'other') return e.customText ?? '';
  // مرحلة غير معروفة (من نسخة أحدث) تُعامل «غير محدد» ولا تُحذف
  if (!isStage(e.stage)) return 'غير محدد';
  if (e.stage === 'referred') return detail ? `تمت الإحالة إلى ${detail}` : STAGE_LABELS.referred;
  const label = STAGE_LABELS[e.stage];
  const base = e.branch ? `${label}: ${BRANCH_LABELS[e.branch]}` : label;
  return detail ? `${base} ${detail}` : base;
}

export function validateStatusEntry(e: Pick<StatusEntry, 'stage' | 'branch' | 'customText' | 'memoDate'>): string | null {
  if (!isStage(e.stage)) return 'الإجراء غير معروف';
  if (e.stage === 'other' && !e.customText?.trim()) return 'اكتب نص الإجراء الآخر';
  if (e.branch && !BRANCHES_OF[e.stage].includes(e.branch)) return 'الفرع المختار لا يتبع هذا الإجراء';
  // التاريخ اختياري؛ إن وُجد فيجب أن يكون صالحاً
  if (e.memoDate !== undefined && e.memoDate !== '' && !isValidDate(e.memoDate)) return 'تاريخ المذكرة أو الإجراء غير صالح';
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
    if (typeof e.stage !== 'string') continue;
    let copy: Record<string, unknown> | null = null;
    const edit = () => (copy ??= { ...e });
    if (!isText(e.id) || e.id === '' || seen.has(e.id)) edit().id = `status-fix-${out.length}-${Math.random().toString(36).substring(2, 8)}`;
    // تاريخ غير صالح يُحذف ويبقى الإدخال (التاريخ اختياري)
    if (e.memoDate !== undefined && !isValidDate(e.memoDate)) delete edit().memoDate;
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
  kind: 'tender' | 'order';
  id: string;
  referenceNumber: string;
  title: string;
  announcement: string;
  receivedAt: string;
  action: string;
  memoNo: string;
  date: string;
  note: string;
}

type SheetSource = { kind: 'tender' | 'order'; item: TenderProject | StatusOrder };

/**
 * كشف الموقف: المناقصات المحفوظة والطلبيات بلا تحليل معاً.
 * 'number' (الافتراضي): برقم الطلبية (السنة ثم التسلسل ثم الرمز).
 * 'stage': مجموعات بحسب الإجراء الحالي بترتيب STAGE_ORDER (المجهول بعد «إجراء آخر»، وبلا موقف أخيراً)، وداخل المجموعة برقم الطلبية.
 */
export function statusSheetRows(projects: TenderProject[], orders: StatusOrder[] = [], sortBy: 'number' | 'stage' = 'number'): StatusSheetRow[] {
  const sources: SheetSource[] = [
    ...projects.map(item => ({ kind: 'tender' as const, item })),
    ...orders.map(item => ({ kind: 'order' as const, item }))
  ];
  const stageRank = (p: TenderProject | StatusOrder): number => {
    const s = p.statusLog?.at(-1);
    if (!s) return STAGE_ORDER.length + 1;
    const i = STAGE_ORDER.indexOf(s.stage);
    return i === -1 ? STAGE_ORDER.length : i;
  };
  const sorted = sources.sort((a, b) => {
    if (sortBy === 'stage') {
      const d = stageRank(a.item) - stageRank(b.item);
      if (d) return d;
    }
    return compareOrderNumbers(a.item.referenceNumber ?? '', b.item.referenceNumber ?? '');
  });
  return sorted.map(({ kind, item: p }, i) => {
    const s = p.statusLog?.at(-1);
    return {
      no: i + 1,
      kind,
      id: p.id,
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

export { isValidDate };

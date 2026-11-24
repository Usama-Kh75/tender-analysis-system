// سجلان صغيران للجنة، تسجيل وعرض فقط، لا يدخلان حساباً ولا ترتيباً ولا توصية:
// (1) إيعاز التحقق من المرشحين الثلاثة الأوائل (ضوابط رقم (4) أحد عشر/4 و5): تاريخ اختياري وتذكير على الشاشة، لا يُطبع ولا يُصدَّر.
// (2) أوجه الخلاف في الرأي بين أعضاء اللجنة (أحد عشر/6): نص حر يُطبع في المحضر إن كُتب وحده.
import type { TenderProject } from '../types/tender';
import { formatSheetDate } from './orderStatus';
import type { LegalKey } from './legalTexts';

export const CANDIDATES_CHECK_KEYS: LegalKey[] = ['ann4_11_4', 'ann4_11_5'];
export const DISSENT_KEY: LegalKey = 'ann4_11_6';

export const CANDIDATES_CHECK_REMINDER =
  'قبل التوصية بالإحالة: توجّه التعليمات اللجنة إلى الإيعاز لتشكيلات العقود بالتحقق من صحة بيانات المرشحين الثلاثة الأوائل وسلامة موقفهم من القائمة السوداء وقائمة الشركات المتلكئة';

const validDate = (v: unknown): v is string => typeof v === 'string' && formatSheetDate(v) !== '';

/** تاريخ الإيعاز المسجَّل، أو undefined */
export const candidatesCheckDateOf = (project: TenderProject): string | undefined =>
  validDate(project.candidatesCheckDate) ? project.candidatesCheckDate : undefined;

/** عند التحميل: تاريخ غير صحيح يُحذف، بلا تغيير updatedAt ولا قيد سجل */
export function sanitizeCandidatesCheckDate(project: TenderProject): TenderProject {
  if (project.candidatesCheckDate === undefined || validDate(project.candidatesCheckDate)) return project;
  const { candidatesCheckDate: _drop, ...rest } = project;
  void _drop;
  return rest as TenderProject;
}

/** النص بعد توحيد نهايات الأسطر وقص أطرافه؛ فارغ ← undefined */
export const cleanDissentNote = (v: unknown): string | undefined => {
  if (typeof v !== 'string') return undefined;
  const t = v.replace(/\r\n?/g, '\n').trim();
  return t === '' ? undefined : t;
};

/** عند التحميل: ما ليس نصاً أو يصير فارغاً بعد القص يُحذف، وإلا يبقى كما هو (بلا updatedAt ولا قيد سجل) */
export function sanitizeDissentNote(project: TenderProject): TenderProject {
  if (project.dissentNote === undefined) return project;
  const clean = cleanDissentNote(project.dissentNote);
  if (clean === project.dissentNote) return project;
  const { dissentNote: _drop, ...rest } = project;
  void _drop;
  return (clean === undefined ? rest : { ...rest, dissentNote: clean }) as TenderProject;
}

export interface DissentBlock {
  title: string;
  lines: string[];
  /** السند الذي يُطبع نصه الرسمي بعد الأسطر */
  legalKey: LegalKey;
}

/** كتلة «أوجه الخلاف في الرأي» في المحضر: null بغياب النص، فلا يتغير المحضر بحرف */
export function dissentBlock(project: TenderProject): DissentBlock | null {
  const note = cleanDissentNote(project.dissentNote);
  if (!note) return null;
  return { title: 'أوجه الخلاف في الرأي', lines: note.split('\n'), legalKey: DISSENT_KEY };
}

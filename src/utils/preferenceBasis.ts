import type { PreferenceItem, PreferenceRecord, TenderProject } from '../types/tender';
import { toLatinDigits } from './calculations';

/**
 * القيمة المالية للمبادرة كما كتبتها اللجنة: فارغة = undefined، رقم صالح (أرقام عربية أو هندية، وفواصل آلاف) = الرقم،
 * وما سوى ذلك = null فيُرفض الحفظ. parseArabicNumber يعيد صفراً لنص غير رقمي فيُطبع صفراً (مراجعة Codex)
 */
export function parseInitiativeValue(raw: string): number | undefined | null {
  const s = toLatinDigits(raw.trim()).replace(/[,،٬\s]/g, '');
  if (!s) return undefined;
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// أساس المفاضلة (ضوابط رقم (5)): سجل وطباعة فقط، لا يدخل حساباً ولا ترتيباً ولا التوصية

const text = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/** قيمة مالية صالحة: رقم منتهٍ لا يقل عن صفر */
export const isValidInitiativeValue = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;

/** مبادرة مكتملة: نوعها ووصفها غير فارغين */
export const isCompleteItem = (i: PreferenceItem): boolean => !!text(i.type) && !!text(i.description);

/** سجل مكتمل: «لا مبادرات»، أو مبادرة مكتملة واحدة على الأقل */
export const isCompletePreferenceRecord = (r: PreferenceRecord | undefined): boolean =>
  !!r && (r.hasInitiative === false || (Array.isArray(r.items) && r.items.some(isCompleteItem)));

export const preferenceRecordOf = (project: Pick<TenderProject, 'preferenceInitiatives'>, bidderId: string): PreferenceRecord | undefined =>
  Array.isArray(project.preferenceInitiatives) ? project.preferenceInitiatives.find(r => r && r.bidderId === bidderId) : undefined;

/** سجل المجهز مكتمل؟ */
export const hasCompletePreferenceRecord = (project: Pick<TenderProject, 'preferenceInitiatives'>, bidderId: string): boolean =>
  isCompletePreferenceRecord(preferenceRecordOf(project, bidderId));

function cleanItem(raw: unknown): PreferenceItem | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const type = text(r.type);
  const description = text(r.description);
  if (!type || !description) return null;
  const item: PreferenceItem = { type, description };
  if (isValidInitiativeValue(r.value)) item.value = r.value;
  if (r.completedOnRequest === true) item.completedOnRequest = true;
  return item;
}

/** سجل نظيف، أو null إن لم يصلح (ليس كائناً أو بلا معرّف مجهز) */
export function cleanPreferenceRecord(raw: unknown): PreferenceRecord | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const bidderId = text(r.bidderId);
  if (!bidderId) return null;
  const items = Array.isArray(r.items) ? r.items.map(cleanItem).filter((i): i is PreferenceItem => i !== null) : [];
  return { bidderId, hasInitiative: r.hasInitiative === true, items };
}

/** تنظيف الحقل عند التحميل بلا تغيير updatedAt ولا سجل تدقيق؛ لا نسخة جديدة إن لم يتغير شيء */
export function sanitizePreferenceInitiatives(project: TenderProject): TenderProject {
  const raw = project.preferenceInitiatives as unknown;
  if (raw === undefined) return project;
  const { preferenceInitiatives: _drop, ...rest } = project;
  void _drop;
  if (!Array.isArray(raw)) return rest;
  const clean = raw.map(cleanPreferenceRecord).filter((r): r is PreferenceRecord => r !== null);
  if (JSON.stringify(clean) === JSON.stringify(raw)) return project;
  return clean.length ? { ...rest, preferenceInitiatives: clean } : rest;
}

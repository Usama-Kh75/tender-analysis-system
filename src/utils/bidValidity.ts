// نفاذية العطاءات (المادة 13/أولاً، ضوابط رقم (4) أحد عشر/3 و9): عرض فقط، لا يدخل حساباً ولا ترتيباً ولا يُطبع ولا يُصدَّر.
// تاريخ غلق المناقصة واحد للمناقصة، ومدة النفاذية تختلف من عطاء إلى آخر، والتمديد (إن طُلب) يحل محل الحساب.
import type { Bidder, TenderProject } from '../types/tender';
import { hasBidAmounts } from './recommendation';
import { formatSheetDate } from './orderStatus';
import { reportLeftCommittee } from './tenderPath';
import type { LegalKey } from './legalTexts';

/** المادة 13/أولاً: يُقدَّم التقرير قبل انتهاء النفاذية بـ30 يوماً على الأقل */
export const REPORT_LEAD_DAYS = 30;
/** يبدأ التنبيه الكهرماني قبل انتهاء النفاذية بهذه الأيام */
export const WARN_DAYS = 45;

export type ValidityLevel = 'warn' | 'late' | 'expired';

export interface ValidityAlert {
  level: ValidityLevel;
  bidderId: string;
  bidderName: string;
  expiry: string;
  reportDue: string;
  text: string;
  legalKeys: LegalKey[];
}

const DAY_MS = 86_400_000;
const validDate = (v?: string): v is string => typeof v === 'string' && formatSheetDate(v) !== '';
const dayNo = (iso: string): number => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / DAY_MS;
// حساب تقويمي خالص: تواريخ YYYY-MM-DD تُحوَّل إلى رقم يوم وتُعاد، فلا ينزاح اليوم بتوقيت الجهاز
const fromDayNo = (n: number): string => new Date(n * DAY_MS).toISOString().slice(0, 10);
export const addDays = (iso: string, days: number): string => fromDayNo(dayNo(iso) + days);

export const isValidityDays = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v > 0;

/** آخر يوم تنفذ فيه نفاذية العطاء: التمديد إن وُجد، وإلا تاريخ الغلق + المدة */
export function bidExpiry(project: TenderProject, bidder: Bidder): string | null {
  if (validDate(bidder.validityExtendedTo)) return bidder.validityExtendedTo;
  if (validDate(project.closingDate) && isValidityDays(bidder.validityDays)) return addDays(project.closingDate, bidder.validityDays);
  return null;
}

/** العطاءات التي تُراقَب نفاذيتها: لها مبالغ ولم تستبعدها اللجنة */
const candidates = (project: TenderProject): Bidder[] =>
  project.bidders.filter(b => hasBidAmounts(b) && b.status !== 'disqualified');

export function validityAlert(project: TenderProject, today: string): ValidityAlert | null {
  if (reportLeftCommittee(project) || !validDate(today)) return null;
  let first: { b: Bidder; expiry: string } | null = null;
  for (const b of candidates(project)) {
    const expiry = bidExpiry(project, b);
    if (expiry && (!first || expiry < first.expiry)) first = { b, expiry };
  }
  if (!first) return null;
  const { b, expiry } = first;
  const reportDue = addDays(expiry, -REPORT_LEAD_DAYS);
  const left = dayNo(expiry) - dayNo(today);
  const exp = formatSheetDate(expiry);
  const due = formatSheetDate(reportDue);
  if (left < 0) {
    return { level: 'expired', bidderId: b.id, bidderName: b.name, expiry, reportDue, legalKeys: ['ann4_11_3', 'art13_1'],
      text: `انتهت نفاذية عطاء «${b.name}» في ${exp}: يُوعَز إلى العقود بمطالبة المجهز بتمديدها (ضوابط رقم (4) أحد عشر/3)` };
  }
  if (left < REPORT_LEAD_DAYS) {
    return { level: 'late', bidderId: b.id, bidderName: b.name, expiry, reportDue, legalKeys: ['art13_1', 'ann4_11_3', 'ann4_11_9'],
      text: `تنتهي نفاذية عطاء «${b.name}» في ${exp}، وفات موعد تقديم التقرير (30 يوماً قبلها، المادة 13/أولاً): يُوعَز بطلب تمديد النفاذية (أحد عشر/3)` };
  }
  if (left <= WARN_DAYS) {
    return { level: 'warn', bidderId: b.id, bidderName: b.name, expiry, reportDue, legalKeys: ['art13_1', 'ann4_11_9'],
      text: `تنتهي نفاذية عطاء «${b.name}» في ${exp}: يُقدَّم تقرير اللجنة قبل ${due} (المادة 13/أولاً)` };
  }
  return null;
}

/** عدد العطاءات المراقَبة التي لا نفاذية محسوبة لها، حين يكون في المناقصة ما يدل على استعمال الميزة (للتلميح الهادئ فقط) */
export function validityMissing(project: TenderProject): number {
  const inUse = validDate(project.closingDate) || project.bidders.some(b => isValidityDays(b.validityDays) || validDate(b.validityExtendedTo));
  if (!inUse) return 0;
  return candidates(project).filter(b => bidExpiry(project, b) === null).length;
}

/** تنظيف عند التحميل: تاريخ غير صالح أو مدة غير موجبة صحيحة تُهمل، بلا تغيير updatedAt ولا سجل */
export function sanitizeBidValidity(project: TenderProject): TenderProject {
  let next = project;
  if (project.closingDate !== undefined && !validDate(project.closingDate)) next = { ...next, closingDate: undefined };
  if (!Array.isArray(project.bidders)) return next;
  const bad = (b: Bidder) => (b.validityDays !== undefined && !isValidityDays(b.validityDays))
    || (b.validityExtendedTo !== undefined && !validDate(b.validityExtendedTo));
  if (project.bidders.some(bad)) {
    next = {
      ...next,
      bidders: project.bidders.map(b => !bad(b) ? b : {
        ...b,
        validityDays: isValidityDays(b.validityDays) ? b.validityDays : undefined,
        validityExtendedTo: validDate(b.validityExtendedTo) ? b.validityExtendedTo : undefined
      })
    };
  }
  return next;
}

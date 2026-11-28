import type { InvitationType, TenderProject } from '../types/tender';
import { hasBidAmounts } from './recommendation';

/**
 * بيانات المناقصة الاختيارية (منذ الإصدار 1.19.0): تُعرض في رأس المحضر وبطاقة المناقصة وملفات Excel، ولا يُطبع منها إلا ما أُدخل.
 * لا تدخل في حساب المبالغ أو الترتيب، لكنها تغذّي أحكام التعليمات المعروضة وتذكيراتها (بعد 1.32.6، لم تُصدر):
 * عدد المستلمة (bidCountGap وملصق العدد)، ورقم الإعلان (إعادة الإعلان في الإعلان الثالث وموافقات الزيادة)، وأسلوب الدعوة
 * (الإعفاء من التأمينات الأولية: bidBondExempt). والتوصية المطبوعة للعطاء الواحد لا تتغيّر.
 */

/** أساليب التعاقد كما سمّتها المادة (6)؛ المسابقة (خامساً) ليست تحليل أسعار فلا تُدرج. */
export const INVITATION_TYPES: Record<InvitationType, { label: string }> = {
  general: { label: 'مناقصة عامة' },
  limited: { label: 'مناقصة محدودة' },
  twoStage: { label: 'مناقصة بمرحلتين' },
  direct: { label: 'دعوة مباشرة' },
  singleSource: { label: 'عطاء واحد (العرض الوحيد)' }
};

export const INVITATION_TYPE_ORDER: InvitationType[] = ['general', 'limited', 'twoStage', 'direct', 'singleSource'];

/** النوع غير المعروف (من localStorage أو نسخة احتياطية) يُعامل كغير محدد. */
export function invitationTypeInfo(type?: string): { label: string } | undefined {
  return type && Object.hasOwn(INVITATION_TYPES, type) ? INVITATION_TYPES[type as InvitationType] : undefined;
}

const ORDINALS = ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس'];
export const ANNOUNCEMENT_ORDER = ORDINALS.map((_, i) => i + 1);

/** «الإعلان الأول» …؛ undefined لقيمة غير محددة أو خارج القائمة. */
export function announcementLabel(no?: number): string | undefined {
  return no && Number.isInteger(no) && no >= 1 && no <= ORDINALS.length ? `الإعلان ${ORDINALS[no - 1]}` : undefined;
}

/** عدد العطاءات التي حُلِّلت تجارياً: من لها مبالغ فقط، كما في المحضر (hasBidAmounts). */
export const analyzedBidsCount = (project: TenderProject): number => project.bidders.filter(hasBidAmounts).length;

/** عدد العطاءات المستلمة إن أُدخل رقماً صحيحاً موجباً، وإلا undefined. */
export function receivedBidsCountOf(project: TenderProject): number | undefined {
  const n = project.receivedBidsCount;
  return typeof n === 'number' && Number.isInteger(n) && n > 0 ? n : undefined;
}

/** الإعلان الثالث فما بعد (ضوابط رقم (2) ثالثاً/5 إلى 7). يُحدَّد رقمه يدوياً فلا يُفترض حين يُترك فارغاً */
export const isThirdOrLaterAnnouncement = (project: Pick<TenderProject, 'announcementNo'>): boolean => {
  const n = project.announcementNo;
  return typeof n === 'number' && Number.isInteger(n) && n >= 3;
};

/**
 * أسلوب الدعوة يُعفي مقدمي العطاءات من التأمينات الأولية: المناقصة المحدودة، والمناقصة بمرحلتين (المرحلة الثانية)،
 * والدعوة المباشرة، والعرض الوحيد (المادة (27)/أولاً/هـ). المناقصة العامة وغير المحدد لا تُعفي.
 */
const BID_BOND_EXEMPT: ReadonlySet<string> = new Set<InvitationType>(['limited', 'twoStage', 'direct', 'singleSource']);
export const bidBondExempt = (project: Pick<TenderProject, 'invitationType'>): boolean =>
  !!project.invitationType && BID_BOND_EXEMPT.has(project.invitationType);

/** مجهزون استُبعدوا قبل التحليل التجاري: مستبعدون بقرار اللجنة بلا مبالغ (لا يُدخَل لهم عطاء) */
export const excludedBeforeAnalysisCount = (project: TenderProject): number =>
  project.bidders.filter(b => b.status === 'disqualified' && !hasBidAmounts(b)).length;

/** أجزاء البيانات المُدخلة بالترتيب، كل جزء نص مستقل. */
export function tenderDetailParts(project: TenderProject, { withCounts = true, withAnnouncement = true }: { withCounts?: boolean; withAnnouncement?: boolean } = {}): string[] {
  const parts: string[] = [];
  const announcement = announcementLabel(project.announcementNo);
  if (announcement && withAnnouncement) parts.push(announcement);
  const invitation = invitationTypeInfo(project.invitationType);
  if (invitation) parts.push(`أسلوب الدعوة: ${invitation.label}`);
  const beneficiary = project.beneficiaryEntity?.trim();
  if (beneficiary) parts.push(`الجهة المستفيدة: ${beneficiary}`);
  // عددٌ صار أقل من المحلَّلة (أُضيف مجهز بعد حفظه) لا يُطبع، والإعدادات تُظهر الخطأ عند فتحها
  const received = withCounts ? receivedBidsCountOf(project) : undefined;
  const analyzed = analyzedBidsCount(project);
  if (received && received >= analyzed) parts.push(`عدد العطاءات المستلمة: (${received})، المحلَّلة تجارياً منها: (${analyzed})`);
  return parts;
}

/**
 * ملصق أعداد العطاءات في الرأس: «العطاءات: 5 مستلمة · 4 محلَّلة تجارياً · 1 استُبعدت قبل التحليل»؛ null إن لم يوجد شيء.
 * كل عطاء في جدول التحليل يُحلَّل تجارياً والترسية على أفضلها، فلا «مؤهلة/غير مؤهلة» هنا (أسامة 2026-11-13). العطاء الذي
 * فيه نقص جوهري (كالتأمينات الأولية) تستلمه اللجنة فيُعدّ مستلماً، ولا يدخل جدول التحليل التجاري.
 * الأجزاء من البيانات: «استُبعدت قبل التحليل» من المجهزين المستبعدين بلا مبالغ، وما بقي من الفرق «لم يُسجَّل سببه».
 */
export function bidCountsLabel(project: TenderProject): string | null {
  const analyzed = analyzedBidsCount(project);
  const received = receivedBidsCountOf(project);
  const parts: string[] = [];
  if (received && received >= analyzed) parts.push(`${received} مستلمة`);
  if (analyzed > 0) parts.push(`${analyzed} محلَّلة تجارياً`);
  if (received && received > analyzed) {
    const excluded = Math.min(excludedBeforeAnalysisCount(project), received - analyzed);
    if (excluded > 0) parts.push(`${excluded} استُبعدت قبل التحليل`);
    if (received - analyzed - excluded > 0) parts.push(`${received - analyzed - excluded} لم يُسجَّل سببه`);
  }
  return parts.length ? `العطاءات: ${parts.join(' · ')}` : null;
}

/** عند التحميل: hiddenAsPrevious لا يبقى إلا إن كان true تماماً (بلا تغيير updatedAt ولا قيد سجل) */
export const sanitizeHiddenAsPrevious = <T extends { hiddenAsPrevious?: true }>(item: T): T => {
  if (item.hiddenAsPrevious === undefined || item.hiddenAsPrevious === true) return item;
  const { hiddenAsPrevious: _drop, ...rest } = item;
  void _drop;
  return rest as T;
};

/** عند التحميل: splitAllowed لا يبقى إلا إن كان true تماماً (بلا تغيير updatedAt ولا قيد سجل) */
export const sanitizeSplitAllowed = (project: TenderProject): TenderProject => {
  if (project.splitAllowed === undefined || project.splitAllowed === true) return project;
  const { splitAllowed: _drop, ...rest } = project;
  void _drop;
  return rest as TenderProject;
};

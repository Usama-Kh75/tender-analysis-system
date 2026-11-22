import type { InvitationType, TenderProject } from '../types/tender';
import { hasBidAmounts } from './recommendation';

/**
 * بيانات المناقصة الاختيارية (منذ الإصدار 1.19.0): للعرض في رأس المحضر وبطاقة المناقصة وملفات Excel فقط،
 * ولا تدخل في أي حساب أو توصية. لا يُطبع منها إلا ما أُدخل.
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
 * ملصق أعداد العطاءات في الرأس: «العطاءات: 5 مستلمة · 4 محلَّلة تجارياً · 1 لم تُحلَّل لنقص جوهري»؛ null إن لم يوجد شيء.
 * كل عطاء في جدول التحليل يُحلَّل تجارياً والترسية على أفضلها، فلا «مؤهلة/غير مؤهلة» هنا (أسامة 2026-11-13). العطاء الذي
 * فيه نقص جوهري (كالتأمينات الأولية) تستلمه اللجنة فيُعدّ مستلماً، ولا يدخل جدول التحليل التجاري.
 */
export function bidCountsLabel(project: TenderProject): string | null {
  const analyzed = analyzedBidsCount(project);
  const received = receivedBidsCountOf(project);
  const parts: string[] = [];
  if (received && received >= analyzed) parts.push(`${received} مستلمة`);
  if (analyzed > 0) parts.push(`${analyzed} محلَّلة تجارياً`);
  if (received && received > analyzed) parts.push(`${received - analyzed} لم تُحلَّل لنقص جوهري`);
  return parts.length ? `العطاءات: ${parts.join(' · ')}` : null;
}

/** عند التحميل: splitAllowed لا يبقى إلا إن كان true تماماً (بلا تغيير updatedAt ولا قيد سجل) */
export const sanitizeSplitAllowed = (project: TenderProject): TenderProject => {
  if (project.splitAllowed === undefined || project.splitAllowed === true) return project;
  const { splitAllowed: _drop, ...rest } = project;
  void _drop;
  return rest as TenderProject;
};

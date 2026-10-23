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
export function tenderDetailParts(project: TenderProject, { withCounts = true }: { withCounts?: boolean } = {}): string[] {
  const parts: string[] = [];
  const announcement = announcementLabel(project.announcementNo);
  if (announcement) parts.push(announcement);
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

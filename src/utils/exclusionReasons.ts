import type { Bidder, ExclusionReason, TechnicalOpinion, TenderProject } from '../types/tender';
import { LEGAL_TEXTS, uniqueLegalKeys, type LegalKey } from './legalTexts';
import { formatSheetDate, isValidDate } from './orderStatus';
import { hasBidAmounts } from './recommendation';

/**
 * أسباب استبعاد العطاء كله (status 'disqualified'): كل سبب بند من التعليمات مع تفصيل اختياري، وصياغته الثابتة
 * مصدرها هذا الملف وحده (القائمة في الواجهة، والعبارة المطبوعة في المحضر، ومعاينة النافذة، وسجل التدقيق).
 * كتبت Claude الصياغة بتفويض من أسامة (2026-11-09). لا تدخل في أي حساب أو ترتيب: المستبعد خارج التوصية أصلاً.
 * لا يُستشهد بالمادة (7)/تاسعاً/ج: خاصة بالاتفاق الإطاري.
 */

export interface GroundInfo {
  ground: string;
  label: string;          // القائمة في الواجهة
  phrase: string;         // العبارة المطبوعة
  legalKey?: LegalKey;    // بلا بند: 'other'
  hint: string;           // placeholder التفصيل
  detailRequired?: boolean;
}

export const EXCLUSION_GROUNDS: GroundInfo[] = [
  {
    ground: 'technical', label: 'عدم المطابقة الفنية',
    phrase: 'عدم مطابقة عرضه الفني للمواصفات الفنية المطلوبة في وثائق المناقصة', legalKey: 'ann4_6_6',
    hint: 'الفقرات أو المواصفات غير المطابقة كما وردت في الرأي الفني'
  },
  {
    ground: 'qualification', label: 'عدم الاستجابة لمعايير التأهيل',
    phrase: 'عدم استجابة عطائه لمعايير التأهيل المطلوبة بموجب وثائق المناقصة', legalKey: 'ann4_6_6',
    hint: 'المعيار غير المستوفى، مثل الأعمال المماثلة أو السيولة النقدية'
  },
  {
    ground: 'conditions', label: 'عدم الاستجابة لشروط المناقصة',
    phrase: 'عدم استجابة عطائه لشروط المناقصة بموجب وثائقها', legalKey: 'ann4_6_6',
    hint: 'الشرط غير المستوفى'
  },
  {
    ground: 'incomplete', label: 'عدم الاستكمال خلال المدة المحددة',
    phrase: 'عدم استكماله خلال المدة التي حددتها اللجنة', // يُدرج المتطلب بعد «عدم استكماله» (reasonLine)
    hint: 'ما طُلب منه، ورقم كتاب المفاتحة وتاريخه'
  },
  {
    ground: 'bidBond', label: 'عدم إرفاق التأمينات الأولية',
    phrase: 'عدم إرفاق التأمينات الأولية المطلوبة بموجب وثائق المناقصة مع عطائه', legalKey: 'ann4_6_1',
    hint: ''
  },
  {
    ground: 'bondInvalid', label: 'خطاب ضمان غير مستوفٍ للشروط',
    phrase: 'عدم استيفاء خطاب ضمان التأمينات الأولية أو الصك المصدق للشروط المطلوبة', legalKey: 'ann4_5_d',
    hint: 'وجه المخالفة: المبلغ، أو المدة، أو الجهة الموجه إليها، أو اسم مقدم العطاء، أو اسم المناقصة ورقمها', detailRequired: true
  },
  {
    ground: 'legalDocs', label: 'عدم استيفاء الشروط القانونية',
    phrase: 'عدم استيفائه الشروط القانونية المطلوبة في وثائق المناقصة لعدم امتلاكه لها ابتداءً', legalKey: 'ann4_6_3',
    hint: 'الوثيقة غير المملوكة: هوية التصنيف، أو هوية غرفة التجارة، أو إجازة ممارسة المهنة، أو شهادة التأسيس'
  },
  {
    ground: 'blacklist', label: 'القائمة السوداء أو الشركات المتلكئة',
    phrase: 'إدراجه في القائمة السوداء أو قائمة الشركات المتلكئة، أو سبق أن فسخت جهة التعاقد عقداً سابقاً معه قضائياً لإخلاله', legalKey: 'ann4_6_4',
    hint: 'القائمة أو العقد المفسوخ ومرجعه'
  },
  {
    ground: 'derivedDiscount', label: 'عطاء مبني على تخفيض من عطاء آخر',
    phrase: 'بناء عطائه على تخفيض نسبة مئوية أو مبلغ مقطوع من عطاء آخر مقدم في المناقصة', legalKey: 'ann4_6_2',
    hint: 'العطاء المبني عليه'
  },
  {
    ground: 'erasures', label: 'شطب أو حك دون توقيع',
    phrase: 'وجود تحبير أو حك أو شطب أو تصحيح بالحبر الأبيض إزاء أسعار فقراته دون توقيعه أو ختمه، ورفضه إجراء التصحيح أو ختمه', legalKey: 'ann4_6_7',
    hint: 'الفقرات'
  },
  {
    ground: 'refusedCorrection', label: 'رفض التصحيح الحسابي',
    phrase: 'رفضه إجراء التصحيح الحسابي على عطائه', legalKey: 'ann4_5_b5',
    hint: ''
  },
  {
    ground: 'duplicateManager', label: 'مدير مفوض لأكثر من شركة',
    phrase: 'تقديم المدير المفوض لأكثر من شركة أكثر من عطاء واحد في المناقصة غير المجزأة', legalKey: 'art10_1_y',
    hint: 'الشركات الأخرى واسم المدير المفوض'
  },
  {
    ground: 'duplicatePartner', label: 'تكرار اسم الشريك',
    phrase: 'تكرار اسم الشريك نفسه في أكثر من عطاء مقدم على المناقصة غير المجزأة نفسها', legalKey: 'art10_1_k',
    hint: 'الشريك والعطاءات الأخرى'
  },
  {
    ground: 'other', label: 'سبب آخر',
    phrase: '', hint: 'السبب كما تثبته اللجنة', detailRequired: true
  }
];

/** المتطلبات التي يُطلب استكمالها (ضوابط رقم (4) سابعاً/1..9)، بالترتيب */
export const INCOMPLETE_ITEMS: string[] = [
  'أوراق الشركة القانونية المحددة في وثائق المناقصة',
  'الهوية الضريبية أو كتاب عدم الممانعة من الاشتراك بالمناقصة الصادر من الهيئة العامة للضرائب',
  'الحسابات الختامية المصدقة بتاريخ يسبق تاريخ غلق المناقصة',
  'بيانات الأعمال المماثلة وكتب أو شهادات إنجازها أو نسب تقدم العمل بها',
  'العقود الخاصة بالعاملين بالمشروع (المهندسين والفنيين) وسيرهم الذاتية',
  'الأوراق الثبوتية للمعدات والآليات أو عقود إيجارها',
  'الشروط غير الجوهرية المثبتة في وثائق المناقصة',
  'التصاميم والكتلوجات والمواصفات الخاصة بالتفاصيل الفنية لعرضه الفني ومنهجية العمل',
  'ختمه أو توقيعه على وثائق المناقصة'
];

export const groundInfo = (ground: string): GroundInfo | undefined =>
  EXCLUSION_GROUNDS.find(g => g.ground === ground);

const isItemNo = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= INCOMPLETE_ITEMS.length;

/** مفتاح النص الرسمي لسبب، أو undefined (سبب آخر، أو غير معروف) */
export function reasonLegalKey(reason: ExclusionReason): LegalKey | undefined {
  if (reason.ground === 'incomplete') return isItemNo(reason.item) ? `ann4_7_${reason.item}` as LegalKey : undefined;
  return groundInfo(reason.ground)?.legalKey;
}

/** الاستناد إلى الرأي الفني: المصدر، ثم رقم الكتاب وتاريخه إن وُجدا؛ فارغ بلا مصدر */
export function opinionClause(project: Pick<TenderProject, 'technicalOpinion'>): string {
  const o = project.technicalOpinion;
  const source = o?.source?.trim();
  if (!source) return '';
  const no = o?.letterNo?.trim();
  const date = formatSheetDate(o?.letterDate);
  return `، استناداً إلى الرأي الفني المقدَّم من (${source})${no ? ` بالكتاب المرقم (${no})` : ''}${date ? ` في (${date})` : ''}، الذي طلبته اللجنة وفق المادة (13)/ثانياً`;
}

/** النص المطبوع لسبب واحد */
export function reasonLine(reason: ExclusionReason, project: Pick<TenderProject, 'technicalOpinion'>): string {
  const detail = reason.detail?.trim();
  const info = groundInfo(reason.ground);
  if (!info) return `سبب غير محدد${detail ? `: ${detail}` : ''}.`;
  if (info.ground === 'other') return `${detail ?? ''}.`;
  const key = reasonLegalKey(reason);
  const phrase = info.ground === 'incomplete' && isItemNo(reason.item)
    ? `عدم استكماله ${INCOMPLETE_ITEMS[reason.item - 1]} خلال المدة التي حددتها اللجنة` : info.phrase;
  return `${phrase}${key ? ` (${LEGAL_TEXTS[key].label})` : ''}${detail ? `: ${detail}` : ''}${info.ground === 'technical' ? opinionClause(project) : ''}.`;
}

/** تسمية سبب في القائمة وسجل التدقيق: التسمية القصيرة، ومعها المتطلب في الاستكمال */
export function reasonLabel(reason: ExclusionReason): string {
  const info = groundInfo(reason.ground);
  if (!info) return 'سبب غير محدد';
  return info.ground === 'incomplete' && isItemNo(reason.item) ? `${info.label} (${reason.item})` : info.label;
}

const reasonsOf = (bidder: Bidder): ExclusionReason[] =>
  bidder.status === 'disqualified' && Array.isArray(bidder.exclusionReasons) ? bidder.exclusionReasons : [];

/** عطاء مستبعد له مبالغ (هو وحده يدخل المحضر) */
export const excludedBidders = (project: TenderProject): Bidder[] =>
  project.bidders.filter(b => b.status === 'disqualified' && hasBidAmounts(b));

/** مفاتيح النصوص الرسمية لأسباب كل العطاءات المستبعدة، بترتيب ورودها وبلا تكرار؛ art13_2 بعد سبب فني له مصدر رأي */
export function exclusionLegalKeys(project: TenderProject): LegalKey[] {
  const hasSource = !!project.technicalOpinion?.source?.trim();
  const keys: (LegalKey | undefined)[] = [];
  for (const b of excludedBidders(project)) {
    for (const r of reasonsOf(b)) {
      keys.push(reasonLegalKey(r));
      if (r.ground === 'technical' && hasSource) keys.push('art13_2');
    }
  }
  return uniqueLegalKeys(keys);
}

/** تسميات أسباب العطاء (القصيرة) بلا تكرار، تُجمع بـ«، » */
export function exclusionLabels(bidder: Bidder): string {
  return [...new Set(reasonsOf(bidder).map(reasonLabel))].join('، ');
}

/** تسميات بنود التعليمات لأسباب العطاء (لعمود الموقف في المحضر): بلا تكرار وبالترتيب، و«سبب آخر» لا يضيف */
export function exclusionLegalLabels(bidder: Bidder): string {
  return [...new Set(uniqueLegalKeys(reasonsOf(bidder).map(reasonLegalKey)).map(k => LEGAL_TEXTS[k].label))].join('، ');
}

/** رسالة خطأ عربية أو null */
export function validateReasons(reasons: ExclusionReason[]): string | null {
  const seen = new Set<string>();
  for (const r of reasons) {
    const info = groundInfo(r.ground);
    const name = info ? info.label : 'سبب غير محدد';
    if (r.ground === 'incomplete' && !isItemNo(r.item)) return `اختر المتطلب الذي لم يستكمله المجهز في سبب «${name}»`;
    if (info?.detailRequired && !r.detail?.trim()) {
      return r.ground === 'other' ? 'اكتب السبب الآخر كما تثبته اللجنة' : `اكتب وجه المخالفة في سبب «${name}»`;
    }
    const id = `${r.ground}|${r.ground === 'incomplete' ? r.item : ''}`;
    if (seen.has(id)) return `السبب «${reasonLabel(r)}» مكرر؛ اجمع تفصيله في سبب واحد`;
    seen.add(id);
  }
  return null;
}

/** يوجد سبب فني لعطاء مستبعد ومصدر الرأي الفني فارغ */
export function needsOpinionSource(project: TenderProject): boolean {
  return !project.technicalOpinion?.source?.trim()
    && excludedBidders(project).some(b => reasonsOf(b).some(r => r.ground === 'technical'));
}

/**
 * كل عطاء مستبعد له مبالغ ذكرت اللجنة لاستبعاده سبباً واحداً على الأقل من بنود التعليمات. «سبب آخر» والسبب غير
 * المعروف لا يُثبتان عدم المطابقة لشروط المناقصة ومعاييرها التي تشترطها المادة (20)/ثالثاً (ملاحظة مراجعة Codex)
 */
export function allExcludedHaveReasons(project: TenderProject): boolean {
  const list = excludedBidders(project);
  return list.length > 0 && list.every(b => reasonsOf(b).some(r => !!reasonLegalKey(r)));
}

// ---- التنظيف عند التحميل والحفظ ----

const text = (v: unknown): string | undefined => typeof v === 'string' && v.trim() ? v.trim() : undefined;

/** يعيد الأسباب نظيفة، أو undefined إن لم تكن مصفوفة. ground غير معروف يبقى، وitem خارج 1..9 يُحذف */
export function cleanExclusionReasons(raw: unknown): ExclusionReason[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: ExclusionReason[] = [];
  for (const e of raw) {
    if (typeof e !== 'object' || e === null || Array.isArray(e)) continue;
    const r = e as Record<string, unknown>;
    const reason: ExclusionReason = { ground: typeof r.ground === 'string' ? r.ground : 'unknown' };
    if (isItemNo(r.item)) reason.item = r.item;
    const detail = text(r.detail);
    if (detail) reason.detail = detail;
    out.push(reason);
  }
  return out;
}

/** مصدر الرأي الفني نظيفاً؛ تاريخ الكتاب غير الصالح يُحذف. فارغ كله = undefined */
export function cleanTechnicalOpinion(raw: unknown): TechnicalOpinion | undefined {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return undefined;
  const r = raw as Record<string, unknown>;
  const out: TechnicalOpinion = {};
  const source = text(r.source);
  const letterNo = text(r.letterNo);
  const letterDate = isValidDate(r.letterDate) ? r.letterDate : undefined;
  if (source) out.source = source;
  if (letterNo) out.letterNo = letterNo;
  if (letterDate) out.letterDate = letterDate;
  return Object.keys(out).length ? out : undefined;
}

/**
 * تنظيف الحقلين عند تحميل المناقصة أو استعادتها: بلا تغيير updatedAt ولا سجل تدقيق. لا نسخة جديدة إن لم يتغير شيء.
 * حقل الأسباب الذي ليس مصفوفة يُحذف، والعنصر الذي ليس كائناً يُحذف
 */
export function sanitizeExclusionFields(project: TenderProject): TenderProject {
  let next = project;
  let bidders = project.bidders;
  if (Array.isArray(bidders) && bidders.some(b => b && b.exclusionReasons !== undefined)) {
    let changed = false;
    bidders = bidders.map(b => {
      if (!b || b.exclusionReasons === undefined) return b;
      const clean = cleanExclusionReasons(b.exclusionReasons);
      if (JSON.stringify(clean) === JSON.stringify(b.exclusionReasons)) return b;
      changed = true;
      const { exclusionReasons: _drop, ...rest } = b;
      void _drop;
      return clean ? { ...rest, exclusionReasons: clean } : rest;
    });
    if (changed) next = { ...next, bidders };
  }
  if (project.technicalOpinion !== undefined) {
    const clean = cleanTechnicalOpinion(project.technicalOpinion);
    if (JSON.stringify(clean) !== JSON.stringify(project.technicalOpinion)) {
      const { technicalOpinion: _drop, ...rest } = next;
      void _drop;
      next = clean ? { ...rest, technicalOpinion: clean } : rest;
    }
  }
  return next;
}

import type { Bidder, RecommendationBasis, RecommendationEdit, TenderProject } from '../types/tender';
import { formatCurrency, formatNumber, formatPercent, tafqeetArabic } from './calculations';
import { buildRecommendation, equalPriceBids, exclusionThresholdOf, PREFERENCE_BAND_PERCENT, type Recommendation } from './recommendation';
import { preferenceReference } from './contractTypes';
import { budgetApprovalNote } from './budgetTypes';
import { assessBalance, correctedBalanceRows, isOfferFinal, pricingClause } from './weightedOffer';
import { uniqueLegalKeys } from './legalTexts';

/**
 * نص توصية المحضر (ثالثاً) مصدراً واحداً: منه يُطبع المحضر، ومنه تبدأ صياغة اللجنة، وبه تُقارن صياغتها بعد ذلك.
 * المقاطع العريضة تبقى في الطباعة؛ وصياغة اللجنة نص عادي تُحفظ معه صياغة النظام وما بُنيت عليه (RecommendationEdit).
 * قائمة النصوص المستند إليها وملاحظات المحضر لا تدخل في الصياغة: تبقى كما يصوغها النظام
 */

export interface Run { text: string; strong?: boolean; underline?: boolean }
export type RecommendationBlock = { type: 'p'; runs: Run[] } | { type: 'list'; items: string[] };

const strong = (text: string): Run => ({ text, strong: true });
const para = (...runs: (Run | string | false | undefined)[]): RecommendationBlock =>
  ({ type: 'p', runs: runs.filter((r): r is Run | string => !!r).map(r => typeof r === 'string' ? { text: r } : r) });

interface BlockInput {
  project: TenderProject;
  rec: Recommendation;
  subject: Bidder;
  exclusion: number;
  pricingText: string;
  approval: ReturnType<typeof budgetApprovalNote>;
}

// كل صيغة مسندة إلى نص التعليمات رقم (1) لسنة 2025 — المراجع في utils/recommendation.ts
function recommendationBlocks({ project, rec, subject, exclusion, pricingText, approval }: BlockInput): RecommendationBlock[] {
  const money = (b: Bidder) => formatCurrency(b.totals.totalBidderAmount, project.currency);
  const words = (b: Bidder) => tafqeetArabic(b.totals.totalBidderAmount, 'دينار عراقي');
  const pct = (b: Bidder) => formatPercent(b.totals.totalDeviationPercent, 2, exclusion);
  const pref = preferenceReference(project.contractType);

  if (rec.kind === 'award' && rec.primary) {
    const x = rec.primary;
    return [para(
      'بعد التحليل التجاري والمالي للعطاءات والتدقيق الحسابي لجداول الكميات ومقارنتها بالكلفة التخمينية، واستناداً إلى المادة (13)/ثالثاً/أ، توصي لجنة التحليل',
      strong(` بإحالة المناقصة على العطاء المقدم من (${x.name}) `),
      'بمبلغ إجمالي قدره ', strong(`(${money(x)})`), ' ', { text: `(${words(x)})`, strong: true, underline: true },
      rec.chosenNotLowest
        ? '، وهو العطاء الذي اختارته اللجنة من بين العطاءات المؤهلة'
        : rec.chosenByCommittee && rec.closeBids.length > 1
          ? `، وهو العطاء الذي اختارته اللجنة من بين العطاءات ${rec.exactTie ? 'المتساوية' : 'المتقاربة'} في مبالغها`
          : '، لكونه أوطأ العطاءات المؤهلة',
      `، مع مراعاة نتائج التقييم الفني والقانوني${x.id === subject.id ? pricingText : ''}. وتُرفع هذه التوصية إلى الجهة المخولة بالمصادقة على الإحالة وفق المادة (13)/أولاً.`,
      approval?.kind === 'note' && ` ${approval.text}`
    )];
  }

  if (rec.kind === 'tie') {
    // سند استكمال المبادرات للمتساوية وحدها، ولو كان معها عطاء متقارب غير مساوٍ (equalPriceBids)
    const equal = equalPriceBids(rec.closeBids);
    return [
      para(
        'بعد التحليل التجاري والمالي للعطاءات والتدقيق الحسابي لجداول الكميات ومقارنتها بالكلفة التخمينية، تبيّن أن العطاءات المؤهلة الآتية',
        strong(rec.exactTie ? ' متساوية في مبالغها' : ` متقاربة في مبالغها لغاية (${PREFERENCE_BAND_PERCENT}%) من الكلفة التخمينية`),
        ':'
      ),
      { type: 'list', items: rec.closeBids.map(b => `${b.name} — ${money(b)} (${words(b)})`) },
      para(
        'وعليه توصي لجنة التحليل ', strong(`بالمفاضلة بين هذه العطاءات وفق ${pref.clause}`),
        '، والإحالة على العطاء الأفضل بنتيجتها، مع مراعاة نتائج التقييم الفني والقانوني.',
        equal.length > 1 && ` وعند تساوي ${rec.exactTie ? 'الأسعار' : `أسعار العطاءات (${equal.map(b => b.name).join('، ')})`} لأصغر فئة نقدية فلجهة التعاقد استكمال المبادرات إن لم تُقدَّم ابتداءً لتصبح جزءاً من العطاء (${pref.clause}). وإذا تساوت الأسعار والشروط بعد ذلك، فلجهة التعاقد إرساء المناقصة على أكثر من متقدم إن كانت شروط المناقصة تنص على ذلك (المادة 15/رابعاً/أ).`
      )
    ];
  }

  if (rec.kind === 'referral' && rec.primary) {
    const x = rec.primary;
    return [para(
      `بعد التحليل التجاري والمالي للعطاءات ومقارنتها بالكلفة التخمينية، لم يرد أي عطاء ضمن الحدود المقبولة (±${exclusion}%) وفق المادة (13)/ثالثاً/أ، وكان أقل العطاءات هو العطاء المقدم من `,
      strong(`(${x.name})`), ' بمبلغ ', strong(`(${money(x)})`),
      ` وبانحراف (${pct(x)}) عن الكلفة التخمينية. وعليه توصي لجنة التحليل `,
      strong('برفع الموضوع إلى اللجنة المركزية للمصادقة على الإحالة للنظر في التفاوض لتخفيض الأسعار'),
      '، استناداً إلى المادة (13)/ثالثاً/ب، علماً أن إجراء التفاوض ذاته ليس من اختصاص لجنة التحليل. وإذا لم تؤدِّ المفاوضات إلى تخفيض الأسعار ضمن الحدود المقبولة، فلجهة التعاقد إعادة الإعلان أو الدعوة وفق المادة (20)/أولاً.'
    )];
  }

  if (rec.kind === 'retender') {
    const x = rec.primary;
    return [rec.retenderReason === 'lowest-below' && x
      ? para(
        `بعد التحليل التجاري والمالي للعطاءات ومقارنتها بالكلفة التخمينية، لم يرد أي عطاء ضمن الحدود المقبولة (±${exclusion}%) وفق المادة (13)/ثالثاً/أ، وكان أقل العطاءات هو العطاء المقدم من `,
        strong(`(${x.name})`), ' بمبلغ ', strong(`(${money(x)})`),
        ` ويقل عن الكلفة التخمينية بنسبة (${pct(x)})، فلا ينطبق عليه استثناء المادة (13)/ثالثاً/ب المشروط بزيادة أقل العطاءات على الحدود. وعليه توصي لجنة التحليل `,
        strong('بعرض الموضوع على جهة التعاقد للنظر في إعادة الإعلان أو الدعوة'), ' استناداً إلى المادة (20)/رابعاً.'
      )
      : para(
        'استبعدت اللجنة جميع العطاءات المقدمة. وإذا كان استبعادها لعدم مطابقتها لشروط ومعايير المناقصة، توصي لجنة التحليل ',
        strong('بعرض الموضوع على جهة التعاقد للنظر في إعادة الإعلان أو الدعوة'), ' استناداً إلى المادة (20)/ثالثاً.'
      )];
  }

  // بلا كلفة تخمينية لا تُصاغ توصية (يعرض المحضر تنبيهه)
  return [];
}

/** نص عادي للصياغة: فقرة في كل سطر، وبنود القائمة أسطر تبدأ بـ«•» */
export const blocksToText = (blocks: RecommendationBlock[]): string =>
  blocks.map(b => b.type === 'p' ? b.runs.map(r => r.text).join('') : b.items.map(i => `• ${i}`).join('\n')).join('\n');

export function recommendationBasis(rec: Recommendation): RecommendationBasis {
  const bids = rec.kind === 'tie' ? rec.closeBids : rec.primary ? [rec.primary] : [];
  return { kind: rec.kind, bids: bids.map(b => ({ id: b.id, name: b.name, amount: b.totals.totalBidderAmount })) };
}

/**
 * ما يحتاجه قسم (ثالثاً) وما حوله: التوصية، والعطاء موضوع المحضر، وعبارة التسعير، وملاحظة الموازنة، والفقرات
 * المذكورة (لتُطبع نصوصها)، ونص النظام. tableShownOverride خيار «طباعة جدول الأسعار الموزونة»؛ null = الافتراضي
 */
export function recommendationPieces(project: TenderProject, activeBidder: Bidder, tableShownOverride: boolean | null = null) {
  // التوصية تُحسب من كل العطاءات (لا من التبويب المفتوح لحظة الطباعة) — انظر utils/recommendation.ts
  const rec = buildRecommendation(project);
  const subject = rec.primary ?? activeBidder;
  // حد الفقرة المنحرفة، وحد استبعاد العطاء بانحرافه الكلي (منفصلان)
  const threshold = project.deviationThreshold;
  const exclusion = exclusionThresholdOf(project);
  const pref = preferenceReference(project.contractType);
  // توازن العطاء موضوع المحضر (سادساً/5) وعرضه الموزون
  const balance = assessBalance(correctedBalanceRows(subject.items), threshold, exclusion);
  const offer = subject.weightedOffer && subject.weightedOffer.status !== 'paused' ? subject.weightedOffer : undefined;
  const offerFinal = isOfferFinal(subject);
  // جدول الأسعار الموزونة مفعّل افتراضياً حين يحيل نص التوصية إليه
  // نص التسعير لا يُطبع إلا في توصية الإحالة على عطاء (لا في المفاضلة ولا التفاوض ولا إعادة الإعلان)
  const weightingNeeded = rec.kind === 'award' && balance.verdict === 'weighting-required' && !offerFinal;
  const showWeighted = tableShownOverride ?? weightingNeeded;
  const pricingText = pricingClause(balance.verdict, { final: offerFinal, origin: offer?.origin, tableShown: showWeighted });
  const approval = rec.kind === 'award' && rec.primary
    ? budgetApprovalNote(project.budgetType, rec.primary.totals.totalDeviationPercent) : null;
  // الفقرات المذكورة في قسم ثالثاً بترتيب ورودها، لتُطبع نصوصها الرسمية تحت التوصية
  const legalKeys = uniqueLegalKeys(
    rec.kind === 'award' ? ['art13_3a', pricingText.includes('سادساً/5') && 'ann4_6_5', 'art13_1', approval?.kind === 'note' && approval.ref, rec.closeBids.length > 1 && pref.legalKey]
    : rec.kind === 'tie' ? [pref.legalKey, equalPriceBids(rec.closeBids).length > 1 && 'art15_4a']
    : rec.kind === 'referral' ? ['art13_3a', 'art13_3b', 'art20_1']
    : rec.kind === 'retender' ? (rec.retenderReason === 'lowest-below' ? ['art13_3a', 'art13_3b', 'art20_4'] : ['art20_3'])
    : []
  );
  const blocks = recommendationBlocks({ project, rec, subject, exclusion, pricingText, approval });
  return {
    rec, subject, threshold, exclusion, pref, balance, offer, offerFinal, weightingNeeded, showWeighted,
    pricingText, approval, legalKeys, blocks, systemText: blocksToText(blocks), basis: recommendationBasis(rec)
  };
}

/** صياغة اللجنة المحفوظة إن كانت سليمة البنية (نسخة احتياطية عُدّلت باليد لا تُسقط المحضر) */
export function savedRecommendationEdit(project: TenderProject): RecommendationEdit | undefined {
  const e = project.recommendationEdit as Partial<RecommendationEdit> | undefined;
  return e && typeof e.text === 'string' && e.text.trim() && typeof e.systemText === 'string'
    && e.basis && typeof e.basis.kind === 'string' && Array.isArray(e.basis.bids)
    ? e as RecommendationEdit : undefined;
}

const KIND_LABEL: Record<RecommendationBasis['kind'], string> = {
  award: 'بالإحالة',
  tie: 'بالمفاضلة',
  referral: 'برفع الموضوع للتفاوض',
  retender: 'بإعادة الإعلان أو الدعوة',
  'no-estimate': 'غير ممكنة لعدم وجود كلفة تخمينية'
};

const namesOf = (b: RecommendationBasis) => b.bids.map(x => x.name).join('، ') || 'لا عطاء';

/** وصف قصير لما بُنيت عليه التوصية، لسجل التدقيق */
export const basisLabel = (b: RecommendationBasis): string => `التوصية ${KIND_LABEL[b.kind]} (${namesOf(b)})`;

/**
 * ما تغيّر منذ صاغت اللجنة التوصية: نوعها، أو العطاء المعني، أو اسمه، أو مبلغه؛ وإن لم يتغيّر شيء منها فصياغة
 * النظام نفسها (عبارة التسعير، ملاحظة الموازنة، خيار جدول الأسعار الموزونة…). فارغة = الصياغة ما زالت على أساسها
 */
export function recommendationEditChanges(edit: RecommendationEdit, now: { basis: RecommendationBasis; systemText: string }): string[] {
  const was = edit.basis;
  const is = now.basis;
  if (was.kind !== is.kind) return [`صارت التوصية ${KIND_LABEL[is.kind]} بعد أن كانت ${KIND_LABEL[was.kind]}`];
  const ids = (b: RecommendationBasis) => b.bids.map(x => x.id).sort().join('|');
  if (ids(was) !== ids(is)) return [`العطاء المعني صار (${namesOf(is)}) بعد أن كان (${namesOf(was)})`];
  const changes: string[] = [];
  for (const old of was.bids) {
    const cur = is.bids.find(x => x.id === old.id)!;
    if (cur.name !== old.name) changes.push(`تغيّر اسم المجهز من (${old.name}) إلى (${cur.name})`);
    if (Math.abs(cur.amount - old.amount) >= 0.005) changes.push(`تغيّر مبلغ (${cur.name}) من (${formatNumber(old.amount)}) إلى (${formatNumber(cur.amount)})`);
  }
  if (changes.length === 0 && edit.systemText !== now.systemText) {
    changes.push('تغيّرت صياغة النظام منذ التعديل (عبارة التسعير، أو ملاحظة الموازنة، أو خيار جدول الأسعار الموزونة، أو غيرها)');
  }
  return changes;
}

/**
 * ملف التوصيات التي عدّلت اللجنة صياغتها، في كل المناقصات: يُحفظ في مجلد اللجنة ليُقترح منه تحسين صياغة النظام
 * بإصدار مقصود، لا تعلّم تلقائي
 */
export function recommendationEditsExport(projects: TenderProject[], appVersion: string) {
  const entries = projects.flatMap(p => {
    const edit = savedRecommendationEdit(p);
    const active = p.bidders.find(b => b.id === p.activeBidderId) ?? p.bidders[0];
    if (!edit || !active) return [];
    const now = recommendationPieces(p, active);
    return [{
      referenceNumber: p.referenceNumber,
      title: p.title,
      contractType: p.contractType,
      budgetType: p.budgetType,
      editedAt: edit.editedAt,
      basis: edit.basis,
      systemTextAtEdit: edit.systemText,
      committeeText: edit.text,
      systemTextNow: now.systemText,
      changedSince: recommendationEditChanges(edit, now)
    }];
  });
  return { __type: 'boc-tender-recommendation-edits', __version: 1, appVersion, exportedAt: new Date().toISOString(), entries };
}

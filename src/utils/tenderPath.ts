// «الخطوة التالية» تحت العنوان وحالة كل شركة في بطاقتها.
// كل ما هنا يُستنتج من بيانات المناقصة ولا يُخزَّن، فلا تحويل للمناقصات القديمة،
// وإن رجعت اللجنة عن خطوة (ألغت اختيار الترسية) رجع الشريط إليها.
import type { Bidder, TenderProject } from '../types/tender';
import { isPending } from './tableFilters';
import { itemsCountText } from './arabicCount';
import { buildRecommendation, hasBidAmounts, hasNoEstimate } from './recommendation';
import { currentStatus } from './orderStatus';
import type { StatusStage } from '../types/tender';

/** الموقف يُسجَّل من أول يوم تدخل فيه الطلبية ويتبع عمل اللجنة (أسامة 2026-11-19)، فوجوده لا يعني أن المحضر انتهى.
 *  المحضر منتهٍ حين يكون آخر موقف خروج الطلبية من اللجنة بعد اختيار الفائز. «معادة من التدقيق» رجوع إلى اللجنة،
 *  و«إجراء آخر» مجهول المعنى، فكلاهما يُبقي خطوة المحضر */
const REPORT_DONE_STAGES: ReadonlySet<StatusStage> = new Set<StatusStage>(['audit', 'reviewCommittee', 'referralPending', 'referred', 'sentToContracts']);
const reportLeftCommittee = (p: TenderProject): boolean => {
  const s = currentStatus(p)?.stage;
  return !!s && REPORT_DONE_STAGES.has(s as StatusStage);
};

export type BidderAuditState = { kind: 'empty' } | { kind: 'pending'; count: number } | { kind: 'done' };

/** فقرات فيها أخطاء لم تُعالج (خطأ ضرب، خلاف تفقيط، اختلاف قراءتين)، والفقرة التي فيها أكثر من واحد تُعدّ مرة */
const pendingCount = (b: Bidder): number => b.items.filter(isPending).length;

export function bidderAuditState(b: Bidder): BidderAuditState {
  if (!hasBidAmounts(b)) return { kind: 'empty' };
  const count = pendingCount(b);
  return count > 0 ? { kind: 'pending', count } : { kind: 'done' };
}

export interface TenderPath {
  hasEstimate: boolean;
  /** entered: الشركات التي لها مبالغ؛ registered: الشركات المسجّلة في المناقصة؛
   *  expected للعرض: الأكبر من العطاءات المستلمة (إن أُدخلت) والمسجّلة، فالمستلمة قد تزيد على المحلَّلة بحق */
  bids: { entered: number; registered: number; expected: number };
  /** pending في الشركات ذوات المبالغ وحدها؛ firstBidderId أولها بترتيب الشركات */
  audit: { pending: number; firstBidderId: string | null };
  /** من اختارته اللجنة للترسية، وnull قبل اختيارها */
  award: { name: string } | null;
}

export function tenderPath(p: TenderProject): TenderPath {
  const withAmounts = p.bidders.filter(hasBidAmounts);
  const pendingBidders = withAmounts.filter(b => pendingCount(b) > 0);
  const rec = buildRecommendation(p);
  return {
    hasEstimate: !hasNoEstimate(p),
    bids: { entered: withAmounts.length, registered: p.bidders.length, expected: Math.max(p.receivedBidsCount ?? 0, p.bidders.length) },
    audit: {
      pending: withAmounts.reduce((n, b) => n + pendingCount(b), 0),
      firstBidderId: pendingBidders[0]?.id ?? null
    },
    award: rec.chosenByCommittee && rec.primary ? { name: rec.primary.name } : null
  };
}

export type StageId = 'bids' | 'study' | 'report';
export type StageState = 'done' | 'current' | 'upcoming';
const STAGE_ORDER: StageId[] = ['bids', 'study', 'report'];

/** حال مراحل التبويبات الثلاثة، مستنتجة ولا تُخزَّن. كل مرحلة مكتملة بشرطها هي:
 *  الأولى بالكلفة التخمينية ومبالغ كل الشركات المسجّلة وبلا فقرات معلّقة، والثانية باختيار الترسية،
 *  والثالثة بخروج الطلبية من اللجنة بعد الاختيار (آخر موقف: التدقيق أو المراجعة أو الإحالة أو العقود). وأول مرحلة غير مكتملة «قيد العمل»، وما بعدها من غير المكتمل «لم تبدأ» */
export function stageStates(p: TenderProject): Record<StageId, StageState> {
  const path = tenderPath(p);
  const done: Record<StageId, boolean> = {
    bids: path.hasEstimate && path.bids.registered > 0 && path.bids.entered === path.bids.registered && path.audit.pending === 0,
    study: path.award !== null,
    report: path.award !== null && reportLeftCommittee(p)
  };
  let seenCurrent = false;
  const out = {} as Record<StageId, StageState>;
  for (const id of STAGE_ORDER) {
    if (done[id]) out[id] = 'done';
    else if (!seenCurrent) { out[id] = 'current'; seenCurrent = true; }
    else out[id] = 'upcoming';
  }
  return out;
}

export type NextStepTarget = 'bids' | 'importEstimate' | 'audit' | 'study' | 'report' | 'print' | 'status';
export interface NextStepAction { label: string; target: NextStepTarget; bidderId?: string }
export interface NextStep {
  /** stageDone: سطر ختام مرحلة العطاءات والتدقيق في تبويبها، أو مرحلة الدراسة والتوصية بعد اختيار الفائز (stageStep وحده) */
  kind: 'estimate' | 'audit' | 'bids' | 'award' | 'report' | 'stageDone';
  text: string;
  actions: NextStepAction[];
}

/** خطوة التبويب المفتوح وحده (قرار أسامة 2026-11-18: التلميحات والأزرار خاصة بالتبويب الذي يحتويها).
 *  العطاءات والتدقيق: خطوات الكلفة والتدقيق والإدخال، فإذا اكتملت سطر ختام وزر إلى الدراسة، بلا اسم فائز.
 *  والانتقال يدوي: اللجنة قد تراجع الفقرة الأخيرة بعد إدخالها، فلا يُقفز بها وحده.
 *  الدراسة والتوصية: قبل اختيار الفائز نص بلا أزرار (جدول «قرار اللجنة» في التبويب نفسه)، وبعده سطر ختام
 *  وزر إلى المحضر (سواء سُجّل الموقف أم لا)، وما لم تكتمل الأولى null.
 *  المحضر: ما لم تكتمل الأولى سطر بلا زر؛ وقبل اختيار الفائز سطر وزر إلى الدراسة والتوصية؛ ثم المحضر والموقف */
export function stageStep(p: TenderProject, tab?: string): NextStep | null {
  const step = nextStep(p);
  const firstStage = !!step && (step.kind === 'estimate' || step.kind === 'audit' || step.kind === 'bids');
  if (tab !== 'study' && tab !== 'report' && !firstStage) {
    const { bids } = tenderPath(p);
    return {
      kind: 'stageDone',
      text: `اكتملت مرحلة العطاءات والتدقيق: أُدخلت العطاءات (${bids.entered} من ${bids.expected}) ودُقّقت. المرحلة التالية: الدراسة والتوصية`
        + (bids.expected > bids.registered
          ? `. استُلمت (${bids.expected}) عطاءات، وأُدخل منها (${bids.entered}) للتحليل التجاري. العطاء الذي فيه نقص جوهري (كالتأمينات الأولية) يُعدّ مستلماً ولا يُحلَّل تجارياً، وإن لم يكن فيه نقص فأضفه من «إضافة مجهز».`
          : ''),
      actions: [{ label: 'الانتقال إلى الدراسة والتوصية', target: 'study' }]
    };
  }
  if (tab === 'study' && !firstStage) {
    const { award } = tenderPath(p);
    if (award) {
      return {
        kind: 'stageDone',
        text: `اكتملت مرحلة الدراسة والتوصية: اختارت اللجنة «${award.name}». المرحلة التالية: المحضر`,
        actions: [{ label: 'الانتقال إلى المحضر', target: 'report' }]
      };
    }
  }
  if (!step) return null;
  if (tab === 'report') {
    if (firstStage) {
      return { ...step, text: `لم تكتمل مرحلة العطاءات والتدقيق (${step.text.replace(/^الخطوة التالية: /, '')})، فالمحضر قبل إكمالها غير نهائي`, actions: [] };
    }
    if (step.kind === 'award') {
      return { ...step, text: 'الخطوة التالية: اختيار العطاء الفائز في «الدراسة والتوصية»', actions: [{ label: 'الانتقال إلى الدراسة والتوصية', target: 'study' }] };
    }
    return step;
  }
  if (tab === 'study') {
    // الفائز لم يُختر (وإلا عاد سطر الختام أعلاه). ملاحظة العطاءات المستلمة تخص الإدخال، فمكانها سطر ختام المرحلة الأولى
    return step.kind === 'award'
      ? { ...step, text: 'الخطوة التالية: دراسة العطاءات ومقارنتها، ثم اختيار العطاء الفائز بزر «اختيار للترسية» في جدول «قرار اللجنة»', actions: [] }
      : null;
  }
  return firstStage ? step : null;
}

/** الخطوة الواحدة التالية: أول شرط يتحقق، وnull حين لا شيء ينتظر. مستنتجة ولا تُخزَّن */
export function nextStep(p: TenderProject): NextStep | null {
  const path = tenderPath(p);
  if (!path.hasEstimate) {
    return {
      kind: 'estimate',
      text: 'الخطوة التالية: استيراد كشف الكلف التخمينية',
      actions: [{ label: 'استيراد كشف الكلف التخمينية', target: 'importEstimate' }]
    };
  }
  if (path.audit.pending > 0) {
    const action: NextStepAction = { label: 'عرض الفقرات التي فيها أخطاء', target: 'audit' };
    if (path.audit.firstBidderId) action.bidderId = path.audit.firstBidderId;
    return {
      kind: 'audit',
      text: `الخطوة التالية: ${itemsCountText(path.audit.pending)} فيها أخطاء لم تُعالج`,
      actions: [action]
    };
  }
  const empty = p.bidders.find(b => !hasBidAmounts(b));
  if (empty) {
    const action: NextStepAction = { label: 'إدخال العطاء', target: 'bids', bidderId: empty.id };
    return {
      kind: 'bids',
      text: `الخطوة التالية: إدخال عطاء «${empty.name}»`,
      actions: [action]
    };
  }
  if (!path.award) {
    return {
      kind: 'award',
      text: `اكتمل إدخال العطاءات (${path.bids.entered} من ${path.bids.expected}) والكلفة التخمينية. الخطوة التالية: دراسة العطاءات والتوصية بالإحالة`
        + (path.bids.expected > path.bids.registered
          ? `. استُلمت (${path.bids.expected}) عطاءات، وأُدخل منها (${path.bids.entered}) للتحليل التجاري. العطاء الذي فيه نقص جوهري (كالتأمينات الأولية) يُعدّ مستلماً ولا يُحلَّل تجارياً، وإن لم يكن فيه نقص فأضفه من «إضافة مجهز».`
          : ''),
      actions: [{ label: 'الانتقال إلى الدراسة والتوصية', target: 'study' }]
    };
  }
  if (!reportLeftCommittee(p)) {
    const hasStatus = (p.statusLog?.length ?? 0) > 0;
    return {
      kind: 'report',
      text: `اختارت اللجنة «${path.award.name}». الخطوة التالية: طباعة محضر التحليل، ثم ${hasStatus ? 'تحديث' : 'تسجيل'} الموقف عند إرساله`,
      actions: [
        { label: 'فتح المحضر', target: 'print' },
        { label: hasStatus ? 'تحديث الموقف' : 'تسجيل الموقف', target: 'status' }
      ]
    };
  }
  return null;
}

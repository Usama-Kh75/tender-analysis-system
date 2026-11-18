// «ما تقرره التعليمات هنا»: المواد التي تنطبق على حال المناقصة في مرحلة التبويب المفتوح (عرض فقط).
// يُستنتج من البيانات ولا يُخزَّن، ولا يدخل حساباً ولا طباعة ولا Excel. الأحكام تعيد ما يقوله النص الرسمي وحده.
import type { BOQItem, TenderProject } from '../types/tender';
import { uniqueLegalKeys, type LegalKey } from './legalTexts';
import {
  buildRecommendation, equalPriceBids, exclusionThresholdOf, hasBidAmounts, hasNoEstimate, isCommerciallyExcluded
} from './recommendation';
import { assessBalance, correctedBalanceRows } from './weightedOffer';
import { isCommitteeCorrected } from './bidderAuditEngine';
import { budgetApprovalNote } from './budgetTypes';
import { preferenceReference } from './contractTypes';

export interface GuidanceItem { key: LegalKey; ruling: string }

const weightingRequired = (project: TenderProject, items: BOQItem[]) =>
  assessBalance(correctedBalanceRows(items), project.deviationThreshold, exclusionThresholdOf(project)).verdict === 'weighting-required';

export function stageGuidance(project: TenderProject, tab: string): GuidanceItem[] {
  const out: GuidanceItem[] = [];
  const add = (key: LegalKey | undefined, ruling: string) => { if (key) out.push({ key, ruling }); };
  const withAmounts = project.bidders.filter(hasBidAmounts);

  if (tab === 'bids') {
    const rows = withAmounts.flatMap(b => b.items);
    const math = rows.some(i => i.hasMathError && !isCommitteeCorrected(i));
    const text = rows.some(i => i.hasTextDiscrepancy && !isCommitteeCorrected(i));
    if (math || text) add('art10_1_n', 'يُعوَّل على السعر المدوّن كتابةً إذا اختلف عن المدوّن رقماً، وعلى سعر الوحدة إذا لم يصحّ مبلغ الفقرة');
    if (text) add('ann4_5_b1', 'عند اختلاف السعر المكتوب بالكلمات عن الأرقام يُعتمد المكتوب بالكلمات');
    if (math) add('ann4_5_b2', 'عند اختلاف مبلغ الفقرة عن حاصل ضرب سعر الوحدة بالكمية يُعتمد سعر الوحدة، إلا إذا رأت اللجنة خطأً فادحاً في العلامة العشرية فتعتمد المبلغ وتصحّح سعر الوحدة');
    if (rows.some(isCommitteeCorrected)) {
      add('ann4_5_b3', 'تُبلِغ اللجنة مقدم العطاء بالتصحيح الحسابي ليحضر ويوقّع ويختم إزاءه');
      add('ann4_5_b5', 'إذا رفض مقدم العطاء التصحيح الحسابي يُستبعد عطاؤه وتُصادر تأميناته الأولية');
    }
    if (rows.some(i => i.unpriced)) add('art10_1_t', 'الفقرة التي لم يُدوَّن سعر إزاءها تُعدّ كلفتها مشمولة بالمبلغ الإجمالي للعطاء');
    if (withAmounts.length >= 2) add('ann4_5_b6', 'يُحدَّد تسلسل مقدمي العطاءات بعد إجراء التصحيح والتدقيق الحسابي لجميع العطاءات');
  } else if ((tab === 'study' || tab === 'report') && !hasNoEstimate(project)) {
    const rec = buildRecommendation(project);
    const threshold = exclusionThresholdOf(project);
    const pref = preferenceReference(project.contractType).legalKey;
    const close = rec.kind === 'tie' || rec.closeBids.length > 1;
    const equal = equalPriceBids(rec.closeBids).length > 1;
    const prefRuling = 'العطاءات المتساوية أو المتقاربة لغاية (1%) من الكلفة التخمينية يُفاضَل بينها بمعايير المفاضلة المحوّلة لقيمة مالية';

    if (tab === 'study') {
      if (withAmounts.some(b => isCommerciallyExcluded(b, threshold))) {
        add('art13_3a', 'يُستبعد العطاء الذي يزيد أو يقل عن (20%) من الكلفة التخمينية'
          + (threshold !== 20 ? `، والحد المعتمد في هذه المناقصة (${threshold}%)` : ''));
      }
      if (rec.eligible.some(b => weightingRequired(project, b.items))) {
        add('ann4_6_5', 'العطاء الأنسب سعراً الذي تتجاوز فقراته غير المتوازنة بالزيادة (10%) من عدد الفقرات تُقبل إحالته بجدول الكميات المسعّر من جهة التعاقد معدّلاً بنسبة مبلغه');
      }
      if (close) add(pref, prefRuling + (equal ? '، وعند التساوي لأصغر فئة نقدية يجوز استكمال المبادرات إن لم تُقدَّم ابتداءً وتصبح جزءاً من العطاء' : ''));
      if (equal) add('art15_4a', 'يجوز الإرساء على أكثر من متقدم إذا تساوت الأسعار والشروط ونصّت على ذلك شروط المناقصة');
      if (rec.chosenNotLowest) add('art10_1_h', 'جهة التعاقد غير ملزمة بقبول أوطأ العطاءات');
      if (rec.kind === 'referral') {
        add('art13_3b', 'للجنة التحليل التوصية بالتفاوض لتخفيض الأسعار إلى الحدود المسموحة للكلفة التخمينية دون المساس بنطاق العمل المعلن، إذا كان أقل العطاءات المطابقة للمواصفات يزيد على الحدود المقبولة');
      } else if (rec.kind === 'retender') {
        if (rec.retenderReason === 'lowest-below') add('art20_4', 'لجهة التعاقد إعادة الإعلان أو الدعوة إذا كان مبلغ العطاء المستجيب أقل من الكلفة التخمينية بنسبة (20%) أو أكثر');
        else add('art20_3', 'لجهة التعاقد إعادة الإعلان أو الدعوة إذا كانت جميع العطاءات المستلمة لا تتطابق مع شروط ومعايير المناقصة');
      }
    } else {
      // ann4_6_5 لا يُضاف هنا: بطاقة التوازن في «المحضر» تعرض سادساً/5 للعطاء الفائز في الحالات نفسها
      const approval = rec.kind === 'award' && rec.primary
        ? budgetApprovalNote(project.budgetType, rec.primary.totals.totalDeviationPercent) : null;
      if (approval?.kind === 'note') add(approval.ref, 'صلاحية قبول العطاء الزائد على الكلفة التخمينية بحسب نوع الموازنة ونسبة الزيادة');
    }
  }
  const keys = uniqueLegalKeys(out.map(i => i.key));
  return keys.map(k => out.find(i => i.key === k)!);
}

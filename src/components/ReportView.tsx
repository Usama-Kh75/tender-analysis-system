import React, { useState } from 'react';
import { Award, FileSpreadsheet, Printer } from 'lucide-react';
import { TenderProject } from '../types/tender';
import { formatCurrency, formatPercent } from '../utils/calculations';
import { buildRecommendation, hasNoEstimate, exclusionThresholdOf, offerWinner, hasBidAmounts, isCommerciallyExcluded } from '../utils/recommendation';
import { budgetApprovalNote, thirdAnnouncementNote } from '../utils/budgetTypes';
import { isOfferFinal, assessBalance, correctedBalanceRows } from '../utils/weightedOffer';
import { WeightedOfferBar } from './WeightedOfferBar';
import { WeightedTableView } from './WeightedTableView';
import { offerSheetTarget } from '../utils/bidderAuditExcel';
import { LEGAL_TEXTS, type LegalKey } from '../utils/legalTexts';

// «النص الرسمي» للمادة المذكورة في بطاقة الفائز: يبقى النص في الصفحة مخفياً ليشير إليه aria-controls دائماً (عرض فقط، لا يُطبع)
const OfficialText: React.FC<{ legalKey: LegalKey }> = ({ legalKey }) => {
  const [on, setOn] = useState(false);
  const t = LEGAL_TEXTS[legalKey];
  return (
    <span className="no-print print:hidden">
      {' '}
      <button
        type="button"
        aria-expanded={on}
        aria-controls={`legal-text-${legalKey}`}
        aria-label={`${on ? 'إخفاء' : 'عرض'} النص الرسمي لـ ${t.label}`}
        onClick={() => setOn(!on)}
        className="font-bold text-indigo-800 underline cursor-pointer rounded whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700"
      >
        {on ? 'إخفاء النص' : 'النص الرسمي'}
      </button>
      <blockquote id={`legal-text-${legalKey}`} hidden={!on} className="mt-1 rounded-lg border border-indigo-100 bg-white px-3 py-2 leading-relaxed text-slate-700 font-normal">
        «{t.text}» (ص {t.page})
      </blockquote>
    </span>
  );
};

interface ReportViewProps {
  project: TenderProject;
  /** ينقل إلى «الدراسة والتوصية» لاختيار العطاء الفائز */
  onGoStudy: () => void;
  onOpenPrint: () => void;
  onExportExcel: () => void;
  /** يختار المجهز وينقل إلى جدول الفقرات في تبويب «العطاءات والتدقيق» لإعداد عرضه الموزون */
  onOpenWeightedOffer: (bidderId: string) => void;
  /** يستأنف العرض الموزون الموقوف للعطاء الفائز ثم ينقل إلى جدول فقراته (لا بدء جديد في الواجهة) */
  onResumeWeightedOffer: (bidderId: string) => void;
}

/** «المحضر»: العطاء الفائز بعد اختيار اللجنة، وعرضه الموزون، ومعاينة المحضر وطباعته */
export const ReportView: React.FC<ReportViewProps> = ({
  project,
  onGoStudy,
  onOpenPrint,
  onExportExcel,
  onOpenWeightedOffer,
  onResumeWeightedOffer
}) => {
  const noEstimate = hasNoEstimate(project);
  const exclusionThreshold = exclusionThresholdOf(project);
  // العرض الموزون للعطاء الفائز وحده (ضوابط (4) سادساً/5) إن تجاوزت فقراته غير المتوازنة 10% من عددها،
  // ويبقى ظاهراً كل عطاء له عرض مسجّل ليُرى ويُوقف إن لم يعد فائزاً
  // (العرض المسجّل يبقى ظاهراً ولو استُبعد العطاء بعده، ليُوقف: مراجعة Kimi 2026-11-18)
  const winner = offerWinner(project);
  // غير الفائز يظهر ما دام عرضه فعّالاً أو معتمداً ليُوقف، والموقوف لا يقفل شيئاً فلا يبقى بطاقة بلا عمل؛
  // والفائز يظهر بعرضه الموقوف ليستأنفه، أو بلا عرض إن لزمه التوزين (مراجعة Antigravity 2026-11-18)
  const balanceBidders = noEstimate ? [] : project.bidders.filter(b =>
    (b.weightedOffer && b.weightedOffer.status !== 'paused') ||
    (b.id === winner?.id && (!!b.weightedOffer ||
      (hasBidAmounts(b) && b.status !== 'disqualified' && !isCommerciallyExcluded(b, exclusionThreshold) &&
        assessBalance(correctedBalanceRows(b.items), project.deviationThreshold, exclusionThreshold).verdict === 'weighting-required'))));

  // التوصية من المحرك المشترك مع المحضر المطبوع (utils/recommendation.ts)
  const rec = buildRecommendation(project);
  const approval = rec.kind === 'award' && rec.primary
    ? budgetApprovalNote(project.budgetType, rec.primary.totals.totalDeviationPercent) : null;
  // الإعلان الثالث والعطاء الأفضل أعلى من التخمينية (ضوابط (2) ثالثاً/5 و6): عرض فقط، لا يُطبع
  const thirdNote = rec.kind === 'award' && rec.primary
    ? thirdAnnouncementNote(project, rec.primary.totals.totalDeviationPercent) : null;

  // بطاقة الفائز تضم عرضه الموزون تحتها؛ وغير الفائز يبقى في قسم مستقل (قرار أسامة 2026-11-19)
  const sheetTarget = offerSheetTarget(project);
  const winnerCard = rec.kind === 'award' && rec.chosenByCommittee && !!rec.primary;
  const winnerBalance = winnerCard ? balanceBidders.find(b => b.id === winner?.id) : undefined;
  const otherBalance = winnerBalance ? balanceBidders.filter(b => b.id !== winnerBalance.id) : balanceBidders;

  // محتوى التوازن والعرض الموزون لعطاء واحد؛ withName=false داخل بطاقة الفائز لأن اسمه فيها
  const renderBalance = (b: typeof balanceBidders[number], withName: boolean) => {
    const live = !!b.weightedOffer && b.weightedOffer.status !== 'paused';
    return (
      <div key={b.id} className="space-y-2">
        {withName && <div className="text-sm font-black text-slate-800">{b.name}</div>}
        <WeightedOfferBar bidder={b} threshold={project.deviationThreshold} exclusionThreshold={exclusionThreshold} />
        {b.id !== winner?.id && (
          <p className="text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
            العرض الموزون للعطاء الفائز وحده (ضوابط رقم (4) سادساً/5)، وهذا العطاء ليس الفائز في التوصية الحالية{live && '، فأوقف مرحلته من جدول فقراته'}.
          </p>
        )}
        {b.id === winner?.id && !b.weightedOffer && (
          <p className="text-xs font-bold text-amber-900 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 leading-relaxed">
            يلزم اعتماد الجدول الموزون لهذا العطاء (ضوابط رقم (4) سادساً/5): كل فقرة = مبلغها في الكلفة التخمينية × النسبة السعرية. الجدول محسوب تلقائياً، ويظهر في معاينة المحضر وفي ورقة «الجدول الموزون» في تصدير Excel.
          </p>
        )}
        {b.id === winner?.id && sheetTarget.bidder?.id === b.id && sheetTarget.source && (
          <WeightedTableView bidder={b} source={sheetTarget.source} />
        )}
        {b.id === winner?.id && b.weightedOffer?.status === 'paused' && (
          <button
            type="button"
            onClick={() => onResumeWeightedOffer(b.id)}
            aria-label={`استئناف العرض الموزون لعطاء ${b.name}`}
            className="text-xs sm:text-sm font-bold px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-800 text-white cursor-pointer transition"
          >
            استئناف العرض الموزون
          </button>
        )}
        {live && (
          <button
            type="button"
            onClick={() => onOpenWeightedOffer(b.id)}
            aria-label={`فتح العرض الموزون لعطاء ${b.name} في جدول الفقرات`}
            className="text-xs sm:text-sm font-bold px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-800 text-white cursor-pointer transition"
          >
            فتح العرض الموزون في جدول الفقرات
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 mb-8">

      {/* Banner Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 sm:p-8 border border-amber-500/30 shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-6">

          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="p-1.5 bg-amber-500 text-slate-950 rounded-lg font-black text-xs">
                المحضر
              </span>
              {project.entityName && (
                <span className="text-xs text-amber-200 font-bold">
                  {project.entityName}
                </span>
              )}
            </div>

            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2.5">
              {/* «العطاء الفائز» بعد اختيار اللجنة وحده: في الإحالة وإعادة الإعلان لا فائز (مراجعة Antigravity 2026-11-19) */}
              {rec.kind === 'award' && rec.chosenByCommittee ? 'العطاء الفائز ومعاينة المحضر' : 'معاينة المحضر'}
            </h2>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={onOpenPrint}
              className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs sm:text-sm font-black px-4 py-2.5 rounded-xl shadow-md transition transform active:scale-95 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>معاينة المحضر وطباعته</span>
            </button>
            <button
              onClick={onExportExcel}
              className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-emerald-300 text-xs sm:text-sm font-bold px-4 py-2.5 rounded-xl border border-slate-700 transition cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>تصدير Excel</span>
            </button>
          </div>

        </div>
      </div>


      {/* العطاء الفائز: بعد اختيار اللجنة له في «الدراسة والتوصية» */}
      {rec.kind === 'award' && rec.chosenByCommittee && rec.primary ? (
        <div className="bg-white rounded-3xl border border-emerald-200 shadow-sm p-5">
         <div className="flex items-start gap-3">
          <div className="p-2 bg-emerald-600 text-white rounded-xl shadow-xs">
            <Award className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-emerald-900">العطاء الفائز</div>
            <div className="text-base font-black text-slate-900 mt-0.5"><bdi>{rec.primary.name}</bdi></div>
            <div className="text-sm font-bold text-slate-800 mt-1 leading-relaxed">
              المبلغ الإجمالي: <span className="font-mono">{formatCurrency(rec.primary.totals.totalBidderAmount, project.currency)}</span>
              {' — '}الانحراف الكلي: <span className="font-mono" dir="ltr">{formatPercent(rec.primary.totals.totalDeviationPercent, 2, exclusionThreshold)}</span>
            </div>
            <div className="text-xs font-bold text-slate-700 mt-1">
              {rec.chosenNotLowest ? 'باختيار اللجنة، وليس الأوطأ (المادة 10/أولاً/هـ)' : 'أوطأ العطاءات المؤهلة'}
              {isOfferFinal(rec.primary) && '، باعتماد أسعار العرض الموزون المعتمد'}
            </div>
          </div>
         </div>
          {/* العرض الموزون للفائز مباشرة تحت مبلغه (تنبيه مهم لا يُدفن أسفل البطاقة): لا يُطبع */}
          {winnerBalance && (
            <div className="no-print border-t border-emerald-100 mt-3 pt-3">
              {renderBalance(winnerBalance, false)}
            </div>
          )}
          {/* موافقة قبول العطاء (نوع الموازنة) بعد كتلة العرض الموزون */}
          {approval?.kind === 'note' && (
            <div className="text-xs font-bold text-slate-700 mt-3">{approval.text}<OfficialText legalKey={approval.ref} /></div>
          )}
          {thirdNote && (
            <div className="no-print print:hidden text-xs font-bold text-indigo-900 mt-3">{thirdNote.text}<OfficialText legalKey={thirdNote.ref} /></div>
          )}
          {approval?.kind === 'missing' && (
            <div className="text-xs font-bold text-amber-700 mt-3">
              حدّد نوع الموازنة في إعدادات المناقصة لتظهر هنا الموافقة المطلوبة لقبول العطاء (ضوابط رقم (2) رابعاً).
            </div>
          )}
        </div>
      ) : (rec.kind === 'award' || rec.kind === 'tie') ? (
        <div className="bg-slate-50 rounded-3xl border border-slate-200 p-5 flex flex-wrap items-center justify-between gap-3 no-print">
          <div className="text-sm font-bold text-slate-700">
            لم تختر اللجنة العطاء الفائز بعد: اختره من جدول «قرار اللجنة» في «الدراسة والتوصية»
          </div>
          <button
            type="button"
            onClick={onGoStudy}
            className="bg-slate-700 hover:bg-slate-800 text-white text-xs font-black px-4 py-2 rounded-xl cursor-pointer transition"
          >
            الانتقال إلى الدراسة والتوصية
          </button>
        </div>
      ) : (
        <div className="bg-slate-50 rounded-3xl border border-slate-200 p-5 text-sm font-bold text-slate-700 leading-relaxed">
          {rec.kind === 'referral' && rec.primary && (
            <>لا فائز في هذه المناقصة: يُثبت المحضر توصية اللجنة برفع الموضوع إلى اللجنة المركزية للنظر في التفاوض مع (<bdi>{rec.primary.name}</bdi>) لتخفيض الأسعار (المادة 13/ثالثاً/ب).</>
          )}
          {rec.kind === 'retender' && (
            <>لا فائز في هذه المناقصة: يُثبت المحضر توصية اللجنة بعرض الموضوع على جهة التعاقد للنظر في إعادة الإعلان (المادة 20/{rec.retenderReason === 'lowest-below' ? 'رابعاً' : 'ثالثاً'}).</>
          )}
          {rec.kind === 'no-estimate' && (
            <span className="text-rose-700">لم تُدخل الكلفة التخمينية بعد — لا تُصاغ توصية قبل إدخالها.</span>
          )}
        </div>
      )}

      {otherBalance.length > 0 && (
        <div className="space-y-4 no-print">
          <h3 className="text-sm sm:text-base font-black text-slate-800">{winnerBalance ? 'عروض موزونة لعطاءات غير الفائز' : rec.kind !== 'award' ? 'العرض الموزون' : rec.chosenByCommittee ? 'العرض الموزون للعطاء الفائز' : 'العرض الموزون لأوطأ العطاءات المؤهلة (المرشّح للترسية)'}</h3>
          {otherBalance.map(b => renderBalance(b, true))}
        </div>
      )}

    </div>
  );
};

import React from 'react';
import { Award, FileSpreadsheet, Printer } from 'lucide-react';
import { TenderProject } from '../types/tender';
import { formatCurrency, formatPercent } from '../utils/calculations';
import { buildRecommendation, hasNoEstimate, exclusionThresholdOf, offerWinner, hasBidAmounts, isCommerciallyExcluded } from '../utils/recommendation';
import { budgetApprovalNote } from '../utils/budgetTypes';
import { isOfferFinal, assessBalance, correctedBalanceRows, startOfferBlocker } from '../utils/weightedOffer';
import { WeightedOfferBar } from './WeightedOfferBar';
import { StartMenu } from './WeightedOfferControl';

interface ReportViewProps {
  project: TenderProject;
  /** ينقل إلى «الدراسة والتوصية» لاختيار العطاء الفائز */
  onGoStudy: () => void;
  onOpenPrint: () => void;
  onExportExcel: () => void;
  /** يختار المجهز وينقل إلى جدول الفقرات في تبويب «العطاءات والتدقيق» لإعداد عرضه الموزون */
  onOpenWeightedOffer: (bidderId: string) => void;
  /** يبدأ العرض الموزون أو يستأنفه لمجهز بعينه ثم ينقل إلى جدول فقراته */
  onStartWeightedOffer: (bidderId: string, origin: 'corrected' | 'formula' | 'resume') => void;
}

/** «المحضر»: العطاء الفائز بعد اختيار اللجنة، وعرضه الموزون، ومعاينة المحضر وطباعته */
export const ReportView: React.FC<ReportViewProps> = ({
  project,
  onGoStudy,
  onOpenPrint,
  onExportExcel,
  onOpenWeightedOffer,
  onStartWeightedOffer
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
        <div className="bg-white rounded-3xl border border-emerald-200 shadow-sm p-5 flex items-start gap-3">
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
            {approval?.kind === 'note' && (
              <div className="text-xs font-bold text-slate-700 mt-1">{approval.text}</div>
            )}
            {approval?.kind === 'missing' && (
              <div className="text-xs font-bold text-amber-700 mt-1">
                حدّد نوع الموازنة في إعدادات المناقصة لتظهر هنا الموافقة المطلوبة لقبول العطاء (ضوابط رقم (2) رابعاً).
              </div>
            )}
          </div>
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

      {balanceBidders.length > 0 && (
        <div className="space-y-4 no-print">
          <h3 className="text-sm sm:text-base font-black text-slate-800">{rec.kind !== 'award' ? 'العرض الموزون' : rec.chosenByCommittee ? 'العرض الموزون للعطاء الفائز' : 'العرض الموزون لأوطأ العطاءات المؤهلة (المرشّح للترسية)'}</h3>
          {balanceBidders.map(b => {
            const live = !!b.weightedOffer && b.weightedOffer.status !== 'paused';
            return (
              <div key={b.id} className="space-y-2">
                <div className="text-sm font-black text-slate-800">{b.name}</div>
                <WeightedOfferBar bidder={b} threshold={project.deviationThreshold} exclusionThreshold={exclusionThreshold} />
                {b.id !== winner?.id && (
                  <p className="text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                    العرض الموزون للعطاء الفائز وحده (ضوابط رقم (4) سادساً/5)، وهذا العطاء ليس الفائز في التوصية الحالية{live && '، فأوقف مرحلته من جدول فقراته'}.
                  </p>
                )}
                {b.id === winner?.id && !live && (
                  <StartMenu
                    paused={b.weightedOffer?.status === 'paused'}
                    blocker={startOfferBlocker(b, exclusionThreshold)}
                    onStart={(o) => onStartWeightedOffer(b.id, o)}
                  />
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
          })}
        </div>
      )}

    </div>
  );
};

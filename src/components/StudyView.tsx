import React from 'react';
import { CheckCircle2, XCircle, Building2, FileCheck, Award } from 'lucide-react';
import { TenderProject, Bidder, PreferenceRecord } from '../types/tender';
import { formatNumber, formatCurrency, formatPercent } from '../utils/calculations';
import { buildRecommendation, equalPriceBids, hasBidAmounts, hasNoEstimate, eligibilityCounts, exclusionThresholdOf, PREFERENCE_BAND_PERCENT } from '../utils/recommendation';
import { preferenceReference } from '../utils/contractTypes';
import { recommendationBasis, recommendationEditChanges, savedRecommendationEdit } from '../utils/recommendationText';
import { decisionSensitivity } from '../utils/decisionSensitivity';
import { isOfferFinal } from '../utils/weightedOffer';
import { rankingEffect } from '../utils/rankingEffect';
import { evaluateBids } from '../utils/bidEvaluation';
import { bidderAuditState, tenderPath, unpricedCount } from '../utils/tenderPath';
import { isPreAwardStatus } from '../utils/statusLag';
import { statusBadgeText } from '../utils/orderStatus';
import { errorsCountText, unpricedCountText } from '../utils/arabicCount';
import { unresolvedEmptyBidders } from '../utils/exclusionReasons';
import { awardBlockers, needsAwardDialog } from '../utils/awardBlockers';
import { LEGAL_TEXTS } from '../utils/legalTexts';
import { hasCompletePreferenceRecord, preferenceRecordOf } from '../utils/preferenceBasis';
import { AwardBlockersModal } from './modals/AwardBlockersModal';
import { PreferenceBasisModal } from './modals/PreferenceBasisModal';

interface StudyViewProps {
  project: TenderProject;
  onOpenExclusionReasons: (id: string) => void;
  onSelectBidder: (id: string) => void;
  onUpdateBidderStatus: (id: string, status: Bidder['status'], reason?: string) => void;
  /** يفتح نافذة الموقف (نموذج مدخل جديد بتاريخ اليوم) */
  onOpenStatus: (opts?: { award?: boolean }) => void;
  /** يفتح عرض التدقيق في تبويب «العطاءات والتدقيق» عند أول مجهز فيه فقرات فيها أخطاء */
  onOpenAudit: (bidderId?: string) => void;
  /** ينتقل إلى تبويب العطاءات على المجهز لإدخال عطائه */
  onEnterBid: (id: string) => void;
  onDeleteBidder: (id: string) => void;
  // مقارنة المجهزين والرسوم: زرّان في شريط الدراسة
  onOpenMatrix: () => void;
  chartsOpen: boolean;
  onToggleCharts: () => void;
  /** يحفظ أساس المفاضلة؛ يعيد رسالة خطأ عربية أو null */
  onSavePreferenceInitiatives: (records: PreferenceRecord[]) => string | null;
  /** إدخال لم يُحفظ في نوافذ الدراسة (يمنع التحديث) */
  onDirtyChange: (dirty: boolean) => void;
}

/** «الدراسة والتوصية»: مقارنة العطاءات تجارياً، وتوصية اللجنة، وقرار الترسية (اختيار الفائز) */
export const StudyView: React.FC<StudyViewProps> = ({
  project,
  onOpenExclusionReasons,
  onSelectBidder,
  onUpdateBidderStatus,
  onOpenStatus,
  onOpenAudit,
  onEnterBid,
  onDeleteBidder,
  onOpenMatrix,
  chartsOpen,
  onToggleCharts,
  onSavePreferenceInitiatives,
  onDirtyChange
}) => {
  // الترسية المؤجَّلة بانتظار موقف الشركات غير المحسومة
  const [pendingAwardId, setPendingAwardId] = React.useState<string | null>(null);
  // نافذة أساس المفاضلة (من زرها أو من نافذة الموانع)
  const [prefOpen, setPrefOpen] = React.useState(false);
  // بعد الترسية: إن بقي الموقف المسجَّل قبلها (أو لم يُسجَّل) تُسأل اللجنة عن تسجيل الجديد؛ لا يُكتب موقف تلقائياً
  const askRecordStatus = () => {
    if (!isPreAwardStatus(project)) return;
    const had = project.statusLog?.length ? `الموقف المسجَّل للطلبية: «${statusBadgeText(project.statusLog).replace(/^الموقف: /, '')}».` : 'لم يُسجَّل موقف للطلبية.';
    // بعد أن يُرسَل تحديث الحالة وتُغلق النافذة، فلا تقطع نقل التركيز
    setTimeout(() => { if (window.confirm(`${had} اختارت اللجنة الترسية الآن، فهل تسجّل الموقف الجديد؟`)) onOpenStatus({ award: true }); }, 0);
  };
  const chooseAward = (id: string) => {
    if (needsAwardDialog(awardBlockers(project, id))) { setPendingAwardId(id); return; }
    onSelectBidder(id);
    onUpdateBidderStatus(id, 'recommended');
    askRecordStatus();
  };
  const pendingAward = pendingAwardId ? project.bidders.find(b => b.id === pendingAwardId) : undefined;
  const estimatedTotal = project.bidders[0]?.totals.totalEstimatedAmount || 0;
  const noEstimate = hasNoEstimate(project);
  const exclusionThreshold = exclusionThresholdOf(project);
  const counts = eligibilityCounts(project);
  // شركات بلا مبالغ بعد لا تُعد عروضاً (انظر hasBidAmounts)
  const emptyBidders = unresolvedEmptyBidders(project);
  const excludedEmpty = project.bidders.filter(b => !hasBidAmounts(b) && b.status === 'disqualified');
  const sortedBidders = evaluateBids(project);
  // التوصية من المحرك المشترك مع المحضر المطبوع (utils/recommendation.ts)
  const rec = buildRecommendation(project);
  // قرار الترسية على المؤهلين وحدهم؛ المستبعدون في جدول المقارنة أعلاه
  const decisionBids = sortedBidders.filter(b => b.commercialStatus === 'qualified' || b.commercialStatus === 'recommended');
  const excludedCount = sortedBidders.filter(b => b.commercialStatus === 'excluded').length;
  // ملاحظة الموازنة تنتقل إلى «المحضر» مع العطاء الفائز
  // صياغة اللجنة للتوصية: هنا تُذكر وحدها مع تغيّر أساسها. تغيّر صياغة النظام يُفحص في المعاينة، لأن خيار جدول
  // الأسعار الموزونة يغيّرها ولا يُعرف هنا
  const savedEdit = rec.kind !== 'no-estimate' ? savedRecommendationEdit(project) : undefined;
  const basisChanges = savedEdit ? recommendationEditChanges(savedEdit, { basis: recommendationBasis(rec), systemText: savedEdit.systemText }) : [];

  return (
    <div className="space-y-6 mb-8">

      {/* Banner Summary Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 sm:p-8 border border-amber-500/30 shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-6">

          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="p-1.5 bg-amber-500 text-slate-950 rounded-lg font-black text-xs">
                الدراسة والتوصية
              </span>
              {project.entityName && (
                <span className="text-xs text-amber-200 font-bold">
                  {project.entityName}
                </span>
              )}
            </div>

            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2.5">
              دراسة العطاءات وتحليلها
            </h2>

            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
              جدول المقارنة النهائي للعروض المقدمة من المجهزين والمقاولين لفرز العطاءات المقبولة وتحديد العطاءات المستبعدة تجارياً بسبب الانحرافات أو عدم التوازن السعري وفق تعليمات العقود.
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={onOpenMatrix}
              className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs sm:text-sm font-bold px-4 py-2.5 rounded-xl border border-slate-700 transition cursor-pointer"
              title="مقارنة كافة المجهزين"
            >
              <span>👥 مقارنة المجهزين</span>
            </button>
            <button
              onClick={onToggleCharts}
              aria-pressed={chartsOpen}
              className={`flex items-center gap-2 text-xs sm:text-sm font-bold px-4 py-2.5 rounded-xl border transition cursor-pointer ${
                chartsOpen ? 'bg-slate-100 text-slate-900 border-slate-300' : 'bg-slate-800 hover:bg-slate-700 text-slate-100 border-slate-700'
              }`}
              title={chartsOpen ? 'إخفاء الرسوم البيانية' : 'إظهار الرسوم البيانية تحت الملخص'}
            >
              <span>📊 الرسوم</span>
            </button>
          </div>

        </div>

        {/* Highlight Banner: Estimated Cost & Bidders Count */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-800 text-xs">
          <div className="bg-slate-800/60 p-3 rounded-2xl border border-slate-700">
            <div className="text-slate-400 font-semibold mb-1">الكلفة التخمينية المعتمدة</div>
            <div className={`text-base sm:text-lg font-black font-mono ${noEstimate ? 'text-slate-400' : 'text-amber-400'}`}>
              {noEstimate ? 'بانتظار التخميني' : formatCurrency(estimatedTotal, project.currency)}
            </div>
          </div>

          <div className="bg-slate-800/60 p-3 rounded-2xl border border-slate-700">
            <div className="text-slate-400 font-semibold mb-1">إجمالي العروض المستلمة</div>
            <div className="text-base sm:text-lg font-black text-white font-mono">
              {sortedBidders.length} شركات
            </div>
          </div>

          <div className="bg-slate-800/60 p-3 rounded-2xl border border-slate-700">
            <div className="text-slate-400 font-semibold mb-1">العطاءات المؤهلة</div>
            <div className={`text-base sm:text-lg font-black font-mono ${noEstimate ? 'text-slate-400' : 'text-emerald-400'}`}>
              {noEstimate ? 'بانتظار التخميني' : `${counts?.eligible ?? 0} عروض`}
            </div>
          </div>

          <div className="bg-slate-800/60 p-3 rounded-2xl border border-slate-700">
            <div className="text-slate-400 font-semibold mb-1">المستبعدة</div>
            <div className={`text-base sm:text-lg font-black font-mono ${noEstimate ? 'text-slate-400' : 'text-rose-400'}`}>
              {noEstimate ? 'بانتظار التخميني' : `${counts?.excluded ?? 0} عروض`}
            </div>
          </div>
        </div>

      </div>

      {/* مؤشر الفقرات بانتظار قرار اللجنة: النقر يفتح عرض التدقيق، وهادئ أخضر عند الصفر */}
      {(() => {
        const pending = tenderPath(project).audit.pending;
        return pending > 0 ? (
          <button
            type="button"
            onClick={() => onOpenAudit()}
            className="w-full flex flex-wrap items-center justify-between gap-2 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 rounded-2xl px-4 py-3 text-sm font-black cursor-pointer transition no-print"
          >
            <span>فقرات فيها أخطاء لم تُعالج: <bdi className="font-mono">{pending}</bdi></span>
            <span className="text-xs underline">عرض الفقرات التي فيها أخطاء</span>
          </button>
        ) : (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl px-4 py-3 text-sm font-black no-print">
            <span aria-hidden="true">✓ </span>لا أخطاء لم تُعالج
          </div>
        );
      })()}

      {/* Main Commercial Comparison Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-indigo-600" />
            <h3 className="font-black text-slate-900 text-sm sm:text-base">
              مقارنة العطاءات تجارياً
            </h3>
          </div>
          <span className="text-xs text-slate-500 font-semibold">
            مرتبة من الأوطأ مبلغاً، والمستبعد في الأسفل
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm text-right border-collapse">
            <thead className="bg-slate-900 text-slate-100 uppercase text-xs font-black select-none">
              <tr>
                <th className="p-3.5 text-center w-12 border-l border-slate-800">التسلسل</th>
                <th className="p-3.5 min-w-[220px] border-l border-slate-800">اسم الشركة / المقاول</th>
                <th className="p-3.5 text-center w-36 border-l border-slate-800 text-indigo-300">مبلغ العرض المقدم</th>
                <th className="p-3.5 text-center w-32 border-l border-slate-800">الانحراف الكلي %</th>
                <th className="p-3.5 text-center w-32 border-l border-slate-800">الانحراف الجزئي %</th>
                <th className="p-3.5 text-center w-28 border-l border-slate-800 text-purple-200">النسبة السعرية</th>
                <th className="p-3.5 text-center w-28 border-l border-slate-800">التدقيق</th>
                <th className="p-3.5 text-center w-44 border-l border-slate-800">الموقف التجاري والرقابي</th>
                <th className="p-3.5 min-w-[260px]">أسباب القبول أو الاستبعاد</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200 bg-white font-medium">
              {sortedBidders.map((bidder, idx) => {
                const isExcluded = bidder.commercialStatus === 'excluded';
                const isRec = (rec.kind === 'award' && bidder.id === rec.primary?.id)
                  || (rec.kind === 'tie' && rec.closeBids.some(c => c.id === bidder.id));

                return (
                  <tr
                    key={bidder.id}
                    className={`hover:bg-blue-50/40 transition ${
                      isExcluded
                        ? 'bg-rose-50/30'
                        : isRec
                        ? 'bg-emerald-50/40 font-bold'
                        : ''
                    }`}
                  >
                    {/* التسلسل */}
                    <td className="p-3.5 text-center font-black text-slate-700 border-l border-slate-200 bg-slate-50">
                      {idx + 1}
                    </td>

                    {/* اسم الشركة */}
                    <td className="p-3.5 border-l border-slate-200">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                        <div>
                          <div className="font-black text-slate-900 text-sm">
                            {bidder.name}
                          </div>
                          {bidder.commercialRecord && (
                            <div className="text-[11px] text-slate-500 font-mono">
                              {bidder.commercialRecord}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* مبلغ العرض */}
                    <td className="p-3.5 text-center font-black text-slate-900 border-l border-slate-200 text-sm">
                      {formatNumber(bidder.totals.totalBidderAmount)}
                      {!noEstimate && (
                        <div className={`text-[11px] font-bold ${bidder.diff > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                          <span dir="ltr">{bidder.diff > 0 ? '+' : ''}{formatNumber(bidder.diff)}</span> {project.currency}
                        </div>
                      )}
                    </td>

                    {/* الانحراف الكلي والجزئي والنسبة السعرية: «—» قبل الكلفة التخمينية بدل أصفار توحي بالمطابقة */}
                    {noEstimate ? (
                      <td colSpan={3} className="p-3.5 text-center border-l border-slate-200 text-xs font-bold text-slate-400">
                        — بانتظار الكلفة التخمينية —
                      </td>
                    ) : (<>
                    <td className="p-3.5 text-center border-l border-slate-200 font-black">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black ${
                        Math.abs(bidder.totals.totalDeviationPercent) > exclusionThreshold
                          ? 'bg-rose-100 text-rose-900 border border-rose-300'
                          : bidder.totals.totalDeviationPercent < 0
                          ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                          : 'bg-slate-100 text-slate-800'
                      }`}>
                        <span dir="ltr">{formatPercent(bidder.totals.totalDeviationPercent, 2, exclusionThreshold)}</span>
                      </span>
                    </td>

                    {/* الانحراف الجزئي */}
                    <td className="p-3.5 text-center border-l border-slate-200 font-black">
                      {/* استرشادي فقط - لا يُستخدم في الجدول المعتمد كمعيار استبعاد أو تحذير مستقل */}
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-slate-100 text-slate-700">
                        <span dir="ltr">{bidder.totals.partialDeviationPercent.toFixed(2)}%</span>
                      </span>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        ({bidder.totals.deviatedItemsCount} فقرة منحرفة بالزيادة أو النقصان)
                      </div>
                    </td>

                    {/* النسبة السعرية */}
                    <td className="p-3.5 text-center font-mono font-bold text-purple-700 border-l border-slate-200">
                      {bidder.totals.overallPriceRatio.toFixed(4)}
                    </td>
                    </>)}

                    {/* حالة التدقيق الحسابي: عدد الفقرات المعلّقة أو «مكتمل» */}
                    <td className="p-3.5 text-center border-l border-slate-200 text-xs font-black">
                      {(() => {
                        const st = bidderAuditState(bidder);
                        return st.kind === 'pending'
                          ? <span className="text-amber-800">{errorsCountText(st.count)}</span>
                          : <span className="text-emerald-700">مكتمل</span>;
                      })()}
                      {/* غير المسعّرة عرض فقط (المادة 10/أولاً/ط)، ليست خطأً */}
                      {unpricedCount(bidder) > 0 && (
                        <div className="text-slate-600 text-[10px] font-bold mt-0.5">{unpricedCountText(unpricedCount(bidder))}</div>
                      )}
                    </td>

                    {/* الموقف التجاري */}
                    <td className="p-3.5 text-center border-l border-slate-200">
                      {bidder.commercialStatus === 'pending' ? (
                        <span className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-600 border border-slate-300 text-xs font-black px-3 py-1 rounded-full">
                          بانتظار التخميني
                        </span>
                      ) : isExcluded ? (
                        <span className="inline-flex items-center gap-1.5 bg-rose-100 text-rose-800 border border-rose-300 text-xs font-black px-3 py-1 rounded-full">
                          <XCircle className="w-4 h-4 text-rose-600" />
                          {bidder.status === 'disqualified' ? 'مستبعد بقرار اللجنة' : 'مستبعد تجارياً'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-900 border border-emerald-300 text-xs font-black px-3 py-1 rounded-full">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          {bidder.unbalancedItems ? 'مؤهل تجارياً' : 'مؤهل ومتوازن'}
                        </span>
                      )}
                    </td>

                    {/* الأسباب والتحليل */}
                    <td className="p-3.5 text-xs leading-relaxed">
                      <div className="text-slate-700 font-semibold">
                        {bidder.commercialReason}
                      </div>
                      {bidder.status === 'disqualified' && (
                        <button
                          type="button"
                          onClick={() => onOpenExclusionReasons(bidder.id)}
                          aria-label={`أسباب استبعاد ${bidder.name}`}
                          className="mt-1.5 text-[11px] font-bold text-rose-700 hover:underline cursor-pointer"
                        >
                          أسباب الاستبعاد
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {emptyBidders.length > 0 && (
          <div className="px-5 py-2.5 bg-slate-50 border-t border-slate-200 text-xs font-bold text-slate-500">
            شركات بلا مبالغ بعد، لا تدخل المقارنة ولا التوصية ولا المحضر: {emptyBidders.map(b => b.name).join('، ')}.
            يمكن حذفها من «مقارنة المجهزين» إن أُضيفت خطأً.
          </div>
        )}
        {excludedEmpty.length > 0 && (
          <div className="px-5 py-2.5 bg-slate-50 border-t border-slate-200 text-xs font-bold text-slate-500">
            مستبعدة قبل التحليل التجاري (تُطبع أسبابها في المحضر):{' '}
            {excludedEmpty.map((b, i) => (
              <React.Fragment key={b.id}>
                {i > 0 && '، '}
                <button type="button" onClick={() => onOpenExclusionReasons(b.id)}
                  className="underline decoration-dotted text-rose-700 hover:text-rose-900 cursor-pointer">
                  <bdi>{b.name}</bdi> — الأسباب ({b.exclusionReasons?.length ?? 0})
                </button>
              </React.Fragment>
            ))}
          </div>
        )}

      </div>

      {(() => {
        const s = decisionSensitivity(project);
        if (!s) return null;
        return (
          <div role="alert" className="no-print bg-amber-50 border border-amber-300 rounded-3xl shadow-sm p-4 sm:p-5 text-amber-900">
            <h3 className="font-black text-sm sm:text-base"><span aria-hidden="true">⚠️ </span>لا تعتمد الترسية قبل مطابقة فقرات بالورقة</h3>
            <div className="text-xs sm:text-sm font-semibold mt-1.5 leading-relaxed">
              الفرق بين <bdi>{s.primary.name}</bdi> و<bdi>{s.rival.name}</bdi> هو <bdi className="font-mono">{formatNumber(s.gap)}</bdi> {project.currency}،
              وفقرات القراءة الآلية التي لم تُطابَق بالورقة بعد تبلغ عند هذين العطاءين <bdi className="font-mono">{formatNumber(s.primary.amount + s.rival.amount)}</bdi> {project.currency}:
              فخطأ قراءة واحد بهذا الحجم قد يبدّل الترتيب.
            </div>
            <ul className="text-xs sm:text-sm mt-1.5 list-disc pr-5">
              {[s.primary, s.rival].filter(e => e.rows > 0).map(e => (
                <li key={e.bidderId}>
                  <bdi>{e.name}</bdi>: <bdi className="font-mono">{e.rows}</bdi> فقرة بمبلغ <bdi className="font-mono">{formatNumber(e.amount)}</bdi> {project.currency}
                </li>
              ))}
            </ul>
            <div className="text-xs font-semibold mt-1.5">تجدها في بطاقة «موثوقية القراءة» فوق جدول المجهز في تبويب «العطاءات والتدقيق». المبلغ حدّ أعلى متحفظ: يعدّ كل مبلغ الفقرة معرَّضاً للخطأ.</div>
          </div>
        );
      })()}

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">

        {/* Recommendation Statement */}
        <div className="p-5 bg-gradient-to-r from-emerald-50 via-teal-50 to-blue-50 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-emerald-600 text-white rounded-xl shadow-xs">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs font-bold text-emerald-900">
                التوصية التجارية للجنة التحليل:
              </div>
              <div className="text-sm font-black text-slate-900 mt-0.5 leading-relaxed">
                {rec.kind === 'award' && rec.primary && (
                  <>
                    الإحالة على: <span className="text-emerald-700 underline font-black">({rec.primary.name})</span> بمبلغ إجمالي <span className="font-mono">{formatCurrency(rec.primary.totals.totalBidderAmount, project.currency)}</span>
                    {rec.chosenNotLowest ? ' — باختيار اللجنة، وليس الأوطأ (تُثبت المسوغات في التقرير — المادة 10/أولاً/هـ)' : ' — أوطأ العطاءات المؤهلة'}
                    {isOfferFinal(rec.primary) && '، باعتماد أسعار العرض الموزون المعتمد بقرار اللجنة'}.
                  </>
                )}
                {rec.kind === 'tie' && (
                  <>
                    العطاءات ({rec.closeBids.map(b => b.name).join('، ')}) {rec.exactTie ? 'متساوية في مبالغها' : `متقاربة لغاية (${PREFERENCE_BAND_PERCENT}%) من الكلفة التخمينية`} — تُطبق معايير المفاضلة ({preferenceReference(project.contractType).clause})، ثم اختر الفائز بزر «اختيار للترسية».
                  </>
                )}
                {rec.kind === 'referral' && rec.primary && (
                  <>
                    لا يوجد عطاء ضمن الحدود المقبولة — التوصية برفع الموضوع إلى اللجنة المركزية للنظر في التفاوض مع ({rec.primary.name}) لتخفيض الأسعار (المادة 13/ثالثاً/ب).
                  </>
                )}
                {rec.kind === 'retender' && (
                  <>
                    لا يوجد عطاء مؤهل — التوصية بعرض الموضوع على جهة التعاقد للنظر في إعادة الإعلان (المادة 20/{rec.retenderReason === 'lowest-below' ? 'رابعاً' : 'ثالثاً'}).
                  </>
                )}
                {rec.kind === 'no-estimate' && (
                  <span className="text-rose-700">
                    لم تُدخل الكلفة التخمينية بعد — لا تُصاغ توصية قبل إدخالها.
                  </span>
                )}
              </div>
              {/* مرحلة التحليل: التساوي لأصغر فئة نقدية يجيز استكمال المبادرات (ضوابط رقم (5))، فتُنبَّه اللجنة إلى مخاطبة
                  المجهزين قبل المفاضلة. التقارب لغاية 1% يُفاضَل فيه بما قُدّم فلا يشمله. طلب المستخدم 2026-10-21 */}
              {rec.kind === 'tie' && equalPriceBids(rec.closeBids).length > 1 && (
                <div className="text-xs font-bold text-amber-800 mt-1 leading-relaxed">
                  📌 الأسعار متساوية لأصغر فئة نقدية: تُخاطَب الشركات ({equalPriceBids(rec.closeBids).map(b => b.name).join('، ')}) لتقديم مبادراتها لغرض المفاضلة إن لم تقدّمها ابتداءً، وتصبح المبادرات جزءاً من العطاء، ويُستقطع مبلغ ما لا يُلتزم به عند التنفيذ حسب الأسعار السائدة ({preferenceReference(project.contractType).clause}).
                  {' '}{project.splitAllowed === true
                    ? 'وشروط المناقصة تجيز إرساءها على أكثر من متقدم: فإن تساوت الشروط أيضاً فللجنة أن توصي بإرسائها عليها مجزّأة (المادة 15/رابعاً/أ).'
                    : 'وإن نصّت شروط المناقصة على جواز إرسائها على أكثر من متقدم وتساوت الشروط أيضاً، فللجنة أن توصي بإرسائها عليها مجزّأة (المادة 15/رابعاً/أ).'}
                </div>
              )}
              {project.splitAllowed === true && !noEstimate && (
                <div className="text-xs font-bold text-indigo-900 mt-1.5 leading-relaxed no-print">
                  شروط المناقصة تجيز الإرساء على أكثر من متقدم: عند تساوي الأسعار والشروط (المادة 15/رابعاً/أ)، أو بتجزئة الكميات بين مقدمي العطاءات وفق أقل الأسعار مع إعلام الوزارة (المادة 15/رابعاً/ب، والملحق 1/د). النظام يرسي على مجهز واحد، فإن قررت اللجنة التجزئة تُثبتها في صياغة التوصية.
                  <details className="mt-1 font-normal">
                    <summary className="cursor-pointer font-bold underline">النص الرسمي</summary>
                    {(['art15_4a', 'art15_4b', 'ann1_d'] as const).map(k => (
                      <blockquote key={k} className="mt-1 rounded-lg border border-indigo-100 bg-white px-3 py-2 leading-relaxed text-slate-700">
                        <span className="font-bold">{LEGAL_TEXTS[k].label}:</span> «{LEGAL_TEXTS[k].text}» (ص {LEGAL_TEXTS[k].page})
                      </blockquote>
                    ))}
                  </details>
                </div>
              )}
              {rec.closeBids.length > 1 && (
                <button type="button" onClick={() => setPrefOpen(true)}
                  className="mt-1.5 text-xs font-black px-3 py-1.5 rounded-lg border border-indigo-300 bg-indigo-50 text-indigo-900 hover:bg-indigo-100 cursor-pointer no-print">
                  أساس المفاضلة ({rec.closeBids.filter(b => hasCompletePreferenceRecord(project, b.id)).length} من {rec.closeBids.length})
                </button>
              )}
              {rec.closeBids.length > 1 && (
                <ul className="mt-1.5 space-y-0.5 text-xs no-print">
                  {rec.closeBids.map(b => {
                    const r = preferenceRecordOf(project, b.id);
                    return (
                      <li key={b.id} className="leading-relaxed">
                        <bdi className="font-black text-slate-900">{b.name}</bdi>
                        {': '}
                        {!r ? <span className="font-bold text-amber-700">لم يُسجَّل بعد</span>
                          : !r.hasInitiative ? <span className="text-slate-500">لم تقدّم مبادرات</span>
                          : <span className="text-slate-700">
                              {r.items.map(i => `${i.type}: ${i.description}${i.value !== undefined ? ` (${formatCurrency(i.value, project.currency)})` : ''}${i.completedOnRequest ? ' — مستكمَلة بطلب اللجنة' : ''}`).join('؛ ')}
                            </span>}
                      </li>
                    );
                  })}
                </ul>
              )}
              {savedEdit && (
                <div className="text-xs font-bold text-indigo-800 mt-1">
                  ✎ تُطبع التوصية في المحضر بصياغة اللجنة
                  {basisChanges.length > 0 && <span className="text-rose-700"> — وتغيّر ما بُنيت عليه: {basisChanges.join('؛ ')}. راجعها من «معاينة المحضر وطباعته» في تبويب «المحضر».</span>}
                </div>
              )}
            </div>
          </div>

          {rec.kind === 'award' && rec.primary && rec.primary.status !== 'recommended' && (
            <button
              onClick={() => chooseAward(rec.primary!.id)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black px-5 py-2.5 rounded-xl shadow-md transition transform active:scale-95 cursor-pointer"
            >
              اعتماد الترسية على هذا العطاء
            </button>
          )}
        </div>

        {/* جدول قرار اللجنة: المؤهلون وحدهم، ولا يظهر قبل الكلفة التخمينية */}
        {!noEstimate && (
          <>
            <div className="p-4 sm:p-5 bg-slate-50 border-y border-slate-200">
              <h3 className="font-black text-slate-900 text-sm sm:text-base">قرار اللجنة</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs sm:text-sm text-right border-collapse">
                <thead className="bg-slate-900 text-slate-100 uppercase text-xs font-black select-none">
                  <tr>
                    <th className="p-3.5 min-w-[220px] border-l border-slate-800">اسم الشركة / المقاول</th>
                    <th className="p-3.5 text-center w-36 border-l border-slate-800 text-indigo-300">مبلغ العرض المقدم</th>
                    <th className="p-3.5 text-center w-32 border-l border-slate-800">الانحراف الكلي %</th>
                    <th className="p-3.5 text-center w-44 border-l border-slate-800">الموقف التجاري والرقابي</th>
                    <th className="p-3.5 text-center w-36">قرار اللجنة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white font-medium">
                  {decisionBids.length === 0 && (
                    <tr><td colSpan={5} className="p-4 text-center text-xs font-bold text-slate-500">لا عطاء مؤهل للترسية في هذه المناقصة</td></tr>
                  )}
                  {decisionBids.map(bidder => (
                    <tr key={bidder.id} className="hover:bg-blue-50/40 transition">
                      <td className="p-3.5 border-l border-slate-200 font-black text-slate-900 text-sm">{bidder.name}</td>
                      <td className="p-3.5 text-center font-black text-slate-900 border-l border-slate-200 text-sm">
                        {formatNumber(bidder.totals.totalBidderAmount)}
                      </td>
                      <td className="p-3.5 text-center border-l border-slate-200 font-black">
                        <span dir="ltr">{formatPercent(bidder.totals.totalDeviationPercent, 2, exclusionThreshold)}</span>
                      </td>
                      <td className="p-3.5 text-center border-l border-slate-200">
                        <span className="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-900 border border-emerald-300 text-xs font-black px-3 py-1 rounded-full">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          {bidder.unbalancedItems ? 'مؤهل تجارياً' : 'مؤهل ومتوازن'}
                        </span>
                      </td>
                      <td className="p-3.5 text-center">
                        <button
                          type="button"
                          aria-pressed={bidder.status === 'recommended'}
                          aria-label={bidder.status === 'recommended' ? `${bidder.name}: مُوصى به` : `اختيار ${bidder.name} للترسية`}
                          onClick={() => {
                            if (bidder.status === 'recommended') return;
                            chooseAward(bidder.id);
                          }}
                          className={`w-full text-xs font-black px-3 py-1.5 rounded-xl transition cursor-pointer ${
                            bidder.status === 'recommended'
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300'
                          }`}
                        >
                          {bidder.status === 'recommended' ? '★ مُوصى به' : 'اختيار للترسية'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {excludedCount > 0 && (
              <div className="px-5 py-2.5 bg-slate-50 border-t border-slate-200 text-xs font-bold text-slate-500">
                العطاءات المستبعدة ({excludedCount}) معروضة في جدول المقارنة أعلاه
              </div>
            )}
          </>
        )}

      </div>

      {(() => {
        const effect = rankingEffect(project);
        if (!effect) return null;
        return (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-black text-slate-900 text-sm sm:text-base">أثر التصحيح الحسابي على الترتيب</h3>
              <span className="text-xs text-slate-500 font-semibold">ضوابط رقم (4) خامساً/ب/6</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs sm:text-sm text-right border-collapse">
                <thead className="bg-slate-900 text-slate-100 text-xs font-black select-none">
                  <tr>
                    <th className="p-3.5 min-w-[180px] border-l border-slate-800">المجهز</th>
                    <th className="p-3.5 text-center border-l border-slate-800">مبلغه كما قدّمه</th>
                    <th className="p-3.5 text-center w-24 border-l border-slate-800">رتبته قبل التصحيح</th>
                    <th className="p-3.5 text-center border-l border-slate-800">مبلغه بعد التصحيح</th>
                    <th className="p-3.5 text-center w-24 border-l border-slate-800">رتبته بعد التصحيح</th>
                    <th className="p-3.5 text-center w-40">التغيّر</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white font-medium">
                  {[...effect.rows].sort((a, b) => a.rankAfter - b.rankAfter).map(r => (
                    <tr key={r.bidderId} className={r.rankBefore !== r.rankAfter ? 'bg-amber-50/50 font-bold' : ''}>
                      <td className="p-3.5 border-l border-slate-200">{r.name}</td>
                      <td className="p-3.5 text-center font-mono whitespace-nowrap border-l border-slate-200">{formatNumber(r.submittedTotal)}</td>
                      <td className="p-3.5 text-center font-black border-l border-slate-200">{r.rankBefore}</td>
                      <td className="p-3.5 text-center font-mono whitespace-nowrap border-l border-slate-200">{formatNumber(r.correctedTotal)}</td>
                      <td className="p-3.5 text-center font-black border-l border-slate-200">{r.rankAfter}</td>
                      <td className="p-3.5 text-center">
                        {r.rankBefore !== r.rankAfter
                          ? <span className="text-amber-700">{r.rankBefore} ← {r.rankAfter}</span>
                          : <span className="text-slate-600 font-semibold">{r.hasCorrections ? 'مصحَّح، الرتبة ثابتة' : '—'}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className={`p-4 text-xs sm:text-sm font-black ${effect.changed ? 'text-amber-800' : 'text-slate-700'}`}>
              {effect.changed ? 'غيّر التصحيح الحسابي ترتيب المجهزين' : 'لم يغيّر التصحيح الحسابي ترتيب المجهزين'}
            </div>
          </div>
        );
      })()}

      {pendingAward && (
        <AwardBlockersModal
          chosenName={pendingAward.name}
          currency={project.currency}
          blockers={awardBlockers(project, pendingAward.id)}
          onClose={() => setPendingAwardId(null)}
          onDirtyChange={onDirtyChange}
          onApply={(reason) => { setPendingAwardId(null); onSelectBidder(pendingAward.id); onUpdateBidderStatus(pendingAward.id, 'recommended', reason); askRecordStatus(); }}
          onOpenAudit={(id) => { setPendingAwardId(null); onOpenAudit(id); }}
          onOpenPreference={() => { setPendingAwardId(null); setPrefOpen(true); }}
          onExcluded={(id) => { setPendingAwardId(null); onUpdateBidderStatus(id, 'disqualified'); onOpenExclusionReasons(id); }}
          onEnterBid={(id) => { setPendingAwardId(null); onEnterBid(id); }}
          onDelete={(id) => { setPendingAwardId(null); onDeleteBidder(id); }}
        />
      )}

      {prefOpen && rec.closeBids.length > 1 && (
        <PreferenceBasisModal
          project={project}
          closeBids={rec.closeBids}
          equalBids={equalPriceBids(rec.closeBids)}
          onSave={onSavePreferenceInitiatives}
          onClose={() => setPrefOpen(false)}
          onDirtyChange={onDirtyChange}
        />
      )}

    </div>
  );
};

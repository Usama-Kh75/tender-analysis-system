import React from 'react';
import { CheckCircle2, XCircle, Building2, FileCheck } from 'lucide-react';
import { TenderProject } from '../types/tender';
import { formatNumber, formatCurrency, formatPercent } from '../utils/calculations';
import { buildRecommendation, hasBidAmounts, hasNoEstimate, eligibilityCounts, exclusionThresholdOf } from '../utils/recommendation';
import { rankingEffect } from '../utils/rankingEffect';
import { evaluateBids } from '../utils/bidEvaluation';
import { bidderAuditState, tenderPath } from '../utils/tenderPath';
import { errorsCountText } from '../utils/arabicCount';

interface StudyViewProps {
  project: TenderProject;
  onOpenExclusionReasons: (id: string) => void;
  /** يفتح عرض التدقيق في تبويب «العطاءات والتدقيق» عند أول مجهز فيه فقرات فيها أخطاء */
  onOpenAudit: () => void;
  // مقارنة المجهزين والرسوم: زرّان في شريط الدراسة
  onOpenMatrix: () => void;
  chartsOpen: boolean;
  onToggleCharts: () => void;
}

/** «الدراسة والتحليل»: مقارنة العطاءات تجارياً بالأرقام والانحرافات وأثر التصحيح، بلا قرار ولا توصية */
export const StudyView: React.FC<StudyViewProps> = ({
  project,
  onOpenExclusionReasons,
  onOpenAudit,
  onOpenMatrix,
  chartsOpen,
  onToggleCharts
}) => {
  const estimatedTotal = project.bidders[0]?.totals.totalEstimatedAmount || 0;
  const noEstimate = hasNoEstimate(project);
  const exclusionThreshold = exclusionThresholdOf(project);
  const counts = eligibilityCounts(project);
  // شركات بلا مبالغ بعد لا تُعد عروضاً (انظر hasBidAmounts)
  const emptyBidders = project.bidders.filter(b => !hasBidAmounts(b));
  const sortedBidders = evaluateBids(project);
  // التوصية من المحرك المشترك: تُستعمل هنا لتلوين صف الموصى به فقط
  const rec = buildRecommendation(project);

  return (
    <div className="space-y-6 mb-8">

      {/* Banner Summary Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 sm:p-8 border border-amber-500/30 shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-6">

          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="p-1.5 bg-amber-500 text-slate-950 rounded-lg font-black text-xs">
                الدراسة والتحليل
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
            <div className="text-base sm:text-lg font-black text-amber-400 font-mono">
              {formatCurrency(estimatedTotal, project.currency)}
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
            onClick={onOpenAudit}
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
                          {bidder.diff > 0 ? '+' : ''}{formatNumber(bidder.diff)} {project.currency}
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
                        {formatPercent(bidder.totals.totalDeviationPercent, 2, exclusionThreshold)}
                      </span>
                    </td>

                    {/* الانحراف الجزئي */}
                    <td className="p-3.5 text-center border-l border-slate-200 font-black">
                      {/* استرشادي فقط - لا يُستخدم في الجدول المعتمد كمعيار استبعاد أو تحذير مستقل */}
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-slate-100 text-slate-700">
                        {bidder.totals.partialDeviationPercent.toFixed(2)}%
                      </span>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        ({bidder.totals.deviatedItemsCount} فقرة منحرفة)
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
                          مستبعد تجارياً
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

    </div>
  );
};

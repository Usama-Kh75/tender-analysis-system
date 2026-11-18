import React from 'react';
import { Award, CheckCircle2, FileSpreadsheet, Printer } from 'lucide-react';
import { TenderProject, Bidder } from '../types/tender';
import { formatNumber, formatCurrency, formatPercent } from '../utils/calculations';
import { buildRecommendation, equalPriceBids, hasNoEstimate, exclusionThresholdOf, PREFERENCE_BAND_PERCENT, offerWinner, hasBidAmounts, isCommerciallyExcluded } from '../utils/recommendation';
import { preferenceReference } from '../utils/contractTypes';
import { budgetApprovalNote } from '../utils/budgetTypes';
import { recommendationBasis, recommendationEditChanges, savedRecommendationEdit } from '../utils/recommendationText';
import { decisionSensitivity } from '../utils/decisionSensitivity';
import { evaluateBids } from '../utils/bidEvaluation';
import { isOfferFinal, assessBalance, correctedBalanceRows, startOfferBlocker } from '../utils/weightedOffer';
import { WeightedOfferBar } from './WeightedOfferBar';
import { StartMenu } from './WeightedOfferControl';

interface RecommendationViewProps {
  project: TenderProject;
  onSelectBidder: (id: string) => void;
  onUpdateBidderStatus: (id: string, status: Bidder['status']) => void;
  onOpenPrint: () => void;
  onExportExcel: () => void;
  /** يختار المجهز وينقل إلى جدول الفقرات في تبويب «العطاءات والتدقيق» لإعداد عرضه الموزون */
  onOpenWeightedOffer: (bidderId: string) => void;
  /** يبدأ العرض الموزون أو يستأنفه لمجهز بعينه ثم ينقل إلى جدول فقراته */
  onStartWeightedOffer: (bidderId: string, origin: 'corrected' | 'formula' | 'resume') => void;
}

/** «التوصية والمحضر»: توصية اللجنة وقرار الترسية والمحضر المطبوع */
export const RecommendationView: React.FC<RecommendationViewProps> = ({
  project,
  onSelectBidder,
  onUpdateBidderStatus,
  onOpenPrint,
  onExportExcel,
  onOpenWeightedOffer,
  onStartWeightedOffer
}) => {
  const noEstimate = hasNoEstimate(project);
  const exclusionThreshold = exclusionThresholdOf(project);
  // العرض الموزون للعطاء الفائز وحده (ضوابط (4) سادساً/5) إن تجاوزت فقراته غير المتوازنة 10% من عددها،
  // ويبقى ظاهراً كل عطاء له عرض مسجّل ليُرى ويُوقف إن لم يعد فائزاً
  const winner = offerWinner(project);
  const balanceBidders = noEstimate ? [] : project.bidders.filter(b =>
    hasBidAmounts(b) && b.status !== 'disqualified' && !isCommerciallyExcluded(b, exclusionThreshold) &&
    (b.weightedOffer || (b.id === winner?.id && assessBalance(correctedBalanceRows(b.items), project.deviationThreshold, exclusionThreshold).verdict === 'weighting-required')));
  const evaluated = evaluateBids(project);
  // قرار الترسية على المؤهلين وحدهم؛ المستبعدون يُعرضون في «الدراسة والتحليل»
  const decisionBids = evaluated.filter(b => b.commercialStatus === 'qualified' || b.commercialStatus === 'recommended');
  const excludedCount = evaluated.filter(b => b.commercialStatus === 'excluded').length;

  // التوصية من المحرك المشترك مع المحضر المطبوع (utils/recommendation.ts)
  const rec = buildRecommendation(project);
  const approval = rec.kind === 'award' && rec.primary
    ? budgetApprovalNote(project.budgetType, rec.primary.totals.totalDeviationPercent) : null;
  // صياغة اللجنة للتوصية: هنا تُذكر وحدها مع تغيّر أساسها. تغيّر صياغة النظام يُفحص في المعاينة، لأن خيار جدول
  // الأسعار الموزونة يغيّرها ولا يُعرف هنا
  const savedEdit = rec.kind !== 'no-estimate' ? savedRecommendationEdit(project) : undefined;
  const basisChanges = savedEdit ? recommendationEditChanges(savedEdit, { basis: recommendationBasis(rec), systemText: savedEdit.systemText }) : [];

  return (
    <div className="space-y-6 mb-8">

      {/* Banner Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 sm:p-8 border border-amber-500/30 shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-6">

          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="p-1.5 bg-amber-500 text-slate-950 rounded-lg font-black text-xs">
                التوصية والمحضر
              </span>
              {project.entityName && (
                <span className="text-xs text-amber-200 font-bold">
                  {project.entityName}
                </span>
              )}
            </div>

            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2.5">
              التوصية بالإحالة والمحضر
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
                  {' '}وإن نصّت شروط المناقصة على جواز إرسائها على أكثر من متقدم وتساوت الشروط أيضاً، فللجنة أن توصي بإرسائها عليها مجزّأة (المادة 15/رابعاً/أ).
                </div>
              )}
              {approval?.kind === 'note' && (
                <div className="text-xs font-bold text-slate-700 mt-1">{approval.text}</div>
              )}
              {approval?.kind === 'missing' && (
                <div className="text-xs font-bold text-amber-700 mt-1">
                  حدّد نوع الموازنة في إعدادات المناقصة لتظهر هنا الموافقة المطلوبة لقبول العطاء (ضوابط رقم (2) رابعاً).
                </div>
              )}
              {savedEdit && (
                <div className="text-xs font-bold text-indigo-800 mt-1">
                  ✎ تُطبع التوصية في المحضر بصياغة اللجنة
                  {basisChanges.length > 0 && <span className="text-rose-700"> — وتغيّر ما بُنيت عليه: {basisChanges.join('؛ ')}. راجعها من «طباعة المحضر النهائي».</span>}
                </div>
              )}
            </div>
          </div>

          {rec.kind === 'award' && rec.primary && rec.primary.status !== 'recommended' && (
            <button
              onClick={() => {
                onSelectBidder(rec.primary!.id);
                onUpdateBidderStatus(rec.primary!.id, 'recommended');
              }}
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
                  {decisionBids.map(bidder => (
                    <tr key={bidder.id} className="hover:bg-blue-50/40 transition">
                      <td className="p-3.5 border-l border-slate-200 font-black text-slate-900 text-sm">{bidder.name}</td>
                      <td className="p-3.5 text-center font-black text-slate-900 border-l border-slate-200 text-sm">
                        {formatNumber(bidder.totals.totalBidderAmount)}
                      </td>
                      <td className="p-3.5 text-center border-l border-slate-200 font-black">
                        {formatPercent(bidder.totals.totalDeviationPercent, 2, exclusionThreshold)}
                      </td>
                      <td className="p-3.5 text-center border-l border-slate-200">
                        <span className="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-900 border border-emerald-300 text-xs font-black px-3 py-1 rounded-full">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          {bidder.unbalancedItems ? 'مؤهل تجارياً' : 'مؤهل ومتوازن'}
                        </span>
                      </td>
                      <td className="p-3.5 text-center">
                        <button
                          onClick={() => {
                            onSelectBidder(bidder.id);
                            onUpdateBidderStatus(bidder.id, 'recommended');
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
                العطاءات المستبعدة ({excludedCount}) معروضة في «الدراسة والتحليل»
              </div>
            )}
          </>
        )}

      </div>

      {balanceBidders.length > 0 && (
        <div className="space-y-4 no-print">
          <h3 className="text-sm sm:text-base font-black text-slate-800">العرض الموزون للعطاء الفائز</h3>
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

import React from 'react';
import {
  Award,
  CheckCircle2,
  XCircle,
  Building2,
  FileSpreadsheet,
  Printer,
  FileCheck
} from 'lucide-react';
import { TenderProject, Bidder } from '../types/tender';
import { formatNumber, formatCurrency } from '../utils/calculations';
import { buildRecommendation, PREFERENCE_BAND_PERCENT } from '../utils/recommendation';

interface ExecutiveSummaryViewProps {
  project: TenderProject;
  onSelectBidder: (id: string) => void;
  onUpdateBidderStatus: (id: string, status: Bidder['status']) => void;
  onOpenPrint: () => void;
  onExportExcel: () => void;
}

export const ExecutiveSummaryView: React.FC<ExecutiveSummaryViewProps> = ({
  project,
  onSelectBidder,
  onUpdateBidderStatus,
  onOpenPrint,
  onExportExcel
}) => {
  const estimatedTotal = project.bidders[0]?.totals.totalEstimatedAmount || 0;

  // تقييم العطاءات تجارياً وتصنيفها
  const evaluatedBidders = project.bidders.map((bidder) => {
    const totalDev = bidder.totals.totalDeviationPercent;
    const partialDev = bidder.totals.partialDeviationPercent;
    // فرق كل مجهز عن كلفته التخمينية الخاصة به (وليس عن كلفة أول مجهز في القائمة)
    const diff = bidder.totals.overallDiffAmount;

    // معيار الاستبعاد التجاري الوحيد المعتمد في الجدول المرجعي: تجاوز الانحراف الكلي لحد الانحراف المعتمد
    // (الانحراف الجزئي مؤشر استرشادي فقط في الجدول المعتمد ولا يُستخدم فيه كسبب استبعاد أو تحذير مستقل)
    let commercialStatus: 'recommended' | 'qualified' | 'excluded' = 'qualified';
    let commercialReason = '';

    if (bidder.status === 'disqualified') {
      commercialStatus = 'excluded';
      commercialReason = 'مستبعد بقرار اللجنة';
    } else if (Math.abs(totalDev) > project.deviationThreshold) {
      commercialStatus = 'excluded';
      commercialReason = `مستبعد تجارياً: تجاوز الانحراف الإجمالي الحدود القانونية (±${project.deviationThreshold}%) حيث بلغ (${totalDev.toFixed(2)}%)`;
    } else {
      commercialStatus = bidder.status === 'recommended' ? 'recommended' : 'qualified';
      commercialReason = partialDev > 0
        ? `عطاء متوازن تجارياً وضمن الحدود المقبولة قانونياً (انحراف جزئي استرشادي: ${partialDev.toFixed(2)}%)`
        : `عطاء متوازن تجارياً وضمن الحدود المقبولة قانونياً`;
    }

    return {
      ...bidder,
      commercialStatus,
      commercialReason,
      diff
    };
  });

  // ترتيب العطاءات المؤهلة من الأقل مبلغاً والأكثر اتزاناً
  const sortedBidders = [...evaluatedBidders].sort((a, b) => {
    // المستبعد في الأسفل
    if (a.commercialStatus === 'excluded' && b.commercialStatus !== 'excluded') return 1;
    if (b.commercialStatus === 'excluded' && a.commercialStatus !== 'excluded') return -1;
    return a.totals.totalBidderAmount - b.totals.totalBidderAmount;
  });

  // التوصية من المحرك المشترك مع المحضر المطبوع (utils/recommendation.ts)
  const rec = buildRecommendation(project);

  return (
    <div className="space-y-6 mb-8">
      
      {/* Banner Summary Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 sm:p-8 border border-amber-500/30 shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-6">
          
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="p-1.5 bg-amber-500 text-slate-950 rounded-lg font-black text-xs">
                خلاصة شاملة
              </span>
              {project.entityName && (
                <span className="text-xs text-amber-200 font-bold">
                  {project.entityName}
                </span>
              )}
            </div>

            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2.5">
              خلاصة التحليل التجاري والترسية للطلبية / المناقصة
            </h2>
            
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
              جدول المقارنة النهائي للعروض المقدمة من المجهزين والمقاولين لفرز العطاءات المقبولة وتحديد العطاءات المستبعدة تجارياً بسبب الانحرافات أو عدم التوازن السعري وفق تعليمات العقود.
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={onOpenPrint}
              className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs sm:text-sm font-black px-4 py-2.5 rounded-xl shadow-md transition transform active:scale-95 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة المحضر النهائي</span>
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
              {project.bidders.length} شركات
            </div>
          </div>

          <div className="bg-slate-800/60 p-3 rounded-2xl border border-slate-700">
            <div className="text-slate-400 font-semibold mb-1">العطاءات المؤهلة تجارياً</div>
            <div className="text-base sm:text-lg font-black text-emerald-400 font-mono">
              {evaluatedBidders.filter(b => b.commercialStatus !== 'excluded').length} عروض
            </div>
          </div>

          <div className="bg-slate-800/60 p-3 rounded-2xl border border-slate-700">
            <div className="text-slate-400 font-semibold mb-1">المستبعدة تجارياً (انحرافات)</div>
            <div className="text-base sm:text-lg font-black text-rose-400 font-mono">
              {evaluatedBidders.filter(b => b.commercialStatus === 'excluded').length} عروض
            </div>
          </div>
        </div>

      </div>

      {/* Main Commercial Summary Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-indigo-600" />
            <h3 className="font-black text-slate-900 text-sm sm:text-base">
              مصفوفة التحليل التجاري والترسية المقترحة
            </h3>
          </div>
          <span className="text-xs text-slate-500 font-semibold">
            مرتبة حسب الأفضلية والأولى بالترسية
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
                <th className="p-3.5 text-center w-44 border-l border-slate-800">الموقف التجاري والرقابي</th>
                <th className="p-3.5 min-w-[260px] border-l border-slate-800">أسباب القبول أو الاستبعاد التجاري</th>
                <th className="p-3.5 text-center w-28">قرار اللجنة</th>
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
                      <div className={`text-[11px] font-bold ${bidder.diff > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {bidder.diff > 0 ? '+' : ''}{formatNumber(bidder.diff)} {project.currency}
                      </div>
                    </td>

                    {/* الانحراف الكلي */}
                    <td className="p-3.5 text-center border-l border-slate-200 font-black">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black ${
                        Math.abs(bidder.totals.totalDeviationPercent) > project.deviationThreshold
                          ? 'bg-rose-100 text-rose-900 border border-rose-300'
                          : bidder.totals.totalDeviationPercent < 0
                          ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                          : 'bg-slate-100 text-slate-800'
                      }`}>
                        {bidder.totals.totalDeviationPercent > 0 ? '+' : ''}{bidder.totals.totalDeviationPercent.toFixed(2)}%
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

                    {/* الموقف التجاري */}
                    <td className="p-3.5 text-center border-l border-slate-200">
                      {isExcluded ? (
                        <span className="inline-flex items-center gap-1.5 bg-rose-100 text-rose-800 border border-rose-300 text-xs font-black px-3 py-1 rounded-full">
                          <XCircle className="w-4 h-4 text-rose-600" />
                          مستبعد تجارياً
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-900 border border-emerald-300 text-xs font-black px-3 py-1 rounded-full">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          مؤهل ومتوازن
                        </span>
                      )}
                    </td>

                    {/* الأسباب والتحليل */}
                    <td className="p-3.5 border-l border-slate-200 text-xs leading-relaxed">
                      <div className="text-slate-700 font-semibold">
                        {bidder.commercialReason}
                      </div>
                    </td>

                    {/* قرار اللجنة */}
                    <td className="p-3.5 text-center">
                      {!isExcluded ? (
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
                      ) : (
                        <span className="text-xs text-rose-600 font-bold">
                          غير مؤهل
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer Recommendation Statement */}
        <div className="p-5 bg-gradient-to-r from-emerald-50 via-teal-50 to-blue-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
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
                    {rec.chosenNotLowest ? ' — باختيار اللجنة، وليس الأوطأ (تُثبت المسوغات في التقرير — المادة 10/أولاً/هـ)' : ' — أوطأ العطاءات المؤهلة تجارياً'}.
                  </>
                )}
                {rec.kind === 'tie' && (
                  <>
                    العطاءات ({rec.closeBids.map(b => b.name).join('، ')}) {rec.exactTie ? 'متساوية في مبالغها' : `متقاربة لغاية (${PREFERENCE_BAND_PERCENT}%) من الكلفة التخمينية`} — تُطبق معايير المفاضلة (ضوابط رقم 5)، ثم اختر الفائز بزر «اختيار للترسية».
                  </>
                )}
                {rec.kind === 'referral' && rec.primary && (
                  <>
                    لا يوجد عطاء ضمن الحدود المقبولة — التوصية برفع الموضوع إلى اللجنة المركزية للنظر في التفاوض مع ({rec.primary.name}) لتخفيض الأسعار (المادة 13/ثالثاً/ب).
                  </>
                )}
                {rec.kind === 'retender' && (
                  <>
                    لا يوجد عطاء مؤهل — التوصية بعرض الموضوع على جهة التعاقد للنظر في إعادة الإعلان (المادة 20/{rec.retenderReason === 'all-below' ? 'رابعاً' : 'ثالثاً'}).
                  </>
                )}
              </div>
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

      </div>

    </div>
  );
};

import React from 'react';
import { createPortal } from 'react-dom';
import { X, Printer } from 'lucide-react';
import { TenderProject, Bidder } from '../../types/tender';
import { formatNumber, formatPercent, formatCurrency, tafqeetArabic } from '../../utils/calculations';
import { buildRecommendation, hasBidAmounts, isCommerciallyExcluded, PREFERENCE_BAND_PERCENT } from '../../utils/recommendation';
import { contractTypeInfo, preferenceReference } from '../../utils/contractTypes';

interface PrintReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: TenderProject;
  activeBidder: Bidder;
}

export const PrintReportModal: React.FC<PrintReportModalProps> = ({
  isOpen,
  onClose,
  project,
  activeBidder
}) => {
  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  // التوصية تُحسب من كل العطاءات (لا من التبويب المفتوح لحظة الطباعة) — انظر utils/recommendation.ts
  const rec = buildRecommendation(project);
  const subject = rec.primary ?? activeBidder;
  const threshold = project.deviationThreshold;
  const pref = preferenceReference(project.contractType);
  const money = (b: Bidder) => formatCurrency(b.totals.totalBidderAmount, project.currency);
  const words = (b: Bidder) => tafqeetArabic(b.totals.totalBidderAmount, 'دينار عراقي');
  const subjectLabel = {
    award: 'للعطاء الموصى به',
    tie: 'لأوطأ العطاءات المتقاربة',
    referral: 'لأقل العطاءات (المقترح عرضه للتفاوض)',
    retender: 'لأقل العطاءات',
    'no-estimate': 'للعطاء المعروض'
  }[rec.kind];

  // توقيعات المحضر: رئيس اللجنة ثابت دائماً، وعدد الأعضاء يتبع حجم اللجنة الفعلي المُدخل في الإعدادات
  const signatories = [
    ...(project.committeeMembers || []).map(name => ({ role: 'عضو لجنة التحليل', name })),
    { role: 'رئيس لجنة التحليل والتقييم', name: project.committeeChairman }
  ];


  // يُعرض في body مباشرة (لا داخل شجرة الواجهة) فتخفي قاعدة الطباعة في index.css بقية النظام،
  // ويُطبع المحضر وحده بطوله الكامل بدل أن يُقص عند حد النافذة ويتكرر فوق الواجهة
  return createPortal(
    <div className="print-report-portal fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 print:static print:block print:bg-white print:p-0 print:backdrop-blur-none">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[95vh] flex flex-col overflow-hidden print:max-w-none print:max-h-none print:overflow-visible print:rounded-none print:shadow-none print:border-0 print:block">
        
        {/* Controls Bar */}
        <div className="p-4 bg-slate-950 text-white flex items-center justify-between no-print border-b border-amber-500/30">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-bold">معاينة وطباعة محضر لجنة فتح وتحليل العطاءات والترسية</h2>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-slate-950 text-xs font-black px-4 py-2 rounded-xl shadow-sm cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              طباعة فورية
            </button>
            <button onClick={onClose} aria-label="إغلاق" className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document */}
        <div className="flex-1 overflow-y-auto p-8 sm:p-12 bg-white text-slate-900 print:p-0 print:m-0 print:overflow-visible">
          
          {/* Official Header */}
          <div className="border-b-2 border-slate-900 pb-4 mb-6 text-center relative">
            <div className="flex items-center justify-between mb-2">
              <div className="text-right text-xs font-bold text-slate-700">
                {project.entityName && (
                  <div className="text-amber-900 font-extrabold text-sm">{project.entityName}</div>
                )}
              </div>

              <div className="text-left text-xs font-bold text-slate-700">
                <div>العدد: {project.referenceNumber}</div>
                <div>التاريخ: {new Date().toLocaleDateString('ar-EG')}</div>
                <div className="text-emerald-700 mt-1">إعداد: م. أسامة خليل هاشم</div>
              </div>
            </div>

            <h2 className="text-lg font-black text-slate-900 mt-3">
              محضر لجنة فتح وتحليل العطاءات والترسية النهائية
            </h2>
            <div className="text-xs text-slate-600 mt-1 font-semibold">
              مشروع / طلبية: {project.title}
              {contractTypeInfo(project.contractType) && <> — نوع العقد: {contractTypeInfo(project.contractType)!.label}</>}
            </div>
          </div>

          {/* 1. جدول خلاصة كافة العروض والموقف التجاري */}
          <div className="mb-6">
            <h3 className="font-black text-slate-900 text-xs mb-2 bg-slate-100 p-2 rounded border border-slate-300">
              أولاً: خلاصة العروض التجارية المقدمة وموقف الاستبعاد والترسية:
            </h3>

            <table className="w-full text-xs text-right border-collapse border border-slate-400 mb-4">
              <thead className="bg-slate-200 font-bold border-b border-slate-400">
                <tr>
                  <th className="border border-slate-300 p-2 text-center w-8">ت</th>
                  <th className="border border-slate-300 p-2">اسم الشركة / المجهز</th>
                  <th className="border border-slate-300 p-2 text-center">مبلغ العطاء المقدم</th>
                  <th className="border border-slate-300 p-2 text-center">الانحراف الكلي %</th>
                  <th className="border border-slate-300 p-2 text-center">الانحراف الجزئي %</th>
                  <th className="border border-slate-300 p-2 text-center">النسبة السعرية</th>
                  <th className="border border-slate-300 p-2 text-center">الموقف التجاري والرقابي</th>
                </tr>
              </thead>
              <tbody>
                {/* شركة بلا مبالغ ليست عطاءً فلا تُدرج في المحضر (انظر hasBidAmounts) */}
                {project.bidders.filter(hasBidAmounts).map((b, idx) => {
                  // معيار الاستبعاد التجاري وفق الجدول المعتمد: تجاوز الانحراف الكلي للحد المعتمد فقط
                  // (الانحراف الجزئي مؤشر استرشادي في الجدول المعتمد ولا يُستخدم فيه كسبب استبعاد مستقل)
                  const isExcluded = isCommerciallyExcluded(b, threshold);
                  const isRejected = b.status === 'disqualified';
                  const isRec = rec.kind === 'award' && b.id === rec.primary?.id;
                  const isClose = rec.kind === 'tie' && rec.closeBids.some(c => c.id === b.id);

                  return (
                    <tr key={b.id} className={isRec || isClose ? 'bg-emerald-50 font-bold' : isExcluded || isRejected ? 'bg-rose-50' : ''}>
                      <td className="border border-slate-300 p-2 text-center">{idx + 1}</td>
                      <td className="border border-slate-300 p-2 font-bold">{b.name}</td>
                      <td className="border border-slate-300 p-2 text-center font-bold">{formatNumber(b.totals.totalBidderAmount)}</td>
                      <td className="border border-slate-300 p-2 text-center">{formatPercent(b.totals.totalDeviationPercent)}</td>
                      <td className="border border-slate-300 p-2 text-center">{b.totals.partialDeviationPercent.toFixed(2)}%</td>
                      <td className="border border-slate-300 p-2 text-center font-mono">{b.totals.overallPriceRatio.toFixed(4)}</td>
                      <td className="border border-slate-300 p-2 text-center font-bold">
                        {isRejected ? (
                          <span className="text-rose-800">مستبعد بقرار اللجنة</span>
                        ) : isExcluded ? (
                          <span className="text-rose-800">مستبعد تجارياً — المادة (13)/ثالثاً/أ</span>
                        ) : isRec ? (
                          <span className="text-emerald-800">★ موصى بالإحالة</span>
                        ) : isClose ? (
                          <span className="text-emerald-800">متقارب — للمفاضلة</span>
                        ) : rec.kind === 'no-estimate' ? (
                          <span className="text-slate-500">بانتظار الكلفة التخمينية</span>
                        ) : (
                          <span className="text-slate-700">مؤهل تجارياً</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 2. التحليل التفصيلي للفقرات للعطاء الموصى به */}
          <div className="mb-6">
            <h3 className="font-black text-slate-900 text-xs mb-2 bg-slate-100 p-2 rounded border border-slate-300">
              ثانياً: جدول التحليل المالي والأسعار الموزونة {subjectLabel} ({subject.name}):
            </h3>

            <div className="bg-slate-50 border border-slate-300 rounded-xl p-3 mb-3 text-xs leading-relaxed">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-semibold">
                <div><strong>الكلفة التخمينية:</strong> {formatCurrency(subject.totals.totalEstimatedAmount, project.currency)}</div>
                <div><strong>مبلغ العرض:</strong> {formatCurrency(subject.totals.totalBidderAmount, project.currency)}</div>
                <div><strong>النسبة السعرية:</strong> {subject.totals.overallPriceRatio.toFixed(4)}</div>
                <div><strong>الانحراف الكلي:</strong> {formatPercent(subject.totals.totalDeviationPercent)}</div>
              </div>
            </div>

            <table className="w-full text-xs text-right border-collapse border border-slate-400 mb-4">
              <thead className="bg-slate-100 font-bold border-b border-slate-400">
                <tr>
                  <th className="border border-slate-300 p-2 text-center w-8">ت</th>
                  <th className="border border-slate-300 p-2">المفرد التخميني</th>
                  <th className="border border-slate-300 p-2 text-center">مفرد المجهز</th>
                  <th className="border border-slate-300 p-2 text-center">نسبة الانحراف</th>
                  <th className="border border-slate-300 p-2 text-center">الفقرة المنحرفة (&gt;{project.deviationThreshold}%)</th>
                  <th className="border border-slate-300 p-2 text-center">النسبة السعرية</th>
                  <th className="border border-slate-300 p-2 text-center">المفرد الموزون (المعتمد)</th>
                  <th className="border border-slate-300 p-2 text-center">التقييم</th>
                </tr>
              </thead>
              <tbody>
                {subject.items.map((item) => (
                  <tr key={item.id} className="border-b border-slate-300">
                    <td className="border border-slate-300 p-2 text-center font-bold">{item.itemNo}</td>
                    <td className="border border-slate-300 p-2 text-center font-bold text-blue-900">{formatNumber(item.estimatedTotal)}</td>
                    <td className="border border-slate-300 p-2 text-center font-bold text-indigo-900">{formatNumber(item.bidderTotal)}</td>
                    <td className="border border-slate-300 p-2 text-center font-bold">
                      {item.deviationPercent > 0 ? '+' : ''}{item.deviationPercent.toFixed(2)}%
                    </td>
                    <td className="border border-slate-300 p-2 text-center font-bold text-rose-800">
                      {item.deviatedAmount > 0 ? formatNumber(item.deviatedAmount) : '-'}
                    </td>
                    <td className="border border-slate-300 p-2 text-center font-mono">{item.priceRatio.toFixed(4)}</td>
                    <td className="border border-slate-300 p-2 text-center font-bold text-purple-900">{formatNumber(item.newPrice)}</td>
                    <td className="border border-slate-300 p-2 text-center font-bold">
                      {item.isDeviated ? 'منحرفة' : 'متوازن'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-100 font-black border-t-2 border-slate-900">
                <tr>
                  <td className="border border-slate-400 p-2 text-center">المجموع</td>
                  <td className="border border-slate-400 p-2 text-center">{formatNumber(subject.totals.totalEstimatedAmount)}</td>
                  <td className="border border-slate-400 p-2 text-center">{formatNumber(subject.totals.totalBidderAmount)}</td>
                  <td className="border border-slate-400 p-2 text-center">{formatPercent(subject.totals.totalDeviationPercent)}</td>
                  <td className="border border-slate-400 p-2 text-center text-rose-800">{formatNumber(subject.totals.deviatedItemsSum)}</td>
                  <td className="border border-slate-400 p-2 text-center font-mono">{subject.totals.overallPriceRatio.toFixed(4)}</td>
                  <td className="border border-slate-400 p-2 text-center">{formatNumber(subject.totals.newPricesTotal)}</td>
                  <td className="border border-slate-400 p-2 text-center">-</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* 3. توصية وقرار اللجنة القانوني */}
          <div className="border border-slate-300 rounded-xl p-4 mb-8 text-xs leading-relaxed bg-slate-50">
            <h4 className="font-bold text-slate-900 mb-1 text-sm">ثالثاً: قرار وتوصية لجنة التحليل والترسية:</h4>
            {/* كل صيغة مسندة إلى نص التعليمات رقم (1) لسنة 2025 — المراجع في utils/recommendation.ts */}
            {rec.kind === 'award' && rec.primary && (
              <p>
                استناداً إلى المادة (13) من تعليمات تنفيذ العقود الحكومية رقم (1) لسنة 2025 والضوابط الصادرة بموجبها، وبعد التحليل التجاري والمالي للعطاءات والتدقيق الحسابي لجداول الكميات ومقارنتها بالكلفة التخمينية، واستبعاد العطاءات التي تزيد أو تقل عن الكلفة التخمينية بأكثر من الحد المعتمد (±{threshold}%) وفق المادة (13)/ثالثاً/أ، توصي لجنة التحليل
                <strong> بإحالة المناقصة على العطاء المقدم من ({rec.primary.name}) </strong>
                بمبلغ إجمالي قدره <strong>({money(rec.primary)})</strong> <span className="text-slate-800 font-bold underline">({words(rec.primary)})</span>
                {rec.chosenNotLowest
                  ? '، وهو العطاء الذي اختارته اللجنة من بين العطاءات المؤهلة تجارياً'
                  : rec.chosenByCommittee && rec.closeBids.length > 1
                    ? `، وهو العطاء الذي اختارته اللجنة من بين العطاءات ${rec.exactTie ? 'المتساوية' : 'المتقاربة'} في مبالغها`
                    : '، لكونه أوطأ العطاءات المؤهلة تجارياً'}
                ، مع مراعاة نتائج التقييم الفني والقانوني، واعتماد الأسعار والمفردات الموزونة المثبتة أعلاه عند إصدار أوامر التغيير وفق المادة (25)/ثالثاً. وتُرفع هذه التوصية إلى الجهة المخولة بالمصادقة على الإحالة وفق المادة (13)/أولاً.
              </p>
            )}

            {rec.kind === 'tie' && (
              <div>
                <p>
                  استناداً إلى المادة (13) من تعليمات تنفيذ العقود الحكومية رقم (1) لسنة 2025 والضوابط الصادرة بموجبها، وبعد التحليل التجاري والمالي للعطاءات والتدقيق الحسابي لجداول الكميات ومقارنتها بالكلفة التخمينية، تبيّن أن العطاءات المؤهلة تجارياً الآتية
                  <strong>{rec.exactTie ? ' متساوية في مبالغها' : ` متقاربة في مبالغها لغاية (${PREFERENCE_BAND_PERCENT}%) من الكلفة التخمينية`}</strong>:
                </p>
                <ul className="list-disc pr-6 my-1.5 font-bold">
                  {rec.closeBids.map(b => (
                    <li key={b.id}>{b.name} — {money(b)} ({words(b)})</li>
                  ))}
                </ul>
                <p>
                  وعليه توصي لجنة التحليل <strong>بالمفاضلة بين هذه العطاءات وفق معايير المفاضلة الواردة في {pref.clause}</strong>، بتحويلها إلى قيمة مالية لأغراض المفاضلة (مثل: {pref.examples})، والإحالة على العطاء الأفضل بنتيجتها، مع مراعاة نتائج التقييم الفني والقانوني.
                  {rec.exactTie && (
                    <> وعند تساوي الأسعار لأصغر فئة نقدية فلجهة التعاقد استكمال المبادرات إن لم تُقدَّم ابتداءً لتصبح جزءاً من العطاء ({pref.clause}). وإذا تساوت الأسعار والشروط بعد ذلك، فلجهة التعاقد إرساء المناقصة على أكثر من متقدم إن كانت شروط المناقصة تنص على ذلك (المادة 15/رابعاً/أ).</>
                  )}
                </p>
                <div className="no-print mt-2 p-2.5 bg-sky-50 border border-sky-300 rounded-lg text-sky-900 font-bold text-[11px]">
                  💡 بعد إجراء المفاضلة: اختر العطاء الفائز من «خلاصة الترسية» بزر «اختيار للترسية»، فتتحول هذه الفقرة إلى توصية بالإحالة عليه. (هذه الملاحظة لا تظهر في الطباعة)
                </div>
              </div>
            )}

            {rec.kind === 'referral' && rec.primary && (
              <p>
                بعد التحليل التجاري والمالي للعطاءات ومقارنتها بالكلفة التخمينية، لم يرد أي عطاء ضمن الحدود المقبولة (±{threshold}%) وفق المادة (13)/ثالثاً/أ، وكان أقل العطاءات هو العطاء المقدم من <strong>({rec.primary.name})</strong> بمبلغ <strong>({money(rec.primary)})</strong> وبانحراف ({formatPercent(rec.primary.totals.totalDeviationPercent)}) عن الكلفة التخمينية.
                وعليه توصي لجنة التحليل <strong>برفع الموضوع إلى اللجنة المركزية للمصادقة على الإحالة للنظر في التفاوض لتخفيض الأسعار</strong> إلى الحدود المسموحة للكلفة التخمينية دون المساس بنطاق العمل المعلن، استناداً إلى المادة (13)/ثالثاً/ب — علماً أن إجراء التفاوض ذاته ليس من اختصاص لجنة التحليل.
                وإذا لم تؤدِّ المفاوضات إلى تخفيض الأسعار ضمن الحدود المقبولة، فلجهة التعاقد إعادة الإعلان أو الدعوة وفق المادة (20)/أولاً.
              </p>
            )}

            {rec.kind === 'retender' && (
              <p>
                {rec.retenderReason === 'lowest-below' && rec.primary ? (
                  <>بعد التحليل التجاري والمالي للعطاءات ومقارنتها بالكلفة التخمينية، لم يرد أي عطاء ضمن الحدود المقبولة (±{threshold}%) وفق المادة (13)/ثالثاً/أ، وكان أقل العطاءات هو العطاء المقدم من <strong>({rec.primary.name})</strong> بمبلغ <strong>({money(rec.primary)})</strong> ويقل عن الكلفة التخمينية بنسبة ({formatPercent(rec.primary.totals.totalDeviationPercent)})، فلا ينطبق عليه استثناء المادة (13)/ثالثاً/ب المشروط بزيادة أقل العطاءات على الحدود. وعليه توصي لجنة التحليل <strong>بعرض الموضوع على جهة التعاقد للنظر في إعادة الإعلان أو الدعوة</strong> استناداً إلى المادة (20)/رابعاً.</>
                ) : (
                  <>استبعدت اللجنة جميع العطاءات المقدمة. وإذا كان استبعادها لعدم مطابقتها لشروط ومعايير المناقصة، توصي لجنة التحليل <strong>بعرض الموضوع على جهة التعاقد للنظر في إعادة الإعلان أو الدعوة</strong> استناداً إلى المادة (20)/ثالثاً.</>
                )}
              </p>
            )}

            {rec.kind === 'no-estimate' && (
              <div className="p-3 bg-rose-50 border border-rose-300 rounded-lg text-rose-900 font-bold">
                ⚠️ لم تُدخل الكلفة التخمينية بعد، فلا يمكن احتساب الانحرافات ولا تطبيق المادة (13)/ثالثاً/أ، ولذلك لا تُصاغ توصية. يرجى إدخال الكلفة التخمينية قبل اعتماد هذا المحضر.
              </div>
            )}

            {rec.kind === 'award' && rec.chosenNotLowest && rec.eligible[0] && (
              <div className="mt-2 p-2.5 bg-amber-50 border border-amber-300 rounded-lg text-amber-900 font-bold text-[11px]">
                📌 <strong>ملاحظة (المادة 10/أولاً/هـ):</strong> العطاء الموصى به ليس أوطأ العطاءات المؤهلة تجارياً (الأوطأ: {rec.eligible[0].name} بمبلغ {money(rec.eligible[0])}). جهة التعاقد غير ملزمة بقبول أوطأ العطاءات، ويجب تثبيت مسوغات اختيار اللجنة في التقرير النهائي.
              </div>
            )}

            {rec.kind === 'award' && rec.closeBids.length > 1 && (
              <div className="mt-2 p-2.5 bg-amber-50 border border-amber-300 rounded-lg text-amber-900 font-bold text-[11px]">
                📌 <strong>ملاحظة ({pref.clause} — معايير المفاضلة):</strong> العطاءات ({rec.closeBids.map(b => b.name).join('، ')}) {rec.exactTie ? 'متساوية في مبالغها' : `متقاربة لغاية (${PREFERENCE_BAND_PERCENT}%) من الكلفة التخمينية`}، فيجب أن تستند المفاضلة بينها إلى معايير المفاضلة المحوّلة لقيمة مالية (مثل: {pref.examples})، وأن تُثبت نتيجتها في التقرير.
              </div>
            )}
          </div>

          {/* 4. توقيعات اللجنة (رئيس اللجنة ثابت + عدد الأعضاء حسب حجم اللجنة الفعلي) */}
          <div
            className="grid gap-6 pt-6 text-center text-xs font-bold"
            style={{ gridTemplateColumns: `repeat(${Math.min(signatories.length, 3)}, minmax(0, 1fr))` }}
          >
            {signatories.map((s, idx) => (
              <div key={idx} className="border-t border-slate-400 pt-2">
                <div>{s.role}</div>
                {s.name && <div className="text-slate-900 font-extrabold mt-0.5">{s.name}</div>}
                <div className="mt-6 text-slate-600">التوقيع: .....................</div>
              </div>
            ))}
          </div>

        </div>

      </div>
    </div>
  , document.body);
};

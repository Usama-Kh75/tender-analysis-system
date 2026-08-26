import React from 'react';
import { X, Printer } from 'lucide-react';
import { TenderProject, Bidder } from '../../types/tender';
import { formatNumber, formatPercent, formatCurrency, tafqeetArabic } from '../../utils/calculations';

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

  // لا يجوز طباعة توصية ترسية على عطاء مستبعد تجارياً حتى لو كان تبويبه هو المفتوح حالياً
  const isActiveBidderExcluded = Math.abs(activeBidder.totals.totalDeviationPercent) > project.deviationThreshold;

  // توقيعات المحضر: رئيس اللجنة ثابت دائماً، وعدد الأعضاء يتبع حجم اللجنة الفعلي المُدخل في الإعدادات
  const signatories = [
    ...(project.committeeMembers || []).map(name => ({ role: 'عضو لجنة التحليل', name })),
    { role: 'رئيس لجنة التحليل والتقييم', name: project.committeeChairman }
  ];


  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[95vh] flex flex-col overflow-hidden">
        
        {/* Controls Bar */}
        <div className="p-4 bg-slate-950 text-white flex items-center justify-between no-print border-b border-amber-500/30">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-bold">معاينة وطباعة محضر لجنة فتح وتحليل العطاءات والترسية - شركة نفط البصرة</h2>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-slate-950 text-xs font-black px-4 py-2 rounded-xl shadow-sm cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              طباعة فورية
            </button>
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document */}
        <div className="flex-1 overflow-y-auto p-8 sm:p-12 bg-white text-slate-900 print:p-0 print:m-0">
          
          {/* Official BOC Header */}
          <div className="border-b-2 border-slate-900 pb-4 mb-6 text-center relative">
            <div className="flex items-center justify-between mb-2">
              <div className="text-right text-xs font-bold text-slate-700">
                <div>جمهورية العراق</div>
                <div>وزارة النفط</div>
                <div className="text-amber-900 font-extrabold text-sm">شركة نفط البصرة (BOC)</div>
                <div>هيأة المشاريع والمشتريات</div>
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
                {project.bidders.map((b, idx) => {
                  // معيار الاستبعاد التجاري وفق الجدول المعتمد: تجاوز الانحراف الكلي للحد المعتمد فقط
                  // (الانحراف الجزئي مؤشر استرشادي في الجدول المعتمد ولا يُستخدم فيه كسبب استبعاد مستقل)
                  const isExcluded = Math.abs(b.totals.totalDeviationPercent) > project.deviationThreshold;
                  const isRec = b.id === activeBidder.id || b.status === 'recommended';

                  return (
                    <tr key={b.id} className={isRec ? 'bg-emerald-50 font-bold' : isExcluded ? 'bg-rose-50' : ''}>
                      <td className="border border-slate-300 p-2 text-center">{idx + 1}</td>
                      <td className="border border-slate-300 p-2 font-bold">{b.name}</td>
                      <td className="border border-slate-300 p-2 text-center font-bold">{formatNumber(b.totals.totalBidderAmount)}</td>
                      <td className="border border-slate-300 p-2 text-center">{formatPercent(b.totals.totalDeviationPercent)}</td>
                      <td className="border border-slate-300 p-2 text-center">{b.totals.partialDeviationPercent.toFixed(2)}%</td>
                      <td className="border border-slate-300 p-2 text-center font-mono">{b.totals.overallPriceRatio.toFixed(4)}</td>
                      <td className="border border-slate-300 p-2 text-center font-bold">
                        {isExcluded ? (
                          <span className="text-rose-800">مستبعد تجارياً (تجاوز الانحرافات)</span>
                        ) : isRec ? (
                          <span className="text-emerald-800">★ موصى بالترسية (الأفضل والأنسب)</span>
                        ) : (
                          <span className="text-slate-700">مؤهل ومتوازن</span>
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
              ثانياً: جدول التحليل المالي والأسعار الموزونة للعطاء الموصى به ({activeBidder.name}):
            </h3>

            <div className="bg-slate-50 border border-slate-300 rounded-xl p-3 mb-3 text-xs leading-relaxed">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-semibold">
                <div><strong>الكلفة التخمينية:</strong> {formatCurrency(activeBidder.totals.totalEstimatedAmount, project.currency)}</div>
                <div><strong>مبلغ العرض:</strong> {formatCurrency(activeBidder.totals.totalBidderAmount, project.currency)}</div>
                <div><strong>النسبة السعرية:</strong> {activeBidder.totals.overallPriceRatio.toFixed(4)}</div>
                <div><strong>الانحراف الكلي:</strong> {formatPercent(activeBidder.totals.totalDeviationPercent)}</div>
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
                {activeBidder.items.map((item) => (
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
                  <td className="border border-slate-400 p-2 text-center">{formatNumber(activeBidder.totals.totalEstimatedAmount)}</td>
                  <td className="border border-slate-400 p-2 text-center">{formatNumber(activeBidder.totals.totalBidderAmount)}</td>
                  <td className="border border-slate-400 p-2 text-center">{formatPercent(activeBidder.totals.totalDeviationPercent)}</td>
                  <td className="border border-slate-400 p-2 text-center text-rose-800">{formatNumber(activeBidder.totals.deviatedItemsSum)}</td>
                  <td className="border border-slate-400 p-2 text-center font-mono">{activeBidder.totals.overallPriceRatio.toFixed(4)}</td>
                  <td className="border border-slate-400 p-2 text-center">{formatNumber(activeBidder.totals.newPricesTotal)}</td>
                  <td className="border border-slate-400 p-2 text-center">-</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* 3. توصية وقرار اللجنة القانوني */}
          <div className="border border-slate-300 rounded-xl p-4 mb-8 text-xs leading-relaxed bg-slate-50">
            <h4 className="font-bold text-slate-900 mb-1 text-sm">ثالثاً: قرار وتوصية لجنة التحليل والترسية:</h4>
            {!isActiveBidderExcluded ? (
              <p>
                استناداً إلى أحكام تعليمات تنفيذ العقود الحكومية والضوابط الصادرة بموجبها، وبعد إجراء التحليل التجاري والمالي والمطابقة مع الكلفة التخمينية، توصي اللجنة بـ:
                <strong> إحالة وترسية المناقصة على العطاء المقدم من شركة ({activeBidder.name}) </strong>
                بمبلغ إجمالي قدره <strong>({formatCurrency(activeBidder.totals.totalBidderAmount, project.currency)})</strong> <span className="text-slate-800 font-bold underline">({tafqeetArabic(activeBidder.totals.totalBidderAmount, 'دينار عراقي')})</span> لكونه العطاء الأفضل مالياً والأكثر اتزاناً والمطابق للمواصفات، مع اعتماد الأسعار والمفردات الموزونة المثبتة أعلاه كشرط تعاقدي عند تنفيذ أوامر الغيار.
              </p>
            ) : (
              <div className="p-3 bg-rose-50 border border-rose-300 rounded-lg text-rose-900 font-bold">
                ⚠️ تنبيه: العطاء المعروض حالياً من شركة ({activeBidder.name}) <strong>مستبعد تجارياً</strong> لتجاوز انحرافه الكلي عن الكلفة التخمينية الحد المسموح (±{project.deviationThreshold}%)، إذ بلغ ({activeBidder.totals.totalDeviationPercent.toFixed(2)}%). لا يجوز التوصية بالترسية عليه بصيغته الحالية — يرجى اختيار عطاء مؤهل من مصفوفة المقارنة أو خلاصة الترسية قبل اعتماد هذا المحضر.
              </div>
            )}
            {activeBidder.totals.totalDeviationPercent > project.deviationThreshold && (
              <div className="mt-2 p-2.5 bg-amber-50 border border-amber-300 rounded-lg text-amber-900 font-bold text-[11px]">
                📌 <strong>ملاحظة إجرائية (المادة 13/ثالثاً/ب):</strong> بما أن العطاء الموصى به يتجاوز الحد الأقصى المسموح للانحراف عن الكلفة التخمينية (±{project.deviationThreshold}%) وبلغ ({activeBidder.totals.totalDeviationPercent.toFixed(2)}%)،
                يقتصر دور لجنة التحليل على <strong>التوصية</strong> بإحالة الموضوع إلى اللجنة المختصة (لجنة المراجعة / اللجنة المركزية) للمصادقة على التفاوض لتخفيض السعر ضمن الحدود المسموحة دون المساس بنطاق العمل المعلن — علماً أن إجراء التفاوض ذاته ليس من اختصاص لجنة التحليل.
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
  );
};

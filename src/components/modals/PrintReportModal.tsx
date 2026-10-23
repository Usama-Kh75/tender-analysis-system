import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Printer, PenLine, RotateCcw } from 'lucide-react';
import { TenderProject, Bidder, RecommendationEdit } from '../../types/tender';
import { formatNumber, formatPercent, formatCurrency } from '../../utils/calculations';
import { equalPriceBids, hasBidAmounts, isCommerciallyExcluded, PREFERENCE_BAND_PERCENT } from '../../utils/recommendation';
import { contractTypeInfo } from '../../utils/contractTypes';
import { budgetTypeInfo } from '../../utils/budgetTypes';
import { offerStatus, isOfferEdited, BALANCE_VERDICT_LABEL, UNBALANCED_ITEMS_LIMIT_PERCENT } from '../../utils/weightedOffer';
import { summarizePages } from '../../utils/pageSummary';
import { correctionSignatures } from '../../utils/bidderAuditEngine';
import { tenderDetailParts } from '../../utils/tenderDetails';
import { localDate } from '../../utils/localDate';
import { recommendationPieces, recommendationEditChanges, savedRecommendationEdit, type RecommendationBlock } from '../../utils/recommendationText';
import { LegalTextsList, ThresholdBasisSentence } from '../LegalTexts';

interface PrintReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: TenderProject;
  activeBidder: Bidder;
  // صياغة اللجنة للتوصية، أو null لاستعادة صياغة النظام (recommendationHandlers.ts)
  onSaveRecommendationEdit?: (edit: RecommendationEdit | null, systemText: string) => void;
  // محرر الصياغة مفتوح: يمنع App التحديث حتى يُحفظ أو يُلغى (blockingWork)
  onEditingChange?: (editing: boolean) => void;
}

// كلمات الشرط: التوصية لا تُقيَّد بشروط (قرار أسامة 2026-10-23)، فيُسأل عنها إن لم تكن في صياغة النظام
const CONDITION_WORDS = ['بشرط', 'شريطة', 'مشروط', 'شرط أن'];

/** نص التوصية كما يصوغه النظام، بمقاطعه العريضة */
const RecommendationBlocks: React.FC<{ blocks: RecommendationBlock[] }> = ({ blocks }) => (
  <>
    {blocks.map((b, i) => b.type === 'p' ? (
      <p key={i}>
        {b.runs.map((r, j) => r.underline ? <span key={j} className="text-slate-800 font-bold underline">{r.text}</span>
          : r.strong ? <strong key={j}>{r.text}</strong>
          : <React.Fragment key={j}>{r.text}</React.Fragment>)}
      </p>
    ) : (
      <ul key={i} className="list-disc pr-6 my-1.5 font-bold">
        {b.items.map((item, j) => <li key={j}>{item}</li>)}
      </ul>
    ))}
  </>
);

export const PrintReportModal: React.FC<PrintReportModalProps> = ({
  isOpen,
  onClose,
  project,
  activeBidder,
  onSaveRecommendationEdit,
  onEditingChange
}) => {
  // تجاوز المستخدم لطباعة جدول الأسعار الموزونة؛ null = القيمة الافتراضية (تتبع نص التوصية)
  const [weightedOverride, setWeightedOverride] = useState<boolean | null>(null);
  // نص محرر الصياغة؛ null = المحرر مغلق
  const [draft, setDraft] = useState<string | null>(null);
  const editing = draft !== null;
  useEffect(() => {
    onEditingChange?.(editing);
    return () => onEditingChange?.(false);
  }, [editing, onEditingChange]);
  if (!isOpen) return null;

  // المحرر لا يُطبع: يُطبع المحفوظ وحده، فيُنبَّه قبل الطباعة إن بقي فيه ما لم يُحفظ
  const handlePrint = () => {
    if (draftDirty && !window.confirm('في محرر الصياغة تعديل لم يُحفظ، فيُطبع المحضر بالصياغة المحفوظة. أتطبع مع ذلك؟')) return;
    window.print();
  };

  // التوصية وما يتبعها من مصدر واحد (utils/recommendationText.ts)
  const {
    rec, subject, threshold, exclusion, pref, balance, offer, offerFinal, weightingNeeded, showWeighted,
    approval, legalKeys, blocks, systemText, basis
  } = recommendationPieces(project, activeBidder, weightedOverride);
  const money = (b: Bidder) => formatCurrency(b.totals.totalBidderAmount, project.currency);
  // المبلغ قبل التصحيح الحسابي وبعده: عمودان متى سُجّل المبلغ المدون لأي عطاء. الترتيب والتوصية على
  // المبلغ بعد التصحيح (ضوابط رقم (4) خامساً/ب/6)
  const showStated = project.bidders.filter(hasBidAmounts).some(b => (b.statedTotal ?? 0) > 0);
  // توقيع كل مجهز إزاء تصحيحات اللجنة في عطائه (ضوابط رقم (4) خامساً/ب/3)، للعطاءات التي فيها تصحيح
  const signatures = project.bidders.filter(hasBidAmounts)
    .map(b => ({ bidder: b, ...correctionSignatures(b.items) })).filter(s => s.corrected > 0);
  // العرض الموزون للعطاء موضوع المحضر، وصفحاته
  const offerState = offer ? offerStatus(subject) : null;
  const editedItems = offer ? subject.items.filter(isOfferEdited) : [];
  const pages = summarizePages(subject.items);
  const adjustedCount = subject.items.filter(i => i.weightedAdjustment).length;
  const residual = subject.totals.weightedRoundingResidual ?? 0;
  // النسبة السعرية أداة الأسعار الموزونة وحدها: حين تُعتمد أسعار المجهز كما هي لا تُذكر (قرار المستخدم 2026-10-21)
  const ratioShown = !!offer || balance.verdict === 'weighting-required' || showWeighted;
  // بعد اختيار اللجنة للترسية تمّت إجراءات التصحيح بحضور المجهز وتوقيعه، فلا تُطبع فقرة التصحيح أصلاً:
  // تسلسلها في أوليات المناقصة (سجل التدقيق وقيد الاختيار). قرار المستخدم 2026-10-21
  const adopted = rec.kind === 'award' && rec.chosenByCommittee;

  // صياغة اللجنة تُطبع بدل صياغة النظام ما دامت هناك توصية (لا قبل الكلفة التخمينية)
  const savedEdit = rec.kind !== 'no-estimate' ? savedRecommendationEdit(project) : undefined;
  const editChanges = savedEdit ? recommendationEditChanges(savedEdit, { basis, systemText }) : [];
  const editable = !!onSaveRecommendationEdit && rec.kind !== 'no-estimate';
  const draftDirty = draft !== null && draft.trim() !== (savedEdit?.text ?? systemText).trim();

  const saveDraft = () => {
    if (draft === null || !onSaveRecommendationEdit) return;
    const text = draft.replace(/\r\n/g, '\n').trim();
    if (!text) {
      window.alert(savedEdit
        ? 'الصياغة فارغة. لطباعة صياغة النظام اضغط «إلغاء» ثم «استعادة صياغة النظام».'
        : 'الصياغة فارغة. لطباعة صياغة النظام اضغط «إلغاء».');
      return;
    }
    const added = CONDITION_WORDS.filter(w => text.includes(w) && !systemText.includes(w));
    if (added.length && !window.confirm(`في الصياغة (${added.join('، ')}). التوصية لا تُقيَّد بشروط، وتعديل الصياغة لا يضيف إليها شرطاً. أتحفظ الصياغة كما هي؟`)) return;
    if (text === systemText.trim()) {
      // مطابقة لصياغة النظام: لا تعديل يُحفظ، ويُستعاد النظام إن كان هناك تعديل سابق
      if (savedEdit) onSaveRecommendationEdit(null, systemText);
    } else if (text !== savedEdit?.text || editChanges.length > 0) {
      // حفظ الصياغة نفسها بعد تغيّر أساسها إقرار بها على الأساس الجديد، فيزول التنبيه
      onSaveRecommendationEdit({ text, systemText, basis, editedAt: new Date().toISOString() }, systemText);
    }
    setDraft(null);
  };

  const restoreSystem = () => {
    if (!onSaveRecommendationEdit || !savedEdit) return;
    if (!window.confirm('تُحذف صياغة اللجنة ويُطبع المحضر بصياغة النظام. تبقى الصياغة المحذوفة في سجل التدقيق. أتستعيد صياغة النظام؟')) return;
    onSaveRecommendationEdit(null, systemText);
    setDraft(null);
  };

  const handleClose = () => {
    if (draftDirty && !window.confirm('في محرر الصياغة تعديل لم يُحفظ. أتغلق المحضر وتتركه؟')) return;
    onClose();
  };

  // ترك المسودة («إلغاء») أو استبدالها بصياغة النظام الحالية: بتأكيد إن كان فيها ما لم يُحفظ
  const discardDraft = (next: string | null) => {
    if (draftDirty && !window.confirm('في محرر الصياغة تعديل لم يُحفظ. أتتركه؟')) return;
    setDraft(next);
  };

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
            <h2 className="text-base font-bold">معاينة وطباعة محضر التحليل</h2>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-start gap-0.5">
              <label className="flex items-center gap-1.5 text-white text-xs font-bold cursor-pointer">
                <input
                  type="checkbox"
                  className="accent-amber-500"
                  aria-describedby={weightingNeeded && !showWeighted ? 'weighted-table-warning' : undefined}
                  checked={showWeighted}
                  onChange={e => setWeightedOverride(e.target.checked)}
                />
                طباعة جدول الأسعار الموزونة
              </label>
              {/* منطقة إعلان ثابتة يتغير نصها، فيقرأ قارئ الشاشة التنبيه لحظة إلغاء المربع والتركيز عليه */}
              <span id="weighted-table-warning" role="status" className="text-[11px] font-bold text-amber-400">
                {weightingNeeded && !showWeighted ? 'نص التوصية يحيل إلى الأسعار الموزونة: أرفق جدولها بالمحضر' : ''}
              </span>
            </div>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-slate-950 text-xs font-black px-4 py-2 rounded-xl shadow-sm cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              طباعة فورية
            </button>
            <button onClick={handleClose} aria-label="إغلاق" className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer">
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
                {/* العدد رقم محضر لجنة التحليل، والتاريخ يوم توقيعه: يُكتبان باليد (قرار أسامة 2026-10-23) */}
                <div>العدد: <span className="inline-block w-24 border-b border-dotted border-slate-500"></span></div>
                <div>التاريخ: <span className="inline-block w-24 border-b border-dotted border-slate-500"></span></div>
              </div>
            </div>

            {/* لجنة التحليل لا تفتح العطاءات ولا ترسي (لجنة الفتح مستقلة، والتحليل توصية)؛ رقم الطلبية في العنوان */}
            <h2 className="text-lg font-black text-slate-900 mt-3">
              محضر تحليل طلبية{project.referenceNumber?.trim() && <> (<bdi>{project.referenceNumber.trim()}</bdi>)</>}
            </h2>
            <div className="text-xs text-slate-600 mt-1 font-semibold">
              مشروع / طلبية: {project.title}
              {contractTypeInfo(project.contractType) && <> — نوع العقد: {contractTypeInfo(project.contractType)!.label}</>}
              {budgetTypeInfo(project.budgetType) && <> — نوع الموازنة: {budgetTypeInfo(project.budgetType)!.label}</>}
            </div>
            {tenderDetailParts(project).length > 0 && (
              <div className="text-xs text-slate-600 mt-1 font-semibold">
                {tenderDetailParts(project).join(' — ')}
              </div>
            )}
          </div>

          {/* 1. جدول خلاصة كافة العروض والموقف التجاري */}
          <div className="mb-6">
            <h3 className="font-black text-slate-900 text-xs mb-2 bg-slate-100 p-2 rounded border border-slate-300">
              أولاً: خلاصة العروض التجارية المقدمة وموقف الاستبعاد والتوصية:
            </h3>

            <table className="w-full text-xs text-right border-collapse border border-slate-400 mb-4">
              <thead className="bg-slate-200 font-bold border-b border-slate-400">
                <tr>
                  <th className="border border-slate-300 p-2 text-center w-8">ت</th>
                  <th className="border border-slate-300 p-2">اسم الشركة / المجهز</th>
                  {showStated ? (<>
                    <th className="border border-slate-300 p-2 text-center">المبلغ المدون في العطاء</th>
                    <th className="border border-slate-300 p-2 text-center">المبلغ بعد التدقيق الحسابي</th>
                  </>) : (
                    <th className="border border-slate-300 p-2 text-center">مبلغ العطاء المقدم</th>
                  )}
                  <th className="border border-slate-300 p-2 text-center">الانحراف الكلي %</th>
                  <th className="border border-slate-300 p-2 text-center">الانحراف الجزئي %</th>
                  {ratioShown && <th className="border border-slate-300 p-2 text-center">النسبة السعرية</th>}
                  <th className="border border-slate-300 p-2 text-center">الموقف التجاري والرقابي</th>
                </tr>
              </thead>
              <tbody>
                {/* شركة بلا مبالغ ليست عطاءً فلا تُدرج في المحضر (انظر hasBidAmounts) */}
                {project.bidders.filter(hasBidAmounts).map((b, idx) => {
                  // معيار الاستبعاد التجاري وفق الجدول المعتمد: تجاوز الانحراف الكلي للحد المعتمد فقط
                  // (الانحراف الجزئي مؤشر استرشادي في الجدول المعتمد ولا يُستخدم فيه كسبب استبعاد مستقل)
                  const isExcluded = isCommerciallyExcluded(b, exclusion);
                  const isRejected = b.status === 'disqualified';
                  const isRec = rec.kind === 'award' && b.id === rec.primary?.id;
                  const isClose = rec.kind === 'tie' && rec.closeBids.some(c => c.id === b.id);

                  return (
                    <tr key={b.id} className={isRec || isClose ? 'bg-emerald-50 font-bold' : isExcluded || isRejected ? 'bg-rose-50' : ''}>
                      <td className="border border-slate-300 p-2 text-center">{idx + 1}</td>
                      <td className="border border-slate-300 p-2 font-bold">{b.name}</td>
                      {showStated && (
                        <td className="border border-slate-300 p-2 text-center">{b.statedTotal ? formatNumber(b.statedTotal) : '—'}</td>
                      )}
                      <td className="border border-slate-300 p-2 text-center font-bold">{formatNumber(b.totals.totalBidderAmount)}</td>
                      {/* قبل الكلفة التخمينية: «—» بدل أصفار توحي بالمطابقة */}
                      {rec.kind === 'no-estimate' ? (
                        <td colSpan={ratioShown ? 3 : 2} className="border border-slate-300 p-2 text-center text-slate-500">بانتظار الكلفة التخمينية</td>
                      ) : (<>
                        <td className="border border-slate-300 p-2 text-center">{formatPercent(b.totals.totalDeviationPercent, 2, exclusion)}</td>
                        <td className="border border-slate-300 p-2 text-center">{b.totals.partialDeviationPercent.toFixed(2)}%</td>
                        {ratioShown && <td className="border border-slate-300 p-2 text-center font-mono">{b.totals.overallPriceRatio.toFixed(4)}</td>}
                      </>)}
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
            {signatures.length > 0 && !adopted && (
              <div className="border border-slate-300 rounded-xl p-3 text-xs leading-relaxed bg-white space-y-1">
                <strong>التصحيح الحسابي وتوقيع مقدمي العطاءات (ضوابط رقم (4) خامساً/ب/3):</strong>
                {signatures.map(s => (
                  <p key={s.bidder.id}>
                    صحّحت اللجنة ({s.corrected}) فقرة في عطاء ({s.bidder.name})،
                    {s.signed === s.corrected
                      ? ` وحضر المجهز ووقّع وختم إزاء التصحيح${s.corrected > 1 ? ' فيها جميعاً' : ''}.`
                      : <> {s.signed > 0 ? `ووقّع المجهز وختم إزاء (${s.signed}) منها، وبانتظار توقيعه وختمه` : 'وبانتظار توقيع المجهز وختمه'} إزاء
                        التصحيح في {s.unsigned.length > 1 ? 'الفقرات' : 'الفقرة'}: <bdi>{s.unsigned.join('، ')}</bdi>.</>}
                  </p>
                ))}
              </div>
            )}
          </div>

          {/* 2. التحليل التفصيلي للفقرات للعطاء الموصى به */}
          <div className="mb-6">
            <h3 className="font-black text-slate-900 text-xs mb-2 bg-slate-100 p-2 rounded border border-slate-300">
              {showWeighted
                ? <>ثانياً: جدول التحليل المالي والأسعار الموزونة {subjectLabel} ({subject.name}):</>
                : <>ثانياً: التحليل المالي {subjectLabel} ({subject.name}):</>}
            </h3>

            <div className="bg-slate-50 border border-slate-300 rounded-xl p-3 mb-3 text-xs leading-relaxed">
              <div className={`grid grid-cols-2 ${ratioShown ? 'sm:grid-cols-4' : 'sm:grid-cols-3'} gap-3 font-semibold`}>
                <div><strong>الكلفة التخمينية:</strong> {formatCurrency(subject.totals.totalEstimatedAmount, project.currency)}</div>
                <div><strong>مبلغ العرض:</strong> {formatCurrency(subject.totals.totalBidderAmount, project.currency)}</div>
                {ratioShown && <div><strong>النسبة السعرية:</strong> {subject.totals.overallPriceRatio.toFixed(4)}</div>}
                <div><strong>الانحراف الكلي:</strong> {formatPercent(subject.totals.totalDeviationPercent, 2, exclusion)}</div>
              </div>
            </div>

            {showWeighted && (
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
                    {/* فقرة بلا مبلغ تخميني لا تُقيَّم: «—» بدل 0.00% و«متوازن» */}
                    <td className="border border-slate-300 p-2 text-center font-bold">
                      {item.estimatedTotal > 0 ? `${item.deviationPercent > 0 ? '+' : ''}${item.deviationPercent.toFixed(2)}%` : '—'}
                    </td>
                    <td className="border border-slate-300 p-2 text-center font-bold text-rose-800">
                      {item.deviatedAmount > 0 ? formatNumber(item.deviatedAmount) : '-'}
                    </td>
                    <td className="border border-slate-300 p-2 text-center font-mono">{item.estimatedTotal > 0 ? item.priceRatio.toFixed(4) : '—'}</td>
                    <td className="border border-slate-300 p-2 text-center font-bold text-purple-900">{item.estimatedTotal > 0 ? formatNumber(item.newPrice) : '—'}</td>
                    <td className="border border-slate-300 p-2 text-center font-bold">
                      {item.estimatedTotal > 0 ? (item.isDeviated ? 'منحرفة' : 'متوازن') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-100 font-black border-t-2 border-slate-900">
                <tr>
                  <td className="border border-slate-400 p-2 text-center">المجموع</td>
                  <td className="border border-slate-400 p-2 text-center">{formatNumber(subject.totals.totalEstimatedAmount)}</td>
                  <td className="border border-slate-400 p-2 text-center">{formatNumber(subject.totals.totalBidderAmount)}</td>
                  <td className="border border-slate-400 p-2 text-center">{formatPercent(subject.totals.totalDeviationPercent, 2, exclusion)}</td>
                  <td className="border border-slate-400 p-2 text-center text-rose-800">{formatNumber(subject.totals.deviatedItemsSum)}</td>
                  <td className="border border-slate-400 p-2 text-center font-mono">{subject.totals.overallPriceRatio.toFixed(4)}</td>
                  <td className="border border-slate-400 p-2 text-center">{formatNumber(subject.totals.newPricesTotal)}</td>
                  <td className="border border-slate-400 p-2 text-center">-</td>
                </tr>
              </tfoot>
            </table>
            )}
            {/* حكم التوازن من مرحلة التحليل: بعد اختيار الترسية يبقى في المحضر ما استندت إليه التوصية وحده (عبارة
                التسعير في ثالثاً)، فظهوره معها توصيتان متناقضتان؛ مكانه أوليات المناقصة. قرار المستخدم 2026-10-21.
                ملاحظة تقريب الأسعار الموزونة تبقى مع جدولها */}
            {rec.kind !== 'no-estimate' && (!adopted || (showWeighted && (adjustedCount > 0 || Math.abs(residual) >= 0.005))) && (
              <div className="border border-slate-300 rounded-xl p-3 text-xs leading-relaxed bg-white">
                {!adopted && <>
                <strong>توازن العطاء (ضوابط رقم (4) سادساً/5):</strong> عدد الفقرات المنحرفة بالزيادة أكثر من ({threshold}%) هو ({balance.unbalancedCount}) من مجموع ({balance.itemCount}) فقرة، أي ({balance.unbalancedPercent.toFixed(2)}%) مقابل حد ({UNBALANCED_ITEMS_LIMIT_PERCENT}%)
                {balance.belowCount > 0 && <>، وعدد المنحرفة بالنقصان ({balance.belowCount}) للإحاطة</>}.
                {' '}<strong>الحكم: {BALANCE_VERDICT_LABEL[balance.verdict]}.</strong>
                {/* حكم النص وحده يوحي بأن اللجنة قبلت العطاء كما هو، فيُثبت قرارها بعده */}
                {offerFinal && <> <strong>وقرّرت اللجنة{balance.verdict === 'accept-as-is' ? ' مع ذلك' : ''} اعتماد العرض الموزون المثبت في (رابعاً).</strong></>}
                </>}
                {/* بعد الاختيار تبقى جملتا التقريب وحدهما، فلهما عنوان ولا تبدأ الثانية بواو بلا معطوف عليه */}
                {adopted && <strong>تقريب الأسعار الموزونة:</strong>}
                {showWeighted && adjustedCount > 0 && <> سُوّيت فروقات تقريب الأسعار الموزونة بتحميل أجزاء من الفلس على مفرد ({adjustedCount}) فقرة ليساوي مجموعها مبلغ العطاء.</>}
                {showWeighted && Math.abs(residual) >= 0.005 && <> {adjustedCount > 0 || !adopted ? 'وبقي' : 'بقي'} فرق تقريب قدره ({formatNumber(residual)}) تعذّرت تسويته بكميات الفقرات.</>}
              </div>
            )}
          </div>

          {/* 3. توصية وقرار اللجنة القانوني */}
          <div className="border border-slate-300 rounded-xl p-4 mb-8 text-xs leading-relaxed bg-slate-50">
            <h4 className="font-bold text-slate-900 mb-1 text-sm">ثالثاً: توصية لجنة التحليل:</h4>

            {/* صياغة اللجنة: إعادة صياغة فقط، لا تضيف شروطاً (قرار أسامة 2026-10-23). أدواتها لا تُطبع */}
            {editable && !editing && (
              <div className="no-print mb-2 flex flex-wrap items-center gap-2 text-[11px] font-bold">
                {savedEdit && (
                  <span className="text-indigo-800">✎ تُطبع التوصية بصياغة اللجنة (عُدّلت في {localDate(new Date(savedEdit.editedAt))})</span>
                )}
                <button
                  type="button"
                  onClick={() => setDraft(savedEdit?.text ?? systemText)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 cursor-pointer"
                >
                  <PenLine className="w-3.5 h-3.5" />
                  تعديل صياغة التوصية
                </button>
                {savedEdit && (
                  <button
                    type="button"
                    onClick={restoreSystem}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    استعادة صياغة النظام
                  </button>
                )}
              </div>
            )}
            {/* يبقى ظاهراً أثناء التحرير: فيه ما تغيّر مما تحتاجه الصياغة الجديدة */}
            {savedEdit && editChanges.length > 0 && (
              <div id="basis-change-alert" role="alert" className="no-print mb-2 p-2.5 bg-rose-50 border border-rose-300 rounded-lg text-rose-900 font-bold text-[11px]">
                ⚠️ صاغت اللجنة هذه التوصية ثم تغيّر ما بُنيت عليه: {editChanges.join('؛ ')}. راجع الصياغة أو استعد صياغة النظام قبل الطباعة. (هذه الملاحظة لا تظهر في الطباعة)
              </div>
            )}
            {editing && (
              <div className="no-print mb-2 p-3 bg-white border border-indigo-300 rounded-lg space-y-2">
                <textarea
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  dir="rtl"
                  rows={9}
                  autoFocus
                  aria-label="صياغة التوصية"
                  aria-describedby={editChanges.length > 0 ? 'basis-change-alert recommendation-edit-hint' : 'recommendation-edit-hint'}
                  className="w-full min-h-[8rem] resize-y text-xs leading-relaxed p-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
                <p id="recommendation-edit-hint" className="text-[11px] text-slate-600 font-semibold">
                  تعديل الصياغة لا يضيف إلى التوصية شروطاً ولا يغيّر سندها. كل سطر فقرة. قائمة النصوص المستند إليها وملاحظات المحضر تبقى كما يصوغها النظام.
                </p>
                <div className="flex flex-wrap gap-2 text-xs font-bold">
                  <button type="button" onClick={saveDraft} className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer">
                    حفظ الصياغة
                  </button>
                  <button type="button" onClick={() => discardDraft(null)} className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 cursor-pointer">
                    إلغاء
                  </button>
                  {/* يُعطَّل بـ aria-disabled حين يطابق النص صياغة النظام: disabled ولا الإخفاء يُسقطان تركيز لوحة المفاتيح */}
                  {savedEdit && (
                    <button
                      type="button"
                      aria-disabled={draft?.trim() === systemText.trim()}
                      onClick={() => { if (draft?.trim() !== systemText.trim()) discardDraft(systemText); }}
                      className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 cursor-pointer aria-disabled:opacity-50 aria-disabled:cursor-not-allowed"
                    >
                      البدء من صياغة النظام الحالية
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* أثناء التحرير يبقى النص المحفوظ للطباعة وحدها */}
            <div className={editing ? 'hidden print:block' : undefined}>
              {savedEdit
                ? <p className="whitespace-pre-line">{savedEdit.text}</p>
                : <RecommendationBlocks blocks={blocks} />}
            </div>

            {approval?.kind === 'missing' && (
              <div className="no-print mt-2 p-2.5 bg-sky-50 border border-sky-300 rounded-lg text-sky-900 font-bold text-[11px]">
                💡 حدّد نوع الموازنة (استثمارية أو تشغيلية) في إعدادات المناقصة لتذكر التوصية صلاحية قبول العطاء الذي يزيد على الكلفة التخمينية والموافقة المطلوبة له (ضوابط رقم (2) رابعاً). (هذه الملاحظة لا تظهر في الطباعة)
              </div>
            )}

            {rec.kind === 'tie' && (
              <div className="no-print mt-2 p-2.5 bg-sky-50 border border-sky-300 rounded-lg text-sky-900 font-bold text-[11px]">
                💡 {equalPriceBids(rec.closeBids).length > 1 && <>قبل المفاضلة: خاطب مقدمي العطاءات المتساوية ({equalPriceBids(rec.closeBids).map(b => b.name).join('، ')}) لتقديم مبادراتهم إن لم تُقدَّم ابتداءً ({pref.clause}). </>}بعد إجراء المفاضلة: اختر العطاء الفائز من «خلاصة الترسية» بزر «اختيار للترسية»، فتتحول هذه الفقرة إلى توصية بالإحالة عليه. (هذه الملاحظة لا تظهر في الطباعة)
              </div>
            )}

            {rec.kind === 'no-estimate' && (
              <div className="p-3 bg-rose-50 border border-rose-300 rounded-lg text-rose-900 font-bold">
                ⚠️ لم تُدخل الكلفة التخمينية بعد، فلا يمكن احتساب الانحرافات ولا تطبيق المادة (13)/ثالثاً/أ، ولذلك لا تُصاغ توصية. يرجى إدخال الكلفة التخمينية قبل اعتماد هذا المحضر.
              </div>
            )}

            {/* تذكير للجنة لا أساس للإحالة: يظهر في المعاينة ولا يُطبع (قرار المستخدم 2026-10-21). ملاحظة المفاضلة بعده تُطبع */}
            {rec.kind === 'award' && rec.chosenNotLowest && rec.eligible[0] && (
              <div className="no-print mt-2 p-2.5 bg-amber-50 border border-amber-300 rounded-lg text-amber-900 font-bold text-[11px]">
                📌 <strong>ملاحظة (المادة 10/أولاً/هـ):</strong> العطاء الموصى به ليس أوطأ العطاءات المؤهلة (الأوطأ: {rec.eligible[0].name} بمبلغ {money(rec.eligible[0])}). جهة التعاقد غير ملزمة بقبول أوطأ العطاءات، ويجب تثبيت مسوغات اختيار اللجنة في التقرير النهائي. (هذه الملاحظة لا تظهر في الطباعة)
              </div>
            )}

            {(exclusion !== 20 || threshold !== 20) && rec.kind !== 'no-estimate' && !project.thresholdBasis?.trim() && (
              <div className="no-print mt-2 p-2.5 bg-sky-50 border border-sky-300 rounded-lg text-sky-900 font-bold text-[11px]">
                💡 حد مختلف عن نص التعليمات (20%): اكتب سنده في إعدادات المناقصة (سند الحد المعتمد). (هذه الملاحظة لا تظهر في الطباعة)
              </div>
            )}

            {rec.kind === 'award' && rec.closeBids.length > 1 && (
              <div className="mt-2 p-2.5 bg-amber-50 border border-amber-300 rounded-lg text-amber-900 font-bold text-[11px]">
                📌 <strong>ملاحظة ({pref.clause} — معايير المفاضلة):</strong> العطاءات ({rec.closeBids.map(b => b.name).join('، ')}) {rec.exactTie ? 'متساوية في مبالغها' : `متقاربة لغاية (${PREFERENCE_BAND_PERCENT}%) من الكلفة التخمينية`}، فيجب أن تستند المفاضلة بينها إلى معايير المفاضلة المحوّلة لقيمة مالية (مثل: {pref.examples})، وأن تُثبت نتيجتها في التقرير.
              </div>
            )}

            {rec.kind !== 'no-estimate' && <>
              <ThresholdBasisSentence exclusion={exclusion} item={threshold} basis={project.thresholdBasis} />
              <LegalTextsList keys={legalKeys} />
            </>}
          </div>

          {offer && (
            <div className="mb-6">
              <h3 className="font-black text-slate-900 text-xs mb-2 bg-slate-100 p-2 rounded border border-slate-300">
                رابعاً: العرض الموزون لعطاء ({subject.name}) — {offer.origin === 'formula' ? 'بالمعادلة (التخميني × النسبة السعرية)' : 'جدول المجهز المعدل'}{offerFinal ? '' : ' (غير نهائي)'}:
              </h3>
              <p className="text-xs mb-2">
                مجموع العرض الموزون ({formatNumber(offerState?.offerSum ?? 0)}) {Math.abs(offerState?.diff ?? 0) < 0.005 ? 'مساوٍ لمبلغ العطاء بعد التصحيح' : `يختلف عن مبلغ العطاء بعد التصحيح بمقدار (${formatNumber(offerState?.diff ?? 0)})`}، وعدد الفقرات المعدّلة ({editedItems.length}).
              </p>
              {/* جدول فقرات العرض اختياري كجدول (ثانياً): يتبع مربع الطباعة، ويبقى سطر الخلاصة فتصح إحالة التوصية إلى (رابعاً) */}
              {editedItems.length > 0 && showWeighted && (
                <table className="w-full text-xs text-right border-collapse border border-slate-400">
                  <thead className="bg-slate-100 font-bold">
                    <tr>
                      <th className="border border-slate-300 p-2 text-center">ت</th>
                      <th className="border border-slate-300 p-2">الوصف</th>
                      <th className="border border-slate-300 p-2 text-center">الكمية</th>
                      <th className="border border-slate-300 p-2 text-center">المبلغ بعد التصحيح</th>
                      <th className="border border-slate-300 p-2 text-center">مفرد العرض الموزون</th>
                      <th className="border border-slate-300 p-2 text-center">مبلغ العرض الموزون</th>
                    </tr>
                  </thead>
                  <tbody>
                    {editedItems.map(i => (
                      <tr key={i.id}>
                        <td className="border border-slate-300 p-2 text-center">{i.itemNo}</td>
                        <td className="border border-slate-300 p-2">{i.description}</td>
                        <td className="border border-slate-300 p-2 text-center">{formatNumber(i.quantity)}</td>
                        <td className="border border-slate-300 p-2 text-center">{formatNumber(i.bidderTotal)}</td>
                        <td className="border border-slate-300 p-2 text-center font-bold">{formatNumber(i.offerUnitPrice ?? 0)}</td>
                        <td className="border border-slate-300 p-2 text-center font-bold">{formatNumber(i.offerTotal ?? 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {pages && (
            <div className="mb-6">
              <h3 className="font-black text-slate-900 text-xs mb-2 bg-slate-100 p-2 rounded border border-slate-300">
                ملخص صفحات عطاء ({subject.name}):
              </h3>
              <table className="w-full text-xs text-right border-collapse border border-slate-400">
                <thead className="bg-slate-100 font-bold">
                  <tr>
                    <th className="border border-slate-300 p-2 text-center">الصفحة</th>
                    <th className="border border-slate-300 p-2 text-center">عدد الفقرات</th>
                    <th className="border border-slate-300 p-2 text-center">كما دوّنه المجهز</th>
                    <th className="border border-slate-300 p-2 text-center">بعد التصحيح الحسابي</th>
                    {offer && <th className="border border-slate-300 p-2 text-center">العرض الموزون{offerFinal ? '' : ' (غير نهائي)'}</th>}
                  </tr>
                </thead>
                <tbody>
                  {pages.rows.map(r => (
                    <tr key={r.page ?? 'none'}>
                      <td className="border border-slate-300 p-2 text-center">{r.page ?? 'فقرات بلا صفحة'}</td>
                      <td className="border border-slate-300 p-2 text-center">{r.itemCount}</td>
                      <td className="border border-slate-300 p-2 text-center">{formatNumber(r.stated)}</td>
                      <td className="border border-slate-300 p-2 text-center">{formatNumber(r.corrected)}</td>
                      {offer && <td className="border border-slate-300 p-2 text-center font-bold">{formatNumber(r.offer)}</td>}
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-100 font-black">
                  <tr>
                    <td className="border border-slate-400 p-2 text-center">المجموع</td>
                    <td className="border border-slate-400 p-2 text-center">{subject.items.length}</td>
                    <td className="border border-slate-400 p-2 text-center">{formatNumber(pages.totals.stated)}</td>
                    <td className="border border-slate-400 p-2 text-center">{formatNumber(pages.totals.corrected)}</td>
                    {offer && <td className="border border-slate-400 p-2 text-center">{formatNumber(pages.totals.offer)}</td>}
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

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

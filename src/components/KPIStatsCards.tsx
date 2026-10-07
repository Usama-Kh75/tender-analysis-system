import React, { useState } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle, 
  Calculator, 
  Percent,
  Layers,
  Scale
} from 'lucide-react';
import { TenderTotals } from '../types/tender';
import { formatNumber, formatPercent, formatCurrency, parseArabicNumber } from '../utils/calculations';

interface KPIStatsCardsProps {
  totals: TenderTotals;
  currency: string;
  deviationThreshold: number;
  /** المبلغ الإجمالي المدون في العطاء قبل التصحيح الحسابي (Bidder.statedTotal) */
  statedTotal?: number;
  /** فقرات مؤشرة بخطأ ضرب أو تعارض تفقيط لم تعالجها اللجنة بعد */
  pendingAuditCount?: number;
  onChangeStatedTotal?: (value: number) => void;
}

/**
 * المبلغ قبل التصحيح الحسابي وبعده: ما كتبه المجهز إجمالياً مقابل مجموع الفقرات بعد التدقيق، الذي يُرتَّب
 * عليه المجهزون (ضوابط رقم (4) خامساً/ب/6). يُعدَّل المدون بحفظ صريح (Enter أو مغادرة الحقل) فيُسجَّل
 * في سجل التدقيق مرة واحدة لا مع كل حرف
 */
const StatedTotalBar: React.FC<{
  statedTotal?: number;
  afterAudit: number;
  pendingAuditCount: number;
  onChange: (value: number) => void;
}> = ({ statedTotal, afterAudit, pendingAuditCount, onChange }) => {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft !== null) onChange(parseArabicNumber(draft));
    setDraft(null);
  };
  const diff = statedTotal ? afterAudit - statedTotal : 0;

  return (
    <div className="mt-3 bg-white rounded-xl border border-slate-200 shadow-xs px-4 py-2.5 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs">
      <span className="font-bold text-slate-500">المبلغ قبل التصحيح الحسابي وبعده:</span>

      <span className="flex items-center gap-1.5">
        <span className="text-slate-600">المدون في العطاء:</span>
        {draft !== null ? (
          <input
            autoFocus
            type="text"
            inputMode="decimal"
            dir="ltr"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit();
              if (e.key === 'Escape') setDraft(null);
            }}
            placeholder="الإجمالي كما كتبه المجهز"
            aria-label="المبلغ الإجمالي المدون في العطاء"
            className="w-40 bg-white border border-indigo-300 rounded-lg px-2 py-0.5 font-mono font-black text-indigo-950 focus:ring-2 focus:ring-indigo-500/30"
          />
        ) : statedTotal ? (
          <span className="font-mono font-black text-slate-900">{formatNumber(statedTotal)}</span>
        ) : (
          <span className="text-slate-400">لم يُسجَّل</span>
        )}
        {draft === null && (
          <button
            onClick={() => setDraft(statedTotal ? String(statedTotal) : '')}
            className="text-[11px] font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-lg cursor-pointer"
          >
            {statedTotal ? 'تعديل' : '+ تسجيل من الأصل'}
          </button>
        )}
      </span>

      <span className="flex items-center gap-1.5">
        <span className="text-slate-600">بعد التدقيق الحسابي:</span>
        <span className="font-mono font-black text-slate-900">{formatNumber(afterAudit)}</span>
      </span>

      {statedTotal ? (
        Math.abs(diff) < 1 ? (
          <span className="font-bold text-emerald-700">✓ مطابق للمدون في العطاء</span>
        ) : (
          <span className="font-bold text-amber-800">
            الفرق: {diff > 0 ? 'أكثر' : 'أقل'} من المدون بـ <bdi className="font-mono">{formatNumber(Math.abs(diff))}</bdi>
          </span>
        )
      ) : null}

      {pendingAuditCount > 0 && (
        <span className="font-bold text-rose-700">
          بقيت ({pendingAuditCount}) فقرة بخطأ ضرب أو تعارض تفقيط لم تُعالج، فالمبلغ بعد التدقيق ليس نهائياً بعد
        </span>
      )}
    </div>
  );
};

export const KPIStatsCards: React.FC<KPIStatsCardsProps> = ({
  totals,
  currency,
  deviationThreshold,
  statedTotal,
  pendingAuditCount = 0,
  onChangeStatedTotal
}) => {
  const isHighTotalDeviation = Math.abs(totals.totalDeviationPercent) > deviationThreshold;
  // قبل إدخال الكلفة التخمينية كل الانحرافات صفر، وكانت البطاقات تعرضها خضراء «ضمن الحد المقبول»
  // و«لا يوجد انحرافات حادة» قبل أي مقارنة ممكنة: تُعرض «—» محايدة بدلها
  const noEstimate = !(totals.totalEstimatedAmount > 0);
  const pendingNote = <div className="text-[11px] text-slate-400 mt-1">بانتظار الكلفة التخمينية</div>;
  const neutralCard = 'bg-white border-slate-200 text-slate-900';

  // المبالغ الكبيرة (مئات المليارات شائعة في المناقصات) كانت تخرج عن حدود البطاقة:
  // يصغر الخط مع طول الرقم، ويُكسر داخل البطاقة إن طال أكثر بدل أن يتجاوزها
  const amountSize = (value: number) => {
    const len = formatNumber(value).length;
    return len <= 14 ? 'text-lg' : len <= 18 ? 'text-base' : 'text-sm';
  };

  return (
    <div className="mb-6">
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">

      {/* 1. إجمالي التخميني */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs flex flex-col justify-between hover:border-slate-300 transition min-w-0">
        <div className="flex items-center justify-between text-slate-500 mb-1">
          <span className="text-xs font-semibold">إجمالي الكلفة التخمينية</span>
          <Calculator className="w-4 h-4 text-blue-600" />
        </div>
        <div className={`${amountSize(totals.totalEstimatedAmount)} font-black text-slate-900 tracking-tight`}>
          <span className="break-all">{formatNumber(totals.totalEstimatedAmount)}</span>
          <span className="text-[11px] font-normal text-slate-500 mr-1 whitespace-nowrap">{currency}</span>
        </div>
        <div className="text-[11px] text-slate-500 mt-1">الأساس المرجعي للجنة</div>
      </div>

      {/* 2. إجمالي المجهز */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs flex flex-col justify-between hover:border-slate-300 transition min-w-0">
        <div className="flex items-center justify-between text-slate-500 mb-1">
          <span className="text-xs font-semibold">إجمالي مبلغ المجهز</span>
          <Layers className="w-4 h-4 text-indigo-600" />
        </div>
        <div className={`${amountSize(totals.totalBidderAmount)} font-black text-slate-900 tracking-tight`}>
          <span className="break-all">{formatNumber(totals.totalBidderAmount)}</span>
          <span className="text-[11px] font-normal text-slate-500 mr-1 whitespace-nowrap">{currency}</span>
        </div>
        {noEstimate ? pendingNote : (
          <div className="text-[11px] text-slate-500 mt-1 break-all">
            فرق: {formatCurrency(totals.overallDiffAmount, currency)}
          </div>
        )}
      </div>

      {/* 3. النسبة السعرية */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs flex flex-col justify-between hover:border-slate-300 transition min-w-0">
        <div className="flex items-center justify-between text-slate-500 mb-1">
          <span className="text-xs font-semibold">النسبة السعرية للمجهز</span>
          <Scale className="w-4 h-4 text-purple-600" />
        </div>
        <div className={`text-lg font-black tracking-tight ${noEstimate ? 'text-slate-400' : 'text-purple-700'}`}>
          {noEstimate ? '—' : totals.overallPriceRatio.toFixed(4)}
        </div>
        {noEstimate ? pendingNote : (
          <div className="text-[11px] text-slate-500 mt-1">
            (مجموع المجهز / التخميني)
          </div>
        )}
      </div>

      {/* 4. الانحراف الكلي */}
      <div className={`rounded-xl p-4 border shadow-xs flex flex-col justify-between transition ${
        noEstimate
          ? neutralCard
          : isHighTotalDeviation
          ? 'bg-rose-50/70 border-rose-200 text-rose-900'
          : 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
      }`}>
        <div className="flex items-center justify-between mb-1 opacity-90">
          <span className="text-xs font-bold">الانحراف الكلي</span>
          {noEstimate ? null : totals.totalDeviationPercent >= 0 ? (
            <TrendingUp className={`w-4 h-4 ${isHighTotalDeviation ? 'text-rose-600' : 'text-emerald-600'}`} />
          ) : (
            <TrendingDown className={`w-4 h-4 ${isHighTotalDeviation ? 'text-rose-600' : 'text-emerald-600'}`} />
          )}
        </div>
        <div className={`text-lg font-black tracking-tight ${
          noEstimate ? 'text-slate-400' : isHighTotalDeviation ? 'text-rose-700' : 'text-emerald-700'
        }`}>
          {noEstimate ? '—' : formatPercent(totals.totalDeviationPercent)}
        </div>
        {noEstimate ? pendingNote : (
          <div className="text-[11px] font-medium opacity-80 mt-1">
            {isHighTotalDeviation ? 'يتجاوز الحد المسموح' : 'ضمن الحد المقبول'}
          </div>
        )}
      </div>

      {/* 5. الانحراف الجزئي (مؤشر استرشادي فقط - لا حد قانوني معتمد له) */}
      <div className="rounded-xl p-4 border shadow-xs flex flex-col justify-between transition bg-white border-slate-200 text-slate-900">
        <div className="flex items-center justify-between text-slate-500 mb-1">
          <span className="text-xs font-semibold">الانحراف الجزئي</span>
          <Percent className="w-4 h-4 text-amber-600" />
        </div>
        <div className={`text-lg font-black tracking-tight ${noEstimate ? 'text-slate-400' : 'text-slate-800'}`}>
          {noEstimate ? '—' : `${totals.partialDeviationPercent.toFixed(2)}%`}
        </div>
        {noEstimate ? pendingNote : (
          <div className="text-[11px] text-slate-500 mt-1">
            مجموع المنحرف: {formatNumber(totals.deviatedItemsSum)}
          </div>
        )}
      </div>

      {/* 6. الفقرات المنحرفة */}
      <div className={`rounded-xl p-4 border shadow-xs flex flex-col justify-between transition ${
        noEstimate
          ? neutralCard
          : totals.deviatedItemsCount > 0
          ? 'bg-rose-50/50 border-rose-200'
          : 'bg-emerald-50/50 border-emerald-200'
      }`}>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-semibold text-slate-600">الفقرات المنحرفة &gt; {deviationThreshold}%</span>
          {noEstimate ? null : totals.deviatedItemsCount > 0 ? (
            <AlertTriangle className="w-4 h-4 text-rose-600" />
          ) : (
            <CheckCircle className="w-4 h-4 text-emerald-600" />
          )}
        </div>
        <div className={`text-lg font-black tracking-tight ${
          noEstimate ? 'text-slate-400' : totals.deviatedItemsCount > 0 ? 'text-rose-700' : 'text-emerald-700'
        }`}>
          {noEstimate ? '—' : `${totals.deviatedItemsCount} فقرة`}
        </div>
        {noEstimate ? pendingNote : (
          <div className="text-[11px] text-slate-500 mt-1">
            {totals.deviatedItemsCount === 0 ? 'لا يوجد انحرافات حادة' : 'تتطلب مراجعة وتدقيق'}
          </div>
        )}
      </div>

    </div>

    {/* شركة بلا مبالغ ولا مبلغ مدون ليست عطاءً بعد، فلا معنى لقبل التصحيح وبعده */}
    {onChangeStatedTotal && (totals.totalBidderAmount > 0 || (statedTotal ?? 0) > 0) && (
      <StatedTotalBar
        statedTotal={statedTotal}
        afterAudit={totals.totalBidderAmount}
        pendingAuditCount={pendingAuditCount}
        onChange={onChangeStatedTotal}
      />
    )}
    </div>
  );
};

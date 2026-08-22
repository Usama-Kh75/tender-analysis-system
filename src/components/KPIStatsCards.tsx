import React from 'react';
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
import { formatNumber, formatPercent, formatCurrency } from '../utils/calculations';

interface KPIStatsCardsProps {
  totals: TenderTotals;
  currency: string;
  deviationThreshold: number;
}

export const KPIStatsCards: React.FC<KPIStatsCardsProps> = ({
  totals,
  currency,
  deviationThreshold
}) => {
  const isHighTotalDeviation = Math.abs(totals.totalDeviationPercent) > deviationThreshold;
  const isHighPartialDeviation = totals.partialDeviationPercent > 10;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5 mb-6">
      
      {/* 1. إجمالي التخميني */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs flex flex-col justify-between hover:border-slate-300 transition">
        <div className="flex items-center justify-between text-slate-500 mb-1">
          <span className="text-xs font-semibold">إجمالي الكلفة التخمينية</span>
          <Calculator className="w-4 h-4 text-blue-600" />
        </div>
        <div className="text-lg font-black text-slate-900 tracking-tight">
          {formatNumber(totals.totalEstimatedAmount)}
          <span className="text-[11px] font-normal text-slate-500 mr-1">{currency}</span>
        </div>
        <div className="text-[11px] text-slate-500 mt-1">الأساس المرجعي للجنة</div>
      </div>

      {/* 2. إجمالي المجهز */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs flex flex-col justify-between hover:border-slate-300 transition">
        <div className="flex items-center justify-between text-slate-500 mb-1">
          <span className="text-xs font-semibold">إجمالي مبلغ المجهز</span>
          <Layers className="w-4 h-4 text-indigo-600" />
        </div>
        <div className="text-lg font-black text-slate-900 tracking-tight">
          {formatNumber(totals.totalBidderAmount)}
          <span className="text-[11px] font-normal text-slate-500 mr-1">{currency}</span>
        </div>
        <div className="text-[11px] text-slate-500 mt-1">
          فرق: {formatCurrency(totals.overallDiffAmount, currency)}
        </div>
      </div>

      {/* 3. النسبة السعرية */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs flex flex-col justify-between hover:border-slate-300 transition">
        <div className="flex items-center justify-between text-slate-500 mb-1">
          <span className="text-xs font-semibold">النسبة السعرية للمجهز</span>
          <Scale className="w-4 h-4 text-purple-600" />
        </div>
        <div className="text-lg font-black text-purple-700 tracking-tight">
          {totals.overallPriceRatio.toFixed(4)}
        </div>
        <div className="text-[11px] text-slate-500 mt-1">
          (مجموع المجهز / التخميني)
        </div>
      </div>

      {/* 4. الانحراف الكلي */}
      <div className={`rounded-xl p-4 border shadow-xs flex flex-col justify-between transition ${
        isHighTotalDeviation 
          ? 'bg-rose-50/70 border-rose-200 text-rose-900' 
          : 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
      }`}>
        <div className="flex items-center justify-between mb-1 opacity-90">
          <span className="text-xs font-bold">الانحراف الكلي</span>
          {totals.totalDeviationPercent >= 0 ? (
            <TrendingUp className={`w-4 h-4 ${isHighTotalDeviation ? 'text-rose-600' : 'text-emerald-600'}`} />
          ) : (
            <TrendingDown className={`w-4 h-4 ${isHighTotalDeviation ? 'text-rose-600' : 'text-emerald-600'}`} />
          )}
        </div>
        <div className={`text-lg font-black tracking-tight ${
          isHighTotalDeviation ? 'text-rose-700' : 'text-emerald-700'
        }`}>
          {formatPercent(totals.totalDeviationPercent)}
        </div>
        <div className="text-[11px] font-medium opacity-80 mt-1">
          {isHighTotalDeviation ? 'يتجاوز الحد المسموح' : 'ضمن الحد المقبول'}
        </div>
      </div>

      {/* 5. الانحراف الجزئي */}
      <div className={`rounded-xl p-4 border shadow-xs flex flex-col justify-between transition ${
        isHighPartialDeviation 
          ? 'bg-amber-50 border-amber-200 text-amber-900' 
          : 'bg-white border-slate-200 text-slate-900'
      }`}>
        <div className="flex items-center justify-between text-slate-500 mb-1">
          <span className="text-xs font-semibold">الانحراف الجزئي</span>
          <Percent className="w-4 h-4 text-amber-600" />
        </div>
        <div className={`text-lg font-black tracking-tight ${
          isHighPartialDeviation ? 'text-amber-700' : 'text-slate-800'
        }`}>
          {totals.partialDeviationPercent.toFixed(2)}%
        </div>
        <div className="text-[11px] text-slate-500 mt-1">
          مجموع المنحرف: {formatNumber(totals.deviatedItemsSum)}
        </div>
      </div>

      {/* 6. الفقرات المنحرفة */}
      <div className={`rounded-xl p-4 border shadow-xs flex flex-col justify-between transition ${
        totals.deviatedItemsCount > 0 
          ? 'bg-rose-50/50 border-rose-200' 
          : 'bg-emerald-50/50 border-emerald-200'
      }`}>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-semibold text-slate-600">الفقرات المنحرفة &gt; {deviationThreshold}%</span>
          {totals.deviatedItemsCount > 0 ? (
            <AlertTriangle className="w-4 h-4 text-rose-600" />
          ) : (
            <CheckCircle className="w-4 h-4 text-emerald-600" />
          )}
        </div>
        <div className={`text-lg font-black tracking-tight ${
          totals.deviatedItemsCount > 0 ? 'text-rose-700' : 'text-emerald-700'
        }`}>
          {totals.deviatedItemsCount} فقرة
        </div>
        <div className="text-[11px] text-slate-500 mt-1">
          {totals.deviatedItemsCount === 0 ? 'لا يوجد انحرافات حادة' : 'تتطلب مراجعة وتدقيق'}
        </div>
      </div>

    </div>
  );
};

import React from 'react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend, 
  CartesianGrid,
  Cell
} from 'recharts';
import { BOQItem, TenderTotals } from '../types/tender';
import { formatNumber } from '../utils/calculations';

interface ChartsViewProps {
  items: BOQItem[];
  totals: TenderTotals;
  currency: string;
  deviationThreshold: number;
}

export const ChartsView: React.FC<ChartsViewProps> = ({
  items,
  totals,
  currency,
  deviationThreshold
}) => {
  const chartData = items.slice(0, 15).map(item => ({
    name: `ف${item.itemNo}`,
    estimated: item.estimatedTotal,
    bidder: item.bidderTotal,
    deviation: item.deviationPercent,
    isDeviated: item.isDeviated
  }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      
      {/* 1. مقارنة المبالغ لكل فقرة */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
        <h4 className="font-bold text-slate-800 text-sm mb-4 flex items-center justify-between">
          <span>مقارنة الكلفة التخمينية وعرض المجهز (لكل فقرة)</span>
          <span className="text-xs text-slate-500 font-normal">أول 15 فقرة</span>
        </h4>
        
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip 
                formatter={(val: any) => `${formatNumber(Number(val))} ${currency}`}
                contentStyle={{ borderRadius: '8px', direction: 'rtl', textAlign: 'right' }}
              />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: '10px' }} />
              <Bar dataKey="estimated" name="المبلغ التخميني" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="bidder" name="مبلغ المجهز" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 2. رسم بياني لتوزيع نسب الانحراف */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
        <h4 className="font-bold text-slate-800 text-sm mb-4 flex items-center justify-between">
          <span>توزيع نسب الانحراف (%) والفقرات الحرجة</span>
          <span className="text-xs text-rose-600 font-bold">حد الخطر: ±{deviationThreshold}%</span>
        </h4>

        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} unit="%" />
              <Tooltip 
                formatter={(val: any) => `${Number(val).toFixed(2)}%`}
                contentStyle={{ borderRadius: '8px', direction: 'rtl', textAlign: 'right' }}
              />
              <Bar dataKey="deviation" name="نسبة الانحراف %" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.isDeviated ? '#f43f5e' : entry.deviation < 0 ? '#10b981' : '#3b82f6'} 
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

    </div>
  );
};

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
  Cell,
  ReferenceLine
} from 'recharts';
import { Bidder } from '../types/tender';
import { formatNumber } from '../utils/calculations';

interface ChartsViewProps {
  bidders: Bidder[];
  currency: string;
  deviationThreshold: number;
}

// اسم مختصر لمحور الرسم عند كثرة المجهزين، مع الاسم الكامل بالتلميح (Tooltip)
function shortenBidderName(name: string, maxLen: number = 14): string {
  return name.length > maxLen ? `${name.slice(0, maxLen)}…` : name;
}

export const ChartsView: React.FC<ChartsViewProps> = ({
  bidders,
  currency,
  deviationThreshold
}) => {
  // المقارنة هنا على مستوى المجهزين (وليس فقرات الجدول) لأن جداول العطاءات
  // قد تتجاوز 500 فقرة، ما يجعل رسمها فقرة بفقرة غير مفيد تحليلياً وغير قابل للعرض
  const chartData = bidders.map(b => ({
    name: shortenBidderName(b.name),
    fullName: b.name,
    bidder: b.totals.totalBidderAmount,
    deviation: b.totals.totalDeviationPercent,
    deviatedCount: b.totals.deviatedItemsCount,
    isExcluded: Math.abs(b.totals.totalDeviationPercent) > deviationThreshold
  }));

  // الكلفة التخمينية واحدة ومشتركة لكل مشروع/طلبية — تُعرض كخط مرجعي واحد بدل تكرارها كعمود لكل مجهز
  const estimatedCost = Math.max(...bidders.map(b => b.totals.totalEstimatedAmount), 0);

  if (bidders.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-xs text-center text-slate-400 text-sm">
        لا يوجد مجهزون بعد لعرض المقارنة البيانية
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">

      {/* 1. مبلغ كل مجهز مقارنةً بخط الكلفة التخمينية الواحد للمشروع */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
        <h4 className="font-bold text-slate-800 text-sm mb-4 flex items-center justify-between">
          <span>مبلغ العرض لكل مجهز مقابل الكلفة التخمينية</span>
          <span className="text-xs text-blue-600 font-bold">
            الكلفة التخمينية: {formatNumber(estimatedCost)} {currency}
          </span>
        </h4>

        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName || ''}
                formatter={(val: any) => `${formatNumber(Number(val))} ${currency}`}
                contentStyle={{ borderRadius: '8px', direction: 'rtl', textAlign: 'right' }}
              />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: '10px' }} />
              <ReferenceLine
                y={estimatedCost}
                stroke="#3b82f6"
                strokeDasharray="6 4"
                strokeWidth={2}
                label={{ value: 'الكلفة التخمينية', position: 'insideTopRight', fill: '#3b82f6', fontSize: 11, fontWeight: 700 }}
              />
              <Bar dataKey="bidder" name="مبلغ المجهز" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 2. نسبة الانحراف الكلي لكل مجهز */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
        <h4 className="font-bold text-slate-800 text-sm mb-4 flex items-center justify-between">
          <span>نسبة الانحراف الكلي (لكل مجهز)</span>
          <span className="text-xs text-rose-600 font-bold">حد الخطر: ±{deviationThreshold}%</span>
        </h4>

        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} unit="%" />
              <Tooltip
                labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName || ''}
                formatter={(val: any) => `${Number(val).toFixed(2)}%`}
                contentStyle={{ borderRadius: '8px', direction: 'rtl', textAlign: 'right' }}
              />
              <Bar dataKey="deviation" name="نسبة الانحراف الكلي %" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.isExcluded ? '#f43f5e' : entry.deviation < 0 ? '#10b981' : '#3b82f6'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 3. عدد الفقرات المنحرفة لكل مجهز */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs lg:col-span-2">
        <h4 className="font-bold text-slate-800 text-sm mb-4">
          عدد الفقرات المنحرفة (لكل مجهز)
        </h4>

        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip
                labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName || ''}
                formatter={(val: any) => `${val} فقرة`}
                contentStyle={{ borderRadius: '8px', direction: 'rtl', textAlign: 'right' }}
              />
              <Bar dataKey="deviatedCount" name="عدد الفقرات المنحرفة" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

    </div>
  );
};

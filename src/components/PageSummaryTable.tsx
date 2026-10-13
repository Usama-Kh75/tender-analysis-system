import React from 'react';
import { FileStack } from 'lucide-react';
import type { BOQItem } from '../types/tender';
import { summarizePages } from '../utils/pageSummary';
import { formatNumber } from '../utils/calculations';

interface Props { items: BOQItem[]; showOffer: boolean; offerFinal: boolean; onOpenPageBreaks: () => void }

// ملخص صفحات عطاء المجهز: مبلغ كل صفحة كما دوّنه، وبعد التصحيح، وفي العرض الموزون؛ مجموعها مجموع العطاء
export const PageSummaryTable: React.FC<Props> = ({ items, showOffer, offerFinal, onOpenPageBreaks }) => {
  const summary = summarizePages(items);
  if (!summary) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-3 text-xs font-bold text-slate-600">
        <span>ملخص صفحات العطاء يظهر بعد إسناد الفقرات إلى صفحاتها.</span>
        <button onClick={onOpenPageBreaks} className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 rounded-xl cursor-pointer">
          <FileStack className="w-3.5 h-3.5" /> فواصل الصفحات
        </button>
      </div>
    );
  }
  const n = (v: number) => formatNumber(v, Number.isInteger(v) ? 0 : 2);
  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-3 bg-slate-50 border-b border-slate-200 font-black text-sm text-slate-900 flex items-center justify-between">
        <span>ملخص صفحات العطاء ({summary.rows.filter(r => r.page !== null).length} صفحة)</span>
        {showOffer && !offerFinal && <span className="text-xs text-amber-700">العرض الموزون غير نهائي</span>}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-right border-collapse">
          <thead className="bg-slate-900 text-slate-100 font-black">
            <tr>
              <th className="p-2 text-center">الصفحة</th>
              <th className="p-2 text-center">عدد الفقرات</th>
              <th className="p-2 text-center">كما دوّنه المجهز</th>
              <th className="p-2 text-center">بعد التصحيح الحسابي</th>
              {showOffer && <th className="p-2 text-center bg-purple-950">العرض الموزون</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 font-mono font-bold">
            {summary.rows.map(r => (
              <tr key={r.page ?? 'none'} className={r.page === null ? 'bg-amber-50' : ''}>
                <td className="p-2 text-center font-sans">{r.page ?? 'فقرات بلا صفحة'}</td>
                <td className="p-2 text-center">{r.itemCount}</td>
                <td className="p-2 text-center">{n(r.stated)}</td>
                <td className="p-2 text-center">{n(r.corrected)}</td>
                {showOffer && <td className="p-2 text-center text-purple-950">{n(r.offer)}</td>}
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-100 font-black font-mono">
            <tr>
              <td className="p-2 text-center font-sans">المجموع</td>
              <td className="p-2 text-center">{items.length}</td>
              <td className="p-2 text-center">{n(summary.totals.stated)}</td>
              <td className="p-2 text-center">{n(summary.totals.corrected)}</td>
              {showOffer && <td className="p-2 text-center text-purple-950">{n(summary.totals.offer)}</td>}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};

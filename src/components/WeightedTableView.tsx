import React, { useState } from 'react';
import type { Bidder } from '../types/tender';
import { formatNumber } from '../utils/calculations';
import { weightedSheetRows, type WeightedSource } from '../utils/weightedSheetRows';

interface WeightedTableViewProps {
  bidder: Bidder;
  source: WeightedSource;
}

// الجدول الموزون للعطاء الفائز على الشاشة: صفوفه من المصدر نفسه الذي تكتب منه ورقة «الجدول الموزون» في Excel (عرض فقط، لا يُطبع)
export const WeightedTableView: React.FC<WeightedTableViewProps> = ({ bidder, source }) => {
  const [open, setOpen] = useState(false);
  const { rows, sum } = weightedSheetRows(bidder, source);
  const id = `weighted-table-${bidder.id}`;
  const th = 'border border-slate-300 p-2 text-center';
  const td = 'border border-slate-200 p-2 text-center';
  return (
    <div className="no-print print:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
        className="text-xs sm:text-sm font-bold px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-800 text-white cursor-pointer transition"
      >
        {open ? 'إخفاء الجدول الموزون' : 'عرض الجدول الموزون'}
      </button>
      {/* منطقة تمرير أفقي على الشاشات الضيقة: قابلة للتركيز بلوحة المفاتيح */}
      <div
        id={id}
        hidden={!open}
        tabIndex={0}
        role="region"
        aria-label={`الجدول الموزون لعطاء ${bidder.name}`}
        className="mt-2 overflow-x-auto rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
      >
        <table className="w-full min-w-[520px] text-xs text-right border-collapse">
          <caption className="sr-only">الجدول الموزون لعطاء {bidder.name}</caption>
          <thead className="bg-slate-100 font-bold">
            <tr>
              <th scope="col" className={`${th} w-10`}>ت</th>
              <th scope="col" className="border border-slate-300 p-2 text-right">الوصف</th>
              <th scope="col" className={th}>الكمية</th>
              <th scope="col" className={th}>المفرد الموزون</th>
              <th scope="col" className={th}>المبلغ الموزون</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ item, dash, unit, total }) => (
              <tr key={item.id}>
                <td className={`${td} font-bold`}>{item.itemNo}</td>
                <td className="border border-slate-200 p-2 text-slate-800">{item.description}</td>
                <td className={`${td} whitespace-nowrap`}>{formatNumber(item.quantity)}</td>
                <td className={`${td} whitespace-nowrap`}>{dash ? '—' : formatNumber(unit, 2)}</td>
                <td className={`${td} whitespace-nowrap font-bold`}>{dash ? '—' : formatNumber(total)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-50 font-black">
            <tr>
              <th scope="row" className={th} colSpan={4}>المجموع</th>
              <td className={`${th} whitespace-nowrap`}>{formatNumber(sum)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};

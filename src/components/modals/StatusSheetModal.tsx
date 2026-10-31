import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Printer, FileSpreadsheet } from 'lucide-react';
import type { TenderProject } from '../../types/tender';
import { statusSheetRows, formatSheetDate } from '../../utils/orderStatus';
import { exportStatusSheetToExcel, statusSheetTitle } from '../../utils/statusSheetExcel';
import { localDate } from '../../utils/localDate';

interface StatusSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects: TenderProject[];
}

const cell = 'border border-black px-2 py-1.5 align-middle';

// معاينة كشف موقف الطلبيات وطباعته (A4 أفقي) وتصديره. وثيقة رسمية بلا توقيع، وعرض لما هو محفوظ بلا مجاميع
export const StatusSheetModal: React.FC<StatusSheetModalProps> = ({ isOpen, onClose, projects }) => {
  const [asOf, setAsOf] = useState(localDate());

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const rows = statusSheetRows(projects);
  // تاريخ الكشف الممسوح: يُعتمد تاريخ اليوم في العنوان والتصدير بدل عنوان بلا تاريخ
  const dateMissing = formatSheetDate(asOf) === '';
  const effectiveAsOf = dateMissing ? localDate() : asOf;
  const canOutput = rows.length > 0;
  const title = statusSheetTitle(effectiveAsOf);

  return createPortal(
    <div
      className="print-report-portal fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 print:static print:block print:bg-white print:p-0 print:backdrop-blur-none"
      role="dialog" aria-modal="true" aria-label="كشف موقف الطلبيات"
    >
      {/* الصفحة أفقية للطباعة */}
      <style>{'@media print { @page { size: A4 landscape; margin: 12mm; } .status-sheet-head th { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }'}</style>
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-6xl max-h-[95vh] flex flex-col overflow-hidden print:max-w-none print:max-h-none print:overflow-visible print:rounded-none print:shadow-none print:border-0 print:block">

        <div className="p-4 bg-slate-950 text-white flex items-center justify-between gap-3 flex-wrap no-print border-b border-amber-500/30">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-bold">كشف موقف الطلبيات</h2>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <label htmlFor="status-sheet-date" className="text-xs font-bold text-slate-300">تاريخ الكشف</label>
            <input
              id="status-sheet-date"
              type="date"
              value={asOf}
              onChange={(e) => setAsOf(e.target.value)}
              className="bg-white text-slate-900 border border-slate-300 rounded-lg px-2 py-1 text-xs"
            />
            <button
              type="button"
              onClick={() => exportStatusSheetToExcel(rows, effectiveAsOf)}
              disabled={!canOutput}
              className="flex items-center gap-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded-lg cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" /> تصدير Excel
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              disabled={!canOutput}
              className="flex items-center gap-1.5 text-xs font-bold bg-amber-500 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 px-3 py-1.5 rounded-lg cursor-pointer"
            >
              <Printer className="w-4 h-4" /> طباعة
            </button>
            <button type="button" onClick={onClose} aria-label="إغلاق" className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 flex-1 min-h-0 overflow-auto bg-white text-black print:overflow-visible print:p-0" dir="rtl">
          <h1 className="text-center text-lg font-black mb-4">{title}</h1>
          {dateMissing && <p className="no-print text-center text-xs font-bold text-rose-700 mb-2">لم يُدخل تاريخ الكشف، فيُستعمل تاريخ اليوم</p>}
          {rows.length === 0 ? (
            <p className="text-center text-sm text-slate-500 py-8">لا طلبيات محفوظة</p>
          ) : (
            <table className="w-full min-w-[850px] print:min-w-0 border-collapse text-xs">
              <thead>
                <tr className="status-sheet-head bg-slate-100 font-black text-center">
                  <th scope="col" rowSpan={2} className={cell}>ت</th>
                  <th scope="col" rowSpan={2} className={cell}>رقم الطلبية</th>
                  <th scope="col" rowSpan={2} className={cell}>الموضوع</th>
                  <th scope="col" rowSpan={2} className={cell}>الإعلان</th>
                  <th scope="col" rowSpan={2} className={cell}>تاريخ الاستلام</th>
                  <th scope="colgroup" colSpan={3} className={cell}>الموقف</th>
                  <th scope="col" rowSpan={2} className={cell}>الملاحظات</th>
                </tr>
                <tr className="status-sheet-head bg-slate-100 font-black text-center">
                  <th scope="col" className={cell}>الإجراء</th>
                  <th scope="col" className={cell}>رقم المذكرة</th>
                  <th scope="col" className={cell}>التاريخ</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.no} className="break-inside-avoid">
                    <td className={`${cell} text-center`}>{r.no}</td>
                    <td className={`${cell} text-center`}><bdi>{r.referenceNumber}</bdi></td>
                    <td className={cell}>{r.title}</td>
                    <td className={`${cell} text-center`}>{r.announcement}</td>
                    <td className={`${cell} text-center`}><bdi>{r.receivedAt}</bdi></td>
                    <td className={cell}>{r.action}</td>
                    <td className={`${cell} text-center`}><bdi>{r.memoNo}</bdi></td>
                    <td className={`${cell} text-center`}><bdi>{r.date}</bdi></td>
                    <td className={cell}>{r.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

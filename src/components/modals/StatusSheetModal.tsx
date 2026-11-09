import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Printer, FileSpreadsheet, Plus } from 'lucide-react';
import type { StatusOrder, TenderProject } from '../../types/tender';
import type { createStatusHandlers } from '../../app/statusHandlers';
import type { createStatusOrderHandlers } from '../../app/statusOrderHandlers';
import { StatusRowEditor } from './StatusRowEditor';
import { statusSheetRows, formatSheetDate } from '../../utils/orderStatus';
import {
  exportStatusSheetToExcel, statusSheetTitle, STATUS_COLUMNS, defaultStatusColumns, shownStatusColumns
} from '../../utils/statusSheetExcel';
import type { OptionalStatusColumnKey } from '../../utils/statusSheetExcel';
import { localDate } from '../../utils/localDate';

interface StatusSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects: TenderProject[];
  orders: StatusOrder[];
  // معالجات مناقصة بعينها (لا الحالية وحدها) ومعالجات الطلبيات بلا تحليل
  makeTenderHandlers: (p: TenderProject) => ReturnType<typeof createStatusHandlers>;
  orderHandlers: ReturnType<typeof createStatusOrderHandlers>;
}

const cell = 'border border-black px-2 py-1.5 align-middle';

// معاينة كشف موقف الطلبيات وطباعته (A4 أفقي) وتصديره. وثيقة رسمية بتوقيع رئيس اللجنة وحده (قرار أسامة 2026-11-01)، وعرض لما هو محفوظ بلا مجاميع
export const StatusSheetModal: React.FC<StatusSheetModalProps> = ({ isOpen, onClose, projects, orders, makeTenderHandlers, orderHandlers }) => {
  const [asOf, setAsOf] = useState(localDate());
  // الصف المفتوح للتحرير: مناقصة أو طلبية بلا تحليل، أو طلبية جديدة
  const [editing, setEditing] = useState<{ kind: 'tender' | 'order'; id: string } | 'new' | null>(null);

  // اختيار الأعمدة الاختيارية: null = الافتراضي (ما فيه بيانات). يُعاد عند كل فتح لأن App يركّب الكشف بمفتاح يتغير مع فتحه
  const [chosenCols, setChosenCols] = useState<Set<OptionalStatusColumnKey> | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    // والمحرر مفتوح فهو الذي يستجيب لـ Escape وحده
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !editing) onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose, editing]);

  if (!isOpen) return null;

  const rows = statusSheetRows(projects, orders);
  // تاريخ الكشف الممسوح: يُعتمد تاريخ اليوم في العنوان والتصدير بدل عنوان بلا تاريخ
  const dateMissing = formatSheetDate(asOf) === '';
  const effectiveAsOf = dateMissing ? localDate() : asOf;
  const activeCols = chosenCols ?? new Set(defaultStatusColumns(rows));
  const cols = shownStatusColumns(activeCols);
  const toggleCol = (key: OptionalStatusColumnKey) => {
    const next = new Set(activeCols);
    if (next.has(key)) next.delete(key); else next.add(key);
    setChosenCols(next);
  };
  const stateColSpan = cols.filter(c => c.key === 'action' || c.key === 'memoNo' || c.key === 'date').length;
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
            <button
              type="button"
              onClick={() => setEditing('new')}
              className="flex items-center gap-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg cursor-pointer"
            >
              <Plus className="w-4 h-4" /> إضافة طلبية بلا تحليل
            </button>
            <label htmlFor="status-sheet-date" className="text-xs font-bold text-slate-300">تاريخ الكشف</label>
            <input
              id="status-sheet-date"
              type="date"
              value={asOf}
              onChange={(e) => setAsOf(e.target.value)}
              className="bg-white text-slate-900 border border-slate-300 rounded-lg px-2 py-1 text-xs"
            />
            <div role="group" aria-labelledby="status-cols-label" className="flex items-center gap-2 flex-wrap">
              <span id="status-cols-label" className="text-xs font-bold text-slate-300">الأعمدة:</span>
              {STATUS_COLUMNS.filter(c => c.optional).map(c => (
                <label key={c.key} htmlFor={`status-col-${c.key}`} className="flex items-center gap-1 text-xs text-slate-200 cursor-pointer">
                  <input
                    id={`status-col-${c.key}`}
                    type="checkbox"
                    checked={activeCols.has(c.key as OptionalStatusColumnKey)}
                    onChange={() => toggleCol(c.key as OptionalStatusColumnKey)}
                    className="cursor-pointer"
                  />
                  {c.header}
                </label>
              ))}
            </div>
            <button
              type="button"
              onClick={() => exportStatusSheetToExcel(rows, effectiveAsOf, activeCols)}
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
            <p className="text-center text-sm text-slate-500 py-8">لا طلبيات محفوظة. أضف طلبية بلا تحليل من الزر أعلاه.</p>
          ) : (
            <table className="w-full min-w-[850px] print:min-w-0 border-collapse text-xs">
              <thead>
                <tr className="status-sheet-head bg-slate-100 font-black text-center">
                  {cols.map(c => {
                    const inState = c.key === 'action' || c.key === 'memoNo' || c.key === 'date';
                    if (inState) return c.key === 'action' ? <th key="state" scope="colgroup" colSpan={stateColSpan} className={cell}>الموقف</th> : null;
                    return <th key={c.key} scope="col" rowSpan={2} className={cell}>{c.header}</th>;
                  })}
                  <th scope="col" rowSpan={2} className={`${cell} no-print`}><span className="sr-only">تعديل</span></th>
                </tr>
                <tr className="status-sheet-head bg-slate-100 font-black text-center">
                  {cols.filter(c => c.key === 'action' || c.key === 'memoNo' || c.key === 'date').map(c => (
                    <th key={c.key} scope="col" className={cell}>{c.header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.no} className="break-inside-avoid">
                    {cols.map(c => (
                      <td key={c.key} className={c.align === 'center' ? `${cell} text-center` : cell}>
                        {c.key === 'no' || c.key === 'announcement' ? r[c.key] : c.align === 'center' ? <bdi>{r[c.key]}</bdi> : r[c.key]}
                      </td>
                    ))}
                    <td className={`${cell} text-center no-print`}>
                      <button
                        type="button"
                        onClick={() => setEditing({ kind: r.kind, id: r.id })}
                        aria-label={`تعديل الطلبية ${r.referenceNumber || r.title}`}
                        className="px-2.5 py-1 text-xs font-bold text-indigo-700 hover:bg-indigo-50 rounded-lg cursor-pointer"
                      >تعديل</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {rows.length > 0 && (
            <div className="break-inside-avoid break-before-avoid flex justify-end pt-8 text-center text-xs font-bold">
              <div className="w-64 border-t border-slate-400 pt-2">
                <div>رئيس اللجنة</div>
                <div className="mt-6 text-slate-600">التوقيع: .....................</div>
              </div>
            </div>
          )}
        </div>
      </div>
      {editing && (() => {
        const common = { orderHandlers, onClose: () => setEditing(null), onCreated: (id: string) => setEditing({ kind: 'order', id }) };
        if (editing === 'new') return <StatusRowEditor key="new" mode="new" {...common} />;
        if (editing.kind === 'tender') {
          const project = projects.find(p => p.id === editing.id);
          return project ? <StatusRowEditor key={`t-${project.id}`} mode="tender" project={project} tenderHandlers={makeTenderHandlers(project)} {...common} /> : null;
        }
        const order = orders.find(o => o.id === editing.id);
        return order ? <StatusRowEditor key={`o-${order.id}`} mode="order" order={order} {...common} /> : null;
      })()}
    </div>,
    document.body
  );
};

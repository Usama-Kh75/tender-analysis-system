import React, { useState } from 'react';
import { X, Plus, Minus, FileStack } from 'lucide-react';
import type { BOQItem } from '../../types/tender';
import { resolvePageStarts, resolvePageNumbers, pagesFromStarts, startItemNos, startPages, previewPageRanges } from '../../utils/pageSummary';
import { formatNumber } from '../../utils/calculations';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  items: BOQItem[];
  bidderName: string;
  onApply: (pages: (number | undefined)[]) => void;
}

interface StartRow { page: string; itemNo: string }

// فواصل صفحات عطاء المجهز كما قدّمه: رقم كل صفحة ورقم أول فقرة فيها، فتُسند الفقرات إلى صفحاتها بالترتيب.
// رقم الصفحة يُدخل كما في العطاء (غلاف يسبق الجدول أو صفحة شروط بين صفحتين)، فلا يُعاد ترقيمه من 1.
// لا يمس أي مبلغ. للعطاءات المُدخلة قبل أن تقرأ القراءة الآلية أرقام الصفحات
export const PageBreaksModal: React.FC<Props> = ({ isOpen, onClose, items, bidderName, onApply }) => {
  const [rows, setRows] = useState<StartRow[]>(() => {
    const itemNos = startItemNos(items);
    const pageNos = startPages(items);
    return itemNos.length > 0
      ? itemNos.map((itemNo, k) => ({ page: String(pageNos[k]), itemNo }))
      : [{ page: '1', itemNo: String(items[0]?.itemNo ?? '1') }];
  });
  if (!isOpen) return null;

  const starts = resolvePageStarts(items, rows.map(r => r.itemNo));
  const numbers = resolvePageNumbers(rows.map(r => r.page));
  const error = 'error' in starts ? starts.error : 'error' in numbers ? numbers.error : null;
  const pages = 'starts' in starts && 'numbers' in numbers
    ? pagesFromStarts(items.length, starts.starts, numbers.numbers) : null;
  const ranges = pages ? previewPageRanges(items, pages) : [];
  const n = (v: number) => formatNumber(v, Number.isInteger(v) ? 0 : 2);

  const update = (k: number, patch: Partial<StartRow>) => setRows(rs => rs.map((r, i) => i === k ? { ...r, ...patch } : r));
  const addRow = () => setRows(rs => {
    const last = Number(rs[rs.length - 1]?.page);
    return [...rs, { page: Number.isInteger(last) ? String(last + 1) : '', itemNo: '' }];
  });

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="فواصل الصفحات">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="p-4 bg-slate-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold"><FileStack className="w-5 h-5 text-amber-400" /> فواصل صفحات عطاء ({bidderName})</div>
          <button onClick={onClose} aria-label="إغلاق" className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 overflow-y-auto space-y-2 text-sm">
          <p className="text-xs text-slate-600 font-bold">أدخل رقم الصفحة كما في العطاء الأصلي ورقم أول فقرة فيها. الصفحة الأولى المذكورة تبدأ من أول فقرة في الجدول.</p>
          {rows.map((r, k) => (
            <div key={k} className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 font-bold text-slate-800">
                <span>صفحة</span>
                <input type="text" dir="ltr" value={r.page} aria-label={`رقم الصفحة ${k + 1}`}
                  onChange={(e) => update(k, { page: e.target.value })}
                  className="w-16 text-center border border-slate-300 rounded-lg p-1 font-mono font-bold" />
              </label>
              <label className="flex items-center gap-1.5 font-bold text-slate-800">
                <span>تبدأ بالفقرة</span>
                <input type="text" dir="ltr" value={r.itemNo} disabled={k === 0} aria-label={`أول فقرة في الصفحة ${k + 1}`}
                  onChange={(e) => update(k, { itemNo: e.target.value })}
                  className="w-24 text-center border border-slate-300 rounded-lg p-1 font-mono font-bold disabled:bg-slate-100" />
              </label>
            </div>
          ))}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={addRow}
              className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 cursor-pointer"><Plus className="w-3.5 h-3.5" /> صفحة</button>
            <button type="button" disabled={rows.length <= 1} onClick={() => setRows(rs => rs.slice(0, -1))}
              className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 cursor-pointer disabled:opacity-50"><Minus className="w-3.5 h-3.5" /> آخر صفحة</button>
          </div>
          {error && <div className="text-xs font-bold text-rose-800 bg-rose-50 border border-rose-200 rounded-lg p-2">{error}</div>}
          {ranges.length > 0 && (
            <div className="pt-2 overflow-x-auto">
              <table className="w-full text-xs text-right border-collapse border border-slate-200 rounded-lg overflow-hidden">
                <thead className="bg-slate-900 text-slate-100 font-black">
                  <tr>
                    <th className="p-2 text-center">الصفحة</th>
                    <th className="p-2 text-center">من فقرة</th>
                    <th className="p-2 text-center">إلى فقرة</th>
                    <th className="p-2 text-center">عدد الفقرات</th>
                    <th className="p-2 text-center">مجموع الصفحة (كما دوّنه المجهز)</th>
                    <th className="p-2 text-center">بعد التصحيح الحسابي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-mono font-bold text-slate-900">
                  {ranges.map(r => (
                    <tr key={r.page}>
                      <td className="p-2 text-center font-sans">{r.page}</td>
                      <td className="p-2 text-center">{r.from}</td>
                      <td className="p-2 text-center">{r.to}</td>
                      <td className="p-2 text-center">{r.itemCount}</td>
                      <td className="p-2 text-center">{n(r.stated)}</td>
                      {Math.abs(r.corrected - r.stated) > 0.005
                        ? <td className="p-2 text-center bg-amber-50 text-amber-900" title={`في الصفحة تصحيح حسابي: الفرق ${n(Math.round((r.corrected - r.stated) * 100) / 100)}`}>{n(r.corrected)}</td>
                        : <td className="p-2 text-center">{n(r.corrected)}</td>}
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-100 font-black font-mono text-slate-900">
                  <tr>
                    <td className="p-2 text-center font-sans" colSpan={3}>المجموع</td>
                    <td className="p-2 text-center">{ranges.reduce((s, r) => s + r.itemCount, 0)}</td>
                    <td className="p-2 text-center">{n(Math.round(ranges.reduce((s, r) => s + r.stated, 0) * 100) / 100)}</td>
                    <td className="p-2 text-center">{n(Math.round(ranges.reduce((s, r) => s + r.corrected, 0) * 100) / 100)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
        <div className="p-4 border-t border-slate-200 flex justify-end gap-2">
          <button onClick={onClose} className="text-xs font-bold px-4 py-2 rounded-xl border border-slate-300 cursor-pointer">إلغاء</button>
          <button disabled={!pages} onClick={() => pages && onApply(pages)}
            className="text-xs font-black px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer disabled:opacity-50">إسناد الفقرات إلى ({rows.length}) صفحة</button>
        </div>
      </div>
    </div>
  );
};

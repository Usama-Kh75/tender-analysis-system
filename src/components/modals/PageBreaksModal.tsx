import React, { useState } from 'react';
import { X, Plus, Minus, FileStack } from 'lucide-react';
import type { BOQItem } from '../../types/tender';
import { resolvePageStarts, pagesFromStarts, startItemNos } from '../../utils/pageSummary';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  items: BOQItem[];
  bidderName: string;
  onApply: (pages: (number | undefined)[]) => void;
}

// فواصل صفحات عطاء المجهز كما قدّمه: رقم أول فقرة في كل صفحة، فتُسند الفقرات إلى صفحاتها بالترتيب.
// لا يمس أي مبلغ. للعطاءات المُدخلة قبل أن تقرأ القراءة الآلية أرقام الصفحات
export const PageBreaksModal: React.FC<Props> = ({ isOpen, onClose, items, bidderName, onApply }) => {
  const [starts, setStarts] = useState<string[]>(() => {
    const current = startItemNos(items);
    return current.length > 0 ? current : [String(items[0]?.itemNo ?? '1')];
  });
  if (!isOpen) return null;

  const resolved = resolvePageStarts(items, starts);
  const error = 'error' in resolved ? resolved.error : null;
  const pages = 'starts' in resolved ? pagesFromStarts(items.length, resolved.starts) : null;
  const countOf = (p: number) => pages ? pages.filter(x => x === p).length : 0;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="فواصل الصفحات">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        <div className="p-4 bg-slate-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold"><FileStack className="w-5 h-5 text-amber-400" /> فواصل صفحات عطاء ({bidderName})</div>
          <button onClick={onClose} aria-label="إغلاق" className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 overflow-y-auto space-y-2 text-sm">
          <p className="text-xs text-slate-600 font-bold">أدخل رقم أول فقرة في كل صفحة كما في العطاء الأصلي. الصفحة الأولى تبدأ من أول فقرة في الجدول.</p>
          {starts.map((v, p) => (
            <label key={p} className="flex items-center gap-2">
              <span className="w-40 font-bold text-slate-800">الصفحة ({p + 1}) تبدأ بالفقرة</span>
              <input type="text" dir="ltr" value={v} disabled={p === 0}
                onChange={(e) => setStarts(s => s.map((x, i) => i === p ? e.target.value : x))}
                className="w-24 text-center border border-slate-300 rounded-lg p-1 font-mono font-bold disabled:bg-slate-100" />
              {pages && <span className="text-xs text-slate-500">({countOf(p + 1)}) فقرة</span>}
            </label>
          ))}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={() => setStarts(s => [...s, ''])}
              className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 cursor-pointer"><Plus className="w-3.5 h-3.5" /> صفحة</button>
            <button type="button" disabled={starts.length <= 1} onClick={() => setStarts(s => s.slice(0, -1))}
              className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 cursor-pointer disabled:opacity-50"><Minus className="w-3.5 h-3.5" /> آخر صفحة</button>
          </div>
          {error && <div className="text-xs font-bold text-rose-800 bg-rose-50 border border-rose-200 rounded-lg p-2">{error}</div>}
        </div>
        <div className="p-4 border-t border-slate-200 flex justify-end gap-2">
          <button onClick={onClose} className="text-xs font-bold px-4 py-2 rounded-xl border border-slate-300 cursor-pointer">إلغاء</button>
          <button disabled={!pages} onClick={() => pages && onApply(pages)}
            className="text-xs font-black px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer disabled:opacity-50">إسناد الفقرات إلى ({starts.length}) صفحة</button>
        </div>
      </div>
    </div>
  );
};

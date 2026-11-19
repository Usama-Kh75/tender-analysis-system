import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, HelpCircle } from 'lucide-react';
import type { Bidder } from '../../types/tender';

interface UnanalysedBidsModalProps {
  chosenName: string;
  bidders: Bidder[];
  onExcluded: (id: string) => void;
  onEnterBid: (id: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

// قبل اختيار الترسية: شركات مسجَّلة بلا مبالغ ولم تُستبعد؛ كل خيار إجراء واحد ولا يجري الاختيار تلقائياً
export const UnanalysedBidsModal: React.FC<UnanalysedBidsModalProps> = ({ chosenName, bidders, onExcluded, onEnterBid, onDelete, onClose }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const btn = 'text-xs font-black px-3 py-2 rounded-lg border cursor-pointer transition';

  return createPortal(
    <div
      className="fixed inset-0 z-[60] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 no-print"
      role="dialog" aria-modal="true" aria-labelledby="unanalysed-bids-title"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/20 text-amber-300 rounded-lg"><HelpCircle className="w-5 h-5" /></div>
            <h2 id="unanalysed-bids-title" className="text-base sm:text-lg font-bold">قبل اختيار ({chosenName}) للترسية</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="إغلاق" className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 overflow-y-auto space-y-3">
          <p className="text-xs sm:text-sm font-bold text-slate-700 leading-relaxed">
            الشركات الآتية مسجَّلة في المناقصة بلا مبالغ، فما موقف كل منها؟
          </p>
          {bidders.map(b => (
            <div key={b.id} className="border border-slate-200 rounded-xl p-3 bg-slate-50">
              <div className="font-black text-slate-900 text-sm mb-2"><bdi>{b.name}</bdi></div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => onExcluded(b.id)} className={`${btn} bg-rose-50 border-rose-300 text-rose-900 hover:bg-rose-100`}>
                  مستبعدة قبل التحليل التجاري — تسجيل الأسباب
                </button>
                <button type="button" onClick={() => onEnterBid(b.id)} className={`${btn} bg-blue-50 border-blue-300 text-blue-900 hover:bg-blue-100`}>
                  لم يُدخل عطاؤها بعد — الانتقال إلى إدخاله
                </button>
                <button type="button" onClick={() => onDelete(b.id)} className={`${btn} bg-white border-slate-300 text-slate-800 hover:bg-slate-100`}>
                  حذفها (سُجّلت خطأً)
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="p-3 border-t border-slate-200 flex justify-end">
          <button type="button" onClick={onClose} className={`${btn} bg-slate-100 border-slate-300 text-slate-800 hover:bg-slate-200`}>إلغاء</button>
        </div>
      </div>
    </div>,
    document.body
  );
};

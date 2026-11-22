import React, { useEffect, useRef, useState } from 'react';
import { Hourglass, X } from 'lucide-react';
import type { Bidder, TenderProject } from '../../types/tender';
import { toLatinDigits } from '../../utils/calculations';
import { bidExpiry, isValidityDays, MAX_VALIDITY_DAYS } from '../../utils/bidValidity';
import { formatSheetDate } from '../../utils/orderStatus';

interface BidValidityModalProps {
  project: TenderProject;
  bidder: Bidder;
  onSave: (bidderId: string, v: { validityDays?: number; validityExtendedTo?: string }) => void;
  onClose: () => void;
  /** إدخال لم يُحفظ بعد: يمنع «حفظ والتحديث» (blockingWork في App) */
  onDirtyChange: (dirty: boolean) => void;
}

// نفاذية عطاء واحد (المادة 13/أولاً): المدة بالأيام من تاريخ غلق المناقصة، وتاريخ التمديد إن طُلب من المجهز. عرض وتنبيه فقط.
export const BidValidityModal: React.FC<BidValidityModalProps> = ({ project, bidder, onSave, onClose, onDirtyChange }) => {
  const [days, setDays] = useState(bidder.validityDays ? String(bidder.validityDays) : '');
  const [extended, setExtended] = useState(bidder.validityExtendedTo ?? '');
  const closeRef = useRef<HTMLButtonElement>(null);

  const daysText = toLatinDigits(days.trim());
  const daysNum = daysText === '' ? undefined : Number(daysText);
  const daysError = daysNum !== undefined && (!/^\d+$/.test(daysText) || !isValidityDays(daysNum))
    ? `أدخل عدداً صحيحاً موجباً من الأيام لا يزيد على ${MAX_VALIDITY_DAYS}` : null;
  const dirty = daysText !== (bidder.validityDays ? String(bidder.validityDays) : '') || extended !== (bidder.validityExtendedTo ?? '');

  useEffect(() => { onDirtyChange(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);

  useEffect(() => {
    const prev = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    return () => { if (prev && prev.isConnected) prev.focus(); };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const preview = bidExpiry(project, { ...bidder, validityDays: daysError ? undefined : daysNum, validityExtendedTo: extended || undefined });
  const hasClosing = !!formatSheetDate(project.closingDate);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (daysError) return;
    onSave(bidder.id, { validityDays: daysNum, validityExtendedTo: extended || undefined });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 print:hidden" role="dialog" aria-modal="true" aria-labelledby="bid-validity-title">
      <form onSubmit={submit} className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/20 text-amber-400 rounded-lg"><Hourglass className="w-5 h-5" /></div>
            <h2 id="bid-validity-title" className="text-base font-bold">نفاذية العطاء: {bidder.name}</h2>
          </div>
          <button type="button" ref={closeRef} onClick={onClose} aria-label="إغلاق" className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 space-y-3 text-sm">
          <div>
            <label htmlFor="bid-validity-days" className="block text-xs font-bold text-slate-700 mb-1">مدة نفاذية العطاء (يوماً)</label>
            <input
              id="bid-validity-days"
              type="text"
              inputMode="numeric"
              value={days}
              onChange={(e) => setDays(e.target.value)}
              aria-invalid={!!daysError}
              aria-describedby={daysError ? 'bid-validity-error' : undefined}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
            {daysError && <p id="bid-validity-error" role="alert" className="text-xs font-bold text-rose-700 mt-1">{daysError}</p>}
          </div>
          <div>
            <label htmlFor="bid-validity-ext" className="block text-xs font-bold text-slate-700 mb-1">ممدَّدة لغاية (إن مدّدها المجهز)</label>
            <input
              id="bid-validity-ext"
              type="date"
              value={extended}
              onChange={(e) => setExtended(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
          <p className="text-xs font-bold rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-slate-700" aria-live="polite">
            {preview
              ? <>تنتهي النفاذية في <bdi className="font-mono">{formatSheetDate(preview)}</bdi></>
              : !hasClosing && !extended
                ? 'أدخل تاريخ غلق المناقصة في إعدادات المناقصة ليُحسب انتهاء النفاذية'
                : 'أدخل مدة النفاذية ليُحسب انتهاؤها'}
          </p>
        </div>
        <div className="p-4 border-t border-slate-200 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer">إلغاء</button>
          <button type="submit" disabled={!!daysError} className="px-4 py-2 text-sm font-bold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg cursor-pointer">حفظ</button>
        </div>
      </form>
    </div>
  );
};

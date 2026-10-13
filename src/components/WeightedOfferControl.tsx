import React, { useEffect, useRef, useState } from 'react';
import { Scale, Play, Pause, CheckCircle2, RotateCcw, ChevronDown } from 'lucide-react';
import type { Bidder } from '../types/tender';
import { formatNumber } from '../utils/calculations';
import { assessBalance, correctedBalanceRows, offerStatus, startOfferBlocker } from '../utils/weightedOffer';

interface Props {
  bidder: Bidder;
  threshold: number;
  onStart: (origin: 'corrected' | 'formula' | 'resume') => void;
  onPause: () => void;
  onAdopt: () => void;
  onUnadopt: () => void;
}

const MENU_WIDTH = 288;

// زر بدء العرض الموزون: قائمة من خيارين، تُرسم بموضع ثابت لتعلو الشريط المثبت والجدول وتبقى داخل الشاشة
const StartMenu: React.FC<Pick<Props, 'onStart'> & { paused: boolean; blocker: string | null }> = ({ onStart, paused, blocker }) => {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!menuRef.current?.contains(target) && !buttonRef.current?.contains(target)) close();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const toggle = () => {
    if (open) { setOpen(false); return; }
    const r = buttonRef.current?.getBoundingClientRect();
    if (!r) return;
    const left = Math.min(Math.max(8, r.right - MENU_WIDTH), window.innerWidth - MENU_WIDTH - 8);
    setPos({ top: r.bottom + 6, left });
    setOpen(true);
  };
  const choose = (origin: 'corrected' | 'formula' | 'resume') => { setOpen(false); onStart(origin); };
  const item = 'w-full text-right px-3 py-2 rounded-xl hover:bg-purple-50 transition cursor-pointer block';

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        disabled={!!blocker}
        aria-haspopup="menu"
        aria-expanded={open}
        title={blocker ?? 'بدء مرحلة العرض الموزون (ضوابط رقم (4) سادساً/5)'}
        className="flex items-center gap-1.5 bg-purple-700 hover:bg-purple-600 text-white text-xs font-black px-3.5 py-2 rounded-xl shadow-md transition cursor-pointer border border-purple-400/40 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Scale className="w-4 h-4 text-purple-200" />
        <span>{paused ? 'العرض الموزون (موقوف)' : 'العرض الموزون'}</span>
        <ChevronDown className="w-3.5 h-3.5 text-purple-200" />
      </button>
      {open && (
        <div
          ref={menuRef}
          role="menu"
          style={{ position: 'fixed', top: pos.top, left: pos.left, width: MENU_WIDTH }}
          className="z-50 bg-white text-slate-900 rounded-2xl shadow-2xl border border-purple-300 p-1.5 text-xs"
        >
          {paused && (
            <button type="button" role="menuitem" className={`${item} font-black text-purple-900`} onClick={() => choose('resume')}>
              <span className="flex items-center gap-1.5"><Play className="w-3.5 h-3.5" /> استئناف العرض الموزون</span>
              <span className="block font-bold text-slate-500 mt-0.5">يعود إلى الأسعار التي وصلت إليها قبل الإيقاف</span>
            </button>
          )}
          <button type="button" role="menuitem" className={item} onClick={() => choose('corrected')}>
            <span className="flex items-center gap-1.5 font-black text-purple-900"><Play className="w-3.5 h-3.5" /> {paused ? 'إعادة البدء ' : 'بدء '}من أسعار العطاء</span>
            <span className="block font-bold text-slate-500 mt-0.5">تبدأ بأسعار العطاء بعد التصحيح، ثم تُعدَّل الفقرات التي غيّرها المجهز</span>
          </button>
          <button type="button" role="menuitem" className={item} onClick={() => choose('formula')}>
            <span className="flex items-center gap-1.5 font-black text-purple-900"><Play className="w-3.5 h-3.5" /> {paused ? 'إعادة البدء ' : 'بدء '}بالمعادلة</span>
            <span className="block font-bold text-slate-500 mt-0.5">كل فقرة = مبلغها التخميني × النسبة السعرية، مع تسوية التقريب</span>
          </button>
        </div>
      )}
    </>
  );
};

// مدخل العرض الموزون في شريط الشركة المثبت: زر بدء بقائمة، ثم سطر حي (الفرق والاعتماد والإيقاف) أثناء المرحلة.
// بطاقة التوازن التفصيلية تبقى فوق الجدول في WeightedOfferBar
export const WeightedOfferControl: React.FC<Props> = ({ bidder, threshold, onStart, onPause, onAdopt, onUnadopt }) => {
  const balance = assessBalance(correctedBalanceRows(bidder.items), threshold);
  const offer = bidder.weightedOffer;
  if (balance.verdict === 'no-estimate') return null;

  if (!offer || offer.status === 'paused') {
    if (balance.verdict === 'excluded') return null;
    return <StartMenu onStart={onStart} paused={offer?.status === 'paused'} blocker={startOfferBlocker(bidder, threshold)} />;
  }

  const status = offerStatus(bidder);
  if (!status) return null;
  const balanced = Math.abs(status.diff) < 0.005;
  const btn = 'flex items-center gap-1.5 text-xs font-black px-3 py-1.5 rounded-xl transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';

  return (
    <div className="flex items-center gap-2 flex-wrap bg-purple-950/70 border border-purple-400/40 rounded-xl px-3 py-1.5 text-xs font-bold">
      <Scale className="w-4 h-4 text-purple-300 shrink-0" />
      <span className="text-purple-100 font-black">{offer.status === 'adopted' ? '✓ العرض الموزون معتمد' : 'العرض الموزون'}</span>
      <span className={balanced ? 'text-emerald-300' : 'text-rose-300'}>
        الفرق: <span className="font-mono">{formatNumber(status.diff)}</span>{balanced ? ' ✓' : ''}
      </span>
      {status.stale && <span className="text-amber-300">⚠ تغيّر مبلغ العطاء: أوقف المرحلة ثم استأنفها</span>}
      {offer.status === 'active' ? (
        <button type="button" className={`${btn} bg-emerald-700 hover:bg-emerald-600 text-white`} disabled={!status.canAdopt} onClick={onAdopt}
          title={status.canAdopt ? '' : 'يُعتمد حين يساوي مجموع العرض مبلغ العطاء تماماً'}>
          <CheckCircle2 className="w-3.5 h-3.5" /> اعتماد العرض
        </button>
      ) : (
        <button type="button" className={`${btn} bg-white text-purple-900`} onClick={onUnadopt}>
          <RotateCcw className="w-3.5 h-3.5" /> إلغاء الاعتماد
        </button>
      )}
      <button type="button" className={`${btn} bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-600`} onClick={onPause}>
        <Pause className="w-3.5 h-3.5" /> إيقاف المرحلة
      </button>
    </div>
  );
};

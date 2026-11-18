import React from 'react';
import { Scale, Pause, CheckCircle2, RotateCcw } from 'lucide-react';
import type { Bidder } from '../types/tender';
import { formatNumber } from '../utils/calculations';
import { assessBalance, correctedBalanceRows, offerStatus } from '../utils/weightedOffer';

interface Props {
  bidder: Bidder;
  threshold: number;
  exclusionThreshold?: number;
  onPause: () => void;
  onAdopt: () => void;
  onUnadopt: () => void;
}

// سطر العرض الموزون الحي في شريط الشركة المثبت (الفرق والاعتماد والإيقاف) أثناء المرحلة فقط؛ لا بدء جديد في الواجهة، والاستئناف من «المحضر».
// بطاقة التوازن التفصيلية تبقى فوق الجدول في WeightedOfferBar
export const WeightedOfferControl: React.FC<Props> = ({ bidder, threshold, exclusionThreshold = threshold, onPause, onAdopt, onUnadopt }) => {
  const balance = assessBalance(correctedBalanceRows(bidder.items), threshold, exclusionThreshold);
  const offer = bidder.weightedOffer;
  if (balance.verdict === 'no-estimate') return null;

  // الاستئناف من «المحضر»: الشريط هنا مع العرض الفعّال أو المعتمد فقط
  if (!offer || offer.status === 'paused') return null;

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

import React from 'react';
import { Scale, Play, Pause, CheckCircle2, RotateCcw, AlertTriangle } from 'lucide-react';
import type { Bidder } from '../types/tender';
import { formatNumber } from '../utils/calculations';
import {
  assessBalance, correctedBalanceRows, offerBalanceRows, offerStatus, startOfferBlocker,
  BALANCE_VERDICT_LABEL, UNBALANCED_ITEMS_LIMIT_PERCENT
} from '../utils/weightedOffer';

interface Props {
  bidder: Bidder;
  threshold: number;
  onStart: (origin: 'corrected' | 'formula' | 'resume') => void;
  onPause: () => void;
  onAdopt: () => void;
  onUnadopt: () => void;
}

// حكم التوازن (سادساً/5) ومرحلة العرض الموزون للعطاء النشط: البدء، الشريط الحي، الاعتماد
export const WeightedOfferBar: React.FC<Props> = ({ bidder, threshold, onStart, onPause, onAdopt, onUnadopt }) => {
  const balance = assessBalance(correctedBalanceRows(bidder.items), threshold);
  const offer = bidder.weightedOffer;
  const status = offerStatus(bidder);
  const blocker = startOfferBlocker(bidder, threshold);
  const offerBalance = offer ? assessBalance(offerBalanceRows(bidder.items), threshold) : null;
  if (balance.verdict === 'no-estimate') return null;

  const verdictTone = balance.verdict === 'excluded' ? 'border-rose-300 bg-rose-50 text-rose-950'
    : balance.verdict === 'weighting-required' ? 'border-amber-300 bg-amber-50 text-amber-950'
    : 'border-emerald-300 bg-emerald-50 text-emerald-950';
  const btn = 'flex items-center gap-1.5 text-xs font-black px-3 py-1.5 rounded-xl transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';

  return (
    <div className={`rounded-3xl border-2 p-4 space-y-3 ${verdictTone}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Scale className="w-5 h-5 shrink-0" />
          <div>
            <div className="font-black text-sm">توازن العطاء (ضوابط رقم (4) سادساً/5): {BALANCE_VERDICT_LABEL[balance.verdict]}</div>
            <div className="text-xs font-bold mt-0.5">
              الفقرات المنحرفة بالزيادة أكثر من {threshold}%: ({balance.unbalancedCount}) من ({balance.itemCount}) = {balance.unbalancedPercent.toFixed(2)}%
              {' '}— الحد {UNBALANCED_ITEMS_LIMIT_PERCENT}%
              {balance.belowCount > 0 && <> — والمنحرفة بالنقصان للإحاطة: ({balance.belowCount})</>}
            </div>
          </div>
        </div>

        {(!offer || offer.status === 'paused') && balance.verdict !== 'excluded' && (
          <div className="flex flex-wrap items-center gap-2">
            {offer?.status === 'paused' && (
              <button className={`${btn} bg-purple-700 hover:bg-purple-800 text-white`} disabled={!!blocker} title={blocker ?? ''} onClick={() => onStart('resume')}>
                <Play className="w-3.5 h-3.5" /> استئناف العرض الموزون
              </button>
            )}
            <button className={`${btn} bg-white hover:bg-purple-50 text-purple-900 border border-purple-400`} disabled={!!blocker} title={blocker ?? 'تبدأ بأسعار العطاء بعد التصحيح، ثم تُعدَّل الفقرات التي غيّرها المجهز في جدوله المعدل'} onClick={() => onStart('corrected')}>
              <Play className="w-3.5 h-3.5" /> بدء العرض الموزون من أسعار العطاء
            </button>
            <button className={`${btn} bg-white hover:bg-purple-50 text-purple-900 border border-purple-400`} disabled={!!blocker} title={blocker ?? 'كل فقرة = مبلغها التخميني × النسبة السعرية، مع تسوية التقريب (نص سادساً/5)'} onClick={() => onStart('formula')}>
              <Play className="w-3.5 h-3.5" /> بدء العرض الموزون بالمعادلة
            </button>
          </div>
        )}
      </div>

      {Math.abs(bidder.totals.weightedRoundingResidual ?? 0) >= 0.005 && (
        <div className="text-[11px] font-bold text-amber-900">
          فرق تقريب متبقٍ في الأسعار الموزونة المرجعية: <span className="font-mono">{formatNumber(bidder.totals.weightedRoundingResidual ?? 0)}</span> — تعذّرت تسويته بكميات الفقرات، وهو ما يفسّر فرق العرض إن بدأ بالمعادلة.
        </div>
      )}

      {blocker && (!offer || offer.status === 'paused') && balance.verdict !== 'excluded' && (
        <div className="text-xs font-bold">{blocker}</div>
      )}
      {!offer && balance.verdict === 'accept-as-is' && (
        <div className="text-[11px] font-bold opacity-80">إعداد العرض الموزون هنا اختياري بقرار اللجنة؛ النص يقبل مبلغ العطاء كما هو.</div>
      )}

      {offer && offer.status !== 'paused' && status && (
        <div className="bg-white/70 rounded-2xl border border-purple-300 p-3 space-y-2 text-purple-950">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="font-black text-sm">
              {offer.status === 'adopted' ? '✓ العرض الموزون معتمد' : 'مرحلة العرض الموزون — أرقام العطاء مقفلة'}
              <span className="text-xs font-bold opacity-70"> ({offer.origin === 'formula' ? 'بالمعادلة' : 'من أسعار العطاء'})</span>
            </div>
            <div className="flex items-center gap-2">
              {offer.status === 'active' ? (
                <button className={`${btn} bg-emerald-700 hover:bg-emerald-800 text-white`} disabled={!status.canAdopt} onClick={onAdopt}
                  title={status.canAdopt ? '' : 'يُعتمد حين يساوي مجموع العرض مبلغ العطاء تماماً'}>
                  <CheckCircle2 className="w-3.5 h-3.5" /> اعتماد العرض الموزون
                </button>
              ) : (
                <button className={`${btn} bg-white text-purple-900 border border-purple-400`} onClick={onUnadopt}>
                  <RotateCcw className="w-3.5 h-3.5" /> إلغاء الاعتماد
                </button>
              )}
              <button className={`${btn} bg-white text-slate-700 border border-slate-300`} onClick={onPause}>
                <Pause className="w-3.5 h-3.5" /> إيقاف المرحلة
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-bold">
            <div>مبلغ العطاء بعد التصحيح: <span className="font-mono">{formatNumber(status.bidTotal)}</span></div>
            <div>مجموع العرض الموزون: <span className="font-mono">{formatNumber(status.offerSum)}</span></div>
            <div className={Math.abs(status.diff) < 0.005 ? 'text-emerald-700' : 'text-rose-700'}>
              الفرق: <span className="font-mono">{formatNumber(status.diff)}</span>{Math.abs(status.diff) < 0.005 ? ' ✓' : ''}
            </div>
            <div>الفقرات المعدّلة: ({status.editedCount})</div>
          </div>
          {offerBalance && (
            <div className="text-xs font-bold">
              توازن العرض الموزون: ({offerBalance.unbalancedCount}) فقرة منحرفة بالزيادة = {offerBalance.unbalancedPercent.toFixed(2)}% — {BALANCE_VERDICT_LABEL[offerBalance.verdict]}
            </div>
          )}
          {status.markedNotEdited > 0 && (
            <div className="text-xs font-bold text-orange-800">⚑ ({status.markedNotEdited}) فقرة مؤشرة «سعر غير معقول» لم يُعدَّل سعرها في العرض.</div>
          )}
          {status.stale && (
            <div className="text-xs font-black text-rose-800 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" /> تغيّر مبلغ العطاء بعد بدء العرض الموزون؛ أوقف المرحلة ثم استأنفها لتُعاد المطابقة.
            </div>
          )}
          {balance.verdict === 'weighting-required' && offer.origin === 'corrected' && (
            <div className="text-[11px] font-bold text-amber-900">
              تنبيه: الفقرات غير المتوازنة تتجاوز 10%، والنص (سادساً/5) يعتمد جدول جهة التعاقد معدلاً بنسبة مبلغ العطاء (البدء بالمعادلة).
            </div>
          )}
        </div>
      )}
    </div>
  );
};

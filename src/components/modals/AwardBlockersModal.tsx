import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, HelpCircle } from 'lucide-react';
import type { AwardBlockers } from '../../utils/awardBlockers';
import { LEGAL_TEXTS, type LegalKey } from '../../utils/legalTexts';
import { itemsCountText, itemsWithErrorsText } from '../../utils/arabicCount';
import { formatCurrency } from '../../utils/calculations';

interface AwardBlockersModalProps {
  chosenName: string;
  currency: string;
  blockers: AwardBlockers;
  onOpenAudit: (bidderId: string) => void;
  onExcluded: (id: string) => void;
  onEnterBid: (id: string) => void;
  onDelete: (id: string) => void;
  onOpenPreference: () => void;
  /** يعتمد الاختيار؛ reason مبرر اختيار غير الأوطأ إن انطبق */
  onApply: (reason?: string) => void;
  onClose: () => void;
  /** مبرر مكتوب لم يُعتمد بعد (يمنع التحديث: blockingWork) */
  onDirtyChange: (dirty: boolean) => void;
}

const btn = 'text-xs font-black px-3 py-2 rounded-lg border cursor-pointer transition';
const focus = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700';
const card = 'border border-slate-200 rounded-xl p-3 bg-slate-50';

interface LegalProps { k?: LegalKey; shown: LegalKey | null; setShown: (k: LegalKey | null) => void }
const Legal: React.FC<LegalProps> = ({ k, shown, setShown }) => {
  if (!k) return null;
  const t = LEGAL_TEXTS[k];
  const on = shown === k;
  return (
    <>
      <span className="text-indigo-800 text-xs font-bold"> ({t.label})</span>{' '}
      <button type="button" aria-expanded={on} aria-controls={`award-legal-${k}`}
        aria-label={`${on ? 'إخفاء' : 'عرض'} النص الرسمي لـ ${t.label}`}
        onClick={() => setShown(on ? null : k)}
        className={`text-xs font-bold text-indigo-800 underline cursor-pointer rounded whitespace-nowrap ${focus}`}>
        {on ? 'إخفاء النص' : 'النص الرسمي'}
      </button>
      <blockquote id={`award-legal-${k}`} hidden={!on} className="mt-1 rounded-lg border border-indigo-100 bg-white px-3 py-2 text-xs leading-relaxed text-slate-700">
        «{t.text}» (ص {t.page})
      </blockquote>
    </>
  );
};

// قبل اختيار الترسية: موانع قاطعة، ومبررات تسجّلها اللجنة، وتنبيهات. لا يجري الاختيار إلا بـ«اعتماد الاختيار» حين لا مانع
export const AwardBlockersModal: React.FC<AwardBlockersModalProps> = ({
  chosenName, currency, blockers, onOpenAudit, onExcluded, onEnterBid, onDelete, onOpenPreference, onApply, onClose, onDirtyChange
}) => {
  const [reason, setReason] = useState('');
  const [shown, setShown] = useState<LegalKey | null>(null);
  const reasonRef = useRef('');
  const closeRef = useRef<HTMLButtonElement>(null);
  // الإغلاق للانتقال إلى نافذة أو عرض آخر لا يعيد المؤشر إلى زر الاختيار: الوجهة تأخذه (كما في StatusWindow)
  const handoffRef = useRef(false);

  const handoff = (fn: () => void) => () => {
    if (reasonRef.current.trim() && !window.confirm('كتبتَ مبرراً لم يُعتمد. أتتركه وتنتقل؟')) return;
    handoffRef.current = true;
    fn();
  };
  const requestClose = useCallback(() => {
    if (reasonRef.current.trim() && !window.confirm('كتبتَ مبرراً لم يُعتمد. أتغلق النافذة دونه؟')) return;
    onClose();
  }, [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') requestClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [requestClose]);
  useEffect(() => {
    handoffRef.current = false;
    const prev = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    return () => { if (!handoffRef.current && prev && prev.isConnected) prev.focus(); };
  }, []);
  useEffect(() => { reasonRef.current = reason; onDirtyChange(reason.trim() !== ''); }, [reason, onDirtyChange]);
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);

  const pendingErrors = blockers.blocks.find(b => b.kind === 'pendingErrors');
  const empty = blockers.blocks.find(b => b.kind === 'emptyBidders');
  const preference = blockers.justify.find(j => j.kind === 'preference');
  const notLowest = blockers.justify.find(j => j.kind === 'notLowest');
  const readCheck = blockers.warnings.find(w => w.kind === 'readCheck');
  const prefUnmet = !!preference && !preference.met;
  const canApply = blockers.blocks.length === 0 && !prefUnmet;
  const reasonMissing = !!notLowest && reason.trim() === '';

  return createPortal(
    <div className="fixed inset-0 z-[60] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 no-print"
      role="dialog" aria-modal="true" aria-labelledby="award-blockers-title">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/20 text-amber-300 rounded-lg"><HelpCircle className="w-5 h-5" /></div>
            <h2 id="award-blockers-title" className="text-base sm:text-lg font-bold">قبل اختيار (<bdi>{chosenName}</bdi>) للترسية</h2>
          </div>
          <button ref={closeRef} type="button" onClick={requestClose} aria-label="إغلاق" className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto space-y-3">
          {pendingErrors && pendingErrors.kind === 'pendingErrors' && (
            <section className={card} aria-labelledby="ab-errors">
              <h3 id="ab-errors" className="font-black text-slate-900 text-sm">فقرات فيها أخطاء لم تبتّ فيها اللجنة</h3>
              <div className="text-xs sm:text-sm font-semibold text-slate-700 leading-relaxed mt-1">
                لا تُختار الترسية قبل بتّ اللجنة في الفقرات التي فيها أخطاء في جميع العطاءات المؤهلة، لأن تسلسل العطاءات يُحدَّد بعد التصحيح.
                <Legal k={pendingErrors.legalKey} shown={shown} setShown={setShown} />
              </div>
              <ul className="text-xs sm:text-sm list-disc pr-5 mt-1.5 text-amber-900 font-bold">
                {pendingErrors.bidders.map(b => (
                  <li key={b.id}><bdi>{b.name}</bdi>: {itemsWithErrorsText(b.count)}</li>
                ))}
              </ul>
              <button type="button" onClick={handoff(() => onOpenAudit(pendingErrors.firstBidderId))}
                className={`${btn} mt-2 bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100`}>
                فتح التدقيق: <bdi>{pendingErrors.bidders[0].name}</bdi>
              </button>
            </section>
          )}

          {empty && empty.kind === 'emptyBidders' && (
            <section className={card} aria-labelledby="ab-empty">
              <h3 id="ab-empty" className="font-black text-slate-900 text-sm">شركات مسجَّلة بلا مبالغ</h3>
              <p className="text-xs sm:text-sm font-bold text-slate-700 leading-relaxed mt-1 mb-2">
                الشركات الآتية مسجَّلة في المناقصة بلا مبالغ، فما موقف كل منها؟
              </p>
              <div className="space-y-2">
                {empty.bidders.map(b => (
                  <div key={b.id} className="border border-slate-200 rounded-xl p-3 bg-white">
                    <div className="font-black text-slate-900 text-sm mb-2"><bdi>{b.name}</bdi></div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={handoff(() => onExcluded(b.id))} aria-label={`${b.name}: مستبعدة قبل التحليل التجاري — تسجيل الأسباب`} className={`${btn} bg-rose-50 border-rose-300 text-rose-900 hover:bg-rose-100`}>
                        مستبعدة قبل التحليل التجاري — تسجيل الأسباب
                      </button>
                      <button type="button" onClick={handoff(() => onEnterBid(b.id))} aria-label={`${b.name}: لم يُدخل عطاؤها بعد — الانتقال إلى إدخاله`} className={`${btn} bg-blue-50 border-blue-300 text-blue-900 hover:bg-blue-100`}>
                        لم يُدخل عطاؤها بعد — الانتقال إلى إدخاله
                      </button>
                      <button type="button" onClick={handoff(() => onDelete(b.id))} aria-label={`${b.name}: حذفها (سُجّلت خطأً)`} className={`${btn} bg-white border-slate-300 text-slate-800 hover:bg-slate-100`}>
                        حذفها (سُجّلت خطأً)
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {prefUnmet && preference && preference.kind === 'preference' && (
            <section className={card} aria-labelledby="ab-pref">
              <h3 id="ab-pref" className="font-black text-slate-900 text-sm">أساس المفاضلة بين العطاءات المتقاربة</h3>
              <div className="text-xs sm:text-sm font-semibold text-slate-700 leading-relaxed mt-1">
                العطاءات المتساوية أو المتقاربة لغاية 1% من الكلفة التخمينية يُفاضَل بينها بمعايير مُحوَّلة لقيمة مالية، فيُسجَّل أساس المفاضلة لكل منها قبل الاختيار.
                <Legal k={preference.legalKey} shown={shown} setShown={setShown} />
              </div>
              <ul className="text-xs sm:text-sm mt-1.5 space-y-0.5">
                {preference.bids.map(b => (
                  <li key={b.id} className={b.complete ? 'text-emerald-800 font-bold' : 'text-amber-900 font-bold'}>
                    <bdi>{b.name}</bdi>: {b.complete ? '✓ سُجّل' : 'لم يُسجَّل'}
                  </li>
                ))}
              </ul>
              <button type="button" onClick={handoff(onOpenPreference)} className={`${btn} mt-2 bg-indigo-50 border-indigo-300 text-indigo-900 hover:bg-indigo-100`}>
                تسجيل أساس المفاضلة
              </button>
            </section>
          )}

          {notLowest && notLowest.kind === 'notLowest' && (
            <section className={card} aria-labelledby="ab-notlowest">
              <h3 id="ab-notlowest" className="font-black text-slate-900 text-sm">اختيار عطاء غير الأوطأ</h3>
              <div className="text-xs sm:text-sm font-semibold text-slate-700 leading-relaxed mt-1">
                جهة التعاقد غير ملزمة بقبول أوطأ العطاءات، لكن تُسجَّل مسوغات اختيار غيره. الأوطأ: <bdi>{notLowest.lowest.name}</bdi> بمبلغ{' '}
                <bdi className="font-mono">{formatCurrency(notLowest.lowest.totals.totalBidderAmount, currency)}</bdi>.
                <Legal k={notLowest.legalKey} shown={shown} setShown={setShown} />
              </div>
              <label htmlFor="ab-reason" className="block text-xs font-black text-slate-800 mt-2 mb-1">
                مبرر اختيار عطاء غير الأوطأ (يُحفظ في سجل التتبع ولا يُطبع)
              </label>
              <textarea id="ab-reason" required aria-required="true" value={reason} onChange={e => setReason(e.target.value)} rows={3}
                className="w-full border border-slate-300 rounded-lg p-2 text-sm bg-white" />
            </section>
          )}

          {readCheck && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs sm:text-sm font-bold text-amber-900 leading-relaxed">
              تنبيه: {itemsCountText(readCheck.count)} اختلفت قراءتاها ولم تُطابَق بالورقة بعد في العطاءات المؤهلة. لا يمنع هذا الاختيار، لكن طابقها قبل اعتماد الترسية.
            </div>
          )}
        </div>

        <div className="p-3 border-t border-slate-200 flex justify-end gap-2">
          {canApply && (
            <button type="button" disabled={reasonMissing} onClick={() => onApply(notLowest ? reason.trim() : undefined)}
              className={`${btn} bg-emerald-600 border-emerald-700 text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed`}>
              اعتماد الاختيار
            </button>
          )}
          <button type="button" onClick={requestClose} className={`${btn} bg-slate-100 border-slate-300 text-slate-800 hover:bg-slate-200`}>إلغاء</button>
        </div>
      </div>
    </div>,
    document.body
  );
};

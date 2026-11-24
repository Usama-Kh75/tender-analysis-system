import React, { useEffect, useId, useState } from 'react';
import { LEGAL_TEXTS } from '../utils/legalTexts';
import { CANDIDATES_CHECK_KEYS, CANDIDATES_CHECK_REMINDER } from '../utils/committeeRecords';
import { formatSheetDate } from '../utils/orderStatus';

interface Props {
  /** التاريخ المسجَّل (YYYY-MM-DD) أو undefined */
  date?: string;
  /** يحفظ التاريخ (فارغ = مسح)؛ يعيد رسالة خطأ عربية أو null */
  onSave: (date: string) => string | null;
  /** تاريخ مكتوب لم يُحفظ (يمنع التحديث) */
  onDirtyChange: (dirty: boolean) => void;
}

/**
 * تذكير غير مانع بالتحقق من المرشحين الثلاثة الأوائل قبل التوصية بالإحالة (ضوابط رقم (4) أحد عشر/4 و5).
 * عرض وتسجيل فقط: لا يمنع الترسية ولا يدخل المحضر ولا Excel ولا حساباً. الأزرق النيلي للتعليمات، لا الكهرماني (العمل المعلّق).
 */
export const CandidatesCheckNote: React.FC<Props> = ({ date, onSave, onDirtyChange }) => {
  const saved = date ?? '';
  const [draft, setDraft] = useState(saved);
  const [error, setError] = useState('');
  const dateId = useId();
  const errorId = useId();
  // الإعادة إلى المسجَّل عند تغيّره تتم بـ key من المستعمل (مناقصة أخرى أو بعد الحفظ)
  const dirty = draft !== saved;
  useEffect(() => { onDirtyChange(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);

  const save = () => {
    const err = onSave(draft);
    setError(err ?? '');
  };

  return (
    <div className="mt-1.5 text-xs font-bold text-indigo-900 leading-relaxed no-print" role="note">
      <div>
        {CANDIDATES_CHECK_REMINDER} ({CANDIDATES_CHECK_KEYS.map(k => LEGAL_TEXTS[k].label).join('، ')}).
      </div>
      <details className="mt-1 font-normal">
        <summary className="cursor-pointer font-bold underline">النص الرسمي</summary>
        {CANDIDATES_CHECK_KEYS.map(k => (
          <blockquote key={k} className="mt-1 rounded-lg border border-indigo-100 bg-white px-3 py-2 leading-relaxed text-slate-700">
            <span className="font-bold">{LEGAL_TEXTS[k].label}:</span> «{LEGAL_TEXTS[k].text}» (ص {LEGAL_TEXTS[k].page})
          </blockquote>
        ))}
      </details>
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <label htmlFor={dateId} className="font-black">تاريخ الإيعاز (اختياري)</label>
        <input id={dateId} type="date" value={draft} onChange={e => { setDraft(e.target.value); if (error) setError(''); }}
          aria-invalid={error ? true : undefined} aria-describedby={error ? errorId : undefined}
          className="border border-indigo-200 rounded-lg px-2 py-1 bg-white text-slate-800 font-semibold" />
        <button type="button" onClick={save} disabled={!dirty}
          className="font-black px-3 py-1.5 rounded-lg border border-indigo-300 bg-indigo-50 text-indigo-900 hover:bg-indigo-100 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
          {draft === '' && saved !== '' ? 'مسح التاريخ' : saved !== '' ? 'تحديث الإيعاز' : 'تسجيل الإيعاز'}
        </button>
        <span role="status" className={saved ? 'text-emerald-800' : 'text-slate-500 font-semibold'}>
          {saved ? `مسجَّل: ${formatSheetDate(saved)}` : 'لم يُسجَّل بعد'}
        </span>
      </div>
      {error && <div id={errorId} role="alert" className="mt-1 text-rose-700">{error}</div>}
    </div>
  );
};

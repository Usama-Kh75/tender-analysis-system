import React, { useEffect, useId, useState } from 'react';
import type { TenderProject } from '../types/tender';
import { bidCountGap } from '../utils/bidCountGap';
import { bidsCountAccusative } from '../utils/arabicCount';

interface BidCountGapCardProps {
  project: TenderProject;
  /** «لم يُدخل بعد»: يفتح إضافة مجهز (الإجراء المعتاد) */
  onAdd: () => void;
  /** «استُبعد قبل التحليل التجاري»: يضيف مجهزاً مستبعداً بالاسم ويفتح له أسباب الاستبعاد */
  onAddExcluded: (name: string) => void;
  /** «العدد خطأ»: يفتح إعدادات المناقصة */
  onOpenSettings: () => void;
  /** إدخال اسم لم يُحفظ بعد (يمنع التحديث) */
  onDirtyChange: (dirty: boolean) => void;
}

/**
 * فرق عدد العطاءات المستلمة (معلومات المناقصة) عن المجهزين المسجَّلين: تذكير للجنة لا مانع، لا يمنع اكتمال مرحلة ولا الترسية.
 * عرض فقط (لا يُطبع)؛ الكهرماني للعمل المعلّق.
 */
export const BidCountGapCard: React.FC<BidCountGapCardProps> = ({ project, onAdd, onAddExcluded, onOpenSettings, onDirtyChange }) => {
  const gap = bidCountGap(project);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const inputId = useId();
  const errorId = useId();

  // اسم مكتوب لم يُحفظ يمنع التحديث؛ ويُرفع المنع إذا أُغلق الحقل أو زالت البطاقة أو غاب التبويب
  const dirty = !!gap && naming && name.trim().length > 0;
  useEffect(() => {
    onDirtyChange(dirty);
    return () => onDirtyChange(false);
  }, [dirty, onDirtyChange]);

  const setNameValue = (v: string) => { setName(v); setError(''); };
  const close = () => { setNaming(false); setName(''); setError(''); };
  const save = () => {
    const n = name.trim();
    if (!n) { setError('اكتب اسم الشركة المستبعدة'); return; }
    close();
    onAddExcluded(n);
  };

  if (!gap) return null;
  const btn = 'px-3 py-1.5 text-xs font-bold rounded-lg border border-amber-400 bg-white text-amber-900 hover:bg-amber-100 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700';

  return (
    <div role="status" className="mb-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900 no-print">
      {gap.kind === 'missing' ? (
        <>
          <p className="text-sm font-black">
            في معلومات المناقصة ({gap.received}) عطاءات مستلمة، والمسجَّل ({gap.registered}). ما سبب نقص {bidsCountAccusative(gap.diff)}؟
          </p>
          {naming ? (
            <div className="mt-2 flex flex-wrap items-start gap-2">
              <div className="flex-1 min-w-[12rem] max-w-md">
                <label htmlFor={inputId} className="block text-xs font-bold mb-1">اسم الشركة المستبعدة قبل التحليل التجاري</label>
                <input
                  id={inputId}
                  type="text"
                  value={name}
                  autoFocus
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? errorId : undefined}
                  onChange={(e) => setNameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); save(); }
                    else if (e.key === 'Escape') { e.preventDefault(); close(); }
                  }}
                  className="w-full bg-white border border-amber-400 rounded-lg px-2 py-1.5 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                />
                {error && <p id={errorId} role="alert" className="mt-1 text-xs font-bold text-rose-700">{error}</p>}
              </div>
              <div className="flex items-center gap-2 pt-5">
                <button type="button" onClick={save} className={btn}>حفظ وتسجيل الأسباب</button>
                <button type="button" onClick={close} className={btn}>إلغاء</button>
              </div>
            </div>
          ) : (
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" onClick={() => onAdd()} className={btn}>لم يُدخل بعد</button>
              <button type="button" onClick={() => setNaming(true)} className={btn}>استُبعد قبل التحليل التجاري</button>
              <button type="button" onClick={onOpenSettings} className={btn}>العدد في معلومات المناقصة خطأ</button>
            </div>
          )}
        </>
      ) : (
        <>
          <p className="text-sm font-black">
            المسجَّل ({gap.registered}) أكثر من المستلم في معلومات المناقصة ({gap.received}).
          </p>
          <p className="mt-1 text-xs font-bold">
            إن كان العدد في معلومات المناقصة خطأً فصحّحه، وإن كان مجهز زائداً فاحذفه من «مقارنة المجهزين».
          </p>
          <div className="mt-2">
            <button type="button" onClick={onOpenSettings} className={btn}>تصحيح العدد</button>
          </div>
        </>
      )}
    </div>
  );
};

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Gavel, Plus, Trash2 } from 'lucide-react';
import type { Bidder, ExclusionReason, TechnicalOpinion, TenderProject } from '../../types/tender';
import {
  EXCLUSION_GROUNDS, INCOMPLETE_ITEMS, cleanExclusionReasons, cleanTechnicalOpinion, groundInfo, reasonLine, validateReasons
} from '../../utils/exclusionReasons';

interface ExclusionReasonsModalProps {
  project: TenderProject;
  bidder: Bidder;
  onSave: (bidderId: string, reasons: ExclusionReason[], technicalOpinion?: TechnicalOpinion) => void;
  onClose: () => void;
}

const fieldClass = 'w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none';

// أسباب استبعاد عطاء كله (ضوابط رقم (4) سادساً وسابعاً) ومصدر الرأي الفني للمناقصة؛ سجل وطباعة، لا يغيّر الحالة
export const ExclusionReasonsModal: React.FC<ExclusionReasonsModalProps> = ({ project, bidder, onSave, onClose }) => {
  const initialReasons = (): ExclusionReason[] => {
    const saved = cleanExclusionReasons(bidder.exclusionReasons) ?? [];
    return saved.length ? saved : [{ ground: 'technical' }];
  };
  const [reasons, setReasons] = useState<ExclusionReason[]>(initialReasons);
  const [opinion, setOpinion] = useState<TechnicalOpinion>(() => ({ ...(cleanTechnicalOpinion(project.technicalOpinion) ?? {}) }));
  const [error, setError] = useState<string | null>(null);
  const [snapshot] = useState(() => JSON.stringify([reasons, opinion]));
  const dirty = JSON.stringify([reasons, opinion]) !== snapshot;
  const hasTechnical = reasons.some(r => r.ground === 'technical');

  const requestClose = () => {
    if (dirty && !window.confirm('في النافذة تعديل لم يُحفظ. أتتخلى عنه؟')) return;
    onClose();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (dirty && !window.confirm('في النافذة تعديل لم يُحفظ. أتتخلى عنه؟')) return;
      onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [dirty, onClose]);

  const update = (i: number, patch: Partial<ExclusionReason>) =>
    setReasons(rs => rs.map((r, j) => {
      if (j !== i) return r;
      const next = { ...r, ...patch };
      if (next.ground !== 'incomplete') delete next.item;
      return next;
    }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = cleanExclusionReasons(reasons) ?? [];
    const message = validateReasons(clean);
    if (message) { setError(message); return; }
    // قسم المصدر مخفي بلا سبب فني: يبقى المحفوظ كما هو
    onSave(bidder.id, clean, hasTechnical ? cleanTechnicalOpinion(opinion) : project.technicalOpinion);
  };

  const preview = cleanExclusionReasons(reasons) ?? [];
  const previewProject = { technicalOpinion: hasTechnical ? cleanTechnicalOpinion(opinion) : project.technicalOpinion };

  return createPortal(
    <div
      className="fixed inset-0 z-[60] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 no-print"
      role="dialog" aria-modal="true" aria-labelledby="exclusion-reasons-title"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-rose-500/20 text-rose-300 rounded-lg"><Gavel className="w-5 h-5" /></div>
            <h2 id="exclusion-reasons-title" className="text-base sm:text-lg font-bold">أسباب استبعاد عطاء ({bidder.name})</h2>
          </div>
          <button type="button" onClick={requestClose} aria-label="إغلاق" className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={submit} className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50">
          <p className="text-xs text-slate-600">
            الأسباب بنود من التعليمات تستند إليها اللجنة في استبعاد العطاء كله، وتُطبع في المحضر بصياغة ثابتة مع نصوصها الرسمية.
          </p>

          <ol className="space-y-3">
            {reasons.map((r, i) => {
              const info = groundInfo(r.ground);
              return (
                <li key={i} className="bg-white border border-slate-200 rounded-xl p-3 space-y-2">
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="flex-1 min-w-[12rem]">
                      <label htmlFor={`ground-${i}`} className="block text-xs font-bold text-slate-700 mb-1">السبب ({i + 1})</label>
                      <select
                        id={`ground-${i}`}
                        value={r.ground}
                        onChange={e => update(i, { ground: e.target.value })}
                        className={fieldClass}
                      >
                        {!info && <option value={r.ground}>سبب غير محدد</option>}
                        {EXCLUSION_GROUNDS.map(g => <option key={g.ground} value={g.ground}>{g.label}</option>)}
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={() => setReasons(rs => rs.filter((_, j) => j !== i))}
                      aria-label={`حذف السبب ${i + 1}`}
                      className="flex items-center gap-1 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-lg cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      حذف
                    </button>
                  </div>

                  {r.ground === 'incomplete' && (
                    <div>
                      <label htmlFor={`item-${i}`} className="block text-xs font-bold text-slate-700 mb-1">المتطلب الذي لم يستكمله</label>
                      <select
                        id={`item-${i}`}
                        value={r.item ?? ''}
                        onChange={e => update(i, { item: e.target.value ? Number(e.target.value) : undefined })}
                        className={fieldClass}
                      >
                        <option value="">اختر المتطلب</option>
                        {INCOMPLETE_ITEMS.map((t, n) => <option key={n} value={n + 1}>{n + 1}. {t}</option>)}
                      </select>
                    </div>
                  )}

                  <div>
                    <label htmlFor={`detail-${i}`} className="block text-xs font-bold text-slate-700 mb-1">
                      التفصيل{info?.detailRequired ? ' (إلزامي)' : ' (اختياري)'}
                    </label>
                    <textarea
                      id={`detail-${i}`}
                      value={r.detail ?? ''}
                      onChange={e => update(i, { detail: e.target.value })}
                      placeholder={info?.hint ?? ''}
                      rows={2}
                      className={`${fieldClass} resize-y`}
                    />
                  </div>
                </li>
              );
            })}
          </ol>

          <button
            type="button"
            onClick={() => setReasons(rs => [...rs, { ground: 'technical' }])}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-50 border border-indigo-200 rounded-lg cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            إضافة سبب
          </button>

          {hasTechnical && (
            <fieldset className="bg-white border border-slate-200 rounded-xl p-3 space-y-2">
              <legend className="px-1 text-xs font-bold text-slate-800">مصدر الرأي الفني (للمناقصة كلها)</legend>
              <p className="text-[11px] text-slate-600">استعانة اللجنة بذوي الخبرة وفق المادة (13)/ثانياً</p>
              <div>
                <label htmlFor="opinion-source" className="block text-xs font-bold text-slate-700 mb-1">الفنيون أو الجهة المستعان بها</label>
                <input
                  id="opinion-source"
                  type="text"
                  value={opinion.source ?? ''}
                  onChange={e => setOpinion(o => ({ ...o, source: e.target.value }))}
                  placeholder="مثل: الفنيين من قسم … (الجهة الطالبة)"
                  className={fieldClass}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label htmlFor="opinion-no" className="block text-xs font-bold text-slate-700 mb-1">رقم الكتاب</label>
                  <input
                    id="opinion-no"
                    type="text"
                    value={opinion.letterNo ?? ''}
                    onChange={e => setOpinion(o => ({ ...o, letterNo: e.target.value }))}
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label htmlFor="opinion-date" className="block text-xs font-bold text-slate-700 mb-1">تاريخ الكتاب</label>
                  <input
                    id="opinion-date"
                    type="date"
                    value={opinion.letterDate ?? ''}
                    onChange={e => setOpinion(o => ({ ...o, letterDate: e.target.value || undefined }))}
                    className={fieldClass}
                  />
                </div>
              </div>
            </fieldset>
          )}

          <section aria-labelledby="exclusion-preview-title" className="bg-white border border-slate-200 rounded-xl p-3">
            <h3 id="exclusion-preview-title" className="text-xs font-bold text-slate-800 mb-1">معاينة ما يُطبع في المحضر</h3>
            {preview.length === 0 ? (
              <p className="text-xs text-slate-500">لا أسباب: يُطبع «مستبعد بقرار اللجنة» وحده.</p>
            ) : (
              <>
                <p className="text-xs font-bold">استُبعد عطاء ({bidder.name}) {preview.length > 1 ? 'للأسباب الآتية' : 'للسبب الآتي'}:</p>
                <ol className="list-decimal pr-6 text-xs leading-relaxed space-y-1 mt-1">
                  {preview.map((r, i) => <li key={i}>{reasonLine(r, previewProject)}</li>)}
                </ol>
              </>
            )}
          </section>

          {error && <p role="alert" className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2">{error}</p>}

          <div className="flex justify-end gap-2">
            <button type="button" onClick={requestClose} className="px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200 rounded-lg cursor-pointer">إلغاء</button>
            <button type="submit" className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg cursor-pointer">حفظ</button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

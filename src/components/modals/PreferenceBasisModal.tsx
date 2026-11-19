import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Scale, Plus, Trash2 } from 'lucide-react';
import type { Bidder, PreferenceRecord, TenderProject } from '../../types/tender';
import { preferenceInitiativeTypes, preferenceReference } from '../../utils/contractTypes';
import { parseInitiativeValue, preferenceRecordOf } from '../../utils/preferenceBasis';
import { LEGAL_TEXTS } from '../../utils/legalTexts';

interface Props {
  project: TenderProject;
  /** العطاءات المتساوية أو المتقاربة (rec.closeBids) */
  closeBids: Bidder[];
  /** المتساوية لأصغر فئة نقدية: يجوز تأشير مبادراتها «مستكمَلة بطلب اللجنة» */
  equalBids: Bidder[];
  /** يعيد رسالة خطأ عربية أو null عند الحفظ */
  onSave: (records: PreferenceRecord[]) => string | null;
  onClose: () => void;
  onDirtyChange: (dirty: boolean) => void;
}

interface DraftItem { type: string; description: string; value: string; completedOnRequest: boolean }
interface Draft { answer: 'yes' | 'no' | null; items: DraftItem[] }

const btn = 'text-xs font-black px-3 py-2 rounded-lg border cursor-pointer transition';
const input = 'w-full border border-slate-300 rounded-lg p-2 text-sm bg-white';

const toDraft = (r: PreferenceRecord | undefined): Draft => !r ? { answer: null, items: [] } : {
  answer: r.hasInitiative ? 'yes' : 'no',
  items: r.items.map(i => ({ type: i.type, description: i.description, value: i.value === undefined ? '' : String(i.value), completedOnRequest: !!i.completedOnRequest }))
};

// أساس المفاضلة (ضوابط رقم (5)): هل لكل عطاء متقارب مبادرة؟ نوعها ووصفها وقيمتها. سجل وطباعة، ولا يرتّب النظام بها
export const PreferenceBasisModal: React.FC<Props> = ({ project, closeBids, equalBids, onSave, onClose, onDirtyChange }) => {
  const pref = preferenceReference(project.contractType);
  const types = useMemo(() => preferenceInitiativeTypes(project.contractType), [project.contractType]);
  const initial = useMemo(() => {
    const d: Record<string, Draft> = {};
    for (const b of closeBids) d[b.id] = toDraft(preferenceRecordOf(project, b.id));
    return d;
  }, [closeBids, project]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>(initial);
  const [error, setError] = useState<string | null>(null);
  const initialJson = useMemo(() => JSON.stringify(initial), [initial]);
  const dirty = JSON.stringify(drafts) !== initialJson;
  const dirtyRef = useRef(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const equalIds = new Set(equalBids.map(b => b.id));

  const requestClose = useCallback(() => {
    if (dirtyRef.current && !window.confirm('في النافذة ما لم يُحفظ. أتغلقها دونه؟')) return;
    onClose();
  }, [onClose]);

  useEffect(() => { dirtyRef.current = dirty; onDirtyChange(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') requestClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [requestClose]);
  useEffect(() => {
    const prev = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    return () => { if (prev && prev.isConnected) prev.focus(); };
  }, []);

  // أي تعديل يُسقط رسالة الخطأ السابقة، فلا تبقى أمام اللجنة وهي تصحّح الحقل
  const patch = (id: string, fn: (d: Draft) => Draft) => { setError(null); setDrafts(s => ({ ...s, [id]: fn(s[id]) })); };
  const setItem = (id: string, idx: number, p: Partial<DraftItem>) =>
    patch(id, d => ({ ...d, items: d.items.map((it, i) => i === idx ? { ...it, ...p } : it) }));

  const save = () => {
    const records: PreferenceRecord[] = [];
    for (const b of closeBids) {
      const d = drafts[b.id];
      if (d.answer === null) continue;
      const items: PreferenceRecord['items'] = [];
      if (d.answer === 'yes') {
        for (const [idx, i] of d.items.entries()) {
          const description = i.description.trim();
          const rawValue = i.value.trim();
          // صف بلا وصف ولا قيمة صف فارغ أُضيف خطأً فيُترك؛ ما فيه شيء يُستكمل ولا يُحذف بصمت (مراجعة Codex)
          if (!description && !rawValue) continue;
          if (!description) { setError(`اكتب وصف المبادرة (${idx + 1}) لعطاء (${b.name}) أو احذفها`); return; }
          const value = parseInitiativeValue(rawValue);
          if (value === null) { setError(`القيمة المالية للمبادرة (${idx + 1}) لعطاء (${b.name}) ليست رقماً صحيحاً`); return; }
          items.push({
            type: i.type.trim(), description,
            ...(value !== undefined ? { value } : {}),
            ...(i.completedOnRequest && equalIds.has(b.id) ? { completedOnRequest: true } : {})
          });
        }
      }
      records.push({ bidderId: b.id, hasInitiative: d.answer === 'yes', items });
    }
    const err = onSave(records);
    if (err) { setError(err); return; }
    onDirtyChange(false);
    dirtyRef.current = false;
    onClose();
  };

  const legal = pref.legalKey ? LEGAL_TEXTS[pref.legalKey] : undefined;

  return createPortal(
    <div className="fixed inset-0 z-[60] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 no-print"
      role="dialog" aria-modal="true" aria-labelledby="pref-basis-title">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-500/20 text-indigo-300 rounded-lg"><Scale className="w-5 h-5" /></div>
            <h2 id="pref-basis-title" className="text-base sm:text-lg font-bold">أساس المفاضلة ({pref.clause})</h2>
          </div>
          <button ref={closeRef} type="button" onClick={requestClose} aria-label="إغلاق" className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto space-y-3">
          <p className="text-xs sm:text-sm font-semibold text-slate-700 leading-relaxed">
            المفاضلة قرار اللجنة؛ النظام يثبت أساسها ولا يرتّب بها ({pref.clause}: معايير المفاضلة تُحوَّل لقيمة مالية لأغراض المفاضلة، مثل {pref.examples}).
          </p>
          {legal && (
            <details className="text-xs text-indigo-900">
              <summary className="cursor-pointer font-bold underline">النص الرسمي ({legal.label})</summary>
              <blockquote className="mt-1 rounded-lg border border-indigo-100 bg-white px-3 py-2 leading-relaxed text-slate-700">«{legal.text}» (ص {legal.page})</blockquote>
            </details>
          )}

          {closeBids.map(b => {
            const d = drafts[b.id];
            const equal = equalIds.has(b.id);
            return (
              <fieldset key={b.id} className="border border-slate-200 rounded-xl p-3 bg-slate-50">
                <legend className="font-black text-slate-900 text-sm px-1"><bdi>{b.name}</bdi></legend>
                <div className="flex items-center gap-4 text-sm font-bold text-slate-800" role="radiogroup" aria-label={`هل توجد مبادرة لدى ${b.name}؟`}>
                  <span>هل توجد مبادرة؟</span>
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input type="radio" name={`init-${b.id}`} checked={d.answer === 'yes'}
                      onChange={() => patch(b.id, x => ({ ...x, answer: 'yes', items: x.items.length ? x.items : [{ type: types[0], description: '', value: '', completedOnRequest: false }] }))} />
                    نعم
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input type="radio" name={`init-${b.id}`} checked={d.answer === 'no'}
                      onChange={() => patch(b.id, x => ({ ...x, answer: 'no', items: [] }))} />
                    لا
                  </label>
                </div>

                {d.answer === 'yes' && (
                  <div className="mt-2 space-y-2">
                    {d.items.map((it, idx) => (
                      <div key={idx} className="grid grid-cols-1 sm:grid-cols-[11rem_1fr_9rem_auto] gap-2 items-start bg-white border border-slate-200 rounded-lg p-2">
                        <select aria-label={`نوع المبادرة ${idx + 1} لعطاء ${b.name}`} value={it.type} className={input}
                          onChange={e => setItem(b.id, idx, { type: e.target.value })}>
                          {!types.includes(it.type) && it.type && <option value={it.type}>{it.type}</option>}
                          {types.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <input type="text" aria-label={`وصف المبادرة ${idx + 1} لعطاء ${b.name}`} placeholder="وصف المبادرة" value={it.description} className={input}
                          onChange={e => setItem(b.id, idx, { description: e.target.value })} />
                        <input type="text" inputMode="decimal" aria-label={`القيمة المالية للمبادرة ${idx + 1} لعطاء ${b.name} (اختيارية)`} placeholder="القيمة (اختيارية)" value={it.value} className={input}
                          onChange={e => setItem(b.id, idx, { value: e.target.value })} />
                        <button type="button" aria-label={`حذف المبادرة ${idx + 1} لعطاء ${b.name}`} title="حذف المبادرة"
                          onClick={() => patch(b.id, x => ({ ...x, items: x.items.filter((_, i) => i !== idx) }))}
                          className="justify-self-end w-fit p-2 text-rose-700 hover:bg-rose-50 rounded-lg cursor-pointer"><Trash2 className="w-4 h-4" /></button>
                        {equal && (
                          <label className="sm:col-span-4 flex items-center gap-1.5 text-xs font-bold text-amber-900 cursor-pointer">
                            <input type="checkbox" checked={it.completedOnRequest} onChange={e => setItem(b.id, idx, { completedOnRequest: e.target.checked })} />
                            مستكمَلة بطلب اللجنة بعد فتح العطاءات
                          </label>
                        )}
                      </div>
                    ))}
                    <button type="button" onClick={() => patch(b.id, x => ({ ...x, items: [...x.items, { type: types[0], description: '', value: '', completedOnRequest: false }] }))}
                      className={`${btn} bg-white border-slate-300 text-slate-800 hover:bg-slate-100 inline-flex items-center gap-1`}>
                      <Plus className="w-3.5 h-3.5" /> إضافة مبادرة
                    </button>
                  </div>
                )}
              </fieldset>
            );
          })}
        </div>

        {/* الخطأ في التذييل الثابت بجانب «حفظ»، فيُرى مهما كان موضع التمرير */}
        {error && <div role="alert" className="mx-3 mt-3 rounded-lg border border-rose-300 bg-rose-50 p-2.5 text-xs sm:text-sm font-bold text-rose-900">{error}</div>}
        <div className="p-3 border-t border-slate-200 flex justify-end gap-2">
          <button type="button" onClick={save} className={`${btn} bg-indigo-600 border-indigo-700 text-white hover:bg-indigo-700`}>حفظ</button>
          <button type="button" onClick={requestClose} className={`${btn} bg-slate-100 border-slate-300 text-slate-800 hover:bg-slate-200`}>إلغاء</button>
        </div>
      </div>
    </div>,
    document.body
  );
};

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Users } from 'lucide-react';

interface CommitteeNameModalProps {
  // required: يظهر تلقائياً عند أول فتح بلا اسم محفوظ، فلا إغلاق ولا إلغاء؛ edit: تعديل الاسم الحالي ويُغلق بلا حفظ
  mode: 'required' | 'edit';
  initialName: string;
  onSave: (name: string) => void;
  onClose: () => void;
}

// اسم اللجنة إعداد واحد للنظام كله (لا لكل مناقصة): يُطبع في كشف الموقف وفي محضر التحليل
export const CommitteeNameModal: React.FC<CommitteeNameModalProps> = ({ mode, initialName, onSave, onClose }) => {
  const [name, setName] = useState(initialName);
  const canSave = name.trim() !== '';
  const required = mode === 'required';

  useEffect(() => {
    if (required) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [required, onClose]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (canSave) onSave(name.trim());
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[60] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 no-print"
      role="dialog" aria-modal="true" aria-labelledby="committee-name-title"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden">
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/20 text-amber-400 rounded-lg">
              <Users className="w-5 h-5" />
            </div>
            <h2 id="committee-name-title" className="text-base sm:text-lg font-bold">اسم اللجنة</h2>
          </div>
          {!required && (
            <button type="button" onClick={onClose} aria-label="إغلاق" className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <form onSubmit={submit} className="p-6 space-y-4 bg-slate-50">
          <p id="committee-name-desc" className="text-xs text-slate-600">يُطبع في كشف موقف الطلبيات وفي محضر التحليل، ويبقى محفوظاً في هذا المتصفح لكل المناقصات.</p>
          <div>
            <label htmlFor="committee-name-input" className="block text-xs font-bold text-slate-700 mb-1">اسم اللجنة</label>
            <input
              id="committee-name-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثال: لجنة تحليل وتقييم العطاءات المحلية"
              aria-describedby="committee-name-desc"
              aria-required="true"
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2">
            {!required && (
              <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200 rounded-lg cursor-pointer">إلغاء</button>
            )}
            <button
              type="submit"
              disabled={!canSave}
              className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg cursor-pointer"
            >حفظ</button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

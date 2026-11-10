import React, { useEffect, useRef, useState } from 'react';
import { X, MapPin } from 'lucide-react';
import type { StatusBranch, StatusEntry, StatusStage } from '../../types/tender';
import { branchesOf, BRANCH_LABELS, STAGE_LABELS, STAGE_ORDER, formatSheetDate, statusLine, statusText } from '../../utils/orderStatus';
import { localDate } from '../../utils/localDate';
import type { StatusInput } from '../../app/statusHandlers';

interface OrderStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  statusLog: StatusEntry[];
  // أسماء مقترحة للجهة المحال إليها (مجهزو المناقصة)؛ فارغة لطلبية بلا تحليل
  suggestions?: string[];
  // قسم بيانات يظهر فوق نموذج الموقف (المحرر في كشف الموقف)
  detailsSlot?: React.ReactNode;
  // يخفي نموذج الموقف وسجله (طلبية جديدة لم تُحفظ بياناتها بعد)
  statusHidden?: boolean;
  statusHiddenNote?: string;
  // نافذة تعلو نافذة أخرى مفتوحة (كشف الموقف)
  stacked?: boolean;
  onAdd: (input: StatusInput) => string | null;
  onEdit: (id: string, input: StatusInput) => string | null;
  onDelete: (id: string) => void;
}

const fieldClass = 'w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none';
const labelClass = 'block text-xs font-bold text-slate-700 mb-1';

// نافذة موقف الطلبية: إضافة موقف جديد، وسجل المواقف (الأحدث أولاً) مع تعديل وحذف
export const OrderStatusModal: React.FC<OrderStatusModalProps> = ({
  isOpen, onClose, title = 'موقف الطلبية', subtitle = 'أين الطلبية الآن وبأي مذكرة، والأخير في السجل هو الموقف الحالي',
  statusLog, suggestions = [], detailsSlot, statusHidden, statusHiddenNote, stacked, onAdd, onEdit, onDelete
}) => {
  const [stage, setStage] = useState<StatusStage>('analysis');
  const [branch, setBranch] = useState<StatusBranch | ''>('');
  const [customText, setCustomText] = useState('');
  const [memoNo, setMemoNo] = useState('');
  const [memoDate, setMemoDate] = useState(localDate());
  const [note, setNote] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stageRef = useRef<HTMLSelectElement>(null);

  // Escape يغلق النافذة، كما تُغلق بزر الإغلاق
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const branches = branchesOf(stage);
  // الأحدث إدخالاً أولاً: الأخير في المصفوفة هو الموقف الحالي
  const entries = [...statusLog].reverse();
  const currentId = statusLog.at(-1)?.id;
  const preview = statusText({ stage, branch: branch || undefined, customText });

  const reset = () => {
    setStage('analysis');
    setBranch('');
    setCustomText('');
    setMemoNo('');
    setMemoDate(localDate());
    setNote('');
    setEditingId(null);
    setError(null);
  };

  const handleStageChange = (next: StatusStage) => {
    setStage(next);
    setError(null);
    // التفصيل النصي يبقى عند تبديل الإجراء
    if (branch && !branchesOf(next).includes(branch)) setBranch('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const input: StatusInput = { stage, branch: branch || undefined, customText, memoNo, memoDate, note };
    const result = editingId ? onEdit(editingId, input) : onAdd(input);
    if (result) {
      setError(result);
      return;
    }
    reset();
  };

  const startEdit = (id: string) => {
    const entry = statusLog.find(s => s.id === id);
    if (!entry) return;
    setEditingId(id);
    // مرحلة مجهولة (من نسخة أحدث): يبدأ النموذج بإجراء معروف ويبقى الإدخال قابلاً للحذف
    const known = Object.hasOwn(STAGE_LABELS, entry.stage);
    setStage(known ? entry.stage : 'analysis');
    setBranch(known ? entry.branch ?? '' : '');
    setCustomText(entry.customText ?? '');
    setMemoNo(entry.memoNo ?? '');
    setMemoDate(entry.memoDate ?? '');
    setNote(entry.note ?? '');
    setError(null);
    // النموذج في أعلى النافذة والسجل تحته: يُنقل التركيز إليه ليظهر
    stageRef.current?.focus();
  };

  const handleDelete = (id: string) => {
    if (!window.confirm('حذف هذا الموقف من سجل الطلبية؟')) return;
    onDelete(id);
    if (editingId === id) reset();
  };

  return (
    <div className={`fixed inset-0 ${stacked ? 'z-[60] print:hidden' : 'z-50'} bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4`} role="dialog" aria-modal="true" aria-label={title}>
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">

        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/20 text-amber-400 rounded-lg">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold">{title}</h2>
              <p className="text-xs text-slate-400">{subtitle}</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="إغلاق" className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 bg-slate-50 flex-1 overflow-y-auto">
          {detailsSlot}

          {statusHidden ? (
            <p className="text-xs text-slate-500 bg-white border border-slate-200 rounded-lg px-3 py-4 text-center">{statusHiddenNote}</p>
          ) : (<>
          <form onSubmit={handleSubmit} className="space-y-3">
            <h3 className="text-sm font-black text-slate-800">{editingId ? 'تعديل الموقف' : 'إضافة موقف جديد'}</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className={branches.length === 0 ? 'sm:col-span-2' : undefined}>
                <label htmlFor="status-stage" className={labelClass}>الإجراء</label>
                <select id="status-stage" ref={stageRef} value={stage} onChange={(e) => handleStageChange(e.target.value as StatusStage)} className={fieldClass}>
                  {STAGE_ORDER.map(s => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
                </select>
              </div>

              {branches.length > 0 && (
                <div>
                  <label htmlFor="status-branch" className={labelClass}>الفرع (اختياري)</label>
                  <select id="status-branch" value={branch} onChange={(e) => setBranch(e.target.value as StatusBranch | '')} className={fieldClass}>
                    <option value="">— بلا فرع —</option>
                    {branches.map(b => <option key={b} value={b}>{BRANCH_LABELS[b]}</option>)}
                  </select>
                </div>
              )}

              <div className="sm:col-span-2">
                <label htmlFor="status-custom" className={labelClass}>
                  {stage === 'other' ? <>النص <span className="text-rose-600">*</span></>
                    : stage === 'referred' ? 'الجهة المحال إليها أو تفصيل الإحالة (اختياري)'
                    : 'تفصيل يُلحق بالإجراء (اختياري)'}
                </label>
                <input
                  id="status-custom" type="text" value={customText} onChange={(e) => setCustomText(e.target.value)} className={fieldClass}
                  list={stage === 'referred' ? 'status-referred-suggestions' : undefined}
                  placeholder={stage === 'other' || stage === 'referred' ? undefined : 'مثل: على تقديم الأعمال المماثلة'}
                />
                {stage === 'referred' && (
                  <datalist id="status-referred-suggestions">
                    {suggestions.map(n => <option key={n} value={n} />)}
                  </datalist>
                )}
                {preview && <p className="text-[11px] text-slate-500 mt-1">يُكتب في الكشف: <span className="font-bold text-slate-700 whitespace-pre-line">{preview}</span></p>}
              </div>

              <div>
                <label htmlFor="status-memo-no" className={labelClass}>رقم المذكرة (اختياري)</label>
                <input id="status-memo-no" type="text" value={memoNo} onChange={(e) => setMemoNo(e.target.value)} className={fieldClass} />
              </div>

              <div>
                <label htmlFor="status-memo-date" className={labelClass}>تاريخ المذكرة أو الإجراء (اختياري)</label>
                <input id="status-memo-date" type="date" value={memoDate} onChange={(e) => setMemoDate(e.target.value)} className={fieldClass} />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="status-note" className={labelClass}>ملاحظة (اختيارية)</label>
                <textarea id="status-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} className={`${fieldClass} resize-y`} aria-describedby="status-note-hint" />
                <p id="status-note-hint" className="text-[11px] text-slate-500 mt-1">كل سطر يظهر في سطر مستقل في الكشف</p>
              </div>
            </div>

            {error && <p role="alert" className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</p>}

            <div className="flex items-center justify-end gap-2">
              {editingId && (
                <button type="button" onClick={reset} className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-200 rounded-lg font-medium cursor-pointer">
                  إلغاء التعديل
                </button>
              )}
              <button type="submit" className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-lg shadow-sm cursor-pointer">
                {editingId ? 'حفظ التعديل' : 'إضافة الموقف'}
              </button>
            </div>
          </form>

          <section aria-labelledby="status-log-title">
            <h3 id="status-log-title" className="text-sm font-black text-slate-800 mb-2">سجل المواقف</h3>
            {entries.length === 0 ? (
              <p className="text-xs text-slate-500 bg-white border border-slate-200 rounded-lg px-3 py-4 text-center">لم يُسجَّل موقف لهذه الطلبية بعد</p>
            ) : (
              <ul className="space-y-2">
                {entries.map(entry => (
                  <li key={entry.id} className="bg-white border border-slate-200 rounded-xl px-3 py-2.5 flex items-start justify-between gap-3">
                    <div className="text-xs space-y-0.5 min-w-0 flex-1">
                      {(() => {
                        // شارة «الحالي» تلازم سطر الإجراء الأول، والتفصيل (إن وُجد) في السطر التالي
                        const [head, ...rest] = (statusText(entry) || 'غير محدد').split('\n');
                        return (
                          <div className="font-black text-slate-900">
                            {head}
                            {entry.id === currentId && <span className="mr-2 text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-full px-2 py-0.5">الحالي</span>}
                            {rest.length > 0 && <div className="whitespace-pre-line">{rest.join('\n')}</div>}
                          </div>
                        );
                      })()}
                      <div className="text-slate-600">
                        {entry.memoNo ? <>مذكرة رقم <bdi>{entry.memoNo}</bdi>{entry.memoDate ? ' — ' : ''}</> : ''}{entry.memoDate ? <bdi>{formatSheetDate(entry.memoDate)}</bdi> : (!entry.memoNo && 'بلا تاريخ')}
                      </div>
                      {entry.note && <div className="text-slate-500 break-words whitespace-pre-line">{entry.note}</div>}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button type="button" onClick={() => startEdit(entry.id)} aria-label={`تعديل موقف: ${[statusLine(entry) || 'غير محدد', formatSheetDate(entry.memoDate)].filter(Boolean).join(' ')}`} className="px-2.5 py-1 text-xs font-bold text-indigo-700 hover:bg-indigo-50 rounded-lg cursor-pointer">تعديل</button>
                      <button type="button" onClick={() => handleDelete(entry.id)} aria-label={`حذف موقف: ${[statusLine(entry) || 'غير محدد', formatSheetDate(entry.memoDate)].filter(Boolean).join(' ')}`} className="px-2.5 py-1 text-xs font-bold text-rose-700 hover:bg-rose-50 rounded-lg cursor-pointer">حذف</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
          </>)}
        </div>
      </div>
    </div>
  );
};

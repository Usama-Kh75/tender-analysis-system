import React, { useEffect, useRef, useState } from 'react';
import { Printer } from 'lucide-react';
import type { StatusBranch, StatusStage, TenderProject } from '../types/tender';
import { branchesOf, BRANCH_LABELS, STAGE_LABELS, STAGE_ORDER, formatSheetDate, statusLine, statusText } from '../utils/orderStatus';
import { localDate } from '../utils/localDate';
import { analysisPath } from '../utils/analysisPath';
import type { StatusInput } from '../app/statusHandlers';
import { chosenWinnerName, WINNER_DETAIL_STAGES, type StatusFormPreset } from '../utils/statusPreset';

interface OrderStatusPanelProps {
  project: TenderProject;
  onAdd: (input: StatusInput) => string | null;
  onEdit: (id: string, input: StatusInput) => string | null;
  onDelete: (id: string) => void;
  onOpenSheet: () => void;
  // نموذج فيه إدخال لم يُحفظ: يمنع «حفظ والتحديث» (blockingWork في App)
  onDirtyChange: (dirty: boolean) => void;
  // قيم ابتدائية للنموذج (بعد اختيار الترسية)؛ لا يُحفظ شيء قبل «إضافة الموقف»
  preset?: StatusFormPreset;
}

const fieldClass = 'w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none';
const labelClass = 'block text-xs font-bold text-slate-700 mb-1';

// تبويب موقف الطلبية: إضافة موقف جديد، وسجل المواقف (الأحدث أولاً) مع تعديل وحذف.
// يُنشأ بـkey=معرّف المناقصة فيبدأ نموذجه فارغاً لكل مناقصة
export const OrderStatusPanel: React.FC<OrderStatusPanelProps> = ({ project, onAdd, onEdit, onDelete, onOpenSheet, onDirtyChange, preset }) => {
  // القيم التي يقارَن بها «لم يُحفظ»: المسبقة إن وُجدت، وبعد إضافة ناجحة الفارغة
  const [base, setBase] = useState(() => ({
    stage: (preset?.stage ?? 'analysis') as StatusStage,
    customText: preset?.customText ?? '',
    memoDate: preset?.memoDate ?? localDate()
  }));
  const [stage, setStage] = useState<StatusStage>(base.stage);
  const [branch, setBranch] = useState<StatusBranch | ''>('');
  const [customText, setCustomText] = useState(base.customText);
  const [memoNo, setMemoNo] = useState('');
  const [memoDate, setMemoDate] = useState(base.memoDate);
  const [note, setNote] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stageRef = useRef<HTMLSelectElement>(null);

  // النموذج «متسخ» إن اختلف حقل عن قيمته الابتدائية أو كان تعديلاً جارياً
  const dirty = editingId !== null || stage !== base.stage || branch !== '' || customText !== base.customText || memoNo !== '' || memoDate !== base.memoDate || note !== '';
  useEffect(() => {
    onDirtyChange(dirty);
    return () => onDirtyChange(false);
  }, [dirty, onDirtyChange]);

  const branches = branchesOf(stage);
  // الأحدث إدخالاً أولاً: الأخير في المصفوفة هو الموقف الحالي
  const entries = [...(project.statusLog ?? [])].reverse();
  const currentId = project.statusLog?.at(-1)?.id;
  const preview = statusText({ stage, branch: branch || undefined, customText });
  // أسماء مقترحة للجهة المحال إليها: مجهزو المناقصة
  const suggestions = project.bidders.map(b => b.name).filter(Boolean);

  const reset = () => {
    setBase({ stage: 'analysis', customText: '', memoDate: localDate() });
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
    if (branch && !branchesOf(next).includes(branch)) setBranch('');
    // اسم الفائز يملأ التفصيل الفارغ فقط، ولا يستبدل ما كتبه المستخدم
    if ((WINNER_DETAIL_STAGES as readonly string[]).includes(next) && !customText.trim()) {
      const winner = chosenWinnerName(project);
      if (winner) setCustomText(winner);
    }
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
    const entry = project.statusLog?.find(s => s.id === id);
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
    <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden" aria-label="موقف الطلبية">
      <div className="p-4 border-b border-slate-200 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-base sm:text-lg font-black text-slate-900">موقف الطلبية</h2>
          <p className="text-xs text-slate-500">أين الطلبية الآن وبأي مذكرة، والأخير في السجل هو الموقف الحالي</p>
        </div>
        <button type="button" onClick={onOpenSheet} className="flex items-center gap-1.5 bg-white hover:bg-slate-100 text-slate-800 text-xs font-black px-3.5 py-2 rounded-xl border border-slate-300 cursor-pointer">
          <Printer className="w-4 h-4" />
          <span>كشف الموقف</span>
        </button>
      </div>
      <div>
        <div className="p-6 space-y-5">
          {/* مسار التحليل: مشتق من حالة المناقصة وسجل تدقيقها، لا يُخزَّن ولا يغيّر سجل المواقف أدناه */}
          <section aria-labelledby="analysis-path-title">
            <h3 id="analysis-path-title" className="text-sm font-black text-slate-800">مسار التحليل</h3>
            <p className="text-xs text-slate-500 mb-3">ما أُنجز وما بقي ومن ينفّذه، يتحدّث وحده من بيانات المناقصة</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {analysisPath(project).map(stage => (
                <div key={stage.title} className="rounded-xl border border-slate-200 p-3">
                  <div className="text-xs font-black text-slate-900 mb-2">{stage.title}</div>
                  <ol className="space-y-1.5">
                    {stage.steps.map(step => (
                      <li key={step.text} className={`flex items-start gap-2 text-xs ${step.state === 'pending' ? 'text-slate-400' : 'text-slate-800'}`}>
                        <span aria-hidden="true" className={`mt-0.5 shrink-0 font-black ${step.state === 'done' ? 'text-emerald-600' : step.state === 'current' ? 'text-amber-600' : 'text-slate-300'}`}>
                          {step.state === 'done' ? '✓' : step.state === 'current' ? '◐' : '○'}
                        </span>
                        <span className="min-w-0 grow">
                          <span className={step.state === 'current' ? 'font-black' : 'font-semibold'}>{step.text}</span>
                          <span className="block text-[11px] text-slate-500">
                            {step.actor}
                            {step.state === 'done' ? ' — تم' : step.state === 'current' ? ' — الخطوة الحالية' : ' — لم يحن بعد'}
                            {step.date && <> — <bdi>{formatSheetDate(step.date)}</bdi></>}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          </section>

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
                  placeholder={stage === 'other' || stage === 'referred' ? undefined : 'مثل: على تقديم الأعمال المماثلة أو المبادرات'}
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
                            {entry.id === currentId && <span className="mr-2 text-[10px] bg-blue-50 text-blue-800 border border-blue-300 rounded-full px-2 py-0.5">الموقف الحالي</span>}
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
        </div>
      </div>
    </div>
  );
};

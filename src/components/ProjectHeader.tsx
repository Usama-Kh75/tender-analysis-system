import React, { useEffect, useState } from 'react';
import { Settings, Pencil } from 'lucide-react';
import type { MainTab } from '../resume';
import { TenderProject } from '../types/tender';
import { contractTypeInfo } from '../utils/contractTypes';
import { budgetTypeInfo } from '../utils/budgetTypes';
import { announcementLabel, bidCountsLabel, tenderDetailParts } from '../utils/tenderDetails';
import { statusBadgeText } from '../utils/orderStatus';
import { statusLag } from '../utils/statusLag';
import { stageStates, type NextStepAction, type StageState } from '../utils/tenderPath';
import { itemsWithErrorsText } from '../utils/arabicCount';
import { validityAlert, validityMissing } from '../utils/bidValidity';
import { localDate } from '../utils/localDate';
import { LEGAL_TEXTS } from '../utils/legalTexts';
import { NextStepBar } from './NextStepBar';
import { StageGuidance } from './StageGuidance';

// ثلاثة تبويبات لمراحل المناقصة الواحدة: لكل واحد سؤال واحد يظهر تحت اسمه
const TABS: { id: MainTab; label: string; question: string }[] = [
  { id: 'bids', label: 'العطاءات والتدقيق', question: 'ماذا قدّم كل مجهز؟' },
  { id: 'study', label: 'الدراسة والتوصية', question: 'من الأفضل، وبماذا توصي اللجنة؟' },
  { id: 'report', label: 'المحضر', question: 'ماذا يُثبت المحضر ويُطبع؟' }
];

// بطاقات المراحل (النموذج ب، اختيار أسامة 2026-11-18): الشريط العلوي والشارة لحال المرحلة،
// والإطار الأزرق للتبويب المفتوح، فلا يختلط الأمران. الأزرق لا يُستعمل لحال المرحلة
const STAGE_LOOK: Record<StageState, { bar: string; pill: string; mark: string; text: string }> = {
  done: { bar: 'bg-emerald-600', pill: 'bg-emerald-100 text-emerald-800', mark: '✓', text: 'مكتملة' },
  current: { bar: 'bg-amber-500', pill: 'bg-amber-100 text-amber-800', mark: '●', text: 'قيد العمل' },
  upcoming: { bar: 'bg-slate-300', pill: 'bg-slate-100 text-slate-600', mark: '○', text: 'لم تبدأ' }
};

interface ProjectHeaderProps {
  activeTab: MainTab;
  onSelectTab: (t: MainTab) => void;
  /** فقرات فيها أخطاء: شارة على تبويب العطاءات والتدقيق تختفي عند الصفر */
  pendingAudit: number;
  project: TenderProject;
  onOpenSettings: () => void;
  /** زر الموقف يفتح سجله في نافذة */
  onOpenStatus: () => void;
  onGo: (a: NextStepAction) => void;
  /** المجهز المعروض في الجدول، يمرَّر إلى شريط «الخطوة التالية» */
  activeBidderId?: string;
  /** تعديل العنوان من الرأس مباشرة */
  onRenameTitle: (title: string) => void;
  /** النص المكتوب في حقل العنوان لم يُحفظ بعد (يمنع التحديث) */
  onTitleDirtyChange: (dirty: boolean) => void;
}

// عنوان المناقصة مع تعديل مباشر: حفظ/إلغاء صريحان، Enter يحفظ وEscape يلغي. يُرسم بمفتاح معرّف المناقصة فيبدأ نظيفاً عند تبديلها
const TitleEditor: React.FC<{ title: string; onRename: (t: string) => void; onDirtyChange: (d: boolean) => void }> = ({ title, onRename, onDirtyChange }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const dirty = editing && draft !== title;
  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);

  const save = () => {
    const next = draft.trim();
    if (!next) { setError('عنوان المناقصة لا يكون فارغاً'); return; }
    if (next !== title) onRename(next);
    setEditing(false);
    setError('');
  };
  const cancel = () => { setEditing(false); setError(''); };

  if (!editing) {
    return (
      <div className="flex items-center gap-2">
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">{title}</h1>
        <button
          type="button"
          onClick={() => { setDraft(title); setError(''); setEditing(true); }}
          className="no-print print:hidden shrink-0 p-1.5 text-slate-500 hover:text-blue-700 hover:bg-slate-100 rounded-lg transition cursor-pointer"
          title="تعديل عنوان المناقصة"
          aria-label="تعديل عنوان المناقصة"
        >
          <Pencil className="w-4 h-4" />
        </button>
      </div>
    );
  }
  return (
    <div className="no-print print:hidden" onKeyDown={(e) => { if (e.key === 'Escape') cancel(); }}>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => { setDraft(e.target.value); setError(''); }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); save(); } }}
          className="flex-1 min-w-0 bg-white border border-blue-400 rounded-lg px-2 py-1 text-base sm:text-lg font-black text-slate-900 focus:outline-none ring-2 ring-blue-500/20"
          aria-label="عنوان المناقصة"
          aria-invalid={error ? true : undefined}
          autoFocus
        />
        <button type="button" onClick={save} className="shrink-0 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-2.5 py-1.5 rounded-lg cursor-pointer">حفظ</button>
        <button type="button" onClick={cancel} className="shrink-0 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-bold px-2.5 py-1.5 rounded-lg cursor-pointer">إلغاء</button>
      </div>
      {error && <p role="alert" className="mt-1 text-xs font-bold text-red-700">{error}</p>}
    </div>
  );
};

// بطاقة رأس المناقصة: رقم الطلبية وبياناتها للقراءة فقط (التعديل من الإعدادات)، والعنوان يُعدَّل من الرأس مباشرة، والخطوة التالية
export const ProjectHeader: React.FC<ProjectHeaderProps> = ({
  project: currentProject, onOpenSettings, onOpenStatus, onGo,
  activeTab, onSelectTab, pendingAudit, activeBidderId, onRenameTitle, onTitleDirtyChange
}) => {
  const states = stageStates(currentProject);
  const lag = statusLag(currentProject);
  const validity = validityAlert(currentProject, localDate());
  const missing = validity ? 0 : validityMissing(currentProject);
  const [legalOpen, setLegalOpen] = useState(false);
  return (
    <div className="bg-white rounded-3xl p-4 sm:p-6 border border-slate-200 shadow-xs mb-6">
      
      {/* Top Meta Bar */}
      <div className="flex items-center justify-between gap-4 mb-3 pb-3 border-b border-slate-100 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="bg-amber-100 text-amber-900 border border-amber-300 text-xs font-black px-3 py-1 rounded-full font-mono shadow-2xs">
            {currentProject.referenceNumber || "رقم الطلبية: غير محدد"}
          </span>
          {/* يميّز إعلانات الطلبية الواحدة */}
          {announcementLabel(currentProject.announcementNo) ? (
            <span className="bg-amber-50 text-amber-900 text-xs font-bold px-3.5 py-1 rounded-full border border-amber-200">
              {announcementLabel(currentProject.announcementNo)}
            </span>
          ) : (
            <span className="bg-slate-50 text-slate-500 text-xs font-bold px-3.5 py-1 rounded-full border border-slate-200">
              الإعلان: غير محدد
            </span>
          )}
          {currentProject.entityName && (
            <span className="bg-slate-100 text-slate-800 text-xs font-bold px-3.5 py-1 rounded-full border border-slate-200">
              {currentProject.entityName}
            </span>
          )}
          {contractTypeInfo(currentProject.contractType) ? (
            <span className="bg-indigo-50 text-indigo-900 text-xs font-bold px-3.5 py-1 rounded-full border border-indigo-200">
              نوع العقد: {contractTypeInfo(currentProject.contractType)!.label}
            </span>
          ) : (
            <span
              title="نوع العقد يحدد معايير المفاضلة في التوصية (ضوابط رقم 5)"
              className="bg-amber-50 text-amber-800 text-xs font-bold px-3.5 py-1 rounded-full border border-amber-200"
            >
              ⚠️ نوع العقد: غير محدد
            </span>
          )}
          {budgetTypeInfo(currentProject.budgetType) ? (
            <span className="bg-teal-50 text-teal-900 text-xs font-bold px-3.5 py-1 rounded-full border border-teal-200">
              نوع الموازنة: {budgetTypeInfo(currentProject.budgetType)!.label}
            </span>
          ) : (
            <span
              title="نوع الموازنة يحدد صلاحية قبول العطاء الزائد على الكلفة التخمينية (ضوابط رقم 2 رابعاً)"
              className="bg-slate-50 text-slate-500 text-xs font-bold px-3.5 py-1 rounded-full border border-slate-200"
            >
              نوع الموازنة: غير محدد
            </span>
          )}
          {/* أسلوب الدعوة والجهة المستفيدة: ما أُدخل فقط، وصياغته من tenderDetailParts (الإعلان والأعداد لها مكانها) */}
          {tenderDetailParts(currentProject, { withCounts: false, withAnnouncement: false }).map(part => (
            <span key={part} className="bg-slate-50 text-slate-800 text-xs font-bold px-3.5 py-1 rounded-full border border-slate-200">{part}</span>
          ))}
          {bidCountsLabel(currentProject) && (
            <span className="bg-slate-50 text-slate-800 text-xs font-bold px-3.5 py-1 rounded-full border border-slate-200">{bidCountsLabel(currentProject)}</span>
          )}
          {/* زر الموقف: آخر مدخل في statusLog (الأخير في المصفوفة لا الأحدث تاريخاً)، يظهر دائماً ويفتح السجل في نافذة */}
          <button
            type="button"
            aria-haspopup="dialog"
            onClick={onOpenStatus}
            title={lag ? lag.text : 'سجل موقف الطلبية'}
            className={lag
              ? 'bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-bold px-3.5 py-1 rounded-full border border-amber-300 cursor-pointer transition'
              : 'bg-blue-50 hover:bg-blue-100 text-blue-900 text-xs font-bold px-3.5 py-1 rounded-full border border-blue-200 cursor-pointer transition'}
          >
            {lag && <span aria-hidden="true">⚠ </span>}
            {statusBadgeText(currentProject.statusLog)}
            {lag && <span className="sr-only"> — {lag.text}</span>}
          </button>
          <button
            onClick={onOpenSettings}
            title="تعديل بيانات المناقصة"
            className="flex items-center gap-1.5 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold px-3.5 py-1 rounded-full border border-slate-300 cursor-pointer transition"
          >
            <Settings className="w-3.5 h-3.5" />
            إعدادات المناقصة
          </button>
        </div>

        <div className="text-xs text-slate-500 font-semibold">
          تاريخ آخر تحديث: {new Date(currentProject.updatedAt).toLocaleDateString('ar-EG')}
        </div>
      </div>

      {/* نفاذية العطاءات: تنبيه عرض فقط، لا يُطبع ولا يدخل المحضر */}
      {validity && (
        <div
          role="status"
          className={`no-print print:hidden mb-3 rounded-xl border px-3 py-2 text-xs font-bold ${validity.level === 'warn' ? 'bg-amber-50 border-amber-300 text-amber-900' : 'bg-rose-50 border-rose-300 text-rose-900'}`}
        >
          <span aria-hidden="true">⏳ </span>{validity.text}{' '}
          <button
            type="button"
            aria-expanded={legalOpen}
            aria-controls="validity-legal-texts"
            onClick={() => setLegalOpen(o => !o)}
            className="underline cursor-pointer rounded whitespace-nowrap"
          >
            {legalOpen ? 'إخفاء النص' : 'النص الرسمي'}
          </button>
          <div id="validity-legal-texts" hidden={!legalOpen} className="mt-1.5 space-y-1 font-normal text-slate-700">
            {validity.legalKeys.map(k => (
              <blockquote key={k} className="rounded-lg border border-slate-200 bg-white px-3 py-2 leading-relaxed">
                <span className="font-bold">{LEGAL_TEXTS[k].label}: </span>«{LEGAL_TEXTS[k].text}» (ص {LEGAL_TEXTS[k].page})
              </blockquote>
            ))}
          </div>
        </div>
      )}
      {!validity && missing > 0 && (
        <p className="no-print print:hidden mb-3 text-[11px] text-slate-500">لم تُدخل نفاذية {missing === 1 ? 'عطاء واحد' : `${missing} عطاءات`} (زر «نفاذية العطاء» في تبويب العطاءات)</p>
      )}

      {/* Middle Row: Project Title (Editable) */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
        <div className="flex-1 min-w-0 sm:min-w-[280px]">
          <TitleEditor key={currentProject.id} title={currentProject.title} onRename={onRenameTitle} onDirtyChange={onTitleDirtyChange} />
        </div>
      </div>

      {/* تبويبات المراحل: بطاقات تحت العنوان مباشرة، وحال كل مرحلة مستنتجة (stageStates) */}
      <div
        role="tablist"
        aria-label="مراحل المناقصة"
        className="mt-4 grid grid-cols-3 gap-2.5"
        onKeyDown={(e) => {
          // اتجاه RTL: السهم الأيسر = التالي بصرياً
          const i = TABS.findIndex(t => t.id === activeTab);
          let n = -1;
          if (e.key === 'ArrowLeft') n = (i + 1) % TABS.length;
          else if (e.key === 'ArrowRight') n = (i - 1 + TABS.length) % TABS.length;
          else if (e.key === 'Home') n = 0;
          else if (e.key === 'End') n = TABS.length - 1;
          if (n < 0) return;
          e.preventDefault();
          onSelectTab(TABS[n].id);
          e.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]')[n]?.focus();
        }}
      >
        {TABS.map(({ id, label, question }) => {
          const on = activeTab === id;
          const look = STAGE_LOOK[states[id]];
          return (
            <button
              key={id}
              type="button"
              role="tab"
              id={`tab-${id}`}
              aria-controls={`tabpanel-${id}`}
              aria-selected={on}
              tabIndex={on ? 0 : -1}
              onClick={() => onSelectTab(id)}
              className={`@container relative overflow-hidden rounded-xl px-3.5 pt-3.5 pb-2.5 min-h-[76px] min-w-0 text-start transition cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 ${
                on ? 'bg-white border border-transparent ring-2 ring-blue-600 shadow-md' : 'bg-slate-50 border border-slate-200 hover:bg-white hover:border-slate-300'
              }`}
            >
              <span aria-hidden="true" className={`absolute inset-x-0 top-0 h-1 ${look.bar}`} />
              <span className="flex items-center gap-2 min-w-0">
                <span className={`text-sm font-black leading-tight min-w-0 ${on ? 'text-slate-950' : 'text-slate-800'}`}>{label}</span>
                {id === 'bids' && pendingAudit > 0 && (
                  <span aria-hidden="true" title={itemsWithErrorsText(pendingAudit)} className="shrink-0 bg-amber-500 text-slate-950 text-[10px] font-black rounded-full min-w-[1.25rem] px-1.5 py-0.5 text-center">
                    {pendingAudit}
                  </span>
                )}
                {/* نص الشارة يختفي حسب عرض البطاقة نفسها لا عرض الشاشة، وتبقى العلامة */}
                <span aria-hidden="true" className={`ms-auto shrink-0 inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${look.pill}`}>
                  {look.mark}<span className="hidden @min-[15rem]:inline">{look.text}</span>
                </span>
              </span>
              <span className="block mt-0.5 text-[11px] font-medium text-slate-600 truncate">{question}</span>
              <span className="sr-only">، {look.text}{id === 'bids' && pendingAudit > 0 ? `، ${itemsWithErrorsText(pendingAudit)}` : ''}</span>
            </button>
          );
        })}
      </div>

      {/* التعليمات أولاً تمهّد للخطوة التالية تحتها */}
      <StageGuidance project={currentProject} activeTab={activeTab} />
      <NextStepBar project={currentProject} onGo={onGo} activeTab={activeTab} activeBidderId={activeBidderId} />

    </div>
  );
};

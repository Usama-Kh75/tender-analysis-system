import React, { useState } from 'react';
import { Pencil, Settings, Table2, Award, MapPin } from 'lucide-react';
import type { MainTab } from '../resume';
import { TenderProject } from '../types/tender';
import { contractTypeInfo } from '../utils/contractTypes';
import { budgetTypeInfo } from '../utils/budgetTypes';
import { formatOrderNumber } from '../utils/orderNumber';
import { announcementLabel, tenderDetailParts } from '../utils/tenderDetails';
import { statusLine } from '../utils/orderStatus';
import type { NextStepAction } from '../utils/tenderPath';
import { NextStepBar } from './NextStepBar';

// ثلاثة تبويبات لمراحل المناقصة الواحدة: لكل واحد سؤال واحد يظهر تحت اسمه
const TABS: { id: MainTab; label: string; question: string; Icon: React.ElementType }[] = [
  { id: 'bids', label: 'العطاءات والتدقيق', question: 'ماذا قدّم كل مجهز؟', Icon: Table2 },
  { id: 'analysis', label: 'التحليل والتوصية', question: 'من الأفضل ولماذا؟', Icon: Award },
  { id: 'status', label: 'الموقف', question: 'أين وصلت الطلبية؟', Icon: MapPin }
];

interface ProjectHeaderProps {
  activeTab: MainTab;
  onSelectTab: (t: MainTab) => void;
  /** فقرات بانتظار قرار اللجنة: شارة على تبويب العطاءات والتدقيق تختفي عند الصفر */
  pendingAudit: number;
  project: TenderProject;
  onChangeProjectField: (field: 'title' | 'referenceNumber', value: string) => void;
  onOpenSettings: () => void;
  /** الخطوة التالية تُعرض في تبويبي العطاءات والتحليل فقط */
  showNextStep: boolean;
  onGo: (a: NextStepAction) => void;
}

// بطاقة رأس المناقصة: رقم الطلبية والعنوان القابلان للتعديل، والخطوة التالية
export const ProjectHeader: React.FC<ProjectHeaderProps> = ({
  project: currentProject, onChangeProjectField, onOpenSettings, showNextStep, onGo,
  activeTab, onSelectTab, pendingAudit
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState<boolean>(false);
  const [isEditingRefNumber, setIsEditingRefNumber] = useState<boolean>(false);
  // التوحيد عند الحفظ لا مع كل ضغطة مفتاح كي لا يتشوش الكتابة
  const commitRefNumber = () => {
    const formatted = formatOrderNumber(currentProject.referenceNumber);
    if (formatted !== currentProject.referenceNumber) onChangeProjectField('referenceNumber', formatted);
    setIsEditingRefNumber(false);
  };

  const lastStatus = currentProject.statusLog?.[currentProject.statusLog.length - 1];

  return (
    <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs mb-6">
      
      {/* Top Meta Bar */}
      <div className="flex items-center justify-between gap-4 mb-3 pb-3 border-b border-slate-100 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {!isEditingRefNumber ? (
            <span
              onClick={() => setIsEditingRefNumber(true)}
              title="انقر لتعديل رقم الطلبية أو المناقصة"
              className="group bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 text-xs font-black px-3 py-1 rounded-full font-mono shadow-2xs cursor-pointer flex items-center gap-1.5 transition"
            >
              {currentProject.referenceNumber || 'أدخل رقم الطلبية/المناقصة'}
              <Pencil className="w-3 h-3 text-amber-700 opacity-0 group-hover:opacity-100 transition" />
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              <input
                type="text"
                value={currentProject.referenceNumber}
                onChange={(e) => {
                  const val = e.target.value;
                  onChangeProjectField('referenceNumber', val);
                }}
                onKeyDown={(e) => e.key === 'Enter' && commitRefNumber()}
                className="bg-white border border-amber-400 text-amber-900 text-xs font-black font-mono px-3 py-1 rounded-full focus:outline-none ring-2 ring-amber-500/20 w-40"
                autoFocus
              />
              <button
                onClick={commitRefNumber}
                className="bg-amber-600 text-white text-xs font-bold px-2.5 py-1 rounded-full shrink-0 cursor-pointer"
              >
                حفظ
              </button>
            </span>
          )}
          {/* يميّز إعلانات الطلبية الواحدة؛ غير المحدد زر يفتح الإعدادات */}
          <button
            onClick={onOpenSettings}
            title="تعديل الإعلان من إعدادات المناقصة"
            className="bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-bold px-3.5 py-1 rounded-full border border-amber-200 cursor-pointer transition"
          >
            {announcementLabel(currentProject.announcementNo) ?? 'حدد الإعلان'}
          </button>
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
            <button
              onClick={onOpenSettings}
              title="نوع العقد يحدد معايير المفاضلة في التوصية (ضوابط رقم 5)"
              className="bg-rose-50 hover:bg-rose-100 text-rose-800 text-xs font-bold px-3.5 py-1 rounded-full border border-rose-300 cursor-pointer transition"
            >
              ⚠️ حدد نوع العقد
            </button>
          )}
          {budgetTypeInfo(currentProject.budgetType) ? (
            <span className="bg-teal-50 text-teal-900 text-xs font-bold px-3.5 py-1 rounded-full border border-teal-200">
              نوع الموازنة: {budgetTypeInfo(currentProject.budgetType)!.label}
            </span>
          ) : (
            <button
              onClick={onOpenSettings}
              title="نوع الموازنة يحدد صلاحية قبول العطاء الزائد على الكلفة التخمينية (ضوابط رقم 2 رابعاً)"
              className="bg-rose-50 hover:bg-rose-100 text-rose-800 text-xs font-bold px-3.5 py-1 rounded-full border border-rose-300 cursor-pointer transition"
            >
              ⚠️ حدد نوع الموازنة
            </button>
          )}
          {/* أسلوب الدعوة والجهة المستفيدة: ما أُدخل فقط، وصياغته من tenderDetailParts (الإعلان والأعداد لها مكانها) */}
          {tenderDetailParts(currentProject, { withCounts: false, withAnnouncement: false }).map(part => (
            <span key={part} className="bg-slate-50 text-slate-800 text-xs font-bold px-3.5 py-1 rounded-full border border-slate-200">{part}</span>
          ))}
          {/* شارة الموقف: آخر مدخل في statusLog (الأخير في المصفوفة لا الأحدث تاريخاً)، وتختفي إن لم يوجد */}
          {lastStatus && (
            <span className="bg-blue-50 text-blue-900 text-xs font-bold px-3.5 py-1 rounded-full border border-blue-200">
              الموقف: {statusLine(lastStatus) || 'غير محدد'}
            </span>
          )}
          <button
            onClick={onOpenSettings}
            title="إعدادات المناقصة والنسب"
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

      {/* Middle Row: Project Title (Editable) */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
        <div className="flex-1 min-w-[280px]">
          <div className="flex items-center gap-2 group">
            {!isEditingTitle ? (
              <h1 
                onClick={() => setIsEditingTitle(true)}
                className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight cursor-pointer hover:text-blue-700 transition flex items-center gap-2"
                title="انقر لتعديل اسم المناقصة والمشروع فوراً"
              >
                {currentProject.title}
                <Pencil className="w-4 h-4 text-slate-400 opacity-0 group-hover:opacity-100 transition" />
              </h1>
            ) : (
              <div className="flex items-center gap-2 w-full max-w-xl">
                <input
                  type="text"
                  value={currentProject.title}
                  onChange={(e) => {
                    const val = e.target.value;
                    onChangeProjectField('title', val);
                  }}
                  className="w-full text-lg font-bold border border-blue-500 rounded-xl px-3 py-1 bg-white focus:outline-none ring-2 ring-blue-500/20"
                  autoFocus
                />
                <button
                  onClick={() => setIsEditingTitle(false)}
                  className="bg-blue-600 text-white text-xs font-bold px-3 py-1.5 rounded-xl shrink-0 cursor-pointer"
                >
                  حفظ
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* تبويبات المراحل: تحت العنوان مباشرة، والمفتوح بخط سفلي */}
      <div
        role="tablist"
        aria-label="مراحل المناقصة"
        className="mt-4 flex items-stretch gap-1 overflow-x-auto overflow-y-hidden border-b border-slate-200"
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
        {TABS.map(({ id, label, question, Icon }) => {
          const on = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={on}
              tabIndex={on ? 0 : -1}
              onClick={() => onSelectTab(id)}
              className={`flex items-center gap-2 px-4 py-2 whitespace-nowrap border-b-4 transition cursor-pointer ${
                on ? 'border-blue-600 text-blue-800' : 'border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="flex flex-col items-start leading-tight">
                <span className="text-sm font-black">{label}</span>
                <span className="text-[11px] font-medium text-slate-500">{question}</span>
              </span>
              {id === 'bids' && pendingAudit > 0 && (
                <span aria-hidden="true" title={`${pendingAudit} فقرة بانتظار قرار اللجنة`} className="bg-amber-500 text-slate-950 text-[10px] font-black rounded-full min-w-[1.25rem] px-1.5 py-0.5 text-center">
                  {pendingAudit}
                </span>
              )}
              {id === 'bids' && pendingAudit > 0 && <span className="sr-only">{pendingAudit} فقرة بانتظار قرار</span>}
            </button>
          );
        })}
      </div>

      {showNextStep && <NextStepBar project={currentProject} onGo={onGo} />}

    </div>
  );
};

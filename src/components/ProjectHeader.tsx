import React, { useState } from 'react';
import { Pencil, Settings } from 'lucide-react';
import { TenderProject } from '../types/tender';
import { contractTypeInfo } from '../utils/contractTypes';
import { budgetTypeInfo } from '../utils/budgetTypes';
import { announcementLabel } from '../utils/tenderDetails';
import { tenderPath } from '../utils/tenderPath';
import { TenderPathLine, type PathTarget } from './TenderPathLine';

interface ProjectHeaderProps {
  project: TenderProject;
  onChangeProjectField: (field: 'title' | 'referenceNumber', value: string) => void;
  onOpenSettings: () => void;
  onGo: (t: PathTarget) => void;
}

// بطاقة رأس المناقصة: رقم الطلبية والعنوان القابلان للتعديل، وسطر الموقف والمسار
export const ProjectHeader: React.FC<ProjectHeaderProps> = ({
  project: currentProject, onChangeProjectField, onOpenSettings, onGo
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState<boolean>(false);
  const [isEditingRefNumber, setIsEditingRefNumber] = useState<boolean>(false);

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
                onKeyDown={(e) => e.key === 'Enter' && setIsEditingRefNumber(false)}
                className="bg-white border border-amber-400 text-amber-900 text-xs font-black font-mono px-3 py-1 rounded-full focus:outline-none ring-2 ring-amber-500/20 w-40"
                autoFocus
              />
              <button
                onClick={() => setIsEditingRefNumber(false)}
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

      <TenderPathLine path={tenderPath(currentProject)} onGo={onGo} />

    </div>
  );
};

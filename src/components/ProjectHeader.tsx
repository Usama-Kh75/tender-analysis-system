import React, { useState } from 'react';
import { Table2, Pencil, Award, BarChart3, Building2, Plus } from 'lucide-react';
import { TenderProject, Bidder } from '../types/tender';
import { contractTypeInfo } from '../utils/contractTypes';
import { budgetTypeInfo } from '../utils/budgetTypes';

interface ProjectHeaderProps {
  project: TenderProject;
  activeBidder: Bidder;
  activeTab: 'table' | 'summary' | 'charts';
  onSelectTableTab: () => void;
  onSelectTab: (tab: 'summary' | 'charts') => void;
  onChangeProjectField: (field: 'title' | 'referenceNumber', value: string) => void;
  onSelectBidder: (id: string) => void;
  onRenameBidder: (name: string) => void;
  onAddBidder: () => void;
  onOpenSettings: () => void;
}

// بطاقة رأس المناقصة: رقم الطلبية والعنوان القابلان للتعديل، ومبدّل الشركة، والتبويبات الثلاثة
export const ProjectHeader: React.FC<ProjectHeaderProps> = ({
  project: currentProject, activeBidder, activeTab, onSelectTableTab, onSelectTab, onChangeProjectField,
  onSelectBidder, onRenameBidder, onAddBidder, onOpenSettings
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState<boolean>(false);
  const [isEditingRefNumber, setIsEditingRefNumber] = useState<boolean>(false);
  const [isEditingBidderName, setIsEditingBidderName] = useState<boolean>(false);
  const [tempBidderName, setTempBidderName] = useState<string>('');
  const handleUpdateBidderName = onRenameBidder;
  const handleSelectTableTab = onSelectTableTab;

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

        {/* Right Controls: Active Bidder Switcher & Excel & 3 Main Tabs */}
        <div className="flex items-center gap-3 flex-wrap">
          
          {/* Bidder Switcher, Inline Rename & Quick Add Button */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-300 rounded-2xl p-1.5 shadow-xs">
            <div className="flex items-center gap-1 px-2">
              <Building2 className="w-4 h-4 text-indigo-600" />
              <span className="text-xs font-bold text-slate-600">الشركة:</span>
            </div>

            {!isEditingBidderName ? (
              <>
                <select
                  value={activeBidder.id}
                  onChange={(e) => {
                    onSelectBidder(e.target.value);
                  }}
                  className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs sm:text-sm font-black text-indigo-700 focus:outline-none cursor-pointer max-w-[220px] truncate"
                >
                  {currentProject.bidders.map(b => (
                    <option key={b.id} value={b.id} className="text-slate-900">
                      {b.name}{b.status === 'recommended' ? ' (★ موصى بالترسية)' : b.status === 'disqualified' ? ' (مستبعد)' : ''}
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => {
                    setTempBidderName(activeBidder.name);
                    setIsEditingBidderName(true);
                  }}
                  className="p-1.5 text-slate-500 hover:text-indigo-700 hover:bg-white rounded-lg transition cursor-pointer"
                  title="تعديل اسم الشركة النشطة حالياً"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </>
            ) : (
              <>
                <input
                  type="text"
                  value={tempBidderName}
                  onChange={(e) => setTempBidderName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (handleUpdateBidderName(tempBidderName.trim() || activeBidder.name), setIsEditingBidderName(false))}
                  className="bg-white border border-indigo-400 rounded-xl px-3 py-1.5 text-xs sm:text-sm font-black text-indigo-900 focus:outline-none ring-2 ring-indigo-500/20 w-56"
                  autoFocus
                />
                <button
                  onClick={() => {
                    handleUpdateBidderName(tempBidderName.trim() || activeBidder.name);
                    setIsEditingBidderName(false);
                  }}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3 py-1.5 rounded-xl shrink-0 cursor-pointer"
                >
                  حفظ
                </button>
              </>
            )}

            <button
              onClick={() => onAddBidder()}
              className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-xs transition cursor-pointer"
              title="إضافة شركة / مقاول جديد للمناقصة"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ شركة جديدة</span>
            </button>
          </div>

          {/* View Tabs */}
          <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200">
            <button
              onClick={handleSelectTableTab}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black transition cursor-pointer ${
                activeTab === 'table' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Table2 className="w-4 h-4" />
              <span>الجدول المالي</span>
            </button>

            <button
              onClick={() => onSelectTab('summary')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black transition cursor-pointer ${
                activeTab === 'summary' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Award className="w-4 h-4 text-amber-900" />
              <span>خلاصة الترسية والمقارنة 🏆</span>
            </button>

            <button
              onClick={() => onSelectTab('charts')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black transition cursor-pointer ${
                activeTab === 'charts' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>الرسوم البيانية</span>
            </button>
          </div>

        </div>
      </div>

    </div>
  );
};

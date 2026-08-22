import React, { useState } from 'react';
import { X, Settings, Save, ShieldAlert } from 'lucide-react';
import { TenderProject } from '../../types/tender';

interface ProjectSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: TenderProject;
  onSaveSettings: (updated: Partial<TenderProject>) => void;
}

export const ProjectSettingsModal: React.FC<ProjectSettingsModalProps> = ({
  isOpen,
  onClose,
  project,
  onSaveSettings
}) => {
  const [title, setTitle] = useState(project.title);
  const [referenceNumber, setReferenceNumber] = useState(project.referenceNumber);
  const [entityName, setEntityName] = useState(project.entityName);
  const [committeeChairman, setCommitteeChairman] = useState(project.committeeChairman);
  const [currency, setCurrency] = useState(project.currency);
  const [deviationThreshold, setDeviationThreshold] = useState(project.deviationThreshold || 20);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings({
      title,
      referenceNumber,
      entityName,
      committeeChairman,
      currency,
      deviationThreshold: Number(deviationThreshold) || 20
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-500/20 text-blue-400 rounded-lg">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold">إعدادات المناقصة ومعايير التحليل</h2>
              <p className="text-xs text-slate-400">تخصيص نسب الانحراف والبيانات الرسمية</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 bg-slate-50 flex-1 overflow-y-auto">
          
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">اسم / عنوان المناقصة</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">رقم الإحالة / المناقصة</label>
              <input
                type="text"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">العملة المعتمدة</label>
              <input
                type="text"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">الجهة المعلنة / الوزارة / الدائرة</label>
            <input
              type="text"
              value={entityName}
              onChange={(e) => setEntityName(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">رئيس لجنة التحليل</label>
            <input
              type="text"
              value={committeeChairman}
              onChange={(e) => setCommitteeChairman(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          {/* Deviation Threshold */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <ShieldAlert className="w-4 h-4 text-amber-600" />
              <label className="text-xs font-bold text-amber-900">
                حد الانحراف المسموح للفقرة (%):
              </label>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="5"
                max="50"
                step="1"
                value={deviationThreshold}
                onChange={(e) => setDeviationThreshold(Number(e.target.value))}
                className="flex-1 cursor-pointer"
              />
              <span className="bg-amber-600 text-white text-xs font-black px-2.5 py-1 rounded-lg font-mono">
                {deviationThreshold}%
              </span>
            </div>
            <p className="text-[11px] text-amber-700 mt-1">
              الفقرات التي يتجاوز انحرافها هذه النسبة تُصنف كـ <strong>"فقرة منحرفة"</strong> وتدخل في حساب الانحراف الجزئي.
            </p>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-200 rounded-lg font-medium cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-lg shadow-sm cursor-pointer"
            >
              <Save className="w-4 h-4" />
              حفظ التعديلات
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};

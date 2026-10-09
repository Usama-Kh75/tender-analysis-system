import React, { useState } from 'react';
import { X, Settings, Save, ShieldAlert, DownloadCloud, UploadCloud, FileJson2, Trash2, RotateCcw, Plus, Users } from 'lucide-react';
import type { TenderProject, ContractType } from '../../types/tender';
import { CONTRACT_TYPES, CONTRACT_TYPE_ORDER, contractTypeInfo } from '../../utils/contractTypes';

interface ProjectSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: TenderProject;
  onSaveSettings: (updated: Partial<TenderProject>) => void;
  onExportBackup: () => void;
  onImportBackup: (file: File) => void;
  onExportAllBackup: () => void;
  onImportAllBackup: (file: File) => void;
  onDeleteProject: () => void;
  onFactoryReset: () => void;
  onResetAllBidders: () => void;
}

export const ProjectSettingsModal: React.FC<ProjectSettingsModalProps> = ({
  isOpen,
  onClose,
  project,
  onSaveSettings,
  onExportBackup,
  onImportBackup,
  onExportAllBackup,
  onImportAllBackup,
  onDeleteProject,
  onFactoryReset,
  onResetAllBidders,
}) => {
  const [title, setTitle] = useState(project.title);
  const [referenceNumber, setReferenceNumber] = useState(project.referenceNumber);
  const [entityName, setEntityName] = useState(project.entityName);
  const [committeeChairman, setCommitteeChairman] = useState(project.committeeChairman);
  const [committeeMembers, setCommitteeMembers] = useState<string[]>(project.committeeMembers || []);
  const [currency, setCurrency] = useState(project.currency);
  const [deviationThreshold, setDeviationThreshold] = useState(project.deviationThreshold || 20);
  const [contractType, setContractType] = useState<ContractType | ''>(contractTypeInfo(project.contractType) ? project.contractType! : '');

  if (!isOpen) return null;

  const handleAddMember = () => {
    setCommitteeMembers(prev => [...prev, '']);
  };

  const handleUpdateMember = (index: number, value: string) => {
    setCommitteeMembers(prev => prev.map((m, i) => i === index ? value : m));
  };

  const handleRemoveMember = (index: number) => {
    setCommitteeMembers(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings({
      title,
      referenceNumber,
      entityName,
      committeeChairman,
      committeeMembers: committeeMembers.map(m => m.trim()).filter(Boolean),
      currency,
      deviationThreshold: Number(deviationThreshold) || 20,
      ...(contractType ? { contractType } : {})
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
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

          <div>
            <label htmlFor="settings-contract-type" className="block text-xs font-bold text-slate-700 mb-1">نوع العقد</label>
            <select
              id="settings-contract-type"
              value={contractType}
              onChange={(e) => setContractType(e.target.value as ContractType)}
              className={`w-full bg-white border rounded-lg px-3 py-2 text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none ${contractType ? 'border-slate-300' : 'border-rose-400'}`}
            >
              {!contractType && <option value="" disabled>— اختر نوع العقد —</option>}
              {CONTRACT_TYPE_ORDER.map(type => (
                <option key={type} value={type}>{CONTRACT_TYPES[type].label}</option>
              ))}
            </select>
            <p className="text-[11px] text-slate-500 mt-1">
              يحدد معايير المفاضلة في التوصية عند تساوي العطاءات أو تقاربها (ضوابط رقم 5). الخدمات الاستشارية غير مشمولة.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">رقم الطلبية أو المناقصة</label>
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

          {/* Committee Members (dynamic list, sized to actual committee) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-slate-500" />
                أعضاء لجنة التحليل (يظهرون في توقيعات المحضر المطبوع)
              </label>
              <button
                type="button"
                onClick={handleAddMember}
                className="flex items-center gap-1 text-[11px] font-bold text-blue-700 hover:text-blue-900 bg-blue-50 border border-blue-200 px-2 py-1 rounded-lg cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                إضافة عضو
              </button>
            </div>

            {committeeMembers.length === 0 ? (
              <p className="text-[11px] text-slate-500 bg-slate-100 border border-slate-200 rounded-lg px-3 py-2">
                لا يوجد أعضاء مضافون بعد. انقر "إضافة عضو" لكل عضو حسب حجم اللجنة الفعلي (مثال: "م. علي جاسم محمد (عضو فني ومقرر)").
              </p>
            ) : (
              <div className="space-y-2">
                {committeeMembers.map((member, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={member}
                      onChange={(e) => handleUpdateMember(idx, e.target.value)}
                      placeholder="اسم العضو (الصفة) — مثال: المحاسب كرار عبد الرضا (عضو مالي)"
                      className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveMember(idx)}
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer shrink-0"
                      title="إزالة هذا العضو"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
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

          {/* Backup & Restore */}
          <div className="bg-slate-100 border border-slate-300 rounded-xl p-4 space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <FileJson2 className="w-4 h-4 text-slate-700" />
                <label className="text-xs font-bold text-slate-800">
                  النسخ الاحتياطي واستعادة هذه المناقصة/الطلبية فقط:
                </label>
              </div>
              <p className="text-[11px] text-slate-600 mb-3">
                بيانات المشروع محفوظة محلياً في متصفحك فقط. نزّل نسخة احتياطية (JSON) بشكل دوري لحمايتها من الفقدان، أو لنقل المشروع بكامل بياناته إلى جهاز آخر.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={onExportBackup}
                  className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold px-3.5 py-2 rounded-lg shadow-xs transition cursor-pointer"
                >
                  <DownloadCloud className="w-3.5 h-3.5 text-emerald-400" />
                  تنزيل نسخة احتياطية
                </button>

                <label className="flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold px-3.5 py-2 rounded-lg border border-slate-300 shadow-xs transition cursor-pointer">
                  <UploadCloud className="w-3.5 h-3.5 text-indigo-600" />
                  استيراد نسخة احتياطية
                  <input
                    type="file"
                    accept="application/json,.json"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) onImportBackup(file);
                      e.target.value = '';
                    }}
                  />
                </label>
              </div>
            </div>

            <div className="border-t border-slate-300 pt-3">
              <div className="flex items-center gap-2 mb-2">
                <FileJson2 className="w-4 h-4 text-indigo-700" />
                <label className="text-xs font-bold text-indigo-900">
                  نسخة احتياطية شاملة (كل المناقصات/الطلبيات مجتمعة):
                </label>
              </div>
              <p className="text-[11px] text-slate-600 mb-3">
                ملف JSON واحد يحتوي كل مناقصاتك المحفوظة دفعة واحدة — أرشفة كاملة أو نقل شامل لجهاز آخر.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={onExportAllBackup}
                  className="flex items-center gap-1.5 bg-indigo-700 hover:bg-indigo-800 text-white text-xs font-bold px-3.5 py-2 rounded-lg shadow-xs transition cursor-pointer"
                >
                  <DownloadCloud className="w-3.5 h-3.5 text-emerald-300" />
                  تنزيل نسخة شاملة لكل المناقصات
                </button>

                <label className="flex items-center gap-1.5 bg-white hover:bg-indigo-50 text-indigo-900 text-xs font-bold px-3.5 py-2 rounded-lg border border-indigo-300 shadow-xs transition cursor-pointer">
                  <UploadCloud className="w-3.5 h-3.5 text-indigo-600" />
                  استعادة نسخة شاملة
                  <input
                    type="file"
                    accept="application/json,.json"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) onImportAllBackup(file);
                      e.target.value = '';
                    }}
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="bg-rose-50 border border-rose-300 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <ShieldAlert className="w-4 h-4 text-rose-700" />
              <label className="text-xs font-bold text-rose-900">
                منطقة الخطر:
              </label>
            </div>
            <p className="text-[11px] text-rose-700 mb-3">
              هذه الإجراءات نهائية ولا يمكن التراجع عنها. يُنصح بتنزيل نسخة احتياطية أولاً من الأعلى.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onResetAllBidders}
                title="حذف جميع المجهزين المدرجين في هذه المناقصة والبدء بمجهز واحد فارغ"
                className="flex items-center gap-1.5 bg-white hover:bg-rose-100 text-rose-800 text-xs font-bold px-3.5 py-2 rounded-lg border border-rose-400 shadow-xs transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                مسح كل المجهزين في هذه المناقصة
              </button>

              <button
                type="button"
                onClick={onDeleteProject}
                title="حذف هذه المناقصة/الطلبية نهائياً"
                className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-3.5 py-2 rounded-lg shadow-xs transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                حذف هذه المناقصة/الطلبية
              </button>

              <button
                type="button"
                onClick={onFactoryReset}
                className="flex items-center gap-1.5 bg-white hover:bg-rose-100 text-rose-800 text-xs font-bold px-3.5 py-2 rounded-lg border border-rose-400 shadow-xs transition cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                إعادة ضبط النظام بالكامل (مسح كل شيء)
              </button>
            </div>
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

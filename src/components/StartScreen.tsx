import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { ContractType, BudgetType } from '../types/tender';
import { NewProjectModal } from './modals/NewProjectModal';

interface StartScreenProps {
  recoveryNotice: React.ReactNode;
  onCreate: (data: { title: string; referenceNumber: string; contractType: ContractType; budgetType: BudgetType; bidderNames: string[] }) => void;
  onImportBackup: (file: File) => void;
}

// لا مناقصة محفوظة (بعد «إعادة ضبط النظام» أو حذف آخر مناقصة): شاشة بداية بدل مناقصة فارغة تُنشأ تلقائياً
export const StartScreen: React.FC<StartScreenProps> = ({ recoveryNotice, onCreate, onImportBackup }) => {
  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false);
  const handleCreateProject = onCreate;
  const handleImportBackup = onImportBackup;
  return (
    <div className="min-h-screen bg-slate-100">
    {recoveryNotice}
    <div className="flex items-center justify-center p-4 min-h-[80vh]">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-8 max-w-md w-full text-center space-y-4">
        <h1 className="text-lg font-black text-slate-900">نظام تحليل العطاءات</h1>
        <p className="text-sm text-slate-500">لا توجد مناقصة محفوظة في هذا المتصفح.</p>
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <button
            type="button"
            onClick={() => setIsNewProjectOpen(true)}
            className="flex items-center justify-center gap-1.5 text-sm font-bold bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-xl cursor-pointer transition"
          >
            <Plus className="w-4 h-4 text-amber-400" />
            مناقصة جديدة
          </button>
          <label className="text-sm font-bold text-slate-700 border border-slate-300 hover:bg-slate-50 px-4 py-2 rounded-xl cursor-pointer transition">
            استيراد نسخة احتياطية
            <input
              type="file"
              accept=".json,application/json"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) handleImportBackup(f);
              }}
            />
          </label>
        </div>
      </div>
      <NewProjectModal
        isOpen={isNewProjectOpen}
        onClose={() => setIsNewProjectOpen(false)}
        onCreate={(data) => { handleCreateProject(data); setIsNewProjectOpen(false); }}
      />
    </div>
    </div>
  );
};

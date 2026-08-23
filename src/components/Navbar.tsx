import React from 'react';
import { 
  FileSpreadsheet, 
  Camera, 
  Users2, 
  History, 
  Printer, 
  Plus, 
  Settings, 
  FolderOpen,
  UserCheck
} from 'lucide-react';
import { TenderProject, Bidder } from '../types/tender';
import { bocLogoDataUrl } from '../assets/bocLogo';

interface NavbarProps {
  project: TenderProject;
  projects: TenderProject[];
  activeBidder: Bidder;
  onSelectProject: (id: string) => void;
  onNewProject: () => void;
  onOpenSmartImport: (type?: 'bidder' | 'estimated' | 'both') => void;
  onOpenOcr: () => void;
  onOpenMultiBidder: () => void;
  onOpenAuditTrail: () => void;
  onOpenSettings: () => void;
  onOpenPrint: () => void;
  onExportExcel: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  project,
  projects,
  onSelectProject,
  onNewProject,
  onOpenSmartImport,
  onOpenOcr,
  onOpenMultiBidder,
  onOpenAuditTrail,
  onOpenSettings,
  onOpenPrint,
  onExportExcel
}) => {
  return (
    <header className="bg-slate-950 text-white shadow-2xl border-b border-amber-500/30 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          
          {/* Right Side: BOC Logo & Full Official Title with Author (Permanent & Sticky) */}
          <div className="flex items-center gap-3.5">
            <div className="flex items-center gap-3 bg-slate-900/90 border border-amber-500/30 p-2 pr-3 pl-4 rounded-2xl shadow-lg">
              
              {/* Official BOC Logo */}
              <div className="w-12 h-12 rounded-xl bg-white p-1 flex items-center justify-center shadow-md overflow-hidden shrink-0">
                <img
                  src={bocLogoDataUrl}
                  alt="شركة نفط البصرة"
                  className="w-full h-full object-contain"
                />
              </div>
              
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="font-black text-sm sm:text-base tracking-wide text-amber-400">
                    نظام تحليل وتقييم العطاءات المتكامل
                  </span>
                  <span className="bg-amber-500 text-slate-950 text-[10px] font-black px-1.5 py-0.5 rounded-md shadow-xs">
                    BOC
                  </span>
                </div>

                <div className="flex items-center gap-2 text-[11px] font-medium mt-0.5 flex-wrap">
                  <span className="text-slate-300 font-bold">وزارة النفط • شركة نفط البصرة</span>
                  <span className="text-slate-500">•</span>
                  <span className="text-emerald-400 font-bold flex items-center gap-1 bg-emerald-950/90 px-2 py-0.5 rounded-md border border-emerald-500/40">
                    <UserCheck className="w-3.5 h-3.5" />
                    إعداد: م. أسامة خليل هاشم
                  </span>
                </div>
              </div>
            </div>

            {/* Project Switcher */}
            <div className="hidden 2xl:flex items-center gap-2 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800">
              <FolderOpen className="w-4 h-4 text-amber-400" />
              <select
                value={project.id}
                onChange={(e) => onSelectProject(e.target.value)}
                className="bg-transparent text-xs text-slate-200 focus:outline-none cursor-pointer max-w-[180px] truncate font-medium"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id} className="bg-slate-900 text-white">
                    {p.title} ({p.referenceNumber})
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={onNewProject}
              className="hidden xl:flex items-center gap-1 text-xs bg-slate-900 hover:bg-slate-800 text-slate-300 px-2.5 py-2 rounded-xl border border-slate-800 transition cursor-pointer"
              title="إنشاء مناقصة جديدة"
            >
              <Plus className="w-3.5 h-3.5 text-amber-400" />
              <span>مناقصة جديدة</span>
            </button>
          </div>

          {/* Left Side: Clean Action Tools */}
          <div className="flex items-center gap-2">
            
            {/* Smart Table Import (Excel / Word) Button */}
            <button
              onClick={onOpenSmartImport}
              className="flex items-center gap-1.5 bg-gradient-to-r from-indigo-700 to-blue-700 hover:from-indigo-600 hover:to-blue-600 text-white text-xs sm:text-sm font-black px-3.5 py-2 rounded-xl shadow-md transition transform active:scale-95 cursor-pointer border border-indigo-400/30"
              title="استيراد جدول من ملف Excel أو Word مع مطابقة واستبعاد الأعمدة الزائدة"
            >
              <FileSpreadsheet className="w-4 h-4 text-indigo-200" />
              <span className="hidden sm:inline">استيراد جدول (Excel / Word)</span>
              <span className="sm:hidden">استيراد</span>
            </button>

            {/* OCR Button */}
            <button
              onClick={onOpenOcr}
              className="flex items-center gap-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs sm:text-sm font-bold px-3.5 py-2 rounded-xl shadow-md transition transform active:scale-95 cursor-pointer border border-emerald-400/30"
            >
              <Camera className="w-4 h-4" />
              <span className="hidden sm:inline">استخراج من صورة / PDF</span>
              <span className="sm:hidden">OCR</span>
            </button>

            {/* Multi-Bidder Comparison */}
            <button
              onClick={onOpenMultiBidder}
              className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs sm:text-sm font-medium px-3 py-2 rounded-xl border border-slate-800 transition cursor-pointer"
              title="مقارنة كافة المجهزين"
            >
              <Users2 className="w-4 h-4 text-indigo-400" />
              <span className="hidden md:inline">مقارنة المجهزين</span>
              <span className="bg-indigo-500/30 text-indigo-300 text-xs px-1.5 py-0.5 rounded-full font-bold">
                {project.bidders.length}
              </span>
            </button>

            {/* Audit Trail */}
            <button
              onClick={onOpenAuditTrail}
              className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs sm:text-sm font-medium px-3 py-2 rounded-xl border border-slate-800 transition cursor-pointer"
              title="سجل التتبع والتعديلات"
            >
              <History className="w-4 h-4 text-amber-400" />
              <span className="hidden lg:inline">سجل التتبع</span>
            </button>

            {/* Export Excel */}
            <button
              onClick={onExportExcel}
              className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-emerald-300 text-xs sm:text-sm font-medium px-3 py-2 rounded-xl border border-slate-800 transition cursor-pointer"
              title="تصدير ملف Excel"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span className="hidden xl:inline">تصدير Excel</span>
            </button>

            {/* Print Official Report */}
            <button
              onClick={onOpenPrint}
              className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs sm:text-sm font-medium px-3 py-2 rounded-xl border border-slate-800 transition cursor-pointer"
              title="طباعة محضر اللجنة الرسمي"
            >
              <Printer className="w-4 h-4 text-blue-400" />
              <span className="hidden xl:inline">محضر التحليل</span>
            </button>

            {/* Settings */}
            <button
              onClick={onOpenSettings}
              className="p-2.5 text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 rounded-xl border border-slate-800 transition cursor-pointer"
              title="إعدادات المناقصة والنسب"
            >
              <Settings className="w-4 h-4 text-amber-400" />
            </button>
          </div>

        </div>
      </div>
    </header>
  );
};

import React, { useSyncExternalStore } from 'react';
import {
  MonitorDown,
  Users2,
  History,
  Plus,
  Settings,
  FolderOpen,
  UserCheck
} from 'lucide-react';
import { TenderProject, Bidder } from '../types/tender';
import { canInstallApp, installApp, subscribeInstall } from '../pwa';

interface NavbarProps {
  project: TenderProject;
  projects: TenderProject[];
  activeBidder: Bidder;
  onSelectProject: (id: string) => void;
  onNewProject: () => void;
  onOpenMultiBidder: () => void;
  onOpenAuditTrail: () => void;
  onOpenSettings: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  project,
  projects,
  onSelectProject,
  onNewProject,
  onOpenMultiBidder,
  onOpenAuditTrail,
  onOpenSettings
}) => {
  const canInstall = useSyncExternalStore(subscribeInstall, canInstallApp);

  return (
    <header className="bg-slate-950 text-white shadow-2xl border-b border-amber-500/30 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          
          {/* Right Side: Full Official Title with Author (Permanent & Sticky) */}
          <div className="flex items-center gap-3.5">
            <div className="flex items-center gap-3 bg-slate-900/90 border border-amber-500/30 p-2 pr-3 pl-4 rounded-2xl shadow-lg">

              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="font-black text-sm sm:text-base tracking-wide text-amber-400">
                    نظام تحليل العطاءات التجاري المتكامل
                  </span>
                </div>

                <div className="flex items-center gap-2 text-[11px] font-medium mt-0.5 flex-wrap">
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

            {/* Install as app — only when the browser reports it's installable */}
            {canInstall && (
              <button
                onClick={installApp}
                className="flex items-center gap-1.5 whitespace-nowrap bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs sm:text-sm font-black px-3 py-2 rounded-xl shadow-md transition transform active:scale-95 cursor-pointer border border-amber-300/50"
                title="تثبيت النظام كتطبيق على الحاسوب — يعمل بنافذته الخاصة وبلا إنترنت"
                aria-label="تثبيت كتطبيق"
              >
                <MonitorDown className="w-4 h-4" />
                <span className="hidden md:inline">تثبيت</span>
              </button>
            )}

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

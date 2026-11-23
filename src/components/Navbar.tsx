import React, { useSyncExternalStore } from 'react';
import {
  MonitorDown,
  History,
  Plus,
  FolderOpen,
  UserCheck,
  DownloadCloud,
  ShieldCheck,
  Pencil,
  ClipboardList
} from 'lucide-react';
import { canInstallApp, installApp, subscribeInstall } from '../pwa';
import { MoreMenu } from './MoreMenu';

interface NavbarProps {
  // عدد المناقصات المحفوظة على زر «المناقصات» (قائمة الاختيار المنسدلة حُذفت، فلا حاجة للمصفوفة نفسها)
  projectsCount: number;
  onNewProject: () => void;
  onOpenProjectsBrowser: () => void;
  onOpenStatusSheet: () => void;
  onOpenAuditTrail: () => void;
  unsavedCount: number;
  lastBackupAt?: string;
  onBackupAll: () => void;
  committeeName: string | null;
  onEditCommitteeName: () => void;
  /** رقم الطلبية وعنوانها للمناقصة المفتوحة، يبقيان ظاهرين مع تمرير الصفحة */
  orderNumber?: string;
  tenderTitle?: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  projectsCount,
  onNewProject,
  onOpenProjectsBrowser,
  onOpenStatusSheet,
  onOpenAuditTrail,
  unsavedCount,
  lastBackupAt,
  onBackupAll,
  committeeName,
  onEditCommitteeName,
  orderNumber,
  tenderTitle
}) => {
  const canInstall = useSyncExternalStore(subscribeInstall, canInstallApp);
  const lastBackupText = lastBackupAt
    ? new Date(lastBackupAt).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' })
    : 'لم تُحفظ نسخة احتياطية بعد';

  return (
    <header className="bg-slate-950 text-white shadow-2xl border-b border-amber-500/30 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          
          {/* Right Side: Full Official Title with Author (Permanent & Sticky) */}
          <div className="flex items-center gap-3.5 shrink-0">
            {/* py-1.5 لا p-2: سطر اسم اللجنة يضيف ارتفاعاً، والصندوق يبقى داخل الشريط (h-20) */}
            <div className="flex items-center gap-3 bg-slate-900/90 border border-amber-500/30 py-1.5 pr-3 pl-4 rounded-2xl shadow-lg">

              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="font-black text-sm sm:text-base tracking-wide text-amber-400">
                    <span className="hidden xl:inline">نظام تحليل العطاءات التجاري المتكامل</span>
                    <span className="xl:hidden">نظام تحليل العطاءات</span>
                  </span>
                </div>

                {committeeName && (
                  <button
                    type="button"
                    onClick={onEditCommitteeName}
                    title="تعديل اسم اللجنة"
                    aria-label={`تعديل اسم اللجنة: ${committeeName}`}
                    className="flex items-center gap-1 text-[11px] font-bold text-amber-200 hover:text-white max-w-[22rem] cursor-pointer"
                  >
                    <Pencil className="w-3 h-3 shrink-0" />
                    <span className="truncate min-w-0">{committeeName}</span>
                  </button>
                )}

                <div className="flex items-center gap-2 text-[11px] font-medium mt-0.5 flex-wrap">
                  <span className="text-emerald-400 font-bold flex items-center gap-1 bg-emerald-950/90 px-2 py-0.5 rounded-md border border-emerald-500/40">
                    <UserCheck className="w-3.5 h-3.5" />
                    إعداد المهندس أسامة خليل هاشم
                  </span>
                </div>
              </div>
            </div>

          {/* فعل الإنشاء: يُفصل عن أدوات الحفظ والاستعراض بجانب هوية النظام */}
          <button
            onClick={onNewProject}
            className="flex items-center gap-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-100 border border-amber-500/60 text-xs sm:text-sm font-bold px-2 sm:px-3 py-2 rounded-xl transition cursor-pointer"
            title="إنشاء مناقصة جديدة"
            aria-label="مناقصة جديدة"
          >
            <Plus className="w-4 h-4 text-amber-400" />
            <span className="hidden xl:inline">مناقصة جديدة</span>
          </button>

          {/* رقم الطلبية في الشريط الثابت (كان في بطاقة المناقصة وحدها فيغيب مع التمرير)؛ يُخفى تحت sm لأن الشريط يفيض على الهاتف */}
          {orderNumber && (
            <span
              title={tenderTitle || undefined}
              className="hidden sm:inline-flex items-center whitespace-nowrap bg-amber-100 text-amber-900 border border-amber-300 text-xs font-black px-3 py-1 rounded-full font-mono"
            >
              <span className="sr-only">رقم الطلبية: </span>
              {/* بلا bdi: يُعرض باتجاه الصفحة كما في بطاقة المناقصة، فلا يختلف ترتيب أجزائه بين الموضعين */}
              {orderNumber}
            </span>
          )}

          </div>

          {/* Left Side: Clean Action Tools */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">

            {/* نسخة احتياطية شاملة: العدد = المناقصات التي تغيّرت منذ آخر نسخة تحويها */}
            <button
              onClick={onBackupAll}
              className={`flex items-center gap-1.5 text-xs sm:text-sm font-medium px-2 sm:px-3 py-2 rounded-xl border transition cursor-pointer ${
                unsavedCount > 0
                  ? 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-100 border-amber-500/60'
                  : 'bg-slate-900 hover:bg-slate-800 text-slate-200 border-slate-800'
              }`}
              title={unsavedCount > 0
                ? lastBackupAt
                  ? `${unsavedCount} مناقصة أو طلبية تغيّرت منذ آخر نسخة احتياطية — اضغط لحفظ نسخة شاملة لكل المناقصات (آخر نسخة: ${lastBackupText})`
                  : `${unsavedCount} مناقصة أو طلبية لم تُحفظ في نسخة احتياطية بعد — اضغط لحفظ نسخة شاملة لكل المناقصات`
                : `كل المناقصات محفوظة في نسخة احتياطية (آخر نسخة: ${lastBackupText}) — اضغط لحفظ نسخة جديدة`}
              aria-label={unsavedCount > 0
                ? `نسخة احتياطية (${unsavedCount} مناقصة أو طلبية لم تُحفظ)`
                : 'نسخة احتياطية (كل المناقصات محفوظة)'}
            >
              {unsavedCount > 0
                ? <DownloadCloud className="w-4 h-4 text-amber-400" />
                : <ShieldCheck className="w-4 h-4 text-emerald-400" />}
              <span className="hidden xl:inline">نسخة احتياطية</span>
              {unsavedCount > 0 && (
                <span className="bg-amber-500 text-slate-950 text-xs px-1.5 py-0.5 rounded-full font-bold">{unsavedCount}</span>
              )}
            </button>

            {/* كل المناقصات وعروضها — ظاهر في كل المقاسات، بخلاف القائمة المنسدلة */}
            <button
              onClick={onOpenProjectsBrowser}
              className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs sm:text-sm font-medium px-2 sm:px-3 py-2 rounded-xl border border-slate-800 transition cursor-pointer"
              title="استعراض كل المناقصات وعروضها"
              aria-label={`المناقصات (${projectsCount})`}
            >
              <FolderOpen className="w-4 h-4 text-amber-400" />
              <span className="hidden xl:inline">المناقصات</span>
              <span className="bg-amber-500/20 text-amber-300 text-xs px-1.5 py-0.5 rounded-full font-bold">
                {projectsCount}
              </span>
            </button>

            {/* كشف الموقف في الشريط الدائم (أسامة 2026-11-22): كان داخل نافذة «المناقصات» وحدها */}
            <button
              type="button"
              onClick={onOpenStatusSheet}
              className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs sm:text-sm font-medium px-2 sm:px-3 py-2 rounded-xl border border-slate-800 transition cursor-pointer"
              title="كشف رسمي بموقف كل طلبية: أين هي الآن ومنذ متى وبأي مذكرة"
              aria-label="كشف الموقف"
            >
              <ClipboardList className="w-4 h-4 text-amber-400" />
              <span className="hidden xl:inline">كشف الموقف</span>
            </button>

            <MoreMenu
              dark
              ariaLabel="المزيد"
              items={[
                { label: 'سجل التتبع', icon: <History className="w-3.5 h-3.5" />, onClick: onOpenAuditTrail },
                ...(canInstall ? [{ label: 'تثبيت النظام', icon: <MonitorDown className="w-3.5 h-3.5" />, onClick: () => { void installApp(); }, title: 'تثبيت النظام كتطبيق على الحاسوب — يعمل بنافذته الخاصة وبلا إنترنت' }] : [])
              ]}
            />
          </div>

        </div>
      </div>
    </header>
  );
};

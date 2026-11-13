import React, { useSyncExternalStore } from 'react';
import {
  MonitorDown,
  History,
  Plus,
  FolderOpen,
  UserCheck,
  DownloadCloud,
  ShieldCheck,
  Table2,
  Award,
  MapPin,
  Pencil
} from 'lucide-react';
import { canInstallApp, installApp, subscribeInstall } from '../pwa';
import { MoreMenu } from './MoreMenu';
import type { MainTab } from '../resume';

interface NavbarProps {
  // عدد المناقصات المحفوظة على زر «المناقصات» (قائمة الاختيار المنسدلة حُذفت، فلا حاجة للمصفوفة نفسها)
  projectsCount: number;
  activeTab: MainTab;
  onSelectTab: (t: MainTab) => void;
  onNewProject: () => void;
  onOpenProjectsBrowser: () => void;
  onOpenAuditTrail: () => void;
  unsavedCount: number;
  lastBackupAt?: string;
  onBackupAll: () => void;
  committeeName: string | null;
  onEditCommitteeName: () => void;
  /** فقرات بانتظار قرار اللجنة: شارة على «العطاءات» تختفي عند الصفر */
  pendingAudit: number;
}

// ثلاثة تبويبات: لكل واحد سؤال واحد (مجهز واحد، المجهزون معاً، مسار الطلبية)
// وتحت اسم كل تبويب سؤاله
const TABS: { id: MainTab; label: string; question: string; Icon: React.ElementType }[] = [
  { id: 'bids', label: 'العطاءات', question: 'ماذا قدّم كل مجهز؟', Icon: Table2 },
  { id: 'analysis', label: 'التحليل والتوصية', question: 'من الأفضل ولماذا؟', Icon: Award },
  { id: 'status', label: 'الموقف', question: 'أين وصلت الطلبية؟', Icon: MapPin }
];

export const Navbar: React.FC<NavbarProps> = ({
  projectsCount,
  activeTab,
  onSelectTab,
  onNewProject,
  onOpenProjectsBrowser,
  onOpenAuditTrail,
  unsavedCount,
  lastBackupAt,
  onBackupAll,
  committeeName,
  onEditCommitteeName,
  pendingAudit
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

          </div>

          {/* التبويبات الثلاثة: المفتوح بخط سفلي أزرق وخلفية أفتح */}
          <div role="tablist" aria-label="أقسام العمل" className="flex items-stretch h-full mx-1 sm:mx-3 min-w-0 overflow-x-auto">
            {TABS.map(({ id, label, question, Icon }) => {
              const on = activeTab === id;
              return (
                <button
                  key={id}
                  role="tab"
                  aria-selected={on}
                  onClick={() => onSelectTab(id)}
                  title={`${label}: ${question}`}
                  aria-label={id === 'bids' && pendingAudit > 0 ? `${label}، ${pendingAudit} فقرة بانتظار قرار` : label}
                  className={`flex items-center gap-1.5 px-2.5 lg:px-4 text-xs sm:text-sm font-black whitespace-nowrap border-b-4 transition cursor-pointer ${
                    on ? 'border-blue-400 bg-slate-800/80 text-white' : 'border-transparent text-slate-400 hover:text-white hover:bg-slate-900'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${on ? 'text-blue-300' : ''}`} />
                  {/* تحت lg أيقونة وحدها (مع aria-label وtitle)، وبعدها الاسم الكامل وتحته سؤاله */}
                  <span className="hidden lg:flex flex-col items-start leading-tight">
                    <span>{label}</span>
                    <span className="text-[10px] font-medium text-slate-400">{question}</span>
                  </span>
                  {id === 'bids' && pendingAudit > 0 && (
                    <span aria-hidden="true" title={`${pendingAudit} فقرة بانتظار قرار اللجنة`} className="bg-amber-500 text-slate-950 text-[10px] font-black rounded-full min-w-[1.25rem] px-1.5 py-0.5 text-center">
                      {pendingAudit}
                    </span>
                  )}
                </button>
              );
            })}
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

            {/* تُستعمل كثيراً فلا تُخبَّأ في «⋯» */}
            <button
              onClick={onNewProject}
              className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs sm:text-sm font-medium px-2 sm:px-3 py-2 rounded-xl border border-slate-800 transition cursor-pointer"
              title="إنشاء مناقصة جديدة"
              aria-label="مناقصة جديدة"
            >
              <Plus className="w-4 h-4 text-amber-400" />
              <span className="hidden xl:inline">مناقصة جديدة</span>
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

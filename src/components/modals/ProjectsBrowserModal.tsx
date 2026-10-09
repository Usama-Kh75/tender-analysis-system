import React from 'react';
import { X, FolderOpen, Plus, Trash2 } from 'lucide-react';
import type { TenderProject } from '../../types/tender';
import { formatNumber, formatPercent } from '../../utils/calculations';
import { hasBidAmounts, hasNoEstimate } from '../../utils/recommendation';
import { contractTypeInfo } from '../../utils/contractTypes';

interface ProjectsBrowserModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects: TenderProject[];
  activeProjectId: string;
  // bidderId: يُفتح العرض نفسه داخل مناقصته
  onOpenProject: (projectId: string, bidderId?: string) => void;
  onDeleteProject: (projectId: string) => void;
  onNewProject: () => void;
}

// تاريخ اليوم بتوقيت الجهاز: آخر الليل في العراق يقع في يوم UTC السابق
const localDate = (iso?: string): string => {
  const d = iso ? new Date(iso) : null;
  if (!d || isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * نافذة «المناقصات»: كل مناقصة محفوظة بعروضها، الأحدث تعديلاً أولاً. كل مناقصة تُعرض وحدها بلا مجاميع
 * ولا مقارنة بين المناقصات، لأن كل مناقصة قرار مستقل للجنة. الأرقام هي totals المحسوبة سلفاً لكل مجهز
 */
export const ProjectsBrowserModal: React.FC<ProjectsBrowserModalProps> = ({
  isOpen,
  onClose,
  projects,
  activeProjectId,
  onOpenProject,
  onDeleteProject,
  onNewProject
}) => {
  if (!isOpen) return null;

  const sorted = [...projects].sort((a, b) =>
    (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || ''));

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="projects-browser-title"
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden"
      >
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/20 text-amber-400 rounded-lg">
              <FolderOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 id="projects-browser-title" className="text-base sm:text-lg font-bold">المناقصات والطلبيات</h2>
              <p className="text-xs text-slate-400">({projects.length}) محفوظة في هذا المتصفح — الأحدث تعديلاً أولاً</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="إغلاق" className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-3 bg-slate-50 flex-1 overflow-y-auto">
          {sorted.length === 0 && (
            <p className="text-center text-sm text-slate-500 py-6">لا توجد مناقصة محفوظة.</p>
          )}
          {sorted.map(project => {
            const isActive = project.id === activeProjectId;
            const noEstimate = hasNoEstimate(project);
            const estimate = project.bidders.find(b => b.totals.totalEstimatedAmount > 0)?.totals.totalEstimatedAmount ?? 0;
            const typeLabel = contractTypeInfo(project.contractType)?.label;
            const created = localDate(project.createdAt);
            const updated = localDate(project.updatedAt);
            return (
              <section
                key={project.id}
                aria-label={project.title}
                className={`rounded-2xl border bg-white overflow-hidden ${isActive ? 'border-indigo-400 ring-2 ring-indigo-100' : 'border-slate-200'}`}
              >
                <button
                  type="button"
                  onClick={() => onOpenProject(project.id)}
                  aria-current={isActive ? 'true' : undefined}
                  className="w-full text-right p-4 hover:bg-slate-50 cursor-pointer transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500"
                >
                  {/* الزر لا يحوي إلا عناصر نصية (span)؛ اسم المنطقة من aria-label على section */}
                  <span className="flex items-start justify-between gap-2 flex-wrap">
                    <span className="font-black text-slate-900 text-sm sm:text-base">{project.title}</span>
                    {isActive && (
                      <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                        مفتوحة الآن
                      </span>
                    )}
                  </span>
                  <span className="text-[11px] text-slate-500 flex flex-wrap gap-x-3 gap-y-1 mt-1">
                    {project.referenceNumber && <span>الرقم: <bdi>{project.referenceNumber}</bdi></span>}
                    {typeLabel && <span>{typeLabel}</span>}
                    {project.entityName && <span>{project.entityName}</span>}
                    {created && <span>أُنشئت <bdi>{created}</bdi></span>}
                    {updated && <span>آخر تعديل <bdi>{updated}</bdi></span>}
                  </span>
                  <span className="block text-xs text-slate-600 mt-2">
                    الكلفة التخمينية:{' '}
                    {noEstimate
                      ? <span className="font-bold text-amber-700">بانتظار الكلفة التخمينية</span>
                      : <><bdi className="font-mono font-black text-slate-900">{formatNumber(estimate)}</bdi> {project.currency}</>}
                  </span>
                </button>

                <div className="border-t border-slate-100">
                  <div className="flex items-center justify-between gap-2 px-4 pt-2">
                    <p className="text-[11px] font-bold text-slate-500">المجهزون ({project.bidders.length})</p>
                    <button
                      type="button"
                      onClick={() => onDeleteProject(project.id)}
                      aria-label={`حذف المناقصة ${project.title}`}
                      className="flex items-center gap-1 text-[11px] font-bold text-rose-700 hover:bg-rose-50 px-2 py-1 rounded-lg cursor-pointer transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      حذف
                    </button>
                  </div>
                  <ul className="divide-y divide-slate-100">
                    {project.bidders.map(bidder => {
                      const priced = hasBidAmounts(bidder);
                      const deviation = bidder.totals.totalDeviationPercent;
                      const beyond = Math.abs(deviation) > project.deviationThreshold;
                      return (
                        <li key={bidder.id}>
                          <button
                            type="button"
                            onClick={() => onOpenProject(project.id, bidder.id)}
                            className="w-full flex items-center justify-between gap-3 px-4 py-2 text-right text-xs hover:bg-indigo-50 cursor-pointer transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500"
                          >
                            <span className={`font-bold truncate ${priced ? 'text-slate-800' : 'text-slate-400'}`}>{bidder.name}</span>
                            {priced ? (
                              <span className="flex items-center gap-3 shrink-0">
                                <span>
                                  <bdi className="font-mono font-black text-slate-900">{formatNumber(bidder.totals.totalBidderAmount)}</bdi>
                                  {' '}<span className="text-slate-500">{project.currency}</span>
                                </span>
                                {!noEstimate && (
                                  <bdi
                                    title="الانحراف عن الكلفة التخمينية"
                                    className={`font-mono font-bold px-1.5 py-0.5 rounded-md ${beyond ? 'text-rose-700 bg-rose-50' : 'text-emerald-700 bg-emerald-50'}`}
                                  >
                                    {formatPercent(deviation)}
                                  </bdi>
                                )}
                              </span>
                            ) : (
                              <span className="text-slate-400 shrink-0">لم تُدخل أسعاره بعد</span>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </section>
            );
          })}
        </div>

        <div className="p-4 border-t border-slate-200 bg-white flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onNewProject}
            className="flex items-center gap-1.5 text-sm font-bold bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-xl cursor-pointer transition"
          >
            <Plus className="w-4 h-4 text-amber-400" />
            مناقصة جديدة
          </button>
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-bold text-slate-600 hover:text-slate-900 px-4 py-2 rounded-xl cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};

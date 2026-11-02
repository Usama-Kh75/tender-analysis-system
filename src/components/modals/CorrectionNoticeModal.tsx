import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Printer } from 'lucide-react';
import type { Bidder, TenderProject } from '../../types/tender';
import { correctionNoticeRows } from '../../utils/correctionNotice';

interface CorrectionNoticeModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: TenderProject;
  bidder: Bidder;
}

const cell = 'border border-black px-2 py-1.5 align-middle';
const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 3 });

// إشعار تصحيح المجهز للتوقيع (A4 عمودي): ضوابط رقم (4) خامساً/ب/3. وثيقة بصيغة المحضر بلا ترقيم ولا تاريخ مطبوع،
// فالتاريخ والتوقيع والختم بخط اليد. للعرض والطباعة فقط، ولا يغيّر بيانات المناقصة
export const CorrectionNoticeModal: React.FC<CorrectionNoticeModalProps> = ({ isOpen, onClose, project, bidder }) => {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const { rows, pending, totalDifference } = correctionNoticeRows(bidder, project.auditLogs);
  const canPrint = rows.length > 0;
  const diffText = totalDifference === 0 ? '0' : `${totalDifference > 0 ? '+' : '−'}${fmt(Math.abs(totalDifference))}`;

  return createPortal(
    <div
      className="print-report-portal fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 print:static print:block print:bg-white print:p-0 print:backdrop-blur-none"
      role="dialog" aria-modal="true" aria-label="إشعار بالتصحيح الحسابي"
    >
      <style>{'@media print { @page { size: A4 portrait; margin: 12mm; } .correction-notice-head th { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }'}</style>
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[95vh] flex flex-col overflow-hidden print:max-w-none print:max-h-none print:overflow-visible print:rounded-none print:shadow-none print:border-0 print:block">

        <div className="p-4 bg-slate-950 text-white flex items-center justify-between gap-3 flex-wrap no-print border-b border-amber-500/30">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-bold">إشعار المجهز للتوقيع</h2>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {pending > 0 && (
              <span className="text-xs font-bold text-amber-300">{pending} فقرة ما زالت بانتظار قرار اللجنة ولا تدخل هذا الإشعار</span>
            )}
            <button
              type="button"
              onClick={() => window.print()}
              disabled={!canPrint}
              className="flex items-center gap-1.5 text-xs font-bold bg-amber-500 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 px-3 py-1.5 rounded-lg cursor-pointer"
            >
              <Printer className="w-4 h-4" /> طباعة
            </button>
            <button type="button" onClick={onClose} aria-label="إغلاق" className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 flex-1 min-h-0 overflow-auto bg-white text-black print:overflow-visible print:p-0" dir="rtl">
          <h1 className="text-center text-lg font-black mb-2">إشعار بالتصحيح الحسابي</h1>
          <div className="text-center text-sm font-bold mb-4 space-y-0.5">
            {project.entityName && <div>{project.entityName}</div>}
            <div>
              مناقصة{project.referenceNumber?.trim() && <> (<bdi>{project.referenceNumber.trim()}</bdi>)</>}: {project.title}
            </div>
            <div>المجهز: {bidder.name}</div>
          </div>

          {!canPrint ? (
            <p className="text-center text-sm text-slate-500 py-8">لا فقرات صحّحتها اللجنة في هذا العطاء</p>
          ) : (
            <>
              <p className="text-sm leading-relaxed mb-4">
                تبلّغ لجنة التحليل مقدّم العطاء ({bidder.name}) بوجود تصحيح حسابي في عطائه، ليحضر ويوقّع ويختم إزاء التصحيح الذي قامت به اللجنة — ضوابط رقم (4) خامساً/ب/3.
              </p>
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="correction-notice-head bg-slate-100 font-black text-center">
                    <th scope="col" className={cell}>ت</th>
                    <th scope="col" className={cell}>رقم الفقرة</th>
                    <th scope="col" className={cell}>الوصف</th>
                    <th scope="col" className={cell}>الكمية</th>
                    <th scope="col" className={cell}>المفرد كما قدّمه</th>
                    <th scope="col" className={cell}>المبلغ كما قدّمه</th>
                    <th scope="col" className={cell}>المفرد المعتمد</th>
                    <th scope="col" className={cell}>المبلغ المعتمد</th>
                    <th scope="col" className={cell}>سبب التصحيح</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={`${r.itemNo}-${i}`} className="break-inside-avoid">
                      <td className={`${cell} text-center`}>{i + 1}</td>
                      <td className={`${cell} text-center`}><bdi>{r.itemNo}</bdi></td>
                      <td className={cell}>{r.description}</td>
                      <td className={`${cell} text-center`}><bdi>{fmt(r.quantity)}</bdi></td>
                      <td className={`${cell} text-center`}>{r.submittedUnit === null ? 'غير محفوظ' : <bdi>{fmt(r.submittedUnit)}</bdi>}</td>
                      <td className={`${cell} text-center`}><bdi>{fmt(r.submittedTotal)}</bdi></td>
                      <td className={`${cell} text-center`}><bdi>{fmt(r.adoptedUnit)}</bdi></td>
                      <td className={`${cell} text-center`}><bdi>{fmt(r.adoptedTotal)}</bdi></td>
                      <td className={cell}>{r.basis}</td>
                    </tr>
                  ))}
                  <tr className="break-inside-avoid font-black bg-slate-50">
                    <td colSpan={7} className={`${cell} text-center`}>فرق المجموع (المعتمد − كما قدّمه)</td>
                    <td className={`${cell} text-center`}><bdi dir="ltr">{diffText}</bdi></td>
                    <td className={cell}></td>
                  </tr>
                </tbody>
              </table>

              <div className="break-inside-avoid grid grid-cols-2 gap-8 pt-10 text-xs font-bold">
                <div className="border-t border-slate-400 pt-2 text-center">
                  <div>رئيس لجنة التحليل</div>
                  <div className="mt-6 text-slate-600">التوقيع: .....................</div>
                </div>
                <div className="border-t border-slate-400 pt-2 text-center space-y-4">
                  <div>مقدّم العطاء أو ممثله</div>
                  <div className="text-slate-600">الاسم: .....................</div>
                  <div className="text-slate-600">التوقيع: .....................</div>
                  <div className="text-slate-600">الختم: .....................</div>
                  <div className="text-slate-600">التاريخ: .....................</div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

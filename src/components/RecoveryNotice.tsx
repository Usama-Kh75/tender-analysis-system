import React from 'react';
import { AlertTriangle, Download, X } from 'lucide-react';
import { RecoveredData } from '../utils/storageService';

interface RecoveryNoticeProps {
  entries: RecoveredData[];
  onDownload: () => void;
  onDismiss: () => void;
}

// بيانات محفوظة تعذّرت قراءتها عند التحميل: حُفظت جانباً بدل الكتابة فوقها، ويُنزَّل نصها ليُفحص أو يُرسل للدعم
export const RecoveryNotice: React.FC<RecoveryNoticeProps> = ({ entries, onDownload, onDismiss }) => {
  if (entries.length === 0) return null;
  return (
    <div role="alert" className="bg-amber-50 border-b border-amber-300 text-amber-900 px-4 py-3 flex flex-wrap items-center gap-3 text-sm">
      <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
      <p className="flex-1 min-w-[16rem] font-semibold">
        تعذّرت قراءة بعض بيانات المناقصات المحفوظة ({entries[entries.length - 1].reason}). لم تُحذف: حُفظت نسخة منها
        في المتصفح، فنزّلها قبل أي تعديل إن احتجت استرجاعها.
      </p>
      <button
        type="button"
        onClick={onDownload}
        className="flex items-center gap-1.5 font-bold bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-lg cursor-pointer transition"
      >
        <Download className="w-4 h-4" />
        تنزيل النسخة المحفوظة
      </button>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="إخفاء التنبيه وحذف النسخة المحفوظة"
        title="إخفاء التنبيه وحذف النسخة المحفوظة"
        className="p-1.5 rounded-lg hover:bg-amber-100 cursor-pointer transition"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

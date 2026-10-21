import React, { useState } from 'react';
import { AlertTriangle, Download, X } from 'lucide-react';
import { RecoveredData } from '../utils/storageService';

interface RecoveryNoticeProps {
  entries: RecoveredData[];
  /** تعذّر حفظ النسخة في المتصفح: الحفظ موقوف حتى تُنزَّل وتُغلق */
  saveBlocked: boolean;
  /** يعيد false إن أُلغي الحفظ */
  onDownload: () => Promise<boolean>;
  onDismiss: () => void;
}

// بيانات محفوظة تعذّرت قراءتها عند التحميل: حُفظت جانباً بدل الكتابة فوقها، ويُنزَّل نصها ليُفحص أو يُرسل للدعم
export const RecoveryNotice: React.FC<RecoveryNoticeProps> = ({ entries, saveBlocked, onDownload, onDismiss }) => {
  // عدد النسخ عند آخر تنزيل: نسخة أُضيفت بعده لم تُنزَّل بعد
  const [downloadedCount, setDownloadedCount] = useState(0);
  if (entries.length === 0) return null;

  // تُعدّ النسخ منزّلة بعد الحفظ فقط، وبعددها لحظة الضغط
  const download = async () => {
    const count = entries.length;
    if (await onDownload()) setDownloadedCount(count);
  };
  // ✕ يحذف النسخة من المتصفح نهائياً، فلا يُحذف ما لم يُنزَّل إلا بتأكيد
  const dismiss = () => {
    if (downloadedCount < entries.length && !window.confirm(
      'لم تُنزَّل النسخة المحفوظة بعد.\n\nإخفاء التنبيه يحذفها من المتصفح نهائياً، ولا يمكن استرجاعها بعد ذلك.\n\nهل تحذفها دون تنزيل؟'
    )) return;
    onDismiss();
  };

  return (
    <div role="alert" className="bg-amber-50 border-b border-amber-300 text-amber-900 px-4 py-3 flex flex-wrap items-center gap-3 text-sm">
      <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
      <p className="flex-1 min-w-[16rem] font-semibold">
        تعذّرت قراءة بعض بيانات المناقصات المحفوظة ({entries[entries.length - 1].reason}).{' '}
        {saveBlocked
          ? 'تعذّر حفظ نسخة منها في المتصفح لضيق مساحته، فأُوقف الحفظ حتى لا تُتلف: نزّل النسخة ثم اضغط ✕ ليُستأنف.'
          : 'لم تُحذف: حُفظت نسخة منها في المتصفح، فنزّلها قبل أي تعديل إن احتجت استرجاعها.'}
      </p>
      <button
        type="button"
        onClick={download}
        className="flex items-center gap-1.5 font-bold bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-lg cursor-pointer transition"
      >
        <Download className="w-4 h-4" />
        تنزيل النسخة المحفوظة
      </button>
      <button
        type="button"
        onClick={dismiss}
        aria-label="إخفاء التنبيه وحذف النسخة المحفوظة"
        title="إخفاء التنبيه وحذف النسخة المحفوظة"
        className="p-1.5 rounded-lg hover:bg-amber-100 cursor-pointer transition"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

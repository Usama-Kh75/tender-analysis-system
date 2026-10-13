import React, { useEffect, useState } from 'react';
import { AlertTriangle, RotateCw, X } from 'lucide-react';
import { watchForeignDom } from '../utils/foreignDom';

// تنبيه حين تعدّل إضافة متصفح نصوص الصفحة (انظر foreignDom.ts): العلاج إيقافها لهذا الموقع، لا في التطبيق
export const ForeignDomNotice: React.FC = () => {
  const [found, setFound] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const root = document.getElementById('root');
    return root ? watchForeignDom(root, () => setFound(true)) : undefined;
  }, []);

  if (!found || dismissed) return null;
  return (
    <div role="alert" translate="no" className="bg-rose-50 border-b border-rose-300 text-rose-900 px-4 py-3 flex flex-wrap items-center gap-3 text-sm">
      <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
      <p className="flex-1 min-w-[16rem] font-semibold">
        إضافة في المتصفح تعدّل نصوص هذه الصفحة، وغالباً مترجم مثل TransOver أو الترجمة التلقائية. قد يتعطل العرض
        فتبيضّ الشاشة، أو تبقى بعض الأرقام الظاهرة قديمة. أوقف الإضافة لهذا الموقع (في TransOver: «Disable on this page»)
        ثم أعد تحميل الصفحة.
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="flex items-center gap-1.5 font-bold bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded-lg cursor-pointer transition"
      >
        <RotateCw className="w-4 h-4" />
        إعادة تحميل الصفحة
      </button>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="إخفاء التنبيه"
        title="إخفاء التنبيه"
        className="p-1.5 rounded-lg hover:bg-rose-100 cursor-pointer transition"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

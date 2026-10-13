import React from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';
import { foreignDomSeen } from '../utils/foreignDom';

interface State {
  error: Error | null;
}

// خطأ أثناء رسم الصفحة كان يُسقط الواجهة كلها إلى شاشة بيضاء بلا تفسير: تظهر بدلها رسالة وزر إعادة تحميل.
// البيانات في localStorage تُقرأ من جديد عند التحميل، وأثر إضافة تعدّل الصفحة يُذكر سبباً إن رُصد (foreignDom.ts)
export class RenderErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('تعطّل عرض الصفحة', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const byExtension = foreignDomSeen() || error.name === 'NotFoundError';
    return (
      <div translate="no" className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div role="alert" className="bg-white rounded-3xl border border-rose-200 shadow-xs p-8 max-w-lg w-full space-y-4 text-slate-800">
          <div className="flex items-center gap-2 text-rose-700">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <h1 className="text-lg font-black">تعطّل عرض الصفحة</h1>
          </div>
          <p className="text-sm leading-7">
            البيانات المحفوظة في المتصفح لم تتأثر. أعد تحميل الصفحة، وتأكد بعدها أن آخر تعديل أجريتَه ظاهر، فإن لم يظهر فأعده.
          </p>
          {byExtension && (
            <p className="text-sm leading-7 bg-amber-50 border border-amber-200 rounded-xl p-3 text-amber-900 font-semibold">
              السبب الأرجح إضافة في المتصفح تعدّل نصوص الصفحة، وغالباً مترجم مثل TransOver أو الترجمة التلقائية.
              أوقفها لهذا الموقع (في TransOver: «Disable on this page») حتى لا يتكرر التعطل.
            </p>
          )}
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="flex items-center gap-1.5 text-sm font-bold bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-xl cursor-pointer transition"
          >
            <RotateCw className="w-4 h-4 text-amber-400" />
            إعادة تحميل الصفحة
          </button>
          <p className="text-xs text-slate-400 font-mono break-all" dir="ltr">{error.name}: {error.message}</p>
        </div>
      </div>
    );
  }
}

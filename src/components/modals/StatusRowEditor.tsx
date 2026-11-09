import React, { useState } from 'react';
import type { StatusOrder, TenderProject } from '../../types/tender';
import { ANNOUNCEMENT_ORDER, announcementLabel } from '../../utils/tenderDetails';
import type { createStatusHandlers } from '../../app/statusHandlers';
import type { createStatusOrderHandlers } from '../../app/statusOrderHandlers';
import { OrderStatusModal } from './OrderStatusModal';

interface StatusRowEditorProps {
  // tender: مناقصة محفوظة (العنوان والرقم للقراءة فقط)، order: طلبية بلا تحليل، new: طلبية جديدة لم تُحفظ بعد
  mode: 'tender' | 'order' | 'new';
  project?: TenderProject;
  order?: StatusOrder;
  tenderHandlers?: ReturnType<typeof createStatusHandlers>;
  orderHandlers: ReturnType<typeof createStatusOrderHandlers>;
  onClose: () => void;
  // بعد حفظ طلبية جديدة: تُفتح للتحرير ليظهر قسم المواقف
  onCreated: (id: string) => void;
}

const fieldClass = 'w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none';
const labelClass = 'block text-xs font-bold text-slate-700 mb-1';

// محرر صف في كشف الموقف: بيانات الطلبية (الإعلان وتاريخ الاستلام، ورقمها وموضوعها للطلبية بلا تحليل) ثم مواقفها
export const StatusRowEditor: React.FC<StatusRowEditorProps> = ({ mode, project, order, tenderHandlers, orderHandlers, onClose, onCreated }) => {
  const source = mode === 'tender' ? project : order;
  const [referenceNumber, setReferenceNumber] = useState(source?.referenceNumber ?? '');
  const [title, setTitle] = useState(source?.title ?? '');
  const [announcementNo, setAnnouncementNo] = useState<number | ''>(source?.announcementNo ?? '');
  const [receivedAt, setReceivedAt] = useState(source?.receivedAt ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    const values = { announcementNo: announcementNo === '' ? undefined : announcementNo, receivedAt: receivedAt || undefined };
    setSaved(false);
    if (mode === 'tender') {
      const r = tenderHandlers!.handleSaveDetails(values);
      setError(r);
      setSaved(!r);
    } else if (mode === 'order') {
      const r = orderHandlers.handleEditOrder(order!.id, { referenceNumber, title, ...values });
      setError(r);
      setSaved(!r);
    } else {
      const r = orderHandlers.handleAddOrder({ referenceNumber, title, ...values });
      if ('error' in r) setError(r.error);
      else onCreated(r.id);
    }
  };

  const handleDeleteOrder = () => {
    if (!order || !window.confirm(`حذف الطلبية (${order.referenceNumber || order.title}) من كشف الموقف نهائياً بكل مواقفها؟`)) return;
    orderHandlers.handleDeleteOrder(order.id);
    onClose();
  };

  const readOnly = mode === 'tender';
  // خلفية واحدة لكل حقل: صنفان متنافسان للخلفية يحكمهما ترتيب ملف CSS لا ترتيب الكتابة
  const refClass = readOnly ? fieldClass.replace('bg-white', 'bg-slate-100 text-slate-600 cursor-not-allowed') : fieldClass;
  const roHint = readOnly ? 'row-readonly-hint' : undefined;
  // تعديل أي حقل يُسقط رسالة «حُفظت البيانات» والخطأ السابق: ما على الشاشة لم يُحفظ بعد
  const edited = <T,>(set: (v: T) => void) => (v: T) => { set(v); setSaved(false); setError(null); };
  const detailsSection = (
    <section className="space-y-3" aria-label="بيانات الطلبية">
      <h3 className="text-sm font-black text-slate-800">بيانات الطلبية</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="row-ref" className={labelClass}>رقم الطلبية</label>
          <input id="row-ref" type="text" value={referenceNumber} readOnly={readOnly} aria-describedby={roHint} onChange={(e) => edited(setReferenceNumber)(e.target.value)} className={refClass} />
        </div>
        <div>
          <label htmlFor="row-title" className={labelClass}>الموضوع</label>
          <input id="row-title" type="text" value={title} readOnly={readOnly} aria-describedby={roHint} onChange={(e) => edited(setTitle)(e.target.value)} className={refClass} />
        </div>
        <div>
          <label htmlFor="row-announcement" className={labelClass}>الإعلان</label>
          <select id="row-announcement" value={announcementNo} onChange={(e) => edited(setAnnouncementNo)(e.target.value === '' ? '' : Number(e.target.value))} className={fieldClass}>
            <option value="">— غير محدد —</option>
            {ANNOUNCEMENT_ORDER.map(no => <option key={no} value={no}>{announcementLabel(no)}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="row-received" className={labelClass}>تاريخ الاستلام (اختياري)</label>
          <input id="row-received" type="date" value={receivedAt} onChange={(e) => edited(setReceivedAt)(e.target.value)} className={fieldClass} />
        </div>
      </div>
      {readOnly && <p id="row-readonly-hint" className="text-[11px] text-slate-500">رقم المناقصة وموضوعها يُعدَّلان من إعدادات المناقصة.</p>}
      {error && <p role="alert" className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</p>}
      {saved && !error && <p role="status" className="text-xs font-bold text-emerald-700">حُفظت البيانات</p>}
      <div className="flex items-center justify-between gap-2">
        {mode === 'order' ? (
          <button type="button" onClick={handleDeleteOrder} className="px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50 rounded-lg cursor-pointer">حذف الطلبية</button>
        ) : <span />}
        <button type="button" onClick={handleSave} className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-lg shadow-sm cursor-pointer">
          {mode === 'new' ? 'حفظ الطلبية' : 'حفظ البيانات'}
        </button>
      </div>
    </section>
  );

  if (mode === 'tender') {
    return (
      <OrderStatusModal
        isOpen stacked onClose={onClose}
        title="تعديل موقف الطلبية" subtitle={[project!.referenceNumber, project!.title].filter(Boolean).join(' — ')}
        statusLog={project!.statusLog ?? []} suggestions={[...new Set(project!.bidders.map(b => b.name.trim()).filter(Boolean))]} detailsSlot={detailsSection}
        onAdd={tenderHandlers!.handleAddStatus} onEdit={tenderHandlers!.handleEditStatus} onDelete={tenderHandlers!.handleDeleteStatus}
      />
    );
  }
  return (
    <OrderStatusModal
      isOpen stacked onClose={onClose}
      title={mode === 'new' ? 'طلبية بلا تحليل' : 'تعديل موقف الطلبية'}
      subtitle={mode === 'new' ? 'أدخل بياناتها ثم احفظ لتضيف مواقفها' : [order!.referenceNumber, order!.title].filter(Boolean).join(' — ')}
      statusLog={order?.statusLog ?? []} detailsSlot={detailsSection}
      statusHidden={mode === 'new'} statusHiddenNote="احفظ بيانات الطلبية أولاً ثم أضف مواقفها"
      onAdd={(i) => orderHandlers.handleAddOrderStatus(order!.id, i)}
      onEdit={(id, i) => orderHandlers.handleEditOrderStatus(order!.id, id, i)}
      onDelete={(id) => orderHandlers.handleDeleteOrderStatus(order!.id, id)}
    />
  );
};

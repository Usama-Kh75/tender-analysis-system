import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MapPin, X } from 'lucide-react';
import type { TenderProject } from '../../types/tender';
import type { StatusInput } from '../../app/statusHandlers';
import { OrderStatusPanel } from '../OrderStatusPanel';
import type { StatusFormPreset } from '../../utils/statusPreset';

interface StatusWindowProps {
  isOpen: boolean;
  onClose: () => void;
  project: TenderProject;
  onAdd: (input: StatusInput) => string | null;
  onEdit: (id: string, input: StatusInput) => string | null;
  onDelete: (id: string) => void;
  onOpenSheet: () => void;
  // نموذج فيه إدخال لم يُحفظ: يمنع «حفظ والتحديث» (blockingWork في App)
  onDirtyChange: (dirty: boolean) => void;
  preset?: StatusFormPreset;
}

// نافذة سجل موقف الطلبية: تفتح من زر الموقف في رأس المناقصة (كان تبويباً). تلفّ OrderStatusPanel القائمة بلا تغيير في سلوكها.
// الإغلاق بالزر وEscape وبفتح «كشف الموقف» يمرّ كله بدالة واحدة تسأل قبل ضياع كتابة لم تُحفظ
export const StatusWindow: React.FC<StatusWindowProps> = ({
  isOpen, onClose, project, onAdd, onEdit, onDelete, onOpenSheet, onDirtyChange, preset
}) => {
  const [dirty, setDirty] = useState(false);
  const dirtyRef = useRef(false);

  const handleDirty = useCallback((d: boolean) => {
    dirtyRef.current = d;
    setDirty(d);
    onDirtyChange(d);
  }, [onDirtyChange]);

  // الإغلاق للانتقال إلى «كشف الموقف» لا يعيد المؤشر إلى شارة الموقف: الكشف يأخذه (مراجعة Antigravity 2026-11-19)
  const handoffRef = useRef(false);
  const requestClose = useCallback((then?: () => void) => {
    if (dirtyRef.current && !window.confirm('في نموذج الموقف ما لم يُحفظ. أتغلق النافذة دونه؟')) return;
    handoffRef.current = !!then;
    onClose();
    then?.();
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') requestClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, requestClose]);

  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!isOpen) return;
    handoffRef.current = false;
    const prev = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    return () => { if (!handoffRef.current && prev && prev.isConnected) prev.focus(); };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 print:hidden" role="dialog" aria-modal="true" aria-labelledby="status-window-title">
      <div className="bg-slate-50 rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/20 text-amber-400 rounded-lg">
              <MapPin className="w-5 h-5" />
            </div>
            <h2 id="status-window-title" className="text-base sm:text-lg font-bold">موقف الطلبية</h2>
          </div>
          <button type="button" ref={closeRef} onClick={() => requestClose()} aria-label="إغلاق" data-dirty={dirty} className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 sm:p-6 flex-1 overflow-y-auto">
          <OrderStatusPanel
            key={`${project.id}:${preset?.seq ?? 0}`}
            preset={preset}
            project={project}
            onAdd={onAdd}
            onEdit={onEdit}
            onDelete={onDelete}
            onOpenSheet={() => requestClose(onOpenSheet)}
            onDirtyChange={handleDirty}
          />
        </div>
      </div>
    </div>
  );
};

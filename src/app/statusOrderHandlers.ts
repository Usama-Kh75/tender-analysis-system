import type { StatusEntry, StatusOrder } from '../types/tender';
import { isValidDate } from '../utils/orderStatus';
import { announcementLabel } from '../utils/tenderDetails';
import { applyStatusAdd, applyStatusDelete, applyStatusEdit, type StatusInput } from './statusHandlers';

export interface StatusOrderDetails {
  referenceNumber: string;
  title: string;
  announcementNo?: number;
  receivedAt?: string;
}

// معالجات الطلبيات بلا تحليل: تعيد رسالة عربية عند الخطأ ولا ترمي. لا سجل تدقيق لها: سجل المواقف هو سجلها
export function createStatusOrderHandlers(orders: StatusOrder[], setOrders: (f: (prev: StatusOrder[]) => StatusOrder[]) => void) {
  const touch = (id: string, change: (o: StatusOrder) => StatusOrder) =>
    setOrders(prev => prev.map(o => o.id === id ? { ...change(o), updatedAt: new Date().toISOString() } : o));

  const checkDetails = (d: StatusOrderDetails): string | null => {
    if (!d.referenceNumber.trim() && !d.title.trim()) return 'اكتب رقم الطلبية أو موضوعها';
    if (d.receivedAt && !isValidDate(d.receivedAt)) return 'تاريخ الاستلام غير صالح';
    if (d.announcementNo !== undefined && !announcementLabel(d.announcementNo)) return 'الإعلان غير معروف';
    return null;
  };
  const tidy = (d: StatusOrderDetails) => ({
    referenceNumber: d.referenceNumber.trim(),
    title: d.title.trim(),
    announcementNo: d.announcementNo,
    receivedAt: d.receivedAt?.trim() || undefined
  });

  /** يضيف طلبية ويعيد معرّفها، أو رسالة الخطأ. */
  const handleAddOrder = (d: StatusOrderDetails): { id: string } | { error: string } => {
    const error = checkDetails(d);
    if (error) return { error };
    const now = new Date().toISOString();
    const order: StatusOrder = { id: `order-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`, ...tidy(d), statusLog: [], createdAt: now, updatedAt: now };
    setOrders(prev => [...prev, order]);
    return { id: order.id };
  };

  const handleEditOrder = (id: string, d: StatusOrderDetails): string | null => {
    if (!orders.some(o => o.id === id)) return 'الطلبية غير موجودة';
    const error = checkDetails(d);
    if (error) return error;
    touch(id, o => ({ ...o, ...tidy(d) }));
    return null;
  };

  const handleDeleteOrder = (id: string): void => setOrders(prev => prev.filter(o => o.id !== id));

  const withLog = (id: string, change: (log: StatusEntry[]) => { error: string } | { log: StatusEntry[] }): string | null => {
    const order = orders.find(o => o.id === id);
    if (!order) return 'الطلبية غير موجودة';
    const r = change(order.statusLog);
    if ('error' in r) return r.error;
    touch(id, o => ({ ...o, statusLog: r.log }));
    return null;
  };

  const handleAddOrderStatus = (id: string, input: StatusInput): string | null => withLog(id, log => applyStatusAdd(log, input));
  const handleEditOrderStatus = (id: string, statusId: string, input: StatusInput): string | null => withLog(id, log => applyStatusEdit(log, statusId, input));
  const handleDeleteOrderStatus = (id: string, statusId: string): void => {
    withLog(id, log => applyStatusDelete(log, statusId) ?? { error: 'الموقف غير موجود' });
  };

  return { handleAddOrder, handleEditOrder, handleDeleteOrder, handleAddOrderStatus, handleEditOrderStatus, handleDeleteOrderStatus };
}

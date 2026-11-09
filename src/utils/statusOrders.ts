import type { StatusOrder } from '../types/tender';
import { isValidDate, sanitizeStatusLog } from './orderStatus';
import { announcementLabel } from './tenderDetails';
import { STATUS_ORDERS_KEY, isSaveBlocked, stashRecovered } from './storageService';

/**
 * طلبيات كشف الموقف بلا تحليل (مثل طلبية أُعيد إعلانها لعدم استيفاء معايير التأهيل فلم تُحلَّل).
 * ليست مناقصات: لا تدخل قائمة المناقصات ولا تصير المناقصة الحالية، وسجل مواقفها هو سجلها الوحيد.
 */

const isText = (v: unknown): v is string => typeof v === 'string';

/** توحيد قائمة خام (من التخزين أو نسخة احتياطية): العنصر غير الصالح يُتخطى، والحقول الفاسدة تُهمل. */
export function normalizeStatusOrders(raw: unknown): StatusOrder[] {
  if (!Array.isArray(raw)) return [];
  const out: StatusOrder[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    if (!isText(o.id) || o.id === '' || seen.has(o.id)) continue;
    const referenceNumber = isText(o.referenceNumber) ? o.referenceNumber : '';
    const title = isText(o.title) ? o.title : '';
    if (!referenceNumber.trim() && !title.trim()) continue;
    seen.add(o.id);
    const now = new Date().toISOString();
    out.push({
      id: o.id,
      referenceNumber,
      title,
      announcementNo: typeof o.announcementNo === 'number' && announcementLabel(o.announcementNo) ? o.announcementNo : undefined,
      receivedAt: isValidDate(o.receivedAt) ? o.receivedAt : undefined,
      statusLog: sanitizeStatusLog(o.statusLog),
      createdAt: isText(o.createdAt) ? o.createdAt : now,
      updatedAt: isText(o.updatedAt) ? o.updatedAt : isText(o.createdAt) ? o.createdAt : now
    });
  }
  return out;
}

export function getStatusOrders(): StatusOrder[] {
  let data: string | null = null;
  try { data = localStorage.getItem(STATUS_ORDERS_KEY); } catch { return []; }
  if (!data) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch {
    stashRecovered(data, 'نص طلبيات الكشف المحفوظة تالف ولا يُقرأ');
    return [];
  }
  if (!Array.isArray(parsed)) {
    stashRecovered(data, 'طلبيات الكشف المحفوظة ليست قائمة');
    return [];
  }
  const orders = normalizeStatusOrders(parsed);
  if (orders.length < parsed.length) {
    stashRecovered(data, `${parsed.length - orders.length} عنصر من طلبيات الكشف لا يُقرأ`);
  }
  return orders;
}

export function saveStatusOrders(orders: StatusOrder[]): void {
  if (isSaveBlocked()) return;
  try { localStorage.setItem(STATUS_ORDERS_KEY, JSON.stringify(orders)); } catch { /* تخزين محظور */ }
}

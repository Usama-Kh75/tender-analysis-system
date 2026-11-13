import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, Plus, Trash2, X } from 'lucide-react';
import { BOQItem } from '../../types/tender';
import { parseArabicNumber } from '../../utils/calculations';
import { auditRowAmounts } from '../../utils/bidderAuditEngine';
import { estimateMergeConfirmText, EstimateTableRow, planEstimateMerge } from '../../utils/estimateMerge';
import { ImportMode } from './SmartTableImportModal';

// إدخال يدوي من الورقة للعطاءات ذات الفقرات القليلة (بلا قراءة آلية مدفوعة). لا يكتب شيئاً بنفسه: يبني
// Partial<BOQItem>[] ويمرّره إلى handleApplyExtractedItems بالمسار نفسه (الكمية المشتركة، هوية الفقرة، دمج الكلفة
// برقم الفقرة، فحص الضرب والتفقيط). المبلغ لا يُملأ تلقائياً: الملء يُخفي خطأ ضرب المجهز، والتحذير هنا عرض فقط.

type ManualKind = Extract<ImportMode, 'bidder_only' | 'new_bidder' | 'estimated_only'>;

interface Row {
  key: number;
  itemNo: string;
  description: string;
  unit: string;
  qty: string;
  unitPrice: string;
  amount: string;
  written: string;
  unpriced: boolean;
}

interface ManualEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (items: Partial<BOQItem>[], mode: ImportMode, bidderName?: string) => void;
  currentBidderName: string;
  // فقرات الجدول (referenceRows): كمية الفقرة الفارغة صفر، فلا فقرات حقيقية = مناقصة جديدة تبدأ بصف فارغ
  tableRows: EstimateTableRow[];
  tableUnits: (string | undefined)[];
  // يخبر App بوجود أرقام مكتوبة لم تُحفظ (blockingWork)
  onDirtyChange?: (dirty: boolean) => void;
}

const COLS = { itemNo: 0, description: 1, unit: 2, qty: 3, unitPrice: 4, amount: 5, written: 6 } as const;
const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 3 });
const inputCls = 'w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:bg-slate-100 disabled:text-slate-400';

export const ManualEntryModal: React.FC<ManualEntryModalProps> = ({ isOpen, onClose, onApply, currentBidderName, tableRows, tableUnits, onDirtyChange }) => {
  const tableMode = tableRows.some(r => r.quantity > 0);
  const [kind, setKind] = useState<ManualKind>('bidder_only');
  const [newName, setNewName] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const keySeq = useRef(0);
  const bodyRef = useRef<HTMLDivElement>(null);
  const pendingFocus = useRef<{ r: number; c: number } | null>(null);

  const blankRow = (itemNo: string, i?: number): Row => ({
    key: keySeq.current++, itemNo, description: '', unit: '',
    qty: i !== undefined && tableRows[i]?.quantity > 0 ? String(tableRows[i].quantity) : '',
    unitPrice: '', amount: '', written: '', unpriced: false
  });
  const initialRows = () => tableMode
    ? tableRows.map((t, i) => ({ ...blankRow(String(t.itemNo), i), description: t.description?.startsWith('فقرة ') ? '' : (t.description || ''), unit: tableUnits[i] || '' }))
    : [blankRow('1')];

  useEffect(() => {
    if (!isOpen) return;
    setKind('bidder_only');
    setNewName('');
    setRows(initialRows());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const isEstimate = kind === 'estimated_only';
  const tableQty = (i: number) => tableRows[i]?.quantity || 0;
  // كمية الصف للحساب: كمية الجدول لعطاء المجهز (مشتركة)، والمكتوبة للكلفة التخمينية أو لجدول جديد
  const qtyOf = (row: Row, i: number) => tableMode && !isEstimate ? tableQty(i) : parseArabicNumber(row.qty);
  const isEntered = (row: Row, i: number) => {
    if (row.unitPrice.trim() || row.amount.trim() || row.written.trim() || row.unpriced) return true;
    if (!tableMode) return !!(row.description.trim() || row.qty.trim());
    return isEstimate && parseArabicNumber(row.qty) > 0 && parseArabicNumber(row.qty) !== tableQty(i);
  };
  const dirty = rows.some(isEntered) || !!newName.trim();
  useEffect(() => { onDirtyChange?.(isOpen && dirty); }, [dirty, isOpen, onDirtyChange]);

  useEffect(() => {
    const p = pendingFocus.current;
    if (!p) return;
    pendingFocus.current = null;
    bodyRef.current?.querySelector<HTMLInputElement>(`[data-r="${p.r}"][data-c="${p.c}"]:not(:disabled)`)?.focus();
  }, [rows.length]);

  const live = useMemo(() => {
    let total = 0, priced = 0;
    rows.forEach((row, i) => {
      if (row.unpriced) return;
      const unit = parseArabicNumber(row.unitPrice);
      const amount = parseArabicNumber(row.amount);
      const v = amount > 0 ? amount : unit * qtyOf(row, i);
      if (v > 0) { total += v; priced++; }
    });
    return { total, priced };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, kind, tableMode]);

  if (!isOpen) return null;

  const setRow = (key: number, patch: Partial<Row>) => setRows(rs => rs.map(r => r.key === key ? { ...r, ...patch } : r));
  const addRow = (focusCol?: number) => {
    setRows(rs => {
      const last = parseInt(rs[rs.length - 1]?.itemNo || '', 10);
      const next = String(Number.isFinite(last) ? last + 1 : rs.length + 1);
      if (focusCol !== undefined) pendingFocus.current = { r: rs.length, c: focusCol };
      return [...rs, blankRow(next)];
    });
  };
  const onKey = (e: React.KeyboardEvent<HTMLInputElement>, r: number, c: number) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const next = bodyRef.current?.querySelector<HTMLInputElement>(`[data-r="${r + 1}"][data-c="${c}"]:not(:disabled)`);
    if (next) next.focus();
    else if (!tableMode && r === rows.length - 1) addRow(c);
  };
  const switchKind = (k: ManualKind) => {
    if (k === kind) return;
    if (dirty && !window.confirm('تغيير نوع الإدخال يمسح ما كتبته. متابعة؟')) return;
    setKind(k);
    setNewName('');
    setRows(initialRows());
  };
  const requestClose = () => {
    if (dirty && !window.confirm('فيها أرقام لم تُحفظ. إغلاق النافذة يمحوها. إغلاق؟')) return;
    onClose();
  };

  const save = () => {
    const entered = rows.map((row, i) => ({ row, i })).filter(({ row, i }) => isEntered(row, i));
    if (entered.length === 0) { alert('لم تُكتب أي فقرة.'); return; }
    if (!tableMode) {
      const bad = entered.find(({ row }) => !(parseArabicNumber(row.qty) > 0));
      if (bad) { alert(`الفقرة (${bad.row.itemNo || bad.i + 1}): اكتب الكمية.`); return; }
      const noNo = entered.find(({ row }) => !row.itemNo.trim());
      if (noNo) { alert(`الفقرة رقم ${noNo.i + 1} بلا رقم فقرة.`); return; }
    }
    const build = ({ row, i }: { row: Row; i: number }): Partial<BOQItem> => {
      const unit = parseArabicNumber(row.unitPrice);
      const amount = parseArabicNumber(row.amount);
      const qty = qtyOf(row, i);
      const identity: Partial<BOQItem> = {
        itemNo: row.itemNo.trim() || String(i + 1),
        description: row.description.trim() || undefined,
        unit: row.unit.trim() || undefined,
        quantity: qty > 0 ? qty : undefined
      };
      if (isEstimate) {
        return { ...identity, estimatedTotal: amount > 0 ? amount : unit * qty, enteredUnitPrice: unit > 0 ? unit : undefined };
      }
      if (row.unpriced) return { ...identity, bidderTotal: 0, unpriced: true };
      // بلا مبلغ مكتوب: يبقى المبلغ فارغاً فيشتقه calculateBOQMetrics من المفرد × الكمية (بلا فحص ضرب)
      return {
        ...identity,
        bidderTotal: amount > 0 ? amount : 0,
        enteredUnitPrice: unit > 0 ? unit : undefined,
        enteredBidderTotal: amount > 0 ? amount : undefined,
        writtenText: row.written.trim() || undefined
      };
    };

    if (!isEstimate) {
      const noAmount = entered.filter(({ row }) => !row.unpriced && parseArabicNumber(row.unitPrice) > 0 && !(parseArabicNumber(row.amount) > 0)).length;
      if (noAmount > 0 && !window.confirm(`${noAmount} فقرة بلا مبلغ: سيُحسب مبلغها الكمية × المفرد ولن يُفحص فيها خطأ الضرب. متابعة؟`)) return;
    }

    let items: Partial<BOQItem>[];
    if (tableMode && !isEstimate) {
      // متفرقة بموضع الفقرة: ما لم يُكتب يبقى صفه كما هو (handleApplyExtractedItems)
      items = [];
      for (const e of entered) items[e.i] = build(e);
    } else {
      items = entered.map(build);
    }
    if (isEstimate) {
      const text = estimateMergeConfirmText(planEstimateMerge(items, tableRows));
      if (text && !window.confirm(text)) return;
    }
    onApply(items, kind, kind === 'new_bidder' ? newName.trim() || undefined : undefined);
    onClose();
  };

  const kinds: { id: ManualKind; label: string }[] = [
    { id: 'bidder_only', label: `عطاء المجهز النشط (${currentBidderName})` },
    { id: 'new_bidder', label: 'مجهز جديد' },
    { id: 'estimated_only', label: 'الكلفة التخمينية' }
  ];
  const unitLabel = isEstimate ? 'المفرد التخميني' : 'سعر المفرد';
  const amountLabel = isEstimate ? 'المبلغ التخميني' : 'المبلغ كما في الورقة';

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-6xl max-h-[94vh] flex flex-col overflow-hidden">
        <div className="p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600 rounded-2xl shadow-md"><Keyboard className="w-6 h-6" /></div>
            <div>
              <h2 className="text-lg font-black">إدخال يدوي من الورقة</h2>
              <p className="text-xs text-slate-300 mt-0.5">للعطاءات ذات الفقرات القليلة. Tab بين الخانات، وEnter ينقلك إلى الخانة نفسها في الفقرة التالية. الأرقام العربية-الهندية والفواصل تُقبل.</p>
            </div>
          </div>
          <button onClick={requestClose} className="p-2 text-slate-400 hover:text-white rounded-xl cursor-pointer" aria-label="إغلاق"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-4 border-b border-slate-200 flex flex-wrap items-center gap-2">
          {kinds.map(k => (
            <button key={k.id} type="button" onClick={() => switchKind(k.id)} aria-pressed={kind === k.id}
              className={`text-xs font-black px-3 py-2 rounded-xl border cursor-pointer ${kind === k.id ? 'bg-indigo-700 text-white border-indigo-700' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'}`}>
              {k.label}
            </button>
          ))}
          {kind === 'new_bidder' && (
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="اسم المجهز الجديد" className={`${inputCls} max-w-xs`} />
          )}
        </div>

        <div ref={bodyRef} className="flex-1 overflow-auto p-4">
          <table className="w-full text-xs border-separate border-spacing-y-1">
            <thead className="sticky top-0 bg-white z-10">
              <tr className="text-slate-500 font-black text-right">
                <th className="px-1 w-14">ت</th>
                <th className="px-1">الوصف</th>
                <th className="px-1 w-20">الوحدة</th>
                <th className="px-1 w-24">الكمية</th>
                <th className="px-1 w-32">{unitLabel}</th>
                <th className="px-1 w-40">{amountLabel}</th>
                {!isEstimate && <th className="px-1 w-48">التفقيط (اختياري)</th>}
                {!isEstimate && <th className="px-1 w-20">غير مسعّرة</th>}
                {!tableMode && <th className="w-8" />}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const unit = parseArabicNumber(row.unitPrice);
                const amount = parseArabicNumber(row.amount);
                const qty = qtyOf(row, i);
                const flags = !isEstimate && !row.unpriced ? auditRowAmounts(qty, unit, amount, row.written.trim()) : { hasMathError: false, hasTextDiscrepancy: false };
                const mathMismatch = isEstimate ? (unit > 0 && amount > 0 && qty > 0 && Math.abs(unit * qty - amount) > 0.01) : flags.hasMathError && amount > 0;
                const readOnlyIdentity = tableMode;
                const cell = (c: number, value: string, key: keyof Row, extra?: { disabled?: boolean; ltr?: boolean; numeric?: boolean }) => (
                  <input
                    data-r={i} data-c={c}
                    value={value}
                    disabled={extra?.disabled}
                    inputMode={extra?.numeric ? 'decimal' : undefined}
                    dir={extra?.ltr ? 'ltr' : undefined}
                    onChange={e => setRow(row.key, { [key]: e.target.value } as Partial<Row>)}
                    onKeyDown={e => onKey(e, i, c)}
                    className={inputCls}
                  />
                );
                return (
                  <React.Fragment key={row.key}>
                    <tr className="align-top">
                      <td className="px-1">{tableMode ? <span className="font-black text-slate-700">{row.itemNo}</span> : cell(COLS.itemNo, row.itemNo, 'itemNo')}</td>
                      <td className="px-1">{readOnlyIdentity ? <span className="text-slate-700">{row.description || '—'}</span> : cell(COLS.description, row.description, 'description')}</td>
                      <td className="px-1">{readOnlyIdentity ? <span className="text-slate-600">{row.unit || '—'}</span> : cell(COLS.unit, row.unit, 'unit')}</td>
                      <td className="px-1">
                        {tableMode && !isEstimate
                          ? <span className="font-black text-slate-700">{tableQty(i) > 0 ? fmt(tableQty(i)) : '—'}</span>
                          : cell(COLS.qty, row.qty, 'qty', { ltr: true, numeric: true })}
                      </td>
                      <td className="px-1">{cell(COLS.unitPrice, row.unitPrice, 'unitPrice', { ltr: true, numeric: true, disabled: row.unpriced })}</td>
                      <td className="px-1">
                        {cell(COLS.amount, row.amount, 'amount', { ltr: true, numeric: true, disabled: row.unpriced })}
                        {unit > 0 && qty > 0 && !row.unpriced && <div className="text-[10px] text-slate-400 mt-0.5" dir="ltr">{fmt(qty)} × {fmt(unit)} = {fmt(unit * qty)}</div>}
                      </td>
                      {!isEstimate && <td className="px-1">{cell(COLS.written, row.written, 'written', { disabled: row.unpriced })}</td>}
                      {!isEstimate && (
                        <td className="px-1 text-center pt-2">
                          <input type="checkbox" checked={row.unpriced} aria-label={`الفقرة ${row.itemNo} غير مسعّرة`}
                            onChange={e => setRow(row.key, { unpriced: e.target.checked })} />
                        </td>
                      )}
                      {!tableMode && (
                        <td className="px-1 pt-1">
                          <button type="button" onClick={() => setRows(rs => rs.length > 1 ? rs.filter(r => r.key !== row.key) : [blankRow('1')])}
                            className="p-1 text-slate-400 hover:text-red-600 cursor-pointer" aria-label="حذف الفقرة" title="حذف الفقرة"><Trash2 className="w-4 h-4" /></button>
                        </td>
                      )}
                    </tr>
                    {(mathMismatch || flags.hasTextDiscrepancy) && (
                      <tr>
                        <td />
                        <td colSpan={8} className="px-1 pb-1 text-[11px] font-bold text-amber-700">
                          {mathMismatch && <span className="ml-4">يختلف عن حاصل الضرب: {isEstimate ? 'تأكد من الورقة' : 'سيُعلَّم للجنة'}</span>}
                          {flags.hasTextDiscrepancy && <span>التفقيط لا يطابق المفرد ولا المبلغ: سيُعلَّم للجنة</span>}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
          {!tableMode && (
            <button type="button" onClick={() => addRow()} className="mt-2 flex items-center gap-1.5 text-xs font-black text-indigo-700 hover:text-indigo-900 cursor-pointer">
              <Plus className="w-4 h-4" /> إضافة فقرة
            </button>
          )}
        </div>

        <div className="p-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50">
          <div className="text-xs font-bold text-slate-600">
            المجموع المُدخل: <span className="text-slate-900 font-black" dir="ltr">{fmt(live.total)}</span>
            <span className="mx-2 text-slate-300">|</span>
            المسعّرة: <span className="text-slate-900 font-black">{live.priced}</span> من {rows.length} فقرة
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={requestClose} className="px-4 py-2 text-xs font-black text-slate-600 hover:bg-slate-200 rounded-xl cursor-pointer">إلغاء</button>
            <button type="button" onClick={save} disabled={!dirty}
              className="px-5 py-2 text-xs font-black text-white bg-indigo-700 hover:bg-indigo-600 disabled:bg-slate-300 rounded-xl cursor-pointer">حفظ</button>
          </div>
        </div>
      </div>
    </div>
  );
};

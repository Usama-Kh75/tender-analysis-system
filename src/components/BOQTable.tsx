import React, { useState } from 'react';
import { 
  Plus, 
  Trash2, 
  Search, 
  FileCheck2, 
  Copy, 
  AlertTriangle, 
  CheckCircle2, 
  ShieldCheck, 
  Zap, 
  FileText, 
  ClipboardPaste,
  FileSpreadsheet,
  Info
} from 'lucide-react';
import { BOQItem, TenderTotals } from '../types/tender';
import { formatNumber } from '../utils/calculations';

interface BOQTableProps {
  items: BOQItem[];
  totals: TenderTotals;
  currency: string;
  deviationThreshold: number;
  onUpdateItem: (index: number, field: keyof BOQItem, value: any) => void;
  onAddItem: () => void;
  onDeleteItem: (index: number) => void;
  onDuplicateItem: (index: number) => void;
  onBatchAddItems?: (newItems: Partial<BOQItem>[]) => void;
}

export type ViewPreset = 'source_excel' | 'quick_fast' | 'detailed_desc';

export const BOQTable: React.FC<BOQTableProps> = ({
  items,
  totals,
  currency,
  deviationThreshold,
  onUpdateItem,
  onAddItem,
  onDeleteItem,
  onDuplicateItem,
  onBatchAddItems
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'deviated' | 'savings'>('all');
  const [viewPreset, setViewPreset] = useState<ViewPreset>('source_excel'); // النمط المصدري المعتمد
  const [pasteNotice, setPasteNotice] = useState<string | null>(null);

  const filteredItems = items.filter((item) => {
    const matchesSearch = 
      String(item.itemNo).includes(searchTerm) || 
      (item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase()));
    
    if (!matchesSearch) return false;

    if (filterMode === 'deviated') return item.isDeviated;
    if (filterMode === 'savings') return item.diffAmount < 0;
    return true;
  });

  // معالجة اللصق الذكي من Excel (Ctrl + V)
  const handleTablePaste = (e: React.ClipboardEvent) => {
    const pastedData = e.clipboardData.getData('text');
    if (!pastedData || (!pastedData.includes('\t') && !pastedData.includes('\n'))) {
      return;
    }

    const rows = pastedData.trim().split(/\r?\n/).map(r => r.split('\t'));
    if (rows.length === 0) return;

    const parsedRows: Partial<BOQItem>[] = [];
    let startNo = items.length + 1;

    for (const row of rows) {
      const cleanNum = (val: string) => {
        if (!val) return 0;
        const cleaned = val.replace(/,/g, '').trim();
        return parseFloat(cleaned) || 0;
      };

      if (row.length === 1) {
        parsedRows.push({
          itemNo: startNo++,
          description: 'فقرة ' + (startNo - 1),
          quantity: 1,
          estimatedTotal: 0,
          bidderTotal: cleanNum(row[0])
        });
      } else if (row.length === 2) {
        parsedRows.push({
          itemNo: startNo++,
          description: 'فقرة ' + (startNo - 1),
          quantity: 1,
          estimatedTotal: cleanNum(row[0]),
          bidderTotal: cleanNum(row[1])
        });
      } else if (row.length >= 3) {
        const isFirstNum = !isNaN(Number(row[0].trim()));
        parsedRows.push({
          itemNo: isFirstNum ? row[0].trim() : startNo++,
          description: !isFirstNum ? row[0].trim() : 'فقرة ' + row[0].trim(),
          quantity: 1,
          estimatedTotal: cleanNum(row[1]),
          bidderTotal: cleanNum(row[2])
        });
      }
    }

    if (parsedRows.length > 0 && onBatchAddItems) {
      e.preventDefault();
      onBatchAddItems(parsedRows);
      setPasteNotice('تم لصق وإدراج (' + parsedRows.length + ') فقرة بنجاح من الحافظة!');
      setTimeout(() => setPasteNotice(null), 4000);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, rowIndex: number, field: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (rowIndex === items.length - 1) {
        onAddItem();
      } else {
        const nextInput = document.getElementById('input-' + field + '-' + (rowIndex + 1));
        nextInput?.focus();
      }
    }
  };

  return (
    <div 
      className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden mb-8 outline-none"
      onPaste={handleTablePaste}
      tabIndex={0}
    >
      
      {/* Table Toolbar */}
      <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
        
        {/* View Mode Presets Switcher */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <FileCheck2 className="w-5 h-5 text-blue-600" />
            <h3 className="font-black text-slate-900 text-sm sm:text-base">
              جدول التحليل والتقييم المالي
            </h3>
          </div>

          {/* 3 View Modes Buttons */}
          <div className="flex items-center bg-slate-200/80 p-1 rounded-2xl text-xs font-black border border-slate-300">
            
            {/* النمط المصدري Excel */}
            <button
              onClick={() => setViewPreset('source_excel')}
              className={'flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl transition cursor-pointer ' + (
                viewPreset === 'source_excel'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'text-slate-700 hover:text-slate-950'
              )}
              title="عرض الجدول بنفس مصفوفة وترتيب أعمدة ملف Excel المرجعي المعتمد"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>النمط المصدري المعتمد (Excel) 📑</span>
            </button>

            {/* النمط السريع */}
            <button
              onClick={() => setViewPreset('quick_fast')}
              className={'flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition cursor-pointer ' + (
                viewPreset === 'quick_fast'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'text-slate-700 hover:text-slate-950'
              )}
              title="إدخال مالي سريع ومباشر للأسعار"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>النمط السريع ⚡</span>
            </button>
            
            {/* النمط الشامل التفصيلي */}
            <button
              onClick={() => setViewPreset('detailed_desc')}
              className={'flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition cursor-pointer ' + (
                viewPreset === 'detailed_desc'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-700 hover:text-slate-950'
              )}
              title="إظهار كافة التفاصيل مع وصف الفقرة والتقييم"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>النمط الشامل مع الأوصاف 📝</span>
            </button>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
            <input
              type="text"
              placeholder="بحث برقم أو وصف الفقرة..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-white border border-slate-300 rounded-xl text-xs sm:text-sm pr-9 pl-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 w-44 sm:w-52 shadow-2xs"
            />
          </div>

          <div className="flex items-center bg-white border border-slate-300 rounded-xl p-1 text-xs font-bold shadow-2xs">
            <button
              onClick={() => setFilterMode('all')}
              className={'px-3 py-1.5 rounded-lg transition cursor-pointer ' + (
                filterMode === 'all' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              )}
            >
              الكل ({items.length})
            </button>
            <button
              onClick={() => setFilterMode('deviated')}
              className={'px-3 py-1.5 rounded-lg transition cursor-pointer ' + (
                filterMode === 'deviated' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-600 hover:text-rose-700'
              )}
            >
              المنحرفة &gt; {deviationThreshold}% ({totals.deviatedItemsCount})
            </button>
            <button
              onClick={() => setFilterMode('savings')}
              className={'px-3 py-1.5 rounded-lg transition cursor-pointer ' + (
                filterMode === 'savings' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-emerald-700'
              )}
            >
              وفورات ({items.filter(i => i.diffAmount < 0).length})
            </button>
          </div>

          <button
            onClick={onAddItem}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black px-4 py-2 rounded-xl shadow-sm transition transform active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ إضافة فقرة</span>
          </button>
        </div>
      </div>

      {/* Mode Guidance Sub-Bar */}
      {viewPreset === 'source_excel' && (
        <div className="bg-emerald-50 border-b border-emerald-200 px-5 py-2 text-xs flex items-center justify-between text-emerald-900 font-medium">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-emerald-700" />
            <span>
              <strong>النمط المصدري المعتمد (Excel):</strong> حقول الإدخال المباشر هي <span className="font-bold text-blue-800">[المبلغ التخميني]</span> و <span className="font-bold text-indigo-800">[مبلغ المجهز]</span>، وباقي الأعمدة محتسبة آلياً ومحمية للعرض والمطابقة.
            </span>
          </div>
          <span className="font-mono text-emerald-800 text-[11px] font-bold">
            مطابق لجدول نهائي.xlsx
          </span>
        </div>
      )}

      {/* Paste Notice */}
      {pasteNotice && (
        <div className="bg-emerald-600 text-white text-xs font-bold px-4 py-2 text-center animate-bounce">
          {pasteNotice}
        </div>
      )}

      {/* Spreadsheet Table Container */}
      <div className="overflow-x-auto max-h-[620px] relative">
        <table className="w-full text-xs sm:text-sm text-right border-collapse">
          
          <thead className="bg-slate-900 text-slate-100 uppercase text-xs font-black sticky top-0 z-20 shadow-xs select-none">
            {viewPreset === 'source_excel' ? (
              /* النمط المصدري المعتمد (مطابق لملف Excel المرجعي) */
              <tr>
                <th className="p-3.5 w-16 text-center border-l border-slate-800">الفقرة</th>
                <th className="p-3.5 w-40 text-center bg-indigo-950 border-l border-slate-800 text-indigo-300">مبلغ المجهز ✏️</th>
                <th className="p-3.5 w-40 text-center bg-blue-950 border-l border-slate-800 text-blue-300">المبلغ التخميني ✏️</th>
                <th className="p-3.5 w-32 text-center border-l border-slate-800">نسبة الانحراف</th>
                <th className="p-3.5 w-36 text-center border-l border-slate-800 bg-rose-950 text-rose-300">الفقرة المنحرفة</th>
                <th className="p-3.5 w-28 text-center border-l border-slate-800 bg-purple-950/80 text-purple-200">النسبة السعرية</th>
                <th className="p-3.5 w-40 text-center border-l border-slate-800 bg-purple-950 text-purple-200">السعر الجديد (للمجهز)</th>
                <th className="p-3.5 w-24 text-center border-l border-slate-800">الكمية</th>
                <th className="p-3.5 w-40 text-center border-l border-slate-800 bg-purple-950 text-purple-200">المفرد المجهز الموزون</th>
                <th className="p-3.5 w-20 text-center">إجراءات</th>
              </tr>
            ) : viewPreset === 'quick_fast' ? (
              /* النمط السريع */
              <tr>
                <th className="p-3.5 w-16 text-center border-l border-slate-800">ت</th>
                <th className="p-3.5 w-44 text-center bg-blue-950 border-l border-slate-800 text-blue-300">المبلغ التخميني ✏️</th>
                <th className="p-3.5 w-44 text-center bg-indigo-950 border-l border-slate-800 text-indigo-300">مبلغ المجهز ✏️</th>
                <th className="p-3.5 w-32 text-center border-l border-slate-800">نسبة الانحراف %</th>
                <th className="p-3.5 w-36 text-center border-l border-slate-800 bg-rose-950 text-rose-300">الفقرة المنحرفة (&gt;{deviationThreshold}%)</th>
                <th className="p-3.5 w-44 text-center border-l border-slate-800 bg-purple-950 text-purple-200">المفرد المجهز الموزون</th>
                <th className="p-3.5 w-28 text-center border-l border-slate-800">التقييم</th>
                <th className="p-3.5 w-20 text-center">إجراءات</th>
              </tr>
            ) : (
              /* النمط الشامل مع الأوصاف */
              <tr>
                <th className="p-3.5 w-16 text-center border-l border-slate-800">ت</th>
                <th className="p-3.5 min-w-[240px] border-l border-slate-800">وصف وتفاصيل الفقرة ✏️</th>
                <th className="p-3.5 w-40 text-center bg-blue-950 border-l border-slate-800 text-blue-300">المبلغ التخميني ✏️</th>
                <th className="p-3.5 w-40 text-center bg-indigo-950 border-l border-slate-800 text-indigo-300">مبلغ المجهز ✏️</th>
                <th className="p-3.5 w-32 text-center border-l border-slate-800">نسبة الانحراف %</th>
                <th className="p-3.5 w-36 text-center border-l border-slate-800 bg-rose-950 text-rose-300">الفقرة المنحرفة</th>
                <th className="p-3.5 w-40 text-center border-l border-slate-800 bg-purple-950 text-purple-200">السعر الجديد الموزون</th>
                <th className="p-3.5 w-28 text-center border-l border-slate-800">التقييم</th>
                <th className="p-3.5 w-20 text-center">إجراءات</th>
              </tr>
            )}
          </thead>
          
          <tbody className="divide-y divide-slate-200 bg-white font-medium">
            {filteredItems.map((item, index) => {
              const actualIndex = items.findIndex(i => i.id === item.id);
              const isDeviated = item.isDeviated;
              const isSaving = item.diffAmount < 0;

              return (
                <tr 
                  key={item.id} 
                  className={'hover:bg-blue-50/50 transition group ' + (
                    isDeviated ? 'bg-rose-50/30' : isSaving ? 'bg-emerald-50/20' : ''
                  )}
                >
                  {viewPreset === 'source_excel' ? (
                    <>
                      {/* 1. الفقرة (تعديل) */}
                      <td className="p-2.5 text-center font-black text-slate-700 border-l border-slate-200 bg-slate-50/80">
                        <input
                          type="text"
                          value={item.itemNo}
                          onChange={(e) => onUpdateItem(actualIndex, 'itemNo', e.target.value)}
                          className="w-full text-center bg-transparent focus:bg-white focus:ring-2 focus:ring-blue-500 rounded p-1 font-mono font-black"
                        />
                      </td>

                      {/* 2. مبلغ المجهز (إدخال نشط) */}
                      <td className="p-2.5 text-center font-black text-indigo-900 border-l border-slate-200 bg-indigo-50/50">
                        <input
                          id={'input-bidderTotal-' + actualIndex}
                          type="number"
                          value={item.bidderTotal === 0 ? '' : item.bidderTotal}
                          onChange={(e) => onUpdateItem(actualIndex, 'bidderTotal', parseFloat(e.target.value) || 0)}
                          onKeyDown={(e) => handleKeyDown(e, actualIndex, 'bidderTotal')}
                          className="w-full text-center bg-white border border-indigo-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 rounded-lg p-1.5 font-black text-indigo-900 text-sm shadow-2xs"
                          placeholder="0.00"
                        />
                      </td>

                      {/* 3. المبلغ التخميني (إدخال نشط) */}
                      <td className="p-2.5 text-center font-black text-blue-900 border-l border-slate-200 bg-blue-50/50">
                        <input
                          id={'input-estimatedTotal-' + actualIndex}
                          type="number"
                          value={item.estimatedTotal === 0 ? '' : item.estimatedTotal}
                          onChange={(e) => onUpdateItem(actualIndex, 'estimatedTotal', parseFloat(e.target.value) || 0)}
                          onKeyDown={(e) => handleKeyDown(e, actualIndex, 'estimatedTotal')}
                          className="w-full text-center bg-white border border-blue-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 rounded-lg p-1.5 font-black text-blue-900 text-sm shadow-2xs"
                          placeholder="0.00"
                        />
                      </td>

                      {/* 4. نسبة الانحراف (عرض نقي) */}
                      <td className="p-2.5 text-center border-l border-slate-200">
                        <span className={'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black ' + (
                          isDeviated 
                            ? 'bg-rose-100 text-rose-800 border border-rose-300' 
                            : isSaving 
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                            : 'bg-slate-100 text-slate-700'
                        )}>
                          {item.deviationPercent > 0 ? '+' : ''}{item.deviationPercent.toFixed(2)}%
                        </span>
                      </td>

                      {/* 5. الفقرة المنحرفة (عرض نقي) */}
                      <td className={'p-2.5 text-center font-black border-l border-slate-200 text-sm ' + (
                        item.deviatedAmount > 0 ? 'bg-rose-100/60 text-rose-800 font-extrabold' : 'text-slate-400'
                      )}>
                        {item.deviatedAmount > 0 ? formatNumber(item.deviatedAmount) : '0.00'}
                      </td>

                      {/* 6. النسبة السعرية (عرض نقي) */}
                      <td className="p-2.5 text-center font-mono font-bold text-purple-700 border-l border-slate-200 bg-purple-50/10">
                        {item.priceRatio.toFixed(4)}
                      </td>

                      {/* 7. السعر الجديد (عرض نقي) */}
                      <td className="p-2.5 text-center font-black text-purple-900 border-l border-slate-200 bg-purple-50/20 text-sm">
                        {formatNumber(item.newPrice)}
                      </td>

                      {/* 8. الكمية (عرض) */}
                      <td className="p-2.5 text-center font-black text-slate-800 border-l border-slate-200">
                        {item.quantity || 1}
                      </td>

                      {/* 9. المفرد الموزون (عرض نقي مميز) */}
                      <td className="p-2.5 text-center font-black text-purple-950 border-l border-slate-200 bg-purple-50/30 text-sm">
                        {formatNumber(item.weightedUnitPrice)}
                      </td>
                    </>
                  ) : viewPreset === 'quick_fast' ? (
                    <>
                      <td className="p-2.5 text-center font-black text-slate-700 border-l border-slate-200 bg-slate-50/80">
                        <input
                          type="text"
                          value={item.itemNo}
                          onChange={(e) => onUpdateItem(actualIndex, 'itemNo', e.target.value)}
                          className="w-full text-center bg-transparent focus:bg-white focus:ring-2 focus:ring-blue-500 rounded p-1 font-mono font-black"
                        />
                      </td>

                      <td className="p-2.5 text-center font-black text-blue-900 border-l border-slate-200 bg-blue-50/40">
                        <input
                          id={'input-estimatedTotal-' + actualIndex}
                          type="number"
                          value={item.estimatedTotal === 0 ? '' : item.estimatedTotal}
                          onChange={(e) => onUpdateItem(actualIndex, 'estimatedTotal', parseFloat(e.target.value) || 0)}
                          onKeyDown={(e) => handleKeyDown(e, actualIndex, 'estimatedTotal')}
                          className="w-full text-center bg-transparent focus:bg-white focus:ring-2 focus:ring-blue-500 rounded p-1 font-black text-blue-900 text-sm"
                          placeholder="0.00"
                        />
                      </td>

                      <td className="p-2.5 text-center font-black text-indigo-900 border-l border-slate-200 bg-indigo-50/40">
                        <input
                          id={'input-bidderTotal-' + actualIndex}
                          type="number"
                          value={item.bidderTotal === 0 ? '' : item.bidderTotal}
                          onChange={(e) => onUpdateItem(actualIndex, 'bidderTotal', parseFloat(e.target.value) || 0)}
                          onKeyDown={(e) => handleKeyDown(e, actualIndex, 'bidderTotal')}
                          className="w-full text-center bg-transparent focus:bg-white focus:ring-2 focus:ring-indigo-500 rounded p-1 font-black text-indigo-900 text-sm"
                          placeholder="0.00"
                        />
                      </td>

                      <td className="p-2.5 text-center border-l border-slate-200">
                        <span className={'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black ' + (
                          isDeviated 
                            ? 'bg-rose-100 text-rose-800 border border-rose-300' 
                            : isSaving 
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                            : 'bg-slate-100 text-slate-700'
                        )}>
                          {item.deviationPercent > 0 ? '+' : ''}{item.deviationPercent.toFixed(2)}%
                        </span>
                      </td>

                      <td className={'p-2.5 text-center font-black border-l border-slate-200 text-sm ' + (
                        item.deviatedAmount > 0 ? 'bg-rose-100/60 text-rose-800 font-extrabold' : 'text-slate-300'
                      )}>
                        {item.deviatedAmount > 0 ? formatNumber(item.deviatedAmount) : '-'}
                      </td>

                      <td className="p-2.5 text-center font-black text-purple-950 border-l border-slate-200 bg-purple-50/20 text-sm">
                        {formatNumber(item.weightedUnitPrice)}
                      </td>

                      <td className="p-2.5 text-center border-l border-slate-200">
                        {isDeviated ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-black text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                            <AlertTriangle className="w-3 h-3 text-rose-600" />
                            منحرفة
                          </span>
                        ) : isSaving ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            وفر
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600 bg-slate-50 px-2 py-0.5 rounded-md">
                            <ShieldCheck className="w-3 h-3 text-blue-600" />
                            متوازن
                          </span>
                        )}
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="p-2.5 text-center font-black text-slate-700 border-l border-slate-200 bg-slate-50/80">
                        <input
                          type="text"
                          value={item.itemNo}
                          onChange={(e) => onUpdateItem(actualIndex, 'itemNo', e.target.value)}
                          className="w-full text-center bg-transparent focus:bg-white focus:ring-2 focus:ring-blue-500 rounded p-1 font-mono font-black"
                        />
                      </td>

                      <td className="p-2.5 border-l border-slate-200">
                        <input
                          type="text"
                          value={item.description || ''}
                          onChange={(e) => onUpdateItem(actualIndex, 'description', e.target.value)}
                          className="w-full bg-transparent focus:bg-white focus:ring-2 focus:ring-blue-500 rounded p-1 text-slate-900 font-semibold"
                          placeholder={'فقرة ' + item.itemNo}
                        />
                      </td>

                      <td className="p-2.5 text-center font-black text-blue-900 border-l border-slate-200 bg-blue-50/40">
                        <input
                          id={'input-estimatedTotal-' + actualIndex}
                          type="number"
                          value={item.estimatedTotal === 0 ? '' : item.estimatedTotal}
                          onChange={(e) => onUpdateItem(actualIndex, 'estimatedTotal', parseFloat(e.target.value) || 0)}
                          onKeyDown={(e) => handleKeyDown(e, actualIndex, 'estimatedTotal')}
                          className="w-full text-center bg-transparent focus:bg-white focus:ring-2 focus:ring-blue-500 rounded p-1 font-black text-blue-900 text-sm"
                          placeholder="0.00"
                        />
                      </td>

                      <td className="p-2.5 text-center font-black text-indigo-900 border-l border-slate-200 bg-indigo-50/40">
                        <input
                          id={'input-bidderTotal-' + actualIndex}
                          type="number"
                          value={item.bidderTotal === 0 ? '' : item.bidderTotal}
                          onChange={(e) => onUpdateItem(actualIndex, 'bidderTotal', parseFloat(e.target.value) || 0)}
                          onKeyDown={(e) => handleKeyDown(e, actualIndex, 'bidderTotal')}
                          className="w-full text-center bg-transparent focus:bg-white focus:ring-2 focus:ring-indigo-500 rounded p-1 font-black text-indigo-900 text-sm"
                          placeholder="0.00"
                        />
                      </td>

                      <td className="p-2.5 text-center border-l border-slate-200">
                        <span className={'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black ' + (
                          isDeviated 
                            ? 'bg-rose-100 text-rose-800 border border-rose-300' 
                            : isSaving 
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                            : 'bg-slate-100 text-slate-700'
                        )}>
                          {item.deviationPercent > 0 ? '+' : ''}{item.deviationPercent.toFixed(2)}%
                        </span>
                      </td>

                      <td className={'p-2.5 text-center font-black border-l border-slate-200 text-sm ' + (
                        item.deviatedAmount > 0 ? 'bg-rose-100/60 text-rose-800 font-extrabold' : 'text-slate-300'
                      )}>
                        {item.deviatedAmount > 0 ? formatNumber(item.deviatedAmount) : '-'}
                      </td>

                      <td className="p-2.5 text-center font-black text-purple-900 border-l border-slate-200 bg-purple-50/20 text-sm">
                        {formatNumber(item.newPrice)}
                      </td>

                      <td className="p-2.5 text-center border-l border-slate-200">
                        {isDeviated ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-black text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                            <AlertTriangle className="w-3 h-3 text-rose-600" />
                            منحرفة
                          </span>
                        ) : isSaving ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            وفر
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600 bg-slate-50 px-2 py-0.5 rounded-md">
                            <ShieldCheck className="w-3 h-3 text-blue-600" />
                            متوازن
                          </span>
                        )}
                      </td>
                    </>
                  )}

                  {/* إجراءات */}
                  <td className="p-2.5 text-center">
                    <div className="flex items-center justify-center gap-1.5 opacity-80 group-hover:opacity-100 transition">
                      <button
                        onClick={() => onDuplicateItem(actualIndex)}
                        className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-600 transition cursor-pointer"
                        title="تكرار الفقرة"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDeleteItem(actualIndex)}
                        className="p-1.5 hover:bg-rose-100 rounded-lg text-rose-600 transition cursor-pointer"
                        title="حذف الفقرة"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>

          {/* المجاميع */}
          <tfoot className="bg-slate-950 text-white font-black text-xs sm:text-sm sticky bottom-0 z-20 shadow-lg border-t-2 border-slate-800">
            {viewPreset === 'source_excel' ? (
              <tr>
                <td className="p-3.5 text-center bg-black font-black border-l border-slate-800 text-amber-400">
                  المجموع
                </td>
                <td className="p-3.5 text-center font-black text-indigo-300 border-l border-slate-800 bg-indigo-950/70 text-sm">
                  {formatNumber(totals.totalBidderAmount)}
                </td>
                <td className="p-3.5 text-center font-black text-blue-400 border-l border-slate-800 bg-blue-950/70 text-sm">
                  {formatNumber(totals.totalEstimatedAmount)}
                </td>
                <td className="p-3.5 text-center border-l border-slate-800 text-amber-300 font-black">
                  {totals.totalDeviationPercent.toFixed(2)}%
                </td>
                <td className="p-3.5 text-center border-l border-slate-800 bg-rose-950 font-black text-rose-300 text-sm">
                  {formatNumber(totals.deviatedItemsSum)}
                </td>
                <td className="p-3.5 text-center border-l border-slate-800 text-purple-300 font-mono">
                  {totals.overallPriceRatio.toFixed(4)}
                </td>
                <td className="p-3.5 text-center border-l border-slate-800 bg-purple-950 font-black text-purple-300 text-sm">
                  {formatNumber(totals.newPricesTotal)}
                </td>
                <td className="p-3.5 text-center border-l border-slate-800">-</td>
                <td className="p-3.5 text-center border-l border-slate-800 text-purple-300">-</td>
                <td className="p-3.5 text-center">-</td>
              </tr>
            ) : viewPreset === 'quick_fast' ? (
              <tr>
                <td className="p-3.5 text-center bg-black font-black border-l border-slate-800 text-amber-400">
                  المجموع
                </td>
                <td className="p-3.5 text-center font-black text-blue-400 border-l border-slate-800 bg-blue-950/70 text-sm">
                  {formatNumber(totals.totalEstimatedAmount)}
                </td>
                <td className="p-3.5 text-center font-black text-indigo-300 border-l border-slate-800 bg-indigo-950/70 text-sm">
                  {formatNumber(totals.totalBidderAmount)}
                </td>
                <td className="p-3.5 text-center border-l border-slate-800 text-amber-300 font-black">
                  {totals.totalDeviationPercent.toFixed(2)}%
                </td>
                <td className="p-3.5 text-center border-l border-slate-800 bg-rose-950 font-black text-rose-300 text-sm">
                  {formatNumber(totals.deviatedItemsSum)}
                </td>
                <td className="p-3.5 text-center border-l border-slate-800 text-purple-300">-</td>
                <td className="p-3.5 text-center border-l border-slate-800 text-slate-400 text-xs">
                  {totals.deviatedItemsCount} منحرفة
                </td>
                <td className="p-3.5 text-center">-</td>
              </tr>
            ) : (
              <tr>
                <td colSpan={2} className="p-3.5 text-center bg-black font-black border-l border-slate-800 text-amber-400">
                  المجموع الإجمالي
                </td>
                <td className="p-3.5 text-center font-black text-blue-400 border-l border-slate-800 bg-blue-950/70 text-sm">
                  {formatNumber(totals.totalEstimatedAmount)}
                </td>
                <td className="p-3.5 text-center font-black text-indigo-300 border-l border-slate-800 bg-indigo-950/70 text-sm">
                  {formatNumber(totals.totalBidderAmount)}
                </td>
                <td className="p-3.5 text-center border-l border-slate-800 text-amber-300 font-black">
                  {totals.totalDeviationPercent.toFixed(2)}%
                </td>
                <td className="p-3.5 text-center border-l border-slate-800 bg-rose-950 font-black text-rose-300 text-sm">
                  {formatNumber(totals.deviatedItemsSum)}
                </td>
                <td className="p-3.5 text-center border-l border-slate-800 bg-purple-950 font-black text-purple-300 text-sm">
                  {formatNumber(totals.newPricesTotal)}
                </td>
                <td className="p-3.5 text-center border-l border-slate-800 text-slate-400 text-xs">
                  {totals.deviatedItemsCount} منحرفة
                </td>
                <td className="p-3.5 text-center">-</td>
              </tr>
            )}
          </tfoot>
        </table>
      </div>

      {/* شريط الإرشادات */}
      <div className="p-3 bg-slate-100 border-t border-slate-200 flex flex-wrap items-center justify-between text-xs text-slate-600 font-medium">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="flex items-center gap-1">
            <kbd className="bg-white px-2 py-0.5 rounded border border-slate-300 font-mono font-bold text-slate-900 shadow-2xs">Enter</kbd>
            للانتقال للسطر التالي أو إنشاء سطر جديد
          </span>
          <span>•</span>
          <span className="flex items-center gap-1 text-blue-700 font-bold">
            <ClipboardPaste className="w-3.5 h-3.5" />
            يمكنك نسخ أي جدول من Excel ولصقه هنا بـ (Ctrl + V) لتعبئة كافة الفقرات فوراً
          </span>
        </div>
      </div>

    </div>
  );
};

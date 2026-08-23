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
  Building2,
  Pencil,
  RotateCcw,
  Eraser,
  HelpCircle
} from 'lucide-react';
import { BOQItem, TenderTotals } from '../types/tender';
import { formatNumber } from '../utils/calculations';

interface BOQTableProps {
  items: BOQItem[];
  totals: TenderTotals;
  currency: string;
  deviationThreshold: number;
  bidderName: string;
  onUpdateBidderName?: (name: string) => void;
  onUpdateItem: (index: number, field: keyof BOQItem, value: any) => void;
  onAddItem: () => void;
  onDeleteItem: (index: number) => void;
  onDuplicateItem: (index: number) => void;
  onBatchAddItems?: (newItems: Partial<BOQItem>[]) => void;
  onClearBidderPrices?: () => void;
  onClearAllItems?: () => void;
}

export type ViewPreset = 'quick_fast' | 'source_excel' | 'detailed_desc';

export const BOQTable: React.FC<BOQTableProps> = ({
  items,
  totals,
  currency,
  deviationThreshold,
  bidderName,
  onUpdateBidderName,
  onUpdateItem,
  onAddItem,
  onDeleteItem,
  onDuplicateItem,
  onBatchAddItems,
  onClearBidderPrices,
  onClearAllItems
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'deviated' | 'savings'>('all');
  const [viewPreset, setViewPreset] = useState<ViewPreset>('quick_fast'); // الافتراضي هو النمط السريع للإدخال المباشر
  const [pasteNotice, setPasteNotice] = useState<string | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(bidderName);

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
      
      {/* 1. Header Bar: Bidder Name (Editable) & Action Toolbar */}
      <div className="p-4 sm:p-5 bg-slate-900 text-white border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
        
        {/* Bidder Identity & Name Editing */}
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-xs">
            <Building2 className="w-5 h-5" />
          </div>

          <div>
            <div className="text-[11px] text-indigo-300 font-bold">المجهز / المقاول الذي يتم إدخال مبالغه حالياً:</div>
            
            {!isEditingName ? (
              <div 
                onClick={() => {
                  setTempName(bidderName);
                  setIsEditingName(true);
                }}
                className="text-base sm:text-lg font-black text-white hover:text-amber-400 cursor-pointer flex items-center gap-2 transition"
                title="انقر لتعديل اسم الشركة فوراً"
              >
                <span>{bidderName}</span>
                <Pencil className="w-3.5 h-3.5 text-slate-400" />
              </div>
            ) : (
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="text"
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  className="bg-slate-800 text-white text-sm font-black px-3 py-1 rounded-lg border border-indigo-400 focus:outline-none ring-2 ring-indigo-500/40"
                  autoFocus
                />
                <button
                  onClick={() => {
                    if (onUpdateBidderName && tempName.trim()) {
                      onUpdateBidderName(tempName.trim());
                    }
                    setIsEditingName(false);
                  }}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black px-3 py-1.5 rounded-lg cursor-pointer shadow-xs"
                >
                  حفظ
                </button>
                <button
                  onClick={() => setIsEditingName(false)}
                  className="bg-slate-700 text-slate-300 text-xs px-2.5 py-1.5 rounded-lg cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Clear & Reset Tools (أدوات المسح والتفريغ) */}
        <div className="flex items-center gap-2 flex-wrap">
          {onClearBidderPrices && (
            <button
              onClick={onClearBidderPrices}
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 text-xs font-bold px-3 py-2 rounded-xl transition cursor-pointer"
              title="تصفير مبالغ هذا المجهز للبدء في تعبئتها من جديد"
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
              <span>تصفير مبالغ المجهز</span>
            </button>
          )}

          {onClearAllItems && (
            <button
              onClick={onClearAllItems}
              className="flex items-center gap-1.5 bg-rose-950/80 hover:bg-rose-900 text-rose-200 border border-rose-800 text-xs font-bold px-3 py-2 rounded-xl transition cursor-pointer"
              title="مسح كافة أسطر وفقرات الجدول بالكامل للبدء بجدول فارغ"
            >
              <Eraser className="w-3.5 h-3.5 text-rose-400" />
              <span>مسح وتفريغ الجدول بالكامل</span>
            </button>
          )}
        </div>

      </div>

      {/* 2. Sub-Toolbar: Fast Mode / Presets / Search / Add */}
      <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
        
        {/* View Mode Presets Switcher */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center bg-slate-200/80 p-1 rounded-2xl text-xs font-black border border-slate-300">
            
            {/* النمط السريع (الافتراضي للإدخال) */}
            <button
              onClick={() => setViewPreset('quick_fast')}
              className={'flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl transition cursor-pointer ' + (
                viewPreset === 'quick_fast'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'text-slate-700 hover:text-slate-950'
              )}
              title="النمط السريع المباشر لإدخال المبالغ التخمينية ومبالغ المجهز"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>النمط السريع للإدخال ⚡</span>
            </button>

            {/* النمط المصدري Excel (للمطابقة والمراجعة) */}
            <button
              onClick={() => setViewPreset('source_excel')}
              className={'flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl transition cursor-pointer ' + (
                viewPreset === 'source_excel'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'text-slate-700 hover:text-slate-950'
              )}
              title="معاينة الأعمدة كما هي في ملف Excel المرجعي"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>معاينة شيت Excel 📑</span>
            </button>
            
            {/* النمط الشامل التفصيلي */}
            <button
              onClick={() => setViewPreset('detailed_desc')}
              className={'flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl transition cursor-pointer ' + (
                viewPreset === 'detailed_desc'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-700 hover:text-slate-950'
              )}
              title="إظهار كافة التفاصيل مع وصف الفقرة والتقييم"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>النمط الشامل 📝</span>
            </button>
          </div>
        </div>

        {/* Search & Filters & Add Item */}
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
              مطابقة ({items.filter(i => i.diffAmount < 0).length})
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
            {viewPreset === 'quick_fast' ? (
              /* النمط السريع (الافتراضي) */
              <tr>
                <th className="p-3.5 w-16 text-center border-l border-slate-800">ت</th>
                <th className="p-3.5 w-44 text-center bg-blue-950 border-l border-slate-800 text-blue-300">المبلغ التخميني ✏️</th>
                <th className="p-3.5 w-44 text-center bg-indigo-950 border-l border-slate-800 text-indigo-300">مبلغ المجهز ({bidderName}) ✏️</th>
                <th className="p-3.5 w-32 text-center border-l border-slate-800">نسبة الانحراف %</th>
                <th className="p-3.5 w-36 text-center border-l border-slate-800 bg-rose-950 text-rose-300">الفقرة المنحرفة (&gt;{deviationThreshold}%)</th>
                <th className="p-3.5 w-44 text-center border-l border-slate-800 bg-purple-950 text-purple-200">المفرد المجهز الموزون</th>
                <th className="p-3.5 w-28 text-center border-l border-slate-800">التقييم</th>
                <th className="p-3.5 w-20 text-center">إجراءات</th>
              </tr>
            ) : viewPreset === 'source_excel' ? (
              /* معاينة شيت Excel */
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
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-12 text-center text-slate-400 font-bold bg-slate-50/50">
                  <div className="max-w-md mx-auto space-y-2">
                    <p className="text-base text-slate-700 font-black">الجدول فارغ حالياً</p>
                    <p className="text-xs text-slate-500">انقر فوق زر <strong>(+ إضافة فقرة)</strong> أو الصق بيانات من Excel بـ <kbd className="bg-white px-1 border font-bold">Ctrl+V</kbd></p>
                  </div>
                </td>
              </tr>
            ) : filteredItems.map((item, index) => {
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
                  {viewPreset === 'quick_fast' ? (
                    /* صفوف النمط السريع */
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
                          className="w-full text-center bg-white border border-blue-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 rounded-lg p-1.5 font-black text-blue-900 text-sm shadow-2xs"
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
                          className="w-full text-center bg-white border border-indigo-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 rounded-lg p-1.5 font-black text-indigo-900 text-sm shadow-2xs"
                          placeholder="0.00"
                        />
                        {(item.hasMathError || item.hasTextDiscrepancy) && (
                          <div className="mt-1 space-y-1 text-right">
                            {item.hasMathError && (
                              <div className="text-[10px] font-black text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />
                                <span>خطأ ضرب: المدون ({item.enteredBidderTotal?.toLocaleString() || '-'}) ← صُحح للمفرد</span>
                              </div>
                            )}
                            {item.hasTextDiscrepancy && (
                              <div className="text-[10px] font-bold text-purple-800 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                                📝 تفقيط: {item.writtenText}
                              </div>
                            )}
                          </div>
                        )}
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
                          <span className="inline-flex items-center gap-1 text-[11px] font-black text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded-md border border-rose-200">
                            <AlertTriangle className="w-3 h-3 text-rose-600" />
                            منحرفة {item.deviationPercent < 0 ? '(للأقل)' : '(للأعلى)'}
                          </span>
                        ) : item.deviationPercent < 0 ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-black text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            مطابق (للأقل ↓)
                          </span>
                        ) : item.deviationPercent > 0 ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-black text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-md border border-blue-200">
                            <CheckCircle2 className="w-3 h-3 text-blue-600" />
                            مطابق (للأعلى ↑)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-black text-slate-700 bg-slate-50 px-2.5 py-0.5 rounded-md border border-slate-200">
                            <CheckCircle2 className="w-3 h-3 text-slate-600" />
                            مطابق تماماً
                          </span>
                        )}
                      </td>
                    </>
                  ) : viewPreset === 'source_excel' ? (
                    /* صفوف معاينة Excel */
                    <>
                      <td className="p-2.5 text-center font-black text-slate-700 border-l border-slate-200 bg-slate-50/80">
                        <input
                          type="text"
                          value={item.itemNo}
                          onChange={(e) => onUpdateItem(actualIndex, 'itemNo', e.target.value)}
                          className="w-full text-center bg-transparent focus:bg-white focus:ring-2 focus:ring-blue-500 rounded p-1 font-mono font-black"
                        />
                      </td>

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
                        item.deviatedAmount > 0 ? 'bg-rose-100/60 text-rose-800 font-extrabold' : 'text-slate-400'
                      )}>
                        {item.deviatedAmount > 0 ? formatNumber(item.deviatedAmount) : '0.00'}
                      </td>

                      <td className="p-2.5 text-center font-mono font-bold text-purple-700 border-l border-slate-200 bg-purple-50/10">
                        {item.priceRatio.toFixed(4)}
                      </td>

                      <td className="p-2.5 text-center font-black text-purple-900 border-l border-slate-200 bg-purple-50/20 text-sm">
                        {formatNumber(item.newPrice)}
                      </td>

                      <td className="p-2.5 text-center font-black text-slate-800 border-l border-slate-200">
                        {item.quantity || 1}
                      </td>

                      <td className="p-2.5 text-center font-black text-purple-950 border-l border-slate-200 bg-purple-50/30 text-sm">
                        {formatNumber(item.weightedUnitPrice)}
                      </td>
                    </>
                  ) : (
                    /* صفوف النمط الشامل */
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
                          className="w-full text-center bg-white border border-blue-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 rounded-lg p-1.5 font-black text-blue-900 text-sm shadow-2xs"
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
                          className="w-full text-center bg-white border border-indigo-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 rounded-lg p-1.5 font-black text-indigo-900 text-sm shadow-2xs"
                          placeholder="0.00"
                        />
                        {(item.hasMathError || item.hasTextDiscrepancy) && (
                          <div className="mt-1 space-y-1 text-right">
                            {item.hasMathError && (
                              <div className="text-[10px] font-black text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />
                                <span>خطأ ضرب: المدون ({item.enteredBidderTotal?.toLocaleString() || '-'}) ← صُحح للمفرد</span>
                              </div>
                            )}
                            {item.hasTextDiscrepancy && (
                              <div className="text-[10px] font-bold text-purple-800 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                                📝 تفقيط: {item.writtenText}
                              </div>
                            )}
                          </div>
                        )}
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
                          <span className="inline-flex items-center gap-1 text-[11px] font-black text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded-md border border-rose-200">
                            <AlertTriangle className="w-3 h-3 text-rose-600" />
                            منحرفة {item.deviationPercent < 0 ? '(للأقل)' : '(للأعلى)'}
                          </span>
                        ) : item.deviationPercent < 0 ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-black text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            مطابق (للأقل ↓)
                          </span>
                        ) : item.deviationPercent > 0 ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-black text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-md border border-blue-200">
                            <CheckCircle2 className="w-3 h-3 text-blue-600" />
                            مطابق (للأعلى ↑)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-black text-slate-700 bg-slate-50 px-2.5 py-0.5 rounded-md border border-slate-200">
                            <CheckCircle2 className="w-3 h-3 text-slate-600" />
                            مطابق تماماً
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

          {/* المجاميع الإجمالية */}
          <tfoot className="bg-slate-950 text-white font-black text-xs sm:text-sm sticky bottom-0 z-20 shadow-lg border-t-2 border-slate-800">
            {viewPreset === 'quick_fast' ? (
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
            ) : viewPreset === 'source_excel' ? (
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

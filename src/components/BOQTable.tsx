import React, { useState } from 'react';
import { 
  Plus, 
  Trash2, 
  Copy, 
  AlertTriangle, 
  CheckCircle2, 
  FileSpreadsheet, 
  Sparkles,
  Calculator,
  RotateCcw,
  Pencil,
  Building2,
  Table as TableIcon,
  ShieldCheck,
  Coins,
  Search,
  Filter,
  Check,
  Scale
} from 'lucide-react';
import { BOQItem, TenderTotals } from '../types/tender';
import { formatNumber } from '../utils/calculations';

interface BOQTableProps {
  items: BOQItem[];
  totals?: TenderTotals;
  currency?: string;
  deviationThreshold: number;
  bidderName: string;
  onUpdateItem: (index: number, field: keyof BOQItem, val: any) => void;
  onAddItem: () => void;
  onDeleteItem: (index: number) => void;
  onDuplicateItem: (index: number) => void;
  onBatchAddItems?: (newItems: Partial<BOQItem>[]) => void;
  onClearBidderPrices?: () => void;
  onClearAllItems?: () => void;
  onUpdateBidderName?: (newName: string) => void;
}

export const BOQTable: React.FC<BOQTableProps> = ({
  items,
  deviationThreshold,
  bidderName,
  onUpdateItem,
  onAddItem,
  onDeleteItem,
  onDuplicateItem,
  onBatchAddItems,
  onClearBidderPrices,
  onClearAllItems,
  onUpdateBidderName
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'deviated' | 'savings' | 'errors'>('all');
  const [isEditingBidderName, setIsEditingBidderName] = useState(false);
  const [tempBidderName, setTempBidderName] = useState(bidderName);

  // إحصائيات الأخطاء الحسابية وتعارض التفقيط
  const itemsWithErrors = items.filter(i => i.hasMathError || i.hasTextDiscrepancy);
  const mathErrorsCount = items.filter(i => i.hasMathError).length;
  const textErrorsCount = items.filter(i => i.hasTextDiscrepancy).length;

  // فلترة الأسطر
  const filteredItems = items.filter(item => {
    const matchSearch = 
      String(item.itemNo).toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.writtenText && item.writtenText.toLowerCase().includes(searchTerm.toLowerCase()));

    if (!matchSearch) return false;

    if (filterMode === 'deviated') return item.isDeviated;
    if (filterMode === 'savings') return item.diffAmount < 0;
    if (filterMode === 'errors') return item.hasMathError || item.hasTextDiscrepancy;
    return true;
  });

  const handleSaveBidderName = () => {
    if (tempBidderName.trim() && onUpdateBidderName) {
      onUpdateBidderName(tempBidderName.trim());
    }
    setIsEditingBidderName(false);
  };

  return (
    <div className="space-y-4">
      
      {/* Top Banner: Bidder Editing & Actions Bar */}
      <div className="bg-slate-900 text-white rounded-3xl p-4 sm:p-5 shadow-lg border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        
        {/* Bidder Name Editor */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-600 rounded-2xl shadow-md">
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="text-[11px] text-slate-400 font-bold">
              المجهز / المقاول الذي يتم تحليل وتدقيق عطائه حالياً:
            </div>
            {!isEditingBidderName ? (
              <div 
                onClick={() => {
                  setTempBidderName(bidderName);
                  setIsEditingBidderName(true);
                }}
                className="text-base sm:text-lg font-black text-white flex items-center gap-2 cursor-pointer hover:text-indigo-300 transition group"
              >
                <span>{bidderName}</span>
                <Pencil className="w-4 h-4 text-indigo-400 opacity-60 group-hover:opacity-100 transition" />
              </div>
            ) : (
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="text"
                  value={tempBidderName}
                  onChange={(e) => setTempBidderName(e.target.value)}
                  className="bg-slate-800 border border-indigo-400 text-white text-sm font-black px-3 py-1.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveBidderName()}
                />
                <button
                  onClick={handleSaveBidderName}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black px-3 py-1.5 rounded-xl cursor-pointer"
                >
                  حفظ
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Clear Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {onClearBidderPrices && (
            <button
              onClick={onClearBidderPrices}
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-bold px-3.5 py-2 rounded-xl border border-amber-400/30 transition cursor-pointer"
              title="تصفير مبالغ هذا المجهز لإعادة إدخالها مع الحفاظ على التخميني والفقرات"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>تصفير مبالغ المجهز</span>
            </button>
          )}

          {onClearAllItems && (
            <button
              onClick={onClearAllItems}
              className="flex items-center gap-1.5 bg-rose-950/80 hover:bg-rose-900 text-rose-200 text-xs font-bold px-3.5 py-2 rounded-xl border border-rose-600/40 transition cursor-pointer"
              title="مسح وتفريغ الجدول بالكامل للبدء من الصفر"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span>مسح وتفريغ الجدول بالكامل</span>
            </button>
          )}
        </div>

      </div>

      {/* Forensic Audit Warning Banner (When Math or Text Errors are Detected) */}
      {itemsWithErrors.length > 0 && (
        <div className="bg-gradient-to-r from-rose-500/20 via-amber-500/15 to-transparent border-2 border-rose-400 p-4 sm:p-5 rounded-3xl flex flex-wrap items-center justify-between gap-4 text-xs shadow-md">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-rose-600 text-white rounded-2xl font-black text-sm shrink-0 flex items-center gap-2 shadow-sm">
              <AlertTriangle className="w-5 h-5" />
              <span>تدقيق حسابي وقانوني (مادة 13/2)</span>
            </div>
            <div>
              <div className="font-black text-rose-950 text-sm sm:text-base flex items-center gap-2">
                تم اكتشاف ({itemsWithErrors.length}) أخطاء في عطاء ({bidderName}):
                <span className="text-xs bg-rose-600 text-white px-2 py-0.5 rounded-md font-bold">
                  {mathErrorsCount} خطأ ضرب • {textErrorsCount} تعارض تفقيط
                </span>
              </div>
              <p className="text-rose-900 text-xs mt-1 leading-relaxed">
                قام النظام بتأشير كافة الأخطاء وتطبيق التصحيح الحسابي القانوني التلقائي بالاعتداد بسعر المفرد وفق المادة (13 / ثانياً) من تعليمات تنفيذ العقود الحكومية.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setFilterMode(filterMode === 'errors' ? 'all' : 'errors')}
              className={`px-4 py-2 rounded-xl font-black text-xs border transition cursor-pointer ${
                filterMode === 'errors'
                  ? 'bg-rose-700 text-white border-rose-800 shadow-sm'
                  : 'bg-white text-rose-900 border-rose-300 hover:bg-rose-50'
              }`}
            >
              {filterMode === 'errors' ? 'عرض كافة الفقرات' : `عرض الفقرات الخاطئة فقط (${itemsWithErrors.length})`}
            </button>
          </div>
        </div>
      )}

      {/* Main Table Container */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden" id="boq-table-container">
        
        {/* Table Toolbar */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          
          {/* Search Box */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
            <input
              type="text"
              placeholder="بحث برقم أو وصف الفقرة..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl pr-9 pl-3 py-1.5 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setFilterMode('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer ${
                filterMode === 'all' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              الكل ({items.length})
            </button>

            {itemsWithErrors.length > 0 && (
              <button
                onClick={() => setFilterMode('errors')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1 ${
                  filterMode === 'errors' ? 'bg-rose-600 text-white shadow-xs' : 'bg-rose-50 text-rose-800 border border-rose-300 hover:bg-rose-100'
                }`}
              >
                <AlertTriangle className="w-3 h-3 text-rose-600" />
                <span>أخطاء العطاء ({itemsWithErrors.length})</span>
              </button>
            )}

            <button
              onClick={() => setFilterMode('deviated')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer ${
                filterMode === 'deviated' ? 'bg-rose-600 text-white shadow-xs' : 'bg-white text-rose-800 border border-rose-200 hover:bg-rose-50'
              }`}
            >
              المنحرفة &gt; {deviationThreshold}% ({items.filter(i => i.isDeviated).length})
            </button>

            <button
              onClick={() => setFilterMode('savings')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer ${
                filterMode === 'savings' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-white text-emerald-800 border border-emerald-200 hover:bg-emerald-50'
              }`}
            >
              مطابقة ({items.filter(i => i.diffAmount < 0).length})
            </button>
          </div>

          {/* Add Row Button */}
          <button
            onClick={onAddItem}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black px-4 py-2 rounded-xl shadow-xs transition transform active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ إضافة فقرة</span>
          </button>
        </div>

        {/* The Comprehensive BOQ Table */}
        <div className="overflow-x-auto max-h-[640px] relative">
          <table className="w-full text-xs sm:text-sm text-right border-collapse">
            
            <thead className="bg-slate-900 text-slate-100 uppercase text-xs font-black sticky top-0 z-20 shadow-xs select-none">
              <tr>
                <th className="p-3 w-12 text-center border-l border-slate-800">ت</th>
                <th className="p-3 min-w-[200px] border-l border-slate-800">اسم المادة / وصف الفقرة ✏️</th>
                <th className="p-3 w-20 text-center border-l border-slate-800 bg-slate-800">العدد ✏️</th>
                <th className="p-3 w-32 text-center border-l border-slate-800 bg-indigo-950 text-indigo-200">سعر المفرد للمجهز ✏️</th>
                <th className="p-3 w-36 text-center border-l border-slate-800 bg-indigo-900 text-indigo-100">مبلغ المجهز الإجمالي 💰</th>
                <th className="p-3 w-32 text-center border-l border-slate-800 bg-blue-950 text-blue-200">المبلغ التخميني (BOC) ✏️</th>
                <th className="p-3 min-w-[240px] border-l border-slate-800 bg-amber-950 text-amber-200">تدقيق الأخطاء الحسابية والتفقيط (مادة 13/2)</th>
                <th className="p-3 w-28 text-center border-l border-slate-800">نسبة الانحراف %</th>
                <th className="p-3 w-32 text-center border-l border-slate-800 bg-purple-950 text-purple-200">المفرد الموزون</th>
                <th className="p-3 w-28 text-center border-l border-slate-800">التقييم</th>
                <th className="p-3 w-16 text-center">حذف</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200 bg-white font-medium">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={11} className="p-12 text-center text-slate-400 font-bold bg-slate-50/50">
                    <div className="max-w-md mx-auto space-y-2">
                      <p className="text-base text-slate-700 font-black">الجدول فارغ حالياً</p>
                      <p className="text-xs text-slate-500">
                        استورد جدول الإكسل من الأعلى عبر <strong>[ استيراد جدول (Excel / Word) ]</strong> أو انقر <strong>(+ إضافة فقرة)</strong>.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : filteredItems.map((item) => {
                const actualIndex = items.findIndex(i => i.id === item.id);
                const isDeviated = item.isDeviated;
                const isSaving = item.diffAmount < 0;
                const hasError = item.hasMathError || item.hasTextDiscrepancy;

                const displayUnitPrice = item.enteredUnitPrice !== undefined && item.enteredUnitPrice > 0
                  ? item.enteredUnitPrice
                  : item.quantity > 0 ? (item.bidderTotal / item.quantity) : 0;

                return (
                  <tr 
                    key={item.id} 
                    className={`hover:bg-blue-50/50 transition group ${
                      hasError ? 'bg-rose-50/50' : isDeviated ? 'bg-rose-50/20' : isSaving ? 'bg-emerald-50/15' : ''
                    }`}
                  >
                    {/* Item No */}
                    <td className="p-2 text-center font-black text-slate-700 border-l border-slate-200 bg-slate-50/80">
                      <input
                        type="text"
                        value={item.itemNo}
                        onChange={(e) => onUpdateItem(actualIndex, 'itemNo', e.target.value)}
                        className="w-full text-center bg-transparent focus:bg-white focus:ring-2 focus:ring-indigo-500 rounded p-1 font-mono font-black"
                      />
                    </td>

                    {/* Description */}
                    <td className="p-2 border-l border-slate-200">
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) => onUpdateItem(actualIndex, 'description', e.target.value)}
                        className="w-full bg-transparent border-0 font-bold text-slate-900 focus:outline-none focus:bg-white focus:ring-1 focus:ring-indigo-500 rounded px-1.5 py-1 text-xs"
                      />
                    </td>

                    {/* Quantity */}
                    <td className="p-2 text-center border-l border-slate-200 bg-slate-50/50">
                      <input
                        type="number"
                        value={item.quantity || 1}
                        onChange={(e) => {
                          const newQty = parseFloat(e.target.value) || 1;
                          onUpdateItem(actualIndex, 'quantity', newQty);
                          if (item.enteredUnitPrice) {
                            onUpdateItem(actualIndex, 'bidderTotal', item.enteredUnitPrice * newQty);
                          }
                        }}
                        className="w-16 text-center bg-white border border-slate-200 rounded-lg p-1 font-mono font-black text-slate-800 text-xs shadow-2xs focus:ring-1 focus:ring-indigo-500"
                      />
                    </td>

                    {/* Bidder Unit Price (سعر المفرد) */}
                    <td className="p-2 text-center border-l border-slate-200 bg-indigo-50/30">
                      <input
                        type="number"
                        value={displayUnitPrice === 0 ? '' : displayUnitPrice}
                        onChange={(e) => {
                          const newUnit = parseFloat(e.target.value) || 0;
                          onUpdateItem(actualIndex, 'enteredUnitPrice', newUnit);
                          onUpdateItem(actualIndex, 'bidderTotal', newUnit * (item.quantity || 1));
                        }}
                        placeholder="0.00"
                        className="w-full text-center bg-white border border-indigo-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 rounded-lg p-1.5 font-mono font-black text-indigo-950 text-xs shadow-2xs"
                      />
                    </td>

                    {/* Bidder Total Amount (مبلغ المجهز الإجمالي) */}
                    <td className="p-2 text-center border-l border-slate-200 bg-indigo-50/60 font-mono font-black text-indigo-950 text-xs">
                      <input
                        type="number"
                        value={item.bidderTotal === 0 ? '' : item.bidderTotal}
                        onChange={(e) => onUpdateItem(actualIndex, 'bidderTotal', parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                        className="w-full text-center bg-white border border-indigo-300 focus:ring-2 focus:ring-indigo-500 rounded-lg p-1.5 font-mono font-black text-indigo-950 text-xs shadow-2xs"
                      />
                    </td>

                    {/* Estimated Total (المبلغ التخميني) */}
                    <td className="p-2 text-center border-l border-slate-200 bg-blue-50/40">
                      <input
                        type="number"
                        value={item.estimatedTotal === 0 ? '' : item.estimatedTotal}
                        onChange={(e) => onUpdateItem(actualIndex, 'estimatedTotal', parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                        className="w-full text-center bg-white border border-blue-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 rounded-lg p-1.5 font-mono font-black text-blue-900 text-xs shadow-2xs"
                      />
                    </td>

                    {/* Forensic Math & Text Audit Column */}
                    <td className="p-2 border-l border-slate-200 text-xs leading-tight">
                      {hasError ? (
                        <div className="space-y-1">
                          {item.hasMathError && (
                            <div className="bg-rose-100 text-rose-900 border border-rose-300 px-2 py-1 rounded-lg font-bold flex items-start gap-1.5">
                              <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                              <div>
                                <span className="font-black text-rose-950">خطأ ضرب:</span> دوّن المجهز رقماً ({item.enteredBidderTotal?.toLocaleString() || '-'}) ← صُحح قانونياً ({item.bidderTotal.toLocaleString()})
                              </div>
                            </div>
                          )}
                          {item.hasTextDiscrepancy && (
                            <div className="bg-purple-100 text-purple-900 border border-purple-300 px-2 py-1 rounded-lg font-bold">
                              📝 <span className="font-black">التفقيط المكتوب:</span> {item.writtenText}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-emerald-700 font-bold flex items-center gap-1 text-[11px]">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>سليم ومطابق حسابياً</span>
                        </div>
                      )}
                    </td>

                    {/* Deviation % */}
                    <td className="p-2 text-center border-l border-slate-200">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black ${
                        isDeviated 
                          ? 'bg-rose-100 text-rose-800 border border-rose-300' 
                          : isSaving 
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        {item.estimatedTotal > 0 
                          ? `${item.deviationPercent > 0 ? '+' : ''}${item.deviationPercent.toFixed(2)}%`
                          : '-'}
                      </span>
                    </td>

                    {/* Weighted Unit Price */}
                    <td className="p-2 text-center font-black text-purple-950 border-l border-slate-200 bg-purple-50/20 text-xs font-mono">
                      {item.estimatedTotal > 0 ? formatNumber(item.weightedUnitPrice) : '-'}
                    </td>

                    {/* Evaluation Badge */}
                    <td className="p-2 text-center border-l border-slate-200">
                      {item.estimatedTotal === 0 ? (
                        <span className="text-[11px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
                          بانتظار التخميني
                        </span>
                      ) : isDeviated ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-black text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                          <AlertTriangle className="w-3 h-3 text-rose-600" />
                          منحرفة {item.deviationPercent < 0 ? '(للأقل)' : '(للأعلى)'}
                        </span>
                      ) : item.deviationPercent < 0 ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          مطابق (للأقل ↓)
                        </span>
                      ) : item.deviationPercent > 0 ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-black text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                          <CheckCircle2 className="w-3 h-3 text-blue-600" />
                          مطابق (للأعلى ↑)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-black text-slate-700 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200">
                          <CheckCircle2 className="w-3 h-3 text-slate-600" />
                          مطابق تماماً
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="p-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => onDuplicateItem(actualIndex)}
                          className="p-1 text-slate-400 hover:text-indigo-600 rounded transition cursor-pointer"
                          title="تكرار الفقرة"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onDeleteItem(actualIndex)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded transition cursor-pointer"
                          title="حذف الفقرة"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>

                  </tr>
                );
              })}
            </tbody>

            {/* Table Footer Totals */}
            <tfoot className="bg-slate-900 text-white font-black text-xs sticky bottom-0 z-10 shadow-lg">
              <tr>
                <td colSpan={3} className="p-3 text-center border-l border-slate-800">
                  المجموع الكلي ({items.length} فقرة)
                </td>
                <td className="p-3 text-center border-l border-slate-800 font-mono text-slate-400">
                  -
                </td>
                <td className="p-3 text-center border-l border-slate-800 font-mono text-indigo-300 text-sm">
                  {items.reduce((s, i) => s + i.bidderTotal, 0).toLocaleString()} د.ع
                </td>
                <td className="p-3 text-center border-l border-slate-800 font-mono text-blue-300 text-sm">
                  {items.reduce((s, i) => s + i.estimatedTotal, 0).toLocaleString()} د.ع
                </td>
                <td className="p-3 text-right border-l border-slate-800 text-amber-300">
                  {itemsWithErrors.length > 0 ? `تم تصحيح (${itemsWithErrors.length}) فقرة أصولياً ✓` : 'كافة الفقرات سليمة ✓'}
                </td>
                <td className="p-3 text-center border-l border-slate-800 font-mono text-rose-300">
                  {items.some(i => i.estimatedTotal > 0)
                    ? `${(((items.reduce((s, i) => s + i.bidderTotal, 0) - items.reduce((s, i) => s + i.estimatedTotal, 0)) / (items.reduce((s, i) => s + i.estimatedTotal, 0) || 1)) * 100).toFixed(2)}%`
                    : '-'}
                </td>
                <td colSpan={3} className="p-3 text-center font-mono text-slate-400">
                  -
                </td>
              </tr>
            </tfoot>

          </table>
        </div>

      </div>

    </div>
  );
};

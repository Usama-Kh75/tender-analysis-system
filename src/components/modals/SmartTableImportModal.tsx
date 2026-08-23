import React, { useState, useRef } from 'react';
import { 
  X, 
  UploadCloud, 
  FileSpreadsheet, 
  ClipboardPaste, 
  Sparkles,
  Table as TableIcon,
  Check,
  Building2,
  HelpCircle,
  AlertCircle
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { BOQItem } from '../../types/tender';
import { parseArabicNumber } from '../../utils/calculations';

interface SmartTableImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyExtractedItems: (items: Partial<BOQItem>[], createAsNew: boolean, bidderName?: string) => void;
  currentBidderName: string;
}

type ColumnRole = 'itemNo' | 'estimatedTotal' | 'bidderTotal' | 'description' | 'quantity' | 'ignore';

export const SmartTableImportModal: React.FC<SmartTableImportModalProps> = ({
  isOpen,
  onClose,
  onApplyExtractedItems,
  currentBidderName
}) => {
  if (!isOpen) return null;

  const [allRawData, setAllRawData] = useState<string[][]>([]);
  const [selectedHeaderRowIdx, setSelectedHeaderRowIdx] = useState<number>(0);
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<string[][]>([]);
  const [columnMappings, setColumnMappings] = useState<ColumnRole[]>([]);
  const [importTarget, setImportTarget] = useState<'current' | 'new'>('current');
  const [newBidderName, setNewBidderName] = useState<string>('');
  const [pastedText, setPastedText] = useState<string>('');
  const [sourceFileName, setSourceFileName] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // الكشف الذكي وتعيين دور كل عمود بناءً على اسمه ومحتواه
  const autoDetectRoles = (headers: string[]): ColumnRole[] => {
    return headers.map((h, colIdx) => {
      const clean = h.trim().toLowerCase();
      
      // 1. رقم الفقرة / التسلسل
      if (
        /^(ت|رقم|الرقم|فقرة|الفقرة|تسلسل|م|item|no|itemno|#|id)$/i.test(clean) || 
        clean.includes('تسلسل') || 
        clean.includes('رقم الفقرة')
      ) {
        return 'itemNo';
      }

      // 2. المبلغ التخميني
      if (
        clean.includes('تخمين') || 
        clean.includes('تخميني') || 
        clean.includes('estimated') || 
        clean.includes('الكلفة التخمينية') || 
        clean.includes('سعر التخميني')
      ) {
        return 'estimatedTotal';
      }

      // 3. مبلغ المجهز / سعر المفرد / العطاء
      if (
        clean.includes('مجهز') || 
        clean.includes('مقاول') || 
        clean.includes('مقدم') || 
        clean.includes('سعر المفرد') || 
        clean.includes('سعر مفرد') || 
        clean.includes('مفرد') || 
        clean.includes('مبلغ الفقرة') || 
        clean.includes('سعر الفقرة') || 
        clean.includes('bidder') || 
        clean.includes('unit price') || 
        clean.includes('rate') || 
        clean.includes('المبلغ') || 
        clean.includes('السعر')
      ) {
        return 'bidderTotal';
      }

      // 4. الوصف / اسم المادة
      if (
        clean.includes('وصف') || 
        clean.includes('اسم المادة') || 
        clean.includes('المادة') || 
        clean.includes('بيان') || 
        clean.includes('تفاصيل') || 
        clean.includes('العمل') || 
        clean.includes('description') || 
        clean.includes('item name') || 
        clean.includes('item description')
      ) {
        return 'description';
      }

      // 5. الكمية / العدد
      if (
        clean.includes('عدد') || 
        clean.includes('العدد') || 
        clean.includes('كمية') || 
        clean.includes('الكمية') || 
        clean.includes('qty') || 
        clean.includes('quantity')
      ) {
        return 'quantity';
      }

      return 'ignore';
    });
  };

  // خوارزمية ذكية لاكتشاف صف العناوين الحقيقي في ملف Excel (تتجاهل صفوف العنوان المدمجة في البداية)
  const findBestHeaderRowIndex = (data: string[][]): number => {
    let bestIdx = 0;
    let maxScore = -1;

    const keywords = ['ت', 'رقم', 'فقرة', 'مادة', 'اسم', 'وصف', 'سعر', 'مفرد', 'تخمين', 'مجهز', 'عدد', 'كمية', 'وحدة', 'مبلغ', 'item', 'price', 'qty', 'description'];

    for (let r = 0; r < Math.min(12, data.length); r++) {
      const row = data[r] || [];
      const nonEmptyCells = row.filter(c => String(c).trim().length > 0);
      if (nonEmptyCells.length < 2) continue; // صفوف العناوين الرئيسية المدمجة غالباً بها خلية واحدة فقط

      let score = 0;
      for (const cell of nonEmptyCells) {
        const text = String(cell).trim().toLowerCase();
        if (keywords.some(k => text.includes(k))) {
          score += 3;
        } else {
          score += 1;
        }
      }

      if (score > maxScore) {
        maxScore = score;
        bestIdx = r;
      }
    }

    return bestIdx;
  };

  // تطبيق صف العناوين المختار
  const applyHeaderRow = (data: string[][], headerIdx: number) => {
    if (!data || data.length === 0) return;
    
    // تنظيف وتحديد العناوين
    const rawHeaderRow = data[headerIdx] || [];
    
    // إيجاد أقصى عدد للأعمدة
    let maxCols = rawHeaderRow.length;
    data.forEach(r => {
      if (r && r.length > maxCols) maxCols = r.length;
    });

    const headers: string[] = [];
    for (let c = 0; c < maxCols; c++) {
      const hVal = rawHeaderRow[c] !== undefined ? String(rawHeaderRow[c]).trim() : '';
      headers.push(hVal || `عمود ${c + 1}`);
    }

    const rows = data.slice(headerIdx + 1).filter(r => r && r.some(c => String(c).trim() !== ''));

    setRawHeaders(headers);
    setRawRows(rows);
    setSelectedHeaderRowIdx(headerIdx);
    setColumnMappings(autoDetectRoles(headers));
  };

  // معالجة قراءة ملف Excel (.xlsx, .xls, .csv)
  const handleExcelFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setSourceFileName(file.name);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[firstSheetName];
      
      const jsonData = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: '' });
      if (!jsonData || jsonData.length === 0) {
        alert('الملف فارغ أو لا يحتوي على بيانات مقروءة.');
        setIsProcessing(false);
        return;
      }

      const stringData: string[][] = jsonData.map(row => 
        Array.isArray(row) ? row.map(c => String(c !== undefined && c !== null ? c : '').trim()) : []
      );

      setAllRawData(stringData);
      
      const bestHeaderIdx = findBestHeaderRowIndex(stringData);
      applyHeaderRow(stringData, bestHeaderIdx);

      // اقتراح اسم الشركة من اسم الملف
      const cleanFileName = file.name.replace(/\.[^/.]+$/, '').replace(/جدول|عطاء|مناقصة|تحليل|BOQ|أسعار|مواد/gi, '').trim();
      if (cleanFileName) {
        setNewBidderName(cleanFileName);
      }
    } catch (err: any) {
      alert(`حدث خطأ أثناء قراءة الملف: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // معالجة لصق جدول من Word أو Excel أو الحافظة
  const handleProcessPastedText = () => {
    if (!pastedText.trim()) return;

    const lines = pastedText.trim().split(/\r?\n/);
    if (lines.length === 0) return;

    const stringData = lines.map(line => line.split('\t').map(c => c.trim()));
    if (stringData.length === 0) return;

    setAllRawData(stringData);
    const bestHeaderIdx = findBestHeaderRowIndex(stringData);
    applyHeaderRow(stringData, bestHeaderIdx);
    setSourceFileName('جدول منسوخ من الحافظة (Word / Excel)');
  };

  // تغيير دور العمود يدوياً
  const handleMapColumn = (colIndex: number, role: ColumnRole) => {
    setColumnMappings(prev => {
      const updated = [...prev];
      updated[colIndex] = role;
      return updated;
    });
  };

  // تأكيد الاستيراد وتحويل البيانات لفقرات نظامية
  const handleConfirmImport = () => {
    if (rawRows.length === 0) {
      alert('لا توجد بيانات للاستيراد.');
      return;
    }

    const itemNoIdx = columnMappings.indexOf('itemNo');
    const estIdx = columnMappings.indexOf('estimatedTotal');
    const bidIdx = columnMappings.indexOf('bidderTotal');
    const descIdx = columnMappings.indexOf('description');
    const qtyIdx = columnMappings.indexOf('quantity');

    // إذا لم يحدد المستخدم أي عمود مالي، نساعده بتوجيهه
    if (estIdx === -1 && bidIdx === -1) {
      alert('يرجى تحديد عمود مالي واحد على الأقل عبر القائمة المنسدلة أعلى الأعمدة:\n- اختر [مبلغ المجهز] أو [المبلغ التخميني]');
      return;
    }

    const extractedItems: Partial<BOQItem>[] = rawRows.map((row, idx) => {
      const itemNoVal = itemNoIdx !== -1 && row[itemNoIdx] ? row[itemNoIdx] : String(idx + 1);
      const estVal = estIdx !== -1 ? parseArabicNumber(row[estIdx]) : 0;
      const bidVal = bidIdx !== -1 ? parseArabicNumber(row[bidIdx]) : 0;
      const descVal = descIdx !== -1 && row[descIdx] ? row[descIdx] : `فقرة ${itemNoVal}`;
      const qtyVal = qtyIdx !== -1 ? parseArabicNumber(row[qtyIdx]) : 1;

      return {
        itemNo: itemNoVal,
        description: descVal,
        quantity: qtyVal || 1,
        estimatedTotal: estVal,
        bidderTotal: bidVal
      };
    }).filter(item => 
      (item.estimatedTotal || 0) > 0 || 
      (item.bidderTotal || 0) > 0 || 
      (item.description && item.description.length > 0 && !item.description.includes('مجموع'))
    );

    if (extractedItems.length === 0) {
      alert('لم يتم العثور على قيم صالحة في الأعمدة المحددة.');
      return;
    }

    onApplyExtractedItems(
      extractedItems,
      importTarget === 'new',
      importTarget === 'new' ? (newBidderName.trim() || 'شركة جديدة') : undefined
    );

    onClose();
  };

  const hasFinancialColumn = columnMappings.includes('estimatedTotal') || columnMappings.includes('bidderTotal');

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
        
        {/* Modal Header */}
        <div className="p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between border-b border-indigo-500/30">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 text-white rounded-2xl shadow-md">
              <UploadCloud className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight text-white flex items-center gap-2">
                الاستيراد الذكي لجداول Excel و Word
                <span className="text-[10px] bg-amber-500 text-slate-950 px-2 py-0.5 rounded-md font-bold">
                  Auto Column Mapper
                </span>
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">
                ارفع أي جدول مهما كانت عناوين أو أعمدة الملف؛ يكتشف النظام العناوين الحقيقية والمبالغ تلقائياً ويستبعد الأعمدة الزائدة.
              </p>
            </div>
          </div>

          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-xl cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50 text-slate-900">
          
          {/* Step 1: Upload or Paste */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* File Upload Box */}
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-indigo-300 hover:border-indigo-600 bg-indigo-50/40 hover:bg-indigo-50/80 rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition group shadow-2xs"
            >
              <FileSpreadsheet className="w-10 h-10 text-indigo-600 group-hover:scale-110 transition mb-2" />
              <div className="text-sm font-black text-slate-900">رفع ملف Excel (.xlsx / .xls / .csv)</div>
              <div className="text-xs text-slate-500 mt-1">انقر لاختيار الملف من جهازك لقراءته واستخلاصه فوراً</div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleExcelFile}
              />
            </div>

            {/* Paste from Word / Excel */}
            <div className="border border-slate-300 bg-white rounded-2xl p-4 flex flex-col justify-between shadow-2xs">
              <div>
                <div className="flex items-center gap-1.5 text-xs font-black text-slate-800 mb-2">
                  <ClipboardPaste className="w-4 h-4 text-indigo-600" />
                  <span>أو انسخ جدولاً من Word / Excel والصقه هنا مباشرة (Ctrl+V):</span>
                </div>
                <textarea
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  placeholder="انسخ أي جدول من برنامج Word أو صفحة ويب والصقه هنا..."
                  className="w-full h-20 bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>

              <button
                onClick={handleProcessPastedText}
                disabled={!pastedText.trim()}
                className="mt-2 w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white text-xs font-black py-2 rounded-xl transition cursor-pointer"
              >
                معالجة النص المنسوخ
              </button>
            </div>

          </div>

          {/* Step 2: Interactive Column Mapping Grid */}
          {rawHeaders.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
              
              {/* Header Info & Row Selector */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <TableIcon className="w-5 h-5 text-indigo-600" />
                  <div>
                    <h3 className="text-sm font-black text-slate-900">
                      مطابقة وتعيين الأعمدة المستخلصة ({rawHeaders.length} أعمدة • {rawRows.length} أسطر)
                    </h3>
                    <div className="text-xs text-slate-500 font-medium">
                      الملف: <span className="font-bold text-indigo-700">{sourceFileName}</span>
                    </div>
                  </div>
                </div>

                {/* Header Row Selector Dropdown */}
                {allRawData.length > 1 && (
                  <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200 text-xs">
                    <span className="font-bold text-slate-700">صف عناوين الجدول:</span>
                    <select
                      value={selectedHeaderRowIdx}
                      onChange={(e) => applyHeaderRow(allRawData, Number(e.target.value))}
                      className="bg-white border border-slate-300 rounded-lg px-2 py-1 font-bold text-indigo-900 focus:outline-none cursor-pointer text-xs"
                    >
                      {allRawData.slice(0, 10).map((row, idx) => {
                        const preview = row.filter(c => String(c).trim().length > 0).slice(0, 3).join(' | ');
                        return (
                          <option key={idx} value={idx}>
                            الصف {idx + 1}: {preview.length > 30 ? preview.substring(0, 30) + '...' : preview}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                )}
              </div>

              {/* Notice if no financial column is selected yet */}
              {!hasFinancialColumn && (
                <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 flex items-center gap-2 text-xs text-amber-900 font-bold">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    يرجى تعيين عمود <strong>[مبلغ المجهز]</strong> أو <strong>[المبلغ التخميني]</strong> عبر القائمة المنسدلة أعلى العمود المطلوب لتأكيد الاستيراد.
                  </span>
                </div>
              )}

              {/* Column Mapping Selectors & Preview Table */}
              <div className="overflow-x-auto max-h-[320px] border border-slate-200 rounded-xl">
                <table className="w-full text-xs text-right border-collapse">
                  
                  {/* Selectors Header */}
                  <thead className="bg-slate-900 text-white sticky top-0 z-10">
                    <tr>
                      {rawHeaders.map((header, colIdx) => {
                        const currentRole = columnMappings[colIdx] || 'ignore';
                        return (
                          <th key={colIdx} className="p-3 border-l border-slate-800 min-w-[160px]">
                            <div className="text-[11px] text-slate-300 font-bold mb-1 truncate" title={header}>
                              {header}
                            </div>
                            
                            {/* Role Dropdown */}
                            <select
                              value={currentRole}
                              onChange={(e) => handleMapColumn(colIdx, e.target.value as ColumnRole)}
                              className={`w-full text-xs font-black p-1.5 rounded-lg border focus:outline-none cursor-pointer ${
                                currentRole === 'bidderTotal'
                                  ? 'bg-indigo-600 text-white border-indigo-400'
                                  : currentRole === 'estimatedTotal'
                                  ? 'bg-blue-600 text-white border-blue-400'
                                  : currentRole === 'itemNo'
                                  ? 'bg-amber-600 text-slate-950 border-amber-400'
                                  : currentRole === 'description'
                                  ? 'bg-emerald-700 text-white border-emerald-400'
                                  : currentRole === 'quantity'
                                  ? 'bg-slate-700 text-purple-200 border-purple-400'
                                  : 'bg-slate-800 text-slate-400 border-slate-700'
                              }`}
                            >
                              <option value="ignore">✕ تجاهل هذا العمود</option>
                              <option value="bidderTotal">🏢 مبلغ / سعر المجهز</option>
                              <option value="estimatedTotal">💰 المبلغ التخميني</option>
                              <option value="description">📝 وصف / اسم المادة</option>
                              <option value="itemNo">🔢 رقم الفقرة (ت)</option>
                              <option value="quantity">📦 الكمية / العدد</option>
                            </select>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>

                  {/* Sample Rows Preview */}
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {rawRows.slice(0, 8).map((row, rowIdx) => (
                      <tr key={rowIdx} className="hover:bg-slate-50">
                        {rawHeaders.map((_, colIdx) => {
                          const role = columnMappings[colIdx] || 'ignore';
                          const val = row[colIdx] || '-';
                          const isIgnored = role === 'ignore';

                          return (
                            <td 
                              key={colIdx} 
                              className={`p-2.5 border-l border-slate-200 font-mono text-xs ${
                                isIgnored 
                                  ? 'text-slate-400 bg-slate-50/50 line-through' 
                                  : role === 'bidderTotal'
                                  ? 'text-indigo-900 bg-indigo-50/30 font-black'
                                  : role === 'estimatedTotal'
                                  ? 'text-blue-900 bg-blue-50/30 font-black'
                                  : role === 'description'
                                  ? 'text-emerald-950 bg-emerald-50/30 font-bold'
                                  : 'text-slate-900 font-bold'
                              }`}
                            >
                              {val}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>

                </table>
              </div>

              {/* Step 3: Destination Target (Current Bidder vs New Bidder) */}
              <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4">
                
                <div className="flex items-center gap-4 flex-wrap">
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer">
                    <input
                      type="radio"
                      name="importTarget"
                      value="current"
                      checked={importTarget === 'current'}
                      onChange={() => setImportTarget('current')}
                      className="text-indigo-600"
                    />
                    <span>تحديث وتعبئة جدول المجهز الحالي ({currentBidderName})</span>
                  </label>

                  <label className="flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer">
                    <input
                      type="radio"
                      name="importTarget"
                      value="new"
                      checked={importTarget === 'new'}
                      onChange={() => setImportTarget('new')}
                      className="text-indigo-600"
                    />
                    <span>إنشاء مجهز / شركة جديدة بهذا الجدول</span>
                  </label>
                </div>

                {importTarget === 'new' && (
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-indigo-600" />
                    <input
                      type="text"
                      placeholder="اسم الشركة / المجهز الجديد..."
                      value={newBidderName}
                      onChange={(e) => setNewBidderName(e.target.value)}
                      className="text-xs font-bold border border-indigo-300 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-56"
                    />
                  </div>
                )}

              </div>

            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-100 border-t border-slate-200 flex items-center justify-between">
          <div className="text-xs text-slate-500 font-medium">
            {rawRows.length > 0 ? `جاهز لاستيراد (${rawRows.length}) فقرة إلى جدول التحليل` : 'اختر ملفاً أو الصق جدولاً للبدء'}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 bg-white border border-slate-300 rounded-xl cursor-pointer"
            >
              إلغاء
            </button>

            <button
              onClick={handleConfirmImport}
              disabled={rawRows.length === 0}
              className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white text-xs font-black px-6 py-2 rounded-xl shadow-md transition transform active:scale-95 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>تأكيد واستيراد البيانات إلى الجدول</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  UploadCloud,
  FileSpreadsheet,
  ClipboardPaste,
  Sparkles,
  Table as TableIcon,
  Coins,
  FileEdit,
  Layers,
  Calculator,
  FileCheck2
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { BOQItem } from '../../types/tender';
import { parseArabicNumber } from '../../utils/calculations';
import { auditBidderRows, auditRowAmounts, BidderAuditReport, quantityMismatches } from '../../utils/bidderAuditEngine';
import { isPdfFile } from '../../utils/pdfService';
import { QuantityMismatchNotice } from '../QuantityMismatchNotice';

export type ImportDocType = 'bidder' | 'estimated' | 'both';
export type ImportMode = 'estimated_only' | 'bidder_only' | 'new_bidder' | 'full_replace';

interface SmartTableImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyExtractedItems: (
    items: Partial<BOQItem>[],
    mode: ImportMode,
    bidderName?: string
  ) => void;
  currentBidderName: string;
  initialDocType?: ImportDocType;
  // مدخل استيراد واحد لكل أنواع الملفات: PDF والصور تُسلَّم لنافذة القراءة بالذكاء الاصطناعي بنوع الجدول المختار
  onReadWithAi?: (files: File[], docType: 'bidder' | 'estimated') => void;
  // فقرات الجدول الحالية: استيراد عطاء المجهز يُبقي كميتها ويُفحص بها، فتُقارن بها كمية الملف في المعاينة
  tableRows?: Pick<BOQItem, 'itemNo' | 'quantity'>[];
}

// PDF أو صورة: تُقرأ بالذكاء الاصطناعي لا بمطابقة الأعمدة
const isAiReadable = (f: File) => isPdfFile(f) || f.type.startsWith('image/');

type ColumnRole = 'itemNo' | 'estimatedTotal' | 'unitPrice' | 'quantity' | 'bidderTotal' | 'writtenText' | 'description' | 'ignore';

export const SmartTableImportModal: React.FC<SmartTableImportModalProps> = ({
  isOpen,
  onClose,
  onApplyExtractedItems,
  currentBidderName,
  initialDocType = 'bidder',
  onReadWithAi,
  tableRows = []
}) => {
  const [docType, setDocType] = useState<ImportDocType>(initialDocType);
  const [allRawData, setAllRawData] = useState<string[][]>([]);
  const [selectedHeaderRowIdx, setSelectedHeaderRowIdx] = useState<number>(0);
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<string[][]>([]);
  const [columnMappings, setColumnMappings] = useState<ColumnRole[]>([]);
  const [newBidderName, setNewBidderName] = useState<string>('');
  const [pastedText, setPastedText] = useState<string>('');
  const [sourceFileName, setSourceFileName] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [auditReport, setAuditReport] = useState<BidderAuditReport | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // نوع الجدول الحالي لقراءة ملف Excel غير المتزامنة: إن غيّره المستخدم أثناء القراءة لا تُبنى الأعمدة بالنوع القديم.
  // يُحدَّث مع كل تغيير للنوع عبر chooseDocType
  const docTypeRef = useRef(initialDocType);
  const chooseDocType = (type: ImportDocType) => {
    docTypeRef.current = type;
    setDocType(type);
  };

  // رقم آخر قراءة ملف: الفتح والإغلاق وكل قراءة أحدث تُبطل ما قبلها، فلا تملأ قراءةٌ بطيئة لملف سابق نافذةً أُعيد فتحها
  const readGenRef = useRef(0);

  // النافذة تبقى مركّبة بين الفتحات، فكل فتح يبدأ بلا ملف: كان الملف السابق وتقريره يبقيان بنوع الجدول
  // الافتراضي، فيمكن استيراده ثانية بغير نوعه
  useEffect(() => {
    chooseDocType(initialDocType);
    readGenRef.current++;
    if (!isOpen) return;
    setAllRawData([]);
    setRawHeaders([]);
    setRawRows([]);
    setColumnMappings([]);
    setAuditReport(null);
    setPastedText('');
    setSourceFileName('');
    setNewBidderName('');
  }, [initialDocType, isOpen]);

  if (!isOpen) return null;

  // الكشف الذكي التلقائي عن الأدوار الدقيقة لكافة الأعمدة
  const autoDetectRoles = (headers: string[], selectedDocType: ImportDocType): ColumnRole[] => {
    return headers.map((h) => {
      const clean = h.trim().toLowerCase();
      
      // 1. رقم الفقرة
      if (
        /^(ت|رقم|الرقم|فقرة|الفقرة|تسلسل|م|item|no|itemno|#|id)$/i.test(clean) || 
        clean.includes('تسلسل') || 
        clean.includes('رقم الفقرة')
      ) {
        return 'itemNo';
      }

      // 2. الوصف / اسم المادة
      if (
        clean.includes('اسم المادة') || 
        clean.includes('المادة') || 
        clean.includes('وصف') || 
        clean.includes('بيان') || 
        clean.includes('description') || 
        clean.includes('تفاصيل')
      ) {
        return 'description';
      }

      // 3. سعر المفرد
      if (
        clean.includes('سعر المفرد') || 
        clean.includes('المفرد') || 
        clean.includes('سعر مفرد') || 
        clean.includes('unit price') || 
        clean.includes('rate')
      ) {
        return 'unitPrice';
      }

      // 4. العدد / الكمية
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

      // 5. التفقيط / مبلغ الفقرة كتابةً
      if (
        clean.includes('كتابة') || 
        clean.includes('كتابةً') || 
        clean.includes('تفقيط') || 
        clean.includes('words')
      ) {
        return 'writtenText';
      }

      // 6. مبلغ الفقرة رقماً
      if (
        clean.includes('مبلغ الفقرة') || 
        clean.includes('مبلغ') || 
        clean.includes('رقما') || 
        clean.includes('رقماً') || 
        clean.includes('الإجمالي') || 
        clean.includes('مجهز') || 
        clean.includes('عطاء') || 
        clean.includes('total')
      ) {
        return selectedDocType === 'estimated' ? 'estimatedTotal' : 'bidderTotal';
      }

      // 7. الكلفة التخمينية
      if (clean.includes('تخمين') || clean.includes('estimated')) {
        return 'estimatedTotal';
      }

      return 'ignore';
    });
  };

  // خوارزمية اكتشاف صف العناوين الحقيقي
  const findBestHeaderRowIndex = (data: string[][]): number => {
    let bestIdx = 0;
    let maxScore = -1;

    const keywords = ['ت', 'رقم', 'فقرة', 'مادة', 'اسم', 'وصف', 'سعر', 'مفرد', 'تخمين', 'مجهز', 'عدد', 'كمية', 'وحدة', 'مبلغ', 'كتابة', 'item', 'price', 'qty', 'description'];

    for (let r = 0; r < Math.min(12, data.length); r++) {
      const row = data[r] || [];
      const nonEmptyCells = row.filter(c => String(c).trim().length > 0);
      if (nonEmptyCells.length < 2) continue;

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

  // صفوف الملف كما تُدرج (handleConfirmImport) وكما تُدقَّق في المعاينة، فيتطابقان. kept يُسقط صفوف «المجموع»
  // الخالية من المبالغ، وtableQty كمية الجدول في موضع الفقرة بعد الإسقاط (الدمج بالترتيب). استيراد عطاء المجهز
  // يُبقي كمية الجدول (handleApplyExtractedItems)، فيُفحص الضرب بها، وبلا عمود للمبلغ يُحسب المبلغ بها
  const mapImportRows = (rows: string[][], roles: ColumnRole[], selectedDoc: ImportDocType) => {
    const itemNoIdx = roles.indexOf('itemNo');
    const estIdx = roles.indexOf('estimatedTotal');
    const unitPriceIdx = roles.indexOf('unitPrice');
    const qtyIdx = roles.indexOf('quantity');
    const bidIdx = roles.indexOf('bidderTotal');
    const descIdx = roles.indexOf('description');
    const writtenIdx = roles.indexOf('writtenText');
    let keptCount = 0;

    return rows.map((row, idx) => {
      const itemNoVal = itemNoIdx !== -1 && row[itemNoIdx] ? row[itemNoIdx] : String(idx + 1);
      const estVal = estIdx !== -1 ? parseArabicNumber(row[estIdx]) : 0;
      const unitPriceVal = unitPriceIdx !== -1 ? parseArabicNumber(row[unitPriceIdx]) : 0;
      const fileQty = qtyIdx !== -1 ? parseArabicNumber(row[qtyIdx]) : 0; // 0: لا كمية في الملف
      const writtenBid = bidIdx !== -1 ? parseArabicNumber(row[bidIdx]) : null;
      const descVal = descIdx !== -1 && row[descIdx] ? row[descIdx] : `فقرة ${itemNoVal}`;
      const writtenVal = writtenIdx !== -1 && row[writtenIdx] ? String(row[writtenIdx]).trim() : undefined;

      const hasBidAmount = selectedDoc !== 'estimated' && (writtenBid !== null ? writtenBid > 0 : unitPriceVal > 0);
      const kept = estVal > 0 || hasBidAmount || !descVal.includes('مجموع');
      const tableQty = kept && selectedDoc === 'bidder' ? (tableRows[keptCount]?.quantity || 0) : 0;
      if (kept) keptCount++;
      const checkQty = tableQty > 0 ? tableQty : (fileQty || 1);

      // الحفاظ على مبلغ المجهز الأصلي كما دونه في العطاء تماماً؛ بلا عمود للمبلغ يُحسب المفرد × الكمية
      const enteredBidVal = writtenBid !== null ? writtenBid : unitPriceVal * checkQty;
      // العلامتان كما في القراءة بالذكاء الاصطناعي: التفقيط للمفرد أو للمبلغ، والضرب لكمية أكبر من 1
      const { hasMathError: isMathErr, hasTextDiscrepancy: isTextDisc } =
        auditRowAmounts(checkQty, unitPriceVal, enteredBidVal, writtenVal);

      const item: Partial<BOQItem> = {
        itemNo: itemNoVal,
        description: descVal,
        // بلا كمية في الملف (عمود مبالغ ملصوق مثلاً) تبقى كمية الجدول: كانت 1 تحل محلها في كل الفقرات.
        // الجدول المتكامل يستبدل الجدول كله فيبقى 1 فيه
        quantity: fileQty > 0 ? fileQty : (selectedDoc === 'both' ? 1 : undefined),
        estimatedTotal: estVal,
        bidderTotal: selectedDoc === 'estimated' ? 0 : enteredBidVal,
        enteredUnitPrice: unitPriceVal,
        enteredBidderTotal: enteredBidVal,
        writtenText: writtenVal,
        hasMathError: isMathErr,
        hasTextDiscrepancy: isTextDisc,
        correctionRationale: isMathErr ? 'مؤشر خطأ ضرب في عطاء المجهز' : undefined
      };
      return { item, kept, fileQty, tableQty, checkQty };
    });
  };

  // تشغيل الفحص التدقيقي عند تجهيز الصفوف — تدقيق لعطاء المجهز وحده: جدول الكلفة التخمينية لا يُدرج منه
  // سعر مجهز ولا علامات (handleApplyExtractedItems يأخذ منه الكمية والتخميني فقط)، فكان تقريره يُنسب
  // «لعطاء المجهز» ويؤشّر خطأ ضرب في كل فقرة كميتها أكبر من 1
  const runForensicAudit = (headers: string[], rows: string[][], roles: ColumnRole[], selectedDoc: ImportDocType = docType) => {
    if (selectedDoc === 'estimated') {
      setAuditReport(null);
      return;
    }
    const formattedRows = mapImportRows(rows, roles, selectedDoc).map(({ item, checkQty }) => ({
      itemNo: item.itemNo,
      description: item.description,
      unitPrice: item.enteredUnitPrice,
      quantity: checkQty,
      enteredTotal: item.enteredBidderTotal,
      writtenText: item.writtenText
    }));

    const report = auditBidderRows(formattedRows, sourceFileName || currentBidderName);
    setAuditReport(report);
  };

  // تطبيق صف العناوين المختار
  const applyHeaderRow = (data: string[][], headerIdx: number, selectedDoc: ImportDocType) => {
    if (!data || data.length === 0) return;
    
    const rawHeaderRow = data[headerIdx] || [];
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

    const roles = autoDetectRoles(headers, selectedDoc);
    setColumnMappings(roles);
    runForensicAudit(headers, rows, roles, selectedDoc);
  };

  // اختيار نوع المستند
  const handleSelectDocType = (type: ImportDocType) => {
    chooseDocType(type);
    if (rawHeaders.length > 0) {
      const roles = autoDetectRoles(rawHeaders, type);
      setColumnMappings(roles);
      runForensicAudit(rawHeaders, rawRows, roles, type);
    }
  };

  // توجيه الملفات بحسب نوعها: PDF والصور إلى القراءة بالذكاء الاصطناعي، وExcel وCSV إلى مطابقة الأعمدة هنا
  const routeFiles = (files: File[]) => {
    if (files.length === 0) return;
    const aiFiles = files.filter(isAiReadable);
    if (aiFiles.length > 0) {
      if (aiFiles.length !== files.length) {
        alert('اختر نوعاً واحداً من الملفات في كل مرة: ملفات Excel، أو ملفات PDF وصور.');
        return;
      }
      if (docType === 'both') {
        // القراءة بالذكاء الاصطناعي تستخرج عمود مبالغ واحداً
        alert('الجدول المتكامل (تخميني + مجهز) غير مدعوم لملفات PDF والصور. اختر «أسعار عرض المجهز» أو «جدول الكلفة التخمينية» ثم ارفع الملف.');
        return;
      }
      onReadWithAi?.(aiFiles, docType);
      return;
    }
    // ملف جدول واحد في كل مرة (صفحات PDF والصور تُقبل معاً، أما Excel فكل ملف جدول مستقل)
    if (files.length > 1) {
      alert('اختر ملف Excel واحداً في كل مرة.');
      return;
    }
    void handleExcelFile(files[0]);
  };

  // معالجة ملف Excel
  const handleExcelFile = async (file: File) => {
    const gen = ++readGenRef.current;
    setIsProcessing(true);
    setSourceFileName(file.name);

    try {
      const data = await file.arrayBuffer();
      if (gen !== readGenRef.current) return; // أُغلقت النافذة أو بدأت قراءة أحدث
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
      applyHeaderRow(stringData, bestHeaderIdx, docTypeRef.current);

      const cleanFileName = file.name.replace(/\.[^/.]+$/, '').replace(/جدول|عطاء|مناقصة|تحليل|BOQ|أسعار|مواد|سيناريو|اختبار/gi, '').trim();
      if (cleanFileName) {
        setNewBidderName(cleanFileName);
      }
    } catch (err: any) {
      alert(`حدث خطأ أثناء قراءة الملف: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // معالجة اللصق
  const handleProcessPastedText = () => {
    if (!pastedText.trim()) return;

    const lines = pastedText.trim().split(/\r?\n/);
    if (lines.length === 0) return;

    const stringData = lines.map(line => line.split('\t').map(c => c.trim()));
    if (stringData.length === 0) return;

    setAllRawData(stringData);
    const bestHeaderIdx = findBestHeaderRowIndex(stringData);
    applyHeaderRow(stringData, bestHeaderIdx, docType);
    setSourceFileName('جدول منسوخ من الحافظة (Word / Excel)');
  };

  // تغيير دور العمود يدوياً — الفحص خارج دالة التحديث، لأن دالة setState يجب ألا تُحدِّث حالة أخرى
  const handleMapColumn = (colIndex: number, role: ColumnRole) => {
    const updated = [...columnMappings];
    updated[colIndex] = role;
    setColumnMappings(updated);
    runForensicAudit(rawHeaders, rawRows, updated);
  };

  // تأكيد الاستيراد
  const handleConfirmImport = () => {
    if (rawRows.length === 0) {
      alert('لا توجد بيانات للاستيراد.');
      return;
    }

    const extractedItems = mapImportRows(rawRows, columnMappings, docType).filter(r => r.kept).map(r => r.item);

    if (extractedItems.length === 0) {
      alert('لم يتم العثور على قيم صالحة في الأعمدة المحددة.');
      return;
    }

    const finalMode: ImportMode = 
      docType === 'estimated' ? 'estimated_only' :
      docType === 'bidder' ? 'bidder_only' : 'full_replace';

    onApplyExtractedItems(
      extractedItems,
      finalMode,
      newBidderName.trim() || undefined
    );

    onClose();
  };

  // فقرات كميتها في الملف تختلف عن كمية الجدول. لعطاء المجهز وحده: جدول الكلفة التخمينية يضع كميته،
  // والجدول المتكامل يستبدل الجدول كله
  const mappedRows = rawRows.length > 0 ? mapImportRows(rawRows, columnMappings, docType) : [];
  const qtyMismatchList = docType === 'bidder'
    ? quantityMismatches(mappedRows.filter(r => r.kept).map(r => ({ quantity: r.fileQty })), tableRows)
    : [];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-6xl max-h-[94vh] flex flex-col overflow-hidden">
        
        {/* Modal Header */}
        <div className="p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between border-b border-indigo-500/30">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600 text-white rounded-2xl shadow-md">
              <UploadCloud className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight text-white flex items-center gap-2">
                معالج الاستيراد والتدقيق الحسابي والقانوني لجداول العطاءات
                <span className="text-[10px] bg-amber-500 text-slate-950 px-2 py-0.5 rounded-md font-bold">
                  Math & Legal Auditor
                </span>
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">
                يكتشف أخطاء الضرب الحسابي وتعارض الأرقام مع التفقيط المكتوب كتابةً، ويعرض التصحيح كخيار يعتمده العضو المختص صراحة دون تعديل تلقائي صامت.
              </p>
            </div>
          </div>

          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-xl cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50 text-slate-900">
          
          {/* Step 0: Upfront Document Type Selector */}
          <div className="space-y-2">
            <div className="text-xs font-black text-slate-800 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>حدد نوع الجدول أو الملف الذي ترفعه الآن:</span>
            </div>

            <div role="group" aria-label="نوع الجدول" className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              
              {/* Card 1: Bidder Quotation */}
              <div 
                onClick={() => handleSelectDocType('bidder')}
                role="button"
                aria-pressed={docType === 'bidder'}
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSelectDocType('bidder'); } }}
                className={`p-4 rounded-2xl border-2 cursor-pointer transition flex flex-col justify-between relative ${
                  docType === 'bidder'
                    ? 'border-indigo-600 bg-indigo-50/70 shadow-md ring-2 ring-indigo-500/20'
                    : 'border-slate-200 bg-white hover:border-indigo-200'
                }`}
              >
                {docType === 'bidder' && (
                  <div className="absolute -top-2.5 left-3 bg-indigo-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-xs">
                    محدد حالياً ✓
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
                      <FileEdit className="w-5 h-5" />
                    </div>
                    <div className="text-sm font-black text-indigo-950">1. أسعار عرض المجهز / المقاول</div>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    لاستيراد وتدقيق أسعار مفردات عطاء المجهز مع <strong>الحفاظ الكامل على الكلفة التخمينية</strong>.
                  </p>
                </div>
              </div>

              {/* Card 2: Estimated Cost */}
              <div 
                onClick={() => handleSelectDocType('estimated')}
                role="button"
                aria-pressed={docType === 'estimated'}
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSelectDocType('estimated'); } }}
                className={`p-4 rounded-2xl border-2 cursor-pointer transition flex flex-col justify-between relative ${
                  docType === 'estimated'
                    ? 'border-blue-600 bg-blue-50/70 shadow-md ring-2 ring-blue-500/20'
                    : 'border-slate-200 bg-white hover:border-blue-200'
                }`}
              >
                {docType === 'estimated' && (
                  <div className="absolute -top-2.5 left-3 bg-blue-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-xs">
                    محدد حالياً ✓
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="p-2 bg-blue-100 text-blue-700 rounded-xl">
                      <Coins className="w-5 h-5" />
                    </div>
                    <div className="text-sm font-black text-blue-950">2. جدول الكلفة التخمينية</div>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    لاستيراد الكلفة التخمينية والفقرات مع <strong>الحفاظ الكامل على أسعار المجهزين</strong> دون مساس.
                  </p>
                </div>
              </div>

              {/* Card 3: Complete Both */}
              <div 
                onClick={() => handleSelectDocType('both')}
                role="button"
                aria-pressed={docType === 'both'}
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSelectDocType('both'); } }}
                className={`p-4 rounded-2xl border-2 cursor-pointer transition flex flex-col justify-between relative ${
                  docType === 'both'
                    ? 'border-slate-900 bg-slate-100 shadow-md ring-2 ring-slate-900/20'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                {docType === 'both' && (
                  <div className="absolute -top-2.5 left-3 bg-slate-900 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-xs">
                    محدد حالياً ✓
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="p-2 bg-slate-200 text-slate-800 rounded-xl">
                      <Layers className="w-5 h-5" />
                    </div>
                    <div className="text-sm font-black text-slate-950">3. جدول متكامل (تخميني + مجهز)</div>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    إذا كان الملف يحتوي على عمودين للمبالغ (التخميني ومبلغ المجهز معاً في نفس الجدول).
                  </p>
                </div>
              </div>

            </div>
          </div>

          {/* Step 1: Upload or Paste */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* File Upload Box */}
            <div
              onClick={() => fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInputRef.current?.click(); } }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); routeFiles(Array.from(e.dataTransfer.files || [])); }}
              className="border-2 border-dashed border-indigo-300 hover:border-indigo-600 bg-indigo-50/40 hover:bg-indigo-50/80 rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition group shadow-2xs"
            >
              <FileSpreadsheet className="w-10 h-10 text-indigo-600 group-hover:scale-110 transition mb-2" />
              <div className="text-sm font-black text-slate-900">
                رفع ملف <bdi dir="ltr">Excel / PDF</bdi> أو صورة ({docType === 'estimated' ? 'جدول الكلفة التخمينية' : docType === 'both' ? 'جدول متكامل' : 'جدول أسعار وعطاء المجهز'})
              </div>
              <div className="text-xs text-slate-500 mt-1">انقر للاختيار أو اسحب الملف وأفلته هنا</div>
              <div className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                Excel يُقرأ بمطابقة الأعمدة، و<bdi dir="ltr">PDF</bdi> والصور بالذكاء الاصطناعي (يحتاج اتصالاً بالإنترنت)
                {docType === 'both' && <span className="block text-amber-700 font-bold">الجدول المتكامل: ملفات Excel فقط</span>}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv,.pdf,application/pdf,image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  e.target.value = ''; // اختيار الملف نفسه مرة أخرى يُطلق التحميل من جديد
                  routeFiles(files);
                }}
              />
            </div>

            {/* Paste from Word / Excel */}
            <div className="border border-slate-300 bg-white rounded-2xl p-4 flex flex-col justify-between shadow-2xs">
              <div>
                <div className="flex items-center gap-1.5 text-xs font-black text-slate-800 mb-2">
                  <ClipboardPaste className="w-4 h-4 text-indigo-600" />
                  <span>أو انسخ الجدول والصقه هنا مباشرة (Ctrl+V):</span>
                </div>
                <textarea
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  onPaste={(e) => {
                    // لقطة شاشة لجدول تُقرأ بالذكاء الاصطناعي بدل لصقها نصاً فارغاً
                    const images = Array.from(e.clipboardData.files || []).filter(f => f.type.startsWith('image/'));
                    if (images.length > 0) { e.preventDefault(); routeFiles(images); }
                  }}
                  placeholder="انسخ أي جدول أو عمود مبالغ من Excel أو Word والصقه هنا..."
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

          <QuantityMismatchNotice mismatches={qtyMismatchList} source="الملف" />

          {/* Step 2: Audit Results Dashboard (When Errors are Detected) */}
          {auditReport && auditReport.itemsWithErrorsCount > 0 && (
            <div className="bg-gradient-to-br from-rose-50 via-amber-50 to-white rounded-3xl border-2 border-rose-300 shadow-md p-5 space-y-4">
              
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rose-200/80 pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-rose-600 text-white rounded-2xl shadow-sm">
                    <Calculator className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-black text-rose-950 flex items-center gap-2">
                      تقرير التدقيق الحسابي والمطابقة النصية لعطاء المجهز
                      <span className="text-xs bg-rose-600 text-white px-2 py-0.5 rounded-md font-bold">
                        تم اكتشاف {auditReport.itemsWithErrorsCount} أخطاء
                      </span>
                    </h3>
                    {/* كان هنا خيار «اعتماد التصحيح الحسابي بسعر المفرد لهذا الاستيراد» لا يقرؤه الإدراج: المبالغ
                        تُدرج كما دوّنها المجهز دائماً، والتصحيح قرار صريح للجنة لكل فقرة في الجدول بعد الإدراج */}
                    <p className="text-xs text-rose-800 font-medium">
                      تُدرج أرقام العطاء كما دوّنها المجهز وتُؤشَّر هذه الأخطاء في الجدول، واعتماد تصحيح كل فقرة قرار صريح تتخذه اللجنة بعد الإدراج.
                    </p>
                  </div>
                </div>
              </div>

              {/* KPI Audit Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white p-3 rounded-2xl border border-slate-200">
                  <div className="text-[11px] text-slate-500 font-bold">إجمالي المبالغ المدونة بالعطاء</div>
                  <div className="text-sm font-black text-slate-900 font-mono mt-0.5">
                    {auditReport.originalTotalEntered.toLocaleString()} د.ع
                  </div>
                </div>

                <div className="bg-white p-3 rounded-2xl border border-emerald-300">
                  <div className="text-[11px] text-emerald-700 font-bold">المبلغ القانوني الصحيح (المفرد × العدد)</div>
                  <div className="text-sm font-black text-emerald-800 font-mono mt-0.5">
                    {auditReport.correctedLegalTotal.toLocaleString()} د.ع
                  </div>
                </div>

                <div className="bg-white p-3 rounded-2xl border border-amber-300">
                  <div className="text-[11px] text-amber-700 font-bold">أخطاء الضرب الحسابي</div>
                  <div className="text-sm font-black text-amber-800 mt-0.5">
                    {auditReport.mathErrorsCount} فقرات خاطئة
                  </div>
                </div>

                <div className="bg-white p-3 rounded-2xl border border-purple-300">
                  <div className="text-[11px] text-purple-700 font-bold">تعارض التفقيط مع الرقم</div>
                  <div className="text-sm font-black text-purple-800 mt-0.5">
                    {auditReport.textDiscrepanciesCount} حالات تعارض
                  </div>
                </div>
              </div>

              {/* Error Detail Cards */}
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {auditReport.rows.filter(r => r.hasMathError || r.hasTextDiscrepancy).map((row, idx) => (
                  <div key={idx} className="bg-white p-2.5 rounded-xl border border-rose-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-bold bg-slate-900 text-white px-2 py-0.5 rounded-md text-[11px]">
                        فقرة {row.itemNo}
                      </span>
                      <span className="font-bold text-slate-800">{row.description}</span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px]">
                      {row.hasMathError && (
                        <span className="text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 font-bold">
                          ⚠️ خطأ ضرب: المدون ({row.enteredNumberTotal.toLocaleString()}) ≠ الصحيح ({row.calculatedMathTotal.toLocaleString()})
                        </span>
                      )}
                      {row.hasTextDiscrepancy && (
                        <span className="text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200 font-bold">
                          📝 تعارض تفقيط: المكتوب ({row.writtenText})
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

            </div>
          )}

          {/* Step 3: Interactive Column Mapping Grid */}
          {rawHeaders.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
              
              {/* Header Info & Row Selector */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <TableIcon className="w-5 h-5 text-indigo-600" />
                  <div>
                    <h3 className="text-sm font-black text-slate-900">
                      الأعمدة المستخلصة من الملف ({rawHeaders.length} أعمدة • {rawRows.length} أسطر)
                    </h3>
                    <div className="text-xs text-slate-500 font-medium">
                      الملف: <span className="font-bold text-indigo-700">{sourceFileName}</span>
                    </div>
                  </div>
                </div>

                {/* Header Row Selector Dropdown */}
                {allRawData.length > 1 && (
                  <label className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200 text-xs">
                    <span className="font-bold text-slate-700">صف عناوين الجدول:</span>
                    <select
                      value={selectedHeaderRowIdx}
                      onChange={(e) => applyHeaderRow(allRawData, Number(e.target.value), docType)}
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
                  </label>
                )}
              </div>

              {/* Column Mapping Selectors & Preview Table */}
              <div className="overflow-x-auto max-h-[300px] border border-slate-200 rounded-xl">
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
                            
                            {/* Role Dropdown — اسمه لقارئ الشاشة يذكر العمود الذي يُحدَّد دوره */}
                            <select
                              aria-label={`دور العمود: ${header}`}
                              value={currentRole}
                              onChange={(e) => handleMapColumn(colIdx, e.target.value as ColumnRole)}
                              className={`w-full text-xs font-black p-1.5 rounded-lg border focus:outline-none cursor-pointer ${
                                currentRole === 'unitPrice'
                                  ? 'bg-indigo-600 text-white border-indigo-400'
                                  : currentRole === 'quantity'
                                  ? 'bg-purple-600 text-white border-purple-400'
                                  : currentRole === 'bidderTotal'
                                  ? 'bg-blue-600 text-white border-blue-400'
                                  : currentRole === 'writtenText'
                                  ? 'bg-amber-600 text-slate-950 border-amber-400'
                                  : currentRole === 'description'
                                  ? 'bg-emerald-700 text-white border-emerald-400'
                                  : currentRole === 'itemNo'
                                  ? 'bg-slate-700 text-white border-slate-500'
                                  : 'bg-slate-800 text-slate-400 border-slate-700'
                              }`}
                            >
                              <option value="ignore">✕ تجاهل هذا العمود</option>
                              <option value="unitPrice">🏷️ سعر المفرد (د.ع)</option>
                              <option value="quantity">🔢 العدد / الكمية</option>
                              <option value="bidderTotal">🏢 مبلغ الفقرة رقماً</option>
                              <option value="writtenText">📝 التفقيط (المفرد أو المبلغ كتابةً)</option>
                              <option value="description">📋 اسم المادة / الوصف</option>
                              <option value="itemNo">🔢 رقم الفقرة (ت)</option>
                              <option value="estimatedTotal">💰 المبلغ التخميني</option>
                            </select>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>

                  {/* Sample Rows Preview with Audit Badges */}
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {rawRows.slice(0, 15).map((row, rowIdx) => {
                      const auditRow = auditReport?.rows[rowIdx];
                      // كمية الملف تخالف كمية الجدول في موضع هذه الفقرة (تبقى كمية الجدول)
                      const mapped = docType === 'bidder' ? mappedRows[rowIdx] : undefined;
                      const qtyDiffers = !!mapped && mapped.fileQty > 0 && mapped.tableQty > 0
                        && Math.abs(mapped.fileQty - mapped.tableQty) > 1e-9;
                      return (
                        <tr 
                          key={rowIdx} 
                          className={`hover:bg-slate-50 ${
                            auditRow?.hasMathError || auditRow?.hasTextDiscrepancy ? 'bg-rose-50/40' : ''
                          }`}
                        >
                          {rawHeaders.map((_, colIdx) => {
                            const role = columnMappings[colIdx] || 'ignore';
                            const val = row[colIdx] || '-';
                            const isIgnored = role === 'ignore';

                            const qtyCellDiffers = role === 'quantity' && qtyDiffers;
                            return (
                              <td
                                key={colIdx}
                                title={qtyCellDiffers ? `كمية الجدول: ${mapped!.tableQty.toLocaleString('en-US')} — تبقى، ويُفحص الضرب بها` : undefined}
                                className={`p-2.5 border-l border-slate-200 font-mono text-xs ${
                                  isIgnored
                                    ? 'text-slate-400 bg-slate-50/50 line-through'
                                    : role === 'unitPrice'
                                    ? 'text-indigo-950 bg-indigo-50/40 font-black'
                                    : qtyCellDiffers
                                    ? 'text-amber-950 bg-amber-100 font-black text-center'
                                    : role === 'quantity'
                                    ? 'text-purple-950 bg-purple-50/40 font-bold text-center'
                                    : role === 'bidderTotal' && auditRow?.hasMathError
                                    ? 'text-rose-700 bg-rose-100 font-black'
                                    : role === 'writtenText' && auditRow?.hasTextDiscrepancy
                                    ? 'text-purple-900 bg-purple-100 font-bold'
                                    : 'text-slate-900 font-bold'
                                }`}
                              >
                                {val}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>

                </table>
              </div>

            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-100 border-t border-slate-200 flex items-center justify-between">
          <div className="text-xs text-slate-500 font-medium">
            {rawRows.length > 0 ? `جاهز لاستيراد (${rawRows.length}) فقرة مع تطبيق معايير التدقيق والتصحيح القانوني` : 'حدد نوع الجدول أولاً ثم ارفع الملف للبدء'}
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
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-xs font-black px-6 py-2.5 rounded-xl shadow-md transition transform active:scale-95 cursor-pointer"
            >
              <FileCheck2 className="w-4 h-4" />
              <span>اعتماد واستيراد الجدول في النظام</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

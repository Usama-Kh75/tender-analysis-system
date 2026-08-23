import React, { useState } from 'react';
import { 
  X, 
  Upload, 
  Sparkles, 
  Check, 
  AlertCircle, 
  Loader2, 
  FileText, 
  CheckCircle2,
  Trash2,
  Plus
} from 'lucide-react';
import { BOQItem } from '../../types/tender';
import { extractBOQFromImage } from '../../utils/ocrService';
import { formatNumber } from '../../utils/calculations';

interface ImageOcrModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyExtractedItems: (items: Partial<BOQItem>[], createAsNewBidder: boolean, bidderName?: string) => void;
}

export const ImageOcrModal: React.FC<ImageOcrModalProps> = ({
  isOpen,
  onClose,
  onApplyExtractedItems
}) => {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progressStatus, setProgressStatus] = useState<string>('');
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [extractedItems, setExtractedItems] = useState<Partial<BOQItem>[]>([]);
  const [bidderName, setBidderName] = useState<string>('');
  const [importMode, setImportMode] = useState<'estimated_only' | 'bidder_only' | 'new_bidder'>('bidder_only');
  const [rawText, setRawText] = useState<string>('');

  if (!isOpen) return null;

  const handleImageUpload = async (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      setImagePreview(dataUrl);
      setIsLoading(true);
      setProgressPercent(10);
      setProgressStatus('جاري تهيئة محرك القراءة والذكاء الاصطناعي...');

      try {
        const result = await extractBOQFromImage(dataUrl, (p, status) => {
          setProgressPercent(p);
          setProgressStatus(status);
        });

        setExtractedItems(result.items);
        setRawText(result.rawText);
      } catch (err: any) {
        alert('حدث خطأ أثناء معالجة الصورة: ' + err.message);
      } finally {
        setIsLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleImageUpload(e.dataTransfer.files[0]);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const blob = items[i].getAsFile();
        if (blob) handleImageUpload(blob);
      }
    }
  };

  const handleUpdateExtractedItem = (index: number, field: keyof BOQItem, val: any) => {
    const updated = [...extractedItems];
    updated[index] = { ...updated[index], [field]: val };
    setExtractedItems(updated);
  };

  const handleDeleteItem = (index: number) => {
    setExtractedItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddItem = () => {
    const nextNo = extractedItems.length + 1;
    setExtractedItems(prev => [
      ...prev,
      {
        itemNo: nextNo,
        description: `فقرة مستخرجة رقم ${nextNo}`,
        quantity: 1,
        estimatedTotal: 0,
        bidderTotal: 0
      }
    ]);
  };

  const handleApply = () => {
    if (extractedItems.length === 0) {
      alert('لا توجد فقرات لاعتمادها!');
      return;
    }
    onApplyExtractedItems(extractedItems, importMode, bidderName || undefined);
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4"
      onPaste={handlePaste}
    >
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold">
                استخراج جدول العطاء والأسعار من صورة أو PDF (Vision AI / OCR)
              </h2>
              <p className="text-xs text-slate-400">
                يمكنك سحب وإفلات صورة جدول العطاء أو لصق لقطة الشاشة مباشرة عبر (Ctrl + V)
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-lg cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {!imagePreview ? (
            <div 
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              className="border-2 border-dashed border-slate-300 hover:border-emerald-500 bg-slate-50 hover:bg-emerald-50/20 rounded-2xl p-12 text-center transition cursor-pointer flex flex-col items-center justify-center gap-4"
            >
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shadow-sm">
                <Upload className="w-8 h-8" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-base mb-1">
                  اسحب صورة جدول العطاء وأفلتها هنا، أو تصفح ملفاتك
                </h3>
                <p className="text-xs text-slate-500">
                  يدعم صور JPG, PNG أو لقطات الشاشة المنسوخة (Ctrl+V)
                </p>
              </div>

              <label className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-6 py-2.5 rounded-xl cursor-pointer shadow-md transition">
                اختيار صورة من الجهاز
                <input 
                  type="file" 
                  accept="image/*,.pdf" 
                  className="hidden" 
                  onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0])}
                />
              </label>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Left Column: Image Preview */}
              <div className="lg:col-span-5 bg-slate-100 rounded-2xl p-3 border border-slate-300 flex flex-col">
                <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-200 text-xs font-bold text-slate-700">
                  <span>الصورة الأصلية المرفوعة</span>
                  <label className="text-blue-600 hover:underline cursor-pointer">
                    تغيير الصورة
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0])}
                    />
                  </label>
                </div>
                <div className="flex-1 overflow-auto max-h-[420px] rounded-lg bg-white flex items-center justify-center p-2">
                  <img src={imagePreview} alt="Tender BOQ" className="max-w-full max-h-full object-contain" />
                </div>
              </div>

              {/* Right Column: Extracted Interactive Data */}
              <div className="lg:col-span-7 flex flex-col">
                {isLoading ? (
                  <div className="flex-1 min-h-[300px] flex flex-col items-center justify-center p-8 bg-slate-50 rounded-2xl border border-slate-200 text-center gap-4">
                    <Loader2 className="w-10 h-10 text-emerald-600 animate-spin" />
                    <div>
                      <div className="font-bold text-slate-800 text-sm mb-1">{progressStatus}</div>
                      <div className="w-64 bg-slate-200 rounded-full h-2.5 overflow-hidden mx-auto mt-2">
                        <div 
                          className="bg-emerald-600 h-2.5 rounded-full transition-all duration-300"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span className="text-xs font-black text-slate-800">
                          الفقرات المستخرجة ({extractedItems.length} فقرة)
                        </span>
                      </div>
                      <button
                        onClick={handleAddItem}
                        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-bold cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>إضافة سطر</span>
                      </button>
                    </div>

                    <div className="overflow-x-auto max-h-[360px] border border-slate-200 rounded-xl bg-white shadow-xs">
                      <table className="w-full text-xs text-right border-collapse">
                        <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0 border-b border-slate-200">
                          <tr>
                            <th className="p-2 w-10 text-center">ت</th>
                            <th className="p-2 min-w-[160px]">وصف الفقرة</th>
                            <th className="p-2 w-16 text-center">الكمية</th>
                            <th className="p-2 w-28 text-center text-blue-700">المبلغ التخميني</th>
                            <th className="p-2 w-28 text-center text-indigo-700">مبلغ المجهز</th>
                            <th className="p-2 w-10 text-center">حذف</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {extractedItems.map((item, idx) => (
                            <tr key={idx} className="hover:bg-slate-50">
                              <td className="p-1.5 text-center font-mono font-bold text-slate-500">
                                {item.itemNo || idx + 1}
                              </td>
                              <td className="p-1.5">
                                <input
                                  type="text"
                                  value={item.description || ''}
                                  onChange={(e) => handleUpdateExtractedItem(idx, 'description', e.target.value)}
                                  className="w-full bg-slate-50 focus:bg-white border border-slate-200 rounded p-1"
                                />
                              </td>
                              <td className="p-1.5 text-center">
                                <input
                                  type="number"
                                  value={item.quantity || 1}
                                  onChange={(e) => handleUpdateExtractedItem(idx, 'quantity', parseFloat(e.target.value) || 0)}
                                  className="w-full text-center bg-slate-50 focus:bg-white border border-slate-200 rounded p-1 font-bold"
                                />
                              </td>
                              <td className="p-1.5 text-center">
                                <input
                                  type="number"
                                  value={item.estimatedTotal || 0}
                                  onChange={(e) => handleUpdateExtractedItem(idx, 'estimatedTotal', parseFloat(e.target.value) || 0)}
                                  className="w-full text-center bg-blue-50/50 focus:bg-white border border-blue-200 text-blue-900 rounded p-1 font-bold"
                                />
                              </td>
                              <td className="p-1.5 text-center">
                                <input
                                  type="number"
                                  value={item.bidderTotal || 0}
                                  onChange={(e) => handleUpdateExtractedItem(idx, 'bidderTotal', parseFloat(e.target.value) || 0)}
                                  className="w-full text-center bg-indigo-50/50 focus:bg-white border border-indigo-200 text-indigo-900 rounded p-1 font-bold"
                                />
                              </td>
                              <td className="p-1.5 text-center">
                                <button
                                  onClick={() => handleDeleteItem(idx)}
                                  className="p-1 text-rose-500 hover:text-rose-700 cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Import Mode Options */}
                    <div className="mt-4 p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-xs">
                      <div className="font-bold text-slate-800">وجهة تطبيق هذا الجدول المستخرج من الصورة / PDF:</div>
                      <div className="flex flex-wrap items-center gap-4">
                        <label className="flex items-center gap-1.5 cursor-pointer font-bold text-indigo-900">
                          <input
                            type="radio"
                            name="importMode"
                            checked={importMode === 'bidder_only'}
                            onChange={() => setImportMode('bidder_only')}
                          />
                          <span>تحديث أسعار المجهز الحالي فقط (مع الحفاظ على التخميني)</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer font-bold text-blue-900">
                          <input
                            type="radio"
                            name="importMode"
                            checked={importMode === 'estimated_only'}
                            onChange={() => setImportMode('estimated_only')}
                          />
                          <span>تحديث الكلفة التخمينية فقط (مع الحفاظ على أسعار المجهزين)</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer font-bold text-emerald-900">
                          <input
                            type="radio"
                            name="importMode"
                            checked={importMode === 'new_bidder'}
                            onChange={() => setImportMode('new_bidder')}
                          />
                          <span>إنشاء شركة / مجهز جديد بهذا العطاء</span>
                        </label>
                      </div>

                      {importMode === 'new_bidder' && (
                        <div className="pt-1">
                          <input
                            type="text"
                            placeholder="اسم الشركة أو المجهز الجديد..."
                            value={bidderName}
                            onChange={(e) => setBidderName(e.target.value)}
                            className="bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 w-64"
                          />
                        </div>
                      )}
                    </div>

                  </div>
                )}
              </div>

            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
          >
            إلغاء
          </button>

          {imagePreview && !isLoading && (
            <button
              onClick={handleApply}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black px-6 py-2.5 rounded-xl shadow-md transition transform active:scale-95 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>اعتماد وإدراج في جدول التحليل</span>
            </button>
          )}
        </div>

      </div>
    </div>
  );
};

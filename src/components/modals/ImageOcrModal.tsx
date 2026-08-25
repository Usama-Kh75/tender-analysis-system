import React, { useState, useEffect } from 'react';
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
  Plus,
  Key,
  Cpu,
  Eye,
  AlertTriangle,
  Building2,
  HelpCircle
} from 'lucide-react';
import { BOQItem } from '../../types/tender';
import { extractBOQFromImage, extractBOQWithGeminiVision, testGeminiApiKey } from '../../utils/ocrService';
import { formatNumber } from '../../utils/calculations';

interface ImageOcrModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyExtractedItems: (
    items: Partial<BOQItem>[], 
    mode: 'estimated_only' | 'bidder_only' | 'new_bidder' | 'full_replace' | boolean, 
    bidderName?: string
  ) => void;
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
  const [destinationMode, setDestinationMode] = useState<'bidder_only' | 'estimated_only' | 'new_bidder'>('bidder_only');
  const [engineMode, setEngineMode] = useState<'ai_vision' | 'local_ocr'>('ai_vision');
  const [apiKey, setApiKey] = useState<string>('');
  const [showKeyInput, setShowKeyInput] = useState<boolean>(false);
  const [keyTestStatus, setKeyTestStatus] = useState<{ isTesting: boolean; success?: boolean; message?: string }>({ isTesting: false });

  useEffect(() => {
    const savedKey = localStorage.getItem('gemini_ocr_api_key') || '';
    setApiKey(savedKey);
  }, []);

  if (!isOpen) return null;

  const handleTestKey = async () => {
    if (!apiKey.trim()) return;
    setKeyTestStatus({ isTesting: true });
    try {
      const res = await testGeminiApiKey(apiKey);
      setKeyTestStatus({ isTesting: false, success: res.success, message: res.message });
    } catch (e: any) {
      setKeyTestStatus({ isTesting: false, success: false, message: e.message });
    }
  };

  const handleSaveApiKey = (key: string) => {
    setApiKey(key);
    localStorage.setItem('gemini_ocr_api_key', key.trim());
  };

  const handleImageUpload = async (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      setImagePreview(dataUrl);
      setExtractedItems([]); // تنظيف النتائج السابقة
    };
    reader.readAsDataURL(file);
  };

  const processImage = async (dataUrl: string) => {
    setIsLoading(true);
    setProgressPercent(10);
    setProgressStatus('جاري تهيئة معالجة الصورة...');

    try {
      if (engineMode === 'ai_vision') {
        const activeKey = apiKey.trim() || localStorage.getItem('gemini_ocr_api_key') || '';
        if (!activeKey) {
          setShowKeyInput(true);
          setIsLoading(false);
          alert('يرجى إدخال مفتاح Google Gemini API المجاني لتفعيل ميزة التعرف على خط اليد والصور المعقدة بالذكاء الاصطناعي.');
          return;
        }

        const result = await extractBOQWithGeminiVision(dataUrl, activeKey, (p, status) => {
          setProgressPercent(p);
          setProgressStatus(status);
        });

        setExtractedItems(result.items);
      } else {
        const result = await extractBOQFromImage(dataUrl, (p, status) => {
          setProgressPercent(p);
          setProgressStatus(status);
        });

        setExtractedItems(result.items);
      }
    } catch (err: any) {
      alert('حدث خطأ أثناء معالجة الصورة: ' + (err.message || 'تأكد من صحة المفتاح أو الاتصال'));
    } finally {
      setIsLoading(false);
    }
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
        description: `فقرة جديدة ${nextNo}`,
        quantity: 1,
        enteredUnitPrice: 0,
        bidderTotal: 0,
        estimatedTotal: 0
      }
    ]);
  };

  // تدوير الصورة 90 درجة لتصحيح اتجاه المسح الضوئي / الكاميرا
  const handleRotateImage = () => {
    if (!imagePreview) return;
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.height;
      canvas.height = img.width;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((90 * Math.PI) / 180);
        ctx.drawImage(img, -img.width / 2, -img.height / 2);
        const rotatedDataUrl = canvas.toDataURL('image/jpeg', 0.95);
        setImagePreview(rotatedDataUrl);
      }
    };
    img.src = imagePreview;
  };

  const handleApply = () => {
    if (extractedItems.length === 0) return;
    onApplyExtractedItems(extractedItems, destinationMode, bidderName.trim() || undefined);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-6xl max-h-[94vh] flex flex-col overflow-hidden">
        
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-tr from-indigo-600 to-purple-600 rounded-2xl shadow-md">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black flex items-center gap-2">
                <span>استخراج جداول العطاءات من الصور والمستندات (OCR / AI)</span>
              </h2>
              <p className="text-xs text-slate-400">
                يدعم الصور الورقية والممسوحة ضوئياً والمكتوبة بخط اليد مع التدقيق الحسابي الفوري
              </p>
            </div>
          </div>

          <button 
            onClick={onClose} 
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Engine Selector & API Key Bar */}
        <div className="bg-slate-100 p-3 sm:px-6 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-700">محرك المعالجة:</span>
            
            <button
              onClick={() => setEngineMode('ai_vision')}
              className={`px-3 py-1.5 rounded-xl font-black transition flex items-center gap-1.5 cursor-pointer ${
                engineMode === 'ai_vision'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>الذكاء الاصطناعي الرؤيوي (AI Vision) • يدعم خط اليد ⭐</span>
            </button>

            <button
              onClick={() => setEngineMode('local_ocr')}
              className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer ${
                engineMode === 'local_ocr'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>OCR موضعي (بدون إنترنت • للمطبوع فقط)</span>
            </button>
          </div>

          {engineMode === 'ai_vision' && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowKeyInput(!showKeyInput)}
                className="text-[11px] font-bold text-indigo-700 hover:text-indigo-900 flex items-center gap-1 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-lg cursor-pointer"
              >
                <Key className="w-3 h-3" />
                <span>{apiKey ? 'تعديل مفتاح Gemini API' : 'إدخال مفتاح Gemini API المجاني'}</span>
              </button>
            </div>
          )}

        </div>

        {/* API Key Drawer (if expanded) */}
        {showKeyInput && (
          <div className="bg-indigo-50 p-4 border-b border-indigo-200 flex flex-col gap-3 text-xs animate-in slide-in-from-top-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex-1 min-w-[280px]">
                <label className="block font-black text-indigo-950 mb-1">
                  مفتاح Google Gemini API (مجاني 100% وبدون بطاقة ائتمانية):
                </label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    placeholder="ألصق المفتاح هنا..."
                    value={apiKey}
                    onChange={(e) => handleSaveApiKey(e.target.value)}
                    className="flex-1 bg-white border border-indigo-300 rounded-xl px-3 py-1.5 font-mono text-xs focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    onClick={handleTestKey}
                    disabled={keyTestStatus.isTesting}
                    className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    <span>{keyTestStatus.isTesting ? 'جاري الفحص...' : '🔍 فحص واختبار المفتاح'}</span>
                  </button>
                  <button
                    onClick={() => setShowKeyInput(false)}
                    className="bg-indigo-600 text-white px-3 py-1.5 rounded-xl font-bold hover:bg-indigo-700 cursor-pointer"
                  >
                    حفظ وإغلاق
                  </button>
                </div>
              </div>
              <div className="text-[11px] text-slate-600 max-w-sm">
                يُحفظ المفتاح محلياً في متصفحك فقط، ويتيح قراءة أصعب الجداول المكتوبة بخط اليد والصور الملتقطة بكاميرا الهاتف في ثانية واحدة.
              </div>
            </div>

            {/* Test result feedback banner */}
            {keyTestStatus.message && (
              <div className={`p-2 rounded-xl text-[11px] font-bold border flex items-center gap-2 ${
                keyTestStatus.success 
                  ? 'bg-emerald-50 text-emerald-950 border-emerald-300' 
                  : 'bg-rose-50 text-rose-950 border-rose-300'
              }`}>
                <span>{keyTestStatus.success ? '✅' : '❌'}</span>
                <span>{keyTestStatus.message}</span>
              </div>
            )}
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50 flex flex-col gap-5" onPaste={handlePaste}>
          
          {/* Upload Dropzone (if no image or want to re-upload) */}
          {!imagePreview ? (
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              className="border-2 border-dashed border-slate-300 hover:border-indigo-500 bg-white rounded-3xl p-8 sm:p-12 text-center transition flex flex-col items-center justify-center gap-4 cursor-pointer group"
              onClick={() => document.getElementById('ocr-file-input')?.click()}
            >
              <input
                id="ocr-file-input"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0])}
              />
              
              <div className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl group-hover:scale-110 transition shadow-xs">
                <Upload className="w-8 h-8" />
              </div>

              <div>
                <p className="text-sm sm:text-base font-black text-slate-800">
                  اسحب وأفلت صورة جدول العطاء هنا، أو انقر للاختيار
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  يدعم صور الكاميرا، الممسوحة ضوئياً، المستندات الورقية، أو النسخ واللصق بـ <kbd className="bg-slate-100 px-1.5 py-0.5 border rounded font-bold">Ctrl+V</kbd>
                </p>
              </div>

              <div className="inline-flex items-center gap-2 text-xs font-bold text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-200">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                <span>يدعم قراءة خط اليد وتفكيك أسعار المفرد والتفقيط آلياً</span>
              </div>
            </div>
          ) : (
            /* Split View: Image Preview on Right, Extracted Table on Left */
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              
              {/* Left Column: Image Preview Card */}
              <div className="lg:col-span-5 bg-white rounded-3xl border border-slate-200 p-4 shadow-sm flex flex-col gap-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2 flex-wrap gap-2">
                  <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                    <Eye className="w-4 h-4 text-indigo-600" />
                    معاينة الوثيقة المرفوعة:
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleRotateImage}
                      className="text-xs text-indigo-700 hover:text-indigo-900 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-lg font-bold flex items-center gap-1 cursor-pointer transition"
                      title="تدوير الصورة 90 درجة في حال كانت مقلوبة أو مستعرضة"
                    >
                      <span>🔄 تدوير 90°</span>
                    </button>
                    <button
                      onClick={() => {
                        setImagePreview(null);
                        setExtractedItems([]);
                      }}
                      className="text-xs text-rose-600 hover:text-rose-800 font-bold cursor-pointer"
                    >
                      تغيير الصورة ↺
                    </button>
                  </div>
                </div>

                <div className="max-h-[420px] overflow-auto rounded-2xl border border-slate-200 bg-slate-900 flex items-center justify-center p-2">
                  <img 
                    src={imagePreview} 
                    alt="Document Preview" 
                    className="max-w-full max-h-[400px] object-contain rounded-lg shadow-sm"
                  />
                </div>

                {/* Main Action Button */}
                <button
                  onClick={() => imagePreview && processImage(imagePreview)}
                  disabled={isLoading}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-black py-3 rounded-2xl shadow-md transition transform active:scale-95 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>{extractedItems.length === 0 ? '🚀 بدء القراءة واستخراج الجدول الآن' : 'إعادة القراءة والتحليل ↺'}</span>
                </button>
              </div>

              {/* Right Column: Extracted Table & Verification */}
              <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200 p-4 sm:p-5 shadow-sm flex flex-col gap-4">
                
                {/* Destination & Action Selector */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <span className="text-xs font-black text-slate-800">
                      الفقرات المستخرجة ({extractedItems.length} فقرة):
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={destinationMode}
                      onChange={(e: any) => setDestinationMode(e.target.value)}
                      className="bg-indigo-50 text-indigo-950 border border-indigo-300 text-xs font-black rounded-xl px-3 py-1.5 focus:outline-none"
                    >
                      <option value="bidder_only">تعبئة أسعار المجهز الحالي</option>
                      <option value="new_bidder">إنشاء مجهز / شركة جديدة</option>
                      <option value="estimated_only">تعبئة الكلفة التخمينية (BOC)</option>
                    </select>

                    {destinationMode === 'new_bidder' && (
                      <input
                        type="text"
                        placeholder="اسم المجهز الجديد..."
                        value={bidderName}
                        onChange={(e) => setBidderName(e.target.value)}
                        className="border border-slate-300 rounded-xl px-2.5 py-1 text-xs font-bold w-40"
                      />
                    )}
                  </div>
                </div>

                {/* Progress / Loading State */}
                {isLoading ? (
                  <div className="p-12 text-center flex flex-col items-center justify-center gap-3">
                    <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                    <p className="text-sm font-black text-slate-800">{progressStatus}</p>
                    <div className="w-64 bg-slate-200 rounded-full h-2 overflow-hidden">
                      <div 
                        className="bg-indigo-600 h-2 transition-all duration-300 rounded-full"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>
                ) : extractedItems.length === 0 ? (
                  <div className="p-12 text-center flex flex-col items-center justify-center gap-3 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                    <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                      <Sparkles className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-black text-slate-800">
                      تم تحميل الصورة بنجاح!
                    </p>
                    <p className="text-xs text-slate-500 max-w-sm">
                      تأكد من تعديل اتجاه الصورة لتكون أفقية مستقيمة باستخدام زر <strong>(🔄 تدوير 90°)</strong>، ثم انقر على زر <strong>(🚀 بدء القراءة واستخراج الجدول)</strong> بالأسفل.
                    </p>
                  </div>
                ) : (
                  <div className="max-h-[380px] overflow-auto border border-slate-200 rounded-2xl">
                    <table className="w-full text-xs text-right border-collapse">
                      <thead className="bg-slate-900 text-white sticky top-0 z-10 font-black">
                        <tr>
                          <th className="p-2 w-10 text-center border-l border-slate-800">ت</th>
                          <th className="p-2 min-w-[140px] border-l border-slate-800">اسم المادة / الوصف</th>
                          <th className="p-2 w-14 text-center border-l border-slate-800">العدد</th>
                          <th className="p-2 w-24 text-center border-l border-slate-800 bg-indigo-950 text-indigo-200">المفرد (د.ع)</th>
                          <th className="p-2 w-28 text-center border-l border-slate-800 bg-indigo-900 text-indigo-100">المبلغ الإجمالي</th>
                          <th className="p-2 min-w-[120px] border-l border-slate-800 bg-amber-950 text-amber-200">التفقيط</th>
                          <th className="p-2 w-10 text-center">حذف</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 font-medium bg-white">
                        {extractedItems.map((item, idx) => (
                          <tr key={idx} className="hover:bg-indigo-50/40">
                            <td className="p-1.5 text-center font-bold bg-slate-50">
                              <input
                                type="text"
                                value={item.itemNo}
                                onChange={(e) => handleUpdateExtractedItem(idx, 'itemNo', e.target.value)}
                                className="w-full text-center bg-transparent border-0 font-black"
                              />
                            </td>
                            <td className="p-1.5">
                              <input
                                type="text"
                                value={item.description}
                                onChange={(e) => handleUpdateExtractedItem(idx, 'description', e.target.value)}
                                className="w-full bg-transparent border-0 font-bold text-slate-800"
                              />
                            </td>
                            <td className="p-1.5 text-center">
                              <input
                                type="number"
                                value={item.quantity || 1}
                                onChange={(e) => handleUpdateExtractedItem(idx, 'quantity', parseFloat(e.target.value) || 1)}
                                className="w-12 text-center bg-slate-50 border border-slate-200 rounded p-1 font-bold"
                              />
                            </td>
                            <td className="p-1.5 text-center bg-indigo-50/20">
                              <input
                                type="number"
                                value={item.enteredUnitPrice || ''}
                                onChange={(e) => handleUpdateExtractedItem(idx, 'enteredUnitPrice', parseFloat(e.target.value) || 0)}
                                className="w-full text-center bg-white border border-indigo-200 rounded p-1 font-bold text-indigo-950"
                              />
                            </td>
                            <td className="p-1.5 text-center bg-indigo-50/40 font-mono font-black">
                              <input
                                type="number"
                                value={item.bidderTotal || ''}
                                onChange={(e) => handleUpdateExtractedItem(idx, 'bidderTotal', parseFloat(e.target.value) || 0)}
                                className="w-full text-center bg-white border border-indigo-300 rounded p-1 font-bold text-indigo-950"
                              />
                            </td>
                            <td className="p-1.5 text-[10px] text-slate-700">
                              <input
                                type="text"
                                value={item.writtenText || ''}
                                onChange={(e) => handleUpdateExtractedItem(idx, 'writtenText', e.target.value)}
                                className="w-full bg-transparent border-0 font-medium text-slate-700"
                                placeholder="التفقيط المكتوب..."
                              />
                            </td>
                            <td className="p-1.5 text-center">
                              <button
                                onClick={() => handleDeleteItem(idx)}
                                className="p-1 text-slate-400 hover:text-rose-600 rounded transition cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Add Row & Total Summary */}
                {extractedItems.length > 0 && (
                  <div className="flex items-center justify-between text-xs pt-2">
                    <button
                      onClick={handleAddItem}
                      className="text-indigo-600 hover:text-indigo-800 font-black flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ إضافة سطر يدوياً</span>
                    </button>

                    <div className="font-black text-slate-800 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
                      مجموع مبالغ الفقرات: <span className="text-indigo-700 font-mono text-sm">{extractedItems.reduce((s, i) => s + (i.bidderTotal || 0), 0).toLocaleString()} د.ع</span>
                    </div>
                  </div>
                )}

              </div>

            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 bg-white border-t border-slate-200 flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
          >
            إلغاء
          </button>

          <button
            onClick={handleApply}
            disabled={extractedItems.length === 0 || isLoading}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl shadow-md transition transform active:scale-95 flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>إدراج وتطبيق في جدول المناقصة ({extractedItems.length} فقرة)</span>
          </button>
        </div>

      </div>
    </div>
  );
};

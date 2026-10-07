import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Upload,
  Sparkles,
  Loader2,
  CheckCircle2,
  Trash2,
  Plus,
  Key,
  Cpu,
  Eye
} from 'lucide-react';
import { BOQItem } from '../../types/tender';
import { extractBOQFromImage, extractBOQWithGeminiVision, testGeminiApiKey, compressImageDataUrl, ReadingPages } from '../../utils/ocrService';
import { auditRowAmounts, quantityMismatches } from '../../utils/bidderAuditEngine';
import { isPdfFile, pdfToImages } from '../../utils/pdfService';
import { QuantityMismatchNotice } from '../QuantityMismatchNotice';

/**
 * ملفات PDF أو صور سلّمتها نافذة الاستيراد الموحّدة مع وجهتها (جدول المجهز أو الكلفة التخمينية):
 * تُحمَّل عند الفتح وتُضبط الوجهة، فلا يبحث المستخدم عن قائمة الوجهة بعد الرفع. id يميّز كل تسليم
 */
export interface OcrHandoff {
  id: number;
  files: File[];
  destination: 'bidder_only' | 'estimated_only';
}

interface ImageOcrModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyExtractedItems: (
    items: Partial<BOQItem>[],
    mode: 'estimated_only' | 'bidder_only' | 'new_bidder' | 'full_replace' | boolean,
    bidderName?: string,
    statedTotal?: number
  ) => void;
  handoff?: OcrHandoff | null;
  // فقرات الجدول الحالية: إدراج عطاء مجهز يُبقي كميتها ويُفحص بها، فتُقارن بها الكمية المقروءة قبل الإدراج
  tableRows?: Pick<BOQItem, 'itemNo' | 'quantity'>[];
}

export const ImageOcrModal: React.FC<ImageOcrModalProps> = ({
  isOpen,
  onClose,
  onApplyExtractedItems,
  handoff,
  tableRows = []
}) => {
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [activeImageIndex, setActiveImageIndex] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [progressStatus, setProgressStatus] = useState<string>('');
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [extractedItems, setExtractedItems] = useState<Partial<BOQItem>[]>([]);
  // صفحات قرأها المحرك الموضعي بثقة منخفضة: تنبيه فوق النتائج وتأكيد صريح قبل الإدراج
  const [lowConfidencePages, setLowConfidencePages] = useState<{ page: number; confidence: number }[]>([]);
  // جرت قراءة على الصفحات الحالية (لتمييز «لم تبدأ القراءة» عن «انتهت بلا أسطر»)
  const [readAttempted, setReadAttempted] = useState(false);
  // نتيجة قراءة Gemini الأخيرة: الإجمالي المكتوب في العطاء (للمقارنة بمجموع الفقرات) والنموذج المستخدم
  const [geminiCheck, setGeminiCheck] = useState<{ statedTotal: number | null; statedText?: string; modelUsed: string } | null>(null);
  // الصفحات التي تُقرأ الآن: تنتقل إليها المعاينة وتُعلَّم في شريط الصفحات، وما قبلها مقروء
  const [readingRange, setReadingRange] = useState<ReadingPages | null>(null);
  const lastReading = useRef('');
  const thumbRefs = useRef<(HTMLDivElement | null)[]>([]);

  // دفعة جديدة تنقل المعاينة إلى أول صفحاتها مرة واحدة (لا مع كل رسالة تقدم)، فيبقى للمستخدم أن يفتح
  // غيرها أثناء الانتظار. Gemini يقرأ صفحات الدفعة معاً، فالمتابعة بالدفعة لا بالصفحة
  const followReading = (reading?: ReadingPages) => {
    if (!reading) return;
    const key = `${reading.start}:${reading.count}`;
    if (key === lastReading.current) return;
    lastReading.current = key;
    setReadingRange(reading);
    setActiveImageIndex(reading.start);
  };

  // الصفحة المعروضة تبقى ظاهرة في الشريط أثناء القراءة (ملف من 19 صفحة لا يتسع له الشريط)
  useEffect(() => {
    if (readingRange) thumbRefs.current[activeImageIndex]?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }, [activeImageIndex, readingRange]);

  // ملف كبير قد تكون أغلب صفحاته منخفضة الجودة: تُذكر أول خمس فقط
  const summarizePages = (withConfidence: boolean) => {
    const shown = lowConfidencePages.slice(0, 5)
      .map(p => withConfidence ? `${p.page} — ثقة ${p.confidence}%` : String(p.page)).join('، ');
    const rest = lowConfidencePages.length - 5;
    return rest > 0 ? `${shown} و(${rest}) صفحة أخرى` : shown;
  };
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

  const readFileAsDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  };

  const handleImageUpload = async (file: File) => {
    const dataUrl = await readFileAsDataUrl(file);
    // تصغير الصورة تلقائياً لتقليل حجم الطلب وتسريع الاستخراج وتفادي فشل الشبكة
    const compressed = await compressImageDataUrl(dataUrl);
    setImagePreviews(prev => [...prev, compressed]);
  };

  const handleMultipleFiles = async (files: FileList | File[]) => {
    const accepted = Array.from(files).filter(f => f.type.startsWith('image/') || isPdfFile(f));
    if (accepted.length === 0) return;
    // ملف بحجم 0 بايت (حفظ أو نقل لم يكتمل) لا يُقرأ؛ نوقف قبل pdf.js لأن رسالته إنجليزية وتوحي بأن الملف محمي
    const empty = accepted.filter(f => f.size === 0);
    if (empty.length > 0) {
      alert(empty.length === 1
        ? `الملف (${empty[0].name}) فارغ: حجمه 0 بايت، أي أن حفظه أو نقله لم يكتمل وليس فيه ما يُقرأ. أعد تصديره من تطبيق المسح الضوئي أو انسخه من مصدره من جديد، ثم ارفعه.`
        : `هذه الملفات فارغة (حجمها 0 بايت)، أي أن حفظها أو نقلها لم يكتمل: ${empty.map(f => `(${f.name})`).join('، ')}. أعد تصديرها أو نسخها من مصدرها، ثم ارفعها من جديد.`);
      return;
    }
    // نقرأ ونضغط كل الصفحات أولاً، ثم نضيفها دفعة واحدة بترتيب الرفع الأصلي
    // (القراءة الفردية كانت تُدرج الصفحات بترتيب اكتمال القراءة لا ترتيب الاختيار، فيختل ترتيب الصفحات عند الدمج)
    // ملف PDF (رقمي أو ممسوح ضوئياً) يُحوَّل صفحةً صفحة إلى صور في مكانه من الترتيب
    const pages: string[] = [];
    let currentFile: File | null = null;
    setIsLoading(true);
    try {
      for (const file of accepted) {
        currentFile = file;
        if (isPdfFile(file)) {
          setProgressStatus(`جاري تحويل صفحات ملف PDF (${file.name})...`);
          setProgressPercent(0);
          const rendered = await pdfToImages(file, (n, total) => {
            setProgressStatus(`جاري تحويل صفحات ملف PDF: الصفحة (${n}) من (${total})...`);
            setProgressPercent(Math.round((n / total) * 100));
          });
          pages.push(...await Promise.all(rendered.map(d => compressImageDataUrl(d))));
        } else {
          pages.push(await compressImageDataUrl(await readFileAsDataUrl(file)));
        }
      }
    } catch (err) {
      // الرسالة تخص نوع الملف الذي فشل فعلاً (كانت تقول «ملف PDF» حتى لو فشلت صورة)
      const failedPdf = currentFile ? isPdfFile(currentFile) : false;
      alert((failedPdf ? `تعذّرت قراءة ملف PDF (${currentFile?.name}): ` : `تعذّرت قراءة الملف${currentFile ? ` (${currentFile.name})` : ''}: `)
        + (err instanceof Error ? err.message : String(err))
        + (failedPdf ? ' — تأكد أن الملف سليم وغير محمي بكلمة مرور.' : ''));
    } finally {
      setIsLoading(false);
      setProgressStatus('');
      setProgressPercent(0);
    }
    if (pages.length > 0) {
      setImagePreviews(prev => [...prev, ...pages]);
      setReadAttempted(false);
      setLowConfidencePages([]);
    }
  };

  // تسليم من نافذة الاستيراد الموحّدة: بداية نظيفة بالوجهة المختارة ثم تحميل الملفات، مرة واحدة لكل تسليم
  const lastHandoffId = useRef<number | null>(null);
  useEffect(() => {
    if (!isOpen || !handoff || handoff.id === lastHandoffId.current) return;
    lastHandoffId.current = handoff.id;
    setImagePreviews([]);
    setExtractedItems([]);
    setGeminiCheck(null);
    setLowConfidencePages([]);
    setReadAttempted(false);
    setActiveImageIndex(0);
    setDestinationMode(handoff.destination);
    handleMultipleFiles(handoff.files);
    // handleMultipleFiles تُعرَّف من جديد مع كل رسم؛ التسليم وحده هو ما يُطلق التحميل
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, handoff]);

  const handleRemoveImage = (index: number) => {
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
    if (activeImageIndex >= index && activeImageIndex > 0) {
      setActiveImageIndex(activeImageIndex - 1);
    }
  };

  // متوسط ثقة المحرك الموضعي دون هذا الحد = قراءة غير موثوقة. قيس على عينات: جدول بخطوط شبكية 47%،
  // ومقلوب 90° 41%، وصفحة ممسوحة 51% (كلها مشوّهة)، وجدول بلا خطوط 82% (صحيح)
  const LOW_CONFIDENCE = 65;

  // نتيجة قراءة صفحة واحدة بالمحرك الموضعي: نجاح بنسبة الثقة، أو خطأ يوقف المعالجة
  type PageResult = { ok: true; confidence: number } | { ok: false; error: string };

  const processImage = async (dataUrl: string): Promise<PageResult> => {
    setProgressPercent(10);
    setProgressStatus('جاري تهيئة معالجة الصورة...');
    try {
      const result = await extractBOQFromImage(dataUrl, (p, status) => {
        setProgressPercent(p);
        setProgressStatus(status);
      });
      setExtractedItems(prev => [...prev, ...result.items]);
      return { ok: true, confidence: result.confidence };
    } catch (err: any) {
      return { ok: false, error: err?.message || 'تأكد من صحة المفتاح أو الاتصال' };
    }
  };

  // أشهر خطأين من Gemini يُعرضان بالعربية بدل نص الخادم الخام (JSON بالإنجليزية)
  const explainGeminiError = (message: string) => {
    const invalidKey = /API key not valid|API_KEY_INVALID|PERMISSION_DENIED|\(40[13]\)/i.test(message);
    const quota = /\(429\)|RESOURCE_EXHAUSTED|quota/i.test(message);
    if (invalidKey) {
      setShowKeyInput(true);
      setKeyTestStatus({ isTesting: false, success: false, message: 'مفتاح Gemini المحفوظ غير صالح. تحقق منه أو أدخل مفتاحاً جديداً ثم أعد القراءة.' });
      return 'مفتاح Gemini غير صالح.';
    }
    return quota ? 'نفدت حصة الطلبات المجانية في Gemini مؤقتاً. انتظر دقيقة أو دقيقتين ثم أعد القراءة.' : message;
  };

  // Gemini: كل الصفحات في استدعاء واحد يقسمها دفعات (GEMINI_PAGES_PER_REQUEST) بدل طلب لكل صفحة،
  // فيرى النموذج الجدول الممتد عبر الصفحات ويُستهلك من الحصة طلب واحد لعرض من 7 صفحات
  const processWithGemini = async (activeKey: string) => {
    try {
      const result = await extractBOQWithGeminiVision(imagePreviews, activeKey, (p, status, reading) => {
        setProgressPercent(p);
        setProgressStatus(status);
        followReading(reading);
      });
      setExtractedItems(result.items);
      setGeminiCheck({ statedTotal: result.grandTotal, statedText: result.grandTotalText, modelUsed: result.modelUsed });
      if (result.stoppedAtPage) {
        alert(`توقفت القراءة عند الصفحة (${result.stoppedAtPage}) من (${imagePreviews.length}): ${explainGeminiError(result.error || '')}\nما استُخرج من الصفحات السابقة باقٍ في الجدول.`);
      }
    } catch (err: any) {
      alert(`تعذّرت قراءة الصفحات: ${explainGeminiError(err?.message || 'تأكد من صحة المفتاح أو الاتصال')}\nتوقفت المعالجة.`);
    }
  };

  const processAllImages = async () => {
    if (imagePreviews.length === 0) return;

    // المفتاح يُفحص مرة واحدة قبل البدء، لا عند كل صفحة: كان غيابه يُظهر رسالة منبثقة لكل صفحة
    // على التوالي (7 صفحات = 7 رسائل)، فيبدو زر «OK» كأنه لا يستجيب
    const activeKey = engineMode === 'ai_vision'
      ? (apiKey.trim() || localStorage.getItem('gemini_ocr_api_key') || '')
      : '';
    if (engineMode === 'ai_vision' && !activeKey) {
      setShowKeyInput(true);
      setKeyTestStatus({
        isTesting: false,
        success: false,
        message: 'لم يُحفظ مفتاح Gemini في هذه النسخة من النظام بعد. أدخله في الخانة أعلاه ثم اضغط «بدء القراءة»، أو اختر محرك «OCR موضعي».'
      });
      return;
    }

    setExtractedItems([]); // تنظيف النتائج السابقة
    setLowConfidencePages([]);
    setGeminiCheck(null);
    setReadAttempted(true);
    lastReading.current = '';
    setIsLoading(true);
    try {
      if (engineMode === 'ai_vision') {
        await processWithGemini(activeKey);
        return;
      }
      for (let i = 0; i < imagePreviews.length; i++) {
        followReading({ start: i, count: 1 });
        setProgressStatus(`جاري معالجة الصفحة (${i + 1}) من (${imagePreviews.length})...`);
        const result = await processImage(imagePreviews[i]);
        if (!result.ok) {
          // خطأ واحد يوقف المعالجة برسالة واحدة (لا رسالة لكل صفحة متبقية)
          alert(
            `تعذّرت قراءة الصفحة (${i + 1}) من (${imagePreviews.length}): ${result.error}` +
            (i > 0 ? '\nتوقفت المعالجة، وما استُخرج من الصفحات السابقة باقٍ في الجدول.' : '\nتوقفت المعالجة.')
          );
          break;
        }
        if (result.confidence < LOW_CONFIDENCE) {
          const confidence = result.confidence;
          setLowConfidencePages(prev => [...prev, { page: i + 1, confidence }]);
        }
      }
    } finally {
      setIsLoading(false);
      setReadingRange(null);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleMultipleFiles(e.dataTransfer.files);
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

  // تصحيح رقم قُرئ خطأً: الرقم المصحح هو ما كتبه المجهز، فيُحدَّث المبلغ المدون معه وتُعاد علامتا التدقيق
  // (كانتا تبقيان على القراءة الأولى، فيعرض الجدول بعد الإدراج «المدون في العطاء» بالرقم المقروء خطأً،
  // أو خطأ ضرب لم يرتكبه المجهز)
  const handleUpdateExtractedItem = (index: number, field: keyof BOQItem, val: any) => {
    const updated = [...extractedItems];
    const item: Partial<BOQItem> = { ...updated[index], [field]: val };
    if (field === 'bidderTotal') item.enteredBidderTotal = val;
    // مبلغ أُدخل لفقرة عُدّت غير مسعّرة: لم تكن «-» في الأصل
    if ((field === 'bidderTotal' || field === 'enteredUnitPrice') && val > 0) item.unpriced = undefined;
    if (field === 'quantity' || field === 'enteredUnitPrice' || field === 'bidderTotal' || field === 'writtenText') {
      Object.assign(item, auditRowAmounts(item.quantity || 1, item.enteredUnitPrice || 0, item.bidderTotal || 0, item.writtenText));
    }
    updated[index] = item;
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

  // تدوير الصورة النشطة 90 درجة لتصحيح اتجاه المسح الضوئي / الكاميرا
  // تدوير صورة 90° مع عقارب الساعة
  const rotateDataUrl = (src: string): Promise<string> => new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.height;
      canvas.height = img.width;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(src); return; }
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((90 * Math.PI) / 180);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      resolve(canvas.toDataURL('image/jpeg', 0.95));
    };
    img.onerror = () => resolve(src);
    img.src = src;
  });

  const handleRotateImage = async () => {
    const currentImg = imagePreviews[activeImageIndex];
    if (!currentImg) return;
    const index = activeImageIndex;
    const rotated = await rotateDataUrl(currentImg);
    setImagePreviews(prev => prev.map((p, i) => i === index ? rotated : p));
  };

  // ملف ممسوح بالعرض تكون كل صفحاته مقلوبة عادةً: تدويرها كلها بضغطة بدل صفحة صفحة
  // صفحة بعد صفحة لا كلها معاً: ملف كبير كان سيفتح عشرات اللوحات في الذاكرة في آن واحد
  const handleRotateAll = async () => {
    if (imagePreviews.length === 0) return;
    setIsLoading(true);
    try {
      const rotated: string[] = [];
      for (let i = 0; i < imagePreviews.length; i++) {
        setProgressStatus(`جاري تدوير الصفحات: (${i + 1}) من (${imagePreviews.length})...`);
        setProgressPercent(Math.round(((i + 1) / imagePreviews.length) * 100));
        rotated.push(await rotateDataUrl(imagePreviews[i]));
      }
      setImagePreviews(rotated);
      setReadAttempted(false);
      setLowConfidencePages([]);
    } finally {
      setIsLoading(false);
      setProgressStatus('');
      setProgressPercent(0);
    }
  };

  // فحص الاكتمال: الإجمالي المكتوب في العطاء مقابل مجموع المبالغ كما كتبها المجهز، ومقابل مجموع
  // «العدد × المفرد». فرق تفسره أخطاء الضرب خطأ من المجهز يُدرج كما هو، ويؤشره النظام لتقرر اللجنة
  // تصحيحه. أما فرق لا تفسره فقد يكون فقرة سقطت عند القراءة، وهذه لا يكتشفها النظام بعد الإدراج،
  // فيُطلب تأكيد بمطابقة الأصل
  const rowMath = extractedItems.map(i => auditRowAmounts(i.quantity || 1, i.enteredUnitPrice || 0, i.bidderTotal || 0).hasMathError);
  const mathErrorCount = rowMath.filter(Boolean).length;
  const extractedSum = extractedItems.reduce((s, i) => s + (i.bidderTotal || 0), 0);
  const productsSum = extractedItems.reduce(
    (s, i, idx) => s + (rowMath[idx] ? (i.enteredUnitPrice || 0) * (i.quantity || 1) : (i.bidderTotal || 0)), 0);
  const statedTotal = geminiCheck?.statedTotal ?? null;
  const totalMismatch = statedTotal !== null && Math.abs(extractedSum - statedTotal) >= 1;
  const explainedByMath = totalMismatch && mathErrorCount > 0 && Math.abs(productsSum - statedTotal!) < 1;
  const unexplainedMismatch = totalMismatch && !explainedByMath;
  const unpricedCount = extractedItems.filter(i => i.unpriced).length;
  const missingAmountCount = extractedItems.filter(i => !i.unpriced && !((i.bidderTotal || 0) > 0)).length;
  const fmt = (n: number) => n.toLocaleString('en-US');
  // اتجاه الفرق بالكلمات بدل إشارة سالبة تربك القراءة في السياق العربي
  const diffWords = statedTotal === null ? ''
    : `${extractedSum < statedTotal ? 'أقل' : 'أكثر'} منه بـ ${fmt(Math.abs(extractedSum - statedTotal))}`;
  // الفحص نفسه يجري على جدول الكلفة التخمينية: كان نصه يذكر «العطاء» و«المجهز» دائماً، فيظن المستخدم
  // أن إجمالي التخميني المقروء هو مبلغ عطاء المجهز. وعلامات أخطاء الضرب لا تُنقل إلى الكلفة التخمينية
  const toEstimateDoc = destinationMode === 'estimated_only';
  const docName = toEstimateDoc ? 'جدول الكلفة التخمينية' : 'العطاء';
  const sumErrorCause = toEstimateDoc ? 'أو جُمع الإجمالي في الجدول نفسه خطأً' : 'أو أخطأ المجهز في جمع الإجمالي';
  // عطاء مجهز (الحالي أو جديد): تبقى كمية الجدول ويُفحص بها الضرب بعد الإدراج، فتُعرض الفقرات المخالفة.
  // جدول الكلفة التخمينية يضع كميته فلا يُقارن
  const qtyMismatchList = toEstimateDoc ? [] : quantityMismatches(extractedItems, tableRows);

  const handleApply = () => {
    if (extractedItems.length === 0) return;
    if (lowConfidencePages.length > 0 && !window.confirm(
      `جودة القراءة منخفضة في الصفحة (${summarizePages(false)})، وقد تكون الفقرات المستخرجة مشوّهة.\n\n` +
      'هل تريد إدراجها في جدول المناقصة رغم ذلك؟'
    )) return;
    if (unexplainedMismatch && !window.confirm(
      `مجموع الفقرات المستخرجة (${fmt(extractedSum)}) لا يساوي الإجمالي المكتوب في ${docName} (${fmt(statedTotal!)}): ${diffWords}، ` +
      `ولا تفسر أخطاء الضرب في الفقرات هذا الفرق.\n` +
      `قد تكون فقرة سقطت أو قُرئت خطأً، ${sumErrorCause}. ` +
      (toEstimateDoc
        ? 'تُدرج الكلفة التخمينية بمبالغ الفقرات لا بالإجمالي المكتوب، ولا يُحفظ هذا الإجمالي، والنظام '
        : 'بعد الإدراج يؤشر النظام أخطاء الضرب والتفقيط، لكنه ') +
      'لا يكتشف فقرة سقطت عند القراءة.\n\nهل طابقت عدد الفقرات ومبالغها مع الأصل وتريد إدراجها؟'
    )) return;
    // المبالغ المقروءة توضع في bidderTotal؛ عند «تعبئة الكلفة التخمينية» تُنقل إلى estimatedTotal
    // (كانت تصل صفراً فتُمسح الكلفة التخمينية في الجدول). مبلغ غير مقروء لا يمس التخميني القائم
    const toEstimate = destinationMode === 'estimated_only';
    const items = toEstimate
      ? extractedItems.map(i => ({ ...i, estimatedTotal: (i.bidderTotal || 0) > 0 ? i.bidderTotal : undefined }))
      : extractedItems;
    // الإجمالي المكتوب يُحفظ مع عطاء المجهز ليظهر المبلغ قبل التصحيح الحسابي وبعده
    onApplyExtractedItems(items, destinationMode, bidderName.trim() || undefined,
      toEstimate ? undefined : statedTotal ?? undefined);
    onClose();
  };

  // الخروج المبكر هنا لا في أول المكوّن: كل الخطافات (ومنها useEffect التسليم أعلاه) قبله
  if (!isOpen) return null;

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
          {imagePreviews.length === 0 ? (
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              className="border-2 border-dashed border-slate-300 hover:border-indigo-500 bg-white rounded-3xl p-8 sm:p-12 text-center transition flex flex-col items-center justify-center gap-4 cursor-pointer group"
              onClick={() => { if (!isLoading) document.getElementById('ocr-file-input')?.click(); }}
            >
              <input
                id="ocr-file-input"
                type="file"
                accept="image/*,application/pdf,.pdf"
                multiple
                className="hidden"
                onChange={(e) => e.target.files && handleMultipleFiles(e.target.files)}
              />
              
              {isLoading ? (
                // تحويل ملف PDF قد يستغرق ثوانٍ: بلا مؤشر يبدو الرفع كأنه فشل
                <div role="status" className="flex flex-col items-center gap-3">
                  <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                  <p className="text-sm font-black text-slate-800">{progressStatus || 'جاري تحضير الملفات...'}</p>
                  <div className="w-64 bg-slate-200 rounded-full h-2 overflow-hidden">
                    <div className="bg-indigo-600 h-2 transition-all duration-300 rounded-full" style={{ width: `${progressPercent}%` }} />
                  </div>
                </div>
              ) : (<>
              <div className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl group-hover:scale-110 transition shadow-xs">
                <Upload className="w-8 h-8" />
              </div>

              <div>
                <p className="text-sm sm:text-base font-black text-slate-800">
                  اسحب وأفلت صور جدول العطاء أو ملف PDF هنا، أو انقر للاختيار
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  يدعم صور الكاميرا، وملفات PDF الرقمية والممسوحة ضوئياً (تُحوَّل كل صفحة إلى صورة)، أو النسخ واللصق بـ <kbd className="bg-slate-100 px-1.5 py-0.5 border rounded font-bold">Ctrl+V</kbd>
                </p>
              </div>

              <div className="inline-flex items-center gap-2 text-xs font-bold text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-200">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                <span>يدعم قراءة خط اليد وتفكيك أسعار المفرد والتفقيط آلياً</span>
              </div>
              </>)}
            </div>
          ) : (
            /* Split View: Image Preview on Right, Extracted Table on Left */
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              
              {/* Left Column: Image Preview Card */}
              <div className="lg:col-span-5 bg-white rounded-3xl border border-slate-200 p-4 shadow-sm flex flex-col gap-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2 flex-wrap gap-2">
                  <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                    <Eye className="w-4 h-4 text-indigo-600" />
                    الصور المرفوعة ({imagePreviews.length} صفحة):
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => document.getElementById('ocr-add-more')?.click()}
                      disabled={isLoading}
                      className="text-xs text-emerald-700 hover:text-emerald-900 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg font-bold flex items-center gap-1 cursor-pointer transition disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Plus className="w-3 h-3" />
                      <span>إضافة صفحة</span>
                    </button>
                    <input id="ocr-add-more" type="file" accept="image/*,application/pdf,.pdf" multiple className="hidden" onChange={(e) => e.target.files && handleMultipleFiles(e.target.files)} />
                    <button
                      onClick={handleRotateImage}
                      disabled={isLoading}
                      className="text-xs text-indigo-700 hover:text-indigo-900 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-lg font-bold flex items-center gap-1 cursor-pointer transition disabled:opacity-40 disabled:cursor-not-allowed"
                      title="تدوير الصورة النشطة 90 درجة"
                    >
                      <span>🔄 تدوير 90°</span>
                    </button>
                    {imagePreviews.length > 1 && (
                      <button
                        onClick={handleRotateAll}
                        disabled={isLoading}
                        className="text-xs text-indigo-700 hover:text-indigo-900 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-lg font-bold flex items-center gap-1 cursor-pointer transition disabled:opacity-40 disabled:cursor-not-allowed"
                        title="تدوير كل الصفحات 90 درجة مع عقارب الساعة"
                      >
                        <span>🔄 تدوير الكل</span>
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setImagePreviews([]);
                        setReadAttempted(false);
                        setLowConfidencePages([]);
                        setExtractedItems([]);
                        setGeminiCheck(null);
                        setActiveImageIndex(0);
                      }}
                      disabled={isLoading}
                      className="text-xs text-rose-600 hover:text-rose-800 font-bold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      مسح الكل ↺
                    </button>
                  </div>
                </div>

                {/* Thumbnail Strip for multiple pages */}
                {imagePreviews.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {imagePreviews.map((img, idx) => {
                      // أثناء القراءة: ما قبل الدفعة الحالية مقروء، وصفحاتها قيد القراءة، وما بعدها ينتظر
                      const pageState = !readingRange ? null
                        : idx < readingRange.start ? 'done'
                        : idx < readingRange.start + readingRange.count ? 'reading' : null;
                      return (
                      <div
                        key={idx}
                        ref={el => { thumbRefs.current[idx] = el; }}
                        onClick={() => setActiveImageIndex(idx)}
                        title={pageState === 'reading' ? 'تُقرأ الآن' : pageState === 'done' ? 'قُرئت' : undefined}
                        className={`relative shrink-0 w-16 h-16 rounded-xl border-2 overflow-hidden cursor-pointer transition ${
                          idx === activeImageIndex ? 'border-indigo-600 ring-2 ring-indigo-300'
                            : pageState === 'reading' ? 'border-amber-400 ring-2 ring-amber-200'
                            : 'border-slate-200 hover:border-indigo-300'
                        }`}
                      >
                        <img src={img} alt={`صفحة ${idx + 1}`} className="w-full h-full object-cover" />
                        <span className={`absolute bottom-0 left-0 right-0 text-white text-[9px] text-center font-bold ${
                          pageState === 'reading' ? 'bg-amber-500 animate-pulse'
                            : pageState === 'done' ? 'bg-emerald-600/90'
                            : 'bg-slate-900/70'
                        }`}>
                          {idx + 1}{pageState === 'reading' ? ' ⏳' : pageState === 'done' ? ' ✓' : ''}
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleRemoveImage(idx); }}
                          disabled={isLoading}
                          aria-label={`حذف الصفحة ${idx + 1}`}
                          className="absolute top-0 right-0 bg-rose-600 text-white rounded-bl-lg p-0.5 text-[8px] font-bold cursor-pointer hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed"
                        >✕</button>
                      </div>
                      );
                    })}
                  </div>
                )}

                {readingRange && (
                  <div role="status" className="text-[11px] font-bold text-amber-950 bg-amber-50 border border-amber-200 rounded-xl px-2.5 py-1">
                    ⏳ {readingRange.count > 1
                      ? `يقرأ النموذج الآن الصفحات (${readingRange.start + 1}–${readingRange.start + readingRange.count}) من (${imagePreviews.length}) معاً`
                      : `تُقرأ الآن الصفحة (${readingRange.start + 1}) من (${imagePreviews.length})`}
                    {' · '}المعروضة: الصفحة ({activeImageIndex + 1})
                  </div>
                )}

                <div className="max-h-[350px] overflow-auto rounded-2xl border border-slate-200 bg-slate-900 flex items-center justify-center p-2">
                  <img 
                    src={imagePreviews[activeImageIndex]} 
                    alt="Document Preview" 
                    className="max-w-full max-h-[330px] object-contain rounded-lg shadow-sm"
                  />
                </div>

                {/* Main Action Button */}
                <button
                  onClick={processAllImages}
                  disabled={isLoading}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-black py-3 rounded-2xl shadow-md transition transform active:scale-95 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>{extractedItems.length === 0 ? `🚀 بدء القراءة واستخراج الجدول (${imagePreviews.length} صفحة)` : `إعادة القراءة (${imagePreviews.length} صفحة) ↺`}</span>
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
                      <option value="estimated_only">تعبئة الكلفة التخمينية</option>
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

                {/* تنبيه جودة القراءة: يظهر حتى لو لم يُستخرج أي سطر، فلا تبدو القراءة الفاشلة كأنها لم تبدأ */}
                {!isLoading && lowConfidencePages.length > 0 && (
                  <div role="alert" className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 text-xs leading-relaxed">
                    <div className="font-black mb-0.5">
                      ⚠️ جودة القراءة منخفضة في الصفحة ({summarizePages(true)})
                      {extractedItems.length === 0 && ' — لم يُستخرج أي سطر'}
                    </div>
                    <div>قد تكون الفقرات مشوّهة. الأسباب الشائعة: صفحة مقلوبة، أو خطوط الجدول، أو مسح غير واضح. دوّر الصفحات وأعد القراءة، أو استخدم محرك الذكاء الاصطناعي (Gemini)، وراجع الفقرات قبل الإدراج.</div>
                  </div>
                )}

                {/* فحص الاكتمال بعد قراءة Gemini: مجموع الفقرات مقابل الإجمالي المكتوب في العطاء */}
                {!isLoading && geminiCheck && extractedItems.length > 0 && (
                  <div
                    role={unexplainedMismatch ? 'alert' : 'status'}
                    className={`p-3 rounded-xl border text-xs leading-relaxed ${
                      statedTotal === null ? 'bg-slate-50 border-slate-200 text-slate-700'
                        : unexplainedMismatch ? 'bg-amber-50 border-amber-300 text-amber-950'
                        : explainedByMath ? 'bg-sky-50 border-sky-300 text-sky-950'
                        : 'bg-emerald-50 border-emerald-300 text-emerald-950'
                    }`}
                  >
                    <div className="font-black">
                      {statedTotal === null
                        ? `لم يُعثر على إجمالي مكتوب في ${docName} لمقارنته بمجموع الفقرات — راجع الفقرات مع الأصل.`
                        : unexplainedMismatch
                        ? <>⚠️ مجموع الفقرات المستخرجة (<bdi>{fmt(extractedSum)}</bdi>) لا يساوي الإجمالي المكتوب في {docName} (<bdi>{fmt(statedTotal)}</bdi>): {diffWords}، ولا تفسر أخطاء الضرب{mathErrorCount > 0 ? ` في (${mathErrorCount}) فقرة` : ''} هذا الفرق. قد تكون فقرة سقطت أو قُرئت خطأً، {sumErrorCause}: طابق عدد الفقرات ومبالغها مع الأصل قبل الإدراج.</>
                        : explainedByMath
                        ? <>مجموع المبالغ كما {toEstimateDoc ? 'كُتبت في الجدول' : 'كتبها المجهز'} (<bdi>{fmt(extractedSum)}</bdi>) لا يساوي الإجمالي المكتوب في {docName} (<bdi>{fmt(statedTotal)}</bdi>)، لكن الإجمالي يساوي مجموع «العدد × المفرد»: الفرق سببه أخطاء ضرب في ({mathErrorCount}) فقرة مؤشرة في الجدول.</>
                        : <>✓ مجموع الفقرات المستخرجة يطابق الإجمالي المكتوب في {docName} (<bdi>{fmt(statedTotal)}</bdi>).</>}
                    </div>
                    {mathErrorCount > 0 && !unexplainedMismatch && (
                      <div className="mt-0.5">
                        {!explainedByMath && <>في ({mathErrorCount}) فقرة لا يساوي «العدد × المفرد» المبلغ المكتوب (مؤشرة في الجدول). </>}
                        {toEstimateDoc
                          ? 'تُدرج الكلفة التخمينية بالمبلغ المكتوب في كل فقرة، ولا تُؤشَّر بعد الإدراج: طابقها مع الصورة وصحح هنا ما يلزم قبل الإدراج.'
                          : 'تُدرج كما كتبها المجهز، ويؤشرها النظام لتقرر اللجنة تصحيحها. طابقها مع الصورة أولاً، وما قُرئ خطأً صححه هنا.'}
                      </div>
                    )}
                    {geminiCheck.statedText && <div className="mt-0.5">الإجمالي كتابةً في {docName}: {geminiCheck.statedText}</div>}
                    {statedTotal !== null && destinationMode !== 'estimated_only' && (
                      <div className="mt-0.5">يُحفظ هذا الإجمالي مع العطاء، فيظهر المبلغ قبل التصحيح الحسابي وبعده في الشاشة والمحضر.</div>
                    )}
                    {(unpricedCount > 0 || missingAmountCount > 0) && (
                      <div className="mt-0.5">
                        {unpricedCount > 0 && <>({unpricedCount}) فقرة غير مسعّرة في {docName} («-»). </>}
                        {missingAmountCount > 0 && <>({missingAmountCount}) فقرة تعذّرت قراءة مبلغها — أدخله من الأصل. </>}
                      </div>
                    )}
                    {geminiCheck.modelUsed && <div className="mt-0.5 text-[11px] opacity-75">قُرئت بالنموذج: <bdi dir="ltr">{geminiCheck.modelUsed}</bdi></div>}
                  </div>
                )}

                {/* مركّب دائماً (فارغ أثناء القراءة): منطقة الإعلان فيه يجب أن تسبق محتواها ليُعلن عنه */}
                <QuantityMismatchNotice mismatches={isLoading ? [] : qtyMismatchList} source="العطاء المقروء" />

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
                    {readAttempted ? (
                      <>
                        <p className="text-sm font-black text-slate-800">لم يُستخرج أي سطر من الصفحات</p>
                        <p className="text-xs text-slate-500 max-w-sm">
                          تأكد أن النص أفقي (زر <strong>🔄 تدوير الكل</strong>)، أو استخدم محرك الذكاء الاصطناعي، ثم أعد القراءة.
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-sm font-black text-slate-800">
                          تم تحميل الصورة بنجاح!
                        </p>
                        <p className="text-xs text-slate-500 max-w-sm">
                          تأكد من تعديل اتجاه الصورة لتكون أفقية مستقيمة باستخدام زر <strong>(🔄 تدوير 90°)</strong>، ثم انقر على زر <strong>(🚀 بدء القراءة واستخراج الجدول)</strong> بالأسفل.
                        </p>
                      </>
                    )}
                  </div>
                ) : (
                  <>
                  <div className="max-h-[380px] overflow-auto border border-slate-200 rounded-2xl">
                    <table className="w-full text-xs text-right border-collapse">
                      <thead className="bg-slate-900 text-white sticky top-0 z-10 font-black">
                        <tr>
                          <th className="p-2 w-10 text-center border-l border-slate-800">ت</th>
                          <th className="p-2 min-w-[140px] border-l border-slate-800">اسم المادة / الوصف</th>
                          <th className="p-2 w-24 text-center border-l border-slate-800">العدد</th>
                          <th className="p-2 w-24 text-center border-l border-slate-800 bg-indigo-950 text-indigo-200">المفرد (د.ع)</th>
                          <th className="p-2 w-28 text-center border-l border-slate-800 bg-indigo-900 text-indigo-100">المبلغ الإجمالي</th>
                          <th className="p-2 min-w-[120px] border-l border-slate-800 bg-amber-950 text-amber-200">التفقيط</th>
                          <th className="p-2 w-10 text-center">حذف</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 font-medium bg-white">
                        {extractedItems.map((item, idx) => {
                          // «-» في العطاء، أو مبلغ تعذّرت قراءته: يُميَّز الصف ليُراجع مع الأصل
                          const missingAmount = !item.unpriced && !((item.bidderTotal || 0) > 0);
                          return (
                          <tr key={idx} className={item.unpriced ? 'bg-slate-50' : missingAmount ? 'bg-rose-50/60' : rowMath[idx] ? 'bg-amber-50/70' : 'hover:bg-indigo-50/40'}>
                            <td className="p-1.5 text-center font-bold bg-slate-50">
                              <input
                                type="text"
                                value={item.itemNo}
                                onChange={(e) => handleUpdateExtractedItem(idx, 'itemNo', e.target.value)}
                                className="w-full min-w-[3rem] text-center bg-transparent border-0 font-black"
                              />
                            </td>
                            {/* كما في جدول المناقصة: أول الوصف الإنجليزي ظاهر والنص كاملاً عند التمرير،
                                وحقول المبالغ بحد أدنى للعرض كي لا يُقص أول الرقم فيبدو كأن القراءة خاطئة */}
                            <td className="p-1.5">
                              <input
                                type="text"
                                dir="auto"
                                title={item.description}
                                value={item.description}
                                onChange={(e) => handleUpdateExtractedItem(idx, 'description', e.target.value)}
                                className="w-full bg-transparent border-0 font-bold text-slate-800 text-ellipsis"
                              />
                              {item.unpriced && (
                                <span className="inline-block mt-0.5 text-[10px] font-bold text-slate-600 bg-slate-200 px-1.5 rounded">غير مسعّرة في العطاء («-»)</span>
                              )}
                              {missingAmount && (
                                <span className="inline-block mt-0.5 text-[10px] font-bold text-rose-700 bg-rose-100 px-1.5 rounded">تعذّرت قراءة المبلغ — أدخله من الأصل</span>
                              )}
                              {rowMath[idx] && (
                                <span className="inline-block mt-0.5 text-[10px] font-bold text-amber-900 bg-amber-100 px-1.5 rounded">
                                  العدد × المفرد = <bdi>{fmt((item.enteredUnitPrice || 0) * (item.quantity || 1))}</bdi> ≠ المبلغ — طابقه مع الصورة
                                </span>
                              )}
                            </td>
                            {/* عرض يتسع لكمية من خمسة أرقام مع أسهم الحقل: بعرض w-12 ظهرت 11550 «550» */}
                            <td className="p-1.5 text-center">
                              <input
                                type="number"
                                value={item.quantity || 1}
                                onChange={(e) => handleUpdateExtractedItem(idx, 'quantity', parseFloat(e.target.value) || 1)}
                                aria-label={`كمية الفقرة ${item.itemNo ?? idx + 1}`}
                                className="w-20 text-center bg-slate-50 border border-slate-200 rounded p-1 font-bold"
                              />
                            </td>
                            <td className="p-1.5 text-center bg-indigo-50/20">
                              <input
                                type="number"
                                value={item.enteredUnitPrice || ''}
                                onChange={(e) => handleUpdateExtractedItem(idx, 'enteredUnitPrice', parseFloat(e.target.value) || 0)}
                                className="w-full min-w-[6rem] no-spinner text-center bg-white border border-indigo-200 rounded p-1 font-bold text-indigo-950"
                              />
                            </td>
                            <td className="p-1.5 text-center bg-indigo-50/40 font-mono font-black">
                              <input
                                type="number"
                                value={item.bidderTotal || ''}
                                onChange={(e) => handleUpdateExtractedItem(idx, 'bidderTotal', parseFloat(e.target.value) || 0)}
                                className="w-full min-w-[6rem] no-spinner text-center bg-white border border-indigo-300 rounded p-1 font-bold text-indigo-950"
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
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  </>
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

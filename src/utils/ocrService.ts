import { createWorker } from 'tesseract.js';
import { BOQItem } from '../types/tender';
import { parseArabicNumber } from './calculations';
import { auditRowAmounts } from './bidderAuditEngine';

export interface ExtractedTableData {
  items: Partial<BOQItem>[];
  rawText: string;
  confidence: number;
}

/**
 * تصغير وضغط الصورة قبل رفعها لتقليل حجم الطلب وتسريع الاستجابة
 * وتفادي فشل الاتصال بسبب حجم الصور الكبير القادمة من كاميرا الهاتف.
 * 2000 بكسل (كان 1600): صفحات PDF تُرسم بهذا الحجم أصلاً، وتصغيرها كان يُضعف الأرقام الصغيرة في المسح الضوئي
 */
export function compressImageDataUrl(
  dataUrl: string,
  maxDimension: number = 2000,
  quality: number = 0.85
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const { width, height } = img;
      const scale = Math.min(1, maxDimension / Math.max(width, height));

      // إذا كانت الصورة أصغر من الحد الأقصى أصلاً، لا داعي لإعادة ترميزها
      if (scale >= 1) {
        resolve(dataUrl);
        return;
      }

      const canvas = document.createElement('canvas');
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export function normalizeArabicNumbers(str: string): string {
  if (!str) return '';
  const arabicNumerals = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  const persianNumerals = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  
  let result = str;
  for (let i = 0; i < 10; i++) {
    result = result.split(arabicNumerals[i]).join(String(i));
    result = result.split(persianNumerals[i]).join(String(i));
  }
  return result;
}

/**
 * ترتيب نماذج Gemini لقراءة جداول العطاءات: كان يُؤخذ أول نموذج فيه «flash» بترتيب قائمة الحساب،
 * فقد يكون قديماً أو مخففاً أو نموذج صوت/صور. الآن: المستقر قبل التجريبي، ثم flash ثم pro ثم flash-lite،
 * والأحدث إصداراً أولاً. تُستبعد نماذج الصوت وتوليد الصور والبث المباشر وغيرها مما لا يقرأ المستندات
 */
export function rankGeminiModels(names: string[]): string[] {
  const notForDocuments = /(embedding|aqa|tts|image|live|transcribe|translate|robotics|veo|lyria|imagen|deep-research|antigravity|omni|computer-use|gemma|learnlm|audio)/i;
  const version = (n: string) => parseFloat(n.match(/gemini-(\d+(?:\.\d+)?)/i)?.[1] || '0');
  const family = (n: string) => /flash-lite/i.test(n) ? 2 : /flash/i.test(n) ? 0 : /pro/i.test(n) ? 1 : 3;
  const unstable = (n: string) => /(preview|exp|latest)/i.test(n) ? 1 : 0;
  return names
    .filter(n => /^gemini-/i.test(n) && !notForDocuments.test(n))
    .sort((a, b) => unstable(a) - unstable(b) || family(a) - family(b) || version(b) - version(a));
}

/**
 * فحص واختبار مفتاح Gemini واسترجاع نماذج الرؤية المتاحة بالضبط
 */
export async function testGeminiApiKey(apiKey: string): Promise<{ success: boolean; message: string; models: string[] }> {
  const cleanKey = apiKey.trim();
  if (!cleanKey) {
    return { success: false, message: 'يرجى إدخال مفتاح API أولاً', models: [] };
  }

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${cleanKey}`, {
      headers: {
        'x-goog-api-key': cleanKey
      }
    });

    if (!res.ok) {
      const err = await res.text();
      return {
        success: false,
        message: `فشل الاتصال (${res.status}): ${err}`,
        models: []
      };
    }

    const data = await res.json();
    // النماذج التي تدعم generateContent، مرتبة بالأنسب لقراءة الجداول (rankGeminiModels)
    const modelsList: string[] = rankGeminiModels((data?.models || [])
      .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
      .map((m: any) => String(m.name || '').replace('models/', '')));

    if (modelsList.length === 0) {
      return {
        success: false,
        message: 'تم الاتصال ولكن لم يتم العثور على نماذج Gemini نشطة في هذا المشروع. تأكد من إنشاء المفتاح من aistudio.google.com',
        models: []
      };
    }

    return {
      success: true,
      message: `تم الاتصال بنجاح! النماذج النشطة في حسابك (${modelsList.length}): ${modelsList.slice(0, 4).join(' ، ')}`,
      models: modelsList
    };
  } catch (err: any) {
    return {
      success: false,
      message: `خطأ في الاتصال بالإنترنت: ${err.message}`,
      models: []
    };
  }
}

/**
 * استخراج نص JSON نقي حتى لو أرجع النموذج نصوصاً أو شروحات إضافية
 */
function extractJsonArray(text: string): any[] {
  if (!text) return [];
  
  // 1. محاولة مباشرة عبر Regex لاستخراج مصفوفة JSON بين [ و ]
  const arrayMatch = text.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    try {
      return JSON.parse(arrayMatch[0]);
    } catch (e) {
      // محاولة تنظيف إضافية
    }
  }

  // 2. إزالة markdown blocks
  const clean = text
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();

  try {
    const parsed = JSON.parse(clean);
    return Array.isArray(parsed) ? parsed : (parsed.items || parsed.table || []);
  } catch (e) {
    // 3. محاولة استخراج كائنات فردية إذا كانت المصفوفة مقطوعة
    const objectMatches = text.match(/\{[^{}]*\}/g);
    if (objectMatches && objectMatches.length > 0) {
      const items: any[] = [];
      for (const objStr of objectMatches) {
        try {
          items.push(JSON.parse(objStr));
        } catch (_) {}
      }
      if (items.length > 0) return items;
    }
    throw new Error(`تعذر تفكيك استجابة الذكاء الاصطناعي: ${text.substring(0, 150)}...`);
  }
}

// الصفحات في طلب Gemini الواحد: يرى النموذج الجدول الممتد عبر الصفحات، ويُستهلك طلب واحد من الحصة
// المجانية بدل طلب لكل صفحة (عرض من 7 صفحات كان 7 طلبات). تُقسم الدفعة أيضاً إن تجاوز حجم صورها
// GEMINI_MAX_BATCH_CHARS، لتبقى دون حد حجم الطلب المضمَّن
export const GEMINI_PAGES_PER_REQUEST = 8;
const GEMINI_MAX_BATCH_CHARS = 14_000_000;

// صيغة رد إلزامية (مخطط OpenAPI في responseSchema): بدونها كان النظام يبحث عن JSON داخل نص الرد.
// إن رفضها نموذج (400) يُعاد الطلب نفسه بلا مخطط، والتعليمات تطلب الشكل نفسه
const GEMINI_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          itemNo: { type: 'STRING', nullable: true },
          description: { type: 'STRING' },
          unit: { type: 'STRING', nullable: true },
          quantity: { type: 'NUMBER', nullable: true },
          unitPrice: { type: 'NUMBER', nullable: true },
          total: { type: 'NUMBER', nullable: true },
          writtenText: { type: 'STRING', nullable: true },
          unpriced: { type: 'BOOLEAN' }
        },
        required: ['description', 'unpriced'],
        propertyOrdering: ['itemNo', 'description', 'unit', 'quantity', 'unitPrice', 'total', 'writtenText', 'unpriced']
      }
    },
    grandTotal: { type: 'NUMBER', nullable: true },
    grandTotalText: { type: 'STRING', nullable: true }
  },
  required: ['items'],
  propertyOrdering: ['items', 'grandTotal', 'grandTotalText']
};

const geminiPrompt = (pages: number) => `أنت مدقق جداول كميات في عطاءات حكومية. الصور المرفقة (${pages}) صفحات متتالية من عطاء واحد، بترتيبها.
استخرج كل فقرات جدول الكميات من كل الصفحات بالترتيب، وأعد كائن JSON فقط بهذا الشكل دون أي شرح:
{"items":[{"itemNo":"1.15","description":"Male Plug","unit":"NOS","quantity":6,"unitPrice":396000,"total":2376000,"writtenText":null,"unpriced":false}],"grandTotal":312000000,"grandTotalText":null}

القواعد:
1. description: وصف الفقرة كاملاً كما هو مكتوب بلغته الأصلية (عربي أو إنجليزي أو مختلط)، دون ترجمة ولا اختصار.
2. إذا بدأت صفحة بصف بلا رقم فقرة ولا أسعار يكمل وصف فقرة من الصفحة السابقة، فأضف نصه إلى وصف تلك الفقرة ولا تنشئ له فقرة جديدة.
3. لا تُدرج صفوف العناوين ولا صف المجموع أو «السعر الإجمالي» ضمن items. ضع الإجمالي الكلي المكتوب في العطاء في grandTotal رقماً، ونصه المكتوب كتابةً (التفقيط) إن وجد في grandTotalText، وإلا فـ null.
4. إذا كانت خانة سعر الفقرة أو مبلغها شرطة «-» أو مكتوباً فيها ما يدل على عدم التسعير، فاجعل unitPrice وtotal قيمة null وunpriced=true.
5. إذا تعذّرت قراءة رقم فاجعله null مع unpriced=false. لا تخمّن رقماً ولا تحسبه بنفسك: انقل المكتوب في العطاء كما هو حتى لو بدا خاطئاً حسابياً.
6. الأرقام أرقام JSON بلا فواصل آلاف ولا عملة. quantity هي الرقم وحده من خانة الكمية (مثلاً "NOS 6" تعني 6، و"Set 1" تعني 1)، وunit هي الوحدة نصاً.
7. itemNo رقم الفقرة نصاً كما هو مكتوب (مثل "1.15" أو "2.0")، وnull إن لم يوجد.
8. writtenText: مبلغ الفقرة المكتوب كتابةً (التفقيط) إن وجد، وإلا null.`;

interface GeminiRawResult {
  rows: any[];
  grandTotal: number | null;
  grandTotalText?: string;
  rawText: string;
  modelUsed: string;
  truncated: boolean;
}

/**
 * يفكك رد Gemini: الشكل الجديد كائن {items, grandTotal, grandTotalText}، ويُقبل الشكل القديم
 * (مصفوفة صفوف) من نموذج تجاهل التعليمات. صف «-» يُعلَّم غير مسعّر حتى لو أعاد النموذج الشرطة نصاً
 */
export function parseGeminiTable(text: string): { rows: any[]; grandTotal: number | null; grandTotalText?: string } {
  const clean = (text || '').replace(/```json/gi, '').replace(/```/g, '').trim();
  let parsed: any;
  try {
    parsed = JSON.parse(clean);
  } catch {
    // نص إضافي حول JSON: الكائن أولاً ثم المصفوفة القديمة (extractJsonArray يرمي خطأً إن فشل)
    const obj = clean.match(/\{[\s\S]*\}/);
    try { parsed = obj ? JSON.parse(obj[0]) : undefined; } catch { parsed = undefined; }
    if (!parsed || (!Array.isArray(parsed) && !parsed.items)) parsed = extractJsonArray(clean);
  }
  // شكل الرد يُتحقق منه: الفقرات مصفوفة كائنات وإلا يُرفض الرد (فيُجرَّب النموذج التالي)، لئلا يتحول
  // نص مثل "items": "abc" إلى فقرات مختلقة حرفاً حرفاً. المصفوفة الفارغة مقبولة (صفحات بلا جدول)
  const container = Array.isArray(parsed) ? parsed
    : Array.isArray(parsed?.items) ? parsed.items
    : Array.isArray(parsed?.table) ? parsed.table
    : null;
  if (!container) throw new Error('رد بلا مصفوفة فقرات');
  const rows: any[] = container.filter((r: unknown) => r !== null && typeof r === 'object' && !Array.isArray(r));
  if (rows.length !== container.length) throw new Error('رد فيه عناصر ليست فقرات');
  const total = !Array.isArray(parsed) && parsed?.grandTotal !== null && parsed?.grandTotal !== undefined
    ? parseArabicNumber(parsed.grandTotal) : 0;
  const totalText = !Array.isArray(parsed) && typeof parsed?.grandTotalText === 'string' && parsed.grandTotalText.trim()
    ? parsed.grandTotalText.trim() : undefined;
  return { rows, grandTotal: total > 0 ? total : null, grandTotalText: totalText };
}

const isBlank = (v: unknown) => v === null || v === undefined || String(v).trim() === '';
const isDash = (v: unknown) => typeof v === 'string' && /^\s*[-–—_]+\s*$/.test(v);

/**
 * صف بلا رقم فقرة ولا كمية ولا أسعار يكمل وصف الفقرة السابقة (وصف امتد إلى أعلى الصفحة التالية،
 * أو إلى أول صفحة في الدفعة التالية حيث لا يرى النموذج الصفحة السابقة): يُضاف نصه إليها
 */
export function mergeContinuationRows(rows: any[]): any[] {
  const merged: any[] = [];
  for (const r of rows) {
    const prev = merged[merged.length - 1];
    const isContinuation = prev && isBlank(r?.itemNo) && !r?.unpriced
      && [r?.quantity, r?.unitPrice, r?.total].every(v => isBlank(v))
      && !isBlank(r?.description);
    if (isContinuation) {
      merged[merged.length - 1] = { ...prev, description: `${prev.description || ''} ${String(r.description).trim()}`.trim() };
    } else {
      merged.push(r);
    }
  }
  return merged;
}

function mapGeminiRow(r: any, idx: number): Partial<BOQItem> {
  const itemNo = isBlank(r?.itemNo) ? idx + 1 : String(r.itemNo).trim();
  const description = isBlank(r?.description) ? `فقرة ${itemNo}` : String(r.description).trim();
  const unit = isBlank(r?.unit) ? 'عدد' : String(r.unit).trim();
  const unpriced = r?.unpriced === true || isDash(r?.unitPrice) || isDash(r?.total);
  const quantity = parseArabicNumber(r?.quantity) || 1;
  const unitPrice = unpriced ? 0 : (parseArabicNumber(r?.unitPrice) || 0);
  const total = unpriced ? 0 : (parseArabicNumber(r?.total) || (unitPrice * quantity));
  const writtenText = isBlank(r?.writtenText) ? undefined : String(r.writtenText).trim();
  const { hasMathError: isMathError, hasTextDiscrepancy: isTextDiscrepancy } =
    auditRowAmounts(quantity, unitPrice, total, writtenText);

  return {
    itemNo,
    description,
    unit,
    quantity,
    estimatedTotal: 0,
    bidderTotal: total,
    enteredUnitPrice: unitPrice,
    enteredBidderTotal: total,
    writtenText,
    hasMathError: isMathError,
    hasTextDiscrepancy: isTextDiscrepancy,
    unpriced: unpriced || undefined
  };
}

// دفعات بالترتيب: حتى GEMINI_PAGES_PER_REQUEST صفحة، ودون GEMINI_MAX_BATCH_CHARS من بيانات الصور
function batchPages(images: string[]): { start: number; images: string[] }[] {
  const batches: { start: number; images: string[] }[] = [];
  let current: string[] = [];
  let size = 0;
  let start = 0;
  images.forEach((img, i) => {
    if (current.length > 0 && (current.length >= GEMINI_PAGES_PER_REQUEST || size + img.length > GEMINI_MAX_BATCH_CHARS)) {
      batches.push({ start, images: current });
      current = [];
      size = 0;
      start = i;
    }
    current.push(img);
    size += img.length;
  });
  if (current.length > 0) batches.push({ start, images: current });
  return batches;
}

const toInlinePart = (dataUrl: string) => {
  const [head, data] = dataUrl.includes(';base64,') ? dataUrl.split(';base64,') : ['data:image/jpeg', dataUrl];
  return { inlineData: { mimeType: head.replace('data:', '') || 'image/jpeg', data } };
};

// نماذج رفضت صيغة الرد الإلزامية في هذه الجلسة: تُطلب بلا مخطط مباشرة بدل طلب مرفوض لكل دفعة
const modelsWithoutSchema = new Set<string>();

/** طلب واحد لدفعة صفحات، مع المرور على النماذج بالترتيب وإعادة المحاولة عند 429 */
async function requestGeminiRows(
  images: string[],
  apiKey: string,
  models: string[],
  onStatus: (status: string) => void
): Promise<GeminiRawResult> {
  const errorReports: string[] = [];
  let hadRateLimitError = false;

  for (const model of models) {
    let structured = !modelsWithoutSchema.has(model);
    let rateRetried = false;
    for (;;) {
      onStatus(`جاري القراءة بالنموذج (${model})${rateRetried ? ' - إعادة محاولة...' : ''}`);
      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify({
            contents: [{ parts: [{ text: geminiPrompt(images.length) }, ...images.map(toInlinePart)] }],
            generationConfig: {
              temperature: 0.1,
              ...(structured ? { responseMimeType: 'application/json', responseSchema: GEMINI_RESPONSE_SCHEMA } : {})
            }
          })
        });

        if (response.ok) {
          const data = await response.json();
          const candidate = data?.candidates?.[0];
          const rawText = (candidate?.content?.parts || []).map((p: any) => p?.text || '').join('');
          const truncated = candidate?.finishReason === 'MAX_TOKENS';
          if (rawText.trim().length > 1) {
            let parsed: ReturnType<typeof parseGeminiTable> | null = null;
            try { parsed = parseGeminiTable(rawText); } catch { parsed = null; }
            if (parsed) return { ...parsed, rawText, modelUsed: model, truncated };
            // رد مقطوع لا يُفكك: تُقسم الدفعة؛ وغير المقطوع يُجرَّب بالنموذج التالي
            if (truncated) return { rows: [], grandTotal: null, rawText, modelUsed: model, truncated: true };
            errorReports.push(`${model}: تعذّر تفكيك الرد (${rawText.substring(0, 80)}...)`);
            break;
          }
          if (truncated) {
            return { rows: [], grandTotal: null, rawText: '', modelUsed: model, truncated: true };
          }
          errorReports.push(`${model}: رد فارغ${data?.promptFeedback?.blockReason ? ` (${data.promptFeedback.blockReason})` : ''}`);
          break;
        }
        if (response.status === 400 && structured) {
          // نموذج لا يقبل صيغة الرد الإلزامية: الطلب نفسه بلا مخطط
          structured = false;
          modelsWithoutSchema.add(model);
          continue;
        }
        if (response.status === 429) {
          hadRateLimitError = true;
          errorReports.push(`${model}: تجاوزت الحد المسموح من الطلبات في الدقيقة (429)`);
          if (!rateRetried) {
            rateRetried = true;
            await new Promise((r) => setTimeout(r, 3000));
            continue;
          }
          break;
        }
        if (response.status === 404) {
          errorReports.push(`${model}: هذا النموذج غير متاح لمفتاحك الحالي (404)`);
          break;
        }
        const errText = await response.text();
        errorReports.push(`${model}: (${response.status}) ${errText.substring(0, 100)}`);
        break;
      } catch (err: any) {
        errorReports.push(`${model}: تعذر الاتصال بالإنترنت - ${err.message}`);
        break;
      }
    }
  }

  if (hadRateLimitError) {
    throw new Error('تم تجاوز الحد المسموح من الطلبات لهذه الدقيقة (حصة مجانية محدودة من Google) (429). يرجى الانتظار دقيقة واحدة ثم إعادة المحاولة.');
  }
  throw new Error(`تعذر الاتصال بالنماذج: ${errorReports.join(' | ')}`);
}

export interface GeminiExtraction extends ExtractedTableData {
  models: string[];
  modelUsed: string;
  /** الإجمالي الكلي المكتوب في العطاء (للمقارنة بمجموع الفقرات)، أو null إن لم يُعثر عليه */
  grandTotal: number | null;
  grandTotalText?: string;
  /** توقفت القراءة قبل آخر صفحة: رقم أول صفحة لم تُقرأ وسبب التوقف، وما قبلها مقروء في items */
  stoppedAtPage?: number;
  error?: string;
}

/** الصفحات التي تُقرأ الآن (بترتيبها من الصفر)، لتتابعها المعاينة */
export interface ReadingPages {
  start: number;
  count: number;
}

/**
 * محرك استخراج الجداول عبر Gemini: كل الصفحات في دفعات (لا صفحة صفحة)، بصيغة رد إلزامية،
 * ثم دمج الأوصاف الممتدة عبر الصفحات وتعليم الفقرات غير المسعّرة وقراءة الإجمالي المكتوب
 */
export async function extractBOQWithGeminiVision(
  images: string[],
  apiKey: string,
  onProgress?: (progress: number, status: string, reading?: ReadingPages) => void,
  knownModels?: string[]
): Promise<GeminiExtraction> {
  const cleanKey = apiKey.trim();

  // قائمة النماذج تُستكشف مرة واحدة لكل قراءة (لا لكل دفعة) حفاظاً على الحصة المجانية
  let models = knownModels && knownModels.length > 0 ? knownModels : [];
  if (models.length === 0) {
    onProgress?.(5, 'جاري استكشاف النماذج النشطة في حساب Google الخاص بك...');
    try {
      const checkRes = await testGeminiApiKey(cleanKey);
      if (checkRes.success) models = checkRes.models;
    } catch (_) {}
  }
  if (models.length === 0) models = ['gemini-3.8-flash', 'gemini-2.5-flash', 'gemini-2.5-pro'];

  // دفعة قُطع ردها لطوله تُقسم نصفين وتُقرأ من جديد. start موضع أول صفحاتها في الملف
  let percent = 10;
  const readBatch = async (imgs: string[], label: string, start: number): Promise<GeminiRawResult> => {
    const reading = { start, count: imgs.length };
    const r = await requestGeminiRows(imgs, cleanKey, models, s => onProgress?.(percent, `${label}: ${s}`, reading));
    if (!r.truncated) return r;
    if (imgs.length === 1) {
      throw new Error('رد النموذج على هذه الصفحة طويل جداً فقُطع قبل اكتماله.');
    }
    const mid = Math.ceil(imgs.length / 2);
    const a = await readBatch(imgs.slice(0, mid), label, start);
    const b = await readBatch(imgs.slice(mid), label, start + mid);
    return { rows: [...a.rows, ...b.rows], grandTotal: b.grandTotal ?? a.grandTotal, grandTotalText: b.grandTotalText ?? a.grandTotalText,
      rawText: `${a.rawText}\n${b.rawText}`, modelUsed: b.modelUsed, truncated: false };
  };

  const batches = batchPages(images);
  const rows: any[] = [];
  const rawTexts: string[] = [];
  let grandTotal: number | null = null;
  let grandTotalText: string | undefined;
  let modelUsed = '';
  let stoppedAtPage: number | undefined;
  let error: string | undefined;

  for (let b = 0; b < batches.length; b++) {
    const { start, images: imgs } = batches[b];
    const label = images.length === 1 ? 'الصفحة (1)'
      : `الصفحات (${start + 1}–${start + imgs.length}) من (${images.length})`;
    percent = Math.round(10 + (80 * b) / batches.length);
    onProgress?.(percent, `${label}: جاري الإرسال...`, { start, count: imgs.length });
    try {
      const r = await readBatch(imgs, label, start);
      rows.push(...r.rows);
      rawTexts.push(r.rawText);
      if (r.grandTotal !== null) { grandTotal = r.grandTotal; grandTotalText = r.grandTotalText; }
      modelUsed = r.modelUsed;
    } catch (err: any) {
      // دفعة أولى فاشلة = فشل القراءة كلها؛ بعدها يُحتفظ بما قُرئ ويُبلَّغ عن موضع التوقف
      if (b === 0) throw err;
      stoppedAtPage = start + 1;
      error = err?.message || String(err);
      break;
    }
  }

  const items = mergeContinuationRows(rows).map(mapGeminiRow);
  onProgress?.(100, `تم استخراج (${items.length}) فقرة عبر الذكاء الاصطناعي${modelUsed ? ` (${modelUsed})` : ''}`);

  return {
    items,
    rawText: rawTexts.join('\n'),
    confidence: 98,
    models,
    modelUsed,
    grandTotal,
    grandTotalText,
    stoppedAtPage,
    error
  };
}

interface OcrWord {
  text: string;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

interface OcrLine {
  words: OcrWord[];
  y0: number;
  y1: number;
}

type ColumnKey = 'itemNo' | 'description' | 'unit' | 'quantity' | 'unitPrice' | 'total' | 'writtenText';

// كلمات مفتاحية شائعة في رؤوس جداول الكميات والعطاءات الحكومية العراقية
const HEADER_KEYWORDS: { key: ColumnKey; pattern: RegExp }[] = [
  { key: 'itemNo', pattern: /^(ت|م|رقم|تسلسل)$/ },
  { key: 'unit', pattern: /(الوحدة|وحدة)/ },
  { key: 'quantity', pattern: /(الكمية|كمية|العدد|عدد)/ },
  { key: 'unitPrice', pattern: /(سعر\s*المفرد|سعر\s*الوحدة|المفرد)/ },
  { key: 'writtenText', pattern: /(تفقيط|كتاب)/ },
  { key: 'total', pattern: /(المجموع|الاجمالي|الإجمالي|المبلغ|الكلي)/ },
  { key: 'description', pattern: /(وصف|اسم\s*المادة|البيان|الفقرة|المادة)/ }
];

/**
 * تفكيك نتيجة Tesseract إلى أسطر مع مواقع الكلمات (Bounding Boxes)
 * بدل الاكتفاء بالنص الخام، لإتاحة إعادة بناء أعمدة الجدول هندسياً حسب الموقع الفعلي
 */
function flattenTesseractLines(page: any): OcrLine[] {
  const lines: OcrLine[] = [];
  const blocks = page?.blocks || [];
  for (const block of blocks) {
    for (const para of block.paragraphs || []) {
      for (const line of para.lines || []) {
        const words: OcrWord[] = (line.words || [])
          .filter((w: any) => w.text && w.text.trim())
          .map((w: any) => ({
            text: w.text.trim(),
            x0: w.bbox.x0,
            x1: w.bbox.x1,
            y0: w.bbox.y0,
            y1: w.bbox.y1
          }));
        if (words.length > 0) {
          lines.push({ words, y0: line.bbox.y0, y1: line.bbox.y1 });
        }
      }
    }
  }
  return lines.sort((a, b) => a.y0 - b.y0);
}

/**
 * البحث عن سطر رأس الجدول (ت، اسم المادة، الوحدة، الكمية، سعر المفرد، المجموع، التفقيط)
 * وتحديد مواقع الأعمدة الفعلية (بالبكسل) اعتماداً على موقع كل كلمة مفتاحية
 */
function detectHeaderColumns(lines: OcrLine[]): { headerIndex: number; bands: { key: ColumnKey; centerX: number }[] } {
  const searchLimit = Math.min(lines.length, 15);
  for (let li = 0; li < searchLimit; li++) {
    const matches: { key: ColumnKey; centerX: number }[] = [];
    for (const w of lines[li].words) {
      const normalized = normalizeArabicNumbers(w.text).replace(/[.:]/g, '').trim();
      for (const hk of HEADER_KEYWORDS) {
        if (hk.pattern.test(normalized) && !matches.find(m => m.key === hk.key)) {
          matches.push({ key: hk.key, centerX: (w.x0 + w.x1) / 2 });
          break;
        }
      }
    }
    if (matches.length >= 3) {
      return { headerIndex: li, bands: matches.sort((a, b) => a.centerX - b.centerX) };
    }
  }
  return { headerIndex: -1, bands: [] };
}

function assignToNearestBand(centerX: number, bands: { key: ColumnKey; centerX: number }[]): ColumnKey {
  let bestKey = bands[0].key;
  let bestDist = Infinity;
  for (const b of bands) {
    const d = Math.abs(centerX - b.centerX);
    if (d < bestDist) {
      bestDist = d;
      bestKey = b.key;
    }
  }
  return bestKey;
}

/**
 * إعادة بناء صفوف الجدول اعتماداً على مواقع رأس الجدول المكتشفة (بدون أي ذكاء اصطناعي)
 */
function buildRowsFromHeader(
  lines: OcrLine[],
  headerIndex: number,
  bands: { key: ColumnKey; centerX: number }[]
): Partial<BOQItem>[] {
  const items: Partial<BOQItem>[] = [];
  let itemIndex = 1;

  for (let li = headerIndex + 1; li < lines.length; li++) {
    const cells: Partial<Record<ColumnKey, string[]>> = {};
    for (const w of lines[li].words) {
      const key = assignToNearestBand((w.x0 + w.x1) / 2, bands);
      if (!cells[key]) cells[key] = [];
      cells[key]!.push(w.text);
    }

    const cellText = (k: ColumnKey) => (cells[k] || []).join(' ').trim();

    const quantityRaw = cellText('quantity');
    const unitPriceRaw = cellText('unitPrice');
    const totalRaw = cellText('total');

    // تجاهل الأسطر التي لا تحتوي على أي بيانات رقمية (خطوط فاصلة، عناوين فرعية...)
    if (!quantityRaw && !unitPriceRaw && !totalRaw) continue;

    const itemNoParsed = Math.round(parseArabicNumber(normalizeArabicNumbers(cellText('itemNo'))));
    const itemNo = itemNoParsed > 0 ? itemNoParsed : itemIndex;
    const quantity = parseArabicNumber(normalizeArabicNumbers(quantityRaw)) || 1;
    const unitPrice = parseArabicNumber(normalizeArabicNumbers(unitPriceRaw)) || 0;
    const total = parseArabicNumber(normalizeArabicNumbers(totalRaw)) || (unitPrice * quantity);
    const description = cellText('description') || `فقرة رقم ${itemNo}`;
    const unit = cellText('unit') || 'عدد';
    const writtenText = cellText('writtenText') || undefined;

    if (total <= 0 && unitPrice <= 0) continue;

    items.push({
      itemNo,
      description,
      unit,
      quantity,
      estimatedTotal: 0,
      estimatedUnitPrice: 0,
      bidderTotal: total,
      bidderUnitPrice: quantity > 0 ? total / quantity : total,
      enteredUnitPrice: unitPrice || (quantity > 0 ? total / quantity : total),
      enteredBidderTotal: total,
      writtenText
    });
    itemIndex++;
  }

  return items;
}

/**
 * حل احتياطي عند تعذر اكتشاف رأس الجدول: نفس الأسلوب القديم القائم على عدّ الأرقام بكل سطر نصي
 */
function buildRowsHeuristic(text: string): Partial<BOQItem>[] {
  const lines = text.split(/\r?\n/).map((l: string) => l.trim()).filter(Boolean);
  const items: Partial<BOQItem>[] = [];
  let itemIndex = 1;

  for (const line of lines) {
    const normalizedLine = normalizeArabicNumbers(line);
    const numberMatches = normalizedLine.match(/-?\d+(?:[.,]\d+)?/g);

    if (numberMatches && numberMatches.length >= 2) {
      const numbers = numberMatches.map((n: string) => parseFloat(n.replace(/,/g, ''))).filter((n: number) => !isNaN(n));

      if (numbers.length >= 2) {
        let itemNo = itemIndex;
        let bidderTotal = 0;
        let estimatedTotal = 0;
        let quantity = 1;

        if (numbers.length === 2) {
          bidderTotal = numbers[0];
          estimatedTotal = numbers[1];
        } else if (numbers.length === 3) {
          itemNo = Math.round(numbers[0]) || itemIndex;
          bidderTotal = numbers[1];
          estimatedTotal = numbers[2];
        } else if (numbers.length >= 4) {
          itemNo = Math.round(numbers[0]) || itemIndex;
          bidderTotal = numbers[1];
          estimatedTotal = numbers[2];
          quantity = numbers[3] > 0 ? numbers[3] : 1;
        }

        let desc = line.replace(/[-+]?\d+(?:[.,]\d+)?/g, '').replace(/[|/\\_-]/g, '').trim();
        if (!desc || desc.length < 2) {
          desc = `فقرة رقم ${itemNo}`;
        }

        if (bidderTotal > 0 || estimatedTotal > 0) {
          items.push({
            itemNo,
            description: desc,
            unit: 'عدد',
            quantity: quantity || 1,
            estimatedTotal,
            estimatedUnitPrice: quantity > 0 ? estimatedTotal / quantity : estimatedTotal,
            bidderTotal,
            bidderUnitPrice: quantity > 0 ? bidderTotal / quantity : bidderTotal,
            enteredUnitPrice: quantity > 0 ? bidderTotal / quantity : bidderTotal,
            enteredBidderTotal: bidderTotal
          });
          itemIndex++;
        }
      }
    }
  }

  return items;
}

/**
 * محرك OCR المحلي (Tesseract) للمستندات المطبوعة بدون إنترنت وبدون ذكاء اصطناعي
 * يعتمد على اكتشاف رأس الجدول (ت، اسم المادة، الوحدة، الكمية، سعر المفرد، المجموع)
 * وإعادة بناء الأعمدة هندسياً حسب موقع كل كلمة فعلياً في الصورة
 */
/**
 * في أول زيارة للتطبيق المنشور يُثبَّت عامل الخدمة (pwa/sw.js) ثم يستلم الصفحة (clients.claim).
 * إن بدأ محرك Tesseract تحميل ملفاته قبل أن يستلمها، يتوقف المحرك عند «التهيئة» بلا خطأ ولا نهاية
 * (ثبت بالتجربة: ينجح مع صفحة مستلمة مسبقاً، ويعلق إن بدأ في الثواني الأولى من أول زيارة).
 * فننتظر الاستلام إن كان عامل الخدمة قيد التثبيت، بحد أقصى 10 ثوانٍ. لا أثر له في الملف المحمول (file://).
 */
async function waitForServiceWorkerControl(timeoutMs = 10000): Promise<void> {
  if (!('serviceWorker' in navigator) || navigator.serviceWorker.controller) return;
  const registration = await navigator.serviceWorker.getRegistration().catch(() => undefined);
  if (!registration) return;
  await Promise.race([
    new Promise<void>(resolve => navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true })),
    new Promise<void>(resolve => setTimeout(resolve, timeoutMs)),
  ]);
}

export async function extractBOQFromImage(
  imageSource: string | File,
  onProgress?: (progress: number, status: string) => void
): Promise<ExtractedTableData> {
  let imageUrl = '';
  if (imageSource instanceof File) {
    imageUrl = URL.createObjectURL(imageSource);
  } else {
    imageUrl = imageSource;
  }

  onProgress?.(10, 'جاري تهيئة محرك التعرف الضوئي الموضعي (OCR)...');

  try {
    await waitForServiceWorkerControl();
    const worker = await createWorker(['ara', 'eng']);

    onProgress?.(35, 'جاري معالجة وقراءة النصوص المطبوعة من الصورة...');
    const ret = await worker.recognize(imageUrl, {}, { blocks: true });

    onProgress?.(70, 'جاري اكتشاف رأس الجدول وإعادة بناء الأعمدة...');
    await worker.terminate();

    const text = ret.data.text || '';
    const ocrLines = flattenTesseractLines(ret.data);

    let items: Partial<BOQItem>[] = [];
    const { headerIndex, bands } = detectHeaderColumns(ocrLines);

    if (headerIndex >= 0 && bands.length >= 3) {
      onProgress?.(85, `تم اكتشاف رأس الجدول (${bands.length} أعمدة)، جاري تعبئة الصفوف...`);
      items = buildRowsFromHeader(ocrLines, headerIndex, bands);
    }

    // حل احتياطي في حال تعذر اكتشاف رأس الجدول أو لم تُستخرج أي صفوف صالحة منه
    if (items.length === 0) {
      onProgress?.(85, 'تعذر اكتشاف رأس الجدول بدقة، جاري استخدام أسلوب الاستخراج الاحتياطي...');
      items = buildRowsHeuristic(text);
    }

    onProgress?.(100, `اكتمل الاستخراج الموضعي! (${items.length} فقرة)`);
    return {
      items,
      rawText: text,
      confidence: typeof ret.data.confidence === 'number' ? Math.round(ret.data.confidence) : 0
    };
  } catch (error) {
    console.error('OCR Extraction Error:', error);
    onProgress?.(100, 'حدث خطأ أثناء قراءة الصورة');
    throw error;
  }
}

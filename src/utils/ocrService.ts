import { createWorker } from 'tesseract.js';
import { BOQItem } from '../types/tender';
import { parseArabicNumber } from './calculations';
import { parseArabicTextToNumber } from './bidderAuditEngine';

export interface ExtractedTableData {
  items: Partial<BOQItem>[];
  rawText: string;
  confidence: number;
}

/**
 * تصغير وضغط الصورة قبل رفعها لتقليل حجم الطلب وتسريع الاستجابة
 * وتفادي فشل الاتصال بسبب حجم الصور الكبير القادمة من كاميرا الهاتف
 */
export function compressImageDataUrl(
  dataUrl: string,
  maxDimension: number = 1600,
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
    // استخراج كافة النماذج التي تدعم generateContent وتدعم الرؤية
    const modelsList: string[] = (data?.models || [])
      .filter((m: any) => {
        const name = (m.name || '').toLowerCase();
        return name.includes('gemini') && 
               !name.includes('embedding') && 
               !name.includes('aqa') &&
               m.supportedGenerationMethods?.includes('generateContent');
      })
      .map((m: any) => m.name.replace('models/', ''));

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

/**
 * محرك استخراج الجداول عبر نماذج Gemini Vision المتخصصة بالرؤية الاصطناعية
 */
export async function extractBOQWithGeminiVision(
  imageBase64: string,
  apiKey: string,
  onProgress?: (progress: number, status: string) => void,
  knownModels?: string[]
): Promise<ExtractedTableData & { models: string[] }> {
  const cleanKey = apiKey.trim();

  // إزالة الترويسة data:image/...;base64,
  let cleanBase64 = imageBase64;
  let mimeType = 'image/jpeg';
  if (imageBase64.includes(';base64,')) {
    const parts = imageBase64.split(';base64,');
    mimeType = parts[0].replace('data:', '');
    cleanBase64 = parts[1];
  }

  const systemPrompt = `أنت خبير تدقيق وتحليل جداول كميات ومناقصات وعطاءات حكومية.
قم بتحليل صورة جدول العطاء المرفقة واستخرج كافة الصفوف بدقة متناهية.

لكل صف، استخرج الحقول الآتية بصيغة JSON حصراً:
- itemNo: رقم أو تسلسل الفقرة (مثلاً 1 أو 447)
- description: اسم المادة أو وصف الفقرة بالعربية
- unit: الوحدة (متر، كغم، ميسر، عدد، لفة...)
- quantity: العدد أو الكمية كرقم (مثلاً 2400)
- unitPrice: سعر المفرد المكتوب كرقم (مثلاً 2400 أو 3000)
- writtenText: سعر المفرد أو مبلغ الفقرة المكتوب كتابةً بالتفقيط (مثلاً "ألفان وأربعمائة دينار")
- total: مبلغ الفقرة الإجمالي المكتوب أو المحسوب كرقم (مثلاً 5760000)

يجب أن تكون إجابتك عبارة عن مصفوفة JSON فقط كالتالي دون أي مقدمات أو شروحات:
[
  {
    "itemNo": 1,
    "description": "اسم المادة",
    "unit": "عدد",
    "quantity": 10,
    "unitPrice": 18000,
    "writtenText": "ثمانية عشر ألف دينار",
    "total": 180000
  }
]`;

  // 1. استخدام قائمة النماذج المخزنة مسبقاً (لتفادي استهلاك حصة الطلبات عند معالجة عدة صفحات)
  //    أو الاستعلام المباشر عنها لمفتاح المستخدم بالضبط في حال عدم توفرها
  let modelsToTry: string[] = knownModels && knownModels.length > 0 ? knownModels : [];

  if (modelsToTry.length === 0) {
    onProgress?.(10, 'جاري استكشاف النماذج النشطة في حساب Google الخاص بك...');
    try {
      const checkRes = await testGeminiApiKey(cleanKey);
      if (checkRes.success && checkRes.models.length > 0) {
        // ترتيب النماذج: flash أولاً ثم الباقي
        modelsToTry = checkRes.models.sort((a, b) => {
          if (a.includes('flash') && !b.includes('flash')) return -1;
          if (!a.includes('flash') && b.includes('flash')) return 1;
          return 0;
        });
      }
    } catch (_) {}
  }

  // إذا لم نتمكن من قائمة النماذج، نستخدم النماذج القياسية كحل احتياطي أخير
  if (modelsToTry.length === 0) {
    modelsToTry = [
      'gemini-2.5-flash',
      'gemini-2.0-flash',
      'gemini-1.5-flash',
      'gemini-1.5-flash-8b',
      'gemini-1.5-pro'
    ];
  }

  let rawContent = '';
  let errorReports: string[] = [];
  let hadRateLimitError = false;

  for (const model of modelsToTry) {
    // محاولتان لكل نموذج: الثانية بعد انتظار قصير في حال تجاوز حد الطلبات (429)
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        onProgress?.(35, `جاري الاستخراج بالنموذج النشط (${model})${attempt > 1 ? ' - إعادة محاولة...' : ''}`);

        const requestBody = {
          contents: [
            {
              parts: [
                { text: systemPrompt },
                {
                  inlineData: {
                    mimeType: mimeType,
                    data: cleanBase64
                  }
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.1
          }
        };

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${cleanKey}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': cleanKey
          },
          body: JSON.stringify(requestBody)
        });

        if (response.ok) {
          const data = await response.json();
          rawContent = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
          if (rawContent && rawContent.length > 5) {
            break; // نجاح كامل!
          }
        } else if (response.status === 429) {
          hadRateLimitError = true;
          errorReports.push(`${model}: تجاوزت الحد المسموح من الطلبات في الدقيقة (429)`);
          if (attempt === 1) {
            await new Promise((r) => setTimeout(r, 3000));
            continue; // إعادة محاولة نفس النموذج بعد الانتظار
          }
        } else if (response.status === 404) {
          errorReports.push(`${model}: هذا النموذج غير متاح لمفتاحك الحالي (404)`);
        } else {
          const errText = await response.text();
          errorReports.push(`${model}: (${response.status}) ${errText.substring(0, 100)}`);
        }
      } catch (err: any) {
        errorReports.push(`${model}: تعذر الاتصال بالإنترنت - ${err.message}`);
      }
      break; // لا نعيد المحاولة إلا في حالة 429 المعالجة أعلاه
    }
    if (rawContent) break;
  }

  if (!rawContent) {
    if (hadRateLimitError) {
      throw new Error('تم تجاوز الحد المسموح من الطلبات لهذه الدقيقة (حصة مجانية محدودة من Google). يرجى الانتظار دقيقة واحدة ثم إعادة المحاولة، أو معالجة الصفحات بشكل منفصل بدل الدفعة الواحدة.');
    }
    throw new Error(`تعذر الاتصال بالنماذج: ${errorReports.join(' | ')}`);
  }

  try {
    onProgress?.(80, 'جاري تفكيك وهيكلة البيانات وتدقيق الحسابات...');

    const parsedRows = extractJsonArray(rawContent);

    const items: Partial<BOQItem>[] = parsedRows.map((r: any, idx: number) => {
      const itemNo = r.itemNo || idx + 1;
      const description = r.description || `فقرة ${itemNo}`;
      const unit = r.unit || 'عدد';
      const quantity = parseArabicNumber(r.quantity) || 1;
      const unitPrice = parseArabicNumber(r.unitPrice) || 0;
      const total = parseArabicNumber(r.total) || (unitPrice * quantity);
      const writtenText = r.writtenText ? String(r.writtenText).trim() : undefined;

      const mathTotal = unitPrice > 0 ? unitPrice * quantity : total;
      const isMathError = unitPrice > 0 && quantity > 1 && Math.abs(mathTotal - total) > 0.01;

      let isTextDiscrepancy = false;
      if (writtenText && writtenText.length > 2) {
        const textNum = parseArabicTextToNumber(writtenText);
        if (textNum !== null && textNum > 0 && Math.abs(textNum - (unitPrice || total)) > 0.01 && Math.abs(textNum - total) > 0.01) {
          isTextDiscrepancy = true;
        }
      }

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
        hasTextDiscrepancy: isTextDiscrepancy
      };
    });

    onProgress?.(100, `تم استخراج (${items.length}) فقرة بنجاح عبر الذكاء الاصطناعي!`);

    return {
      items,
      rawText: rawContent,
      confidence: 98,
      models: modelsToTry
    };

  } catch (error: any) {
    console.error('Gemini JSON parsing error:', error);
    throw new Error('فشل تفكيك استجابة الذكاء الاصطناعي: ' + error.message);
  }
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
      confidence: ret.data.confidence || 80
    };
  } catch (error) {
    console.error('OCR Extraction Error:', error);
    onProgress?.(100, 'حدث خطأ أثناء قراءة الصورة');
    throw error;
  }
}

import { createWorker } from 'tesseract.js';
import { BOQItem } from '../types/tender';
import { parseArabicNumber } from './calculations';
import { parseArabicTextToNumber } from './bidderAuditEngine';

export interface ExtractedTableData {
  items: Partial<BOQItem>[];
  rawText: string;
  confidence: number;
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
 * محرك استخراج الجداول عبر الذكاء الاصطناعي الرؤيوي (Gemini Vision API)
 * يدعم بدقة فائقة: خط اليد العربي، الأرقام المشرقية، الصور الملتقطة بكاميرا الهاتف، والجداول المعقدة
 */
export async function extractBOQWithGeminiVision(
  imageBase64: string,
  apiKey: string,
  onProgress?: (progress: number, status: string) => void
): Promise<ExtractedTableData> {
  onProgress?.(15, 'جاري تهيئة الاتصال بمحرك الرؤية الاصطناعية...');

  // إزالة الترويسة data:image/...;base64,
  let cleanBase64 = imageBase64;
  let mimeType = 'image/jpeg';
  if (imageBase64.includes(';base64,')) {
    const parts = imageBase64.split(';base64,');
    mimeType = parts[0].replace('data:', '');
    cleanBase64 = parts[1];
  }

  const systemPrompt = `أنت خبير تدقيق وتحليل جداول كميات ومناقصات وعطاءات حكومية.
قم بتحليل الصورة المرفقة (سواء كانت مطبوعة أو مكتوبة بخط اليد أو مصورة بكاميرا) واستخرج كافة صفوف الجدول المالي بدقة متناهية.

لكل صف، استخرج الحقول الآتية بصيغة JSON حصراً:
- itemNo: رقم أو تسلسل الفقرة (مثلاً 1 أو 447)
- description: اسم المادة أو وصف الفقرة بالعربية
- unit: الوحدة (متر، كغم، ميسر، عدد، لفة...)
- quantity: العدد أو الكمية كرقم (مثلاً 2400)
- unitPrice: سعر المفرد المكتوب كرقم (مثلاً 2400 أو 3000)
- writtenText: سعر المفرد أو مبلغ الفقرة المكتوب كتابةً بالتفقيط (مثلاً "ألفان وأربعمائة دينار")
- total: مبلغ الفقرة الإجمالي المكتوب أو المحسوب كرقم (مثلاً 5760000)

أرجع النتيجة كمصفوفة JSON نقية فقط بالشكل التالي دون أي نصوص إضافية:
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

  const candidateModels = [
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-1.5-flash-latest',
    'gemini-1.5-flash',
    'gemini-1.5-pro'
  ];

  let rawContent = '';
  let lastError: any = null;

  for (const model of candidateModels) {
    try {
      onProgress?.(35, `جاري الاتصال بنموذج (${model})...`);
      
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey.trim()}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: systemPrompt },
              {
                inline_data: {
                  mime_type: mimeType,
                  data: cleanBase64
                }
              }
            ]
          }],
          generationConfig: {
            temperature: 0.1,
            response_mime_type: "application/json"
          }
        })
      });

      if (response.ok) {
        const data = await response.json();
        rawContent = data?.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
        if (rawContent && rawContent !== '[]') {
          break; // نجح الاتصال بنجاح!
        }
      } else {
        const errText = await response.text();
        lastError = new Error(`(${response.status}): ${errText}`);
      }
    } catch (err: any) {
      lastError = err;
    }
  }

  if (!rawContent || rawContent === '[]') {
    throw new Error(`تعذر الاتصال بالنماذج المتاحة: ${lastError?.message || 'تأكد من صحة المفتاح والاتصال'}`);
  }

  try {
    onProgress?.(75, 'جاري تفكيك وهيكلة البيانات وتدقيق الحسابات...');

    // تنظيف نص JSON
    const jsonStr = rawContent.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsedRows = JSON.parse(jsonStr);

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
      confidence: 98
    };

  } catch (error: any) {
    console.error('Gemini JSON parsing error:', error);
    throw new Error('فشل تفكيك استجابة الذكاء الاصطناعي: ' + error.message);
  }
}

/**
 * محرك OCR المحلي (Tesseract) للمستندات المطبوعة بدون إنترنت
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
    const ret = await worker.recognize(imageUrl);
    
    onProgress?.(80, 'جاري تنظيم وهيكلة بيانات الجدول...');
    await worker.terminate();

    const text = ret.data.text || '';
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

    onProgress?.(100, 'اكتمل الاستخراج الموضعي!');
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

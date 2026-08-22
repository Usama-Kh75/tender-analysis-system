import { createWorker } from 'tesseract.js';
import { BOQItem } from '../types/tender';

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

export function parseAmount(text: string): number {
  if (!text) return 0;
  const clean = normalizeArabicNumbers(text)
    .replace(/[^0-9.,-]/g, '')
    .replace(/,/g, '');
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
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

  onProgress?.(10, 'جاري تهيئة محرك التعرف الضوئي (OCR)...');

  try {
    const worker = await createWorker(['ara', 'eng']);
    
    onProgress?.(35, 'جاري معالجة وقراءة النصوص والأرقام من الصورة...');
    const ret = await worker.recognize(imageUrl);
    
    onProgress?.(80, 'جاري تنظيم وهيكلة بيانات الجدول المالي...');
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

          let desc = line.replace(/[-+]?\d+(?:[.,]\d+)?/g, '').replace(/[|/\_-]/g, '').trim();
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
            });
            itemIndex++;
          }
        }
      }
    }

    onProgress?.(100, 'اكتمل الاستخراج بنجاح!');
    return {
      items,
      rawText: text,
      confidence: ret.data.confidence || 85
    };
  } catch (error) {
    console.error('OCR Extraction Error:', error);
    onProgress?.(100, 'حدث خطأ أثناء قراءة الصورة');
    throw error;
  }
}

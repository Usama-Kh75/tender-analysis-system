/**
 * تحويل صفحات ملف PDF (رقمي أو ممسوح ضوئياً) إلى صور، لتمر بعدها في محركي الاستخراج نفسيهما
 * (Gemini أو Tesseract) كأي صورة، مع إمكان مراجعة كل صفحة وتدويرها أو حذفها قبل القراءة.
 *
 * يعمل داخل الملف الواحد وبلا إنترنت:
 * - pdf.js يعمل في الخيط الرئيسي (globalThis.pdfjsWorker) بدل ملف worker منفصل يحتاج رابطاً.
 * - مفككا صور المسح الضوئي (JBIG2 للأبيض والأسود، وJPX/JPEG2000) ملفا WebAssembly مضمّنان في
 *   البناء ويُسلَّمان عبر BinaryDataFactory خاص، لأن pdf.js يطلبهما افتراضياً من رابط (wasmUrl).
 * يُحمَّل كل ذلك عند أول ملف PDF فقط (import ديناميكي)، فلا يبطئ فتح النظام.
 */
import EMBEDDED_WASM from 'virtual:pdf-wasm';

// يُسلِّم ملفات WebAssembly المضمّنة بدل جلبها من رابط
class EmbeddedBinaryDataFactory {
  constructor(_options: unknown) { /* لا روابط */ }
  async fetch({ kind, filename }: { kind: string; filename: string }): Promise<Uint8Array> {
    const base64 = kind === 'wasmUrl' ? EMBEDDED_WASM[filename] : undefined;
    if (!base64) throw new Error(`ملف غير مضمّن: ${kind}/${filename}`);
    return Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  }
}

type PdfJs = typeof import('pdfjs-dist');
let pdfjsPromise: Promise<PdfJs> | null = null;

function loadPdfJs(): Promise<PdfJs> {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs');
      (globalThis as { pdfjsWorker?: unknown }).pdfjsWorker = worker;
      return await import('pdfjs-dist');
    })();
  }
  return pdfjsPromise;
}

export const isPdfFile = (file: File): boolean =>
  file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

// أطول بُعد للصفحة المحوّلة بالبكسل: يكفي لقراءة أرقام جدول الكميات بوضوح دون تضخيم الحجم
const TARGET_DIMENSION = 2000;

/**
 * يحوّل كل صفحات الملف إلى صور JPEG (data URL) بترتيبها.
 * onProgress يُستدعى بعد كل صفحة (رقمها، عددها الكلي).
 */
export async function pdfToImages(
  file: File,
  onProgress?: (page: number, total: number) => void
): Promise<string[]> {
  const pdfjs = await loadPdfJs();
  const data = new Uint8Array(await file.arrayBuffer());
  const loadingTask = pdfjs.getDocument({
    data,
    useWorkerFetch: false,
    BinaryDataFactory: EmbeddedBinaryDataFactory,
  });
  const pdf = await loadingTask.promise;

  const images: string[] = [];
  try {
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n);
      const base = page.getViewport({ scale: 1 });
      const scale = Math.min(TARGET_DIMENSION / Math.max(base.width, base.height), 4);
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      // خلفية بيضاء: صفحات PDF الشفافة تصير سوداء عند الحفظ بصيغة JPEG
      const ctx = canvas.getContext('2d');
      if (ctx) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); }

      await page.render({ canvas, viewport }).promise;
      images.push(canvas.toDataURL('image/jpeg', 0.9));
      page.cleanup();
      onProgress?.(n, pdf.numPages);
    }
  } finally {
    await loadingTask.destroy();
  }
  return images;
}

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
import { scanLongEdge } from './readAdvice';

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

// أبعاد الصور المضمّنة في الصفحة (المسح الضوئي صورة واحدة بحجم الصفحة)، لقياس دقة المسح الأصلية قبل أن يحدّها الرسم بـ 2000 بكسل.
// في المتصفح لا تُحَلّ كائنات الصور في page.objs إلا أثناء الرسم ثم تُحرَّر بعده، فتُسجَّل استدعاءاتها قبل render وتُقرأ بعده:
// ما لم يُحَلّ حتى انتهاء الرسم يُعدّ مجهولاً. أي تعذّر يعني «مجهول» لا خطأ
async function watchEmbeddedImages(pdfjs: PdfJs, page: import('pdfjs-dist').PDFPageProxy) {
  const waits: Promise<{ width: number; height: number } | null>[] = [];
  const open: (() => void)[] = [];
  try {
    const ops = await page.getOperatorList();
    for (let i = 0; i < ops.fnArray.length; i++) {
      const fn = ops.fnArray[i];
      if (fn !== pdfjs.OPS.paintImageXObject && fn !== pdfjs.OPS.paintImageXObjectRepeat && fn !== pdfjs.OPS.paintInlineImageXObject) continue;
      const arg = ops.argsArray[i]?.[0];
      waits.push(new Promise(resolve => {
        const done = (img: { width?: number; height?: number } | null | undefined) =>
          resolve(img && (img.width ?? 0) > 0 && (img.height ?? 0) > 0 ? { width: img.width!, height: img.height! } : null);
        if (typeof arg !== 'string') { done(arg); return; }
        open.push(() => resolve(null));
        page.objs.get(arg, done);
      }));
    }
  } catch { /* دقة مجهولة */ }
  return {
    // يُستدعى بعد انتهاء الرسم: ما بقي معلّقاً لن يُحَلّ
    async sizes() {
      open.forEach(close => close());
      return (await Promise.all(waits)).filter((x): x is { width: number; height: number } => x !== null);
    }
  };
}

/**
 * يحوّل كل صفحات الملف إلى صور JPEG (data URL) بترتيبها.
 * onProgress يُستدعى بعد كل صفحة (رقمها، عددها الكلي).
 * onScanEdge بعد كل صفحة أيضاً: أطول بُعد (بكسل) لمسحها الضوئي الأصلي، أو null لصفحة رقمية أو مجهولة
 */
export async function pdfToImages(
  file: File,
  onProgress?: (page: number, total: number) => void,
  onScanEdge?: (pageIndex: number, edge: number | null) => void
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

      const embedded = onScanEdge ? await watchEmbeddedImages(pdfjs, page) : null;
      await page.render({ canvas, viewport }).promise;
      if (embedded) onScanEdge!(n - 1, scanLongEdge(await embedded.sizes(), base));
      images.push(canvas.toDataURL('image/jpeg', 0.9));
      page.cleanup();
      onProgress?.(n, pdf.numPages);
    }
  } finally {
    await loadingTask.destroy();
  }
  return images;
}

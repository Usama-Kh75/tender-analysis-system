// نصائح ما قبل القراءة الآلية: دقة المسح الأصلية للصفحات (محلية، بلا طلب شبكة). عرض فقط: لا تدخل في أي حساب
// الدقة تُقاس من الصورة الأصلية لا من الصفحة المرسومة: pdfToImages وcompressImageDataUrl يحدّان الصورة بـ 2000 بكسل،
// فمسح ضعيف مكبَّر إليها يبدو سليماً. أطول بُعد دون هذا الحد (نحو 120 نقطة في البوصة لصفحة A4) يُضعف الأرقام الصغيرة
export const LOW_RESOLUTION_EDGE = 1400;

// صورة مضمّنة تُعدّ مسحاً للصفحة كلها إن قاربت نسبة أبعادها نسبة الصفحة (ولو دُوّرت)؛ شعار أو ختم صغير لا يُعدّ
const SCAN_ASPECT_TOLERANCE = 0.15;

interface Size { width: number; height: number }

/**
 * أطول بُعد (بكسل) لأكبر صورة مضمّنة في صفحة PDF تغطيها كلها، أو null لصفحة رقمية (نص وخطوط لا تتأثر بالدقة)
 */
export function scanLongEdge(images: Size[], page: Size): number | null {
  const pageRatio = Math.max(page.width, page.height) / Math.min(page.width, page.height);
  let best: number | null = null;
  for (const img of images) {
    if (!(img.width > 0 && img.height > 0)) continue;
    const ratio = Math.max(img.width, img.height) / Math.min(img.width, img.height);
    if (Math.abs(ratio - pageRatio) / pageRatio > SCAN_ASPECT_TOLERANCE) continue;
    const edge = Math.max(img.width, img.height);
    if (best === null || edge > best) best = edge;
  }
  return best;
}

/** مواضع الصفحات (من 0) التي أطول أبعاد صورتها الأصلية دون الحد؛ المجهول (null) لا يُعدّ منخفضاً */
export const lowResolutionPages = (edges: (number | null | undefined)[]): number[] =>
  edges.flatMap((e, i) => (typeof e === 'number' && e < LOW_RESOLUTION_EDGE ? [i] : []));

// تلميح «الأرجح خطأ قراءة»: يقارن الرقم المقروء من العطاء بالرقم الذي يقوله التفقيط. عرض فقط، لا يغيّر شيئاً بنفسه.
// نمطان عُرفا من قراءة عطاء مكتوب بخط اليد: «٣» بسنّ واحدة تُقرأ «٢»، وصفر يزيد أو ينقص. غير ذلك لا تلميح،
// فاختلاف الرقمين قد يكون خطأ المجهز نفسه.
export type ReadingHintKind = 'swap23' | 'zeros';
export interface ReadingHint { kind: ReadingHintKind; text: string }

const stripTrailingZeros = (s: string) => s.replace(/0+$/, '');

export function readingHint(read: number, written: number): ReadingHint | null {
  if (!Number.isInteger(read) || !Number.isInteger(written) || read <= 0 || written <= 0 || read === written) return null;
  const a = String(read);
  const b = String(written);
  if (a.length === b.length) {
    let diff = 0;
    for (let i = 0; i < a.length; i++) {
      if (a[i] === b[i]) continue;
      if (!((a[i] === '2' && b[i] === '3') || (a[i] === '3' && b[i] === '2'))) return null;
      diff++;
    }
    return diff > 0 ? { kind: 'swap23', text: 'الأرجح خطأ قراءة: «٣» بخط اليد تُقرأ أحياناً «٢»' } : null;
  }
  return stripTrailingZeros(a) === stripTrailingZeros(b)
    ? { kind: 'zeros', text: 'الأرجح خطأ قراءة: صفر زائد أو ناقص' }
    : null;
}

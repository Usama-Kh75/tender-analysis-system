// توحيد رقم الطلبية: التسلسل / السنة / الرمز بمسافة واحدة حول كل شرطة مائلة
const DIGITS = /^\d+$/;

export function formatOrderNumber(raw: string): string {
  try {
    const text = String(raw ?? '').trim();
    const western = text
      .replace(/[٠-٩]/g, c => String(c.charCodeAt(0) - 0x0660))
      .replace(/[۰-۹]/g, c => String(c.charCodeAt(0) - 0x06f0));
    const parts = western.split(/\s*[-/\\–—_.]\s*/);
    if (parts.length !== 3 || !parts.every(p => DIGITS.test(p))) return text;
    // الرمز أربعة أرقام بالضبط؛ جزء أول أطول ليس رمزاً فلا يُنقل
    if (parts[0].length === 4 && parts[2].length >= 1 && parts[2].length <= 3) {
      [parts[0], parts[2]] = [parts[2], parts[0]];
    }
    return parts.join(' / ');
  } catch {
    return typeof raw === 'string' ? raw.trim() : '';
  }
}

/** أجزاء الرقم الموحّد «تسلسل / سنة / رمز»؛ null إن لم يكن بهذه الصيغة. */
export function orderNumberParts(ref: string): { seq: number; year: number; code: number } | null {
  const parts = formatOrderNumber(ref).split(' / ');
  if (parts.length !== 3 || !parts.every(p => DIGITS.test(p))) return null;
  return { seq: Number(parts[0]), year: Number(parts[1]), code: Number(parts[2]) };
}

/** ترتيب أرقام الطلبيات: الموحَّدة أولاً بالسنة ثم التسلسل ثم الرمز، ثم غيرها نصاً، والفارغ أخيراً. */
export function compareOrderNumbers(a: string, b: string): number {
  const ea = (a ?? '').trim() === '';
  const eb = (b ?? '').trim() === '';
  if (ea !== eb) return ea ? 1 : -1;
  const pa = orderNumberParts(a);
  const pb = orderNumberParts(b);
  if (pa && pb) return pa.year - pb.year || pa.seq - pb.seq || pa.code - pb.code;
  if (pa || pb) return pa ? -1 : 1;
  return (a ?? '').localeCompare(b ?? '', 'ar', { numeric: true });
}

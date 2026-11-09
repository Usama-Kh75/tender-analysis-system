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
    if (parts[0].length >= 4 && parts[2].length >= 1 && parts[2].length <= 3) {
      [parts[0], parts[2]] = [parts[2], parts[0]];
    }
    return parts.join(' / ');
  } catch {
    return typeof raw === 'string' ? raw.trim() : '';
  }
}

// تاريخ اليوم بتوقيت الجهاز (YYYY-MM-DD): toISOString يعطي تاريخ UTC، فآخر الليل في العراق
// (حتى الثالثة فجراً) يقع في اليوم السابق، كنسخة حُفظت 01:37 يوم 18 فسُمّيت باسم 17
export const localDate = (d: Date = new Date()): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

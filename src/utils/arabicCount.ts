// العدد بالعربية صحيحاً: 1 «فقرة واحدة»، 2 «فقرتان»، 3–10 «N فقرات»، 11+ «N فقرة»؛ وللأخطاء كذلك
const count = (n: number, one: string, two: string, few: string, many: string): string =>
  n === 1 ? one : n === 2 ? two : n >= 3 && n <= 10 ? `${n} ${few}` : `${n} ${many}`;

export const itemsCountText = (n: number): string => count(n, 'فقرة واحدة', 'فقرتان', 'فقرات', 'فقرة');
export const errorsCountText = (n: number): string => count(n, 'خطأ واحد', 'خطآن', 'أخطاء', 'خطأ');
export const initiativesCountText = (n: number): string => count(n, 'مبادرة واحدة', 'مبادرتان', 'مبادرات', 'مبادرة');
/** «فقرتان غير مسعّرتين»: فقرات لها مبلغ في التخميني ولا مبلغ للمجهز فيها (عرض فقط، ليست خطأً) */
export const unpricedCountText = (n: number): string => count(n, 'فقرة واحدة غير مسعّرة', 'فقرتان غير مسعّرتين', 'فقرات غير مسعّرة', 'فقرة غير مسعّرة');
/** «N فقرات فيها أخطاء» */
export const itemsWithErrorsText = (n: number): string => `${itemsCountText(n)} فيها أخطاء`;
/** «عطاء واحد / عطاءان / N عطاءات / N عطاءً» (عدد العطاءات في فرق المستلمة والمسجَّلة) */
export const bidsCountText = (n: number): string => count(n, 'عطاء واحد', 'عطاءان', 'عطاءات', 'عطاءً');
/** المجرور بعد مضاف (نقص …): «عطاء واحد / عطاءين / N عطاءات / N عطاءً» */
export const bidsCountGenitive = (n: number): string => count(n, 'عطاء واحد', 'عطاءين', 'عطاءات', 'عطاءً');

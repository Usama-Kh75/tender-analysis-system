// العدد بالعربية صحيحاً: 1 «فقرة واحدة»، 2 «فقرتان»، 3–10 «N فقرات»، 11+ «N فقرة»؛ وللأخطاء كذلك
const count = (n: number, one: string, two: string, few: string, many: string): string =>
  n === 1 ? one : n === 2 ? two : n >= 3 && n <= 10 ? `${n} ${few}` : `${n} ${many}`;

export const itemsCountText = (n: number): string => count(n, 'فقرة واحدة', 'فقرتان', 'فقرات', 'فقرة');
export const errorsCountText = (n: number): string => count(n, 'خطأ واحد', 'خطآن', 'أخطاء', 'خطأ');
/** «N فقرات فيها أخطاء» */
export const itemsWithErrorsText = (n: number): string => `${itemsCountText(n)} فيها أخطاء`;

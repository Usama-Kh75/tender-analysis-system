/**
 * استئناف العمل بعد «حفظ والتحديث»: البيانات نفسها تُحفظ في localStorage مع كل تعديل،
 * أما موضع المستخدم (التبويب المفتوح وموضع التمرير) فيُحفظ هنا قبل إعادة التحميل ويُستعاد بعدها.
 * sessionStorage يبقى عبر إعادة التحميل في النافذة نفسها ويُمسح بإغلاقها.
 */
const KEY = 'tender_analysis_resume';

export type ResumeTab = 'table' | 'summary' | 'charts';

export interface ResumeState {
  tab: ResumeTab;
  scrollY: number;
}

export function saveResumeState(state: ResumeState): void {
  try { sessionStorage.setItem(KEY, JSON.stringify(state)); } catch { /* تخزين محظور: يُستأنف من البداية */ }
}

function consumeResumeState(): ResumeState | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    sessionStorage.removeItem(KEY);
    const s = JSON.parse(raw) as Partial<ResumeState>;
    const tab: ResumeTab = s.tab === 'summary' || s.tab === 'charts' ? s.tab : 'table';
    return { tab, scrollY: typeof s.scrollY === 'number' && s.scrollY > 0 ? s.scrollY : 0 };
  } catch { return null; }
}

// يُقرأ مرة واحدة عند تحميل الصفحة (ثم يُحذف)، فلا يُستأنف موضع قديم عند فتح لاحق
export const RESUMED_STATE: ResumeState | null = consumeResumeState();

export function clearResumeState(): void {
  try { sessionStorage.removeItem(KEY); } catch { /* لا شيء */ }
}

/**
 * «ما الجديد»: ما صار النظام قادراً على فعله، بلغة عضو اللجنة — يُعرض مرة واحدة بعد التحديث.
 *
 * يُكتب هنا فقط ما يضيف للمستخدم قدرة أو وظيفة جديدة، بصيغة «ما يمكنك فعله».
 * لا تُذكر الإصلاحات الداخلية ولا تحسينات الكود ولا تفاصيل الواجهة الصغيرة (قرار المستخدم 2026-09-30).
 * إصدار إصلاحات فقط لا يحتاج مدخلاً، فلا تظهر له النافذة.
 */

// مرحلة الإصدار تظهر بجانب الرقم في الواجهة فقط (لا في المحضر المطبوع، لأنه وثيقة رسمية).
// عند استقرار النظام: اجعلها '' فتختفي من كل مكان.
export const RELEASE_STAGE = 'Beta';

export const APP_VERSION = __APP_VERSION__;

export const versionLabel = (version: string = APP_VERSION) =>
  `v${version}${RELEASE_STAGE ? ` ${RELEASE_STAGE}` : ''}`;

export interface ChangelogEntry {
  version: string;
  date: string;
  notes: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '1.6.0',
    date: '2026-09-30',
    notes: [
      'عند توفر تحديث اضغط «حفظ والتحديث»، فتعود بعده إلى المناقصة والتبويب وموضع الصفحة نفسها دون أن تفقد شيئاً من عملك.'
    ]
  },
  {
    version: '1.5.0',
    date: '2026-09-30',
    notes: [
      'يُعلمك النظام حين يتوفر إصدار جديد، ويعرض لك ما أُضيف فيه من إمكانيات.',
      'اضغط رقم الإصدار أسفل الصفحة لعرض آخر ما أُضيف في أي وقت.'
    ]
  },
  {
    version: '1.4.0',
    date: '2026-09-30',
    notes: [
      'اختر نوع العقد (أشغال / تجهيز / خدمات غير استشارية) عند إنشاء المناقصة، فتُصاغ التوصية بمعايير المفاضلة الخاصة بنوعه وفق ضوابط رقم (5).'
    ]
  },
  {
    version: '1.3.0',
    date: '2026-09-30',
    notes: [
      'يصوغ النظام توصية لجنة التحليل مسندة إلى مواد تعليمات تنفيذ العقود الحكومية رقم (1) لسنة 2025.',
      'عند تساوي العطاءات أو تقاربها ضمن 1% من الكلفة التخمينية يوصي النظام بالمفاضلة بينها، وحين لا يرد عطاء ضمن الحدود يوصي بالإحالة للتفاوض أو بإعادة الإعلان حسب الحالة.'
    ]
  }
];

/** مقارنة رقمي إصدار (1.4.2 مقابل 1.10.0): سالب إن كان a أقدم */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(n => parseInt(n, 10) || 0);
  const pb = b.split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

/** مدخلات السجل الأحدث من إصدار سابق حتى الإصدار الحالي، من الأحدث إلى الأقدم */
export const changesSince = (previous: string): ChangelogEntry[] =>
  CHANGELOG.filter(e => compareVersions(e.version, previous) > 0 && compareVersions(e.version, APP_VERSION) <= 0);

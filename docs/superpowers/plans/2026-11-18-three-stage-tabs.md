# خطة تنفيذ: ثلاثة تبويبات بمراحل عمل اللجنة، والموقف زر في الرأس

> **للوكلاء المنفّذين:** المهارة المطلوبة: superpowers:subagent-driven-development أو superpowers:executing-plans لتنفيذ الخطة مهمة مهمة. الخطوات بصيغة (`- [ ]`) للمتابعة.

**الهدف:** يصير صف التبويبات «العطاءات والتدقيق | الدراسة والتحليل | التوصية والمحضر»، ويخرج «الموقف» منه إلى زر في رأس المناقصة يفتح سجله في نافذة.

**البنية:**
- يُستخرج تقييم العطاءات من `ExecutiveSummaryView` إلى دالة نقية `evaluateBids` لها اختبارات.
- يُقسم المكوّن إلى مكوّنين: `StudyView` و`RecommendationView`.
- يلفّ مكوّنٌ جديد `StatusWindow` لوحة `OrderStatusPanel` القائمة في نافذة.
- تتغير معرّفات التبويبات في `resume.ts` و`tenderPath.ts` و`ProjectHeader.tsx` و`App.tsx`.

**الأدوات:** React 19 وTypeScript وTailwind v4. الاختبارات `node --test` عبر `npm run check`.

**التصميم:** `docs/superpowers/specs/2026-11-18-three-stage-tabs-design.md`

**مكان العمل:** `E:\Claude Projects\_ui-v6`، الفرع `feature/ui-v6`. كل الأوامر تُشغَّل فيه.

## قيود عامة
- عرض فقط: لا حقل جديد في `TenderProject`، ولا ترحيل، ولا تغيير في `calculations.ts` ولا `recommendation.ts` ولا `recommendationText.ts` ولا المحضر المطبوع ولا Excel.
- `buildRecommendation` هو المصدر الوحيد للتوصية. لا يُعاد حسابها في أي مكوّن.
- نصوص الواجهة عربية. النصوص المنقولة من `ExecutiveSummaryView` تُنقل حرفياً، إلا ما تنص الخطة على تغييره.
- لا مكتبات جديدة.
- لا بند في `src/changelog.ts` ولا رفع للنسخة في هذه الخطة. الإصدار بقرار أسامة بعد معاينته.
- كل مهمة تنتهي بنجاح `npm run build` و`npm run check`، ونتيجة `npm run lint` لا تزيد على ما كانت عليه قبلها.

## تركيز المراجعة
1. **نسخة مثبَّتة حفظت التبويب `'analysis'` أو `'status'` قبل التحديث:** بعد إعادة التحميل يفتح التطبيق «الدراسة والتحليل» أو «التوصية والمحضر»، ولا يظهر تبويب فارغ. يثبّته اختبار في المهمة 4.
2. **إغلاق نافذة الموقف وفي نموذجها كتابة لم تُحفظ** (بالزر أو بـ Escape أو بفتح «كشف الموقف»): يُسأل المستخدم قبل الإغلاق، ولا يضيع ما كتبه بصمت. يُتحقق منه يدوياً في المهمة 3.
3. **تبديل المناقصة ونافذة الموقف مفتوحة:** النافذة تعرض سجل المناقصة الجديدة، ولا يبقى سجل القديمة. يُتحقق منه يدوياً في المهمة 3.
4. **مناقصة بلا كلفة تخمينية:** «التوصية والمحضر» يعرض «لم تُدخل الكلفة التخمينية بعد…» بلا أزرار ترسية، و«الدراسة» تعرض «بانتظار الكلفة التخمينية». يثبّته اختبار في المهمة 1، ويُعايَن في المهمة 2.
5. **مجهز مستبعد بقرار اللجنة:** يظهر في جدول الدراسة ومعه زر «أسباب الاستبعاد»، ولا يظهر في قائمة قرار الترسية. يثبّته اختبار في المهمة 1، ويُعايَن في المهمة 2.

---

### المهمة 0: دمج master في الفرع
الفرع متأخر 24 commit عن master (v1.28.0 حتى v1.28.6). ويُتوقع تعارض في `ExecutiveSummaryView.tsx` و`App.tsx` و`CLAUDE.md`، لأن v1.28.3 أزال الزر الثالث «جدول العرض الموزون» وغيّر «تصدير Excel» إلى `buildTenderWorkbook`.

- [ ] **الخطوة 1:** شغّل `git merge master`.
- [ ] **الخطوة 2:** حلّ التعارضات. ما أضافه master من وظائف يبقى، وما أضافه الفرع من واجهة يبقى. الزر الثالث يبقى محذوفاً كما في master.
- [ ] **الخطوة 3:** شغّل `npm run build` ثم `npm run check`. المطلوب: نجاح البناء، وعدد الاختبارات الناجحة لا يقل عن عدد master (225) مع اختبارات الفرع، وصفر فشل.
- [ ] **الخطوة 4:** commit الدمج.

### المهمة 1: دالة `evaluateBids` النقية
**الملفات:**
- إنشاء: `src/utils/bidEvaluation.ts`
- إنشاء: `checks/bidEvaluation.test.ts`
- تعديل: `src/components/ExecutiveSummaryView.tsx` (أسطر 51–110 قبل الدمج) ليستعمل الدالة.

**الواجهات:**
- **تعتمد على:** `hasBidAmounts` و`hasNoEstimate` و`exclusionThresholdOf` من `recommendation.ts`، و`exclusionLabels`، و`assessBalance` و`correctedBalanceRows` و`isOfferFinal` و`UNBALANCED_ITEMS_LIMIT_PERCENT`، و`formatPercent`.
- **تنتج:**
```ts
export type CommercialStatus = 'recommended' | 'qualified' | 'excluded' | 'pending';
export type EvaluatedBid = Bidder & { commercialStatus: CommercialStatus; commercialReason: string; unbalancedItems: boolean; diff: number };
/** العطاءات ذوات المبالغ وحدها، مرتبة: المستبعد في الأسفل، ثم الأقل مبلغاً (totals.totalBidderAmount) */
export function evaluateBids(project: TenderProject): EvaluatedBid[];
```

- [ ] **الخطوة 1:** اكتب الاختبارات. ابنِ المشاريع بطريقة `setup` في `checks/tenderPath.test.ts`، أي `createNewTenderProject` ثم `calculateBOQMetrics`:
  - `'الشركة بلا مبالغ لا تدخل التقييم'`: طول النتيجة يساوي عدد العطاءات ذوات المبالغ.
  - `'المستبعد في الأسفل ثم الأقل مبلغاً'`: ثلاث شركات، والأقل مبلغاً `disqualified`، فترتيب المعرّفات [الثاني الأقل، الثالث، المستبعد].
  - `'المستبعد بقرار اللجنة'`: `commercialStatus === 'excluded'`، و`commercialReason` يبدأ بـ `'مستبعد بقرار اللجنة'`.
  - `'قبل الكلفة التخمينية'`: كل الشركات غير المستبعدة `pending`، وسببها `'بانتظار الكلفة التخمينية: لا يُحكم بالانحراف ولا بالتوازن قبل إدخالها'`.
  - `'تجاوز حد الاستبعاد'`: انحراف كلي 30% وحد 20 يعطي `excluded`، والسبب يبدأ بـ `'مستبعد تجارياً: تجاوز الانحراف الإجمالي'`.
- [ ] **الخطوة 2:** شغّل `npm run check`. المطلوب: فشل الاختبارات الجديدة لأن الملف غير موجود.
- [ ] **الخطوة 3:** انقل منطق `evaluatedBidders` و`sortedBidders` حرفياً إلى `evaluateBids`، واجعل `ExecutiveSummaryView` يستدعيها. لا تغيير في نص أي سبب.
- [ ] **الخطوة 4:** شغّل `npm run check` ثم `npm run build`. المطلوب: نجاح الكل.
- [ ] **الخطوة 5:** commit برسالة `evaluateBids: تقييم العطاءات تجارياً في دالة نقية مشتركة`.

### المهمة 2: مكوّنا `StudyView` و`RecommendationView`
**الملفات:**
- إنشاء: `src/components/StudyView.tsx` و`src/components/RecommendationView.tsx`
- حذف: `src/components/ExecutiveSummaryView.tsx`
- تعديل: `src/App.tsx` (فرع `activeTab === 'analysis'`)

**الواجهات:**
- **تعتمد على:** `evaluateBids` من المهمة 1.
- **تنتج:**
```ts
interface StudyViewProps { project: TenderProject; onOpenExclusionReasons: (id: string) => void; onOpenAudit: () => void;
  onOpenMatrix: () => void; chartsOpen: boolean; onToggleCharts: () => void }
interface RecommendationViewProps { project: TenderProject; onSelectBidder: (id: string) => void;
  onUpdateBidderStatus: (id: string, status: Bidder['status']) => void; onOpenPrint: () => void; onExportExcel: () => void }
```

- [ ] **الخطوة 1:** ابنِ `StudyView`. عنوان الشريط `دراسة العطاءات وتحليلها`، وشارته `الدراسة والتحليل`، ووصفه السطر الحالي (سطر 145) كما هو. فيه بالترتيب:
  1. زرا «👥 مقارنة المجهزين» و«📊 الرسوم».
  2. شبكة الأرقام الأربعة.
  3. مؤشر الأخطاء التي لم تُعالج.
  4. جدول المقارنة، بلا عمود «قرار اللجنة»، وعنوانه `مقارنة العطاءات تجارياً`، ووصفه `مرتبة من الأوطأ مبلغاً، والمستبعد في الأسفل`.
  5. سطر الشركات بلا مبالغ.
  6. بطاقة «أثر التصحيح الحسابي على الترتيب».

  وتلوين صف الموصى به (`isRec`) يبقى كما هو.
- [ ] **الخطوة 2:** ابنِ `RecommendationView`. عنوان الشريط `التوصية بالإحالة والمحضر`. فيه بالترتيب:
  1. زرا «معاينة المحضر وطباعته» (الرئيسي) و«تصدير Excel».
  2. لافتة `decisionSensitivity`.
  3. كتلة نص التوصية بكل فروعها (أسطر 436–509 قبل الدمج) حرفياً، ومعها زر «اعتماد الترسية على هذا العطاء».
  4. جدول «قرار اللجنة». صفوفه من `evaluateBids(project)`، مقصورة على ما `commercialStatus` فيه `'qualified'` أو `'recommended'`. أعمدته: الاسم، والمبلغ (`formatNumber`)، والانحراف الكلي (`formatPercent(…, 2, exclusionThreshold)`)، والموقف التجاري (`مؤهل ومتوازن` أو `مؤهل تجارياً`)، وزر `اختيار للترسية` أو `★ مُوصى به` بالسلوك الحالي (سطر 403–415).
  5. تحت الجدول سطر `العطاءات المستبعدة (n) معروضة في «الدراسة والتحليل»`، يظهر حين n > 0.

  وقبل الكلفة التخمينية لا يظهر الجدول، ويبقى نص `rec.kind === 'no-estimate'`.
- [ ] **الخطوة 3:** في `App.tsx` اعرض `StudyView` ثم `RecommendationView` مكان `ExecutiveSummaryView` في فرع `'analysis'`. هذا وضع مؤقت إلى المهمة 4، و`ChartsView` يبقى تحت `StudyView`. ثم احذف `ExecutiveSummaryView.tsx`.
- [ ] **الخطوة 4:** شغّل `npm run build` و`npm run check` و`npm run lint`. المطلوب: نجاح الكل، ولا تحذير جديد.
- [ ] **الخطوة 5:** معاينة بالمتصفح (`npm run dev`) على مناقصة تجريبية فيها: مجهز مستبعد بقرار اللجنة، ومجهز فوق 20%، وواحد مؤهل. المطلوب:
  - المستبعدان في جدول الدراسة.
  - المؤهل وحده في جدول القرار.
  - مناقصة بلا كلفة تخمينية لا تعرض أزرار ترسية.
- [ ] **الخطوة 6:** commit برسالة `تقسيم الخلاصة: الدراسة والتحليل، والتوصية والمحضر`.

### المهمة 3: نافذة الموقف وزرّها في الرأس
**الملفات:**
- إنشاء: `src/components/modals/StatusWindow.tsx`
- تعديل: `src/utils/orderStatus.ts`، و`checks/orderStatus.test.ts`، و`src/components/ProjectHeader.tsx` (أسطر 94–99)، و`src/App.tsx`

**الواجهات:**
- **تنتج:**
```ts
// orderStatus.ts
/** نص زر الموقف في الرأس */
export function statusBadgeText(log: StatusEntry[] | undefined): string;
// StatusWindow.tsx
interface StatusWindowProps { isOpen: boolean; onClose: () => void; project: TenderProject;
  onAdd: (input: StatusInput) => string | null; onEdit: (id: string, input: StatusInput) => string | null;
  onDelete: (id: string) => void; onOpenSheet: () => void; onDirtyChange: (dirty: boolean) => void }
// ProjectHeader: خاصية جديدة
onOpenStatus: () => void;
```

- [ ] **الخطوة 1:** اكتب الاختبار `'نص زر الموقف'`:
  - `statusBadgeText(undefined)` و`statusBadgeText([])` تعطيان `'الموقف: لم يُسجَّل'`.
  - مع سجل: `'الموقف: ' + statusLine(آخر مدخل في المصفوفة)`.
  - مدخل `statusLine` له فارغ يعطي `'الموقف: غير محدد'`.
- [ ] **الخطوة 2:** شغّل `npm run check`. المطلوب: فشل الاختبار الجديد.
- [ ] **الخطوة 3:** نفّذ `statusBadgeText`. شغّل `npm run check`، والمطلوب: نجاحه.
- [ ] **الخطوة 4:** ابنِ `StatusWindow` بنمط النوافذ القائمة: غطاء، و`role="dialog"`، و`aria-modal="true"`، و`aria-labelledby` على عنوانه `موقف الطلبية`، وزر إغلاق.
  - تعرض `<OrderStatusPanel key={project.id} …/>`.
  - تمرّر `onDirtyChange` إلى الأعلى، وتحفظ القيمة محلياً أيضاً.
  - Escape وزر الإغلاق وزر «كشف الموقف» يمرّ كلها بدالة واحدة `requestClose(then?: () => void)`. هذه الدالة تسأل `window.confirm('في نموذج الموقف ما لم يُحفظ. أتغلق النافذة دونه؟')` حين يكون فيها تعديل غير محفوظ، ثم تغلق.
  - زر «كشف الموقف» يغلق النافذة ثم يستدعي `onOpenSheet`.
- [ ] **الخطوة 5:** في `ProjectHeader` حوّل الشارة إلى `<button type="button" aria-haspopup="dialog" onClick={onOpenStatus}>`، بنصّ `statusBadgeText(currentProject.statusLog)` وألوانها الحالية، تظهر دائماً.
- [ ] **الخطوة 6:** في `App.tsx`:
  - أضف `const [isStatusOpen, setIsStatusOpen] = useState(false)`.
  - اعرض `StatusWindow` بمعالجات `OrderStatusPanel` الحالية (أسطر 425–433).
  - مرّر `onOpenStatus={() => setIsStatusOpen(true)}`.
  - `isStatusDirty` في `blockingWork` يبقى كما هو.
  - تبويب `'status'` يبقى إلى المهمة 4.
- [ ] **الخطوة 7:** شغّل `npm run build` و`npm run check`. المطلوب: نجاح الكل.
- [ ] **الخطوة 8:** معاينة يدوية لبندي التركيز 2 و3:
  - اكتب في النموذج ثم اضغط Escape: يظهر السؤال.
  - بدّل المناقصة والنافذة مفتوحة: يتغير السجل.
- [ ] **الخطوة 9:** commit برسالة `الموقف: زر في رأس المناقصة يفتح سجله في نافذة`.

### المهمة 4: معرّفات التبويبات الجديدة وإزالة تبويب الموقف
**الملفات:**
- تعديل: `src/resume.ts`، و`checks/resume.test.ts`، و`src/utils/tenderPath.ts`، و`checks/tenderPath.test.ts` (الأسطر 116 و143 و151–152)، و`src/components/ProjectHeader.tsx` (`TABS`)، و`src/App.tsx` (`handleGo`، والعرض، و`showNextStep`)، و`CLAUDE.md`

**الواجهات:**
- **تنتج:**
```ts
export type ResumeTab = 'bids' | 'study' | 'recommendation';
export type NextStepTarget = 'bids' | 'importEstimate' | 'audit' | 'recommendation' | 'status';
```
  و`'status'` في `NextStepTarget` معناه فتح النافذة، لا تبويب.

- [ ] **الخطوة 1:** عدّل الاختبارات أولاً:
  - `normalizeResumeTab`: `'bids'` و`'study'` و`'recommendation'` تبقى كما هي. `'analysis'` و`'summary'` و`'charts'` تعطي `'study'`. `'status'` تعطي `'recommendation'`. `'table'` تعطي `'bids'`. وما سواها يعطي `'bids'`.
  - `nextStep`: خطوة `award` تعطي `[{ label: 'الانتقال إلى التوصية والمحضر', target: 'recommendation' }]`. وخطوة `report` تعطي `[{ label: 'فتح المحضر', target: 'recommendation' }, { label: 'تسجيل الموقف', target: 'status' }]`.
- [ ] **الخطوة 2:** شغّل `npm run check`. المطلوب: فشل الاختبارات المعدّلة.
- [ ] **الخطوة 3:** عدّل `resume.ts` و`tenderPath.ts` بحسب الاختبارات.
- [ ] **الخطوة 4:** عدّل `TABS` بحسب جدول التصميم: `bids` «العطاءات والتدقيق» «ماذا قدّم كل مجهز؟»، و`study` «الدراسة والتحليل» «كيف تقارن العطاءات؟»، و`recommendation` «التوصية والمحضر» «بماذا توصي اللجنة؟». اختر أيقونة للدراسة من lucide (مثل `BarChart3`)، و`Award` للتوصية.
- [ ] **الخطوة 5:** في `App.tsx`:
  - `'study'` يعرض `StudyView` و`ChartsView`، و`'recommendation'` يعرض `RecommendationView`.
  - احذف فرع `OrderStatusPanel`.
  - `showNextStep` يصير دائماً `true` (أو تُحذف الخاصية).
  - `handleGo`: `'recommendation'` تعني `setActiveTab('recommendation')`، و`'status'` تعني `setIsStatusOpen(true)`.
- [ ] **الخطوة 6:** ابحث بـ `grep` في `src` عن `'analysis'` و`'status'` بوصفهما تبويباً. لا يبقى استعمال لهما بهذا المعنى. أما `stage: 'analysis'` في الموقف فمعنى آخر، يبقى.
- [ ] **الخطوة 7:** في `CLAUDE.md` حدّث وصف التبويبات بسطرين: الثلاثة وأسماؤها، والموقف زر في الرأس يفتح `StatusWindow`، و`evaluateBids` مصدر التقييم المشترك.
- [ ] **الخطوة 8:** شغّل `npm run build` و`npm run check` و`npm run lint`. المطلوب: نجاح الكل.
- [ ] **الخطوة 9:** معاينة بالمتصفح على عرض 1400 و1024 و700:
  - التبويبات الثلاثة.
  - زر الموقف لا يتراكب على غيره.
  - شريط «الخطوة التالية» يفتح الهدف الصحيح في كل حالة.
- [ ] **الخطوة 10:** commit برسالة `التبويبات بمراحل عمل اللجنة: العطاءات والتدقيق، الدراسة والتحليل، التوصية والمحضر`.

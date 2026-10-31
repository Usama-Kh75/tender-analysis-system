# موقف الطلبيات — خطة التنفيذ

> **للمنفّذ:** استعمل superpowers:subagent-driven-development (الموصى به) أو superpowers:executing-plans. الخطوات بصيغة `- [ ]`.

**الهدف:** تسجيل موقف كل طلبية (إجراء، فرع، رقم المذكرة وتاريخها) وتاريخ استلامها، وكشف رسمي «موقف الطلبيات» للطباعة والتصدير إلى Excel.

**المعمارية:** منطق نقي في `src/utils/orderStatus.ts` (أنواع، قوائم، تنظيف، بناء صفوف الكشف) يستعمله الإدخال والطباعة وExcel. معالجات التحرير في `src/app/statusHandlers.ts` بالنمط نفسه لبقية المعالجات (مصنع يأخذ `ctx`). نافذتان جديدتان: «موقف الطلبية» (إدخال) و«كشف الموقف» (معاينة وطباعة). لا حساب في النظام يتأثر.

**التقنية:** React 19 + TypeScript + Tailwind v4، `xlsx-js-style`، فحوص `checks/*.test.ts` عبر `npm run check`.

**المواصفة:** `docs/superpowers/specs/2026-11-01-order-status-design.md` (اقرأها كاملة، وملف `CLAUDE.md` للمشروع).

## القيود العامة
- ملف HTML واحد محمول، بلا اعتماديات جديدة ولا خادم.
- الكشف عرض لما هو محفوظ في كل مناقصة، بلا مجاميع ولا مقارنات بين الطلبيات. المناقصة المحذوفة لا تظهر فيه.
- الكشف وثيقة رسمية: **بلا توقيع المهندس أسامة**.
- كل معالج يغيّر مناقصة يحدّث `updatedAt` (استعمل `addAuditLog`، فهو يحدّثه).
- التواريخ تُخزَّن `YYYY-MM-DD` وتُعرض `DD/MM/YYYY` بأرقام لاتينية. التاريخ الافتراضي من `localDate()` (`src/utils/localDate.ts`) لا من UTC.
- «لجنة المراجعة» هو الاسم المعتمد في الواجهة والكشف.
- النصوص والتعليقات بالعربية كما في المشروع. لا `commit` ولا نشر ولا تغيير `package.json` قبل أن يطلب أسامة.
- ملفات الشجرة غير المنشورة من تعديل «الإعلان» (`NewProjectModal` و`ProjectSettingsModal` و`ProjectHeader` و`ProjectsBrowserModal` و`tenderDetails` و`storageService` و`projectHandlers`) موجودة، فابنِ فوقها ولا تعدها.

## تركيز المراجعة
1. نسخة احتياطية أو localStorage فيها `statusLog` غير مصفوفة، أو عناصر ناقصة (بلا `memoDate`، `stage` مجهول): تُنظَّف ولا يتعطل التحميل. (Task 1)
2. فرع لا يتبع إجراءه (مثل `negotiation` تحت `analysis`): يُسقَط الفرع. (Task 1)
3. «إجراء آخر» بلا نص: يُرفض عند الإدخال. (Task 1، Task 3)
4. تاريخ فارغ أو غير صالح في الكشف: خانة فارغة لا «NaN». (Task 1)
5. طلبية عنوانها أو رقمها فارغ، أو بلا تاريخ استلام: صف سليم، وتأتي في آخر الكشف. (Task 1)
6. حذف كل إدخالات الموقف: الشارة تعود «حدد الموقف» ويبقى الصف في الكشف بخانة موقف فارغة. (Task 1، Task 3)

---

### Task 1: منطق الموقف والكشف (نقي، بفحوص)

**Files:**
- Modify: `src/types/tender.ts` (أضف الأنواع وحقلين على `TenderProject` قرب `announcementNo`)
- Create: `src/utils/orderStatus.ts`
- Create: `checks/orderStatus.test.ts`
- Modify: `src/utils/storageService.ts` (نظّف `statusLog` عند التحميل: ابحث عن `normalizeLoadedProject` وطبّق `sanitizeStatusLog`)

**Interfaces:**
- Produces (types في `tender.ts`):
  ```ts
  export type StatusStage = 'analysis' | 'audit' | 'returnedFromAudit' | 'reviewCommittee' | 'sentToContracts' | 'readvertise' | 'other';
  export type StatusBranch = 'technical' | 'commercial' | 'documents' | 'negotiation';
  export interface StatusEntry { id: string; stage: StatusStage; branch?: StatusBranch; customText?: string;
    memoNo?: string; memoDate: string; note?: string; recordedAt: string }
  // على TenderProject: receivedAt?: string; statusLog?: StatusEntry[];
  ```
- Produces (`orderStatus.ts`):
  - `STAGE_ORDER: StatusStage[]` بالترتيب: analysis, audit, returnedFromAudit, reviewCommittee, sentToContracts, readvertise, other.
  - `STAGE_LABELS: Record<StatusStage, string>`: «قيد التحليل»، «لدى قسم الرقابة والتدقيق الداخلي»، «معادة من التدقيق إلى اللجنة»، «لدى لجنة المراجعة»، «أُرسلت إلى العقود»، «إعادة إعلان»، «إجراء آخر».
  - `BRANCHES_OF: Record<StatusStage, StatusBranch[]>`: analysis → technical, commercial, documents؛ reviewCommittee → negotiation؛ البقية فارغة.
  - `BRANCH_LABELS: Record<StatusBranch, string>`: «بانتظار نتيجة التحليل الفني من الجهة الطالبة»، «التحليل التجاري»، «استكمال الوثائق (مخاطبة المشتريات المحلية)»، «قيد التفاوض».
  - `statusText(e: StatusEntry): string`: `other` → `customText`؛ غيره → التسمية، ومعها «: الفرع» إن وُجد.
  - `validateStatusEntry(e: Pick<StatusEntry,'stage'|'branch'|'customText'|'memoDate'>): string | null`: رسالة عربية عند `other` بلا نص، أو فرع لا يتبع الإجراء، أو `memoDate` ليس تاريخاً صالحاً؛ وإلا `null`.
  - `sanitizeStatusLog(raw: unknown): StatusEntry[]`: غير المصفوفة → `[]`؛ يُسقط العنصر الذي `stage` فيه مجهول أو `memoDate` غير صالح؛ يُسقط الفرع الذي لا يتبع الإجراء ويُبقي العنصر؛ يحافظ على الترتيب.
  - `currentStatus(p: TenderProject): StatusEntry | undefined`: **آخر** عنصر في المصفوفة.
  - `formatSheetDate(iso?: string): string`: `DD/MM/YYYY`، وخانة فارغة لقيمة غير صالحة.
  - `interface StatusSheetRow { no: number; referenceNumber: string; title: string; announcement: string; receivedAt: string; action: string; memoNo: string; date: string; note: string }`
  - `statusSheetRows(projects: TenderProject[]): StatusSheetRow[]`: ترتيب بتاريخ الاستلام الأقدم، وبلا تاريخ في الآخر، وعند التساوي برقم الطلبية (`localeCompare` بـ`numeric: true`)؛ `no` يبدأ من 1 بعد الترتيب؛ `announcement` من `announcementLabel`؛ المواقف الفارغة تعطي نصوصاً فارغة.

- [ ] **Step 1: اكتب `checks/orderStatus.test.ts` أولاً** (نمط `checks/legacyBudgetType.test.ts`، والمناقصات من `createNewTenderProject`). الفحوص بأسمائها:
  - `الفرع يُطبع مع أصله`: `statusText({stage:'analysis', branch:'commercial',…})` يساوي «قيد التحليل: التحليل التجاري».
  - `إجراء آخر يُطبع بنصه`: `statusText({stage:'other', customText:'كتاب إلى الوزارة',…})` يساوي النص نفسه.
  - `الموقف الحالي هو آخر إدخال لا الأحدث تاريخاً`: إدخالان، الأخير بتاريخ أقدم، `currentStatus` يرجع الأخير.
  - `إجراء آخر بلا نص يُرفض` و`فرع لا يتبع إجراءه يُرفض` و`تاريخ غير صالح يُرفض`: `validateStatusEntry` غير `null` بنص عربي.
  - `التنظيف يتجاوز الفاسد ولا يتعطل`: `sanitizeStatusLog('x')` و`sanitizeStatusLog(null)` و`[{stage:'zzz'},{stage:'analysis',memoDate:''}]` تعطي `[]`؛ وعنصر `analysis` بفرع `negotiation` يبقى بلا فرع.
  - `ترتيب الكشف`: ثلاث مناقصات (استلام 10/10 وأقدم منه وبلا استلام) يرتّبها كما في المواصفة، وترقيم `no` 1..3؛ وتساوي الاستلام يُحسم برقم الطلبية.
  - `صف سليم لعنوان ورقم فارغين وبلا موقف`: لا يرمي، والخانات فارغة.
  - `formatSheetDate('2026-10-05')` = `05/10/2026` و`formatSheetDate('')` و`formatSheetDate('x')` = `''`.
- [ ] **Step 2: شغّل** `npm run check -- orderStatus`. المتوقع: الفشل (الملف غير موجود).
- [ ] **Step 3: نفّذ الأنواع و`orderStatus.ts`** بالتواقيع أعلاه. تاريخ صالح = نص `YYYY-MM-DD` يُقرأ بـ`Date` ولا يعطي `NaN` ويطابق تنسيقه نفسه عند إعادة كتابته.
- [ ] **Step 4: ثبّت التنظيف عند التحميل** في `normalizeLoadedProject` (`storageService.ts`): `statusLog` يمر على `sanitizeStatusLog`، و`receivedAt` غير الصالح يصير `undefined`. لا تغيّر باقي المناقصة، ولا تضف سطراً إلى سجل التدقيق.
- [ ] **Step 5: شغّل** `npm run check`. المتوقع: كل الفحوص تنجح (92 السابقة + الجديدة)، ثم `npm run build`.

---

### Task 2: تاريخ الاستلام (الإنشاء والإعدادات)

**Files:**
- Modify: `src/utils/storageService.ts` (`createNewTenderProject`)
- Modify: `src/app/projectHandlers.ts` (`handleCreateProject`)
- Modify: `src/components/modals/NewProjectModal.tsx`
- Modify: `src/components/modals/ProjectSettingsModal.tsx`
- Modify: `src/app/bidderHandlers.ts` (`handleSaveSettings`)
- Test: `checks/orderStatus.test.ts` (أضف)

**Interfaces:**
- Consumes: `StatusEntry` و`localDate`.
- Produces: `createNewTenderProject` يقبل `receivedAt?: string`؛ إن وُجد صالحاً يضعه ويُنشئ `statusLog: [{ id, stage: 'analysis', memoDate: receivedAt, recordedAt: <now ISO> }]` (بلا فرع ولا مذكرة). `onCreate` في `NewProjectModal` يمرر `receivedAt: string`.

- [ ] **Step 1: أضف الفحص** `المناقصة الجديدة بتاريخ استلام تبدأ بقيد التحليل بتاريخه` و`بلا تاريخ استلام لا موقف ولا خطأ`، ثم شغّله وتأكد أنه يفشل.
- [ ] **Step 2: نفّذ** في `createNewTenderProject` و`handleCreateProject` (يمرر الحقل)، ثم شغّل الفحص حتى ينجح.
- [ ] **Step 3: `NewProjectModal`:** حقل `<input type="date">` عنوانه «تاريخ الاستلام» بجانب رقم الطلبية والإعلان، حالته الابتدائية `localDate()` ويعود إليها في `close()`؛ يُمرَّر في `onCreate`.
- [ ] **Step 4: `ProjectSettingsModal`:** حقل «تاريخ الاستلام» في الشبكة نفسها، يُحمَّل من `project.receivedAt`، ويُمرَّر في `onSaveSettings` (`receivedAt` أو `undefined` عند المسح).
- [ ] **Step 5: `handleSaveSettings`:** أضف `detailChange('تاريخ الاستلام', formatSheetDate(old), formatSheetDate(new))` إلى نص سجل التدقيق. تعديل الاستلام **لا** يمس `statusLog`.
- [ ] **Step 6: شغّل** `npm run check` و`npm run build` و`npm run lint` (تحذير `SmartTableImportModal.tsx:89` قديم، يُتجاهل).

---

### Task 3: إدخال الموقف (معالجات، نافذة، شارة الرأس)

**Files:**
- Create: `src/app/statusHandlers.ts`
- Create: `src/components/modals/OrderStatusModal.tsx`
- Modify: `src/components/ProjectHeader.tsx` (شارة بجانب شارة الإعلان، وخاصية `onOpenStatus: () => void`)
- Modify: `src/App.tsx` (حالة `isStatusOpen`، المعالجات، النافذة، و`blockingWork` فيه `isStatusOpen ? 'موقف الطلبية'`)
- Test: `checks/statusHandlers.test.ts`

**Interfaces:**
- Consumes: من `ctx` (`createEditContext`): `saveProject`، ومن `orderStatus.ts`: `validateStatusEntry`، `statusText`، `currentStatus`، `STAGE_ORDER`، `STAGE_LABELS`، `BRANCHES_OF`، `BRANCH_LABELS`.
- Produces: `createStatusHandlers(ctx)` يرجع:
  ```ts
  type StatusInput = Omit<StatusEntry, 'id' | 'recordedAt'>;
  handleAddStatus(input: StatusInput): string | null      // رسالة خطأ أو null عند النجاح
  handleEditStatus(id: string, input: StatusInput): string | null
  handleDeleteStatus(id: string): void
  ```
  كل منها يمر على `validateStatusEntry` (ما عدا الحذف)، ويبني المناقصة الجديدة من `currentProject` وقت العرض، ثم `addAuditLog` برسالة عربية تذكر الإجراء والمذكرة والتاريخ (والقيم القديمة عند التعديل/الحذف)، ثم `saveProject`. الإضافة تُلحق في **آخر** المصفوفة. `OrderStatusModal` props: `{ isOpen, onClose, project, onAdd, onEdit, onDelete }`.

- [ ] **Step 1: اكتب `checks/statusHandlers.test.ts`** بنمط `checks/importHandlers.test.ts` (`saveProject` ملتقط):
  - `إضافة موقف تلحقه آخراً وتسجل في سجل التدقيق وتحدّث updatedAt`.
  - `إضافة موقف غير صالح (إجراء آخر بلا نص) ترجع رسالة ولا تحفظ`.
  - `تعديل موقف يغيّر عنصره وحده ويسجل القديم والجديد`.
  - `حذف آخر موقف يجعل السابق هو الحالي`، و`حذف الكل يعطي currentStatus غير معرّف`.
  شغّله وتأكد أنه يفشل.
- [ ] **Step 2: نفّذ `createStatusHandlers`** بالتواقيع أعلاه، ثم شغّل الفحص حتى ينجح.
- [ ] **Step 3: `OrderStatusModal`** (قالب `NewProjectModal` لهيئة النافذة): في الأعلى نموذج إضافة: قائمة الإجراء (`STAGE_ORDER`)، وقائمة فرع اختيارية تظهر حين يكون للإجراء فروع، وحقل «النص» حين يكون `other`، وحقل «رقم المذكرة» (اختياري، نصي)، وحقل «تاريخ المذكرة أو الإجراء» (`type="date"`، ابتداؤه `localDate()`)، وحقل ملاحظة اختياري. تحته سجل المواقف الأحدث أولاً، لكل صف نصه (`statusText`) ورقم المذكرة وتاريخها (`formatSheetDate`) وزرا «تعديل» (يعبّئ النموذج) و«حذف» (بتأكيد `window.confirm`). رسالة الخطأ من المعالج تظهر في النافذة نفسها. حالة فارغة: «لم يُسجَّل موقف لهذه الطلبية بعد». الانتباه لإمكانية الوصول: كل حقل بـ`label htmlFor`، والأزرار `<button>` حقيقية.
- [ ] **Step 4: الشارة في `ProjectHeader`:** زر بجانب شارة الإعلان نصه `statusText(currentStatus(project))` أو «حدد الموقف»، ينادي `onOpenStatus`، وتلوينه كشارة الإعلان.
- [ ] **Step 5: `App.tsx`:** اربط الحالة والمعالجات والنافذة (بـ`key={`${currentProject.id}-${isStatusOpen}`}` كما في الإعدادات) و`blockingWork`.
- [ ] **Step 6: شغّل** `npm run check` و`npm run build` و`npm run lint`.

---

### Task 4: كشف الموقف (معاينة، طباعة، Excel، الزر)

**Files:**
- Create: `src/components/modals/StatusSheetModal.tsx`
- Create: `src/utils/statusSheetExcel.ts`
- Modify: `src/components/modals/ProjectsBrowserModal.tsx` (زر وخاصية `onOpenStatusSheet`)
- Modify: `src/App.tsx` (حالة `isStatusSheetOpen` والنافذة، ويُغلق المتصفح عند فتحها)
- Test: `checks/orderStatus.test.ts` (أضف فحص Excel)

**Interfaces:**
- Consumes: `statusSheetRows(projects)`، `formatSheetDate`، `localDate`.
- Produces: `buildStatusSheetWorkbook(rows: StatusSheetRow[], asOf: string): XLSX.WorkBook` و`exportStatusSheetToExcel(rows, asOf): void` (يكتب `موقف الطلبيات.xlsx` بـ`XLSX.writeFile`). `StatusSheetModal` props: `{ isOpen, onClose, projects }`.

- [ ] **Step 1: أضف الفحص** `ورقة Excel: العنوان والرأس والصفوف` (من `buildStatusSheetWorkbook`): ورقة واحدة، أول خلية فيها «موقف الطلبيات لغاية 01/11/2026» للتاريخ المعطى، صف الرأس بالأعمدة بالترتيب: ت، رقم الطلبية، الموضوع، الإعلان، تاريخ الاستلام، الإجراء، رقم المذكرة، التاريخ، الملاحظات، وعدد صفوف البيانات يساوي عدد الصفوف المعطاة. شغّله وتأكد أنه يفشل.
- [ ] **Step 2: نفّذ `statusSheetExcel.ts`** بأسلوب `bidderAuditExcel.ts` (Arial، رأس أبيض غامق على `1F4E78`، حدود رفيعة، `wb.Workbook = { Views: [{ RTL: true }] }`، عنوان مدموج). عمود «الموقف» في الكشف المطبوع رأس من ثلاثة أعمدة فرعية (الإجراء، رقم المذكرة، التاريخ)؛ وفي Excel تكفي أعمدة منفصلة بتلك الأسماء. بلا توقيع. شغّل الفحص حتى ينجح.
- [ ] **Step 3: `StatusSheetModal`:** معاينة بالنمط نفسه الذي يطبع به `PrintReportModal` (بوابة بصنف `print-report-portal`، وأزرار شريط `no-print`، و`window.print()`). الأعلى حقل «تاريخ الكشف» (ابتداؤه `localDate()` ويُعدَّل قبل الطباعة) والعنوان «موقف الطلبيات لغاية DD/MM/YYYY». الجدول بالأعمدة: ت، رقم الطلبية، الموضوع، الإعلان، تاريخ الاستلام، **الموقف** (رأس مدموج يضم: الإجراء، رقم المذكرة، التاريخ)، الملاحظات. صفحة أفقية للطباعة (`@page { size: A4 landscape }` داخل نمط المعاينة). بلا توقيع. زر «تصدير Excel». حالة فارغة: «لا طلبيات محفوظة».
- [ ] **Step 4: الزر والربط:** زر «كشف الموقف» في رأس `ProjectsBrowserModal` بجانب «تصدير التوصيات المعدّلة»، ينادي `onOpenStatusSheet`، ويربطه `App.tsx` (يغلق نافذة المناقصات ويفتح الكشف).
- [ ] **Step 5: شغّل** `npm run check` و`npm run build` و`npm run lint`. ثم شغّل `npm run dev` وعاين يدوياً: إنشاء مناقصة بتاريخ استلام، وتسجيل موقفين (أحدهما بمذكرة)، وفتح الكشف وطباعته إلى PDF من المتصفح (أفقي، بلا توقيع)، وتصدير Excel وفتحه. أبلغ بما عاينته وما لم تستطع.

---

### Task 5: التوثيق وما الجديد

**Files:**
- Modify: `src/changelog.ts` (سطر في أعلى `CHANGELOG`)
- Modify: `CLAUDE.md` (فقرة قصيرة بالإنجليزية في «Architecture»)
- Modify: `docs/superpowers/specs/2026-11-01-order-status-design.md` (الحالة: منفَّذ، غير منشور)

- [ ] **Step 1:** في `src/changelog.ts` أضف في أعلى `CHANGELOG` مدخلاً بصيغة الإضافة التي تغيّر الاستعمال (يُطابق شكل المدخلات الموجودة، **بلا رقم إصدار جديد**، فرقمه يحدده أسامة عند النشر): «تسجيل موقف كل طلبية برقم المذكرة وتاريخها، وطباعة كشف موقف الطلبيات أو تصديره إلى Excel». لا تذكر إصلاحات ولا تحسينات.
- [ ] **Step 2:** في `CLAUDE.md` فقرة (إنجليزية، نمط الفقرات المجاورة): حقول `receivedAt` و`statusLog`، و`orderStatus.ts` مصدراً وحيداً للقوائم والكشف، وأن الموقف الحالي آخر إدخال لا الأحدث تاريخاً، وأن الكشف بلا توقيع وبلا مجاميع، وأن المحذوفة لا تظهر فيه، وأن المعالجات تعيد رسالة خطأ بدل رمي استثناء، وأن النافذتين تدخلان في `blockingWork` (الإدخال فقط).
- [ ] **Step 3:** شغّل `npm run build` و`npm run lint` و`npm run check` وأبلغ بنتائجها الفعلية. **لا commit ولا tag ولا نشر**: يعاين أسامة الواجهة مع تعديل «الإعلان» أولاً، وبعد موافقته يُنشأ إصدار واحد.

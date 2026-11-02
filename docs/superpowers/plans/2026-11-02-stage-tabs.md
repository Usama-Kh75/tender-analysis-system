# تبويبات العمل (الإصدار الأول) — خطة التنفيذ

> **للمنفّذ:** استعمل superpowers:subagent-driven-development (الموصى به) أو superpowers:executing-plans. الخطوات بصيغة `- [ ]`.

**الهدف:** ثلاثة تبويبات في الشريط العلوي («العطاءات»، «التحليل والتوصية»، «الموقف»)، وسطر «الموقف + مسار المناقصة» تحت العنوان، وبطاقات الشركات، وعرض تدقيق على الجدول نفسه تنتقل إليه أزرار قرارات اللجنة.

**المعمارية:** ثلاث وحدات نقية جديدة مع فحوصها (`tenderPath.ts`، `tableFilters.ts`، و`asSubmitted` في `bidderAuditEngine.ts`)، تبني عليها مكونات صغيرة جديدة (`MoreMenu`، `TenderPathLine`، `BidderCards`، `AuditCell`، `OrderStatusPanel`). `BOQTable` يصير عرضين على الجدول نفسه (`auditMode`). `App.tsx` يبقى مالك الحالة. لا تتغير بيانات المناقصة ولا أي حساب.

**التقنية:** React 19 + TypeScript + Tailwind v4، `lucide-react`، فحوص `checks/*.test.ts` عبر `npm run check`.

**المواصفة:** `docs/superpowers/specs/2026-11-02-stage-tabs-and-tracker-design.md`، قسم «الإصدار الأول» وما قبله. اقرأها كاملة، واقرأ `CLAUDE.md` للمشروع. والصورة المرجعية `mockups/stages-v4.html` (محلية).

## القيود العامة
- ملف HTML واحد محمول، بلا اعتماديات جديدة.
- لا تتغير بيانات `TenderProject` ولا `BOQItem`، ولا أي دالة حساب أو توصية. لا تحويل للبيانات المحفوظة.
- لا تُحذف وظيفة: كل زر اليوم ينتقل إلى مكان في التبويبات، إلا قائمة اختيار المناقصة المنسدلة في `Navbar` (قرار في المواصفة).
- الألوان للمعنى في كل ما يُضاف أو يُنقل: أحمر خطأ، كهرماني بانتظار قرار، أخضر مصحَّح أو مكتمل، أزرق الموقف الحالي.
- الشريط العلوي يبقى بارتفاع `h-20` في سطر واحد، فتبقى الإزاحة `81px` في `BOQTable` صحيحة. لا تغيّر هذا الرقم.
- كل عرض فيه عمل غير محفوظ يدخل `blockingWork` في `App.tsx`.
- التوقيع «إعداد المهندس أسامة خليل هاشم» يبقى ظاهراً في الشريط العلوي كما هو.
- النصوص والتعليقات بالعربية كما في المشروع. لا `git tag` ولا نشر قبل أن يعاين أسامة ويطلب.
- بعد كل مهمة: `npm run check` و`npm run build` ينجحان، و`npm run lint` بلا تحذير جديد (تحذير `SmartTableImportModal.tsx:89` قديم).

## تركيز المراجعة
1. عرض موزون فعّال أو معتمد ثم فتح عرض التدقيق: أزرار القرار تُرفض برسالة القفل كما اليوم (`offerLockReason`)، والجدول يعرض مبالغ العرض. لا خطأ ولا شاشة بيضاء. (Task 5)
2. تبديل الشركة وعرض التدقيق مفتوح بمرشح «بانتظار قرار»: تُمسح الفقرات المثبَّتة ويُعاد تثبيت فقرات الشركة الجديدة، فلا تظهر علامة «✓ عولجت» على فقرات شركة أخرى. (Task 2 وTask 5)
3. شركة بلا مبالغ: بطاقتها «لم تُدخل أسعاره»، ولا تدخل عدّ التدقيق في سطر المسار، وزر التدقيق لا يظهر لها. (Task 1 وTask 4 وTask 5)
4. تحديث التطبيق وكان التبويب المحفوظ من النسخة السابقة `summary` أو `charts` أو `table`: يُفتح المقابل الجديد. (Task 3)
5. الشاشة بين 640 و1280 بكسل: التبويبات الثلاثة ظاهرة في الشريط، وأسماؤها تختصر إلى أيقونة وكلمة، ولا يلتف الشريط فيغطي الجدول. (Task 3)

---

### Task 1: حساب سطر المسار وحالة كل شركة

**Files:**
- Create: `src/utils/tenderPath.ts`
- Test: `checks/tenderPath.test.ts`

**Interfaces:**
- Consumes: `hasBidAmounts`, `hasNoEstimate`, `buildRecommendation` من `src/utils/recommendation.ts`؛ `currentStatus`, `statusText` من `src/utils/orderStatus.ts`.
- Produces:
  ```ts
  export type BidderAuditState = { kind: 'empty' } | { kind: 'pending'; count: number } | { kind: 'done' };
  export function bidderAuditState(b: Bidder): BidderAuditState;
  export interface TenderPath {
    status: string | null;                 // statusText(currentStatus(p)) أو null إن لا موقف
    hasEstimate: boolean;                  // !hasNoEstimate(p)
    bids: { entered: number; expected: number };
    audit: { pending: number; firstBidderId: string | null };
    award: { name: string } | null;        // حين rec.chosenByCommittee
  }
  export function tenderPath(p: TenderProject): TenderPath;
  ```

- [ ] **Step 1: اكتب الفحوص الفاشلة** في `checks/tenderPath.test.ts`، ببناء مناقصة من `createNewTenderProject` و`calculateBOQMetrics` كما في `checks/acceptAsReading.test.ts`:
  - `bidderAuditState`: شركة بلا مبالغ ⇐ `{kind:'empty'}`؛ شركة فيها فقرتان `hasMathError` وواحدة `hasTextDiscrepancy` ⇐ `{kind:'pending', count:3}`؛ فقرة فيها العلامتان معاً تُعدّ مرة واحدة؛ لا علامات ⇐ `{kind:'done'}`.
  - `tenderPath.bids`: ثلاث شركات، اثنتان بمبالغ، و`receivedBidsCount` غائب ⇐ `{entered:2, expected:3}`؛ ومع `receivedBidsCount: 4` ⇐ `expected: 4`.
  - `tenderPath.audit`: علامات في شركة بلا مبالغ لا تُعدّ؛ `firstBidderId` أول شركة بترتيب `bidders` فيها فقرات معلّقة، و`null` حين لا شيء.
  - `tenderPath.award`: قبل اختيار اللجنة `null`؛ بعد `status: 'recommended'` على شركة ⇐ `{name}` باسمها.
  - `tenderPath.status`: بلا `statusLog` ⇐ `null`؛ بإدخال `analysis/commercial` ⇐ النص نفسه الذي يعطيه `statusText`.
- [ ] **Step 2:** `npm run check` ⇐ تفشل لأن الملف غير موجود.
- [ ] **Step 3: نفّذ** `src/utils/tenderPath.ts` بالتواقيع أعلاه. المعلّقة = `hasMathError || hasTextDiscrepancy`.
- [ ] **Step 4:** `npm run check` ⇐ تنجح كلها.
- [ ] **Step 5: Commit** `git add src/utils/tenderPath.ts checks/tenderPath.test.ts` ثم `git commit -m "سطر المسار: حساب حالة المناقصة وكل شركة من بياناتها"`

### Task 2: أرقام «كما قدّمه المجهز» ومرشحات الجدول

**Files:**
- Modify: `src/utils/bidderAuditEngine.ts` (إضافة `asSubmitted`)
- Modify: `src/utils/bidderAuditExcel.ts:163-173` (`analyseRow` يستعمل `asSubmitted`)
- Create: `src/utils/tableFilters.ts`
- Test: `checks/tableFilters.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // bidderAuditEngine.ts — المصدر الواحد لأرقام «واقع الحال» في Excel وعرض «كما قدّمه» على الشاشة
  export interface AsSubmitted { unit: number; total: number; writtenText?: string }
  export const asSubmitted: (item: BOQItem) => AsSubmitted;
  //   unit = originalUnitPrice ?? enteredUnitPrice ?? 0
  //   total = enteredBidderTotal || bidderTotal
  //   writtenText = originalWrittenText ?? writtenText

  // tableFilters.ts
  export type NormalFilter = 'all' | 'deviated' | 'savings';
  export type AuditFilter = 'all' | 'pending' | 'corrected';
  export const isPending: (i: BOQItem) => boolean;                 // hasMathError || hasTextDiscrepancy
  export function pinPending(items: BOQItem[]): Set<string>;        // معرّفات المعلّقة لحظة اختيار المرشح
  export function auditFilterMatch(i: BOQItem, f: AuditFilter, pinned: Set<string>): boolean;
  //   'pending' ⇐ isPending(i) || pinned.has(i.id)؛ 'corrected' ⇐ isCommitteeCorrected(i)؛ 'all' ⇐ true
  export function isHandled(i: BOQItem, pinned: Set<string>): boolean; // pinned.has(i.id) && !isPending(i)
  ```

- [ ] **Step 1: اكتب الفحوص الفاشلة** في `checks/tableFilters.test.ts`:
  - `asSubmitted`: فقرة اعتُمد تفقيطها مفرداً (`originalUnitPrice: 260, enteredUnitPrice: 280`) ⇐ `unit: 260`؛ فقرة صُحّح مبلغها (`enteredBidderTotal: 1248000, bidderTotal: 1344000`) ⇐ `total: 1248000`؛ فقرة اعتُمد تفقيطها «آلاف» ⇐ `writtenText` هو `originalWrittenText`؛ فقرة بلا `enteredBidderTotal` ⇐ `total: bidderTotal`.
  - ورقة «واقع الحال» لم تتغير: `buildBidderAuditWorkbook` لمناقصة الفحص نفسها يعطي القيم ذاتها في عمودي المفرد والمبلغ قبل التعديل وبعده (اقرأ الخلايا بـ`XLSX.utils.sheet_to_json(wb.Sheets['واقع الحال'], {header:1})`).
  - `auditFilterMatch`: فقرة معلّقة تظهر في `pending`؛ فقرة زالت علامتها وهي في `pinned` تبقى في `pending` و`isHandled` لها `true`؛ فقرة سليمة غير مثبّتة لا تظهر في `pending`؛ فقرة مصحّحة تظهر في `corrected`.
- [ ] **Step 2:** `npm run check` ⇐ تفشل.
- [ ] **Step 3: نفّذ** `asSubmitted` و`tableFilters.ts`، واجعل `analyseRow` يأخذ `unit` و`stated` و`asWritten` من `asSubmitted(item)` (ويبقى حساب `unitLost` كما هو).
- [ ] **Step 4:** `npm run check` ⇐ تنجح كلها، ومنها فحوص Excel القديمة.
- [ ] **Step 5: Commit** `git commit -m "مصدر واحد لأرقام «كما قدّمه المجهز» ومرشحات التدقيق"`

### Task 3: التبويبات في الشريط العلوي وقائمة «⋯»

**Files:**
- Modify: `src/resume.ts` (نوع التبويب وقراءته)
- Create: `src/components/MoreMenu.tsx`
- Modify: `src/components/Navbar.tsx`
- Modify: `src/App.tsx` (نوع `activeTab` وتمريره، وإزالة تبويبات الرأس)
- Test: `checks/resume.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // resume.ts
  export type ResumeTab = 'bids' | 'analysis' | 'status';
  export function normalizeResumeTab(v: unknown): ResumeTab;
  //   'bids'|'analysis'|'status' كما هي؛ 'table' ⇐ 'bids'؛ 'summary'|'charts' ⇐ 'analysis'؛ غير ذلك ⇐ 'bids'
  export type MainTab = ResumeTab;

  // MoreMenu.tsx
  export interface MoreMenuItem { label: string; icon?: React.ReactNode; onClick: () => void; disabled?: boolean; title?: string }
  export const MoreMenu: React.FC<{ items: MoreMenuItem[]; ariaLabel: string; dark?: boolean }>;
  //   زر «⋯» يفتح قائمة؛ تُغلق بالضغط خارجها وبـEscape وبعد اختيار عنصر

  // Navbar props (تُحذف: projects, onSelectProject, onOpenMultiBidder, onOpenSettings)
  activeTab: MainTab; onSelectTab: (t: MainTab) => void;
  ```

- [ ] **Step 1: فحص فاشل** `checks/resume.test.ts` لـ`normalizeResumeTab` بالحالات الست أعلاه، ومعها `undefined` و`42` ⇐ `'bids'`.
- [ ] **Step 2:** `npm run check` ⇐ يفشل.
- [ ] **Step 3: نفّذ** `normalizeResumeTab` واستعمله في `consumeResumeState`.
- [ ] **Step 4:** `npm run check` ⇐ ينجح.
- [ ] **Step 5: نفّذ `MoreMenu`** ثم **الشريط العلوي**:
  - من اليمين: كتلة الاسم والتوقيع كما هي (يُختصر الاسم إلى «نظام تحليل العطاءات» تحت `xl`)، ثم التبويبات الثلاثة «العطاءات» و«التحليل والتوصية» و«الموقف» بأيقوناتها (`Table2`، `Award`، `MapPin`)، والمفتوح بخط سفلي أزرق وخلفية أفتح، ثم في الطرف الأيسر «نسخة احتياطية» و«المناقصات» كما هما، و`MoreMenu` فيه: «مناقصة جديدة»، «سجل التتبع»، و«تثبيت النظام» حين `canInstall`.
  - تحت `md` تظهر أيقونة التبويب وكلمته الأولى فقط («العطاءات»، «التحليل»، «الموقف»).
  - التبويبات `role="tablist"`/`role="tab"`/`aria-selected`.
- [ ] **Step 6: في `App.tsx`**: `activeTab: MainTab` من `RESUMED_STATE?.tab ?? 'bids'`؛ يُمرَّر إلى `Navbar`؛ `getResumeState` يحفظه. تُزال من `ProjectHeader` أزرار التبويبات الثلاثة (المكوّن يُعاد بناؤه في Task 4). المحتوى مؤقتاً: `bids` ⇐ محتوى `table` اليوم، و`analysis` ⇐ `ExecutiveSummaryView` ثم `ChartsView` تحته، و`status` ⇐ نص «قيد البناء» إلى Task 7.
- [ ] **Step 7:** `npm run build` و`npm run check` و`npm run lint` ⇐ تنجح.
- [ ] **Step 8: Commit** `git commit -m "التبويبات الثلاثة في الشريط العلوي وقائمة ⋯"`

### Task 4: رأس المناقصة: سطر الموقف والمسار، وبطاقات الشركات

**Files:**
- Create: `src/components/TenderPathLine.tsx`
- Create: `src/components/BidderCards.tsx`
- Modify: `src/components/ProjectHeader.tsx` (يُزال مبدّل الشركة ويُضاف زر الإعدادات وسطر المسار)
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `tenderPath`, `bidderAuditState` (Task 1)؛ `MainTab` (Task 3).
- Produces:
  ```ts
  export type PathTarget = 'estimate' | 'bids' | 'audit' | 'award' | 'status';
  export const TenderPathLine: React.FC<{ path: TenderPath; onGo: (t: PathTarget) => void }>;
  export const BidderCards: React.FC<{
    project: TenderProject; activeBidderId: string;
    onSelect: (id: string) => void; onRename: (name: string) => void; onAdd: () => void;
  }>;
  // ProjectHeader props بعد التعديل:
  //   project, onChangeProjectField, onOpenSettings, onGo: (t: PathTarget) => void
  ```

- [ ] **Step 1: `TenderPathLine`**: «الموقف:» ثم الحالة بالأزرق (أو «حدد الموقف» محايداً)، ثم فاصل، ثم «مسار المناقصة:» وعناصره بأسهم `←`: «✓ الكلفة التخمينية» أو «بانتظار الكلفة التخمينية»؛ «العطاءات n من m» (أخضر حين n = m وn > 0)؛ «التدقيق: N فقرة بانتظار قرار» كهرماني أو «✓ التدقيق» أخضر (لا يظهر قبل أي مبالغ)؛ «التوصية: (الاسم)» أخضر أو «التوصية: لم تُختر» محايد. كل عنصر `button` يستدعي `onGo` بهدفه. الحاوية `flex-wrap`، والسهم داخل عنصره كي لا ينفصل عنه عند الالتفاف.
- [ ] **Step 2: `BidderCards`**: بطاقة لكل شركة: الاسم، وتحته حالة `bidderAuditState` («✓ مدقَّق» أخضر، «N بانتظار قرار» كهرماني، «لم تُدخل أسعاره» محايد)، وشارة «★ موصى بالترسية» أو «مستبعد» كما في خيارات القائمة اليوم. البطاقة المفتوحة بإطار أزرق وفيها قلم تعديل الاسم (سلوك التعديل الحالي في `ProjectHeader:171-218`). وبطاقة منقّطة «＋ شركة». التفاف عند كثرة الشركات.
- [ ] **Step 3: `ProjectHeader`**: يبقى صف رقم الطلبية والإعلان والشارات والعنوان كما هي؛ شارة الموقف الحالية تُحذف (صار الموقف أول سطر المسار)؛ يُضاف زر «⚙ إعدادات المناقصة» في صف الشارات؛ ثم `TenderPathLine` في أسفله.
- [ ] **Step 4: `App.tsx`**: `ProjectHeader` يظهر فوق التبويبات الثلاثة. `onGo`: `estimate` و`bids` ⇐ تبويب `bids` ثم تمرير إلى الجدول؛ `audit` ⇐ تبويب `bids` + `selectBidder(path.audit.firstBidderId)` + فتح عرض التدقيق بمرشح «بانتظار قرار» (عرّف هنا في App الحالة `auditMode: boolean` و`auditInitialFilter: AuditFilter`، وتصلها Task 5 بالجدول)؛ `award` ⇐ `analysis`؛ `status` ⇐ `status`. `BidderCards` في أعلى تبويب `bids` وحده. `KPIStatsCards` تنتقل إلى داخل تبويب `bids` تحت البطاقات.
- [ ] **Step 5:** `npm run build` و`npm run check` و`npm run lint` ⇐ تنجح. ثم `npm run dev` وتحقق بالعين: الضغط على كل عنصر في السطر ينقل إلى مكانه، والبطاقات تبدّل الشركة وتعدّل اسمها.
- [ ] **Step 6: Commit** `git commit -m "سطر الموقف ومسار المناقصة، وبطاقات الشركات بحالتها"`

### Task 5: الجدول بعرضين: العادي وعرض التدقيق

**Files:**
- Create: `src/components/AuditCell.tsx` (محتوى عمود التدقيق `BOQTable.tsx:586-855` منقولاً كما هو)
- Modify: `src/components/BOQTable.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `asSubmitted` و`tableFilters` (Task 2)؛ `bidderAuditState` (Task 1)؛ `MoreMenu` (Task 3).
- Produces:
  ```ts
  // AuditCell: كل ما في الخلية اليوم، بالمعالجات نفسها، ومعه حالة قلم التفقيط
  export const AuditCell: React.FC<{
    item: BOQItem; index: number; editingText: boolean;
    onEditText: (id: string | null) => void;
    onUpdateFields; onCorrectReading; onAdoptTafqeetThousands;
    onMarkUnreasonable?; onMarkBidderSigned?; onAcceptAsReading?;   // بأنواعها الحالية في BOQTableProps
  }>;
  // BOQTable props جديدة:
  auditMode: boolean;
  onAuditModeChange: (open: boolean, focusItemId?: string) => void;
  auditFocusItemId?: string;          // يُمرَّر إليه ويُبرز صفه
  auditInitialFilter: AuditFilter;    // 'pending' من سطر المسار، 'all' من شارة الصف
  bidderId: string;                   // يمسح التثبيت عند تبديل الشركة
  ```

- [ ] **Step 1: انقل** محتوى خلية التدقيق إلى `AuditCell` دون أي تغيير في السلوك. `npm run build` و`npm run check` ⇐ تنجحان قبل أي خطوة أخرى.
- [ ] **Step 2: العرض العادي** (`auditMode = false`):
  - يُحذف الشريط الأحمر «تدقيق حسابي وقانوني» (`BOQTable.tsx:336-371`) ومرشح «أخطاء العطاء».
  - شريط الشركة: `offerControl`، و«استيراد جدول»، و«🧮 التدقيق والتصحيح الحسابي (N)» (N عدد المعلّقة، كهرماني حين N > 0، ولا يظهر لشركة بلا مبالغ)، و`MoreMenu` فيه «إضافة فقرة» و«تصفير مبالغ المجهز» (بشروطهما الحالية `sharedReadOnly` و`locked`). ويُحذف زر «تصدير الجدول» من هنا (ينتقل إلى عرض التدقيق).
  - شريط البحث: البحث، ومرشحات `NormalFilter`: «الكل»، «المنحرفة > X%»، «مطابقة». ويُحذف زر «+ إضافة فقرة» منه.
  - أعمدة الجدول كما هي **عدا عمود التدقيق**. وعلى الفقرة المعلّقة، داخل خلية الوصف، شارة حمراء «خطأ ضرب» أو كهرمانية «خلاف التفقيط» (`button`)، تستدعي `onAuditModeChange(true, item.id)`.
  - الفقرة المصحَّحة (`isCommitteeCorrected`): المبلغ أخضر، وتحته `asSubmitted(item).total` مشطوباً بخط صغير حين يختلف.
  - خلايا الكمية والمفرد والمبلغ تبقى تصحيح قراءة كما هي.
- [ ] **Step 3: عرض التدقيق** (`auditMode = true`):
  - شريط بخلفية كهرمانية فاتحة: زر «🧮 التدقيق والتصحيح الحسابي ✕» يغلقه؛ اختيار «كما قدّمه المجهز / بعد التصحيح» (الافتراضي «بعد التصحيح»)؛ مرشحات `AuditFilter` «الكل (n)» و«بانتظار قرار (n)» و«مصحّحة (n)»؛ زر «كشف التدقيق (Excel)» يستدعي `onExportAudit`؛ سطر القاعدة: «التفقيط يُعتمد عند الاختلاف، وسعر المفرد يُرجَّح على مبلغ الفقرة، ثم يوقّع المجهز إزاء التصحيح — ضوابط رقم (4) خامساً/ب».
  - الأعمدة: ت، الوصف، الكمية، المفرد، المبلغ، التدقيق (`AuditCell`). تُخفى التخميني والانحراف والموزون والتقييم والحذف.
  - «كما قدّمه»: المفرد والمبلغ من `asSubmitted` للقراءة فقط، والتفقيط `asSubmitted().writtenText`، وأزرار `AuditCell` مخفية. «بعد التصحيح»: الخلايا قابلة للتعديل كالعادي و`AuditCell` كاملة.
  - مرشح «بانتظار قرار»: `pinned` يُحسب بـ`pinPending(items)` عند اختياره، ويُمسح عند تغيير المرشح أو الإغلاق أو تغيّر `bidderId`. الصف الذي `isHandled` يُعلَّم «✓ عولجت» أخضر ولا يختفي.
  - `auditFocusItemId`: بعد الفتح يُمرَّر إلى الصف (`scrollIntoView({block:'center'})`) ويُبرز لحظة. عند الفتح من شارة يكون المرشح «الكل».
- [ ] **Step 4: سطر المرشح المفعَّل** في العرضين: حين يكون المرشح غير «الكل» أو البحث غير فارغ، يظهر فوق الجدول «يُعرض n من N فقرة» وزر «عرض الكل» يعيد المرشح «الكل» ويمسح البحث.
- [ ] **Step 5: `App.tsx`**: حالة `auditMode` (عرّفتها Task 4) ومعها `auditFocusItemId`؛ تُمرَّران إلى `BOQTable` مع `bidderId={activeBidder.id}`؛ تُغلق `auditMode` عند تبديل المناقصة.
- [ ] **Step 6:** `npm run build` و`npm run check` و`npm run lint` ⇐ تنجح. ثم `npm run dev` وتحقق بالعين على نسخة احتياطية فيها أخطاء: الشارة تفتح التدقيق عند صفها؛ تصحيح قراءة في «بانتظار قرار» يُبقي الصف بعلامة «✓ عولجت»؛ «كما قدّمه» يطابق ورقة «واقع الحال» في Excel لثلاث فقرات مصحّحة؛ «عرض الكل» يعيد الجدول كله؛ الأشرطة اللاصقة لا تغطي رؤوس الأعمدة على شاشة عريضة؛ عرض موزون فعّال لا يكسر العرضين (تركيز المراجعة 1).
- [ ] **Step 7: Commit** `git commit -m "الجدول بعرضين: المراجعة، والتدقيق بأزرار قرارات اللجنة"`

### Task 6: تبويب «التحليل والتوصية»

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/ExecutiveSummaryView.tsx` (أزرار المقارنة والرسوم بجانب «طباعة المحضر»)

**Interfaces:**
- Produces: `ExecutiveSummaryView` props جديدة `onOpenMatrix: () => void` و`chartsOpen: boolean` و`onToggleCharts: () => void`.

- [ ] **Step 1:** بجانب «طباعة المحضر النهائي» و«تصدير Excel» زرّا «👥 مقارنة المجهزين» (يفتح `MultiBidderMatrix` كما يفعل الشريط اليوم) و«📊 الرسوم» (يُظهر `ChartsView` تحت الملخص ويخفيه، والحالة في App).
- [ ] **Step 2:** تبويب `analysis` يعرض `ExecutiveSummaryView` ثم `ChartsView` حين `chartsOpen`.
- [ ] **Step 3:** `npm run build` و`npm run check` و`npm run lint` ⇐ تنجح. تحقق بالعين: المقارنة تفتح، والرسوم تظهر وتختفي، والطباعة كما كانت.
- [ ] **Step 4: Commit** `git commit -m "تبويب التحليل والتوصية: المقارنة والرسوم بجانب المحضر"`

### Task 7: تبويب «الموقف»

**Files:**
- Create: `src/components/OrderStatusPanel.tsx` (من `OrderStatusModal.tsx` بلا الغطاء ولا `isOpen` ولا Escape)
- Delete: `src/components/modals/OrderStatusModal.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `StatusInput` من `src/app/statusHandlers.ts`.
- Produces:
  ```ts
  export const OrderStatusPanel: React.FC<{
    project: TenderProject;
    onAdd: (input: StatusInput) => string | null;
    onEdit: (id: string, input: StatusInput) => string | null;
    onDelete: (id: string) => void;
    onOpenSheet: () => void;                 // يفتح StatusSheetModal
    onDirtyChange: (dirty: boolean) => void;  // نموذج فيه إدخال لم يُحفظ
  }>;
  ```

- [ ] **Step 1:** انقل النموذج والسجل إلى `OrderStatusPanel` كما هما، في بطاقة بيضاء بعرض الصفحة: السجل الزمني (الأحدث أولاً، والحالي معلَّم بشارة «الموقف الحالي» زرقاء نصاً لا عبر CSS)، ونموذج الإضافة والتعديل، وزر «🖨 كشف الموقف». المكوّن يُعاد إنشاؤه بـ`key={currentProject.id}` فيبدأ نموذجه فارغاً لكل مناقصة.
- [ ] **Step 2:** `dirty` = حقل في النموذج يختلف عن قيمته الابتدائية أو `editingId` غير فارغ. `App.tsx`: `isStatusDirty` يحل محل `isStatusOpen` في `blockingWork` بالنص نفسه «موقف الطلبية». يُحذف `isStatusOpen` و`OrderStatusModal`.
- [ ] **Step 3:** `npm run build` و`npm run check` و`npm run lint` ⇐ تنجح. تحقق بالعين: إضافة موقف وتعديله وحذفه تُحدّث سطر الموقف في الرأس؛ «كشف الموقف» يفتح؛ كتابة في النموذج ثم «حفظ والتحديث» يُرفض برسالة «موقف الطلبية».
- [ ] **Step 4: Commit** `git commit -m "تبويب الموقف بدل نافذته"`

### Task 8: الإصدار والتوثيق

**Files:**
- Modify: `package.json` (`"version": "1.24.0"`)
- Modify: `src/changelog.ts` (مدخل في أول `CHANGELOG`)
- Modify: `CLAUDE.md` (المشروع)
- Modify: `docs/superpowers/specs/2026-11-02-stage-tabs-and-tracker-design.md` (سطر الحالة)

- [ ] **Step 1:** مدخل «ما الجديد» للإصدار `1.24.0` بتاريخ يوم البناء، سطران بصيغة ما يستطيعه المستخدم:
  - «تنتقل بين العطاءات، والتحليل والتوصية، والموقف من تبويبات أعلى الشاشة، ويريك سطر مسار المناقصة ما اكتمل وما بقي.»
  - «تراجع تصحيحات كل مجهز في عرض التدقيق، وتقارن أرقامه كما قدّمها بأرقامه بعد التصحيح.»
- [ ] **Step 2:** `CLAUDE.md`: فقرة قصيرة تحت «Architecture» عن التبويبات (`MainTab`، `normalizeResumeTab`)، وعرض التدقيق (`auditMode`، `AuditCell`، `asSubmitted` مصدر واحد مع ورقة «واقع الحال»، التثبيت في «بانتظار قرار»)، و`OrderStatusPanel` بدل النافذة؛ وتصحيح الإشارات إلى «تبويب الجدول» والشريط الأحمر و`OrderStatusModal` حيث وردت.
- [ ] **Step 3:** `npm run build` ثم `cp dist/index.html "نظام_تحليل_العطاءات.html"`، و`npm run check` و`npm run lint` ⇐ تنجح.
- [ ] **Step 4: Commit** `git commit -m "v1.24.0: تبويبات العمل وعرض التدقيق"` (بلا `git tag` ولا دفع: ينتظر معاينة أسامة).

import { asSubmitted, findAdoption, isCommitteeCorrected, readingBeforeCorrection, submittedFlags, submittedTotal, unitLostOf } from '../utils/bidderAuditEngine';
import { AuditCell } from './AuditCell';
import { auditFilterMatch, isHandled, isPending, pinPending, type AuditFilter, type NormalFilter } from '../utils/tableFilters';
import React, { useEffect, useRef, useState } from 'react';
import {
  Plus,
  Trash2,
  Copy,
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
  Building2,
  FileSpreadsheet,
  Search,
  Download,
  Printer,
  Keyboard
} from 'lucide-react';
import { AuditLogEntry, BOQItem, TenderTotals, ReadingField } from '../types/tender';
import { formatNumber, parseArabicNumber, toLatinDigits } from '../utils/calculations';
import type { UnitOutlier } from '../utils/unitOutliers';
import { isOfferEdited, offerItemView } from '../utils/weightedOffer';

// حقل مبلغ يعرض فواصل الآلاف (60,000,000) خارج التعديل والرقم المجرد أثناء الكتابة: بلا فواصل كان
// 60000000 يشتبه بـ 6000000. يقبل الأرقام العربية والفواصل الملصوقة عبر parseArabicNumber.
// يُعتمد الرقم عند مغادرة الحقل أو Enter (وEscape يلغي)، لا مع كل حرف: كل اعتماد يُعيد فحص الفقرة
// ويُسجَّل، وقد يطلب تأكيداً، وكان كل حرف يُسجَّل تعديلاً مستقلاً
// المبالغ تُعرض بثلاث منازل (الفلس): «422.100» كانت تظهر «422.10». يُقرَّب إلى الفلس قبل فحص العدد الصحيح
// لئلا يظهر حاصل ضرب مثل 19.99 × 100 = 1998.9999999999998 بصيغة «1,999.000»
const displayAmount = (v: number, fractionDigits = 3) => {
  const rounded = Math.round(v * 1000) / 1000;
  return formatNumber(rounded, Number.isInteger(rounded) ? 0 : fractionDigits);
};

const useMeasuredHeight = (initial: number) => {
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(initial);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setHeight(Math.round(el.getBoundingClientRect().height)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, height] as const;
};

const AmountInput: React.FC<{ value: number; onChange: (v: number) => void; className: string; label: string; placeholder?: string; fractionDigits?: number; readOnly?: boolean; readOnlyTitle?: string }> = ({ value, onChange, className, label, placeholder = '0.00', fractionDigits, readOnly, readOnlyTitle = 'مقفل أثناء العرض الموزون' }) => {
  const [draft, setDraft] = useState<string | null>(null);
  const cancelled = useRef(false);
  return (
    <input
      type="text"
      inputMode="decimal"
      dir="ltr"
      aria-label={label}
      readOnly={readOnly}
      title={readOnly ? readOnlyTitle : undefined}
      value={draft ?? (value ? displayAmount(value, fractionDigits) : '')}
      onFocus={() => { if (readOnly) return; cancelled.current = false; setDraft(value ? String(value) : ''); }}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); }
        if (e.key === 'Escape') { cancelled.current = true; e.currentTarget.blur(); }
      }}
      onBlur={() => {
        const next = draft === null ? value : parseArabicNumber(draft);
        setDraft(null);
        if (!cancelled.current && next !== value) onChange(next);
      }}
      placeholder={placeholder}
      className={readOnly ? `${className} opacity-60 cursor-not-allowed` : className}
    />
  );
};


// وصف الفقرة: يظهر ملفوفاً حتى ثلاثة أسطر من أوله (كان سطراً واحداً مقصوصاً)، والنقر عليه يفتح
// حقل تعديل يعرض النص كاملاً. dir="auto" يُظهر الوصف الإنجليزي من اليسار بترتيبه الصحيح
const DescriptionCell: React.FC<{ value: string; onChange: (v: string) => void; readOnly?: boolean }> = ({ value, onChange, readOnly }) => {
  const [editing, setEditing] = useState(false);
  if (editing && !readOnly) {
    return (
      <textarea
        autoFocus
        dir="auto"
        rows={4}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setEditing(false)}
        onKeyDown={(e) => { if (e.key === 'Escape') setEditing(false); }}
        className="w-full field-sizing-content min-h-[4.5rem] bg-white border-0 font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded px-1.5 py-1 text-xs leading-relaxed resize-y"
      />
    );
  }
  return (
    <div
      role="button"
      tabIndex={0}
      dir="auto"
      title={value}
      onClick={() => { if (!readOnly) setEditing(true); }}
      onKeyDown={(e) => { if (!readOnly && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setEditing(true); } }}
      className={`line-clamp-3 font-bold text-slate-900 text-xs leading-relaxed px-1.5 py-1 rounded ${readOnly ? '' : 'cursor-text'} hover:bg-white focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500`}
    >
      {value}
    </div>
  );
};

// مفرد الفقرة في العرض الموزون: الجديد بارزاً بشارة، وتحته مفرد ما بعد التصحيح مشطوباً
const OfferUnitCell: React.FC<{ item: BOQItem; editable: boolean; onChange: (v: number) => void }> = ({ item, editable, onChange }) => {
  const correctedUnit = item.quantity > 0 ? item.bidderTotal / item.quantity : item.bidderTotal;
  const unit = item.offerUnitPrice ?? correctedUnit;
  const edited = isOfferEdited(item);
  const show = (v: number) => formatNumber(v, Number.isInteger(v) ? 0 : 2);
  return (
    <div className="flex flex-col items-center gap-0.5">
      <AmountInput value={unit} onChange={onChange} readOnly={!editable} label={`سعر المفرد في العرض الموزون للفقرة ${item.itemNo}`}
        className={`w-full min-w-[6rem] text-center rounded-lg p-1.5 font-mono font-black text-xs shadow-2xs border ${edited ? 'bg-purple-50 border-purple-400 text-purple-950' : 'bg-white border-indigo-200 text-indigo-950'}`} />
      {edited && (<>
        <span className="text-[10px] font-black text-purple-800 bg-purple-100 px-1.5 rounded">معدّل بالعرض الموزون</span>
        <span className="text-[10px] text-slate-500 line-through font-mono">{show(correctedUnit)}</span>
      </>)}
    </div>
  );
};

const OfferAmountCell: React.FC<{ item: BOQItem }> = ({ item }) => {
  const edited = isOfferEdited(item);
  const total = item.offerTotal ?? item.bidderTotal;
  const show = (v: number) => formatNumber(v, Number.isInteger(v) ? 0 : 2);
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className={`font-mono font-black text-xs ${edited ? 'text-purple-950' : 'text-indigo-950'}`}>{show(total)}</span>
      {edited && <span className="text-[10px] text-slate-500 line-through font-mono">{show(item.bidderTotal)}</span>}
    </div>
  );
};

interface BOQTableProps {
  unitOutliers?: UnitOutlier[];
  items: BOQItem[];
  totals?: TenderTotals;
  currency?: string;
  deviationThreshold: number;
  bidderName: string;
  onUpdateItem: (index: number, field: keyof BOQItem, val: any) => void;
  // تعديل مركّب لعدة حقول دفعة واحدة (انظر handleUpdateItemFields في App.tsx)
  onUpdateFields: (index: number, patch: Partial<BOQItem>, logAction?: string) => void;
  // تعديل الكمية أو المفرد أو المبلغ أو التفقيط يدوياً = تصحيح قراءة يعيد فحص الفقرة (handleCorrectReading في App.tsx)
  onCorrectReading: (index: number, field: ReadingField, value: number | string) => void;
  // فقرة عليها تصحيح حسابي تبيّن أن خطأها قراءة النظام للورقة: الأرقام الحالية تصير المدوَّنة (handleAcceptAsReading في itemHandlers.ts)
  onAcceptAsReading?: (index: number) => void;
  onReadingFromPaper?: (index: number, paper: { unitPrice?: number; total?: number }) => void;
  onConfirmReadCheck?: (index: number) => void;
  // تفقيط ناقص «آلاف»: تعتمده اللجنة بعد إضافتها دون أن يتغير رقم (handleAdoptTafqeetThousands في App.tsx)
  onAdoptTafqeetThousands: (index: number, correctedText: string) => void;
  onAddItem: () => void;
  onDeleteItem: (index: number) => void;
  onDuplicateItem: (index: number) => void;
  onClearBidderPrices?: () => void;
  onOpenSmartImport?: () => void;
  onOpenManualEntry?: () => void;
  // جدول واقع الحال والجدول المعدل لهذا المجهز في ملف Excel (exportBidderAuditToExcel)
  onExportAudit?: () => void;
  onOpenCorrectionNotice?: () => void;
  // العرض الموزون للعطاء النشط: active يُعدَّل فيه المفرد، adopted للعرض فقط، none الجدول العادي
  offerMode?: 'none' | 'active' | 'adopted';
  // عطاء آخر في المناقصة عرضه الموزون فعّال: الكمية والتخميني مقفلان (مشتركان)
  sharedLocked?: boolean;
  onEditOfferUnit?: (index: number, unit: number) => void;
  onMarkUnreasonable?: (index: number, note: string | null) => void;
  // حضور المجهز وتوقيعه وختمه إزاء تصحيح اللجنة لفقرة (ضوابط رقم (4) خامساً/ب/3)
  onMarkBidderSigned?: (index: number, signed: boolean) => void;
  // مدخل العرض الموزون (زر البدء ثم السطر الحي) يُرسم في شريط الشركة المثبت ليبقى ظاهراً أثناء التمرير
  offerControl?: React.ReactNode;
  // عرض التدقيق على الجدول نفسه: أزرار قرارات اللجنة فيه وحده، والعرض العادي للمراجعة
  auditMode: boolean;
  onAuditModeChange: (open: boolean, focusItemId?: string) => void;
  auditFocusItemId?: string;
  /** طلب انتقال إلى فقرة (من بطاقة الموثوقية): يُظهر الجدول الفقرة إن أخفاها مرشح أو بحث ثم ينزل إليها */
  revealRequest?: { itemId: string; seq: number };
  auditInitialFilter: AuditFilter;
  // يُمسح تثبيت «بانتظار قرار» عند تبديل الشركة
  bidderId: string;
  // سجل تدقيق المناقصة: يُعرف منه اعتماد التفقيط سعراً للمفرد قبل v1.12.0 في عرض «كما قدّمه المجهز»
  auditLogs?: AuditLogEntry[];
}

export const BOQTable: React.FC<BOQTableProps> = ({
  items,
  totals,
  unitOutliers = [],
  deviationThreshold,
  bidderName,
  onUpdateItem,
  onUpdateFields,
  onCorrectReading,
  onAdoptTafqeetThousands,
  onAddItem,
  onDeleteItem,
  onDuplicateItem,
  onClearBidderPrices,
  onOpenSmartImport,
  onOpenManualEntry,
  onExportAudit,
  onOpenCorrectionNotice,
  offerMode = 'none',
  sharedLocked = false,
  onEditOfferUnit,
  onMarkUnreasonable,
  onMarkBidderSigned,
  onAcceptAsReading,
  onReadingFromPaper,
  onConfirmReadCheck,
  offerControl,
  auditMode,
  onAuditModeChange,
  auditFocusItemId,
  revealRequest,
  auditInitialFilter,
  bidderId,
  auditLogs = []
}) => {
  const locked = offerMode !== 'none';
  const sharedReadOnly = locked || sharedLocked;
  // أثناء العرض الفعّال والمعتمد يُقاس الانحراف والتقييم والتصفية على مبلغ العرض لا مبلغ المجهز الأصلي،
  // وإلا ناقض الجدول شريط التوازن (0 فقرة منحرفة) وهو يعرض 30 فقرة منحرفة بنسبها الأصلية
  const deviationView = (i: BOQItem) => (locked ? offerItemView(i, deviationThreshold) : i);
  const [searchTerm, setSearchTerm] = useState('');
  // الفقرة التي يُصحَّح نص تفقيطها الآن (بمعرّفها)
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [normalFilter, setNormalFilter] = useState<NormalFilter>('all');
  // يُركَّب الجدول أحياناً وعرض التدقيق مفتوح أصلاً (الانتقال من سطر المسار من تبويب آخر)، فتبدأ الحالة من المرشح الابتدائي
  const [auditFilter, setAuditFilter] = useState<AuditFilter>(auditMode ? auditInitialFilter : 'all');
  // «كما قدّمه المجهز» للقراءة فقط، و«بعد التصحيح» هو الجدول المعتمد القابل للتعديل
  const [auditSource, setAuditSource] = useState<'corrected' | 'submitted'>('corrected');
  // فقرات «بانتظار قرار» لحظة اختيار المرشح: لا تختفي من تحت يد من يصححها (انظر tableFilters.ts)
  const [pinned, setPinned] = useState<Set<string>>(() => (auditMode && auditInitialFilter === 'pending' ? pinPending(items) : new Set()));

  // ضبط الحالة أثناء العرض (لا في effect): عند فتح عرض التدقيق، وعند تبديل الشركة
  const [prevBidderId, setPrevBidderId] = useState(bidderId);
  if (prevBidderId !== bidderId) {
    setPrevBidderId(bidderId);
    setPinned(auditMode && auditFilter === 'pending' ? pinPending(items) : new Set());
  }
  const [prevAuditMode, setPrevAuditMode] = useState(auditMode);
  if (prevAuditMode !== auditMode) {
    setPrevAuditMode(auditMode);
    if (auditMode) {
      setAuditFilter(auditInitialFilter);
      setAuditSource('corrected');
      setPinned(auditInitialFilter === 'pending' ? pinPending(items) : new Set());
    } else {
      setPinned(new Set());
    }
  }
  const chooseAuditFilter = (f: AuditFilter) => {
    setAuditFilter(f);
    setPinned(f === 'pending' ? pinPending(items) : new Set());
  };

  // يُنزَل الصف المطلوب إلى وسط الشاشة بعد فتح عرض التدقيق من شارته
  useEffect(() => {
    if (auditMode && auditFocusItemId) {
      document.getElementById(`audit-row-${auditFocusItemId}`)?.scrollIntoView({ block: 'center' });
    }
  }, [auditMode, auditFocusItemId]);

  // ارتفاع شريط الشركة وشريط البحث المثبتين يُقاس فعلياً (قد يلتف اسم شركة طويل أو تلتف المرشِّحات)،
  // لتثبت العناصر تحتهما مباشرة على الشاشات العريضة دون أن تختفي خلفهما
  const [barRef, barHeight] = useMeasuredHeight(76);
  const [toolbarRef, toolbarHeight] = useMeasuredHeight(64);

  // أعمدة الانحراف والمفرد الموزون والتقييم لا معنى لها قبل إدخال الكلفة التخمينية (كانت تكرر «-»
  // و«بانتظار التخميني» في كل صف)، فتُخفى ويُعرض بدلها تنبيه واحد فوق الجدول
  const hasEstimate = items.some(i => i.estimatedTotal > 0);
  const asSub = auditMode && auditSource === 'submitted';
  const hasAmounts = (totals?.totalBidderAmount ?? 0) > 0;

  // الفقرات بانتظار قرار اللجنة: خطأ ضرب أو خلاف تفقيط
  const pendingItems = items.filter(isPending);
  const correctedCount = items.filter(isCommitteeCorrected).length;

  // فلترة الأسطر. الأرقام المشرقية والإنجليزية سيّان في البحث: «24» تجد «كيك ٢٤ قطعة»
  const term = toLatinDigits(searchTerm.toLowerCase());
  const matches = (text: string) => toLatinDigits(text.toLowerCase()).includes(term);
  const filteredItems = items.filter(item => {
    const matchSearch =
      matches(String(item.itemNo)) ||
      matches(item.description) ||
      (!!item.writtenText && matches(item.writtenText));

    if (!matchSearch) return false;

    if (auditMode) return auditFilterMatch(item, auditFilter, pinned);
    if (normalFilter === 'deviated') return deviationView(item).isDeviated;
    if (normalFilter === 'savings') return deviationView(item).diffAmount < 0;
    return true;
  });
  const filterActive = searchTerm !== '' || (auditMode ? auditFilter !== 'all' : normalFilter !== 'all');
  const showAll = () => {
    setNormalFilter('all');
    setAuditFilter('all');
    setPinned(new Set());
    setSearchTerm('');
  };

  // انتقال مطلوب إلى فقرة: إن أخفاها المرشح أو البحث يُعاد الجدول إلى «الكل» أولاً، ثم يُنزل الصف ويُبرز؛ وإن لم توجد الفقرة تظهر رسالة
  const [revealNote, setRevealNote] = useState('');
  const [prevReveal, setPrevReveal] = useState(revealRequest);
  const [pendingReveal, setPendingReveal] = useState<{ itemId: string; seq: number } | null>(null);
  if (prevReveal !== revealRequest) {
    setPrevReveal(revealRequest);
    if (revealRequest) {
      if (!items.some(i => i.id === revealRequest.itemId)) {
        setRevealNote('تعذّر إظهار الفقرة: لم تعد موجودة في الجدول.');
      } else {
        setRevealNote('');
        if (!filteredItems.some(i => i.id === revealRequest.itemId)) {
          setNormalFilter('all');
          setAuditFilter('all');
          setPinned(new Set());
          setSearchTerm('');
        }
        setPendingReveal(revealRequest);
      }
    }
  }
  useEffect(() => {
    if (!pendingReveal) return;
    const row = document.getElementById(`audit-row-${pendingReveal.itemId}`);
    if (!row) { setTimeout(() => setRevealNote('تعذّر إظهار الفقرة في الجدول.'), 0); return; }
    row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const cls = ['outline', 'outline-2', 'outline-blue-500', 'bg-blue-100'];
    row.classList.add(...cls);
    setTimeout(() => row.classList.remove(...cls), 1600);
  }, [pendingReveal]);
  useEffect(() => {
    if (!revealNote) return;
    const t = setTimeout(() => setRevealNote(''), 5000);
    return () => clearTimeout(t);
  }, [revealNote]);

  return (
    <div className="space-y-4" style={{ '--bidder-bar-h': `${barHeight}px`, '--toolbar-h': `${auditMode ? 0 : toolbarHeight}px` } as React.CSSProperties}>

      {/* Top Banner: Active Bidder Label & Actions Bar
          مثبت تحت الشريط العلوي (ارتفاعه 81px) أثناء التمرير في الجدول، فيبقى اسم الشركة وأدوات
          الإدخال ظاهرين. على الشاشات الضيقة لا يُثبت: تلتف أزراره فيصير طويلاً ويحجب الجدول */}
      <div ref={barRef} className="bg-slate-900 text-white rounded-3xl p-4 sm:p-5 shadow-lg border border-slate-800 flex flex-wrap items-center justify-between gap-4 sm:sticky sm:top-[81px] z-40">

        {/* Active Bidder Label (read-only — يُعدَّل اسم الشركة من مبدّل الشركة في أعلى الصفحة) */}
        <div className="flex items-center gap-2.5 text-slate-300">
          <Building2 className="w-4 h-4 text-indigo-400 shrink-0" />
          <span className="text-xs sm:text-sm font-bold">
            جدول تحليل عطاء: <span className="text-white font-black">{bidderName}</span>
          </span>
        </div>

        {/* أدوات إدخال البيانات: بجانب اسم الشركة ليرى المستخدم إلى أي جدول تذهب البيانات قبل الضغط */}
        <div className="flex items-center gap-2 flex-wrap">
          {offerControl}
          {/* مدخل استيراد واحد لكل أنواع الملفات (كان زرّين: Excel/Word، وصورة/PDF): تُختار فيه نوع الجدول
              (المجهز أو الكلفة التخمينية) أولاً، ثم يُوجَّه الملف لمطابقة الأعمدة أو للقراءة بالذكاء الاصطناعي */}
          {onOpenSmartImport && !locked && (
            <button
              onClick={onOpenSmartImport}
              className="flex items-center gap-1.5 bg-gradient-to-r from-indigo-700 to-blue-700 hover:from-indigo-600 hover:to-blue-600 text-white text-xs font-black px-3.5 py-2 rounded-xl shadow-md transition transform active:scale-95 cursor-pointer border border-indigo-400/30"
              title="استيراد جدول أسعار المجهز أو الكلفة التخمينية من ملف Excel أو PDF أو صورة، أو بلصق جدول من Word"
            >
              <FileSpreadsheet className="w-4 h-4 text-indigo-200" />
              <span>استيراد جدول <bdi dir="ltr">(Excel / Word / PDF)</bdi> أو صورة</span>
            </button>
          )}
          {onOpenManualEntry && !locked && (
            <button
              onClick={onOpenManualEntry}
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-black px-3.5 py-2 rounded-xl shadow-md transition transform active:scale-95 cursor-pointer border border-slate-600"
              title="للعطاءات ذات الفقرات القليلة: إدخال الأرقام من الورقة دون قراءة آلية"
            >
              <Keyboard className="w-4 h-4 text-slate-300" />
              <span>إدخال يدوي</span>
            </button>
          )}
          {onAuditModeChange && hasAmounts && (
            <button
              type="button"
              onClick={() => onAuditModeChange(!auditMode)}
              aria-pressed={auditMode}
              className={`flex items-center gap-1.5 text-xs font-black px-3.5 py-2 rounded-xl shadow-md transition transform active:scale-95 cursor-pointer border ${
                auditMode || pendingItems.length > 0
                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 border-amber-300/50'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-100 border-slate-600'
              }`}
              title="مراجعة تصحيحات الفقرات واتخاذ قرارات اللجنة عليها، ومقارنة أرقام المجهز كما قدّمها بأرقامه بعد التصحيح"
            >
              <span>🧮 التدقيق والتصحيح الحسابي ({pendingItems.length})</span>
            </button>
          )}
          {onExportAudit && hasAmounts && (
            <button
              type="button"
              onClick={onExportAudit}
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-black px-3.5 py-2 rounded-xl shadow-md transition transform active:scale-95 cursor-pointer border border-slate-600"
              title="ملف Excel: عطاء المجهز كما قدّمه بعيوبه مؤشرة ومشروحة، وأخطاء المجهز، والجدول المعدل بعد تصحيحات اللجنة"
            >
              <Download className="w-4 h-4 text-slate-300" />
              <span>تصدير الجدول <bdi dir="ltr">(Excel)</bdi></span>
            </button>
          )}
          {/* ظاهران لا في قائمة «…» (طلب أسامة 2026-11-19)، ويختفيان حين لا يُتاحان كزر الاستيراد:
              وفي عرض «كما قدّمه المجهز» (للقراءة فقط)، والتصفير بلا مبالغ (مراجعة Antigravity 2026-11-19) */}
          {!sharedReadOnly && !asSub && (
            <button
              type="button"
              onClick={onAddItem}
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-black px-3.5 py-2 rounded-xl shadow-md transition transform active:scale-95 cursor-pointer border border-slate-600"
              title="إضافة فقرة جديدة في آخر الجدول"
            >
              <Plus className="w-4 h-4 text-slate-300" />
              <span>إضافة فقرة</span>
            </button>
          )}
          {onClearBidderPrices && !locked && !asSub && hasAmounts && (
            <button
              type="button"
              onClick={onClearBidderPrices}
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-rose-200 text-xs font-black px-3.5 py-2 rounded-xl shadow-md transition transform active:scale-95 cursor-pointer border border-slate-600"
              title="تصفير مبالغ هذا المجهز لإعادة إدخالها مع الحفاظ على التخميني والفقرات"
            >
              <RotateCcw className="w-4 h-4 text-rose-300" />
              <span>تصفير مبالغ المجهز</span>
            </button>
          )}
        </div>

      </div>

      {/* Main Table Container */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden xl:overflow-clip" id="boq-table-container">
        
        {/* Table Toolbar
            على الشاشات العريضة (xl) يثبت تحت شريط الشركة، فيبقى البحث والمرشِّحات في متناول اليد أثناء التمرير
            وتثبت عناوين الأعمدة تحته. على الأضيق يلتف فيطول، فيبقى غير مثبت كشريط الشركة */}
        <div ref={toolbarRef} className={`p-4 border-b flex flex-wrap items-center justify-between gap-3 xl:top-[calc(81px+var(--bidder-bar-h))] z-30 ${
          auditMode ? 'bg-amber-50 border-amber-200' : 'xl:sticky bg-slate-50 border-slate-200'
        }`}>

          {/* عرض التدقيق: إغلاقه، ومصدر الأرقام، ومرشحاته، والقاعدة وسندها */}
          {auditMode && (
            <div className="w-full flex flex-wrap items-center gap-2 pb-3 border-b border-amber-200">
              <button
                type="button"
                onClick={() => onAuditModeChange(false)}
                className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black px-3.5 py-1.5 rounded-xl cursor-pointer border border-amber-300/50"
                title="العودة إلى العرض العادي للجدول"
              >
                🧮 التدقيق والتصحيح الحسابي ✕
              </button>
              <div className="flex items-center gap-1 bg-white border border-amber-300 rounded-xl p-0.5" role="group" aria-label="مصدر الأرقام">
                {([['corrected', 'بعد التصحيح'], ['submitted', 'كما قدّمه المجهز']] as const).map(([v, label]) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setAuditSource(v)}
                    aria-pressed={auditSource === v}
                    className={`px-3 py-1 rounded-lg text-xs font-black cursor-pointer transition ${
                      auditSource === v ? 'bg-slate-800 text-white' : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {([['all', `الكل (${items.length})`], ['pending', `فيها أخطاء (${pendingItems.length})`], ['corrected', `مصحّحة (${correctedCount})`]] as const).map(([v, label]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => chooseAuditFilter(v)}
                  aria-pressed={auditFilter === v}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer border ${
                    auditFilter === v
                      ? v === 'pending' ? 'bg-amber-600 text-white border-amber-700' : v === 'corrected' ? 'bg-emerald-600 text-white border-emerald-700' : 'bg-slate-800 text-white border-slate-900'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  {label}
                </button>
              ))}
              {onOpenCorrectionNotice && correctedCount > 0 && (
                <button
                  type="button"
                  onClick={onOpenCorrectionNotice}
                  className="mr-auto flex items-center gap-1.5 bg-white hover:bg-slate-100 text-slate-800 text-xs font-black px-3.5 py-1.5 rounded-xl cursor-pointer border border-slate-300"
                  title="ورقة مطبوعة باسم المجهز بالفقرات التي صحّحتها اللجنة، ليحضر ويوقّع ويختم إزاءها"
                >
                  <Printer className="w-4 h-4" />
                  <span>إشعار المجهز للتوقيع</span>
                </button>
              )}
              <p className="w-full text-[11px] font-bold text-amber-900 leading-relaxed">
                التفقيط يُعتمد عند الاختلاف، وسعر المفرد يُرجَّح على مبلغ الفقرة، ثم يوقّع المجهز إزاء التصحيح — ضوابط رقم (4) خامساً/ب.
                {asSub && ' (العرض الحالي «كما قدّمه المجهز»: للقراءة فقط.)'}
              </p>
            </div>
          )}

          {/* Search Box */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
            <input
              type="text"
              placeholder="بحث برقم أو وصف الفقرة..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl pr-9 pl-3 py-1.5 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
            />
          </div>

          {/* Filter Pills (العرض العادي) */}
          {!auditMode && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setNormalFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer ${
                normalFilter === 'all' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              الكل ({items.length})
            </button>

            <button
              onClick={() => setNormalFilter('deviated')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer ${
                normalFilter === 'deviated' ? 'bg-rose-600 text-white shadow-xs' : 'bg-white text-rose-800 border border-rose-200 hover:bg-rose-50'
              }`}
            >
              المنحرفة &gt; {deviationThreshold}% ({items.filter(i => deviationView(i).isDeviated).length})
            </button>

            <button
              onClick={() => setNormalFilter('savings')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer ${
                normalFilter === 'savings' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-white text-emerald-800 border border-emerald-200 hover:bg-emerald-50'
              }`}
            >
              مطابقة ({items.filter(i => deviationView(i).diffAmount < 0).length})
            </button>
          </div>
          )}
        </div>

        {revealNote && (
          <div role="status" className="print:hidden px-4 py-2 bg-amber-50 border-b border-amber-200 text-xs font-bold text-amber-900">{revealNote}</div>
        )}

        {/* كل مرشح مفعَّل يُعلن عن نفسه ويُلغى بزر واحد */}
        {filterActive && (
          <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 text-xs font-bold text-blue-900 flex flex-wrap items-center gap-3">
            <span>يُعرض {filteredItems.length} من {items.length} فقرة</span>
            <button type="button" onClick={showAll} className="underline hover:text-blue-700 cursor-pointer">عرض الكل</button>
          </div>
        )}

        {!hasEstimate && items.length > 0 && (
          <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 text-xs font-bold text-blue-900">
            أعمدة نسبة الانحراف والمفرد الموزون والتقييم تظهر بعد إدخال المبلغ التخميني للفقرات.
          </div>
        )}

        {/* The Comprehensive BOQ Table
            على الشاشات العريضة (xl، والجدول يتسع فيها كاملاً) يُمرَّر الجدول مع الصفحة وتثبت عناوين
            أعمدته تحت شريط الشركة وسطر المجاميع أسفل الشاشة. على الأضيق يبقى صندوقاً بتمرير خاص،
            لأنه يحتاج تمريراً أفقياً، وأي حاوية تمرير تحصر التثبيت داخلها */}
        <div className="overflow-x-auto max-h-[640px] relative xl:overflow-visible xl:max-h-none">
          <table className="w-full text-xs sm:text-sm text-right border-collapse">
            
            <thead className="bg-slate-900 text-slate-100 uppercase text-xs font-black sticky top-0 xl:top-[calc(81px+var(--bidder-bar-h)+var(--toolbar-h))] z-20 shadow-xs select-none">
              <tr>
                <th className="p-3 w-12 text-center border-l border-slate-800">ت</th>
                <th className="p-3 min-w-[160px] border-l border-slate-800">اسم المادة / وصف الفقرة{!asSub && ' ✏️'}</th>
                <th className="p-3 w-16 text-center border-l border-slate-800 bg-slate-800">العدد{!asSub && ' ✏️'}</th>
                <th className="p-3 w-28 text-center border-l border-slate-800 bg-indigo-950 text-indigo-200">{locked && !asSub ? 'سعر المفرد — العرض الموزون' : asSub ? 'سعر المفرد للمجهز' : 'سعر المفرد للمجهز ✏️'}</th>
                <th className="p-3 w-32 text-center border-l border-slate-800 bg-indigo-900 text-indigo-100">{locked && !asSub ? 'مبلغ العرض الموزون' : 'مبلغ المجهز الإجمالي 💰'}</th>
                {auditMode ? (
                  <th className="p-3 min-w-[180px] bg-amber-950 text-amber-200">{asSub ? 'التفقيط كما قدّمه المجهز' : 'تدقيق الأخطاء الحسابية والتفقيط'}</th>
                ) : (<>
                <th className="p-3 w-28 text-center border-l border-slate-800 bg-blue-950 text-blue-200">المبلغ التخميني ✏️</th>
                {hasEstimate && (
                  <>
                    <th className="p-3 w-28 text-center border-l border-slate-800">نسبة الانحراف %</th>
                    <th className="p-3 w-32 text-center border-l border-slate-800 bg-purple-950 text-purple-200">المفرد الموزون</th>
                    <th className="p-3 w-28 text-center border-l border-slate-800">التقييم</th>
                  </>
                )}
                <th className="p-3 w-16 text-center">حذف</th>
                </>)}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200 bg-white font-medium">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={auditMode ? 6 : hasEstimate ? 10 : 7} className="p-12 text-center text-slate-400 font-bold bg-slate-50/50">
                    <div className="max-w-md mx-auto space-y-2">
                      {items.length > 0 ? (<>
                        <p className="text-base text-slate-700 font-black">لا فقرات تطابق المرشح</p>
                        <button type="button" onClick={showAll} className="text-xs font-black text-indigo-700 hover:underline cursor-pointer">عرض الكل</button>
                      </>) : (<>
                      <p className="text-base text-slate-700 font-black">الجدول فارغ حالياً</p>
                      <p className="text-xs text-slate-500">
                        استورد جدول الإكسل من الأعلى عبر <strong>[ استيراد جدول (Excel / Word) ]</strong> أو انقر <strong>(+ إضافة فقرة)</strong>.
                      </p>
                      </>)}
                    </div>
                  </td>
                </tr>
              ) : filteredItems.map((item) => {
                const actualIndex = items.findIndex(i => i.id === item.id);
                const unitOutlier = unitOutliers.find(row => row.itemId === item.id);
                const view = deviationView(item);
                const isDeviated = view.isDeviated;
                const isSaving = view.diffAmount < 0;
                const sub = asSubmitted(item);
                // «كما قدّمه»: عيوب الورقة من أرقام المجهز لا من العلامات الحالية (كورقة «واقع الحال»)، فتبقى المصحَّحة بعيبها الأصلي
                const unitLost = asSub && unitLostOf(item, findAdoption(item, bidderId, auditLogs));
                const subFlags = asSub ? submittedFlags(item, unitLost) : null;
                const hasError = subFlags ? subFlags.hasMathError || subFlags.hasTextDiscrepancy : isPending(item);
                const handled = auditMode && !asSub && isHandled(item, pinned);
                const corrected = isCommitteeCorrected(item);

                // فقرة بلا مفرد مدون (جدول بلا عمود للمفرد، أو مُسح مفردها تصحيحاً للقراءة): يظهر المبلغ ÷ الكمية
                // باهتاً في مكان الرقم لا رقماً مدوناً، فلا يُظن مقروءاً من العطاء ولا يبدو المسح كأنه لم يقع
                const recordedUnitPrice = item.enteredUnitPrice && item.enteredUnitPrice > 0 ? item.enteredUnitPrice : 0;
                const derivedUnitPrice = item.quantity > 0 ? item.bidderTotal / item.quantity : 0;

                return (
                  <tr 
                    key={item.id} 
                    id={`audit-row-${item.id}`}
                    className={`hover:bg-blue-50/50 transition group ${
                      auditMode && auditFocusItemId === item.id ? 'ring-2 ring-inset ring-blue-500' : ''
                    } ${
                      handled ? 'bg-emerald-50/60' : subFlags ? (subFlags.hasMathError ? 'bg-rose-50/50' : subFlags.hasTextDiscrepancy ? 'bg-amber-50/60' : '') : hasError ? 'bg-rose-50/50' : !auditMode && isDeviated ? 'bg-rose-50/20' : !auditMode && isSaving ? 'bg-emerald-50/15' : ''
                    }`}
                  >
                    {/* Item No
                        الحد الأدنى للعرض يمنع المتصفح من تضييق العمود: كان «1.15» يظهر «15» */}
                    <td className="p-2 text-center font-black text-slate-700 border-l border-slate-200 bg-slate-50/80">
                      <input
                        type="text"
                        value={item.itemNo}
                        readOnly={asSub}
                        title={asSub ? 'للقراءة فقط: كما قدّمه المجهز' : undefined}
                        onChange={(e) => onUpdateItem(actualIndex, 'itemNo', toLatinDigits(e.target.value))}
                        className="w-full min-w-[3rem] text-center bg-transparent focus:bg-white focus:ring-2 focus:ring-indigo-500 rounded p-1 font-mono font-black"
                      />
                    </td>

                    {/* Description */}
                    <td className="p-2 border-l border-slate-200">
                      <DescriptionCell
                        value={item.description}
                        onChange={(v) => onUpdateItem(actualIndex, 'description', v)}
                        readOnly={asSub}
                      />
                      {/* العرض العادي للمراجعة: شارة على الفقرة المؤشَّرة تفتح التدقيق عند الفقرة نفسها */}
                      {!auditMode && hasError && (
                        <div className="flex flex-wrap gap-1 mt-1 px-1.5">
                          {item.hasMathError && (
                            <button type="button" onClick={() => onAuditModeChange(true, item.id)}
                              title="فتح عرض التدقيق عند هذه الفقرة"
                              className="text-[10px] font-black text-rose-800 bg-rose-50 border border-rose-400 rounded-full px-2 py-0.5 hover:bg-rose-100 cursor-pointer">
                              🚨 خطأ ضرب
                            </button>
                          )}
                          {item.hasTextDiscrepancy && (
                            <button type="button" onClick={() => onAuditModeChange(true, item.id)}
                              title="فتح عرض التدقيق عند هذه الفقرة"
                              className="text-[10px] font-black text-amber-800 bg-amber-50 border border-amber-400 rounded-full px-2 py-0.5 hover:bg-amber-100 cursor-pointer">
                              ⚠️ خلاف التفقيط
                            </button>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Quantity — تصحيح قراءة مشترك: يُعاد فحص الفقرة لدى كل المجهزين، ولا تتغير مبالغهم المدونة
                        (كانت الكمية تُعيد بناء مبلغ المجهز النشط من المفرد فتُخفي الفرق) */}
                    <td className="p-2 text-center border-l border-slate-200 bg-slate-50/50">
                      <AmountInput
                        value={item.quantity || 1}
                        onChange={(v) => onCorrectReading(actualIndex, 'quantity', v || 1)}
                        label={`كمية الفقرة ${item.itemNo}`}
                        placeholder="1"
                        fractionDigits={2}
                        readOnly={sharedReadOnly || asSub}
                        readOnlyTitle={asSub ? 'للقراءة فقط: كما قدّمه المجهز' : undefined}
                        className="w-14 text-center bg-white border border-slate-200 rounded-lg p-1 font-mono font-black text-slate-800 text-xs shadow-2xs focus:ring-1 focus:ring-indigo-500"
                      />
                    </td>

                    {/* Bidder Unit Price (سعر المفرد)
                        حقول المبالغ الثلاثة بحد أدنى للعرض: بدونه يضيّق المتصفح أعمدتها حتى عرض كلمة العنوان،
                        فيُقص أول الرقم (60000000 كان يظهر 0000) ويبدو كأن القراءة خاطئة.
                        تعديل المفرد تصحيح قراءة لا يمس المبلغ المدون إلا إن كان فارغاً (handleCorrectReading) */}
                    <td className="p-2 text-center border-l border-slate-200 bg-indigo-50/30">
                      {asSub ? (
                        <span className="font-mono font-black text-xs text-slate-800">{unitLost ? 'غير محفوظ' : sub.unit > 0 ? displayAmount(sub.unit) : '-'}</span>
                      ) : locked ? (
                        <OfferUnitCell item={item} editable={offerMode === 'active'} onChange={(v) => onEditOfferUnit?.(actualIndex, v)} />
                      ) : (
                        <AmountInput
                          value={recordedUnitPrice}
                          onChange={(newUnit) => onCorrectReading(actualIndex, 'unitPrice', newUnit)}
                          label={`سعر المفرد للفقرة ${item.itemNo}`}
                          placeholder={derivedUnitPrice > 0 ? displayAmount(derivedUnitPrice) : '0.00'}
                          className="w-full min-w-[6rem] text-center bg-white border border-indigo-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 rounded-lg p-1.5 font-mono font-black text-indigo-950 text-xs shadow-2xs"
                        />
                      )}
                      {!locked && unitOutlier && (
                        <span className="print:hidden inline-block mt-1 text-[10px] leading-tight font-black text-amber-800 bg-amber-50 border border-amber-400 rounded-md px-2 py-0.5"
                          title="سعر المفرد يبعد عن وسيط بقية المجهزين بعامل عشري: راجع الفاصلة العشرية — ضوابط رقم (4) خامساً/ب/2">
                          <bdi dir="ltr">{unitOutlier.direction === 'high' ? '×' : '÷'}{10 ** Math.abs(Math.round(Math.log10(unitOutlier.factor)))}</bdi> عن بقية المجهزين
                        </span>
                      )}
                    </td>

                    {/* Bidder Total Amount (مبلغ المجهز الإجمالي) — تصحيح قراءة؛ مسحه يمسح سعر المفرد معه */}
                    <td className="p-2 text-center border-l border-slate-200 bg-indigo-50/60 font-mono font-black text-indigo-950 text-xs">
                      {asSub ? (
                        <>
                        <span className="font-mono font-black text-xs text-slate-800">{sub.total > 0 ? displayAmount(sub.total) : '-'}</span>
                        {item.readCorrected && (() => {
                          const before = readingBeforeCorrection(item, bidderId, auditLogs);
                          return (
                            <div className="print:hidden mt-0.5 text-[10px] leading-tight font-bold text-slate-500">
                              صُحّحت القراءة بمطابقة الورقة
                              {before && <> (قُرئ {before.field === 'unitPrice' ? 'المفرد' : 'المبلغ'}: <bdi dir="ltr" className="font-mono">{displayAmount(before.value)}</bdi>)</>}
                            </div>
                          );
                        })()}
                        </>
                      ) : locked ? <OfferAmountCell item={item} /> : (
                        <>
                        <AmountInput
                          value={item.bidderTotal}
                          onChange={(v) => onCorrectReading(actualIndex, 'total', v)}
                          label={`مبلغ المجهز للفقرة ${item.itemNo}`}
                          className={`w-full min-w-[6rem] text-center rounded-lg p-1.5 font-mono font-black text-xs shadow-2xs border focus:ring-2 ${
                            corrected ? 'bg-emerald-50 border-emerald-400 text-emerald-950 focus:ring-emerald-500' : 'bg-white border-indigo-300 text-indigo-950 focus:ring-indigo-500'
                          }`}
                        />
                        {/* فقرة مصحَّحة: رقم اللجنة، وتحته رقم المجهز كما قدّمه مشطوباً */}
                        {corrected && sub.total > 0 && sub.total !== item.bidderTotal && (
                          <div className="text-[10px] text-slate-500 line-through font-mono mt-0.5" title="مبلغ المجهز كما قدّمه قبل تصحيح اللجنة">{displayAmount(sub.total)}</div>
                        )}
                        </>
                      )}
                    </td>

                    {!auditMode && (<>
                    {/* Estimated Total (المبلغ التخميني) — يُصفَّر المفرد التخميني معه فيعيد calculateBOQMetrics اشتقاقه
                        من المبلغ والكمية: كان يبقى مفرد المبلغ القديم في تصدير Excel، ومسح المبلغ يُعيده المفرد × الكمية */}
                    <td className="p-2 text-center border-l border-slate-200 bg-blue-50/40">
                      <AmountInput
                        value={item.estimatedTotal}
                        onChange={(v) => onUpdateFields(actualIndex, { estimatedTotal: v, estimatedUnitPrice: 0 })}
                        label={`المبلغ التخميني للفقرة ${item.itemNo}`}
                        readOnly={sharedReadOnly}
                        className="w-full min-w-[6rem] text-center bg-white border border-blue-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 rounded-lg p-1.5 font-mono font-black text-blue-900 text-xs shadow-2xs"
                      />
                    </td>

                    {/* Forensic Math & Text Audit Column */}
                    {/* عمود التدقيق: في عرض التدقيق وحده */}
                    </>)}
                    {auditMode && (
                    <td className="p-2 text-xs leading-tight">
                      {asSub ? (<>
                        {sub.writtenText
                          ? <div className="text-slate-800 font-semibold text-[11px] leading-relaxed">{sub.writtenText}</div>
                          : <span className="text-slate-400 font-bold text-[11px]">لا تفقيط مقروء</span>}
                        {subFlags && (subFlags.hasMathError || subFlags.hasTextDiscrepancy) && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {subFlags.hasMathError && <span className="text-[10px] font-black text-rose-800 bg-rose-50 border border-rose-400 rounded-full px-2 py-0.5">🚨 خطأ ضرب</span>}
                            {subFlags.hasTextDiscrepancy && <span className="text-[10px] font-black text-amber-800 bg-amber-50 border border-amber-400 rounded-full px-2 py-0.5">⚠️ تعارض تفقيط</span>}
                          </div>
                        )}
                      </>) : (
                        <AuditCell
                          item={item}
                          index={actualIndex}
                          editingText={editingTextId === item.id}
                          onEditText={setEditingTextId}
                          onUpdateFields={onUpdateFields}
                          onCorrectReading={onCorrectReading}
                          onAdoptTafqeetThousands={onAdoptTafqeetThousands}
                          onMarkUnreasonable={onMarkUnreasonable}
                          onMarkBidderSigned={onMarkBidderSigned}
                          onAcceptAsReading={onAcceptAsReading}
                          onReadingFromPaper={onReadingFromPaper}
                          onConfirmReadCheck={onConfirmReadCheck}
                        />
                      )}
                      {handled && (
                        <div className="mt-1 inline-block text-[11px] font-black text-emerald-800 bg-emerald-50 border border-emerald-400 rounded px-1.5">✓ عولجت</div>
                      )}
                    </td>
                    )}

                    {!auditMode && hasEstimate && (<>
                    {/* Deviation % */}
                    <td className="p-2 text-center border-l border-slate-200">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black ${
                        isDeviated 
                          ? 'bg-rose-100 text-rose-800 border border-rose-300' 
                          : isSaving 
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        {item.estimatedTotal > 0 
                          ? `${view.deviationPercent > 0 ? '+' : ''}${view.deviationPercent.toFixed(2)}%`
                          : '-'}
                      </span>
                      {/* نسبة مبلغ المجهز الأصلي تحت نسبة العرض مشطوبة، كما يفعل عمود المبلغ، فيبقى سبب التوزين ظاهراً */}
                      {locked && item.estimatedTotal > 0 && isOfferEdited(item) && (
                        <div className="text-[10px] text-slate-500 line-through font-mono mt-0.5" title="نسبة انحراف مبلغ المجهز قبل العرض الموزون">
                          {item.deviationPercent > 0 ? '+' : ''}{item.deviationPercent.toFixed(2)}%
                        </div>
                      )}
                    </td>

                    {/* Weighted Unit Price */}
                    <td className="p-2 text-center font-black text-purple-950 border-l border-slate-200 bg-purple-50/20 text-xs font-mono">
                      {item.estimatedTotal > 0 ? formatNumber(item.weightedUnitPrice) : '-'}
                      {item.weightedAdjustment ? <div className="text-[10px] text-purple-700" title="سُوّي التقريب ليساوي مجموع الأسعار الموزونة مبلغ العطاء">سُوّي التقريب ({item.weightedAdjustment > 0 ? '+' : ''}{item.weightedAdjustment})</div> : null}
                    </td>

                    {/* Evaluation Badge */}
                    <td className="p-2 text-center border-l border-slate-200">
                      {item.estimatedTotal === 0 ? (
                        <span className="text-[11px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
                          بانتظار التخميني
                        </span>
                      ) : isDeviated ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-black text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                          <AlertTriangle className="w-3 h-3 text-rose-600" />
                          منحرفة {view.deviationPercent < 0 ? '(للأقل)' : '(للأعلى)'}
                        </span>
                      ) : view.deviationPercent < 0 ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          مطابق (للأقل ↓)
                        </span>
                      ) : view.deviationPercent > 0 ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-black text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                          <CheckCircle2 className="w-3 h-3 text-blue-600" />
                          مطابق (للأعلى ↑)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-black text-slate-700 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200">
                          <CheckCircle2 className="w-3 h-3 text-slate-600" />
                          مطابق تماماً
                        </span>
                      )}
                    </td>
                    </>)}

                    {/* Actions */}
                    {!auditMode && (
                    <td className="p-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => onDuplicateItem(actualIndex)}
                          className="p-1 text-slate-400 hover:text-indigo-600 rounded transition cursor-pointer"
                          title="تكرار الفقرة"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onDeleteItem(actualIndex)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded transition cursor-pointer"
                          title="حذف الفقرة"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                    )}

                  </tr>
                );
              })}
            </tbody>

            {/* Table Footer Totals */}
            <tfoot className={`bg-slate-900 text-white font-black text-xs z-10 shadow-lg ${auditMode ? '' : 'sticky bottom-0'}`}>
              <tr>
                <td colSpan={3} className="p-3 text-center border-l border-slate-800">
                  المجموع الكلي ({items.length} فقرة)
                </td>
                <td className="p-3 text-center border-l border-slate-800 font-mono text-slate-400">
                  -
                </td>
                <td className="p-3 text-center border-l border-slate-800 font-mono text-indigo-300 text-xs">
                  {(asSub ? submittedTotal(items) : locked ? items.reduce((s, i) => s + (i.offerTotal ?? i.bidderTotal), 0) : items.reduce((s, i) => s + i.bidderTotal, 0)).toLocaleString()} د.ع
                </td>
                {auditMode ? (
                  <td className="p-3 text-right text-amber-300">
                    {pendingItems.length > 0 ? `⚠ (${pendingItems.length}) فقرة تحتاج مراجعة واعتماد تصحيح` : 'كافة الفقرات سليمة ✓'}
                  </td>
                ) : (<>
                <td className="p-3 text-center border-l border-slate-800 font-mono text-blue-300 text-xs">
                  {items.reduce((s, i) => s + i.estimatedTotal, 0).toLocaleString()} د.ع
                </td>
                {hasEstimate && (
                  <td className="p-3 text-center border-l border-slate-800 font-mono text-rose-300">
                    {`${(((items.reduce((s, i) => s + (locked ? i.offerTotal ?? i.bidderTotal : i.bidderTotal), 0) - items.reduce((s, i) => s + i.estimatedTotal, 0)) / (items.reduce((s, i) => s + i.estimatedTotal, 0) || 1)) * 100).toFixed(2)}%`}
                  </td>
                )}
                <td colSpan={hasEstimate ? 3 : 1} className="p-3 text-center font-mono text-slate-400">
                  -
                </td>
                </>)}
              </tr>
            </tfoot>

          </table>
        </div>

      </div>

    </div>
  );
};

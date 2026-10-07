import { parseArabicTextToNumber, writtenAmountTarget } from '../utils/bidderAuditEngine';
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
  Pencil
} from 'lucide-react';
import { BOQItem, TenderTotals, ReadingField } from '../types/tender';
import { formatNumber, parseArabicNumber } from '../utils/calculations';

// حقل مبلغ يعرض فواصل الآلاف (60,000,000) خارج التعديل والرقم المجرد أثناء الكتابة: بلا فواصل كان
// 60000000 يشتبه بـ 6000000. يقبل الأرقام العربية والفواصل الملصوقة عبر parseArabicNumber.
// يُعتمد الرقم عند مغادرة الحقل أو Enter (وEscape يلغي)، لا مع كل حرف: كل اعتماد يُعيد فحص الفقرة
// ويُسجَّل، وقد يطلب تأكيداً، وكان كل حرف يُسجَّل تعديلاً مستقلاً
const AmountInput: React.FC<{ value: number; onChange: (v: number) => void; className: string; label: string; placeholder?: string }> = ({ value, onChange, className, label, placeholder = '0.00' }) => {
  const [draft, setDraft] = useState<string | null>(null);
  const cancelled = useRef(false);
  return (
    <input
      type="text"
      inputMode="decimal"
      dir="ltr"
      aria-label={label}
      value={draft ?? (value ? formatNumber(value, Number.isInteger(value) ? 0 : 2) : '')}
      onFocus={() => { cancelled.current = false; setDraft(value ? String(value) : ''); }}
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
      className={className}
    />
  );
};

// تصحيح قراءة التفقيط: يُعتمد النص عند مغادرة الحقل أو Enter، وEscape يلغي. يُكتب كما في العطاء ولا
// يُولَّد من الرقم، لأن المكتوب كتابةً هو ما يُعتد به (ضوابط رقم (4) خامساً/ب/1).
// onDone يُبلغ إن انتهى التعديل من لوحة المفاتيح، ليعيد الجدول التركيز إلى زر القلم بدل ضياعه
const WrittenTextInput: React.FC<{ value: string; onCommit: (v: string) => void; onDone: (byKeyboard: boolean) => void }> = ({ value, onCommit, onDone }) => {
  const [draft, setDraft] = useState(value);
  const cancelled = useRef(false);
  const byKeyboard = useRef(false);
  return (
    <textarea
      autoFocus
      dir="rtl"
      rows={2}
      value={draft}
      aria-label="نص التفقيط كما في العطاء"
      placeholder="المبلغ كتابةً كما في العطاء"
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); byKeyboard.current = true; e.currentTarget.blur(); }
        if (e.key === 'Escape') { cancelled.current = true; byKeyboard.current = true; e.currentTarget.blur(); }
      }}
      onBlur={() => {
        if (!cancelled.current && draft.trim() !== value.trim()) onCommit(draft);
        onDone(byKeyboard.current);
      }}
      className="w-full field-sizing-content min-h-[2.5rem] bg-white border border-indigo-400 font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-lg px-2 py-1 text-[11px] leading-relaxed resize-y"
    />
  );
};

// adding: فقرة بلا تفقيط (أغفلته القراءة، أو مُسح لأنها اختلقته)، فيُضاف كما في العطاء
const EditTextButton: React.FC<{ rowId: string; itemNo: number | string; onClick: () => void; adding?: boolean }> = ({ rowId, itemNo, onClick, adding }) => (
  <button
    type="button"
    onClick={onClick}
    data-edit-text={rowId}
    className="shrink-0 p-0.5 rounded text-slate-500 hover:text-indigo-700 hover:bg-white transition cursor-pointer"
    title={adding
      ? 'إضافة المبلغ كتابةً كما في العطاء إن أغفلته القراءة، فيُعاد فحص الفقرة'
      : 'تصحيح قراءة التفقيط إن خالف نص العطاء، فيُعاد فحص الفقرة'}
    aria-label={`${adding ? 'إضافة التفقيط' : 'تصحيح قراءة التفقيط'} للفقرة ${itemNo}`}
  >
    <Pencil className="w-3 h-3" />
  </button>
);

// وصف الفقرة: يظهر ملفوفاً حتى ثلاثة أسطر من أوله (كان سطراً واحداً مقصوصاً)، والنقر عليه يفتح
// حقل تعديل يعرض النص كاملاً. dir="auto" يُظهر الوصف الإنجليزي من اليسار بترتيبه الصحيح
const DescriptionCell: React.FC<{ value: string; onChange: (v: string) => void }> = ({ value, onChange }) => {
  const [editing, setEditing] = useState(false);
  if (editing) {
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
      onClick={() => setEditing(true)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setEditing(true); } }}
      className="line-clamp-3 font-bold text-slate-900 text-xs leading-relaxed px-1.5 py-1 rounded cursor-text hover:bg-white focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
    >
      {value}
    </div>
  );
};

interface BOQTableProps {
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
  onAddItem: () => void;
  onDeleteItem: (index: number) => void;
  onDuplicateItem: (index: number) => void;
  onClearBidderPrices?: () => void;
  onOpenSmartImport?: () => void;
}

export const BOQTable: React.FC<BOQTableProps> = ({
  items,
  deviationThreshold,
  bidderName,
  onUpdateItem,
  onUpdateFields,
  onCorrectReading,
  onAddItem,
  onDeleteItem,
  onDuplicateItem,
  onClearBidderPrices,
  onOpenSmartImport
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  // الفقرة التي يُصحَّح نص تفقيطها الآن (بمعرّفها)
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<'all' | 'deviated' | 'savings' | 'errors'>('all');

  // ارتفاع شريط الشركة المثبت يُقاس فعلياً (قد يلتف اسم شركة طويل إلى سطرين)، لتثبت
  // عناوين الأعمدة تحته مباشرة على الشاشات العريضة دون أن تختفي خلفه
  const barRef = useRef<HTMLDivElement>(null);
  const [barHeight, setBarHeight] = useState(76);
  useEffect(() => {
    const bar = barRef.current;
    if (!bar || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setBarHeight(Math.round(bar.getBoundingClientRect().height)));
    ro.observe(bar);
    return () => ro.disconnect();
  }, []);

  // أعمدة الانحراف والمفرد الموزون والتقييم لا معنى لها قبل إدخال الكلفة التخمينية (كانت تكرر «-»
  // و«بانتظار التخميني» في كل صف)، فتُخفى ويُعرض بدلها تنبيه واحد فوق الجدول
  const hasEstimate = items.some(i => i.estimatedTotal > 0);

  // إحصائيات الأخطاء الحسابية وتعارض التفقيط
  const itemsWithErrors = items.filter(i => i.hasMathError || i.hasTextDiscrepancy);
  const mathErrorsCount = items.filter(i => i.hasMathError).length;
  const textErrorsCount = items.filter(i => i.hasTextDiscrepancy).length;

  // فلترة الأسطر
  const filteredItems = items.filter(item => {
    const matchSearch = 
      String(item.itemNo).toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.writtenText && item.writtenText.toLowerCase().includes(searchTerm.toLowerCase()));

    if (!matchSearch) return false;

    if (filterMode === 'deviated') return item.isDeviated;
    if (filterMode === 'savings') return item.diffAmount < 0;
    if (filterMode === 'errors') return item.hasMathError || item.hasTextDiscrepancy;
    return true;
  });

  return (
    <div className="space-y-4" style={{ '--bidder-bar-h': `${barHeight}px` } as React.CSSProperties}>

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
          {/* مدخل استيراد واحد لكل أنواع الملفات (كان زرّين: Excel/Word، وصورة/PDF): تُختار فيه نوع الجدول
              (المجهز أو الكلفة التخمينية) أولاً، ثم يُوجَّه الملف لمطابقة الأعمدة أو للقراءة بالذكاء الاصطناعي */}
          {onOpenSmartImport && (
            <button
              onClick={onOpenSmartImport}
              className="flex items-center gap-1.5 bg-gradient-to-r from-indigo-700 to-blue-700 hover:from-indigo-600 hover:to-blue-600 text-white text-xs font-black px-3.5 py-2 rounded-xl shadow-md transition transform active:scale-95 cursor-pointer border border-indigo-400/30"
              title="استيراد جدول أسعار المجهز أو الكلفة التخمينية من ملف Excel أو PDF أو صورة، أو بلصق جدول من Word"
            >
              <FileSpreadsheet className="w-4 h-4 text-indigo-200" />
              <span>استيراد جدول <bdi dir="ltr">(Excel / Word / PDF)</bdi> أو صورة</span>
            </button>
          )}
          {onClearBidderPrices && (
            <button
              onClick={onClearBidderPrices}
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-bold px-3.5 py-2 rounded-xl border border-amber-400/30 transition cursor-pointer"
              title="تصفير مبالغ هذا المجهز لإعادة إدخالها مع الحفاظ على التخميني والفقرات"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>تصفير مبالغ المجهز</span>
            </button>
          )}
        </div>

      </div>

      {/* Forensic Audit Warning Banner (When Math or Text Errors are Detected) */}
      {itemsWithErrors.length > 0 && (
        <div className="bg-gradient-to-r from-rose-500/20 via-amber-500/15 to-transparent border-2 border-rose-400 p-4 sm:p-5 rounded-3xl flex flex-wrap items-center justify-between gap-4 text-xs shadow-md">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-rose-600 text-white rounded-2xl font-black text-sm shrink-0 flex items-center gap-2 shadow-sm">
              <AlertTriangle className="w-5 h-5" />
              <span>تدقيق حسابي وقانوني</span>
            </div>
            <div>
              <div className="font-black text-rose-950 text-sm sm:text-base flex items-center gap-2">
                تم اكتشاف ({itemsWithErrors.length}) أخطاء في عطاء ({bidderName}):
                <span className="text-xs bg-rose-600 text-white px-2 py-0.5 rounded-md font-bold">
                  {mathErrorsCount} خطأ ضرب • {textErrorsCount} تعارض تفقيط
                </span>
              </div>
              <p className="text-rose-900 text-xs mt-1 leading-relaxed">
                قام النظام بتأشير هذه الأخطاء فقط دون أي تصحيح تلقائي أو صامت للأرقام الأصلية المدونة من قبل مقدم العطاء. اعتماد التصحيح (بحاصل الضرب أو بالمكتوب كتابةً) قرار صريح تتخذه اللجنة يدوياً لكل فقرة.
                وإن كان الخطأ في قراءة العطاء لا في العطاء نفسه، فصحّح الرقم أو التفقيط في خانته كما في الأصل، فيُعاد فحص الفقرة.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setFilterMode(filterMode === 'errors' ? 'all' : 'errors')}
              className={`px-4 py-2 rounded-xl font-black text-xs border transition cursor-pointer ${
                filterMode === 'errors'
                  ? 'bg-rose-700 text-white border-rose-800 shadow-sm'
                  : 'bg-white text-rose-900 border-rose-300 hover:bg-rose-50'
              }`}
            >
              {filterMode === 'errors' ? 'عرض كافة الفقرات' : `عرض الفقرات الخاطئة فقط (${itemsWithErrors.length})`}
            </button>
          </div>
        </div>
      )}

      {/* Main Table Container */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden xl:overflow-clip" id="boq-table-container">
        
        {/* Table Toolbar */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          
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

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setFilterMode('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer ${
                filterMode === 'all' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              الكل ({items.length})
            </button>

            {itemsWithErrors.length > 0 && (
              <button
                onClick={() => setFilterMode('errors')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1 ${
                  filterMode === 'errors' ? 'bg-rose-600 text-white shadow-xs' : 'bg-rose-50 text-rose-800 border border-rose-300 hover:bg-rose-100'
                }`}
              >
                <AlertTriangle className="w-3 h-3 text-rose-600" />
                <span>أخطاء العطاء ({itemsWithErrors.length})</span>
              </button>
            )}

            <button
              onClick={() => setFilterMode('deviated')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer ${
                filterMode === 'deviated' ? 'bg-rose-600 text-white shadow-xs' : 'bg-white text-rose-800 border border-rose-200 hover:bg-rose-50'
              }`}
            >
              المنحرفة &gt; {deviationThreshold}% ({items.filter(i => i.isDeviated).length})
            </button>

            <button
              onClick={() => setFilterMode('savings')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer ${
                filterMode === 'savings' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-white text-emerald-800 border border-emerald-200 hover:bg-emerald-50'
              }`}
            >
              مطابقة ({items.filter(i => i.diffAmount < 0).length})
            </button>
          </div>

          {/* Add Row Button */}
          <button
            onClick={onAddItem}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black px-4 py-2 rounded-xl shadow-xs transition transform active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ إضافة فقرة</span>
          </button>
        </div>

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
            
            <thead className="bg-slate-900 text-slate-100 uppercase text-xs font-black sticky top-0 xl:top-[calc(81px+var(--bidder-bar-h))] z-20 shadow-xs select-none">
              <tr>
                <th className="p-3 w-12 text-center border-l border-slate-800">ت</th>
                <th className="p-3 min-w-[200px] border-l border-slate-800">اسم المادة / وصف الفقرة ✏️</th>
                <th className="p-3 w-20 text-center border-l border-slate-800 bg-slate-800">العدد ✏️</th>
                <th className="p-3 w-32 text-center border-l border-slate-800 bg-indigo-950 text-indigo-200">سعر المفرد للمجهز ✏️</th>
                <th className="p-3 w-36 text-center border-l border-slate-800 bg-indigo-900 text-indigo-100">مبلغ المجهز الإجمالي 💰</th>
                <th className="p-3 w-32 text-center border-l border-slate-800 bg-blue-950 text-blue-200">المبلغ التخميني ✏️</th>
                <th className="p-3 min-w-[180px] border-l border-slate-800 bg-amber-950 text-amber-200">تدقيق الأخطاء الحسابية والتفقيط</th>
                {hasEstimate && (
                  <>
                    <th className="p-3 w-28 text-center border-l border-slate-800">نسبة الانحراف %</th>
                    <th className="p-3 w-32 text-center border-l border-slate-800 bg-purple-950 text-purple-200">المفرد الموزون</th>
                    <th className="p-3 w-28 text-center border-l border-slate-800">التقييم</th>
                  </>
                )}
                <th className="p-3 w-16 text-center">حذف</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200 bg-white font-medium">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={hasEstimate ? 11 : 8} className="p-12 text-center text-slate-400 font-bold bg-slate-50/50">
                    <div className="max-w-md mx-auto space-y-2">
                      <p className="text-base text-slate-700 font-black">الجدول فارغ حالياً</p>
                      <p className="text-xs text-slate-500">
                        استورد جدول الإكسل من الأعلى عبر <strong>[ استيراد جدول (Excel / Word) ]</strong> أو انقر <strong>(+ إضافة فقرة)</strong>.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : filteredItems.map((item) => {
                const actualIndex = items.findIndex(i => i.id === item.id);
                const isDeviated = item.isDeviated;
                const isSaving = item.diffAmount < 0;
                const hasError = item.hasMathError || item.hasTextDiscrepancy;

                // فقرة بلا مفرد مدون (جدول بلا عمود للمفرد، أو مُسح مفردها تصحيحاً للقراءة): يظهر المبلغ ÷ الكمية
                // باهتاً في مكان الرقم لا رقماً مدوناً، فلا يُظن مقروءاً من العطاء ولا يبدو المسح كأنه لم يقع
                const recordedUnitPrice = item.enteredUnitPrice && item.enteredUnitPrice > 0 ? item.enteredUnitPrice : 0;
                const derivedUnitPrice = item.quantity > 0 ? item.bidderTotal / item.quantity : 0;

                return (
                  <tr 
                    key={item.id} 
                    className={`hover:bg-blue-50/50 transition group ${
                      hasError ? 'bg-rose-50/50' : isDeviated ? 'bg-rose-50/20' : isSaving ? 'bg-emerald-50/15' : ''
                    }`}
                  >
                    {/* Item No
                        الحد الأدنى للعرض يمنع المتصفح من تضييق العمود: كان «1.15» يظهر «15» */}
                    <td className="p-2 text-center font-black text-slate-700 border-l border-slate-200 bg-slate-50/80">
                      <input
                        type="text"
                        value={item.itemNo}
                        onChange={(e) => onUpdateItem(actualIndex, 'itemNo', e.target.value)}
                        className="w-full min-w-[3.5rem] text-center bg-transparent focus:bg-white focus:ring-2 focus:ring-indigo-500 rounded p-1 font-mono font-black"
                      />
                    </td>

                    {/* Description */}
                    <td className="p-2 border-l border-slate-200">
                      <DescriptionCell
                        value={item.description}
                        onChange={(v) => onUpdateItem(actualIndex, 'description', v)}
                      />
                    </td>

                    {/* Quantity — تصحيح قراءة مشترك: يُعاد فحص الفقرة لدى كل المجهزين، ولا تتغير مبالغهم المدونة
                        (كانت الكمية تُعيد بناء مبلغ المجهز النشط من المفرد فتُخفي الفرق) */}
                    <td className="p-2 text-center border-l border-slate-200 bg-slate-50/50">
                      <AmountInput
                        value={item.quantity || 1}
                        onChange={(v) => onCorrectReading(actualIndex, 'quantity', v || 1)}
                        label={`كمية الفقرة ${item.itemNo}`}
                        placeholder="1"
                        className="w-16 text-center bg-white border border-slate-200 rounded-lg p-1 font-mono font-black text-slate-800 text-xs shadow-2xs focus:ring-1 focus:ring-indigo-500"
                      />
                    </td>

                    {/* Bidder Unit Price (سعر المفرد)
                        حقول المبالغ الثلاثة بحد أدنى للعرض: بدونه يضيّق المتصفح أعمدتها حتى عرض كلمة العنوان،
                        فيُقص أول الرقم (60000000 كان يظهر 0000) ويبدو كأن القراءة خاطئة.
                        تعديل المفرد تصحيح قراءة لا يمس المبلغ المدون إلا إن كان فارغاً (handleCorrectReading) */}
                    <td className="p-2 text-center border-l border-slate-200 bg-indigo-50/30">
                      <AmountInput
                        value={recordedUnitPrice}
                        onChange={(newUnit) => onCorrectReading(actualIndex, 'unitPrice', newUnit)}
                        label={`سعر المفرد للفقرة ${item.itemNo}`}
                        placeholder={derivedUnitPrice > 0 ? formatNumber(derivedUnitPrice, Number.isInteger(derivedUnitPrice) ? 0 : 2) : '0.00'}
                        className="w-full min-w-[7rem] text-center bg-white border border-indigo-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 rounded-lg p-1.5 font-mono font-black text-indigo-950 text-xs shadow-2xs"
                      />
                    </td>

                    {/* Bidder Total Amount (مبلغ المجهز الإجمالي) — تصحيح قراءة؛ مسحه يمسح سعر المفرد معه */}
                    <td className="p-2 text-center border-l border-slate-200 bg-indigo-50/60 font-mono font-black text-indigo-950 text-xs">
                      <AmountInput
                        value={item.bidderTotal}
                        onChange={(v) => onCorrectReading(actualIndex, 'total', v)}
                        label={`مبلغ المجهز للفقرة ${item.itemNo}`}
                        className="w-full min-w-[7rem] text-center bg-white border border-indigo-300 focus:ring-2 focus:ring-indigo-500 rounded-lg p-1.5 font-mono font-black text-indigo-950 text-xs shadow-2xs"
                      />
                    </td>

                    {/* Estimated Total (المبلغ التخميني) — يُصفَّر المفرد التخميني معه فيعيد calculateBOQMetrics اشتقاقه
                        من المبلغ والكمية: كان يبقى مفرد المبلغ القديم في تصدير Excel، ومسح المبلغ يُعيده المفرد × الكمية */}
                    <td className="p-2 text-center border-l border-slate-200 bg-blue-50/40">
                      <AmountInput
                        value={item.estimatedTotal}
                        onChange={(v) => onUpdateFields(actualIndex, { estimatedTotal: v, estimatedUnitPrice: 0 })}
                        label={`المبلغ التخميني للفقرة ${item.itemNo}`}
                        className="w-full min-w-[7rem] text-center bg-white border border-blue-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 rounded-lg p-1.5 font-mono font-black text-blue-900 text-xs shadow-2xs"
                      />
                    </td>

                    {/* Forensic Math & Text Audit Column */}
                    <td className="p-2 border-l border-slate-200 text-xs leading-tight">
                      <div className="space-y-1.5">

                        {/* 1. خطأ الضرب الحسابي (أحمر) */}
                        {item.hasMathError && (
                          <div className="bg-rose-100 text-rose-950 border border-rose-300 px-2.5 py-1.5 rounded-lg font-bold flex flex-col gap-1 shadow-2xs">
                            <div className="flex items-start gap-1.5">
                              <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                              <div>
                                <span className="font-black text-rose-900">🚨 خطأ ضرب:</span> المدون في العطاء ({item.enteredBidderTotal?.toLocaleString() || item.bidderTotal.toLocaleString()} د.ع) ≠ حاصل (المفرد {item.enteredUnitPrice?.toLocaleString()} × {item.quantity} = {((item.enteredUnitPrice || 0) * (item.quantity || 1)).toLocaleString()} د.ع)
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 mt-1 mr-5">
                              <button
                                onClick={() => {
                                  // التصحيح وإزالة العلامة في تعديل واحد: كانا تعديلين فيلغي الثاني الأول،
                                  // فتختفي العلامة ويبقى المبلغ الخاطئ
                                  const mathCorrect = (item.enteredUnitPrice || 0) * (item.quantity || 1);
                                  onUpdateFields(actualIndex, { bidderTotal: mathCorrect, hasMathError: false },
                                    'اعتماد تصحيح خطأ الضرب بقرار اللجنة');
                                }}
                                className="bg-rose-700 hover:bg-rose-800 text-white text-[10px] font-black px-2 py-0.5 rounded shadow-2xs transition cursor-pointer"
                                title="تصحيح مبلغ الفقرة لحاصل ضرب المفرد في الكمية"
                              >
                                🔢 اعتماد حاصل الضرب ({((item.enteredUnitPrice || 0) * (item.quantity || 1)).toLocaleString()})
                              </button>
                            </div>
                          </div>
                        )}

                        {/* 2. تعارض وتناقض التفقيط (برتقالي / كهرماني)
                            المكتوب كتابةً هو المعتمد (ضوابط رقم (4) خامساً/ب/1). التفقيط قد يكون لسعر المفرد فيكون
                            المبلغ حاصل ضربه بالكمية (خامساً/ب/2)، أو لمبلغ الفقرة. الأرقام وحدها لا تحسم أيهما (الرقم
                            المدون نفسه قد يكون الخاطئ)، فحين يحتمل الأمرين يُعرض زران وتختار اللجنة، ويُبرز الأرجح.
                            كان زر واحد يجعل قيمة تفقيط المفرد مبلغاً للفقرة كلها.
                            أثناء تصحيح قراءة التفقيط يحل حقل التعديل محل مربعه (المتعارض أو المطابق)، وتختفي أزرار
                            الاعتماد لأنها مبنية على النص القديم */}
                        {editingTextId === item.id && (
                          <WrittenTextInput
                            value={item.writtenText || ''}
                            onCommit={(v) => onCorrectReading(actualIndex, 'writtenText', v)}
                            onDone={(byKeyboard) => {
                              setEditingTextId(null);
                              // بعد Enter أو Escape يعود التركيز إلى زر القلم، وإلا ضاع مع حذف الحقل
                              if (byKeyboard) requestAnimationFrame(() =>
                                document.querySelector<HTMLButtonElement>(`[data-edit-text="${item.id}"]`)?.focus());
                            }}
                          />
                        )}
                        {item.hasTextDiscrepancy && editingTextId !== item.id && (() => {
                          const written = item.writtenText ? parseArabicTextToNumber(item.writtenText) : null;
                          const qty = item.quantity || 1;
                          const unit = item.enteredUnitPrice || 0;
                          const enteredTotal = item.enteredBidderTotal || item.bidderTotal;
                          // كمية 1: المفرد هو المبلغ فلا فرق بين الاعتمادين
                          const ambiguous = written !== null && unit > 0 && qty !== 1;
                          const likelyUnit = ambiguous && writtenAmountTarget(written, unit, enteredTotal) === 'unit';
                          const adoptAsUnit = (logAction = 'اعتماد سعر المفرد المكتوب كتابةً بقرار اللجنة') => written && onUpdateFields(actualIndex, {
                            enteredUnitPrice: written,
                            bidderUnitPrice: written,
                            bidderTotal: written * qty,
                            hasTextDiscrepancy: false,
                            hasMathError: false
                          }, logAction);
                          // بلا مفرد مدون يُعتمد المبلغ وحده. ومع مفرد مدون وكمية 1 يُحدَّث المفرد مع المبلغ،
                          // وإلا بقي المفرد القديم فتعيد الكمية بناء المبلغ منه عند تعديلها
                          const adoptAsTotal = () => written && (unit > 0 && qty === 1
                            ? adoptAsUnit('اعتماد المبلغ المكتوب كتابةً بقرار اللجنة')
                            : onUpdateFields(actualIndex, { bidderTotal: written, hasTextDiscrepancy: false },
                              'اعتماد المبلغ المكتوب كتابةً بقرار اللجنة'));
                          const solid = 'bg-amber-700 hover:bg-amber-800 text-white';
                          const outline = 'bg-white hover:bg-amber-50 text-amber-900 border border-amber-500';
                          return (
                          <div className="bg-amber-100 text-amber-950 border border-amber-400 px-2.5 py-1.5 rounded-lg font-bold flex flex-col gap-1 shadow-2xs">
                            <div className="flex items-start gap-1.5">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
                              <div className="flex-1">
                                <span className="font-black text-amber-900">⚠️ تعارض تفقيط:</span> المكتوب كتابةً ({item.writtenText}) يختلف عن {ambiguous
                                  ? <>سعر المفرد المدون ({unit.toLocaleString()} د.ع) وعن مبلغ الفقرة المدون ({enteredTotal.toLocaleString()} د.ع)</>
                                  : <>الرقم المدون ({enteredTotal.toLocaleString()} د.ع)</>}
                              </div>
                              <EditTextButton rowId={item.id} itemNo={item.itemNo} onClick={() => setEditingTextId(item.id)} />
                            </div>
                            {written !== null && written > 0 && (
                            <div className="flex flex-wrap items-center gap-1.5 mt-1 mr-5">
                              {ambiguous ? (<>
                                <button
                                  onClick={() => adoptAsUnit()}
                                  className={`${likelyUnit ? solid : outline} text-[10px] font-black px-2 py-0.5 rounded shadow-2xs transition cursor-pointer`}
                                  title="التفقيط لسعر المفرد: يُعتمد مفرداً ويُضرب بالكمية، بقرار اللجنة"
                                >
                                  ⚖️ اعتماده سعراً للمفرد ({written.toLocaleString()} × {qty} = {(written * qty).toLocaleString()})
                                </button>
                                <button
                                  onClick={adoptAsTotal}
                                  className={`${likelyUnit ? outline : solid} text-[10px] font-black px-2 py-0.5 rounded shadow-2xs transition cursor-pointer`}
                                  title="التفقيط لمبلغ الفقرة: يُعتمد مبلغاً لها، بقرار اللجنة"
                                >
                                  ⚖️ اعتماده مبلغاً للفقرة ({written.toLocaleString()})
                                </button>
                              </>) : (
                                <button
                                  onClick={adoptAsTotal}
                                  className={`${solid} text-[10px] font-black px-2 py-0.5 rounded shadow-2xs transition cursor-pointer`}
                                  title="اعتماد المبلغ المكتوب كتابةً بعد موافقة اللجنة / الإدارة وفق التعليمات"
                                >
                                  ⚖️ اعتماد المكتوب كتابةً بموافقة اللجنة
                                </button>
                              )}
                            </div>
                            )}
                          </div>
                          );
                        })()}

                        {/* 3. التفقيط المطابق والسليم (أخضر) */}
                        {item.writtenText && !item.hasTextDiscrepancy && editingTextId !== item.id && (
                          <div className="bg-emerald-50 text-emerald-900 border border-emerald-300 px-2 py-0.5 rounded-lg text-[11px] font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                            <span className="flex-1"><strong className="text-emerald-950 font-bold">تفقيط مطابق:</strong> {item.writtenText}</span>
                            <EditTextButton rowId={item.id} itemNo={item.itemNo} onClick={() => setEditingTextId(item.id)} />
                          </div>
                        )}

                        {/* 4. فقرة بلا مبلغ (لم تُسعَّر في العطاء «-» أو لم تُدخل بعد): ليست «سليمة» بل تُراجع مع الأصل */}
                        {/* في هذا السطر وفي الحالتين 4 و5 لا تفقيط للفقرة: يُتاح إضافته بالقلم، وإلا تعذّر استدراك تفقيط
                            أغفلته القراءة أو مُسح خطأً */}
                        {!item.writtenText && item.hasMathError && editingTextId !== item.id && (
                          <div className="text-slate-500 font-bold flex items-center gap-1 text-[11px]">
                            <span className="flex-1">لا تفقيط مقروء للفقرة</span>
                            <EditTextButton rowId={item.id} itemNo={item.itemNo} adding onClick={() => setEditingTextId(item.id)} />
                          </div>
                        )}
                        {!item.hasMathError && !item.hasTextDiscrepancy && !item.writtenText && item.bidderTotal === 0 && editingTextId !== item.id && (
                          <div className="text-slate-500 font-bold flex items-center gap-1 text-[11px]">
                            <AlertTriangle className="w-3.5 h-3.5 text-slate-400" />
                            {/* unpriced: قرأ الاستخراج «-» في خانة السعر، أي أن العطاء نفسه لم يسعّرها */}
                            <span className="flex-1">{item.unpriced ? 'غير مسعّرة في العطاء («-») — راجِع الأصل' : 'لا مبلغ للمجهز — راجِع العطاء الأصلي'}</span>
                            <EditTextButton rowId={item.id} itemNo={item.itemNo} adding onClick={() => setEditingTextId(item.id)} />
                          </div>
                        )}

                        {/* 5. حالة السليم تماماً عند عدم وجود تفقيط أو أخطاء */}
                        {!item.hasMathError && !item.hasTextDiscrepancy && !item.writtenText && item.bidderTotal !== 0 && editingTextId !== item.id && (
                          <div className="text-emerald-700 font-bold flex items-center gap-1 text-[11px]">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="flex-1">سليم ومطابق حسابياً</span>
                            <EditTextButton rowId={item.id} itemNo={item.itemNo} adding onClick={() => setEditingTextId(item.id)} />
                          </div>
                        )}

                      </div>
                    </td>

                    {hasEstimate && (<>
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
                          ? `${item.deviationPercent > 0 ? '+' : ''}${item.deviationPercent.toFixed(2)}%`
                          : '-'}
                      </span>
                    </td>

                    {/* Weighted Unit Price */}
                    <td className="p-2 text-center font-black text-purple-950 border-l border-slate-200 bg-purple-50/20 text-xs font-mono">
                      {item.estimatedTotal > 0 ? formatNumber(item.weightedUnitPrice) : '-'}
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
                          منحرفة {item.deviationPercent < 0 ? '(للأقل)' : '(للأعلى)'}
                        </span>
                      ) : item.deviationPercent < 0 ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          مطابق (للأقل ↓)
                        </span>
                      ) : item.deviationPercent > 0 ? (
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

                  </tr>
                );
              })}
            </tbody>

            {/* Table Footer Totals */}
            <tfoot className="bg-slate-900 text-white font-black text-xs sticky bottom-0 z-10 shadow-lg">
              <tr>
                <td colSpan={3} className="p-3 text-center border-l border-slate-800">
                  المجموع الكلي ({items.length} فقرة)
                </td>
                <td className="p-3 text-center border-l border-slate-800 font-mono text-slate-400">
                  -
                </td>
                <td className="p-3 text-center border-l border-slate-800 font-mono text-indigo-300 text-sm whitespace-nowrap">
                  {items.reduce((s, i) => s + i.bidderTotal, 0).toLocaleString()} د.ع
                </td>
                <td className="p-3 text-center border-l border-slate-800 font-mono text-blue-300 text-sm whitespace-nowrap">
                  {items.reduce((s, i) => s + i.estimatedTotal, 0).toLocaleString()} د.ع
                </td>
                <td className="p-3 text-right border-l border-slate-800 text-amber-300">
                  {itemsWithErrors.length > 0 ? `⚠ (${itemsWithErrors.length}) فقرة تحتاج مراجعة واعتماد تصحيح` : 'كافة الفقرات سليمة ✓'}
                </td>
                {hasEstimate && (
                  <td className="p-3 text-center border-l border-slate-800 font-mono text-rose-300">
                    {`${(((items.reduce((s, i) => s + i.bidderTotal, 0) - items.reduce((s, i) => s + i.estimatedTotal, 0)) / (items.reduce((s, i) => s + i.estimatedTotal, 0) || 1)) * 100).toFixed(2)}%`}
                  </td>
                )}
                <td colSpan={hasEstimate ? 3 : 1} className="p-3 text-center font-mono text-slate-400">
                  -
                </td>
              </tr>
            </tfoot>

          </table>
        </div>

      </div>

    </div>
  );
};

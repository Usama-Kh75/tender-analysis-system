import { calculateBOQMetrics } from '../utils/calculations';
import { addAuditLog } from '../utils/storageService';
import { hasBidAmounts } from '../utils/recommendation';
import { exportBidderAuditToExcel } from '../utils/bidderAuditExcel';
import { isCommitteeCorrected } from '../utils/bidderAuditEngine';
import { Bidder, BOQItem, ReadingField, TenderProject } from '../types/tender';
import { EditContext } from './editContext';
import { READING_FIELD_LABELS, SHARED_ESTIMATE_FIELDS, withoutBidderPrices } from './itemFields';

export function createItemHandlers(ctx: EditContext) {
  const { currentProject, activeBidder, saveProject, commitBidder, blockedByOffer } = ctx;

  // Clear Bidder Prices Only
  const handleClearBidderPrices = () => {
    if (blockedByOffer({ bidderId: activeBidder.id })) return;
    if (!window.confirm(`هل أنت متأكد من رغبتك في تصفير مبالغ المجهز (${activeBidder.name}) للبدء في تعبئتها من جديد؟`)) {
      return;
    }

    const resetItems = activeBidder.items.map(withoutBidderPrices);

    const recalc = calculateBOQMetrics(resetItems, currentProject.deviationThreshold);

    const updatedBidder: Bidder = {
      ...activeBidder,
      items: recalc.items,
      totals: recalc.totals,
      statedTotal: undefined, // المبلغ المدون يخص العطاء الذي صُفّرت مبالغه
      weightedOffer: undefined // عرض موقوف بأسعار صُفّرت
    };

    const updatedBidders = currentProject.bidders.map(b => b.id === activeBidder.id ? updatedBidder : b);
    let updatedProj: TenderProject = {
      ...currentProject,
      bidders: updatedBidders,
      updatedAt: new Date().toISOString()
    };

    updatedProj = addAuditLog(
      updatedProj,
      'تصفير مبالغ مجهز',
      `تم تصفير مبالغ المجهز (${activeBidder.name})`
    );

    saveProject(updatedProj);
  };

  // Update Item — تعديل عدة حقول لفقرة واحدة دفعة واحدة: الحقول المشتركة (هوية الفقرة والكلفة التخمينية)
  // على كل المجهزين، وحقول السعر على المجهز النشط فقط.
  // التعديل المركّب (الكمية مع الإجمالي، أو التصحيح مع إزالة علامة الخطأ) يجب أن يُرسل هنا في استدعاء واحد:
  // استدعاءان متتاليان يُبنى كلاهما على المشروع نفسه قبل التعديل فيلغي الثاني الأول
  // (كان «اعتماد حاصل الضرب» يزيل علامة الخطأ ويترك المبلغ الخاطئ)
  const handleUpdateItemFields = (index: number, patch: Partial<BOQItem>, logAction?: string) => {
    const before = activeBidder.items[index];
    if (!before) return;
    const fields = Object.keys(patch) as (keyof BOQItem)[];
    // هوية الفقرة والملاحظات لا تغيّر أرقاماً، فلا يقفلها العرض الموزون
    const lockFree: (keyof BOQItem)[] = ['itemNo', 'description', 'unit', 'notes'];
    const priced = fields.filter(f => !lockFree.includes(f));
    if (priced.length > 0 && blockedByOffer({ bidderId: activeBidder.id, shared: priced.some(f => SHARED_ESTIMATE_FIELDS.includes(f)) })) return;
    const sharedPatch: Partial<BOQItem> = {};
    const ownPatch: Partial<BOQItem> = {};
    fields.forEach(f => {
      (SHARED_ESTIMATE_FIELDS.includes(f) ? sharedPatch : ownPatch as any)[f] = patch[f];
    });
    const hasShared = Object.keys(sharedPatch).length > 0;

    const updatedBidders = currentProject.bidders.map(b => {
      const isActive = b.id === activeBidder.id;
      if (!isActive && !hasShared) return b;
      if (!b.items[index]) return b;

      const updatedRaw = [...b.items];
      updatedRaw[index] = { ...updatedRaw[index], ...sharedPatch, ...(isActive ? ownPatch : {}) };
      const recalculation = calculateBOQMetrics(updatedRaw, currentProject.deviationThreshold);
      return { ...b, items: recalculation.items, totals: recalculation.totals };
    });

    let updatedProj: TenderProject = {
      ...currentProject,
      bidders: updatedBidders,
      updatedAt: new Date().toISOString()
    };

    fields.filter(f => ['estimatedTotal', 'bidderTotal', 'description'].includes(f as string)).forEach(f => {
      const isShared = SHARED_ESTIMATE_FIELDS.includes(f);
      updatedProj = addAuditLog(
        updatedProj,
        logAction || (isShared ? 'تعديل الكلفة التخمينية (مشتركة لكل المجهزين)' : 'تعديل قيمة مالية'),
        `تم تعديل حقل (${String(f)}) للفقرة رقم (${before.itemNo})${isShared ? '' : ` في عطاء (${activeBidder.name})`} من (${(before as any)[f]}) إلى (${(patch as any)[f]})`,
        { itemNo: before.itemNo, bidderId: isShared ? undefined : activeBidder.id, oldValue: (before as any)[f], newValue: (patch as any)[f] }
      );
    });

    saveProject(updatedProj);
  };

  const handleUpdateItem = (index: number, field: keyof BOQItem, val: any) =>
    handleUpdateItemFields(index, { [field]: val } as Partial<BOQItem>);

  // تصحيح قراءة: تعديل الكمية أو المفرد أو المبلغ أو التفقيط يدوياً في الجدول يُعدّ تصحيحاً لما قرأه الاستيراد
  // من العطاء، لا تصحيحاً حسابياً. فيصير الرقم الجديد هو «المدون» (enteredUnitPrice/enteredBidderTotal)،
  // وتُمسح علامتا التدقيق ليعيد calculateBOQMetrics حسابهما: كانت العلامتان القديمتان تبقيان، فيبقى تشخيص
  // بُني على رقم مقروء خطأً. لا يغيّر التعديل رقماً آخر (المفرد لا يمس المبلغ إلا إن كان فارغاً) كي لا يُخفي
  // خطأ ضرب وقع فيه المجهز. التصحيح الحسابي يبقى زراً صريحاً للجنة، وتعديل فقرة صحّحتها اللجنة يلغي تصحيحها
  // علناً بعد التأكيد، لأنه بُني على القراءة القديمة. الكمية مشتركة فيُعاد فحص فقرتها لدى كل المجهزين
  const handleCorrectReading = (index: number, field: ReadingField, value: number | string) => {
    const before = activeBidder.items[index];
    if (!before) return;
    if (blockedByOffer({ bidderId: activeBidder.id, shared: field === 'quantity' })) return;
    const isQuantity = field === 'quantity';
    const label = READING_FIELD_LABELS[field];
    const newValue = field === 'writtenText' ? (String(value).trim() || undefined)
      : field === 'unitPrice' ? ((value as number) || undefined)
      : (value as number);
    // لا تعديل إن ساوى الرقم ما في الخانة. أما «من» في السجل فهي ما دوّنه المجهز لا ما اعتمدته اللجنة:
    // كتابة المفرد الأصلي في فقرة اعتُمد تفقيطها كانت تُقارن بالأصل فلا يحدث شيء
    const shownValue = field === 'quantity' ? before.quantity
      : field === 'unitPrice' ? (before.enteredUnitPrice || undefined)
      : field === 'total' ? before.bidderTotal
      : before.writtenText;
    if (newValue === shownValue) return;
    const oldValue = field === 'unitPrice' ? ((before.originalUnitPrice ?? before.enteredUnitPrice) || undefined)
      : field === 'total' ? (before.enteredBidderTotal || before.bidderTotal)
      : field === 'writtenText' ? (before.originalWrittenText ?? shownValue)
      : shownValue;

    const affected = currentProject.bidders.filter(b => b.items[index] && (isQuantity || b.id === activeBidder.id));
    const corrected = affected.filter(b => isCommitteeCorrected(b.items[index]));
    const fmt = (v: unknown) => v === undefined || v === '' ? '—' : typeof v === 'number' ? v.toLocaleString('en-US') : String(v);
    // اعتماد التفقيط سعراً للمفرد يغيّر المفرد أيضاً، فيُذكر ويعود مع المبلغ
    const unitNote = (it: BOQItem) =>
      (it.originalUnitPrice !== undefined
        ? `، وسعر المفرد المعتمد (${fmt(it.enteredUnitPrice)}) والذي دوّنه المجهز (${fmt(it.originalUnitPrice)})` : '')
      + (it.originalWrittenText !== undefined
        ? `، والتفقيط المعتمد (${it.writtenText}) والذي كتبه المجهز (${it.originalWrittenText})` : '');

    if (corrected.length > 0) {
      const lines = corrected.map(b => {
        const it = b.items[index];
        return `• ${b.name}: المبلغ المعتمد (${fmt(it.bidderTotal)})، والذي دوّنه المجهز (${fmt(it.enteredBidderTotal)})${unitNote(it)}`;
      }).join('\n');
      const ok = window.confirm(
        `الفقرة رقم (${before.itemNo}) عليها تصحيح حسابي من اللجنة:\n${lines}\n\n`
        + `تعديل ${label} يُعدّ تصحيحاً لقراءة العطاء، والتصحيح بُني على القراءة القديمة فيُلغى: يعود مبلغ الفقرة وسعر مفردها `
        + `إلى ما دوّنه المجهز ثم يُعاد فحصها، ويُسجَّل الإلغاء في سجل التدقيق.\n\nهل تريد المتابعة؟`
      );
      if (!ok) return;
    }

    const updatedBidders = currentProject.bidders.map(b => {
      if (!affected.includes(b)) return b;
      const item = b.items[index];
      const restoredUnit = item.originalUnitPrice ?? item.enteredUnitPrice;
      const base: BOQItem = isCommitteeCorrected(item)
        ? {
          ...item, bidderTotal: item.enteredBidderTotal || 0, enteredUnitPrice: restoredUnit, bidderUnitPrice: restoredUnit || 0,
          originalUnitPrice: undefined,
          // التفقيط المعتمد بعد إضافة «آلاف» يعود إلى ما كتبه المجهز
          writtenText: item.originalWrittenText ?? item.writtenText, originalWrittenText: undefined,
          // توقيع المجهز كان إزاء التصحيح الملغى
          bidderSignedAt: undefined
        }
        : item;
      let patch: Partial<BOQItem>;
      if (field === 'quantity') {
        // المفرد التخميني يُصفَّر فيُشتق من المبلغ التخميني والكمية الجديدة، كما عند تعديل المبلغ التخميني:
        // كان يبقى مفرد الكمية القديمة (753.26 بدل 750 للفقرة 420) في تصدير Excel
        patch = { quantity: value as number, estimatedUnitPrice: 0 };
      } else if (field === 'unitPrice') {
        const unit = value as number;
        patch = { enteredUnitPrice: unit, bidderUnitPrice: unit, bidderTotal: base.bidderTotal || unit * (base.quantity || 1) };
      } else if (field === 'total') {
        // مسح المبلغ يمسح المفرد معه، وإلا أعاد calculateBOQMetrics بناءه من المفرد × الكمية
        patch = value === 0 ? { bidderTotal: 0, bidderUnitPrice: 0, enteredUnitPrice: 0 } : { bidderTotal: value as number };
      } else {
        patch = { writtenText: newValue as string | undefined };
      }
      const next: BOQItem = { ...base, ...patch };
      const updatedRaw = [...b.items];
      updatedRaw[index] = {
        ...next,
        enteredBidderTotal: next.bidderTotal || undefined,
        hasMathError: undefined,
        hasTextDiscrepancy: undefined,
        // كما في ImageOcrModal: إدخال سعر لفقرة قُرئت «-» يعني أنها مسعّرة
        unpriced: (field === 'unitPrice' || field === 'total') && (value as number) > 0 ? undefined : next.unpriced
      };
      const recalculation = calculateBOQMetrics(updatedRaw, currentProject.deviationThreshold);
      return { ...b, items: recalculation.items, totals: recalculation.totals };
    });

    let updatedProj: TenderProject = {
      ...currentProject,
      bidders: updatedBidders,
      updatedAt: new Date().toISOString()
    };
    corrected.forEach(b => {
      const it = b.items[index];
      updatedProj = addAuditLog(
        updatedProj,
        'إلغاء تصحيح اللجنة لتصحيح قراءة',
        `أُلغي التصحيح الحسابي للفقرة رقم (${before.itemNo}) في عطاء (${b.name}) لتصحيح قراءة ${label}: عاد مبلغها من (${fmt(it.bidderTotal)}) إلى ما دوّنه المجهز (${fmt(it.enteredBidderTotal)})${it.originalUnitPrice !== undefined ? `، وسعر مفردها من (${fmt(it.enteredUnitPrice)}) إلى (${fmt(it.originalUnitPrice)})` : ''}${it.bidderSignedAt ? '، وسقط معه تأشير توقيع المجهز إزاءه' : ''}`,
        { itemNo: before.itemNo, oldValue: it.bidderTotal, newValue: it.enteredBidderTotal }
      );
    });
    updatedProj = addAuditLog(
      updatedProj,
      'تصحيح قراءة',
      `تصحيح قراءة ${label} للفقرة رقم (${before.itemNo}) ${isQuantity ? '(مشتركة لكل المجهزين)' : `في عطاء (${activeBidder.name})`} من (${fmt(oldValue)}) إلى (${fmt(newValue)})، وأُعيد فحصها`,
      { itemNo: before.itemNo, oldValue, newValue }
    );

    saveProject(updatedProj);
  };

  // تفقيط ناقص كلمة «آلاف» (readMissingThousands): تعتمد اللجنة التفقيط بعد إضافتها. الأرقام لا تتغير لأنها توافق
  // التفقيط المعدَّل أصلاً، وما كتبه المجهز يُحفظ في originalWrittenText دليلاً، فيبقى الخطأ مؤشراً في «واقع الحال»
  // ويعود إليه تصحيح القراءة. التصحيح قرار اللجنة ويُبلَّغ به المجهز (ضوابط رقم (4) خامساً/ب/3)
  const handleAdoptTafqeetThousands = (index: number, correctedText: string) => {
    const before = activeBidder.items[index];
    if (!before?.writtenText || !correctedText) return;
    if (blockedByOffer({ bidderId: activeBidder.id })) return;
    const updatedRaw = [...activeBidder.items];
    updatedRaw[index] = {
      ...before,
      originalWrittenText: before.originalWrittenText ?? before.writtenText,
      writtenText: correctedText,
      hasTextDiscrepancy: undefined // يُعاد حسابها بالتفقيط المعتمد
    };
    const recalculation = calculateBOQMetrics(updatedRaw, currentProject.deviationThreshold);
    let updatedProj: TenderProject = {
      ...currentProject,
      bidders: currentProject.bidders.map(b => b.id === activeBidder.id
        ? { ...b, items: recalculation.items, totals: recalculation.totals } : b),
      updatedAt: new Date().toISOString()
    };
    updatedProj = addAuditLog(
      updatedProj,
      'اعتماد التفقيط بعد إضافة «آلاف» بقرار اللجنة',
      `اعتمدت اللجنة للفقرة رقم (${before.itemNo}) في عطاء (${activeBidder.name}) التفقيط (${correctedText}) بدل المكتوب (${before.originalWrittenText ?? before.writtenText}) بعد إضافة «آلاف» الناقصة؛ الأرقام المدونة لم تتغير`,
      { itemNo: before.itemNo, bidderId: activeBidder.id, oldValue: before.originalWrittenText ?? before.writtenText, newValue: before.bidderTotal }
    );
    saveProject(updatedProj);
  };

  // المبلغ الإجمالي المدون في العطاء (قبل التصحيح الحسابي): تملؤه قراءة Gemini، أو يدخله العضو من الأصل
  const handleUpdateStatedTotal = (value: number) => {
    const old = activeBidder.statedTotal;
    const next = value > 0 ? value : undefined;
    if (old === next) return;
    let updatedProj: TenderProject = {
      ...currentProject,
      bidders: currentProject.bidders.map(b => b.id === activeBidder.id ? { ...b, statedTotal: next } : b),
      updatedAt: new Date().toISOString()
    };
    updatedProj = addAuditLog(
      updatedProj,
      'تسجيل المبلغ المدون في العطاء',
      `المبلغ الإجمالي المدون في عطاء (${activeBidder.name}) من (${old?.toLocaleString('en-US') ?? '—'}) إلى (${next?.toLocaleString('en-US') ?? '—'})`,
      { oldValue: old, newValue: next }
    );
    saveProject(updatedProj);
  };

  // تأشير سعر غير معقول (خطأ تسعير لا حسابي): للإحاطة والتبليغ، لا يغيّر رقماً
  const handleMarkUnreasonable = (index: number, note: string | null) => {
    const before = activeBidder.items[index];
    if (!before) return;
    commitBidder(activeBidder.id,
      b => ({ ...b, items: b.items.map((it, i) => i === index
        ? { ...it, unreasonablePrice: note ? { note, markedAt: new Date().toISOString() } : undefined } : it) }),
      note ? 'تأشير سعر غير معقول' : 'إزالة تأشير سعر غير معقول',
      note ? `أُشّر سعر الفقرة رقم (${before.itemNo}) في عطاء (${activeBidder.name}) غير معقول: ${note}`
        : `أُزيل تأشير السعر غير المعقول عن الفقرة رقم (${before.itemNo}) في عطاء (${activeBidder.name})`,
      { itemNo: before.itemNo, oldValue: before.unreasonablePrice?.note, newValue: note ?? undefined });
  };

  // تأشير حضور المجهز وتوقيعه وختمه إزاء تصحيح اللجنة لفقرة (ضوابط رقم (4) خامساً/ب/3): لا يغيّر رقماً
  const handleMarkBidderSigned = (index: number, signed: boolean) => {
    const before = activeBidder.items[index];
    if (!before || (signed && !isCommitteeCorrected(before))) return;
    commitBidder(activeBidder.id,
      b => ({ ...b, items: b.items.map((it, i) => i === index
        ? { ...it, bidderSignedAt: signed ? new Date().toISOString() : undefined } : it) }),
      signed ? 'تأشير توقيع المجهز إزاء التصحيح' : 'إزالة تأشير توقيع المجهز',
      signed ? `حضر المجهز (${activeBidder.name}) ووقّع وختم إزاء التصحيح الحسابي للفقرة رقم (${before.itemNo}) (ضوابط رقم (4) خامساً/ب/3)`
        : `أُزيل تأشير توقيع المجهز (${activeBidder.name}) إزاء التصحيح الحسابي للفقرة رقم (${before.itemNo})`,
      { itemNo: before.itemNo, oldValue: before.bidderSignedAt, newValue: signed ? 'موقَّع' : undefined });
  };

  // جسم تطبيق فواصل الصفحات؛ يغلق App النافذة بعده
  const applyPageBreaks = (pages: (number | undefined)[]) => {
    const count = Math.max(0, ...pages.map(p => p ?? 0));
    commitBidder(activeBidder.id, b => ({ ...b, items: b.items.map((it, i) => ({ ...it, pageNo: pages[i] })) }),
      'فواصل صفحات العطاء', `أُسندت فقرات عطاء (${activeBidder.name}) إلى (${count}) صفحة حسب فواصل الصفحات`);
  };

  // تصدير جدول المجهز النشط: واقع الحال كما قدّمه بعيوبه، والجدول المعدل بعد تصحيحات اللجنة
  const handleExportBidderAudit = () => {
    if (!hasBidAmounts(activeBidder)) {
      window.alert(`لا مبالغ في جدول (${activeBidder.name}) بعد، فلا عطاء يُصدَّر.`);
      return;
    }
    const pending = activeBidder.items.filter(i => i.hasMathError || i.hasTextDiscrepancy).length;
    if (pending > 0 && !window.confirm(
      `(${pending}) فقرة مؤشرة بانتظار قرار اللجنة. تظهر في الجدول المعدل بمبالغها كما دوّنها المجهز مع عبارة «بانتظار قرار اللجنة».\n\nهل تريد التصدير الآن؟`
    )) return;
    exportBidderAuditToExcel(currentProject, activeBidder);
  };

  // Add Item — يُضاف سطر فارغ لكافة المجهزين معاً، لأن الفقرة (الوصف/الوحدة/الكمية/الكلفة التخمينية) واحدة للمشروع
  const handleAddItem = () => {
    if (blockedByOffer({ shared: true })) return;
    const nextNo = activeBidder.items.length + 1;
    const newItem: Partial<BOQItem> = {
      itemNo: nextNo,
      description: `فقرة ${nextNo}`,
      quantity: 1,
      estimatedTotal: 0,
      bidderTotal: 0
    };

    const updatedBidders = currentProject.bidders.map(b => {
      const updatedRaw = [...b.items, { ...newItem, bidderTotal: 0 }];
      const recalculation = calculateBOQMetrics(updatedRaw, currentProject.deviationThreshold);
      return { ...b, items: recalculation.items, totals: recalculation.totals };
    });

    const updatedProj: TenderProject = {
      ...currentProject,
      bidders: updatedBidders,
      updatedAt: new Date().toISOString()
    };

    saveProject(updatedProj);
  };

  // Delete Item
  // Delete Item — يُحذف من جدول كافة المجهزين معاً حفاظاً على تطابق ترقيم وعدد الفقرات بينهم
  const handleDeleteItem = (index: number) => {
    if (blockedByOffer({ shared: true })) return;
    const targetItem = activeBidder.items[index];

    const updatedBidders = currentProject.bidders.map(b => {
      const updatedRaw = b.items.filter((_, i) => i !== index);
      const recalculation = calculateBOQMetrics(updatedRaw, currentProject.deviationThreshold);
      return { ...b, items: recalculation.items, totals: recalculation.totals };
    });

    let updatedProj: TenderProject = {
      ...currentProject,
      bidders: updatedBidders,
      updatedAt: new Date().toISOString()
    };

    updatedProj = addAuditLog(
      updatedProj,
      'حذف فقرة (من جدول كافة المجهزين)',
      `تم حذف الفقرة رقم (${targetItem?.itemNo})`
    );

    saveProject(updatedProj);
  };

  // Duplicate Item — يُكرَّر لدى كافة المجهزين معاً، كل مجهز باستخدام سعره الخاص للفقرة المصدر
  const handleDuplicateItem = (index: number) => {
    if (blockedByOffer({ shared: true })) return;
    const dupId = `item-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;

    const updatedBidders = currentProject.bidders.map(b => {
      const source = b.items[index];
      if (!source) return b;

      const dup: Partial<BOQItem> = {
        ...source,
        id: dupId,
        itemNo: `${source.itemNo} (مكرر)`,
        description: `${source.description} (نسخة)`,
        // صف جديد في آخر الجدول: لا صفحة لمصدره ولا تأشير اللجنة عليه ولا تعديل عرضه الموزون
        pageNo: undefined,
        unreasonablePrice: undefined,
        bidderSignedAt: undefined,
        offerUnitPrice: undefined,
        offerTotal: undefined
      };

      const updatedRaw = [...b.items, dup];
      const recalculation = calculateBOQMetrics(updatedRaw, currentProject.deviationThreshold);
      return { ...b, items: recalculation.items, totals: recalculation.totals };
    });

    const updatedProj: TenderProject = {
      ...currentProject,
      bidders: updatedBidders,
      updatedAt: new Date().toISOString()
    };

    saveProject(updatedProj);
  };

  return {
    handleUpdateItemFields, handleUpdateItem, handleCorrectReading, handleAdoptTafqeetThousands,
    handleUpdateStatedTotal, handleMarkUnreasonable, handleMarkBidderSigned, handleAddItem, handleDeleteItem,
    handleDuplicateItem, handleClearBidderPrices, handleExportBidderAudit, applyPageBreaks
  };
}

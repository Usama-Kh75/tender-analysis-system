import { calculateBOQMetrics } from '../utils/calculations';
import { addAuditLog } from '../utils/storageService';
import { isCommitteeCorrected } from '../utils/bidderAuditEngine';
import { estimateMergeLogNote, planEstimateMerge } from '../utils/estimateMerge';
import { localDate } from '../utils/localDate';
import { Bidder, BOQItem, TenderProject } from '../types/tender';
import { EditContext } from './editContext';
import { syncSharedFieldsToAllBidders } from './itemFields';

export function createImportHandlers(ctx: EditContext) {
  const { currentProject, activeBidder, saveProject, blockedByOffer } = ctx;

  // فقرة فارغة لم تُملأ بعد (الأولى في مناقصة جديدة، أو «+ إضافة فقرة»): وصفها الافتراضي «فقرة N» وكميتها 1
  // بلا كلفة تخمينية ولا مبلغ لأي مجهز، فكميتها ليست مرجعاً يُبقى عند الاستيراد. كانت تحل محل كمية الملف في
  // الفقرة الأولى. فقرة سعّرها مجهز ولو بلا وصف صارت كميتها مرجعاً
  const isBlankRow = (index: number) => {
    const item = activeBidder.items[index];
    return !!item && (item.description || '').startsWith('فقرة ') && (item.quantity || 1) === 1
      && !((item.estimatedTotal || 0) > 0)
      && currentProject.bidders.every(b => !((b.items[index]?.bidderTotal || 0) > 0));
  };
  // كمية الجدول في الموضع index التي يُبقيها استيراد عطاء مجهز (undefined: لا مرجع، فتُعتمد كمية الملف)
  const referenceQuantity = (index: number) =>
    activeBidder.items[index] && !isBlankRow(index) ? activeBidder.items[index].quantity : undefined;
  // فقرات الجدول كما تُعرض لنافذتي الاستيراد لمقارنة الكمية: الفارغة بلا كمية مرجعية
  const referenceRows = activeBidder.items.map((item, i) => ({ itemNo: item.itemNo, quantity: referenceQuantity(i) || 0, description: item.description }));
  // هوية الفقرة (الرقم والوصف والوحدة) مشتركة كالكمية: تبقى من الجدول القائم، وتؤخذ من الملف لفقرة جديدة أو
  // فارغة. كان المجهز الجديد يكتب أوصافه فوق أوصاف الجدول لدى كل المجهزين، وكان استيراد العطاء يُسقط الوحدة
  // فيعيدها calculateBOQMetrics «عدد» ثم تُوحَّد على الجميع
  const sharedIdentity = (i: number, ext?: Partial<BOQItem>) => {
    const existing = activeBidder.items[i];
    const realDesc = (d?: string) => d && !d.startsWith('فقرة ') ? d : undefined;
    if (!existing || isBlankRow(i)) {
      const itemNo = ext?.itemNo || existing?.itemNo || String(i + 1);
      return { itemNo, description: realDesc(ext?.description) || existing?.description || `فقرة ${itemNo}`, unit: ext?.unit || existing?.unit };
    }
    return {
      itemNo: existing.itemNo || ext?.itemNo || String(i + 1),
      description: realDesc(existing.description) || realDesc(ext?.description) || existing.description,
      unit: existing.unit || ext?.unit
    };
  };

  // Apply OCR or Imported Items with Foolproof Row-by-Row Column Merging
  const handleApplyExtractedItems = (
    extracted: Partial<BOQItem>[],
    mode: 'estimated_only' | 'bidder_only' | 'new_bidder' | 'full_replace' | boolean,
    bidderName?: string,
    statedTotal?: number // الإجمالي المكتوب في العطاء كما قرأه الاستخراج (قبل التصحيح الحسابي)
  ) => {
    if (blockedByOffer({ shared: true })) return;
    const isNew = mode === 'new_bidder' || mode === true;
    const isEstimatedOnly = mode === 'estimated_only';
    const isBidderOnly = mode === 'bidder_only';
    const stated = statedTotal && statedTotal > 0 ? { statedTotal } : {};
    const statedNote = statedTotal && statedTotal > 0
      ? ` — المبلغ الإجمالي المدون في العطاء (${statedTotal.toLocaleString('en-US')})` : '';

    if (isNew) {
      // 1. إنشاء مجهز / شركة جديدة
      const maxLen = Math.max(activeBidder.items.length, extracted.length);
      const mergedItems: Partial<BOQItem>[] = [];

      for (let i = 0; i < maxLen; i++) {
        const ext = extracted[i];
        const existing = activeBidder.items[i];
        
        // إذا كان الاستيراد هو عطاء مجهز فقط، نأخذ التخميني من الجدول الحالي
        const estVal = ext && ext.estimatedTotal && ext.estimatedTotal > 0 
          ? ext.estimatedTotal 
          : (existing?.estimatedTotal || 0);

        const bidVal = ext && ext.bidderTotal !== undefined 
          ? ext.bidderTotal 
          : 0;

        // الكمية مشتركة: تبقى كمية الجدول القائمة (كانت كمية الملف تحل محلها لدى كل المجهزين)، وتُمسح علامتا
        // الاستخراج ليعيد calculateBOQMetrics فحص الفقرة بها، كما في «تعبئة أسعار المجهز الحالي»
        mergedItems.push({
          ...sharedIdentity(i, ext),
          quantity: referenceQuantity(i) || ext?.quantity || existing?.quantity || 1,
          estimatedTotal: estVal,
          bidderTotal: bidVal,
          enteredUnitPrice: ext?.enteredUnitPrice,
          // يشتق منه calculateBOQMetrics مبلغاً لم يُقرأ بكمية الجدول (لا يشتق من enteredUnitPrice)
          bidderUnitPrice: ext?.enteredUnitPrice,
          enteredBidderTotal: ext?.enteredBidderTotal,
          writtenText: ext?.writtenText,
          hasMathError: undefined,
          hasTextDiscrepancy: undefined,
          correctionRationale: ext?.correctionRationale,
          unpriced: ext?.unpriced,
          pageNo: ext?.pageNo
        });
      }

      const recalc = calculateBOQMetrics(mergedItems, currentProject.deviationThreshold);

      const newBidder: Bidder = {
        id: `bidder-${Date.now()}`,
        name: bidderName || `شركة جديدة (${currentProject.bidders.length + 1})`,
        submissionDate: localDate(),
        items: recalc.items,
        totals: recalc.totals,
        ...stated,
        status: 'pending'
      };

      // توحيد هوية الفقرات والكلفة التخمينية مع بقية المجهزين الحاليين إن جلب الاستيراد صفوفاً أو قيماً تخمينية جديدة
      const syncedExistingBidders = syncSharedFieldsToAllBidders(currentProject.bidders, mergedItems, currentProject.deviationThreshold);

      let updatedProj: TenderProject = {
        ...currentProject,
        bidders: [...syncedExistingBidders, newBidder],
        activeBidderId: newBidder.id,
        updatedAt: new Date().toISOString()
      };

      updatedProj = addAuditLog(
        updatedProj,
        'استيراد عطاء شركة جديدة',
        `تم إنشاء المجهز (${newBidder.name}) واستيراد (${extracted.length}) فقرة${statedNote}`
      );

      saveProject(updatedProj);

    } else if (isEstimatedOnly) {
      // 2. تحديث الكلفة التخمينية فقط للمشروع عبر كافة المجهزين، مطابَقةً برقم الفقرة (planEstimateMerge):
      // فقرة لم تُقرأ يبقى صفها كما هو، والفقرات الجديدة في آخر الجدول
      const plan = planEstimateMerge(extracted, referenceRows);
      const maxLen = Math.max(plan.rows.length, ...currentProject.bidders.map(b => b.items.length));

      const updatedBidders = currentProject.bidders.map(b => {
        const mergedItems: Partial<BOQItem>[] = [];

        for (let i = 0; i < maxLen; i++) {
          const ext = plan.rows[i];
          const existing = b.items[i];

          // المطابقة بالرقم تُبقي رقم الجدول كما كُتب
          const itemNo = (plan.byItemNo && existing?.itemNo) || ext?.itemNo || existing?.itemNo || String(i + 1);
          const desc = ext?.description && !ext.description.startsWith('فقرة ')
            ? ext.description
            : (existing?.description || `فقرة ${itemNo}`);

          // الكلفة التخمينية تضع كمية الجدول. إن غيّرتها يُعاد فحص سعر المجهز في الفقرة بالكمية الجديدة (كانت
          // العلامتان تبقيان محسوبتين بالقديمة)، إلا فقرة صحّحتها اللجنة فتبقى كما هي وتصحيحها مسجل
          const quantity = ext?.quantity || existing?.quantity || 1;
          const recheck = !!existing && quantity !== existing.quantity && !isCommitteeCorrected(existing);

          // ...existing يحفظ حقول كل مجهز كاملة (سعر المفرد والتفقيط وعلامات الأخطاء وغير المسعّرة):
          // كان الصف يُبنى من جديد بالإجمالي وحده فتُمحى بيانات التدقيق عند استيراد الكلفة التخمينية
          mergedItems.push({
            ...(existing || {}),
            ...(recheck ? { hasMathError: undefined, hasTextDiscrepancy: undefined } : {}),
            id: existing?.id || `item-${i + 1}-${Date.now()}`,
            itemNo,
            description: desc,
            quantity,
            estimatedTotal: ext?.estimatedTotal !== undefined ? ext.estimatedTotal : (existing?.estimatedTotal || 0),
            // تخميني جديد: يُصفَّر المفرد القديم ليُعاد حسابه منه (وإلا أعاد calculateBOQMetrics بناء القديم)
            ...(ext?.estimatedTotal !== undefined ? { estimatedUnitPrice: 0 } : {}),
            bidderTotal: existing?.bidderTotal || 0 // الحفاظ التام على أسعار المجهز الحالي
          });
        }

        const recalc = calculateBOQMetrics(mergedItems, currentProject.deviationThreshold);
        return {
          ...b,
          items: recalc.items,
          totals: recalc.totals
        };
      });

      let updatedProj: TenderProject = {
        ...currentProject,
        bidders: updatedBidders,
        updatedAt: new Date().toISOString()
      };

      updatedProj = addAuditLog(
        updatedProj,
        'تحديث الكلفة التخمينية للمشروع',
        `تم استيراد وتحديث جدول الكلفة التخمينية للمشروع (${extracted.length} فقرة)${estimateMergeLogNote(plan)}`
      );

      saveProject(updatedProj);

    } else if (isBidderOnly) {
      // 3. تحديث أسعار المجهز الحالي فقط بسطر بسطر مع الحفاظ على التخميني
      const maxLen = Math.max(activeBidder.items.length, extracted.length);
      const mergedItems: Partial<BOQItem>[] = [];

      for (let i = 0; i < maxLen; i++) {
        const ext = extracted[i];
        const existing = activeBidder.items[i];

        // صف قائم بعد آخر صف مستخرج يبقى كما هو كاملاً (كان يفقد سعر المفرد والتفقيط والعلامات)
        if (!ext && existing) {
          mergedItems.push({ ...existing });
          continue;
        }

        // تبقى كمية الجدول القائمة (مشتركة مع الكلفة التخمينية وبقية المجهزين)، فتُمسح علامتا الاستخراج ليعيد
        // calculateBOQMetrics فحص الفقرة بها: كانت العلامتان محسوبتين بكمية الملف والصف مخزناً بكمية الجدول.
        // نافذتا الاستيراد تعرضان الفقرات المختلفة الكمية قبل الإدراج (QuantityMismatchNotice)
        mergedItems.push({
          id: existing?.id || `item-${i + 1}-${Date.now()}`,
          ...sharedIdentity(i, ext),
          quantity: referenceQuantity(i) || ext?.quantity || existing?.quantity || 1,
          estimatedTotal: existing?.estimatedTotal || 0, // الحفاظ التام على الكلفة التخمينية
          bidderTotal: ext?.bidderTotal !== undefined ? ext.bidderTotal : (existing?.bidderTotal || 0),
          enteredUnitPrice: ext?.enteredUnitPrice,
          // يشتق منه calculateBOQMetrics مبلغاً لم يُقرأ بكمية الجدول (لا يشتق من enteredUnitPrice)
          bidderUnitPrice: ext?.enteredUnitPrice,
          enteredBidderTotal: ext?.enteredBidderTotal,
          writtenText: ext?.writtenText,
          hasMathError: undefined,
          hasTextDiscrepancy: undefined,
          correctionRationale: ext?.correctionRationale,
          unpriced: ext?.unpriced,
          // صفحة الفقرة في هذا العطاء: من القراءة إن وُجدت، وإلا تبقى المسندة سابقاً (استيراد Excel بلا صفحات)
          pageNo: ext?.pageNo ?? existing?.pageNo,
          // تأشير اللجنة وتعديلات عرض موقوف يبقيان عبر إعادة القراءة (لا يُسقطهما الدمج حقلاً حقلاً)
          unreasonablePrice: existing?.unreasonablePrice,
          offerUnitPrice: existing?.offerUnitPrice,
          offerTotal: existing?.offerTotal
        });
      }

      const recalc = calculateBOQMetrics(mergedItems, currentProject.deviationThreshold);

      // استيراد بلا إجمالي مقروء (Excel مثلاً) لا يمس المبلغ المدون المسجل سابقاً
      const updatedBidder: Bidder = {
        ...activeBidder,
        items: recalc.items,
        totals: recalc.totals,
        ...stated
      };

      // توحيد أي صفوف جديدة أضافها الاستيراد (هوية الفقرة وكلفتها التخمينية) مع بقية المجهزين أيضاً
      const otherBiddersSynced = syncSharedFieldsToAllBidders(currentProject.bidders, mergedItems, currentProject.deviationThreshold, activeBidder.id);
      const updatedBidders = otherBiddersSynced.map(b => b.id === activeBidder.id ? updatedBidder : b);
      let updatedProj: TenderProject = {
        ...currentProject,
        bidders: updatedBidders,
        updatedAt: new Date().toISOString()
      };

      updatedProj = addAuditLog(
        updatedProj,
        'تحديث أسعار مجهز',
        `تم تحديث وتعبئة أسعار المجهز (${activeBidder.name}) لـ (${extracted.length}) فقرة${statedNote}`
      );

      saveProject(updatedProj);

    } else {
      // 4. استبدال كامل للجدول (هوية الفقرة والكلفة التخمينية وسعر المجهز معاً) — يوحَّد الجزء المشترك مع بقية المجهزين
      const recalc = calculateBOQMetrics(extracted, currentProject.deviationThreshold);

      const updatedBidder: Bidder = {
        ...activeBidder,
        items: recalc.items,
        totals: recalc.totals
      };

      const otherBiddersSynced = syncSharedFieldsToAllBidders(currentProject.bidders, extracted, currentProject.deviationThreshold, activeBidder.id);
      const updatedBidders = otherBiddersSynced.map(b => b.id === activeBidder.id ? updatedBidder : b);
      let updatedProj: TenderProject = {
        ...currentProject,
        bidders: updatedBidders,
        updatedAt: new Date().toISOString()
      };

      updatedProj = addAuditLog(
        updatedProj,
        'استبدال جدول الفقرات بالكامل',
        `تم استبدال وتعبئة جدول الفقرات بالكامل (${extracted.length}) فقرة`
      );

      saveProject(updatedProj);
    }
  };

  return { handleApplyExtractedItems, referenceRows };
}

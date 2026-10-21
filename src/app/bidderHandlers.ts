import { calculateBOQMetrics } from '../utils/calculations';
import { addAuditLog } from '../utils/storageService';
import { offerLockReason } from '../utils/weightedOffer';
import { localDate } from '../utils/localDate';
import { CONTRACT_TYPES } from '../utils/contractTypes';
import { Bidder, BOQItem, TenderProject } from '../types/tender';
import { EditContext } from './editContext';
import { withoutBidderPrices } from './itemFields';

export function createBidderHandlers(ctx: EditContext, { closeSettings }: { closeSettings: () => void }) {
  const { currentProject, activeBidder, saveProject, blockedByOffer } = ctx;

  // Update Bidder Name
  const handleUpdateBidderName = (newName: string) => {
    const oldName = activeBidder.name;
    const updatedBidders = currentProject.bidders.map(b => b.id === activeBidder.id ? { ...b, name: newName } : b);
    
    let updatedProj: TenderProject = {
      ...currentProject,
      bidders: updatedBidders,
      updatedAt: new Date().toISOString()
    };

    updatedProj = addAuditLog(
      updatedProj,
      'تعديل اسم المجهز',
      `تم تعديل اسم المجهز من (${oldName}) إلى (${newName})`
    );

    saveProject(updatedProj);
  };

  // Add New Bidder
  const handleAddNewBidder = (name?: string) => {
    // إلغاء نافذة الاسم أو تركه فارغاً لا يضيف شركة (كان يضيف «شركة جديدة (ن)» فارغة تظهر في المقارنة)
    const targetName = (name || prompt('أدخل اسم الشركة / المجهز الجديد:') || '').trim();
    if (!targetName) return;

    // استنساخ الفقرات بلا أي سعر لإدخال عطاء الشركة الخاص
    const clonedItems = activeBidder.items.map(item => ({
      ...withoutBidderPrices(item),
      pageNo: undefined,
      id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`
    }));

    const recalc = calculateBOQMetrics(clonedItems, currentProject.deviationThreshold);

    const newBidder: Bidder = {
      id: `bidder-${Date.now()}`,
      name: targetName,
      submissionDate: localDate(),
      items: recalc.items,
      totals: recalc.totals,
      status: 'pending'
    };

    let updatedProj: TenderProject = {
      ...currentProject,
      bidders: [...currentProject.bidders, newBidder],
      activeBidderId: newBidder.id,
      updatedAt: new Date().toISOString()
    };

    updatedProj = addAuditLog(
      updatedProj,
      'إضافة مجهز جديد',
      `تمت إضافة المجهز (${targetName}) بنجاح إلى المناقصة`
    );

    saveProject(updatedProj);
  };

  // Delete Bidder
  const handleDeleteBidder = (bidderId: string) => {
    if (currentProject.bidders.length <= 1) {
      alert('لا يمكن حذف آخر مجهز في المناقصة. أضف مجهزاً آخر أولاً إن أردت البدء من جديد، أو أنشئ مناقصة جديدة.');
      return;
    }

    const target = currentProject.bidders.find(b => b.id === bidderId);
    if (!target) return;

    if (!window.confirm(`هل أنت متأكد من حذف المجهز (${target.name}) نهائياً؟ لا يمكن التراجع عن هذا الإجراء.`)) {
      return;
    }

    const remainingBidders = currentProject.bidders.filter(b => b.id !== bidderId);
    const wasActive = currentProject.activeBidderId === bidderId;

    let updatedProj: TenderProject = {
      ...currentProject,
      bidders: remainingBidders,
      activeBidderId: wasActive ? remainingBidders[0].id : currentProject.activeBidderId,
      updatedAt: new Date().toISOString()
    };

    updatedProj = addAuditLog(
      updatedProj,
      'حذف مجهز',
      `تم حذف المجهز (${target.name}) نهائياً من المناقصة`
    );

    saveProject(updatedProj);
  };

  // Reset (Clear) All Bidders in Current Project — Fresh Start Without Deleting the Whole Project
  const handleResetAllBidders = () => {
    if (blockedByOffer({ shared: true })) return;
    if (!window.confirm('⚠️ سيتم حذف جميع المجهزين المدرجين حالياً في هذه المناقصة/الطلبية والبدء بمجهز واحد فارغ. هل أنت متأكد؟')) {
      return;
    }

    const blankItem: Partial<BOQItem> = { itemNo: 1, description: 'فقرة 1', quantity: 1, estimatedTotal: 0, bidderTotal: 0 };
    const recalc = calculateBOQMetrics([blankItem], currentProject.deviationThreshold);

    const freshBidder: Bidder = {
      id: `bidder-${Date.now()}`,
      name: 'شركة جديدة',
      submissionDate: localDate(),
      items: recalc.items,
      totals: recalc.totals,
      status: 'pending'
    };

    let updatedProj: TenderProject = {
      ...currentProject,
      bidders: [freshBidder],
      activeBidderId: freshBidder.id,
      updatedAt: new Date().toISOString()
    };

    updatedProj = addAuditLog(
      updatedProj,
      'مسح جميع المجهزين',
      'تم حذف جميع المجهزين المدرجين والبدء بمجهز واحد فارغ لإعادة الإدخال من جديد'
    );

    saveProject(updatedProj);
    closeSettings();
  };

  // Update Bidder Status
  const handleUpdateBidderStatus = (bidderId: string, status: Bidder['status']) => {
    // التوصية بالإحالة لعطاء واحد: اختيار مجهز للترسية يلغي اختيار أي مجهز سابق،
    // وإلا بقي أكثر من «موصى به» وصارت التوصية في المحضر ملتبسة
    const displaced = status === 'recommended'
      ? currentProject.bidders.filter(b => b.id !== bidderId && (b.status === 'recommended' || b.status === 'awarded'))
      : [];
    const updatedBidders = currentProject.bidders.map(b =>
      b.id === bidderId ? { ...b, status } : displaced.includes(b) ? { ...b, status: 'pending' as const } : b
    );
    const targetBidder = currentProject.bidders.find(b => b.id === bidderId);

    let updatedProj: TenderProject = {
      ...currentProject,
      bidders: updatedBidders,
      updatedAt: new Date().toISOString()
    };

    updatedProj = addAuditLog(
      updatedProj,
      'تحديث حالة العطاء',
      `تم تعديل حالة المجهز (${targetBidder?.name}) إلى (${status})`
        + (displaced.length ? ` — وأُلغي اختيار (${displaced.map(b => b.name).join('، ')}) للترسية` : '')
    );

    saveProject(updatedProj);
  };

  // Save Settings
  const handleSaveSettings = (updated: Partial<TenderProject>) => {
    // الحد يغيّر حكم التوازن (سادساً/5) والاستبعاد، فلا يتغيّر بصمت تحت عرض موزون فعّال أو معتمد؛ باقي الإعدادات تُحفظ
    const requested = updated.deviationThreshold ?? currentProject.deviationThreshold;
    const lockReason = requested !== currentProject.deviationThreshold ? offerLockReason(currentProject, { shared: true }) : null;
    if (lockReason) window.alert(`لم يُغيَّر حد الانحراف (بقي ${currentProject.deviationThreshold}%): تغييره يعيد حكم توازن العطاءات.
${lockReason}`);
    const threshold = lockReason ? currentProject.deviationThreshold : requested;

    const recalculatedBidders = currentProject.bidders.map(b => {
      const recalc = calculateBOQMetrics(b.items, threshold);
      return {
        ...b,
        items: recalc.items,
        totals: recalc.totals
      };
    });

    let updatedProj: TenderProject = {
      ...currentProject,
      ...updated,
      deviationThreshold: threshold,
      bidders: recalculatedBidders,
      updatedAt: new Date().toISOString()
    };

    updatedProj = addAuditLog(
      updatedProj,
      'تعديل إعدادات المناقصة',
      `تم تحديث إعدادات المناقصة وحد الانحراف إلى (${threshold}%)`
        + (updated.contractType && updated.contractType !== currentProject.contractType
          ? ` — نوع العقد: ${CONTRACT_TYPES[updated.contractType].label}` : '')
    );

    saveProject(updatedProj);
  };

  // اختيار المجهز النشط من القائمة أو من الخلاصة أو من المصفوفة (لا يغيّر updatedAt)
  const selectBidder = (id: string) => {
    const updatedProj = { ...currentProject, activeBidderId: id };
    saveProject(updatedProj);
  };

  return {
    handleUpdateBidderName, handleAddNewBidder, handleDeleteBidder, handleResetAllBidders,
    handleUpdateBidderStatus, handleSaveSettings, selectBidder
  };
}

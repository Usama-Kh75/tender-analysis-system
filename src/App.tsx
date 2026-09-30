import React, { useState, useEffect, useRef } from 'react';
import {
  getAllProjects,
  saveAllProjects,
  getActiveProjectId,
  setActiveProjectId,
  addAuditLog,
  createDefaultProject,
  downloadProjectBackup,
  parseProjectBackupFile,
  downloadAllProjectsBackup,
  parseAllProjectsBackupFile,
  resetAllData
} from './utils/storageService';
import { calculateBOQMetrics } from './utils/calculations';
import { exportTenderToExcel } from './utils/excelService';
import { TenderProject, Bidder, BOQItem, ContractType } from './types/tender';

import { Navbar } from './components/Navbar';
import { KPIStatsCards } from './components/KPIStatsCards';
import { BOQTable } from './components/BOQTable';
import { ChartsView } from './components/ChartsView';
import { ExecutiveSummaryView } from './components/ExecutiveSummaryView';

import { SmartTableImportModal } from './components/modals/SmartTableImportModal';
import { ImageOcrModal } from './components/modals/ImageOcrModal';
import { MultiBidderMatrix } from './components/modals/MultiBidderMatrix';
import { AuditTrailModal } from './components/modals/AuditTrailModal';
import { ProjectSettingsModal } from './components/modals/ProjectSettingsModal';
import { PrintReportModal } from './components/modals/PrintReportModal';
import { NewProjectModal } from './components/modals/NewProjectModal';
import { UpdateNotice } from './components/UpdateNotice';
import { versionLabel } from './changelog';
import { RESUMED_STATE } from './resume';
import { CONTRACT_TYPES, contractTypeInfo } from './utils/contractTypes';

import {
  Table2,
  Pencil,
  Award,
  BarChart3,
  Building2,
  Plus
} from 'lucide-react';

export function App() {
  const [projects, setProjects] = useState<TenderProject[]>([]);
  const [activeProjectId, setActiveId] = useState<string>('');
  // بعد «حفظ والتحديث» يُستأنف التبويب الذي كان مفتوحاً (src/resume.ts)
  const [activeTab, setActiveTab] = useState<'table' | 'summary' | 'charts'>(RESUMED_STATE?.tab ?? 'table');
  const [isEditingTitle, setIsEditingTitle] = useState<boolean>(false);
  const [isEditingRefNumber, setIsEditingRefNumber] = useState<boolean>(false);
  const [isEditingBidderName, setIsEditingBidderName] = useState<boolean>(false);
  const [tempBidderName, setTempBidderName] = useState<string>('');

  // Modals
  const [isSmartImportOpen, setIsSmartImportOpen] = useState(false);
  const [smartImportDocType, setSmartImportDocType] = useState<'bidder' | 'estimated' | 'both'>('bidder');
  const [isOcrOpen, setIsOcrOpen] = useState(false);
  const [isMultiBidderOpen, setIsMultiBidderOpen] = useState(false);
  const [isAuditOpen, setIsAuditOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPrintOpen, setIsPrintOpen] = useState(false);
  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false);
  const [isWhatsNewOpen, setIsWhatsNewOpen] = useState(false);

  // Load from Storage
  useEffect(() => {
    const loaded = getAllProjects();
    setProjects(loaded);
    const currId = getActiveProjectId();
    setActiveId(currId || loaded[0]?.id || '');
  }, []);

  // Save projects whenever they change
  useEffect(() => {
    if (projects.length > 0) {
      saveAllProjects(projects);
    }
  }, [projects]);

  // استعادة موضع التمرير بعد «حفظ والتحديث»، مرة واحدة بعد أن تُرسم بيانات المشاريع
  const scrollRestored = useRef(false);
  useEffect(() => {
    if (scrollRestored.current || projects.length === 0 || !RESUMED_STATE?.scrollY) return;
    scrollRestored.current = true;
    // يُعاد التطبيق بعد استقرار الرسم: الرسوم البيانية قد تكتمل بعد الإطار الأول فيتغير طول الصفحة
    const y = RESUMED_STATE.scrollY;
    requestAnimationFrame(() => window.scrollTo(0, y));
    setTimeout(() => { if (Math.abs(window.scrollY - y) > 20) window.scrollTo(0, y); }, 600);
  }, [projects]);

  // نافذة مفتوحة فيها عمل لم يُطبَّق أو يُحفظ بعد: يُمنع التحديث حتى تُكمل أو تُغلق
  const blockingWork = isOcrOpen ? 'استخراج من صورة / PDF'
    : isSmartImportOpen ? 'استيراد جدول (Excel / Word)'
    : isSettingsOpen ? 'إعدادات المناقصة'
    : isNewProjectOpen ? 'مناقصة جديدة'
    : null;

  const currentProject = projects.find(p => p.id === activeProjectId) || projects[0];
  const activeBidder = currentProject?.bidders.find(b => b.id === currentProject.activeBidderId) || currentProject?.bidders[0];

  if (!currentProject || !activeBidder) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white text-base">
        جاري تحميل نظام تحليل وتقييم العطاءات المتكامل...
      </div>
    );
  }

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

    setProjects(prev => prev.map(p => p.id === updatedProj.id ? updatedProj : p));
  };

  // Clear Bidder Prices Only
  const handleClearBidderPrices = () => {
    if (!window.confirm(`هل أنت متأكد من رغبتك في تصفير مبالغ المجهز (${activeBidder.name}) للبدء في تعبئتها من جديد؟`)) {
      return;
    }

    const resetItems = activeBidder.items.map(item => ({
      ...item,
      bidderTotal: 0
    }));

    const recalc = calculateBOQMetrics(resetItems, currentProject.deviationThreshold);

    const updatedBidder: Bidder = {
      ...activeBidder,
      items: recalc.items,
      totals: recalc.totals
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

    setProjects(prev => prev.map(p => p.id === updatedProj.id ? updatedProj : p));
  };

  // حقول هوية الفقرة والكلفة التخمينية مشتركة لكل المجهزين (الكلفة التخمينية واحدة للمشروع)
  // بينما حقول السعر والتدقيق (bidderTotal, enteredUnitPrice, writtenText...) خاصة بكل مجهز على حدة
  const SHARED_ESTIMATE_FIELDS: (keyof BOQItem)[] = ['itemNo', 'description', 'unit', 'quantity', 'estimatedUnitPrice', 'estimatedTotal'];

  // يوحّد حقول هوية الفقرة والكلفة التخمينية عبر كل المجهزين انطلاقاً من قائمة فقرات مرجعية (بعد استيراد Excel أو استخراج صورة)
  // مع الحفاظ التام على سعر كل مجهز الخاص للفقرات الموجودة مسبقاً، وتصفير سعر الفقرات الجديدة له فقط
  const syncSharedFieldsToAllBidders = (
    bidders: Bidder[],
    referenceItems: Partial<BOQItem>[],
    excludeBidderId?: string
  ): Bidder[] => {
    return bidders.map(b => {
      if (b.id === excludeBidderId) return b;

      const updatedRaw: Partial<BOQItem>[] = referenceItems.map((ref, i) => {
        const existing = b.items[i];
        const merged: Partial<BOQItem> = { ...(existing || {}) };
        SHARED_ESTIMATE_FIELDS.forEach(f => { (merged as any)[f] = (ref as any)[f]; });
        if (!existing) {
          merged.bidderTotal = 0;
        }
        return merged;
      });

      const recalc = calculateBOQMetrics(updatedRaw, currentProject.deviationThreshold);
      return { ...b, items: recalc.items, totals: recalc.totals };
    });
  };

  // Update Item — يُطبَّق على كل المجهزين إن كان الحقل من حقول الكلفة التخمينية المشتركة، وإلا على المجهز النشط فقط
  const handleUpdateItem = (index: number, field: keyof BOQItem, val: any) => {
    const oldVal = (activeBidder.items[index] as any)[field];
    const isSharedField = SHARED_ESTIMATE_FIELDS.includes(field);

    const updatedBidders = currentProject.bidders.map(b => {
      if (!isSharedField && b.id !== activeBidder.id) return b;
      if (!b.items[index]) return b;

      const updatedRaw = [...b.items];
      updatedRaw[index] = { ...updatedRaw[index], [field]: val };
      const recalculation = calculateBOQMetrics(updatedRaw, currentProject.deviationThreshold);
      return { ...b, items: recalculation.items, totals: recalculation.totals };
    });

    let updatedProj: TenderProject = {
      ...currentProject,
      bidders: updatedBidders,
      updatedAt: new Date().toISOString()
    };

    if (['estimatedTotal', 'bidderTotal', 'description'].includes(field as string)) {
      updatedProj = addAuditLog(
        updatedProj,
        isSharedField ? 'تعديل الكلفة التخمينية (مشتركة لكل المجهزين)' : 'تعديل قيمة مالية',
        `تم تعديل حقل (${String(field)}) للفقرة رقم (${activeBidder.items[index]?.itemNo}) من (${oldVal}) إلى (${val})`,
        { itemNo: activeBidder.items[index]?.itemNo, oldValue: oldVal, newValue: val }
      );
    }

    setProjects(prev => prev.map(p => p.id === updatedProj.id ? updatedProj : p));
  };

  // Add Item — يُضاف سطر فارغ لكافة المجهزين معاً، لأن الفقرة (الوصف/الوحدة/الكمية/الكلفة التخمينية) واحدة للمشروع
  const handleAddItem = () => {
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

    setProjects(prev => prev.map(p => p.id === updatedProj.id ? updatedProj : p));
  };

  // Delete Item
  // Delete Item — يُحذف من جدول كافة المجهزين معاً حفاظاً على تطابق ترقيم وعدد الفقرات بينهم
  const handleDeleteItem = (index: number) => {
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

    setProjects(prev => prev.map(p => p.id === updatedProj.id ? updatedProj : p));
  };

  // Duplicate Item — يُكرَّر لدى كافة المجهزين معاً، كل مجهز باستخدام سعره الخاص للفقرة المصدر
  const handleDuplicateItem = (index: number) => {
    const dupId = `item-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;

    const updatedBidders = currentProject.bidders.map(b => {
      const source = b.items[index];
      if (!source) return b;

      const dup: Partial<BOQItem> = {
        ...source,
        id: dupId,
        itemNo: `${source.itemNo} (مكرر)`,
        description: `${source.description} (نسخة)`
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

    setProjects(prev => prev.map(p => p.id === updatedProj.id ? updatedProj : p));
  };

  // Apply OCR or Imported Items with Foolproof Row-by-Row Column Merging
  const handleApplyExtractedItems = (
    extracted: Partial<BOQItem>[], 
    mode: 'estimated_only' | 'bidder_only' | 'new_bidder' | 'full_replace' | boolean, 
    bidderName?: string
  ) => {
    const isNew = mode === 'new_bidder' || mode === true;
    const isEstimatedOnly = mode === 'estimated_only';
    const isBidderOnly = mode === 'bidder_only';

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

        const itemNo = ext?.itemNo || existing?.itemNo || String(i + 1);
        const desc = ext?.description && !ext.description.startsWith('فقرة ')
          ? ext.description
          : (existing?.description || `فقرة ${itemNo}`);

        mergedItems.push({
          itemNo,
          description: desc,
          quantity: ext?.quantity || existing?.quantity || 1,
          estimatedTotal: estVal,
          bidderTotal: bidVal,
          enteredUnitPrice: ext?.enteredUnitPrice,
          enteredBidderTotal: ext?.enteredBidderTotal,
          writtenText: ext?.writtenText,
          hasMathError: ext?.hasMathError,
          hasTextDiscrepancy: ext?.hasTextDiscrepancy,
          correctionRationale: ext?.correctionRationale
        });
      }

      const recalc = calculateBOQMetrics(mergedItems, currentProject.deviationThreshold);

      const newBidder: Bidder = {
        id: `bidder-${Date.now()}`,
        name: bidderName || `شركة جديدة (${currentProject.bidders.length + 1})`,
        submissionDate: new Date().toISOString().split('T')[0],
        items: recalc.items,
        totals: recalc.totals,
        status: 'pending'
      };

      // توحيد هوية الفقرات والكلفة التخمينية مع بقية المجهزين الحاليين إن جلب الاستيراد صفوفاً أو قيماً تخمينية جديدة
      const syncedExistingBidders = syncSharedFieldsToAllBidders(currentProject.bidders, mergedItems);

      let updatedProj: TenderProject = {
        ...currentProject,
        bidders: [...syncedExistingBidders, newBidder],
        activeBidderId: newBidder.id,
        updatedAt: new Date().toISOString()
      };

      updatedProj = addAuditLog(
        updatedProj,
        'استيراد عطاء شركة جديدة',
        `تم إنشاء المجهز (${newBidder.name}) واستيراد (${extracted.length}) فقرة`
      );

      setProjects(prev => prev.map(p => p.id === updatedProj.id ? updatedProj : p));

    } else if (isEstimatedOnly) {
      // 2. تحديث الكلفة التخمينية فقط للمشروع عبر كافة المجهزين بسطر بسطر
      const maxLen = Math.max(extracted.length, ...currentProject.bidders.map(b => b.items.length));

      const updatedBidders = currentProject.bidders.map(b => {
        const mergedItems: Partial<BOQItem>[] = [];

        for (let i = 0; i < maxLen; i++) {
          const ext = extracted[i];
          const existing = b.items[i];

          const itemNo = ext?.itemNo || existing?.itemNo || String(i + 1);
          const desc = ext?.description && !ext.description.startsWith('فقرة ')
            ? ext.description
            : (existing?.description || `فقرة ${itemNo}`);

          mergedItems.push({
            id: existing?.id || `item-${i + 1}-${Date.now()}`,
            itemNo,
            description: desc,
            quantity: ext?.quantity || existing?.quantity || 1,
            estimatedTotal: ext?.estimatedTotal !== undefined ? ext.estimatedTotal : (existing?.estimatedTotal || 0),
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
        `تم استيراد وتحديث جدول الكلفة التخمينية للمشروع (${extracted.length} فقرة)`
      );

      setProjects(prev => prev.map(p => p.id === updatedProj.id ? updatedProj : p));

    } else if (isBidderOnly) {
      // 3. تحديث أسعار المجهز الحالي فقط بسطر بسطر مع الحفاظ على التخميني
      const maxLen = Math.max(activeBidder.items.length, extracted.length);
      const mergedItems: Partial<BOQItem>[] = [];

      for (let i = 0; i < maxLen; i++) {
        const ext = extracted[i];
        const existing = activeBidder.items[i];

        const itemNo = existing?.itemNo || ext?.itemNo || String(i + 1);
        const desc = existing?.description && !existing.description.startsWith('فقرة ')
          ? existing.description
          : (ext?.description || `فقرة ${itemNo}`);

        mergedItems.push({
          id: existing?.id || `item-${i + 1}-${Date.now()}`,
          itemNo,
          description: desc,
          quantity: existing?.quantity || ext?.quantity || 1,
          estimatedTotal: existing?.estimatedTotal || 0, // الحفاظ التام على الكلفة التخمينية
          bidderTotal: ext?.bidderTotal !== undefined ? ext.bidderTotal : (existing?.bidderTotal || 0),
          enteredUnitPrice: ext?.enteredUnitPrice,
          enteredBidderTotal: ext?.enteredBidderTotal,
          writtenText: ext?.writtenText,
          hasMathError: ext?.hasMathError,
          hasTextDiscrepancy: ext?.hasTextDiscrepancy,
          correctionRationale: ext?.correctionRationale
        });
      }

      const recalc = calculateBOQMetrics(mergedItems, currentProject.deviationThreshold);

      const updatedBidder: Bidder = {
        ...activeBidder,
        items: recalc.items,
        totals: recalc.totals
      };

      // توحيد أي صفوف جديدة أضافها الاستيراد (هوية الفقرة وكلفتها التخمينية) مع بقية المجهزين أيضاً
      const otherBiddersSynced = syncSharedFieldsToAllBidders(currentProject.bidders, mergedItems, activeBidder.id);
      const updatedBidders = otherBiddersSynced.map(b => b.id === activeBidder.id ? updatedBidder : b);
      let updatedProj: TenderProject = {
        ...currentProject,
        bidders: updatedBidders,
        updatedAt: new Date().toISOString()
      };

      updatedProj = addAuditLog(
        updatedProj,
        'تحديث أسعار مجهز',
        `تم تحديث وتعبئة أسعار المجهز (${activeBidder.name}) لـ (${extracted.length}) فقرة`
      );

      setProjects(prev => prev.map(p => p.id === updatedProj.id ? updatedProj : p));

    } else {
      // 4. استبدال كامل للجدول (هوية الفقرة والكلفة التخمينية وسعر المجهز معاً) — يوحَّد الجزء المشترك مع بقية المجهزين
      const recalc = calculateBOQMetrics(extracted, currentProject.deviationThreshold);

      const updatedBidder: Bidder = {
        ...activeBidder,
        items: recalc.items,
        totals: recalc.totals
      };

      const otherBiddersSynced = syncSharedFieldsToAllBidders(currentProject.bidders, extracted, activeBidder.id);
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

      setProjects(prev => prev.map(p => p.id === updatedProj.id ? updatedProj : p));
    }
  };

  // Add New Bidder
  const handleAddNewBidder = (name?: string) => {
    const targetName = name || prompt('أدخل اسم الشركة / المجهز الجديد:') || `شركة جديدة (${currentProject.bidders.length + 1})`;
    
    // استنساخ الفقرات مع تصفير أسعار المجهز لإدخال عطائه الخاص
    const clonedItems = activeBidder.items.map(item => ({
      ...item,
      id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      bidderTotal: 0
    }));

    const recalc = calculateBOQMetrics(clonedItems, currentProject.deviationThreshold);

    const newBidder: Bidder = {
      id: `bidder-${Date.now()}`,
      name: targetName,
      submissionDate: new Date().toISOString().split('T')[0],
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

    setProjects(prev => prev.map(p => p.id === updatedProj.id ? updatedProj : p));
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

    setProjects(prev => prev.map(p => p.id === updatedProj.id ? updatedProj : p));
  };

  // Reset (Clear) All Bidders in Current Project — Fresh Start Without Deleting the Whole Project
  const handleResetAllBidders = () => {
    if (!window.confirm('⚠️ سيتم حذف جميع المجهزين المدرجين حالياً في هذه المناقصة/الطلبية والبدء بمجهز واحد فارغ. هل أنت متأكد؟')) {
      return;
    }

    const blankItem: Partial<BOQItem> = { itemNo: 1, description: 'فقرة 1', quantity: 1, estimatedTotal: 0, bidderTotal: 0 };
    const recalc = calculateBOQMetrics([blankItem], currentProject.deviationThreshold);

    const freshBidder: Bidder = {
      id: `bidder-${Date.now()}`,
      name: 'شركة جديدة',
      submissionDate: new Date().toISOString().split('T')[0],
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

    setProjects(prev => prev.map(p => p.id === updatedProj.id ? updatedProj : p));
    setIsSettingsOpen(false);
  };

  // Delete Entire Project (requires at least one other project to remain)
  const handleDeleteProject = () => {
    if (projects.length <= 1) {
      alert('لا يمكن حذف آخر مناقصة/طلبية في النظام. إن أردت البدء من جديد بالكامل استخدم "إعادة ضبط النظام".');
      return;
    }

    if (!window.confirm(`⚠️ سيتم حذف مناقصة/طلبية (${currentProject.title}) نهائياً بكل بياناتها (المجهزين والأسعار وسجل التدقيق). هل أنت متأكد؟`)) {
      return;
    }

    const remaining = projects.filter(p => p.id !== currentProject.id);
    setProjects(remaining);
    setActiveId(remaining[0].id);
    setActiveProjectId(remaining[0].id);
    setIsSettingsOpen(false);
  };

  // Full Factory Reset — Wipe All Local Data, Start From a Single Blank Project
  const handleFactoryReset = () => {
    if (!window.confirm('⚠️ تحذير أخير: سيتم مسح جميع المناقصات والطلبيات وبياناتها المحفوظة محلياً في هذا المتصفح نهائياً بلا رجعة، والبدء بنظام فارغ تماماً. هل تريد المتابعة؟\n\nيُنصح بتنزيل نسخة احتياطية أولاً إن كانت البيانات الحالية مهمة.')) {
      return;
    }

    const blank = resetAllData();
    setProjects([blank]);
    setActiveId(blank.id);
    setIsSettingsOpen(false);
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

    setProjects(prev => prev.map(p => p.id === updatedProj.id ? updatedProj : p));
  };

  // Save Settings
  const handleSaveSettings = (updated: Partial<TenderProject>) => {
    const threshold = updated.deviationThreshold ?? currentProject.deviationThreshold;
    
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

    setProjects(prev => prev.map(p => p.id === updatedProj.id ? updatedProj : p));
  };

  // Create New Project
  const handleCreateProject = ({ title, referenceNumber, contractType }: { title: string; referenceNumber: string; contractType: ContractType }) => {
    const refNo = referenceNumber || `TND-${Date.now().toString().slice(-4)}`;

    const newProj: TenderProject = {
      ...createDefaultProject(),
      id: `project-${Date.now()}`,
      title,
      contractType,
      referenceNumber: refNo,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      auditLogs: [{
        id: `log-${Date.now()}`,
        timestamp: new Date().toISOString(),
        userName: 'المهندس أسامة خليل هاشم',
        action: 'إنشاء مناقصة جديدة',
        details: `تم إنشاء المناقصة (${title}) بنجاح — نوع العقد: ${CONTRACT_TYPES[contractType].label}`
      }]
    };

    setProjects(prev => [newProj, ...prev]);
    setActiveId(newProj.id);
    setActiveProjectId(newProj.id);
  };

  // Import Project Backup (JSON)
  const handleImportBackup = async (file: File) => {
    try {
      const imported = await parseProjectBackupFile(file);

      // تفادي تعارض المعرّف مع مشروع موجود مسبقاً بإعطائه معرفاً جديداً
      const idConflict = projects.some(p => p.id === imported.id);
      const restoredProject: TenderProject = {
        ...imported,
        id: idConflict ? `project-${Date.now()}` : imported.id,
        updatedAt: new Date().toISOString()
      };

      const withLog = addAuditLog(
        restoredProject,
        'استعادة من نسخة احتياطية',
        `تم استيراد هذا المشروع من ملف نسخة احتياطية (${file.name})`
      );

      setProjects(prev => {
        const withoutOld = prev.filter(p => p.id !== withLog.id);
        return [withLog, ...withoutOld];
      });
      setActiveId(withLog.id);
      setActiveProjectId(withLog.id);
      alert(`تم استيراد المشروع (${withLog.title}) بنجاح من النسخة الاحتياطية.`);
    } catch (err: any) {
      alert(`فشل استيراد النسخة الاحتياطية: ${err.message}`);
    }
  };

  // Import All Projects Backup (JSON) — يستبدل كل المناقصات الحالية بالنسخة الشاملة المستوردة
  const handleImportAllBackup = async (file: File) => {
    try {
      const imported = await parseAllProjectsBackupFile(file);

      if (!window.confirm(`⚠️ سيتم استبدال كل مناقصاتك الحالية (${projects.length}) بالنسخة الاحتياطية الشاملة المستوردة (${imported.length} مناقصة). هل أنت متأكد؟`)) {
        return;
      }

      saveAllProjects(imported);
      setProjects(imported);
      setActiveId(imported[0].id);
      setActiveProjectId(imported[0].id);
      alert(`تم استيراد (${imported.length}) مناقصة بنجاح من النسخة الاحتياطية الشاملة.`);
      setIsSettingsOpen(false);
    } catch (err: any) {
      alert(`فشل استيراد النسخة الاحتياطية الشاملة: ${err.message}`);
    }
  };

  // Select Table Tab and Scroll
  const handleSelectTableTab = () => {
    setActiveTab('table');
    setTimeout(() => {
      document.getElementById('boq-table-container')?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 text-slate-900 font-sans">
      
      {/* Top Navbar */}
      <Navbar
        project={currentProject}
        projects={projects}
        activeBidder={activeBidder}
        onSelectProject={(id) => {
          setActiveId(id);
          setActiveProjectId(id);
        }}
        onNewProject={() => setIsNewProjectOpen(true)}
        onOpenMultiBidder={() => setIsMultiBidderOpen(true)}
        onOpenAuditTrail={() => setIsAuditOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {/* Project Header Info Banner */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs mb-6">
          
          {/* Top Meta Bar */}
          <div className="flex items-center justify-between gap-4 mb-3 pb-3 border-b border-slate-100 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              {!isEditingRefNumber ? (
                <span
                  onClick={() => setIsEditingRefNumber(true)}
                  title="انقر لتعديل رقم الطلبية أو المناقصة"
                  className="group bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 text-xs font-black px-3 py-1 rounded-full font-mono shadow-2xs cursor-pointer flex items-center gap-1.5 transition"
                >
                  {currentProject.referenceNumber || 'أدخل رقم الطلبية/المناقصة'}
                  <Pencil className="w-3 h-3 text-amber-700 opacity-0 group-hover:opacity-100 transition" />
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={currentProject.referenceNumber}
                    onChange={(e) => {
                      const val = e.target.value;
                      setProjects(prev => prev.map(p => p.id === currentProject.id ? { ...p, referenceNumber: val } : p));
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && setIsEditingRefNumber(false)}
                    className="bg-white border border-amber-400 text-amber-900 text-xs font-black font-mono px-3 py-1 rounded-full focus:outline-none ring-2 ring-amber-500/20 w-40"
                    autoFocus
                  />
                  <button
                    onClick={() => setIsEditingRefNumber(false)}
                    className="bg-amber-600 text-white text-xs font-bold px-2.5 py-1 rounded-full shrink-0 cursor-pointer"
                  >
                    حفظ
                  </button>
                </span>
              )}
              <span className="bg-slate-100 text-slate-800 text-xs font-bold px-3.5 py-1 rounded-full border border-slate-200">
                {currentProject.entityName}
              </span>
              {contractTypeInfo(currentProject.contractType) ? (
                <span className="bg-indigo-50 text-indigo-900 text-xs font-bold px-3.5 py-1 rounded-full border border-indigo-200">
                  نوع العقد: {contractTypeInfo(currentProject.contractType)!.label}
                </span>
              ) : (
                <button
                  onClick={() => setIsSettingsOpen(true)}
                  title="نوع العقد يحدد معايير المفاضلة في التوصية (ضوابط رقم 5)"
                  className="bg-rose-50 hover:bg-rose-100 text-rose-800 text-xs font-bold px-3.5 py-1 rounded-full border border-rose-300 cursor-pointer transition"
                >
                  ⚠️ حدد نوع العقد
                </button>
              )}
            </div>

            <div className="text-xs text-slate-500 font-semibold">
              تاريخ آخر تحديث: {new Date(currentProject.updatedAt).toLocaleDateString('ar-EG')}
            </div>
          </div>

          {/* Middle Row: Project Title (Editable) */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
            <div className="flex-1 min-w-[280px]">
              <div className="flex items-center gap-2 group">
                {!isEditingTitle ? (
                  <h1 
                    onClick={() => setIsEditingTitle(true)}
                    className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight cursor-pointer hover:text-blue-700 transition flex items-center gap-2"
                    title="انقر لتعديل اسم المناقصة والمشروع فوراً"
                  >
                    {currentProject.title}
                    <Pencil className="w-4 h-4 text-slate-400 opacity-0 group-hover:opacity-100 transition" />
                  </h1>
                ) : (
                  <div className="flex items-center gap-2 w-full max-w-xl">
                    <input
                      type="text"
                      value={currentProject.title}
                      onChange={(e) => {
                        const val = e.target.value;
                        setProjects(prev => prev.map(p => p.id === currentProject.id ? { ...p, title: val } : p));
                      }}
                      className="w-full text-lg font-bold border border-blue-500 rounded-xl px-3 py-1 bg-white focus:outline-none ring-2 ring-blue-500/20"
                      autoFocus
                    />
                    <button
                      onClick={() => setIsEditingTitle(false)}
                      className="bg-blue-600 text-white text-xs font-bold px-3 py-1.5 rounded-xl shrink-0 cursor-pointer"
                    >
                      حفظ
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Right Controls: Active Bidder Switcher & Excel & 3 Main Tabs */}
            <div className="flex items-center gap-3 flex-wrap">
              
              {/* Bidder Switcher, Inline Rename & Quick Add Button */}
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-300 rounded-2xl p-1.5 shadow-xs">
                <div className="flex items-center gap-1 px-2">
                  <Building2 className="w-4 h-4 text-indigo-600" />
                  <span className="text-xs font-bold text-slate-600">الشركة:</span>
                </div>

                {!isEditingBidderName ? (
                  <>
                    <select
                      value={activeBidder.id}
                      onChange={(e) => {
                        const updatedProj = { ...currentProject, activeBidderId: e.target.value };
                        setProjects(prev => prev.map(p => p.id === updatedProj.id ? updatedProj : p));
                      }}
                      className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs sm:text-sm font-black text-indigo-700 focus:outline-none cursor-pointer max-w-[220px] truncate"
                    >
                      {currentProject.bidders.map(b => (
                        <option key={b.id} value={b.id} className="text-slate-900">
                          {b.name} ({b.status === 'recommended' ? '★ موصى بالترسية' : b.status})
                        </option>
                      ))}
                    </select>

                    <button
                      onClick={() => {
                        setTempBidderName(activeBidder.name);
                        setIsEditingBidderName(true);
                      }}
                      className="p-1.5 text-slate-500 hover:text-indigo-700 hover:bg-white rounded-lg transition cursor-pointer"
                      title="تعديل اسم الشركة النشطة حالياً"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </>
                ) : (
                  <>
                    <input
                      type="text"
                      value={tempBidderName}
                      onChange={(e) => setTempBidderName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (handleUpdateBidderName(tempBidderName.trim() || activeBidder.name), setIsEditingBidderName(false))}
                      className="bg-white border border-indigo-400 rounded-xl px-3 py-1.5 text-xs sm:text-sm font-black text-indigo-900 focus:outline-none ring-2 ring-indigo-500/20 w-56"
                      autoFocus
                    />
                    <button
                      onClick={() => {
                        handleUpdateBidderName(tempBidderName.trim() || activeBidder.name);
                        setIsEditingBidderName(false);
                      }}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3 py-1.5 rounded-xl shrink-0 cursor-pointer"
                    >
                      حفظ
                    </button>
                  </>
                )}

                <button
                  onClick={() => handleAddNewBidder()}
                  className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-xs transition cursor-pointer"
                  title="إضافة شركة / مقاول جديد للمناقصة"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ شركة جديدة</span>
                </button>
              </div>

              {/* View Tabs */}
              <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200">
                <button
                  onClick={handleSelectTableTab}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black transition cursor-pointer ${
                    activeTab === 'table' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Table2 className="w-4 h-4" />
                  <span>الجدول المالي</span>
                </button>

                <button
                  onClick={() => setActiveTab('summary')}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black transition cursor-pointer ${
                    activeTab === 'summary' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Award className="w-4 h-4 text-amber-900" />
                  <span>خلاصة الترسية والمقارنة 🏆</span>
                </button>

                <button
                  onClick={() => setActiveTab('charts')}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black transition cursor-pointer ${
                    activeTab === 'charts' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <BarChart3 className="w-4 h-4" />
                  <span>الرسوم البيانية</span>
                </button>
              </div>

            </div>
          </div>

        </div>

        {/* Dynamic KPI Cards */}
        <KPIStatsCards
          totals={activeBidder.totals}
          currency={currentProject.currency}
          deviationThreshold={currentProject.deviationThreshold}
        />

        {/* Content based on Tab */}
        <div id="boq-table-container">
          {activeTab === 'table' ? (
            <BOQTable
              items={activeBidder.items}
              totals={activeBidder.totals}
              currency={currentProject.currency}
              deviationThreshold={currentProject.deviationThreshold}
              bidderName={activeBidder.name}
              onUpdateItem={handleUpdateItem}
              onAddItem={handleAddItem}
              onDeleteItem={handleDeleteItem}
              onDuplicateItem={handleDuplicateItem}
              onClearBidderPrices={handleClearBidderPrices}
              onOpenSmartImport={() => {
                setSmartImportDocType('bidder');
                setIsSmartImportOpen(true);
              }}
              onOpenOcr={() => setIsOcrOpen(true)}
            />
          ) : activeTab === 'summary' ? (
            <ExecutiveSummaryView
              project={currentProject}
              onSelectBidder={(id) => {
                const updatedProj = { ...currentProject, activeBidderId: id };
                setProjects(prev => prev.map(p => p.id === updatedProj.id ? updatedProj : p));
              }}
              onUpdateBidderStatus={handleUpdateBidderStatus}
              onOpenPrint={() => setIsPrintOpen(true)}
              onExportExcel={() => exportTenderToExcel(currentProject, activeBidder)}
            />
          ) : (
            <ChartsView
              bidders={currentProject.bidders}
              currency={currentProject.currency}
              deviationThreshold={currentProject.deviationThreshold}
            />
          )}
        </div>

      </main>

      {/* Sleek Permanent Footer */}
      <footer className="bg-slate-950 text-slate-400 text-xs py-4 border-t border-slate-800 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-amber-400 font-bold">نظام تحليل العطاءات التجاري المتكامل</span>
            <button
              onClick={() => setIsWhatsNewOpen(true)}
              title="ما الجديد في هذا الإصدار"
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-mono px-1.5 py-0.5 rounded-md border border-slate-700 cursor-pointer transition"
            >
              {versionLabel()}
            </button>
          </div>

          <div className="text-emerald-400 font-bold">
            إعداد: م. أسامة خليل هاشم
          </div>
        </div>
      </footer>

      {/* Modals */}
      <SmartTableImportModal
        isOpen={isSmartImportOpen}
        onClose={() => setIsSmartImportOpen(false)}
        onApplyExtractedItems={handleApplyExtractedItems}
        currentBidderName={activeBidder.name}
        initialDocType={smartImportDocType}
      />

      <ImageOcrModal
        isOpen={isOcrOpen}
        onClose={() => setIsOcrOpen(false)}
        onApplyExtractedItems={handleApplyExtractedItems}
      />

      <MultiBidderMatrix
        isOpen={isMultiBidderOpen}
        onClose={() => setIsMultiBidderOpen(false)}
        project={currentProject}
        onSelectBidder={(id) => {
          const updatedProj = { ...currentProject, activeBidderId: id };
          setProjects(prev => prev.map(p => p.id === updatedProj.id ? updatedProj : p));
        }}
        onAddNewBidder={handleAddNewBidder}
        onUpdateBidderStatus={handleUpdateBidderStatus}
        onDeleteBidder={handleDeleteBidder}
      />

      <AuditTrailModal
        isOpen={isAuditOpen}
        onClose={() => setIsAuditOpen(false)}
        logs={currentProject.auditLogs || []}
      />

      <ProjectSettingsModal
        // يُعاد إنشاؤه مع كل فتح ومع كل مناقصة: حقوله تُهيأ من المشروع مرة واحدة عند الإنشاء،
        // وبدون ذلك تظهر بيانات مناقصة سابقة ويُكتب فوق الحالية عند الحفظ
        key={`${currentProject.id}-${isSettingsOpen}`}
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        project={currentProject}
        onSaveSettings={handleSaveSettings}
        onExportBackup={() => downloadProjectBackup(currentProject)}
        onImportBackup={handleImportBackup}
        onExportAllBackup={() => downloadAllProjectsBackup(projects)}
        onImportAllBackup={handleImportAllBackup}
        onDeleteProject={handleDeleteProject}
        onFactoryReset={handleFactoryReset}
        onResetAllBidders={handleResetAllBidders}
        canDeleteProject={projects.length > 1}
      />

      <UpdateNotice
        manualOpen={isWhatsNewOpen}
        onManualClose={() => setIsWhatsNewOpen(false)}
        blockingWork={blockingWork}
        getResumeState={() => ({ tab: activeTab, scrollY: window.scrollY })}
      />

      <NewProjectModal
        isOpen={isNewProjectOpen}
        onClose={() => setIsNewProjectOpen(false)}
        onCreate={handleCreateProject}
      />

      <PrintReportModal
        isOpen={isPrintOpen}
        onClose={() => setIsPrintOpen(false)}
        project={currentProject}
        activeBidder={activeBidder}
      />

    </div>
  );
}

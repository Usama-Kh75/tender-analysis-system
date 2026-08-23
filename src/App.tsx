import React, { useState, useEffect } from 'react';
import { 
  getAllProjects, 
  saveAllProjects, 
  getActiveProjectId, 
  setActiveProjectId, 
  addAuditLog, 
  createDefaultProject 
} from './utils/storageService';
import { calculateBOQMetrics } from './utils/calculations';
import { exportTenderToExcel, importBOQFromExcel } from './utils/excelService';
import { TenderProject, Bidder, BOQItem } from './types/tender';

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

import { 
  Table2, 
  UploadCloud, 
  Edit3, 
  Pencil, 
  Award,
  BarChart3,
  Building2,
  Plus
} from 'lucide-react';

export function App() {
  const [projects, setProjects] = useState<TenderProject[]>([]);
  const [activeProjectId, setActiveId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'table' | 'summary' | 'charts'>('table');
  const [showInputGuide, setShowInputGuide] = useState<boolean>(true);
  const [isEditingTitle, setIsEditingTitle] = useState<boolean>(false);

  // Modals
  const [isSmartImportOpen, setIsSmartImportOpen] = useState(false);
  const [smartImportDocType, setSmartImportDocType] = useState<'bidder' | 'estimated' | 'both'>('bidder');
  const [isOcrOpen, setIsOcrOpen] = useState(false);
  const [isMultiBidderOpen, setIsMultiBidderOpen] = useState(false);
  const [isAuditOpen, setIsAuditOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPrintOpen, setIsPrintOpen] = useState(false);

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

  // Clear All Items (Empty Table)
  const handleClearAllTableItems = () => {
    if (!window.confirm('⚠️ تحذير: هل أنت متأكد من مسح وتفريغ الجدول بالكامل وحذف كافة الفقرات للبدء من الصفر؟')) {
      return;
    }

    const initialItem: Partial<BOQItem> = {
      itemNo: 1,
      description: 'فقرة 1',
      quantity: 1,
      estimatedTotal: 0,
      bidderTotal: 0
    };

    const recalc = calculateBOQMetrics([initialItem], currentProject.deviationThreshold);

    const updatedBidder: Bidder = {
      ...activeBidder,
      name: 'شركة جديدة',
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
      'تفريغ الجدول بالكامل',
      `تم مسح كافة فقرات الجدول وتصفيره للبدء من الصفر`
    );

    setProjects(prev => prev.map(p => p.id === updatedProj.id ? updatedProj : p));
  };

  // Update Item in Active Bidder
  const handleUpdateItem = (index: number, field: keyof BOQItem, val: any) => {
    const oldVal = (activeBidder.items[index] as any)[field];
    const updatedRaw = [...activeBidder.items];
    updatedRaw[index] = { ...updatedRaw[index], [field]: val };

    const recalculation = calculateBOQMetrics(updatedRaw, currentProject.deviationThreshold);

    const updatedBidder: Bidder = {
      ...activeBidder,
      items: recalculation.items,
      totals: recalculation.totals
    };

    const updatedBidders = currentProject.bidders.map(b => b.id === activeBidder.id ? updatedBidder : b);
    
    let updatedProj: TenderProject = {
      ...currentProject,
      bidders: updatedBidders,
      updatedAt: new Date().toISOString()
    };

    if (['estimatedTotal', 'bidderTotal', 'description'].includes(field as string)) {
      updatedProj = addAuditLog(
        updatedProj,
        'تعديل قيمة مالية',
        `تم تعديل حقل (${String(field)}) للفقرة رقم (${updatedRaw[index].itemNo}) من (${oldVal}) إلى (${val})`,
        { itemNo: updatedRaw[index].itemNo, oldValue: oldVal, newValue: val }
      );
    }

    setProjects(prev => prev.map(p => p.id === updatedProj.id ? updatedProj : p));
  };

  // Add Item
  const handleAddItem = () => {
    const nextNo = activeBidder.items.length + 1;
    const newItem: Partial<BOQItem> = {
      itemNo: nextNo,
      description: `فقرة ${nextNo}`,
      quantity: 1,
      estimatedTotal: 0,
      bidderTotal: 0
    };

    const updatedRaw = [...activeBidder.items, newItem];
    const recalculation = calculateBOQMetrics(updatedRaw, currentProject.deviationThreshold);

    const updatedBidder: Bidder = {
      ...activeBidder,
      items: recalculation.items,
      totals: recalculation.totals
    };

    const updatedBidders = currentProject.bidders.map(b => b.id === activeBidder.id ? updatedBidder : b);
    let updatedProj: TenderProject = {
      ...currentProject,
      bidders: updatedBidders,
      updatedAt: new Date().toISOString()
    };

    setProjects(prev => prev.map(p => p.id === updatedProj.id ? updatedProj : p));
  };

  // Batch Add Items (Direct Smart Paste Handler)
  const handleBatchAddItems = (newItems: Partial<BOQItem>[]) => {
    let mergedItems: Partial<BOQItem>[] = [];

    // إذا كان الجدول يحتوي على عناصر فارغة (أو أسطر مبدئية) وتم لصق عدد فقرات، ندمجها من البداية
    if (activeBidder.items.length > 0 && (activeBidder.items[0].estimatedTotal === 0 && activeBidder.items[0].bidderTotal === 0 && activeBidder.items.length === 1)) {
      mergedItems = newItems;
    } else if (newItems.length <= activeBidder.items.length && activeBidder.items.length > 1) {
      // دمج الأرقام في الأسطر الحالية
      mergedItems = activeBidder.items.map((existing, idx) => {
        const incoming = newItems[idx];
        if (!incoming) return existing;
        return {
          ...existing,
          estimatedTotal: incoming.estimatedTotal !== 0 ? incoming.estimatedTotal : existing.estimatedTotal,
          bidderTotal: incoming.bidderTotal !== 0 ? incoming.bidderTotal : existing.bidderTotal,
          description: incoming.description && !incoming.description.startsWith('فقرة') ? incoming.description : existing.description
        };
      });
    } else {
      mergedItems = newItems;
    }

    const recalculation = calculateBOQMetrics(mergedItems, currentProject.deviationThreshold);

    const updatedBidder: Bidder = {
      ...activeBidder,
      items: recalculation.items,
      totals: recalculation.totals
    };

    const updatedBidders = currentProject.bidders.map(b => b.id === activeBidder.id ? updatedBidder : b);
    let updatedProj: TenderProject = {
      ...currentProject,
      bidders: updatedBidders,
      updatedAt: new Date().toISOString()
    };

    updatedProj = addAuditLog(
      updatedProj,
      'إدراج فقرات جماعي (لصق مباشر)',
      `تم إدراج (${newItems.length}) فقرة إلى جدول التحليل عبر الحافظة`
    );

    setProjects(prev => prev.map(p => p.id === updatedProj.id ? updatedProj : p));
  };

  // Delete Item
  const handleDeleteItem = (index: number) => {
    const targetItem = activeBidder.items[index];
    const updatedRaw = activeBidder.items.filter((_, i) => i !== index);
    const recalculation = calculateBOQMetrics(updatedRaw, currentProject.deviationThreshold);

    const updatedBidder: Bidder = {
      ...activeBidder,
      items: recalculation.items,
      totals: recalculation.totals
    };

    const updatedBidders = currentProject.bidders.map(b => b.id === activeBidder.id ? updatedBidder : b);
    let updatedProj: TenderProject = {
      ...currentProject,
      bidders: updatedBidders,
      updatedAt: new Date().toISOString()
    };

    updatedProj = addAuditLog(
      updatedProj,
      'حذف فقرة',
      `تم حذف الفقرة رقم (${targetItem?.itemNo})`
    );

    setProjects(prev => prev.map(p => p.id === updatedProj.id ? updatedProj : p));
  };

  // Duplicate Item
  const handleDuplicateItem = (index: number) => {
    const source = activeBidder.items[index];
    const dup: Partial<BOQItem> = {
      ...source,
      id: `item-${Date.now()}`,
      itemNo: `${source.itemNo} (مكرر)`,
      description: `${source.description} (نسخة)`
    };

    const updatedRaw = [...activeBidder.items, dup];
    const recalculation = calculateBOQMetrics(updatedRaw, currentProject.deviationThreshold);

    const updatedBidder: Bidder = {
      ...activeBidder,
      items: recalculation.items,
      totals: recalculation.totals
    };

    const updatedBidders = currentProject.bidders.map(b => b.id === activeBidder.id ? updatedBidder : b);
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
          bidderTotal: bidVal
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

      let updatedProj: TenderProject = {
        ...currentProject,
        bidders: [...currentProject.bidders, newBidder],
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
      const maxLen = Math.max(activeBidder.items.length, extracted.length);

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
        `تم استيراد وتحديث جدول الكلفة التخمينية لشركة نفط البصرة (${extracted.length} فقرة)`
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
          bidderTotal: ext?.bidderTotal !== undefined ? ext.bidderTotal : (existing?.bidderTotal || 0)
        });
      }

      const recalc = calculateBOQMetrics(mergedItems, currentProject.deviationThreshold);

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
        'تحديث أسعار مجهز',
        `تم تحديث وتعبئة أسعار المجهز (${activeBidder.name}) لـ (${extracted.length}) فقرة`
      );

      setProjects(prev => prev.map(p => p.id === updatedProj.id ? updatedProj : p));

    } else {
      // 4. استبدال كامل للجدول
      const recalc = calculateBOQMetrics(extracted, currentProject.deviationThreshold);

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

  // Update Bidder Status
  const handleUpdateBidderStatus = (bidderId: string, status: Bidder['status']) => {
    const updatedBidders = currentProject.bidders.map(b => b.id === bidderId ? { ...b, status } : b);
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
    );

    setProjects(prev => prev.map(p => p.id === updatedProj.id ? updatedProj : p));
  };

  // Create New Project
  const handleNewProject = () => {
    const title = prompt('أدخل اسم المناقصة الجديدة:');
    if (!title) return;
    const refNo = prompt('أدخل رقم الإحالة / المناقصة:') || `BOC-TND-${Date.now().toString().slice(-4)}`;

    const newProj: TenderProject = {
      ...createDefaultProject(),
      id: `project-${Date.now()}`,
      title,
      referenceNumber: refNo,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      auditLogs: [{
        id: `log-${Date.now()}`,
        timestamp: new Date().toISOString(),
        userName: 'المهندس أسامة خليل هاشم',
        action: 'إنشاء مناقصة جديدة',
        details: `تم إنشاء المناقصة (${title}) بنجاح`
      }]
    };

    setProjects(prev => [newProj, ...prev]);
    setActiveId(newProj.id);
    setActiveProjectId(newProj.id);
  };

  // Excel Import Direct
  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const items = await importBOQFromExcel(file, currentProject.deviationThreshold);
      if (items.length > 0) {
        handleApplyExtractedItems(items, false);
      }
    } catch (err: any) {
      alert(`حدث خطأ أثناء قراءة ملف Excel: ${err.message}`);
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
        onNewProject={handleNewProject}
        onOpenSmartImport={(type) => {
          setSmartImportDocType(type || 'bidder');
          setIsSmartImportOpen(true);
        }}
        onOpenOcr={() => setIsOcrOpen(true)}
        onOpenMultiBidder={() => setIsMultiBidderOpen(true)}
        onOpenAuditTrail={() => setIsAuditOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenPrint={() => setIsPrintOpen(true)}
        onExportExcel={() => exportTenderToExcel(currentProject, activeBidder)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {/* Project Header Info Banner */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs mb-6">
          
          {/* Top Meta Bar */}
          <div className="flex items-center justify-between gap-4 mb-3 pb-3 border-b border-slate-100 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="bg-amber-100 text-amber-900 border border-amber-300 text-xs font-black px-3 py-1 rounded-full font-mono shadow-2xs">
                {currentProject.referenceNumber}
              </span>
              <span className="bg-slate-100 text-slate-800 text-xs font-bold px-3.5 py-1 rounded-full border border-slate-200">
                {currentProject.entityName}
              </span>
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
              
              {/* Bidder Switcher & Quick Add Button */}
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-300 rounded-2xl p-1.5 shadow-xs">
                <div className="flex items-center gap-1 px-2">
                  <Building2 className="w-4 h-4 text-indigo-600" />
                  <span className="text-xs font-bold text-slate-600">الشركة:</span>
                </div>
                
                <select
                  value={activeBidder.id}
                  onChange={(e) => {
                    const updatedProj = { ...currentProject, activeBidderId: e.target.value };
                    setProjects(prev => prev.map(p => p.id === updatedProj.id ? updatedProj : p));
                  }}
                  className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs sm:text-sm font-black text-indigo-700 focus:outline-none cursor-pointer"
                >
                  {currentProject.bidders.map(b => (
                    <option key={b.id} value={b.id} className="text-slate-900">
                      {b.name} ({b.status === 'recommended' ? '★ موصى بالترسية' : b.status})
                    </option>
                  ))}
                </select>

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
              onUpdateBidderName={handleUpdateBidderName}
              onUpdateItem={handleUpdateItem}
              onAddItem={handleAddItem}
              onDeleteItem={handleDeleteItem}
              onDuplicateItem={handleDuplicateItem}
              onBatchAddItems={handleBatchAddItems}
              onClearBidderPrices={handleClearBidderPrices}
              onClearAllItems={handleClearAllTableItems}
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
              items={activeBidder.items}
              totals={activeBidder.totals}
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
            <span className="text-amber-400 font-bold">نظام تحليل وتقييم العطاءات المتكامل (BOC)</span>
            <span>•</span>
            <span>وزارة النفط / شركة نفط البصرة</span>
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
      />

      <AuditTrailModal
        isOpen={isAuditOpen}
        onClose={() => setIsAuditOpen(false)}
        logs={currentProject.auditLogs || []}
      />

      <ProjectSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        project={currentProject}
        onSaveSettings={handleSaveSettings}
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

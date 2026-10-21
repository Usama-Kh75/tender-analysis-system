import type { Dispatch, SetStateAction } from 'react';
import { BackupMarks, readBackupMarks } from '../utils/backupStatus';
import {
  saveAllProjects,
  setActiveProjectId,
  addAuditLog,
  createNewTenderProject,
  downloadProjectBackup,
  parseProjectBackupFile,
  downloadAllProjectsBackup,
  parseAllProjectsBackupFile,
  resetAllData
} from '../utils/storageService';
import { CONTRACT_TYPES } from '../utils/contractTypes';
import { BUDGET_TYPES } from '../utils/budgetTypes';
import { TenderProject, ContractType, BudgetType } from '../types/tender';

interface ProjectHandlersArgs {
  projects: TenderProject[];
  setProjects: Dispatch<SetStateAction<TenderProject[]>>;
  setActiveId: (id: string) => void;
  recordBackup: (marks: BackupMarks) => void;
  // قد يكون undefined قبل الرجوع المبكر (شاشة البداية)
  currentProject: TenderProject | undefined;
  closeSettings: () => void;
  closeProjects: () => void;
}

// معالجات مستوى المناقصات: لا تعتمد على مجهز نشط، فتُستدعى قبل الرجوعين المبكرين في App
export function createProjectHandlers({
  projects, setProjects, setActiveId, recordBackup, currentProject, closeSettings, closeProjects
}: ProjectHandlersArgs) {
  // النسخة الشاملة تستبدل كل العلامات، فتسقط علامات المناقصات المحذوفة
  const handleBackupAll = async () => {
    const at = await downloadAllProjectsBackup(projects);
    if (at) recordBackup(Object.fromEntries(projects.map(p => [p.id, at])));
  };
  // قراءة العلامات من جديد بعد await مقصودة، لتفادي القيمة القديمة في الإغلاق (closure)
  const handleBackupProject = async () => {
    const at = await downloadProjectBackup(currentProject!);
    if (at) recordBackup({ ...readBackupMarks(), [currentProject!.id]: at });
  };

  // Create New Project
  // مناقصة جديدة فارغة تماماً (createNewTenderProject) بشركة لكل اسم مُدخل وجدول مصفّر
  const handleCreateProject = ({ title, referenceNumber, contractType, budgetType, bidderNames }: { title: string; referenceNumber: string; contractType: ContractType; budgetType: BudgetType; bidderNames: string[] }) => {
    const refNo = referenceNumber || `TND-${Date.now().toString().slice(-4)}`;
    const blank = createNewTenderProject({ title, referenceNumber: refNo, contractType, budgetType, bidderNames });

    const newProj: TenderProject = {
      ...blank,
      auditLogs: [{
        id: `log-${Date.now()}`,
        timestamp: new Date().toISOString(),
        userName: 'المهندس أسامة خليل هاشم',
        action: 'إنشاء مناقصة جديدة',
        details: `تم إنشاء المناقصة (${title}) بنجاح — نوع العقد: ${CONTRACT_TYPES[contractType].label} — نوع الموازنة: ${BUDGET_TYPES[budgetType].label}`
          + ` — الشركات: ${blank.bidders.map(b => b.name).join('، ')}`
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

  // حذف مناقصة (أي مناقصة، بما فيها الأخيرة: يبقى النظام بلا مناقصات وتظهر شاشة البداية)
  const handleDeleteProject = (projectId: string) => {
    const target = projects.find(p => p.id === projectId);
    if (!target) return;

    if (!window.confirm(`⚠️ سيتم حذف مناقصة/طلبية (${target.title}) نهائياً بكل بياناتها (المجهزين والأسعار وسجل التدقيق).

يُنصح بتنزيل نسخة احتياطية منها أولاً إن كانت مهمة. هل أنت متأكد؟`)) {
      return;
    }

    const remaining = projects.filter(p => p.id !== projectId);
    setProjects(remaining);
    if (projectId === currentProject?.id) {
      const nextId = remaining[0]?.id ?? '';
      setActiveId(nextId);
      setActiveProjectId(nextId);
    }
    closeSettings();
    if (remaining.length === 0) closeProjects();
  };

  // Full Factory Reset — Wipe All Local Data, Start With No Tenders
  const handleFactoryReset = () => {
    if (!window.confirm('⚠️ تحذير أخير: سيتم مسح جميع المناقصات والطلبيات وبياناتها المحفوظة محلياً في هذا المتصفح نهائياً بلا رجعة، والبدء بنظام فارغ تماماً. هل تريد المتابعة؟\n\nيُنصح بتنزيل نسخة احتياطية أولاً إن كانت البيانات الحالية مهمة.')) {
      return;
    }

    resetAllData();
    setProjects([]);
    setActiveId('');
    closeSettings();
  };

  // فتح مناقصة أو أحد عروضها من نافذة «المناقصات». اختيار المجهز لا يغيّر updatedAt، كقائمة المجهزين
  const handleOpenFromBrowser = (projectId: string, bidderId?: string) => {
    if (bidderId) {
      setProjects(prev => prev.map(p => p.id === projectId ? { ...p, activeBidderId: bidderId } : p));
    }
    setActiveId(projectId);
    setActiveProjectId(projectId);
    closeProjects();
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
      // المناقصات المستعادة محفوظة في الملف الذي استُعيدت منه
      recordBackup(Object.fromEntries(imported.map(p => [p.id, new Date().toISOString()])));
      setActiveId(imported[0].id);
      setActiveProjectId(imported[0].id);
      alert(`تم استيراد (${imported.length}) مناقصة بنجاح من النسخة الاحتياطية الشاملة.`);
      closeSettings();
    } catch (err: any) {
      alert(`فشل استيراد النسخة الاحتياطية الشاملة: ${err.message}`);
    }
  };

  // اختيار مناقصة من شريط التنقل
  const selectProject = (id: string) => {
    setActiveId(id);
    setActiveProjectId(id);
  };

  return {
    handleBackupAll, handleBackupProject, handleCreateProject, handleImportBackup, handleDeleteProject,
    handleFactoryReset, handleOpenFromBrowser, handleImportAllBackup, selectProject
  };
}

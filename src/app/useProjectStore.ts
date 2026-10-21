import { useState, useEffect, useRef, useMemo } from 'react';
import { BackupMarks, isUnloadAllowed, readBackupMarks, saveBackupMarks, unsavedProjects } from '../utils/backupStatus';
import {
  getAllProjects,
  getRecoveredData,
  clearRecoveredData,
  saveAllProjects,
  getActiveProjectId
} from '../utils/storageService';
import { localDate } from '../utils/localDate';
import { RESUMED_STATE } from '../resume';
import { TenderProject } from '../types/tender';

// مخزن المناقصات: التحميل الأول والحفظ والتنبيه قبل المغادرة واستعادة التمرير. يُستدعى في أول App قبل أي رجوع
export function useProjectStore() {
  // التحميل الأول مرة واحدة: getAllProjects قبل getRecoveredData لأن الأولى تنسخ البيانات التالفة إلى مفتاح الاسترجاع
  const [initial] = useState(() => {
    const stored = getAllProjects();
    return { stored, recovered: getRecoveredData(), activeId: getActiveProjectId() || stored[0]?.id || '' };
  });
  const [projects, setProjects] = useState<TenderProject[]>(initial.stored);
  const [activeProjectId, setActiveId] = useState<string>(initial.activeId);
  // لا يُحفظ شيء قبل اكتمال التحميل الأول؛ وبعده تُحفظ القائمة حتى لو فرغت (حذف آخر مناقصة)
  const loaded = true;
  const [recovered, setRecovered] = useState(initial.recovered);
  const [backupMarks, setBackupMarks] = useState<BackupMarks>(readBackupMarks);

  // Save projects whenever they change
  useEffect(() => {
    if (loaded) saveAllProjects(projects);
  }, [projects, loaded]);

  // تذكير النسخة الاحتياطية: المناقصات التي تغيّرت منذ آخر نسخة تحويها
  const unsaved = useMemo(() => unsavedProjects(projects, backupMarks), [projects, backupMarks]);
  const hasUnsaved = loaded && unsaved.length > 0;

  // المتصفح لا يعرض إلا رسالته العامة «مغادرة الموقع؟»، ولا يظهر التنبيه إلا إذا بقيت تغييرات لم تُحفظ في نسخة احتياطية
  useEffect(() => {
    if (!hasUnsaved) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isUnloadAllowed()) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [hasUnsaved]);

  const recordBackup = (marks: BackupMarks) => { saveBackupMarks(marks); setBackupMarks(marks); };

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

  const downloadRecovered = () => {
    const blob = new Blob([JSON.stringify(recovered, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `بيانات_مناقصات_تعذرت_قراءتها_${localDate()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const dismissRecovered = () => { clearRecoveredData(); setRecovered([]); };

  return {
    projects, setProjects, activeProjectId, setActiveId, loaded, recovered, backupMarks,
    unsaved, recordBackup, downloadRecovered, dismissRecovered
  };
}

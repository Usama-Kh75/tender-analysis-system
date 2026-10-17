import type { TenderProject } from '../types/tender';

// متى حُفظت كل مناقصة آخر مرة في نسخة احتياطية (JSON)، لتذكير المستخدم بما تغيّر بعدها:
// البيانات في المتصفح وحده، فمسح بيانات المتصفح يُضيّع كل مناقصة لم تُحفظ في ملف.
const BACKUP_KEY = 'antigravity_tenders_backed_up_v1';

// معرّف المناقصة ← وقت آخر نسخة احتياطية تحويها
export type BackupMarks = Record<string, string>;

export function readBackupMarks(): BackupMarks {
  try {
    const marks = JSON.parse(localStorage.getItem(BACKUP_KEY) || '{}');
    return marks && typeof marks === 'object' && !Array.isArray(marks) ? marks : {};
  } catch { return {}; }
}

export function saveBackupMarks(marks: BackupMarks): void {
  try { localStorage.setItem(BACKUP_KEY, JSON.stringify(marks)); } catch { /* تخزين محظور: يبقى التذكير قائماً */ }
}

// المناقصات التي تغيّرت بعد آخر نسخة تحويها، أو لم تُحفظ في نسخة قط.
// التغيير يُعرف من updatedAt، فكل تعديل على بيانات المناقصة يحدّثه (اختيار المجهز المعروض لا يحدّثه عمداً).
export function unsavedProjects(projects: TenderProject[], marks: BackupMarks): TenderProject[] {
  return projects.filter(p => {
    const at = marks[p.id];
    if (!at) return true;
    return Date.parse(p.updatedAt || p.createdAt || '') > Date.parse(at);
  });
}

export const lastBackupTime = (marks: BackupMarks): string | undefined =>
  Object.values(marks).sort().at(-1);

// إعادة تحميل يطلبها النظام نفسه (التحديث، أو بعد تنبيه إضافة المتصفح): البيانات محفوظة في المتصفح،
// فلا يظهر تنبيه الإغلاق عن نسخة احتياطية لم تُحفظ
let unloadAllowed = false;
export function allowUnload(): void { unloadAllowed = true; }
export const isUnloadAllowed = (): boolean => unloadAllowed;

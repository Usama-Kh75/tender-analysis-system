import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { RefreshCw, Sparkles, X } from 'lucide-react';
import { APP_VERSION, CHANGELOG, changesSince, compareVersions, versionLabel } from '../changelog';
import { applyUpdate, getAvailableUpdate, subscribeUpdate } from '../pwa';

// آخر إصدار رآه المستخدم في هذا المتصفح — لعرض «ما الجديد» مرة واحدة بعد كل تحديث
const SEEN_KEY = 'tender_analysis_last_seen_version';
// مفتاح بيانات المشاريع (storageService): وجوده يعني مستخدماً سابقاً لا تثبيتاً جديداً
const PROJECTS_KEY = 'antigravity_tenders_projects_v2';
// أقدم إصدار يُفترض لمستخدم سابق لم يُسجَّل له إصدار (قبل إضافة هذه الخاصية)
const BEFORE_TRACKING = '1.4.2';

function readSeen(): string | null {
  try {
    const seen = localStorage.getItem(SEEN_KEY);
    if (seen) return seen;
    return localStorage.getItem(PROJECTS_KEY) ? BEFORE_TRACKING : null;
  } catch { return null; }
}

// يُقرأ عند تحميل الملف، قبل أن يرسم App شيئاً: الفتح الأول يزرع بيانات تجريبية في localStorage
// فوراً، ولو قُرئ بعده لبدا التثبيت الجديد مستخدماً سابقاً وظهرت له «ما الجديد»
const INITIAL_SEEN = readSeen();

// يُحفظ الأحدث بين المسجَّل والحالي: تبويب قديم ما زال مفتوحاً لا يرجع الرقم إلى الوراء
function markSeen() {
  try {
    const stored = localStorage.getItem(SEEN_KEY);
    if (!stored || compareVersions(APP_VERSION, stored) > 0) localStorage.setItem(SEEN_KEY, APP_VERSION);
  } catch { /* تخزين محظور: لا شيء */ }
}

interface UpdateNoticeProps {
  /** فتح «ما الجديد» يدوياً (بالضغط على رقم الإصدار) */
  manualOpen: boolean;
  onManualClose: () => void;
}

export const UpdateNotice: React.FC<UpdateNoticeProps> = ({ manualOpen, onManualClose }) => {
  const available = useSyncExternalStore(subscribeUpdate, getAvailableUpdate);
  const [dismissedUpdate, setDismissedUpdate] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [updateFailed, setUpdateFailed] = useState(false);

  const handleUpdate = async () => {
    setUpdating(true);
    setUpdateFailed(false);
    const reloading = await applyUpdate();
    if (!reloading) {
      setUpdating(false);
      setUpdateFailed(true);
    }
  };

  // يُحسب مرة واحدة عند الفتح: التغييرات منذ آخر إصدار رآه المستخدم
  const [autoEntries, setAutoEntries] = useState(() => {
    if (!INITIAL_SEEN) { markSeen(); return []; }   // تثبيت جديد: لا «ما الجديد»
    const entries = changesSince(INITIAL_SEEN);
    if (entries.length === 0) markSeen();
    return entries;
  });

  const entries = autoEntries.length > 0 ? autoEntries : manualOpen ? CHANGELOG.slice(0, 3) : [];

  const close = () => {
    markSeen();
    setAutoEntries([]);
    onManualClose();
  };

  const dialogOpen = entries.length > 0;
  useEffect(() => {
    if (!dialogOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <>
      {available && available !== dismissedUpdate && (
        <div
          role="status"
          className="no-print fixed bottom-4 left-4 right-4 sm:right-auto sm:max-w-md z-[60] bg-slate-950 text-white border border-amber-500/40 rounded-2xl shadow-2xl p-4 flex items-center gap-3"
        >
          <RefreshCw className="w-5 h-5 text-amber-400 shrink-0" />
          <div className="flex-1 text-xs sm:text-sm">
            <div className="font-black">يتوفر إصدار جديد <bdi dir="ltr">({versionLabel(available)})</bdi></div>
            <div className={`text-[11px] mt-0.5 ${updateFailed ? 'text-rose-300' : 'text-slate-300'}`}>
              {updateFailed ? 'تعذّر تنزيل التحديث — تحقق من الاتصال وحاول مرة أخرى.' : 'بياناتك محفوظة ولا يمسها التحديث.'}
            </div>
          </div>
          <button
            onClick={handleUpdate}
            disabled={updating}
            className="bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black px-3 py-2 rounded-xl cursor-pointer whitespace-nowrap disabled:opacity-60 disabled:cursor-wait"
          >
            {updating ? 'جارٍ التحديث…' : 'تحديث الآن'}
          </button>
          <button
            onClick={() => setDismissedUpdate(available)}
            className="text-slate-400 hover:text-white text-[11px] font-bold px-1 cursor-pointer whitespace-nowrap"
          >
            لاحقاً
          </button>
        </div>
      )}

      {entries.length > 0 && (
        <div className="no-print fixed inset-0 z-[70] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="whats-new-title"
            aria-describedby="whats-new-notes"
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden"
          >
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-500/20 text-amber-400 rounded-lg">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h2 id="whats-new-title" className="text-base font-bold">
                    {autoEntries.length > 0 ? 'تم تحديث النظام' : 'ما الجديد في النظام'}
                  </h2>
                  <p className="text-xs text-slate-400">الإصدار الحالي: <bdi dir="ltr">{versionLabel()}</bdi></p>
                </div>
              </div>
              <button onClick={close} aria-label="إغلاق" className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div id="whats-new-notes" className="p-5 space-y-4 overflow-y-auto bg-slate-50">
              {entries.map(entry => (
                <div key={entry.version}>
                  <div dir="ltr" className="text-xs font-black text-indigo-800 mb-1.5 font-mono text-right">{versionLabel(entry.version)}</div>
                  <ul className="list-disc pr-5 space-y-1 text-xs sm:text-sm text-slate-800 leading-relaxed">
                    {entry.notes.map((note, i) => <li key={i}>{note}</li>)}
                  </ul>
                </div>
              ))}
            </div>

            <div className="p-3 border-t border-slate-200 flex justify-end bg-white">
              <button
                onClick={close}
                autoFocus
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black px-5 py-2 rounded-lg cursor-pointer"
              >
                حسناً
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

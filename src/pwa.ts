// تفعيل وضع التطبيق القابل للتثبيت (PWA) — فقط حين يُفتح النظام من رابط الويب.
// الملف المحمول المفتوح من القرص (file://) لا يدعم عامل الخدمة، فيبقى كما هو.
export function setupPwa(): void {
  if (import.meta.env.DEV || !location.protocol.startsWith('http')) return;

  // تُضاف ديناميكياً لا في index.html: في الملف المحمول تُنتج أخطاء تحميل بلا فائدة
  for (const [rel, href] of [['manifest', './manifest.json'], ['apple-touch-icon', './apple-touch-icon.png']]) {
    const link = document.createElement('link');
    link.rel = rel;
    link.href = href;
    document.head.appendChild(link);
  }

  if ('serviceWorker' in navigator) {
    const register = () => { navigator.serviceWorker.register('./sw.js').catch(() => { }); };
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register);
  }

  // البيانات في localStorage وحده: نطلب من المتصفح ألا يحذفها عند امتلاء القرص
  navigator.storage?.persist?.().catch(() => { });

  // أيقونة التثبيت في شريط العنوان يخفيها Chrome الحديث غالباً في قائمته، فنعرض
  // زر تثبيت داخل النظام نفسه — لكن فقط حين يؤكد المتصفح بهذا الحدث أنه قابل للتثبيت
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    installEvent = e as InstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    installEvent = null;
    notify();
  });
}

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let installEvent: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(fn => fn());

// واجهة useSyncExternalStore: هل يمكن عرض زر التثبيت الآن؟
export const canInstallApp = (): boolean => installEvent !== null;
export const subscribeInstall = (fn: () => void): (() => void) => {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
};

export async function installApp(): Promise<void> {
  const ev = installEvent;
  if (!ev) return;
  installEvent = null; // الحدث يُستعمل مرة واحدة
  notify();
  try {
    await ev.prompt();
    await ev.userChoice;
  } catch { /* أغلق المستخدم النافذة أو رفضها المتصفح */ }
}

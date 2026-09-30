import { APP_VERSION, compareVersions } from './changelog';

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

  // فحص توفر إصدار أحدث: بعد الفتح بقليل، وكل ساعة، وكلما عاد المستخدم إلى النافذة
  // (التطبيق المثبَّت يبقى مفتوحاً أياماً، والنافذة المفتوحة لا تتبدل وحدها)
  setTimeout(checkForUpdate, 5000);
  setInterval(checkForUpdate, 60 * 60 * 1000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkForUpdate();
  });
  window.addEventListener('online', checkForUpdate);
}

// version.json يُنشر مع كل إصدار (vite.config.ts) ولا يُخزَّن في عامل الخدمة.
// المهلة تُحسب من آخر فحص ناجح فقط: فشل عابر لا يؤجل الفحص التالي ساعة
let lastSuccessfulCheck = 0;
let checking = false;
async function checkForUpdate(): Promise<void> {
  if (checking || !navigator.onLine || Date.now() - lastSuccessfulCheck < 5 * 60 * 1000) return;
  checking = true;
  try {
    const res = await fetch('./version.json', { cache: 'no-store' });
    if (!res.ok) return;
    const { version } = await res.json() as { version?: string };
    lastSuccessfulCheck = Date.now();
    if (typeof version === 'string' && compareVersions(version, APP_VERSION) > 0 && version !== availableVersion) {
      availableVersion = version;
      notify();
    }
  } catch { /* بلا اتصال أو ردّ غير صالح: يُعاد الفحص لاحقاً */ }
  finally { checking = false; }
}

let availableVersion: string | null = null;

// واجهة useSyncExternalStore: رقم الإصدار الأحدث المنشور إن وُجد
export const getAvailableUpdate = (): string | null => availableVersion;
export const subscribeUpdate = (fn: () => void): (() => void) => subscribeInstall(fn);

// يطلب من عامل الخدمة تنزيل الصفحة الجديدة وحفظها أولاً، ثم يعيد التحميل. بدون ذلك قد يُفتح
// الإصدار القديم من المخزن إن تجاوز الاتصال مهلة الثلاث ثوانٍ (pwa/sw.js)
export async function applyUpdate(): Promise<void> {
  const sw = navigator.serviceWorker?.controller;
  if (sw) {
    await new Promise<void>(resolve => {
      const channel = new MessageChannel();
      const timer = setTimeout(resolve, 20000);
      channel.port1.onmessage = () => { clearTimeout(timer); resolve(); };
      sw.postMessage('refresh-shell', [channel.port2]);
    });
  }
  location.reload();
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

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
}

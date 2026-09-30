/* عامل الخدمة — يجعل النسخة المنشورة على الويب تعمل بلا إنترنت وقابلة للتثبيت كتطبيق.
   قالب: يُولَّد dist/sw.js منه عند البناء (vite.config.ts) مع رقم الإصدار. */
'use strict';

const VERSION = '__APP_VERSION__';
// المخازن مشتركة بين كل مشاريع النطاق usama-kh75.github.io؛ البادئة تمنع
// هذا العامل من حذف مخازن تطبيق آخر على النطاق نفسه (مثل دليل تعليمات العقود)
const APP = 'tender-analysis';
const SHELL = APP + '-shell-v' + VERSION;
const RUNTIME = APP + '-runtime-v1'; // الخطوط وملفات Tesseract: لا تتغير لنفس الرابط

const SHELL_FILES = [
  './',
  './index.html',
  './manifest.json',
  './favicon.svg',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png'
];

// زر «تحديث الآن»: تنزيل الصفحة الجديدة وحفظها قبل إعادة التحميل، فتُفتح الجديدة حتى لو
// تجاوز الاتصال مهلة الثلاث ثوانٍ وخُدمت الصفحة من المخزن
self.addEventListener('message', e => {
  if (e.data !== 'refresh-shell' || !e.ports || !e.ports[0]) return;
  e.waitUntil((async () => {
    let ok = false;
    try {
      const res = await fetch('./index.html', { cache: 'reload' });
      if (res.ok) {
        const c = await caches.open(SHELL);
        await c.put('./index.html', res.clone());
        await c.put('./', res);
        ok = true;
      }
    } catch (err) { }
    e.ports[0].postMessage(ok);
  })());
});

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const page = await fetch('./index.html', { cache: 'reload' });
    if (!page.ok) throw new Error('page unavailable');
    const c = await caches.open(SHELL);
    await c.put('./index.html', page.clone());
    await c.put('./', page);
    // كلٌّ على حدة: فشل أيقونة واحدة لا يُسقط تخزين الصفحة
    await Promise.all(SHELL_FILES.slice(2).map(async f => {
      try {
        const res = await fetch(f, { cache: 'reload' });
        if (res.ok) await c.put(f, res);
      } catch (err) { }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith(APP + '-shell-v') && k !== SHELL).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

// خطوط Google ومحرك Tesseract ولغاته: تُحفظ عند أول استعمال، فيعمل
// الاستخراج الضوئي (غير الذكي) بلا إنترنت بعد أول مرة
const RUNTIME_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com', 'cdn.jsdelivr.net', 'tessdata.projectnaptha.com', 'unpkg.com'];

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Gemini وغيره: لا يُخزَّن شيء، يمرّ للشبكة كما هو
  if (url.origin !== self.location.origin) {
    if (!RUNTIME_HOSTS.includes(url.hostname)) return;
    e.respondWith((async () => {
      const c = await caches.open(RUNTIME);
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok || res.type === 'opaque') e.waitUntil(c.put(req, res.clone()).catch(() => { }));
      return res;
    })());
    return;
  }

  // الصفحة: من الشبكة أولاً ليصل آخر إصدار، ومن المخزن إن انقطع الإنترنت.
  // اتصال ضعيف متقطع لا يرفض الطلب بل يعلّقه طويلاً، فننتظر الشبكة 3 ثوانٍ فقط
  // ثم نفتح النسخة المحفوظة، ويكمل الجلب في الخلفية فيصل التحديث في الفتحة التالية
  if (req.mode === 'navigate') {
    // الرد يُسلَّم فور وصوله، وحفظه منفصل عنه فلا يؤخّره ولا يُفشله. النسخة تُؤخذ
    // قبل التسليم (بعد بدء قراءته يتعذر نسخه)، ولا تُحفظ إلا الصفحة الرئيسية نفسها
    const isShell = /\/(index\.html)?$/.test(url.pathname);
    const network = fetch(req).then(res => {
      if (res.ok && isShell && !res.redirected && (res.headers.get('content-type') || '').includes('text/html')) {
        const copy = res.clone();
        e.waitUntil(caches.open(SHELL).then(c => c.put('./index.html', copy)).catch(() => { }));
      }
      return res;
    });
    e.waitUntil(network.catch(() => { }));
    e.respondWith((async () => {
      // من مخزن هذا الإصدار وحده: النطاق مشترك مع تطبيقات أخرى
      // عطل في المخزن يُعامل كغياب النسخة، فنبقى ننتظر الشبكة بدل إسقاط الفتح
      const cached = async () => {
        try {
          const c = await caches.open(SHELL);
          return (await c.match('./index.html')) || (await c.match('./'));
        } catch (err) { return undefined; }
      };
      const timeout = new Promise(resolve => setTimeout(resolve, 3000));
      try {
        const res = await Promise.race([network, timeout.then(cached)]);
        // خطأ خادم عابر (مثل 404 لحظة النشر) لا يُغلق التطبيق ما دامت لدينا نسخة
        if (res && !res.ok) return (await cached()) || res;
        if (res) return res;
        return await network; // لا نسخة محفوظة بعد: ننتظر الشبكة مهما طالت
      } catch (err) {
        return (await cached()) || Response.error();
      }
    })());
    return;
  }

  e.respondWith((async () => (await caches.match(req)) || fetch(req))());
});

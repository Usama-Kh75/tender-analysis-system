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

  // الصفحة: من الشبكة أولاً ليصل آخر إصدار، ومن المخزن إن انقطع الإنترنت
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res.ok) {
          const c = await caches.open(SHELL);
          e.waitUntil(c.put('./index.html', res.clone()).catch(() => { }));
        }
        return res;
      } catch (err) {
        return (await caches.match('./index.html')) || (await caches.match('./')) || Response.error();
      }
    })());
    return;
  }

  e.respondWith((async () => (await caches.match(req)) || fetch(req))());
});

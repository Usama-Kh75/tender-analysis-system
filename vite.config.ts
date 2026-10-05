import { readFileSync } from 'node:fs'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { viteSingleFile } from 'vite-plugin-singlefile'
import pkg from './package.json' with { type: 'json' }

// يولّد dist/sw.js من القالب pwa/sw.js مع رقم الإصدار، فيتجدد مخزن التطبيق
// المثبَّت مع كل إصدار. لا أثر له على الملف المحمول (file://) — هناك لا يُسجَّل العامل.
function serviceWorker(): Plugin {
  return {
    name: 'tender-service-worker',
    apply: 'build',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: readFileSync('pwa/sw.js', 'utf8').replace('__APP_VERSION__', pkg.version),
      })
      // رقم آخر إصدار منشور: يقارنه التطبيق المفتوح برقمه ليعرض «يتوفر إصدار جديد» (src/pwa.ts)
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({ version: pkg.version }),
      })
    },
  }
}

// مفككا صور المسح الضوئي في pdf.js (JBIG2 وJPX) ملفا WebAssembly يطلبهما pdf.js من رابط؛ نضمّنهما
// في الملف الواحد كنص base64 عبر وحدة افتراضية (src/utils/pdfService.ts) ليعمل قارئ PDF بلا إنترنت
function embeddedPdfWasm(): Plugin {
  const id = 'virtual:pdf-wasm'
  const resolvedId = '\0' + id
  return {
    name: 'embedded-pdf-wasm',
    resolveId: (source) => (source === id ? resolvedId : null),
    load(resolved) {
      if (resolved !== resolvedId) return null
      const files = ['jbig2.wasm', 'openjpeg.wasm']
      const entries = files.map(f =>
        `${JSON.stringify(f)}: ${JSON.stringify(readFileSync(`node_modules/pdfjs-dist/wasm/${f}`).toString('base64'))}`)
      return `export default { ${entries.join(', ')} };`
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    viteSingleFile(),
    serviceWorker(),
    embeddedPdfWasm()
  ],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version)
  },
})

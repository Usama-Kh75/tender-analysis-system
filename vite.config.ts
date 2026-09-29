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
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    viteSingleFile(),
    serviceWorker()
  ],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version)
  },
})

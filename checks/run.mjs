// فحوص الدوال النقية: يجمّع كل checks/*.test.ts بـ rolldown (مثبّت مع Vite، فلا اعتمادية جديدة) إلى
// checks/.out ثم يشغّلها بـ node --test. الحزم الخارجية تبقى import عادياً فتُحل من node_modules.
// الاستعمال: npm run check  أو  npm run check -- weighted  (ما يحوي اسمه الكلمة)
import { build } from 'rolldown';
import { readdirSync, rmSync, mkdirSync } from 'node:fs';
import { join, dirname, basename, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '.out');
const only = process.argv[2];
const tests = readdirSync(here).filter(f => f.endsWith('.test.ts') && (!only || f.includes(only)));
if (tests.length === 0) {
  console.error('لا فحوص مطابقة');
  process.exit(1);
}
rmSync(out, { recursive: true, force: true });
mkdirSync(out);
for (const t of tests) {
  await build({
    input: join(here, t),
    platform: 'node',
    // xlsx-js-style حزمة CJS لا يكشف Node تصديراتها المسماة عند import *، فتُضمَّن في الحزمة ليعمل XLSX.utils
    external: id => !id.startsWith('.') && !isAbsolute(id) && id !== 'xlsx-js-style',
    logLevel: 'silent',
    output: { file: join(out, basename(t, '.ts') + '.mjs'), format: 'esm' }
  });
}
const r = spawnSync(process.execPath, ['--test', ...tests.map(t => join(out, basename(t, '.ts') + '.mjs'))], { stdio: 'inherit' });
process.exitCode = r.status ?? 1;

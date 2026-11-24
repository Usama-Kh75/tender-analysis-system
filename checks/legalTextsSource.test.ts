// كل نص رسمي في LEGAL_TEXTS يطابق الأصل في ملفات units/*.json (نسخة التعليمات المهيكلة)
// الموضع في الأصل يُستنتج من تسمية المفتاح نفسها، فلا يمكن إضافة مفتاح بنص مُعدَّل أو بمرجع خاطئ دون أن يفشل هذا الفحص.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { LEGAL_TEXTS, type LegalKey } from '../src/utils/legalTexts';

// مجلد التعليمات المهيكلة خارج المستودع عمداً. LEGAL_UNITS_DIR يغيّر مساره، و REQUIRE_LEGAL_SOURCE=1 يجعل غيابه فشلاً (قبل كل إصدار)
const DIR = (process.env.LEGAL_UNITS_DIR ?? 'E:/Claude Projects/تعليمات 2025/contract-instructions-2025-offline/src/units').replace(/\/?$/, '/');
const available = fs.existsSync(DIR);
if (!available) console.warn(`⚠ مجلد التعليمات غير موجود (${DIR}): لم تُقارَن نصوص LEGAL_TEXTS بالأصل`);

test('مجلد التعليمات الرسمية موجود حين يُطلب (REQUIRE_LEGAL_SOURCE=1)', { skip: process.env.REQUIRE_LEGAL_SOURCE !== '1' }, () => {
  assert.ok(available, `لا مجلد: ${DIR}`);
});
const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
// الأصل يكتب «اولاً» بلا همزة و«ثالثا» بلا تنوين في ضوابط (5) وبهما في غيرها
const plain = (s: string) => s.replace(/[أإآ]/g, 'ا').replace(/ً/g, '');

interface Unit { clause: string; officialText: string; printedPage: string }
const cache = new Map<string, Unit[]>();
const unitsOf = (file: string): Unit[] => {
  if (!cache.has(file)) cache.set(file, JSON.parse(fs.readFileSync(DIR + file, 'utf8')).clauses as Unit[]);
  return cache.get(file)!;
};

/** «المادة (13)/ثالثاً/أ» ← article-13.json، «ثالثاً / أ»؛ «ضوابط رقم (4) سادساً/5» ← annex-04.json، «سادساً / 5» */
const locate = (label: string): { file: string; clause: string } => {
  const pad = (n: string) => n.padStart(2, '0');
  let m = label.match(/^المادة \((\d+)\)\/(.+)$/);
  if (m) return { file: `article-${pad(m[1])}.json`, clause: m[2].split('/').join(' / ') };
  m = label.match(/^الملحق \((\d+)\)\/(.+)$/);
  if (m) return { file: `annex-${pad(m[1])}.json`, clause: m[2].split('/').join(' / ') };
  m = label.match(/^ضوابط رقم \((\d+)\) (.+)$/);
  if (m) return { file: `annex-${pad(m[1])}.json`, clause: m[2].split('/').join(' / ') };
  throw new Error(`تسمية لا يُعرف موضعها: ${label}`);
};

const find = (file: string, clause: string): Unit | undefined =>
  unitsOf(file).find(u => plain(u.clause) === plain(clause));

test('كل مفتاح في LEGAL_TEXTS: بنده موجود في الأصل ونصه يحتوي نص الأصل حرفياً', { skip: !available }, () => {
  const bad: string[] = [];
  for (const [key, t] of Object.entries(LEGAL_TEXTS)) {
    const { file, clause } = locate(t.label);
    const u = find(file, clause);
    if (!u) { bad.push(`${key}: لا بند «${clause}» في ${file}`); continue; }
    if (!norm(t.text).includes(norm(u.officialText))) bad.push(`${key}: النص لا يطابق ${file} «${clause}»`);
    // الصفحة المطبوعة كما في الأصل (البند قد يمتد على صفحتين فيكتبها الأصل «83-84»)
    if (t.page !== u.printedPage) bad.push(`${key}: الصفحة ${t.page} والأصل ${u.printedPage}`);
  }
  assert.deepEqual(bad, []);
});

test('نص كل مفتاح لا يزيد على الأصل إلا ببادئة من صدر المادة أو مقدمة البند أو فروعه', { skip: !available }, () => {
  // الإضافة المسموحة: نص بند آخر من الملف نفسه (صدر المادة، مقدمة البند، فروعه)، لا كلمات من خارج الأصل
  const bad: string[] = [];
  for (const [key, t] of Object.entries(LEGAL_TEXTS)) {
    const { file } = locate(t.label);
    let rest = norm(t.text);
    const own = find(file, locate(t.label).clause);
    if (own) rest = rest.replace(norm(own.officialText), '');
    // فروع مرقّمة بين قوسين «(1)» «(2)» تُفصل بها الأجزاء المركّبة
    rest = rest.replace(/\(\d+\)/g, ' ');
    const sources = unitsOf(file).map(u => norm(u.officialText)).filter(Boolean);
    for (const s of sources) if (s && rest.includes(s)) rest = rest.replace(s, '');
    rest = norm(rest);
    if (rest) bad.push(`${key}: كلام ليس من ${file}: «${rest.slice(0, 60)}»`);
  }
  assert.deepEqual(bad, []);
});

test('لا تسمية مكررة بين المفاتيح', () => {
  const labels = Object.values(LEGAL_TEXTS).map(t => t.label);
  const dup = labels.filter((l, i) => labels.indexOf(l) !== i);
  assert.deepEqual(dup, []);
});

test('المفاتيح المسمّاة في الكود كلها معرّفة', () => {
  // مفتاح يُكتب في src ولا نص رسمي له يظهر خالياً في المحضر
  const defined = new Set(Object.keys(LEGAL_TEXTS));
  const used = new Set<string>();
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = `${dir}/${e.name}`;
      if (e.isDirectory()) walk(p);
      else if (/\.tsx?$/.test(e.name) && !p.endsWith('legalTexts.ts')) {
        for (const m of fs.readFileSync(p, 'utf8').matchAll(/['"`]((?:art|ann)\d+_[a-z0-9_]+)['"`]/gi)) used.add(m[1]);
      }
    }
  };
  walk('src');
  const missing = [...used].filter(k => !defined.has(k as LegalKey));
  assert.deepEqual(missing, []);
});

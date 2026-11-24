// تذكير التحقق من المرشحين (أحد عشر/4 و5) وأوجه الخلاف (أحد عشر/6): تسجيل وعرض فقط (src/utils/committeeRecords.ts)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEGAL_TEXTS } from '../src/utils/legalTexts';
import { createNewTenderProject, getAllProjects } from '../src/utils/storageService';
import {
  candidatesCheckDateOf, cleanDissentNote, dissentBlock, sanitizeCandidatesCheckDate, sanitizeDissentNote
} from '../src/utils/committeeRecords';
import { createCommitteeRecordHandlers } from '../src/app/committeeRecordHandlers';
import type { TenderProject } from '../src/types/tender';

const mk = (extra: Record<string, unknown> = {}): TenderProject => ({
  ...createNewTenderProject({ title: 'ت', referenceNumber: '1', contractType: 'works', budgetType: 'operating', bidderNames: ['x'] }),
  ...extra
} as TenderProject);

test('المفاتيح الثلاثة معرّفة بالتسمية والصفحة المطبوعة (المطابقة للأصل في legalTextsSource.test.ts)', () => {
  assert.equal(LEGAL_TEXTS.ann4_11_4.label, 'ضوابط رقم (4) أحد عشر/4');
  assert.equal(LEGAL_TEXTS.ann4_11_5.label, 'ضوابط رقم (4) أحد عشر/5');
  assert.equal(LEGAL_TEXTS.ann4_11_6.label, 'ضوابط رقم (4) أحد عشر/6');
  for (const k of ['ann4_11_4', 'ann4_11_5', 'ann4_11_6'] as const) assert.equal(LEGAL_TEXTS[k].page, '73');
});

test('تنظيف التحميل: تاريخ الإيعاز غير الصحيح يُحذف بلا updatedAt، والصحيح يبقى', () => {
  const base = mk({ updatedAt: '2026-01-01T00:00:00.000Z' });
  for (const bad of ['', 'غد', '2026-13-40', 5, null]) {
    const out = sanitizeCandidatesCheckDate({ ...base, candidatesCheckDate: bad } as unknown as TenderProject);
    assert.equal('candidatesCheckDate' in out, false, String(bad));
    assert.equal(out.updatedAt, base.updatedAt);
    assert.equal(out.auditLogs?.length, base.auditLogs?.length);
  }
  const ok = { ...base, candidatesCheckDate: '2026-11-20' };
  assert.equal(sanitizeCandidatesCheckDate(ok), ok);
  assert.equal(candidatesCheckDateOf(ok), '2026-11-20');
});

test('تنظيف التحميل: أوجه الخلاف غير النص أو الفارغة تُحذف، والنص يُقصّ، بلا updatedAt', () => {
  const base = mk({ updatedAt: '2026-01-01T00:00:00.000Z' });
  for (const bad of ['', '  \n ', 7, {}, null]) {
    const out = sanitizeDissentNote({ ...base, dissentNote: bad } as unknown as TenderProject);
    assert.equal('dissentNote' in out, false, String(bad));
    assert.equal(out.updatedAt, base.updatedAt);
  }
  const trimmed = sanitizeDissentNote({ ...base, dissentNote: '  رأي أ\r\nرأي ب \n' });
  assert.equal(trimmed.dissentNote, 'رأي أ\nرأي ب');
  assert.equal(trimmed.updatedAt, base.updatedAt);
  const ok = { ...base, dissentNote: 'رأي' };
  assert.equal(sanitizeDissentNote(ok), ok);
});

test('التحميل من التخزين يطبّق التنظيفين (بلا قيد تتبع جديد)', () => {
  const store = new Map<string, string>();
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => store.clear(), key: () => null, length: 0
  } as Storage;
  const p = mk({ candidatesCheckDate: 'ليس تاريخاً', dissentNote: '   ' });
  const logs = p.auditLogs?.length ?? 0;
  store.set('antigravity_tenders_projects_v2', JSON.stringify([p]));
  const [loaded] = getAllProjects();
  assert.equal('candidatesCheckDate' in loaded, false);
  assert.equal('dissentNote' in loaded, false);
  assert.equal(loaded.auditLogs?.length ?? 0, logs);
  assert.equal(loaded.updatedAt, p.updatedAt);
});

test('معالج الإيعاز: قيد تتبع واحد، updatedAt يتحدث، المسح يحذف الحقل، بلا تغيير بلا قيد', () => {
  let saved: TenderProject | null = null;
  const base = mk({ updatedAt: '2026-01-01T00:00:00.000Z' });
  const h = createCommitteeRecordHandlers(base, p => { saved = p; });
  assert.equal(h.handleSaveCandidatesCheck('2026-11-20'), null);
  const a = saved as unknown as TenderProject;
  assert.equal(a.candidatesCheckDate, '2026-11-20');
  assert.notEqual(a.updatedAt, base.updatedAt);
  assert.equal((a.auditLogs?.length ?? 0) - (base.auditLogs?.length ?? 0), 1);
  assert.equal(a.auditLogs![a.auditLogs!.length - 1].action, 'تسجيل إيعاز التحقق من المرشحين');

  // مسح
  saved = null;
  const h2 = createCommitteeRecordHandlers(a, p => { saved = p; });
  assert.equal(h2.handleSaveCandidatesCheck(''), null);
  const b = saved as unknown as TenderProject;
  assert.equal('candidatesCheckDate' in b, false);
  assert.equal((b.auditLogs?.length ?? 0) - (a.auditLogs?.length ?? 0), 1);

  // بلا تغيير: لا حفظ
  saved = null;
  assert.equal(h2.handleSaveCandidatesCheck('2026-11-20'), null);
  assert.equal(saved, null);
  // تاريخ غير صحيح: رسالة خطأ ولا حفظ
  assert.match(h.handleSaveCandidatesCheck('2026-99-99') ?? '', /تاريخ/);
  assert.equal(saved, null);
});

test('معالج أوجه الخلاف: قيد «تسجيل أوجه الخلاف»، القص، المسح بالتفريغ، بلا تغيير بلا قيد', () => {
  let saved: TenderProject | null = null;
  const base = mk({ updatedAt: '2026-01-01T00:00:00.000Z' });
  const h = createCommitteeRecordHandlers(base, p => { saved = p; });
  assert.equal(h.handleSaveDissent('  اعترض العضو س على الترسية \n'), null);
  const a = saved as unknown as TenderProject;
  assert.equal(a.dissentNote, 'اعترض العضو س على الترسية');
  assert.notEqual(a.updatedAt, base.updatedAt);
  assert.equal((a.auditLogs?.length ?? 0) - (base.auditLogs?.length ?? 0), 1);
  assert.equal(a.auditLogs![a.auditLogs!.length - 1].action, 'تسجيل أوجه الخلاف');

  saved = null;
  const h2 = createCommitteeRecordHandlers(a, p => { saved = p; });
  assert.equal(h2.handleSaveDissent('اعترض العضو س على الترسية'), null);
  assert.equal(saved, null);
  assert.equal(h2.handleSaveDissent('   '), null);
  const b = saved as unknown as TenderProject;
  assert.equal('dissentNote' in b, false);
  assert.equal((b.auditLogs?.length ?? 0) - (a.auditLogs?.length ?? 0), 1);
});

test('كتلة المحضر: تظهر بوجود النص فقط، سطراً سطراً، وسندها ann4_11_6؛ وبغيابه null', () => {
  assert.equal(dissentBlock(mk()), null);
  assert.equal(dissentBlock(mk({ dissentNote: '  ' })), null);
  assert.equal(dissentBlock(mk({ dissentNote: 7 })), null);
  const b = dissentBlock(mk({ dissentNote: 'رأي أ\r\nرأي ب' }));
  assert.ok(b);
  assert.equal(b.title, 'أوجه الخلاف في الرأي');
  assert.deepEqual(b.lines, ['رأي أ', 'رأي ب']);
  assert.equal(b.legalKey, 'ann4_11_6');
  assert.equal(cleanDissentNote(undefined), undefined);
});

// تذكير النسخة الاحتياطية: أي المناقصات تغيّرت بعد آخر نسخة تحويها
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lastBackupTime, unsavedProjects } from '../src/utils/backupStatus';
import type { TenderProject } from '../src/types/tender';

const tender = (id: string, updatedAt: string) =>
  ({ id, updatedAt, createdAt: '2026-10-01T08:00:00.000Z', bidders: [] }) as unknown as TenderProject;

const a = tender('a', '2026-10-18T10:00:00.000Z');
const b = tender('b', '2026-10-18T12:00:00.000Z');

test('مناقصة لم تُحفظ في نسخة قط تُعدّ غير محفوظة', () => {
  assert.deepEqual(unsavedProjects([a, b], {}).map(p => p.id), ['a', 'b']);
});

test('تعديل بعد النسخة يعيدها غير محفوظة، وما قبلها أو في لحظتها محفوظ', () => {
  const marks = { a: '2026-10-18T11:00:00.000Z', b: '2026-10-18T12:00:00.000Z' };
  assert.deepEqual(unsavedProjects([a, b], marks).map(p => p.id), []);
  const edited = tender('a', '2026-10-18T11:00:00.001Z');
  assert.deepEqual(unsavedProjects([edited, b], marks).map(p => p.id), ['a']);
});

test('نسخة مناقصة واحدة لا تحمي غيرها', () => {
  assert.deepEqual(unsavedProjects([a, b], { a: '2026-10-18T13:00:00.000Z' }).map(p => p.id), ['b']);
});

test('آخر نسخة هي أحدث الأوقات، ولا شيء بلا نسخ', () => {
  assert.equal(lastBackupTime({ a: '2026-10-18T09:00:00.000Z', b: '2026-10-18T13:00:00.000Z' }), '2026-10-18T13:00:00.000Z');
  assert.equal(lastBackupTime({}), undefined);
});

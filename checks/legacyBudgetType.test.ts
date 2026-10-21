import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNewTenderProject, defaultLegacyBudgetType } from '../src/utils/storageService';
import type { TenderProject } from '../src/types/tender';

const legacy = (): TenderProject => {
  const p = createNewTenderProject({ title: 'قديمة', referenceNumber: '1', contractType: 'supply', budgetType: 'operating', bidderNames: ['أ'] });
  delete (p as Partial<TenderProject>).budgetType;
  return p;
};

test('المناقصة بلا نوع موازنة تأخذ «تشغيلية» مع قيد في السجل', () => {
  const before = legacy();
  const after = defaultLegacyBudgetType(before);
  assert.equal(after.budgetType, 'operating');
  assert.equal(after.auditLogs.length, before.auditLogs.length + 1);
  assert.match(after.auditLogs.at(-1)!.details + after.auditLogs[0].details, /نوع الموازنة \(تشغيلية\)/);
});

test('النوع المحدد أو غير المعروف لا يُمس', () => {
  const inv = { ...legacy(), budgetType: 'investment' as const };
  assert.equal(defaultLegacyBudgetType(inv), inv);
  const future = { ...legacy(), budgetType: 'xyz' as unknown as TenderProject['budgetType'] };
  assert.equal(defaultLegacyBudgetType(future), future);
});

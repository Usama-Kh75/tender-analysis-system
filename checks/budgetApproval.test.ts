// ملاحظة صلاحية قبول العطاء الزائد على الكلفة التخمينية بحسب نوع الموازنة (src/utils/budgetTypes.ts)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { budgetApprovalNote } from '../src/utils/budgetTypes';

const text = (type: string | undefined, d: number) => {
  const n = budgetApprovalNote(type, d);
  assert.ok(n && n.kind === 'note', `note expected for ${type} ${d}`);
  return n.text;
};

test('لا ملاحظة بلا زيادة', () => {
  assert.equal(budgetApprovalNote('investment', 0), null);
  assert.equal(budgetApprovalNote('operating', -5), null);
});

test('نوع غير محدد أو غير معروف: تذكير', () => {
  assert.deepEqual(budgetApprovalNote(undefined, 5), { kind: 'missing' });
  assert.deepEqual(budgetApprovalNote('xyz', 5), { kind: 'missing' });
});

test('استثمارية', () => {
  assert.ok(text('investment', 5).includes('رابعاً/1/أ'));
  assert.ok(text('investment', 10).includes('رابعاً/1/أ'));
  assert.ok(text('investment', 10.000001).includes('رابعاً/1/ب'));
  const t = text('investment', 18.87);
  assert.ok(t.includes('رابعاً/1/ب') && t.includes('18.87%'));
  assert.equal(budgetApprovalNote('investment', 25), null);
});

test('تشغيلية', () => {
  assert.ok(text('operating', 10).includes('عند توفر السيولة'));
  const t = text('operating', 18.870095);
  assert.ok(t.includes('وزارة المالية') && t.includes('18.87%'));
});

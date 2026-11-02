// «كما قدّمه المجهز» مصدر واحد مع ورقة «واقع الحال»، ومرشحات عرض التدقيق (تبويبات العمل، 2026-11-02)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx-js-style';
import { calculateBOQMetrics } from '../src/utils/calculations';
import { asSubmitted } from '../src/utils/bidderAuditEngine';
import { buildBidderAuditWorkbook } from '../src/utils/bidderAuditExcel';
import { auditFilterMatch, isHandled, isPending, pinPending } from '../src/utils/tableFilters';
import type { Bidder, BOQItem, TenderProject } from '../src/types/tender';

const base = { quantity: 1, estimatedTotal: 1000, bidderUnitPrice: 0 } as const;
const tafqeetUnit = { ...base, id: 'u', itemNo: 1, description: 'أ', quantity: 4800, enteredUnitPrice: 280, originalUnitPrice: 260,
  enteredBidderTotal: 1344000, bidderTotal: 1344000, writtenText: 'مئتان وثمانون دينار' } as BOQItem;
const mathFixed = { ...base, id: 't', itemNo: 2, description: 'ب', quantity: 4800, enteredUnitPrice: 280,
  enteredBidderTotal: 1248000, bidderTotal: 1344000 } as BOQItem;
const thousands = { ...base, id: 'w', itemNo: 3, description: 'ج', enteredUnitPrice: 3500, enteredBidderTotal: 3500, bidderTotal: 3500,
  writtenText: 'ثلاثة آلاف وخمسمائة', originalWrittenText: 'ثلاثة وخمسمائة' } as BOQItem;
const noEntered = { ...base, id: 'n', itemNo: 4, description: 'د', bidderTotal: 700 } as BOQItem;

test('asSubmitted: أرقام المجهز كما دوّنها قبل أي تصحيح', () => {
  assert.equal(asSubmitted(tafqeetUnit).unit, 260);
  assert.equal(asSubmitted(mathFixed).total, 1248000);
  assert.equal(asSubmitted(mathFixed).unit, 280);
  assert.equal(asSubmitted(thousands).writtenText, 'ثلاثة وخمسمائة');
  assert.equal(asSubmitted(noEntered).total, 700);
  assert.equal(asSubmitted(noEntered).unit, 0);
});

test('ورقة «واقع الحال» تكتب أرقام asSubmitted نفسها', () => {
  const { items, totals } = calculateBOQMetrics([tafqeetUnit, mathFixed, thousands], 20);
  const bidder: Bidder = { id: 'b', name: 'ش', submissionDate: '', items, totals, status: 'pending' };
  const project = { title: 'م', referenceNumber: '', entityName: '', deviationThreshold: 20, bidders: [bidder], auditLogs: [] } as unknown as TenderProject;
  const rows = XLSX.utils.sheet_to_json<unknown[]>(buildBidderAuditWorkbook(project, bidder).Sheets['واقع الحال'], { header: 1 });
  const header = rows.findIndex(r => r[0] === 'ت');
  for (const it of items) {
    const r = rows.slice(header + 1).find(x => String(x[0]) === String(it.itemNo))!;
    const s = asSubmitted(it);
    assert.equal(r[4], s.unit, `مفرد الفقرة ${it.itemNo}`);
    assert.equal(r[5], s.writtenText ?? '', `تفقيط الفقرة ${it.itemNo}`);
    assert.equal(r[6], s.total, `مبلغ الفقرة ${it.itemNo}`);
  }
});

const flagged = { ...noEntered, id: 'f', hasMathError: true } as BOQItem;
const plain = { ...noEntered, id: 'p' } as BOQItem;

test('مرشح «بانتظار قرار» يُبقي الفقرة المثبَّتة بعد زوال علامتها', () => {
  const pinned = pinPending([flagged, plain]);
  assert.deepEqual([...pinned], ['f']);
  assert.ok(isPending(flagged));
  assert.ok(auditFilterMatch(flagged, 'pending', pinned));
  assert.equal(isHandled(flagged, pinned), false);
  const handled = { ...flagged, hasMathError: false };
  assert.ok(auditFilterMatch(handled, 'pending', pinned));
  assert.equal(isHandled(handled, pinned), true);
  assert.equal(auditFilterMatch(plain, 'pending', pinned), false);
  assert.equal(auditFilterMatch(plain, 'pending', new Set()), false);
});

test('مرشحا «مصحّحة» و«الكل»', () => {
  assert.ok(auditFilterMatch(mathFixed, 'corrected', new Set()));
  assert.equal(auditFilterMatch(plain, 'corrected', new Set()), false);
  assert.ok(auditFilterMatch(plain, 'all', new Set()));
});

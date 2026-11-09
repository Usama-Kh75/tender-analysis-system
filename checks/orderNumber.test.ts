// رقم الطلبية بصيغة موحدة: التسلسل / السنة / الرمز
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatOrderNumber } from '../src/utils/orderNumber';
import { normalizeStatusOrders } from '../src/utils/statusOrders';

test('القيم الحقيقية الخمس', () => {
  assert.equal(formatOrderNumber('94/26/9010'), '94 / 26 / 9010');
  assert.equal(formatOrderNumber('2 / 26 / 9012'), '2 / 26 / 9012');
  assert.equal(formatOrderNumber('40 / 26 /8010'), '40 / 26 / 8010');
  assert.equal(formatOrderNumber('29-26-9005'), '29 / 26 / 9005');
  assert.equal(formatOrderNumber('9014/26/11'), '11 / 26 / 9014');
});

test('أرقام هندية وفارسية', () => {
  assert.equal(formatOrderNumber('٩٤/٢٦/٩٠١٠'), '94 / 26 / 9010');
  assert.equal(formatOrderNumber('۹۴-۲۶-۹۰۱۰'), '94 / 26 / 9010');
});

test('ما لا يطابق يبقى كما هو', () => {
  assert.equal(formatOrderNumber('TND-2026-084'), 'TND-2026-084');
  assert.equal(formatOrderNumber(''), '');
  assert.equal(formatOrderNumber('  '), '');
  assert.equal(formatOrderNumber(' 1/2/3/4 '), '1/2/3/4');
  assert.equal(formatOrderNumber('12/26'), '12/26');
});

test('جزء أول أطول من أربعة أرقام لا يُنقل', () => {
  assert.equal(formatOrderNumber('12345/26/11'), '12345 / 26 / 11');
});

test('مسافات زائدة وأصفار بادئة', () => {
  assert.equal(formatOrderNumber('  7   /  26 /  0905 '), '7 / 26 / 0905');
});

test('الطلبية بلا تحليل تُوحَّد عند التحميل دون تغيير updatedAt', () => {
  const out = normalizeStatusOrders([{ id: 'a', referenceNumber: '9014/26/11', title: 't', updatedAt: '2026-01-01T00:00:00.000Z' }]);
  assert.equal(out[0].referenceNumber, '11 / 26 / 9014');
  assert.equal(out[0].updatedAt, '2026-01-01T00:00:00.000Z');
});

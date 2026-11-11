// Owner dashboard: plain-language sales questions, the grid filters they become, and refunds.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { applySalesQuery, parseSalesQuery, summarize, toGridFilter, validateSalesQuery, type PaymentRow } from '../shared/sales.ts';
import { sampleRows } from '../server/ledger.ts';

test('rules understand common questions in English and Arabic', () => {
  assert.deepEqual(parseSalesQuery('unpaid orders at table 12 over $30').query, { status: 'CREATED', table: '12', minTotal: 30 });
  assert.deepEqual(parseSalesQuery('refunds this week').query, { status: 'REFUNDED', sinceHours: 168 });
  assert.deepEqual(parseSalesQuery('biggest paid orders').query, { status: 'COMPLETED', sort: 'total_desc' });
  assert.deepEqual(parseSalesQuery('طلبات ترابيزة 7 المدفوعة').query, { status: 'COMPLETED', table: '7' });
  assert.deepEqual(parseSalesQuery('orders under 20 and over 50').query, { minTotal: 20, maxTotal: 50 }); // swapped into a valid range
});

test('AI output is checked before it reaches the grid', () => {
  assert.equal(validateSalesQuery(null), null);
  const v = validateSalesQuery({ reply: 'ok', status: 'ANY', table: '12; drop', minTotal: -5, maxTotal: 1e9, sinceHours: 'x', sort: 'none', text: '  Sara ' })!;
  assert.deepEqual(v.query, { table: '12drop', text: 'Sara' });
});

test('a query becomes AG Grid filter models', () => {
  const now = new Date(2026, 10, 12, 20, 0, 0);
  assert.deepEqual(toGridFilter({ status: 'CREATED', minTotal: 10, maxTotal: 40, sinceHours: 2 }, now), {
    status: { filterType: 'text', type: 'equals', filter: 'CREATED' },
    total: { filterType: 'number', operator: 'AND', conditions: [
      { filterType: 'number', type: 'greaterThanOrEqual', filter: 10 },
      { filterType: 'number', type: 'lessThanOrEqual', filter: 40 },
    ] },
    at: { filterType: 'date', type: 'greaterThan', dateFrom: '2026-11-12 18:00:00' },
  });
  assert.deepEqual(toGridFilter({}), {});
});

test('sample week: stable, adds up, and filters like the grid', () => {
  const now = Date.parse('2026-11-12T20:00:00Z');
  const a = sampleRows(now);
  assert.deepEqual(a, sampleRows(now));
  for (const r of a) {
    assert.equal(r.subtotal + r.service + r.tax, r.total);
    assert.ok(Date.parse(r.at) <= now);
    assert.equal(r.source, 'sample');
  }
  const refunded = applySalesQuery(a, { status: 'REFUNDED' }, now);
  assert.ok(refunded.every((r) => r.status === 'REFUNDED'));
  const big = applySalesQuery(a, { minTotal: 30, sort: 'total_desc' }, now);
  assert.ok(big.every((r, i) => r.total >= 3000 && (i === 0 || big[i - 1].total >= r.total)));
  const s = summarize(a);
  assert.equal(s.collected, a.filter((r) => r.status === 'COMPLETED').reduce((x, r) => x + r.total, 0));
});

// ---------- HTTP: refunds ----------

delete process.env.PAYPAL_CLIENT_ID; // mock mode
const { default: app } = await import('../server/index.ts');
let server: Server;
let base = '';
before(() => new Promise<void>((r) => { server = app.listen(0, () => { base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`; r(); }); }));
after(() => new Promise<void>((r) => server.close(() => r())));
const post = (p: string, body: unknown = {}) => fetch(base + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(async (r) => ({ status: r.status, json: await r.json() }));

test('a paid order shows up for the owner and can be refunded once', async () => {
  const created = await post('/api/orders', { table: '3', cart: [{ itemId: 'koshari', quantity: 2 }] });
  assert.equal(created.status, 200);
  const id = created.json.id as string;

  const unpaid = await post(`/api/owner/payments/${id}/refund`);
  assert.equal(unpaid.status, 400); // not paid yet

  await post(`/api/orders/${id}/capture`);
  const rows = (await fetch(`${base}/api/owner/payments`).then((r) => r.json())) as PaymentRow[];
  const row = rows.find((r) => r.orderId === id)!;
  assert.equal(row.status, 'COMPLETED');
  assert.equal(row.items, '2× Koshari');
  assert.equal(row.source, 'mock');

  const refunded = await post(`/api/owner/payments/${id}/refund`);
  assert.equal(refunded.json.status, 'REFUNDED');
  const again = await post(`/api/owner/payments/${id}/refund`);
  assert.equal(again.json.refundId, refunded.json.refundId);

  // Guests never see sample rows or other tables in their own payments list.
  const table12 = (await fetch(`${base}/api/tables/12/payments`).then((r) => r.json())) as PaymentRow[];
  assert.ok(table12.every((r) => r.source !== 'sample'));
});

test('rules fill what a small model misses', async () => {
  const { mergeWithRules } = await import('../shared/sales.ts');
  const q = mergeWithRules({ status: 'CREATED', text: 'today' }, 'Unpaid orders today');
  assert.equal(q.text, undefined);
  assert.ok(q.sinceHours && q.sinceHours <= 24);
  assert.deepEqual(mergeWithRules({ text: 'Sara', status: 'REFUNDED' }, 'Sara refunds'), { text: 'Sara', status: 'REFUNDED' });
});

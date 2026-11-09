import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { buildOrderBody } from '../server/paypal.ts';
import { orderForCart, orderForShare } from '../server/orders.ts';

delete process.env.PAYPAL_CLIENT_ID; // mock mode for the HTTP tests
const { default: app } = await import('../server/index.ts');

let server: Server;
let base = '';
before(() => new Promise<void>((r) => { server = app.listen(0, () => { base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`; r(); }); }));
after(() => new Promise<void>((r) => server.close(() => r())));

const post = (p: string, body: unknown) => fetch(base + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(async (r) => ({ status: r.status, json: await r.json() }));

test('paypal body: breakdown adds up and items match item_total', () => {
  const { req } = orderForCart([{ itemId: 'burger', quantity: 2 }, { itemId: 'cola', quantity: 1 }], '7');
  const body = buildOrderBody(req);
  const u = body.purchase_units[0];
  assert.equal(u.amount.value, '27.72'); // 22.00 + 2.64 service + 3.08 tax
  assert.equal(u.amount.breakdown.item_total.value, '22.00');
  assert.equal(u.amount.breakdown.handling.value, '2.64');
  assert.equal(u.amount.breakdown.tax_total.value, '3.08');
  assert.equal(u.items.length, 2);
});

test('orders: prices from the browser are ignored', () => {
  const { req } = orderForCart([{ itemId: 'fries', quantity: 1, price: 0.01 }], '7');
  assert.equal(req.itemTotal, 350);
});

test('orders: a share becomes a single line with its own breakdown', () => {
  const cart = [{ itemId: 'burger', quantity: 1 }, { itemId: 'fries', quantity: 1 }];
  const plan = [{ payer: 'Sara', lines: [{ itemId: 'burger', units: 1 }] }, { payer: 'Omar', lines: [] }];
  const { req, payer } = orderForShare(cart, plan, 0, '7');
  assert.equal(payer, 'Sara');
  assert.equal(req.items[0].unitCents, 1175); // burger + half the fries (unclaimed is shared)
  assert.doesNotThrow(() => buildOrderBody(req));
});

test('http: mock checkout flow, capture is idempotent, table ledger', async () => {
  const cart = [{ itemId: 'koshari', quantity: 2 }];
  const created = await post('/api/orders', { table: '5', cart });
  assert.equal(created.status, 200);
  assert.match(created.json.id, /^MOCK-/);
  const c1 = await post(`/api/orders/${created.json.id}/capture`, {});
  const c2 = await post(`/api/orders/${created.json.id}/capture`, {});
  assert.equal(c1.json.status, 'COMPLETED');
  assert.equal(c2.json.status, 'COMPLETED');
  const ledger = await fetch(`${base}/api/tables/5/payments`).then((r) => r.json());
  assert.equal(ledger.length, 1);
  assert.equal(ledger[0].total, 1512); // 12.00 + 1.44 service + 1.68 tax
});

test('http: kitchen tickets are sanitised, listed newest first, and can be marked done', async () => {
  const a = await post('/api/tables/3/tickets', { cart: [{ itemId: 'koshari', quantity: 2, note: 'sin cebolla' }, { itemId: 'nope', quantity: 1 }], lang: 'es' });
  assert.equal(a.status, 200);
  assert.deepEqual(a.json.lines, [{ itemId: 'koshari', quantity: 2, note: 'sin cebolla' }]);
  assert.equal(a.json.guestLang, 'es');
  const b = await post('/api/tables/4/tickets', { cart: [{ itemId: 'cola', quantity: 1 }] });
  const list = await fetch(`${base}/api/kitchen`).then((r) => r.json());
  assert.equal(list[0].id, b.json.id);
  const done = await post(`/api/kitchen/${a.json.id}/done`, {});
  assert.equal(done.json.done, true);
  assert.equal((await post('/api/tables/3/tickets', { cart: [] })).status, 400);
});

test('http: empty order and unknown payer are rejected', async () => {
  assert.equal((await post('/api/orders', { cart: [] })).status, 400);
  assert.equal((await post('/api/orders', { cart: [{ itemId: 'fries', quantity: 1 }], plan: [], payerIndex: 3 })).status, 400);
  assert.equal((await post('/api/orders/NOPE/capture', {})).status, 400);
});

// A network drop between our server and PayPal at capture time must not lose the payment:
// the API answers 504 + retryable, and the next capture call for the same order succeeds.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

process.env.PAYPAL_CLIENT_ID = 'test-id';
process.env.PAYPAL_CLIENT_SECRET = 'test-secret';

const realFetch = globalThis.fetch;
let captureFailuresLeft = 0;
let captureCalls = 0;
const requestIds: string[] = [];

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  if (!url.includes('paypal.com')) return realFetch(input, init);
  const json = (b: unknown) => new Response(JSON.stringify(b), { status: 200, headers: { 'Content-Type': 'application/json' } });
  if (url.endsWith('/v1/oauth2/token')) return json({ access_token: 't', expires_in: 3600 });
  if (url.endsWith('/v2/checkout/orders')) return json({ id: 'ORDER1', status: 'CREATED' });
  if (url.includes('/capture')) {
    captureCalls++;
    requestIds.push(String((init?.headers as Record<string, string>)['PayPal-Request-Id']));
    if (captureFailuresLeft-- > 0) throw new TypeError('fetch failed');
    return json({ id: 'ORDER1', status: 'COMPLETED', purchase_units: [{ payments: { captures: [{ id: 'CAP1', status: 'COMPLETED' }] } }] });
  }
  throw new Error('unexpected ' + url);
}) as typeof fetch;

const { default: app } = await import('../server/index.ts');
let server: Server;
let base = '';
before(() => new Promise<void>((r) => { server = app.listen(0, () => { base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`; r(); }); }));
after(() => new Promise<void>((r) => { globalThis.fetch = realFetch; server.close(() => r()); }));

const post = (p: string, body: unknown) => realFetch(base + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  .then(async (r) => ({ status: r.status, json: await r.json() }));

test('capture: network drop gives 504 retryable, then the same order completes', async () => {
  const created = await post('/api/orders', { table: '9', cart: [{ itemId: 'fries', quantity: 1 }] });
  assert.equal(created.json.id, 'ORDER1');

  captureFailuresLeft = 3; // the server retries 3 times internally, all fail
  const first = await post('/api/orders/ORDER1/capture', {});
  assert.equal(first.status, 504);
  assert.equal(first.json.retryable, true);
  assert.match(first.json.error, /not been charged/);

  const second = await post('/api/orders/ORDER1/capture', {});
  assert.equal(second.status, 200);
  assert.equal(second.json.status, 'COMPLETED');

  // Every capture attempt for this order used the same idempotency key.
  assert.equal(new Set(requestIds).size, 1);
  assert.equal(captureCalls, 4);
});

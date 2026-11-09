import express, { type NextFunction, type Request, type Response } from 'express';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MENU, RESTAURANT } from '../shared/menu.js';
import { captureOrder, createOrder, paypalConfig, PayPalError } from './paypal.js';
import { BadRequest, orderForCart, orderForShare } from './orders.js';

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '32kb' }));

const paypal = paypalConfig();
// In development the web app runs on Vite and proxies /api to 8787; PORT is only honoured in
// production (`npm start`), where this server also serves the built app.
const PROD = process.argv.includes('--prod');
const PORT = Number(process.env.API_PORT) || (PROD ? Number(process.env.PORT) || 8787 : 8787);

// Payments per table, in memory. Enough for a demo; a real restaurant keeps this in Merkevo.
type Payment = { orderId: string; table: string; payer: string; total: number; status: 'CREATED' | 'COMPLETED'; at: string };
const payments = new Map<string, Payment>();

// Tiny per-IP rate limit: 60 requests a minute on the API.
const hits = new Map<string, { n: number; reset: number }>();
app.use('/api', (req, res, next) => {
  const ip = req.ip || 'x';
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || h.reset < now) hits.set(ip, { n: 1, reset: now + 60_000 });
  else if (++h.n > 60) return res.status(429).json({ error: 'Too many requests, slow down a little.' });
  next();
});

const table = (req: Request) => String(req.body?.table ?? req.params.table ?? '12').replace(/[^\w-]/g, '').slice(0, 12) || '12';

app.get('/api/config', (_req, res) => {
  res.json({
    restaurant: RESTAURANT,
    paypal: paypal ? { mode: process.env.PAYPAL_ENV === 'live' ? 'live' : 'sandbox', clientId: paypal.clientId } : { mode: 'mock' },
  });
});

app.get('/api/menu', (_req, res) => { res.json(MENU); });

app.post('/api/orders', async (req, res, next) => {
  try {
    const t = table(req);
    const isShare = req.body?.plan !== undefined;
    const built = isShare
      ? orderForShare(req.body.cart, req.body.plan, req.body.payerIndex, t)
      : { ...orderForCart(req.body.cart, t), payer: 'Whole table' };
    const requestId = String(req.body?.requestId || randomUUID()).slice(0, 100);
    const order = paypal
      ? await createOrder(paypal, built.req, requestId)
      : { id: `MOCK-${randomUUID().slice(0, 8).toUpperCase()}`, status: 'CREATED' };
    payments.set(order.id, { orderId: order.id, table: t, payer: built.payer, total: built.req.total, status: 'CREATED', at: new Date().toISOString() });
    console.log(`[order] created ${order.id} (${order.status}) table ${t}, ${built.payer}, ${(built.req.total / 100).toFixed(2)}`);
    res.json({ id: order.id, total: built.req.total, payer: built.payer, mock: !paypal });
  } catch (e) { next(e); }
});

app.post('/api/orders/:id/capture', async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const p = payments.get(id);
    if (!p) throw new BadRequest('Unknown order.');
    if (p.status === 'COMPLETED') return res.json({ id, status: 'COMPLETED', payer: p.payer, total: p.total });
    let status = 'COMPLETED';
    if (paypal) {
      const cap = await captureOrder(paypal, id, `capture-${id}`);
      status = cap.purchase_units?.[0]?.payments?.captures?.[0]?.status || cap.status;
    }
    if (status === 'COMPLETED') p.status = 'COMPLETED';
    console.log(`[order] capture ${id}: ${status}`);
    res.json({ id, status, payer: p.payer, total: p.total });
  } catch (e) { next(e); }
});

app.get('/api/tables/:table/payments', (req, res) => {
  const t = table(req);
  res.json([...payments.values()].filter((p) => p.table === t && p.status === 'COMPLETED'));
});

app.use('/api', (_req, res) => { res.status(404).json({ error: 'Not found' }); });

// Production: serve the built web app.
const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
if (existsSync(dist)) {
  app.use(express.static(dist, { index: 'index.html', maxAge: '1h' }));
  app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof BadRequest) return res.status(400).json({ error: err.message });
  if (err instanceof PayPalError) {
    console.error(err.message, JSON.stringify(err.details ?? ''));
    const known: Record<string, string> = {
      COMPLIANCE_VIOLATION: "PayPal blocked this payment for the restaurant's account (often the account's country can't receive payments). The guest was not charged.",
      PAYEE_ACCOUNT_RESTRICTED: "The restaurant's PayPal account can't receive payments right now. The guest was not charged.",
      INSTRUMENT_DECLINED: 'That payment method was declined. Please choose another one in PayPal.',
      ORDER_NOT_APPROVED: 'The payment was not approved in PayPal yet.',
    };
    if (err.status === 504) {
      // Network trouble between this server and PayPal. Nothing was charged; the approval is still valid.
      return res.status(504).json({ error: 'We could not reach PayPal to confirm the payment. You have not been charged yet.', retryable: true });
    }
    const issue = Object.keys(known).find((k) => err.message.includes(k));
    return res.status(502).json({ error: issue ? known[issue] : 'PayPal could not complete that step. Please try again.', issue: err.message });
  }
  console.error(err);
  res.status(500).json({ error: 'Something went wrong.' });
});

export default app;

if (process.argv[1] && path.resolve(fileURLToPath(import.meta.url)).toLowerCase() === path.resolve(process.argv[1]).toLowerCase()) {
  app.listen(PORT, () => console.log(`Merkevo Waiter API on http://localhost:${PORT} (PayPal: ${paypal ? 'sandbox' : 'mock mode'})`));
}

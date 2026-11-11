// Minimal PayPal Orders v2 client (sandbox by default). No SDK: two endpoints are all we need.
// Without credentials the app runs in "mock" mode so anyone can try it end to end.

export type PayPalConfig = { clientId: string; clientSecret: string; base: string } | null;

export function paypalConfig(env = process.env): PayPalConfig {
  const clientId = env.PAYPAL_CLIENT_ID?.trim();
  const clientSecret = env.PAYPAL_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  const base = env.PAYPAL_ENV === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
  return { clientId, clientSecret, base };
}

let token: { value: string; expires: number } | null = null;

async function accessToken(cfg: NonNullable<PayPalConfig>): Promise<string> {
  if (token && token.expires > Date.now() + 60_000) return token.value;
  const res = await send(`${cfg.base}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) throw new PayPalError(`PayPal auth failed (HTTP ${res.status})`, res.status);
  const j = (await res.json()) as { access_token: string; expires_in: number };
  token = { value: j.access_token, expires: Date.now() + j.expires_in * 1000 };
  return token.value;
}

export class PayPalError extends Error {
  constructor(message: string, public status = 502, public details?: unknown) { super(message); }
}

/**
 * fetch with a timeout and one retry on network errors. Safe to retry because every call carries
 * the same PayPal-Request-Id, so PayPal returns the first result instead of doing the work twice.
 */
async function send(url: string, init: RequestInit, tries = 3): Promise<Response> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fetch(url, { ...init, signal: AbortSignal.timeout(20_000) });
    } catch (e) {
      if (attempt >= tries) throw new PayPalError(`Could not reach PayPal (${(e as Error).message})`, 504);
      await new Promise((r) => setTimeout(r, 800));
    }
  }
}

async function call<T>(cfg: NonNullable<PayPalConfig>, path: string, body: unknown, requestId: string): Promise<T> {
  const res = await send(`${cfg.base}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${await accessToken(cfg)}`,
      'Content-Type': 'application/json',
      'PayPal-Request-Id': requestId, // idempotency: a retried request never creates a second order or capture
      Prefer: 'return=representation',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const issue = json?.details?.[0]?.issue || json?.name || 'UNKNOWN';
    throw new PayPalError(`PayPal ${path} failed: ${issue}`, res.status, json?.details);
  }
  return json as T;
}

export type OrderRequest = {
  referenceId: string;
  description: string;
  items: { name: string; quantity: number; unitCents: number; description?: string }[];
  itemTotal: number;
  service: number;
  tax: number;
  total: number;
  currency: string;
};

const money = (cents: number, currency: string) => ({ currency_code: currency, value: (cents / 100).toFixed(2) });

/** PayPal requires item_total to equal the sum of the items, and value to equal the breakdown. */
export function buildOrderBody(o: OrderRequest) {
  const sumItems = o.items.reduce((s, i) => s + i.unitCents * i.quantity, 0);
  if (sumItems !== o.itemTotal) throw new Error(`Item total mismatch: ${sumItems} vs ${o.itemTotal}`);
  if (o.itemTotal + o.service + o.tax !== o.total) throw new Error('Breakdown does not add up');
  return {
    intent: 'CAPTURE',
    purchase_units: [{
      reference_id: o.referenceId.slice(0, 256),
      description: o.description.slice(0, 127),
      amount: {
        ...money(o.total, o.currency),
        breakdown: {
          item_total: money(o.itemTotal, o.currency),
          handling: money(o.service, o.currency), // the restaurant service charge
          tax_total: money(o.tax, o.currency),
        },
      },
      items: o.items.map((i) => ({
        name: i.name.slice(0, 127),
        quantity: String(i.quantity),
        unit_amount: money(i.unitCents, o.currency),
        category: 'PHYSICAL_GOODS',
        ...(i.description ? { description: i.description.slice(0, 127) } : {}),
      })),
    }],
    // The JS SDK button flow (popup) expects a plain CREATED order, so no payment_source here.
    application_context: {
      brand_name: 'Nile Grill (Merkevo Waiter demo)',
      shipping_preference: 'NO_SHIPPING',
      user_action: 'PAY_NOW',
    },
  };
}

export async function createOrder(cfg: NonNullable<PayPalConfig>, o: OrderRequest, requestId: string) {
  return call<{ id: string; status: string }>(cfg, '/v2/checkout/orders', buildOrderBody(o), requestId);
}

export async function captureOrder(cfg: NonNullable<PayPalConfig>, id: string, requestId: string) {
  return call<{ id: string; status: string; purchase_units?: { payments?: { captures?: { id: string; status: string }[] } }[] }>(
    cfg, `/v2/checkout/orders/${encodeURIComponent(id)}/capture`, undefined, requestId);
}

/** Full refund of a captured payment. The same requestId never refunds twice. */
export async function refundCapture(cfg: NonNullable<PayPalConfig>, captureId: string, requestId: string) {
  return call<{ id: string; status: string }>(cfg, `/v2/payments/captures/${encodeURIComponent(captureId)}/refund`, {}, requestId);
}

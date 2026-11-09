import type { Cart } from '../shared/cart';
import type { SharePlan } from '../shared/split';
import type { RESTAURANT } from '../shared/menu';

export type AppConfig = { restaurant: typeof RESTAURANT; paypal: { mode: 'mock' } | { mode: 'sandbox' | 'live'; clientId: string } };
export type CreatedOrder = { id: string; total: number; payer: string; mock: boolean };
export type Captured = { id: string; status: string; payer: string; total: number };

async function req<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, body === undefined ? undefined : {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(json.error || `Request failed (${res.status})`, json.retryable === true || res.status === 504);
  return json as T;
}

/** `retryable` means the same request can safely be sent again (for example a capture after a network drop). */
export class ApiError extends Error {
  constructor(message: string, public retryable = false) { super(message); }
}

export const api = {
  config: () => req<AppConfig>('/api/config'),
  createOrder: (table: string, cart: Cart, share?: { plan: SharePlan; payerIndex: number }) =>
    req<CreatedOrder>('/api/orders', { table, cart, ...(share ? share : {}), requestId: crypto.randomUUID() }),
  capture: (id: string) => req<Captured>(`/api/orders/${encodeURIComponent(id)}/capture`, {}),
  sendTicket: (table: string, cart: Cart, lang: string) => req<Ticket>(`/api/tables/${encodeURIComponent(table)}/tickets`, { cart, lang }),
  kitchen: () => req<Ticket[]>('/api/kitchen'),
  ticketDone: (id: string) => req<Ticket>(`/api/kitchen/${encodeURIComponent(id)}/done`, {}),
};

export type Ticket = { id: string; table: string; lines: Cart; guestLang: string; at: string; done: boolean };

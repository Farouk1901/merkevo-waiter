// Turns a cart (and optionally one person's share) into a PayPal order request.
// Every amount is recomputed here from the server's menu: the browser only says *what*, never *how much*.
import { MENU, RESTAURANT, menuById } from '../shared/menu.js';
import { sanitizeCart, totals, type Cart } from '../shared/cart.js';
import { splitBill, type SharePlan } from '../shared/split.js';
import type { OrderRequest } from './paypal.js';

export class BadRequest extends Error {}

export function sanitizePlan(input: unknown): SharePlan {
  if (!Array.isArray(input)) return [];
  return input.slice(0, 12).map((s) => ({
    payer: String((s as { payer?: unknown })?.payer ?? 'Guest').slice(0, 40),
    lines: Array.isArray((s as { lines?: unknown })?.lines)
      ? ((s as { lines: unknown[] }).lines).slice(0, 50).map((l) => ({
        itemId: String((l as { itemId?: unknown })?.itemId ?? ''),
        units: Number((l as { units?: unknown })?.units) || 0,
      })).filter((l) => menuById(l.itemId) && l.units > 0)
      : [],
    ...((s as { rest?: unknown })?.rest === true ? { rest: true } : {}),
  }));
}

export function orderForCart(rawCart: unknown, table: string): { req: OrderRequest; cart: Cart } {
  const cart = sanitizeCart(rawCart);
  if (!cart.length) throw new BadRequest('The order is empty.');
  const t = totals(cart);
  return {
    cart,
    req: {
      referenceId: `table-${table}`,
      description: `${RESTAURANT.name}, table ${table}`,
      currency: RESTAURANT.currency,
      items: cart.map((l) => {
        const m = menuById(l.itemId)!;
        return { name: m.name, quantity: l.quantity, unitCents: Math.round(m.price * 100), ...(l.note ? { description: l.note } : {}) };
      }),
      itemTotal: t.subtotal,
      service: t.service,
      tax: t.tax,
      total: t.total,
    },
  };
}

export function orderForShare(rawCart: unknown, rawPlan: unknown, payerIndex: unknown, table: string): { req: OrderRequest; payer: string } {
  const cart = sanitizeCart(rawCart);
  if (!cart.length) throw new BadRequest('The order is empty.');
  const plan = sanitizePlan(rawPlan);
  const { shares } = splitBill(cart, plan, MENU);
  const i = Number(payerIndex);
  const share = Number.isInteger(i) ? shares[i] : undefined;
  if (!share) throw new BadRequest('Unknown payer.');
  if (share.total <= 0) throw new BadRequest(`${share.payer} has nothing to pay.`);
  return {
    payer: share.payer,
    req: {
      referenceId: `table-${table}-${i}`,
      description: `${RESTAURANT.name}, table ${table}: ${share.payer}'s share`,
      currency: RESTAURANT.currency,
      items: [{ name: `${share.payer}'s share`, quantity: 1, unitCents: share.subtotal, description: share.items.join(', ') }],
      itemTotal: share.subtotal,
      service: share.service,
      tax: share.tax,
      total: share.total,
    },
  };
}

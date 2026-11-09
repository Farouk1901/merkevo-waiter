// Pure cart logic shared by the browser and the server. All money is handled in cents.
import { MENU, RESTAURANT, menuById, type MenuItem } from './menu.js';

export type CartLine = { itemId: string; quantity: number; note?: string };
export type Cart = CartLine[];

export type CartAction =
  | { op: 'add'; itemId: string; quantity?: number; note?: string }
  | { op: 'remove'; itemId: string; quantity?: number }
  | { op: 'set_note'; itemId: string; note: string }
  | { op: 'clear' };

export const MAX_QTY = 20;

const cents = (usd: number) => Math.round(usd * 100);
export const fmt = (c: number) => (c / 100).toFixed(2);

/** Apply actions in order. Unknown items and bad quantities are skipped and reported. */
export function applyActions(cart: Cart, actions: CartAction[], menu: MenuItem[] = MENU): { cart: Cart; skipped: string[] } {
  let next = cart.map((l) => ({ ...l }));
  const skipped: string[] = [];
  for (const a of actions) {
    if (a.op === 'clear') { next = []; continue; }
    if (!menu.some((m) => m.id === a.itemId)) { skipped.push(`unknown item "${a.itemId}"`); continue; }
    const line = next.find((l) => l.itemId === a.itemId);
    if (a.op === 'add') {
      const q = clampQty(a.quantity ?? 1);
      if (!q) { skipped.push(`bad quantity for ${a.itemId}`); continue; }
      if (line) {
        line.quantity = Math.min(MAX_QTY, line.quantity + q);
        if (a.note) line.note = joinNote(line.note, a.note);
      } else next.push({ itemId: a.itemId, quantity: q, ...(a.note ? { note: cleanNote(a.note) } : {}) });
    } else if (a.op === 'remove') {
      if (!line) { skipped.push(`${a.itemId} is not in the order`); continue; }
      const q = a.quantity === undefined ? line.quantity : clampQty(a.quantity);
      line.quantity -= q;
      if (line.quantity <= 0) next = next.filter((l) => l !== line);
    } else if (a.op === 'set_note') {
      if (!line) { skipped.push(`${a.itemId} is not in the order`); continue; }
      line.note = cleanNote(a.note);
    }
  }
  return { cart: next, skipped };
}

function clampQty(q: unknown): number {
  const n = Math.floor(Number(q));
  return Number.isFinite(n) && n > 0 ? Math.min(n, MAX_QTY) : 0;
}

export function cleanNote(n: string): string {
  return String(n || '').replace(/[\r\n<>]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
}

function joinNote(a: string | undefined, b: string): string {
  return cleanNote(a ? `${a}; ${b}` : b);
}

export type Totals = { subtotal: number; service: number; tax: number; total: number };

/** Totals in cents. Service and tax are computed on the subtotal and rounded once each. */
export function totals(cart: Cart, menu: MenuItem[] = MENU): Totals {
  const subtotal = cart.reduce((s, l) => s + cents(priceOf(l.itemId, menu)) * l.quantity, 0);
  return totalsFromSubtotal(subtotal);
}

export function totalsFromSubtotal(subtotal: number): Totals {
  const service = Math.round(subtotal * RESTAURANT.serviceRate);
  const tax = Math.round(subtotal * RESTAURANT.taxRate);
  return { subtotal, service, tax, total: subtotal + service + tax };
}

export function priceOf(itemId: string, menu: MenuItem[] = MENU): number {
  const m = menu.find((x) => x.id === itemId);
  if (!m) throw new Error(`Unknown item ${itemId}`);
  return m.price;
}

/** Validate a cart that arrives from the outside world (the browser). */
export function sanitizeCart(input: unknown): Cart {
  if (!Array.isArray(input)) return [];
  const out: Cart = [];
  for (const raw of input.slice(0, 50)) {
    const itemId = String((raw as CartLine)?.itemId ?? '');
    const q = clampQty((raw as CartLine)?.quantity);
    if (!menuById(itemId) || !q) continue;
    const note = (raw as CartLine)?.note ? cleanNote(String((raw as CartLine).note)) : undefined;
    out.push({ itemId, quantity: q, ...(note ? { note } : {}) });
  }
  return out;
}

/** Items that pair with what is in the cart but are not in it yet. */
export function suggestions(cart: Cart, menu: MenuItem[] = MENU, max = 3): MenuItem[] {
  const inCart = new Set(cart.map((l) => l.itemId));
  const ids: string[] = [];
  for (const l of cart) for (const p of menu.find((m) => m.id === l.itemId)?.pairsWith || []) {
    if (!inCart.has(p) && !ids.includes(p)) ids.push(p);
  }
  return ids.map((id) => menu.find((m) => m.id === id)!).filter(Boolean).slice(0, max);
}

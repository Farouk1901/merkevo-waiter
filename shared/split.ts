// Bill splitting. The AI (or a person) proposes who pays for what; this file turns that into
// exact amounts in cents that always add up to the table total.
import { MENU, type MenuItem } from './menu.js';
import { totals, type Cart } from './cart.js';

/** `units` is how many of that item this payer takes; 0.5 means half of one. */
/** `rest: true` means this person pays whatever nobody else claimed ("Mona pays the rest"). */
export type SharePlan = { payer: string; lines: { itemId: string; units: number }[]; rest?: boolean }[];

export type ShareAmount = {
  payer: string;
  subtotal: number;
  service: number;
  tax: number;
  total: number;
  /** Human-readable list, e.g. "1 × Grill burger, 0.5 × Fries". */
  items: string[];
};

export type SplitResult = { shares: ShareAmount[]; warnings: string[] };

const MAX_PAYERS = 12;

/**
 * Turn a plan into amounts.
 * - Units over what was ordered are capped, with a warning.
 * - Anything nobody claimed is shared equally by everyone.
 * - Service and tax follow each person's share of the subtotal.
 * - Rounding leftovers (a cent or two) go to the first payers, so the sum is exact.
 */
export function splitBill(cart: Cart, plan: SharePlan, menu: MenuItem[] = MENU): SplitResult {
  const warnings: string[] = [];
  const payers = dedupePayers(plan.map((p) => p.payer)).slice(0, MAX_PAYERS);
  if (!payers.length) return { shares: [], warnings: ['No payers given.'] };
  if (plan.length > MAX_PAYERS) warnings.push(`Only the first ${MAX_PAYERS} payers are used.`);

  const price = (id: string) => Math.round((menu.find((m) => m.id === id)?.price ?? 0) * 100);
  const nameOf = (id: string) => menu.find((m) => m.id === id)?.name ?? id;
  const remaining = new Map(cart.map((l) => [l.itemId, l.quantity]));
  // claimed[payerIndex] = subtotal in "cent units" (may be fractional until the end)
  const claimed = payers.map(() => 0);
  const itemsText: string[][] = payers.map(() => []);

  plan.slice(0, MAX_PAYERS).forEach((share) => {
    const pi = payers.indexOf(cleanPayer(share.payer));
    for (const l of share.lines || []) {
      const left = remaining.get(l.itemId);
      if (left === undefined) { warnings.push(`${share.payer}: ${nameOf(l.itemId)} is not on the bill.`); continue; }
      let u = Number(l.units);
      if (!Number.isFinite(u) || u <= 0) continue;
      if (u > left + 1e-9) {
        warnings.push(`${share.payer}: only ${fmtUnits(left)} × ${nameOf(l.itemId)} left, used that.`);
        u = left;
      }
      if (u <= 0) continue;
      remaining.set(l.itemId, left - u);
      claimed[pi] += u * price(l.itemId);
      itemsText[pi].push(`${fmtUnits(u)} × ${nameOf(l.itemId)}`);
    }
  });

  // Unclaimed items go to whoever said "the rest"; if nobody did, everyone shares them equally.
  const restIdx = [...new Set(plan.slice(0, MAX_PAYERS).filter((p) => p.rest).map((p) => payers.indexOf(cleanPayer(p.payer))))];
  const takers = restIdx.length ? restIdx : payers.map((_, i) => i);
  let unclaimed = 0;
  for (const [id, left] of remaining) if (left > 1e-9) {
    unclaimed += left * price(id);
    const each = left / takers.length;
    takers.forEach((i) => itemsText[i].push(`${restIdx.length ? '' : 'shared '}${fmtUnits(each)} × ${nameOf(id)}`));
  }
  if (unclaimed > 0 && !restIdx.length && plan.some((p) => p.lines?.length)) warnings.push('Items nobody claimed are split equally.');
  const raw = claimed.map((c, i) => c + (takers.includes(i) ? unclaimed / takers.length : 0));

  const t = totals(cart, menu);
  const subtotals = apportion(raw, t.subtotal);
  const services = apportion(subtotals, t.service);
  const taxes = apportion(subtotals, t.tax);

  return {
    shares: payers.map((payer, i) => ({
      payer,
      subtotal: subtotals[i],
      service: services[i],
      tax: taxes[i],
      total: subtotals[i] + services[i] + taxes[i],
      items: itemsText[i],
    })),
    warnings,
  };
}

/** Equal split between n people. */
export function equalPlan(n: number): SharePlan {
  const k = Math.max(1, Math.min(MAX_PAYERS, Math.floor(n) || 1));
  return Array.from({ length: k }, (_, i) => ({ payer: `Guest ${i + 1}`, lines: [] }));
}

/** Split `total` cents in proportion to `weights`, as whole cents that add up exactly (largest remainder). */
export function apportion(weights: number[], total: number): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (!weights.length) return [];
  if (sum <= 0) return apportion(weights.map(() => 1), total);
  const exact = weights.map((w) => (w / sum) * total);
  const out = exact.map(Math.floor);
  let left = total - out.reduce((a, b) => a + b, 0);
  const order = exact.map((e, i) => [e - Math.floor(e), i] as const).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (let k = 0; left > 0; k = (k + 1) % order.length, left--) out[order[k][1]]++;
  return out;
}

const cleanPayer = (p: string) => String(p || '').replace(/[\r\n<>]+/g, ' ').trim().slice(0, 40) || 'Guest';

function dedupePayers(list: string[]): string[] {
  const out: string[] = [];
  for (const p of list.map(cleanPayer)) if (!out.includes(p)) out.push(p);
  return out;
}

function fmtUnits(u: number): string {
  return Number.isInteger(u) ? String(u) : (Math.round(u * 100) / 100).toString();
}

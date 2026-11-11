// Every PayPal order the tables create, for the owner's dashboard.
// Kept in memory, and saved to PAYMENTS_FILE when it is set (production), so a restart keeps the history.
// A week of clearly labelled sample orders is added so the dashboard is never empty in a demo.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { MENU } from '../shared/menu.js';
import { totalsFromSubtotal } from '../shared/cart.js';
import type { PaymentRow } from '../shared/sales.js';

const FILE = process.env.PAYMENTS_FILE?.trim() || '';
const rows = new Map<string, PaymentRow>();

export const ledger = {
  get: (id: string) => rows.get(id),
  all: () => [...rows.values()].sort((a, b) => b.at.localeCompare(a.at)),
  put(row: PaymentRow) { rows.set(row.orderId, row); save(); return row; },
  update(id: string, patch: Partial<PaymentRow>) {
    const r = rows.get(id);
    if (!r) return undefined;
    Object.assign(r, patch);
    save();
    return r;
  },
};

let timer: NodeJS.Timeout | null = null;
function save() {
  if (!FILE || timer) return;
  timer = setTimeout(() => {
    timer = null;
    try {
      mkdirSync(path.dirname(FILE), { recursive: true });
      const real = [...rows.values()].filter((r) => r.source !== 'sample');
      writeFileSync(`${FILE}.tmp`, JSON.stringify(real));
      renameSync(`${FILE}.tmp`, FILE);
    } catch (e) { console.error('[ledger] save failed', e); }
  }, 300);
}

function load() {
  if (!FILE || !existsSync(FILE)) return;
  try {
    for (const r of JSON.parse(readFileSync(FILE, 'utf8')) as PaymentRow[]) if (r?.orderId) rows.set(r.orderId, r);
    console.log(`[ledger] loaded ${rows.size} payments`);
  } catch (e) { console.error('[ledger] load failed', e); }
}

/** Deterministic sample week, so screenshots and tests are stable. Marked source "sample", never sent to PayPal. */
export function sampleRows(now = Date.now(), count = 46): PaymentRow[] {
  let seed = 20261112;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
  const payers = ['Whole table', 'Whole table', 'Whole table', 'Sara', 'Omar', 'Lina', 'Youssef', 'Maya', 'Karim'];
  const out: PaymentRow[] = [];
  for (let i = 0; i < count; i++) {
    const lines = new Map<string, number>();
    const n = 1 + Math.floor(rnd() * 4);
    for (let j = 0; j < n; j++) {
      const m = MENU[Math.floor(rnd() * MENU.length)];
      lines.set(m.id, (lines.get(m.id) || 0) + 1 + Math.floor(rnd() * 2));
    }
    const subtotal = [...lines].reduce((s, [id, q]) => s + Math.round(MENU.find((m) => m.id === id)!.price * 100) * q, 0);
    const t = totalsFromSubtotal(subtotal);
    // A few orders in the last hours (so "today" is never empty), the rest in lunch and dinner rushes this week.
    let d: Date;
    if (i < 7) d = new Date(now - Math.floor(rnd() * 3 * 3_600_000) - 5 * 60_000);
    else {
      const day = 1 + Math.floor(rnd() * 6);
      const hour = rnd() < 0.45 ? 12 + rnd() * 3 : 18 + rnd() * 4;
      d = new Date(now - day * 86_400_000); d.setHours(Math.floor(hour), Math.floor(rnd() * 60), Math.floor(rnd() * 60), 0);
    }
    const roll = rnd();
    const status = i === 1 ? 'CREATED' : i === 4 ? 'REFUNDED' : roll < 0.08 ? 'REFUNDED' : roll < 0.18 ? 'CREATED' : 'COMPLETED';
    out.push({
      orderId: `SAMPLE-${String(i + 1).padStart(3, '0')}`,
      table: String(1 + Math.floor(rnd() * 14)),
      payer: payers[Math.floor(rnd() * payers.length)],
      items: [...lines].map(([id, q]) => `${q}× ${MENU.find((m) => m.id === id)!.name}`).join(', '),
      itemCount: [...lines.values()].reduce((a, b) => a + b, 0),
      ...t,
      status,
      source: 'sample',
      at: d.toISOString(),
      ...(status === 'REFUNDED' ? { refundedAt: new Date(d.getTime() + 40 * 60_000).toISOString() } : {}),
    });
  }
  return out;
}

load();
if (process.env.SAMPLE_PAYMENTS !== '0') for (const r of sampleRows()) if (!rows.has(r.orderId)) rows.set(r.orderId, r);

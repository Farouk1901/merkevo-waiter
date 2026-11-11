// The owner's view of the money: every PayPal order the tables created, and plain-language
// questions about them ("refunds this week", "unpaid orders over $30 at table 12").
// The AI (or the offline rules) turns a question into a SalesQuery; the grid applies it as
// ordinary AG Grid filters, so the owner can always see and change exactly what was asked.

export type PaymentStatus = 'CREATED' | 'COMPLETED' | 'REFUNDED';
export type PaymentSource = 'paypal-sandbox' | 'paypal-live' | 'mock' | 'sample';

export type PaymentRow = {
  orderId: string;
  table: string;
  payer: string;
  items: string;
  itemCount: number;
  subtotal: number; // cents
  service: number;
  tax: number;
  total: number;
  status: PaymentStatus;
  source: PaymentSource;
  at: string; // ISO
  captureId?: string;
  refundId?: string;
  refundedAt?: string;
};

export const STATUSES: PaymentStatus[] = ['COMPLETED', 'CREATED', 'REFUNDED'];
export const SORTS = ['newest', 'oldest', 'total_desc', 'total_asc'] as const;
export type SalesSort = (typeof SORTS)[number];

export type SalesQuery = {
  status?: PaymentStatus;
  table?: string;
  minTotal?: number; // dollars
  maxTotal?: number;
  sinceHours?: number;
  text?: string; // payer or dish
  sort?: SalesSort;
};

const num = (v: unknown, max: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= max ? n : undefined;
};

/** Keep only fields the grid understands, within sane ranges. AI output never reaches the grid unchecked. */
export function validateSalesQuery(json: unknown): { query: SalesQuery; reply: string } | null {
  const o = json as Record<string, unknown>;
  if (!o || typeof o !== 'object') return null;
  const q: SalesQuery = {};
  const status = String(o.status ?? '').toUpperCase();
  if ((STATUSES as string[]).includes(status)) q.status = status as PaymentStatus;
  const table = String(o.table ?? '').replace(/[^\w-]/g, '').slice(0, 12);
  if (table) q.table = table;
  const min = num(o.minTotal, 100_000);
  const max = num(o.maxTotal, 100_000);
  if (min !== undefined && min > 0) q.minTotal = min;
  if (max !== undefined && max > 0) q.maxTotal = max;
  if (q.minTotal !== undefined && q.maxTotal !== undefined && q.minTotal > q.maxTotal) [q.minTotal, q.maxTotal] = [q.maxTotal, q.minTotal];
  const since = num(o.sinceHours, 24 * 366);
  if (since !== undefined && since > 0) q.sinceHours = since;
  const text = typeof o.text === 'string' ? o.text.trim().slice(0, 40) : '';
  if (text) q.text = text;
  if ((SORTS as readonly string[]).includes(String(o.sort))) q.sort = o.sort as SalesSort;
  return { query: q, reply: String(o.reply ?? '').slice(0, 240) || describeQuery(q) };
}

const NOT_SEARCH = /^(today|yesterday|this week|week|orders?|paid|unpaid|refund(ed|s)?|open|pending|all|النهارده|اليوم|امبارح|الأسبوع|طلبات|مدفوع|مسترد)$/i;

/**
 * Small models sometimes put a time or status word into the search text, or forget the time window.
 * The offline rules are reliable for exactly those words, so they fill the gaps (never override the AI).
 */
export function mergeWithRules(ai: SalesQuery, said: string): SalesQuery {
  const rules = parseSalesQuery(said).query;
  const q = { ...ai };
  if (q.text && NOT_SEARCH.test(q.text.trim())) delete q.text;
  if (!q.sinceHours && rules.sinceHours) q.sinceHours = rules.sinceHours;
  if (!q.status && rules.status) q.status = rules.status;
  if (!q.table && rules.table) q.table = rules.table;
  return q;
}

/** Offline fallback: understands the common questions in English and Arabic. */
export function parseSalesQuery(said: string): { query: SalesQuery; reply: string } {
  const s = ` ${said.toLowerCase()} `;
  const q: SalesQuery = {};
  if (/refund|استرد|مرتجع/.test(s)) q.status = 'REFUNDED';
  else if (/unpaid|not paid|open|pending|abandon|مش مدفوع|غير مدفوع|لم يدفع|معلق|متدفعش/.test(s)) q.status = 'CREATED';
  else if (/\bpaid\b|completed|captured|مدفوع|اتدفع/.test(s)) q.status = 'COMPLETED';
  const table = s.match(/(?:table|ترابيزة|طاولة|ترابيزه)\s*#?\s*(\w{1,12})/);
  if (table) q.table = table[1];
  const amount = (re: RegExp) => { const m = s.match(re); return m ? Number(m[1]) : undefined; };
  q.minTotal = amount(/(?:over|above|more than|at least|>\s*|أكثر من|اكتر من|فوق)\s*\$?\s*(\d+(?:\.\d+)?)/);
  q.maxTotal = amount(/(?:under|below|less than|<\s*|أقل من|اقل من|تحت)\s*\$?\s*(\d+(?:\.\d+)?)/);
  if (/today|النهارده|اليوم/.test(s)) q.sinceHours = hoursSinceMidnight(new Date());
  else if (/yesterday|امبارح|أمس/.test(s)) q.sinceHours = 48;
  else if (/this week|last 7|week|الأسبوع|الاسبوع|اسبوع/.test(s)) q.sinceHours = 24 * 7;
  else { const h = amount(/(?:last|آخر|اخر)\s*(\d+)\s*(?:hours?|ساعات|ساعة)/); if (h) q.sinceHours = h; }
  if (/biggest|largest|highest|top|أكبر|اكبر|أعلى/.test(s)) q.sort = 'total_desc';
  else if (/smallest|lowest|أصغر|اقل/.test(s)) q.sort = 'total_asc';
  else if (/oldest|أقدم/.test(s)) q.sort = 'oldest';
  else if (/latest|newest|recent|أحدث|آخر طلبات/.test(s)) q.sort = 'newest';
  const v = validateSalesQuery(q)!;
  return { query: v.query, reply: describeQuery(v.query) };
}

export function hoursSinceMidnight(now: Date): number {
  const m = new Date(now); m.setHours(0, 0, 0, 0);
  return Math.max(1, Math.ceil((now.getTime() - m.getTime()) / 3_600_000));
}

export function describeQuery(q: SalesQuery): string {
  const parts: string[] = [];
  if (q.status) parts.push({ COMPLETED: 'paid', CREATED: 'unpaid', REFUNDED: 'refunded' }[q.status]);
  parts.push('orders');
  if (q.table) parts.push(`at table ${q.table}`);
  if (q.minTotal !== undefined) parts.push(`over $${q.minTotal}`);
  if (q.maxTotal !== undefined) parts.push(`under $${q.maxTotal}`);
  if (q.sinceHours) parts.push(q.sinceHours % 24 === 0 ? `in the last ${q.sinceHours / 24} day${q.sinceHours === 24 ? '' : 's'}` : `in the last ${q.sinceHours} hours`);
  if (q.text) parts.push(`matching "${q.text}"`);
  if (q.sort) parts.push({ newest: ', newest first', oldest: ', oldest first', total_desc: ', biggest first', total_asc: ', smallest first' }[q.sort]);
  const out = parts.join(' ').replace(' ,', ',');
  return Object.keys(q).length ? `Showing ${out}.` : 'Showing all orders.';
}

/** The same filter the grid applies, as a plain function (used for tests and the summary cards). */
export function applySalesQuery(rows: PaymentRow[], q: SalesQuery, now = Date.now()): PaymentRow[] {
  const text = q.text?.toLowerCase();
  const out = rows.filter((r) =>
    (!q.status || r.status === q.status)
    && (!q.table || r.table === q.table)
    && (q.minTotal === undefined || r.total >= q.minTotal * 100)
    && (q.maxTotal === undefined || r.total <= q.maxTotal * 100)
    && (!q.sinceHours || now - Date.parse(r.at) <= q.sinceHours * 3_600_000)
    && (!text || `${r.payer} ${r.items}`.toLowerCase().includes(text)));
  const by: Record<SalesSort, (a: PaymentRow, b: PaymentRow) => number> = {
    newest: (a, b) => b.at.localeCompare(a.at),
    oldest: (a, b) => a.at.localeCompare(b.at),
    total_desc: (a, b) => b.total - a.total,
    total_asc: (a, b) => a.total - b.total,
  };
  return q.sort ? out.sort(by[q.sort]) : out;
}

export type SalesSummary = { collected: number; refunded: number; open: number; paidCount: number; avgTicket: number };

export function summarize(rows: PaymentRow[]): SalesSummary {
  let collected = 0, refunded = 0, open = 0, paidCount = 0;
  for (const r of rows) {
    if (r.status === 'COMPLETED') { collected += r.total; paidCount++; }
    else if (r.status === 'REFUNDED') refunded += r.total;
    else open += r.total;
  }
  return { collected, refunded, open, paidCount, avgTicket: paidCount ? Math.round(collected / paidCount) : 0 };
}

// ---------- AG Grid ----------

/** "2026-11-11 18:05:00", the format AG Grid's date filter model uses. */
const gridDate = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};

/** A SalesQuery becomes ordinary AG Grid filters and sort, visible in the column menus. */
export function toGridFilter(q: SalesQuery, now = new Date()): Record<string, unknown> {
  const fm: Record<string, unknown> = {};
  if (q.status) fm.status = { filterType: 'text', type: 'equals', filter: q.status };
  if (q.table) fm.table = { filterType: 'text', type: 'equals', filter: q.table };
  const totals = [
    ...(q.minTotal !== undefined ? [{ filterType: 'number', type: 'greaterThanOrEqual', filter: q.minTotal }] : []),
    ...(q.maxTotal !== undefined ? [{ filterType: 'number', type: 'lessThanOrEqual', filter: q.maxTotal }] : []),
  ];
  if (totals.length === 1) fm.total = totals[0];
  if (totals.length === 2) fm.total = { filterType: 'number', operator: 'AND', conditions: totals };
  if (q.sinceHours) fm.at = { filterType: 'date', type: 'greaterThan', dateFrom: gridDate(new Date(now.getTime() - q.sinceHours * 3_600_000)) };
  return fm;
}

// Rule-based understanding. Used when no AI model is available at all (no on-device model and
// no network), so the waiter still works. It handles the common phrasings in English and Arabic.
import { MENU, type MenuItem } from './menu.js';
import type { CartAction } from './cart.js';
import type { SharePlan } from './split.js';

const NUMBERS: Record<string, number> = {
  one: 1, a: 1, an: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  half: 0.5, 'واحد': 1, 'واحدة': 1, 'اتنين': 2, 'اثنين': 2, 'إثنين': 2, 'تلاتة': 3, 'ثلاثة': 3, 'تلاته': 3, 'اربعة': 4, 'أربعة': 4, 'اربعه': 4,
  'خمسة': 5, 'خمسه': 5, 'نص': 0.5, 'نصف': 0.5,
};

const REMOVE = /\b(remove|cancel|delete|no more|without the|drop)\b|شيل|الغي|إلغي|امسح|بلاش ال/i;
const CLEAR = /\b(clear|start over|cancel (the )?(whole )?order|reset)\b|امسح الطلب كله|الغي الطلب|من الأول/i;

const norm = (s: string) => s.toLowerCase()
  .replace(/[ً-ْ]/g, '') // Arabic diacritics
  .replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي')
  .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660)); // Arabic-Indic digits

/** Find menu items in text, longest alias first, with their position. */
export function findItems(text: string, menu: MenuItem[] = MENU): { item: MenuItem; index: number; end: number }[] {
  const t = norm(text);
  const hits: { item: MenuItem; index: number; end: number }[] = [];
  const taken: [number, number][] = [];
  const aliases = menu.flatMap((item) => [item.name, item.nameAr, ...item.aliases].map((a) => ({ item, a: norm(a) })))
    .sort((x, y) => y.a.length - x.a.length);
  for (const { item, a } of aliases) {
    let from = 0;
    for (;;) {
      const i = t.indexOf(a, from);
      if (i < 0) break;
      const end = i + a.length;
      const wordOk = !/[a-z]/.test(t[i - 1] || '') && !/[a-z]/.test(t[end] || '') || /[^\x00-\x7F]/.test(a);
      if (wordOk && !taken.some(([s, e]) => i < e && end > s)) {
        taken.push([i, end]);
        hits.push({ item, index: i, end });
      }
      from = end;
    }
  }
  return hits.sort((x, y) => x.index - y.index);
}

/** Quantity written just before an item: "2 burgers", "two burgers", "اتنين شاورما". */
function qtyBefore(t: string, index: number): number | undefined {
  const tokens = t.slice(Math.max(0, index - 20), index).trim().split(/\s+/);
  let before = tokens.pop() || '';
  while (['the', 'of', 'my', 'our'].includes(before) && tokens.length) before = tokens.pop() || '';
  const m = before.match(/^x?(\d{1,2})x?$/);
  if (m) return Number(m[1]);
  return NUMBERS[before];
}

/** Notes like "no garlic", "بدون ثوم", "extra spicy" right after an item. */
function noteAfter(t: string, end: number, nextIndex: number): string | undefined {
  const tail = t.slice(end, nextIndex).replace(/^[\s,،]+/, '');
  const m = tail.match(/^((?:with ?out|without|no|extra|less|more|بدون|من غير|زيادة|زياده|بزيادة|حار|سبايسي)[^,،.]*)/);
  if (!m) return undefined;
  // The note ends where the next part of the order starts: "no garlic and a lemon mint".
  const note = m[1].split(/\s+(?:and|plus|&|then)\s+/)[0].replace(/(?:^|\s)(?:and|a|an|\d+)\s*$/, '').replace(/\s*و\s*$/, '').trim();
  return note || undefined;
}

export function parseOrder(text: string, menu: MenuItem[] = MENU): { actions: CartAction[]; reply: string } {
  const t = norm(text);
  if (CLEAR.test(t)) return { actions: [{ op: 'clear' }], reply: 'Done, I cleared the order.' };
  const ar = /[؀-ۿ]/.test(text);
  const hits = findItems(text, menu);
  if (!hits.length) {
    return { actions: [], reply: ar
      ? 'معلش، ما لقيتش صنف من المنيو في كلامك. جرّب مثلًا: «اتنين شاورما وليمون نعناع».'
      : "Sorry, I didn't catch a dish from the menu. Try “2 shawarma and a lemon mint”." };
  }
  const removing = REMOVE.test(t);
  const actions: CartAction[] = hits.map((h, k) => {
    const q = qtyBefore(t, h.index);
    const note = noteAfter(t, h.end, hits[k + 1]?.index ?? t.length);
    if (removing) return { op: 'remove', itemId: h.item.id, ...(q && q >= 1 ? { quantity: q } : {}) };
    return { op: 'add', itemId: h.item.id, quantity: q && q >= 1 ? Math.floor(q) : 1, ...(note ? { note } : {}) };
  });
  const words = actions.map((a) => {
    const m = menu.find((x) => x.id === (a as { itemId: string }).itemId);
    const name = ar ? m?.nameAr : m?.name;
    if (a.op === 'add') return `${a.quantity} × ${name}${a.note ? ` (${a.note})` : ''}`;
    return ar ? `شلت ${name}` : `removed ${name}`;
  });
  if (ar) return { actions, reply: (removing ? 'تمام: ' : 'تمام، ضفت ') + words.join('، ') + '.' };
  return { actions, reply: (removing ? 'OK: ' : 'Added ') + words.join(', ') + '.' };
}

/**
 * "Sara pays the burger and half the fries, Omar the rest" -> a plan.
 * Sentences are split by payer names that are followed by a pay verb or a colon.
 */
export function parseSplit(text: string, menu: MenuItem[] = MENU): { plan: SharePlan; reply: string } {
  const t = text.trim();
  const equal = norm(t).match(/(?:split|divide|قسم|قسمها|قسّم)\D*(\d{1,2}|two|three|four|five|اتنين|اثنين|تلاته|ثلاثه|اربعه|خمسه)/);
  if (equal && !/pays?|دفع|يدفع|تدفع|:/.test(t)) {
    const n = Number(equal[1]) || NUMBERS[equal[1]] || 2;
    return { plan: Array.from({ length: n }, (_, i) => ({ payer: `Guest ${i + 1}`, lines: [] })), reply: `Split equally between ${n}.` };
  }
  const parts = t.split(/[,،;.]|\band\b(?=\s+[A-Z؀-ۿ][\w؀-ۿ]*\s+(?:pays?|takes?|has|يدفع|تدفع|:))|\bو(?=\s*[؀-ۿ]+\s+(?:يدفع|تدفع))/);
  const plan: SharePlan = [];
  let current: SharePlan[number] | null = null;
  for (const raw of parts) {
    const p = raw.trim();
    if (!p) continue;
    const who = p.match(/^([A-Z؀-ۿ][\w؀-ۿ]{1,20})\s*(?:pays?(?: for)?|takes?|has|gets|:|يدفع|تدفع|عليه|عليها|(?=the rest|الباقي))/);
    if (who) {
      current = { payer: who[1], lines: [] };
      plan.push(current);
    }
    if (!current) continue;
    if (/\b(the )?rest\b|الباقي/.test(norm(p))) current.rest = true; // pays whatever nobody claimed
    if (current.rest && !findItems(p, menu).length) continue;
    const hits = findItems(p, menu);
    const tn = norm(p);
    for (const h of hits) {
      const q = qtyBefore(tn, h.index);
      current.lines.push({ itemId: h.item.id, units: q ?? 1 });
    }
  }
  if (!plan.length) return { plan: [], reply: 'Tell me who pays for what, for example “Sara pays the burger, Omar the rest”, or “split 3 ways”.' };
  return { plan, reply: `Split between ${plan.map((p) => p.payer).join(', ')}.` };
}

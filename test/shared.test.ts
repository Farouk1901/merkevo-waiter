import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyActions, sanitizeCart, suggestions, totals } from '../shared/cart.ts';
import { apportion, splitBill, equalPlan } from '../shared/split.ts';
import { parseOrder, parseSplit, findItems } from '../shared/rules.ts';

test('cart: add, merge, note, remove, clear', () => {
  let { cart } = applyActions([], [{ op: 'add', itemId: 'burger', quantity: 2 }, { op: 'add', itemId: 'burger', note: 'no onion' }]);
  assert.deepEqual(cart, [{ itemId: 'burger', quantity: 3, note: 'no onion' }]);
  ({ cart } = applyActions(cart, [{ op: 'remove', itemId: 'burger', quantity: 1 }]));
  assert.equal(cart[0].quantity, 2);
  const r = applyActions(cart, [{ op: 'add', itemId: 'pizza' }, { op: 'remove', itemId: 'fries' }]);
  assert.equal(r.skipped.length, 2);
  assert.deepEqual(applyActions(cart, [{ op: 'clear' }]).cart, []);
});

test('cart: quantities are capped and invalid ones skipped', () => {
  const { cart, skipped } = applyActions([], [{ op: 'add', itemId: 'fries', quantity: 999 }, { op: 'add', itemId: 'cola', quantity: -2 }]);
  assert.equal(cart[0].quantity, 20);
  assert.equal(skipped.length, 1);
});

test('cart: totals in cents with service and tax', () => {
  const t = totals([{ itemId: 'burger', quantity: 1 }, { itemId: 'fries', quantity: 1 }]);
  assert.deepEqual(t, { subtotal: 1350, service: 162, tax: 189, total: 1701 });
});

test('cart: sanitize drops unknown items and strips tags from notes', () => {
  const c = sanitizeCart([{ itemId: 'burger', quantity: '2', note: '<b>no</b>\nonion' }, { itemId: 'x', quantity: 1 }, null]);
  assert.deepEqual(c, [{ itemId: 'burger', quantity: 2, note: 'b no /b onion' }]);
});

test('cart: suggestions come from pairings and skip what is ordered', () => {
  assert.deepEqual(suggestions([{ itemId: 'burger', quantity: 1 }, { itemId: 'fries', quantity: 1 }]).map((m) => m.id), ['cola']);
});

test('split: apportion always adds up exactly', () => {
  for (const total of [1, 99, 1701, 100003]) {
    const parts = apportion([1, 1, 1], total);
    assert.equal(parts.reduce((a, b) => a + b, 0), total);
  }
  assert.deepEqual(apportion([0, 0], 3), [2, 1]);
});

test('split: claimed items, half portions and shared rest', () => {
  const cart = [{ itemId: 'burger', quantity: 1 }, { itemId: 'fries', quantity: 1 }, { itemId: 'cola', quantity: 2 }];
  const { shares, warnings } = splitBill(cart, [
    { payer: 'Sara', lines: [{ itemId: 'burger', units: 1 }, { itemId: 'fries', units: 0.5 }] },
    { payer: 'Omar', lines: [{ itemId: 'fries', units: 0.5 }] },
  ]);
  const t = totals(cart);
  assert.equal(shares.reduce((s, x) => s + x.total, 0), t.total);
  // Sara: 1000 + 175 + half of colas (200) = 1375; Omar: 175 + 200 = 375
  assert.deepEqual(shares.map((s) => s.subtotal), [1375, 375]);
  assert.match(warnings.join(' '), /split equally/);
});

test('split: over-claiming is capped with a warning', () => {
  const { shares, warnings } = splitBill([{ itemId: 'fries', quantity: 1 }], [
    { payer: 'A', lines: [{ itemId: 'fries', units: 1 }] },
    { payer: 'B', lines: [{ itemId: 'fries', units: 1 }] },
  ]);
  assert.deepEqual(shares.map((s) => s.subtotal), [350, 0]);
  assert.match(warnings.join(' '), /only 0/);
});

test('split: "the rest" goes to one person, not to everyone', () => {
  const cart = [{ itemId: 'shawarma', quantity: 2 }, { itemId: 'koshari', quantity: 2 }, { itemId: 'karkade', quantity: 1 }];
  const { plan } = parseSplit('Sara pays 2 shawarma and half the karkade, Omar pays 1 koshari, Mona the rest');
  assert.deepEqual(plan.map((p) => [p.payer, !!p.rest]), [['Sara', false], ['Omar', false], ['Mona', true]]);
  const { shares, warnings } = splitBill(cart, plan);
  // Sara 1500 + 125, Omar 600, Mona 600 + 125
  assert.deepEqual(shares.map((s) => s.subtotal), [1625, 600, 725]);
  assert.equal(shares.reduce((s, x) => s + x.total, 0), totals(cart).total);
  assert.deepEqual(warnings, []);
});

test('split: equal plan', () => {
  const { shares } = splitBill([{ itemId: 'koshari', quantity: 3 }], equalPlan(3));
  assert.deepEqual(shares.map((s) => s.subtotal), [600, 600, 600]);
});

test('rules: English order with quantities and notes', () => {
  const r = parseOrder('2 shawarma no garlic and a lemon mint');
  assert.deepEqual(r.actions, [
    { op: 'add', itemId: 'shawarma', quantity: 2, note: 'no garlic' },
    { op: 'add', itemId: 'lemon-mint', quantity: 1 },
  ]);
});

test('rules: Arabic order', () => {
  const r = parseOrder('اتنين شاورما بدون ثوم وكركديه');
  assert.equal(r.actions[0].op, 'add');
  assert.deepEqual(r.actions.map((a) => (a as { itemId: string }).itemId), ['shawarma', 'karkade']);
  assert.equal((r.actions[0] as { quantity: number }).quantity, 2);
});

test('rules: removal and clear', () => {
  assert.deepEqual(parseOrder('remove the fries').actions, [{ op: 'remove', itemId: 'fries' }]);
  assert.deepEqual(parseOrder('start over').actions, [{ op: 'clear' }]);
});

test('rules: longest alias wins ("lemon mint" is not "lemon")', () => {
  assert.deepEqual(findItems('one lemon mint').map((h) => h.item.id), ['lemon-mint']);
});

test('rules: split sentences', () => {
  const { plan } = parseSplit('Sara pays the burger and half the fries, Omar the rest');
  assert.equal(plan.length, 2);
  assert.equal(plan[0].payer, 'Sara');
  assert.deepEqual(plan[0].lines, [{ itemId: 'burger', units: 1 }, { itemId: 'fries', units: 0.5 }]);
  assert.equal(plan[1].payer, 'Omar');
  assert.equal(parseSplit('split it 3 ways').plan.length, 3);
});

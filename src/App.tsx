import { useEffect, useMemo, useRef, useState } from 'react';
import { MENU, type MenuItem } from '../shared/menu';
import { applyActions, fmt, suggestions, totals, type Cart, type CartAction } from '../shared/cart';
import { splitBill, type SharePlan } from '../shared/split';
import { api, type AppConfig, type Captured } from './api';
import { downloadOnDeviceModel, status as engineStatus, understandOrder, understandSplit, type EngineStatus, type Source } from './ai/engine';
import { PayButton } from './components/PayButton';

type Msg = { from: 'guest' | 'waiter'; text: string; source?: Source; ms?: number };

const TABLE = new URLSearchParams(location.search).get('table')?.replace(/[^\w-]/g, '').slice(0, 12) || '12';
const CATEGORIES: MenuItem['category'][] = ['mains', 'sides', 'drinks', 'desserts'];
const EXAMPLES = ['2 shawarma no garlic and a lemon mint', 'What is vegan here?', 'اتنين كشري وكركديه', 'Remove the fries'];
const SPLIT_EXAMPLES = ['Sara pays the burger and half the fries, Omar the rest', 'Split it 3 ways'];

const SOURCE_LABEL: Record<Source, string> = { 'on-device': 'On-device · Gemini Nano', cloud: 'Cloud · Gemini', rules: 'Offline rules' };

export function App() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [engine, setEngine] = useState<EngineStatus | null>(null);
  const [online, setOnline] = useState(navigator.onLine);
  const [cart, setCart] = useState<Cart>(() => load('cart', []));
  const [msgs, setMsgs] = useState<Msg[]>([{ from: 'waiter', text: 'Welcome to Nile Grill! Tell me what you would like, in English or Arabic. أهلًا بيك، اطلب اللي تحبه.' }]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [mode, setMode] = useState<'whole' | 'split'>('whole');
  const [splitText, setSplitText] = useState('');
  const [plan, setPlan] = useState<SharePlan | null>(null);
  const [splitNote, setSplitNote] = useState('');
  const [paid, setPaid] = useState<Captured[]>(() => load(`paid-${TABLE}`, []));
  const [download, setDownload] = useState<number | null>(null);
  const chatEnd = useRef<HTMLDivElement>(null);

  useEffect(() => { api.config().then(setConfig).catch(() => setConfig(null)); engineStatus().then(setEngine); }, []);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    addEventListener('online', on); addEventListener('offline', off);
    return () => { removeEventListener('online', on); removeEventListener('offline', off); };
  }, []);
  useEffect(() => save('cart', cart), [cart]);
  useEffect(() => save(`paid-${TABLE}`, paid), [paid]);
  useEffect(() => { chatEnd.current?.scrollIntoView({ block: 'nearest' }); }, [msgs, thinking]);

  const t = useMemo(() => totals(cart), [cart]);
  const split = useMemo(() => (plan ? splitBill(cart, plan) : null), [cart, plan]);
  const pairs = useMemo(() => suggestions(cart), [cart]);
  const paidTotal = paid.reduce((s, p) => s + p.total, 0);
  const locked = paid.length > 0; // once someone paid, the order can't change under them

  function act(actions: CartAction[]) {
    if (locked) return;
    setCart((c) => applyActions(c, actions).cart);
    setPlan(null);
  }

  async function send(text = input) {
    const said = text.trim();
    if (!said || thinking) return;
    setInput('');
    setMsgs((m) => [...m, { from: 'guest', text: said }]);
    setThinking(true);
    const started = performance.now();
    const r = await understandOrder(cart, said);
    const ms = Math.round(performance.now() - started);
    if (locked && r.actions.length) {
      setMsgs((m) => [...m, { from: 'waiter', text: 'Part of the bill is already paid, so I can’t change the order now. Please ask the staff.', source: r.source, ms }]);
    } else {
      const { cart: next, skipped } = applyActions(cart, r.actions);
      setCart(next);
      if (r.actions.length) setPlan(null);
      setMsgs((m) => [...m, { from: 'waiter', text: r.reply + (skipped.length ? ` (${skipped.join('; ')})` : ''), source: r.source, ms }]);
    }
    setThinking(false);
  }

  async function doSplit(text = splitText) {
    const said = text.trim();
    if (!said || !cart.length) return;
    setSplitText(said);
    setThinking(true);
    const r = await understandSplit(cart, said);
    setPlan(r.plan.length ? r.plan : null);
    setSplitNote(`${r.reply} · ${SOURCE_LABEL[r.source]}`);
    setThinking(false);
  }

  async function getModel() {
    setDownload(0);
    const ok = await downloadOnDeviceModel((p) => setDownload(p));
    setDownload(null);
    setEngine(await engineStatus());
    if (!ok) alert('Chrome could not download the on-device model. Check chrome://on-device-internals.');
  }

  function newTable() {
    setCart([]); setPaid([]); setPlan(null); setSplitText(''); setSplitNote('');
    setMsgs((m) => m.slice(0, 1));
  }

  const onPaid = (c: Captured) => setPaid((p) => (p.some((x) => x.id === c.id) ? p : [...p, c]));
  const fullyPaid = cart.length > 0 && paidTotal >= t.total;

  return (
    <div className="app">
      <header className="top">
        <div>
          <h1>Nile Grill</h1>
          <p className="muted">Table {TABLE} · Merkevo Waiter</p>
        </div>
        <div className="status">
          <span className={`pill ${online ? 'ok' : 'warn'}`}>{online ? 'Online' : 'Offline'}</span>
          {engine && <span className="pill" title="Which AI answers your requests">{engineLabel(engine)}</span>}
          {engine?.onDevice === 'downloadable' && download === null && <button className="btn small" onClick={getModel}>Get on-device AI</button>}
          {download !== null && <span className="pill">Downloading model {Math.round(download * 100)}%</span>}
          {config?.paypal.mode === 'mock' && <span className="pill warn" title="Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET to use the PayPal sandbox">Payments: demo</span>}
          {config && config.paypal.mode !== 'mock' && <span className="pill ok">PayPal {config.paypal.mode}</span>}
        </div>
      </header>

      <main className="grid">
        <section className="menu" aria-label="Menu">
          {CATEGORIES.map((cat) => (
            <div key={cat}>
              <h2>{cat[0].toUpperCase() + cat.slice(1)}</h2>
              <ul className="cards">
                {MENU.filter((m) => m.category === cat).map((m) => (
                  <li key={m.id} className="card">
                    <div className="row">
                      <strong>{m.name}</strong>
                      <span className="price">${m.price.toFixed(2)}</span>
                    </div>
                    <p className="ar" lang="ar" dir="rtl">{m.nameAr}</p>
                    <p className="muted small">{m.description}</p>
                    <div className="row">
                      <span className="tags">{m.tags.map((tg) => <span key={tg} className="tag">{tg}</span>)}</span>
                      <button className="btn small" disabled={locked} onClick={() => act([{ op: 'add', itemId: m.id }])} aria-label={`Add ${m.name}`}>Add</button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>

        <aside className="side">
          <section className="panel chat" aria-label="Talk to the waiter">
            <h2>Talk to the waiter</h2>
            <div className="msgs" aria-live="polite">
              {msgs.map((m, i) => (
                <div key={i} className={`msg ${m.from}`} dir="auto">
                  <p>{m.text}</p>
                  {m.source && <span className={`src ${m.source}`}>{SOURCE_LABEL[m.source]}{m.ms !== undefined ? ` · ${m.ms} ms` : ''}</span>}
                </div>
              ))}
              {thinking && <div className="msg waiter"><p className="muted">Thinking…</p></div>}
              <div ref={chatEnd} />
            </div>
            <form className="ask" onSubmit={(e) => { e.preventDefault(); send(); }}>
              <input dir="auto" value={input} onChange={(e) => setInput(e.target.value)} placeholder="e.g. two koshari and a karkade" aria-label="Your order" maxLength={500} />
              <button className="btn primary" disabled={thinking || !input.trim()}>Send</button>
            </form>
            <div className="chips">{EXAMPLES.map((x) => <button key={x} className="chip" dir="auto" onClick={() => send(x)} disabled={thinking}>{x}</button>)}</div>
          </section>

          <section className="panel" aria-label="Your order">
            <div className="row"><h2>Your order</h2>{cart.length > 0 && !locked && <button className="btn link" onClick={() => act([{ op: 'clear' }])}>Clear</button>}</div>
            {!cart.length && <p className="muted">Nothing yet. Tap Add or just tell the waiter.</p>}
            <ul className="lines">
              {cart.map((l) => {
                const m = MENU.find((x) => x.id === l.itemId)!;
                return (
                  <li key={l.itemId} className="line">
                    <div>
                      <strong>{m.name}</strong>
                      {l.note && <p className="note" dir="auto">{l.note}</p>}
                    </div>
                    <div className="qty">
                      <button className="btn small" disabled={locked} onClick={() => act([{ op: 'remove', itemId: l.itemId, quantity: 1 }])} aria-label={`One less ${m.name}`}>−</button>
                      <span aria-label="quantity">{l.quantity}</span>
                      <button className="btn small" disabled={locked} onClick={() => act([{ op: 'add', itemId: l.itemId }])} aria-label={`One more ${m.name}`}>+</button>
                      <span className="price">${fmt(Math.round(m.price * 100) * l.quantity)}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
            {pairs.length > 0 && !locked && (
              <p className="pairs">Goes well with: {pairs.map((p) => <button key={p.id} className="chip" onClick={() => act([{ op: 'add', itemId: p.id }])}>+ {p.name}</button>)}</p>
            )}
            {cart.length > 0 && (
              <dl className="totals">
                <dt>Subtotal</dt><dd>${fmt(t.subtotal)}</dd>
                <dt>Service 12%</dt><dd>${fmt(t.service)}</dd>
                <dt>VAT 14%</dt><dd>${fmt(t.tax)}</dd>
                <dt className="grand">Total</dt><dd className="grand">${fmt(t.total)}</dd>
              </dl>
            )}
          </section>

          {cart.length > 0 && config && (
            <section className="panel" aria-label="Pay">
              <div className="tabs" role="tablist">
                <button role="tab" aria-selected={mode === 'whole'} className={mode === 'whole' ? 'on' : ''} onClick={() => setMode('whole')} disabled={locked && mode === 'split'}>Pay the bill</button>
                <button role="tab" aria-selected={mode === 'split'} className={mode === 'split' ? 'on' : ''} onClick={() => setMode('split')} disabled={locked && mode === 'whole'}>Split it</button>
              </div>

              {fullyPaid ? (
                <div className="done">
                  <p><strong>All paid. Thank you!</strong> شكرًا لزيارتكم</p>
                  <ul>{paid.map((p) => <li key={p.id}>{p.payer}: ${fmt(p.total)} <span className="muted small">({p.id})</span></li>)}</ul>
                  <button className="btn" onClick={newTable}>New table</button>
                </div>
              ) : mode === 'whole' ? (
                <PayButton config={config} table={TABLE} cart={cart} amount={t.total} label="Pay the bill" onPaid={onPaid} />
              ) : (
                <div className="split">
                  <form className="ask" onSubmit={(e) => { e.preventDefault(); doSplit(); }}>
                    <input dir="auto" value={splitText} onChange={(e) => setSplitText(e.target.value)} disabled={locked} placeholder="Who pays for what?" aria-label="How to split" maxLength={500} />
                    <button className="btn primary" disabled={thinking || locked || !splitText.trim()}>Split</button>
                  </form>
                  {!locked && <div className="chips">{SPLIT_EXAMPLES.map((x) => <button key={x} className="chip" onClick={() => doSplit(x)} disabled={thinking}>{x}</button>)}</div>}
                  {splitNote && <p className="muted small">{splitNote}</p>}
                  {split?.warnings.map((w) => <p key={w} className="warn-text small">{w}</p>)}
                  {split && plan && (
                    <ul className="shares">
                      {split.shares.map((s, i) => {
                        const done = paid.find((p) => p.payer === s.payer);
                        return (
                          <li key={s.payer} className="share">
                            <div className="row"><strong>{s.payer}</strong><span className="price">${fmt(s.total)}</span></div>
                            <p className="muted small">{s.items.join(', ') || 'Equal share'}</p>
                            {done ? <p className="ok-text">Paid ✓</p> : <PayButton config={config} table={TABLE} cart={cart} amount={s.total} label={`Pay as ${s.payer}`} share={{ plan, payerIndex: i }} onPaid={onPaid} />}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}
            </section>
          )}
        </aside>
      </main>
      <footer className="muted small">Demo restaurant. Payments run in the PayPal sandbox; no real money moves. Open source, MIT.</footer>
    </div>
  );
}

function engineLabel(e: EngineStatus) {
  if (e.engine === 'firebase-hybrid') return e.onDevice === 'available' ? 'AI: on-device first, cloud fallback' : 'AI: cloud (on-device not ready)';
  if (e.engine === 'chrome-built-in') return 'AI: on-device (Chrome)';
  return 'AI: offline rules';
}

function load<T>(k: string, d: T): T {
  try { const v = localStorage.getItem(`mw-${k}`); return v ? (JSON.parse(v) as T) : d; } catch { return d; }
}
function save(k: string, v: unknown) {
  try { localStorage.setItem(`mw-${k}`, JSON.stringify(v)); } catch { /* private mode */ }
}

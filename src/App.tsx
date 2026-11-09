import { useEffect, useMemo, useRef, useState } from 'react';
import { MENU, type MenuItem } from '../shared/menu';
import { applyActions, fmt, suggestions, totals, type Cart, type CartAction } from '../shared/cart';
import { splitBill, type SharePlan } from '../shared/split';
import { api, type AppConfig, type Captured } from './api';
import { downloadOnDeviceModel, status as engineStatus, understandOrder, understandSplit, type EngineStatus, type Source } from './ai/engine';
import { PayButton } from './components/PayButton';
import { DishArt, GlobeIcon, Logo, MicIcon } from './components/Art';
import { LANGS, LANG_NAME_EN, detectLang, itemText, makeT, tagText, type Lang } from './i18n';
import { useSpeech } from './speech';

type Msg = { from: 'guest' | 'waiter'; text: string; source?: Source; ms?: number };

const TABLE = new URLSearchParams(location.search).get('table')?.replace(/[^\w-]/g, '').slice(0, 12) || '12';
const CATEGORIES: MenuItem['category'][] = ['mains', 'sides', 'drinks', 'desserts'];

export function App() {
  const [lang, setLang] = useState<Lang>(detectLang);
  const t = useMemo(() => makeT(lang), [lang]);
  const rtl = LANGS.find((l) => l.code === lang && 'rtl' in l) !== undefined;
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [engine, setEngine] = useState<EngineStatus | null>(null);
  const [online, setOnline] = useState(navigator.onLine);
  const [cart, setCart] = useState<Cart>(() => load('cart', []));
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [mode, setMode] = useState<'whole' | 'split'>('whole');
  const [splitText, setSplitText] = useState('');
  const [plan, setPlan] = useState<SharePlan | null>(null);
  const [splitNote, setSplitNote] = useState('');
  const [paid, setPaid] = useState<Captured[]>(() => load(`paid-${TABLE}`, []));
  const [sent, setSent] = useState<string | null>(null);
  const [download, setDownload] = useState<number | null>(null);
  const [cat, setCat] = useState<MenuItem['category'] | 'all'>('all');
  const [view, setView] = useState<'waiter' | 'menu'>('waiter');
  const [sheet, setSheet] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const chatEnd = useRef<HTMLDivElement>(null);

  const speech = useSpeech(LANGS.find((l) => l.code === lang)!.speech, (text) => send(text));

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = rtl ? 'rtl' : 'ltr';
    try { localStorage.setItem('mw-lang', lang); } catch { /* ignore */ }
  }, [lang, rtl]);
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
  useEffect(() => { document.body.style.overflow = sheet ? 'hidden' : ''; }, [sheet]);

  const tot = useMemo(() => totals(cart), [cart]);
  const split = useMemo(() => (plan ? splitBill(cart, plan, MENU, { nameOf: (id) => itemText(lang, MENU.find((m) => m.id === id)!).name, shared: t('shared') }) : null), [cart, plan, lang, t]);
  const pairs = useMemo(() => suggestions(cart), [cart]);
  const count = cart.reduce((s, l) => s + l.quantity, 0);
  const paidTotal = paid.reduce((s, p) => s + p.total, 0);
  const locked = paid.length > 0;
  const fullyPaid = cart.length > 0 && paidTotal >= tot.total;
  const name = (id: string) => itemText(lang, MENU.find((m) => m.id === id)!).name;
  const srcLabel = (s: Source) => t(s === 'on-device' ? 'srcDevice' : s === 'cloud' ? 'srcCloud' : 'srcRules');

  function act(actions: CartAction[]) {
    if (locked) return;
    setCart((c) => applyActions(c, actions).cart);
    setPlan(null);
    setSent(null);
  }

  function quickAdd(m: MenuItem) {
    act([{ op: 'add', itemId: m.id }]);
    setFlash(m.id);
    setTimeout(() => setFlash((f) => (f === m.id ? null : f)), 900);
  }

  async function send(text = input) {
    const said = text.trim();
    if (!said || thinking) return;
    setInput('');
    setView('waiter');
    setMsgs((m) => [...m, { from: 'guest', text: said }]);
    setThinking(true);
    const started = performance.now();
    const r = await understandOrder(cart, said, LANG_NAME_EN[lang]);
    const ms = Math.round(performance.now() - started);
    if (locked && r.actions.length) {
      setMsgs((m) => [...m, { from: 'waiter', text: t('locked'), source: r.source, ms }]);
    } else {
      const { cart: next, skipped } = applyActions(cart, r.actions);
      setCart(next);
      if (r.actions.length) { setPlan(null); setSent(null); }
      setMsgs((m) => [...m, { from: 'waiter', text: r.reply + (skipped.length ? ` (${skipped.join('; ')})` : ''), source: r.source, ms }]);
    }
    setThinking(false);
  }

  async function doSplit(text = splitText) {
    const said = text.trim();
    if (!said || !cart.length) return;
    setSplitText(said);
    setThinking(true);
    const r = await understandSplit(cart, said, LANG_NAME_EN[lang]);
    setPlan(r.plan.length ? r.plan : null);
    setSplitNote(`${r.reply} · ${srcLabel(r.source)}`);
    setThinking(false);
  }

  async function toKitchen() {
    try {
      const ticket = await api.sendTicket(TABLE, cart, lang);
      setSent(ticket.id);
    } catch (e) {
      alert((e as Error).message);
    }
  }

  async function getModel() {
    setDownload(0);
    const ok = await downloadOnDeviceModel((p) => setDownload(p));
    setDownload(null);
    setEngine(await engineStatus());
    if (!ok) alert('Chrome could not download the on-device model. Check chrome://on-device-internals.');
  }

  function newTable() {
    setCart([]); setPaid([]); setPlan(null); setSplitText(''); setSplitNote(''); setSent(null); setMsgs([]); setSheet(false);
  }

  const onPaid = (c: Captured) => setPaid((p) => (p.some((x) => x.id === c.id) ? p : [...p, c]));
  const aiLabel = !engine ? '' : engine.engine === 'rules' ? t('aiRules')
    : engine.onDevice === 'available' ? t('aiDevice') : engine.engine === 'firebase-hybrid' ? t('aiCloud') : t('aiDevice');

  // ---------- pieces ----------

  const header = (
    <header className="top">
      <div className="brand">
        <Logo />
        <div>
          <h1>Nile Grill</h1>
          <p className="muted small">{t('table', { n: TABLE })}</p>
        </div>
      </div>
      <label className="lang">
        <GlobeIcon />
        <span className="sr">Language</span>
        <select value={lang} onChange={(e) => setLang(e.target.value as Lang)}>
          {LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
        </select>
      </label>
      <div className="status">
        <span className={`pill ${online ? 'ok' : 'warn'}`}><i className="dot" />{online ? t('online') : t('offline')}</span>
        {aiLabel && <span className="pill">{aiLabel}</span>}
        {engine?.onDevice === 'downloadable' && download === null && <button className="pill btnpill" onClick={getModel}>{t('getModel')}</button>}
        {download !== null && <span className="pill">{Math.round(download * 100)}%</span>}
        {config && <span className={`pill ${config.paypal.mode === 'mock' ? 'warn' : 'ok'}`}>{config.paypal.mode === 'mock' ? t('demoPay') : t('sandbox')}</span>}
      </div>
    </header>
  );

  const examples = [t('ex1'), t('ex2'), t('ex3')];
  const chat = (
    <section className="panel chat" aria-label={t('waiter')}>
      <div className="msgs" aria-live="polite">
        <div className="msg waiter"><p>{t('welcome')}</p></div>
        {msgs.map((m, i) => (
          <div key={i} className={`msg ${m.from}`} dir="auto">
            <p>{m.text}</p>
            {m.source && <span className={`src ${m.source}`}>{srcLabel(m.source)}{m.ms !== undefined ? ` · ${m.ms} ms` : ''}</span>}
          </div>
        ))}
        {(thinking || speech.partial) && <div className={`msg ${speech.partial ? 'guest' : 'waiter'} ghost`}><p>{speech.partial || t('thinking')}</p></div>}
        <div ref={chatEnd} />
      </div>
      {msgs.length === 0 && (
        <div className="chips">{examples.map((x) => <button key={x} className="chip" dir="auto" onClick={() => send(x)} disabled={thinking}>{x}</button>)}</div>
      )}
      <form className="ask" onSubmit={(e) => { e.preventDefault(); send(); }}>
        {speech.supported && (
          <button type="button" className={`mic ${speech.listening ? 'on' : ''}`} onClick={speech.toggle} aria-pressed={speech.listening} aria-label={t('speak')} title={t('speak')}>
            <MicIcon on={speech.listening} />
          </button>
        )}
        <input dir="auto" value={input} onChange={(e) => setInput(e.target.value)} placeholder={speech.listening ? t('listening') : t('placeholder')} aria-label={t('placeholder')} maxLength={500} />
        <button className="btn primary" disabled={thinking || !input.trim()}>{t('send')}</button>
      </form>
      {speech.error && <p className="error">{speech.error}</p>}
    </section>
  );

  const menu = (
    <section className="menu" aria-label={t('menu')}>
      <div className="cats" role="tablist">
        <button role="tab" aria-selected={cat === 'all'} className={`chip ${cat === 'all' ? 'on' : ''}`} onClick={() => setCat('all')}>{t('all')}</button>
        {CATEGORIES.map((c) => <button key={c} role="tab" aria-selected={cat === c} className={`chip ${cat === c ? 'on' : ''}`} onClick={() => setCat(c)}>{t(c)}</button>)}
      </div>
      {CATEGORIES.filter((c) => cat === 'all' || cat === c).map((c) => (
        <div key={c}>
          <h2 className="cat-title">{t(c)}</h2>
          <ul className="cards">
            {MENU.filter((m) => m.category === c).map((m) => {
              const tx = itemText(lang, m);
              const inCart = cart.find((l) => l.itemId === m.id)?.quantity;
              return (
                <li key={m.id} className="card">
                  <DishArt category={m.category} />
                  <div className="card-body">
                    <div className="row"><strong>{tx.name}</strong><span className="price">${m.price.toFixed(2)}</span></div>
                    <p className="muted small">{tx.description}</p>
                    <div className="row">
                      <span className="tags">{m.tags.map((tg) => <span key={tg} className={`tag ${tg}`}>{tagText(lang, tg)}</span>)}</span>
                      <button className={`btn small ${flash === m.id ? 'flash' : ''}`} disabled={locked} onClick={() => quickAdd(m)} aria-label={`${t('add')}: ${tx.name}`}>
                        {flash === m.id ? `✓ ${t('added')}` : `+ ${t('add')}`}{inCart ? <span className="qty-badge">{inCart}</span> : null}
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </section>
  );

  const receipt = (
    <div className="receipt">
      <div className="receipt-head"><Logo /><div><strong>Nile Grill</strong><p className="muted small">{t('table', { n: TABLE })} · {new Date().toLocaleString(lang)}</p></div></div>
      <p className="ok-text">✓ {t('allPaid')}</p>
      <ul className="receipt-lines">
        {cart.map((l) => <li key={l.itemId}><span>{l.quantity} × {name(l.itemId)}</span><span>${fmt(Math.round(MENU.find((m) => m.id === l.itemId)!.price * 100) * l.quantity)}</span></li>)}
      </ul>
      <dl className="totals">
        <dt>{t('subtotal')}</dt><dd>${fmt(tot.subtotal)}</dd>
        <dt>{t('service')}</dt><dd>${fmt(tot.service)}</dd>
        <dt>{t('vat')}</dt><dd>${fmt(tot.tax)}</dd>
        <dt className="grand">{t('total')}</dt><dd className="grand">${fmt(tot.total)}</dd>
      </dl>
      <ul className="payers">{paid.map((p) => <li key={p.id}><span>{p.payer === 'Whole table' ? t('payBill') : p.payer}</span><span>${fmt(p.total)} <span className="muted small">PayPal {p.id}</span></span></li>)}</ul>
      <button className="btn block" onClick={newTable}>{t('newTable')}</button>
    </div>
  );

  const orderPanel = (
    <section className="panel order" aria-label={t('order')}>
      <div className="row"><h2>{t('order')}</h2>{cart.length > 0 && !locked && <button className="btn link" onClick={() => act([{ op: 'clear' }])}>{t('clear')}</button>}</div>
      {!cart.length && <p className="muted">{t('empty')}</p>}
      {fullyPaid ? receipt : (
        <>
          <ul className="lines">
            {cart.map((l) => {
              const m = MENU.find((x) => x.id === l.itemId)!;
              return (
                <li key={l.itemId} className="line">
                  <div>
                    <strong>{name(l.itemId)}</strong>
                    {l.note && <p className="note" dir="auto">{l.note}</p>}
                  </div>
                  <div className="qty">
                    <button className="round" disabled={locked} onClick={() => act([{ op: 'remove', itemId: l.itemId, quantity: 1 }])} aria-label={`− ${name(l.itemId)}`}>−</button>
                    <span>{l.quantity}</span>
                    <button className="round" disabled={locked} onClick={() => act([{ op: 'add', itemId: l.itemId }])} aria-label={`+ ${name(l.itemId)}`}>+</button>
                    <span className="price">${fmt(Math.round(m.price * 100) * l.quantity)}</span>
                  </div>
                </li>
              );
            })}
          </ul>
          {pairs.length > 0 && !locked && (
            <div className="pairs"><span className="muted small">{t('goesWell')}</span>{pairs.map((p) => <button key={p.id} className="chip" onClick={() => quickAdd(p)}>+ {itemText(lang, p).name}</button>)}</div>
          )}
          {cart.length > 0 && (
            <>
              <dl className="totals">
                <dt>{t('subtotal')}</dt><dd>${fmt(tot.subtotal)}</dd>
                <dt>{t('service')}</dt><dd>${fmt(tot.service)}</dd>
                <dt>{t('vat')}</dt><dd>${fmt(tot.tax)}</dd>
                <dt className="grand">{t('total')}</dt><dd className="grand">${fmt(tot.total)}</dd>
              </dl>
              <div className="kitchen-send">
                {sent ? <p className="ok-text small">✓ {t('sentKitchen')}</p> : <button className="btn block" onClick={toKitchen}>{t('sendKitchen')}</button>}
                <p className="muted small">{t('kitchenNote')}</p>
              </div>
            </>
          )}
          {cart.length > 0 && config && (
            <div className="paybox">
              <div className="tabs" role="tablist">
                <button role="tab" aria-selected={mode === 'whole'} className={mode === 'whole' ? 'on' : ''} onClick={() => setMode('whole')} disabled={locked && mode === 'split'}>{t('payBill')}</button>
                <button role="tab" aria-selected={mode === 'split'} className={mode === 'split' ? 'on' : ''} onClick={() => setMode('split')} disabled={locked && mode === 'whole'}>{t('splitIt')}</button>
              </div>
              {mode === 'whole' ? (
                <PayButton config={config} table={TABLE} cart={cart} amount={tot.total} label={t('payBill')} onPaid={onPaid} />
              ) : (
                <div className="split">
                  <form className="ask" onSubmit={(e) => { e.preventDefault(); doSplit(); }}>
                    <input dir="auto" value={splitText} onChange={(e) => setSplitText(e.target.value)} disabled={locked} placeholder={t('splitPlaceholder')} aria-label={t('splitPlaceholder')} maxLength={500} />
                    <button className="btn primary" disabled={thinking || locked || !splitText.trim()}>{t('split')}</button>
                  </form>
                  {!locked && <div className="chips">{[t('sx1'), t('sx2')].map((x) => <button key={x} className="chip" dir="auto" onClick={() => doSplit(x)} disabled={thinking}>{x}</button>)}</div>}
                  {splitNote && <p className="muted small">{splitNote}</p>}
                  {split?.warnings.map((w) => <p key={w} className="warn-text small">{/nobody claimed/.test(w) ? t('unclaimed') : w}</p>)}
                  {split && plan && (
                    <ul className="shares">
                      {split.shares.map((s, i) => {
                        const done = paid.find((p) => p.payer === s.payer);
                        return (
                          <li key={s.payer} className={`share ${done ? 'is-paid' : ''}`}>
                            <div className="row"><strong>{s.payer}</strong><span className="price">${fmt(s.total)}</span></div>
                            <p className="muted small">{s.items.join(', ') || t('equalShare')}</p>
                            {done ? <p className="ok-text">✓ {t('paid')}</p> : <PayButton config={config} table={TABLE} cart={cart} amount={s.total} label={t('payAs', { name: s.payer })} share={{ plan, payerIndex: i }} onPaid={onPaid} />}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );

  return (
    <div className="app">
      {header}
      <nav className="switch" role="tablist" aria-label="View">
        <button role="tab" aria-selected={view === 'waiter'} className={view === 'waiter' ? 'on' : ''} onClick={() => setView('waiter')}>{t('waiter')}</button>
        <button role="tab" aria-selected={view === 'menu'} className={view === 'menu' ? 'on' : ''} onClick={() => setView('menu')}>{t('menu')}</button>
      </nav>
      <main className="grid">
        <div className={`col-main ${view}`}>
          <div className="only-waiter">{chat}</div>
          <div className="only-menu">{menu}</div>
        </div>
        <aside className="side">{orderPanel}</aside>
      </main>

      {cart.length > 0 && !sheet && (
        <button className="cartbar" onClick={() => setSheet(true)}>
          <span className="count">{count}</span>
          <span>{t('viewOrder')}</span>
          <strong>${fmt(tot.total)}</strong>
        </button>
      )}
      {sheet && (
        <div className="sheet-wrap" onClick={() => setSheet(false)}>
          <div className="sheet" role="dialog" aria-modal="true" aria-label={t('order')} onClick={(e) => e.stopPropagation()}>
            <div className="grab" />
            <button className="btn link close" onClick={() => setSheet(false)}>{t('close')}</button>
            {orderPanel}
          </div>
        </div>
      )}
      <footer className="muted small">{t('footer')} · Merkevo Waiter · MIT</footer>
    </div>
  );
}

function load<T>(k: string, d: T): T {
  try { const v = localStorage.getItem(`mw-${k}`); return v ? (JSON.parse(v) as T) : d; } catch { return d; }
}
function save(k: string, v: unknown) {
  try { localStorage.setItem(`mw-${k}`, JSON.stringify(v)); } catch { /* private mode */ }
}

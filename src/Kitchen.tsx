// Kitchen screen: every table's order in the staff's language. Item names come from the menu;
// free-text guest notes ("sin cebolla", "extra spicy") are translated by the same hybrid AI.
import { useEffect, useMemo, useRef, useState } from 'react';
import { MENU } from '../shared/menu';
import { api, type Ticket } from './api';
import { translateNotes, type Source } from './ai/engine';
import { LANGS, LANG_NAME_EN, itemText, makeT, type Lang } from './i18n';
import { GlobeIcon, Logo } from './components/Art';

const K: Record<string, Partial<Record<Lang, string>>> = {
  title: { en: 'Kitchen', ar: 'المطبخ', fr: 'Cuisine', es: 'Cocina', de: 'Küche', it: 'Cucina', tr: 'Mutfak' },
  waiting: { en: 'No orders yet. They appear here as soon as a table sends one.', ar: 'مفيش طلبات لسه. أول ما ترابيزة تبعت طلب هيظهر هنا.' },
  done: { en: 'Done', ar: 'جاهز', fr: 'Prêt', es: 'Listo', de: 'Fertig', it: 'Pronto', tr: 'Hazır' },
  guestSaid: { en: 'Guest wrote', ar: 'الزبون كتب' },
  ordered: { en: 'ordered in', ar: 'طلب بلغة' },
  open: { en: 'open orders', ar: 'طلبات مفتوحة', fr: 'commandes en cours', es: 'pedidos abiertos', de: 'offene Bestellungen', it: 'ordini aperti', tr: 'açık sipariş' },
};

type Translated = Record<string, { texts: string[]; source: Source }>;

export function Kitchen() {
  const [lang, setLang] = useState<Lang>(() => (localStorage.getItem('mw-kitchen-lang') as Lang) || 'ar');
  const t = useMemo(() => makeT(lang), [lang]);
  const k = (key: string) => K[key][lang] ?? K[key].en!;
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [tr, setTr] = useState<Translated>({});
  const asked = useRef(new Set<string>());

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    try { localStorage.setItem('mw-kitchen-lang', lang); } catch { /* ignore */ }
  }, [lang]);

  useEffect(() => {
    let alive = true;
    const tick = () => api.kitchen().then((x) => alive && setTickets(x)).catch(() => {});
    tick();
    const id = setInterval(tick, 3000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  // Translate each ticket's notes once per staff language.
  useEffect(() => {
    for (const tk of tickets) {
      const notes = tk.lines.map((l) => l.note || '');
      const key = `${tk.id}:${lang}`;
      if (!notes.some(Boolean) || asked.current.has(key)) continue;
      asked.current.add(key);
      translateNotes(notes.map((n) => n || '-'), LANG_NAME_EN[lang]).then((r) => setTr((p) => ({ ...p, [key]: r })));
    }
  }, [tickets, lang]);

  const open = tickets.filter((x) => !x.done);
  return (
    <div className="app kitchen">
      <header className="top">
        <div className="brand"><Logo /><div><h1>Nile Grill · {k('title')}</h1><p className="muted small">{open.length} {k('open')}</p></div></div>
        <label className="lang">
          <GlobeIcon />
          <select value={lang} onChange={(e) => setLang(e.target.value as Lang)}>
            {LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
        </label>
      </header>
      {!open.length && <p className="muted">{k('waiting')}</p>}
      <ul className="tickets">
        {open.map((tk) => {
          const tt = tr[`${tk.id}:${lang}`];
          return (
            <li key={tk.id} className="ticket">
              <div className="row">
                <strong className="t-table">{t('table', { n: tk.table })}</strong>
                <span className="muted small">{new Date(tk.at).toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <p className="muted small">{k('ordered')} {LANGS.find((l) => l.code === tk.guestLang)?.label ?? tk.guestLang}</p>
              <ul className="t-lines">
                {tk.lines.map((l, i) => {
                  const m = MENU.find((x) => x.id === l.itemId)!;
                  const translated = tt?.texts[i];
                  return (
                    <li key={l.itemId}>
                      <span className="t-qty">{l.quantity}×</span>
                      <div>
                        <strong>{itemText(lang, m).name}</strong>
                        {l.note && (
                          <p className="note" dir="auto">
                            {translated && translated !== l.note ? translated : l.note}
                            {translated && translated !== l.note && <span className="muted small orig" dir="auto"> · {k('guestSaid')}: {l.note}</span>}
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
              <button className="btn primary block" onClick={() => api.ticketDone(tk.id).then(() => setTickets((p) => p.map((x) => (x.id === tk.id ? { ...x, done: true } : x))))}>{k('done')}</button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

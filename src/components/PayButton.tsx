import { useEffect, useRef, useState } from 'react';
import { api, type AppConfig, type Captured } from '../api';
import { fmt, type Cart } from '../../shared/cart';
import type { SharePlan } from '../../shared/split';

type Props = {
  config: AppConfig;
  table: string;
  cart: Cart;
  amount: number;
  label: string;
  share?: { plan: SharePlan; payerIndex: number };
  onPaid: (c: Captured) => void;
};

type PayPalNs = { Buttons: (o: object) => { render: (el: HTMLElement) => Promise<void>; close?: () => void; isEligible: () => boolean } };
let sdk: Promise<PayPalNs> | null = null;

function loadSdk(clientId: string, currency: string): Promise<PayPalNs> {
  if (sdk) return sdk;
  sdk = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=${currency}&intent=capture&components=buttons`;
    s.onload = () => resolve((window as unknown as { paypal: PayPalNs }).paypal);
    s.onerror = () => { sdk = null; reject(new Error('Could not load PayPal')); };
    document.head.appendChild(s);
  });
  return sdk;
}

export function PayButton({ config, table, cart, amount, label, share, onPaid }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  // Keep the latest inputs for PayPal callbacks without re-rendering the buttons on every change.
  const latest = useRef({ cart, share, onPaid });
  latest.current = { cart, share, onPaid };

  const mock = config.paypal.mode === 'mock';

  useEffect(() => {
    if (mock || !box.current || amount <= 0) return;
    let buttons: ReturnType<PayPalNs['Buttons']> | null = null;
    let cancelled = false;
    const clientId = (config.paypal as { clientId: string }).clientId;
    loadSdk(clientId, config.restaurant.currency).then((paypal) => {
      if (cancelled || !box.current) return;
      box.current.innerHTML = '';
      buttons = paypal.Buttons({
        style: { layout: 'horizontal', height: 40, tagline: false, label: 'pay' },
        createOrder: async () => (await api.createOrder(table, latest.current.cart, latest.current.share)).id,
        onApprove: async (data: { orderID: string }) => {
          const c = await api.capture(data.orderID);
          if (c.status === 'COMPLETED') latest.current.onPaid(c);
          else setError(`Payment status: ${c.status}`);
        },
        onError: (e: Error) => setError(e?.message || 'PayPal error'),
      });
      buttons.render(box.current).catch((e: Error) => setError(e.message));
    }).catch((e: Error) => setError(e.message));
    return () => { cancelled = true; buttons?.close?.(); };
  }, [mock, amount, table, config]);

  async function payMock() {
    setBusy(true);
    setError('');
    try {
      const o = await api.createOrder(table, cart, share);
      const c = await api.capture(o.id);
      onPaid(c);
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  }

  if (amount <= 0) return null;
  return (
    <div className="pay">
      {mock ? (
        <button className="btn primary" onClick={payMock} disabled={busy} aria-label={`${label}: pay ${fmt(amount)} dollars in demo mode`}>
          {busy ? 'Paying…' : `${label} · $${fmt(amount)}`}<span className="tag">demo</span>
        </button>
      ) : (
        <div ref={box} className="pp-box" aria-label={`${label}: pay ${fmt(amount)} dollars with PayPal`} />
      )}
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  );
}

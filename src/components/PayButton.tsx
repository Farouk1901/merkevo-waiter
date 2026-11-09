import { useEffect, useRef, useState } from 'react';
import { api, ApiError, type AppConfig, type Captured } from '../api';
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

const COPY: Record<string, Record<string, string>> = {
  confirming: { en: 'Confirming the payment with PayPal…', ar: 'بنأكد الدفع مع PayPal…' },
  again: { en: 'Confirm payment again', ar: 'أكّد الدفع تاني' },
  cancelled: { en: 'Payment cancelled. You can try again.', ar: 'اتلغى الدفع. تقدر تحاول تاني.' },
  paying: { en: 'Paying…', ar: 'جاري الدفع…' },
};

export function PayButton({ config, table, cart, amount, label, share, onPaid }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  /** An order the guest approved in PayPal that we could not confirm yet (network drop). */
  const [pending, setPending] = useState<string | null>(null);
  const latest = useRef({ cart, share, onPaid });
  latest.current = { cart, share, onPaid };
  const lang = document.documentElement.lang === 'ar' ? 'ar' : 'en';
  const c = (k: string) => COPY[k][lang];

  /**
   * Capture an approved order. Retries quietly twice on network trouble; if it still fails, keeps the
   * order id so the guest can confirm again. Capture is idempotent, so this can never charge twice.
   */
  async function confirm(orderId: string) {
    setError('');
    setBusy(true);
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const r = await api.capture(orderId);
        setPending(null);
        if (r.status === 'COMPLETED') latest.current.onPaid(r);
        else setError(`Payment status: ${r.status}`);
        break;
      } catch (e) {
        const retryable = e instanceof ApiError && e.retryable;
        if (retryable && attempt < 3) { await new Promise((res) => setTimeout(res, 1500 * attempt)); continue; }
        if (retryable) setPending(orderId);
        setError((e as Error).message);
      }
    }
    setBusy(false);
  }
  const confirmRef = useRef(confirm);
  confirmRef.current = confirm;

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
        style: { layout: 'horizontal', height: 44, tagline: false, label: 'pay', shape: 'pill' },
        createOrder: async () => (await api.createOrder(table, latest.current.cart, latest.current.share)).id,
        onApprove: (data: { orderID: string }) => confirmRef.current(data.orderID),
        onCancel: () => setError(c('cancelled')),
        onError: (e: Error) => setError(e?.message || 'PayPal error'),
      });
      buttons.render(box.current).catch((e: Error) => setError(e.message));
    }).catch((e: Error) => setError(e.message));
    return () => { cancelled = true; buttons?.close?.(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mock, amount, table, config]);

  async function payMock() {
    setBusy(true);
    setError('');
    try {
      const o = await api.createOrder(table, cart, share);
      onPaid(await api.capture(o.id));
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  }

  if (amount <= 0) return null;
  return (
    <div className="pay">
      {mock ? (
        <button className="btn primary block" onClick={payMock} disabled={busy}>
          {busy ? c('paying') : `${label} · $${fmt(amount)}`}<span className="badge">demo</span>
        </button>
      ) : (
        <div ref={box} className="pp-box" hidden={!!pending} aria-label={`${label}: $${fmt(amount)} PayPal`} />
      )}
      {busy && !mock && <p className="muted small" role="status">{c('confirming')}</p>}
      {error && <p className="error" role="alert">{error}</p>}
      {pending && !busy && <button className="btn primary block" onClick={() => confirm(pending)}>{c('again')}</button>}
    </div>
  );
}

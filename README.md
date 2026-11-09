# Merkevo Waiter

**An AI waiter for restaurant tables. Order by talking, in English or Arabic. Split the bill in plain words. Everyone pays their own share with PayPal.**

The AI runs **on the guest's device first** (Gemini Nano in Chrome) and falls back to **Gemini in the cloud** through Firebase AI Logic hybrid inference. If neither is available, a rule-based parser keeps the table working.

## Why
- Busy restaurants lose orders and time at two moments: **taking the order** and **settling the bill**. "Who had the burger?" at the end of a group dinner takes minutes and a calculator.
- Restaurant Wi-Fi drops. A waiter that needs the cloud for every sentence stops when the network does. On-device AI keeps taking orders.

## What it does
| | |
|---|---|
| **Talk to order** | "2 shawarma no garlic and a lemon mint" or «اتنين كشري وكركديه» becomes cart actions (add, remove, notes). Questions such as "what is vegan?" get answers, not cart changes. |
| **Suggestions** | "Goes well with…" pairings from the menu. |
| **Split in plain words** | "Sara pays 2 shawarma and half the karkade, Omar pays 1 koshari, Mona the rest", or "split it 3 ways". Service and VAT follow each share, and the cents always add up to the table total. |
| **Everyone pays their share** | Each person gets their own PayPal button. The table ledger shows who has paid; the order locks after the first payment. |
| **Shows where the AI ran** | Every reply is tagged *On-device · Gemini Nano*, *Cloud · Gemini* or *Offline rules*, with the response time. |

## How it works
```
Guest words ─▶ Firebase AI Logic (PREFER_ON_DEVICE)
                 ├─ Gemini Nano in Chrome  (JSON schema output)   ← works offline
                 └─ Gemini in the cloud    (responseSchema)        ← when the device can't
               └─ no model at all ─▶ rule-based parser (EN + AR)
             ─▶ validation (menu ids only, quantities capped) ─▶ cart / split plan

Pay ─▶ server recomputes every amount from its own menu ─▶ PayPal Orders v2 (create → approve → capture)
```
- **Prices never come from the browser.** The server rebuilds each order from the menu, and builds a PayPal order with `item_total`, `handling` (service) and `tax_total` that match exactly.
- **Idempotent:** every create and capture sends a `PayPal-Request-Id`, so retries don't double-charge.
- **Guest text is data:** the model can only return actions on real menu ids. Everything it returns is validated before it touches the cart.

## Run it
```bash
npm install
cp .env.example .env     # optional: add PayPal sandbox and Firebase keys
npm run dev              # web on http://localhost:5173, API on :8787
npm test                 # unit + API tests
```
With no keys, it runs in **demo mode**: payments are simulated and the AI uses Chrome's built-in model or the rule-based parser.

### Turn on the real pieces
1. **PayPal sandbox:** create an app at developer.paypal.com → *Apps & Credentials* → *Sandbox*. Put `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` in `.env`. Pay with a sandbox personal account.
2. **Firebase AI Logic:** create a Firebase project, add a web app, enable **Firebase AI Logic** with the *Gemini Developer API*, and copy the config into the `VITE_FIREBASE_*` variables.
3. **On-device model:** Chrome 139+ on desktop. Turn on `chrome://flags/#prompt-api-for-gemini-nano-multimodal-input`, then click **Get on-device AI** in the app header. Check the status at `chrome://on-device-internals`.

### Production
```bash
npm run build && npm start   # one Node server serves the app and the API (PORT, default 8787)
```

## Project layout
| Path | What |
|---|---|
| `shared/` | Menu, cart maths, bill splitting and the rule-based parser. Pure TypeScript, shared by the browser and the server. |
| `src/ai/engine.ts` | Hybrid inference (Firebase AI Logic), the Chrome built-in fallback, prompts, schemas and validation. |
| `src/` | React UI. |
| `server/` | Express API and a small PayPal Orders v2 client. |
| `test/` | Node test runner: cart, split, parser, PayPal body and API flow. |

Part of the Merkevo restaurant platform. This waiter is a standalone, open-source module. License: MIT.

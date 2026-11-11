// Owner dashboard: every PayPal order from the tables in one AG Grid. Ask a question in plain words
// ("unpaid orders today", "طلبات ترابيزة 12") and the hybrid AI turns it into normal grid filters
// you can see and change. Paid orders can be refunded through PayPal from the row.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import {
  AllCommunityModule, ModuleRegistry, themeQuartz,
  type ColDef, type FilterModel, type GridApi, type GridReadyEvent, type ICellRendererParams, type RowClassParams,
} from 'ag-grid-community';
import { api, ApiError } from './api';
import { askSales, type Source } from './ai/engine';
import { describeQuery, summarize, toGridFilter, type PaymentRow, type SalesQuery } from '../shared/sales';
import { useSpeech } from './speech';
import { Logo, MicIcon } from './components/Art';

ModuleRegistry.registerModules([AllCommunityModule]);

// The grid takes the app's own colours, so it follows light and dark mode with the rest of the page.
const theme = themeQuartz.withParams({
  accentColor: 'var(--brand)',
  backgroundColor: 'var(--surface)',
  foregroundColor: 'var(--text)',
  borderColor: 'var(--line)',
  headerBackgroundColor: 'var(--surface-2)',
  chromeBackgroundColor: 'var(--surface-2)',
  oddRowBackgroundColor: 'var(--surface)',
  fontFamily: 'inherit',
  fontSize: 14,
  headerFontWeight: 600,
  wrapperBorderRadius: 14,
  browserColorScheme: 'inherit',
});

const usd = (cents: number) => `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const money = (field: 'subtotal' | 'service' | 'tax' | 'total') => ({
  valueGetter: (p: { data?: PaymentRow }) => (p.data ? p.data[field] / 100 : null),
  valueFormatter: (p: { value: number | null }) => (p.value == null ? '' : usd(Math.round(p.value * 100))),
  filter: 'agNumberColumnFilter',
  type: 'rightAligned',
});

const STATUS_LABEL: Record<PaymentRow['status'], string> = { COMPLETED: 'Paid', CREATED: 'Not paid', REFUNDED: 'Refunded' };
const SOURCE_LABEL: Record<PaymentRow['source'], string> = { 'paypal-sandbox': 'PayPal sandbox', 'paypal-live': 'PayPal', mock: 'Mock', sample: 'Sample' };
const EXAMPLES = ['Unpaid orders today', 'Refunds this week', 'Biggest orders over $40', 'طلبات ترابيزة 7 المدفوعة'];

function StatusCell(p: ICellRendererParams<PaymentRow>) {
  if (!p.data || p.node.rowPinned) return null;
  return <span className={`pill ${p.data.status.toLowerCase()}`}>{STATUS_LABEL[p.data.status]}</span>;
}

function SourceCell(p: ICellRendererParams<PaymentRow>) {
  if (!p.data || p.node.rowPinned) return null;
  return <span className={`pill src-${p.data.source}`}>{SOURCE_LABEL[p.data.source]}</span>;
}

export function Owner() {
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [shown, setShown] = useState<PaymentRow[]>([]);
  const [error, setError] = useState('');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<{ reply: string; source: Source; ms: number } | null>(null);
  const [thinking, setThinking] = useState(false);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const gridApi = useRef<GridApi<PaymentRow> | null>(null);
  const known = useRef(new Set<string>());

  useEffect(() => {
    document.title = 'Nile Grill · Owner · Merkevo Waiter';
    document.documentElement.lang = 'en';
    document.documentElement.dir = 'ltr';
  }, []);

  // Live: a guest paying at a table shows up here within a few seconds, and the row flashes.
  useEffect(() => {
    let alive = true;
    const tick = () => api.ownerPayments().then((r) => { if (alive) { setRows(r); setError(''); } }).catch((e) => alive && setError((e as Error).message));
    tick();
    const id = setInterval(tick, 5000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  useEffect(() => {
    const a = gridApi.current;
    const fresh = rows.filter((r) => !known.current.has(r.orderId));
    const firstLoad = known.current.size === 0;
    for (const r of rows) known.current.add(r.orderId);
    if (!a || firstLoad || !fresh.length) return;
    setTimeout(() => {
      const nodes = fresh.map((r) => a.getRowNode(r.orderId)).filter((n): n is NonNullable<typeof n> => !!n);
      if (nodes.length) a.flashCells({ rowNodes: nodes });
    }, 50);
  }, [rows]);

  const refreshShown = useCallback(() => {
    const a = gridApi.current;
    if (!a) return;
    const out: PaymentRow[] = [];
    a.forEachNodeAfterFilterAndSort((n) => { if (n.data) out.push(n.data); });
    setShown(out);
  }, []);

  // Two clicks to refund: the first turns the button into "Confirm $x", which expires after a few seconds.
  const [confirming, setConfirming] = useState<string | null>(null);
  useEffect(() => {
    if (!confirming) return;
    const id = setTimeout(() => setConfirming(null), 5000);
    return () => clearTimeout(id);
  }, [confirming]);

  const refund = useCallback(async (r: PaymentRow) => {
    if (confirming !== r.orderId) { setConfirming(r.orderId); return; }
    setConfirming(null);
    setBusy(r.orderId);
    setError('');
    try {
      const updated = await api.refund(r.orderId);
      setRows((p) => p.map((x) => (x.orderId === updated.orderId ? updated : x)));
      setNotice(`Refunded ${usd(updated.total)} to ${updated.payer} at table ${updated.table}` + (updated.source.startsWith('paypal') ? ` through PayPal (refund ${updated.refundId}).` : ' (sample order, nothing sent to PayPal).'));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'The refund failed. Nothing was changed.');
    }
    setBusy(null);
  }, [confirming]);

  const columns = useMemo<ColDef<PaymentRow>[]>(() => [
    {
      colId: 'at', headerName: 'Time', minWidth: 150, initialSort: 'desc',
      valueGetter: (p) => (p.data ? new Date(p.data.at) : null),
      valueFormatter: (p) => (p.value ? (p.value as Date).toLocaleString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''),
      filter: 'agDateColumnFilter',
      filterParams: { comparator: (filter: Date, cell: Date | null) => (!cell ? -1 : cell.getTime() < filter.getTime() ? -1 : cell.getTime() > filter.getTime() ? 1 : 0) },
    },
    { field: 'table', headerName: 'Table', width: 92, filter: 'agTextColumnFilter' },
    { field: 'payer', headerName: 'Paid by', minWidth: 120, filter: 'agTextColumnFilter' },
    { field: 'items', headerName: 'Items', flex: 2, minWidth: 200, tooltipField: 'items', filter: 'agTextColumnFilter' },
    { colId: 'total', headerName: 'Total', width: 110, ...money('total'), cellClass: 'strong' },
    { field: 'status', headerName: 'Status', width: 120, cellRenderer: StatusCell, filter: 'agTextColumnFilter' },
    { field: 'source', headerName: 'Source', width: 140, cellRenderer: SourceCell, filter: 'agTextColumnFilter' },
    { colId: 'subtotal', headerName: 'Food', width: 100, ...money('subtotal') },
    { colId: 'service', headerName: 'Service', width: 100, ...money('service') },
    { colId: 'tax', headerName: 'Tax', width: 90, ...money('tax') },
    { field: 'orderId', headerName: 'PayPal order', minWidth: 170, cellClass: 'mono' },
    {
      colId: 'action', headerName: '', width: 140, sortable: false, filter: false, pinned: 'right',
      cellRenderer: (p: ICellRendererParams<PaymentRow>) => {
        const r = p.data;
        if (!r || p.node.rowPinned) return null;
        if (r.status === 'REFUNDED') return <span className="muted small" title={r.refundId}>Refunded</span>;
        if (r.status !== 'COMPLETED') return null;
        const asking = confirming === r.orderId;
        return (
          <button className={`btn small ${asking ? 'primary' : ''}`} disabled={busy !== null} onClick={() => refund(r)}
            aria-label={asking ? `Confirm refund of ${usd(r.total)} to ${r.payer}` : `Refund ${r.payer}, table ${r.table}`}>
            {busy === r.orderId ? 'Refunding…' : asking ? `Confirm ${usd(r.total)}` : 'Refund'}
          </button>
        );
      },
    },
  ], [busy, confirming, refund]);

  const summary = useMemo(() => summarize(shown), [shown]);
  const pinned = useMemo(() => {
    const sum = (k: 'subtotal' | 'service' | 'tax' | 'total') => shown.filter((r) => r.status === 'COMPLETED').reduce((s, r) => s + r[k], 0);
    return [{ orderId: 'pinned-total', payer: `Paid · ${summary.paidCount}`, items: `${shown.length} orders shown`, subtotal: sum('subtotal'), service: sum('service'), tax: sum('tax'), total: sum('total') } as PaymentRow];
  }, [shown, summary.paidCount]);

  function apply(q: SalesQuery) {
    const a = gridApi.current;
    if (!a) return;
    a.setFilterModel(toGridFilter(q) as FilterModel);
    setSearch(q.text ?? '');
    const sortCol = q.sort === 'total_desc' || q.sort === 'total_asc' ? 'total' : 'at';
    const dir = q.sort === 'total_asc' || q.sort === 'oldest' ? 'asc' : 'desc';
    a.applyColumnState({ state: [{ colId: sortCol, sort: dir }], defaultState: { sort: null } });
  }

  async function ask(text: string) {
    const said = text.trim();
    if (!said || thinking) return;
    setQuestion(said);
    setThinking(true);
    const t0 = performance.now();
    const res = await askSales(said);
    apply(res.query);
    setAnswer({ reply: res.source === 'rules' ? describeQuery(res.query) : res.reply, source: res.source, ms: Math.round(performance.now() - t0) });
    setThinking(false);
  }

  function reset() {
    apply({});
    setAnswer(null);
    setQuestion('');
  }

  const speech = useSpeech('en-US', (t) => ask(t));
  const srcLabel = { 'on-device': 'Answered on this device', cloud: 'Answered in the cloud', rules: 'Answered by offline rules' };

  return (
    <div className="app owner">
      <header className="top">
        <div className="brand"><Logo /><div><h1>Nile Grill · Owner</h1><p className="muted small">PayPal orders from every table, live</p></div></div>
        <nav className="owner-nav"><a className="btn small" href="/">Guest view</a><a className="btn small" href="/kitchen">Kitchen</a></nav>
      </header>

      <section className="kpis" aria-label="Summary of the orders shown">
        <div className="kpi"><span className="muted small">Collected</span><strong>{usd(summary.collected)}</strong><span className="muted small">{summary.paidCount} paid</span></div>
        <div className="kpi"><span className="muted small">Average ticket</span><strong>{usd(summary.avgTicket)}</strong><span className="muted small">paid orders</span></div>
        <div className="kpi"><span className="muted small">Not paid yet</span><strong>{usd(summary.open)}</strong><span className="muted small">started, not captured</span></div>
        <div className="kpi"><span className="muted small">Refunded</span><strong>{usd(summary.refunded)}</strong><span className="muted small">back to guests</span></div>
      </section>

      <form className="ask" onSubmit={(e) => { e.preventDefault(); ask(question); }}>
        <label htmlFor="ask" className="small muted">Ask about your sales, in any language</label>
        <div className="ask-row">
          <input id="ask" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="e.g. unpaid orders at table 12 today" dir="auto" />
          {speech.supported && (
            <button type="button" className={`mic ${speech.listening ? 'on' : ''}`} onClick={speech.toggle} aria-label={speech.listening ? 'Stop listening' : 'Ask by voice'}><MicIcon on={speech.listening} /></button>
          )}
          <button className="btn primary" disabled={thinking || !question.trim()}>{thinking ? 'Thinking…' : 'Ask'}</button>
        </div>
        <div className="chips">
          {EXAMPLES.map((x) => <button type="button" key={x} className="chip" dir="auto" onClick={() => ask(x)}>{x}</button>)}
        </div>
        {answer && (
          <p className="answer" dir="auto">
            {answer.reply} <span className={`src ${answer.source}`}>{srcLabel[answer.source]} · {answer.ms} ms</span>
            <button type="button" className="btn link" onClick={reset}>Show all</button>
          </p>
        )}
      </form>

      <div className="grid-tools">
        <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search guest, dish, order id" aria-label="Search the orders" />
        <button className="btn small" onClick={() => gridApi.current?.exportDataAsCsv({ fileName: 'nile-grill-paypal-orders.csv', columnKeys: ['at', 'table', 'payer', 'items', 'total', 'status', 'source', 'subtotal', 'service', 'tax', 'orderId'] })}>Export CSV</button>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      {notice && <p className="notice" role="status">{notice}</p>}

      <div className="grid-wrap">
        <AgGridReact<PaymentRow>
          theme={theme}
          rowData={rows}
          columnDefs={columns}
          defaultColDef={{ sortable: true, resizable: true, filter: true, floatingFilter: false, suppressHeaderMenuButton: false }}
          getRowId={(p) => p.data.orderId}
          quickFilterText={search}
          pinnedBottomRowData={pinned}
          pagination
          paginationPageSize={20}
          paginationPageSizeSelector={[20, 50, 100]}
          tooltipShowDelay={300}
          enableCellTextSelection
          getRowClass={(p: RowClassParams<PaymentRow>) => (p.node.rowPinned ? 'total-row' : p.data?.source === 'sample' ? 'sample-row' : undefined)}
          onGridReady={(e: GridReadyEvent<PaymentRow>) => { gridApi.current = e.api; if (import.meta.env.DEV) (window as unknown as { grid: unknown }).grid = e.api; refreshShown(); }}
          onModelUpdated={refreshShown}
          localeText={{ noRowsToShow: 'No orders match. Try “Show all”.' }}
        />
      </div>
      <p className="muted small">Sample rows are a made-up week so the dashboard is never empty; rows marked PayPal sandbox are real sandbox payments from the guest view. Refunds on sandbox rows go through PayPal’s Payments API.</p>
    </div>
  );
}

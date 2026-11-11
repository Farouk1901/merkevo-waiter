import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { Kitchen } from './Kitchen';
import './styles.css';

// The owner dashboard (AG Grid) loads only on /owner, so guests at the table never download it.
const Owner = lazy(() => import('./Owner').then((m) => ({ default: m.Owner })));

const page = location.pathname.replace(/\/+$/, '');
const view = page === '/kitchen' ? <Kitchen /> : page === '/owner' ? <Suspense fallback={null}><Owner /></Suspense> : <App />;
createRoot(document.getElementById('root')!).render(<StrictMode>{view}</StrictMode>);

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { Kitchen } from './Kitchen';
import './styles.css';

const isKitchen = location.pathname.replace(/\/+$/, '') === '/kitchen';
createRoot(document.getElementById('root')!).render(<StrictMode>{isKitchen ? <Kitchen /> : <App />}</StrictMode>);

// Small hand-made illustrations, one per category, so the menu has a face without stock photos.
import type { MenuItem } from '../../shared/menu';

export function DishArt({ category }: { category: MenuItem['category'] }) {
  const common = { width: 44, height: 44, viewBox: '0 0 44 44', 'aria-hidden': true } as const;
  if (category === 'mains') {
    return (
      <svg {...common}>
        <circle cx="22" cy="22" r="20" fill="var(--art-1)" />
        <ellipse cx="22" cy="26" rx="14" ry="5" fill="var(--art-plate)" />
        <path d="M11 24c2-8 20-8 22 0" fill="var(--art-2)" />
        <circle cx="17" cy="20" r="1.6" fill="var(--art-3)" /><circle cx="24" cy="18.5" r="1.6" fill="var(--art-3)" /><circle cx="28" cy="21" r="1.4" fill="var(--art-3)" />
      </svg>
    );
  }
  if (category === 'sides') {
    return (
      <svg {...common}>
        <circle cx="22" cy="22" r="20" fill="var(--art-1)" />
        <path d="M14 18h16l-2.5 14h-11z" fill="var(--art-2)" />
        <path d="M16 18l-1-7M20 18l.5-8M24 18l1-8M28 18l2-6" stroke="var(--art-3)" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    );
  }
  if (category === 'drinks') {
    return (
      <svg {...common}>
        <circle cx="22" cy="22" r="20" fill="var(--art-1)" />
        <path d="M15 13h14l-2 19h-10z" fill="var(--art-plate)" />
        <path d="M15.8 20h12.4l-1.3 12h-9.8z" fill="var(--art-2)" />
        <path d="M25 13l3-5" stroke="var(--art-3)" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="22" cy="22" r="20" fill="var(--art-1)" />
      <path d="M12 27h20v3H12z" fill="var(--art-plate)" />
      <path d="M14 27c0-6 3.5-10 8-10s8 4 8 10z" fill="var(--art-2)" />
      <circle cx="22" cy="15" r="2.2" fill="var(--art-3)" />
    </svg>
  );
}

export function Logo() {
  return (
    <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true">
      <rect width="34" height="34" rx="9" fill="var(--brand)" />
      <path d="M8 23h18M10 23c0-5 3-8.5 7-8.5s7 3.5 7 8.5M17 11v3.5" stroke="var(--on-brand)" strokeWidth="2.2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function MicIcon({ on }: { on?: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" fill={on ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function GlobeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

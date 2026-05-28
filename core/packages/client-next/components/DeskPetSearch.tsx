'use client';

// Desk-pet search overlay — reuses the homepage LandingSearch in a centered
// modal. Lazy-loaded by DeskPet so the site-search data layer only loads when
// the user actually opens search (not on every page).

import { useEffect, useLayoutEffect, useRef } from 'react';
import LandingSearch from '@/components/LandingSearch';
import { SEARCH_CARDS } from '@/lib/landing-sections';

const CSS = `
.deskpet-search-backdrop{position:fixed;inset:0;z-index:60;display:flex;
  align-items:flex-end;justify-content:center;padding:16px 16px max(12vh,48px);
  background:color-mix(in srgb, var(--foreground) 38%, transparent);
  backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px);}
.deskpet-search-box{width:min(640px,94vw);will-change:transform,opacity;}
/* Box is anchored to the bottom of the screen, so the results open upward. */
.deskpet-search-box .landing-search-panel{top:auto;bottom:calc(100% + 0.5rem);}
`;

export default function DeskPetSearch({
  lang,
  origin,
  onClose,
}: {
  lang: 'zh' | 'en';
  origin?: { x: number; y: number } | null;
  onClose: () => void;
}) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  // Entrance: the box grows from the pet's position out to its centered spot.
  useLayoutEffect(() => {
    const box = boxRef.current, backdrop = backdropRef.current;
    if (!box) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;

    backdrop?.animate([{ opacity: 0 }, { opacity: 1 }],
      { duration: 200, easing: 'ease-out', fill: 'both' });

    const r = box.getBoundingClientRect();
    const from = origin ?? { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    const dx = from.x - (r.left + r.width / 2);
    const dy = from.y - (r.top + r.height / 2);
    box.animate([
      { transform: `translate(${dx}px, ${dy}px) scale(.35)`, opacity: 0 },
      { transform: 'translate(0, 0) scale(1)', opacity: 1 },
    ], { duration: 260, easing: 'cubic-bezier(.2,.8,.25,1)', fill: 'both' });
  }, [origin]);

  useEffect(() => {
    boxRef.current?.querySelector<HTMLInputElement>('input[type="text"]')?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="deskpet-search-backdrop"
      ref={backdropRef}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <style>{CSS}</style>
      <div className="deskpet-search-box" ref={boxRef}>
        <LandingSearch cards={SEARCH_CARDS} lang={lang} />
      </div>
    </div>
  );
}

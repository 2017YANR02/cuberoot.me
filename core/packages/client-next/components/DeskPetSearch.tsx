'use client';

// Desk-pet search overlay — reuses the homepage LandingSearch in a centered
// modal, with the pet controls (character / size / lang / theme / rest / reset /
// hide) as a horizontal toolbar below the search box. Lazy-loaded by DeskPet so
// the site-search data layer only loads when the user actually opens search.

import { useEffect, useLayoutEffect, useRef } from 'react';
import { Maximize2, Moon, Crosshair, EyeOff } from 'lucide-react';
import LandingSearch from '@/components/LandingSearch';
import HeaderToggles from '@/components/HeaderToggles';
import { SEARCH_CARDS } from '@/lib/landing-sections';

const CSS = `
.deskpet-search-backdrop{position:fixed;inset:0;z-index:60;display:flex;
  align-items:flex-end;justify-content:center;padding:16px 16px max(12vh,48px);
  background:color-mix(in srgb, var(--foreground) 38%, transparent);
  backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px);}
.deskpet-search-box{width:min(640px,94vw);will-change:transform,opacity;}
/* Box is anchored to the bottom of the screen, so the results open upward. */
.deskpet-search-box .landing-search-panel{top:auto;bottom:calc(100% + 0.5rem);}

.deskpet-toolbar{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;
  gap:8px;margin-top:8px;}
.deskpet-toolbar button{display:flex;align-items:center;gap:6px;border:0;cursor:pointer;
  padding:8px 12px;border-radius:10px;
  font:13px/1 ui-sans-serif,system-ui,sans-serif;
  background:color-mix(in srgb, var(--card) 90%, transparent);color:var(--foreground);
  border:1px solid var(--border-default);}
.deskpet-toolbar button:hover{background:var(--card);
  border-color:color-mix(in srgb, var(--foreground) 24%, transparent);}
.deskpet-toolbar .icon-only{padding:8px;}
.deskpet-toolbar-thumb{width:20px;height:20px;object-fit:contain;image-rendering:pixelated;}
.deskpet-toolbar .sep{align-self:stretch;width:1px;margin:2px 2px;
  background:var(--border-default);}
.deskpet-toolbar .header-toggles{gap:8px;padding:0 2px;}
`;

export default function DeskPetSearch({
  lang,
  origin,
  onClose,
  charThumb,
  charLabel,
  sizeLabel,
  resting,
  onCycleChar,
  onCycleSize,
  onToggleRest,
  onResetPos,
  onHide,
}: {
  lang: 'zh' | 'en';
  origin?: { x: number; y: number } | null;
  onClose: () => void;
  charThumb: string;
  charLabel: string;
  sizeLabel: string;
  resting: boolean;
  onCycleChar: () => void;
  onCycleSize: () => void;
  onToggleRest: () => void;
  onResetPos: () => void;
  onHide: () => void;
}) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const zh = lang === 'zh';
  const t = (z: string, e: string) => (zh ? z : e);

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
        <div className="deskpet-toolbar">
          <button type="button" className="icon-only" onClick={onCycleChar}
            title={`${t('形象', 'Character')}: ${charLabel}`}>
            <img src={charThumb} alt="" className="deskpet-toolbar-thumb" />
          </button>
          <button type="button" onClick={onCycleSize}
            title={`${t('大小', 'Size')}: ${sizeLabel}`}>
            <Maximize2 size={16} />
            {sizeLabel}
          </button>
          <HeaderToggles />
          <span className="sep" />
          <button type="button" onClick={onToggleRest}>
            <Moon size={15} />
            {resting ? t('叫醒它', 'Wake up') : t('休息一下', 'Take a nap')}
          </button>
          <button type="button" onClick={onResetPos}>
            <Crosshair size={15} />
            {t('复位', 'Reset')}
          </button>
          <button type="button" onClick={onHide}>
            <EyeOff size={15} />
            {t('隐藏(刷新恢复)', 'Hide (until reload)')}
          </button>
        </div>
      </div>
    </div>
  );
}

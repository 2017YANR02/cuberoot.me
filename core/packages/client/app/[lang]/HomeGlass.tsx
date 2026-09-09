'use client';

import { useEffect, useRef, useState } from 'react';
import LiquidGlass from 'liquid-glass-react';
import { needsCssGlassFallback } from '@/components/LiquidGlassChips';

const STILL_POINTER = { x: 0, y: 0 };
const SURFACES = '.landing-card, .card, .rs-scard, .recon-card, .rc-card, .ongoing-comps-chip, .admin-tools';

/** One existing optical engine supplies all homepage surfaces. The filter only
 * warps their backdrop pseudo-element; text, links and drag handles stay native. */
export default function HomeGlass() {
  const engine = useRef<HTMLDivElement>(null);
  const [optics, setOptics] = useState(false);

  useEffect(() => {
    setOptics(!needsCssGlassFallback() && !/Firefox/i.test(navigator.userAgent));
  }, []);

  useEffect(() => {
    if (!optics) return;
    const filter = engine.current?.querySelector('filter');
    if (!filter?.querySelector('[result="RED_DISPLACED"]')) return;
    // The package's RGB/alpha recombination drops the backdrop in Chromium.
    // Use its existing displacement channel, then frost that result directly.
    const frost = document.createElementNS('http://www.w3.org/2000/svg', 'feGaussianBlur');
    frost.setAttribute('in', 'RED_DISPLACED');
    frost.setAttribute('stdDeviation', '8');
    frost.setAttribute('result', 'HOME_FROST');
    const tint = document.createElementNS('http://www.w3.org/2000/svg', 'feColorMatrix');
    tint.setAttribute('in', 'HOME_FROST');
    tint.setAttribute('type', 'saturate');
    tint.setAttribute('values', '1.5');
    filter.append(frost, tint);
    // The package owns its SVG definition and displacement texture. Share its
    // generated ID instead of duplicating that renderer for every card.
    document.body.style.setProperty('--home-glass-refraction', `url("#${filter.id}")`);
    return () => {
      document.body.style.removeProperty('--home-glass-refraction');
      frost.remove();
      tint.remove();
    };
  }, [optics]);

  useEffect(() => {
    const page = engine.current?.closest('.landing-page');
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    let active: HTMLElement | null = null;
    let frame = 0;
    let x = 0;
    let y = 0;
    const reset = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      active?.style.removeProperty('--glass-pointer-x');
      active?.style.removeProperty('--glass-pointer-y');
      active = null;
    };
    const move = (event: PointerEvent) => {
      if (reducedMotion.matches || event.pointerType === 'touch') return;
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>(SURFACES) : null;
      const next = target && (page?.contains(target) || target.matches('.admin-tools')) ? target : null;
      if (next !== active) { reset(); active = next; }
      if (!active) return;
      x = event.clientX;
      y = event.clientY;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (!active) return;
        const rect = active.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        active.style.setProperty('--glass-pointer-x', `${Math.max(0, Math.min(100, (x - rect.left) / rect.width * 100))}%`);
        active.style.setProperty('--glass-pointer-y', `${Math.max(0, Math.min(100, (y - rect.top) / rect.height * 100))}%`);
      });
    };
    document.addEventListener('pointermove', move, { passive: true });
    document.documentElement.addEventListener('pointerleave', reset);
    window.addEventListener('blur', reset);
    reducedMotion.addEventListener('change', reset);
    return () => {
      reset();
      document.removeEventListener('pointermove', move);
      document.documentElement.removeEventListener('pointerleave', reset);
      window.removeEventListener('blur', reset);
      reducedMotion.removeEventListener('change', reset);
    };
  }, []);

  return (
    <div className="home-glass-engine" ref={engine} aria-hidden="true">
      {optics && <LiquidGlass
        displacementScale={28}
        blurAmount={0.25}
        saturation={150}
        aberrationIntensity={0.5}
        elasticity={0}
        globalMousePos={STILL_POINTER}
        mouseOffset={STILL_POINTER}
        padding="0"
        cornerRadius={20}
      >
        <div style={{ width: 240, height: 140 }} />
      </LiquidGlass>}
    </div>
  );
}

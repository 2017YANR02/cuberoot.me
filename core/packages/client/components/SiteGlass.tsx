'use client';

import { useEffect, useRef, useState } from 'react';
import LiquidGlass from 'liquid-glass-react';
import { needsCssGlassFallback } from '@/components/LiquidGlassChips';

const STILL_POINTER = { x: 0, y: 0 };

/** One existing optical engine supplies all site surfaces. The filter only
 * warps their backdrop pseudo-element; text, links and drag handles stay native. */
export default function SiteGlass() {
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
    frost.setAttribute('edgeMode', 'duplicate');
    frost.setAttribute('result', 'SITE_FROST');
    filter.append(frost);
    // The package owns its SVG definition and displacement texture. Share its
    // generated ID instead of duplicating that renderer for every card.
    document.body.style.setProperty('--site-glass-refraction', `url("#${filter.id}")`);
    return () => {
      document.body.style.removeProperty('--site-glass-refraction');
      frost.remove();
    };
  }, [optics]);

  return (
    <div className="site-glass-engine" ref={engine} aria-hidden="true">
      {optics && <LiquidGlass
        displacementScale={28}
        blurAmount={0.25}
        saturation={100}
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

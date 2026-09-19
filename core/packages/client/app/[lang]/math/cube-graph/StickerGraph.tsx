'use client';

import { useLayoutEffect, useMemo, useRef } from 'react';
import { CUBE_FILL } from '@/lib/cube-colors';
import { useT } from '@/hooks/useT';
import { graphPoint, graphPosition, sectorPath, type GraphLayout } from './model';

const FACES = ['U', 'R', 'F', 'D', 'L', 'B'] as const;
const TURN_MS = 500;
type View = 'rings' | 'sectors';

function locations(stickers: number[]) {
  const result = new Array<number>(stickers.length);
  stickers.forEach((id, slot) => { result[id] = slot; });
  return result;
}

/** The parent remounts this view when its order changes. */
export default function StickerGraph({ layout, stickers, view, animate, selected, onSelect }: {
  layout: GraphLayout; stickers: number[]; view: View; animate: boolean;
  selected?: number; onSelect: (id: number) => void;
}) {
  const t = useT();
  const { order, rings } = layout;
  const svgRef = useRef<SVGSVGElement>(null);
  const viewportRef = useRef<SVGGElement>(null);
  const faceSize = order * order;
  const dotRadius = Math.min(6.5, 19.5 / order);
  const targets = useMemo(() => locations(stickers), [stickers]);
  const previous = useRef(targets);
  const initial = useRef(targets.map(slot => graphPoint(layout, slot)));
  const displayed = useRef(initial.current);
  const circles = useRef<(SVGCircleElement | null)[]>([]);
  const hitAreas = useRef<(SVGCircleElement | null)[]>([]);
  const name = (id: number) => `${FACES[Math.floor(id / faceSize)]}${id % faceSize + 1}`;
  const pickProps = (id: number, slot: number) => ({
    role: 'button', tabIndex: 0, 'aria-pressed': selected === id,
    'aria-label': `${t('贴纸', 'Sticker')} ${name(id)} → ${name(slot)}`,
    onClick: () => onSelect(id),
    onKeyDown: (event: React.KeyboardEvent<SVGElement>) => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(id); }
    },
  });
  useLayoutEffect(() => {
    const svg = svgRef.current!;
    const viewport = viewportRef.current!;
    const size = view === 'rings' ? 490 : 440;
    const center = view === 'rings' ? { x: 220, y: 200 } : { x: 220, y: 220 };
    let scale = 1, x = 0, y = 0, moved = false;
    const pointers = new Map<number, { x: number; y: number }>();
    let origin = { x: 0, y: 0 };
    const paint = () => {
      const limit = size * scale / 2;
      x = Math.max(-limit, Math.min(limit, x));
      y = Math.max(-limit, Math.min(limit, y));
      viewport.setAttribute('transform', `translate(${center.x + x} ${center.y + y}) scale(${scale}) translate(${-center.x} ${-center.y})`);
    };
    const point = (event: { clientX: number; clientY: number }) => {
      const rect = svg.getBoundingClientRect();
      const unit = size / Math.max(1, Math.min(rect.width, rect.height));
      return { x: (event.clientX - rect.left - rect.width / 2) * unit, y: (event.clientY - rect.top - rect.height / 2) * unit };
    };
    const zoom = (factor: number, from: { x: number; y: number }, to = from) => {
      const next = Math.max(0.5, Math.min(8, scale * factor));
      x = to.x - (from.x - x) * next / scale;
      y = to.y - (from.y - y) * next / scale;
      scale = next;
      paint();
    };
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? svg.clientHeight : 1);
      zoom(Math.exp(-Math.max(-200, Math.min(200, delta)) * 0.002), point(event));
    };
    const down = (event: PointerEvent) => {
      if (event.button !== 0) return;
      if (!pointers.size) {
        moved = false;
        origin = { x: event.clientX, y: event.clientY };
      }
      pointers.set(event.pointerId, point(event));
      if (pointers.size > 1) moved = true;
      // Capture on the sticker itself so a stationary tap retains its click target.
      (event.target as Element).setPointerCapture(event.pointerId);
    };
    const move = (event: PointerEvent) => {
      if (!pointers.has(event.pointerId)) return;
      if (!moved && Math.hypot(event.clientX - origin.x, event.clientY - origin.y) < 4) return;
      moved = true;
      svg.classList.add('is-panning');
      const before = [...pointers.values()];
      pointers.set(event.pointerId, point(event));
      const after = [...pointers.values()];
      if (before.length >= 2) {
        const midpoint = (points: typeof before) => ({ x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 });
        const distance = (points: typeof before) => Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
        zoom(distance(after) / Math.max(1, distance(before)), midpoint(before), midpoint(after));
      } else {
        x += after[0].x - before[0].x;
        y += after[0].y - before[0].y;
        paint();
      }
    };
    const end = (event: PointerEvent) => {
      pointers.delete(event.pointerId);
      if (event.type === 'pointercancel') moved = true;
      if (!pointers.size) svg.classList.remove('is-panning');
    };
    const click = (event: MouseEvent) => {
      if (moved && event.detail !== 0) { event.preventDefault(); event.stopPropagation(); }
    };
    const reset = () => { scale = 1; x = 0; y = 0; paint(); };
    const doubleClick = (event: MouseEvent) => {
      if (!(event.target as Element).closest('[role="button"]')) reset();
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === '+' || event.key === '=') zoom(1.25, { x: 0, y: 0 });
      else if (event.key === '-') zoom(0.8, { x: 0, y: 0 });
      else if (event.key === '0') reset();
      else if (event.key.startsWith('Arrow')) {
        x += event.key === 'ArrowLeft' ? 20 : event.key === 'ArrowRight' ? -20 : 0;
        y += event.key === 'ArrowUp' ? 20 : event.key === 'ArrowDown' ? -20 : 0;
        paint();
      } else return;
      event.preventDefault();
    };
    svg.addEventListener('wheel', wheel, { passive: false });
    svg.addEventListener('pointerdown', down);
    svg.addEventListener('pointermove', move);
    svg.addEventListener('pointerup', end);
    svg.addEventListener('pointercancel', end);
    svg.addEventListener('lostpointercapture', end);
    svg.addEventListener('click', click, true);
    svg.addEventListener('dblclick', doubleClick);
    svg.addEventListener('keydown', key);
    return () => {
      svg.removeEventListener('wheel', wheel);
      svg.removeEventListener('pointerdown', down);
      svg.removeEventListener('pointermove', move);
      svg.removeEventListener('pointerup', end);
      svg.removeEventListener('pointercancel', end);
      svg.removeEventListener('lostpointercapture', end);
      svg.removeEventListener('click', click, true);
      svg.removeEventListener('dblclick', doubleClick);
      svg.removeEventListener('keydown', key);
    };
  }, [view]);
  useLayoutEffect(() => {
    const from = previous.current;
    const origins = displayed.current;
    previous.current = targets;
    if (view !== 'rings') return;
    const duration = animate && !window.matchMedia('(prefers-reduced-motion: reduce)').matches ? TURN_MS : 0;
    const start = performance.now();
    let frame = 0;
    function draw(now: number) {
      const progress = duration ? Math.min(1, (now - start) / duration) : 1;
      displayed.current = targets.map((slot, id) => {
        const p = graphPosition(from[id], slot, progress * progress * (3 - 2 * progress), origins[id], layout);
        circles.current[id]?.setAttribute('cx', String(p.x));
        circles.current[id]?.setAttribute('cy', String(p.y));
        hitAreas.current[id]?.setAttribute('cx', String(p.x));
        hitAreas.current[id]?.setAttribute('cy', String(p.y));
        return p;
      });
      if (progress < 1) frame = requestAnimationFrame(draw);
    }
    draw(start);
    return () => cancelAnimationFrame(frame);
  }, [targets, animate, view, layout]);

  return <svg ref={svgRef} className="cube-graph-svg" viewBox={view === 'rings' ? '-25 -45 490 490' : '0 0 440 440'} role="group" tabIndex={0}
    aria-label={view === 'rings' ? t('圆环贴纸图', 'Ring sticker map') : t('圆盘贴纸图', 'Sector sticker map')}>
    <title>{view === 'rings' ? t('圆环贴纸图', 'Ring sticker map') : t('圆盘贴纸图', 'Sector sticker map')}</title>
    <g ref={viewportRef}>
    {view === 'rings' ? <>
      {rings.map((ring, i) => <circle key={i} cx={ring.x} cy={ring.y} r={ring.r} fill="none" stroke="var(--muted-foreground)" strokeOpacity="0.6" strokeWidth={Math.min(1.3, 4 / order)} />)}
      {targets.map((slot, id) => <g key={id} {...pickProps(id, slot)}>
        <circle ref={node => { hitAreas.current[id] = node; }} cx={initial.current[id].x} cy={initial.current[id].y} r={dotRadius * 1.5} fill="transparent" />
        <circle ref={node => { circles.current[id] = node; }}
          // React leaves coordinates stable; animation owns subsequent positions.
          cx={initial.current[id].x} cy={initial.current[id].y} r={selected === id ? dotRadius * 1.5 : dotRadius}
          opacity={selected === undefined || selected === id ? 1 : 0.2} fill={CUBE_FILL[FACES[Math.floor(id / faceSize)]]}
          stroke="var(--foreground)" strokeWidth={Math.min(0.8, 2.4 / order)} data-sticker={id}>
          <title>{`${name(id)} → ${name(slot)}`}</title>
        </circle>
      </g>)}
    </> : <>
      {stickers.map((id, slot) => <path key={slot}
        d={sectorPath(Math.floor(slot / faceSize), Math.floor(slot % faceSize / order), slot % order, order)}
        fill={CUBE_FILL[FACES[Math.floor(id / faceSize)]]}
        opacity={selected === undefined || id === selected ? 1 : 0.15}
        stroke="var(--foreground)" strokeWidth={id === selected ? 2 : Math.min(0.8, 2.4 / order)}
        data-slot={slot} {...pickProps(id, slot)}>
        <title>{`${name(slot)} ← ${name(id)}`}</title>
      </path>)}
      <g stroke="var(--background)" strokeWidth="4" pointerEvents="none" aria-hidden="true">
        {FACES.map((face, index) => {
          const angle = -Math.PI / 2 + index * Math.PI / 3;
          return <line key={face}
            x1={220 + 38 * Math.cos(angle)} y1={220 + 38 * Math.sin(angle)}
            x2={220 + 167 * Math.cos(angle)} y2={220 + 167 * Math.sin(angle)} />;
        })}
      </g>
      {FACES.map((face, index) => {
        const angle = -Math.PI / 2 + (index + 0.5) * Math.PI / 3;
        return <text key={face} x={(220 + 191 * Math.cos(angle)).toFixed(3)} y={(220 + 191 * Math.sin(angle)).toFixed(3)} textAnchor="middle" dominantBaseline="middle" fill="var(--foreground)" fontSize="17">{face}</text>;
      })}
    </>}
    </g>
  </svg>;
}

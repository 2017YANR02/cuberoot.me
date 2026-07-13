'use client';

/**
 * PuzzleImage — the headless preview half of the puzzle-image studio.
 *
 * Owns every render-dispatch DOM branch that used to live inline in
 * app/[lang]/visualcube/page.tsx:
 *
 *   pure          renderSpecSvg()  → visualcube iso/plan/trans + all tnoodle nets
 *   sr-puzzlegen  <PuzzleSVG>      → non-cube iso/top
 *   net-paint-3x3 <InteractiveCubeNet> → the 3x3 net paint editor
 *   skewb-net     <scramble-display>   → cubing.js custom element
 *
 * plus drag-to-rotate. Dispatch is a REGISTRY keyed on (puzzleType, view) —
 * `view` being cubeView for a cube and puzzleVariant otherwise — so a new
 * renderer is one row, not a sixth `if`.
 *
 * The root keeps the class `vc-preview`: app/globals.css and puzzle-image.css
 * key off it, and scripts/verify_puzzle_image_golden.cjs scrapes its innerHTML
 * as the zero-loss oracle. Do not rename it.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import InteractiveCubeNet from '@/app/[lang]/scramble/solver/_InteractiveCubeNet';
import { PuzzleSVG } from '@/components/PuzzleSVG';
import { invertAlg } from '@/lib/cube3';
import { rotationDefaultsFor, rotationsMatchDefault } from '@/lib/puzzle-image/defaults';
import { renderSpecSvg, srKindOf } from '@/lib/puzzle-image/render';
import type { StickerId } from '@/lib/puzzle-image/mask-core';
import type { ImageSpec, PuzzleType } from '@/lib/puzzle-image/types';

// ── skewb net (cubing.js scramble-display) ──────────────────────────────────

/**
 * Skewb 'net' is cubing.js' scramble-display unfolded view (NOT the WCA colour
 * configuration — that's the 'wca' variant, which is our tnoodle port).
 * scramble-display is a thin <scramble-display> custom element around
 * cubing/twisty; importing it side-effect-registers the element via
 * customElements.define, so it is lazy-imported inside the effect (client-only,
 * avoids SSR + a duplicate define on Fast Refresh).
 */
function SkewbNetPreview({ scramble, pixelSize }: { scramble: string; pixelSize: number }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    let cancelled = false;
    let el: HTMLElement | null = null;
    import('scramble-display').then(() => {
      if (cancelled || !hostRef.current) return;
      el = document.createElement('scramble-display');
      el.setAttribute('event', 'skewb');
      el.setAttribute('scramble', scramble ?? '');
      el.setAttribute('visualization', '2D');
      el.style.width = '100%';
      el.style.height = '100%';
      el.style.display = 'block';
      hostRef.current.appendChild(el);
    }).catch((err) => console.warn('[PuzzleImage] scramble-display load failed', err));
    return () => {
      cancelled = true;
      if (el && el.parentNode) el.parentNode.removeChild(el);
    };
  }, [scramble]);
  // Match the scramble-display skewb facelet aspect (12 wide x 9 tall units).
  const size = Math.max(8, Math.round(pixelSize / 12));
  return (
    <div
      ref={hostRef}
      style={{ width: size * 12, height: size * 9, display: 'block' }}
      role="img"
      aria-label="skewb net"
    />
  );
}

// ── registry ────────────────────────────────────────────────────────────────

type RendererId = 'pure' | 'sr-puzzlegen' | 'net-paint-3x3' | 'skewb-net-display';

interface RendererEntry {
  /** Most rows are a constant; cube `net` alone needs the size to choose. */
  renderer: RendererId | ((s: ImageSpec) => RendererId);
  /** Drag-to-rotate: only the projected (non-unfolded) views have a viewport. */
  draggable: boolean;
}

/** Extra `.vc-preview` class, keyed on the RESOLVED renderer — not the row, so a
 *  4x4 `cube:net` (which resolves to the pure tnoodle SVG, not the 3x3 paint
 *  editor) does not inherit the paint-editor marker. Mirrors the original markup,
 *  where these classes lived inside the per-renderer branch. */
const RENDERER_CLASS: Partial<Record<RendererId, string>> = {
  'net-paint-3x3': 'vc-preview-net-paint',
  'skewb-net-display': 'vc-preview-cubing',
};

/** key = `${puzzleType}:${cubeView | puzzleVariant}`. Every combination the codec
 *  can produce has a row — an unknown key falls back to the pure renderer. */
const REGISTRY: Record<string, RendererEntry> = {
  'cube:normal': { renderer: 'pure', draggable: true },
  'cube:plan':   { renderer: 'pure', draggable: true },
  'cube:trans':  { renderer: 'pure', draggable: true },
  // 3x3 net is the paint editor; every other size falls through to the tnoodle net.
  'cube:net':    { renderer: (s) => (s.cubeSize === 3 ? 'net-paint-3x3' : 'pure'), draggable: false },
  'cube:wca':    { renderer: 'pure', draggable: false },

  'sq1:iso':      { renderer: 'sr-puzzlegen', draggable: true },
  'sq1:top':      { renderer: 'sr-puzzlegen', draggable: true },
  'sq1:net':      { renderer: 'pure', draggable: false },
  'sq1:wca':      { renderer: 'pure', draggable: false },

  'megaminx:iso': { renderer: 'sr-puzzlegen', draggable: true },
  'megaminx:top': { renderer: 'sr-puzzlegen', draggable: true },
  'megaminx:net': { renderer: 'pure', draggable: false },
  'megaminx:wca': { renderer: 'pure', draggable: false },

  'pyraminx:iso': { renderer: 'sr-puzzlegen', draggable: true },
  'pyraminx:top': { renderer: 'sr-puzzlegen', draggable: true },
  'pyraminx:net': { renderer: 'pure', draggable: false },
  'pyraminx:wca': { renderer: 'pure', draggable: false },

  'skewb:iso': { renderer: 'sr-puzzlegen', draggable: true },
  'skewb:top': { renderer: 'sr-puzzlegen', draggable: true },
  'skewb:net': { renderer: 'skewb-net-display', draggable: false },
  'skewb:wca': { renderer: 'pure', draggable: false },
};

const FALLBACK: RendererEntry = { renderer: 'pure', draggable: false };

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string
  ));
}

export function registryKey(s: ImageSpec): string {
  return `${s.puzzleType}:${s.puzzleType === 'cube' ? s.cubeView : s.puzzleVariant}`;
}

function entryFor(s: ImageSpec): { renderer: RendererId; draggable: boolean; extraClass?: string } {
  const e = REGISTRY[registryKey(s)] ?? FALLBACK;
  const renderer = typeof e.renderer === 'function' ? e.renderer(s) : e.renderer;
  return { renderer, draggable: e.draggable, extraClass: RENDERER_CLASS[renderer] };
}

/** sr-puzzlegen's own axis naming: sq1 / pyraminx spin about z where we say y. */
function srPuzzleAxis(type: PuzzleType, axis: string): string {
  return (type === 'sq1' || type === 'pyraminx') && axis === 'y' ? 'z' : axis;
}

// ── component ───────────────────────────────────────────────────────────────

export interface PuzzleImageProps {
  spec: ImageSpec;
  className?: string;
  /** Required for drag-to-rotate and for the 3x3 paint editor to write back. */
  onSpecChange?: (patch: Partial<ImageSpec>) => void;
  /** Default true. false ⇒ a static picture: no drag, no paint write-back. */
  interactive?: boolean;
  /**
   * Click a sticker → its canonical id (mask authoring). Only the tnoodle
   * unfolded renderers carry a `data-sid` id space, so this fires on the net /
   * wca views; visualcube iso/plan and sr-puzzlegen emit no ids and stay silent.
   */
  onStickerClick?: (sid: StickerId) => void;
}

export default function PuzzleImage({
  spec, className, onSpecChange, interactive = true, onStickerClick,
}: PuzzleImageProps) {
  const { renderer, draggable, extraClass } = entryFor(spec);
  const wantIds = !!onStickerClick;

  // Pinned pre-existing behaviour: a renderer throw becomes a red div rather than
  // an error boundary. The message is HTML-escaped before it reaches
  // dangerouslySetInnerHTML (the original interpolated it raw). The sr-puzzlegen
  // render-fail path is the one the golden fixtures lock; this is the parallel
  // pure-render path.
  const svg = useMemo(() => {
    if (renderer !== 'pure') return null;
    try {
      return renderSpecSvg(spec, wantIds ? { stickerIds: true } : undefined);
    } catch (e) {
      return `<div style="color:red">${escapeHtml((e as Error).message)}</div>`;
    }
  }, [spec, renderer, wantIds]);

  // ── drag-to-rotate ───────────────────────────────────────────────────────
  const dragRef = useRef<{
    startX: number; startY: number;
    startYAngle: number; startXAngle: number;
    yslot: 1 | 2 | null; xslot: 1 | 2 | null;
    rafId: number | null; pendingDx: number; pendingDy: number;
    dxSign: 1 | -1; dySign: 1 | -1; xMin: number; xMax: number;
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const wrapAngle = (n: number) => {
    const r = ((Math.round(n) + 180) % 360 + 360) % 360 - 180;
    return r === -180 ? 180 : r;
  };

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!onSpecChange) return;
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    const findSlot = (axis: 'x' | 'y'): 1 | 2 | null => {
      if (spec.rotateAxis1 === axis) return 1;
      if (spec.rotateAxis2 === axis) return 2;
      return null;
    };
    const yslot = findSlot('y');
    const xslot = findSlot('x');
    if (yslot === null && xslot === null) return;
    const angleAt = (slot: 1 | 2) => (slot === 1 ? spec.rotateAngle1 : spec.rotateAngle2);
    const isSrPuzzlegen = spec.puzzleType !== 'cube'
      && !(spec.puzzleType === 'skewb' && spec.puzzleVariant === 'top');
    const defs = rotationDefaultsFor(spec);
    const defaultAt = (slot: 1 | 2) => (slot === 1 ? defs.angle1 : defs.angle2);
    const xDefault = xslot ? defaultAt(xslot) : 0;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      startX: e.clientX, startY: e.clientY,
      startYAngle: yslot ? angleAt(yslot) : 0,
      startXAngle: xslot ? angleAt(xslot) : 0,
      yslot, xslot, rafId: null, pendingDx: 0, pendingDy: 0,
      dxSign: isSrPuzzlegen ? 1 : -1,
      dySign: isSrPuzzlegen ? 1 : -1,
      xMin: xDefault - 45, xMax: xDefault + 45,
    };
    setIsDragging(true);
  }, [spec, onSpecChange]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || !onSpecChange) return;
    d.pendingDx = e.clientX - d.startX;
    d.pendingDy = e.clientY - d.startY;
    if (d.rafId !== null) return;
    d.rafId = requestAnimationFrame(() => {
      const cur = dragRef.current;
      if (!cur) return;
      cur.rafId = null;
      const patch: Partial<ImageSpec> = {};
      if (cur.yslot) {
        const v = wrapAngle(cur.startYAngle + cur.dxSign * cur.pendingDx * 0.5);
        if (cur.yslot === 1) patch.rotateAngle1 = v;
        else patch.rotateAngle2 = v;
      }
      if (cur.xslot) {
        const raw = cur.startXAngle + cur.dySign * cur.pendingDy * 0.5;
        const v = Math.max(cur.xMin, Math.min(cur.xMax, Math.round(raw)));
        if (cur.xslot === 1) patch.rotateAngle1 = v;
        else patch.rotateAngle2 = v;
      }
      onSpecChange(patch);
    });
  }, [onSpecChange]);

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d) return;
    if (d.rafId !== null) cancelAnimationFrame(d.rafId);
    dragRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    setIsDragging(false);
  }, []);

  const canDrag = draggable && interactive && !!onSpecChange;
  const dragHandlers = canDrag ? {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel: onPointerUp,
  } : {};

  // ── sticker picking ──────────────────────────────────────────────────────
  const onClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!onStickerClick) return;
    const el = (e.target as Element).closest?.('[data-sid]');
    const sid = el?.getAttribute('data-sid');
    if (sid) onStickerClick(sid);
  }, [onStickerClick]);

  const cls = [
    'vc-preview',
    extraClass,
    canDrag ? `vc-preview-draggable${isDragging ? ' dragging' : ''}` : null,
    wantIds ? 'vc-preview-pickable' : null,
    className,
  ].filter(Boolean).join(' ');

  if (renderer === 'net-paint-3x3') {
    return (
      <div className={cls}>
        <InteractiveCubeNet
          facelet={spec.paintedFacelet}
          onChange={(next) => onSpecChange?.({ paintedFacelet: next })}
          activeColor={spec.netActiveColor}
          onActiveColorChange={(c) => onSpecChange?.({ netActiveColor: c })}
          pixelSize={spec.imageSize}
        />
      </div>
    );
  }

  if (renderer === 'skewb-net-display') {
    const raw = spec.algorithm ?? '';
    // scramble-display takes a forward scramble; a `case` is the inverse of it.
    const forward = spec.algType === 'case' ? invertAlg(raw) : raw;
    return (
      <div className={cls}>
        <SkewbNetPreview scramble={forward} pixelSize={spec.imageSize} />
      </div>
    );
  }

  if (renderer === 'sr-puzzlegen') {
    const kind = srKindOf(spec.puzzleType, spec.puzzleVariant)!;
    const rotations = !rotationsMatchDefault(spec) ? [
      { [srPuzzleAxis(spec.puzzleType, spec.rotateAxis1)]: spec.rotateAngle1 },
      { [srPuzzleAxis(spec.puzzleType, spec.rotateAxis2)]: spec.rotateAngle2 },
    ] as { x?: number; y?: number; z?: number }[] : undefined;
    return (
      <div className={cls} {...dragHandlers}>
        <PuzzleSVG
          kind={kind}
          alg={spec.algType === 'alg' ? spec.algorithm : undefined}
          case={spec.algType === 'case' ? spec.algorithm : undefined}
          size={spec.imageSize}
          rotations={rotations}
          mask={spec.stickerMask || undefined}
        />
      </div>
    );
  }

  return (
    <div
      className={cls}
      {...dragHandlers}
      {...(onStickerClick ? { onClick } : {})}
      dangerouslySetInnerHTML={{ __html: svg ?? '' }}
    />
  );
}

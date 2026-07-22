'use client';

/**
 * Interactive 2D unfolded net for the NxN sim — the「平面图」view mode (alternative
 * to the 3D「立体图」). NxN only (SQ1 / pyraminx / skewb / megaminx don't use this
 * engine / serialize()).
 *
 * State source: `cube.serialize()` returns a URFDLB face-letter string whose six
 * N² blocks are already in display (net) orientation — see cube.ts serialize(). So
 * the net mirrors the live 3D state exactly with no per-face flipping. We re-read on
 * every move by subscribing to `cube.callbacks`.
 *
 * Drag a sticker to twist that layer. The (face, drag-direction) → (axis, layer,
 * reverse) table below feeds `cube.twister.twist(new TwistAction(group.name, reverse))`
 * — the SAME convention the 3D drag controller uses (controller.ts handleUp): a turn
 * with reverse=false is +90° about CubeGroup.AXIS_VECTOR[axis]. The reverse flags were
 * derived from ω = n̂ × d̂ (n̂ = face normal, d̂ = world drag direction) and verified
 * against known cases (front-top drag-right = U', front-right-col drag-down = R').
 */

import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import type World from './engine/world';
import type CubeType from './engine/nxn/cube';
import { TwistAction } from './engine/nxn/twister';
import { useT } from '@/hooks/useT';
// 布局单一源:与静态导出器 sim_net_export 共用(退役对照表 §2b「视图 net」),平面图
// 与导出件逐格对齐、免两份漂移。
import {
  NET_GAP as GAP, NET_STROKE_W as STROKE_W,
  NET_FACE_ORDER as FACE_ORDER, netFaceOffsets as faceOffsets,
  type NetFaceLetter,
} from './sim_net_export';

type FaceLetter = NetFaceLetter;
type Axis = 'x' | 'y' | 'z';

/** Above this order the per-sticker DOM + O(N²) serialize() per move get heavy and a
 *  flat net is impractical — fall back to a note (use 立体图 instead). */
export const NET_MAX_ORDER = 50;

interface DragRule {
  axis: Axis;
  layer: (r: number, c: number, N: number) => number;
  /** reverse flag when dragging in the +screen direction (right for H, down for V). */
  baseReverse: boolean;
}

/**
 * Per-face drag table.
 *  h = horizontal drag (|dx| > |dy|): turns a slice perpendicular to the drag.
 *  v = vertical drag.
 * `layer` indexes cube.table.groups[axis][layer]; `reverse` flips when the drag is
 * in the −screen direction.
 */
const DRAG_TABLE: Record<FaceLetter, { h: DragRule; v: DragRule }> = {
  U: {
    h: { axis: 'z', layer: (r) => r, baseReverse: false },
    v: { axis: 'x', layer: (_r, c) => c, baseReverse: true },
  },
  D: {
    h: { axis: 'z', layer: (r, _c, N) => N - 1 - r, baseReverse: true },
    v: { axis: 'x', layer: (_r, c) => c, baseReverse: true },
  },
  F: {
    h: { axis: 'y', layer: (r, _c, N) => N - 1 - r, baseReverse: true },
    v: { axis: 'x', layer: (_r, c) => c, baseReverse: true },
  },
  B: {
    h: { axis: 'y', layer: (r, _c, N) => N - 1 - r, baseReverse: true },
    v: { axis: 'z', layer: (_r, c, N) => N - 1 - c, baseReverse: false },
  },
  R: {
    h: { axis: 'y', layer: (r, _c, N) => N - 1 - r, baseReverse: true },
    v: { axis: 'z', layer: (_r, c, N) => N - 1 - c, baseReverse: false },
  },
  L: {
    h: { axis: 'y', layer: (r, _c, N) => N - 1 - r, baseReverse: true },
    v: { axis: 'z', layer: (_r, c) => c, baseReverse: true },
  },
};

interface Props {
  getWorld: () => World | null;
  /** Bumps when the world is (re)created — re-subscribe to the live cube. */
  worldTick: number;
  /** Current order from SimPage state — re-subscribe when the active cube changes. */
  order: number;
  userMoveRef: RefObject<((action: TwistAction | string) => void) | null>;
  faceColors: Record<FaceLetter, string>;
  /** 手拧(设置面板):false = 拖贴纸不转层。平面图没有视角可转,所以直接不接手势。 */
  pointerTurns?: boolean;
}

/** Narrow world.cube to the NxN Cube (the only kind with serialize()/table). */
function nxnCube(world: World | null): CubeType | null {
  if (!world) return null;
  if (world.puzzleKind === 'sq1' || world.puzzleKind === 'ivy') return null;
  return world.cube as CubeType;
}

export default function SimCubeNet({ getWorld, worldTick, order, userMoveRef, faceColors, pointerTurns = true }: Props) {
  const t = useT();
  const [, force] = useState(0);
  const rerender = useCallback(() => force((n) => (n + 1) & 0xffff), []);

  // Subscribe to the live cube's move callbacks; re-read on world / order change.
  useEffect(() => {
    const cube = nxnCube(getWorld());
    if (!cube) return;
    const cb = () => rerender();
    cube.callbacks.push(cb);
    rerender(); // paint current state immediately
    return () => {
      const i = cube.callbacks.indexOf(cb);
      if (i >= 0) cube.callbacks.splice(i, 1);
    };
  }, [getWorld, worldTick, order, rerender]);

  const dragRef = useRef<
    { face: FaceLetter; r: number; c: number; x: number; y: number; done: boolean } | null
  >(null);

  const applyMove = useCallback(
    (face: FaceLetter, r: number, c: number, dx: number, dy: number) => {
      const cube = nxnCube(getWorld());
      if (!cube) return;
      const N = cube.order;
      const horizontal = Math.abs(dx) > Math.abs(dy);
      const rule = horizontal ? DRAG_TABLE[face].h : DRAG_TABLE[face].v;
      const layer = rule.layer(r, c, N);
      if (layer < 0 || layer >= N) return;
      const group = cube.table.groups[rule.axis]?.[layer];
      if (!group) return;
      const positive = horizontal ? dx > 0 : dy > 0;
      const reverse = positive ? rule.baseReverse : !rule.baseReverse;
      const action = new TwistAction(group.name, reverse, 1);
      // fast + force: apply instantly (3D is hidden in net mode) — the net repaints
      // via the cube callback. userMoveRef appends the move to the alg box.
      cube.twister.twist(action, true, true);
      userMoveRef.current?.(action);
    },
    [getWorld, userMoveRef],
  );

  // Window-level move/up so a drag that leaves the sticker still resolves.
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d || d.done) return;
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      if (Math.hypot(dx, dy) < 8) return; // threshold — one move per drag
      d.done = true;
      applyMove(d.face, d.r, d.c, dx, dy);
    };
    const onUp = () => { dragRef.current = null; };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [applyMove]);

  const cube = nxnCube(getWorld());
  const N = cube?.order ?? order;

  if (!cube) return <div className="sim-net" aria-hidden />;
  if (N > NET_MAX_ORDER) {
    return (
      <div className="sim-net sim-net--fallback">
        {t(`平面图暂不支持 ${N} 阶(请用立体图)`, `Flat net unsupported for ${N}×${N} — use the 3D view`)}
      </div>
    );
  }

  const facelets = cube.serialize();
  const offs = faceOffsets(N);
  const w = 4 * N + 5 * GAP;
  const h = 3 * N + 4 * GAP;

  const colorOf = (ch: string): string =>
    ch === 'U' || ch === 'R' || ch === 'F' || ch === 'D' || ch === 'L' || ch === 'B'
      ? faceColors[ch]
      : '#444';

  const rects: ReactNode[] = [];
  for (let fi = 0; fi < 6; fi++) {
    const face = FACE_ORDER[fi];
    const [ox, oy] = offs[face];
    const base = fi * N * N;
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const ch = facelets[base + r * N + c];
        rects.push(
          <rect
            key={`${face}-${r}-${c}`}
            data-face={face}
            data-r={r}
            data-c={c}
            x={ox + c}
            y={oy + r}
            width={1}
            height={1}
            fill={colorOf(ch)}
            stroke="#000"
            strokeWidth={STROKE_W}
            onPointerDown={(e) => {
              // 手拧关 → 根本不起手势(applyMove 是拖转层的唯一出口,它只由这里启动)。
              if (!pointerTurns) return;
              e.preventDefault();
              dragRef.current = { face, r, c, x: e.clientX, y: e.clientY, done: false };
            }}
          />,
        );
      }
    }
  }

  return (
    <div className="sim-net">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="xMidYMid meet"
        className="sim-net-svg"
      >
        {rects}
      </svg>
    </div>
  );
}

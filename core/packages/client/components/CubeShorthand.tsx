'use client';

/**
 * CubeShorthand — 把一条公式画成一行「一个转动 = 一个独立符号」的可视化记号。
 *
 * 用户定义的视觉语言(按 image #5 / #6 实例):
 *   - 竖条家族 R/L/M:三根竖条 = 三列,带箭头的那一根 = 要转的列 + 方向
 *       (右列↑ = R,左列↓ = L,中列↓ = M;' 翻方向)
 *   - 横条家族 U/D/E:三根横条 = 三行,带箭头的那一根 = 要转的行 + 方向
 *   - 面家族 F/B/S:三个叠放圆角方块 = 面层叠,左侧扫掠箭头 = 顺/逆(' = 逆时针)
 *       ⚠️ F vs B vs S 的区分、x/y/z 整体转动尚待用户敲定,当前为占位。
 *   - 双箭头 = 180°(2);accent 色 = 整体转动。
 *
 * 移动解析复用 lib/pll-fingertricks 的 tokenizeAlg + parseMove(纯函数,无 THREE)。
 *
 * 几何是数据驱动的:每个转动 -> glyphPrimitives(p) -> GlyphPrim[](0..100 viewBox)。
 * 本组件把 GlyphPrim[] 映射成 SVG;/paint 的插入面板把同样的 GlyphPrim[] 映射成可编辑矢量。
 */

import { useMemo } from 'react';
import { tokenizeAlg, parseMove, type ParsedMove } from '@/lib/pll-fingertricks';
import './cube-shorthand.css';

type Dir = 'up' | 'down' | 'left' | 'right';
const OPP: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' };

interface BarsCfg {
  kind: 'bars';
  orient: 'V' | 'H';
  idx: number; // which of the 3 bars carries the arrow (0=left/top … 2=right/bottom)
  dir: Dir; // unprimed motion direction
  all?: boolean; // whole-cube rotation: every bar is an arrow
  rot?: boolean;
}
interface StackCfg {
  kind: 'stack';
  cw: boolean; // unprimed = clockwise (left edge up)
  depth: 'front' | 'mid' | 'back';
  rot?: boolean;
}
type Cfg = BarsCfg | StackCfg;

const BASE: Record<string, Cfg> = {
  R: { kind: 'bars', orient: 'V', idx: 2, dir: 'up' },
  L: { kind: 'bars', orient: 'V', idx: 0, dir: 'down' },
  M: { kind: 'bars', orient: 'V', idx: 1, dir: 'down' },
  U: { kind: 'bars', orient: 'H', idx: 0, dir: 'left' },
  D: { kind: 'bars', orient: 'H', idx: 2, dir: 'right' },
  E: { kind: 'bars', orient: 'H', idx: 1, dir: 'right' },
  F: { kind: 'stack', cw: true, depth: 'front' },
  B: { kind: 'stack', cw: true, depth: 'back' },
  S: { kind: 'stack', cw: true, depth: 'mid' },
  // placeholders — x/y all-arrow, z stacked, all accent
  x: { kind: 'bars', orient: 'V', idx: 0, dir: 'up', all: true, rot: true },
  y: { kind: 'bars', orient: 'H', idx: 0, dir: 'left', all: true, rot: true },
  z: { kind: 'stack', cw: true, depth: 'front', rot: true },
};

const BAR_W = 3.5;
const HEAD_L = 13;
const HEAD_HW = 5.5;
const POS = [28, 50, 72]; // three column / row centers

// ── GlyphPrim: the single geometry source ───────────────────────────────────
// Each primitive lives in the existing 0..100 viewBox. `fillable` = filled when
// rendered (arrowheads / solid cards); otherwise stroked (bars / brackets).
// `accent` marks whole-cube-rotation prims (x/y/z) so consumers can colour them.
export type GlyphPrim =
  | { kind: 'line'; x1: number; y1: number; x2: number; y2: number; w: number; accent?: boolean; fillable?: boolean }
  | { kind: 'polygon'; points: [number, number][]; accent?: boolean; fillable?: boolean }
  | { kind: 'rect'; x: number; y: number; w: number; h: number; rx: number; sw: number; accent?: boolean; fillable?: boolean }
  | { kind: 'path'; d: string; sw: number; accent?: boolean; fillable?: boolean };

function unit(ax: number, ay: number, bx: number, by: number): [number, number] {
  const dx = bx - ax;
  const dy = by - ay;
  const m = Math.hypot(dx, dy) || 1;
  return [dx / m, dy / m];
}

// shaft (butt) + 1-2 bold triangular heads from trailing point Ts to leading point Te
function arrowPrims(
  Ts: [number, number],
  Te: [number, number],
  times: number,
  w = BAR_W,
  headL = HEAD_L,
  headHW = HEAD_HW,
): GlyphPrim[] {
  const [ux, uy] = unit(Ts[0], Ts[1], Te[0], Te[1]);
  const n = Math.min(Math.max(times, 1), 2);
  const beX = Te[0] - ux * headL * n;
  const beY = Te[1] - uy * headL * n;
  const prims: GlyphPrim[] = [{ kind: 'line', x1: Ts[0], y1: Ts[1], x2: beX, y2: beY, w }];
  const px = -uy;
  const py = ux;
  for (let k = 0; k < n; k++) {
    const apx = Te[0] - ux * headL * k;
    const apy = Te[1] - uy * headL * k;
    const bcx = apx - ux * headL;
    const bcy = apy - uy * headL;
    prims.push({
      kind: 'polygon',
      fillable: true,
      points: [
        [apx, apy],
        [bcx + px * headHW, bcy + py * headHW],
        [bcx - px * headHW, bcy - py * headHW],
      ],
    });
  }
  return prims;
}

function barsPrims(cfg: BarsCfg, dir: Dir, times: number): GlyphPrim[] {
  const prims: GlyphPrim[] = [];
  for (let i = 0; i < 3; i++) {
    const isArrow = cfg.all || i === cfg.idx;
    const p = POS[i];
    if (cfg.orient === 'V') {
      if (!isArrow) {
        prims.push({ kind: 'line', x1: p, y1: 12, x2: p, y2: 88, w: BAR_W });
      } else {
        const Ts: [number, number] = dir === 'up' ? [p, 88] : [p, 12];
        const Te: [number, number] = dir === 'up' ? [p, 12] : [p, 88];
        prims.push(...arrowPrims(Ts, Te, times));
      }
    } else {
      if (!isArrow) {
        prims.push({ kind: 'line', x1: 12, y1: p, x2: 88, y2: p, w: BAR_W });
      } else {
        const Ts: [number, number] = dir === 'left' ? [88, p] : [12, p];
        const Te: [number, number] = dir === 'left' ? [12, p] : [88, p];
        prims.push(...arrowPrims(Ts, Te, times));
      }
    }
  }
  return prims;
}

function stackPrims(_cfg: StackCfg, cw: boolean, times: number): GlyphPrim[] {
  // Opus's S' design, with ROUNDED bracket corners. Three shapes stepping up-left: the
  // two BACK cards are simple L-brackets (top edge + left edge, rounded top-left corner,
  // no right/bottom edge); the FRONT card is a full rounded square. The back-most card's
  // left edge is the sweep arrow. ' = arrow down (CCW); plain = up (CW).
  const sw = 2.5;
  const rr = 9; // single corner radius shared by all three cards (true circular arcs)
  const st = 7; // step between cards — horizontal spacing == vertical spacing
  const S = 54; // card size
  const bx = 14;
  const by = 16; // back card top-left
  const mx = bx + st;
  const my = by + st; // middle card top-left
  const fx = bx + 2 * st;
  const fy = by + 2 * st; // front card top-left
  // left-edge bottoms on a slope-1 line (parallel to the top-corner line), anchored at
  // the front card's left-edge bottom; arrow tip is highest, front lowest.
  const frontBot = fy + S - rr;
  const midBot = frontBot - st;
  const arrowTip = frontBot - 2 * st;
  const prims: GlyphPrim[] = [];

  // back bracket: rounded top-left corner + top edge (its left edge = the arrow)
  prims.push({
    kind: 'path',
    sw,
    d: `M ${bx} ${by + rr} A ${rr} ${rr} 0 0 1 ${bx + rr} ${by} L ${bx + S + 2} ${by}`,
  });
  // middle bracket: left edge + rounded top-left corner + top edge
  prims.push({
    kind: 'path',
    sw,
    d: `M ${mx} ${midBot} L ${mx} ${my + rr} A ${rr} ${rr} 0 0 1 ${mx + rr} ${my} L ${mx + S + 2} ${my}`,
  });
  // front full rounded square (same corner radius; even (st,st) step keeps all three
  // top-left corner centres collinear on the 45° diagonal)
  prims.push({ kind: 'rect', x: fx, y: fy, w: S, h: S, rx: rr, sw });

  // arrow = back card's left edge; thin head ("瘦" triangle)
  const Ts: [number, number] = cw ? [bx, frontBot] : [bx, by + rr];
  const Te: [number, number] = cw ? [bx, by - 8] : [bx, arrowTip];
  prims.push(...arrowPrims(Ts, Te, times, sw, 14, 4));
  return prims;
}

/**
 * The single geometry source: a parsed move -> its glyph primitives in the
 * 0..100 viewBox. Returns [] for unparseable / wide / unknown-base moves.
 * Both <CubeShorthand> and the /paint insert panel consume this.
 */
export function glyphPrimitives(p: ParsedMove): GlyphPrim[] {
  if (p.wide) return [];
  const cfg = BASE[p.base];
  if (!cfg) return [];
  const prims =
    cfg.kind === 'bars'
      ? barsPrims(cfg, p.reverse ? OPP[cfg.dir] : cfg.dir, p.times)
      : stackPrims(cfg, p.reverse ? !cfg.cw : cfg.cw, p.times);
  if (cfg.rot) for (const pr of prims) pr.accent = true;
  return prims;
}

function PrimEl({ prim, i }: { prim: GlyphPrim; i: number }) {
  switch (prim.kind) {
    case 'line':
      return <line key={i} x1={prim.x1} y1={prim.y1} x2={prim.x2} y2={prim.y2} strokeWidth={prim.w} strokeLinecap="butt" />;
    case 'polygon':
      return <polygon key={i} points={prim.points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ')} />;
    case 'rect':
      return <rect key={i} className="cube-sh-sq" x={prim.x} y={prim.y} width={prim.w} height={prim.h} rx={prim.rx} strokeWidth={prim.sw} />;
    case 'path':
      return <path key={i} className="cube-sh-sq" strokeWidth={prim.sw} strokeLinecap="round" d={prim.d} />;
  }
}

function MoveGlyph({ p, size }: { p: ParsedMove; size: number }) {
  const prims = glyphPrimitives(p);
  if (!prims.length) return null;
  const isRot = prims.some((pr) => pr.accent);
  return (
    <svg
      className={`cube-sh-glyph${isRot ? ' is-rot' : ''}`}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      aria-hidden="true"
    >
      {prims.map((prim, i) => (
        <PrimEl key={i} prim={prim} i={i} />
      ))}
    </svg>
  );
}

export interface CubeShorthandProps {
  /** Algorithm in standard notation, e.g. "R U R' U'". */
  alg: string;
  /** Glyph square size in px. */
  size?: number;
  /** Show the raw move token under each glyph. */
  showLabels?: boolean;
  className?: string;
}

/** Render an alg as a left-to-right row of discrete shorthand glyphs (one per move). */
export default function CubeShorthand({ alg, size = 40, showLabels = false, className }: CubeShorthandProps) {
  const items = useMemo(
    () =>
      tokenizeAlg(alg || '').map((tok) => {
        const p = parseMove(tok);
        const ok = !!p && !p.wide && glyphPrimitives(p).length > 0;
        return { tok, p, ok };
      }),
    [alg],
  );

  return (
    <div className={`cube-sh${className ? ` ${className}` : ''}`}>
      {items.map((it, i) => (
        <div className="cube-sh-item" key={i}>
          {it.ok && it.p ? (
            <MoveGlyph p={it.p} size={size} />
          ) : (
            <span className="cube-sh-bad" style={{ width: size, height: size }}>
              {it.tok}
            </span>
          )}
          {showLabels && <span className="cube-sh-label">{it.tok}</span>}
        </div>
      ))}
    </div>
  );
}

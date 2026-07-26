'use client';

/**
 * Shared paint primitives for the solver state painters.
 *
 * Both the 2D net painter (_InteractiveCubeNet) and the 3D rotatable cube
 * painter (_Interactive3DCube) edit the SAME URFDLB facelet string and obey the
 * same per-piece sticker rules (no duplicate / opposite colors on one cubie).
 * Constants + paint logic live here so the two views stay bit-identical.
 *
 * Everything order-specific (how many stickers, how many of each color, which
 * stickers share a cubie, what counts as legal, whether centers are fixed) is a
 * PaintSpec: CUBE3_PAINT here, CUBE2_PAINT in _paint-spec-222 (which owns the
 * 2×2 model so this module stays free of the pocket solver import). Every entry
 * point defaults to CUBE3_PAINT, so pre-existing 3×3 callers are unchanged.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { SOLVED_FACELET, STICKER_SIBLINGS, cubieToFacelet, validateFacelet } from './facelet';
import { applySequence, solvedCubie } from './_kociemba/cube';

export type FaceLetter = 'U' | 'R' | 'F' | 'D' | 'L' | 'B';
export type PaintColor = FaceLetter | 'X';

export const FACES: FaceLetter[] = ['U', 'R', 'F', 'D', 'L', 'B'];

/** WCA scheme — U white, R red, F green, D yellow, L orange, B blue. */
export const COLOR_HEX: Record<FaceLetter, string> = {
  U: '#ffffff',
  F: '#44ee00',
  R: '#ff0000',
  D: '#f4f400',
  B: '#2266ff',
  L: '#ff8000',
};
export const EMPTY_COLOR_HEX = '#5a5a5a';

export const OPPOSITE_FACE: Record<FaceLetter, FaceLetter> = {
  U: 'D', D: 'U',
  R: 'L', L: 'R',
  F: 'B', B: 'F',
};

/** All-empty facelet (every sticker 'X' except the 6 fixed centers). */
export const EMPTY_FACELET = (() => {
  const arr = new Array<string>(54).fill('X');
  FACES.forEach((c, i) => { arr[i * 9 + 4] = c; });
  return arr.join('');
})();

export { SOLVED_FACELET };

/** URFDLB face + (row,col) → facelet index (row-major per face; n = cube order). */
export function faceletIdx(face: FaceLetter, row: number, col: number, n = 3): number {
  return FACES.indexOf(face) * n * n + row * n + col;
}

/**
 * Everything the shared painters need to know about a cube order. `n` drives the
 * net layout / 3D cube order; the rest is the legality model.
 */
export interface PaintSpec {
  /** Cube order — 3 or 2. Non-NxN puzzles (skewb) set 0 and own their own canvas. */
  n: number;
  /** Sticker count = 6·n². */
  size: number;
  /** Max stickers per color = n² (a color's whole face). */
  maxPerColor: number;
  /** Per-sticker same-cubie partners (2 for a corner, 1 for an edge, 0 for a center). */
  siblings: ReadonlyArray<readonly number[]>;
  /** All-empty state ('X' everywhere paintable). */
  empty: string;
  solved: string;
  /** 3×3 has fixed centers (unpaintable, click-to-pick); 2×2 / skewb have none. */
  fixedCenters: boolean;
  /**
   * Per-face swatch colors. Defaults to the WCA cube scheme (COLOR_HEX); the skewb
   * spec overrides it with tnoodle's own scheme so the painter, the preview SVG and
   * the printed tnoodle sheet all show the same puzzle.
   */
  colors?: Readonly<Record<FaceLetter, string>>;
  /**
   * 对面色表(同一块上不能同时出现)。缺省 = 立方体那套 U↔D / R↔L / F↔B。
   * 金字塔要显式传 `{}`:它只有 4 个面且两两相邻,L 与 R 是**合法**的一条棱 ——
   * 沿用立方体的表会把真实存在的棱当非法拦掉。
   */
  opposite?: Readonly<Partial<Record<FaceLetter, FaceLetter>>>;
  /**
   * 中文报错里「块」怎么叫(如 `'一个角块'`)。只中文需要 —— 英文那几句一律说 "A piece",
   * 不点块型。默认按 `n` 推(二阶=角块,三阶=角/棱块)。
   */
  pieceLabel?: string;
  /** null = physically legal; otherwise a raw reason for `friendlyErr`. */
  validate: (facelet: string) => string | null;
  friendlyErr: (msg: string, isZh: boolean) => string;
  randomLegal: () => string;
}

export const CUBE3_PAINT: PaintSpec = {
  n: 3,
  size: 54,
  maxPerColor: 9,
  siblings: STICKER_SIBLINGS,
  empty: EMPTY_FACELET,
  solved: SOLVED_FACELET,
  fixedCenters: true,
  validate: validateFacelet,
  friendlyErr: friendlyValidErr,
  randomLegal: randomLegalFacelet,
};

/** A random *legal* state — 25 random HTM moves from solved. */
export function randomLegalFacelet(): string {
  const idxs: number[] = [];
  for (let i = 0; i < 25; i++) {
    const m = Math.floor(Math.random() * 18);
    if (idxs.length > 0 && Math.floor(m / 3) === Math.floor(idxs[idxs.length - 1] / 3)) {
      i--; continue;
    }
    if (idxs.length > 1
      && Math.floor(m / 3) % 3 === Math.floor(idxs[idxs.length - 1] / 3) % 3
      && Math.floor(m / 3) === Math.floor(idxs[idxs.length - 2] / 3)) {
      i--; continue;
    }
    idxs.push(m);
  }
  return cubieToFacelet(applySequence(solvedCubie(), idxs));
}

/** Translate a raw validateFacelet() error into a friendly bilingual sentence. */
export function friendlyValidErr(msg: string, isZh: boolean): string {
  const t = (z: string, e: string) => (isZh ? z : e);
  if (msg.includes('color counts != 9')) return t('每种颜色必须正好 9 格', 'Each color must appear exactly 9 times');
  if (msg.includes('not in centers')) return t('出现了非中心色字符', 'Sticker color does not match any center');
  if (msg.includes('corner permutation not bijective')) return t('某个角块出现两次(或缺失)', 'Some corner piece appears twice or is missing');
  if (msg.includes('edge permutation not bijective')) return t('某个棱块出现两次(或缺失)', 'Some edge piece appears twice or is missing');
  if (msg.includes('corner orientation sum')) return t('单个角块被扭了 ±120°(角朝向之和必须是 3 的倍数)', 'A single corner is twisted (corner orientation invariant)');
  if (msg.includes('edge orientation sum')) return t('单个棱块被翻了(棱翻转之和必须是偶数)', 'A single edge is flipped (edge orientation invariant)');
  if (msg.includes('parity mismatch')) return t('角棱排列奇偶不一致(只有两个块对调是不可能的)', 'Corner/edge permutation parity mismatch — single 2-cycle swap is impossible');
  if (msg.includes('no matching piece') && msg.includes('corner')) return t('某个角的颜色组合不存在(角必须由相邻 3 个面组成)', 'A corner has colors that cannot belong to any real cubelet');
  if (msg.includes('no matching piece') && msg.includes('edge')) return t('某个棱的颜色组合不存在(棱必须由相邻 2 个面组成)', 'An edge has colors that cannot belong to any real cubelet');
  if (msg.includes('no U/D sticker')) return t('某个角没有 U/D 面颜色(每个角必须含 U 或 D)', 'A corner has no U/D sticker (every corner must include U or D)');
  return msg;
}

export type PaintReject =
  | { kind: 'dup' }
  | { kind: 'opp'; sib: FaceLetter; active: FaceLetter }
  | { kind: 'full'; color: FaceLetter };
export type PaintOutcome = { ok: true; next: string } | { ok: false; reject: PaintReject };

/**
 * Paint sticker `idx` with `color`, enforcing the per-cubie rules: a single
 * piece can't carry two stickers of the same color, nor two opposite-face
 * colors, nor push a color's total count past one whole face (n²). Painting
 * 'X' (erase) is always allowed. Returns the next facelet or a rejection
 * reason (no mutation).
 */
export function paintSticker(
  facelet: string, idx: number, color: PaintColor, spec: PaintSpec = CUBE3_PAINT,
): PaintOutcome {
  if (color !== 'X') {
    const opposite = spec.opposite ?? OPPOSITE_FACE;
    for (const sib of spec.siblings[idx]) {
      const sibColor = facelet[sib] as PaintColor;
      if (sibColor === 'X') continue;
      if (sibColor === color) return { ok: false, reject: { kind: 'dup' } };
      if (opposite[sibColor as FaceLetter] === color) {
        return { ok: false, reject: { kind: 'opp', sib: sibColor as FaceLetter, active: color } };
      }
    }
    if (facelet[idx] !== color) {
      let count = 0;
      for (let i = 0; i < facelet.length; i++) if (facelet[i] === color) count++;
      if (count >= spec.maxPerColor) return { ok: false, reject: { kind: 'full', color } };
    }
  }
  const arr = facelet.split('');
  arr[idx] = color;
  return { ok: true, next: arr.join('') };
}

function rejectText(r: PaintReject, isZh: boolean, spec: PaintSpec): string {
  const t = (z: string, e: string) => (isZh ? z : e);
  // 二阶 / 斜转只有角块,三阶有角也有棱 —— 报错里别提不存在的块型(英文一律 "A piece")。
  const piece = spec.pieceLabel ?? (spec.n === 2 ? '一个角块' : '一个角/棱块');
  if (r.kind === 'dup') return t(`${piece}上不能有重复颜色`, 'A piece cannot have two stickers of the same color');
  if (r.kind === 'full') return t(`${r.color} 颜色已用满 ${spec.maxPerColor} 格`, `Color ${r.color} is already used on all ${spec.maxPerColor} stickers`);
  return t(
    `${piece}上不能同时含相对面颜色(${r.sib} 与 ${r.active})`,
    `A piece cannot have opposite-face colors (${r.sib} and ${r.active})`,
  );
}

/**
 * Paint controller shared by both painter views. Owns the transient reject
 * flash (a piece-rule violation), exposes `paint(idx, color?)` that either
 * commits via `onChange` or flashes a 2.5s rejection message. `color` defaults
 * to the active palette color; pass 'X' explicitly for a right-click erase.
 */
export function usePainter(opts: {
  facelet: string;
  onChange: (next: string) => void;
  activeColor: PaintColor;
  isZh: boolean;
  spec?: PaintSpec;
}) {
  const { facelet, onChange, activeColor, isZh, spec = CUBE3_PAINT } = opts;
  const [rejectMsg, setRejectMsg] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const paint = useCallback((idx: number, color: PaintColor = activeColor) => {
    const res = paintSticker(facelet, idx, color, spec);
    if (res.ok) {
      setRejectMsg(null);
      onChange(res.next);
    } else {
      setRejectMsg(rejectText(res.reject, isZh, spec));
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setRejectMsg(null), 2500);
    }
  }, [facelet, activeColor, onChange, isZh, spec]);

  return { paint, rejectMsg };
}

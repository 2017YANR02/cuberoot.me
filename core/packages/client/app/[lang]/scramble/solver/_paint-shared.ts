'use client';

/**
 * Shared paint primitives for the 3×3 solver state painters.
 *
 * Both the 2D net painter (_InteractiveCubeNet) and the 3D rotatable cube
 * painter (_Interactive3DCube) edit the SAME 54-char URFDLB facelet string and
 * obey the same per-piece sticker rules (no duplicate / opposite colors on one
 * cubie). Constants + paint logic live here so the two views stay bit-identical.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { SOLVED_FACELET, STICKER_SIBLINGS, cubieToFacelet } from './facelet';
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

/** URFDLB face + (row,col) → facelet index 0..53 (row-major per face). */
export function faceletIdx(face: FaceLetter, row: number, col: number): number {
  return FACES.indexOf(face) * 9 + row * 3 + col;
}

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

/** Every color (including its 1 fixed center) may appear at most this many times. */
const MAX_PER_COLOR = 9;

/**
 * Paint sticker `idx` with `color`, enforcing the per-cubie rules: a single
 * piece can't carry two stickers of the same color, nor two opposite-face
 * colors, nor push a color's total count past 9 (1 center + 8 others). Painting
 * 'X' (erase) is always allowed. Returns the next facelet or a rejection
 * reason (no mutation).
 */
export function paintSticker(facelet: string, idx: number, color: PaintColor): PaintOutcome {
  if (color !== 'X') {
    for (const sib of STICKER_SIBLINGS[idx]) {
      const sibColor = facelet[sib] as PaintColor;
      if (sibColor === 'X') continue;
      if (sibColor === color) return { ok: false, reject: { kind: 'dup' } };
      if (OPPOSITE_FACE[sibColor as FaceLetter] === color) {
        return { ok: false, reject: { kind: 'opp', sib: sibColor as FaceLetter, active: color } };
      }
    }
    if (facelet[idx] !== color) {
      let count = 0;
      for (let i = 0; i < facelet.length; i++) if (facelet[i] === color) count++;
      if (count >= MAX_PER_COLOR) return { ok: false, reject: { kind: 'full', color } };
    }
  }
  const arr = facelet.split('');
  arr[idx] = color;
  return { ok: true, next: arr.join('') };
}

function rejectText(r: PaintReject, isZh: boolean): string {
  const t = (z: string, e: string) => (isZh ? z : e);
  if (r.kind === 'dup') return t('一个角/棱块上不能有重复颜色', 'A piece cannot have two stickers of the same color');
  if (r.kind === 'full') return t(`${r.color} 颜色已用满 9 格`, `Color ${r.color} is already used on all 9 stickers`);
  return t(
    `一个角/棱块上不能同时含相对面颜色(${r.sib} 与 ${r.active})`,
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
}) {
  const { facelet, onChange, activeColor, isZh } = opts;
  const [rejectMsg, setRejectMsg] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const paint = useCallback((idx: number, color: PaintColor = activeColor) => {
    const res = paintSticker(facelet, idx, color);
    if (res.ok) {
      setRejectMsg(null);
      onChange(res.next);
    } else {
      setRejectMsg(rejectText(res.reject, isZh));
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setRejectMsg(null), 2500);
    }
  }, [facelet, activeColor, onChange, isZh]);

  return { paint, rejectMsg };
}

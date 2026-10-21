'use client';

/**
 * PlayerControls — alg playground for /sim (Next.js port).
 *
 * Differences from the Vite version:
 *  - The solution box uses the shared <AlgInput> (same auto-space normalisation
 *    as /recon/submit's solve field — issue #11). The scramble box stays a
 *    plain <textarea>. Auto-space is gated off for in-house corner-turn engine
 *    notations that use multi-letter tokens (dino/skewb/rex/heli/fto/megaminx
 *    all use "UFR"/"UF"/"BL" style names — auto-spacing would split them mid-
 *    token); it stays on for every single-letter-per-move notation (NxN/twisty
 *    WCA alg, Ivy, redi, pyraminx-engine, SQ1's digit-based format is a no-op
 *    either way). See `algAutoSpaceSafe` below.
 *  - Virtual keyboards (issue #32): 'alg' = CubeVirtualKeyboard writing into the
 *    solution box; 'qwerty' = SimQwertyKeypad mirroring the keymap (click =
 *    twist, same applyMove path as hard keys). Keyboards open only on request.
 *  - Scramble path uses tnoodleRandomScramble (lib/cubing-scramble.ts), which
 *    routes to cubing.js + the in-app pool. NxN N≥8 falls back to inline
 *    random-move (cheap, no solver needed).
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useT } from '@/hooks/useT';
import { SettingsPopover } from '@/components/TrainingSettings';
import { FlipHorizontal2, FlipVertical2, Eraser, Link2, Check, Keyboard, Grid3x3 } from '@app-foundation/icons/lucide';
import { Alg, Move } from 'cubing/alg';
import type { TwistyPlayer } from 'cubing/twisty';
import World from './engine/world';
import AlgTransformPanel from './AlgTransformPanel';
import { hasHandNotation } from './alg-manipulation';
import SimAppearancePanel from './SimAppearancePanel';
import type { SimPuzzle } from './puzzleOptions';
import { TwistAction } from './engine/nxn/twister';
import { timing } from './engine/tweenTiming';
import tweener from './engine/tweener';
import { parseSq1Scramble, type Sq1Move } from './engine/sq1/sq1State';
import { SQUARE_FAMILY_SPECS, formatSquareFamilyAlg, invertSquareFamilyMoves, randomSquareFamilyScramble, simplifySquareFamilyAlg, squareFamilyMovesToString, tryParseSquareFamilyMoves, type SquareFamilyKind, type SquareFamilyMove, type SquareFamilyNotationFormat } from './engine/squareFamily/squareFamilyState';
import { parseIvyMoves } from './engine/ivy/IvyTwister';
import type { IvyMove } from './engine/ivy/IvyCube';
import { getIvyMode, ivyScrambleForMode } from '@/lib/scramble-ivy-mode';
import { classifyIvyTokens } from '@/lib/ivy-solver';
import { parseDinoMoves, dinoMovesToString, randomDinoScramble, type DinoMove } from './engine/dino/dinoState';
import { parseRediMoves, rediMovesToString, randomRediScramble, type RediMove } from './engine/redi/rediState';
import { parseRexMoves, rexMovesToString, randomRexScramble, type RexMove } from './engine/rex/rexState';
import { parseHeliMoves, heliMovesToString, randomHeliScrambleMoves, type HeliMove } from './engine/heli/heliState';
import { parseGearMoves, gearMovesToString, invertGearMoves, reduceGearAlg, randomGearScrambleMoves, type GearAnyMove } from './engine/gear/gearState';
import { parseSkewbMoves, skewbMovesToString, randomSkewbScramble, isSkewbRot, type SkewbMove } from './engine/skewb/skewbState';
import { parsePyraMoves, pyraMovesToString, invertPyraMoves, reducePyraAlg, randomPyraScramble, type PyraMove } from './engine/pyra/pyraState';
import { parseMegaMoves, megaMovesToString, invertMegaMoves, reduceMegaAlg, randomMegaScramble, type MegaMove } from './engine/mega/megaState';
import { parseFtoMoves, ftoMovesToString, invertFtoMoves, randomFtoScramble, type FtoMove } from './engine/fto/ftoState';
import { parseFtoEifMoveGroups } from './engine/fto/ftoEifMoves';
import GhostCube from '@cuberoot/puzzle-render-core/engine/ghost/GhostCube';

import { GHOST_ALIGN, ghostAlignmentMoves, parseGhostMoves, ghostMovesToString, invertGhostMoves, reduceGhostAlg, ghostSequenceValid, type GhostMove } from '@cuberoot/puzzle-render-core/engine/ghost/ghostState';
import { parseClockSteps, clockStepsToString, invertClockSteps, type ClockStep } from '@/lib/clock-notation';
import { reduceClockAlg, randomClockScramble } from '@cuberoot/puzzle-solvers/clock';

/** Random Ivy scramble: ~9 R/L/D/B turns, no immediate axis repeat. */
function randomIvyScramble(): string {
  const L = 'RLDB';
  const out: string[] = [];
  let last = -1;
  for (let i = 0; i < 9; i++) {
    let a = Math.floor(Math.random() * 4);
    if (a === last) a = (a + 1 + Math.floor(Math.random() * 3)) % 4;
    last = a;
    out.push(L[a] + (Math.random() < 0.5 ? "'" : ''));
  }
  return ivyScrambleForMode(out.join(' '), getIvyMode());
}
import { invertAlg, simplifyAlg, simplifyTwistyAlg, mirrorAlg } from '@/lib/cube3';
import { convertKilominxAlg, fromCubingKilominx, type KilominxNotation } from '@/lib/kilominx-notation';
import MagicCube from '@cuberoot/puzzle-render-core/engine/magic/MagicCube';
import MagicRouteControls from './MagicRouteControls';
import { classifyMagicTokens, isMagicPuzzle, parseMagicMoves, magicMovesToString, invertMagicMoves, reduceMagicAlg, magicSequenceValid, magicSolution, type MagicMove, type MagicPuzzle } from '@cuberoot/puzzle-solvers/magic';
import { formatTimerCompoundScramble } from '@cuberoot/shared/timer';
import { classifyDuoTokens, duoMovesToString, generatePyraminxDuoScramble, invertDuoMoves, parseDuoMoves, reduceDuoAlg, type DuoMove } from '@cuberoot/puzzle-solvers/pyraminx-duo';
import { get_shortened_rotation } from '@/lib/roux/RotationHelp';
import { cleanForPlayer, extractAlgFromText, findTokenPositions, findWhitespaceTokenPositions, type TokenPosition } from '@/lib/recon-alg-utils';
import { deriveScrambleFromSolution } from '@/lib/scramble-from-solution';
import { tnoodleRandomScramble } from '@/lib/cubing-scramble';
import { pgRandomScramble } from '@/lib/pg-scramble';
import { generateNativePuzzleScramble, isNativePuzzleId } from '@cuberoot/puzzle-solvers/native-puzzles';
import { parseNativePuzzleAlg, simplifyNativePuzzleAlg } from '@cuberoot/puzzle-solvers/native-puzzle-model';
import { cloudOptimalScramble } from '@/lib/cloud-optimal-scramble';
import { useAuthStore } from '@/lib/auth-store';
import { formatScrambleForEvent, canonicalSq1Alg, compactSq1Alg, simplifySq1Alg, invertSq1Alg } from '@cuberoot/shared/sq1-notation';
import { toWca as toWcaSkewb, type SkewbNotation } from '@cuberoot/shared/skewb-notation';
import SkewbNotationGuide from './SkewbNotationGuide';
import { Slider, Toggle, KeymapModal, resetWorldView, mapFrames, DEFAULT_SETTINGS, type SimSettings, type SliderUnit } from './SettingDrawer';

import { KEYBOARD_ROWS, keyLabel, displayMove, type KeyMove } from './keymap';
import CubeVirtualKeyboard from '@/components/CubeVirtualKeyboard';
import ResetDefaultsButton from '@/components/ResetDefaultsButton';

import { isPgPuzzleId } from './pgCatalog';
import { isTwistyPuzzle } from './twistyPuzzles';
import { resolveCaps } from './simCaps';
import StickeringSelect from './StickeringSelect';

import type { PickGrain, CustomTreatment, CustomBrush } from '@/components/sim-embed/customStickering';
import { simulateGrips, type GripName, type GripSimStep, type HandSide, type PinSpec } from './engine/hands/handsRig';
import { flattenAlg, stm, stripGripMarks } from '@cuberoot/shared/alg-notation';
import { canonicalFtoEifAlgorithm, invertFtoEifAlgorithm, reduceFtoEifAlgorithm } from '@cuberoot/shared/fto-notation';
import { stripFtnBlocks, FTN_TOKEN, parseFtnPin } from './engine/hands/ftn';
export { SIM_FIXED_PUZZLE_OPTIONS } from './puzzleOptions';
import { simSpeedToTps, simTpsToSpeed } from '@/lib/sim_timing';
import SimAlgEditor, { type SimAlgHighlightSpan } from './SimAlgEditor';
import ReconAutofill from '@/components/ReconAutofill';
import PlaybackBar from '@/components/PlaybackBar';
import { CompactSelect } from '@/components/CompactSelect';
import { createTwistyPlayback, EMPTY_TWISTY_PLAYBACK_STATE, type TwistyPlaybackPlayer, type TwistyPlaybackState } from '@/lib/twisty-playback';

import './player-controls.css';

/**
 * 换握记号(仅 NxN 解法框):↑ 上手(拇指起手在 U 面)、↓ 下手(D 面)、· 回 home 握。
 * 记号是播放步(占一步、驱动手部换握动画),对魔方状态零作用;手没开时照常跳过。
 * 手别由空白定(FINGERTRICKS §2,2026-07-10 用户规格):记号**紧贴**后续字符
 * (`↑U`)= 右手;后随空白/串尾(`↑ U`)= 左手。双手 = 紧贴链尾随空白(`↑↑ U`)。
 */
const GRIP_MARKS: Record<string, GripName> = { '↑': 'up', '↓': 'down', '·': 'home' };
const GRIP_MARK_SPLIT = /([↑↓·])/;

/** Char offsets of grip marks in `text` (line comments excluded — mirrors the
 *  `noComments` pass parseNxnItems does before splitting on GRIP_MARK_SPLIT). */
function findGripMarkPositions(text: string): number[] {
  const positions: number[] = [];
  let offset = 0;
  for (const line of text.split(/\r?\n/)) {
    const commentIdx = line.indexOf('//');
    const instr = commentIdx >= 0 ? line.slice(0, commentIdx) : line;
    for (let i = 0; i < instr.length; i++) {
      if (GRIP_MARKS[instr[i]]) positions.push(offset + i);
    }
    offset += line.length + 1;
  }
  return positions;
}

/** 指法后缀 `p`(推法,FINGERTRICKS.md §2):空白分隔的单招 token 尾接 p,如
 *  `U'p` = 右食指推 U'。喂 cubing.js / 变换工具前必须剥(Alg 解析不了)。 */
const PUSH_TOKEN = /^([A-Za-z]w?[2']{0,2})p$/;
const stripPushMarks = (s: string): string =>
  s.split(/(\s+)/).map((tok) => { const m = PUSH_TOKEN.exec(tok); return m ? m[1] : tok; }).join('');
/** 变换/导出前剥全部手部记号(FTN 注解块 + 换握 ↑↓· + 推法 p 后缀;块先剥,
 *  `U'p[…]` 先塌成 `U'p` 再剥 p)。 */
export const stripHandMarks = (s: string): string => stripPushMarks(stripGripMarks(stripFtnBlocks(s)));

type NxnPlayItem = { kind: 'move'; action: TwistAction; push?: boolean; pin?: PinSpec } | { kind: 'grip'; grip: GripName; side: HandSide };

/** 手部转前闸(与 isRegripping 同款节拍):登记 quarters/push 提示(连拨、
 *  推法分类用,FINGERTRICKS.md),该步若需前置就位(F 族越顶 / U'p / D2' 小指)
 *  则启动/等待伸指动画并返回 true —— 调用方本轮不发 twist,下轮再问;
 *  false = 无需前置或已到位。 */
function gateHandsReach(world: World | null, cube: import('./engine/nxn/cube').default, action: TwistAction, push = false, pin?: PinSpec): boolean {
  const hands = world?.hands;
  if (!hands?.isEnabled) return false;
  // 上一步 reach 式手势(topPush/U'p/D2' 小指/@pin 钉指)收指未完先等:weld
  // 会把伸在魔方上方的指链烘着整手转进方块(oracle 实证 −11U)。
  if (hands.isReachRetreating) return true;
  const rotates = cube.table.convert(action);
  if (!rotates.length) return false;
  return hands.prepareTwist(
    rotates[0].group.axis as 'x' | 'y' | 'z',
    rotates.map((r) => r.group.layer),
    rotates[0].twist > 0 ? 1 : -1,
    Math.abs(rotates[0].twist),
    push,
    pin,
  );
}

/** NxN 解法串 → 播放项(move + 换握记号)。坏 token 由 Alg 抛错,调用方 catch。
 *  注释先剥(cleanForPlayer 在记号切分之后才跑,注释里的 ↑/↓/· 不能算步)。 */
function parseNxnItems(text: string): NxnPlayItem[] {
  const noComments = text
    .split(/\r?\n/)
    .map((l) => { const i = l.indexOf('//'); return i >= 0 ? l.slice(0, i) : l; })
    .join('\n');
  const items: NxnPlayItem[] = [];
  const segs = noComments.split(GRIP_MARK_SPLIT);
  for (let si = 0; si < segs.length; si++) {
    const seg = segs[si];
    const grip = GRIP_MARKS[seg];
    if (grip) {
      // 手别空格规则(FINGERTRICKS §2):紧贴后续字符 = 右手;后随空白/串尾 = 左手。
      // split-capture 交替 [文本,记号,文本,…]:后继文本段空 ⇒ 要么紧贴下一记号
      // (还有后续段,右手),要么串尾(左手)。
      const next = segs[si + 1] ?? '';
      const glued = next ? !/^\s/.test(next) : si + 2 < segs.length;
      items.push({ kind: 'grip', grip, side: glued ? 'R' : 'L' });
      continue;
    }
    if (!seg.trim()) continue;
    // p 后缀(推法记号):只认空白分隔的单招 token;无 p 记号时整段一次性
    // 走原路径(行为零变化)。缓冲分段解析保持步序。
    let buf = '';
    const flush = (): void => {
      if (!buf.trim()) { buf = ''; return; }
      const cleaned = cleanForPlayer(buf);
      buf = '';
      for (const node of new Alg(cleaned).expand().childAlgNodes()) {
        if (node instanceof Move) items.push({ kind: 'move', action: new TwistAction(node.toString()) });
      }
    };
    for (const chunk of seg.split(/(\s+)/)) {
      // FTN 注解 token(招式尾紧贴 [...],§7):剥块取招式,能解析出 @pin 则挂
      // 到该步;无法识别的块按 §7.4 剥净后招式照播(落回缓冲)。
      const fm = FTN_TOKEN.exec(chunk);
      if (fm) {
        let core = fm[1];
        let push = false;
        const pm = PUSH_TOKEN.exec(core);
        if (pm) { core = pm[1]; push = true; }
        let mv: Move | null = null;
        try {
          const nodes = [...new Alg(core).expand().childAlgNodes()];
          if (nodes.length === 1 && nodes[0] instanceof Move) mv = nodes[0];
        } catch { /* 非法招式:剥块后落回缓冲 */ }
        if (mv) {
          flush();
          const pin = parseFtnPin(fm[2], mv.toString());
          items.push({ kind: 'move', action: new TwistAction(mv.toString()), ...(push ? { push: true } : {}), ...(pin ? { pin } : {}) });
        } else {
          buf += fm[1];
        }
        continue;
      }
      const m = PUSH_TOKEN.exec(chunk);
      if (m) {
        let mv: Move | null = null;
        try {
          const nodes = [...new Alg(m[1]).expand().childAlgNodes()];
          if (nodes.length === 1 && nodes[0] instanceof Move) mv = nodes[0];
        } catch { /* 非法招式:当普通文本落回缓冲 */ }
        if (mv) {
          flush();
          items.push({ kind: 'move', action: new TwistAction(mv.toString()), push: true });
          continue;
        }
      }
      buf += chunk;
    }
    flush();
  }
  return items;
}

/** Convert Square-family text while preserving per-line `// comments` and newlines. */
function convertSquareText(text: string, convert: (s: string) => string): string {
  return text.split('\n').map(line => {
    const commentIdx = line.indexOf('//');
    const algPart = commentIdx >= 0 ? line.slice(0, commentIdx) : line;
    const comment = commentIdx >= 0 ? line.slice(commentIdx) : '';
    const converted = algPart.trim() ? convert(algPart) : '';
    return comment ? `${converted}  ${comment}` : converted;
  }).join('\n');
}

/** Random-move NxN scrambler for N≥8 (no solver). */
const SCRAMBLE_FACES = ['U', 'D', 'L', 'R', 'F', 'B'] as const;
const SCRAMBLE_AXIS_OF: Record<string, number> = {
  U: 0, D: 0, L: 1, R: 1, F: 2, B: 2,
};
const SCRAMBLE_SUFFIXES = ['', "'", '2'] as const;

function randomMoveScrambleNxN(N: number): string {
  if (N < 2) return '';
  const length = N >= 5 ? 20 * (N - 2) : Math.max(20, 9 * N);
  const maxDepth = Math.max(1, Math.floor(N / 2));
  const moves: string[] = [];
  let prevAxis = -1;
  let prevPrevAxis = -1;
  let prevFace = '';
  while (moves.length < length) {
    const face = SCRAMBLE_FACES[Math.floor(Math.random() * 6)];
    const axis = SCRAMBLE_AXIS_OF[face];
    if (face === prevFace) continue;
    if (axis === prevAxis && axis === prevPrevAxis) continue;
    const depth = 1 + Math.floor(Math.random() * maxDepth);
    const suffix = SCRAMBLE_SUFFIXES[Math.floor(Math.random() * SCRAMBLE_SUFFIXES.length)];
    const prefix = depth >= 3 ? String(depth) : '';
    const wide = depth >= 2 ? 'w' : '';
    moves.push(`${prefix}${face}${wide}${suffix}`);
    prevPrevAxis = prevAxis;
    prevAxis = axis;
    prevFace = face;
  }
  return moves.join(' ');
}

/** SimPage puzzle kind. */
export type { SimPuzzle } from './puzzleOptions';

interface SquarePlaybackCube {
  twister: {
    finish(): void;
    setup(scramble: string): void;
    twist(move: Sq1Move, fast: boolean, force: boolean): boolean;
  };
  applyMoveInstant(move: Sq1Move): void;
}

const SAME_AXIS_1X1: Record<string, 'x' | 'y' | 'z'> = {
  R: 'x', U: 'y', F: 'z', S: 'z',
};
const OPP_AXIS_1X1: Record<string, 'x' | 'y' | 'z'> = {
  L: 'x', D: 'y', B: 'z', M: 'x', E: 'y',
};

function invertDinoMoves(moves: DinoMove[]): DinoMove[] {
  const out: DinoMove[] = [];
  for (let i = moves.length - 1; i >= 0; i--) {
    out.push({ corner: moves[i].corner, dir: moves[i].dir === 1 ? -1 : 1 });
  }
  return out;
}

/** Fold consecutive same-corner Dino twists mod 3 (X X = X', X X' = id, …). */
function reduceDinoAlg(s: string): string {
  const moves = parseDinoMoves(s);
  const out: DinoMove[] = [];
  for (const m of moves) {
    const last = out[out.length - 1];
    if (last && last.corner === m.corner) {
      // accumulate net turns mod 3 (dir +1 = +120, -1 = -120 ≡ +240)
      const net = (((last.dir === 1 ? 1 : 2) + (m.dir === 1 ? 1 : 2)) % 3 + 3) % 3;
      out.pop();
      if (net === 1) out.push({ corner: m.corner, dir: 1 });
      else if (net === 2) out.push({ corner: m.corner, dir: -1 });
      // net === 0 → cancelled, push nothing
    } else {
      out.push(m);
    }
  }
  return dinoMovesToString(out);
}

function invertRediMoves(moves: RediMove[]): RediMove[] {
  const out: RediMove[] = [];
  for (let i = moves.length - 1; i >= 0; i--) {
    out.push({ corner: moves[i].corner, dir: moves[i].dir === 1 ? -1 : 1 });
  }
  return out;
}

/** Fold consecutive same-corner Redi twists mod 3 (X X = X', X X' = id, …). */
function reduceRediAlg(s: string): string {
  const moves = parseRediMoves(s);
  const out: RediMove[] = [];
  for (const m of moves) {
    const last = out[out.length - 1];
    if (last && last.corner === m.corner) {
      const net = (((last.dir === 1 ? 1 : 2) + (m.dir === 1 ? 1 : 2)) % 3 + 3) % 3;
      out.pop();
      if (net === 1) out.push({ corner: m.corner, dir: 1 });
      else if (net === 2) out.push({ corner: m.corner, dir: -1 });
    } else {
      out.push(m);
    }
  }
  return rediMovesToString(out);
}

function invertRexMoves(moves: RexMove[]): RexMove[] {
  const out: RexMove[] = [];
  for (let i = moves.length - 1; i >= 0; i--) {
    out.push({ corner: moves[i].corner, dir: moves[i].dir === 1 ? -1 : 1 });
  }
  return out;
}

/** Fold consecutive same-corner Rex twists mod 3 (X X = X', X X' = id, …). */
function reduceRexAlg(s: string): string {
  const moves = parseRexMoves(s);
  const out: RexMove[] = [];
  for (const m of moves) {
    const last = out[out.length - 1];
    if (last && last.corner === m.corner) {
      const net = (((last.dir === 1 ? 1 : 2) + (m.dir === 1 ? 1 : 2)) % 3 + 3) % 3;
      out.pop();
      if (net === 1) out.push({ corner: m.corner, dir: 1 });
      else if (net === 2) out.push({ corner: m.corner, dir: -1 });
    } else {
      out.push(m);
    }
  }
  return rexMovesToString(out);
}

/** Invert a Helicopter sequence: every edge twist is a 180° involution, so the inverse
 *  is just the reversed sequence (each move unchanged). */
function invertHeliMoves(moves: HeliMove[]): HeliMove[] {
  return [...moves].reverse();
}

function invertSkewbMoves(moves: SkewbMove[]): SkewbMove[] {
  const out: SkewbMove[] = [];
  for (let i = moves.length - 1; i >= 0; i--) {
    const m = moves[i];
    // Rotation inverse: x2 stays x2, else flip the quarter turn. Grip inverse: flip dir.
    if (isSkewbRot(m)) out.push({ rot: m.rot, dir: m.dir === 2 ? 2 : (m.dir === 1 ? -1 : 1) });
    else out.push({ corner: m.corner, dir: m.dir === 1 ? -1 : 1 });
  }
  return out;
}

/** Fold consecutive same-grip Skewb twists mod 3 (X X = X', X X' = id, …). Rotations
 *  are left as-is (only same-grip twists cancel). */
function reduceSkewbAlg(s: string): string {
  const moves = parseSkewbMoves(s);
  const out: SkewbMove[] = [];
  for (const m of moves) {
    const last = out[out.length - 1];
    if (!isSkewbRot(m) && last && !isSkewbRot(last) && last.corner === m.corner) {
      const net = (((last.dir === 1 ? 1 : 2) + (m.dir === 1 ? 1 : 2)) % 3 + 3) % 3;
      out.pop();
      if (net === 1) out.push({ corner: m.corner, dir: 1 });
      else if (net === 2) out.push({ corner: m.corner, dir: -1 });
    } else {
      out.push(m);
    }
  }
  return skewbMovesToString(out);
}

// ── Corner/edge-turn engine puzzles registry ────────────────────────────────────
// Dino / Redi / Rex / Heli / Skewb are all discrete corner-or-edge-turn engine
// puzzles whose player logic (parse / invert / 消步 / scramble / replay) is identical
// in shape — only the per-puzzle move functions differ. Capturing those 5 differences
// per puzzle in one descriptor collapses what used to be ~13 parallel `isDino||isRedi
// ||…` branches into a single `corner` lookup. Adding a corner-turn puzzle = one entry
// here + one line in `cornerKind` below (mirrors the engine/cornerTurnGesture adapters).
// 「corner」是历史名字,准确说是"离散整步、逐招重放"的引擎拼图 —— 魔表(转的是表盘,一步
// 30° 的倍数)与它们形状完全一致,所以也走这张表,而不是再开一条 isClock 分支链。
type CornerKind = 'dino' | 'redi' | 'rex' | 'heli' | 'gear' | 'ghost' | 'skewb' | 'pyraminx' | 'pyraminx_duo' | 'megaminx' | 'fto' | 'clock' | 'magic' | 'mmagic';

interface CornerSpec {
  /** Optional per-token validation for both editable text tracks. */
  classify?(s: string): Array<{ text: string; bad: boolean }>;
  /** Opt out when the generic six-face M/S mirror grammar does not apply. */
  cubeMirrors?: boolean;
  /** Bounded folding routes have explicit starts; inverse anchoring does not apply. */
  endAnchor?: boolean;
  sequenceValid?(setup: string, algorithm: string): boolean;
  /** Parse alg / scramble text → the puzzle's move list. */
  parse(s: string): unknown[];
  /** Optional notation-token groups for moves that expand to multiple physical turns. */
  parseGroups?(s: string): unknown[][];
  /** Move list → canonical text. */
  toString(moves: unknown[]): string;
  /** The inverse sequence (for the "Algorithm" playback base + 取逆 tool). */
  invert(moves: unknown[]): unknown[];
  /** Text-level inverse for grouped notation whose timeline tokens must stay intact. */
  invertText?(s: string): string;
  /** Fold / cancel redundant moves (消步). */
  reduce(s: string): string;
  /** A fresh random scramble string. */
  scramble(): string;
}

/** Uniform cube surface every corner-turn engine cube exposes (move type erased to
 *  `unknown` — the move always comes from the same puzzle's spec, so it matches). */
interface CornerCube {
  twister: {
    readonly length: number;
    readonly busy?: boolean;
    finish(): void;
    setup(s: string): void;
    push(s: string): void;
    twist(move: unknown, fast: boolean, force: boolean): boolean;
    setupMoves?(moves: readonly unknown[], init?: string): void;
    pushMoves?(moves: readonly unknown[]): void;
  };
  applyMoveInstant(move: unknown): void;
}

function magicSpec(puzzle: MagicPuzzle): CornerSpec {
  return {
    cubeMirrors: false, endAnchor: false,
    classify: text => classifyMagicTokens(text, puzzle),
    parse: text => parseMagicMoves(text, puzzle),
    toString: moves => magicMovesToString(moves as MagicMove[]),
    invert: moves => invertMagicMoves(moves as MagicMove[]),
    reduce: text => reduceMagicAlg(text, puzzle),
    sequenceValid: (setup, algorithm) => magicSequenceValid(puzzle, setup, algorithm),
    scramble: () => formatTimerCompoundScramble(puzzle, []),
  };
}

const CORNER_SPECS: Record<CornerKind, CornerSpec> = {
  magic: magicSpec('magic'),
  mmagic: magicSpec('mmagic'),
  ghost: {
    cubeMirrors: false,
    parse: parseGhostMoves,
    toString: (m) => ghostMovesToString(m as GhostMove[]),
    invert: (m) => invertGhostMoves(m as GhostMove[]),
    reduce: reduceGhostAlg,
    scramble: () => `${GHOST_ALIGN} ${randomMoveScrambleNxN(3)}`,
  },
  dino: {
    parse: parseDinoMoves,
    toString: (m) => dinoMovesToString(m as DinoMove[]),
    invert: (m) => invertDinoMoves(m as DinoMove[]),
    reduce: reduceDinoAlg,
    scramble: () => dinoMovesToString(randomDinoScramble(15)),
  },
  redi: {
    parse: parseRediMoves,
    toString: (m) => rediMovesToString(m as RediMove[]),
    invert: (m) => invertRediMoves(m as RediMove[]),
    reduce: reduceRediAlg,
    scramble: () => rediMovesToString(randomRediScramble(20)),
  },
  rex: {
    parse: parseRexMoves,
    toString: (m) => rexMovesToString(m as RexMove[]),
    invert: (m) => invertRexMoves(m as RexMove[]),
    reduce: reduceRexAlg,
    scramble: () => rexMovesToString(randomRexScramble(25)),
  },
  heli: {
    parse: parseHeliMoves,
    toString: (m) => heliMovesToString(m as HeliMove[]),
    invert: (m) => invertHeliMoves(m as HeliMove[]),
    reduce: reduceHeliAlg,
    scramble: () => heliMovesToString(randomHeliScrambleMoves(20)),
  },
  gear: {
    parse: parseGearMoves,
    toString: (m) => gearMovesToString(m as GearAnyMove[]),
    invert: (m) => invertGearMoves(m as GearAnyMove[]),
    reduce: reduceGearAlg,
    // uniform random state + optimal path (lib/gear-solver, cstimer gearo semantics)
    scramble: () => gearMovesToString(randomGearScrambleMoves()),
  },
  skewb: {
    parse: parseSkewbMoves,
    toString: (m) => skewbMovesToString(m as SkewbMove[]),
    invert: (m) => invertSkewbMoves(m as SkewbMove[]),
    reduce: reduceSkewbAlg,
    scramble: () => skewbMovesToString(randomSkewbScramble(12)),
  },
  pyraminx: {
    parse: parsePyraMoves,
    toString: (m) => pyraMovesToString(m as PyraMove[]),
    invert: (m) => invertPyraMoves(m as PyraMove[]),
    reduce: reducePyraAlg,
    scramble: () => pyraMovesToString(randomPyraScramble(10)),
  },
  pyraminx_duo: {
    classify: classifyDuoTokens,
    cubeMirrors: false,
    parse: parseDuoMoves,
    toString: (m) => duoMovesToString(m as DuoMove[]),
    invert: (m) => invertDuoMoves(m as DuoMove[]),
    reduce: reduceDuoAlg,
    scramble: generatePyraminxDuoScramble,
  },
  megaminx: {
    parse: parseMegaMoves,
    toString: (m) => megaMovesToString(m as MegaMove[]),
    invert: (m) => invertMegaMoves(m as MegaMove[]),
    reduce: reduceMegaAlg,
    scramble: () => megaMovesToString(randomMegaScramble(30)),
  },
  fto: {
    parse: parseFtoMoves,
    parseGroups: (s) => {
      const parsed = parseFtoEifMoveGroups(s);
      if (parsed.invalid.length > 0) throw new Error(`Invalid FTO notation: ${parsed.invalid.join(' ')}`);
      return parsed.groups;
    },
    toString: (m) => ftoMovesToString(m as FtoMove[]),
    invert: (m) => invertFtoMoves(m as FtoMove[]),
    invertText: invertFtoEifAlgorithm,
    reduce: (s) => reduceFtoEifAlgorithm(s) ?? canonicalFtoEifAlgorithm(s) ?? s,
    scramble: () => ftoMovesToString(randomFtoScramble(30)),
  },
  // 魔表:一"步" = 一次拧 或 一次 y2 翻面(y2 在记号里是独立 token,得能单独跨过去)。
  // 消步吃阿贝尔性可跨位置合并;打乱是均匀随机态反推,与官方打乱同分布同格式。
  clock: {
    parse: parseClockSteps,
    toString: (m) => clockStepsToString(m as ClockStep[]),
    invert: (m) => invertClockSteps(m as ClockStep[]),
    reduce: reduceClockAlg,
    scramble: () => randomClockScramble(),
  },
};

function parseCornerGroups(spec: CornerSpec, text: string): unknown[][] {
  return spec.parseGroups?.(text) ?? spec.parse(text).map((move) => [move]);
}

/** Collapse adjacent identical edge twists (X X = identity — each is an involution). */
function reduceHeliAlg(s: string): string {
  const moves = parseHeliMoves(s);
  const out: HeliMove[] = [];
  for (const m of moves) {
    const last = out[out.length - 1];
    if (last && last.edge === m.edge) out.pop(); // X X = id
    else out.push(m);
  }
  return heliMovesToString(out);
}

function normalizeTo1x1(action: TwistAction): TwistAction | null {
  const s = action.sign;
  if (s === 'x' || s === 'y' || s === 'z') return action;
  const bare = s.endsWith('w') ? s.slice(0, -1).toUpperCase() : s;
  if (SAME_AXIS_1X1[bare]) return new TwistAction(SAME_AXIS_1X1[bare], action.reverse, action.times);
  if (OPP_AXIS_1X1[bare]) return new TwistAction(OPP_AXIS_1X1[bare], !action.reverse, action.times);
  return null;
}

/** Grow / shrink a textarea to fit its content (rows={1} + this = auto-height). */
function autosize(el: HTMLTextAreaElement | null): void {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
}

/** Splice a `[start, end)` "currently playing" range across a span list, tagging
 *  the overlapping slice(s) `current` (and slicing a span in two/three when the
 *  range only partly covers it) — same mirror-overlay trick the Ivy `bad`
 *  highlighting already uses (`.sim-player-hl`), just orange instead of red and
 *  driven by playback position instead of live validation. */
function applyAlgHighlight(spans: SimAlgHighlightSpan[], range: [number, number] | null): SimAlgHighlightSpan[] {
  if (!range) return spans;
  const [hs, he] = range;
  if (he <= hs) return spans;
  const out: SimAlgHighlightSpan[] = [];
  let pos = 0;
  for (const s of spans) {
    const start = pos;
    const end = pos + s.text.length;
    pos = end;
    if (end <= hs || start >= he) { out.push(s); continue; }
    const preLen = Math.max(0, hs - start);
    const postStart = Math.min(s.text.length, Math.max(preLen, he - start));
    if (preLen > 0) out.push({ ...s, text: s.text.slice(0, preLen) });
    if (postStart > preLen) out.push({ ...s, text: s.text.slice(preLen, postStart), current: true });
    if (postStart < s.text.length) out.push({ ...s, text: s.text.slice(postStart) });
  }
  return out;
}

// 整体转体的「消步」:cubing.js 的 simplifyAlg 只抵消相邻同轴,不会把一串
// x/y/z 折成最短等价转体。复用 recon/roux 的 get_shortened_rotation(整 24 朝向
// 解最短转体串),按面转切段、只对纯转体的连续段求最短,面转原样保留。仅 NxN。
const ROT_TOKEN_RE = /^[xyz][2']?$/;
function shortenRotations(alg: string): string {
  const toks = alg.trim().split(/\s+/).filter(Boolean);
  if (toks.length < 2) return alg.trim();
  const out: string[] = [];
  let run: string[] = [];
  const flush = () => {
    if (!run.length) return;
    if (run.length === 1) { out.push(run[0]); run = []; return; }
    let short = run.join(' ');
    try { short = get_shortened_rotation(run.join(' ')).trim(); } catch { /* keep raw */ }
    if (short) out.push(short);
    run = [];
  };
  for (const t of toks) {
    if (ROT_TOKEN_RE.test(t)) run.push(t);
    else { flush(); out.push(t); }
  }
  flush();
  return out.join(' ');
}

// ─── NxN 同轴消步(逐层向量法)───────────────────────────────────────────────
// 同一空间轴上的所有转动(面 / 编号层 / 宽层 / 中层 / 整体转体)两两可交换,故一段
// 极大同轴连续段完全由「每层净转量」决定。把段内每个 token 展开成各层增量,累加成
// 向量 amt[1..N](层 1 = 主面那侧,正向 = 主面方向),再合成最短等价 token 串。这样
// 覆盖一切等价写法:M' R → r、L' r → x、L' 3r → x、R 2R L' 2L' → x、x R x' → R …。
// 关键:抽出整体转体 x/y/z(把所有层同量并掉);仅当严格更短才采用转体写法,否则保留
// 逐层折叠基线(S→S、d2 Uw 等不被改长)。各轴主面 P(+1)/ 对面 Q(-1):
//   x: R / L (中层 M 随 L,-1)   y: U / D (E 随 D,-1)   z: F / B (S 随 F,+1)
const AXIS_CFG = {
  x: { rot: 'x', P: { face: 'R', wide: 'r', fams: ['R', 'Rw', 'r'] }, Q: { face: 'L', wide: 'l', fams: ['L', 'Lw', 'l'] }, slice: 'M', sliceSign: -1 },
  y: { rot: 'y', P: { face: 'U', wide: 'u', fams: ['U', 'Uw', 'u'] }, Q: { face: 'D', wide: 'd', fams: ['D', 'Dw', 'd'] }, slice: 'E', sliceSign: -1 },
  z: { rot: 'z', P: { face: 'F', wide: 'f', fams: ['F', 'Fw', 'f'] }, Q: { face: 'B', wide: 'b', fams: ['B', 'Bw', 'b'] }, slice: 'S', sliceSign: 1 },
} as const;
type AxisKey = keyof typeof AXIS_CFG;
const WIDE_FAMS = new Set(['Rw', 'r', 'Lw', 'l', 'Uw', 'u', 'Dw', 'd', 'Fw', 'f', 'Bw', 'b']);
const AXIS_OF: Record<string, AxisKey> = {};
for (const ax of Object.keys(AXIS_CFG) as AxisKey[]) {
  const c = AXIS_CFG[ax];
  for (const f of [...c.P.fams, ...c.Q.fams, c.slice, c.rot]) AXIS_OF[f] = ax;
}
const m4n = (n: number) => ((n % 4) + 4) % 4;
const amtSuffix = (k: number) => (k === 1 ? '' : k === 2 ? '2' : k === 3 ? "'" : '');

// 一个 token → 各层(主面侧 1..N)增量;null = 无法稳妥分解(偶数阶中层等)→ 整段保留原样
function moveToDeltas(m: Move, axis: AxisKey, N: number): { idx: number; delta: number }[] | null {
  const c = AXIS_CFG[axis];
  const fam = m.family, a = m.amount;
  if (fam === c.rot) return Array.from({ length: N }, (_, i) => ({ idx: i + 1, delta: a }));
  if (fam === c.slice) {
    if (N % 2 === 0) return null;                 // 偶数阶无单一中层 → 保留
    return [{ idx: (N + 1) / 2, delta: c.sliceSign * a }];
  }
  const onP = (c.P.fams as readonly string[]).includes(fam);
  const onQ = (c.Q.fams as readonly string[]).includes(fam);
  if (!onP && !onQ) return null;
  const sign = onP ? 1 : -1;
  let d1: number, d2: number;
  if (WIDE_FAMS.has(fam)) { d1 = m.outerLayer ?? 1; d2 = m.innerLayer ?? 2; }
  else if (m.innerLayer != null) { if (m.outerLayer != null) return null; d1 = d2 = m.innerLayer; }
  else { d1 = d2 = 1; }
  if (d1 < 1 || d2 > N || d1 > d2) return null;
  const out: { idx: number; delta: number }[] = [];
  for (let d = d1; d <= d2; d++) out.push({ idx: onP ? d : N + 1 - d, delta: sign * a });
  return out;
}

// 一段「层 lo..hi 同转量 g(1..3,主面方向)」→ 单个 token(就近选主面 / 对面侧记号)
function emitRun(lo: number, hi: number, g: number, axis: AxisKey, N: number): string {
  const c = AXIS_CFG[axis];
  if (lo === 1 && hi === N) return c.rot + amtSuffix(g);          // 全部层 → 整体转体
  if (lo === 1) {                                                  // 贴主面:R / r / 3r …
    if (hi === 1) return c.P.face + amtSuffix(g);
    if (hi === 2) return c.P.wide + amtSuffix(g);
    return `${hi}${c.P.wide}` + amtSuffix(g);
  }
  if (hi === N) {                                                  // 贴对面:L / l / 3l …
    const dq = N - lo + 1, q = m4n(-g);
    if (dq === 1) return c.Q.face + amtSuffix(q);
    if (dq === 2) return c.Q.wide + amtSuffix(q);
    return `${dq}${c.Q.wide}` + amtSuffix(q);
  }
  if (lo === hi) {                                                 // 内部单层:就近编号
    const pIdx = lo, qIdx = N + 1 - lo;
    return pIdx <= qIdx ? `${pIdx}${c.P.face}` + amtSuffix(g) : `${qIdx}${c.Q.face}` + amtSuffix(m4n(-g));
  }
  return `${lo}-${hi}${c.P.wide}` + amtSuffix(g);                  // 内部连续段:范围宽层 2-3u(小写;2-3Uw 也照样解析)
}

// 逐层向量 → 最短 token 串。枚举抽出的整体转体量 r∈0..3,各取残差按极大等量连续段成串;
// '<' 比较使平局偏向 r=0(不无故引入转体)。
function synthesizeAxis(amt: number[], axis: AxisKey, N: number): { str: string; tokCount: number } {
  let best: { str: string; tokCount: number } | null = null;
  for (let r = 0; r <= 3; r++) {
    const res = amt.map((v) => m4n(v - r));
    const toks: string[] = [];
    let i = 1;
    while (i <= N) {
      if (res[i - 1] === 0) { i++; continue; }
      let j = i;
      while (j + 1 <= N && res[j] === res[i - 1]) j++;
      toks.push(emitRun(i, j, res[i - 1], axis, N));
      i = j + 1;
    }
    const tokCount = toks.length + (r !== 0 ? 1 : 0);
    if (best === null || tokCount < best.tokCount) {
      const parts = r !== 0 ? [AXIS_CFG[axis].rot + amtSuffix(r), ...toks] : toks;
      best = { str: parts.join(' '), tokCount };
    }
  }
  return best!;
}

// 逐层折叠基线:按 family+层号合并、求和取模、丢空操作。token 数恒 ≤ 输入 → 防消步变长。
function foldRun(moves: Move[]): { str: string; tokCount: number } {
  const sums = new Map<string, number>(), rep = new Map<string, Move>(), keys: string[] = [];
  for (const m of moves) {
    const k = `${m.family}|${m.outerLayer ?? ''}|${m.innerLayer ?? ''}`;
    if (!sums.has(k)) { keys.push(k); rep.set(k, m); }
    sums.set(k, (sums.get(k) ?? 0) + m.amount);
  }
  const toks: string[] = [];
  for (const k of keys) {
    const w = m4n(sums.get(k) ?? 0);
    if (w === 0) continue;
    toks.push(rep.get(k)!.modified({ amount: w === 3 ? -1 : w }).toString());
  }
  return { str: toks.join(' '), tokCount: toks.length };
}

function canonOnce(alg: string, N: number): string {
  if (!alg.trim()) return '';
  let moves: Move[];
  try { moves = [...new Alg(alg).experimentalLeafMoves()]; } catch { return alg; }
  const out: string[] = [];
  let i = 0;
  while (i < moves.length) {
    const ax = AXIS_OF[moves[i].family];
    if (!ax) { out.push(moves[i].toString()); i += 1; continue; }
    const amt = new Array<number>(N).fill(0);
    const run: Move[] = [];
    let bail = false;
    let j = i;
    while (j < moves.length && AXIS_OF[moves[j].family] === ax) {
      const d = moveToDeltas(moves[j], ax, N);
      run.push(moves[j]);
      if (d === null) bail = true; else for (const { idx, delta } of d) amt[idx - 1] += delta;
      j += 1;
    }
    i = j;
    if (bail) { out.push(run.map((m) => m.toString()).join(' ')); continue; }
    const fold = foldRun(run);
    const syn = synthesizeAxis(amt.map(m4n), ax, N);
    const pick = syn.tokCount < fold.tokCount ? syn.str : fold.str;  // 仅严格更短才用转体写法
    if (pick) out.push(pick);
  }
  return out.join(' ');
}

// 同轴消步:逐层向量法,迭代到不动点(每趟非增,有限步收敛)。跨轴转体最短化交给
// shortenRotations(整 24 朝向),与本步互补。
function collapseSameAxis(alg: string, N: number): string {
  let prev = alg, cur = canonOnce(alg, N), guard = 0;
  while (cur !== prev && guard++ < 6) { prev = cur; cur = canonOnce(cur, N); }
  return cur;
}

interface Props {
  /** Only animation owns playback and physical keyboard input. */
  active?: boolean;
  world: World | null;
  /** Cube identity published after the parent completes its puzzle switch. */
  activeCube?: World['cube'] | null;
  clearFrozen: () => void;
  alg: string;
  setup?: string;
  onAlgChange: (alg: string) => void;
  onSetupChange: (setup: string) => void;
  /** Translate editor notation only at the playback boundary. */
  toPlaybackText?: (text: string) => string;
  order: number;
  puzzleKind: SimPuzzle;
  settings: SimSettings;
  onSettingsChange: (s: SimSettings) => void;
  /** 自定义 logo 是会员权益；无权限时仍可使用无 logo 或本站 logo。 */
  canUseCustomLogo: boolean;
  /** 图像面板选中 trans(X 光)视图时的内核预设值(SettingDrawer 的 TRANS_CORE),否则 null。
   *  非 null = 内核色 / 内核不透明度由预设接管(3D 与伴图同吃这一份,见 SimPage 的
   *  withTransCore):外观区那两行显示预设值、锁死不可改,hover 说明原因。 */
  transCore?: { coreColor: string; coreOpacity: number } | null;
  keymap: Record<string, KeyMove>;
  onKeymapChange: (km: Record<string, KeyMove>) => void;
  onResetKeymap: () => void;
  userMoveRef?: RefObject<((action: TwistAction | string, anchoredSetup?: { setup: string }) => string | void) | null>;
  /** TwistyPlayer instance for pyraminx/skewb/megaminx — used by the explicit
   *  scramble play button to drive jumpToStart + play after the alg is set. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  twistyPlayerRef?: RefObject<any>;
  /** Reactive player identity for the shared playback bar; refs alone miss rebuilds. */
  twistyPlaybackPlayer?: TwistyPlaybackPlayer | null;
  /** Skewb-only: Sarah vs WCA notation. Owner SimPage persists in localStorage. */
  skewbNotation?: SkewbNotation;
  onSkewbNotationChange?: (n: SkewbNotation) => void;
  /** Kilominx face names and their text travel together in the shared URL. */
  kilominxNotation?: KilominxNotation;
  onKilominxNotationChange?: (next: KilominxNotation, setup: string, alg: string) => void;
  /** Copy the latest drafts with the owner's current URL state, before nuqs flushes. */
  onCopyLink?: (setup: string, alg: string) => Promise<void>;
  /** Renderer for an ENGINE_TWISTY puzzle: 'cubing' = cubing.js TwistyPlayer (default),
   *  'group' = the in-house Three.js engine + group-theory panel. 'engine' (engine without
   *  panel) is retired — still typed so stale URLs parse, treated as 'group'. */
  renderer?: 'cubing' | 'engine' | 'group';
  onRendererChange?: (r: 'cubing' | 'engine' | 'group') => void;
  /** DOM node below the cube canvas to portal the playback control row into
   *  (twizzle-style bar under the puzzle). Falls back to inline when absent. */
  playbackSlot?: HTMLElement | null;
  canvasTools?: ReactNode;
  /** Current-state stage control shares the canvas footer with animation tools. */
  captureStickeringSlot?: HTMLElement | null;
  appearanceOpen?: boolean;
  onAppearanceToggle?: () => void;
  /** Background selector slot in the shared row below the canvas. */
  bgSlot?: HTMLElement | null;
  /** 全屏/退出全屏按钮(SimPage 持有 fullscreen 状态),渲染在播放条按钮排最左
   *  (twizzle alpha.twizzle.net/edit 同款,全屏钮居首)。 */
  fullscreenButton?: ReactNode;
  /** 画布右上角背面小窗的显隐开关。 */
  backViewButton?: ReactNode;
  /** 按阶段展示色块(twizzle stickering,issue #27)。URL 状态归 SimPage(nuqs),
   *  这里只渲染播放条最左的下拉。支持与否走 simCaps.supports.stickering(不支持隐藏)。 */
  stickering?: string;
  onStickeringChange?: (v: string) => void;
  /** 阶段遮罩的拿方朝向(整体转前缀,24 档),仅 NxN 引擎遮罩;默认 ''(UF,恒等)。 */
  stickeringRot?: string;
  onStickeringRotChange?: (v: string) => void;
  /** 自定义阶段的贴纸样式与画笔。状态归 SimPage。 */
  stickeringMask?: string;
  onStickeringMaskClear?: () => void;
  customGrain?: PickGrain;
  onCustomGrainChange?: (v: PickGrain) => void;
  /** 自定义阶段的画法:选中的 / 其余的各自原色、压暗还是置灰。 */
  customPick?: CustomBrush;
  onCustomPickChange?: (v: CustomBrush) => void;
  onCustomUndo?: () => void;
  onCustomRedo?: () => void;
  canCustomUndo?: boolean;
  canCustomRedo?: boolean;
  customRest?: CustomTreatment;
  onCustomRestChange?: (v: CustomTreatment) => void;
}

export default function PlayerControls({
  active = true,
  world, activeCube = world?.cube ?? null,
  clearFrozen, alg, setup, onAlgChange: onAlgChangeProp, onSetupChange: onSetupChangeProp,
  order, puzzleKind,
  settings, onSettingsChange, canUseCustomLogo, transCore = null,
  keymap, onKeymapChange, onResetKeymap,
  userMoveRef, twistyPlayerRef, twistyPlaybackPlayer = null, toPlaybackText,
  skewbNotation, onSkewbNotationChange,
  kilominxNotation = 'cstimer', onKilominxNotationChange,
  onCopyLink,
  renderer = 'cubing', onRendererChange,
  appearanceOpen, onAppearanceToggle,
  playbackSlot, canvasTools, captureStickeringSlot, bgSlot, fullscreenButton, backViewButton,
  stickering = 'full', onStickeringChange,
  stickeringRot = '', onStickeringRotChange,
  stickeringMask = '', onStickeringMaskClear,
  customGrain = 'sticker', onCustomGrainChange,
  customPick = 'regular', onCustomPickChange,
  customRest = 'ignored', onCustomRestChange,
  onCustomUndo, onCustomRedo, canCustomUndo, canCustomRedo,
}: Props) {
  const isSq1 = puzzleKind === 'sq1';
  const squareFamilyKind: SquareFamilyKind | null = puzzleKind === 'sq2' || puzzleKind === 'sq4'
    ? puzzleKind
    : null;
  const squareFamilySpec = squareFamilyKind ? SQUARE_FAMILY_SPECS[squareFamilyKind] : null;
  const squarePuzzleKind: 'sq1' | SquareFamilyKind | null = isSq1 ? 'sq1' : squareFamilyKind;
  const isSquarePuzzle = isSq1 || squareFamilySpec !== null;
  const isIvy = puzzleKind === 'ivy';
  // Skewb on the in-house engine — a corner-turn engine puzzle, NOT the cubing.js
  // twisty path. The cubing.js skewb stays a twisty puzzle (renderer 'cubing').
  const isSkewbEngine = puzzleKind === 'skewb' && renderer !== 'cubing';
  const isPyraEngine = puzzleKind === 'pyraminx' && renderer !== 'cubing';
  const isMegaEngine = puzzleKind === 'megaminx' && renderer !== 'cubing';
  const isFtoEngine = puzzleKind === 'fto' && renderer !== 'cubing';
  // Skewb + Pyraminx + Megaminx + FTO have an in-house engine alternative; off the cubing.js
  // renderer (= 群论内核) they behave like the other engine (corner-/face-turn) puzzles,
  // NOT the cubing.js twisty path.
  const isEngineTwisty = isSkewbEngine || isPyraEngine || isMegaEngine || isFtoEngine;
  // PuzzleGeometry explore puzzle (cubing.js TwistyPlayer, world-less) — twisty-class,
  // so it shares every twisty branch below (scramble / simplify / no-world guards).
  // Custom-cut puzzle (Puzzle Cuts editor) — a runtime PuzzleGeometry description, so
  // it shares every twisty/PG branch (random-move scramble off the live player, etc.).
  const isPgMode = (typeof puzzleKind === 'string' && isPgPuzzleId(puzzleKind)) || puzzleKind === 'custom';
  const isTwistyMode = (isTwistyPuzzle(puzzleKind) || isPgMode) && !isEngineTwisty;
  const engineReady = !isTwistyMode && !!world
    && world.puzzleKind === puzzleKind && world.cube === activeCube;
  // Corner/edge-turn engine puzzle descriptor (Dino/Redi/Rex/Heli/Skewb/Pyraminx), or
  // null for everything else. One mapping line per puzzle; every player branch below
  // keys off `corner` instead of a per-puzzle boolean chain.
  const cornerKind: CornerKind | null =
    puzzleKind === 'dino' ? 'dino'
      : puzzleKind === 'redi' ? 'redi'
        : puzzleKind === 'rex' ? 'rex'
          : puzzleKind === 'heli' ? 'heli'
          : puzzleKind === 'gear' ? 'gear'
          : puzzleKind === 'ghost' ? 'ghost'
          : puzzleKind === 'pyraminx_duo' ? 'pyraminx_duo'
          : isMagicPuzzle(puzzleKind) ? puzzleKind
            : isSkewbEngine ? 'skewb'
              : isPyraEngine ? 'pyraminx'
                : isMegaEngine ? 'megaminx'
                  : isFtoEngine ? 'fto'
                    : puzzleKind === 'clock' ? 'clock'
                      : null;
  // For the engine skewb in Sarah mode, translate typed input Sarah → WCA before the
  // engine (WCA-only) parser sees it, so a Sarah alg plays on the engine just like it
  // does on the cubing.js renderer. Output (scramble / 消步 / 取逆) stays WCA — the
  // engine's native — matching the cubing.js path (scrambles come back in WCA there too).
  const corner = useMemo<CornerSpec | null>(() => {
    if (!cornerKind) return null;
    const spec = CORNER_SPECS[cornerKind];
    if (cornerKind === 'skewb' && skewbNotation === 'sarah') {
      return {
        ...spec,
        parse: (s) => spec.parse(toWcaSkewb(s, 'sarah')),
        reduce: (s) => spec.reduce(toWcaSkewb(s, 'sarah')),
      };
    }
    return spec;
  }, [cornerKind, skewbNotation]);
  const playbackMode = corner?.endAnchor === false ? 'moves' : settings.playbackMode;
  // The setup box is fed straight to the engine twister (it bypasses corner.parse), so
  // translate it the same way — mirrors SimPage, which runs toWca on both the setup and
  // alg it hands the cubing.js renderer. No-op outside skewb and in WCA mode.
  const toEngineText = useCallback(
    (s: string) => (cornerKind === 'skewb' ? toWcaSkewb(s, skewbNotation ?? 'wca') : s),
    [cornerKind, skewbNotation],
  );
  // Auto-space (recon/submit parity, issue #11) is safe wherever every move token is a
  // single letter: NxN/twisty WCA alg, Ivy, SQ1 (no letters, no-op either way), and the
  // 'redi' / 'pyraminx' corner-engine notations (F/L/B/R and U/L/R/B). It must stay off
  // for the other corner-engine notations, which use multi-letter tokens per move
  // ("UFR"/"UF"/"BL" …) that auto-spacing would split mid-token. Gear's tokens are
  // single-letter too, but the WCA rules misfire on its grammar (UD/FB glue exemption,
  // suffix digits 3-6) — it gets the 'simple' variant instead of the full WCA one.
  const algAutoSpaceSafe = puzzleKind !== 'kilominx' && !isPgMode
    && (!corner || cornerKind === 'redi' || cornerKind === 'pyraminx' || cornerKind === 'pyraminx_duo');
  const algAutoSpace: boolean | 'simple' =
    algAutoSpaceSafe ? true : cornerKind === 'gear' ? 'simple' : false;
  // "Derive scramble from solution" (cubedb-style) is 3x3-only — the solver is.
  const is3x3 = !isSquarePuzzle && !isIvy && !corner && !isTwistyMode && order === 3;
  const tr = useT();
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const t = (zh: string, en: string) => (isZh ? zh : en);

  const authUser = useAuthStore((s) => s.user);
  const authLogin = useAuthStore((s) => s.login);

  const [squareFormats, setSquareFormats] = useState<Record<'sq1' | SquareFamilyKind, SquareFamilyNotationFormat>>({
    sq1: 'compact',
    sq2: 'compact',
    sq4: 'compact',
  });
  const squareFormat = squareFormats[squarePuzzleKind ?? 'sq1'];
  const formatIncomingSquareText = useCallback((text: string): string => {
    if (!text.trim() || !isSquarePuzzle) return text;
    const convert = isSq1
      ? squareFormat === 'wca' ? canonicalSq1Alg : compactSq1Alg
      : squareFamilySpec
        ? (value: string) => formatSquareFamilyAlg(value, squareFamilySpec, squareFormat)
        : (value: string) => value;
    return convertSquareText(text, convert);
  }, [isSquarePuzzle, isSq1, squareFamilySpec, squareFormat]);
  const [algDraft, setAlgDraft] = useState(() => formatIncomingSquareText(alg));
  const algStm = useMemo(() => (is3x3 ? stm(algDraft) : 0), [algDraft, is3x3]);
  const [setupDraft, setSetupDraft] = useState(() => formatIncomingSquareText(setup ?? ''));
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (active) return;
    setPlaying(false);
    twistyPlaybackPlayer?.pause();
  }, [active, twistyPlaybackPlayer]);
  const [twistyPlayback, setTwistyPlayback] = useState<TwistyPlaybackState>(EMPTY_TWISTY_PLAYBACK_STATE);
  const twistyPlaybackRef = useRef<ReturnType<typeof createTwistyPlayback> | null>(null);
  // Caret char offset in the solution box while the user is navigating text (click
  // / arrow keys / typing) — drives the "current move" highlight the twizzle way
  // (highlight the move the caret is *on*, not the last one fully behind it).
  // Null = highlight follows playback position (`step`) instead; cleared whenever
  // a non-caret action (play / step / reset) moves the timeline.
  const [caretChar, setCaretChar] = useState<number | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [moveEditing, setMoveEditing] = useState(false);
  const [moveEditorSlot, setMoveEditorSlot] = useState<HTMLDivElement | null>(null);
  useEffect(() => { setMoveEditing(false); }, [puzzleKind, active]);
  const [lastEdit, setLastEdit] = useState<{ setup: string; alg: string; nextSetup: string; nextAlg: string; puzzle: SimPuzzle; step: number } | null>(null);
  const [optimalScrambleBusy, setOptimalScrambleBusy] = useState(false);
  const [optimalScrambleStatus, setOptimalScrambleStatus] = useState<string | null>(null);
  const optimalScrambleAbortRef = useRef<AbortController | null>(null);

  // 播放/单步 TPS = 抽屉 TPS 的每个公式 token 标称 tick 数。
  // 手动拖动 / 键盘 / 播放 / 单步全用这一个速度(2026-07-09 用户要求统一为单一旋钮;
  // 旧的独立「×」播放倍率已删)。timing.frames 是与抽屉共用的全局,禁在 mount/slider
  // 时裸写抢顺序 —— 播放与单步路径显式 set(此处即写回同值,幂等),用完立刻 restore
  // 回抽屉基准值(tween 在 twist() 调用瞬间捕获帧数,同步恢复安全)。
  const playbackFrames = mapFrames(settings.speed);

  const playTimerRef = useRef<number | null>(null);
  const stepRef = useRef(0);
  const replayRequestRef = useRef(0);
  const replayPendingRef = useRef(false);
  const [replayPending, setReplayPending] = useState(false);
  const setupElRef = useRef<HTMLTextAreaElement | null>(null);
  const algElRef = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => { stepRef.current = step; }, [step]);

  // 虚拟键盘:'alg' = 记号输入键盘(写进解法框),'qwerty' = 按键映射键盘(点击 =
  // 转魔方)。按需打开，避免与手机系统键盘争抢空间。
  const [kbVariant, setKbVariant] = useState<'alg' | 'qwerty' | null>(null);

  // 快捷键弹窗(查看 / 自定义按键映射)。按钮与虚拟键盘开关同排 —— 都是「键盘」主题,
  // 放一起比藏在下方设置区里好找(设置区原按钮已移除)。
  const [keymapOpen, setKeymapOpen] = useState(false);

  // The alg/setup props round-trip through the URL (nuqs): a local edit calls
  // onAlgChange → setQuery → the prop echoes back. That echo arrives in several waves
  // and each wave oscillates between the previous value and the new one (a transient
  // empty read before it settles) before finally landing on what we pushed. Every
  // such prop change clobbers the local draft below and re-fires the auto-reset
  // effect UNGUARDED → the cube reset+replays = the "snap-back flash" (local dev only,
  // where the extra render passes surface the transient; prod batches it away).
  //
  // Fix: wrap the change callbacks so each local push records both the value pushed
  // and the value it replaced. The prop-sync effects then ignore any prop equal to
  // either (it's our own echo / bounce — the local draft is already correct) and only
  // apply genuinely external values (URL load, alg picker), which are never one of the
  // two we just cycled between.
  const skipAutoResetRef = useRef(false);
  const algDraftRef = useRef(algDraft);
  const setupDraftRef = useRef(setupDraft);
  useEffect(() => { algDraftRef.current = algDraft; }, [algDraft]);
  useEffect(() => { setupDraftRef.current = setupDraft; }, [setupDraft]);
  const pushedAlgRef = useRef<string | null>(null);
  const replacedAlgRef = useRef<string | null>(null);
  const pushedSetupRef = useRef<string | null>(null);
  const replacedSetupRef = useRef<string | null>(null);

  // The URL write for a user move is debounced (see appendUserMove) so it lands after
  // the snap animation, not during it. lastCommittedAlgRef = the value the URL currently
  // holds; the echo-gate refs above are set from it at write time so the nuqs bounce
  // (lastCommitted ↔ next) is still recognised as our own echo.
  const lastCommittedAlgRef = useRef<string>(alg);
  const pendingAlgCommitRef = useRef<string | null>(null);
  const algCommitTimerRef = useRef<number | null>(null);
  const applyAlgToUrl = useCallback((next: string) => {
    replacedAlgRef.current = lastCommittedAlgRef.current;
    pushedAlgRef.current = next;
    lastCommittedAlgRef.current = next;
    onAlgChangeProp(next);
  }, [onAlgChangeProp]);
  const flushAlgCommit = useCallback(() => {
    if (algCommitTimerRef.current != null) { window.clearTimeout(algCommitTimerRef.current); algCommitTimerRef.current = null; }
    if (pendingAlgCommitRef.current != null) {
      const v = pendingAlgCommitRef.current;
      pendingAlgCommitRef.current = null;
      applyAlgToUrl(v);
    }
  }, [applyAlgToUrl]);
  // Fire the deferred URL write only once the turn animation has fully settled — a
  // fixed timer can land mid-snap (a 90° snap runs ~500ms) and re-drop frames. Poll
  // the shared tweener + controller until idle, then commit. Reads latest world/flush
  // via a ref so the poller keeps a stable identity.
  const commitEnvRef = useRef({ world, flushAlgCommit });
  commitEnvRef.current = { world, flushAlgCommit };
  const scheduleAlgCommit = useCallback(() => {
    if (algCommitTimerRef.current != null) window.clearTimeout(algCommitTimerRef.current);
    algCommitTimerRef.current = window.setTimeout(() => {
      algCommitTimerRef.current = null;
      const { world: w, flushAlgCommit: fl } = commitEnvRef.current;
      const ctrl = w?.controller as { rotating?: boolean; dragging?: boolean } | undefined;
      const busy = tweener.length > 0 || !!ctrl?.rotating || !!ctrl?.dragging;
      if (busy) { scheduleAlgCommit(); return; }
      fl();
    }, 120);
  }, []);
  const commitAlgDebounced = useCallback((next: string) => {
    pendingAlgCommitRef.current = next;
    scheduleAlgCommit();
  }, [scheduleAlgCommit]);
  // Immediate path (typing / scramble / alg picker): supersede any pending move-commit.
  const onAlgChange = useCallback((next: string) => {
    pendingAlgCommitRef.current = null;
    if (algCommitTimerRef.current != null) { window.clearTimeout(algCommitTimerRef.current); algCommitTimerRef.current = null; }
    applyAlgToUrl(next);
  }, [applyAlgToUrl]);
  // Persist any pending move URL write when leaving the component.
  useEffect(() => () => { flushAlgCommit(); }, [flushAlgCommit]);

  const onSetupChange = useCallback((next: string) => {
    replacedSetupRef.current = setupDraftRef.current;
    pushedSetupRef.current = next;
    onSetupChangeProp(next);
  }, [onSetupChangeProp]);

  useEffect(() => {
    if (alg === pushedAlgRef.current || alg === replacedAlgRef.current) return;
    setAlgDraft(formatIncomingSquareText(alg));
  }, [alg, formatIncomingSquareText]);
  useEffect(() => {
    const s = setup ?? '';
    if (s === pushedSetupRef.current || s === replacedSetupRef.current) return;
    setSetupDraft(formatIncomingSquareText(s));
  }, [setup, formatIncomingSquareText]);

  // Keep both textareas sized to their content. The onInput handlers only fire
  // on typing, so a value arriving via defaultValue (shared URL on first mount),
  // an AlgsPanel pick, or a tool action would otherwise stay at the rows={1}
  // height with content clipped by overflow:hidden — most visible on narrow
  // screens where a long scramble/solution wraps to many lines. Sync the DOM
  // value too, but never while the box is focused (would jump the caret).
  useEffect(() => {
    const el = setupElRef.current;
    if (!el) return;
    if (document.activeElement !== el && el.value !== setupDraft) el.value = setupDraft;
    autosize(el);
  }, [setupDraft]);
  useEffect(() => {
    const el = algElRef.current;
    if (!el) return;
    if (document.activeElement !== el && el.value !== algDraft) el.value = algDraft;
    autosize(el);
  }, [algDraft]);

  // The needed height depends on wrap width, which shifts after the mono font
  // loads and on viewport resize / rotation. The draft effects above measure
  // too early (fallback font, pre-layout) and would leave the box clipped.
  // Re-fit after fonts settle and whenever a textarea's *width* changes — the
  // width guard skips our own height writes so this can't feedback-loop.
  useEffect(() => {
    const els = [setupElRef.current, algElRef.current].filter(Boolean) as HTMLTextAreaElement[];
    if (!els.length) return;
    const fit = () => els.forEach(autosize);
    fit();
    const fonts = (document as Document & { fonts?: { ready?: Promise<unknown> } }).fonts;
    fonts?.ready?.then(fit).catch(() => { /* no FontFaceSet */ });
    if (typeof ResizeObserver === 'undefined') return;
    const lastW = new WeakMap<Element, number>();
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        const el = e.target as HTMLTextAreaElement;
        const w = el.clientWidth;
        if (lastW.get(el) === w) continue;
        lastW.set(el, w);
        autosize(el);
      }
    });
    els.forEach((el) => ro.observe(el));
    return () => ro.disconnect();
  }, []);

  // NxN 播放项 = move + 换握记号(↑/↓/·,占一步驱动手部,不动魔方)。
  const nxnItems = useMemo<NxnPlayItem[]>(() => {
    if (isSquarePuzzle || isIvy || corner || isTwistyMode) return [];
    if (!algDraft.trim()) return [];
    try {
      return parseNxnItems(algDraft);
    } catch {
      return [];
    }
  }, [algDraft, isSquarePuzzle, isIvy, corner, isTwistyMode]);

  const nativeSetupError = useMemo(() => {
    if (!isNativePuzzleId(puzzleKind)) return '';
    try { parseNativePuzzleAlg(puzzleKind, setupDraft); return ''; } catch (error) { return String((error as Error).message); }
  }, [puzzleKind, setupDraft]);
  const nativeAlgError = useMemo(() => {
    if (!isNativePuzzleId(puzzleKind)) return '';
    try { parseNativePuzzleAlg(puzzleKind, algDraft); return ''; } catch (error) { return String((error as Error).message); }
  }, [puzzleKind, algDraft]);
  const nativeSetupValid = !nativeSetupError;
  const nativeAlgValid = !nativeAlgError;

  useEffect(() => {
    setTwistyPlayback(EMPTY_TWISTY_PLAYBACK_STATE);
    if (!isTwistyMode || !twistyPlaybackPlayer) return;
    // Invalid drafts must not play the previous legal picture while the URL is
    // still waiting for its debounced update. TwistySection keeps that picture.
    if (!nativeSetupValid || !nativeAlgValid) {
      twistyPlaybackPlayer.pause();
      return;
    }
    const controls = createTwistyPlayback(twistyPlaybackPlayer, setTwistyPlayback);
    twistyPlaybackRef.current = controls;
    return () => {
      controls.dispose();
      if (twistyPlaybackRef.current === controls) twistyPlaybackRef.current = null;
    };
  }, [isTwistyMode, twistyPlaybackPlayer, nativeSetupValid, nativeAlgValid]);

  const squareFamilyAlgMoves = useMemo<SquareFamilyMove[] | null>(() => {
    if (!squareFamilySpec) return null;
    return tryParseSquareFamilyMoves(algDraft, squareFamilySpec);
  }, [algDraft, squareFamilySpec]);
  const squareFamilySetupMoves = useMemo<SquareFamilyMove[] | null>(() => {
    if (!squareFamilySpec) return null;
    return tryParseSquareFamilyMoves(setupDraft, squareFamilySpec);
  }, [setupDraft, squareFamilySpec]);
  const squareFamilyAlgValid = !squareFamilySpec || squareFamilyAlgMoves !== null;
  const squareFamilySetupValid = !squareFamilySpec || squareFamilySetupMoves !== null;
  const squareFamilyCanPlay = squareFamilyAlgValid && squareFamilySetupValid;

  const squareActions = useMemo<Sq1Move[]>(() => {
    if (isSq1) return parseSq1Scramble(algDraft);
    if (squareFamilySpec) return squareFamilyAlgMoves ?? [];
    return [];
  }, [algDraft, isSq1, squareFamilySpec, squareFamilyAlgMoves]);

  const ivyActions = useMemo<IvyMove[]>(() => {
    if (!isIvy) return [];
    try { return parseIvyMoves(algDraft); } catch { return []; }
  }, [algDraft, isIvy]);

  // Ivy live-input validation: classify both boxes so a bad token (e.g. a 3x3
  // "F") highlights red in-place AND blocks playback — instead of throwing and
  // crashing the page. Non-Ivy puzzles keep their own handling (null spans).
  const ivySetupSpans = useMemo(() => (isIvy ? classifyIvyTokens(setupDraft) : null), [isIvy, setupDraft]);
  const ivyAlgSpans = useMemo(() => (isIvy ? classifyIvyTokens(algDraft) : null), [isIvy, algDraft]);
  const ivyCanPlay = !isIvy
    || (!ivySetupSpans!.some((s) => s.bad) && !ivyAlgSpans!.some((s) => s.bad));
  const squareSetupSpans = squareFamilySpec && !squareFamilySetupValid
    ? [{ text: setupDraft, bad: true }]
    : null;
  const squareAlgSpans = squareFamilySpec && !squareFamilyAlgValid
    ? [{ text: algDraft, bad: true }]
    : null;
  const ghostSetupValid = useMemo(() => puzzleKind !== 'ghost' || ghostSequenceValid(setupDraft), [puzzleKind, setupDraft]);
  const ghostCanPlay = useMemo(() => {
    if (puzzleKind !== 'ghost') return true;
    if (!ghostSetupValid) return false;
    try {
      const inverse = playbackMode === 'algorithm' ? ghostMovesToString(invertGhostMoves(parseGhostMoves(algDraft))) : '';
      return ghostSequenceValid(`${setupDraft} ${inverse} ${algDraft}`);
    } catch { return false; }
  }, [puzzleKind, ghostSetupValid, setupDraft, algDraft, playbackMode]);
  const cornerSetupSpans = useMemo(() => corner?.classify?.(setupDraft) ?? null, [corner, setupDraft]);
  const cornerAlgSpans = useMemo(() => corner?.classify?.(algDraft) ?? null, [corner, algDraft]);
  const cornerSetupValid = ghostSetupValid && !cornerSetupSpans?.some(span => span.bad)
    && (corner?.sequenceValid?.(setupDraft, '') ?? true);
  const cornerCanPlay = ghostCanPlay && cornerSetupValid && !cornerAlgSpans?.some(span => span.bad)
    && (corner?.sequenceValid?.(setupDraft, algDraft) ?? true);
  // A token can be spelled correctly yet leave the legal route (F' at its
  // start, or too many F steps). Preserve precise lexical errors, otherwise
  // highlight the invalid sequence instead of hiding it behind valid spans.
  const setupValidationSpans = (!nativeSetupValid ? [{ text: setupDraft, bad: true }] : null) ?? ivySetupSpans ?? squareSetupSpans ?? (
    !cornerSetupValid && !cornerSetupSpans?.some(span => span.bad)
      ? [{ text: setupDraft, bad: true }] : cornerSetupSpans
  );
  const algValidationSpans = (!nativeAlgValid ? [{ text: algDraft, bad: true }] : null) ?? ivyAlgSpans ?? squareAlgSpans ?? (
    cornerSetupValid && !cornerCanPlay && !cornerAlgSpans?.some(span => span.bad)
      ? [{ text: algDraft, bad: true }] : cornerAlgSpans
  );
  const describeInvalid = (spans: readonly { text: string; bad?: boolean }[] | null | undefined) => {
    let prefix = '';
    for (const span of spans ?? []) {
      if (span.bad) {
        const line = prefix.split('\n').length;
        const column = prefix.length - prefix.lastIndexOf('\n');
        const token = span.text.trim().slice(0, 32);
        return t(`第 ${line} 行、第 ${column} 列附近的记号或转动序列无效：${token}`, `Invalid notation or move sequence near line ${line}, column ${column}: ${token}`);
      }
      prefix += span.text;
    }
    return '';
  };
  const setupError = nativeSetupError || describeInvalid(setupValidationSpans);
  const algError = nativeAlgError || describeInvalid(algValidationSpans);
  useEffect(() => { if (!cornerCanPlay) setPlaying(false); }, [cornerCanPlay]);

  // One move list for whichever corner-turn engine puzzle is active (empty otherwise).
  // algDraft 是**正在打字**的文本 → 随时可能停在半个 token 上,解析器严格会抛;兜住当空
  // (与 ivyActions 同款),让页面继续跑、等用户把这一招打完。
  const cornerActions = useMemo<unknown[][]>(() => {
    if (!corner) return [];
    try { return parseCornerGroups(corner, algDraft); } catch { return []; }
  }, [corner, algDraft]);

  // Char range of every play-item (move token / grip mark), in play order — the
  // single source both the highlight (index → range) and caret sync (caret →
  // index) read from. SQ1's tuple notation isn't one-move-per-token and the
  // cubing.js twisty path has its own native scrubber, so both stay empty.
  const itemPositions = useMemo<TokenPosition[]>(() => {
    if (isSquarePuzzle || isTwistyMode) return [];
    if (isIvy) return ivyCanPlay ? findWhitespaceTokenPositions(algDraft) : [];
    // 半个 token(还在打)解析不了 → 不算一项,别让它抛出去炸掉整页。
    if (corner) {
      return findWhitespaceTokenPositions(algDraft).filter((tk) => {
        try { return parseCornerGroups(corner, tk.text).length === 1; } catch { return false; }
      });
    }
    // NxN: WCA move tokens + grip marks (↑↓·), merged back into text order.
    const moves = findTokenPositions(algDraft);
    const grips = findGripMarkPositions(algDraft).map((p) => ({ start: p, end: p + 1, text: algDraft[p] }));
    return [...moves, ...grips].sort((a, b) => a.start - b.start);
  }, [algDraft, isSquarePuzzle, isTwistyMode, isIvy, ivyCanPlay, corner]);

  // Which play-item to paint orange. While the user navigates text (caretChar set,
  // not playing) it's the move on the caret's own line — the last item at/before
  // the caret when that move shares the caret's line, else the first move on the
  // caret's line (so a caret before a leading `(` of a group highlights that
  // group's first move, not the previous line's last move). Otherwise it follows
  // the playback position: `step - 1` = the move just started / finishing.
  const highlightRange = useMemo<[number, number] | null>(() => {
    let idx: number;
    if (!playing && caretChar !== null) {
      const lineOf = (pos: number) => {
        let n = 0;
        for (let i = 0; i < pos && i < algDraft.length; i++) if (algDraft[i] === '\n') n++;
        return n;
      };
      const caretLine = lineOf(caretChar);
      let prev = -1, next = -1;
      for (let i = 0; i < itemPositions.length; i++) {
        if (itemPositions[i].start <= caretChar) prev = i;
        if (next === -1 && itemPositions[i].start >= caretChar) next = i;
      }
      // Prefer a move on the caret's line: the behind-move if it's on this line,
      // else the ahead-move if it's on this line (caret sits in the leading
      // whitespace / `(` before the line's first move), else fall back to behind.
      if (prev >= 0 && lineOf(itemPositions[prev].start) === caretLine) idx = prev;
      else if (next >= 0 && lineOf(itemPositions[next].start) === caretLine) idx = next;
      else idx = prev;
    } else {
      idx = step - 1;
    }
    if (idx < 0) return null;
    const p = itemPositions[idx];
    return p ? [p.start, p.end] : null;
  }, [playing, caretChar, itemPositions, step, algDraft]);

  const algHlBaseSpans = useMemo<SimAlgHighlightSpan[]>(
    () => algValidationSpans ?? [{ text: algDraft }],
    [algValidationSpans, algDraft],
  );
  const algHlSpans = useMemo(
    () => applyAlgHighlight(algHlBaseSpans, highlightRange),
    [algHlBaseSpans, highlightRange],
  );
  const showAlgOverlay = !!algValidationSpans || !!highlightRange;

  const totalSteps = isTwistyMode
    ? (nativeSetupValid && nativeAlgValid && twistyPlayback.ready ? twistyPlayback.total : 0)
    : !engineReady ? 0
    : isSquarePuzzle
    ? (squareFamilyCanPlay ? squareActions.length : 0)
    : isIvy
      ? (ivyCanPlay ? ivyActions.length : 0)
      : corner
        ? (cornerCanPlay ? cornerActions.length : 0)
        : nxnItems.length;

  const jumpToStep = useCallback(async (n: number) => {
    if (isTwistyMode) {
      await twistyPlaybackRef.current?.seek(n);
      return;
    }
    if (!world || !engineReady || world.cube !== activeCube) return;
    const replayRequest = ++replayRequestRef.current;
    replayPendingRef.current = false; // non-NxN replay paths below are synchronous
    setReplayPending(false);
    // Release any held-partial (debug) turn first: an NxN frozen layer holds the
    // cube lock, which would make the replay's group.twist below spin forever.
    clearFrozen();
    if (isSquarePuzzle) {
      if (!squareFamilyCanPlay) {
        setPlaying(false);
        stepRef.current = 0;
        setStep(0);
        return;
      }
      const squareCube = world.cube as unknown as SquarePlaybackCube;
      squareCube.twister.finish();
      const effSetup = playbackMode === 'algorithm'
        ? (setupDraft + ' ' + (isSq1 ? invertSq1Alg(algDraft) : squareFamilyMovesToString(
          invertSquareFamilyMoves(squareFamilyAlgMoves ?? [], squareFamilySpec ?? undefined),
        ))).trim()
        : setupDraft;
      // setup() applies the scramble as the base state; layer the first `target`
      // solution moves on top WITHOUT resetting (applyMovesInstant would snap
      // back to solved first, wiping the scramble). Mirrors the NxN path below.
      squareCube.twister.setup(effSetup);
      const target = Math.max(0, Math.min(n, squareActions.length));
      for (let i = 0; i < target; i++) squareCube.applyMoveInstant(squareActions[i]);
      setStep(target);
      return;
    }
    if (isIvy) {
      // A bad token in either box → can't play: leave the cube as-is (the box
      // shows the offending token in red) rather than feeding it to the parser.
      if (!ivyCanPlay) { setStep(0); return; }
      const ivyCube = world.cube as unknown as import('./engine/ivy/IvyCube').default;
      ivyCube.twister.finish();
      const effSetup = playbackMode === 'algorithm'
        ? (setupDraft + ' ' + invertAlg(algDraft)).trim()
        : setupDraft;
      ivyCube.twister.setup(effSetup);
      const target = Math.max(0, Math.min(n, ivyActions.length));
      for (let i = 0; i < target; i++) ivyCube.applyMoveInstant(ivyActions[i]);
      setStep(target);
      return;
    }
    if (corner) {
      // All corner/edge-turn engine puzzles share this replay shape — only the
      // move functions (via `corner`) differ. setup() lays the scramble (or the
      // inverted solution, in Algorithm mode) as the base state, then the first
      // `target` solution moves are applied instantly on top.
      if (!cornerCanPlay) { setStep(0); return; }
      const cube = world.cube as unknown as CornerCube;
      cube.twister.finish();
      const effSetup = playbackMode === 'algorithm'
        ? (toEngineText(setupDraft) + ' ' + (corner.invertText
          ? corner.invertText(algDraft)
          : corner.toString(corner.invert(cornerActions.flat())))).trim()
        : toEngineText(setupDraft);
      // 打乱框同样是逐键触发的:半个 token 会让 twister.setup 的解析抛。兜住 = 保持上一次
      // 的合法基座不动,等这一招打完(比整页崩掉或悄悄跳回还原态都合理)。
      const target = Math.max(0, Math.min(n, cornerActions.length));
      try {
        if (corner.parseGroups && cube.twister.setupMoves) {
          const baseMoves = parseCornerGroups(corner, effSetup).flat();
          cube.twister.setupMoves([
            ...baseMoves,
            ...cornerActions.slice(0, target).flat(),
          ], effSetup);
        } else {
          cube.twister.setup(effSetup);
          for (let i = 0; i < target; i++) cube.applyMoveInstant(cornerActions[i][0]);
        }
      } catch { return; }
      setStep(target);
      return;
    }
    const cube = world.cube as import('./engine/nxn/cube').default;
    const effectiveSetup = playbackMode === 'algorithm'
      ? (setupDraft + ' ' + invertAlg(stripHandMarks(algDraft))).trim()
      : setupDraft;
    replayPendingRef.current = true;
    setReplayPending(true);
    try {
      await cube.twister.setupAsync(effectiveSetup);
    } finally {
      if (replayRequest === replayRequestRef.current && world.cube === cube) {
        replayPendingRef.current = false;
        setReplayPending(false);
      }
    }
    // A later seek or puzzle switch owns the UI now. Do not continue replaying on
    // a detached cube or overwrite the active puzzle's step after an async setup.
    if (replayRequest !== replayRequestRef.current || world.cube !== cube) return;
    const target = Math.max(0, Math.min(n, nxnItems.length));
    for (let i = 0; i < target; i++) {
      const it = nxnItems[i];
      if (it.kind === 'move') cube.twister.twist(it.action, true, true);
    }
    // 手部握姿:静态推演前 target 项(weld 提交烘入 + 换握记号),瞬时摆到位 ——
    // 与逐步 live 播放的落点一致(跳步是瞬切,rig 轮询不到层角,不会自己烘)。
    const hands = world.hands;
    if (hands?.isEnabled) {
      const sim: GripSimStep[] = [];
      for (let i = 0; i < target; i++) {
        const it = nxnItems[i];
        if (it.kind === 'grip') { sim.push({ grip: it.grip, side: it.side }); continue; }
        const rotates = cube.table.convert(it.action);
        if (!rotates.length) continue;
        sim.push({
          axis: rotates[0].group.axis as 'x' | 'y' | 'z',
          layers: rotates.map((r) => r.group.layer),
          quarters: rotates[0].twist,
        });
      }
      const g = simulateGrips(sim, cube.order);
      hands.setGrips(g.R, g.L);
    }
    setStep(target);
  }, [world, activeCube, engineReady, clearFrozen, setupDraft, algDraft, nxnItems, squareActions, squareFamilyAlgMoves, squareFamilySpec, squareFamilyCanPlay, ivyActions, cornerActions, corner, toEngineText, isSquarePuzzle, isSq1, isIvy, isTwistyMode, ivyCanPlay, cornerCanPlay, playbackMode]);

  // Notation guide (engine skewb): play ONE token on the main cube from solved so the
  // user sees which corner a letter turns. It only borrows the cube — setup/alg text is
  // untouched — so `jumpToStep` rebuilds the user's state on demand (Back to my cube).
  const demoNotationMove = useCallback((token: string) => {
    if (!world || isTwistyMode) return;
    const tw = (world.cube as unknown as CornerCube).twister;
    tw.finish();
    clearFrozen();
    tw.setup('');
    tw.push(toEngineText(token));
  }, [world, clearFrozen, isTwistyMode, toEngineText]);

  const restoreFromDemo = useCallback(() => { jumpToStep(stepRef.current); }, [jumpToStep]);

  const animatingScrambleRef = useRef(false);
  const scrambleReqIdRef = useRef(0);
  const twistyReplayReqIdRef = useRef(0);
  const [scramblePreview, setScramblePreview] = useState(false);
  const restorePreviewRef = useRef<((revision: number) => Promise<void>) | null>(null);
  const restoreScramblePreview = useCallback(async () => {
    const revision = ++twistyReplayReqIdRef.current;
    const restore = restorePreviewRef.current;
    restorePreviewRef.current = null;
    setScramblePreview(false);
    await restore?.(revision);
  }, []);
  useEffect(() => {
    restoreScramblePreview();
    return () => {
      const revision = ++twistyReplayReqIdRef.current;
      void restorePreviewRef.current?.(revision);
      restorePreviewRef.current = null;
    };
  }, [active, puzzleKind, renderer, setupDraft, algDraft, settings.playbackMode, restoreScramblePreview]);
  useEffect(() => {
    ++twistyReplayReqIdRef.current;
    return () => { ++twistyReplayReqIdRef.current; };
  }, [puzzleKind, renderer]);
  // 上一次驱动过魔方状态的解法文本 —— auto-reset effect 用它判断「这次变更是不是
  // 纯末尾追加」:是,且开着「动画」,就在当前状态上动画转新招,而不是整段瞬切重放。
  const prevAlgTextRef = useRef(alg);
  const replayedCubeRef = useRef<World['cube'] | null>(null);

  useEffect(() => {
    if (!engineReady || replayedCubeRef.current !== activeCube) {
      // Child effects can run before SimPage applies the requested URL puzzle.
      // Pause immediately, then wait for its completed-switch identity to replay
      // setup + the current step. Text-edit shortcuts only describe the old cube.
      if (playTimerRef.current !== null) {
        window.clearInterval(playTimerRef.current);
        playTimerRef.current = null;
      }
      setPlaying(false);
      replayRequestRef.current++;
      replayPendingRef.current = true;
      setReplayPending(true);
      scrambleReqIdRef.current++;
      skipAutoResetRef.current = false;
      animatingScrambleRef.current = false;
      if (!engineReady) return;
      replayedCubeRef.current = activeCube;
      prevAlgTextRef.current = algDraft;
      void jumpToStep(stepRef.current);
      return;
    }
    const actions = isSquarePuzzle ? squareActions : isIvy ? ivyActions : corner ? cornerActions : nxnItems;
    const prevText = prevAlgTextRef.current;
    prevAlgTextRef.current = algDraft;
    if (skipAutoResetRef.current) {
      skipAutoResetRef.current = false;
      setStep(actions.length);
      return;
    }
    if (animatingScrambleRef.current) {
      animatingScrambleRef.current = false;
      setStep(0);
      return;
    }
    // 解法框正被编辑(光标在框里):魔方跟随光标 —— 事件里的 caret sync 因 actions
    // 未更新而跳过了,这里用本轮的新 actions 落实(打一个 U,魔方立刻转 U;删掉则回退)。
    const algEl = algElRef.current;
    if (algEl instanceof HTMLTextAreaElement && document.activeElement === algEl) {
      const n = caretStepOf(algEl.value, algEl.selectionStart ?? algEl.value.length);
      if (n !== null) {
        // 「动画」开着且这次是纯末尾追加一招(魔方已停在前 n−1 步):在当前状态上
        // 动画转这一招(与手势/键映射同一体验)。其余情况(中途编辑/删除/一次粘贴
        // 多招/algorithm 模式基座会变)仍整段瞬切重放。SQ1/Ivy 沿 stepForward
        // 的先例保持瞬切。
        if (
          settings.animatePlayback !== false && playbackMode !== 'algorithm'
          && !isSquarePuzzle && !isIvy && cornerCanPlay && world
          && n === actions.length && stepRef.current === n - 1
          && algDraft.startsWith(prevText)
        ) {
          clearFrozen();
          if (corner) {
            const twister = (world.cube as unknown as CornerCube).twister;
            const group = actions[n - 1] as unknown[];
            if (corner.parseGroups && twister.pushMoves) twister.pushMoves(group);
            else if (!twister.twist(group[0], false, true)) return;
            stepRef.current = n;
            setStep(n);
            return;
          }
          const it = nxnItems[n - 1];
          // 手部演示开着时仍走 jumpToStep(它会重推演握姿);动画追加不带手部模拟。
          if (it.kind === 'move' && !world.hands?.isEnabled) {
            (world.cube as import('./engine/nxn/cube').default).twister.twist(it.action, false, true);
            stepRef.current = n;
            setStep(n);
            return;
          }
        }
        jumpToStep(n);
        return;
      }
    }
    jumpToStep(stepRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCube, engineReady, setupDraft, nxnItems, squareActions, ivyActions, cornerActions, playbackMode]);

  /** 光标位置 → 光标前的完整步数(各拼图各自的 parser);解析不了返回 null。 */
  const caretStepOf = useCallback((text: string, caretIndex: number): number | null => {
    if (isTwistyMode) return null; // The native player owns its timeline and bounded parser.
    const before = text.slice(0, caretIndex);
    if (!isSquarePuzzle && !isIvy && !corner) {
      // NxN 直接喂原文(parseNxnItems 自己剥注释):extractAlgFromText 会把
      // ↑/↓/· 当装饰剥掉,经它一遍换握步就数丢了。
      try { return parseNxnItems(before).length; } catch { return null; }
    }
    const algBefore = extractAlgFromText(before);
    if (isSq1) return parseSq1Scramble(algBefore).length;
    if (squareFamilySpec) return tryParseSquareFamilyMoves(algBefore, squareFamilySpec)?.length ?? null;
    if (isIvy) {
      try { return parseIvyMoves(algBefore).length; } catch { return null; }
    }
    // 光标前的文本天然可能停在半个 token 上("ALL3+" 打到 "AL"),各引擎的解析器都是严格的
    // → 必须像上面 Ivy / NxN 两条一样兜住,否则打字打到一半整页崩。单字母记号的拼图(dino /
    // pyraminx …)前缀恰好总是合法,所以一直没暴露;魔表的 token 有 3–6 字符,一打就中。
    if (corner) {
      try { return parseCornerGroups(corner, algBefore).length; } catch { return null; }
    }
    return null;
  }, [isSquarePuzzle, isSq1, squareFamilySpec, isIvy, corner, isTwistyMode]);

  const handleCaretSync = useCallback((text: string, caretIndex: number) => {
    // Remember the caret so the highlight can follow the move it sits on (twizzle
    // rule, see the highlightRange memo) — separate from the cube state, which is
    // driven by jumpToStep(moves-before-caret).
    setCaretChar(caretIndex);
    // 打字/删除刚改了文本:此刻 memoized actions 还是旧的,jumpToStep 会被 clamp 到旧
    // 长度 → 魔方不动(虚拟键盘没有 keyup 兜底,#38 后续「输入 U 不转」)。文本变更的
    // 跳步交给下面的 auto-reset effect 用本轮新 actions 落实;这里只处理纯光标移动
    // (点击/方向键,文本没变,actions 就是新的)。
    if (text !== algDraft) return;
    const n = caretStepOf(text, caretIndex);
    if (n !== null) jumpToStep(n);
  }, [algDraft, caretStepOf, jumpToStep]);

  // 「动画」开着时,上一步/下一步在当前状态上顺播/倒播这一步(与播放循环同一
  // 转动动画路径),而不是 jumpToStep 的整段重放瞬切;关着时保持瞬切。
  // 目前只走 NxN(SQ1/Ivy/角转引擎仍瞬切):cube 状态恒等于 setup+前 step 项,
  // 正向 twist 第 step 项 / 反向 twist 第 step-1 项的逆,状态保持一致。
  const stepForward = useCallback(() => {
    if (isTwistyMode) {
      setCaretChar(null);
      void twistyPlaybackRef.current?.stepForward(settings.animatePlayback !== false);
      return;
    }
    if (!engineReady || world?.cube !== activeCube || replayPendingRef.current) return;
    clearFrozen();
    setCaretChar(null); // hand the highlight back to the playback position
    const animate = settings.animatePlayback !== false;
    if (animate && !isSquarePuzzle && !isIvy && !corner && world && step < nxnItems.length) {
      const cube = world.cube as import('./engine/nxn/cube').default;
      const it = nxnItems[step];
      if (it.kind === 'grip') {
        world.hands?.regrip(it.grip, it.side);
      } else {
        if (cube.busy || world.hands?.isRegripping) return;
        // 前置就位:伸指在途时本次点击只推进伸指,到位后再点才转。
        if (gateHandsReach(world, cube, it.action, it.push, it.pin)) return;
        // 单步与播放同速:tween 在 twist() 同步捕获帧数,随即恢复抽屉值。
        timing.frames = playbackFrames;
        const ok = cube.twister.twist(it.action, false, false);
        timing.frames = mapFrames(settings.speed);
        if (!ok) return;
      }
      stepRef.current = step + 1;
      setStep(step + 1);
      return;
    }
    jumpToStep(step + 1);
  }, [activeCube, engineReady, clearFrozen, jumpToStep, step, settings.animatePlayback, settings.speed, playbackFrames, isSquarePuzzle, isIvy, isTwistyMode, corner, world, nxnItems]);

  const stepBack = useCallback(() => {
    if (isTwistyMode) {
      setCaretChar(null);
      void twistyPlaybackRef.current?.stepBack(settings.animatePlayback !== false);
      return;
    }
    if (!engineReady || world?.cube !== activeCube || replayPendingRef.current) return;
    clearFrozen();
    setCaretChar(null); // hand the highlight back to the playback position
    const animate = settings.animatePlayback !== false;
    if (animate && !isSquarePuzzle && !isIvy && !corner && world && step > 0 && step <= nxnItems.length) {
      const cube = world.cube as import('./engine/nxn/cube').default;
      const it = nxnItems[step - 1];
      if (it.kind === 'grip') {
        // 回退换握:前一握姿是任意累积四元数(可能含 weld 烘入),静态推演后瞬时摆回。
        const hands = world.hands;
        if (hands?.isEnabled) {
          const sim: GripSimStep[] = [];
          for (let i = 0; i < step - 1; i++) {
            const p = nxnItems[i];
            if (p.kind === 'grip') { sim.push({ grip: p.grip, side: p.side }); continue; }
            const rotates = cube.table.convert(p.action);
            if (rotates.length) sim.push({ axis: rotates[0].group.axis as 'x' | 'y' | 'z', layers: rotates.map((r) => r.group.layer), quarters: rotates[0].twist });
          }
          const g = simulateGrips(sim, cube.order);
          hands.setGrips(g.R, g.L);
        }
      } else {
        if (cube.busy || world.hands?.isRegripping) return;
        const inv = new TwistAction(it.action.sign, !it.action.reverse, it.action.times);
        // 倒播的 F' 同样先伸指到位再转(push 提示随逆招失义,分类自会回落)。
        if (gateHandsReach(world, cube, inv, it.push)) return;
        timing.frames = playbackFrames;
        const ok = cube.twister.twist(inv, false, false);
        timing.frames = mapFrames(settings.speed);
        if (!ok) return;
      }
      stepRef.current = step - 1;
      setStep(step - 1);
      return;
    }
    jumpToStep(step - 1);
  }, [activeCube, engineReady, clearFrozen, jumpToStep, step, settings.animatePlayback, settings.speed, playbackFrames, isSquarePuzzle, isIvy, isTwistyMode, corner, world, nxnItems]);

  // Play/pause toggle for the shared PlaybackBar. Pausing is instant; starting
  // from the end first复位到第 0 步(并同步 stepRef,否则播放轮询读到 step≥total
  // 会立刻停),复位完成后再开播 — 与旧内联 handler 行为一致。
  const handleTogglePlay = useCallback(async () => {
    if (isTwistyMode) {
      setCaretChar(null);
      await twistyPlaybackRef.current?.togglePlay();
      return;
    }
    if (playing) { setPlaying(false); return; }
    if (!engineReady || world?.cube !== activeCube || replayPendingRef.current) return;
    clearFrozen();
    setCaretChar(null); // playback owns the highlight from here
    if (step >= totalSteps) {
      await jumpToStep(0);
      if (world?.cube !== activeCube) return;
      stepRef.current = 0;
    }
    setPlaying(true);
  }, [activeCube, engineReady, world, playing, step, totalSteps, jumpToStep, clearFrozen, isTwistyMode]);

  useEffect(() => {
    if (!active || !playing || !engineReady) {
      if (playTimerRef.current) { window.clearInterval(playTimerRef.current); playTimerRef.current = null; }
      return;
    }
    // Completion-driven playback: poll frequently and only advance to the next
    // move once the current one's animation has *finished*. We pass force=false
    // so a still-running tween makes twist() return false (drop) instead of
    // truncating it — this is what guarantees每一步完整做完才接下一步. (force=true
    // on a wall-clock interval truncated the current turn whenever the timer beat
    // the eased animation, which 120° corner turns — Redi/Dino/Ivy ≈567ms vs the
    // old 600ms interval — hit on the slightest frame-rate jank.) Speed scales the
    // animation length via CubeGroup.frames (separate effect), not the poll rate.
    const total = isSquarePuzzle ? squareActions.length : isIvy ? ivyActions.length : corner ? cornerActions.length : nxnItems.length;
    // 动画开关(设置面板「动画」):关 → 不逐步转动,瞬切到下一步。瞬切没有动画完成可等,
    // 故节拍由 interval 周期给:timing.frames 帧 @60fps ≈ 该步本应播放的时长,瞬切后等同节拍
    // (否则一帧就冲到底,看不到逐步)。开 → 16ms 高频轮询,按动画完成逐步推进(原行为)。
    const animatePlayback = settings.animatePlayback !== false;
    // 播放期间全局 tick 数切到播放速度,停止(cleanup)恢复抽屉 TPS 值。
    timing.frames = playbackFrames;
    const stepDelayMs = Math.max(80, Math.round((playbackFrames / 60) * 1000));
    playTimerRef.current = window.setInterval(() => {
      const s = stepRef.current;
      if (s >= total) { setPlaying(false); return; }
      if (!world || world.cube !== activeCube || world.puzzleKind !== puzzleKind || replayPendingRef.current) return;
      clearFrozen();
      if (!animatePlayback) {
        // 瞬切:走跟「下一步」按钮同一条 instant 落子路径(fast+force / applyMoveInstant),
        // 不产生 tween;节拍由 interval 周期 stepDelayMs 控制。
        if (isSquarePuzzle) {
          (world.cube as unknown as SquarePlaybackCube).applyMoveInstant(squareActions[s]);
        } else if (isIvy) {
          (world.cube as unknown as import('./engine/ivy/IvyCube').default).applyMoveInstant(ivyActions[s]);
        } else if (corner) {
          const cube = world.cube as unknown as CornerCube;
          for (const move of cornerActions[s]) cube.applyMoveInstant(move);
        } else {
          const it = nxnItems[s];
          if (it.kind === 'move') (world.cube as import('./engine/nxn/cube').default).twister.twist(it.action, true, true);
          else world.hands?.regrip(it.grip);
        }
        world.dirty = true;
        stepRef.current = s + 1;
        setStep(s + 1);
        return;
      }
      let started = false;
      if (isSquarePuzzle) {
        const squareCube = world.cube as unknown as SquarePlaybackCube;
        started = squareCube.twister.twist(squareActions[s], false, false);
      } else if (isIvy) {
        const ivyCube = world.cube as unknown as import('./engine/ivy/IvyCube').default;
        started = ivyCube.twister.twist(ivyActions[s], false, false);
      } else if (corner) {
        const cube = world.cube as unknown as CornerCube;
        if (corner.parseGroups && cube.twister.pushMoves) {
          if (cube.twister.busy) return;
          cube.twister.pushMoves(cornerActions[s]);
          started = true;
        } else {
          started = cube.twister.twist(cornerActions[s][0], false, false);
        }
      } else {
        const cube = world.cube as import('./engine/nxn/cube').default;
        // 换握动画播完才接下一步(镜像「转动动画完成才接下一步」的节拍约定)。
        if (world.hands?.isRegripping) return;
        const it = nxnItems[s];
        if (it.kind === 'grip') {
          world.hands?.regrip(it.grip, it.side);
          started = true;
        } else {
          // NxN twist(force=false) returns true even for a same-axis/same-face turn
          // (it runs in parallel or cancel+restarts), so gate on the cube's own lock
          // state to keep playback strictly one-turn-at-a-time.
          if (cube.busy) return;
          // 前置就位:转动开始前指尖先到位(16ms 轮询幂等重入)。
          if (gateHandsReach(world, cube, it.action, it.push, it.pin)) return;
          started = cube.twister.twist(it.action, false, false);
        }
      }
      // Busy (previous turn still animating) → wait for the next poll, keep step.
      if (!started) return;
      stepRef.current = s + 1;
      setStep(s + 1);
    }, animatePlayback ? 16 : stepDelayMs);
    return () => {
      if (playTimerRef.current) { window.clearInterval(playTimerRef.current); playTimerRef.current = null; }
      timing.frames = mapFrames(settings.speed);
    };
  }, [active, activeCube, engineReady, puzzleKind, playing, nxnItems, squareActions, ivyActions, cornerActions, corner, world, clearFrozen, playbackFrames, isSquarePuzzle, isIvy, settings.animatePlayback, settings.speed]);

  const replaceDrafts = async (nextSetup: string, nextAlg: string, restoreStep = 0) => {
    await restoreScramblePreview();
    setPlaying(false);
    twistyPlaybackPlayer?.pause();
    setCaretChar(null);
    skipAutoResetRef.current = false;
    stepRef.current = restoreStep;
    setStep(restoreStep);
    setSetupDraft(nextSetup);
    onSetupChange(nextSetup);
    setAlgDraft(nextAlg);
    onAlgChange(nextAlg);
    if (setupElRef.current) { setupElRef.current.value = nextSetup; autosize(setupElRef.current); }
    if (algElRef.current) { algElRef.current.value = nextAlg; autosize(algElRef.current); }
  };
  const editDrafts = (nextSetup: string, nextAlg: string) => {
    setLastEdit({ setup: setupDraft, alg: algDraft, nextSetup, nextAlg, puzzle: puzzleKind, step: stepRef.current });
    void replaceDrafts(nextSetup, nextAlg);
  };
  const canUndoEdit = lastEdit && lastEdit.puzzle === puzzleKind && setupDraft === lastEdit.nextSetup && algDraft === lastEdit.nextAlg;
  const tool = (transform: (s: string) => string) => () => {
    // Algorithm tools edit the solution; setup remains a separate playback anchor.
    if (hasHandNotation(algDraft)) return;
    editDrafts(setupDraft, transform(algDraft));
  };

  // Per-puzzle "消步" (cancel redundant moves) + invert. SQ1 has its own token
  // model; pyraminx/skewb/megaminx (cubing.js) can't use the cube's mod-4 fold.
  // Corner-turn engine puzzles fold via their descriptor.
  const simplifyForPuzzle = useCallback((s: string): string => {
    if (isNativePuzzleId(puzzleKind)) {
      try { return simplifyNativePuzzleAlg(puzzleKind, s); } catch { return s; }
    }
    if (isSq1) return simplifySq1Alg(s, squareFormat);
    if (squareFamilySpec) return simplifySquareFamilyAlg(s, squareFamilySpec, squareFormat);
    if (isIvy) return s; // ivy R R = R' (not R2) — NxN fold doesn't apply
    // 文本可能还没打完 / 有错字 → 原样返回,别抛(按钮点在半截文本上不该炸页)。
    if (corner) {
      try { return corner.reduce(s); } catch { return s; }
    }
    if (isTwistyMode) return simplifyTwistyAlg(s);
    // 逐层向量法同轴消步:吃掉一切等价写法并抽出整体转体(M' R → r、L' r → x、
    // L' 3r → x、R 2R L' 2L' → x …)。再跨轴最短化转体串(整 24 朝向),最后回炉一遍
    // 把 shortenRotations 可能造出的相邻同轴并掉。
    const fold = (seg: string): string => {
      let r = collapseSameAxis(simplifyAlg(seg), order);
      r = collapseSameAxis(shortenRotations(r), order);
      // 宽层输出统一小写记号(Rw→r、3Rw→3r、2-3Uw→2-3u);大小写两种写法输入都解析。
      return r.replace(/([RLUDFB])w/g, (_, c: string) => c.toLowerCase());
    };
    // 换握记号是分段边界:各段独立消步(跨记号抵消 = 手都换了,不该并),记号原位保留。
    if (GRIP_MARK_SPLIT.test(s)) {
      return s.split(GRIP_MARK_SPLIT)
        .map((seg) => (GRIP_MARKS[seg] ? seg : seg.trim() ? fold(seg) : ''))
        .filter((seg) => seg !== '')
        .join(' ');
    }
    return fold(s);
  }, [isSq1, squareFamilySpec, isIvy, corner, isTwistyMode, squareFormat, order, puzzleKind]);

  const invertForPuzzle = useCallback((s: string): string => {
    if (isNativePuzzleId(puzzleKind)) {
      try { return parseNativePuzzleAlg(puzzleKind, s).invert().toString(); } catch { return s; }
    }
    if (corner) {
      try {
        return corner.invertText?.(s) ?? corner.toString(corner.invert(corner.parse(s)));
      } catch { return s; }
    }
    if (isSq1) {
      const inv = invertSq1Alg(s);
      return squareFormat === 'wca' ? canonicalSq1Alg(inv) : compactSq1Alg(inv);
    }
    if (squareFamilySpec) {
      const parsed = tryParseSquareFamilyMoves(s, squareFamilySpec);
      if (!parsed) return s;
      return formatSquareFamilyAlg(
        squareFamilyMovesToString(invertSquareFamilyMoves(parsed, squareFamilySpec)),
        squareFamilySpec,
        squareFormat,
      );
    }
    return invertAlg(s); // The tool entry rejects hand notation instead of discarding it.
  }, [isSq1, squareFamilySpec, corner, squareFormat, puzzleKind]);

  // 消步 = 实时消步开关(settings.liveReduce);开启时手势 / 键盘追加自动消步。
  // 拨到开还顺手把当前解法消一次步(兼顾原一次性按钮:手敲 / 粘贴后开开关即整理)。
  const setLiveReduce = useCallback((v: boolean) => {
    onSettingsChange({ ...settings, liveReduce: v });
    if (!v) return;
    const reduced = isSquarePuzzle
      ? convertSquareText(algDraft.trimEnd(), simplifyForPuzzle)
      : simplifyForPuzzle(algDraft.trim());
    if (reduced === algDraft.trim()) return;
    setAlgDraft(reduced);
    onAlgChange(reduced);
    const el = algElRef.current;
    if (el) { el.value = reduced; autosize(el); }
  }, [settings, onSettingsChange, algDraft, simplifyForPuzzle, isSquarePuzzle, onAlgChange]);

  // Copy the current page URL (puzzle + scramble + solution params) so the exact
  // sim state can be shared. Works for any puzzle — the URL always carries state.
  const copyTimerRef = useRef<number | null>(null);
  useEffect(() => () => { if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current); }, []);
  const handleCopyLink = useCallback(() => {
    if (typeof window === 'undefined' || !navigator.clipboard?.writeText) return;
    flushAlgCommit(); // request persistence; the owner copies the immediate drafts below
    const copied = onCopyLink
      ? onCopyLink(setupElRef.current?.value ?? setupDraft, algElRef.current?.value ?? algDraft)
      : navigator.clipboard.writeText(window.location.href);
    copied.then(() => {
      setLinkCopied(true);
      if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = window.setTimeout(() => setLinkCopied(false), 1500);
    }).catch(() => { /* clipboard denied */ });
  }, [flushAlgCommit, onCopyLink, setupDraft, algDraft]);

  const appendUserMove = useCallback((action: TwistAction | string, anchoredSetup?: { setup: string }) => {
    if (restorePreviewRef.current) {
      restoreScramblePreview();
      return algDraftRef.current;
    }
    let moveText = typeof action === 'string' ? action : action.value;
    if (typeof action !== 'string' && !isSquarePuzzle && !isTwistyMode && world && world.cube.order === 1) {
      const norm = normalizeTo1x1(action);
      if (!norm) return;
      moveText = norm.value;
    }
    if (!moveText) return;
    const algEl = algElRef.current;
    if (!algEl) return;
    const current = isMagicPuzzle(puzzleKind)
      ? magicMovesToString(cornerActions.slice(0, stepRef.current).flat() as MagicMove[])
      : algEl.value;
    const currentLine = current.slice(current.lastIndexOf('\n') + 1);
    const hasTrailingLineBreak = /\n[ \t]*$/.test(current);
    const appendAfterComment = (isSquarePuzzle || isTwistyMode)
      && !hasTrailingLineBreak && currentLine.includes('//');
    const appendOnNewLine = appendAfterComment || hasTrailingLineBreak;
    const appendBase = appendAfterComment
      ? `${current.trimEnd()}\n`
      : hasTrailingLineBreak ? current : current.trimEnd();
    // SQ1: glue slices to adjacent turns (`(1,0)/(2,0)`), but NEVER glue two
    // slices — `//` is the comment marker in Square notation, so
    // a dragged double-slice must read as `/ /`.
    const endsSlash = !appendOnNewLine && appendBase.endsWith('/');
    const glue = isSquarePuzzle && squareFormat === 'compact'
      && (moveText === '/' || endsSlash) && !(moveText === '/' && endsSlash);
    const sep = !appendOnNewLine && appendBase ? (glue ? '' : ' ') : '';
    let next = appendBase + sep + moveText + ' ';
    // 实时消步:追加后立即 fold/抵消重复转动(R 后做 R' → 框里清空)。魔方本身已被
    // 手势转过去,这里只改文本,故必须 skipAutoReset 不让文本变更触发回放重置。
    if (settings.liveReduce !== false && !isIvy) {
      const reduced = isSquarePuzzle
        ? convertSquareText(next.trimEnd(), simplifyForPuzzle)
        : simplifyForPuzzle(next.trim());
      next = reduced ? reduced + ' ' : '';
    } else if (isSquarePuzzle) {
      const convert = isSq1
        ? squareFormat === 'wca' ? canonicalSq1Alg : compactSq1Alg
        : squareFamilySpec
          ? (text: string) => formatSquareFamilyAlg(text, squareFamilySpec, squareFormat)
          : (text: string) => text;
      const formatted = convertSquareText(next, convert);
      next = formatted ? formatted + ' ' : '';
    }
    algEl.value = next;
    algEl.selectionStart = algEl.selectionEnd = next.length;
    autosize(algEl);
    skipAutoResetRef.current = true;
    setAlgDraft(next);
    if (anchoredSetup) {
      // An end-anchored manual move advances the endpoint as well as the record.
      // Publish both drafts together so the next render and an immediate share
      // retain that endpoint, even if an earlier move still has a deferred URL write.
      const nextSetup = anchoredSetup.setup;
      const setupEl = setupElRef.current;
      if (setupEl) {
        setupEl.value = nextSetup;
        setupEl.selectionStart = setupEl.selectionEnd = nextSetup.length;
        autosize(setupEl);
      }
      onSetupChange(nextSetup);
      setupDraftRef.current = nextSetup;
      setSetupDraft(nextSetup);
      onAlgChange(next);
      return next;
    }
    // Defer only the URL write (nuqs setQuery). Synchronously it re-renders SimPage
    // (query changed) right as the snap animation starts — the dominant per-move frame
    // drop (the "开始转动掉帧"). The cube, textarea DOM and React alg state are already
    // current above; the URL can lag, so land it once the turn animation has settled
    // (idle-gated) and coalesce rapid turns into one write.
    commitAlgDebounced(next);
    // The native player uses the exact editor spelling to recognize its later
    // URL echo, including a batch of turns or a live-reduction setting change.
    return next;
  }, [commitAlgDebounced, onSetupChange, onAlgChange, isSquarePuzzle, isSq1, squareFamilySpec, isIvy, isTwistyMode, world, settings.liveReduce, simplifyForPuzzle, squareFormat, puzzleKind, cornerActions, restoreScramblePreview]);

  useEffect(() => {
    if (!userMoveRef) return;
    userMoveRef.current = appendUserMove;
    return () => { userMoveRef.current = null; };
  }, [userMoveRef, appendUserMove]);

  // QWERTY: keymap → twist + append (hard keys + the on-screen keymap keypad).
  const applyMove = useCallback((k: KeyMove) => {
    if (isSquarePuzzle || isIvy || isTwistyMode) return;
    clearFrozen();
    if (corner) {
      // corner-registry engines (gear/dino/…): route the keys the puzzle's own
      // grammar parses (gear: U R F D L B + x/y/z rotations); everything else is
      // a silent no-op.
      if (!world) return;
      const text = new TwistAction(k.sign, !!k.reverse, 1).value;
      let moves: unknown[] = [];
      try { moves = corner.parse(text); } catch { return; }
      if (moves.length !== 1) return;
      const cube = world.cube as unknown as CornerCube;
      if (cube.twister.twist(moves[0], settings.animatePlayback === false, true)) {
        appendUserMove(corner.toString(moves));
      }
      return;
    }
    let action: TwistAction | null = new TwistAction(k.sign, !!k.reverse, 1);
    let moveText = action.value;
    if (world && world.cube.order === 1) {
      action = normalizeTo1x1(action);
      if (!action) return;
      moveText = action.value;
    }
    if (world) {
      const cube = world.cube as import('./engine/nxn/cube').default;
      // 「动画」关 → fast=true 瞬切(键盘 / 屏幕键转动也无动画),与拖层一致。
      cube.twister.twist(action, settings.animatePlayback === false, true);
    }
    const algEl = algElRef.current;
    if (!algEl) return;
    if (document.activeElement !== algEl) algEl.focus();
    const current = algEl.value;
    const next = current.trimEnd() + (current.trim() ? ' ' : '') + moveText + ' ';
    algEl.value = next;
    algEl.selectionStart = algEl.selectionEnd = next.length;
    skipAutoResetRef.current = true;
    setAlgDraft(next);
    onAlgChange(next);
  }, [world, clearFrozen, isSquarePuzzle, isIvy, corner, isTwistyMode, onAlgChange, settings.animatePlayback, appendUserMove]);

  // QWERTY 键盘展开时,实体按键按 keymap 走(捕获阶段,连解法框聚焦时也接管);
  // 打乱框聚焦时放行(让字符正常落进打乱框)。capture + stopPropagation 同时挡掉
  // SimPage 的全局 keydown,不会双触发。
  useEffect(() => {
    if (!active || kbVariant !== 'qwerty' || isTwistyMode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest('[role="dialog"], [role="listbox"], [role="menu"]')) return;
      // 设置区的原生表单控件必须自行接收按键。否则 Digit2 等会命中魔方
      // keymap，applyMove 随后聚焦解法框，在 iOS 上表现为数字键盘输一位即关闭。
      if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.isContentEditable)) return;
      if (document.activeElement === setupElRef.current) return;
      const k = keymap[e.code];
      if (!k) return;
      e.preventDefault();
      e.stopPropagation();
      applyMove(k);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [active, kbVariant, keymap, applyMove, isTwistyMode]);

  const handleScramble = useCallback(async () => {
    // A new setup may replace an invalid setup draft, but keep the last valid
    // board intact while the solution is invalid instead of publishing half a state.
    if (!nativeAlgValid) return;
    ++twistyReplayReqIdRef.current;
    const reqId = ++scrambleReqIdRef.current;
    // Twisty puzzles (pyraminx/skewb/megaminx) — no cuber world. Route to
    // tnoodleRandomScramble (cubing.js + pool), then write setup so the player
    // lands on the final scrambled state immediately. Animation is reserved for
    // the adjacent play button.
    if (isTwistyMode) {
      let twistyScramble = '';
      try {
        // PuzzleGeometry explore puzzles have no tnoodle event — generate a random
        // move sequence from the live player's own move set instead.
        twistyScramble = isNativePuzzleId(puzzleKind)
          ? generateNativePuzzleScramble(puzzleKind)
          : (isPgPuzzleId(puzzleKind as string) || puzzleKind === 'custom')
          ? await pgRandomScramble(twistyPlayerRef?.current)
          : ((await tnoodleRandomScramble(puzzleKind as string)) ?? '');
      } catch (err) {
        console.warn('[sim] twisty scramble failed:', err);
      }
      if (reqId !== scrambleReqIdRef.current) return;
      const editorScramble = puzzleKind === 'kilominx'
        ? fromCubingKilominx(twistyScramble, kilominxNotation)
        : twistyScramble;
      // Keep the solution and selected anchor intact. The setup state is at the
      // start for start anchoring, or at the end for end anchoring. Seeking the
      // wrong endpoint would add/remove the solution from the new scramble.
      const settleOnSetup = () => {
        if (reqId !== scrambleReqIdRef.current) return;
        const p = twistyPlayerRef?.current as unknown as {
          experimentalSetupAlg?: string;
          experimentalSetupAnchor?: string;
          jumpToStart?: (opts?: unknown) => void;
          jumpToEnd?: (opts?: unknown) => void;
          pause?: () => void;
        } | null;
        try { p?.pause?.(); } catch { /* */ }
        try {
          if (p) {
            p.experimentalSetupAlg = twistyScramble;
            p.experimentalSetupAnchor = playbackMode === 'algorithm' ? 'end' : 'start';
          }
        } catch { /* */ }
        try {
          if (playbackMode === 'algorithm') p?.jumpToEnd?.({ flash: false });
          else p?.jumpToStart?.({ flash: false });
        } catch { /* */ }
      };
      settleOnSetup();
      if (setupElRef.current) {
        setupElRef.current.value = editorScramble;
        autosize(setupElRef.current);
      }
      setSetupDraft(editorScramble);
      onSetupChange(editorScramble);
      requestAnimationFrame(() => { requestAnimationFrame(settleOnSetup); });
      return;
    }
    if (!world) return;
    let scramble: string | null = null;
    try {
      if (isSq1) {
        // tnoodle output for sq1 is `(t, b) / (t, b) / ...`. compactSq1Alg
        // collapses it to the canonical `1023030...` shorthand the textarea
        // shows on /scramble/gen and that parseSq1Tokens also accepts.
        const raw = await tnoodleRandomScramble('sq1');
        scramble = raw
          ? squareFormat === 'wca' ? canonicalSq1Alg(raw) : formatScrambleForEvent('sq1', raw)
          : '';
      } else if (squareFamilySpec) {
        scramble = formatSquareFamilyAlg(
          randomSquareFamilyScramble(squareFamilySpec),
          squareFamilySpec,
          squareFormat,
        );
      } else if (isIvy) {
        scramble = randomIvyScramble();
      } else if (corner) {
        // Self-contained sim — a random sequence of legal corner/edge twists is a
        // valid scramble (no external solver needed). Each puzzle's descriptor
        // supplies its own length-tuned generator.
        scramble = corner.scramble();
      } else if (order >= 2 && order <= 7) {
        const eventId = `${order}${order}${order}`;
        scramble = await tnoodleRandomScramble(eventId);
      } else {
        scramble = randomMoveScrambleNxN(order);
      }
    } catch (err) {
      console.warn('[sim] scramble failed:', err);
      scramble = isSq1
        ? ''
        : squareFamilySpec
          ? formatSquareFamilyAlg(
            randomSquareFamilyScramble(squareFamilySpec),
            squareFamilySpec,
            squareFormat,
          )
          : isIvy
            ? randomIvyScramble()
            : corner
              ? ''
              : randomMoveScrambleNxN(order);
    }
    if (reqId !== scrambleReqIdRef.current || world.cube !== activeCube) return;
    if (!scramble) return;
    clearFrozen(); // release any debug held-partial turn first
    // Random scramble always lands on its final state immediately. The adjacent
    // play button owns its explicit animation path.
    animatingScrambleRef.current = true;
    const tw = world.cube.twister as unknown as {
      setupAsync?: (e: string) => Promise<void>;
      setup: (e: string) => void;
    };
    if (tw.setupAsync) await tw.setupAsync(scramble);
    else tw.setup(scramble);
    if (reqId !== scrambleReqIdRef.current || world.cube !== activeCube) return;
    if (setupElRef.current) {
      setupElRef.current.value = scramble;
      autosize(setupElRef.current);
    }
    setSetupDraft(scramble);
    onSetupChange(scramble);
  }, [world, activeCube, clearFrozen, order, isSq1, squareFamilySpec, isIvy, corner, isTwistyMode, puzzleKind, squareFormat, kilominxNotation, playbackMode, nativeAlgValid, onSetupChange, twistyPlayerRef]);

  // ▶ Play button: animate the CURRENT scramble (the text already in the box) from
  // solved, on demand. This is the explicit animation entry point for a normal random scramble:
  // cuber world → twister.setup('') + push; twisty (cubing.js) → move scramble to the
  // alg track and jumpToStart + play.
  const handlePlayScramble = useCallback(async () => {
    const scramble = setupDraft.trim();
    if (!scramble || !squareFamilySetupValid || !cornerSetupValid || !nativeSetupValid || !nativeAlgValid) return;
    if (isTwistyMode) {
      await restoreScramblePreview();
      const player = twistyPlayerRef?.current as TwistyPlayer | null;
      if (!player) return;
      const reqId = ++twistyReplayReqIdRef.current;
      const model = player.experimentalModel;
      const [timeline, originalSetup, originalAlg, originalAnchor] = await Promise.all([
        model.detailedTimelineInfo.get(), model.setupAlg.get(), model.alg.get(), model.setupAnchor.get(),
      ]).catch(() => [null, null, null, null] as const);
      if (!timeline || !originalSetup || !originalAlg || !originalAnchor) return;
      if (reqId !== twistyReplayReqIdRef.current) return;
      const original = { setup: originalSetup.alg, alg: originalAlg.alg, anchor: originalAnchor };
      let previewText: string;
      try { previewText = new Alg(toPlaybackText?.(scramble) ?? scramble).toString(); }
      catch { return; }
      restorePreviewRef.current = async (revision) => {
        player.pause();
        const [currentAlg, currentSetup, currentAnchor] = await Promise.all([
          model.alg.get(), model.setupAlg.get(), model.setupAnchor.get(),
        ]).catch(() => [null, null, null] as const);
        if (revision !== twistyReplayReqIdRef.current || !currentAlg || !currentSetup) return;
        // A new URL/project has already replaced the borrowed model: do not
        // restore an obsolete snapshot over its new owner.
        if (currentAlg.alg.toString() !== previewText || currentSetup.alg.toString() !== '') return;
        player.experimentalSetupAlg = original.setup;
        player.alg = original.alg;
        if (currentAnchor === 'start') player.experimentalSetupAnchor = original.anchor;
        player.timestamp = timeline?.timestamp ?? 0;
      };
      player.pause();
      player.experimentalSetupAlg = '';
      player.alg = previewText;
      player.experimentalSetupAnchor = 'start';
      setScramblePreview(true);
      // Wait for this model's parsed timeline, never a fixed number of frames.
      const ready = await model.indexer.get().then(() => true, () => false);
      if (!ready) { await restoreScramblePreview(); return; }
      if (reqId !== twistyReplayReqIdRef.current || twistyPlayerRef?.current !== player) return;
      player.jumpToStart({ flash: false });
      player.play();
      void model.coarseTimelineInfo.get().then(() => {
        if (reqId !== twistyReplayReqIdRef.current) player.pause();
      }).catch(() => { player.pause(); });
      return;
    }
    if (!world) return;
    const engScramble = toEngineText(scramble);
    const tw = (world.cube as unknown as CornerCube).twister;
    if (corner?.parseGroups && tw.setupMoves && tw.pushMoves) {
      let groups: unknown[][];
      try { groups = parseCornerGroups(corner, engScramble); } catch { return; }
      if (tw.busy) {
        tw.setupMoves(groups.flat(), engScramble);
        return;
      }
      clearFrozen();
      tw.setupMoves([], '');
      tw.pushMoves(groups.flat());
      return;
    }
    // 动画仍在播时再次点播放键 = 直接跳到完整打乱态(走快速 WASM 整体应用,不从头重播,
    // 高阶 400+ 步宽转也是瞬时)。等价于解法框 focus 的跳过。
    if (tw.length > 0) { tw.setup(engScramble); return; }
    // Animate from solved: reset the cube instantly, then queue the scramble moves
    // via push() (the engine's tweened playback — the same primitive the auto-animate
    // scramble uses). setupDraft is unchanged, so the setup-sync effect never fires
    // and won't snap the cube mid-animation — no animatingScrambleRef needed here.
    clearFrozen();
    tw.setup('');
    tw.push(engScramble);
  }, [setupDraft, squareFamilySetupValid, cornerSetupValid, nativeSetupValid, nativeAlgValid, isTwistyMode, puzzleKind, world, clearFrozen, corner, onSetupChange, onAlgChange, twistyPlayerRef, toEngineText, toPlaybackText, restoreScramblePreview]);

  // 点解法框时,若打乱动画仍在逐步播放(高阶打乱可达 400+ 步 ≈ 分钟级),立即落到完整打乱态,
  // 让用户马上能在打乱好的魔方上输解法。走快速整体应用 setup(打乱文本):它清空待播队列后用
  // WASM 路径一次性重建,不逐步 replay,高阶宽转也不卡(逐步 finish 会几百万次 getColor 卡死)。
  const flushPendingScramble = useCallback(() => {
    restoreScramblePreview();
    if (!world || isTwistyMode) return;
    const tw = (world.cube as unknown as CornerCube).twister;
    const scr = setupDraft.trim();
    const hasPendingAnimation = corner?.parseGroups ? tw?.busy : (tw?.length ?? 0) > 0;
    if (!tw || !hasPendingAnimation || !scr || !squareFamilySetupValid || !cornerSetupValid) return;
    const engScramble = toEngineText(scr);
    if (corner?.parseGroups && tw.setupMoves) {
      try { tw.setupMoves(parseCornerGroups(corner, engScramble).flat(), engScramble); } catch { /* keep last legal state */ }
      return;
    }
    tw.setup(engScramble);
  }, [world, isTwistyMode, corner, setupDraft, squareFamilySetupValid, cornerSetupValid, toEngineText, restoreScramblePreview]);

  // Derive the state solved by the reconstruction, then minimize its scramble.
  const handleDeriveScramble = useCallback(async () => {
    if (!is3x3 || !world || optimalScrambleBusy) return;
    const solution = algDraft;
    const originalSetup = (setupElRef.current?.value ?? setupDraft).trim();
    if (!solution.trim()) return;
    if (!authUser) { authLogin(); return; }
    const reqId = ++scrambleReqIdRef.current;
    setOptimalScrambleBusy(true);
    setOptimalScrambleStatus(t('正在反推打乱…', 'Deriving scramble…'));
    const ac = new AbortController();
    optimalScrambleAbortRef.current = ac;
    const applyScramble = (scramble: string) => {
      if (setupElRef.current) {
        setupElRef.current.value = scramble;
        autosize(setupElRef.current);
      }
      setSetupDraft(scramble);
      onSetupChange(scramble);
      setupDraftRef.current = scramble;
    };
    try {
      const raw = await deriveScrambleFromSolution(stripHandMarks(solution));
      if (ac.signal.aborted) throw new DOMException('Aborted', 'AbortError');
      if (reqId !== scrambleReqIdRef.current) return;
      if (!raw) throw new Error(t('无法从当前解法反推打乱。', 'Could not derive a scramble from the current solution.'));
      if ((setupElRef.current?.value ?? setupDraftRef.current).trim() !== originalSetup
        || (algElRef.current?.value ?? algDraftRef.current) !== solution) {
        setOptimalScrambleStatus(t('公式已更改，已忽略本次结果。', 'Algorithm changed; result discarded.'));
        return;
      }
      if (playbackMode !== 'moves') {
        onSettingsChange({ ...settings, playbackMode: 'moves' });
      }
      // Publish the fast local result before waiting for the cloud solver.
      applyScramble(raw);
      setOptimalScrambleStatus(t('已生成打乱，继续求最优中…', 'Scramble ready; optimizing…'));
      const { scramble, moves } = await cloudOptimalScramble(raw, (p) => {
        if (reqId !== scrambleReqIdRef.current) return;
        setOptimalScrambleStatus(
          p.phase === 'loading'
            ? t('正在把求解表载入服务器内存(首次约 20 秒)…', 'Loading the solver table into server memory (first time ~20s)…')
            : p.phase === 'queued'
              ? t(`排队中(前面 ${p.ahead} 个在算)…`, `Queued (${p.ahead} ahead)…`)
              : t('求解中…', 'Solving…')
        );
      }, ac.signal);
      if (reqId !== scrambleReqIdRef.current) return;
      if (ac.signal.aborted) throw new DOMException('Aborted', 'AbortError');
      if ((setupElRef.current?.value ?? setupDraftRef.current).trim() !== raw
        || (algElRef.current?.value ?? algDraftRef.current) !== solution) {
        setOptimalScrambleStatus(t('公式已更改，已忽略本次结果。', 'Algorithm changed; result discarded.'));
        return;
      }
      // Rebuild the derived setup at the current playback step.
      applyScramble(scramble);
      setOptimalScrambleStatus(t(`已求出 ${moves} 步最优打乱。`, `Optimal scramble: ${moves} moves.`));
    } catch (err) {
      if (ac.signal.aborted) setOptimalScrambleStatus(t('已取消。', 'Cancelled.'));
      else setOptimalScrambleStatus(t(`求最优打乱失败:${(err as Error).message}`, `Optimal scramble failed: ${(err as Error).message}`));
    } finally {
      setOptimalScrambleBusy(false);
      optimalScrambleAbortRef.current = null;
    }
  }, [is3x3, world, setupDraft, algDraft, optimalScrambleBusy, authUser, authLogin, settings, onSettingsChange, onSetupChange, t]);

  const cancelOptimalScramble = useCallback(() => { optimalScrambleAbortRef.current?.abort(); }, []);

  // Anchor (twizzle "Setup Anchor" — cubing.js experimentalSetupAnchor 'start'/'end'):
  // 'moves' anchors the scramble box at the timeline start (alg plays forward from it);
  // 'algorithm' anchors it at the end (alg plays backward INTO it, i.e. the scramble box
  // reads as the target/solved state the moves resolve to). Shared by both render paths
  // below — the engine path also shows step/play controls, twisty mode (cubing.js
  // TwistyPlayer) has its own native scrubber and only needs this anchor toggle.
  const anchorSelect = <div className="sim-toggle sim-anchor-setting">
    <span>{t('锚定', 'Anchor')}</span>
    <CompactSelect
      value={playbackMode}
      label={playbackMode === 'algorithm' ? t('终点', 'End') : t('起点', 'Start')}
      items={[
        { value: 'moves', label: t('起点', 'Start') },
        { value: 'algorithm', label: t('终点', 'End') },
      ]}
      disabled={corner?.endAnchor === false}
      ariaLabel={t('锚定起点或终点', 'Anchor: keep the scramble start or the solve end fixed')}
      triggerClassName="sim-anchor-trigger"
      popupClassName="sim-anchor-menu"
      showArrow
      onChange={playbackMode => onSettingsChange({ ...settings, playbackMode })}
    />
  </div>;

  // 按阶段展示色块(twizzle edit 同款,issue #27)— 播放条最左。支持面走 simCaps
  // (NxN 引擎 ≥2 阶 / cubing.js megaminx·fto),不支持的拼图整个隐藏。
  const stickeringSelect = resolveCaps(puzzleKind, renderer).supports.stickering && onStickeringChange
    ? (
      <StickeringSelect
        puzzleKind={puzzleKind} value={stickering} onChange={onStickeringChange}
        orientation={stickeringRot} onOrientationChange={onStickeringRotChange}
        faceColors={settings.faceColors}
        mask={stickeringMask} onMaskClear={onStickeringMaskClear}
        pick={customPick} onPickChange={onCustomPickChange}
        rest={customRest} onRestChange={onCustomRestChange}
        onUndo={onCustomUndo} onRedo={onCustomRedo} canUndo={canCustomUndo} canRedo={canCustomRedo}
        grain={customGrain} onGrainChange={onCustomGrainChange}
      />
    )
    : null;

  const hasTransformPanel = typeof puzzleKind === 'number' || puzzleKind === 'mirror' || puzzleKind === 'mirror2' || puzzleKind === 'sphere';
  const basicTools = <>
    <button disabled={corner?.endAnchor === false || hasHandNotation(algDraft)} onClick={tool(invertForPuzzle)} title={t('取逆', 'Invert')}>{t('取逆', 'Invert')}</button>
    {/* 消步:实时消步开关(默认开)。开 = 手势 / 键盘转动追加时自动合并 / 抵消重复转动,
        并对当前解法消一次步;关 = 原样保留。取代原一次性「消步」按钮。 */}
    {!isIvy && (
      <Toggle
        label={t('消步', 'Reduce')}
        value={settings.liveReduce !== false}
        onChange={setLiveReduce}
      />
    )}
    {!isSquarePuzzle && !isIvy && !corner && !isTwistyMode && (
      <button
        disabled={hasHandNotation(algDraft)}
        onClick={tool(flattenAlg)}
        title={t('展开所有括号并保留等价动作', 'Expand all groups into equivalent moves')}
      >
        {t('去括号', 'Expand')}
      </button>
    )}
  </>;
  const undoTool = (
    <button disabled={!canUndoEdit} type="button" title={t('撤销公式操作', 'Undo algorithm edit')} onClick={() => {
      if (!lastEdit) return;
      void replaceDrafts(lastEdit.setup, lastEdit.alg, lastEdit.step);
      setLastEdit(null);
    }}>{t('撤销', 'Undo')}</button>
  );
  const endTools = <>
    <button onClick={() => editDrafts(setupDraft, '')} title={t('清空公式', 'Clear algorithm')}><Eraser size={13} />{t('清空公式', 'Clear algorithm')}</button>
    <button type="button" onClick={() => editDrafts('', '')} title={t('重置为还原态', 'Reset to solved')}>{t('重置', 'Reset')}</button>
    <button
      onClick={handleCopyLink}
      className={linkCopied ? 'sim-link-copied' : undefined}
      title={t('复制本页链接(含打乱 / 解法)', 'Copy this page link (with scramble / solution)')}
    >
      {linkCopied ? <Check size={13} /> : <Link2 size={13} />}
      {linkCopied ? t('已复制', 'Copied') : t('复制链接', 'Copy link')}
    </button>
  </>;

  return (
    <div className="sim-player">
      {stickeringSelect && captureStickeringSlot && createPortal(
        <div className="sim-capture-stickering">
          <div className="sim-capture-stickering-controls">{stickeringSelect}</div>
        </div>,
        captureStickeringSlot,
      )}
      <div className="sim-animation-controls" hidden={!active}>
      <SimAlgEditor
        moveEditing={moveEditing}
        moveEditorRef={setMoveEditorSlot}
        setup={{
          text: setupDraft, elementRef: setupElRef, spans: setupValidationSpans, error: setupError,
          invalid: !nativeSetupValid || (squareFamilySpec ? !squareFamilySetupValid : corner ? !cornerSetupValid : undefined),
          onFocus: restoreScramblePreview,
          onInput: (el) => {
            autosize(el);
            setSetupDraft(el.value);
            onSetupChange(el.value);
          },
        }}
        alg={{
          text: algDraft, elementRef: algElRef, spans: algHlSpans, error: algError,
          showOverlay: showAlgOverlay, autoSpace: algAutoSpace, onFocus: flushPendingScramble,
          // Virtual-key presses refocus this textarea; only a direct click closes the keyboard.
          onClick: () => setKbVariant(null),
          onChange: (text) => { setAlgDraft(text); onAlgChange(text); },
          onCaretChange: handleCaretSync,
        }}
        is3x3={is3x3}
        algStm={algStm}
        scramble={{
          previewing: !!scramblePreview, onRestore: restoreScramblePreview,
          onRandom: handleScramble,
          randomDisabled: !nativeAlgValid || (isTwistyMode ? !twistyPlaybackPlayer : !engineReady),
          onPreview: handlePlayScramble,
          previewDisabled: corner?.endAnchor === false || !setupDraft.trim() || !squareFamilySetupValid || !cornerSetupValid || !nativeSetupValid || !nativeAlgValid,
          onDerive: is3x3 ? handleDeriveScramble : undefined,
          busy: optimalScrambleBusy, status: optimalScrambleStatus,
          onCancel: cancelOptimalScramble,
        }}
        setupExtras={<>
          {isMagicPuzzle(puzzleKind) && (
            <MagicRouteControls
              cube={engineReady && world?.cube instanceof MagicCube ? world.cube : null}
              puzzle={puzzleKind}
              valid={cornerCanPlay}
              onRoute={direction => {
                clearFrozen();
                setPlaying(false);
                const setup = `${puzzleKind === 'mmagic' ? 'M ' : ''}${direction}`;
                const solution = magicSolution(puzzleKind);
                setSetupDraft(setup);
                onSetupChange(setup);
                setAlgDraft(solution);
                onAlgChange(solution);
                if (setupElRef.current) setupElRef.current.value = setup;
                if (algElRef.current) algElRef.current.value = solution;
                stepRef.current = 0;
                setStep(0);
                if (world?.cube instanceof MagicCube) world.cube.twister.setup(setup);
              }}
              onFold={dir => {
                if (!engineReady || !(world?.cube instanceof MagicCube)) return;
                clearFrozen();
                if (world.cube.twister.twist({ kind: 'fold', dir }, settings.animatePlayback === false, false)) {
                  appendUserMove(dir === 1 ? 'F' : "F'");
                }
              }}
            />
          )}
          {puzzleKind === 'pyraminx_duo' && (
            <div className="sim-player-status">
              {tr('使用 U、L、R、B 及其逆转（加撇号），每次转动 120°。', 'Use U, L, R, B and their inverses (with a prime); each turn is 120°.')}
            </div>
          )}
          {puzzleKind === 'ghost' && (
            <div className="sim-player-status">
              <button type="button" className="sim-player-scramble" onClick={() => {
                if (!(world?.cube instanceof GhostCube)) return;
                clearFrozen();
                world.cube.twister.finish();
                const text = ghostMovesToString(ghostAlignmentMoves(world.cube.pose));
                if (text) { world.cube.twister.push(text); appendUserMove(text); }
              }}>{tr('对齐切层', 'Align layers')}</button>
              <span>{cornerCanPlay
                ? tr('先对齐再转侧层；字母表示内部转轴。', 'Align before side turns; letters refer to internal axes.')
                : tr('记号无效或切层未对齐。还原态先输入 U29° D35°。', 'Invalid notation or misaligned layers. From solved, start with U29° D35°.')}</span>
            </div>
          )}
        </>}
        autofill={<>
          {is3x3 && <ReconAutofill
            textareaRef={algElRef}
            value={algDraft}
            scramble={playbackMode === 'algorithm'
              ? `${setupDraft} ${invertAlg(stripHandMarks(algDraft))}`.trim()
              : setupDraft}
            setValue={text => {
              const el = algElRef.current;
              if (el) { el.value = text; autosize(el); }
              skipAutoResetRef.current = false;
              setAlgDraft(text);
              onAlgChange(text);
            }}
          />}
        </>}
        notationControls={<>
          {puzzleKind === 'skewb' && skewbNotation && onSkewbNotationChange && (
            <select
              className="sim-player-mode"
              value={skewbNotation}
              onChange={(e) => onSkewbNotationChange(e.target.value as SkewbNotation)}
              title={t('斜转记号:WCA (R/U/L/B) 或 Sarah (R/L/B/F 含 S H 宏)', 'Skewb notation: WCA (R/U/L/B) or Sarah (R/L/B/F with S/H macros)')}
            >
              <option value="wca">WCA</option>
              <option value="sarah">Sarah</option>
            </select>
          )}
          {puzzleKind === 'kilominx' && onKilominxNotationChange && (
            <select
              className="sim-player-mode"
              aria-label={t('二阶五魔方记号', 'Kilominx notation')}
              value={kilominxNotation}
              onChange={(e) => {
                const next = e.target.value as KilominxNotation;
                const newSetup = convertKilominxAlg(setupDraft, kilominxNotation, next);
                const newAlg = convertKilominxAlg(algDraft, kilominxNotation, next);
                // Supersede pending moves / scrambles before changing their convention.
                ++scrambleReqIdRef.current;
                pendingAlgCommitRef.current = null;
                if (algCommitTimerRef.current != null) {
                  window.clearTimeout(algCommitTimerRef.current);
                  algCommitTimerRef.current = null;
                }
                replacedSetupRef.current = setupDraftRef.current;
                pushedSetupRef.current = newSetup;
                replacedAlgRef.current = lastCommittedAlgRef.current;
                pushedAlgRef.current = newAlg;
                lastCommittedAlgRef.current = newAlg;
                setSetupDraft(newSetup);
                setAlgDraft(newAlg);
                onKilominxNotationChange(next, newSetup, newAlg);
              }}
              title={t('计时器使用 csTimer 记号；切换时自动转换打乱与解法', 'The timer uses csTimer notation; switching converts both scramble and solution')}
            >
              <option value="cstimer">csTimer</option>
              <option value="cubing">Twizzle</option>
            </select>
          )}
          {isSquarePuzzle && (
            <select
              className="sim-player-mode"
              value={squareFormat}
              onChange={(e) => {
                const next = e.target.value as SquareFamilyNotationFormat;
                const convert = isSq1
                  ? next === 'wca' ? canonicalSq1Alg : compactSq1Alg
                  : squareFamilySpec
                    ? (text: string) => formatSquareFamilyAlg(text, squareFamilySpec, next)
                    : (text: string) => text;
                const newSetup = setupDraft.trim() ? convertSquareText(setupDraft, convert) : '';
                const newAlg = algDraft.trim() ? convertSquareText(algDraft, convert) : '';
                if (squarePuzzleKind) {
                  setSquareFormats((formats) => ({ ...formats, [squarePuzzleKind]: next }));
                }
                setSetupDraft(newSetup);
                onSetupChange(newSetup);
                setAlgDraft(newAlg);
                onAlgChange(newAlg);
              }}
              title={t('记号格式', 'Notation format')}
            >
              <option value="compact">{t('简化', 'Compact')}</option>
              <option value="wca">{isSq1 ? 'WCA' : t('标准', 'Standard')}</option>
            </select>
          )}
        </>}
        algHelp={puzzleKind === 'skewb' && skewbNotation && !isTwistyMode && (
          <SkewbNotationGuide
            notation={skewbNotation}
            onDemo={demoNotationMove}
            onRestore={restoreFromDemo}
          />
        )}
      />

      {active && (() => {
      const playbackBar = (
      // 播放控制排:twizzle alpha.twizzle.net/edit 同款两排布局(进度条在上、传输按钮在下),
      // 与 /recon 播放条共用同一份 <PlaybackBar>。stickering / 锚点两个下拉挂在按钮排两端。
      <div className="sim-stage-controls">
      <div className="sim-view-tools" role="toolbar" aria-label={t('画布工具', 'Canvas tools')}>
        {backViewButton}{fullscreenButton}
        {!resolveCaps(puzzleKind, renderer).flat && <button type="button" className="playback-bar-btn"
          onClick={() => {
            const next = { ...settings, scale: DEFAULT_SETTINGS.scale, viewAngle: DEFAULT_SETTINGS.viewAngle, viewGradient: DEFAULT_SETTINGS.viewGradient };
            onSettingsChange(next);
            if (world) resetWorldView(world, next);
          }}>{t('重置视角', 'Reset view')}</button>}
        {canvasTools}
      </div>
      <PlaybackBar layout="wide"
        disabled={!isTwistyMode && (!engineReady || replayPending)}
        step={isTwistyMode ? (totalSteps > 0 ? twistyPlayback.step : 0) : step}
        total={totalSteps}
        playing={isTwistyMode ? totalSteps > 0 && twistyPlayback.playing : playing}
        onScrub={(n) => { setCaretChar(null); jumpToStep(n); }}
        onSkipStart={() => { setCaretChar(null); jumpToStep(0); }}
        onStepBack={stepBack}
        onTogglePlay={handleTogglePlay}
        onStepForward={stepForward}
        onSkipEnd={() => { setCaretChar(null); jumpToStep(totalSteps); }}
        leading={<div className="sim-playback-speed">
          <Slider label="TPS" value={settings.speed} onChange={speed => onSettingsChange({ ...settings, speed })} unit={UNIT_TPS} title={t('每秒转动步数', 'Turns per second')} />
        </div>}
        trailing={<SettingsPopover label={t('播放设置', 'Playback settings')} className="sim-playback-settings" iconSize={14}>
          {anchorSelect}
          <Toggle label={t('动画', 'Animation')} value={settings.animatePlayback !== false} onChange={animatePlayback => onSettingsChange({ ...settings, animatePlayback })} />
        </SettingsPopover>}
        labels={{
          skipStart: t('回到起点', 'Skip to start'),
          stepBack: t('上一步', 'Step back'),
          play: t('播放', 'Play'),
          pause: t('暂停', 'Pause'),
          stepForward: t('下一步', 'Step forward'),
          skipEnd: t('跳到末尾', 'Skip to end'),
          scrub: t('拖动播放进度', 'Scrub playback'),
        }}
      />
      </div>
      );
      return playbackSlot ? createPortal(playbackBar, playbackSlot) : playbackBar;
      })()}

      {/* 键盘行:左 = 两个虚拟键盘开关(toggle,点亮 = 展开),右 = 「快捷键」「恢复默认设置」
          动作按钮(带文字,免得和左侧键盘图标混淆)。竖线分隔两组。twisty 拼图无虚拟键盘,
          只剩右侧两个动作按钮(与原设置区位置时行为一致)。 */}
      <div className="sim-keyboard-section">
        <div className="sim-keyboard-switcher">
          {!isTwistyMode && (
            <>
              <button
                type="button"
                className={'vkb-toggle' + (kbVariant === 'alg' ? ' active' : '')}
                onClick={() => setKbVariant((v) => (v === 'alg' ? null : 'alg'))}
                title={t('解法虚拟键盘', 'Alg virtual keyboard')}
                aria-label={t('解法虚拟键盘', 'Alg virtual keyboard')}
                aria-pressed={kbVariant === 'alg'}
              >
                <Keyboard size={14} />
              </button>
              <button
                type="button"
                className={'vkb-toggle' + (kbVariant === 'qwerty' ? ' active' : '')}
                onClick={() => setKbVariant((v) => (v === 'qwerty' ? null : 'qwerty'))}
                title={t('按键映射键盘(点击 = 转魔方)', 'Keymap keyboard (click = twist cube)')}
                aria-label={t('按键映射键盘', 'Keymap keyboard')}
                aria-pressed={kbVariant === 'qwerty'}
              >
                <Grid3x3 size={14} />
              </button>
              <span className="sim-kb-sep" aria-hidden />
            </>
          )}
          <button
            type="button"
            className="sim-keymap-open-btn"
            onClick={() => setKeymapOpen(true)}
            title={t('键盘 / 鼠标快捷键(可自定义)', 'Keyboard / mouse shortcuts (customizable)')}
          >
            {t('快捷键', 'Shortcuts')}
          </button>
          <ResetDefaultsButton
            onReset={() => { onSettingsChange(DEFAULT_SETTINGS); if (world) resetWorldView(world, DEFAULT_SETTINGS); }}
            title={t('全部设置与视角恢复默认(不含快捷键)', 'Reset all settings & view to defaults (shortcuts unaffected)')}
          />
        </div>
        {!isTwistyMode && kbVariant === 'alg' && (
          <CubeVirtualKeyboard
            target={algElRef}
            onInput={() => {
              const el = algElRef.current;
              if (!el) return;
              const text = el.value;
              skipAutoResetRef.current = false; // 文本键盘改的是文字,回放该重置
              setAlgDraft(text);
              onAlgChange(text);
            }}
          />
        )}
        {!isTwistyMode && kbVariant === 'qwerty' && (
          <SimQwertyKeypad keymap={keymap} onMove={applyMove} />
        )}
      </div>

      <section className="sim-alg-tools" aria-label={t('公式操作', 'Algorithm tools')}>
      <div className="sim-player-tools">
        {hasTransformPanel ? (
          <AlgTransformPanel
            key={String(puzzleKind)}
            basicTools={basicTools}
            undoTool={undoTool}
            endTools={endTools}
            text={algDraft}
            setup={setupDraft}
            order={order}
            editing={moveEditing}
            editorSlot={moveEditorSlot}
            onEditingChange={editing => {
              setPlaying(false);
              void restoreScramblePreview();
              setMoveEditing(editing);
            }}
            onSelect={caret => handleCaretSync(algDraft, caret)}
            onApply={(nextSetup, next, caret) => {
              const previousSetup = setupDraft, previousAlg = algDraft, previousStep = stepRef.current;
              void replaceDrafts(nextSetup, next, caret === undefined ? parseNxnItems(next).length : caretStepOf(next, caret) ?? 0);
              return () => { void replaceDrafts(previousSetup, previousAlg, previousStep); };
            }}
          />
        ) : <>
          {basicTools}
          {!isSquarePuzzle && !isTwistyMode && corner?.cubeMirrors !== false && <button onClick={tool((s) => mirrorAlg(s, 'M'))} title={t('Mirror M (L↔R)', 'Mirror M (L↔R)')} aria-label="Mirror M"><FlipHorizontal2 size={13} /></button>}
          {!isSquarePuzzle && !isTwistyMode && corner?.cubeMirrors !== false && <button onClick={tool((s) => mirrorAlg(s, 'S'))} title={t('Mirror S (F↔B)', 'Mirror S (F↔B)')} aria-label="Mirror S"><FlipVertical2 size={13} /></button>}
          {undoTool}
          {endTools}
        </>}
      </div>
      </section>
      </div>

      <SimAppearancePanel
        open={appearanceOpen}
        onToggle={onAppearanceToggle}
        world={world}
        order={order}
        puzzleKind={puzzleKind}
        renderer={renderer}
        onRendererChange={onRendererChange}
        settings={settings}
        onSettingsChange={onSettingsChange}
        canUseCustomLogo={canUseCustomLogo}
        transCore={transCore}
        bgSlot={bgSlot}
        t={t}
      />
      <KeymapModal
        open={keymapOpen}
        onClose={() => setKeymapOpen(false)}
        keymap={keymap}
        onKeymapChange={onKeymapChange}
        onResetKeymap={onResetKeymap}
      />
    </div>
  );
}

/** 按键映射键盘:按 keymap 的 QWERTY 布局排键,点键 = 转魔方(与实体按键同一条
 *  applyMove 路径)。空位(没映射的键)禁用。布局数据与快捷键弹窗共用 keymap.ts。 */
function SimQwertyKeypad({
  keymap,
  onMove,
}: {
  keymap: Record<string, KeyMove>;
  onMove: (k: KeyMove) => void;
}) {
  return (
    <div className="sim-keyboard sim-qwerty-keypad">
      {KEYBOARD_ROWS.map((row, ri) => (
        <div key={ri} className="sim-keyboard-row">
          {row.map((code) => {
            const m = keymap[code];
            return (
              <button
                key={code}
                type="button"
                className={'sim-key' + (!m ? ' empty' : '')}
                disabled={!m}
                onPointerDown={(e) => {
                  if (!m) return;
                  e.preventDefault();
                  onMove(m);
                }}
              >
                <span className="sim-key-label">{keyLabel(code)}</span>
                <span className="sim-key-move">{m ? displayMove(m) : '·'}</span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

const UNIT_TPS: SliderUnit = { to: simSpeedToTps, from: simTpsToSpeed, min: 0.5, max: 6, step: 0.1, decimals: 1 };

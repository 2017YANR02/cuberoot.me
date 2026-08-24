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
 *    twist, same applyMove path as hard keys). Mobile auto-opens qwerty.
 *  - Scramble path uses tnoodleRandomScramble (lib/cubing-scramble.ts), which
 *    routes to cubing.js + the in-app pool. NxN N≥8 falls back to inline
 *    random-move (cheap, no solver needed).
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import {
  Play,
  FlipHorizontal2, FlipVertical2, Eraser,
  Shuffle, Link2, Check,
  Search, Loader2, Pipette,
  Keyboard, Grid3x3, ImagePlus, Upload, Trash2, Crop,
} from 'lucide-react';
import { Alg, Move } from 'cubing/alg';
import World from './engine/world';
import { TwistAction } from './engine/nxn/twister';
import { timing } from './engine/tweenTiming';
import tweener from './engine/tweener';
import { parseSq1Scramble, movesToString, type Sq1Move } from './engine/sq1/sq1State';
import { parseIvyMoves } from './engine/ivy/IvyTwister';
import type { IvyMove } from './engine/ivy/IvyCube';
import { classifyIvyTokens } from '@/lib/ivy-solver';
import {
  parseDinoMoves, dinoMovesToString, randomDinoScramble, type DinoMove,
} from './engine/dino/dinoState';
import {
  parseRediMoves, rediMovesToString, randomRediScramble, type RediMove,
} from './engine/redi/rediState';
import {
  parseRexMoves, rexMovesToString, randomRexScramble, type RexMove,
} from './engine/rex/rexState';
import {
  parseHeliMoves, heliMovesToString, randomHeliScrambleMoves, type HeliMove,
} from './engine/heli/heliState';
import {
  parseGearMoves, gearMovesToString, invertGearMoves, reduceGearAlg, randomGearScrambleMoves, type GearAnyMove,
} from './engine/gear/gearState';
import {
  parseSkewbMoves, skewbMovesToString, randomSkewbScramble, isSkewbRot, type SkewbMove,
} from './engine/skewb/skewbState';
import {
  parsePyraMoves, pyraMovesToString, invertPyraMoves, reducePyraAlg, randomPyraScramble, type PyraMove,
} from './engine/pyra/pyraState';
import {
  parseMegaMoves, megaMovesToString, invertMegaMoves, reduceMegaAlg, randomMegaScramble, type MegaMove,
} from './engine/mega/megaState';
import {
  parseFtoMoves, ftoMovesToString, invertFtoMoves, randomFtoScramble, type FtoMove,
} from './engine/fto/ftoState';
import { parseFtoEifMoveGroups } from './engine/fto/ftoEifMoves';
import {
  parseClockSteps, clockStepsToString, invertClockSteps, type ClockStep,
} from '@/lib/clock-notation';
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
  return out.join(' ');
}
import { invertAlg, simplifyAlg, simplifyTwistyAlg, mirrorAlg } from '@/lib/cube3';
import { get_shortened_rotation } from '@/lib/roux/RotationHelp';
import {
  cleanForPlayer, extractAlgFromText, findTokenPositions, findWhitespaceTokenPositions,
  type TokenPosition,
} from '@/lib/recon-alg-utils';
import { deriveScrambleFromSolution } from '@/lib/scramble-from-solution';
import { tnoodleRandomScramble } from '@/lib/cubing-scramble';
import { pgRandomScramble } from '@/lib/pg-scramble';
import { cloudOptimalScramble, firstBadHtmToken } from '@/lib/cloud-optimal-scramble';
import { useAuthStore } from '@/lib/auth-store';
import {
  formatScrambleForEvent, canonicalSq1Alg, compactSq1Alg,
  simplifySq1Alg, invertSq1Alg,
} from '@cuberoot/shared/sq1-notation';
import { toWca as toWcaSkewb, type SkewbNotation } from '@cuberoot/shared/skewb-notation';
import SkewbNotationGuide from './SkewbNotationGuide';
import {
  Slider, ValueField, OrbitPad, Toggle, KeymapModal, resetWorldView, mapFrames,
  DEFAULT_SETTINGS, DEFAULT_FACE_COLORS, MIRROR_DEFAULT_COLOR, persistPictureFaces,
  type SimSettings, type SimBoardBg, type SliderUnit,
} from './SettingDrawer';
import { KEYBOARD_ROWS, keyLabel, displayMove, type KeyMove } from './keymap';
import CubeVirtualKeyboard from '@/components/CubeVirtualKeyboard';
import ResetDefaultsButton from '@/components/ResetDefaultsButton';
import { defaultPlatonicColorSchemes } from '@/lib/puzzle-geometry/colors';
import { fileToLogoDataUrl } from './engine/nxn/logo';
import {
  PICTURE_FACE_ORDER,
  DEFAULT_PICTURE_CROP,
  countPictureFaces,
  drawPictureCrop,
  emptyPictureFaces,
  fileToPictureEditSourceDataUrl,
  normalizePictureCrop,
  panPictureCropBy,
  pictureCropGeometry,
  pictureEditSourceToFaceDataUrl,
  rotatePictureCropTo,
  zoomPictureCropAt,
  type PictureCrop,
  type PictureFace,
  type PictureFaces,
} from './engine/nxn/pictureCube';
import { PG_PUZZLES, isPgPuzzleId, type PgPuzzleId } from './pgCatalog';
import { resolveCaps } from './simCaps';
import StickeringSelect from './StickeringSelect';
import type { PickGrain, CustomTreatment } from './engine/nxn/customStickering';
import { simulateGrips, type GripName, type GripSimStep, type HandSide, type PinSpec } from './engine/hands/handsRig';
import { stripGripMarks } from '@cuberoot/shared/alg-notation';
import {
  canonicalFtoEifAlgorithm,
  invertFtoEifAlgorithm,
  reduceFtoEifAlgorithm,
} from '@cuberoot/shared/fto-notation';
import { stripFtnBlocks, FTN_TOKEN, parseFtnPin } from './engine/hands/ftn';
import { ClearButton } from '@/components/ClearButton';
import PuzzlePicker, { type PuzzlePickerGroup } from '@/components/PuzzlePicker/PuzzlePicker';
import { eventDisplayName } from '@/lib/wca-events';
import { simSpeedToTps, simTpsToSpeed } from '@/lib/sim_timing';
import AlgInput from '@/components/AlgInput';
import PlaybackBar from '@/components/PlaybackBar';
import BoolToggle from '@/components/BoolToggle';
import NxNOrderInput from '@/components/NxNOrderInput';
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

/** Convert SQ1 text while preserving per-line `// comments` and newlines. */
function convertSq1Text(text: string, convert: (s: string) => string): string {
  return text.split('\n').map(line => {
    const commentIdx = line.indexOf('//');
    const algPart = commentIdx >= 0 ? line.slice(0, commentIdx) : line;
    const comment = commentIdx >= 0 ? line.slice(commentIdx) : '';
    const converted = algPart.trim() ? convert(algPart) : '';
    return comment ? `${converted}  ${comment}` : converted;
  }).join('\n');
}

// WCA-standard event names reuse the site-wide single source (lib/wca-events
// eventDisplayName — same labels the /wca/records page renders: 三阶/3×3, SQ1,
// 金字塔/Pyra, 斜转/Skewb, 五魔/Mega...). Non-WCA puzzles below keep bespoke names.
const PUZZLE_TYPE_OPTIONS = [
  { value: 'nxn',      iconClass: 'event-333', labelZh: 'NxN',    labelEn: 'NxN' },
  { value: 'custom',   iconClass: 'event-333', labelZh: '自定义切割', labelEn: 'Puzzle Cuts' },
  { value: 'sq1',      iconClass: 'event-sq1', labelZh: eventDisplayName('sq1', true), labelEn: eventDisplayName('sq1', false) },
  { value: 'ivy',      iconClass: 'unofficial-ivy', labelZh: '枫叶', labelEn: 'Ivy' },
  { value: 'pyraminx', iconClass: 'event-pyram', labelZh: eventDisplayName('pyram', true), labelEn: eventDisplayName('pyram', false) },
  { value: 'skewb',    iconClass: 'event-skewb', labelZh: eventDisplayName('skewb', true), labelEn: eventDisplayName('skewb', false) },
  { value: 'megaminx', iconClass: 'event-minx',  labelZh: eventDisplayName('minx', true), labelEn: eventDisplayName('minx', false) },
  { value: 'clock',    iconClass: 'event-clock', labelZh: eventDisplayName('clock', true), labelEn: eventDisplayName('clock', false) },
  { value: 'fto',      iconClass: 'unofficial-fto', labelZh: eventDisplayName('fto', true), labelEn: eventDisplayName('fto', false) },
  { value: 'dino',     iconClass: 'unofficial-dino', labelZh: '恐龙', labelEn: 'Dino' },
  { value: 'redi',     iconClass: 'unofficial-redi', labelZh: 'Redi', labelEn: 'Redi' },
  { value: 'rex',      iconClass: 'unofficial-rex', labelZh: 'Rex', labelEn: 'Rex Cube' },
  { value: 'heli',     iconClass: 'unofficial-helicopter', labelZh: '直升机', labelEn: 'Helicopter' },
  { value: 'gear',     iconClass: 'unofficial-gear', labelZh: '齿轮', labelEn: 'Gear Cube' },
  { value: 'mirror',   iconClass: 'unofficial-333_mirror_blocks', labelZh: '镜面', labelEn: 'Mirror' },
  { value: 'mirror2',  iconClass: 'unofficial-222_mirror_blocks', labelZh: '二阶镜面', labelEn: 'Mirror 2x2' },
] as const;

// Engine puzzles above + cubing.js PuzzleGeometry puzzles (explore set, rendered
// via TwistyPlayer — see pgCatalog.ts). The PG entries are appended at runtime so
// the catalog stays the single source of truth.
const ALL_PUZZLE_TYPE_OPTIONS: { value: string; iconClass: string; labelZh: string; labelEn: string }[] = [
  ...PUZZLE_TYPE_OPTIONS,
  ...PG_PUZZLES.map((p) => ({ value: p.id, iconClass: p.icon, labelZh: p.zh, labelEn: p.en })),
];

export function PuzzleTypeSelect({ value, onChange, isZh, allowedValues }: {
  value: string;
  onChange: (v: string) => void;
  isZh: boolean;
  /** Optional subset for another /sim tool that shares this selector. */
  allowedValues?: readonly string[];
}) {
  const options = (() => {
    if (!allowedValues) return ALL_PUZZLE_TYPE_OPTIONS;
    const allowed = new Set(allowedValues);
    return ALL_PUZZLE_TYPE_OPTIONS.filter((option) => allowed.has(option.value));
  })();
  const current = options.find((option) => option.value === value) ?? options[0];
  const groups: readonly PuzzlePickerGroup[] = [{
    id: 'sim-puzzles',
    label: ['Puzzles', '项目'][Number(isZh)],
    items: options.map((option) => ({
      id: option.value,
      label: [option.labelEn, option.labelZh][Number(isZh)],
      iconClass: option.iconClass,
    })),
  }];

  return (
    <PuzzlePicker
      isZh={isZh}
      selectedEvent={current?.value}
      groups={groups}
      onSelect={onChange}
    />
  );
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
export type SimPuzzle = number | 'sq1' | 'ivy' | 'dino' | 'redi' | 'rex' | 'heli' | 'gear' | 'pyraminx' | 'skewb' | 'megaminx' | 'fto' | 'mirror' | 'mirror2' | 'clock' | 'custom' | PgPuzzleId;

function isTwistyPuzzle(p: SimPuzzle): p is 'pyraminx' | 'skewb' | 'megaminx' | 'fto' {
  return p === 'pyraminx' || p === 'skewb' || p === 'megaminx' || p === 'fto';
}

const SAME_AXIS_1X1: Record<string, 'x' | 'y' | 'z'> = {
  R: 'x', U: 'y', F: 'z', S: 'z',
};
const OPP_AXIS_1X1: Record<string, 'x' | 'y' | 'z'> = {
  L: 'x', D: 'y', B: 'z', M: 'x', E: 'y',
};

function invertSq1Moves(moves: Sq1Move[]): Sq1Move[] {
  const out: Sq1Move[] = [];
  for (let i = moves.length - 1; i >= 0; i--) {
    const m = moves[i];
    out.push(m.kind === 'slice' ? m : { kind: 'turn', top: -m.top, bot: -m.bot });
  }
  return out;
}

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
type CornerKind = 'dino' | 'redi' | 'rex' | 'heli' | 'gear' | 'skewb' | 'pyraminx' | 'megaminx' | 'fto' | 'clock';

interface CornerSpec {
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

const CORNER_SPECS: Record<CornerKind, CornerSpec> = {
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

type AlgHlSpan = { text: string; bad?: boolean; current?: boolean };

/** Splice a `[start, end)` "currently playing" range across a span list, tagging
 *  the overlapping slice(s) `current` (and slicing a span in two/three when the
 *  range only partly covers it) — same mirror-overlay trick the Ivy `bad`
 *  highlighting already uses (`.sim-player-hl`), just orange instead of red and
 *  driven by playback position instead of live validation. */
function applyAlgHighlight(spans: AlgHlSpan[], range: [number, number] | null): AlgHlSpan[] {
  if (!range) return spans;
  const [hs, he] = range;
  if (he <= hs) return spans;
  const out: AlgHlSpan[] = [];
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
  world: World | null;
  alg: string;
  setup?: string;
  onAlgChange: (alg: string) => void;
  onSetupChange: (setup: string) => void;
  order: number;
  onOrderChange: (n: number) => void;
  puzzleKind: SimPuzzle;
  onPuzzleChange: (kind: SimPuzzle) => void;
  settings: SimSettings;
  onSettingsChange: (s: SimSettings) => void;
  /** 图像面板选中 trans(X 光)视图时的内核预设值(SettingDrawer 的 TRANS_CORE),否则 null。
   *  非 null = 内核色 / 内核不透明度由预设接管(3D 与伴图同吃这一份,见 SimPage 的
   *  withTransCore):外观区那两行显示预设值、锁死不可改,hover 说明原因。 */
  transCore?: { coreColor: string; coreOpacity: number } | null;
  keymap: Record<string, KeyMove>;
  onKeymapChange: (km: Record<string, KeyMove>) => void;
  onResetKeymap: () => void;
  userMoveRef?: RefObject<((action: TwistAction | string) => void) | null>;
  /** TwistyPlayer instance for pyraminx/skewb/megaminx — used by animateScramble
   *  to drive jumpToStart + play after the alg is set. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  twistyPlayerRef?: RefObject<any>;
  /** Skewb-only: Sarah vs WCA notation. Owner SimPage persists in localStorage. */
  skewbNotation?: SkewbNotation;
  onSkewbNotationChange?: (n: SkewbNotation) => void;
  /** Renderer for an ENGINE_TWISTY puzzle: 'cubing' = cubing.js TwistyPlayer (default),
   *  'group' = the in-house Three.js engine + group-theory panel. 'engine' (engine without
   *  panel) is retired — still typed so stale URLs parse, treated as 'group'. */
  renderer?: 'cubing' | 'engine' | 'group';
  onRendererChange?: (r: 'cubing' | 'engine' | 'group') => void;
  /** DOM node below the cube canvas to portal the playback control row into
   *  (twizzle-style bar under the puzzle). Falls back to inline when absent. */
  playbackSlot?: HTMLElement | null;
  /** DOM node at the canvas' bottom-left corner to portal the 背景(BG)selector into
   *  (overlays the big cube view, like the top-right back-view window). When absent the
   *  selector simply doesn't render — SimPage always provides the slot. */
  bgSlot?: HTMLElement | null;
  /** 全屏/退出全屏按钮(SimPage 持有 fullscreen 状态),渲染在播放条按钮排最左
   *  (twizzle alpha.twizzle.net/edit 同款,全屏钮居首)。 */
  fullscreenButton?: ReactNode;
  /** 画布左上角图像浮层的显隐开关(状态归 SimPage),放在按钮排最左 —— 与浮层
   *  自身的关闭钮是同一个开关的两个入口。 */
  imageButton?: ReactNode;
  /** 画布右上角背面小窗的显隐开关,放在按钮排最右,同上。 */
  backViewButton?: ReactNode;
  /** 按阶段展示色块(twizzle stickering,issue #27)。URL 状态归 SimPage(nuqs),
   *  这里只渲染播放条最左的下拉。支持与否走 simCaps.supports.stickering(不支持隐藏)。 */
  stickering?: string;
  onStickeringChange?: (v: string) => void;
  /** 阶段遮罩的拿方朝向(整体转前缀,24 档),仅 NxN 引擎遮罩;默认 ''(UF,恒等)。 */
  stickeringRot?: string;
  onStickeringRotChange?: (v: string) => void;
  /** 自定义阶段:选中的贴纸清单(mask-core DSL)+ 作图开关。状态归 SimPage。 */
  stickeringMask?: string;
  onStickeringMaskClear?: () => void;
  customEditing?: boolean;
  onCustomEditingChange?: (v: boolean) => void;
  customGrain?: PickGrain;
  onCustomGrainChange?: (v: PickGrain) => void;
  /** 自定义阶段的画法:选中的 / 其余的各自原色、压暗还是置灰。 */
  customPick?: CustomTreatment;
  onCustomPickChange?: (v: CustomTreatment) => void;
  customRest?: CustomTreatment;
  onCustomRestChange?: (v: CustomTreatment) => void;
}

export default function PlayerControls({
  world, alg, setup, onAlgChange: onAlgChangeProp, onSetupChange: onSetupChangeProp,
  order, onOrderChange, puzzleKind, onPuzzleChange,
  settings, onSettingsChange, transCore = null,
  keymap, onKeymapChange, onResetKeymap,
  userMoveRef, twistyPlayerRef,
  skewbNotation, onSkewbNotationChange,
  renderer = 'cubing', onRendererChange,
  playbackSlot, bgSlot, fullscreenButton, imageButton, backViewButton,
  stickering = 'full', onStickeringChange,
  stickeringRot = '', onStickeringRotChange,
  stickeringMask = '', onStickeringMaskClear,
  customEditing = true, onCustomEditingChange,
  customGrain = 'sticker', onCustomGrainChange,
  customPick = 'regular', onCustomPickChange,
  customRest = 'ignored', onCustomRestChange,
}: Props) {
  const isSq1 = puzzleKind === 'sq1';
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
  // Corner/edge-turn engine puzzle descriptor (Dino/Redi/Rex/Heli/Skewb/Pyraminx), or
  // null for everything else. One mapping line per puzzle; every player branch below
  // keys off `corner` instead of a per-puzzle boolean chain.
  const cornerKind: CornerKind | null =
    puzzleKind === 'dino' ? 'dino'
      : puzzleKind === 'redi' ? 'redi'
        : puzzleKind === 'rex' ? 'rex'
          : puzzleKind === 'heli' ? 'heli'
          : puzzleKind === 'gear' ? 'gear'
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
  const algAutoSpaceSafe = !corner || cornerKind === 'redi' || cornerKind === 'pyraminx';
  const algAutoSpace: boolean | 'simple' =
    algAutoSpaceSafe ? true : cornerKind === 'gear' ? 'simple' : false;
  // "Derive scramble from solution" (cubedb-style) is 3x3-only — the solver is.
  const is3x3 = !isSq1 && !isIvy && !corner && !isTwistyMode && order === 3;
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const t = (zh: string, en: string) => (isZh ? zh : en);

  const authUser = useAuthStore((s) => s.user);
  const authLogin = useAuthStore((s) => s.login);

  const [algDraft, setAlgDraft] = useState(alg);
  const [setupDraft, setSetupDraft] = useState(setup ?? '');
  const [sq1Format, setSq1Format] = useState<'compact' | 'wca'>('compact');
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  // Caret char offset in the solution box while the user is navigating text (click
  // / arrow keys / typing) — drives the "current move" highlight the twizzle way
  // (highlight the move the caret is *on*, not the last one fully behind it).
  // Null = highlight follows playback position (`step`) instead; cleared whenever
  // a non-caret action (play / step / reset) moves the timeline.
  const [caretChar, setCaretChar] = useState<number | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [derivingScramble, setDerivingScramble] = useState(false);
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
  const setupElRef = useRef<HTMLTextAreaElement | null>(null);
  const algElRef = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => { stepRef.current = step; }, [step]);

  // 虚拟键盘:'alg' = 记号输入键盘(写进解法框),'qwerty' = 按键映射键盘(点击 =
  // 转魔方)。桌面默认收起;移动端(实体键盘点不到)mount 后自动展开 qwerty —
  // 不能用 useIsMobile 做 useState 初值:SSR 首帧按非移动渲染,水合会不一致。
  const [kbVariant, setKbVariant] = useState<'alg' | 'qwerty' | null>(null);
  useEffect(() => {
    if (window.matchMedia('(max-width: 768px)').matches) setKbVariant('qwerty');
  }, []);
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
    setAlgDraft(alg);
  }, [alg]);
  useEffect(() => {
    const s = setup ?? '';
    if (s === pushedSetupRef.current || s === replacedSetupRef.current) return;
    setSetupDraft(s);
  }, [setup]);

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
    if (isSq1 || isIvy || corner) return [];
    if (!algDraft.trim()) return [];
    try {
      return parseNxnItems(algDraft);
    } catch {
      return [];
    }
  }, [algDraft, isSq1, isIvy, corner]);

  const sq1Actions = useMemo<Sq1Move[]>(() => {
    if (!isSq1) return [];
    return parseSq1Scramble(algDraft);
  }, [algDraft, isSq1]);

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
    if (isSq1 || isTwistyMode) return [];
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
  }, [algDraft, isSq1, isTwistyMode, isIvy, ivyCanPlay, corner]);

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

  const algHlBaseSpans = useMemo<AlgHlSpan[]>(
    () => ivyAlgSpans ?? [{ text: algDraft }],
    [ivyAlgSpans, algDraft],
  );
  const algHlSpans = useMemo(
    () => applyAlgHighlight(algHlBaseSpans, highlightRange),
    [algHlBaseSpans, highlightRange],
  );
  const showAlgOverlay = !!ivyAlgSpans || !!highlightRange;

  const totalSteps = isSq1
    ? sq1Actions.length
    : isIvy
      ? (ivyCanPlay ? ivyActions.length : 0)
      : corner
        ? cornerActions.length
        : nxnItems.length;

  const jumpToStep = useCallback(async (n: number) => {
    if (!world) return;
    // Release any held-partial (debug) turn first: an NxN frozen layer holds the
    // cube lock, which would make the replay's group.twist below spin forever.
    world.controller.clearFrozen();
    if (isSq1) {
      const sq1Cube = world.cube as unknown as import('./engine/sq1/Sq1Cube').default;
      sq1Cube.twister.finish();
      const effSetup = settings.playbackMode === 'algorithm'
        ? (setupDraft + ' ' + movesToString(invertSq1Moves(sq1Actions))).trim()
        : setupDraft;
      // setup() applies the scramble as the base state; layer the first `target`
      // solution moves on top WITHOUT resetting (applyMovesInstant would snap
      // back to solved first, wiping the scramble). Mirrors the NxN path below.
      sq1Cube.twister.setup(effSetup);
      const target = Math.max(0, Math.min(n, sq1Actions.length));
      for (let i = 0; i < target; i++) sq1Cube.applyMoveInstant(sq1Actions[i]);
      setStep(target);
      return;
    }
    if (isIvy) {
      // A bad token in either box → can't play: leave the cube as-is (the box
      // shows the offending token in red) rather than feeding it to the parser.
      if (!ivyCanPlay) { setStep(0); return; }
      const ivyCube = world.cube as unknown as import('./engine/ivy/IvyCube').default;
      ivyCube.twister.finish();
      const effSetup = settings.playbackMode === 'algorithm'
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
      const cube = world.cube as unknown as CornerCube;
      cube.twister.finish();
      const effSetup = settings.playbackMode === 'algorithm'
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
    const effectiveSetup = settings.playbackMode === 'algorithm'
      ? (setupDraft + ' ' + invertAlg(stripHandMarks(algDraft))).trim()
      : setupDraft;
    await cube.twister.setupAsync(effectiveSetup);
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
  }, [world, setupDraft, algDraft, nxnItems, sq1Actions, ivyActions, cornerActions, corner, toEngineText, isSq1, isIvy, ivyCanPlay, settings.playbackMode]);

  // Notation guide (engine skewb): play ONE token on the main cube from solved so the
  // user sees which corner a letter turns. It only borrows the cube — setup/alg text is
  // untouched — so `jumpToStep` rebuilds the user's state on demand (Back to my cube).
  const demoNotationMove = useCallback((token: string) => {
    if (!world || isTwistyMode) return;
    const tw = (world.cube as unknown as CornerCube).twister;
    tw.finish();
    world.controller.clearFrozen();
    tw.setup('');
    tw.push(toEngineText(token));
  }, [world, isTwistyMode, toEngineText]);

  const restoreFromDemo = useCallback(() => { jumpToStep(stepRef.current); }, [jumpToStep]);

  const animatingScrambleRef = useRef(false);
  const scrambleReqIdRef = useRef(0);
  // 上一次驱动过魔方状态的解法文本 —— auto-reset effect 用它判断「这次变更是不是
  // 纯末尾追加」:是,且开着「动画」,就在当前状态上动画转新招,而不是整段瞬切重放。
  const prevAlgTextRef = useRef(alg);

  useEffect(() => {
    const actions = isSq1 ? sq1Actions : isIvy ? ivyActions : corner ? cornerActions : nxnItems;
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
          settings.animatePlayback !== false && settings.playbackMode !== 'algorithm'
          && !isSq1 && !isIvy && world
          && n === actions.length && stepRef.current === n - 1
          && algDraft.startsWith(prevText)
        ) {
          if (corner) {
            const twister = (world.cube as unknown as CornerCube).twister;
            const group = actions[n - 1] as unknown[];
            if (corner.parseGroups && twister.pushMoves) twister.pushMoves(group);
            else twister.twist(group[0], false, true);
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
  }, [setupDraft, nxnItems, sq1Actions, ivyActions, cornerActions, settings.playbackMode]);

  /** 光标位置 → 光标前的完整步数(各拼图各自的 parser);解析不了返回 null。 */
  const caretStepOf = useCallback((text: string, caretIndex: number): number | null => {
    const before = text.slice(0, caretIndex);
    if (!isSq1 && !isIvy && !corner) {
      // NxN 直接喂原文(parseNxnItems 自己剥注释):extractAlgFromText 会把
      // ↑/↓/· 当装饰剥掉,经它一遍换握步就数丢了。
      try { return parseNxnItems(before).length; } catch { return null; }
    }
    const algBefore = extractAlgFromText(before);
    if (isSq1) return parseSq1Scramble(algBefore).length;
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
  }, [isSq1, isIvy, corner]);

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
    setCaretChar(null); // hand the highlight back to the playback position
    const animate = settings.animatePlayback !== false;
    if (animate && !isSq1 && !isIvy && !corner && world && step < nxnItems.length) {
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
  }, [jumpToStep, step, settings.animatePlayback, settings.speed, playbackFrames, isSq1, isIvy, corner, world, nxnItems]);

  const stepBack = useCallback(() => {
    setCaretChar(null); // hand the highlight back to the playback position
    const animate = settings.animatePlayback !== false;
    if (animate && !isSq1 && !isIvy && !corner && world && step > 0 && step <= nxnItems.length) {
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
  }, [jumpToStep, step, settings.animatePlayback, settings.speed, playbackFrames, isSq1, isIvy, corner, world, nxnItems]);

  // Play/pause toggle for the shared PlaybackBar. Pausing is instant; starting
  // from the end first复位到第 0 步(并同步 stepRef,否则播放轮询读到 step≥total
  // 会立刻停),复位完成后再开播 — 与旧内联 handler 行为一致。
  const handleTogglePlay = useCallback(async () => {
    if (playing) { setPlaying(false); return; }
    setCaretChar(null); // playback owns the highlight from here
    if (step >= totalSteps) {
      await jumpToStep(0);
      stepRef.current = 0;
    }
    setPlaying(true);
  }, [playing, step, totalSteps, jumpToStep]);

  useEffect(() => {
    if (!playing) {
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
    const total = isSq1 ? sq1Actions.length : isIvy ? ivyActions.length : corner ? cornerActions.length : nxnItems.length;
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
      if (!world) return;
      if (!animatePlayback) {
        // 瞬切:走跟「下一步」按钮同一条 instant 落子路径(fast+force / applyMoveInstant),
        // 不产生 tween;节拍由 interval 周期 stepDelayMs 控制。
        if (isSq1) {
          (world.cube as unknown as import('./engine/sq1/Sq1Cube').default).applyMoveInstant(sq1Actions[s]);
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
      if (isSq1) {
        const sq1Cube = world.cube as unknown as import('./engine/sq1/Sq1Cube').default;
        started = sq1Cube.twister.twist(sq1Actions[s], false, false);
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
  }, [playing, nxnItems, sq1Actions, ivyActions, cornerActions, corner, world, playbackFrames, isSq1, isIvy, settings.animatePlayback, settings.speed]);

  const tool = (transform: (s: string) => string) => () => {
    // 镜像/转体变换先剥手部记号(cubing.js Alg 解析不了会 catch 返 '',静默清空解法框)。
    const combined = stripHandMarks(setupDraft + ' ' + algDraft).trim();
    const next = transform(combined);
    setSetupDraft('');
    onSetupChange('');
    setAlgDraft(next);
    onAlgChange(next);
    if (setupElRef.current) setupElRef.current.value = '';
    if (algElRef.current) algElRef.current.value = next;
  };

  // Per-puzzle "消步" (cancel redundant moves) + invert. SQ1 has its own token
  // model; pyraminx/skewb/megaminx (cubing.js) can't use the cube's mod-4 fold.
  // Corner-turn engine puzzles fold via their descriptor.
  const simplifyForPuzzle = useCallback((s: string): string => {
    if (isSq1) return simplifySq1Alg(s, sq1Format);
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
  }, [isSq1, isIvy, corner, isTwistyMode, sq1Format, order]);

  const invertForPuzzle = useCallback((s: string): string => {
    if (corner) {
      try {
        return corner.invertText?.(s) ?? corner.toString(corner.invert(corner.parse(s)));
      } catch { return s; }
    }
    if (!isSq1) return invertAlg(stripHandMarks(s)); // 倒序后换握/推法位点失义,直接剥
    const inv = invertSq1Alg(s);
    return sq1Format === 'wca' ? canonicalSq1Alg(inv) : compactSq1Alg(inv);
  }, [isSq1, corner, sq1Format]);

  // 消步 = 实时消步开关(settings.liveReduce);开启时手势 / 键盘追加自动消步。
  // 拨到开还顺手把当前解法消一次步(兼顾原一次性按钮:手敲 / 粘贴后开开关即整理)。
  const setLiveReduce = useCallback((v: boolean) => {
    onSettingsChange({ ...settings, liveReduce: v });
    if (!v) return;
    const reduced = simplifyForPuzzle(algDraft.trim());
    if (reduced === algDraft.trim()) return;
    setAlgDraft(reduced);
    onAlgChange(reduced);
    const el = algElRef.current;
    if (el) { el.value = reduced; autosize(el); }
  }, [settings, onSettingsChange, algDraft, simplifyForPuzzle, onAlgChange]);

  // Copy the current page URL (puzzle + scramble + solution params) so the exact
  // sim state can be shared. Works for any puzzle — the URL always carries state.
  const copyTimerRef = useRef<number | null>(null);
  useEffect(() => () => { if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current); }, []);
  const handleCopyLink = useCallback(() => {
    if (typeof window === 'undefined' || !navigator.clipboard?.writeText) return;
    flushAlgCommit(); // land any debounced move into the URL before copying it
    navigator.clipboard.writeText(window.location.href).then(() => {
      setLinkCopied(true);
      if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = window.setTimeout(() => setLinkCopied(false), 1500);
    }).catch(() => { /* clipboard denied */ });
  }, [flushAlgCommit]);

  const appendUserMove = useCallback((action: TwistAction | string) => {
    let moveText = typeof action === 'string' ? action : action.value;
    if (typeof action !== 'string' && !isSq1 && !isTwistyMode && world && world.cube.order === 1) {
      const norm = normalizeTo1x1(action);
      if (!norm) return;
      moveText = norm.value;
    }
    if (!moveText) return;
    const algEl = algElRef.current;
    if (!algEl) return;
    const current = algEl.value;
    // SQ1: glue slices to adjacent turns (`(1,0)/(2,0)`), but NEVER glue two
    // slices — `//` is the comment marker and parseSq1Tokens would drop it, so
    // a dragged double-slice must read as `/ /`.
    const endsSlash = current.trimEnd().endsWith('/');
    const glue = isSq1 && (moveText === '/' || endsSlash) && !(moveText === '/' && endsSlash);
    const sep = current.trim() ? (glue ? '' : ' ') : '';
    let next = current.trimEnd() + sep + moveText + ' ';
    // 实时消步:追加后立即 fold/抵消重复转动(R 后做 R' → 框里清空)。魔方本身已被
    // 手势转过去,这里只改文本,故必须 skipAutoReset 不让文本变更触发回放重置。
    if (settings.liveReduce !== false && !isIvy) {
      const reduced = simplifyForPuzzle(next.trim());
      next = reduced ? reduced + ' ' : '';
    }
    algEl.value = next;
    algEl.selectionStart = algEl.selectionEnd = next.length;
    autosize(algEl);
    skipAutoResetRef.current = true;
    setAlgDraft(next);
    // Defer only the URL write (nuqs setQuery). Synchronously it re-renders SimPage
    // (query changed) right as the snap animation starts — the dominant per-move frame
    // drop (the "开始转动掉帧"). The cube, textarea DOM and React alg state are already
    // current above; the URL can lag, so land it once the turn animation has settled
    // (idle-gated) and coalesce rapid turns into one write.
    commitAlgDebounced(next);
  }, [commitAlgDebounced, isSq1, isIvy, isTwistyMode, world, settings.liveReduce, simplifyForPuzzle]);

  useEffect(() => {
    if (!userMoveRef) return;
    userMoveRef.current = appendUserMove;
    return () => { userMoveRef.current = null; };
  }, [userMoveRef, appendUserMove]);

  // QWERTY: keymap → twist + append (hard keys + the on-screen keymap keypad).
  const applyMove = useCallback((k: KeyMove) => {
    if (isSq1 || isIvy || isTwistyMode) return;
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
  }, [world, isSq1, isIvy, corner, isTwistyMode, onAlgChange, settings.animatePlayback, appendUserMove]);

  // QWERTY 键盘展开时,实体按键按 keymap 走(捕获阶段,连解法框聚焦时也接管);
  // 打乱框聚焦时放行(让字符正常落进打乱框)。capture + stopPropagation 同时挡掉
  // SimPage 的全局 keydown,不会双触发。
  useEffect(() => {
    if (kbVariant !== 'qwerty') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
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
  }, [kbVariant, keymap, applyMove]);

  const handleScramble = useCallback(async () => {
    const reqId = ++scrambleReqIdRef.current;
    // Twisty puzzles (pyraminx/skewb/megaminx) — no cuber world. Route to
    // tnoodleRandomScramble (cubing.js + pool). animateScramble=false writes
    // setup (instant baseline); true clears setup, sets alg, and drives the
    // TwistyPlayer to jumpToStart + play.
    if (isTwistyMode) {
      let twistyScramble = '';
      try {
        // PuzzleGeometry explore puzzles have no tnoodle event — generate a random
        // move sequence from the live player's own move set instead.
        twistyScramble = (isPgPuzzleId(puzzleKind as string) || puzzleKind === 'custom')
          ? await pgRandomScramble(twistyPlayerRef?.current)
          : ((await tnoodleRandomScramble(puzzleKind as string)) ?? '');
      } catch (err) {
        console.warn('[sim] twisty scramble failed:', err);
      }
      if (reqId !== scrambleReqIdRef.current) return;
      if (settings.animateScramble && twistyScramble) {
        if (setupElRef.current) {
          setupElRef.current.value = '';
          autosize(setupElRef.current);
        }
        setSetupDraft('');
        onSetupChange('');
        if (algElRef.current) {
          algElRef.current.value = twistyScramble;
          autosize(algElRef.current);
        }
        skipAutoResetRef.current = true;
        setAlgDraft(twistyScramble);
        onAlgChange(twistyScramble);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const p = twistyPlayerRef?.current as unknown as { jumpToStart?: (opts?: unknown) => void; play?: () => void } | null;
            try { p?.jumpToStart?.({ flash: false }); } catch { /* */ }
            try { p?.play?.(); } catch { /* */ }
          });
        });
        return;
      }
      if (setupElRef.current) {
        setupElRef.current.value = twistyScramble;
        autosize(setupElRef.current);
      }
      setSetupDraft(twistyScramble);
      onSetupChange(twistyScramble);
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
        scramble = raw ? formatScrambleForEvent('sq1', raw) : '';
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
      scramble = isSq1 ? '' : isIvy ? randomIvyScramble() : corner ? '' : randomMoveScrambleNxN(order);
    }
    if (reqId !== scrambleReqIdRef.current) return;
    if (!scramble) return;
    world.controller.clearFrozen(); // release any debug held-partial turn first
    // SQ1 / Ivy / corner-turn puzzles always animate — instant apply would be
    // visually indistinguishable from no rotation. The animation is the whole point.
    const animate = isSq1 || isIvy || !!corner || settings.animateScramble;
    if (animate) {
      animatingScrambleRef.current = true;
      world.cube.twister.setup('');
      world.cube.twister.push(scramble);
    } else {
      animatingScrambleRef.current = true;
      const tw = world.cube.twister as unknown as {
        setupAsync?: (e: string) => Promise<void>;
        setup: (e: string) => void;
      };
      if (tw.setupAsync) await tw.setupAsync(scramble);
      else tw.setup(scramble);
    }
    if (setupElRef.current) {
      setupElRef.current.value = scramble;
      autosize(setupElRef.current);
    }
    setSetupDraft(scramble);
    onSetupChange(scramble);
  }, [world, order, isSq1, isIvy, corner, isTwistyMode, puzzleKind, settings.animateScramble, onSetupChange, onAlgChange, twistyPlayerRef]);

  // ▶ Play button: animate the CURRENT scramble (the text already in the box) from
  // solved, on demand. Reuses the same animation paths as the auto-animate scramble:
  // cuber world → twister.setup('') + push; twisty (cubing.js) → move scramble to the
  // alg track and jumpToStart + play.
  const handlePlayScramble = useCallback(async () => {
    const scramble = setupDraft.trim();
    if (!scramble) return;
    if (isTwistyMode) {
      if (setupElRef.current) { setupElRef.current.value = ''; autosize(setupElRef.current); }
      setSetupDraft('');
      onSetupChange('');
      if (algElRef.current) { algElRef.current.value = scramble; autosize(algElRef.current); }
      skipAutoResetRef.current = true;
      setAlgDraft(scramble);
      onAlgChange(scramble);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const p = twistyPlayerRef?.current as unknown as { jumpToStart?: (opts?: unknown) => void; play?: () => void } | null;
          try { p?.jumpToStart?.({ flash: false }); } catch { /* */ }
          try { p?.play?.(); } catch { /* */ }
        });
      });
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
      world.controller.clearFrozen();
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
    world.controller.clearFrozen();
    tw.setup('');
    tw.push(engScramble);
  }, [setupDraft, isTwistyMode, world, corner, onSetupChange, onAlgChange, twistyPlayerRef, toEngineText]);

  // 点解法框时,若打乱动画仍在逐步播放(高阶打乱可达 400+ 步 ≈ 分钟级),立即落到完整打乱态,
  // 让用户马上能在打乱好的魔方上输解法。走快速整体应用 setup(打乱文本):它清空待播队列后用
  // WASM 路径一次性重建,不逐步 replay,高阶宽转也不卡(逐步 finish 会几百万次 getColor 卡死)。
  const flushPendingScramble = useCallback(() => {
    if (!world || isTwistyMode) return;
    const tw = (world.cube as unknown as CornerCube).twister;
    const scr = setupDraft.trim();
    const hasPendingAnimation = corner?.parseGroups ? tw?.busy : (tw?.length ?? 0) > 0;
    if (!tw || !hasPendingAnimation || !scr) return;
    const engScramble = toEngineText(scr);
    if (corner?.parseGroups && tw.setupMoves) {
      try { tw.setupMoves(parseCornerGroups(corner, engScramble).flat(), engScramble); } catch { /* keep last legal state */ }
      return;
    }
    tw.setup(engScramble);
  }, [world, isTwistyMode, corner, setupDraft, toEngineText]);

  // cubedb-style "反推打乱": invert + re-orient + solve the current solution to
  // recover the clean rotation-free scramble it solves, drop it into the
  // scramble box, and flip to forward (Moves) playback so the cube shows the
  // scramble and the solution plays forward to solve it.
  const handleDeriveScramble = useCallback(async () => {
    if (!is3x3 || !world || !algDraft.trim()) return;
    setDerivingScramble(true);
    try {
      const scramble = await deriveScrambleFromSolution(stripHandMarks(algDraft));
      if (!scramble) return;
      if (settings.playbackMode !== 'moves') {
        onSettingsChange({ ...settings, playbackMode: 'moves' });
      }
      // Apply the scramble to the cube instantly. animatingScrambleRef tells the
      // setup-change effect to land on step 0 (cube shows the scramble) instead
      // of re-running jumpToStep, which would otherwise double-apply.
      animatingScrambleRef.current = true;
      const tw = world.cube.twister as unknown as {
        setupAsync?: (e: string) => Promise<void>;
        setup: (e: string) => void;
      };
      if (tw.setupAsync) await tw.setupAsync(scramble);
      else tw.setup(scramble);
      if (setupElRef.current) {
        setupElRef.current.value = scramble;
        autosize(setupElRef.current);
      }
      setSetupDraft(scramble);
      onSetupChange(scramble);
    } catch (err) {
      console.warn('[sim] derive scramble failed:', err);
    } finally {
      setDerivingScramble(false);
    }
  }, [is3x3, world, algDraft, settings, onSettingsChange, onSetupChange]);

  // Optimal scramble (cloud): reuses the exact protocol /scramble/solver's cloud
  // 求打乱(最优) flow uses (cloudOptimalScramble, lib/cloud-optimal-scramble.ts) —
  // generate a fast random-state scramble (Kociemba), cloud-solve it optimally,
  // then invert that solution back into the setup box. The fewest-move solution
  // to a state IS the fewest-move scramble reaching it — a true God's-number-length
  // scramble, unlike the 🔀 button above (fast, but not move-optimal). 3x3-only;
  // login-gated server-side.
  const handleOptimalScramble = useCallback(async () => {
    if (!is3x3 || !world || optimalScrambleBusy) return;
    if (!authUser) { authLogin(); return; }
    const reqId = ++scrambleReqIdRef.current;
    setOptimalScrambleBusy(true);
    setOptimalScrambleStatus(t('生成随机状态…', 'Generating a random state…'));
    const ac = new AbortController();
    optimalScrambleAbortRef.current = ac;
    try {
      const raw = (await tnoodleRandomScramble('333')) ?? '';
      if (reqId !== scrambleReqIdRef.current) return;
      if (!raw || firstBadHtmToken(raw)) throw new Error(t('生成打乱失败', 'Failed to generate a scramble'));
      setOptimalScrambleStatus(t('云端求最优中…', 'Solving optimally (cloud)…'));
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
      world.controller.clearFrozen();
      if (settings.animateScramble) {
        animatingScrambleRef.current = true;
        world.cube.twister.setup('');
        world.cube.twister.push(scramble);
      } else {
        animatingScrambleRef.current = true;
        const tw = world.cube.twister as unknown as {
          setupAsync?: (e: string) => Promise<void>;
          setup: (e: string) => void;
        };
        if (tw.setupAsync) await tw.setupAsync(scramble);
        else tw.setup(scramble);
      }
      if (setupElRef.current) {
        setupElRef.current.value = scramble;
        autosize(setupElRef.current);
      }
      setSetupDraft(scramble);
      onSetupChange(scramble);
      setOptimalScrambleStatus(t(`已求出 ${moves} 步最优打乱。`, `Optimal scramble: ${moves} moves.`));
    } catch (err) {
      if (ac.signal.aborted) setOptimalScrambleStatus(t('已取消。', 'Cancelled.'));
      else setOptimalScrambleStatus(t(`求最优打乱失败:${(err as Error).message}`, `Optimal scramble failed: ${(err as Error).message}`));
    } finally {
      setOptimalScrambleBusy(false);
      optimalScrambleAbortRef.current = null;
    }
  }, [is3x3, world, optimalScrambleBusy, authUser, authLogin, settings.animateScramble, onSetupChange]);

  const cancelOptimalScramble = useCallback(() => { optimalScrambleAbortRef.current?.abort(); }, []);

  // Anchor (twizzle "Setup Anchor" — cubing.js experimentalSetupAnchor 'start'/'end'):
  // 'moves' anchors the scramble box at the timeline start (alg plays forward from it);
  // 'algorithm' anchors it at the end (alg plays backward INTO it, i.e. the scramble box
  // reads as the target/solved state the moves resolve to). Shared by both render paths
  // below — the engine path also shows step/play controls, twisty mode (cubing.js
  // TwistyPlayer) has its own native scrubber and only needs this select.
  const anchorSelect = (
    <select
      className="sim-player-mode"
      value={settings.playbackMode}
      onChange={(e) => onSettingsChange({ ...settings, playbackMode: e.target.value as 'moves' | 'algorithm' })}
      title={t('锚点:回放固定打乱起点还是解法终点', 'Anchor: keep the scramble start or the solve end fixed')}
    >
      <option value="moves">{t('锚定起点', 'Anchored at start')}</option>
      <option value="algorithm">{t('锚定终点', 'Anchored at end')}</option>
    </select>
  );

  // 按阶段展示色块(twizzle edit 同款,issue #27)— 播放条最左。支持面走 simCaps
  // (NxN 引擎 ≥2 阶 / cubing.js megaminx·fto),不支持的拼图整个隐藏。
  const stickeringSelect = resolveCaps(puzzleKind, renderer).supports.stickering && onStickeringChange
    ? (
      <StickeringSelect
        puzzleKind={puzzleKind} value={stickering} onChange={onStickeringChange}
        orientation={stickeringRot} onOrientationChange={onStickeringRotChange}
        mask={stickeringMask} onMaskClear={onStickeringMaskClear}
        pick={customPick} onPickChange={onCustomPickChange}
        rest={customRest} onRestChange={onCustomRestChange}
        editing={customEditing} onEditingChange={onCustomEditingChange}
        grain={customGrain} onGrainChange={onCustomGrainChange}
      />
    )
    : null;

  return (
    <div className="sim-player">
      <div className="sim-player-row sim-player-row--top">
        <div className="sim-player-hlwrap">
          {ivySetupSpans && (
            <div className="sim-player-hl" aria-hidden="true">
              {ivySetupSpans.map((s, i) => (
                <span key={i} className={s.bad ? 'bad' : undefined}>{s.text}</span>
              ))}
            </div>
          )}
          <textarea
            ref={setupElRef}
            defaultValue={setupDraft}
            rows={1}
            spellCheck={false}
            className={ivySetupSpans ? 'sim-player-input sim-player-input--hl' : 'sim-player-input'}
            placeholder={t('打乱', 'Scramble')}
            onInput={(e) => {
              const el = e.currentTarget;
              autosize(el);
              setSetupDraft(el.value);
              onSetupChange(el.value);
            }}
          />
        </div>
        <button
          type="button"
          className="sim-player-scramble"
          onClick={handleScramble}
          title={t('随机打乱', 'Random scramble')}
          aria-label={t('随机打乱', 'Random scramble')}
        >
          <Shuffle size={14} />
        </button>
        {is3x3 && (
          <button
            type="button"
            className="sim-player-scramble"
            onClick={handleDeriveScramble}
            disabled={derivingScramble || !algDraft.trim()}
            title={t('从下方解法反推打乱', 'Derive scramble from the solution below')}
            aria-label={t('反推打乱', 'Derive scramble')}
          >
            {derivingScramble ? <Loader2 size={14} className="sim-spin" /> : <Search size={14} />}
          </button>
        )}
        {is3x3 && (
          <button
            type="button"
            className="sim-player-scramble sim-player-scramble-optimal"
            onClick={handleOptimalScramble}
            disabled={optimalScrambleBusy}
            title={authUser
              ? t('最优打乱(云端):求一个保证最少步数(God\'s number)到达随机状态的打乱', 'Optimal scramble (cloud): a scramble guaranteed to reach a random state in the fewest possible moves (God\'s number)')
              : t('最优打乱(云端)需登录(WCA),点击登录', 'Optimal scramble (cloud) requires login (WCA) — click to log in')}
            aria-label={t('最优打乱', 'Optimal scramble')}
          >
            {optimalScrambleBusy ? <Loader2 size={14} className="sim-spin" /> : t('最优', 'optimal')}
          </button>
        )}
        <button
          type="button"
          className="sim-player-scramble"
          onClick={handlePlayScramble}
          disabled={!setupDraft.trim()}
          title={t('动画展示打乱', 'Animate scramble')}
          aria-label={t('动画展示打乱', 'Animate scramble')}
        >
          <Play size={14} />
        </button>
      </div>
      {optimalScrambleStatus && (
        <div className="sim-player-status">
          {optimalScrambleBusy && <Loader2 size={14} className="sim-spin" />}
          <span>{optimalScrambleStatus}</span>
          {optimalScrambleBusy && (
            <ClearButton
              variant="standalone"
              onClick={cancelOptimalScramble}
              ariaLabel={t('取消', 'Cancel')}
              title={t('取消', 'Cancel')}
            />
          )}
        </div>
      )}

      <div className="sim-player-row">
        <div className="sim-player-hlwrap">
          {showAlgOverlay && (
            <div className="sim-player-hl" aria-hidden="true">
              {algHlSpans.map((s, i) => (
                <span
                  key={i}
                  className={[s.bad && 'bad', s.current && 'current'].filter(Boolean).join(' ') || undefined}
                >
                  {s.text}
                </span>
              ))}
            </div>
          )}
          <AlgInput
            elementRef={algElRef as RefObject<HTMLTextAreaElement | HTMLDivElement | null>}
            initialText={algDraft}
            rows={1}
            spellCheck={false}
            autoSpace={algAutoSpace}
            autoResize
            className={showAlgOverlay ? 'sim-player-input sim-player-input--hl' : 'sim-player-input'}
            placeholder={t('解法', 'Solution')}
            title={is3x3 ? t('支持换握记号:↑ 上手(拇指起手 U 面)、↓ 下手(D 面)、· 回 home 握', 'Grip marks supported: ↑ thumb-up grip, ↓ thumb-down grip, · back to home grip') : undefined}
            onFocus={flushPendingScramble}
            onChange={(text) => {
              setAlgDraft(text);
              onAlgChange(text);
            }}
            onCaretChange={handleCaretSync}
          />
        </div>
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
        {isSq1 && (
          <select
            className="sim-player-mode"
            value={sq1Format}
            onChange={(e) => {
              const next = e.target.value as 'compact' | 'wca';
              const convert = next === 'wca' ? canonicalSq1Alg : compactSq1Alg;
              const newSetup = setupDraft.trim() ? convertSq1Text(setupDraft, convert) : '';
              const newAlg = algDraft.trim() ? convertSq1Text(algDraft, convert) : '';
              setSq1Format(next);
              setSetupDraft(newSetup);
              onSetupChange(newSetup);
              setAlgDraft(newAlg);
              onAlgChange(newAlg);
            }}
            title={t('SQ1 格式', 'SQ1 format')}
          >
            <option value="compact">{t('简化', 'Compact')}</option>
            <option value="wca">WCA</option>
          </select>
        )}
      </div>

      {puzzleKind === 'skewb' && skewbNotation && !isTwistyMode && (
        <SkewbNotationGuide
          notation={skewbNotation}
          onDemo={demoNotationMove}
          onRestore={restoreFromDemo}
        />
      )}

      {(() => {
      const playbackBar = !isTwistyMode ? (
      // 播放控制排:twizzle alpha.twizzle.net/edit 同款两排布局(进度条在上、传输按钮在下),
      // 与 /recon 播放条共用同一份 <PlaybackBar>。stickering / 锚点两个下拉挂在按钮排两端。
      <PlaybackBar
        step={step}
        total={totalSteps}
        playing={playing}
        onScrub={(n) => { setCaretChar(null); jumpToStep(n); }}
        onSkipStart={() => { setCaretChar(null); jumpToStep(0); }}
        onStepBack={stepBack}
        onTogglePlay={handleTogglePlay}
        onStepForward={stepForward}
        onSkipEnd={() => { setCaretChar(null); jumpToStep(totalSteps); }}
        leading={<>{imageButton}{fullscreenButton}{stickeringSelect}</>}
        trailing={<>{anchorSelect}{backViewButton}</>}
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
      ) : (
      // Twisty puzzles (pyraminx/skewb/megaminx/fto/PG explore — cubing.js TwistyPlayer,
      // alpha.twizzle.net/edit's actual engine) already show a native play/pause/scrub bar
      // (TwistySection's bottom-row controlPanel); only the anchor select is ours to add —
      // TwistySection already reads settings.playbackMode into experimentalSetupAnchor, it
      // just had no control to change it in this mode.
      <div className="sim-player-row">{imageButton}{fullscreenButton}{stickeringSelect}{anchorSelect}{backViewButton}</div>
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

      <div className="sim-player-tools">
        <button onClick={tool(invertForPuzzle)} title={t('取逆', 'Invert')}>{t('逆', 'Invert')}</button>
        {/* 消步:实时消步开关(默认开)。开 = 手势 / 键盘转动追加时自动合并 / 抵消重复转动,
            并对当前解法消一次步;关 = 原样保留。取代原一次性「消步」按钮。 */}
        {!isIvy && (
          <Toggle
            label={t('消步', 'Reduce')}
            value={settings.liveReduce !== false}
            onChange={setLiveReduce}
          />
        )}
        {!isSq1 && !isTwistyMode && <button onClick={tool((s) => mirrorAlg(s, 'M'))} title={t('Mirror M (L↔R)', 'Mirror M (L↔R)')} aria-label="Mirror M"><FlipHorizontal2 size={13} /></button>}
        {!isSq1 && !isTwistyMode && <button onClick={tool((s) => mirrorAlg(s, 'S'))} title={t('Mirror S (F↔B)', 'Mirror S (F↔B)')} aria-label="Mirror S"><FlipVertical2 size={13} /></button>}
        <button onClick={tool(() => '')} title={t('清空', 'Clear')}><Eraser size={13} />{t('清空', 'Clear')}</button>
        <button
          onClick={handleCopyLink}
          className={linkCopied ? 'sim-link-copied' : undefined}
          title={t('复制本页链接(含打乱 / 解法)', 'Copy this page link (with scramble / solution)')}
        >
          {linkCopied ? <Check size={13} /> : <Link2 size={13} />}
          {linkCopied ? t('已复制', 'Copied') : t('复制链接', 'Copy link')}
        </button>
      </div>

      <PuzzleSettings
        order={order}
        onOrderChange={onOrderChange}
        puzzleKind={puzzleKind}
        onPuzzleChange={onPuzzleChange}
        renderer={renderer}
        onRendererChange={onRendererChange}
        settings={settings}
        onSettingsChange={onSettingsChange}
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

// 五魔方 12 面色 —— 复用 vendored puzzle-geometry 的十二面体配色(单一源,不另造)。
const MEGAMINX_COLORS = Object.values(defaultPlatonicColorSchemes()[12]) as string[];
/** 按小写去重,保序;让各调色板拼接预设 + 12 色时不出现重复格。 */
function dedupeColors(cs: string[]): string[] {
  const seen = new Set<string>();
  return cs.filter((c) => { const k = c.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
}

const CORE_COLOR_PRESETS: string[] = dedupeColors([
  '#202020', '#EE0000', '#FFA100', '#FFFFFF', '#FEFE00', '#00D800', '#0000F2',
  ...MEGAMINX_COLORS,
]);

// Mirror Cube single-colour presets — classic gold / silver first, then tints + the 12 Megaminx colours.
const MIRROR_COLOR_PRESETS: string[] = dedupeColors([
  '#E3B23C', '#C0C0C0', '#EE0000', '#00A0E0', '#00C060', '#B060E0',
  ...MEGAMINX_COLORS,
]);

// Face-colour presets — the WCA 6 then the 12 Megaminx colours, for a rich per-face palette.
const FACE_COLOR_PRESETS: string[] = dedupeColors([
  DEFAULT_FACE_COLORS.U, DEFAULT_FACE_COLORS.L, DEFAULT_FACE_COLORS.F,
  DEFAULT_FACE_COLORS.R, DEFAULT_FACE_COLORS.B, DEFAULT_FACE_COLORS.D,
  ...MEGAMINX_COLORS,
]);

// 甲油预设(经典美甲色系:正红 / 酒红 / 粉 / 裸 / 白 / 黑 / 蓝 / 薄荷 / 丁香 / 金;
// 物理甲油色,非主题灰阶)。底色与渐变第二色共用同一板。
const NAIL_COLOR_PRESETS: string[] = dedupeColors([
  '#C21807', '#7B1F3A', '#F48FB1', '#E8C4B0', '#F5F0EA', '#212121',
  '#1565C0', '#7FD8C4', '#B39DDB', '#D4AF37',
]);
/** 从自然甲切到自定义时 trigger 色块的兜底显示色(未选前);选色即覆盖。 */
const NAIL_DEFAULT_COLOR = '#C21807';

const FACE_ORDER = ['U', 'L', 'F', 'R', 'B', 'D'] as const;
const FACE_LABELS_ZH: Record<typeof FACE_ORDER[number], string> = {
  U: '顶', D: '底', L: '左', R: '右', F: '前', B: '后',
};

function SwatchCell({
  color, label, title, active, onPick, onClick, custom,
}: {
  color: string;
  label?: string;
  title?: string;
  active?: boolean;
  onPick?: (c: string) => void;
  onClick?: () => void;
  /** 自定义取色格:角标 Pipette + 区别于预设色块,明示「点这里自选」。 */
  custom?: boolean;
}) {
  const labelEl = label ? <span className="sim-swatch-label">{label}</span> : null;
  const boxEl = custom ? (
    <span className="sim-swatch-box-wrap">
      <span className="sim-swatch-box" style={{ background: color }} />
      <span className="sim-swatch-custom-badge" aria-hidden><Pipette size={9} /></span>
    </span>
  ) : (
    <span className="sim-swatch-box" style={{ background: color }} />
  );
  const cls = 'sim-swatch' + (active ? ' active' : '');
  if (onPick) {
    return (
      <label className={cls} title={title}>
        {labelEl}
        <input
          type="color"
          className="sim-swatch-input"
          value={color}
          onChange={(e) => onPick(e.target.value)}
        />
        {boxEl}
      </label>
    );
  }
  return (
    <button type="button" className={cls} onClick={onClick} title={title}>
      {labelEl}
      {boxEl}
    </button>
  );
}

/** 弹出色块选择器外壳:trigger 显当前格,点开弹出 panel 列 children(各 .sim-swatch)。
 *  内核色 / 镜面 / 面色(ModeColorSelect)与背景共用同一套交互 + 样式,避免每处重写
 *  open / 点外关闭 / trigger / panel。children 是 render prop,收一个 close() 关弹层。 */
function SwatchPopup({
  trigger, title, children,
}: {
  trigger: ReactNode;
  title: string;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDoc);
    return () => document.removeEventListener('pointerdown', onDoc);
  }, [open]);
  return (
    <div className="sim-color-select" ref={ref}>
      <button
        type="button"
        className="sim-color-select-trigger"
        title={title}
        onClick={() => setOpen((o) => !o)}
      >
        {trigger}
      </button>
      {open && (
        <div className="sim-color-select-panel">
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

/** 模式 + 取色合并下拉:把一个「特殊模式」(镜面六色 / 内核原核)与单色取色收进一个菜单。
 *  trigger 普通态显当前色块、特殊态显特殊图标格;面板顶部一个特殊项 + 自定义取色 + 预设色板。
 *  选色 = 退出特殊模式并用该色;选特殊项 = 进特殊模式。 */
function ModeColorSelect({
  special = false, color, presets, specialTitle, specialSwatchClass,
  onPickColor, onPickSpecial, title, t,
}: {
  /** 特殊模式(镜面六色 / 内核原核)。不传 special 系列即退化成普通取色下拉(面色用)。 */
  special?: boolean;
  color: string;
  presets: string[];
  specialTitle?: string;
  specialSwatchClass?: string;
  onPickColor: (c: string) => void;
  onPickSpecial?: () => void;
  title: string;
  t: (zh: string, en: string) => string;
}) {
  const specialSwatch = specialSwatchClass ? <span className={'sim-swatch-box ' + specialSwatchClass} /> : null;
  return (
    <SwatchPopup
      title={title}
      trigger={special && specialSwatch ? specialSwatch : <span className="sim-swatch-box" style={{ background: color }} />}
    >
      {(close) => (
        <>
          {onPickSpecial && specialSwatch && (
            <button
              type="button"
              className={'sim-swatch' + (special ? ' active' : '')}
              title={specialTitle}
              onClick={() => { onPickSpecial(); close(); }}
            >
              {specialSwatch}
            </button>
          )}
          <SwatchCell
            color={color}
            title={t('自定义', 'Custom')}
            custom
            onPick={onPickColor}
          />
          {presets.map((c) => (
            <SwatchCell
              key={c}
              color={c}
              title={c}
              active={!special && c.toLowerCase() === color.toLowerCase()}
              onClick={() => { onPickColor(c); close(); }}
            />
          ))}
        </>
      )}
    </SwatchPopup>
  );
}

function ColorRow({
  label, children, action, trailing, disabled, title,
}: {
  label: string;
  children: ReactNode;
  action?: { label: string; title?: string; onClick: () => void };
  /** 色块右侧附加控件(如内核色行的「原核」开关)。 */
  trailing?: ReactNode;
  /** 该拼图暂不支持此配色 → 变灰 + 不可点(pointer-events:none 兜住所有色块按钮)。 */
  disabled?: boolean;
  title?: string;
}) {
  return (
    <div className={'sim-color-row' + (disabled ? ' sim-color-row--disabled' : '')} aria-disabled={disabled || undefined} title={title}>
      <span className="sim-color-row-label">{label}</span>
      {/* trailing(如「原核」开关)紧贴标签右侧,再到色块 */}
      {trailing}
      {action && (
        <button type="button" className="sim-face-color-reset" onClick={action.onClick} title={action.title}>
          {action.label}
        </button>
      )}
      <div className="sim-swatch-list">{children}</div>
    </div>
  );
}

/** 外观区的百分比滑条(内核不透明度 / 贴纸不透明度 / 黑边)。行式与 ColorRow 一致
 *  —— 标签、控件、右侧读数,不支持该拼图时整行灰化 + 滑条 disabled。
 *  读数是可打字的数字框(与上方 Slider 同一个 ValueField):拖不准的值直接输入。 */
function PercentRow({
  label, value, onChange, min = 0, max = 100, step = 1, disabled, title,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <div className={'sim-color-row sim-percent-row' + (disabled ? ' sim-color-row--disabled' : '')} aria-disabled={disabled || undefined} title={title}>
      <span className="sim-color-row-label">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <ValueField
        display={value}
        // 显示位数跟着步长走:整步 → 整数(100),半步 → 一位小数(黑边 12.5)。
        decimals={Number.isInteger(step) ? 0 : 1}
        min={min}
        max={max}
        step={step}
        suffix="%"
        disabled={disabled}
        commit={(n) => {
          const q = Math.min(max, Math.max(min, Math.round(n / step) * step));
          if (q !== value) onChange(q);
          return q;
        }}
      />
    </div>
  );
}

/** 滑条数字框的真实单位(内部仍存 0..100,见 SliderUnit):
 *  - 缩放 → 倍率:引擎 world.scale = 0.5 + v/100;cubing.js 用 cameraDistance [9,3] 逼近同档感受。
 *  - 左右/上下 → 旋转角度(度):引擎 scene.rotation ±90°;cubing.js 经度全程 ±180°(纬度同 ±90°),
 *    所以左右按渲染路径二选一。上下正值 = 俯视(相机在上)。
 *  - TPS → 每秒公式 token 数:引擎按真实 elapsed time 推进;cubing.js 使用相同精确倍率。 */
// 灵敏度 → 相对默认(滑杆 50)的倍率。它同时驱动三种手感 —— 拖贴纸转层的角速度
// (controller.sensitivity)、拖空白转视角的 rad/px(mapOrbitK)、SQ1 拖拽(mapTurnDragFactor)
// —— 三者都是 mapSensitivity(v) 的常数倍,所以只有"相对默认几倍"对三条路径同时精确;
// 标成 °/px 之类的物理量只有转视角那条对得上,拖贴纸会对不上(它还受透视/缩放影响)。
// mapSensitivity 是几何映射(每 25 格 ×2),倍率 = 2^((v-50)/25),0.25×~4×。
const UNIT_SENS: SliderUnit = { to: (v) => Math.pow(2, (v - 50) / 25), from: (m) => 50 + 25 * Math.log2(m), min: 0.25, max: 4, step: 0.05, decimals: 2, suffix: '×' };
const UNIT_SCALE: SliderUnit = { to: (v) => 0.5 + v / 100, from: (m) => (m - 0.5) * 100, min: 0.5, max: 1.5, step: 0.05, decimals: 2, suffix: '×' };
// 透视 → 35mm 等效焦距:引擎是 dolly-zoom(distance = 取景半径×p,p = 2 + v×0.08,FOV 反向
// 补偿定画幅),竖直 FOV = 2·atan(1/p) ⇔ 全画幅(半高 12mm)焦距 f = 12p = 24 + 0.96v mm。
// 24mm 广角畸变强 → 120mm 长焦近正交。仅引擎路径(cubing.js 拼图此滑条本就禁用)。
const UNIT_FOCAL: SliderUnit = { to: (v) => 24 + v * 0.96, from: (f) => (f - 24) / 0.96, min: 24, max: 120, step: 1, decimals: 0, suffix: 'mm' };
// 视角盘的度数框:约定「右 = 正(看右面)」→ 显示符号相对内部值翻转(默认 viewAngle=30
// 从旧 −36° 变 +36°)。内部 0..100 与引擎 mapYaw / twisty cameraLongitude 全不变,纯显示层。
// pad·90(引擎)/ pad·180(twisty)= (50−v)·1.8 / (50−v)·3.6,与 padX=(50−v)/50 同号。
const UNIT_YAW_ENGINE: SliderUnit = { to: (v) => (50 - v) * 1.8, from: (d) => 50 - d / 1.8, min: -90, max: 90, step: 1, decimals: 0, suffix: '°' };
const UNIT_YAW_TWISTY: SliderUnit = { to: (v) => (50 - v) * 3.6, from: (d) => 50 - d / 3.6, min: -180, max: 180, step: 1, decimals: 0, suffix: '°' };
// 上下(pitch):(50−v)·1.8 本就「上 = 正 = 俯视」,默认 33 → +31°,符号无需翻。
const UNIT_PITCH: SliderUnit = { to: (v) => (50 - v) * 1.8, from: (d) => 50 - d / 1.8, min: -90, max: 90, step: 1, decimals: 0, suffix: '°' };
const UNIT_TPS: SliderUnit = { to: simSpeedToTps, from: simTpsToSpeed, min: 0.5, max: 6, step: 0.1, decimals: 1 };

const PICTURE_FACE_LABELS: Record<PictureFace, readonly [string, string]> = {
  U: ['上面', 'Up'], R: ['右面', 'Right'], F: ['前面', 'Front'],
  D: ['下面', 'Down'], L: ['左面', 'Left'], B: ['后面', 'Back'],
};

function PictureFaceMiniNet({ faces }: { faces: PictureFaces }) {
  return (
    <span className="sim-picture-mini" aria-hidden>
      {PICTURE_FACE_ORDER.map((face) => (
        <span key={face} data-face={face}>
          {faces[face] ? <img src={faces[face]} alt="" /> : <span>{face}</span>}
        </span>
      ))}
    </span>
  );
}

const PICTURE_CROP_SIZE = 384;

function defaultPictureCrops(): Record<PictureFace, PictureCrop> {
  return Object.fromEntries(
    PICTURE_FACE_ORDER.map((face) => [face, { ...DEFAULT_PICTURE_CROP }]),
  ) as Record<PictureFace, PictureCrop>;
}

function PictureCropWorkspace({
  face, source, initialCrop, order, busy, onReplace, onApply, t,
}: {
  face: PictureFace;
  source: string;
  initialCrop: PictureCrop;
  order: number;
  busy: boolean;
  onReplace: () => void;
  onApply: (crop: PictureCrop) => void;
  t: (zh: string, en: string) => string;
}) {
  const [crop, setCrop] = useState<PictureCrop>(() => normalizePictureCrop(initialCrop));
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [imageError, setImageError] = useState(false);
  const [dragging, setDragging] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const cropRef = useRef(crop);
  const pointersRef = useRef(new Map<number, { clientX: number; clientY: number }>());
  const gestureRef = useRef<
    | {
      kind: 'drag';
      pointerId: number;
      clientX: number;
      clientY: number;
      crop: PictureCrop;
    }
    | {
      kind: 'pinch';
      pointerIds: readonly [number, number];
      distance: number;
      centerX: number;
      centerY: number;
      crop: PictureCrop;
    }
    | null
  >(null);

  cropRef.current = crop;

  const commitCrop = useCallback((next: PictureCrop) => {
    const normalized = normalizePictureCrop(next);
    cropRef.current = normalized;
    setCrop(normalized);
  }, []);

  useEffect(() => {
    setCrop(normalizePictureCrop(initialCrop));
    pointersRef.current.clear();
    gestureRef.current = null;
    setDragging(false);
    setDimensions({ width: 0, height: 0 });
    setImageError(false);
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => {
      imageRef.current = image;
      setDimensions({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => setImageError(true);
    image.src = source;
    return () => {
      imageRef.current = null;
      image.onload = null;
      image.onerror = null;
    };
  }, [initialCrop, source]);

  const geometry = useMemo(() => {
    if (!dimensions.width || !dimensions.height) return null;
    return pictureCropGeometry(
      dimensions.width,
      dimensions.height,
      PICTURE_CROP_SIZE,
      crop,
    );
  }, [crop, dimensions]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (!canvas || !image || !dimensions.width || !dimensions.height) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    drawPictureCrop(
      ctx,
      image,
      dimensions.width,
      dimensions.height,
      PICTURE_CROP_SIZE,
      crop,
    );
  }, [crop, dimensions]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (event: WheelEvent) => {
      if (!dimensions.width || !dimensions.height) return;
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const delta = event.deltaMode === 1
        ? event.deltaY * 16
        : event.deltaMode === 2 ? event.deltaY * rect.height : event.deltaY;
      const anchorX = ((event.clientX - rect.left) / rect.width - 0.5) * PICTURE_CROP_SIZE;
      const anchorY = ((event.clientY - rect.top) / rect.height - 0.5) * PICTURE_CROP_SIZE;
      commitCrop(zoomPictureCropAt(
        dimensions.width,
        dimensions.height,
        PICTURE_CROP_SIZE,
        cropRef.current,
        cropRef.current.zoom * Math.exp(-delta * 0.002),
        anchorX,
        anchorY,
      ));
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, [commitCrop, dimensions.height, dimensions.width]);

  const gridCount = order >= 2 && order <= 12 ? order : 0;
  const [zhFace, enFace] = PICTURE_FACE_LABELS[face];

  const setRotation = (rotation: number) => {
    if (!dimensions.width || !dimensions.height) {
      commitCrop({ ...cropRef.current, rotation });
      return;
    }
    commitCrop(rotatePictureCropTo(
      dimensions.width,
      dimensions.height,
      PICTURE_CROP_SIZE,
      cropRef.current,
      rotation,
    ));
  };

  const beginPinch = () => {
    const pair = [...pointersRef.current.entries()].slice(0, 2);
    if (pair.length < 2) return;
    const [[firstId, first], [secondId, second]] = pair;
    gestureRef.current = {
      kind: 'pinch',
      pointerIds: [firstId, secondId],
      distance: Math.max(1, Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY)),
      centerX: (first.clientX + second.clientX) / 2,
      centerY: (first.clientY + second.clientY) / 2,
      crop: cropRef.current,
    };
    setDragging(true);
  };

  const endPointer = (event: React.PointerEvent<HTMLCanvasElement>) => {
    pointersRef.current.delete(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (pointersRef.current.size >= 2) {
      beginPinch();
      return;
    }
    const remaining = [...pointersRef.current.entries()][0];
    if (remaining) {
      const [pointerId, point] = remaining;
      gestureRef.current = {
        kind: 'drag',
        pointerId,
        clientX: point.clientX,
        clientY: point.clientY,
        crop: cropRef.current,
      };
      setDragging(true);
      return;
    }
    gestureRef.current = null;
    setDragging(false);
  };

  return (
    <div className="sim-picture-crop-workspace">
      <div className="sim-picture-crop-heading">
        <span className="sim-picture-crop-icon"><Crop size={17} /></span>
        <div>
          <h3>{t(`调整 ${face} ${zhFace}`, `Adjust ${face} ${enFace}`)}</h3>
        </div>
      </div>

      <div className="sim-picture-crop-body">
        <div className="sim-picture-crop-stage-wrap">
          <div className={'sim-picture-crop-stage' + (dragging ? ' is-dragging' : '')}>
            <canvas
              ref={canvasRef}
              width={PICTURE_CROP_SIZE}
              height={PICTURE_CROP_SIZE}
              tabIndex={0}
              aria-label={t('拖动图片调整取景,双指或滚轮缩放', 'Drag to reframe; pinch or scroll to zoom')}
              onPointerDown={(event) => {
                if (!geometry || (event.pointerType !== 'touch' && event.button !== 0)) return;
                pointersRef.current.set(event.pointerId, {
                  clientX: event.clientX,
                  clientY: event.clientY,
                });
                event.currentTarget.setPointerCapture(event.pointerId);
                if (pointersRef.current.size >= 2) beginPinch();
                else {
                  gestureRef.current = {
                    kind: 'drag',
                    pointerId: event.pointerId,
                    clientX: event.clientX,
                    clientY: event.clientY,
                    crop: cropRef.current,
                  };
                  setDragging(true);
                }
              }}
              onPointerMove={(event) => {
                if (!pointersRef.current.has(event.pointerId) || !geometry) return;
                pointersRef.current.set(event.pointerId, {
                  clientX: event.clientX,
                  clientY: event.clientY,
                });
                const gesture = gestureRef.current;
                if (!gesture) return;
                const rect = event.currentTarget.getBoundingClientRect();
                if (!rect.width || !rect.height) return;
                if (gesture.kind === 'pinch') {
                  const first = pointersRef.current.get(gesture.pointerIds[0]);
                  const second = pointersRef.current.get(gesture.pointerIds[1]);
                  if (!first || !second) return;
                  const distance = Math.max(1, Math.hypot(
                    second.clientX - first.clientX,
                    second.clientY - first.clientY,
                  ));
                  const centerX = (first.clientX + second.clientX) / 2;
                  const centerY = (first.clientY + second.clientY) / 2;
                  const toCanvasX = (clientX: number) => (
                    (clientX - rect.left) / rect.width - 0.5
                  ) * PICTURE_CROP_SIZE;
                  const toCanvasY = (clientY: number) => (
                    (clientY - rect.top) / rect.height - 0.5
                  ) * PICTURE_CROP_SIZE;
                  commitCrop(zoomPictureCropAt(
                    dimensions.width,
                    dimensions.height,
                    PICTURE_CROP_SIZE,
                    gesture.crop,
                    gesture.crop.zoom * distance / gesture.distance,
                    toCanvasX(gesture.centerX),
                    toCanvasY(gesture.centerY),
                    toCanvasX(centerX),
                    toCanvasY(centerY),
                  ));
                  return;
                }
                if (gesture.pointerId !== event.pointerId) return;
                commitCrop(panPictureCropBy(
                  dimensions.width,
                  dimensions.height,
                  PICTURE_CROP_SIZE,
                  gesture.crop,
                  (event.clientX - gesture.clientX) / rect.width * PICTURE_CROP_SIZE,
                  (event.clientY - gesture.clientY) / rect.height * PICTURE_CROP_SIZE,
                ));
              }}
              onPointerUp={endPointer}
              onPointerCancel={endPointer}
              onLostPointerCapture={(event) => {
                if (!pointersRef.current.has(event.pointerId)) return;
                pointersRef.current.clear();
                gestureRef.current = null;
                setDragging(false);
              }}
              onKeyDown={(event) => {
                const nudge = event.shiftKey ? 40 : 12;
                if (event.key === 'ArrowLeft') commitCrop(panPictureCropBy(
                  dimensions.width, dimensions.height, PICTURE_CROP_SIZE, cropRef.current, -nudge, 0,
                ));
                else if (event.key === 'ArrowRight') commitCrop(panPictureCropBy(
                  dimensions.width, dimensions.height, PICTURE_CROP_SIZE, cropRef.current, nudge, 0,
                ));
                else if (event.key === 'ArrowUp') commitCrop(panPictureCropBy(
                  dimensions.width, dimensions.height, PICTURE_CROP_SIZE, cropRef.current, 0, -nudge,
                ));
                else if (event.key === 'ArrowDown') commitCrop(panPictureCropBy(
                  dimensions.width, dimensions.height, PICTURE_CROP_SIZE, cropRef.current, 0, nudge,
                ));
                else if (event.key === '+' || event.key === '=') commitCrop(zoomPictureCropAt(
                  dimensions.width,
                  dimensions.height,
                  PICTURE_CROP_SIZE,
                  cropRef.current,
                  cropRef.current.zoom * 1.15,
                  0,
                  0,
                ));
                else if (event.key === '-') commitCrop(zoomPictureCropAt(
                  dimensions.width,
                  dimensions.height,
                  PICTURE_CROP_SIZE,
                  cropRef.current,
                  cropRef.current.zoom / 1.15,
                  0,
                  0,
                ));
                else return;
                event.preventDefault();
                event.stopPropagation();
              }}
            />
            {gridCount > 0 && (
              <span
                className="sim-picture-crop-grid"
                style={{ backgroundSize: `${100 / gridCount}% ${100 / gridCount}%` }}
                aria-hidden
              />
            )}
            {!dimensions.width && !imageError && <Loader2 size={24} className="sim-picture-crop-loading sim-spin" />}
            {imageError && <span className="sim-picture-crop-load-error">{t('无法预览', 'Preview unavailable')}</span>}
          </div>
        </div>

        <div className="sim-picture-crop-controls">
          <label className="sim-picture-rotation">
            <span>{t('旋转', 'Rotate')}</span>
            <ValueField
              display={crop.rotation}
              decimals={2}
              min={-180}
              max={180}
              step={0.01}
              suffix="°"
              commit={(rotation) => {
                setRotation(rotation);
                return normalizePictureCrop({ ...cropRef.current, rotation }).rotation;
              }}
            />
            <input
              type="range"
              min={-180}
              max={180}
              step={0.1}
              value={crop.rotation}
              aria-label={t('旋转角度', 'Rotation angle')}
              onChange={(event) => setRotation(Number(event.target.value))}
            />
          </label>

          <div className="sim-picture-crop-actions">
            <button
              type="button"
              disabled={busy}
              onClick={() => setCrop({ ...DEFAULT_PICTURE_CROP, rotation: crop.rotation })}
            >
              {t('居中', 'Center')}
            </button>
            <button type="button" disabled={busy} onClick={onReplace}>
              <Upload size={14} />{t('换图', 'Change image')}
            </button>
            <button
              type="button"
              className="sim-picture-crop-apply"
              disabled={busy || !dimensions.width || imageError}
              onClick={() => onApply(crop)}
            >
              {busy && <Loader2 size={14} className="sim-spin" />}
              {t('应用', 'Apply')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PictureCubeEditor({
  open, initialFaces, initialBaseColors, order, onClose,
  onFacesChange, onBaseColorsChange, t,
}: {
  open: boolean;
  initialFaces: PictureFaces;
  initialBaseColors: boolean;
  order: number;
  onClose: () => void;
  onFacesChange: (faces: PictureFaces) => boolean;
  onBaseColorsChange: (baseColors: boolean) => void;
  t: (zh: string, en: string) => string;
}) {
  const [draft, setDraft] = useState<PictureFaces>(() => ({ ...initialFaces }));
  const [baseColors, setBaseColors] = useState(initialBaseColors);
  const [editSources, setEditSources] = useState<PictureFaces>(() => ({ ...initialFaces }));
  const [faceCrops, setFaceCrops] = useState<Record<PictureFace, PictureCrop>>(defaultPictureCrops);
  const [cropFace, setCropFace] = useState<PictureFace | null>(null);
  const [targetFace, setTargetFace] = useState<PictureFace>('U');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const faceInputRef = useRef<HTMLInputElement>(null);
  const bulkInputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const cropFaceRef = useRef<PictureFace | null>(null);
  const openingStateRef = useRef({ faces: initialFaces, baseColors: initialBaseColors });

  cropFaceRef.current = cropFace;

  useEffect(() => {
    if (!open) openingStateRef.current = { faces: initialFaces, baseColors: initialBaseColors };
  }, [initialBaseColors, initialFaces, open]);

  useEffect(() => {
    if (!open) return;
    const initial = openingStateRef.current;
    setDraft({ ...initial.faces });
    setBaseColors(initial.baseColors);
    setEditSources({ ...initial.faces });
    setFaceCrops(defaultPictureCrops());
    setCropFace(null);
    setError('');
    setBusy(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const oldOverflow = document.body.style.overflow;
    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (cropFaceRef.current) {
          setCropFace(null);
          return;
        }
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )).filter((element) => element.offsetParent !== null);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    requestAnimationFrame(() => dialogRef.current?.focus());
    return () => {
      document.body.style.overflow = oldOverflow;
      window.removeEventListener('keydown', onKeyDown);
      previouslyFocused?.focus();
    };
  }, [onClose, open]);

  if (!open || typeof document === 'undefined') return null;

  const messageForError = (reason: unknown) => {
    const code = reason instanceof Error ? reason.message : '';
    if (code === 'too-large') return t('单张图片请小于 15 MB', 'Keep each image under 15 MB');
    if (code === 'not-image') return t('请选择图片文件', 'Choose an image file');
    return t('这张图片无法读取,请换一张再试', 'This image could not be read. Try another file');
  };

  const autoSaveFaces = (faces: PictureFaces): boolean => {
    if (onFacesChange(faces)) {
      setError('');
      return true;
    }
    setError(t(
      '浏览器存储空间不足,图片尚未保存。请清理部分站点数据或减少图片后重试',
      'Browser storage is full, so the images were not saved. Free some site storage or use fewer images, then try again',
    ));
    return false;
  };

  const processFace = async (face: PictureFace, file: File) => {
    const source = await fileToPictureEditSourceDataUrl(file);
    const crop = { ...DEFAULT_PICTURE_CROP };
    const url = await pictureEditSourceToFaceDataUrl(source, crop);
    const next = { ...draft, [face]: url };
    if (!autoSaveFaces(next)) return;
    setEditSources((current) => ({ ...current, [face]: source }));
    setFaceCrops((current) => ({ ...current, [face]: crop }));
    setDraft(next);
    setCropFace(face);
  };

  const handleFaceFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      await processFace(targetFace, file);
    } catch (reason) {
      setError(messageForError(reason));
    } finally {
      setBusy(false);
    }
  };

  const handleBulkFiles = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []).slice(0, 6);
    event.target.value = '';
    if (files.length === 0) return;
    setBusy(true);
    setError('');
    try {
      const imported: Array<{ face: PictureFace; source: string; url: string }> = [];
      for (let index = 0; index < files.length; index++) {
        const source = await fileToPictureEditSourceDataUrl(files[index]);
        imported.push({
          face: PICTURE_FACE_ORDER[index],
          source,
          url: await pictureEditSourceToFaceDataUrl(source, DEFAULT_PICTURE_CROP),
        });
      }
      const next = { ...draft };
      imported.forEach(({ face, url }) => { next[face] = url; });
      if (!autoSaveFaces(next)) return;
      setDraft(next);
      setEditSources((current) => {
        const next = { ...current };
        imported.forEach(({ face, source }) => { next[face] = source; });
        return next;
      });
      setFaceCrops((current) => {
        const next = { ...current };
        imported.forEach(({ face }) => { next[face] = { ...DEFAULT_PICTURE_CROP }; });
        return next;
      });
      setCropFace(null);
      if (files.length < 6) {
        setError(t(`已按顺序填入前 ${files.length} 面,其余可逐面补充`, `Filled the first ${files.length} faces in order; add the rest individually`));
      }
    } catch (reason) {
      setError(messageForError(reason));
    } finally {
      setBusy(false);
    }
  };

  const removeFace = (face: PictureFace) => {
    const next = { ...draft, [face]: '' };
    if (!autoSaveFaces(next)) return;
    setDraft(next);
    setEditSources((current) => ({ ...current, [face]: '' }));
    setFaceCrops((current) => ({ ...current, [face]: { ...DEFAULT_PICTURE_CROP } }));
    if (cropFace === face) setCropFace(null);
  };

  const clearAllFaces = () => {
    const next = emptyPictureFaces();
    if (!autoSaveFaces(next)) return;
    setDraft(next);
    setEditSources({ ...next });
    setFaceCrops(defaultPictureCrops());
    setCropFace(null);
  };

  const applyCrop = async (face: PictureFace, crop: PictureCrop) => {
    const source = editSources[face];
    if (!source) return;
    setBusy(true);
    setError('');
    try {
      const normalized = normalizePictureCrop(crop);
      const url = await pictureEditSourceToFaceDataUrl(source, normalized);
      const next = { ...draft, [face]: url };
      if (!autoSaveFaces(next)) return;
      setFaceCrops((current) => ({ ...current, [face]: normalized }));
      setDraft(next);
      setCropFace(null);
    } catch (reason) {
      setError(messageForError(reason));
    } finally {
      setBusy(false);
    }
  };

  const count = countPictureFaces(draft);
  const dialog = (
    <div
      className="sim-picture-backdrop"
      onPointerDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <section
        ref={dialogRef}
        className="sim-picture-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sim-picture-title"
        tabIndex={-1}
      >
        <header className="sim-picture-head">
          <div>
            <h2 id="sim-picture-title">{t('制作图案魔方', 'Create a picture cube')}</h2>
          </div>
          <ClearButton
            variant="standalone"
            className="sim-picture-icon-btn"
            onClick={() => {
              if (cropFace) setCropFace(null);
              else onClose();
            }}
            ariaLabel={cropFace ? t('返回六面', 'Back to faces') : t('关闭', 'Close')}
          />
        </header>

        {cropFace && editSources[cropFace] ? (
          <PictureCropWorkspace
            key={cropFace}
            face={cropFace}
            source={editSources[cropFace]}
            initialCrop={faceCrops[cropFace]}
            order={order}
            busy={busy}
            onReplace={() => {
              setTargetFace(cropFace);
              faceInputRef.current?.click();
            }}
            onApply={(crop) => { void applyCrop(cropFace, crop); }}
            t={t}
          />
        ) : (
          <>
            <div className="sim-picture-toolbar">
              <button type="button" className="sim-picture-bulk" disabled={busy} onClick={() => bulkInputRef.current?.click()}>
                {busy ? <Loader2 size={16} className="sim-spin" /> : <Upload size={16} />}
                {t('一次选择 6 张', 'Choose 6 at once')}
              </button>
              <span>{t('顺序:U R F D L B', 'Order: U R F D L B')}</span>
              <BoolToggle
                value={baseColors}
                disabled={busy}
                onChange={(next) => {
                  setBaseColors(next);
                  onBaseColorsChange(next);
                  setError('');
                }}
                label={t('保留原色', 'Keep face colors')}
              />
              <button
                type="button"
                className="sim-picture-clear-all"
                disabled={busy || count === 0}
                onClick={clearAllFaces}
                aria-label={t('清空 6 张图片', 'Clear all 6 images')}
                title={t('清空 6 张图片', 'Clear all 6 images')}
              >
                <Trash2 size={16} aria-hidden="true" />
              </button>
            </div>

            <div className="sim-picture-net" aria-label={t('六面图片', 'Six face images')}>
              {PICTURE_FACE_ORDER.map((face) => {
                const [zh, en] = PICTURE_FACE_LABELS[face];
                const hasImage = !!draft[face];
                return (
                  <div className="sim-picture-face" data-face={face} key={face}>
                    <button
                      type="button"
                      className="sim-picture-face-main"
                      onClick={() => {
                        if (hasImage) setCropFace(face);
                        else {
                          setTargetFace(face);
                          faceInputRef.current?.click();
                        }
                      }}
                      disabled={busy}
                      aria-label={hasImage ? t(`调整${zh}图片`, `Adjust ${en} image`) : t(`上传${zh}图片`, `Upload ${en} image`)}
                    >
                      {hasImage
                        ? <img src={draft[face]} alt="" />
                        : <ImagePlus size={22} />}
                      {hasImage && <em><Crop size={12} />{t('调整', 'Adjust')}</em>}
                      <span>{face}</span>
                    </button>
                    {hasImage && (
                      <button
                        type="button"
                        className="clear-btn clear-btn--standalone sim-picture-face-remove"
                        disabled={busy}
                        onClick={() => removeFace(face)}
                        aria-label={t(`删除${zh}图片`, `Remove ${en} image`)}
                        title={t(`删除${zh}图片`, `Remove ${en} image`)}
                      >
                        <Trash2 size={13} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="sim-picture-notes">
              <span>{t(`已设置 ${count}/6 面`, `${count}/6 faces set`)}</span>
              <span>{t('更改会自动保存在当前浏览器,不会上传到服务器', 'Changes are saved automatically in this browser and are not uploaded to a server')}</span>
            </div>
          </>
        )}
        <input ref={bulkInputRef} type="file" accept="image/*" multiple hidden onChange={handleBulkFiles} />
        <input ref={faceInputRef} type="file" accept="image/*" hidden onChange={handleFaceFile} />
        {error && <p className="sim-picture-error" role="status">{error}</p>}
      </section>
    </div>
  );
  return createPortal(dialog, document.body);
}

function PuzzleSettings({
  order, onOrderChange, puzzleKind, onPuzzleChange,
  renderer, onRendererChange,
  settings, onSettingsChange, transCore, bgSlot, t,
}: {
  order: number;
  onOrderChange: (n: number) => void;
  puzzleKind: SimPuzzle;
  onPuzzleChange: (kind: SimPuzzle) => void;
  renderer: 'cubing' | 'engine' | 'group';
  onRendererChange?: (r: 'cubing' | 'engine' | 'group') => void;
  settings: SimSettings;
  onSettingsChange: (s: SimSettings) => void;
  /** 非 null = trans 视图接管了内核色 / 内核不透明度(见 Props.transCore)。 */
  transCore?: { coreColor: string; coreOpacity: number } | null;
  /** 画布左下角浮层槽(SimPage 的 .sim-bg-overlay);背景选择器 portal 到这里,
   *  贴在大图上而非埋在设置面板的开关行里。 */
  bgSlot?: HTMLElement | null;
  t: (zh: string, en: string) => string;
}) {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  // Per-puzzle UI capabilities come from the single registry in simCaps — no per-kind
  // boolean chains here. The settings panel itself is intentionally identical for every
  // puzzle (engine-only toggles always render, no-op where the engine isn't driving); the
  // only per-puzzle bits left are `caps.carve` (挖角/挖面/挖棱 — the moving group differs
  // by puzzle, absent on NxN/SQ1) and `caps.hasRendererChoice` (cubing.js ↔ 群论内核
  // dropdown). Adding a puzzle's controls = one simCaps entry, never an edit to the JSX.
  const caps = resolveCaps(puzzleKind, renderer);
  const isNxNLocal = typeof puzzleKind === 'number';
  const isMirror = puzzleKind === 'mirror' || puzzleKind === 'mirror2';
  // 灰掉「该拼图暂不支持」的控件时,hover 给出统一说明。engineMode 拼图(斜转/金字塔/五魔/FTO)
  // 在 cubing.js 渲染下引擎特性不生效,但切到「群论内核」即点亮 → 附一句提示往哪切;PG 探索
  // 拼图切渲染也不会启用(引擎未建),只给通用说明。
  const switchEnables = !caps.engineActive && resolveCaps(puzzleKind, 'engine').engineActive;
  const naHint = switchEnables
    ? t('该拼图暂不支持此功能(切到「群论内核」渲染可启用)', 'Not available for this puzzle (switch the renderer to "Group theory" to enable)')
    : t('该拼图暂不支持此功能', 'Not available for this puzzle');
  const hint = (ok: boolean) => (ok ? undefined : naHint);
  // trans(X 光)是接管内核外观的预设,不是单纯换张伴图:选中时内核色 / 内核不透明度
  // 由它定值(3D 与伴图同吃),这两行随之锁死 —— hover 说明是谁锁的、怎么解锁。
  const transHint = transCore
    ? t(`已被图像面板的 trans(X 光)视图接管:银色内核 + ${transCore.coreOpacity}% 不透明。换成别的视图即可解锁`,
      `Taken over by the image panel's trans (x-ray) view: silver core at ${transCore.coreOpacity}% opacity. Switch to another view to unlock`)
    : undefined;

  const set = <K extends keyof SimSettings>(key: K, value: SimSettings[K]) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  const [pictureEditorOpen, setPictureEditorOpen] = useState(false);
  const pictureFaceCount = countPictureFaces(settings.pictureFaces);
  const pictureCubeActive = caps.supports.pictureCube
    && settings.pictureCube
    && pictureFaceCount > 0;
  const closePictureEditor = useCallback(() => setPictureEditorOpen(false), []);
  const autoSavePictureFaces = useCallback((faces: PictureFaces) => {
    if (!persistPictureFaces(faces)) return false;
    onSettingsChange({
      ...settings,
      pictureFaces: faces,
      pictureCube: countPictureFaces(faces) > 0,
    });
    return true;
  }, [onSettingsChange, settings]);
  const autoSavePictureBaseColors = useCallback((pictureBaseColors: boolean) => {
    onSettingsChange({ ...settings, pictureBaseColors });
  }, [onSettingsChange, settings]);

  // 顶面 logo 自定义上传:选「自定义」即开文件选择器,选好降采样存进 customLogo 并切到 'custom'。
  const logoFileRef = useRef<HTMLInputElement>(null);
  const handleLogoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // 允许再次选同一文件
    if (!file) return;
    try {
      const url = await fileToLogoDataUrl(file);
      onSettingsChange({ ...settings, customLogo: url, logo: 'custom' });
    } catch { /* 坏图忽略 */ }
  };

  // 背景(BG)选择器:复用内核色那套弹出色块选择器(SwatchPopup),trigger 显当前
  // 背景,点开弹 5 档可视色块。原先埋在设置面板开关行,现 portal 到画布左下角浮层
  // (.sim-bg-overlay),贴着大图 —— 背景是画布属性,控件搬到画布上更直觉。
  // 只留色块,不带文字标签 —— 色块本身就说明是什么(title 兜 a11y / 悬停提示)。
  const bgSelector = (
    <>
      <SwatchPopup
        title={t('背景', 'Background')}
        trigger={<span className={`sim-swatch-box sim-bg-box--${settings.boardBg}`} />}
      >
        {(close) =>
          ([
            ['auto', t('跟随主题', 'Theme')],
            ['white', t('纯白', 'White')],
            ['dark', t('深灰', 'Dark')],
            ['checkerDark', t('深色棋盘', 'Dark grid')],
            ['checkerLight', t('浅色棋盘', 'Light grid')],
          ] as [SimBoardBg, string][]).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={'sim-swatch' + (settings.boardBg === value ? ' active' : '')}
              title={label}
              aria-label={label}
              aria-pressed={settings.boardBg === value}
              onClick={() => { set('boardBg', value); close(); }}
            >
              <span className={`sim-swatch-box sim-bg-box--${value}`} />
            </button>
          ))
        }
      </SwatchPopup>
    </>
  );

  return (
    <section className="sim-puzzle">
      {/* 背景选择器浮层 —— portal 到画布左下角(SimPage 的 .sim-bg-overlay)。slot 未
          挂载(SimPage 恒提供)前不渲染。 */}
      {bgSlot && createPortal(<div className="sim-bg-overlay-inner">{bgSelector}</div>, bgSlot)}
        <div className="sim-puzzle-body">
          <div className="sim-puzzle-row">
            <div className="sim-puzzle-section">
              <PuzzleTypeSelect
                value={typeof puzzleKind === 'number' ? 'nxn' : String(puzzleKind)}
                isZh={isZh}
                onChange={(v) => {
                  if (v === 'sq1' || v === 'ivy' || v === 'dino' || v === 'redi' || v === 'rex' || v === 'heli' || v === 'gear' || v === 'pyraminx' || v === 'skewb' || v === 'megaminx' || v === 'fto' || v === 'mirror' || v === 'mirror2' || v === 'clock' || v === 'custom') onPuzzleChange(v);
                  else if (isPgPuzzleId(v)) onPuzzleChange(v as PgPuzzleId);
                  else onPuzzleChange(order || 3);
                }}
              />
            </div>
            {isNxNLocal && (
              <div className="sim-puzzle-section">
                <NxNOrderInput
                  value={order}
                  onCommit={onOrderChange}
                  aria-label={t('阶数', 'Order')}
                  onMouseDown={(e) => e.stopPropagation()}
                />
              </div>
            )}
            {/* Renderer choice: cubing.js ↔ 群论内核 (= the in-house engine + a live group
                panel). The standalone 自有引擎 (engine without panel) option was retired —
                群论内核 is its strict superset. Only puzzles with a cubing.js renderer get a
                toggle; pure-engine PG puzzles (dino/heli) have no alternative, so no select. */}
            {caps.hasRendererChoice && onRendererChange && (
              <div className="sim-puzzle-section">
                <div className="sim-puzzle-section-title">{t('渲染', 'Renderer')}</div>
                <select
                  className="sim-puzzle-select"
                  value={renderer === 'cubing' ? 'cubing' : 'group'}
                  onChange={(e) => onRendererChange(e.target.value as 'cubing' | 'engine' | 'group')}
                  title={t('cubing.js 官方渲染 / 群论内核(本站引擎:圆润外观 + 拖拽转动 + 群结构面板)', 'cubing.js renderer / group-theory kernel (in-house engine: rounded look + drag + group panel)')}
                >
                  <option value="group">{t('群论内核', 'Group theory')}</option>
                  <option value="cubing">cubing.js</option>
                </select>
              </div>
            )}
            {isNxNLocal && (
              <div className="sim-puzzle-section">
                <select
                  className="sim-puzzle-select"
                  value={settings.viewMode}
                  onChange={(e) => set('viewMode', e.target.value as 'cube' | 'net')}
                >
                  <option value="cube">{t('立体图', '3D cube')}</option>
                  <option value="net">{t('平面图', 'Flat net')}</option>
                </select>
              </div>
            )}
          </div>

          <div className="sim-puzzle-sliders">
            <Slider label={t('灵敏度', 'Sensitivity')} value={settings.sensitivity} onChange={(v) => set('sensitivity', v)} disabled={!caps.supports.sensitivity} unit={UNIT_SENS}
              title={hint(caps.supports.sensitivity) ?? (settings.pointerTurns === false
                // 手拧关 → 拖层/SQ1 两条路径不再产生 move,只剩转视角,单位含义随之收窄(仍然可调)。
                ? t('跟手倍率(相对默认):手拧已关,当前只作用于拖动转视角', 'Responsiveness relative to the default — with drag-turn off it only scales view rotation')
                : t('跟手倍率(相对默认):同时作用于拖层转动、拖空白转视角、SQ1 拖拽', 'Responsiveness relative to the default — scales layer drags, view drags and SQ1 drags alike'))} />
            <Slider label={t('缩放', 'Scale')} value={settings.scale} onChange={(v) => set('scale', v)} disabled={!caps.supports.scale} unit={UNIT_SCALE} title={hint(caps.supports.scale) ?? t('缩放倍率', 'Zoom factor')} />
            <Slider label={t('透视', 'Perspective')} value={settings.perspective} onChange={(v) => set('perspective', v)} disabled={!caps.supports.perspective} unit={UNIT_FOCAL} title={hint(caps.supports.perspective) ?? t('35mm 等效焦距(小 = 广角畸变强,大 = 接近正交)', '35mm-equivalent focal length (low = wide-angle distortion, high = near-orthographic)')} />
            <Slider label={t('TPS', 'TPS')} value={settings.speed} onChange={(v) => set('speed', v)} unit={UNIT_TPS} title={t('每秒转动步数', 'Turns per second')} />
          </div>
          {/* 视角盘:「左右 / 上下」两条滑条合成一个平面直角坐标系 —— 可拖圆点 + 两个精确度数框
              (打 30 正好 30)。右 = 正(看右面)、上 = 正(俯视),纯显示层符号,不改底层 3D 旋转。
              twisty 渲染下左右量程 ±180°(cameraLongitude 全程),引擎 ±90°。 */}
          <OrbitPad
            xValue={settings.viewAngle}
            yValue={settings.viewGradient}
            onChange={(x, y) => onSettingsChange({ ...settings, viewAngle: x, viewGradient: y })}
            xLabel={t('左右', 'Yaw')}
            yLabel={t('上下', 'Pitch')}
            xUnit={caps.engineActive ? UNIT_YAW_ENGINE : UNIT_YAW_TWISTY}
            yUnit={UNIT_PITCH}
            xTitle={t('左右旋转角度(右 = 正,看右面)', 'Horizontal view angle (right = positive, toward the right face)')}
            yTitle={t('上下旋转角度(上 = 正,俯视)', "Vertical view angle (up = positive, bird's-eye)")}
          />
          <div className="sim-puzzle-toggles">
            {/* 手拧:关 = 鼠标 / 手势不能拧动拼图(点贴纸、拖贴纸都只转视角,不记步);
                视角旋转 / 缩放 / 平移 / 键盘 / 播放不受影响。三条路径都接:NxN controller、
                SQ1 / Ivy / 角转系 gesture、cubing.js addMove。 */}
            <Toggle
              label={t('手拧', 'Drag turn')}
              value={settings.pointerTurns !== false}
              onChange={(v) => set('pointerTurns', v)}
              title={t('关闭后鼠标 / 手势只能转视角,不能拧动拼图(键盘和播放不受影响)', 'Off: mouse / touch only rotates the view — it cannot turn the puzzle (keyboard and playback still work)')}
            />
            {/* 「消步」开关已移到播放器工具行(逆 旁),此处不再重复。 */}
            <label className={`sim-toggle${caps.supports.dragEmpty ? '' : ' sim-toggle--disabled'}`} title={hint(caps.supports.dragEmpty)}>
              <span>{t('拖空白', 'Drag empty')}</span>
              <select
                value={settings.dragEmpty}
                disabled={!caps.supports.dragEmpty}
                onChange={(e) => set('dragEmpty', e.target.value as 'orbit' | 'rotate' | 'view')}
              >
                <option value="rotate">{t('整步转体', 'Snap rotate')}</option>
                <option value="view">{t('视角', 'View')}</option>
                <option value="orbit">{t('自动转体', 'Auto rotate')}</option>
              </select>
            </label>
            {/* 播放动画开关:关 → 「播放」时瞬切每一步(不逐格转动);单步前进/后退本就瞬切。 */}
            <Toggle label={t('动画', 'Animation')} value={settings.animatePlayback !== false} onChange={(v) => set('animatePlayback', v)} />
            {/* 方位字母常显:U/D/L/R/F/B(角/棱/面转拼图显对应标签),等同拖视角时浮现的标签但常驻。 */}
            <Toggle
              label={t('字母', 'Letters')}
              value={settings.faceLabels === true}
              onChange={(v) => set('faceLabels', v)}
              disabled={!caps.supports.faceLabels || pictureCubeActive}
              title={pictureCubeActive
                ? t('使用图案时暂时隐藏字母', 'Letters are hidden while artwork is active')
                : hint(caps.supports.faceLabels)}
            />
            {/* 背景(BG)选择器已移到画布左下角浮层(见本组件顶部 bgSelector + SimPage
                的 .sim-bg-overlay),不再占开关行。 */}
            {/* 顶面 U 中心 logo:无 / 网站 / 自定义上传。仅 NxN 奇数阶有正中心块时实际显示
                (偶数阶 / 非 NxN 引擎里 setLogo 自动隐藏)。选「自定义」开文件选择器。 */}
            <label className={'sim-toggle' + (caps.supports.logo ? '' : ' sim-toggle--disabled')} title={hint(caps.supports.logo)}>
              <span>logo</span>
              <select
                value={settings.logo}
                disabled={!caps.supports.logo}
                onChange={(e) => {
                  const v = e.target.value as SimSettings['logo'];
                  if (v === 'custom') logoFileRef.current?.click();
                  else set('logo', v);
                }}
              >
                <option value="none">{t('无', 'None')}</option>
                <option value="site">{t('魔方根', 'CubeRoot')}</option>
                <option value="custom">{t('自定义', 'Custom')}</option>
              </select>
              <input
                ref={logoFileRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleLogoFile}
              />
            </label>
            {/* 锁定大小位置 锁的是引擎滚轮/捏合缩放,cubing.js 拼图自管缩放 → 引擎未驱动时灰掉。 */}
            <Toggle label={t('锁定大小位置', 'Lock size & position')} value={settings.lockView} onChange={(v) => set('lockView', v)} disabled={!caps.supports.lockView} title={hint(caps.supports.lockView)} />
            {/* 小窗(背面视图)的开关不在这里:小窗自己右上角有 ×,关掉后播放条最右出现
                找回按钮 —— 同一个 settings.backView 已经有两个入口,再放一个是第三份。 */}
            {/* 立体贴片 / 镂空 是本站引擎特性,cubing.js 渲染的拼图上无此能力 → 引擎未驱动时灰掉
                (面板形状仍保持每拼图一致:控件常显,只是不可点)。 */}
            <Toggle label={t('立体贴片', 'Sticker thickness')} value={settings.thickness} onChange={(v) => set('thickness', v)} disabled={!caps.supports.thickness} title={hint(caps.supports.thickness)} />
            <Toggle label={t('镂空', 'Hollow')} value={settings.hollow} onChange={(v) => set('hollow', v)} disabled={!caps.supports.hollow} title={hint(caps.supports.hollow)} />
            {/* 提示贴片(hint)两条路径都支持(引擎 hint / cubing.js hintFacelets)→ 不灰。 */}
            <Toggle label={t('提示贴片', 'Hint facelets')} value={settings.hint} onChange={(v) => set('hint', v)} disabled={!caps.supports.hint} title={hint(caps.supports.hint)} />
            {/* 手指(指法演示):双手握持,转层时腕转/弹指跟动画。仅 3x3(simCaps.hands)。 */}
            <Toggle label={t('手指', 'Hands')} value={settings.hands === true} onChange={(v) => set('hands', v)} disabled={!caps.supports.hands} title={hint(caps.supports.hands)} />
            {/* 全身人物:SMPL-X 完整人随手出场(躯干静态 + 双臂 IK 追手;拉远 Scale 看全身)。
                依赖手指开启;资产逐机转换,缺失时静默降级。 */}
            <Toggle label={t('全身人物', 'Full body')} value={settings.fullBody === true} onChange={(v) => set('fullBody', v)} disabled={!caps.supports.hands || settings.hands !== true} title={hint(caps.supports.hands)} />
            {/* 箭头贴片仅 NxN 引擎生效(cube.arrow),非 NxN 拼图无此属性 → 仅 NxN 显示。
                用户指定的唯一例外。 */}
            {isNxNLocal && (
              <Toggle label={t('箭头', 'Arrows')} value={settings.arrow} onChange={(v) => set('arrow', v)} />
            )}
          </div>
          {/* 调试控件单独成行(用户要求):半转停 / 结构着色 / 骨架线条 / 挖块。组前缀「调试」标一次,
              各控件去掉重复的「调试:」前缀。半转停 / 结构着色 为本站引擎特性,在 cubing.js 渲染的拼图上
              为 no-op(仅存设置);骨架线条为手部 MediaPipe 风格叠加线,仅 3x3 手指开启时有效;
              挖块为统一三选一占位(见 applySettings)。 */}
          <div className="sim-puzzle-debug">
            <div className="sim-puzzle-section-title">{t('调试', 'Debug')}</div>
            <div className="sim-puzzle-debug-toggles">
              <Toggle label={t('半转停', 'Hold partial turn')} value={settings.holdPartialTurn} onChange={(v) => set('holdPartialTurn', v)} disabled={!caps.supports.holdPartialTurn} title={hint(caps.supports.holdPartialTurn)} />
              <Toggle label={t('结构着色', 'Structure colors')} value={settings.debugStructureColor} onChange={(v) => set('debugStructureColor', v)} disabled={!caps.supports.structureColor} title={hint(caps.supports.structureColor)} />
              {/* 骨架线条:MediaPipe 风格关键点叠加,仅手指(hands)开启的拼图上可用(同 caps.supports.hands)。 */}
              <Toggle label={t('骨架线条', 'Skeleton overlay')} value={settings.handsSkeleton} onChange={(v) => set('handsSkeleton', v)} disabled={!caps.supports.handsSkeleton} title={hint(caps.supports.handsSkeleton)} />
              {/* 指甲:立体甲片显隐(mesh.visible,不拆几何),门控同骨架线条(手指相关调试)。 */}
              <Toggle label={t('指甲', 'Nails')} value={settings.showNails} onChange={(v) => set('showNails', v)} disabled={!caps.supports.handsSkeleton} title={hint(caps.supports.handsSkeleton)} />
              {/* SMPL-X 全身:藏拼图与手,只看原版 SMPL-X neutral T-pose 人体(手/臂比例上游真值)。
                  资产逐机转换(convert-mano.py),缺失时开了也无效果 —— 不灰,调试自担。
                  平面拼图是唯一的例外:它根本没有 3D 场景可以站人,那不是"资产可能缺",是没地方放。 */}
              <Toggle label={t('SMPL-X 全身', 'SMPL-X body')} value={settings.showSmplxBody === true} onChange={(v) => set('showSmplxBody', v)} disabled={caps.flat} title={hint(!caps.flat)} />
              {/* 挖块:仅当该拼图有「原生转动元素」(角/面/棱)可掀起时可选;NxN/SQ1 无单一会动块组,
                  cubing.js 拼图引擎未驱动 → 灰掉。 */}
              <label className={'sim-toggle' + (caps.supports.carve ? '' : ' sim-toggle--disabled')} title={hint(caps.supports.carve)}>
                <span>{t('挖块', 'Carve')}</span>
                <select
                  value={settings.debugCarve}
                  disabled={!caps.supports.carve}
                  onChange={(e) => set('debugCarve', e.target.value as SimSettings['debugCarve'])}
                >
                  <option value="off">{t('关', 'Off')}</option>
                  <option value="corner">{t('挖角', 'Corner')}</option>
                  <option value="face">{t('挖面', 'Face')}</option>
                  <option value="edge">{t('挖棱', 'Edge')}</option>
                </select>
              </label>
              {/* 隔离:只保留某类块、挖掉其余(挖块的反操作)。选项由 simCaps 各魔方声明的
                  isolate 列表驱动(目前仅齿轮:角/棱/中心 —— 中心块含核心骨架),未声明置灰。
                  选了某类后旁边出「编号」下拉:全部 / 第 1…count 个(用户要单独看一个块)。 */}
              <label className={'sim-toggle' + (caps.supports.isolate ? '' : ' sim-toggle--disabled')} title={hint(caps.supports.isolate)}>
                <span>{t('隔离', 'Isolate')}</span>
                <select
                  value={settings.debugIsolate}
                  disabled={!caps.supports.isolate}
                  onChange={(e) => onSettingsChange({
                    ...settings,
                    debugIsolate: e.target.value as SimSettings['debugIsolate'],
                    debugIsolateIndex: -1, // 换类别复位到「全部」,免旧编号越界
                  })}
                >
                  <option value="off">{t('关', 'Off')}</option>
                  {caps.isolate.some((x) => x.kind === 'corner') && <option value="corner">{t('角块', 'Corner')}</option>}
                  {caps.isolate.some((x) => x.kind === 'edge') && <option value="edge">{t('棱块', 'Edge')}</option>}
                  {caps.isolate.some((x) => x.kind === 'center') && <option value="center">{t('中心块', 'Center')}</option>}
                  {caps.isolate.some((x) => x.kind === 'core') && <option value="core">{t('骨架', 'Frame')}</option>}
                </select>
              </label>
              {(() => {
                const spec = caps.isolate.find((x) => x.kind === settings.debugIsolate);
                if (!caps.supports.isolate || !spec) return null;
                return (
                  <label className="sim-toggle">
                    <span>{t('编号', 'Piece')}</span>
                    <select
                      value={String(settings.debugIsolateIndex)}
                      onChange={(e) => set('debugIsolateIndex', Number(e.target.value))}
                    >
                      <option value="-1">{t('全部', 'All')}</option>
                      {Array.from({ length: spec.count }, (_, i) => (
                        <option key={i} value={String(i)}>{i + 1}</option>
                      ))}
                    </select>
                  </label>
                );
              })()}
            </div>
          </div>
          {isMirror && (
            <ColorRow label={t('镜面配色', 'Mirror colour')}>
              <ModeColorSelect
                special={(settings.mirrorColorMode ?? 'single') === 'six'}
                color={settings.mirrorColor ?? MIRROR_DEFAULT_COLOR}
                presets={MIRROR_COLOR_PRESETS}
                specialTitle={t('六色', 'Six colours')}
                specialSwatchClass="sim-swatch-six-box"
                onPickColor={(c) => onSettingsChange({ ...settings, mirrorColorMode: 'single', mirrorColor: c })}
                onPickSpecial={() => set('mirrorColorMode', 'six')}
                title={t('镜面配色', 'Mirror colour')}
                t={t}
              />
            </ColorRow>
          )}
          <ColorRow
            label={t('内核色', 'Core color')}
            disabled={!caps.supports.coreColor || !!transCore}
            title={transHint ?? hint(caps.supports.coreColor)}
          >
            <ModeColorSelect
              special={!transCore && settings.coreStyle === 'raw'}
              color={transCore ? transCore.coreColor : settings.coreColor}
              presets={CORE_COLOR_PRESETS}
              specialTitle={t('原核', 'Raw body')}
              specialSwatchClass="sim-swatch-raw-box"
              onPickColor={(c) => onSettingsChange({ ...settings, coreStyle: 'normal', coreColor: c })}
              onPickSpecial={() => set('coreStyle', 'raw')}
              title={t('内核色', 'Core color')}
              t={t}
            />
          </ColorRow>
          {/* 内核色的三个同族旋钮 —— 都作用在「贴纸之外那层」上,3D 与示意伴图共用同一份值
              (伴图导出器的 bodyOpacity / stickerOpacity / inset)。原来只挂在图像面板里、
              只改图不改动画,现在并到内核色下面一起管。 */}
          <PercentRow
            label={t('内核不透明度', 'Core opacity')}
            value={transCore ? transCore.coreOpacity : settings.coreOpacity}
            onChange={(v) => set('coreOpacity', v)}
            disabled={!caps.supports.coreOpacity || !!transCore}
            title={transHint ?? hint(caps.supports.coreOpacity)}
          />
          <PercentRow
            label={t('贴纸不透明度', 'Sticker opacity')}
            value={settings.stickerOpacity}
            onChange={(v) => set('stickerOpacity', v)}
            disabled={!caps.supports.coreFinish}
            title={hint(caps.supports.coreFinish)}
          />
          <PercentRow
            label={t('黑边', 'Gap')}
            value={settings.stickerGap}
            min={0}
            max={30}
            step={0.5}
            onChange={(v) => set('stickerGap', v)}
            disabled={!caps.supports.coreFinish}
            title={hint(caps.supports.coreFinish)
              ?? t('贴纸之间那条缝有多宽(占小面的百分比)', 'Width of the gap between stickers, as a % of one facelet')}
          />
          <ColorRow
            label={t('面色', 'Face colors')}
            disabled={!caps.supports.faceColors}
            title={hint(caps.supports.faceColors)}
            action={{
              label: 'WCA',
              title: t('恢复 WCA 默认', 'Reset to WCA defaults'),
              onClick: () => set('faceColors', { ...DEFAULT_FACE_COLORS }),
            }}
          >
            {FACE_ORDER.map((f) => (
              <span key={f} className="sim-face-pick">
                <span className="sim-swatch-label">{f}</span>
                <ModeColorSelect
                  color={settings.faceColors[f]}
                  presets={FACE_COLOR_PRESETS}
                  onPickColor={(c) => set('faceColors', { ...settings.faceColors, [f]: c })}
                  title={t(FACE_LABELS_ZH[f], f)}
                  t={t}
                />
              </span>
            ))}
          </ColorRow>
          <div
            className={'sim-picture-setting' + (caps.supports.pictureCube ? '' : ' sim-picture-setting--disabled')}
            title={hint(caps.supports.pictureCube)}
          >
            <Toggle
              label={t('图案魔方', 'Picture cube')}
              value={settings.pictureCube && pictureFaceCount > 0}
              disabled={!caps.supports.pictureCube}
              title={hint(caps.supports.pictureCube)
                ?? t('把六张图片切到魔方的真实贴纸上,打乱后图片会随块移动', 'Slice six images across the real stickers so the artwork moves with every turn')}
              onChange={(enabled) => {
                if (enabled && pictureFaceCount === 0) {
                  setPictureEditorOpen(true);
                  return;
                }
                set('pictureCube', enabled);
              }}
            />
            <button
              type="button"
              className="sim-picture-open"
              disabled={!caps.supports.pictureCube}
              onClick={() => setPictureEditorOpen(true)}
            >
              <PictureFaceMiniNet faces={settings.pictureFaces} />
              <span>{pictureFaceCount > 0
                ? t('编辑', 'Edit')
                : t('选择六面图片', 'Choose face images')}</span>
            </button>
            {pictureCubeActive && (
              <span className="sim-picture-setting-note">
                {t('使用图案时暂时隐藏 logo、字母和箭头', 'Logo, letters and arrows are hidden while pictures are in use')}
              </span>
            )}
          </div>
          <PictureCubeEditor
            open={pictureEditorOpen}
            initialFaces={settings.pictureFaces}
            initialBaseColors={settings.pictureBaseColors}
            order={order}
            onClose={closePictureEditor}
            onFacesChange={autoSavePictureFaces}
            onBaseColorsChange={autoSavePictureBaseColors}
            t={t}
          />
          {/* 指甲配色(甲油):自然甲 special + 甲油底色;选了底色后追加「渐变」第二色
              (甲根→游离缘)与「深浅」滑杆(50 = 原色,低淡高深)。重涂手部立体甲片
              顶点色(engine/hands paintNailPolish);门控同全身人物(需手指开启)。 */}
          <ColorRow
            label={t('指甲配色', 'Nail colour')}
            disabled={!caps.supports.hands || settings.hands !== true}
            title={hint(caps.supports.hands)}
          >
            <ModeColorSelect
              special={!settings.nailColor}
              color={settings.nailColor || NAIL_DEFAULT_COLOR}
              presets={NAIL_COLOR_PRESETS}
              specialTitle={t('自然甲', 'Natural')}
              specialSwatchClass="sim-swatch-nail-box"
              onPickColor={(c) => set('nailColor', c)}
              onPickSpecial={() => set('nailColor', '')}
              title={t('指甲配色', 'Nail colour')}
              t={t}
            />
            {settings.nailColor !== '' && (
              <>
                <span className="sim-face-pick">
                  <span className="sim-swatch-label">{t('渐变', 'Tip')}</span>
                  <ModeColorSelect
                    special={!settings.nailColorTip}
                    color={settings.nailColorTip || settings.nailColor}
                    presets={NAIL_COLOR_PRESETS}
                    specialTitle={t('无渐变', 'No gradient')}
                    specialSwatchClass="sim-swatch-nail-off-box"
                    onPickColor={(c) => set('nailColorTip', c)}
                    onPickSpecial={() => set('nailColorTip', '')}
                    title={t('渐变第二色(甲根 → 指尖)', 'Gradient tip colour (root → tip)')}
                    t={t}
                  />
                </span>
                <label className="sim-nail-shade" title={t('深浅:左淡右深,中间原色', 'Depth: light ↔ dark, centre = as picked')}>
                  <span className="sim-swatch-label">{t('深浅', 'Depth')}</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={settings.nailShade}
                    onChange={(e) => set('nailShade', Number(e.target.value))}
                  />
                </label>
              </>
            )}
          </ColorRow>
        </div>
    </section>
  );
}

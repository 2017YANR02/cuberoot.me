'use client';

/**
 * PlayerControls — alg playground for /sim (Next.js port).
 *
 * Differences from the Vite version:
 *  - Uses plain <textarea> instead of AlgInput (no markable/autospace yet).
 *    AlgInput depends on 200+ lines of normalisation utils that haven't been
 *    ported yet. Plain textarea retains paste / typing / caret sync — the
 *    main "live preview while editing" UX is intact.
 *  - No CubeVirtualKeyboard (defer; mobile users can use system kbd).
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
import { useTranslation } from 'react-i18next';
import { useRouter, useParams } from 'next/navigation';
import {
  Play, Pause, SkipBack, SkipForward, RotateCcw,
  FlipHorizontal2, FlipVertical2, Eraser, RotateCw,
  Shuffle, Link2, Check, Upload,
  Search, Loader2, Pipette, Wallpaper,
} from 'lucide-react';
import { Alg, Move } from 'cubing/alg';
import World from './engine/world';
import { TwistAction } from './engine/nxn/twister';
import { timing } from './engine/tweenTiming';
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
  parseSkewbMoves, skewbMovesToString, randomSkewbScramble, type SkewbMove,
} from './engine/skewb/skewbState';
import {
  parsePyraMoves, pyraMovesToString, invertPyraMoves, reducePyraAlg, randomPyraScramble, type PyraMove,
} from './engine/pyra/pyraState';
import {
  parseMegaMoves, megaMovesToString, invertMegaMoves, reduceMegaAlg, randomMegaScramble, type MegaMove,
} from './engine/mega/megaState';
import {
  parseFtoMoves, ftoMovesToString, invertFtoMoves, reduceFtoAlg, randomFtoScramble, type FtoMove,
} from './engine/fto/ftoState';

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
import { invertAlg, simplifyAlg, simplifyTwistyAlg, mirrorAlg, countMoves } from '@/lib/cube3';
import { get_shortened_rotation } from '@/lib/roux/RotationHelp';
import { cleanForPlayer, extractAlgFromText } from '@/lib/recon-alg-utils';
import { deriveScrambleFromSolution } from '@/lib/scramble-from-solution';
import { tnoodleRandomScramble } from '@/lib/cubing-scramble';
import { pgRandomScramble } from '@/lib/pg-scramble';
import {
  formatScrambleForEvent, canonicalSq1Alg, compactSq1Alg,
  simplifySq1Alg, invertSq1Alg, parseSq1Tokens,
} from '@/lib/sq1-svg';
import type { SkewbNotation } from '@cuberoot/shared/skewb-notation';
import {
  Slider, Toggle, KeymapModal, resetWorldView,
  DEFAULT_SETTINGS, DEFAULT_FACE_COLORS, MIRROR_DEFAULT_COLOR,
  type SimSettings, type SimBoardBg,
} from './SettingDrawer';
import { type KeyMove } from './keymap';
import { defaultPlatonicColorSchemes } from '@/lib/puzzle-geometry/colors';
import { fileToLogoDataUrl } from './engine/nxn/logo';
import { PG_PUZZLES, isPgPuzzleId, type PgPuzzleId } from './pgCatalog';
import { resolveCaps } from './simCaps';
import { reconEventForSim, buildReconSubmitQuery } from '@/lib/sim-recon-link';
import { WheelPicker } from '@/components/WheelPicker';
import { CubingIcon } from '@/components/EventIcon/EventIcon';
import { eventDisplayName } from '@/lib/wca-events';
import './player-controls.css';

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
  { value: 'fto',      iconClass: 'unofficial-fto', labelZh: eventDisplayName('fto', true), labelEn: eventDisplayName('fto', false) },
  { value: 'dino',     iconClass: 'unofficial-dino', labelZh: '恐龙', labelEn: 'Dino' },
  { value: 'redi',     iconClass: 'unofficial-redi', labelZh: 'Redi', labelEn: 'Redi' },
  { value: 'rex',      iconClass: 'unofficial-rex', labelZh: 'Rex', labelEn: 'Rex Cube' },
  { value: 'heli',     iconClass: 'unofficial-helicopter', labelZh: '直升机', labelEn: 'Helicopter' },
  { value: 'mirror',   iconClass: 'event-333', labelZh: '镜面', labelEn: 'Mirror' },
] as const;

// Engine puzzles above + cubing.js PuzzleGeometry puzzles (explore set, rendered
// via TwistyPlayer — see pgCatalog.ts). The PG entries are appended at runtime so
// the catalog stays the single source of truth.
const ALL_PUZZLE_TYPE_OPTIONS: { value: string; iconClass: string; labelZh: string; labelEn: string }[] = [
  ...PUZZLE_TYPE_OPTIONS,
  ...PG_PUZZLES.map((p) => ({ value: p.id, iconClass: p.icon, labelZh: p.zh, labelEn: p.en })),
];

function PuzzleTypeSelect({ value, onChange, isZh }: {
  value: string;
  onChange: (v: string) => void;
  isZh: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const current = ALL_PUZZLE_TYPE_OPTIONS.find(o => o.value === value) ?? ALL_PUZZLE_TYPE_OPTIONS[0];

  return (
    <div ref={ref} className="sim-puzzle-type-select">
      <button
        type="button"
        title={isZh ? current.labelZh : current.labelEn}
        className="sim-puzzle-select sim-puzzle-type-trigger"
        onClick={() => setOpen(o => !o)}
      >
        <CubingIcon icon={current.iconClass} className="sim-puzzle-type-icon" />
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
          <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
        </svg>
      </button>
      {open && (
        <div className="sim-puzzle-type-popup">
          {ALL_PUZZLE_TYPE_OPTIONS.map(o => (
            <button
              key={o.value}
              type="button"
              title={isZh ? o.labelZh : o.labelEn}
              className={`sim-puzzle-type-item${o.value === value ? ' sim-puzzle-type-item--active' : ''}`}
              onClick={() => { onChange(o.value); setOpen(false); }}
            >
              <CubingIcon icon={o.iconClass} className="sim-puzzle-type-icon" />
              <span className="sim-puzzle-type-label">{isZh ? o.labelZh : o.labelEn}</span>
            </button>
          ))}
        </div>
      )}
    </div>
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
export type SimPuzzle = number | 'sq1' | 'ivy' | 'dino' | 'redi' | 'rex' | 'heli' | 'pyraminx' | 'skewb' | 'megaminx' | 'fto' | 'mirror' | 'custom' | PgPuzzleId;

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
    out.push({ corner: moves[i].corner, dir: moves[i].dir === 1 ? -1 : 1 });
  }
  return out;
}

/** Fold consecutive same-grip Skewb twists mod 3 (X X = X', X X' = id, …). */
function reduceSkewbAlg(s: string): string {
  const moves = parseSkewbMoves(s);
  const out: SkewbMove[] = [];
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
  return skewbMovesToString(out);
}

// ── Corner/edge-turn engine puzzles registry ────────────────────────────────────
// Dino / Redi / Rex / Heli / Skewb are all discrete corner-or-edge-turn engine
// puzzles whose player logic (parse / invert / 消步 / scramble / replay) is identical
// in shape — only the per-puzzle move functions differ. Capturing those 5 differences
// per puzzle in one descriptor collapses what used to be ~13 parallel `isDino||isRedi
// ||…` branches into a single `corner` lookup. Adding a corner-turn puzzle = one entry
// here + one line in `cornerKind` below (mirrors the engine/cornerTurnGesture adapters).
type CornerKind = 'dino' | 'redi' | 'rex' | 'heli' | 'skewb' | 'pyraminx' | 'megaminx' | 'fto';

interface CornerSpec {
  /** Parse alg / scramble text → the puzzle's move list. */
  parse(s: string): unknown[];
  /** Move list → canonical text. */
  toString(moves: unknown[]): string;
  /** The inverse sequence (for the "Algorithm" playback base + 取逆 tool). */
  invert(moves: unknown[]): unknown[];
  /** Fold / cancel redundant moves (消步). */
  reduce(s: string): string;
  /** A fresh random scramble string. */
  scramble(): string;
}

/** Uniform cube surface every corner-turn engine cube exposes (move type erased to
 *  `unknown` — the move always comes from the same puzzle's spec, so it matches). */
interface CornerCube {
  twister: {
    finish(): void;
    setup(s: string): void;
    push(s: string): void;
    twist(move: unknown, fast: boolean, force: boolean): boolean;
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
    toString: (m) => ftoMovesToString(m as FtoMove[]),
    invert: (m) => invertFtoMoves(m as FtoMove[]),
    reduce: reduceFtoAlg,
    scramble: () => ftoMovesToString(randomFtoScramble(30)),
  },
};

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
}

export default function PlayerControls({
  world, alg, setup, onAlgChange, onSetupChange,
  order, onOrderChange, puzzleKind, onPuzzleChange,
  settings, onSettingsChange,
  keymap, onKeymapChange, onResetKeymap,
  userMoveRef, twistyPlayerRef,
  skewbNotation, onSkewbNotationChange,
  renderer = 'cubing', onRendererChange,
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
            : isSkewbEngine ? 'skewb'
              : isPyraEngine ? 'pyraminx'
                : isMegaEngine ? 'megaminx'
                  : isFtoEngine ? 'fto'
                    : null;
  const corner = cornerKind ? CORNER_SPECS[cornerKind] : null;
  // "Derive scramble from solution" (cubedb-style) is 3x3-only — the solver is.
  const is3x3 = !isSq1 && !isIvy && !corner && !isTwistyMode && order === 3;
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const t = (zh: string, en: string) => (isZh ? zh : en);

  const router = useRouter();
  const params = useParams<{ lang?: string }>();
  const langPrefix = params?.lang === 'zh' || params?.lang === 'en'
    ? `/${params.lang}` : ((i18n.language.startsWith('zh') ? '/zh' : '/en'));
  // Engine-skewb uses the self-contained engine notation (UFR/UFL…), which /recon
  // (WCA skewb notation) can't parse — suppress the recon hand-off there.
  const reconEvent = isEngineTwisty ? null : reconEventForSim(puzzleKind);

  const [algDraft, setAlgDraft] = useState(alg);
  const [setupDraft, setSetupDraft] = useState(setup ?? '');
  const [sq1Format, setSq1Format] = useState<'compact' | 'wca'>('compact');
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [linkCopied, setLinkCopied] = useState(false);
  const [derivingScramble, setDerivingScramble] = useState(false);

  useEffect(() => {
    timing.frames = Math.max(2, Math.round(30 / speed));
  }, [speed]);

  const playTimerRef = useRef<number | null>(null);
  const stepRef = useRef(0);
  const setupElRef = useRef<HTMLTextAreaElement | null>(null);
  const algElRef = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => { stepRef.current = step; }, [step]);

  useEffect(() => { setAlgDraft(alg); }, [alg]);
  useEffect(() => { setSetupDraft(setup ?? ''); }, [setup]);

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

  const actions = useMemo<TwistAction[]>(() => {
    if (isSq1 || isIvy || corner) return [];
    if (!algDraft.trim()) return [];
    try {
      const cleaned = cleanForPlayer(algDraft);
      const out: TwistAction[] = [];
      for (const node of new Alg(cleaned).expand().childAlgNodes()) {
        if (node instanceof Move) out.push(new TwistAction(node.toString()));
      }
      return out;
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
  const cornerActions = useMemo<unknown[]>(
    () => (corner ? corner.parse(algDraft) : []),
    [corner, algDraft],
  );

  const totalSteps = isSq1
    ? sq1Actions.length
    : isIvy
      ? (ivyCanPlay ? ivyActions.length : 0)
      : corner
        ? cornerActions.length
        : actions.length;

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
        ? (setupDraft + ' ' + corner.toString(corner.invert(cornerActions))).trim()
        : setupDraft;
      cube.twister.setup(effSetup);
      const target = Math.max(0, Math.min(n, cornerActions.length));
      for (let i = 0; i < target; i++) cube.applyMoveInstant(cornerActions[i]);
      setStep(target);
      return;
    }
    const cube = world.cube as import('./engine/nxn/cube').default;
    const effectiveSetup = settings.playbackMode === 'algorithm'
      ? (setupDraft + ' ' + invertAlg(algDraft)).trim()
      : setupDraft;
    await cube.twister.setupAsync(effectiveSetup);
    const target = Math.max(0, Math.min(n, actions.length));
    for (let i = 0; i < target; i++) {
      cube.twister.twist(actions[i], true, true);
    }
    setStep(target);
  }, [world, setupDraft, algDraft, actions, sq1Actions, ivyActions, cornerActions, corner, isSq1, isIvy, ivyCanPlay, settings.playbackMode]);

  const skipAutoResetRef = useRef(false);
  const animatingScrambleRef = useRef(false);
  const scrambleReqIdRef = useRef(0);

  useEffect(() => {
    if (skipAutoResetRef.current) {
      skipAutoResetRef.current = false;
      setStep(isSq1 ? sq1Actions.length : isIvy ? ivyActions.length : corner ? cornerActions.length : actions.length);
      return;
    }
    if (animatingScrambleRef.current) {
      animatingScrambleRef.current = false;
      setStep(0);
      return;
    }
    jumpToStep(stepRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setupDraft, actions, sq1Actions, ivyActions, cornerActions, settings.playbackMode]);

  const handleCaretSync = useCallback((text: string, caretIndex: number) => {
    const before = text.slice(0, caretIndex);
    const algBefore = extractAlgFromText(before);
    if (isSq1) {
      jumpToStep(parseSq1Scramble(algBefore).length);
      return;
    }
    if (isIvy) {
      try { jumpToStep(parseIvyMoves(algBefore).length); } catch { /* ignore */ }
      return;
    }
    if (corner) {
      jumpToStep(corner.parse(algBefore).length);
      return;
    }
    try {
      let n = 0;
      for (const node of new Alg(algBefore).expand().childAlgNodes()) {
        if (node instanceof Move) n++;
      }
      jumpToStep(n);
    } catch { /* ignore */ }
  }, [jumpToStep, isSq1, isIvy, corner]);

  const stepForward = useCallback(() => { jumpToStep(step + 1); }, [jumpToStep, step]);
  const stepBack = useCallback(() => { jumpToStep(step - 1); }, [jumpToStep, step]);

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
    const total = isSq1 ? sq1Actions.length : isIvy ? ivyActions.length : corner ? cornerActions.length : actions.length;
    // 动画开关(设置面板「动画」):关 → 不逐步转动,瞬切到下一步。瞬切没有动画完成可等,
    // 故节拍由 interval 周期给:timing.frames 帧 @60fps ≈ 该步本应播放的时长,瞬切后等同节拍
    // (否则一帧就冲到底,看不到逐步)。开 → 16ms 高频轮询,按动画完成逐步推进(原行为)。
    const animatePlayback = settings.animatePlayback !== false;
    const stepDelayMs = Math.max(80, Math.round((timing.frames / 60) * 1000));
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
          (world.cube as unknown as CornerCube).applyMoveInstant(cornerActions[s]);
        } else {
          (world.cube as import('./engine/nxn/cube').default).twister.twist(actions[s], true, true);
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
        started = cube.twister.twist(cornerActions[s], false, false);
      } else {
        const cube = world.cube as import('./engine/nxn/cube').default;
        // NxN twist(force=false) returns true even for a same-axis/same-face turn
        // (it runs in parallel or cancel+restarts), so gate on the cube's own lock
        // state to keep playback strictly one-turn-at-a-time.
        if (cube.busy) return;
        started = cube.twister.twist(actions[s], false, false);
      }
      // Busy (previous turn still animating) → wait for the next poll, keep step.
      if (!started) return;
      stepRef.current = s + 1;
      setStep(s + 1);
    }, animatePlayback ? 16 : stepDelayMs);
    return () => {
      if (playTimerRef.current) { window.clearInterval(playTimerRef.current); playTimerRef.current = null; }
    };
  }, [playing, actions, sq1Actions, ivyActions, cornerActions, corner, world, speed, isSq1, isIvy, settings.animatePlayback, settings.speed]);

  const tool = (transform: (s: string) => string) => () => {
    const combined = (setupDraft + ' ' + algDraft).trim();
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
    if (corner) return corner.reduce(s);
    if (isTwistyMode) return simplifyTwistyAlg(s);
    // 逐层向量法同轴消步:吃掉一切等价写法并抽出整体转体(M' R → r、L' r → x、
    // L' 3r → x、R 2R L' 2L' → x …)。再跨轴最短化转体串(整 24 朝向),最后回炉一遍
    // 把 shortenRotations 可能造出的相邻同轴并掉。
    let r = collapseSameAxis(simplifyAlg(s), order);
    r = collapseSameAxis(shortenRotations(r), order);
    // 宽层输出统一小写记号(Rw→r、3Rw→3r、2-3Uw→2-3u);大小写两种写法输入都解析。
    return r.replace(/([RLUDFB])w/g, (_, c: string) => c.toLowerCase());
  }, [isSq1, isIvy, corner, isTwistyMode, sq1Format, order]);

  const invertForPuzzle = useCallback((s: string): string => {
    if (corner) return corner.toString(corner.invert(corner.parse(s)));
    if (!isSq1) return invertAlg(s);
    const inv = invertSq1Alg(s);
    return sq1Format === 'wca' ? canonicalSq1Alg(inv) : compactSq1Alg(inv);
  }, [isSq1, corner, sq1Format]);

  // Whether 消步 would actually shorten the sequence — drives the button's
  // enabled state so it doubles as a "可以消步" hint.
  const canSimplify = useMemo(() => {
    const combined = (setupDraft + ' ' + algDraft).trim();
    if (!combined) return false;
    const count = (s: string) => (isSq1 ? parseSq1Tokens(s).length : corner ? corner.parse(s).length : countMoves(s));
    return count(simplifyForPuzzle(combined)) < count(combined);
  }, [setupDraft, algDraft, isSq1, corner, simplifyForPuzzle]);

  // Copy the current page URL (puzzle + scramble + solution params) so the exact
  // sim state can be shared. Works for any puzzle — the URL always carries state.
  const copyTimerRef = useRef<number | null>(null);
  useEffect(() => () => { if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current); }, []);
  const handleCopyLink = useCallback(() => {
    if (typeof window === 'undefined' || !navigator.clipboard?.writeText) return;
    navigator.clipboard.writeText(window.location.href).then(() => {
      setLinkCopied(true);
      if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = window.setTimeout(() => setLinkCopied(false), 1500);
    }).catch(() => { /* clipboard denied */ });
  }, []);

  // Hand off the current scramble + solution to /recon/submit (matching event).
  const handlePublishRecon = useCallback(() => {
    if (!reconEvent) return;
    const qs = buildReconSubmitQuery(reconEvent, setupDraft, algDraft);
    router.push(`${langPrefix}/recon/submit?${qs}`);
  }, [reconEvent, setupDraft, algDraft, router, langPrefix]);

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
    onAlgChange(next);
  }, [onAlgChange, isSq1, isIvy, isTwistyMode, world, settings.liveReduce, simplifyForPuzzle]);

  useEffect(() => {
    if (!userMoveRef) return;
    userMoveRef.current = appendUserMove;
    return () => { userMoveRef.current = null; };
  }, [userMoveRef, appendUserMove]);

  // QWERTY: keymap → twist + append (no virtual keyboard, just hard keys).
  const applyMove = useCallback((k: KeyMove) => {
    if (isSq1 || isIvy || corner || isTwistyMode) return;
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
  }, [world, isSq1, isIvy, corner, isTwistyMode, onAlgChange, settings.animatePlayback]);

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
    const tw = world.cube.twister as unknown as { length: number; setup: (e: string) => void; push: (e: string) => void };
    // 动画仍在播时再次点播放键 = 直接跳到完整打乱态(走快速 WASM 整体应用,不从头重播,
    // 高阶 400+ 步宽转也是瞬时)。等价于解法框 focus 的跳过。
    if (tw.length > 0) { tw.setup(scramble); return; }
    // Animate from solved: reset the cube instantly, then queue the scramble moves
    // via push() (the engine's tweened playback — the same primitive the auto-animate
    // scramble uses). setupDraft is unchanged, so the setup-sync effect never fires
    // and won't snap the cube mid-animation — no animatingScrambleRef needed here.
    world.controller.clearFrozen();
    tw.setup('');
    tw.push(scramble);
  }, [setupDraft, isTwistyMode, world, onSetupChange, onAlgChange, twistyPlayerRef]);

  // 点解法框时,若打乱动画仍在逐步播放(高阶打乱可达 400+ 步 ≈ 分钟级),立即落到完整打乱态,
  // 让用户马上能在打乱好的魔方上输解法。走快速整体应用 setup(打乱文本):它清空待播队列后用
  // WASM 路径一次性重建,不逐步 replay,高阶宽转也不卡(逐步 finish 会几百万次 getColor 卡死)。
  const flushPendingScramble = useCallback(() => {
    if (!world || isTwistyMode) return;
    const tw = (world.cube as unknown as { twister?: { length: number; setup: (e: string) => void } }).twister;
    const scr = setupDraft.trim();
    if (tw && tw.length > 0 && scr) tw.setup(scr);
  }, [world, isTwistyMode, setupDraft]);

  // cubedb-style "反推打乱": invert + re-orient + solve the current solution to
  // recover the clean rotation-free scramble it solves, drop it into the
  // scramble box, and flip to forward (Moves) playback so the cube shows the
  // scramble and the solution plays forward to solve it.
  const handleDeriveScramble = useCallback(async () => {
    if (!is3x3 || !world || !algDraft.trim()) return;
    setDerivingScramble(true);
    try {
      const scramble = await deriveScrambleFromSolution(algDraft);
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
      </div>

      <div className="sim-player-row">
        <div className="sim-player-hlwrap">
          {ivyAlgSpans && (
            <div className="sim-player-hl" aria-hidden="true">
              {ivyAlgSpans.map((s, i) => (
                <span key={i} className={s.bad ? 'bad' : undefined}>{s.text}</span>
              ))}
            </div>
          )}
          <textarea
            ref={algElRef}
            defaultValue={algDraft}
            rows={1}
            spellCheck={false}
            className={ivyAlgSpans ? 'sim-player-input sim-player-input--hl' : 'sim-player-input'}
            placeholder={t('解法', 'Solution')}
            onFocus={flushPendingScramble}
            onInput={(e) => {
              const el = e.currentTarget;
              autosize(el);
              setAlgDraft(el.value);
              onAlgChange(el.value);
              handleCaretSync(el.value, el.selectionStart ?? 0);
            }}
            onClick={(e) => {
              const el = e.currentTarget;
              handleCaretSync(el.value, el.selectionStart ?? 0);
            }}
            onKeyUp={(e) => {
              const el = e.currentTarget;
              handleCaretSync(el.value, el.selectionStart ?? 0);
            }}
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

      {!isTwistyMode && (
      <div className="sim-player-row">
        <button onClick={() => jumpToStep(0)} title={t('回到起点', 'Reset')}><RotateCcw size={14} /></button>
        <button onClick={stepBack} disabled={step === 0} title={t('上一步', 'Step back')}><SkipBack size={14} /></button>
        <button
          onClick={async () => {
            if (playing) { setPlaying(false); return; }
            // 已在末尾时再点播放 = 从头重播:先把魔方复位到第 0 步(并同步 stepRef,
            // 否则播放轮询读到 step≥total 会立刻停),复位完成后再开播。
            if (step >= totalSteps) {
              await jumpToStep(0);
              stepRef.current = 0;
            }
            setPlaying(true);
          }}
          disabled={totalSteps === 0}
          title={playing ? t('暂停', 'Pause') : t('播放', 'Play')}
        >
          {playing ? <Pause size={14} /> : <Play size={14} />}
        </button>
        <button onClick={stepForward} disabled={step >= totalSteps} title={t('下一步', 'Step forward')}><SkipForward size={14} /></button>
        <span className="sim-player-progress">{step} / {totalSteps}</span>
        <select
          className="sim-player-mode"
          value={settings.playbackMode}
          onChange={(e) => onSettingsChange({ ...settings, playbackMode: e.target.value as 'moves' | 'algorithm' })}
          title={t('回放模式', 'Playback mode')}
        >
          <option value="moves">{t('正向', 'Moves')}</option>
          <option value="algorithm">{t('解还原', 'Algorithm')}</option>
        </select>
        <label className="sim-player-speed">
          <span>{speed.toFixed(2)}×</span>
          <input
            type="range"
            min={0.25}
            max={4}
            step={0.05}
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
          />
        </label>
      </div>
      )}

      <div className="sim-player-tools">
        <button onClick={tool(invertForPuzzle)} title={t('取逆', 'Invert')}><RotateCw size={13} />{t('逆', 'Invert')}</button>
        <button
          onClick={tool(simplifyForPuzzle)}
          disabled={!canSimplify}
          title={t('消步:合并 / 抵消重复转动', 'Reduce: cancel redundant moves')}
        >{t('消步', 'Reduce')}</button>
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
        {reconEvent && (
          <button
            onClick={handlePublishRecon}
            title={t('用当前打乱 / 解法去发布复盘', 'Take this scramble / solution to publish a reconstruction')}
          >
            <Upload size={13} />{t('发布复盘', 'Publish recon')}
          </button>
        )}
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
        onResetView={() => { if (world) resetWorldView(world, DEFAULT_SETTINGS); }}
        t={t}
        applyMove={applyMove}
        keymap={keymap}
        onKeymapChange={onKeymapChange}
        onResetKeymap={onResetKeymap}
      />
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
  label, children, action, trailing,
}: {
  label: string;
  children: ReactNode;
  action?: { label: string; title?: string; onClick: () => void };
  /** 色块右侧附加控件(如内核色行的「原核」开关)。 */
  trailing?: ReactNode;
}) {
  return (
    <div className="sim-color-row">
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

function PuzzleSettings({
  order, onOrderChange, puzzleKind, onPuzzleChange,
  renderer, onRendererChange,
  settings, onSettingsChange, onResetView, t,
  keymap, onKeymapChange, onResetKeymap,
}: {
  order: number;
  onOrderChange: (n: number) => void;
  puzzleKind: SimPuzzle;
  onPuzzleChange: (kind: SimPuzzle) => void;
  renderer: 'cubing' | 'engine' | 'group';
  onRendererChange?: (r: 'cubing' | 'engine' | 'group') => void;
  settings: SimSettings;
  onSettingsChange: (s: SimSettings) => void;
  /** 「恢复默认」附带的视角硬复位(整体朝向 / 平移 / 缩放),见 resetWorldView。 */
  onResetView: () => void;
  t: (zh: string, en: string) => string;
  applyMove: (m: KeyMove) => void;
  keymap: Record<string, KeyMove>;
  onKeymapChange: (km: Record<string, KeyMove>) => void;
  onResetKeymap: () => void;
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
  const isMirror = puzzleKind === 'mirror';
  const [keymapOpen, setKeymapOpen] = useState(false);

  const renderOrderSlot = useCallback((v: number) => (v >= 1 && v <= 400 ? String(v) : ''), []);
  const [orderDraft, setOrderDraft] = useState<string>(String(order));
  useEffect(() => { setOrderDraft(String(order)); }, [order]);

  const applyTimerRef = useRef<number | null>(null);
  const wheelRootRef = useRef<HTMLDivElement>(null);
  const cancelPendingApply = useCallback(() => {
    if (applyTimerRef.current != null) {
      window.clearTimeout(applyTimerRef.current);
      applyTimerRef.current = null;
    }
  }, []);
  const handleWheelChange = useCallback((n: number) => {
    cancelPendingApply();
    setOrderDraft(String(n));
  }, [cancelPendingApply]);
  const handleWheelSettle = useCallback((n: number) => {
    cancelPendingApply();
    applyTimerRef.current = window.setTimeout(() => {
      applyTimerRef.current = null;
      onOrderChange(n);
    }, 500);
  }, [cancelPendingApply, onOrderChange]);

  useEffect(() => {
    const el = wheelRootRef.current;
    if (!el) return;
    el.addEventListener('touchstart', cancelPendingApply, { passive: true });
    el.addEventListener('mousedown', cancelPendingApply);
    return () => {
      el.removeEventListener('touchstart', cancelPendingApply);
      el.removeEventListener('mousedown', cancelPendingApply);
    };
  }, [cancelPendingApply]);
  useEffect(() => () => cancelPendingApply(), [cancelPendingApply]);

  const commitOrderInput = () => {
    const raw = Number(orderDraft);
    if (!Number.isFinite(raw)) { setOrderDraft(String(order)); return; }
    const n = Math.max(1, Math.min(400, Math.floor(raw)));
    setOrderDraft(String(n));
    if (n !== order) {
      cancelPendingApply();
      onOrderChange(n);
    }
  };

  const set = <K extends keyof SimSettings>(key: K, value: SimSettings[K]) => {
    onSettingsChange({ ...settings, [key]: value });
  };

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

  return (
    <section className="sim-puzzle">
        <div className="sim-puzzle-body">
          <div className="sim-puzzle-row">
            <div className="sim-puzzle-section">
              <PuzzleTypeSelect
                value={typeof puzzleKind === 'number' ? 'nxn' : String(puzzleKind)}
                isZh={isZh}
                onChange={(v) => {
                  if (v === 'sq1' || v === 'ivy' || v === 'dino' || v === 'redi' || v === 'rex' || v === 'heli' || v === 'pyraminx' || v === 'skewb' || v === 'megaminx' || v === 'fto' || v === 'mirror' || v === 'custom') onPuzzleChange(v);
                  else if (isPgPuzzleId(v)) onPuzzleChange(v as PgPuzzleId);
                  else onPuzzleChange(order || 3);
                }}
              />
            </div>
            {isNxNLocal && (
              <div className="sim-puzzle-section">
                <div className="sim-puzzle-order-control" ref={wheelRootRef}>
                  <WheelPicker
                    value={order}
                    minValue={1}
                    maxValue={400}
                    renderSlot={renderOrderSlot}
                    onChange={handleWheelChange}
                    onSettle={handleWheelSettle}
                    width={72}
                    itemHeight={22}
                    slots={3}
                    ariaLabel={t('阶数', 'Order')}
                    className="sim-puzzle-order-wheel"
                  />
                  <input
                    type="number"
                    className="sim-puzzle-order-input"
                    min={1}
                    max={400}
                    step={1}
                    value={orderDraft}
                    onChange={(e) => setOrderDraft(e.target.value)}
                    onBlur={commitOrderInput}
                    onMouseDown={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                      else if (e.key === 'Escape') { setOrderDraft(String(order)); (e.target as HTMLInputElement).blur(); }
                    }}
                  />
                </div>
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
            <button
              type="button"
              className="sim-keymap-open-btn"
              onClick={() => setKeymapOpen(true)}
            >
              {t('键盘 / 鼠标快捷键', 'Keyboard / mouse shortcuts')}
            </button>
            <button
              type="button"
              className="sim-drawer-reset"
              onClick={() => { onSettingsChange(DEFAULT_SETTINGS); onResetView(); }}
            >
              {t('恢复默认', 'Reset to defaults')}
            </button>
          </div>

          <div className="sim-puzzle-sliders">
            <Slider label={t('灵敏度', 'Sensitivity')} value={settings.sensitivity} onChange={(v) => set('sensitivity', v)} />
            <Slider label={t('缩放', 'Scale')} value={settings.scale} onChange={(v) => set('scale', v)} />
            <Slider label={t('透视', 'Perspective')} value={settings.perspective} onChange={(v) => set('perspective', v)} />
            <Slider label={t('左右', 'Yaw')} value={settings.viewAngle} onChange={(v) => set('viewAngle', v)} />
            <Slider label={t('上下', 'Pitch')} value={settings.viewGradient} onChange={(v) => set('viewGradient', v)} />
            <Slider label={t('转动速度', 'Turn speed')} value={settings.speed} onChange={(v) => set('speed', v)} />
          </div>
          <div className="sim-puzzle-toggles">
            {/* 播放动画开关:关 → 「播放」时瞬切每一步(不逐格转动);单步前进/后退本就瞬切。 */}
            <Toggle label={t('动画', 'Animation')} value={settings.animatePlayback !== false} onChange={(v) => set('animatePlayback', v)} />
            {/* 方位字母常显:U/D/L/R/F/B(角/棱/面转拼图显对应标签),等同拖视角时浮现的标签但常驻。 */}
            <Toggle label={t('字母', 'Letters')} value={settings.faceLabels === true} onChange={(v) => set('faceLabels', v)} />
            {/* 实时消步:手势 / 键盘转动追加进解法框时自动抵消重复转动(R 后做 R' → 框里清空)。 */}
            {puzzleKind !== 'ivy' && <Toggle label={t('消步', 'Reduce')} value={settings.liveReduce !== false} onChange={(v) => set('liveReduce', v)} />}
            <label className="sim-toggle">
              <span>{t('拖空白', 'Drag empty')}</span>
              <select
                value={settings.dragEmpty}
                onChange={(e) => set('dragEmpty', e.target.value as 'orbit' | 'rotate' | 'view')}
              >
                <option value="rotate">{t('整步转体', 'Snap rotate')}</option>
                <option value="view">{t('视角', 'View')}</option>
                <option value="orbit">{t('自动转体', 'Auto rotate')}</option>
              </select>
            </label>
            {/* 背景:复用内核色那套弹出色块选择器(SwatchPopup),trigger 显当前背景,
                点开弹出 5 个可视色块(直接预览各档外观),整控件无文字。
                色值对齐 sim.css 里 .sim-canvas-wrap 的固定背景。 */}
            <div className="sim-toggle sim-bg-toggle">
              <Wallpaper size={15} className="sim-bg-icon" aria-hidden="true" />
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
            </div>
            {/* 顶面 U 中心 logo:无 / 网站 / 自定义上传。仅 NxN 奇数阶有正中心块时实际显示
                (偶数阶 / 非 NxN 引擎里 setLogo 自动隐藏)。选「自定义」开文件选择器。 */}
            <label className="sim-toggle">
              <span>logo</span>
              <select
                value={settings.logo}
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
            <Toggle label={t('锁定大小位置', 'Lock size & position')} value={settings.lockView} onChange={(v) => set('lockView', v)} />
            <Toggle label={t('小窗', 'Mini view')} value={settings.backView} onChange={(v) => set('backView', v)} />
            {/* The panel is kept identical across every puzzle by request: 立体贴片 / 镂空 are
                in-house-engine features and no-op on cubing.js-rendered puzzles (the setting is
                just stored, applySettings only drives them where the engine exists), but they
                always render so the control surface never changes shape per puzzle. */}
            <Toggle label={t('立体贴片', 'Sticker thickness')} value={settings.thickness} onChange={(v) => set('thickness', v)} />
            <Toggle label={t('镂空', 'Hollow')} value={settings.hollow} onChange={(v) => set('hollow', v)} />
            <Toggle label={t('提示贴片', 'Hint facelets')} value={settings.hint} onChange={(v) => set('hint', v)} />
            {/* 箭头贴片仅 NxN 引擎生效(cube.arrow),非 NxN 拼图无此属性 → 仅 NxN 显示。
                用户指定的唯一例外。 */}
            {isNxNLocal && (
              <Toggle label={t('箭头', 'Arrows')} value={settings.arrow} onChange={(v) => set('arrow', v)} />
            )}
          </div>
          {/* 调试控件单独成行(用户要求):半转停 / 结构着色 / 挖块。组前缀「调试」标一次,各控件
              去掉重复的「调试:」前缀。半转停 / 结构着色 为本站引擎特性,在 cubing.js 渲染的拼图上
              为 no-op(仅存设置);挖块为统一三选一占位(见 applySettings)。 */}
          <div className="sim-puzzle-debug">
            <div className="sim-puzzle-section-title">{t('调试', 'Debug')}</div>
            <div className="sim-puzzle-debug-toggles">
              <Toggle label={t('半转停', 'Hold partial turn')} value={settings.holdPartialTurn} onChange={(v) => set('holdPartialTurn', v)} />
              <Toggle label={t('结构着色', 'Structure colors')} value={settings.debugStructureColor} onChange={(v) => set('debugStructureColor', v)} />
              <label className="sim-toggle">
                <span>{t('挖块', 'Carve')}</span>
                <select
                  value={settings.debugCarve}
                  onChange={(e) => set('debugCarve', e.target.value as SimSettings['debugCarve'])}
                >
                  <option value="off">{t('关', 'Off')}</option>
                  <option value="corner">{t('挖角', 'Corner')}</option>
                  <option value="face">{t('挖面', 'Face')}</option>
                  <option value="edge">{t('挖棱', 'Edge')}</option>
                </select>
              </label>
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
          <ColorRow label={t('内核色', 'Core color')}>
            <ModeColorSelect
              special={settings.coreStyle === 'raw'}
              color={settings.coreColor}
              presets={CORE_COLOR_PRESETS}
              specialTitle={t('原核', 'Raw body')}
              specialSwatchClass="sim-swatch-raw-box"
              onPickColor={(c) => onSettingsChange({ ...settings, coreStyle: 'normal', coreColor: c })}
              onPickSpecial={() => set('coreStyle', 'raw')}
              title={t('内核色', 'Core color')}
              t={t}
            />
          </ColorRow>
          <ColorRow
            label={t('面色', 'Face colors')}
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
        </div>
      <KeymapModal
        open={keymapOpen}
        onClose={() => setKeymapOpen(false)}
        keymap={keymap}
        onKeymapChange={onKeymapChange}
        onResetKeymap={onResetKeymap}
      />
    </section>
  );
}

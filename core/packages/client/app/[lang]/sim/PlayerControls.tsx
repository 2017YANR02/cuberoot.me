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
  FlipHorizontal2, FlipVertical2, Eraser, Sparkles, RotateCw,
  Settings, ChevronRight, Shuffle, Link2, Check, Upload,
  Search, Loader2,
} from 'lucide-react';
import { Alg, Move } from 'cubing/alg';
import World from './cuber/world';
import { TwistAction } from './cuber/twister';
import CubeGroup from './cuber/group';
import { parseSq1Scramble, movesToString, type Sq1Move } from './cuber/sq1/sq1State';
import { parseIvyMoves } from './cuber/ivy/IvyTwister';
import type { IvyMove } from './cuber/ivy/IvyCube';
import { classifyIvyTokens } from '@/lib/ivy-solver';
import {
  parseDinoMoves, dinoMovesToString, randomDinoScramble, type DinoMove,
} from './cuber/dino/dinoState';

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
import { cleanForPlayer, extractAlgFromText } from '@/lib/recon-alg-utils';
import { deriveScrambleFromSolution } from '@/lib/scramble-from-solution';
import { tnoodleRandomScramble } from '@/lib/cubing-scramble';
import {
  formatScrambleForEvent, canonicalSq1Alg, compactSq1Alg,
  simplifySq1Alg, invertSq1Alg, parseSq1Tokens,
} from '@/lib/sq1-svg';
import type { SkewbNotation } from '@cuberoot/shared/skewb-notation';
import {
  Slider, Toggle, KeymapModal,
  DEFAULT_SETTINGS, DEFAULT_FACE_COLORS,
  type SimSettings,
} from './SettingDrawer';
import { type KeyMove } from './keymap';
import { reconEventForSim, buildReconSubmitQuery } from '@/lib/sim-recon-link';
import { WheelPicker } from '@/components/WheelPicker';
import { CubingIcon } from '@/components/EventIcon/EventIcon';
import './player-controls.css';
import i18n from '@/i18n/i18n-client';

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

const PUZZLE_TYPE_OPTIONS = [
  { value: 'nxn',      iconClass: 'event-333', labelZh: 'NxN',    labelEn: 'NxN' },
  { value: 'sq1',      iconClass: 'event-sq1', labelZh: 'Square-1', labelEn: 'Square-1' },
  { value: 'ivy',      iconClass: 'unofficial-ivy', labelZh: '枫叶魔方', labelEn: 'Ivy Cube' },
  { value: 'pyraminx', iconClass: 'event-pyram', labelZh: '金字塔', labelEn: 'Pyraminx' },
  { value: 'skewb',    iconClass: 'event-skewb', labelZh: '斜转',  labelEn: 'Skewb'
},
  { value: 'megaminx', iconClass: 'event-minx',  labelZh: '五魔',  labelEn: 'Megaminx' },
  { value: 'dino',     iconClass: 'unofficial-dino', labelZh: '恐龙', labelEn: 'Dino' },
] as const;

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

  const current = PUZZLE_TYPE_OPTIONS.find(o => o.value === value) ?? PUZZLE_TYPE_OPTIONS[0];

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
          {PUZZLE_TYPE_OPTIONS.map(o => (
            <button
              key={o.value}
              type="button"
              title={isZh ? o.labelZh : o.labelEn}
              className={`sim-puzzle-type-item${o.value === value ? ' sim-puzzle-type-item--active' : ''}`}
              onClick={() => { onChange(o.value); setOpen(false); }}
            >
              <CubingIcon icon={o.iconClass} className="sim-puzzle-type-icon" />
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
export type SimPuzzle = number | 'sq1' | 'ivy' | 'dino' | 'pyraminx' | 'skewb' | 'megaminx';

function isTwistyPuzzle(p: SimPuzzle): p is 'pyraminx' | 'skewb' | 'megaminx' {
  return p === 'pyraminx' || p === 'skewb' || p === 'megaminx';
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
}

export default function PlayerControls({
  world, alg, setup, onAlgChange, onSetupChange,
  order, onOrderChange, puzzleKind, onPuzzleChange,
  settings, onSettingsChange,
  keymap, onKeymapChange, onResetKeymap,
  userMoveRef, twistyPlayerRef,
  skewbNotation, onSkewbNotationChange,
}: Props) {
  const isSq1 = puzzleKind === 'sq1';
  const isIvy = puzzleKind === 'ivy';
  const isDino = puzzleKind === 'dino';
  const isTwistyMode = isTwistyPuzzle(puzzleKind);
  // "Derive scramble from solution" (cubedb-style) is 3x3-only — the solver is.
  const is3x3 = !isSq1 && !isIvy && !isDino && !isTwistyMode && order === 3;
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const t = (zh: string, en: string) => (isZh ? zh : en);

  const router = useRouter();
  const params = useParams<{ lang?: string }>();
  const langPrefix = params?.lang === 'zh' || params?.lang === 'en'
    ? `/${params.lang}` : ((i18n.language.startsWith('zh') ? '/zh' : '/en'));
  const reconEvent = reconEventForSim(puzzleKind);

  const [algDraft, setAlgDraft] = useState(alg);
  const [setupDraft, setSetupDraft] = useState(setup ?? '');
  const [sq1Format, setSq1Format] = useState<'compact' | 'wca'>('compact');
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [linkCopied, setLinkCopied] = useState(false);
  const [derivingScramble, setDerivingScramble] = useState(false);

  useEffect(() => {
    CubeGroup.frames = Math.max(2, Math.round(30 / speed));
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
    if (isSq1 || isIvy || isDino) return [];
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
  }, [algDraft, isSq1, isIvy, isDino]);

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

  const dinoActions = useMemo<DinoMove[]>(() => {
    if (!isDino) return [];
    return parseDinoMoves(algDraft);
  }, [algDraft, isDino]);

  const totalSteps = isSq1
    ? sq1Actions.length
    : isIvy
      ? (ivyCanPlay ? ivyActions.length : 0)
      : isDino
        ? dinoActions.length
        : actions.length;

  const jumpToStep = useCallback(async (n: number) => {
    if (!world) return;
    // Release any held-partial (debug) turn first: an NxN frozen layer holds the
    // cube lock, which would make the replay's group.twist below spin forever.
    world.controller.clearFrozen();
    if (isSq1) {
      const sq1Cube = world.cube as unknown as import('./cuber/sq1/Sq1Cube').default;
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
      const ivyCube = world.cube as unknown as import('./cuber/ivy/IvyCube').default;
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
    if (isDino) {
      const dinoCube = world.cube as unknown as import('./cuber/dino/DinoCube').default;
      dinoCube.twister.finish();
      const effSetup = settings.playbackMode === 'algorithm'
        ? (setupDraft + ' ' + dinoMovesToString(invertDinoMoves(dinoActions))).trim()
        : setupDraft;
      dinoCube.twister.setup(effSetup);
      const target = Math.max(0, Math.min(n, dinoActions.length));
      for (let i = 0; i < target; i++) dinoCube.applyMoveInstant(dinoActions[i]);
      setStep(target);
      return;
    }
    const cube = world.cube as import('./cuber/cube').default;
    const effectiveSetup = settings.playbackMode === 'algorithm'
      ? (setupDraft + ' ' + invertAlg(algDraft)).trim()
      : setupDraft;
    await cube.twister.setupAsync(effectiveSetup);
    const target = Math.max(0, Math.min(n, actions.length));
    for (let i = 0; i < target; i++) {
      cube.twister.twist(actions[i], true, true);
    }
    setStep(target);
  }, [world, setupDraft, algDraft, actions, sq1Actions, ivyActions, dinoActions, isSq1, isIvy, isDino, ivyCanPlay, settings.playbackMode]);

  const skipAutoResetRef = useRef(false);
  const animatingScrambleRef = useRef(false);
  const scrambleReqIdRef = useRef(0);

  useEffect(() => {
    if (skipAutoResetRef.current) {
      skipAutoResetRef.current = false;
      setStep(isSq1 ? sq1Actions.length : isIvy ? ivyActions.length : isDino ? dinoActions.length : actions.length);
      return;
    }
    if (animatingScrambleRef.current) {
      animatingScrambleRef.current = false;
      setStep(0);
      return;
    }
    jumpToStep(stepRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setupDraft, actions, sq1Actions, ivyActions, dinoActions, settings.playbackMode]);

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
    if (isDino) {
      jumpToStep(parseDinoMoves(algBefore).length);
      return;
    }
    try {
      let n = 0;
      for (const node of new Alg(algBefore).expand().childAlgNodes()) {
        if (node instanceof Move) n++;
      }
      jumpToStep(n);
    } catch { /* ignore */ }
  }, [jumpToStep, isSq1, isIvy, isDino]);

  const stepForward = useCallback(() => { jumpToStep(step + 1); }, [jumpToStep, step]);
  const stepBack = useCallback(() => { jumpToStep(step - 1); }, [jumpToStep, step]);

  useEffect(() => {
    if (!playing) {
      if (playTimerRef.current) { window.clearInterval(playTimerRef.current); playTimerRef.current = null; }
      return;
    }
    const intervalMs = Math.max(60, Math.round(600 / speed));
    const total = isSq1 ? sq1Actions.length : isIvy ? ivyActions.length : isDino ? dinoActions.length : actions.length;
    playTimerRef.current = window.setInterval(() => {
      const s = stepRef.current;
      if (s >= total) { setPlaying(false); return; }
      if (world) {
        if (isSq1) {
          const sq1Cube = world.cube as unknown as import('./cuber/sq1/Sq1Cube').default;
          sq1Cube.twister.twist(sq1Actions[s], false, true);
        } else if (isIvy) {
          const ivyCube = world.cube as unknown as import('./cuber/ivy/IvyCube').default;
          ivyCube.twister.twist(ivyActions[s], false, true);
        } else if (isDino) {
          const dinoCube = world.cube as unknown as import('./cuber/dino/DinoCube').default;
          dinoCube.twister.twist(dinoActions[s], false, true);
        } else {
          const cube = world.cube as import('./cuber/cube').default;
          cube.twister.twist(actions[s], false, true);
        }
      }
      stepRef.current = s + 1;
      setStep(s + 1);
    }, intervalMs);
    return () => {
      if (playTimerRef.current) { window.clearInterval(playTimerRef.current); playTimerRef.current = null; }
    };
  }, [playing, actions, sq1Actions, ivyActions, dinoActions, world, speed, isSq1, isIvy, isDino]);

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
  // model; pyraminx/skewb/megaminx can't use the cube's mod-4 fold. Dino: only
  // collapse a token immediately followed by its inverse (and X X = X', X X X = id)
  // would need a full reducer — keep it simple, just drop trivially-cancelling pairs.
  const simplifyForPuzzle = useCallback((s: string): string => {
    if (isSq1) return simplifySq1Alg(s, sq1Format);
    if (isIvy) return s; // ivy R R = R' (not R2) — NxN fold doesn't apply
    if (isDino) return reduceDinoAlg(s);
    if (isTwistyMode) return simplifyTwistyAlg(s);
    return simplifyAlg(s);
  }, [isSq1, isIvy, isDino, isTwistyMode, sq1Format]);

  const invertForPuzzle = useCallback((s: string): string => {
    if (isDino) return dinoMovesToString(invertDinoMoves(parseDinoMoves(s)));
    if (!isSq1) return invertAlg(s);
    const inv = invertSq1Alg(s);
    return sq1Format === 'wca' ? canonicalSq1Alg(inv) : compactSq1Alg(inv);
  }, [isSq1, isDino, sq1Format]);

  // Whether 消步 would actually shorten the sequence — drives the button's
  // enabled state so it doubles as a "可以消步" hint.
  const canSimplify = useMemo(() => {
    const combined = (setupDraft + ' ' + algDraft).trim();
    if (!combined) return false;
    const count = (s: string) => (isSq1 ? parseSq1Tokens(s).length : isDino ? parseDinoMoves(s).length : countMoves(s));
    return count(simplifyForPuzzle(combined)) < count(combined);
  }, [setupDraft, algDraft, isSq1, isDino, simplifyForPuzzle]);

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
    const next = current.trimEnd() + sep + moveText + ' ';
    algEl.value = next;
    algEl.selectionStart = algEl.selectionEnd = next.length;
    autosize(algEl);
    skipAutoResetRef.current = true;
    setAlgDraft(next);
    onAlgChange(next);
  }, [onAlgChange, isSq1, isTwistyMode, world]);

  useEffect(() => {
    if (!userMoveRef) return;
    userMoveRef.current = appendUserMove;
    return () => { userMoveRef.current = null; };
  }, [userMoveRef, appendUserMove]);

  // QWERTY: keymap → twist + append (no virtual keyboard, just hard keys).
  const applyMove = useCallback((k: KeyMove) => {
    if (isSq1 || isIvy || isDino || isTwistyMode) return;
    let action: TwistAction | null = new TwistAction(k.sign, !!k.reverse, 1);
    let moveText = action.value;
    if (world && world.cube.order === 1) {
      action = normalizeTo1x1(action);
      if (!action) return;
      moveText = action.value;
    }
    if (world) {
      const cube = world.cube as import('./cuber/cube').default;
      cube.twister.twist(action, false, true);
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
  }, [world, isSq1, isIvy, isDino, isTwistyMode, onAlgChange]);

  const handleScramble = useCallback(async () => {
    const reqId = ++scrambleReqIdRef.current;
    // Twisty puzzles (pyraminx/skewb/megaminx) — no cuber world. Route to
    // tnoodleRandomScramble (cubing.js + pool). animateScramble=false writes
    // setup (instant baseline); true clears setup, sets alg, and drives the
    // TwistyPlayer to jumpToStart + play.
    if (isTwistyMode) {
      let twistyScramble = '';
      try {
        twistyScramble = (await tnoodleRandomScramble(puzzleKind as string)) ?? '';
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
      } else if (isDino) {
        // No external generator — Dino is a self-contained sim. A random sequence
        // of legal corner twists is a valid scramble (no solver needed).
        scramble = dinoMovesToString(randomDinoScramble(15));
      } else if (order >= 2 && order <= 7) {
        const eventId = `${order}${order}${order}`;
        scramble = await tnoodleRandomScramble(eventId);
      } else {
        scramble = randomMoveScrambleNxN(order);
      }
    } catch (err) {
      console.warn('[sim] scramble failed:', err);
      scramble = isSq1 ? '' : isIvy ? randomIvyScramble() : isDino ? '' : randomMoveScrambleNxN(order);
    }
    if (reqId !== scrambleReqIdRef.current) return;
    if (!scramble) return;
    world.controller.clearFrozen(); // release any debug held-partial turn first
    // SQ1 / Ivy / Dino always animate — instant apply would be visually
    // indistinguishable from no rotation. The animation is the whole point.
    const animate = isSq1 || isIvy || isDino || settings.animateScramble;
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
  }, [world, order, isSq1, isIvy, isDino, isTwistyMode, puzzleKind, settings.animateScramble, onSetupChange, onAlgChange, twistyPlayerRef]);

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
        <button
          type="button"
          className="sim-player-scramble"
          onClick={handleScramble}
          title={t('随机打乱', 'Random scramble')}
          aria-label={t('随机打乱', 'Random scramble')}
        >
          <Shuffle size={14} />
        </button>
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
          onClick={() => setPlaying((p) => !p)}
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
        ><Sparkles size={13} />{t('消步', 'Reduce')}</button>
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
        settings={settings}
        onSettingsChange={onSettingsChange}
        t={t}
        applyMove={applyMove}
        keymap={keymap}
        onKeymapChange={onKeymapChange}
        onResetKeymap={onResetKeymap}
      />
    </div>
  );
}

const CORE_COLOR_PRESETS: string[] = [
  '#202020', '#EE0000', '#FFA100', '#FFFFFF', '#FEFE00', '#00D800', '#0000F2',
];

const FACE_ORDER = ['U', 'L', 'F', 'R', 'B', 'D'] as const;
const FACE_LABELS_ZH: Record<typeof FACE_ORDER[number], string> = {
  U: '顶', D: '底', L: '左', R: '右', F: '前', B: '后',
};

function SwatchCell({
  color, label, title, active, onPick, onClick,
}: {
  color: string;
  label?: string;
  title?: string;
  active?: boolean;
  onPick?: (c: string) => void;
  onClick?: () => void;
}) {
  const labelEl = label ? <span className="sim-swatch-label">{label}</span> : null;
  const boxEl = <span className="sim-swatch-box" style={{ background: color }} />;
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

function ColorRow({
  label, children, action,
}: {
  label: string;
  children: ReactNode;
  action?: { label: string; title?: string; onClick: () => void };
}) {
  return (
    <div className="sim-color-row">
      <span className="sim-color-row-label">{label}</span>
      <div className="sim-swatch-list">{children}</div>
      {action && (
        <button type="button" className="sim-face-color-reset" onClick={action.onClick} title={action.title}>
          {action.label}
        </button>
      )}
    </div>
  );
}

const STYLE_PRESETS: { id: string; zh: string; en: string; s: Pick<SimSettings, 'thickness' | 'hollow' | 'arrow' | 'hint'>
 }[] = [
  { id: 'std', zh: '标准', en: 'Standard', s: { thickness: true, hollow: false, arrow: false, hint: false }
},
  { id: 'hollow', zh: '镂空', en: 'Hollow', s: { thickness: true, hollow: true, arrow: false, hint: false }
},
  { id: 'hint', zh: '提示', en: 'Hint', s: { thickness: true, hollow: false, arrow: false, hint: true } },
  { id: 'arrow', zh: '箭头', en: 'Arrows', s: { thickness: true, hollow: false, arrow: true, hint: false }
},
  { id: 'flat', zh: '平面', en: 'Flat', s: { thickness: false, hollow: false, arrow: false, hint: false } },
];

function PuzzleSettings({
  order, onOrderChange, puzzleKind, onPuzzleChange,
  settings, onSettingsChange, t,
  applyMove, keymap, onKeymapChange, onResetKeymap,
}: {
  order: number;
  onOrderChange: (n: number) => void;
  puzzleKind: SimPuzzle;
  onPuzzleChange: (kind: SimPuzzle) => void;
  settings: SimSettings;
  onSettingsChange: (s: SimSettings) => void;
  t: (zh: string, en: string) => string;
  applyMove: (m: KeyMove) => void;
  keymap: Record<string, KeyMove>;
  onKeymapChange: (km: Record<string, KeyMove>) => void;
  onResetKeymap: () => void;
}) {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const isSq1Local = puzzleKind === 'sq1';
  const isIvyLocal = puzzleKind === 'ivy';
  const isDinoLocal = puzzleKind === 'dino';
  const isTwistyLocal = isTwistyPuzzle(puzzleKind);
  const isNxNLocal = !isSq1Local && !isIvyLocal && !isDinoLocal && !isTwistyLocal;
  const [open, setOpen] = useState(true);
  const [keymapOpen, setKeymapOpen] = useState(false);

  const activePreset = STYLE_PRESETS.find(
    (p) => p.s.thickness === settings.thickness && p.s.hollow === settings.hollow
      && p.s.arrow === settings.arrow && p.s.hint === settings.hint,
  )?.id ?? '';

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

  return (
    <section className="sim-puzzle">
      <button
        type="button"
        className="sim-puzzle-head"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={t('魔方设置', 'Puzzle Settings')}
        title={t('魔方设置', 'Puzzle Settings')}
      >
        <ChevronRight size={14} className={'sim-puzzle-caret' + (open ? ' open' : '')} />
        <Settings size={14} />
      </button>
      {open && (
        <div className="sim-puzzle-body">
          <div className="sim-puzzle-row">
            <div className="sim-puzzle-section">
              <div className="sim-puzzle-section-title">{t('类型', 'Puzzle')}</div>
              <PuzzleTypeSelect
                value={isTwistyLocal ? (puzzleKind as string) : isSq1Local ? 'sq1' : isIvyLocal ? 'ivy' : isDinoLocal ? 'dino' : 'nxn'}
                isZh={isZh}
                onChange={(v) => {
                  if (v === 'sq1' || v === 'ivy' || v === 'dino' || v === 'pyraminx' || v === 'skewb' || v === 'megaminx') onPuzzleChange(v);
                  else onPuzzleChange(order || 3);
                }}
              />
            </div>
            {isNxNLocal && (
              <div className="sim-puzzle-section">
                <div className="sim-puzzle-section-title">{t('阶数', 'Order')}</div>
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
            {isNxNLocal && (
              <div className="sim-puzzle-section">
                <div className="sim-puzzle-section-title">{t('视觉风格', 'Style')}</div>
                <select
                  className="sim-puzzle-select"
                  value={activePreset}
                  onChange={(e) => {
                    const p = STYLE_PRESETS.find((x) => x.id === e.target.value);
                    if (p) onSettingsChange({ ...settings, ...p.s });
                  }}
                >
                  {activePreset === '' && <option value="">{t('自定义', 'Custom')}</option>}
                  {STYLE_PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>{t(p.zh, p.en)}</option>
                  ))}
                </select>
              </div>
            )}
            {isNxNLocal && (
              <div className="sim-puzzle-section">
                <div className="sim-puzzle-section-title">{t('视图', 'View')}</div>
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
              onClick={() => onSettingsChange(DEFAULT_SETTINGS)}
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
            <label className="sim-toggle">
              <span>{t('拖空白', 'Drag empty')}</span>
              <select
                value={settings.dragEmpty}
                onChange={(e) => set('dragEmpty', e.target.value as 'orbit' | 'rotate' | 'view')}
              >
                <option value="view">{t('视角', 'View')}</option>
                <option value="orbit">{t('自动转体', 'Auto rotate')}</option>
                <option value="rotate">{t('整步转体', 'Snap rotate')}</option>
              </select>
            </label>
            <Toggle label={t('动画展示打乱', 'Animate scramble')} value={settings.animateScramble} onChange={(v) => set('animateScramble', v)} />
            <Toggle label={t('棋盘格背景', 'Checkered background')} value={settings.checkeredBg} onChange={(v) => set('checkeredBg', v)} />
            <Toggle label={t('锁定大小位置', 'Lock size & position')} value={settings.lockView} onChange={(v) => set('lockView', v)} />
            <Toggle label={t('背面视图', 'Back view')} value={settings.backView} onChange={(v) => set('backView', v)} />
            <Toggle label={t('立体贴片', 'Sticker thickness')} value={settings.thickness} onChange={(v) => set('thickness', v)} />
            <Toggle label={t('镂空', 'Hollow')} value={settings.hollow} onChange={(v) => set('hollow', v)} />
            <Toggle label={t('箭头', 'Arrows')} value={settings.arrow} onChange={(v) => set('arrow', v)} />
            <Toggle label={t('提示贴片 (背面)', 'Hint facelets (back faces)')} value={settings.hint} onChange={(v) => set('hint', v)} />
            {!isTwistyLocal && (
              <Toggle
                label={t('调试:半转停住', 'Debug: hold partial turn')}
                value={settings.holdPartialTurn}
                onChange={(v) => set('holdPartialTurn', v)}
              />
            )}
            {!isTwistyLocal && (
              <Toggle
                label={t('调试:结构着色', 'Debug: structure colors')}
                value={settings.debugStructureColor}
                onChange={(v) => set('debugStructureColor', v)}
              />
            )}
            {(isIvyLocal || isDinoLocal) && (
              <Toggle
                label={t('调试:挖角', 'Debug: carve corner')}
                value={settings.debugCarveCorner}
                onChange={(v) => set('debugCarveCorner', v)}
              />
            )}
          </div>
          <ColorRow label={t('内核色', 'Core color')}>
            <SwatchCell
              color={settings.coreColor}
              title={t('自定义', 'Custom')}
              onPick={(c) => set('coreColor', c)}
            />
            {CORE_COLOR_PRESETS.map((c) => (
              <SwatchCell
                key={c}
                color={c}
                title={c}
                active={c.toLowerCase() === settings.coreColor.toLowerCase()}
                onClick={() => set('coreColor', c)}
              />
            ))}
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
              <SwatchCell
                key={f}
                color={settings.faceColors[f]}
                label={f}
                title={t(FACE_LABELS_ZH[f], f)}
                onPick={(c) => set('faceColors', { ...settings.faceColors, [f]: c })}
              />
            ))}
          </ColorRow>
        </div>
      )}
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

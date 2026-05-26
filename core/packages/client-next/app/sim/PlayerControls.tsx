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
 *  - No twisty puzzles (pyraminx/skewb/megaminx) — TwistySection isn't ported.
 *    PuzzleSettings hides the picker entries; only NxN + SQ1 are selectable.
 *  - tnoodleRandomScramble is replaced by direct cubing.js + RandomMoveNxN
 *    inline (no cstimer_444 worker pool, no 555 server, no m2p WASM).
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
import {
  Play, Pause, SkipBack, SkipForward, RotateCcw,
  FlipHorizontal2, FlipVertical2, Eraser, Sparkles, RotateCw,
  Settings, ChevronRight, Shuffle,
} from 'lucide-react';
import { Alg, Move } from 'cubing/alg';
import World from './cuber/world';
import { TwistAction } from './cuber/twister';
import CubeGroup from './cuber/group';
import { parseSq1Scramble, movesToString, type Sq1Move } from './cuber/sq1/sq1State';
import { invertAlg, simplifyAlg, mirrorAlg } from '@/lib/cube3';
import { cleanForPlayer, extractAlgFromText } from '@/lib/recon-alg-utils';
import {
  Slider, Toggle, KeymapModal,
  DEFAULT_SETTINGS, DEFAULT_FACE_COLORS,
  type SimSettings,
} from './SettingDrawer';
import { type KeyMove } from './keymap';
import { WheelPicker } from '@/components/WheelPicker';
import './player-controls.css';

/** Random-move NxN scrambler — inlined from utils/cubingScramble.ts so we don't
 *  pull in the cstimer_444 / scramble_555_server / m2p WASM chain.  */
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

async function wcaRandomScramble(eventId: string): Promise<string> {
  const { randomScrambleForEvent } = await import('cubing/scramble');
  const a = await randomScrambleForEvent(eventId);
  return a.toString();
}

/** SimPage puzzle kind. */
export type SimPuzzle = number | 'sq1';

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

function normalizeTo1x1(action: TwistAction): TwistAction | null {
  const s = action.sign;
  if (s === 'x' || s === 'y' || s === 'z') return action;
  const bare = s.endsWith('w') ? s.slice(0, -1).toUpperCase() : s;
  if (SAME_AXIS_1X1[bare]) return new TwistAction(SAME_AXIS_1X1[bare], action.reverse, action.times);
  if (OPP_AXIS_1X1[bare]) return new TwistAction(OPP_AXIS_1X1[bare], !action.reverse, action.times);
  return null;
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
}

export default function PlayerControls({
  world, alg, setup, onAlgChange, onSetupChange,
  order, onOrderChange, puzzleKind, onPuzzleChange,
  settings, onSettingsChange,
  keymap, onKeymapChange, onResetKeymap,
  userMoveRef,
}: Props) {
  const isSq1 = puzzleKind === 'sq1';
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const t = (zh: string, en: string) => (isZh ? zh : en);

  const [algDraft, setAlgDraft] = useState(alg);
  const [setupDraft, setSetupDraft] = useState(setup ?? '');
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

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

  const actions = useMemo<TwistAction[]>(() => {
    if (isSq1) return [];
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
  }, [algDraft, isSq1]);

  const sq1Actions = useMemo<Sq1Move[]>(() => {
    if (!isSq1) return [];
    return parseSq1Scramble(algDraft);
  }, [algDraft, isSq1]);

  const totalSteps = isSq1 ? sq1Actions.length : actions.length;

  const jumpToStep = useCallback(async (n: number) => {
    if (!world) return;
    if (isSq1) {
      const sq1Cube = world.cube as unknown as import('./cuber/sq1/Sq1Cube').default;
      sq1Cube.twister.finish();
      const effSetup = settings.playbackMode === 'algorithm'
        ? (setupDraft + ' ' + movesToString(invertSq1Moves(sq1Actions))).trim()
        : setupDraft;
      sq1Cube.twister.setup(effSetup);
      const target = Math.max(0, Math.min(n, sq1Actions.length));
      sq1Cube.applyMovesInstant(sq1Actions.slice(0, target));
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
  }, [world, setupDraft, algDraft, actions, sq1Actions, isSq1, settings.playbackMode]);

  const skipAutoResetRef = useRef(false);
  const animatingScrambleRef = useRef(false);
  const scrambleReqIdRef = useRef(0);

  useEffect(() => {
    if (skipAutoResetRef.current) {
      skipAutoResetRef.current = false;
      setStep(isSq1 ? sq1Actions.length : actions.length);
      return;
    }
    if (animatingScrambleRef.current) {
      animatingScrambleRef.current = false;
      setStep(0);
      return;
    }
    jumpToStep(stepRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setupDraft, actions, sq1Actions, settings.playbackMode]);

  const handleCaretSync = useCallback((text: string, caretIndex: number) => {
    const before = text.slice(0, caretIndex);
    const algBefore = extractAlgFromText(before);
    if (isSq1) {
      jumpToStep(parseSq1Scramble(algBefore).length);
      return;
    }
    try {
      let n = 0;
      for (const node of new Alg(algBefore).expand().childAlgNodes()) {
        if (node instanceof Move) n++;
      }
      jumpToStep(n);
    } catch { /* ignore */ }
  }, [jumpToStep, isSq1]);

  const stepForward = useCallback(() => { jumpToStep(step + 1); }, [jumpToStep, step]);
  const stepBack = useCallback(() => { jumpToStep(step - 1); }, [jumpToStep, step]);

  useEffect(() => {
    if (!playing) {
      if (playTimerRef.current) { window.clearInterval(playTimerRef.current); playTimerRef.current = null; }
      return;
    }
    const intervalMs = Math.max(60, Math.round(600 / speed));
    const total = isSq1 ? sq1Actions.length : actions.length;
    playTimerRef.current = window.setInterval(() => {
      const s = stepRef.current;
      if (s >= total) { setPlaying(false); return; }
      if (world) {
        if (isSq1) {
          const sq1Cube = world.cube as unknown as import('./cuber/sq1/Sq1Cube').default;
          sq1Cube.twister.twist(sq1Actions[s], false, true);
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
  }, [playing, actions, sq1Actions, world, speed, isSq1]);

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

  const appendUserMove = useCallback((action: TwistAction | string) => {
    let moveText = typeof action === 'string' ? action : action.value;
    if (typeof action !== 'string' && !isSq1 && world && world.cube.order === 1) {
      const norm = normalizeTo1x1(action);
      if (!norm) return;
      moveText = norm.value;
    }
    if (!moveText) return;
    const algEl = algElRef.current;
    if (!algEl) return;
    const current = algEl.value;
    const sep = current.trim()
      ? (isSq1 && (moveText === '/' || current.trimEnd().endsWith('/')) ? '' : ' ')
      : '';
    const next = current.trimEnd() + sep + moveText + ' ';
    algEl.value = next;
    algEl.selectionStart = algEl.selectionEnd = next.length;
    algEl.style.height = 'auto';
    algEl.style.height = algEl.scrollHeight + 'px';
    skipAutoResetRef.current = true;
    setAlgDraft(next);
    onAlgChange(next);
  }, [onAlgChange, isSq1, world]);

  useEffect(() => {
    if (!userMoveRef) return;
    userMoveRef.current = appendUserMove;
    return () => { userMoveRef.current = null; };
  }, [userMoveRef, appendUserMove]);

  // QWERTY: keymap → twist + append (no virtual keyboard, just hard keys).
  const applyMove = useCallback((k: KeyMove) => {
    if (isSq1) return;
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
  }, [world, isSq1, onAlgChange]);

  const handleScramble = useCallback(async () => {
    const reqId = ++scrambleReqIdRef.current;
    if (!world) return;
    let scramble: string | null = null;
    try {
      if (isSq1) {
        scramble = await wcaRandomScramble('sq1');
      } else if (order >= 2 && order <= 7) {
        const eventId = `${order}${order}${order}`;
        scramble = await wcaRandomScramble(eventId);
      } else {
        scramble = randomMoveScrambleNxN(order);
      }
    } catch (err) {
      console.warn('[sim] scramble failed:', err);
      scramble = isSq1 ? '' : randomMoveScrambleNxN(order);
    }
    if (reqId !== scrambleReqIdRef.current) return;
    if (!scramble) return;
    const animate = isSq1 || settings.animateScramble;
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
      setupElRef.current.style.height = 'auto';
      setupElRef.current.style.height = setupElRef.current.scrollHeight + 'px';
    }
    setSetupDraft(scramble);
    onSetupChange(scramble);
  }, [world, order, isSq1, settings.animateScramble, onSetupChange]);

  return (
    <div className="sim-player">
      <div className="sim-player-row sim-player-row--top">
        <textarea
          ref={setupElRef}
          defaultValue={setupDraft}
          rows={1}
          spellCheck={false}
          className="sim-player-input"
          placeholder={t('打乱', 'Scramble')}
          onInput={(e) => {
            const el = e.currentTarget;
            el.style.height = 'auto';
            el.style.height = el.scrollHeight + 'px';
            setSetupDraft(el.value);
            onSetupChange(el.value);
          }}
        />
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
        <textarea
          ref={algElRef}
          defaultValue={algDraft}
          rows={1}
          spellCheck={false}
          className="sim-player-input"
          placeholder={t('解法', 'Solution')}
          onInput={(e) => {
            const el = e.currentTarget;
            el.style.height = 'auto';
            el.style.height = el.scrollHeight + 'px';
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

      <div className="sim-player-tools">
        <button onClick={tool(invertAlg)} title={t('取逆', 'Invert')}><RotateCw size={13} />{t('逆', 'Invert')}</button>
        {!isSq1 && <button onClick={tool(simplifyAlg)} title={t('简化', 'Simplify')}><Sparkles size={13} />{t('简化', 'Simplify')}</button>}
        {!isSq1 && <button onClick={tool((s) => mirrorAlg(s, 'M'))} title={t('Mirror M (L↔R)', 'Mirror M (L↔R)')} aria-label="Mirror M"><FlipHorizontal2 size={13} /></button>}
        {!isSq1 && <button onClick={tool((s) => mirrorAlg(s, 'S'))} title={t('Mirror S (F↔B)', 'Mirror S (F↔B)')} aria-label="Mirror S"><FlipVertical2 size={13} /></button>}
        <button onClick={tool(() => '')} title={t('清空', 'Clear')}><Eraser size={13} />{t('清空', 'Clear')}</button>
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

const STYLE_PRESETS: { id: string; zh: string; en: string; s: Pick<SimSettings, 'thickness' | 'hollow' | 'arrow' | 'hint'> }[] = [
  { id: 'std', zh: '标准', en: 'Standard', s: { thickness: true, hollow: false, arrow: false, hint: false } },
  { id: 'hollow', zh: '镂空', en: 'Hollow', s: { thickness: true, hollow: true, arrow: false, hint: false } },
  { id: 'hint', zh: '提示', en: 'Hint', s: { thickness: true, hollow: false, arrow: false, hint: true } },
  { id: 'arrow', zh: '箭头', en: 'Arrows', s: { thickness: true, hollow: false, arrow: true, hint: false } },
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
  const isSq1Local = puzzleKind === 'sq1';
  const isNxNLocal = !isSq1Local;
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
              <select
                className="sim-puzzle-select"
                value={isSq1Local ? 'sq1' : 'nxn'}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === 'sq1') onPuzzleChange('sq1');
                  else onPuzzleChange(order || 3);
                }}
              >
                <option value="nxn">{t('NxN', 'NxN')}</option>
                <option value="sq1">{t('Square-1', 'Square-1')}</option>
              </select>
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
                <option value="orbit">{t('自动转体', 'Auto rotate')}</option>
                <option value="rotate">{t('整步转体', 'Snap rotate')}</option>
                <option value="view">{t('视角', 'View')}</option>
              </select>
            </label>
            <Toggle label={t('动画展示打乱', 'Animate scramble')} value={settings.animateScramble} onChange={(v) => set('animateScramble', v)} />
            <Toggle label={t('棋盘格背景', 'Checkered background')} value={settings.checkeredBg} onChange={(v) => set('checkeredBg', v)} />
            <Toggle label={t('立体贴片', 'Sticker thickness')} value={settings.thickness} onChange={(v) => set('thickness', v)} />
            <Toggle label={t('镂空', 'Hollow')} value={settings.hollow} onChange={(v) => set('hollow', v)} />
            <Toggle label={t('箭头', 'Arrows')} value={settings.arrow} onChange={(v) => set('arrow', v)} />
            <Toggle label={t('提示贴片 (背面)', 'Hint facelets (back faces)')} value={settings.hint} onChange={(v) => set('hint', v)} />
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

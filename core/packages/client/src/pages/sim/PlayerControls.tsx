/**
 * PlayerControls — alg playground for /sim。
 * 完全复用 ReconSubmit 那套:AlgInput + CubeKeyboardSection + recon_alg_utils。
 * 唯一 sim-特有部分:把"播放到第 n 步"转成 sim World twister 的 reset+fast-twist
 * (因为 sim 渲染是 huazhechen/cuber 自渲染,不是 TwistyPlayer,没 timestamp scrub)。
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { Play, Pause, SkipBack, SkipForward, RotateCcw, FlipHorizontal2, FlipVertical2, Eraser, Sparkles, RotateCw, Settings, ChevronRight, Shuffle, Keyboard, Grid3x3 } from 'lucide-react';
import { Alg, Move } from 'cubing/alg';
import World from './cuber/world';
import { TwistAction } from './cuber/twister';
import CubeGroup from './cuber/group';
import { parseSq1Scramble, movesToString, type Sq1Move } from './cuber/sq1/sq1State';
import { formatScrambleForEvent } from '../gen/sq1_svg';
import { invertAlg, simplifyAlg, mirrorAlg } from '../../utils/cube3';
import { cleanForPlayer, extractAlgFromText } from '../../utils/recon_alg_utils';
import { tnoodleRandomScramble, randomMoveScrambleNxN } from '../../utils/cubingScramble';
import type { SkewbNotation } from '@cuberoot/shared/skewb-notation';
import { isTwistyPuzzle, type SimPuzzle } from './SimPage';
import AlgInput from '../../components/AlgInput';
import CubeVirtualKeyboard from '../../components/CubeVirtualKeyboard';
import { useIsMobile } from '../../hooks/useIsMobile';
import { WheelPicker } from '../../components/WheelPicker';
import { Slider, Toggle, KeymapModal, DEFAULT_SETTINGS, DEFAULT_FACE_COLORS, type SimSettings } from './SettingDrawer';
import { KEYBOARD_ROWS, keyLabel, displayMove, type KeyMove } from './keymap';
import './player-controls.css';

// 1×1 上 face/slice 全等价于 x/y/z 转体。
// SAME = 跟轴同向(R/U/F/S),OPP = 跟轴反向(L/D/B/M/E);wide (Rw 等) → 同向。
// 不可表达的 (其它内层 wide / 数字前缀切片) 返回 null,会被丢弃。
const SAME_AXIS_1X1: Record<string, 'x' | 'y' | 'z'> = {
  R: 'x', U: 'y', F: 'z',
  S: 'z',  // S 跟 F 同向
};
const OPP_AXIS_1X1: Record<string, 'x' | 'y' | 'z'> = {
  L: 'x', D: 'y', B: 'z',
  M: 'x',  // M 跟 L 同向
  E: 'y',  // E 跟 D 同向
};

/** SQ1 alg invert:倒序 + 每个 turn 的 top/bot 取负;slice 保持 slice。 */
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
  // wide 在 1×1 上跟同字母的 face move 等价(整层 = 全方块)
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
  /** 阶数确认改变时调 (wheel 完全停下 / input 回车失焦 / AlgsPanel 选公式)。拖动 / inertia 期间不调。 */
  onOrderChange: (n: number) => void;
  /** Active puzzle. Number for NxN, 'sq1' for Square-1, 'pyraminx' / 'skewb' /
   *  'megaminx' for the cubing.js-rendered puzzles. Drives mode-specific UI. */
  puzzleKind: SimPuzzle;
  /** Called when user picks a different puzzle kind via the picker. */
  onPuzzleChange: (kind: SimPuzzle) => void;
  settings: SimSettings;
  onSettingsChange: (s: SimSettings) => void;
  keymap: Record<string, KeyMove>;
  onKeymapChange: (km: Record<string, KeyMove>) => void;
  onResetKeymap: () => void;
  /** SimPage 装在这里;user drag / tap / 实体键盘 twist 完后会调到我们的 append handler。
   *  传 string = 已是 cubing.js canonical move text(twisty puzzle 的 raycast / 整体转 commit 走这条),
   *  跳过 TwistAction 解析(否则 `Uv` 会被吞成 `U`、`BL` 吞成 `B`)。 */
  userMoveRef?: RefObject<((action: TwistAction | string) => void) | null>;
  /** twisty puzzle (pyraminx / skewb / megaminx) 的 TwistyPlayer 实例。
   *  animateScramble 打乱时用来 jumpToStart + play。 */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  twistyPlayerRef?: RefObject<any>;
  /** Dev 性能采样回调:打乱 click → 画面上屏总耗时 (ms) + setup CPU 纯耗时 (ms) */
  onScrambleTime?: (ms: number, cpuMs?: number) => void;
  /** Skewb-only:Sarah/Algorithm 记号 vs WCA。owner SimPage,持久化 localStorage。
   *  PlayerControls render 选择器(仅 skewb),写在 player.alg 时不直接用——
   *  SimPage 把 alg/setup 投给 TwistySection 时已统一翻成 WCA。 */
  skewbNotation?: SkewbNotation;
  onSkewbNotationChange?: (n: SkewbNotation) => void;
}

export default function PlayerControls({
  world, alg, setup, onAlgChange, onSetupChange,
  order, onOrderChange, puzzleKind, onPuzzleChange,
  settings, onSettingsChange,
  keymap, onKeymapChange, onResetKeymap,
  userMoveRef, twistyPlayerRef, onScrambleTime,
  skewbNotation, onSkewbNotationChange,
}: Props) {
  const isSq1 = puzzleKind === 'sq1';
  const isTwistyMode = isTwistyPuzzle(puzzleKind);
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const t = (zh: string, en: string) => (isZh ? zh : en);

  const [algDraft, setAlgDraft] = useState(alg);
  const [setupDraft, setSetupDraft] = useState(setup ?? '');
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  // 移动端默认开按键映射键盘(实体键盘点不到),桌面端默认收起。SSR 一律按"非移动"
  // 走第一帧 null,客户端 hydrate 后 useIsMobile 再纠正 — 此处用 lazy initializer 避
  // 免水合不一致。
  const isMobile = useIsMobile();
  const [kbVariant, setKbVariant] = useState<'alg' | 'qwerty' | null>(() => isMobile ? 'qwerty' : null);
  const [speed, setSpeed] = useState(1);
  // speed 同步到 twist 内部 tween 时长 (CubeGroup.frames 默认 30)。
  // 这样打乱 (twister.push 走 callback 链) 跟 alg 播放共用同一速度。
  // 下限 2 帧防 speed 过大变成 instant。
  useEffect(() => {
    CubeGroup.frames = Math.max(2, Math.round(30 / speed));
  }, [speed]);
  const playTimerRef = useRef<number | null>(null);
  const stepRef = useRef(0);
  const setupElRef = useRef<HTMLTextAreaElement | HTMLDivElement | null>(null);
  const algElRef = useRef<HTMLTextAreaElement | HTMLDivElement | null>(null);
  useEffect(() => { stepRef.current = step; }, [step]);

  // 外部 URL params 变化时同步 draft
  useEffect(() => { setAlgDraft(alg); }, [alg]);
  useEffect(() => { setSetupDraft(setup ?? ''); }, [setup]);

  // alg → 可播 alg(剥注释 / 零宽 / 连写补空格)→ leaf moves
  // cleanForPlayer 已经处理 `D'U'` `UD2` 这种连写,Alg parser 不会再 throw
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

  // SQ1 alg parsing — own path since cubing.js Alg doesn't understand `(t,b)/`.
  const sq1Actions = useMemo<Sq1Move[]>(() => {
    if (!isSq1) return [];
    return parseSq1Scramble(algDraft);
  }, [algDraft, isSq1]);

  const totalSteps = isSq1 ? sq1Actions.length : actions.length;

  // 跳转到第 n 步:setup 重置 + fast 应用前 n 个 action
  const jumpToStep = useCallback(async (n: number) => {
    if (!world) return;
    if (isSq1) {
      // SQ1: instant setup + instant n alg moves (no debounce). Same model as
      // /demo/sq1's caret-driven snap path. tweener finish() drains in-flight.
      // playbackMode='algorithm':effective setup = setup + invert(alg moves)。
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
    // playbackMode='algorithm' (cubing.js setupAnchor='end'):cube 终点 = setup,起点 = setup·alg⁻¹。
    // 等价于把 effective setup 改成 setupDraft + invert(algDraft),再正向播 n 步:
    //   state(n) = setup · alg⁻¹ · (alg 前 n 步) = setup · (alg 后 (total-n) 步)⁻¹。
    // 'algorithm' 模式下 setup 为空 + n=total = 还原态(alg 把魔方解开)。
    const effectiveSetup = settings.playbackMode === 'algorithm'
      ? (setupDraft + ' ' + invertAlg(algDraft)).trim()
      : setupDraft;
    // setupAsync: worker offload,主线程 UI 期间 60fps 不卡。N=200 ~5s 还是有,但用户能滚 / 切窗口
    await cube.twister.setupAsync(effectiveSetup);
    const target = Math.max(0, Math.min(n, actions.length));
    for (let i = 0; i < target; i++) {
      cube.twister.twist(actions[i], true, true);
    }
    setStep(target);
  }, [world, setupDraft, algDraft, actions, sq1Actions, isSq1, settings.playbackMode]);

  // applyMove (QWERTY 增量追加) 时 set 这个 ref,下面 actions-effect 跳过 reset 避免冲掉刚 twist 的状态
  const skipAutoResetRef = useRef(false);
  // animateScramble 路径:setup 写入会触发 useEffect → jumpToStep(0) instant 应用,
  // 跟动画播放冲突。set 此 ref 让 useEffect skip 一次。
  const animatingScrambleRef = useRef(false);
  /** 连点 Shuffle 时,后发 click 的 tnoodle await 可能先返回 → 先发 click 后返回会
   *  覆盖。每发 click 自增 + await 后核对,旧请求直接 drop。 */
  const scrambleReqIdRef = useRef(0);

  // setup / alg / actions 变化时停留在当前 step(jumpToStep 内部 clamp 到 total)。
  // 加空格 / 改注释等不改 move 数的编辑保持原 step,不会闪一下还原态。
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
  /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [setupDraft, actions, sq1Actions, settings.playbackMode]);

  // caret 同步:从 textarea selectionStart 算前面有几个 move → jump
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

  // 播放
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

  // 工具:对 (打乱 + 解法) 作为整体做变换,结果全部落到解法,打乱清空。
  // AlgInput 非受控 (defaultValue),改 state 必须同时把 textarea.value 也写一遍。
  const tool = (transform: (s: string) => string) => () => {
    const combined = (setupDraft + ' ' + algDraft).trim();
    const next = transform(combined);
    setSetupDraft('');
    onSetupChange('');
    setAlgDraft(next);
    onAlgChange(next);
    const setupEl = setupElRef.current;
    if (setupEl instanceof HTMLTextAreaElement) setupEl.value = '';
    const algEl = algElRef.current;
    if (algEl instanceof HTMLTextAreaElement) algEl.value = next;
  };

  // 用户主动 twist (drag / tap / 实体键盘) 完成时追加 move 到解法框。
  // 跟 applyMove 不同的是:cube 已经被上层 twist 过了,这里只动文本。
  // 永远落到 alg 框 (不像 QWERTY 那样允许写入 setup),因为 drag/tap 时焦点通常不在输入框,
  // 而即便焦点在 setup 框,用户拖魔方的语义也是"开始解",该落解法。
  // sq1: action.value = "(1,0)" / "(0,-1)" / "/" 原样追加;
  // twisty (pyraminx/skewb/megaminx): cubing.js raycast 出的 move 文本(如 U / R' / BL2)。
  const appendUserMove = useCallback((action: TwistAction | string) => {
    // string = raw cubing.js move text(`Uv` / `BL` / `DBR2'` 之类多字符 family)
    // 直接当 moveText 用,不走 TwistAction 正则(它专为 NxN/SQ1 设计,会吞 v / 双字母 family)
    let moveText = typeof action === 'string' ? action : action.value;
    if (typeof action !== 'string' && !isSq1 && !isTwistyMode && world && world.cube.order === 1) {
      const norm = normalizeTo1x1(action);
      if (!norm) return;  // 1×1 上不可表达的 move:丢弃
      moveText = norm.value;
    }
    if (!moveText) return;
    const algEl = algElRef.current;
    if (!(algEl instanceof HTMLTextAreaElement)) return;
    const current = algEl.value;
    // sq1 的 `/` 不要前置空格,`(1,0)` 跟 `/` 紧贴方便阅读;其它 puzzle 一律空格分。
    const sep = current.trim()
      ? (isSq1 && (moveText === '/' || current.trimEnd().endsWith('/'))
        ? ''
        : ' ')
      : '';
    const next = current.trimEnd() + sep + moveText + ' ';
    algEl.value = next;
    algEl.selectionStart = algEl.selectionEnd = next.length;
    algEl.style.height = 'auto';
    algEl.style.height = algEl.scrollHeight + 'px';
    skipAutoResetRef.current = true;
    setAlgDraft(next);
    onAlgChange(next);
  }, [onAlgChange, isSq1, isTwistyMode, world]);

  // 注册到 SimPage userMoveRef,卸载时清空
  useEffect(() => {
    if (!userMoveRef) return;
    userMoveRef.current = appendUserMove;
    return () => { userMoveRef.current = null; };
  }, [userMoveRef, appendUserMove]);

  // QWERTY 模式:按一个 keymap 动作 → 转魔方 + 追加到 setup/alg (打乱框激活时落 setup,否则落 alg 并 focus alg)
  const applyMove = useCallback((k: KeyMove) => {
    if (isSq1) return; // SQ1 keymap not implemented in MVP
    let action: TwistAction | null = new TwistAction(k.sign, !!k.reverse, 1);
    let moveText = displayMove(k);
    if (world && world.cube.order === 1) {
      action = normalizeTo1x1(action);
      if (!action) return;  // 1×1 上不可表达的 move:不转也不写
      moveText = action.value;
    }
    if (world && !isSq1) {
      const cube = world.cube as import('./cuber/cube').default;
      cube.twister.twist(action, false, true);
    }
    const setupEl = setupElRef.current;
    const algEl = algElRef.current;
    const active = document.activeElement;
    const writeToSetup = setupEl instanceof HTMLTextAreaElement && active === setupEl;
    const target = writeToSetup ? setupEl : algEl;
    if (!(target instanceof HTMLTextAreaElement)) return;
    if (!writeToSetup && active !== target) target.focus();
    const current = target.value;
    const next = current.trimEnd() + (current.trim() ? ' ' : '') + moveText + ' ';
    target.value = next;
    target.selectionStart = target.selectionEnd = next.length;
    skipAutoResetRef.current = true;  // 阻止下面 useEffect 把 cube 复原回 setup
    if (writeToSetup) {
      setSetupDraft(next);
      onSetupChange(next);
    } else {
      setAlgDraft(next);
      onAlgChange(next);
    }
  }, [world, onAlgChange, onSetupChange]);

  // QWERTY 激活时,实体键盘按 keymap 走;但打乱框激活时让字符直接落到打乱框 (不接管)
  useEffect(() => {
    if (kbVariant !== 'qwerty') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
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

  // 随机打乱:WCA 2-7 阶走 tnoodle 官方 scramble,其它阶用 huazhechen scrambler (9N moves)。
  // settings.animateScramble:false=写入 setup → useEffect → twister.setup() instant 应用;
  //                          true=animatingScrambleRef 让 useEffect skip,自己 reset+twister.push 慢动画。
  const handleScramble = useCallback(async () => {
    const reqId = ++scrambleReqIdRef.current;
    // Twisty puzzles: no cuber world. animateScramble=false → 写 setup (instant
    // baseline);true → 清 setup + 写 alg + 让 TwistyPlayer 从头自动播 (jumpToStart
    // + play 经 player.experimentalModel.playController)。
    if (isTwistyMode) {
      const scramble = (await tnoodleRandomScramble(puzzleKind as string)) ?? '';
      if (reqId !== scrambleReqIdRef.current) return;
      if (settings.animateScramble && scramble) {
        // setup 清空,alg 设为 scramble,player 自动 jumpToStart + play
        const setupEl = setupElRef.current;
        if (setupEl instanceof HTMLTextAreaElement) setupEl.value = '';
        setSetupDraft('');
        onSetupChange('');
        const algEl = algElRef.current;
        if (algEl instanceof HTMLTextAreaElement) {
          algEl.value = scramble;
          algEl.style.height = 'auto';
          algEl.style.height = algEl.scrollHeight + 'px';
        }
        skipAutoResetRef.current = true;
        setAlgDraft(scramble);
        onAlgChange(scramble);
        // alg prop 异步 flush 到 TwistySection → player.alg 设好后再 jumpToStart + play
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const p = twistyPlayerRef?.current as unknown as { jumpToStart?: (opts?: unknown) => void; play?: () => void } | null;
            try { p?.jumpToStart?.({ flash: false }); } catch { /* */ }
            try { p?.play?.(); } catch { /* */ }
          });
        });
        return;
      }
      const el = setupElRef.current;
      if (el instanceof HTMLTextAreaElement) {
        el.value = scramble;
        el.style.height = 'auto';
        el.style.height = el.scrollHeight + 'px';
      }
      setSetupDraft(scramble);
      onSetupChange(scramble);
      return;
    }
    if (!world) return;
    let scramble: string | null = null;
    if (isSq1) {
      scramble = await tnoodleRandomScramble('sq1');
      if (reqId !== scrambleReqIdRef.current) return;
      if (scramble) scramble = formatScrambleForEvent('sq1', scramble);
    } else if (order >= 2 && order <= 7) {
      const eventId = `${order}${order}${order}`;
      scramble = await tnoodleRandomScramble(eventId);
      if (reqId !== scrambleReqIdRef.current) return;
    }
    if (!scramble) {
      // SQ1: tnoodle hard-required. Fall back to '' to skip if upstream fails.
      // N>=8 (或 cubing.js 拿不到 scramble) 走自家 N×N random-move,
      // 跟 cubing.js 5-7 阶同一模式 (random-move, wide notation, 长度 20*(N-2))
      scramble = isSq1 ? '' : randomMoveScrambleNxN(order);
    }
    // SQ1: always animate — instant apply gives the impression that nothing
    // rotated (state changes in one frame). The animation is the whole point.
    const animate = scramble && (isSq1 || settings.animateScramble);
    if (animate) {
      animatingScrambleRef.current = true;
      world.cube.twister.setup('');     // reset to solved (instant)
      world.cube.twister.push(scramble); // 排队慢动画逐 move 播
    } else if (scramble) {
      // instant apply 走 useEffect 会同步阻塞主线程,公式框跟着卡。
      // 用 animatingScrambleRef 让 useEffect 跳过自动 reset,改在 rAF 之后手动 apply,
      // 给 textarea 一帧把公式画出来。
      animatingScrambleRef.current = true;
      const w = world;
      const t0 = performance.now();
      // setupAsync: worker 跑 hot loop,主线程在 worker 算的几秒里 UI 不卡。
      // 末尾 sweep + rebuildAll 仍在主线程,~500-700ms 卡顿 (N=200) 而非 5400ms。
      const tw = w.cube.twister as unknown as { setupAsync?: (e: string) => Promise<void>; setup: (e: string) => void; lastSetupCpuMs?: number };
      if (tw.setupAsync) {
        await tw.setupAsync(scramble);
      } else {
        // Sq1Twister 没 setupAsync — 退回 sync
        tw.setup(scramble);
      }
      const cpuMs = tw.lastSetupCpuMs;
      // 下一帧 render 把 dirty cube 画到 GPU,再 message-channel/setTimeout 等 paint 上屏后报时
      requestAnimationFrame(() => {
        setTimeout(() => {
          onScrambleTime?.(performance.now() - t0, cpuMs);
        }, 0);
      });
    }
    const el = setupElRef.current;
    if (el instanceof HTMLTextAreaElement) {
      el.value = scramble;
      el.style.height = 'auto';
      el.style.height = el.scrollHeight + 'px';
    }
    setSetupDraft(scramble);
    onSetupChange(scramble);
  }, [world, order, onSetupChange, settings.animateScramble, isSq1, onScrambleTime, isTwistyMode, puzzleKind]);

  return (
    <div className="sim-player">
      <div className="sim-player-row sim-player-row--top">
        <AlgInput
          elementRef={setupElRef}
          initialText={setupDraft}
          autoSpace
          autoResize
          rows={1}
          className="sim-player-input"
          placeholder={t('打乱', 'Scramble')}
          onChange={(text) => {
            setSetupDraft(text);
            onSetupChange(text);
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
        <AlgInput
          elementRef={algElRef}
          initialText={algDraft}
          autoSpace
          autoResize
          rows={1}
          className="sim-player-input"
          placeholder={t('解法', 'Solution')}
          onChange={(text) => {
            setAlgDraft(text);
            onAlgChange(text);
          }}
          onCaretChange={handleCaretSync}
        />
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
      {!isTwistyMode && (
      <div className="sim-keyboard-section">
        <div className="sim-keyboard-switcher">
          <button
            type="button"
            className={'vkb-toggle' + (kbVariant === 'alg' ? ' active' : '')}
            onClick={() => setKbVariant((v) => (v === 'alg' ? null : 'alg'))}
            title={t('解法虚拟键盘', 'Alg virtual keyboard')}
            aria-label={t('解法虚拟键盘', 'Alg virtual keyboard')}
          >
            <Keyboard size={14} />
          </button>
          <button
            type="button"
            className={'vkb-toggle' + (kbVariant === 'qwerty' ? ' active' : '')}
            onClick={() => setKbVariant((v) => (v === 'qwerty' ? null : 'qwerty'))}
            title={t('按键映射键盘 (点击 = 转魔方)', 'Keymap keyboard (click = twist cube)')}
            aria-label={t('按键映射键盘', 'Keymap keyboard')}
          >
            <Grid3x3 size={14} />
          </button>
        </div>
        {kbVariant === 'alg' && (
          <CubeVirtualKeyboard
            target={algElRef}
            onInput={() => {
              const el = algElRef.current;
              if (!el) return;
              const text = el instanceof HTMLTextAreaElement ? el.value : (el.textContent ?? '');
              setAlgDraft(text);
              onAlgChange(text);
            }}
          />
        )}
        {kbVariant === 'qwerty' && (
          <SimQwertyKeypad keymap={keymap} onMove={applyMove} />
        )}
      </div>
      )}
      <div className="sim-player-tools">
        <button onClick={tool(invertAlg)} title={t('取逆', 'Invert')}><RotateCw size={13} />{t('逆', 'Invert')}</button>
        {isSq1 && (
          <button
            onClick={() => {
              if (!world) return;
              // 让 Sq1Twister 走动画路径,回头 finishMove 会自动写历史 + 派发 callback。
              // 透到 appendUserMove 把 `/` 加到解法框。
              const c = world.cube as unknown as import('./cuber/sq1/Sq1Cube').default;
              const ok = c.twister.twist({ kind: 'slice' }, false, true);
              if (ok) appendUserMove(new TwistAction('/', false, 1));
            }}
            title={t('Slash:E 半立方翻转 180°', 'Slash: flip east half 180°')}
            aria-label={t('Slash', 'Slash')}
          >/</button>
        )}
        {!isTwistyMode && <button onClick={tool(simplifyAlg)} title={t('简化', 'Simplify')}><Sparkles size={13} />{t('简化', 'Simplify')}</button>}
        {!isTwistyMode && <button onClick={tool((s) => mirrorAlg(s, 'M'))} title={t('Mirror M:沿 M 面镜像 (L↔R)', 'Mirror M (L↔R)')} aria-label={t('Mirror M:沿 M 面镜像', 'Mirror M')}><FlipHorizontal2 size={13} /></button>}
        {!isTwistyMode && <button onClick={tool((s) => mirrorAlg(s, 'S'))} title={t('Mirror S:沿 S 面镜像 (F↔B)', 'Mirror S (F↔B)')} aria-label={t('Mirror S:沿 S 面镜像', 'Mirror S')}><FlipVertical2 size={13} /></button>}
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
        keymap={keymap}
        onKeymapChange={onKeymapChange}
        onResetKeymap={onResetKeymap}
      />
    </div>
  );
}

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

/** 内核色 preset: 默认深灰 + WCA 6 面色 (跟 define.ts COLORS 对齐) */
const CORE_COLOR_PRESETS: string[] = [
  '#202020', '#EE0000', '#FFA100', '#FFFFFF', '#FEFE00', '#00D800', '#0000F2',
];

const FACE_ORDER = ['U', 'L', 'F', 'R', 'B', 'D'] as const;
const FACE_LABELS_ZH: Record<typeof FACE_ORDER[number], string> = {
  U: '顶', D: '底', L: '左', R: '右', F: '前', B: '后',
};

/** 共用色板格 — preset (onClick) 与 picker (onPick) 都用同一外观 */
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
        <button
          type="button"
          className="sim-face-color-reset"
          onClick={action.onClick}
          title={action.title}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

const STYLE_PRESETS: { id: string; zh: string; en: string; s: Pick<SimSettings, 'thickness' | 'hollow' | 'arrow' | 'hint'> }[] = [
  { id: 'std',    zh: '标准', en: 'Standard', s: { thickness: true,  hollow: false, arrow: false, hint: false } },
  { id: 'hollow', zh: '镂空', en: 'Hollow',   s: { thickness: true,  hollow: true,  arrow: false, hint: false } },
  { id: 'hint',   zh: '提示', en: 'Hint',     s: { thickness: true,  hollow: false, arrow: false, hint: true  } },
  { id: 'arrow',  zh: '箭头', en: 'Arrows',   s: { thickness: true,  hollow: false, arrow: true,  hint: false } },
  { id: 'flat',   zh: '平面', en: 'Flat',     s: { thickness: false, hollow: false, arrow: false, hint: false } },
];

function PuzzleSettings({
  order, onOrderChange, puzzleKind, onPuzzleChange,
  settings, onSettingsChange, t,
  keymap, onKeymapChange, onResetKeymap,
}: {
  order: number;
  onOrderChange: (n: number) => void;
  puzzleKind: SimPuzzle;
  onPuzzleChange: (kind: SimPuzzle) => void;
  settings: SimSettings;
  onSettingsChange: (s: SimSettings) => void;
  t: (zh: string, en: string) => string;
  keymap: Record<string, KeyMove>;
  onKeymapChange: (km: Record<string, KeyMove>) => void;
  onResetKeymap: () => void;
}) {
  const isSq1Local = puzzleKind === 'sq1';
  const isTwistyLocal = isTwistyPuzzle(puzzleKind);
  const isNxNLocal = !isSq1Local && !isTwistyLocal;
  // Twisty puzzles render via cubing.js TwistyPlayer; the NxN-specific sliders
  // / toggles / color rows / keymap settings don't apply, so they're hidden.
  const [open, setOpen] = useState(true);
  const [keymapOpen, setKeymapOpen] = useState(false);

  const activePreset = STYLE_PRESETS.find(
    (p) => p.s.thickness === settings.thickness && p.s.hollow === settings.hollow
      && p.s.arrow === settings.arrow && p.s.hint === settings.hint,
  )?.id ?? '';

  const renderOrderSlot = useCallback((v: number) => (v >= 1 && v <= 400 ? String(v) : ''), []);
  const [orderDraft, setOrderDraft] = useState<string>(String(order));
  useEffect(() => { setOrderDraft(String(order)); }, [order]);
  // wheel 已经 180ms 静止才 onSettle,但大阶魔方重建 (cube ctor + GL upload) 是同步阻塞的 ——
  // 紧接着想二次手指狂滑会被 cube 重建堵住 touchstart 排队。
  // 多套一层 500ms"可撤销窗口":onSettle 后不立刻 apply,这窗口内任何 wheel 触碰 / onChange 都撤销 apply,
  // 让"连续狂滑"完全不触发任何重建。
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
  // 直接监听 wheel root 的 touchstart / mousedown — 用户刚一碰还没移动就撤销,
  // 不依赖 onChange 触发(纯按住不动的 touch 不会 onChange)。
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
      onOrderChange(n);  // 输入框是用户主动提交,立刻 apply,不进 500ms 窗口
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
                value={isTwistyLocal ? puzzleKind : (isSq1Local ? 'sq1' : 'nxn')}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === 'sq1' || v === 'pyraminx' || v === 'skewb' || v === 'megaminx') onPuzzleChange(v);
                  else onPuzzleChange(order || 3);
                }}
              >
                <option value="nxn">{t('NxN', 'NxN')}</option>
                <option value="sq1">{t('Square-1', 'Square-1')}</option>
                <option value="pyraminx">{t('金字塔', 'Pyraminx')}</option>
                <option value="skewb">{t('斜转', 'Skewb')}</option>
                <option value="megaminx">{t('五魔', 'Megaminx')}</option>
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
                  title={t('阶数 1–400(回车 / 失焦应用)', 'Order 1–400 (Enter / blur to apply)')}
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
              <Keyboard size={14} />
              <span>{t('键盘 / 鼠标快捷键', 'Keyboard / mouse shortcuts')}</span>
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
            {!isTwistyLocal && <Slider label={t('灵敏度', 'Sensitivity')} value={settings.sensitivity} onChange={(v) => set('sensitivity', v)} />}
            <Slider label={t('缩放', 'Scale')} value={settings.scale} onChange={(v) => set('scale', v)} />
            {!isTwistyLocal && <Slider label={t('透视', 'Perspective')} value={settings.perspective} onChange={(v) => set('perspective', v)} />}
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
            {!isTwistyLocal && <Toggle label={t('立体贴片', 'Sticker thickness')} value={settings.thickness} onChange={(v) => set('thickness', v)} />}
            {!isTwistyLocal && <Toggle label={t('镂空', 'Hollow')} value={settings.hollow} onChange={(v) => set('hollow', v)} />}
            {!isTwistyLocal && <Toggle label={t('箭头', 'Arrows')} value={settings.arrow} onChange={(v) => set('arrow', v)} />}
            <Toggle label={t('提示贴片 (背面)', 'Hint facelets (back faces)')} value={settings.hint} onChange={(v) => set('hint', v)} />
          </div>
          {!isTwistyLocal && <ColorRow label={t('内核色', 'Core color')}>
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
          </ColorRow>}
          {!isTwistyLocal && <ColorRow
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
          </ColorRow>}
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

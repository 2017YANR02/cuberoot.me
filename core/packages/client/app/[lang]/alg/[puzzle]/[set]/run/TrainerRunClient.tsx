'use client';

// Ported from packages/client-vite/src/pages/trainer/TrainerRunPage.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from '@/components/AppLink';
import { useParams } from 'next/navigation';
import { useQueryState } from 'nuqs';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Settings } from 'lucide-react';
import { getAlgSetMeta, loadAlg, type AlgCase } from '@cuberoot/shared';
import { useTrainerStore, TimerState, trainerPool } from '@/lib/trainer-store';
import TimerFontPicker from '@/components/TimerFontPicker';
import { useSpaceHoldTimer } from '@/hooks/useSpaceHoldTimer';
import { usePanelClamp } from '@/hooks/usePanelClamp';
import { useGestureWheel } from '@/hooks/useGestureWheel';
import { shouldIgnoreTimerTarget } from '@/lib/timer-ignore-target';
import GestureWheel from '@/components/GestureWheel';
import BoolToggle from '@/components/BoolToggle';
import PillToggle from '@/components/PillToggle/PillToggle';
import AlgCaseMetaModal from '@/components/AlgCaseMetaModal';
import { caseKey, findCaseByKey } from '@/lib/trainer-case-key';
import { availableKinds, SCRAMBLE_KINDS, type ScrambleKind } from '@/lib/trainer-scramble';
import { ALG_SET_UNIVERSE } from '@/lib/alg_probability';
import {
  TimerDisplay, ScrambleHeader, SolveCard, StatsList,
} from '@/app/[lang]/alg/_trainer/trainer-components';
import { resolveAlgPuzzle } from '@/app/[lang]/alg/_trainer/events';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import '@/app/[lang]/alg/_trainer/trainer.css';
import '@/app/[lang]/alg/alg.css';
import { tr } from '@/i18n/tr';

const TIMER_DELAY_MS = 0;

export default function TrainerRunClient() {
  const params = useParams<{ puzzle: string; set: string }>();
  const puzzleParam = (Array.isArray(params?.puzzle) ? params.puzzle[0] : params?.puzzle) ?? '';
  const setSlug = (Array.isArray(params?.set) ? params.set[0] : params?.set) ?? '';
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  useDocumentTitle('训练中', 'Training');

  // 训练范围:subgroup 页的训练按钮带 ?scope=<组slug> 进来,只练该组(筛选/默认 replace)
  const [scopeParam] = useQueryState('scope');
  const scopeSlug = scopeParam?.trim().toLowerCase() || null;

  const puzzle = resolveAlgPuzzle(puzzleParam);   // 接受 event code(333)或 legacy puzzle 名(3x3)
  const meta = puzzle ? getAlgSetMeta(puzzle, setSlug) : undefined;

  const cases = useTrainerStore(s => s.cases);
  const selected = useTrainerStore(s => s.selected);
  const scope = useTrainerStore(s => s.scope);
  const solves = useTrainerStore(s => s.solves);
  const currentName = useTrainerStore(s => s.currentName);
  const currentKey = useTrainerStore(s => s.currentKey);
  const currentScramble = useTrainerStore(s => s.currentScramble);
  const hist = useTrainerStore(s => s.hist);
  const timerState = useTrainerStore(s => s.timerState);
  const timerStarted = useTrainerStore(s => s.timerStarted);
  const observingIdx = useTrainerStore(s => s.observingIdx);
  const scrambleKind = useTrainerStore(s => s.scrambleKind);
  const setScrambleKind = useTrainerStore(s => s.setScrambleKind);
  const storePuzzle = useTrainerStore(s => s.puzzle);
  const storeSet = useTrainerStore(s => s.set);
  const loadSession = useTrainerStore(s => s.loadSession);
  const setScope = useTrainerStore(s => s.setScope);
  const hydratePrefs = useTrainerStore(s => s.hydratePrefs);
  const preAuf = useTrainerStore(s => s.preAuf);
  const setPreAuf = useTrainerStore(s => s.setPreAuf);
  const postAuf = useTrainerStore(s => s.postAuf);
  const setPostAuf = useTrainerStore(s => s.setPostAuf);
  const timing = useTrainerStore(s => s.timing);
  const setTiming = useTrainerStore(s => s.setTiming);
  const mode = useTrainerStore(s => s.mode);
  const setMode = useTrainerStore(s => s.setMode);
  const probMode = useTrainerStore(s => s.probMode);
  const setProbMode = useTrainerStore(s => s.setProbMode);
  const recapOrder = useTrainerStore(s => s.recapOrder);
  const setRecapOrder = useTrainerStore(s => s.setRecapOrder);
  const timerFont = useTrainerStore(s => s.timerFont);
  const setTimerFont = useTrainerStore(s => s.setTimerFont);
  const scrambleFont = useTrainerStore(s => s.scrambleFont);
  const setScrambleFont = useTrainerStore(s => s.setScrambleFont);
  const showCaseCard = useTrainerStore(s => s.showCaseCard);
  const setShowCaseCard = useTrainerStore(s => s.setShowCaseCard);
  const showStats = useTrainerStore(s => s.showStats);
  const setShowStats = useTrainerStore(s => s.setShowStats);
  const observingPinned = useTrainerStore(s => s.observingPinned);
  const pinObserving = useTrainerStore(s => s.pinObserving);
  const recapQueue = useTrainerStore(s => s.recapQueue);
  const recapPos = useTrainerStore(s => s.recapPos);
  const nextScramble = useTrainerStore(s => s.nextScramble);
  const prevScramble = useTrainerStore(s => s.prevScramble);
  const getTimerReady = useTrainerStore(s => s.getTimerReady);
  const startTimer = useTrainerStore(s => s.startTimer);
  const stopTimer = useTrainerStore(s => s.stopTimer);
  const setTimerState = useTrainerStore(s => s.setTimerState);
  const setSolvePenalty = useTrainerStore(s => s.setSolvePenalty);
  const deleteSolve = useTrainerStore(s => s.deleteSolve);
  const clearSolves = useTrainerStore(s => s.clearSolves);

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (timerState !== TimerState.RUNNING) return;
    let raf = 0;
    const tick = () => {
      setNow(Date.now());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [timerState]);

  // 偏好(pre-AUF / 计时 / 模式 / 字体)只在挂载后补水 —— SSG 壳渲染默认值,避免水合不一致
  useEffect(() => { hydratePrefs(); }, [hydratePrefs]);

  useEffect(() => {
    if (!puzzle || !meta) return;
    if (storePuzzle === puzzle && storeSet === setSlug && cases.length > 0) return;
    loadAlg(puzzle, setSlug)
      .then(d => loadSession(puzzle, setSlug, d.cases))
      .catch(e => console.error('[trainer] loadAlg failed', e));
  }, [puzzle, setSlug, meta, storePuzzle, storeSet, cases.length, loadSession]);

  // scope slug → 该组全部 case key(与 AlgCategoryView 的 top/sub 两级匹配同一套约定)
  const scopedKeys = useMemo(() => {
    if (!scopeSlug || cases.length === 0) return null;
    const parts = (c: AlgCase) => (c.subgroup || '').toLowerCase().split('/');
    const isTop = cases.some(c => parts(c)[0] === scopeSlug);
    const hit = cases.filter(c => (isTop ? parts(c)[0] : parts(c)[1]) === scopeSlug);
    return hit.length > 0 ? hit.map(caseKey) : null;
  }, [cases, scopeSlug]);

  useEffect(() => {
    setScope(scopedKeys);
  }, [scopedKeys, setScope]);

  const pool = useMemo(() => trainerPool(selected, scope), [selected, scope]);

  /**
   * 选中的这批 case 一共支持哪几种打乱(并集)。只有一种(全是 `inv`)就不渲染选择器。
   * 不是每个 case 都有全套 —— 表里验不过轨道判据的打乱没入库,generateScramble 会退回 `inv`。
   * (必须在下面的 early return 之前 —— hooks 不能因「尚未选 case」而少跑。)
   */
  const kinds = useMemo(() => {
    const seen = new Set<ScrambleKind>();
    for (const k of pool) {
      const c = findCaseByKey(cases, k);
      if (c) for (const kind of availableKinds(c)) seen.add(kind);
    }
    // cstimer 风格 = 求解器现算随机态打乱,不依赖表 meta,3x3 一律可用(issue #30)
    if (puzzle === '3x3') seen.add('cstimer');
    return SCRAMBLE_KINDS.filter(k => seen.has(k.id));
  }, [pool, cases, puzzle]);

  // 改了选中的 case 之后,原先选的那种打乱可能一个 case 都不再支持 —— 此时 <select> 的
  // value 落空、显示成一片空白。退回 `inv`(它永远支持)。
  useEffect(() => {
    if (kinds.length && !kinds.some(k => k.id === scrambleKind)) setScrambleKind('inv');
  }, [kinds, scrambleKind, setScrambleKind]);

  useEffect(() => {
    // 读 live 状态而不是闭包值:setScope 的 effect 可能在同一个 commit 里已经出过题了,
    // 闭包里的 currentName 还是 null —— 直接再出一题会在历史开头塞进一条幽灵记录。
    if (cases.length > 0 && pool.length > 0 && useTrainerStore.getState().currentName === null) {
      nextScramble();
    }
  }, [cases.length, pool.length, currentName, nextScramble]);

  // Space-bar timing (keyboard). Touch/mouse press-to-time is handled by the
  // gesture-wheel hook below so a press can also drive the radial dial.
  useSpaceHoldTimer({
    state: timerState,
    delayMs: TIMER_DELAY_MS,
    enabled: timing,
    getTimerReady,
    startTimer,
    stopTimer,
    setNotRunning: () => setTimerState(TimerState.NOT_RUNNING),
  });

  // ←/→ 打乱历史(同 /timer);不计时模式下空格也直接切下一个打乱。
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA'
        || target.tagName === 'SELECT' || target.isContentEditable)) return;
      if (e.code === 'ArrowLeft') { e.preventDefault(); prevScramble(); return; }
      if (e.code === 'ArrowRight') { e.preventDefault(); nextScramble(); return; }
      if (e.code === 'Space' && !useTrainerStore.getState().timing) {
        e.preventDefault();
        if (!e.repeat) nextScramble();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [prevScramble, nextScramble]);

  // ── Radial gesture wheel (shared with /timer) ───────────────────
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [copied, setCopied] = useState(false);
  const [metaCase, setMetaCase] = useState<AlgCase | null>(null);

  // 齿轮设置弹出面板(训练选项全收在里面),点外部关闭。
  // 监听 pointerdown 而非 mousedown:stage 手势层在 pointerdown 里 preventDefault,
  // 会抑制后续的兼容性 mousedown —— 挂 mousedown 的话点 stage 空白永远关不上。
  const optsRef = useRef<HTMLDivElement | null>(null);
  const optsPanelRef = useRef<HTMLDivElement | null>(null);
  const [optsOpen, setOptsOpen] = useState(false);
  usePanelClamp(optsOpen, optsPanelRef);
  useEffect(() => {
    if (!optsOpen) return;
    const handler = (e: PointerEvent) => {
      if (optsRef.current && !optsRef.current.contains(e.target as Node)) setOptsOpen(false);
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [optsOpen]);
  const stageMounted = !!(puzzle && meta) && !(pool.length === 0 && cases.length > 0);

  /** meta.no → case:元数据弹窗里的镜像 / 逆链接用(同 AlgCategoryView) */
  const byNo = useMemo(() => {
    const m = new Map<number, AlgCase>();
    for (const c of cases) if (c.meta?.no != null) m.set(c.meta.no, c);
    return m;
  }, [cases]);

  // index: 0 next · 1 OK · 2 +2 · 3 DNF · 4 prev · 5 (空) · 6 del · 7 copy
  // 4/5 原是「看上次/看下次」(翻成绩) —— 与 /timer 对齐改为「上一个」= 上一条打乱
  //(同 ← 键),「看下次」与「下一个」语义重复,删(issue #30)。
  const wheelLabels = [
    tr({ zh: '下一个', en: 'Next' }),
    'OK', '+2', 'DNF',
    tr({ zh: '上一个', en: 'Prev' }),
    '',
    tr({ zh: '删除', en: 'Del' }),
    tr({ zh: '复制', en: 'Copy' }),
  ];

  const { wheelRef } = useGestureWheel({
    surfaceRef: stageRef,
    active: stageMounted,
    // 「下一个」等按钮在计时面板内 — 按它们不应触发按压计时(否则点了直接开始计时)。
    ignoreTarget: shouldIgnoreTimerTarget,
    canGesture: () => {
      const st = useTrainerStore.getState().timerState;
      return st === TimerState.NOT_RUNNING || st === TimerState.STOPPING;
    },
    enabledFor: () => {
      const st = useTrainerStore.getState();
      const hasLast = st.solves.length > 0;
      return [
        st.timerState === TimerState.NOT_RUNNING,
        hasLast, hasLast, hasLast,
        st.hist.idx > 0,
        false,
        hasLast,
        !!st.currentScramble,
      ];
    },
    fireAction: (i) => {
      const st = useTrainerStore.getState();
      const lastIdx = st.solves.length - 1;
      const last = st.solves[lastIdx];
      switch (i) {
        case 0: if (st.timerState === TimerState.NOT_RUNNING) nextScramble(); break;
        case 1: if (last) setSolvePenalty(lastIdx, 'ok'); break;
        case 2: if (last) setSolvePenalty(lastIdx, last.penalty === '+2' ? 'ok' : '+2'); break;
        case 3: if (last) setSolvePenalty(lastIdx, last.penalty === 'DNF' ? 'ok' : 'DNF'); break;
        case 4: prevScramble(); break;
        case 6: if (last) deleteSolve(lastIdx); break;
        case 7: {
          const scr = st.currentScramble;
          if (scr && typeof navigator !== 'undefined' && navigator.clipboard) {
            navigator.clipboard.writeText(scr).then(() => {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1200);
            }).catch(() => {});
          }
          break;
        }
      }
    },
    onPressDown: () => {
      if (!useTrainerStore.getState().timing) return;
      const st = useTrainerStore.getState().timerState;
      if (st === TimerState.RUNNING) stopTimer();
      else if (st === TimerState.NOT_RUNNING) getTimerReady(TIMER_DELAY_MS);
    },
    onPressUp: () => {
      // 不计时模式:单击(未拖动)= 下一个打乱
      if (!useTrainerStore.getState().timing) { nextScramble(); return; }
      const st = useTrainerStore.getState().timerState;
      if (st === TimerState.READY) startTimer();
      else if (st === TimerState.AWAITING_READY || st === TimerState.STOPPING) setTimerState(TimerState.NOT_RUNNING);
    },
    onArmCancel: () => {
      const st = useTrainerStore.getState().timerState;
      if (st === TimerState.READY || st === TimerState.AWAITING_READY) setTimerState(TimerState.NOT_RUNNING);
    },
  });

  // stage 之外的页面空白(顶栏边缘、栏间留白、内容下方的 body)也当按压面:
  // 计时开 = 同空格按住/松开;计时关 = 单击直接下一个。sidebar(看成绩要点来点去)、
  // 弹窗、轮盘与一切交互控件除外;不 preventDefault,移动端滚动不受影响(轮盘手势仍只在 stage 内)。
  useEffect(() => {
    const isBlank = (t: EventTarget | null): boolean => {
      if (shouldIgnoreTimerTarget(t)) return false;
      if (!(t instanceof Element)) return false;
      return t.closest('.trainer-stage, .trainer-sidebar, .alg-admin-modal-backdrop, .gesture-wheel') === null;
    };
    let pressed = false;
    const down = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (!isBlank(e.target)) return;
      pressed = true;
      if (!useTrainerStore.getState().timing) return;
      const st = useTrainerStore.getState().timerState;
      if (st === TimerState.RUNNING) stopTimer();
      else if (st === TimerState.NOT_RUNNING) getTimerReady(TIMER_DELAY_MS);
    };
    const up = () => {
      if (!pressed) return;
      pressed = false;
      if (!useTrainerStore.getState().timing) { nextScramble(); return; }
      const st = useTrainerStore.getState().timerState;
      if (st === TimerState.READY) startTimer();
      else if (st === TimerState.AWAITING_READY || st === TimerState.STOPPING) setTimerState(TimerState.NOT_RUNNING);
    };
    document.addEventListener('pointerdown', down);
    document.addEventListener('pointerup', up);
    return () => {
      document.removeEventListener('pointerdown', down);
      document.removeEventListener('pointerup', up);
    };
  }, [nextScramble, stopTimer, getTimerReady, startTimer, setTimerState]);

  if (!puzzle || !meta) {
    return (
      <div className="trainer-root">
        <div className="trainer-landing-empty">
          {tr({ zh: '未知公式集', en: 'Unknown set' })}: {puzzleParam}/{setSlug}
        </div>
      </div>
    );
  }

  const selectHref = `/alg/${puzzleParam}/${setSlug}/select${scopeSlug ? `?scope=${encodeURIComponent(scopeSlug)}` : ''}`;

  if (pool.length === 0 && cases.length > 0) {
    return (
      <div className="trainer-root">
        <div className="trainer-landing-empty">
          {tr({ zh: '尚未选 case', en: 'No cases selected'
        })}
          <div style={{ marginTop: 16 }}>
            <Link href={selectHref} className="trainer-start-btn">
              {tr({ zh: '去选择', en: 'Pick cases'
            })}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const ms =
    timerState === TimerState.RUNNING ? now - timerStarted :
    timerState === TimerState.READY || timerState === TimerState.AWAITING_READY ? 0 :
    solves.length > 0 ? solves[solves.length - 1].ms : 0;

  const observingSolve = solves[observingIdx] ?? null;

  // 侧栏卡片:计时模式跟随所观察的成绩;不计时默认跟随当前题(否则右侧一直冻结在
  // 最后一条成绩上),但统计里点选了成绩(pinned)时也切到那条 —— 打乱图与打乱
  // 公式一同更改(issue #30),出下一题自动回落。
  const currentCase = currentKey ? findCaseByKey(cases, currentKey) ?? null : null;
  const cardSolve = timing ? observingSolve : (observingPinned ? observingSolve : null);
  const cardCase = cardSolve
    ? findCaseByKey(cases, cardSolve.caseKey) ?? null
    : (timing ? null : currentCase);
  const cardScramble = cardSolve ? cardSolve.scramble : (timing ? null : currentScramble);
  // 计数:第几把 —— 不计时也要有(打乱历史里的位置,从 1 起);跟着一条已录成绩看
  // 时改用该成绩的序号(两套编号在计时模式下重合,recap/不计时时只有前者)。
  const cardHeader = cardSolve ? `#${cardSolve.i + 1}` : (hist.idx >= 0 ? `#${hist.idx + 1}` : undefined);

  const onNextCase = () => {
    if (timerState === TimerState.NOT_RUNNING) nextScramble();
  };

  // 不计时没有用时可统计,统计卡片(和它的开关)整块不出现,不是留一个空/永远关着的卡片
  const statsVisible = timing && showStats;

  // pre-AUF 只对「顶层 case + U 可作 AUF」的场景有意义(F2L 类打乱前加 U 会换 case)
  const preAufSupported = (puzzle === '3x3' || puzzle === '2x2') && cases[0]?.sticker.kind !== 'f2l';
  // 真实概率只有带 meta 的 LL set(zbll / pll / ell / 1lll)有数学定义
  const probSupported = puzzle === '3x3' && !!ALG_SET_UNIVERSE[setSlug];
  // recap 进度:pickFresh 已把 recapPos 推到「当前题序号」,直接显示 pos/total
  const recapTotal = recapQueue.length;
  const recapShown = mode === 'recap' && recapTotal > 0;

  return (
    <div className="trainer-root">
      <div className="trainer-topbar">
        <Link href={selectHref} className="trainer-back">
          <ArrowLeft size={14} /> {tr({ zh: '选 case', en: 'Select Algs'
        })}
        </Link>
        <span style={{ fontSize: '1rem', color: 'var(--muted-foreground)' }}>
          {puzzle} · {tr(meta)}{scopeSlug ? ` · ${scopeSlug.toUpperCase()}` : ''}
        </span>
        {/* 训练选项全收进齿轮弹出面板,齿轮居中吸在页面正上方
            (data-no-timer:面板空白不触发按压计时) */}
        <div className="trainer-opts trainer-opts--top" data-no-timer ref={optsRef}>
          <button
            type="button"
            className="trainer-opts-gear"
            onClick={() => setOptsOpen(o => !o)}
            aria-expanded={optsOpen}
            aria-label={tr({ zh: '训练设置', en: 'Trainer settings' })}
          >
            <Settings size={18} />
          </button>
          {optsOpen && (
            <div className="trainer-opts-panel" ref={optsPanelRef}>
              {kinds.length > 1 && (
                <div className="trainer-opts-row">
                  <span className="trainer-opts-label">{tr({ zh: '打乱', en: 'Scramble' })}</span>
                  <select
                    className="trainer-scramble-kind"
                    value={scrambleKind}
                    onChange={e => setScrambleKind(e.target.value as ScrambleKind)}
                    disabled={timerState !== TimerState.NOT_RUNNING}
                    aria-label={tr({ zh: '打乱类型', en: 'Scramble type' })}
                  >
                    {kinds.map(k => <option key={k.id} value={k.id}>{k.label()}</option>)}
                  </select>
                </div>
              )}
              <div className="trainer-opts-row">
                <BoolToggle
                  value={timing}
                  onChange={setTiming}
                  label={tr({ zh: '计时', en: 'Timing' })}
                />
                <PillToggle
                  value={mode === 'train'}
                  onChange={v => setMode(v ? 'train' : 'recap')}
                  onLabel={tr({ zh: '训练', en: 'Train' })}
                  offLabel={tr({ zh: '复习', en: 'Recap' })}
                  ariaLabel={tr({ zh: '训练 / 复习模式', en: 'Train / recap mode' })}
                />
              </div>
              <div className="trainer-opts-hint">
                {mode === 'train'
                  ? tr({ zh: '随机抽取,同一 case 可能连续出现', en: 'Random draw, the same case may repeat' })
                  : tr({
                      zh: '选中的 n 个 case 洗牌后各出一遍,出完重洗。轮内 ≤ n 把必出全部;跨轮看单个 case 最坏间隔 2n−1',
                      en: 'All n selected cases once per shuffled round, reshuffle when done. Every case within ≤ n draws of a round; worst same-case gap across rounds is 2n−1',
                    })}
              </div>
              {mode === 'recap' && (
                <div className="trainer-opts-row">
                  <PillToggle
                    value={recapOrder === 'seq'}
                    onChange={v => setRecapOrder(v ? 'seq' : 'shuffle')}
                    onLabel={tr({ zh: '顺序', en: 'In order' })}
                    offLabel={tr({ zh: '乱序', en: 'Shuffled' })}
                    ariaLabel={tr({ zh: '复习顺序', en: 'Recap order' })}
                  />
                </div>
              )}
              {preAufSupported && (
                <div className="trainer-opts-row">
                  <BoolToggle value={preAuf} onChange={setPreAuf} label="pre-AUF" />
                  <BoolToggle value={postAuf} onChange={setPostAuf} label="post-AUF" />
                </div>
              )}
              {probSupported && mode === 'train' && (
                <>
                  <div className="trainer-opts-row">
                    <span className="trainer-opts-label">{tr({ zh: '概率', en: 'Odds' })}</span>
                    <PillToggle
                      value={probMode === 'uniform'}
                      onChange={v => setProbMode(v ? 'uniform' : 'real')}
                      onLabel={tr({ zh: '均等', en: 'Uniform' })}
                      offLabel={tr({ zh: '真实', en: 'Real' })}
                      ariaLabel={tr({ zh: '出题概率模式', en: 'Case probability mode' })}
                    />
                  </div>
                  <div className="trainer-opts-hint">
                    {probMode === 'uniform'
                      ? tr({
                          zh: '每题独立均匀抽取:P(case) = 1/n',
                          en: 'Independent uniform draw: P(case) = 1/n',
                        })
                      : tr({
                          zh: '按 AUF 轨道大小加权:P(case) ∝ 16/c(c = 该 case 的对称阶),即随机顶层中它的真实出现频率',
                          en: 'Weighted by AUF orbit size: P(case) ∝ 16/c (c = symmetry order) — its true frequency in a random last layer',
                        })}
                  </div>
                </>
              )}
              {timing && (
                <div className="trainer-opts-row">
                  <span className="trainer-opts-label">{tr({ zh: '计时字体', en: 'Timer font' })}</span>
                  <TimerFontPicker value={timerFont} onChange={setTimerFont} />
                </div>
              )}
              <div className="trainer-opts-row">
                <span className="trainer-opts-label">{tr({ zh: '打乱字体', en: 'Scramble font' })}</span>
                <TimerFontPicker
                  value={scrambleFont}
                  onChange={setScrambleFont}
                  ariaLabel={tr({ zh: '打乱字体', en: 'Scramble font' })}
                  preview="R U R' F2"
                  options={['sans', 'mono', 'liberation']}
                  previewWeight={400}
                />
              </div>
              {/* 极简:侧栏两块各自可隐藏(issue #30)。统计=成绩用时列表,不计时根本
                  没有用时可统计 —— 不计时时连开关一起隐掉,而不是留一个永远关着的死开关。 */}
              <div className="trainer-opts-row">
                <BoolToggle
                  value={showCaseCard}
                  onChange={setShowCaseCard}
                  label={tr({ zh: 'case 卡片', en: 'Case card' })}
                />
              </div>
              {timing && (
                <div className="trainer-opts-row">
                  <BoolToggle
                    value={showStats}
                    onChange={setShowStats}
                    label={tr({ zh: '统计', en: 'Stats' })}
                  />
                </div>
              )}
              <div className="trainer-opts-help">
                {timing
                  ? tr({ zh: '空格开始/停止，按住拖动呼出轮盘', en: 'Space to start/stop, hold & drag for the wheel' })
                  : tr({ zh: '单击、空格或 → 键切下一个打乱', en: 'Click, Space or → for the next scramble' })}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className={`trainer-run${showCaseCard || statsVisible ? '' : ' trainer-run--solo'}`}>
        <div className="trainer-stage" ref={stageRef}>
          <ScrambleHeader
            scramble={currentScramble || ''}
            label={copied ? tr({ zh: '已复制', en: 'Copied' }) : undefined}
            font={scrambleFont}
          />
          <div className="trainer-stage-actions">
            {/* 不计时模式下点哪都是「下一个」,按钮多余不显示 */}
            {timing && (
              <button
                className="trainer-stage-btn"
                onClick={onNextCase}
                disabled={timerState !== TimerState.NOT_RUNNING}
              >
                {tr({ zh: '下一个', en: 'Next'
              })}
              </button>
            )}
          </div>

          {recapShown && (
            <div className="trainer-stage-opts">
              <span className="trainer-recap-progress">
                {Math.min(recapPos, recapTotal)}/{recapTotal}
              </span>
            </div>
          )}

          {timing && (
            <TimerDisplay
              state={timerState}
              ms={ms}
              penalty={solves.length > 0 ? solves[solves.length - 1].penalty : undefined}
              font={timerFont}
            />
          )}

        </div>

        {(showCaseCard || statsVisible) && (
          <aside className="trainer-sidebar">
            {showCaseCard && (
              <SolveCard
                puzzle={puzzle}
                set={setSlug}
                scramble={cardScramble}
                c={cardCase}
                isZh={isZh}
                onShowCase={cardCase?.meta ? (c) => setMetaCase(c) : undefined}
                header={cardHeader}
              />
            )}
            {statsVisible && (
              <StatsList
                solves={solves}
                observingIdx={observingIdx}
                isZh={isZh}
                onPick={pinObserving}
                onClear={() => {
                  if (confirm(tr({ zh: '清空所有成绩?', en: 'Clear all solves?'
                })))
                    clearSolves();
                }}
              />
            )}
          </aside>
        )}
      </div>

      <GestureWheel ref={wheelRef} isZh={isZh} labels={wheelLabels} />

      {metaCase?.meta && (
        <AlgCaseMetaModal
          caseObj={metaCase}
          puzzle={puzzle}
          set={setSlug}
          byNo={byNo}
          onClose={() => setMetaCase(null)}
          onJump={(c) => setMetaCase(c)}
        />
      )}
    </div>
  );
}

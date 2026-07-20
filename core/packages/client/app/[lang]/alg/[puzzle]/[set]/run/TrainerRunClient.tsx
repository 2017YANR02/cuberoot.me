'use client';

// Ported from packages/client-vite/src/pages/trainer/TrainerRunPage.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { CaseThumb } from '@/components/CaseThumb';
import { caseKey, findCaseByKey } from '@/lib/trainer-case-key';
import { availableKinds, purifyScramble, SCRAMBLE_KINDS, type ScrambleKind } from '@/lib/trainer-scramble';
import { useTrainerMarks, markStatus, markStarred, type CaseMarkStatus } from '@/lib/trainer-marks';
import { ALG_SET_UNIVERSE } from '@/lib/alg_probability';
import {
  TimerDisplay, ScrambleHeader, SolveCard, StatsList, CaseMarkBar,
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
  const peek = useTrainerStore(s => s.peek);
  const peek2 = useTrainerStore(s => s.peek2);
  // 标记快捷键的目标 = 卡片当前显示的 case(pillCase),用 ref 让 keydown 闭包读到最新值
  const pillKeyRef = useRef<string | null>(null);
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
  const coop = useTrainerStore(s => s.coop);
  const setCoop = useTrainerStore(s => s.setCoop);
  const room = useTrainerStore(s => s.room);
  const roomBusy = useTrainerStore(s => s.roomBusy);
  const roomClaimed = useTrainerStore(s => s.roomClaimed);
  const roomError = useTrainerStore(s => s.roomError);
  const createRoom = useTrainerStore(s => s.createRoom);
  const joinRoom = useTrainerStore(s => s.joinRoom);
  const leaveRoom = useTrainerStore(s => s.leaveRoom);
  const timerFont = useTrainerStore(s => s.timerFont);
  const setTimerFont = useTrainerStore(s => s.setTimerFont);
  const scrambleFont = useTrainerStore(s => s.scrambleFont);
  const setScrambleFont = useTrainerStore(s => s.setScrambleFont);
  const showPrevCard = useTrainerStore(s => s.showPrevCard);
  const setShowPrevCard = useTrainerStore(s => s.setShowPrevCard);
  const showNextCard = useTrainerStore(s => s.showNextCard);
  const setShowNextCard = useTrainerStore(s => s.setShowNextCard);
  const showStats = useTrainerStore(s => s.showStats);
  const setShowStats = useTrainerStore(s => s.setShowStats);
  const showStageThumb = useTrainerStore(s => s.showStageThumb);
  const setShowStageThumb = useTrainerStore(s => s.setShowStageThumb);
  const pureScramble = useTrainerStore(s => s.pureScramble);
  const setPureScramble = useTrainerStore(s => s.setPureScramble);
  const multiScramble = useTrainerStore(s => s.multiScramble);
  const setMultiScramble = useTrainerStore(s => s.setMultiScramble);
  const observingPinned = useTrainerStore(s => s.observingPinned);
  const pinObserving = useTrainerStore(s => s.pinObserving);
  const nextScramble = useTrainerStore(s => s.nextScramble);
  const prevScramble = useTrainerStore(s => s.prevScramble);
  const recapRoundDone = useTrainerStore(s => s.recapRoundDone);
  const continueRecapRound = useTrainerStore(s => s.continueRecapRound);
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

  // per-case 学习标记(pill / 轮盘掌握位 / M 键):本地 + 登录后云端合并
  const loadMarks = useTrainerMarks(s => s.loadMarks);
  useEffect(() => {
    if (!puzzle || !meta) return;
    loadMarks(puzzle, setSlug);
  }, [puzzle, setSlug, meta, loadMarks]);

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
  // pool 为空(还没选 case / cases 未加载)时 kinds 只是过渡态(仅 cstimer),此时 htm 尚未
  // 「入列」不代表不被支持 —— 据此重置会把默认 htm 误打回 inv,且之后 htm 可用也不再扶回。
  useEffect(() => {
    if (pool.length === 0) return;
    if (kinds.length && !kinds.some(k => k.id === scrambleKind)) setScrambleKind('inv');
  }, [kinds, scrambleKind, setScrambleKind, pool.length]);

  useEffect(() => {
    // 读 live 状态而不是闭包值:setScope 的 effect 可能在同一个 commit 里已经出过题了,
    // 闭包里的 currentName 还是 null —— 直接再出一题会在历史开头塞进一条幽灵记录。
    if (cases.length > 0 && pool.length > 0 && useTrainerStore.getState().currentName === null) {
      nextScramble();
    }
  }, [cases.length, pool.length, currentName, nextScramble]);

  // 三条一屏(仅不计时模式):屏上第 2、3 条就是 store 预抽的 peek / peek2,所以「切下一屏」
  // = 连推 3 格 —— 新一屏是全新的三条,每条照常进历史(← 仍能逐条回看)。
  // 监听器常驻不重订阅,用 ref 读当次最新值。
  const multiRef = useRef(false);
  multiRef.current = multiScramble && !timing;
  const advanceScramble = useCallback(() => {
    const n = multiRef.current ? 3 : 1;
    for (let i = 0; i < n; i++) nextScramble();
  }, [nextScramble]);

  // Space-bar timing (keyboard). Touch/mouse press-to-time is handled by the
  // gesture-wheel hook below so a press can also drive the radial dial.
  useSpaceHoldTimer({
    state: timerState,
    delayMs: TIMER_DELAY_MS,
    enabled: timing && !recapRoundDone, // 「本轮结束」弹窗开着时别让空格误起表
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
      // 「本轮结束」弹窗开着时:回车/空格/Esc/→ 进下一轮,其余键一律吞掉(别打标记/翻历史)
      const st0 = useTrainerStore.getState();
      if (st0.recapRoundDone) {
        if (e.code === 'Enter' || e.code === 'Space' || e.code === 'Escape' || e.code === 'ArrowRight') {
          e.preventDefault();
          st0.continueRecapRound();
        }
        return;
      }
      if (e.code === 'ArrowLeft') { e.preventDefault(); prevScramble(); return; }
      if (e.code === 'ArrowRight') { e.preventDefault(); advanceScramble(); return; }
      // 1-4:直接给卡片当前 case 打标记(1 学习中 / 2 已掌握 / 3 搁置 / 4 星标);再按同键取消
      if (!e.repeat && (e.code === 'Digit1' || e.code === 'Digit2' || e.code === 'Digit3' || e.code === 'Digit4')) {
        const st = useTrainerStore.getState();
        if (st.timerState !== TimerState.NOT_RUNNING && st.timerState !== TimerState.STOPPING) return;
        const k = pillKeyRef.current;
        if (!k) return;
        e.preventDefault();
        const mk = useTrainerMarks.getState();
        if (e.code === 'Digit4') {
          mk.applyMarks([k], { f: !markStarred(mk.marks, k) });
        } else {
          const target: CaseMarkStatus = e.code === 'Digit1' ? 'learning' : e.code === 'Digit2' ? 'mastered' : 'paused';
          mk.applyMarks([k], { s: markStatus(mk.marks, k) === target ? null : target });
        }
        return;
      }
      if (e.code === 'Space' && !useTrainerStore.getState().timing) {
        e.preventDefault();
        if (!e.repeat) advanceScramble();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [prevScramble, advanceScramble]);

  // ── Radial gesture wheel (shared with /timer) ───────────────────
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [copied, setCopied] = useState(false);
  const [metaCase, setMetaCase] = useState<AlgCase | null>(null);
  const [joinCode, setJoinCode] = useState('');

  // 齿轮设置弹出面板(训练选项全收在里面),点外部关闭。
  // 监听 pointerdown 而非 mousedown:stage 手势层在 pointerdown 里 preventDefault,
  // 会抑制后续的兼容性 mousedown —— 挂 mousedown 的话点 stage 空白永远关不上。
  const optsRef = useRef<HTMLDivElement | null>(null);
  const optsPanelRef = useRef<HTMLDivElement | null>(null);
  const [optsOpen, setOptsOpen] = useState(false);
  // 空白按压处理器(下方)是常驻监听、不随 optsOpen 重订阅 —— 用 ref 让它读到当次最新值。
  const optsOpenRef = useRef(false);
  optsOpenRef.current = optsOpen;
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

  // index: 0 next · 1 OK · 2 +2 · 3 DNF · 4 prev · 5 掌握 · 6 del · 7 copy
  // 4/5 原是「看上次/看下次」(翻成绩) —— 与 /timer 对齐改为「上一个」= 上一条打乱
  //(同 ← 键),「看下次」与「下一个」语义重复,删(issue #30)。
  // 5 = 当前 case 标「已掌握」(已掌握则降回学习中),计时流程中手不离开就能标。
  const wheelLabels = [
    tr({ zh: '下一个', en: 'Next' }),
    'OK', '+2', 'DNF',
    tr({ zh: '上一个', en: 'Prev' }),
    tr({ zh: '掌握', en: 'Got it' }),
    tr({ zh: '删除', en: 'Del' }),
    tr({ zh: '复制', en: 'Copy' }),
  ];

  const { wheelRef } = useGestureWheel({
    surfaceRef: stageRef,
    active: stageMounted,
    // 「下一个」等按钮在计时面板内 — 按它们不应触发按压计时(否则点了直接开始计时)。
    // 设置面板开着时整个 stage 也一并跳过:面板外那一下只该关面板,不该切打乱 / 起表。
    ignoreTarget: (t) => optsOpenRef.current || shouldIgnoreTimerTarget(t),
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
        !!st.currentKey,
        hasLast,
        !!st.currentScramble,
      ];
    },
    fireAction: (i) => {
      const st = useTrainerStore.getState();
      const lastIdx = st.solves.length - 1;
      const last = st.solves[lastIdx];
      switch (i) {
        case 0: if (st.timerState === TimerState.NOT_RUNNING) advanceScramble(); break;
        case 1: if (last) setSolvePenalty(lastIdx, 'ok'); break;
        case 2: if (last) setSolvePenalty(lastIdx, last.penalty === '+2' ? 'ok' : '+2'); break;
        case 3: if (last) setSolvePenalty(lastIdx, last.penalty === 'DNF' ? 'ok' : 'DNF'); break;
        case 4: prevScramble(); break;
        case 5: {
          const k = st.currentKey;
          if (!k) break;
          const mk = useTrainerMarks.getState();
          mk.applyMarks([k], { s: markStatus(mk.marks, k) === 'mastered' ? 'learning' : 'mastered' });
          break;
        }
        case 6: if (last) deleteSolve(lastIdx); break;
        case 7: {
          // 复制的是**屏幕上那一份**:开了纯打乱就复制剥净后的文本。
          const raw = st.currentScramble;
          const scr = raw && st.pureScramble ? purifyScramble(puzzle, raw) : raw;
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
      // 不计时模式:单击(未拖动)= 下一个打乱(三条一屏时 = 下一屏三条)
      if (!useTrainerStore.getState().timing) { advanceScramble(); return; }
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
      // 设置面板开着时,面板外的按压只该关面板 —— 不该顺带切打乱/触发计时。
      if (optsOpenRef.current) return;
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
      if (!useTrainerStore.getState().timing) { advanceScramble(); return; }
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
  }, [advanceScramble, stopTimer, getTimerReady, startTimer, setTimerState]);

  // ── 成绩驱动的标记升降级建议(只建议不自动改,标记主权在用户)──
  // 升:该 case 近 5 把全成功,且这 5 把的中位数不慢于本 session 全部成功成绩的中位数
  // 降:已掌握的 case 连续 2 把 DNF。每个 (case, 方向) 一个 session 只提一次。
  const applyMarks = useTrainerMarks(s => s.applyMarks);
  const [suggest, setSuggest] = useState<{ k: string; name: string; kind: 'master' | 'demote' } | null>(null);
  const suggestDismissed = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (solves.length === 0) return;
    const last = solves[solves.length - 1];
    const k = last.caseKey;
    const st = markStatus(useTrainerMarks.getState().marks, k);
    const attempts = solves.filter(s => s.caseKey === k);
    const effMs = (s: { ms: number; penalty: string }) => s.ms + (s.penalty === '+2' ? 2000 : 0);
    const median = (xs: number[]) => {
      const a = [...xs].sort((x, y) => x - y);
      return a.length > 0 ? a[Math.floor(a.length / 2)] : Infinity;
    };
    if (st === 'mastered') {
      const last2 = attempts.slice(-2);
      if (last2.length === 2 && last2.every(s => s.penalty === 'DNF') && !suggestDismissed.current.has(`${k}|demote`)) {
        setSuggest({ k, name: last.caseName, kind: 'demote' });
      }
      return;
    }
    if (st === 'paused') return;
    const last5 = attempts.slice(-5);
    if (last5.length < 5 || !last5.every(s => s.penalty === 'ok')) return;
    const allOk = solves.filter(s => s.penalty === 'ok');
    if (median(last5.map(effMs)) > median(allOk.map(effMs))) return;
    if (suggestDismissed.current.has(`${k}|master`)) return;
    setSuggest({ k, name: last.caseName, kind: 'master' });
  }, [solves]);
  const resolveSuggest = (accept: boolean) => {
    if (!suggest) return;
    if (accept) applyMarks([suggest.k], { s: suggest.kind === 'master' ? 'mastered' : 'learning' });
    suggestDismissed.current.add(`${suggest.k}|${suggest.kind}`);
    setSuggest(null);
  };

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

  // 当前题(左栏大打乱 + 下方 case 图)。
  const currentCase = currentKey ? findCaseByKey(cases, currentKey) ?? null : null;

  // 「下一个」卡片(预览):← 回看过就是历史里 idx+1 那条,否则是预抽的 peek。
  const nextEntry = (hist.idx >= 0 && hist.idx < hist.list.length - 1)
    ? hist.list[hist.idx + 1]
    : peek;
  const nextCase = nextEntry ? findCaseByKey(cases, nextEntry.key) ?? null : null;
  const nextScrambleStr = nextEntry?.scramble ?? null;

  // 「下一个」卡片换题后将显示的那格(再往后一格):在队尾 = 二级预抽 peek2,队尾前一格 = peek,
  // 更靠前 = 历史里 idx+2 那条(已看过、已缓存)。据此提前一格离屏预取,右卡换图也秒出。
  const next2Entry =
    (hist.idx >= 0 && hist.idx + 2 <= hist.list.length - 1) ? hist.list[hist.idx + 2]
    : (hist.idx >= 0 && hist.idx + 1 <= hist.list.length - 1) ? peek
    : peek2;
  const next2Case = next2Entry ? findCaseByKey(cases, next2Entry.key) ?? null : null;

  // 三条一屏只在不计时模式下成立(计时是一把一把的,一屏三条无从计时)。
  const multi = multiScramble && !timing;

  // 「上一个」卡片(回看 + 标记):默认 = 打乱历史里的上一条,与「下一个」= 下一条对称 ——
  // 换题(计时停表 / 空格 / →)时光标一起走,两张卡片同步更新(计时停表后的上一条正好是
  // 你刚做完那把)。在统计里点选某条成绩(pinned)则临时切到那把,标题显示 #N,换题自动解除。
  const pinnedSolve = observingPinned ? (solves[observingIdx] ?? null) : null;
  const prevHistEntry = hist.idx > 0 ? hist.list[hist.idx - 1] : null;
  const prevKey = pinnedSolve?.caseKey ?? prevHistEntry?.key ?? null;
  const prevCase = prevKey ? findCaseByKey(cases, prevKey) ?? null : null;
  const prevSolveScramble = pinnedSolve?.scramble ?? prevHistEntry?.scramble ?? null;
  const prevHeader = pinnedSolve
    ? `#${pinnedSolve.i + 1}`
    : tr({ zh: '上一个', en: 'Previous' });
  // 三条一屏时「上一个」= 上一屏那三条(点一次跨 3 格,所以回看的单位也是一屏三条),
  // 顺序与主屏一致(上屏第 1/2/3 条)。不计时模式下 pinned 恒为空,直接读历史即可。
  const prevTrio = multi
    ? [hist.idx - 3, hist.idx - 2, hist.idx - 1]
        .filter(i => i >= 0)
        .map(i => hist.list[i])
        .filter(Boolean)
    : [];
  // 纯打乱纯粹是**呈现**:store / 历史 / 缩略图 / 云备份仍存原打乱,只有给人看和复制的
  // 那一份剥掉括号与 `↑↓·` 标注。
  const shownScramble = (s: string | null | undefined): string =>
    pureScramble ? purifyScramble(puzzle, s ?? '') : (s ?? '');
  // 标记目标 = 上一个这把(你刚做完 / 刚切过的),数字键 1-4 也打在它上面。
  const pillCase = prevCase;
  pillKeyRef.current = pillCase ? caseKey(pillCase) : null;

  const onNextCase = () => {
    if (timerState === TimerState.NOT_RUNNING) advanceScramble();
  };

  // 不计时没有用时可统计,统计卡片(和它的开关)整块不出现,不是留一个空/永远关着的卡片
  const statsVisible = timing && showStats;

  // pre-AUF 只对「顶层 case + U 可作 AUF」的场景有意义(F2L 类打乱前加 U 会换 case)
  const preAufSupported = (puzzle === '3x3' || puzzle === '2x2') && cases[0]?.sticker.kind !== 'f2l';
  // 真实概率只有带 meta 的 LL set(zbll / pll / ell / 1lll)有数学定义
  const probSupported = puzzle === '3x3' && !!ALG_SET_UNIVERSE[setSlug];
  // recap 进度:进度随「当前题」走(store 的 recapPos 因预抽下一题已领先一格),
  // 直接读当前历史条目上记的 pos/total。
  const recapCur = hist.idx >= 0 ? hist.list[hist.idx]?.recap : undefined;
  const recapShown = mode === 'recap' && !!recapCur;

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
            <Settings size={22} />
          </button>
          {/* 复习进度贴在齿轮右侧(absolute 脱流:齿轮仍精确居中,面板锚点不受影响) */}
          {recapShown && recapCur && (
            <span className="trainer-recap-progress">
              {recapCur.pos}/{recapCur.total}
              {room ? (
                <span className="trainer-recap-coop">
                  {tr({ zh: `房间 ${room.code} 全队`, en: `room ${room.code} team` })}
                </span>
              ) : coop.on && coop.n >= 2 ? (
                <span className="trainer-recap-coop">
                  {tr({ zh: `协同 ${coop.k + 1}/${coop.n} 台`, en: `team ${coop.k + 1}/${coop.n}` })}
                </span>
              ) : null}
            </span>
          )}
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
                  value={mode === 'recap'}
                  onChange={v => setMode(v ? 'recap' : 'train')}
                  onLabel={tr({ zh: '复习', en: 'Recap' })}
                  offLabel={tr({ zh: '训练', en: 'Train' })}
                  ariaLabel={tr({ zh: '训练 / 复习模式', en: 'Train / recap mode' })}
                  disabled={!!room}
                />
                {mode === 'recap' && (
                  <PillToggle
                    value={recapOrder === 'shuffle'}
                    onChange={v => setRecapOrder(v ? 'shuffle' : 'seq')}
                    onLabel={tr({ zh: '乱序', en: 'Shuffled' })}
                    offLabel={tr({ zh: '顺序', en: 'In order' })}
                    ariaLabel={tr({ zh: '复习顺序', en: 'Recap order' })}
                    disabled={!!room}
                  />
                )}
              </div>
              <div className="trainer-opts-hint">
                {mode === 'train'
                  ? tr({ zh: '随机抽取,同一 case 可能连续出现', en: 'Random draw, the same case may repeat' })
                  : tr({
                      zh: '选中的 n 个 case 洗牌后各出一遍,出完重洗。轮内 ≤ n 把必出全部;跨轮看单个 case 最坏间隔 2n−1',
                      en: 'All n selected cases once per shuffled round, reshuffle when done. Every case within ≤ n draws of a round; worst same-case gap across rounds is 2n−1',
                    })}
              </div>
              {/* 在线房间:后端共享队列,多设备原子领取 —— 不重不漏、动态均衡、真·合并进度 */}
              {mode === 'recap' && (
                <>
                  <div className="trainer-opts-row trainer-room-row">
                    {room ? (
                      <>
                        <span className="trainer-room-badge">{tr({ zh: '房间', en: 'Room' })} {room.code}</span>
                        <span className="trainer-opts-label">
                          {tr({ zh: '全队', en: 'Team' })} {roomClaimed}/{room.total}
                        </span>
                        <button type="button" className="trainer-room-btn is-ghost" onClick={leaveRoom}>
                          {tr({ zh: '离开', en: 'Leave' })}
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="trainer-room-btn"
                          onClick={() => void createRoom()}
                          disabled={roomBusy}
                        >
                          {tr({ zh: '创建房间', en: 'Create room' })}
                        </button>
                        <span className="trainer-opts-label">{tr({ zh: '或', en: 'or' })}</span>
                        <input
                          className="trainer-coop-code"
                          type="text"
                          value={joinCode}
                          onChange={e => setJoinCode(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter' && joinCode.trim()) void joinRoom(joinCode).then(r => { if (r.ok) setJoinCode(''); }); }}
                          placeholder={tr({ zh: '房间码', en: 'Code' })}
                          autoComplete="off"
                          spellCheck={false}
                          aria-label={tr({ zh: '房间码', en: 'Room code' })}
                        />
                        <button
                          type="button"
                          className="trainer-room-btn"
                          onClick={() => void joinRoom(joinCode).then(r => { if (r.ok) setJoinCode(''); })}
                          disabled={roomBusy || !joinCode.trim()}
                        >
                          {tr({ zh: '加入', en: 'Join' })}
                        </button>
                      </>
                    )}
                  </div>
                  {roomError && <div className="trainer-opts-hint trainer-room-err">{roomError}</div>}
                  <div className="trainer-opts-hint">
                    {room
                      ? tr({
                          zh: '在线协同:全队共享一条队列,各设备领到的 case 互不重复,合起来正好覆盖全部一次;全队领完自动一起进下一轮',
                          en: 'Online coop: the team shares one queue, each device gets distinct cases that together cover the set exactly once; the round ends for everyone at once',
                        })
                      : tr({
                          zh: '创建房间把当前选中的 case 作为全队题库(按上方顺序/乱序),其他设备输房间码加入,自动分工不重不漏',
                          en: 'Create a room to share the selected cases as the team pool (using the order above); others join by code for automatic, no-overlap division',
                        })}
                  </div>
                </>
              )}
              {/* 本地分片:多台设备帮同一选手打乱时,把复习队列切成 n 份各做一份(离线可用,进房间则隐藏) */}
              {mode === 'recap' && !room && (
                <>
                  <div className="trainer-opts-row">
                    <BoolToggle
                      value={coop.on}
                      onChange={v => setCoop({ ...coop, on: v })}
                      label={tr({ zh: '本地分片', en: 'Local split' })}
                    />
                  </div>
                  {coop.on && (
                    <>
                      <div className="trainer-opts-row trainer-coop-row">
                        {recapOrder === 'shuffle' && (
                          <span className="trainer-coop-field">
                            <span className="trainer-opts-label">{tr({ zh: '协同码', en: 'Code' })}</span>
                            <input
                              className="trainer-coop-code"
                              type="text"
                              value={coop.code}
                              onChange={e => setCoop({ ...coop, code: e.target.value })}
                              placeholder="TEAM"
                              autoComplete="off"
                              spellCheck={false}
                              aria-label={tr({ zh: '协同码', en: 'Team code' })}
                            />
                          </span>
                        )}
                        <span className="trainer-coop-field">
                          <span className="trainer-opts-label">{tr({ zh: '共', en: 'Of' })}</span>
                          <select
                            className="trainer-coop-sel"
                            value={coop.n}
                            onChange={e => setCoop({ ...coop, n: Number(e.target.value) })}
                            aria-label={tr({ zh: '协同设备总数', en: 'Total devices' })}
                          >
                            {[2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n}</option>)}
                          </select>
                          <span className="trainer-opts-label">{tr({ zh: '台', en: 'devices' })}</span>
                        </span>
                        <span className="trainer-coop-field">
                          <span className="trainer-opts-label">{tr({ zh: '本机第', en: 'This is #' })}</span>
                          <select
                            className="trainer-coop-sel"
                            value={coop.k}
                            onChange={e => setCoop({ ...coop, k: Number(e.target.value) })}
                            aria-label={tr({ zh: '本机分片序号', en: 'This device index' })}
                          >
                            {Array.from({ length: coop.n }, (_, i) => <option key={i} value={i}>{i + 1}</option>)}
                          </select>
                        </span>
                      </div>
                      <div className="trainer-opts-hint">
                        {recapOrder === 'shuffle'
                          ? tr({
                              zh: '各设备输入相同协同码 + 相同「共几台」,各选不同「本机第几台」;乱序两台同码才对齐,合起来覆盖全部各一次',
                              en: 'Every device: same code + same total, each picks a distinct index. Shuffled order aligns only when codes match; together they cover every case once',
                            })
                          : tr({
                              zh: '各设备选相同「共几台」+ 不同「本机第几台」,按 set 顺序切分,合起来覆盖全部各一次(顺序模式无需协同码)',
                              en: 'Every device: same total, distinct index. Split by set order covers every case once; no code needed in order mode',
                            })}
                      </div>
                    </>
                  )}
                </>
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
              {preAufSupported && (
                <div className="trainer-opts-row">
                  <BoolToggle value={preAuf} onChange={setPreAuf} label="pre-AUF" />
                  <BoolToggle value={postAuf} onChange={setPostAuf} label="post-AUF" />
                </div>
              )}
              {/* 极简:侧栏两块各自可隐藏(issue #30)。统计=成绩用时列表,不计时根本
                  没有用时可统计 —— 不计时时连开关一起隐掉,而不是留一个永远关着的死开关。 */}
              <div className="trainer-opts-row">
                <BoolToggle
                  value={showStageThumb}
                  onChange={setShowStageThumb}
                  label={tr({ zh: '打乱图', en: 'Cube image' })}
                />
                <BoolToggle
                  value={pureScramble}
                  onChange={setPureScramble}
                  label={tr({ zh: '纯打乱', en: 'Plain scramble' })}
                />
                {/* 三条一屏只在不计时下有意义(计时是一把一把的),与「统计」正好互补出现 */}
                {!timing && (
                  <BoolToggle
                    value={multiScramble}
                    onChange={setMultiScramble}
                    label={tr({ zh: '三条一屏', en: 'Three at once' })}
                  />
                )}
                {timing && (
                  <BoolToggle
                    value={showStats}
                    onChange={setShowStats}
                    label={tr({ zh: '统计', en: 'Stats' })}
                  />
                )}
              </div>
              {/* 三条一屏时「下一个」已经在主屏第 2 条里,那张卡片不出 —— 开关一起隐掉,
                  不留一个按了没反应的死开关;「上一个」则整屏回看,改叫「上三个」。 */}
              <div className="trainer-opts-row">
                <BoolToggle
                  value={showPrevCard}
                  onChange={setShowPrevCard}
                  label={multi ? tr({ zh: '上三个', en: 'Previous 3' }) : tr({ zh: '上一个', en: 'Previous' })}
                />
                {!multi && (
                  <BoolToggle
                    value={showNextCard}
                    onChange={setShowNextCard}
                    label={tr({ zh: '下一个', en: 'Next' })}
                  />
                )}
              </div>
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
              <div className="trainer-opts-help">
                {timing
                  ? tr({ zh: '空格开始/停止，按住拖动呼出轮盘', en: 'Space to start/stop, hold & drag for the wheel' })
                  : tr({ zh: '单击、空格或 → 键切下一个打乱', en: 'Click, Space or → for the next scramble' })}
              </div>
              <div className="trainer-opts-help">
                {multi
                  ? tr({
                      zh: '数字键 1 学习中、2 已掌握、3 搁置、4 星标,标在「上三个」最后一条;其余两条点卡片上的标记条',
                      en: 'Keys 1 learning, 2 mastered, 3 paused, 4 star — mark the last of “Previous 3”; use each card’s mark bar for the other two',
                    })
                  : tr({
                      zh: '数字键 1 学习中、2 已掌握、3 搁置、4 星标,标在「上一个」case',
                      en: 'Keys 1 learning, 2 mastered, 3 paused, 4 star — mark the “Previous” case',
                    })}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className={`trainer-run${showPrevCard || (showNextCard && !multi) || statsVisible ? '' : ' trainer-run--solo'}`}>
        <div className="trainer-stage" ref={stageRef}>
          {/* 三条一屏:当前 + 屏上第 2、3 条(队尾时 = 预抽的 peek / peek2,回看过则是历史里
              后两条),拧完三条再点一次切下一屏。打乱与图交错成六行,每条紧跟自己那张图。
              图走 local 渲染:三张与三条文字在同一次 commit 出现,不再各自等自己的网络往返。 */}
          {multi ? (
            <div className="trainer-scramble-multi">
              {[
                { s: currentScramble, c: currentCase },
                { s: nextEntry?.scramble ?? null, c: nextCase },
                { s: next2Entry?.scramble ?? null, c: next2Case },
              ]
                .filter(row => !!row.s)
                .map((row, i) => (
                  <div className="trainer-scramble-row" key={i}>
                    <ScrambleHeader
                      scramble={shownScramble(row.s)}
                      label={i === 0 && copied ? tr({ zh: '已复制', en: 'Copied' }) : undefined}
                      font={scrambleFont}
                    />
                    {showStageThumb && row.c && (
                      <CaseThumb
                        puzzle={puzzle}
                        set={setSlug}
                        sticker={row.c.sticker}
                        alg={row.c.algs.flat()[0]?.alg ?? row.c.standard ?? ''}
                        setup={row.s ?? row.c.setup}
                        size={140}
                        local
                      />
                    )}
                  </div>
                ))}
            </div>
          ) : (
            <ScrambleHeader
              scramble={shownScramble(currentScramble)}
              label={copied ? tr({ zh: '已复制', en: 'Copied' }) : undefined}
              font={scrambleFont}
            />
          )}
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

          {timing && (
            <TimerDisplay
              state={timerState}
              ms={ms}
              penalty={solves.length > 0 ? solves[solves.length - 1].penalty : undefined}
              font={timerFont}
            />
          )}

          {/* 当前这道题的 case 图(左栏下方):看得见正在练的这一把。
              图从「实际打乱」渲染(含 pre/post-AUF),与上方打乱公式朝向一致。
              三条一屏时图已经跟在各自那条打乱下面(见上),这里不再重复出。 */}
          {!multi && showStageThumb && currentCase && (
            <div className="trainer-stage-thumb">
              <CaseThumb
                puzzle={puzzle}
                set={setSlug}
                sticker={currentCase.sticker}
                alg={currentCase.algs.flat()[0]?.alg ?? currentCase.standard ?? ''}
                setup={currentScramble ?? currentCase.setup}
                size={140}
              />
            </div>
          )}
          {/* 离屏预取即将要显示的图(全部 size=140,与左栏/卡片同一 URL → 共用浏览器缓存):
              ① next(换题后 = 左栏当前图 / 也是「上一个」卡片的图);② next2(换题后 =「下一个」
              卡片的图,靠二级预抽 peek2 提前一格备好)。换题时三处都命中缓存秒出,不等网络往返
              (打乱公式是本地状态所以本就瞬间出)。任一缩略图开着就预取。 */}
          {(showStageThumb || showNextCard || showPrevCard) && (
            <div className="trainer-thumb-prefetch" aria-hidden>
              {nextCase && nextScrambleStr && (
                <CaseThumb
                  puzzle={puzzle}
                  set={setSlug}
                  sticker={nextCase.sticker}
                  alg={nextCase.algs.flat()[0]?.alg ?? nextCase.standard ?? ''}
                  setup={nextScrambleStr}
                  size={140}
                />
              )}
              {next2Case && next2Entry?.scramble && (
                <CaseThumb
                  puzzle={puzzle}
                  set={setSlug}
                  sticker={next2Case.sticker}
                  alg={next2Case.algs.flat()[0]?.alg ?? next2Case.standard ?? ''}
                  setup={next2Entry.scramble}
                  size={140}
                />
              )}
            </div>
          )}

          {suggest && (
            <div className="trainer-mark-suggest" data-no-timer>
              <span>
                {suggest.kind === 'master'
                  ? tr({
                      zh: `${suggest.name} 近 5 把全部顺利,标为已掌握?`,
                      en: `Last 5 of ${suggest.name} all clean — mark as mastered?`,
                    })
                  : tr({
                      zh: `已掌握的 ${suggest.name} 连挂 2 把,降回学习中?`,
                      en: `${suggest.name} (mastered) failed twice in a row — back to learning?`,
                    })}
              </span>
              <button type="button" className="trainer-quick-btn" onClick={() => resolveSuggest(true)}>
                {tr({ zh: '标记', en: 'Mark' })}
              </button>
              <button type="button" className="trainer-quick-btn" onClick={() => resolveSuggest(false)}>
                {tr({ zh: '忽略', en: 'Dismiss' })}
              </button>
            </div>
          )}
        </div>

        {(showPrevCard || (showNextCard && !multi) || statsVisible) && (
          <aside className="trainer-sidebar">
            {/* 上一个:刚做完那把(图+名+打乱)+ 标记条,标记打在这把上。第一把之前无成绩,不出。
                三条一屏 → 上三个:上一屏那三条各一张卡片,每张自带标记条(键盘 1-4 仍打最近那条)。 */}
            {showPrevCard && multi && prevTrio.map((e, i) => {
              const c = findCaseByKey(cases, e.key) ?? null;
              if (!c) return null;
              return (
                <SolveCard
                  key={`${e.key}-${i}`}
                  puzzle={puzzle}
                  set={setSlug}
                  scramble={shownScramble(e.scramble)}
                  c={c}
                  isZh={isZh}
                  onShowCase={c.meta ? (cc) => setMetaCase(cc) : undefined}
                  header={i === 0 ? tr({ zh: '上三个', en: 'Previous 3' }) : undefined}
                  markSlot={<CaseMarkBar k={caseKey(c)} />}
                />
              );
            })}
            {showPrevCard && !multi && prevCase && (
              <SolveCard
                puzzle={puzzle}
                set={setSlug}
                scramble={shownScramble(prevSolveScramble)}
                c={prevCase}
                isZh={isZh}
                onShowCase={prevCase.meta ? (c) => setMetaCase(c) : undefined}
                header={prevHeader}
                markSlot={<CaseMarkBar k={caseKey(prevCase)} />}
              />
            )}
            {/* 下一个:预览待做那把(图+名+打乱),不带标记。
                三条一屏时它已经在主屏第 2 条里,不再重复出一张卡片。 */}
            {showNextCard && !multi && (
              <SolveCard
                puzzle={puzzle}
                set={setSlug}
                scramble={shownScramble(nextScrambleStr)}
                c={nextCase}
                isZh={isZh}
                onShowCase={nextCase?.meta ? (c) => setMetaCase(c) : undefined}
                header={tr({ zh: '下一个', en: 'Next up' })}
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

      {/* 协同复习:本机这一份出完 → 弹「本轮复习结束」,「继续下一轮」进下一轮。
          零后端:各设备各自在自己那份出完时弹,不跨设备等齐(份额相近,大致同时)。 */}
      {recapRoundDone && (
        <div
          className="trainer-round-modal-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={continueRecapRound}
        >
          <div className="trainer-round-modal" onClick={e => e.stopPropagation()}>
            <h2>{tr({ zh: '本轮复习结束', en: 'Round complete' })}</h2>
            <p>
              {room
                ? tr({
                    zh: `全队已刷完本轮全部 ${room.total} 个 case!点「继续下一轮」大家一起开新一轮${room.order === 'shuffle' ? '(重新洗牌)' : ''}。`,
                    en: `The team finished all ${room.total} cases this round! Hit “Next round” to start a fresh round together${room.order === 'shuffle' ? ' (reshuffled)' : ''}.`,
                  })
                : tr({
                    zh: `本机第 ${coop.k + 1}/${coop.n} 份已全部过完${recapCur ? `(${recapCur.total} 把)` : ''}。各设备刷完自己那份即完成本轮 —— 大家一起进下一轮。`,
                    en: `This device finished its share (#${coop.k + 1} of ${coop.n}${recapCur ? `, ${recapCur.total} cases` : ''}). Every device completes its own share — start the next round together.`,
                  })}
            </p>
            <button
              type="button"
              className="trainer-round-modal-btn"
              onClick={continueRecapRound}
              autoFocus
            >
              {tr({ zh: '继续下一轮', en: 'Next round' })}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

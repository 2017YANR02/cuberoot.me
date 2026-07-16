'use client';

// Ported from packages/client-vite/src/pages/trainer/TrainerRunPage.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from '@/components/AppLink';
import { useParams } from 'next/navigation';
import { useQueryState } from 'nuqs';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { getAlgSetMeta, loadAlg, type AlgCase } from '@cuberoot/shared';
import { useTrainerStore, TimerState, trainerPool, type TrainerTimerFont } from '@/lib/trainer-store';
import { useSpaceHoldTimer } from '@/hooks/useSpaceHoldTimer';
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

/** 计时数字字体(默认 lcd = /timer 同款七段;其余为站内自托管字体)。 */
const TIMER_FONTS: ReadonlyArray<{ id: TrainerTimerFont; label: () => string }> = [
  { id: 'lcd', label: () => tr({ zh: 'LCD 七段', en: 'LCD' }) },
  { id: 'mono', label: () => 'Roboto Mono' },
  { id: 'liberation', label: () => 'Liberation Mono' },
  { id: 'sans', label: () => 'Inter' },
];

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
  const currentScramble = useTrainerStore(s => s.currentScramble);
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
  const timing = useTrainerStore(s => s.timing);
  const setTiming = useTrainerStore(s => s.setTiming);
  const mode = useTrainerStore(s => s.mode);
  const setMode = useTrainerStore(s => s.setMode);
  const probMode = useTrainerStore(s => s.probMode);
  const setProbMode = useTrainerStore(s => s.setProbMode);
  const timerFont = useTrainerStore(s => s.timerFont);
  const setTimerFont = useTrainerStore(s => s.setTimerFont);
  const recapQueue = useTrainerStore(s => s.recapQueue);
  const recapPos = useTrainerStore(s => s.recapPos);
  const nextScramble = useTrainerStore(s => s.nextScramble);
  const prevScramble = useTrainerStore(s => s.prevScramble);
  const getTimerReady = useTrainerStore(s => s.getTimerReady);
  const startTimer = useTrainerStore(s => s.startTimer);
  const stopTimer = useTrainerStore(s => s.stopTimer);
  const setTimerState = useTrainerStore(s => s.setTimerState);
  const setObservingIdx = useTrainerStore(s => s.setObservingIdx);
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
  const stageMounted = !!(puzzle && meta) && !(pool.length === 0 && cases.length > 0);

  /** meta.no → case:元数据弹窗里的镜像 / 逆链接用(同 AlgCategoryView) */
  const byNo = useMemo(() => {
    const m = new Map<number, AlgCase>();
    for (const c of cases) if (c.meta?.no != null) m.set(c.meta.no, c);
    return m;
  }, [cases]);

  // index: 0 new · 1 OK · 2 +2 · 3 DNF · 4 prev-solve · 5 next-solve · 6 del · 7 copy
  const wheelLabels = [
    tr({ zh: '下一个', en: 'Next' }),
    'OK', '+2', 'DNF',
    tr({ zh: '看上次', en: 'Prev solve' }),
    tr({ zh: '看下次', en: 'Next solve' }),
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
        st.observingIdx > 0,
        st.observingIdx < st.solves.length - 1,
        hasLast,
        !!st.currentScramble,
      ];
    },
    fireAction: (i) => {
      const st = useTrainerStore.getState();
      const lastIdx = st.solves.length - 1;
      const last = st.solves[lastIdx];
      const obs = st.observingIdx;
      switch (i) {
        case 0: if (st.timerState === TimerState.NOT_RUNNING) nextScramble(); break;
        case 1: if (last) setSolvePenalty(lastIdx, 'ok'); break;
        case 2: if (last) setSolvePenalty(lastIdx, last.penalty === '+2' ? 'ok' : '+2'); break;
        case 3: if (last) setSolvePenalty(lastIdx, last.penalty === 'DNF' ? 'ok' : 'DNF'); break;
        case 4: if (obs > 0) setObservingIdx(obs - 1); break;
        case 5: if (obs < st.solves.length - 1) setObservingIdx(obs + 1); break;
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
  const observingCase = observingSolve
    ? findCaseByKey(cases, observingSolve.caseKey) ?? null
    : null;

  const onNextCase = () => {
    if (timerState === TimerState.NOT_RUNNING) nextScramble();
  };

  /**
   * 选中的这批 case 一共支持哪几种打乱(并集)。只有一种(全是 `inv`)就不渲染选择器。
   * 不是每个 case 都有全套 —— 表里验不过轨道判据的打乱没入库,generateScramble 会退回 `inv`。
   */
  const kinds = useMemo(() => {
    const seen = new Set<ScrambleKind>();
    for (const k of pool) {
      const c = findCaseByKey(cases, k);
      if (c) for (const kind of availableKinds(c)) seen.add(kind);
    }
    return SCRAMBLE_KINDS.filter(k => seen.has(k.id));
  }, [pool, cases]);

  // 改了选中的 case 之后,原先选的那种打乱可能一个 case 都不再支持 —— 此时 <select> 的
  // value 落空、显示成一片空白。退回 `inv`(它永远支持)。
  useEffect(() => {
    if (kinds.length && !kinds.some(k => k.id === scrambleKind)) setScrambleKind('inv');
  }, [kinds, scrambleKind, setScrambleKind]);

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
      </div>

      <div className="trainer-run">
        <div className="trainer-stage" ref={stageRef}>
          <ScrambleHeader
            scramble={currentScramble || ''}
            label={copied ? tr({ zh: '已复制', en: 'Copied' }) : undefined}
          />
          <div className="trainer-stage-actions">
            <button
              className="trainer-stage-btn"
              onClick={onNextCase}
              disabled={timerState !== TimerState.NOT_RUNNING}
            >
              <ArrowRight size={12} /> {tr({ zh: '下一个', en: 'Next'
            })}
            </button>
            {kinds.length > 1 && (
              <select
                className="trainer-scramble-kind"
                value={scrambleKind}
                onChange={e => setScrambleKind(e.target.value as ScrambleKind)}
                disabled={timerState !== TimerState.NOT_RUNNING}
                aria-label={tr({ zh: '打乱类型', en: 'Scramble type' })}
              >
                {kinds.map(k => <option key={k.id} value={k.id}>{k.label()}</option>)}
              </select>
            )}
          </div>

          <div className="trainer-stage-opts">
            <PillToggle
              value={mode === 'train'}
              onChange={v => setMode(v ? 'train' : 'recap')}
              onLabel={tr({ zh: '训练', en: 'Train' })}
              offLabel={tr({ zh: '复习', en: 'Recap' })}
              ariaLabel={tr({ zh: '训练 / 复习模式', en: 'Train / recap mode' })}
            />
            <PillToggle
              value={timing}
              onChange={setTiming}
              onLabel={tr({ zh: '计时', en: 'Timing' })}
              offLabel={tr({ zh: '不计时', en: 'No timer' })}
              ariaLabel={tr({ zh: '是否计时', en: 'Timing on/off' })}
            />
            {preAufSupported && (
              <BoolToggle value={preAuf} onChange={setPreAuf} label="pre-AUF" />
            )}
            {probSupported && mode === 'train' && (
              <PillToggle
                value={probMode === 'uniform'}
                onChange={v => setProbMode(v ? 'uniform' : 'real')}
                onLabel={tr({ zh: '均等概率', en: 'Uniform' })}
                offLabel={tr({ zh: '真实概率', en: 'Real odds' })}
                ariaLabel={tr({ zh: '出题概率模式', en: 'Case probability mode' })}
              />
            )}
            {timing && (
              <select
                className="trainer-scramble-kind"
                value={timerFont}
                onChange={e => setTimerFont(e.target.value as TrainerTimerFont)}
                aria-label={tr({ zh: '计时字体', en: 'Timer font' })}
              >
                {TIMER_FONTS.map(f => <option key={f.id} value={f.id}>{f.label()}</option>)}
              </select>
            )}
            {recapShown && (
              <span className="trainer-recap-progress">
                {tr({ zh: '复习进度', en: 'Recap' })} {Math.min(recapPos, recapTotal)}/{recapTotal}
              </span>
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

          {timing && solves.length === 0 && (
            <div className="trainer-help">
              {tr({ zh: '空格开始/停止，按住拖动呼出轮盘', en: 'Space to start/stop, hold & drag for the wheel'
              })}
            </div>
          )}
          {!timing && (
            <div className="trainer-help">
              {tr({ zh: '单击、空格或 → 键切下一个打乱', en: 'Click, Space or → for the next scramble'
              })}
            </div>
          )}
        </div>

        <aside className="trainer-sidebar">
          <SolveCard
            puzzle={puzzle}
            set={setSlug}
            solve={observingSolve}
            c={observingCase}
            isZh={isZh}
            onShowCase={observingCase?.meta ? (c) => setMetaCase(c) : undefined}
            header={observingSolve
              ? `#${observingSolve.i + 1}`
              : tr({ zh: '当前', en: 'Current'
                            })}
          />
          <StatsList
            solves={solves}
            observingIdx={observingIdx}
            isZh={isZh}
            onPick={(i) => setObservingIdx(i)}
            onClear={() => {
              if (confirm(tr({ zh: '清空所有成绩?', en: 'Clear all solves?'
            })))
                clearSolves();
            }}
          />
        </aside>
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

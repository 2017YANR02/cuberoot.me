'use client';

/**
 * BattleView — the 对战 (1v1 Battle) mode hosted inside /timer.
 *
 * This is the battle experience that used to be its own /battle route. The
 * engine (battle_store.ts) + the RAF DOM-write timer hooks are kept
 * BEHAVIORALLY UNTOUCHED — they still write timeRef.innerHTML directly with ZERO
 * per-tick React render. Components + engine now live in ../_battle, since
 * /timer is their only consumer.
 *
 * Changes vs the old standalone page:
 *   - accepts the shell `playersControl` (人数 select) and renders it into the
 *     battle middle-bar; player count itself comes in as a prop from TimerShell
 *   - mode is always 1v1 (the face of 双人/Duo); the internal solo/1v1 toggle was
 *     removed — the top-level 单人/Solo (SoloView) covers single-player
 *   - supports 2~4 players (?players= URL param): 2 keeps the original
 *     versus/side layouts; 3/4 render a 田字格 grid (top cells rotated 180°),
 *     with per-cell score/event/penalty controls (CellControls)
 *   - per-player event picker uses components/WcaEventSelector (green active)
 *     instead of BattleEventPicker + the in-area overlay grid
 *   - icon_timer.png nav icon is replaced with lucide Timer (no-emoji rule)
 *   - no RankBadge here: the WR/NR badge is a Solo-only affordance (SoloView),
 *     多人对战比的是同一条打乱下谁更快,叠一层世界排名只是噪音
 *   - imports re-pointed to timer/_shared (stats-core / format)
 */

import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryState, parseAsString } from 'nuqs';
import { Settings as SettingsIcon, ClipboardList, RotateCcw, Timer as TimerIcon } from 'lucide-react';
import { useBattleStore, battleToTimerEvent, timerToBattleEvent, keyToPlayer, prefetchBattleScrambles, isScrambleHidden } from '@/app/[lang]/timer/_battle/engine/battle_store';
import { PUZZLES, PENALTY, I18N_TEXT, BG_MAX_BYTES } from '@/app/[lang]/timer/_battle/engine/constants';
import { loadScrambleEngine } from '@/app/[lang]/timer/_battle/engine/engine_loader';
import { formatTimeHtml as formatTime } from '@/app/[lang]/timer/_shared/format';
import { computeAo5 } from '@/app/[lang]/timer/_shared/stats-core';
import { formatScrambleForEvent } from '@cuberoot/shared/sq1-notation';

import { TimerStageLayout, TimerBattleToolbar, TimerBattleSettings, TimerBattleLayout, TimerBattleLayoutControls, TimerBattlePlayer, TimerPenaltyActions, TimingSurface, shouldIgnoreTimerTarget } from '@cuberoot/timer-ui';
import { BattleDeviceCenter, BattleCubesProvider, BattleCubeSettingsGroup, BattleCubeDot, useBattleCubesCtx } from '@/app/[lang]/timer/_battle/BattleCubes';
import HistoryPanel from '@/app/[lang]/timer/_battle/HistoryPanel';
import VsHistoryPanel from '@/app/[lang]/timer/_battle/VsHistoryPanel';
import { MilestoneToast } from '@/app/[lang]/timer/_battle/AdvancedFeatures';
import CubeRootLogo from '@/components/CubeRootLogo';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import CubingPreview from '@/components/CubingPreview';
import WcaEventSelector from '@/components/WcaEventSelector';
import { EventIcon } from '@/components/EventIcon';
import { isWcaEvent } from '@/lib/wca-events';
import { ALL_EVENT_IDS } from '@/lib/event-constants';
import { eventInfo, fromWcaSpelling } from '@/app/[lang]/timer/_lib/types';
import { useSettings, updateSettings } from '@/app/[lang]/timer/_lib/settings';
import WcaSourceConfig from '@/components/WcaSourceConfig';
import { wcaMetaFor } from '@/app/[lang]/timer/_lib/scramble/wca_pool';
import { Flag } from '@/components/Flag';
import { compFlagIso2, loadFlagData, flagDataVersion } from '@/lib/country-flags';
import { localizeCompName } from '@/lib/comp-localize';
import { compSourceLine } from '@/lib/comp-schedule';

import '@/app/[lang]/timer/_battle/battle.css';
import './shell.css';
import { tr } from '@/i18n/tr';
import BoolToggle from '@/components/BoolToggle';
import { battlePresenceMix, type TimerPresenceReport } from '@/app/[lang]/timer/_lib/presence';

function BattlePresenceReporter({
  playerCount,
  onChange,
}: {
  playerCount: number;
  onChange?: (report: TimerPresenceReport) => void;
}) {
  const { isLive, handleFor } = useBattleCubesCtx();
  const cubeMode = useBattleStore(s => s.cubeMode);
  const players = useBattleStore(s => s.players);
  const puzzleIds = useBattleStore(s => s.puzzleIds);
  const connected = [0, 1, 2, 3].map(isLive);
  const mix = battlePresenceMix(playerCount, cubeMode, connected);
  const events = Array.from(new Set(
    puzzleIds.slice(0, playerCount).map(battleToTimerEvent),
  ));
  const results = players.slice(0, playerCount).flatMap((player, index) => {
    const solve = player.solveHistory.at(-1);
    if (!solve) return [];
    const at = Date.parse(solve.date);
    return [{
      label: `P${index + 1}`,
      event: battleToTimerEvent(puzzleIds[index]),
      timeMs: solve.time,
      penalty: solve.penalty === 'dnf' ? 'dnf' as const : solve.penalty as 'ok' | '+2',
      ...(Number.isFinite(at) ? { at } : {}),
    }];
  });
  const devices = Array.from(new Map(
    Array.from({ length: playerCount }, (_, index) => handleFor(index)?.status)
      .filter(status => status?.connected)
      .map(status => [status!.deviceId || status!.deviceName, {
        name: status!.deviceName,
        ...(status!.deviceId ? { id: status!.deviceId } : {}),
      }]),
  ).values());
  const report: TimerPresenceReport = {
    ...mix,
    mode: 'local',
    players: playerCount,
    events,
    results,
    devices,
  };
  const signature = JSON.stringify(report);
  useEffect(() => { onChange?.(report); }, [signature, onChange]);
  return null;
}

// NOTE: 根据打乱字符串长度自动计算字号缩放因子
// ≤100 字符（2x2~3x3）= 1.0，更长则 sqrt 曲线平滑缩小，最小 0.7
function getScrambleAutoScale(scramble: string): number {
  if (!scramble) return 1;
  const len = scramble.length;
  if (len <= 100) return 1;
  return Math.max(0.7, Math.sqrt(100 / len));
}

// NOTE: 选择器的可选集 + 「其他」追加项全部由 PUZZLES 派生(PUZZLES 本身派生自 timer 的
// BATTLE_EVENT_IDS),不再手写第二份清单 —— 往对战里加项目只改那张表即可。
// ALL_EVENT_IDS(WCA 21 项)里有的走官方图标网格,没有的(fto / kilominx)走 appendEvents;
// 两者都有 unofficial-* 内联图标,故 iconClass 直接给 EventIcon 的映射键。
// tooltip 不传 label:eventDisplayName(id, isZh) 已双语覆盖 fto / kilominx,传死字符串反而丢中文。
const BATTLE_APPEND_EVENTS: ReadonlyArray<{ id: string; iconClass: string; textLabel?: string }> =
  PUZZLES.filter(p => !ALL_EVENT_IDS.includes(p.id)).map(p => ({
    id: p.id,
    iconClass: eventInfo(fromWcaSpelling(p.id)).icon ?? '',
    textLabel: p.name.en,
  }));
const BATTLE_AVAILABLE_EVENTS = new Set<string>(PUZZLES.map(p => p.id));

// NOTE: 键盘控制 hook — 1:1 翻译自 battle.js handleKeyDown/handleKeyUp（行 755~783）
// 输入控件聚焦时跳过(设置面板里有比赛搜索输入框,空格/字母不能被计时器吃掉)
export function isBattleKeyboardExcludedTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const t = target;
  return t.tagName === 'INPUT'
    || t.tagName === 'TEXTAREA'
    || t.tagName === 'SELECT'
    || t.isContentEditable
    || Boolean(t.closest('[data-no-timer]'));
}

export function useKeyboardControls(suppressed: boolean) {
  const keyPressedRef = useRef<Record<string, boolean>>({});

  useEffect(() => {
    keyPressedRef.current = {};
    if (suppressed) {
      const store = useBattleStore.getState();
      for (let playerId = 0; playerId < store.playerCount; playerId++) {
        store.playerCancel(playerId);
      }
      return;
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      const store = useBattleStore.getState();
      if (store.recordingKeyFor !== null) return; // 设置面板正在录键,这次按键归它处理

      const playerId = keyToPlayer(store.playerKeys, e.key);
      if (playerId === undefined) return;
      if (isBattleKeyboardExcludedTarget(e.target)) return;

      if (store.mode === 'solo' && playerId !== 0) return;
      // 未参战槽位的键不拦(4 人键位默认 Q/P,自定义后同理,在 2 人模式下保持正常输入行为)
      if (store.mode !== 'solo' && playerId >= store.playerCount) return;

      e.preventDefault();

      if (keyPressedRef.current[e.key]) return;
      keyPressedRef.current[e.key] = true;

      store.playerDown(playerId);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const store = useBattleStore.getState();
      if (store.recordingKeyFor !== null) return;
      const playerId = keyToPlayer(store.playerKeys, e.key);
      if (playerId === undefined) return;
      if (isBattleKeyboardExcludedTarget(e.target)) return;
      if (store.mode !== 'solo' && playerId >= store.playerCount) return;

      e.preventDefault();
      keyPressedRef.current[e.key] = false;

      store.playerUp(playerId);
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
    };
  }, [suppressed]);
}

// NOTE: 计时器动画 hook — 通过 RAF 直接写 DOM（不走 React state）
// 1:1 翻译自 battle.js startTimerAnimation()（行 918~934）
function useTimerAnimation(playerId: number, timeRef: React.RefObject<HTMLDivElement | null>) {
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const unsubscribe = useBattleStore.subscribe((state) => {
      const p = state.players[playerId];
      if (p.isTiming && !rafRef.current) {
        // 开始 RAF 循环
        const tick = () => {
          const curr = useBattleStore.getState();
          const cp = curr.players[playerId];
          if (!cp.isTiming) {
            rafRef.current = null;
            return;
          }
          const elapsed = performance.now() - cp.startTime;
          const timeStr = curr.showTime ? formatTime(elapsed, curr.timerPrecision) : '';
          if (timeRef.current) {
            timeRef.current.innerHTML = timeStr;
          }
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      } else if (!p.isTiming && rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    });

    return () => {
      unsubscribe();
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [playerId, timeRef]);
}

// NOTE: WCA Inspection 倒计时显示 — 通过 subscribe 直接写 DOM
function useInspectionDisplay(playerId: number, timeRef: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const unsubscribe = useBattleStore.subscribe((state) => {
      const p = state.players[playerId];
      if (p.isInspecting && timeRef.current) {
        const elapsed = (performance.now() - p.inspectionStart) / 1000;
        const limit = state.inspectionTime;
        if (limit < 9999) {
          if (elapsed >= limit + 2) {
            timeRef.current.textContent = 'DNF';
          } else if (elapsed >= limit) {
            timeRef.current.textContent = '+2';
          } else {
            timeRef.current.textContent = Math.floor(elapsed).toString();
          }
        } else {
          timeRef.current.textContent = Math.floor(elapsed).toString();
        }
      }
    });
    return () => unsubscribe();
  }, [playerId, timeRef]);
}

// ===== ScramblePanel 组件 =====
// 打乱文字 + 打乱图 + WCA 来源行。可被同排一对玩家共用:
//   ids = 参与共享的玩家槽位,取 ids[0] 为代表读打乱(同 puzzle 时全组打乱相等);
//   任一玩家计时中则整条隐藏。单人格传 [playerId],共享行传该排的一对(如 [0,1] / [2,3])。
function ScramblePanel({ ids, imgHeight, part = 'all' }: { ids: number[]; imgHeight?: string; part?: 'all' | 'text' | 'preview' }) {
  const store = useBattleStore();
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  const rep = ids[0];
  // 藏打乱的判据在引擎里(各自开始时要等最后一个人也起表,见 isScrambleHidden)
  const anyTiming = isScrambleHidden(store.players, ids);
  const scrambleRef = useRef<HTMLDivElement>(null);
  // WCA 来源行:打乱图正下方显示「国旗 + 比赛名 · 轮次/组别」。国旗 + 中文名需异步
  // 加载的比赛索引,落地后 bump flagVer 重渲。
  const [flagVer, setFlagVer] = useState(() => flagDataVersion());
  useEffect(() => { void loadFlagData().then((v) => setFlagVer((cur) => (v !== cur ? v : cur))); }, []);

  // 打乱文字只作展示;阻止 pointer 冒泡到 .player-area，避免误起表。
  // 共享行虽在 player-area 之外,保留此拦截无害。
  useEffect(() => {
    const el = scrambleRef.current;
    if (!el) return;
    const stop = (e: PointerEvent) => e.stopPropagation();
    const preventDefault = (event: Event) => event.preventDefault();
    el.addEventListener('touchstart', preventDefault, { passive: false });
    el.addEventListener('selectstart', preventDefault);
    el.addEventListener('contextmenu', preventDefault);
    el.addEventListener('pointerdown', stop);
    el.addEventListener('pointerup', stop);
    el.addEventListener('pointercancel', stop);
    return () => {
      el.removeEventListener('touchstart', preventDefault);
      el.removeEventListener('selectstart', preventDefault);
      el.removeEventListener('contextmenu', preventDefault);
      el.removeEventListener('pointerdown', stop);
      el.removeEventListener('pointerup', stop);
      el.removeEventListener('pointercancel', stop);
    };
  }, []);
  const myScramble = store.scrambles[rep];
  const myLoading = store.scrambleLoadings[rep];
  const myPuzzle = store.puzzleIds[rep];
  // SQ1 shows compact notation (4/-36/...) site-wide; keep the raw csTimer form
  // (with parens) for the CubingPreview below, which cubing.js parses. Errors pass through.
  const myScrambleDisplay = myScramble && !myScramble.startsWith('⚠️')
    ? formatScrambleForEvent(myPuzzle, myScramble)
    : myScramble;
  const scrambleContent = myLoading
    ? `<span class="loading">${I18N_TEXT.generating[store.locale]}</span>`
    : (myScrambleDisplay || '');

  // WCA 来源:当前打乱若来自真实比赛(wca_pool 派发过),显示其比赛 / 轮次 / 组别。
  // 随机生成的打乱不在 meta 表里 → 返回 null,这行自然不显示。
  const wmeta = (!myLoading && myScramble) ? wcaMetaFor(myScramble) : null;
  const wcaSrc = useMemo(() => {
    if (!wmeta) return null;
    return {
      iso2: compFlagIso2(wmeta.ci),
      name: localizeCompName(wmeta.ci, wmeta.cn, isZh),
      meta: compSourceLine(wmeta.r, wmeta.g, wmeta.n, isZh, !!wmeta.x),
    };
    // flagVer: 比赛索引落地后重新派生国旗 + 中文名。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wmeta, isZh, flagVer]);

  return (
    <>
      {/* 打乱文字 — 放在打乱图正上方 */}
      {part !== 'preview' && <div
        ref={scrambleRef}
        className={`scramble-text${anyTiming ? ' hidden' : ''}`}
        data-no-timer
        style={{ '--scramble-auto': getScrambleAutoScale(myScrambleDisplay || ''), cursor: 'default' } as React.CSSProperties}
        dangerouslySetInnerHTML={{ __html: scrambleContent }}
      />}
      {/* 打乱图 — 复用 timer 的 CubingPreview（scramble-display） */}
      {part !== 'text' && <div className={`scramble-img${anyTiming ? ' hidden' : ''}`}>
        {myScramble && !myScramble.startsWith('⚠️') && store.showImage && (
          <CubingPreview event={myPuzzle} scramble={myScramble} className="scramble-svg-img" height={imgHeight} />
        )}
      </div>}

      {/* WCA 来源行(真实比赛打乱时) */}
      {part !== 'preview' && wcaSrc && !anyTiming && (
        <div className="battle-scramble-src" data-no-timer>
          <Flag iso2={wcaSrc.iso2} className="battle-src-flag" />
          <span className="battle-src-name">{wcaSrc.name}</span>
          {wcaSrc.meta && <span className="battle-src-meta">{wcaSrc.meta}</span>}
        </div>
      )}
    </>
  );
}

// ===== TimerArea 组件 =====
// 1:1 翻译自 battle/index.html player-area 结构

export function battlePointerReleaseAction(
  eventType: 'pointerup' | 'pointercancel' | 'lostpointercapture',
): 'up' | 'cancel' {
  return eventType === 'pointerup' ? 'up' : 'cancel';
}

export function TimerArea({ playerId, rotated, hideScramble, cellClass }: { playerId: number; rotated?: boolean; hideScramble?: boolean; cellClass?: string; controlsCorner?: 'left' | 'right' | 'center' }) {
  const player = useBattleStore(s => s.players[playerId]);
  const store = useBattleStore();
  const areaRef = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const timeRef = useRef<HTMLDivElement>(null);

  // NOTE: 高频计时器动画（不走 React re-render）
  useTimerAnimation(playerId, timeRef);
  // NOTE: Inspection 倒计时显示
  useInspectionDisplay(playerId, timeRef);

  // NOTE: 原生 pointer 事件处理 — 每位玩家独立 pointerId(两个拇指可独立 arm)
  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;

    const onDown = (e: PointerEvent) => {
      if (shouldIgnoreTimerTarget(e.target)) return;
      const curr = useBattleStore.getState();
      const p = curr.players[playerId];
      if (p.pointerId !== null) return;

      el.setPointerCapture(e.pointerId);

      const newPlayers = [...curr.players];
      newPlayers[playerId] = { ...p, pointerId: e.pointerId };
      useBattleStore.setState({ players: newPlayers });

      curr.playerDown(playerId);
    };

    const onRelease = (
      e: PointerEvent,
      eventType: 'pointerup' | 'pointercancel' | 'lostpointercapture',
    ) => {
      const curr = useBattleStore.getState();
      const p = curr.players[playerId];
      if (p.pointerId !== e.pointerId) return;

      const newPlayers = [...curr.players];
      newPlayers[playerId] = { ...p, pointerId: null };
      useBattleStore.setState({ players: newPlayers });

      if (battlePointerReleaseAction(eventType) === 'up') curr.playerUp(playerId);
      else curr.playerCancel(playerId);
    };
    const onUp = (e: PointerEvent) => onRelease(e, 'pointerup');
    const onCancel = (e: PointerEvent) => onRelease(e, 'pointercancel');
    const onLostCapture = (e: PointerEvent) => onRelease(e, 'lostpointercapture');

    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onCancel);
    el.addEventListener('lostpointercapture', onLostCapture);

    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onCancel);
      el.removeEventListener('lostpointercapture', onLostCapture);
      const curr = useBattleStore.getState();
      const p = curr.players[playerId];
      if (p.pointerId !== null) {
        const newPlayers = [...curr.players];
        newPlayers[playerId] = { ...p, pointerId: null };
        useBattleStore.setState({ players: newPlayers });
        curr.playerCancel(playerId);
      }
    };
  }, [playerId]);

  const areaClasses = [
    'player-area',
    cellClass || '',
    rotated ? 'rotated' : '',
    player.canStart ? 'state-can-start' : '',
    player.isReady && !player.canStart ? 'state-ready' : '',
    player.isTiming ? 'is-timing' : '',
    player.isInspecting ? 'state-inspecting' : '',
  ].filter(Boolean).join(' ');

  // NOTE: 构建时间显示内容（非计时状态时由 React 渲染，计时中由 RAF 渲染）
  const renderTimeContent = () => {
    if (player.isTiming) return ''; // RAF 会接管
    if (player.isInspecting) return ''; // 由 subscription 接管
    if (player.time === 0) return '0.000';
    if (player.penalty === PENALTY.DNF) return 'DNF';

    const displayTime = player.penalty === PENALTY.PLUS2
      ? player.time + 2000
      : player.time;
    const suffix = player.penalty === PENALTY.PLUS2
      ? '<span class="plus-suffix">+</span>'
      : '';
    const html = formatTime(displayTime, store.timerPrecision) + suffix;

    return html;
  };

  const timeClasses = [
    'time-display',
    player.penalty === PENALTY.PLUS2 ? 'penalty-plus2' : '',
    player.penalty === PENALTY.DNF ? 'penalty-dnf' : '',
    store.winners.includes(playerId) ? 'winner' : '',
  ].filter(Boolean).join(' ');

  const ao5 = computeAo5(player.solveHistory);
  const ao5Text = ao5 === null ? '' : (ao5 === Infinity ? 'ao5: DNF' : 'ao5: ' + formatTime(ao5, store.timerPrecision));

  const bgColor = store.bgColors[playerId];
  const bgImage = store.bgImages[playerId];
  const bgStyle: React.CSSProperties = {
    '--bg-image': bgImage ? `url(${bgImage})` : 'none',
    '--bg-color': bgColor || '',
    '--bg-opacity': String(store.bgOpacity),
  } as React.CSSProperties;

  return (
    <div
      className={areaClasses}
      ref={areaRef}
      style={bgStyle}
    >
      <TimerBattlePlayer playerNumber={playerId + 1} language={store.locale === 'zh' ? 'zh' : 'en'}
        score={player.points} winner={store.winners.includes(playerId)}
        controls={<><BattleEventButton playerId={playerId} /><BattleCubeDot playerId={playerId} /></>}
        actions={player.hasFinished && !player.isTiming && player.time > 0 ? (
          <TimerPenaltyActions language={store.locale === 'zh' ? 'zh' : 'en'} value={player.penalty}
            onChange={(penalty) => store.handlePenalty(playerId, penalty)} />
        ) : undefined}
      >
      <TimingSurface
        layout="local"
        phase={player.isTiming ? 'running' : player.isInspecting ? 'inspecting' : 'idle'}
        colorClass=""
        surfaceRef={surfaceRef}
        digits={<div className={timeClasses} ref={timeRef}
          dangerouslySetInnerHTML={{ __html: renderTimeContent() }} />}
        scrambleSlot={!hideScramble && <ScramblePanel ids={[playerId]} part="text" />}
        cornerSlot={!hideScramble && store.showImage
          ? <ScramblePanel ids={[playerId]} part="preview" imgHeight="var(--timer-cube-h)" />
          : undefined}
      >
        <div className="ao5-display" dangerouslySetInnerHTML={{ __html: ao5Text }} />
      </TimingSurface>
      </TimerBattlePlayer>

      {/* Event picker 全区域覆盖 — 由项目图标按钮触发,改用 WcaEventSelector */}
      {store.eventPickerOpen[playerId] && (
        <EventPickerOverlay playerId={playerId} />
      )}
    </div>
  );
}

// ===== EventPickerOverlay 组件 =====
// 覆盖整个 player-area,内部用项目站全站统一的 WcaEventSelector(绿色 active)

function EventPickerOverlay({ playerId }: { playerId: number }) {
  const store = useBattleStore();
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  const value = store.puzzleIds[playerId];
  const overlayRef = useRef<HTMLDivElement>(null);

  // NOTE: 父级 .player-area 用原生 addEventListener 处理 pointerdown/up 进入计时状态。
  useEffect(() => {
    const el = overlayRef.current;
    if (!el) return;
    const stop = (e: Event) => e.stopPropagation();
    el.addEventListener('pointerdown', stop);
    el.addEventListener('pointerup', stop);
    el.addEventListener('pointercancel', stop);
    return () => {
      el.removeEventListener('pointerdown', stop);
      el.removeEventListener('pointerup', stop);
      el.removeEventListener('pointercancel', stop);
    };
  }, []);

  const select = (id: string) => {
    store.changePuzzle(playerId, id);
    store.setEventPickerOpen(playerId, false);
  };

  return (
    <div
      ref={overlayRef}
      className="event-overlay"
      data-no-timer
      onClick={(e) => {
        // NOTE: 点空白处关闭
        if (e.target === e.currentTarget) store.setEventPickerOpen(playerId, false);
      }}
    >
      <div className="event-overlay-inner">
        <WcaEventSelector presentation="inline"
          availableEvents={BATTLE_AVAILABLE_EVENTS}
          isZh={isZh}
          selectedEvent={value}
          onSelect={select}
          appendEvents={BATTLE_APPEND_EVENTS}
          onlyAvailable
        />
      </div>
    </div>
  );
}

// ===== BattleEventButton — middle-bar / cell 控制条上的 trigger 图标 =====
function BattleEventButton({ playerId }: { playerId: number }) {
  const { i18n } = useTranslation();
  const value = useBattleStore(s => s.puzzleIds[playerId]);
  const isOpen = useBattleStore(s => s.eventPickerOpen[playerId]);
  const setOpen = useBattleStore(s => s.setEventPickerOpen);

  const renderIcon = (id: string) => {
    if (isWcaEvent(id)) return <EventIcon event={id} />;
    const p = PUZZLES.find(x => x.id === id);
    return <span className="event-fallback">{p?.name.en || id}</span>;
  };

  const currentName = (() => {
    const p = PUZZLES.find(x => x.id === value);
    return p ? (p.name[(i18n.language.startsWith('zh') ? 'zh' : 'en')] || p.name.en) : value;
  })();

  return (
    <button
      type="button"
      className={`event-btn${isOpen ? ' active' : ''}`}
      onClick={(e) => { e.stopPropagation(); setOpen(playerId, !isOpen); }}
      aria-label={currentName}
      title={currentName}
    >
      {renderIcon(value)}
    </button>
  );
}

// ===== MiddleBar 组件 =====
// 1:1 翻译自 battle/index.html middle-bar 结构 + 人数下拉注入
// 多人(>2)时左右比分区移到各 cell 的 CellControls,这里只留中间操作区

// ===== BackgroundSettingsGroup 组件 =====

function PlayerBgRow({ playerId, isZh }: { playerId: number; isZh: boolean }) {
  const store = useBattleStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const onColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    store.setBgColor(playerId, e.target.value);
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > BG_MAX_BYTES) {
      setError((isZh
                  ? `图片太大(${(file.size / 1024 / 1024).toFixed(1)} MB),≤4MB`
                  : `Image too large (${(file.size / 1024 / 1024).toFixed(1)} MB), ≤4MB`));
      e.target.value = '';
      setTimeout(() => setError(null), 3000);
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const url = ev.target?.result;
      if (typeof url === 'string') {
        store.setBgImage(playerId, url);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const colorVal = store.bgColors[playerId] || '#000000';
  const hasImage = !!store.bgImages[playerId];

  return (
    <div className="bg-row">
      <span className="bg-row-label">P{playerId + 1}</span>
      <div className="bg-controls">
        <input
          type="color"
          className="bg-color-picker"
          value={colorVal}
          onChange={onColorChange}
          title={tr({ zh: '背景色', en: 'Background color' })}
        />
        <button
          type="button"
          className={`bg-image-btn${hasImage ? ' has-image' : ''}`}
          onClick={() => fileInputRef.current?.click()}
          title={tr({ zh: '上传背景图', en: 'Upload image'
        })}
        >
          {(isZh ? (hasImage ? '已上传' : '图片') : (hasImage ? 'Set' : 'Image'))}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={onFileChange}
        />
        <button
          type="button"
          className="bg-reset-btn"
          onClick={() => store.resetBg(playerId)}
          title={tr({ zh: '重置', en: 'Reset' })}
        >
          ✕
        </button>
      </div>
      {error && <div className="bg-error-msg">{error}</div>}
    </div>
  );
}

function BackgroundSettingsGroup({ mode, isZh }: { mode: string; isZh: boolean }) {
  const store = useBattleStore();
  const rowCount = mode === '1v1' ? store.playerCount : 1;
  return (
    <div className="settings-group">
      <div className="settings-label">{tr({ zh: '背景', en: 'Background' })}</div>
      {Array.from({ length: rowCount }, (_, i) => (
        <PlayerBgRow key={i} playerId={i} isZh={isZh} />
      ))}
      <div className="setting-item slider-row">
        <span>{tr({ zh: '不透明度', en: 'Opacity' })}</span>
        <span className="delay-value">{store.bgOpacity.toFixed(2)}</span>
        <input
          type="range"
          min="0.1"
          max="1.0"
          step="0.05"
          value={store.bgOpacity}
          onChange={e => store.setBgOpacity(parseFloat(e.target.value))}
        />
      </div>
    </div>
  );
}

// ===== SettingsPanel 组件 =====

function SettingsPanel({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const store = useBattleStore();
  const settings = useSettings();
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  if (!visible) return null;
  return <TimerBattleSettings language={isZh ? 'zh' : 'en'} onClose={onClose}
    keys={store.playerKeys.slice(0, store.playerCount)} onKeyChange={store.setPlayerKey}
    precision={{ value: store.timerPrecision, onChange: store.setTimerPrecision }}
    inspection={{ value: store.inspectionTime, onChange: store.setInspectionTime, options: [0, 8, 15, 9999] }}
    hold={{ value: store.startDelay, onChange: store.setStartDelay }}
    preview={{ value: store.showImage, onChange: store.setShowImage }}
    hideTime={{ value: !store.showTime, onChange: () => store.toggleShowTime() }}
    source={<div className="settings-group">
      <label className="setting-item"><span>{tr({ en: 'Scramble source', zh: '打乱来源' })}</span>
        <select className="settings-select" value={settings.scrambleSource === 'wca' ? 'wca' : 'random'}
          onChange={(event) => updateSettings({ scrambleSource: event.target.value as 'random' | 'wca' })}>
          <option value="wca">{tr({ en: 'WCA real', zh: 'WCA 真题' })}</option>
          <option value="random">{tr({ en: 'Random', zh: '随机生成' })}</option>
        </select>
      </label>
      {settings.scrambleSource === 'wca' && <WcaSourceConfig isZh={isZh} event={battleToTimerEvent(store.puzzleIds[0])} settings={settings} updateSettings={updateSettings} />}
    </div>}
    devices={<BattleCubeSettingsGroup />}>
    <BoolToggle value={store.syncStart} onChange={store.setSyncStart} label={tr({ en: 'Start together', zh: '同时开始' })} />
    <BoolToggle value={store.voice} onChange={store.setVoice} label={tr({ en: 'Voice alert', zh: '语音提示' })} />
    <label className="setting-item"><span>{tr({ en: 'Scramble size', zh: '打乱大小' })}</span>
      <input type="range" min={0.5} max={2} step={0.1} value={store.scrambleScale} onChange={(event) => store.setScrambleScale(Number(event.target.value))} />
    </label>
    <label className="setting-item"><span>{tr({ en: 'Phases', zh: '分段' })}</span>
      <select value={store.phases} onChange={(event) => store.setPhases(Number(event.target.value))}>
        <option value={1}>1</option><option value={2}>2 (BLD)</option><option value={4}>4 (CFOP)</option>
      </select>
    </label>
    <BackgroundSettingsGroup mode={store.mode} isZh={isZh} />
    <button className="settings-action-btn danger" onClick={() => { store.resetAll(); onClose(); }}>
      <RotateCcw size={16} />{tr({ en: 'Reset All', zh: '全部重置' })}
    </button>
  </TimerBattleSettings>;
}
// ===== 主组件 =====

interface BattleViewProps {
  /** 参战人数(2~4),由 TimerShell 的 ?players= URL 参数驱动 */
  playerCount: number;
  /** 人数下拉(TimerShell 构建),注入到 middle-bar */
  playersControl?: React.ReactNode;
  presenceControl?: React.ReactNode;
  onPresenceChange?: (report: TimerPresenceReport) => void;
}

export default function BattleView({ playerCount, playersControl, presenceControl, onPresenceChange }: BattleViewProps) {
  const { i18n } = useTranslation();
  const store = useBattleStore();
  const { mode } = store;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [vsHistoryOpen, setVsHistoryOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  useKeyboardControls(settingsOpen || vsHistoryOpen);

  // NOTE: 人数由 URL 驱动(TimerShell),store 跟随同步
  useEffect(() => {
    useBattleStore.getState().setPlayerCount(playerCount);
  }, [playerCount]);

  // 各玩家项目进 URL(?event=,与 Solo 用同一 timer EventId 记号、逗号分隔、按
  // 玩家顺序,强制显式展示 —— 用户选了不同项目时也要能看到/分享)。
  //   有 ?event= 且和当前 store 不同 → 以 URL 为准写回 store(分享链接场景,只跑一次);
  //   否则 store.puzzleIds 变了就强制写回 URL(localStorage 落地的默认值也要显式展示)。
  const [eventsParam, setEventsParam] = useQueryState('event', parseAsString.withOptions({ history: 'replace' }));
  const validBattleIds = useMemo(() => new Set(PUZZLES.map(p => p.id)), []);
  const battleUrlInitRef = useRef(false);
  useEffect(() => {
    if (battleUrlInitRef.current || !eventsParam) return;
    battleUrlInitRef.current = true;
    eventsParam.split(',').slice(0, playerCount).forEach((timerId, i) => {
      const battleId = timerToBattleEvent(timerId);
      if (validBattleIds.has(battleId) && battleId !== useBattleStore.getState().puzzleIds[i]) {
        useBattleStore.getState().changePuzzle(i, battleId);
      }
    });
  }, [eventsParam, playerCount, validBattleIds]);
  useEffect(() => {
    const ids = store.puzzleIds.slice(0, playerCount).map(battleToTimerEvent).join(',');
    if (ids && eventsParam !== ids) void setEventsParam(ids, { history: 'replace' });
  }, [store.puzzleIds, playerCount, eventsParam, setEventsParam]);

  useDocumentTitle(playerCount > 2 ? '多人' : '双人', playerCount > 2 ? 'Multi' : 'Duo');
  // SSG/first-paint gate: battle_store 默认值从 localStorage 读 (mode/layout/...),
  // SSR shim 返 null → 默认 1v1/versus,client 端读到真实值就不同。SSG /timer 页
  // 出空占位,client 挂载后再 render(镜像 TimerShell 的 mounted 门控)。
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // NOTE: 双人模式恒为 1v1(单人/1v1 切换已移除,顶层 Solo 覆盖单人;持久化的旧 solo 强制翻 1v1)
  const defaultedRef = useRef(false);
  useEffect(() => {
    if (defaultedRef.current) return;
    defaultedRef.current = true;
    if (useBattleStore.getState().mode === 'solo') {
      useBattleStore.getState().setMode('1v1');
    }
  }, []);

  // NOTE: 同步 i18n.language → store.locale
  useEffect(() => {
    useBattleStore.getState().setLocale(i18n.language);
  }, [i18n.language]);

  // 打乱来源(共享 timer 设置)变化时,预热 WCA 池并重生当前打乱。compName 逐键变动
  // 不计入签名(只看 comp id),避免边搜边换。首挂载跳过(init 已生成首个打乱)。
  const settings = useSettings();
  const wcaSig = settings.scrambleSource === 'wca'
    ? `wca|${settings.wcaScrambleMode}|${settings.wcaComp}|${settings.wcaRound}|${settings.wcaGroup}|${settings.wcaDateFrom}|${settings.wcaDateTo}`
    : 'random';
  const wcaSigInitRef = useRef(true);
  useEffect(() => {
    prefetchBattleScrambles();
    if (wcaSigInitRef.current) { wcaSigInitRef.current = false; return; }
    useBattleStore.getState().loadNewScramble();
  }, [wcaSig]);

  // NOTE: 监听 checkMilestone/checkFatigue 派发的自定义事件
  useEffect(() => {
    const handler = (e: Event) => {
      const msg = (e as CustomEvent).detail as string;
      setToastMsg(msg);
    };
    window.addEventListener('battle-milestone', handler);
    return () => window.removeEventListener('battle-milestone', handler);
  }, []);

  // NOTE: 初始化 store — 加载历史 + 生成第一个打乱。等打乱引擎就位再 init,
  // 否则首个打乱会撞上还没注入的 scrMgr。
  useEffect(() => {
    void loadScrambleEngine().then(() => useBattleStore.getState().init());
  }, []);

  // NOTE: 应用 solo class 到 body（1:1 翻译自 applyMode）
  useEffect(() => {
    document.body.classList.toggle('solo', mode === 'solo');
    return () => {
      document.body.classList.remove('solo');
    };
  }, [mode]);

  // NOTE: 同步 scrambleScale CSS 变量
  useEffect(() => {
    document.documentElement.style.setProperty('--scramble-scale', String(store.scrambleScale));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const closeSettings = useCallback(() => {
    setSettingsOpen(false);
    if (mode === 'solo') {
      store.switchTab('timer');
    }
  }, [mode, store]);

  const handleSettingsClick = useCallback(() => {
    if (mode === 'solo') {
      store.switchTab('settings');
    } else {
      setSettingsOpen(true);
    }
  }, [mode, store]);

  if (!mounted) {
    // SSG/first-paint placeholder — 避免 hydration mismatch 重建整树。
    return <div className="battle-container" />;
  }

  // 3/4 人:田字格布局(忽略 versus/side,横竖屏同构)
  const isGrid = mode === '1v1' && playerCount > 2;
  // 同排一对玩家 puzzle 相同时(同 puzzle 打乱本就相等,见 loadNewScramble),
  // 只在两格之间渲染一份共享打乱;不同项目则各自沿用格内打乱(共享行塌陷)。
  const bottomSame = store.puzzleIds[0] === store.puzzleIds[1];
  const topSame = store.puzzleIds[2] === store.puzzleIds[3];
  // 上排是否翻转 180°(围坐一桌面向对面 = true;同向观看 = false,用户可关)。
  //   关掉后上排文字/图正立,控制条也从「对面视角上角」回到本屏上角。
  const flipTop = store.flipTopRow;
  const middleBar = <TimerBattleToolbar language={i18n.language === 'zh' ? 'zh' : 'en'}
    onSettings={handleSettingsClick} onHistory={() => setVsHistoryOpen(true)}
    controls={<>{playersControl}{presenceControl}</>} brand={<CubeRootLogo className="middle-logo" />} />;
  return (
    <BattleCubesProvider>
      <BattlePresenceReporter playerCount={playerCount} onChange={onPresenceChange} />
      <div className={`battle-container${mode === '1v1' && !isGrid && store.layout === 'side' ? ' side-layout' : ''}${mode === '1v1' && !isGrid && store.layout === 'side' && bottomSame ? ' side-shared' : ''}${isGrid ? ' grid-layout' : ''}`}>

      <TimerStageLayout devices={mode === '1v1' ? <BattleDeviceCenter /> : undefined}>
      {mode === '1v1' && <TimerBattleLayoutControls
        playerCount={playerCount as 2 | 3 | 4} layout={store.layout} flipTopRow={flipTop}
        language={store.locale === 'zh' ? 'zh' : 'en'} onLayoutChange={store.setLayout} onFlipChange={store.setFlipTopRow}
      />}
      {mode === '1v1' && (
        <TimerBattleLayout
          playerCount={playerCount as 2 | 3 | 4}
          layout={store.layout}
          flipTopRow={flipTop}
          middle={middleBar}
          bottomScramble={bottomSame ? <ScramblePanel ids={[0, 1]} imgHeight="var(--timer-cube-h)" /> : undefined}
          topScramble={topSame ? <ScramblePanel ids={[2, 3]} /> : undefined}
          renderPlayer={(playerId, cell) => <TimerArea playerId={playerId}
            hideScramble={cell.hideScramble} controlsCorner={cell.controlsCorner} />}
        />
      )}
      </TimerStageLayout>
      {/* === Solo 模式 === */}
      {mode === 'solo' && (
        <TimerArea playerId={0} />
      )}

      {/* 底部导航栏 — Solo 模式;人数下拉也塞在这里(solo 没 middle-bar) */}
      {mode === 'solo' && (
        <nav className="bottom-nav" data-no-timer>
          <div className="bottom-nav-mode">{playersControl}</div>
          <button
            className={`nav-tab${store.activeTab === 'timer' ? ' active' : ''}`}
            onClick={() => store.switchTab('timer')}
          >
            {/* lucide Timer 替代 icon_timer.png(no-emoji / no raster) */}
            <TimerIcon size={22} className="nav-tab-icon" />
            <span>{tr({ zh: '计时', en: 'Timer'
            })}</span>
          </button>
          <button
            className={`nav-tab${store.activeTab === 'results' ? ' active' : ''}`}
            onClick={() => store.switchTab('results')}
          >
            <ClipboardList size={22} />
            <span>{tr({ zh: '成绩', en: 'Results'
            })}</span>
          </button>
          <button
            className={`nav-tab${store.activeTab === 'settings' ? ' active' : ''}`}
            onClick={() => store.switchTab('settings')}
          >
            <SettingsIcon size={22} />
            <span>{tr({ zh: '设置', en: 'Settings'
            })}</span>
          </button>
        </nav>
      )}

      {mode === '1v1' && (
        <SettingsPanel visible={settingsOpen} onClose={closeSettings} />
      )}

      {/* 1v1 对战历史面板 */}
      {mode === '1v1' && vsHistoryOpen && (
        <VsHistoryPanel onClose={() => setVsHistoryOpen(false)} />
      )}

      {/* 设置面板 — Solo tab 模式 */}
      {mode === 'solo' && store.activeTab === 'settings' && (
        <SettingsPanel visible={true} onClose={() => store.switchTab('timer')} />
      )}

      {/* 历史面板 — Solo results tab */}
      {mode === 'solo' && store.activeTab === 'results' && (
        <div className="history-overlay visible">
          <HistoryPanel />
        </div>
      )}

      {/* 里程碑 Toast */}
      {toastMsg && (
        <MilestoneToast message={toastMsg} onDone={() => setToastMsg(null)} />
      )}
      </div>
    </BattleCubesProvider>
  );
}

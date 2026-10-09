'use client';

import { LOCAL_BATTLE_SCRAMBLE_COPY } from '@cuberoot/shared/timer';
import {
  TimerBattleAppearanceSettings,
  TimerBattleSourceSettings,
  TimerLocalBattlePage,
  TimerLocalBattlePlayer,
} from '@cuberoot/timer-ui';

/**
 * Web adapter for the shared local battle layout, player controls and dialogs.
 * The battle store, RAF timer nodes, WCA source and device transports stay here.
 */

import {
  battleToTimerEvent,
  isScrambleHidden,
  keyToPlayer,
  prefetchBattleScrambles,
  timerToBattleEvent,
  useBattleStore,
} from '@/app/[lang]/timer/_battle/engine/battle_store';
import { PENALTY, PUZZLES } from '@/app/[lang]/timer/_battle/engine/constants';
import { loadScrambleEngine } from '@/app/[lang]/timer/_battle/engine/engine_loader';
import { formatTimeHtml as formatTime } from '@/app/[lang]/timer/_shared/format';
import { computeAo5 } from '@/app/[lang]/timer/_shared/stats-core';
import { formatScrambleForEvent } from '@cuberoot/shared/sq1-notation';
import { parseAsString, useQueryState } from 'nuqs';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { MilestoneToast } from '@/app/[lang]/timer/_battle/AdvancedFeatures';
import { useBattleHistoryProps } from '@/app/[lang]/timer/_battle/VsHistoryPanel';
import { updateSettings, useSettings } from '@/app/[lang]/timer/_lib/settings';
import { eventInfo } from '@/app/[lang]/timer/_lib/types';
import HomeLink from '@/components/HomeLink';
import { ArrowLeft } from 'lucide-react';
import WcaSourceConfig from '@/components/WcaSourceConfig';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { localizeCompName } from '@/lib/comp-localize';
import { compFlagIso2, flagDataVersion, loadFlagData } from '@/lib/country-flags';
import { TIMER_EVENT_PICKER_GROUPS, timerEventIdFromSelector, timerEventSelectorId } from '@cuberoot/shared/timer';
import {
  TimerBattleSettings,
  TimerCubePreview,
  timerCubePreviewAspect,
  TimerPenaltyActions,
  TimerPuzzlePicker,
  TimerScrambleStrip,
  TimerWcaScrambleSource,
  shouldIgnoreTimerTarget,
  useTimerBattleOrientation,
} from '@cuberoot/timer-ui';

import '@/app/[lang]/timer/_battle/battle.css';
import { battlePresenceMix, type TimerPresenceReport } from '@/app/[lang]/timer/_lib/presence';
import { tr } from '@/i18n/tr';
import './shell.css';

function BattlePresenceReporter({
  playerCount,
  onChange,
}: {
  playerCount: number;
  onChange?: (report: TimerPresenceReport) => void;
}) {
  const players = useBattleStore(s => s.players);
  const puzzleIds = useBattleStore(s => s.puzzleIds);
  const mix = battlePresenceMix(playerCount, 'own', [false, false, false, false]);
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
  const report: TimerPresenceReport = {
    ...mix,
    mode: 'local',
    players: playerCount,
    events,
    results,
    devices: [],
  };
  const signature = JSON.stringify(report);
  useEffect(() => { onChange?.(report); }, [signature, onChange]);
  return null;
}

const BATTLE_AVAILABLE_EVENTS = new Set(PUZZLES.map(p => p.id));

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
      for (let playerId = 0;playerId < store.playerCount;playerId++) {
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
    let frame = 0;
    const update = () => {
      const state = useBattleStore.getState();
      const p = state.players[playerId];
      if (p.isInspecting && timeRef.current) {
        const elapsed = (performance.now() - p.inspectionStart) / 1000;
        const limit = p.timerState?.inspectionSec ?? state.inspectionTime;
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
      frame = requestAnimationFrame(update);
    };
    frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
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
  const [flagVer, setFlagVer] = useState(() => flagDataVersion());
  useEffect(() => { void loadFlagData().then((version) => setFlagVer(version)); }, []);
  const scramble = store.scrambles[rep];
  const loading = store.scrambleLoadings[rep];
  const event = battleToTimerEvent(store.puzzleIds[rep]);
  const failed = store.scrambleErrors[rep];
  const meta = !loading && scramble ? store.scrambleRows[rep]?.wca ?? null : null;
  const source = useMemo(() => meta ? {
    country: compFlagIso2(meta.ci), name: localizeCompName(meta.ci, meta.cn, isZh),
  } : null, [meta, isZh, flagVer]);
  if (anyTiming) return null;
  return <>
    {part !== 'preview' && <TimerScrambleStrip scramble={loading || failed ? '' : formatScrambleForEvent(event, scramble || '')}
      copiedLabel={tr({ en: 'Copied', zh: '已复制' })} fontScale={store.scrambleScale}
      verificationLabels={{ copiedCorrection: tr({ en: 'Copied the scramble', zh: '已复制原打乱' }) }}
      status={loading ? { kind: 'loading', message: tr({ en: 'Generating scramble…', zh: '生成打乱中…' }) }
        : failed ? { kind: 'error', message: tr(LOCAL_BATTLE_SCRAMBLE_COPY.failed), onRetry: () => store.loadNewScramble(rep), retryLabel: tr({ en: 'Retry', zh: '重试' }) } : undefined}
      fallback={tr({ en: 'No scramble', zh: '暂无打乱' })} fallbackKind="custom">
      {meta && source && <TimerWcaScrambleSource competitionName={source.name} country={source.country}
        eventId={meta.e} eventLabel={isZh ? eventInfo(event).nameZh : eventInfo(event).nameEn}
        groupId={meta.g} roundTypeId={meta.r} scrambleNumber={meta.n} isExtra={meta.x === 1}
        href={`${isZh ? '/zh' : ''}/scramble/gen?comp=${encodeURIComponent(meta.ci)}`}
        title={tr({ en: 'View competition scrambles', zh: '查看比赛打乱' })} />}
    </TimerScrambleStrip>}
    {part !== 'text' && scramble && !failed && !loading && store.showImage &&
      <TimerCubePreview event={event} scramble={scramble} height={imgHeight} fill={part === 'preview'} visualization="2D"
        ariaLabel={tr({ en: 'Scramble preview', zh: '打乱预览' })} />}
  </>;
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


  return (
    <div
      className={areaClasses}
      ref={areaRef}
    >
      <TimerLocalBattlePlayer player={{
        background: { color: store.bgColors[playerId], image: store.bgImages[playerId], opacity: store.bgOpacity },
        playerNumber: playerId + 1,
        language: store.locale === 'zh' ? 'zh' : 'en',
        score: player.points,
        winner: store.winners.includes(playerId),
        actions: player.hasFinished && !player.isTiming && player.time > 0 ? (
          <TimerPenaltyActions language={store.locale === 'zh' ? 'zh' : 'en'} value={player.penalty}
            onChange={(penalty) => store.handlePenalty(playerId, penalty)} />
        ) : undefined
      }} timing={{
        phase: player.isTiming ? 'running' : player.isInspecting ? 'inspecting' : 'idle',
        colorClass: "",
        surfaceRef: surfaceRef,
        digits: <div className={timeClasses} ref={timeRef}
          dangerouslySetInnerHTML={{ __html: renderTimeContent() }} />,
        scrambleSlot: !hideScramble && <ScramblePanel ids={[playerId]} part="text" />,
        cornerAspect: timerCubePreviewAspect(battleToTimerEvent(store.puzzleIds[playerId]), store.scrambles[playerId]),
        cornerSlot: !hideScramble && store.showImage
          ? <ScramblePanel ids={[playerId]} part="preview" imgHeight="var(--timer-cube-h)" />
          : undefined
      }}
        average={<div className="ao5-display" dangerouslySetInnerHTML={{ __html: ao5Text }} />} />
    </div>
  );
}

// Keep the picker controlled by the battle store so open menus block timing.
function BattleEventButton({ playerId }: { playerId: number }) {
  const { i18n } = useTranslation();
  const value = useBattleStore(s => s.puzzleIds[playerId]);
  const isOpen = useBattleStore(s => s.eventPickerOpen[playerId]);
  const setOpen = useBattleStore(s => s.setEventPickerOpen);
  const changeAllPuzzles = useBattleStore(s => s.changeAllPuzzles);
  const languageIndex = Number(i18n.language === 'zh');
  const groups = TIMER_EVENT_PICKER_GROUPS.map(group => ({
    id: group.id,
    label: [group.nameEn, group.nameZh][languageIndex],
    items: group.items.filter(item => {
      const event = timerEventIdFromSelector(item.id);
      return event !== null && BATTLE_AVAILABLE_EVENTS.has(timerToBattleEvent(event));
    }).map(item => ({
      id: item.id, label: [item.nameEn, item.nameZh][languageIndex],
      iconClass: item.iconClass, textLabel: item.textLabel,
    })),
  }));
  return (
    <TimerPuzzlePicker dataNoTimer groups={groups}
      puzzleLabel={tr({ en: 'Puzzle', zh: '项目' })}
      scrambleTypeLabel={tr({ en: 'Scramble type', zh: '打乱类型' })}
      selectedEvent={timerEventSelectorId(battleToTimerEvent(value))}
      open={isOpen} onOpenChange={open => setOpen(playerId, open)}
      onSelect={id => {
        const event = timerEventIdFromSelector(id);
        if (event) {
          changeAllPuzzles(timerToBattleEvent(event));
        }
      }} />
  );
}
// ===== BackgroundSettingsGroup 组件 =====

// ===== SettingsPanel 组件 =====

function useBattleSettingsProps(onClose: () => void): React.ComponentProps<typeof TimerBattleSettings> {
  const store = useBattleStore();
  const settings = useSettings();
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  return {
    layout: store.mode === '1v1' ? {
      playerCount: store.playerCount as 2 | 3 | 4, layout: store.layout, flipTopRow: store.flipTopRow,
      onLayoutChange: store.setLayout, onFlipChange: store.setFlipTopRow,
    } : undefined,
    language: isZh ? 'zh' : 'en',
    onClose: onClose,
    onReset: () => store.resetAll(),
    keys: store.playerKeys.slice(0, store.playerCount),
    onKeyChange: store.setPlayerKey,
    precision: { value: store.timerPrecision, onChange: store.setTimerPrecision },
    inspection: { value: store.inspectionTime, onChange: store.setInspectionTime, options: [0, 8, 15, 9999] },
    syncStart: { value: store.syncStart, onChange: store.setSyncStart },
    hold: { value: store.startDelay, onChange: store.setStartDelay },
    preview: { value: store.showImage, onChange: store.setShowImage },
    hideTime: { value: !store.showTime, onChange: () => store.toggleShowTime() },
    source: <TimerBattleSourceSettings language={tr({ en: 'en' as const, zh: 'zh' as const })}
      value={settings.scrambleSource === 'wca' ? 'wca' : 'random'} onChange={scrambleSource => updateSettings({ scrambleSource })}>
      <WcaSourceConfig isZh={isZh} event={battleToTimerEvent(store.puzzleIds[0])} settings={settings} updateSettings={updateSettings} />
    </TimerBattleSourceSettings>, children: <> <TimerBattleAppearanceSettings language={tr({ en: 'en' as const, zh: 'zh' as const })} playerCount={store.playerCount}
      value={{ bgColors: store.bgColors, bgImages: store.bgImages, bgOpacity: store.bgOpacity, scrambleScale: store.scrambleScale }}
      onChange={patch => {
        if (patch.scrambleScale !== undefined) store.setScrambleScale(patch.scrambleScale);
        if (patch.bgOpacity !== undefined) store.setBgOpacity(patch.bgOpacity);
        for (let id = 0;id < store.playerCount;id++) {
          if (patch.bgImages?.[id] && patch.bgImages[id] !== store.bgImages[id]) store.setBgImage(id, patch.bgImages[id]);
          else if (patch.bgColors && (patch.bgColors[id] !== store.bgColors[id] || patch.bgImages?.[id] !== store.bgImages[id])) {
            if (patch.bgColors[id]) store.setBgColor(id, patch.bgColors[id]); else store.resetBg(id);
          }
        }
      }} /> </>
  };
}
// ===== 主组件 =====

interface BattleViewProps {
  /**
 * Web adapter for the shared local battle layout, player controls and dialogs.
 * The battle store, RAF timer nodes, WCA source and device transports stay here.
 */
  playerCount: number;
  /**
 * Web adapter for the shared local battle layout, player controls and dialogs.
 * The battle store, RAF timer nodes, WCA source and device transports stay here.
 */
  playersControl?: React.ReactNode;
  presenceControl?: React.ReactNode;
  onPresenceChange?: (report: TimerPresenceReport) => void;
}

export default function BattleView({ playerCount, playersControl, presenceControl, onPresenceChange }: BattleViewProps) {
  const { i18n } = useTranslation();
  const store = useBattleStore();
  const { mode } = store;
  useTimerBattleOrientation(playerCount, store.setLayout, mode === '1v1');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [vsHistoryOpen, setVsHistoryOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  useKeyboardControls(settingsOpen || vsHistoryOpen);

  // NOTE: 人数由 URL 驱动(TimerShell),store 跟随同步
  useEffect(() => {
    useBattleStore.getState().setPlayerCount(playerCount);
  }, [playerCount]);

  // All local players use one event; old comma-separated URLs use their first event.
  const [eventsParam, setEventsParam] = useQueryState('event', parseAsString.withOptions({ history: 'replace' }));
  const validBattleIds = useMemo(() => new Set(PUZZLES.map(p => p.id)), []);
  const battleUrlInitRef = useRef(false);
  useEffect(() => {
    if (battleUrlInitRef.current || !eventsParam) return;
    battleUrlInitRef.current = true;
    const battleId = timerToBattleEvent(eventsParam.split(',')[0]);
    if (validBattleIds.has(battleId)) useBattleStore.getState().changeAllPuzzles(battleId);
  }, [eventsParam, playerCount, validBattleIds]);
  useEffect(() => {
    const ids = battleToTimerEvent(store.puzzleIds[0]);
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
    const initial = useBattleStore.getState();
    const event = timerToBattleEvent(eventsParam?.split(',')[0] || battleToTimerEvent(initial.puzzleIds[0]));
    if (validBattleIds.has(event)) initial.changeAllPuzzles(event);
    initial.setCubeMode('own');
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
    ? `wca|${settings.wcaScrambleMode}|${settings.wcaComp}|${settings.wcaRound}|${settings.wcaGroup}|${settings.wcaDateFrom}|${settings.wcaDateTo}|${settings.wcaUseOptimal}`
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

  const settingsProps = useBattleSettingsProps(closeSettings);
  const historyProps = useBattleHistoryProps({ onClose: () => setVsHistoryOpen(false) });

  if (!mounted) {
    // SSG/first-paint placeholder — 避免 hydration mismatch 重建整树。
    return <div className="battle-container" />;
  }

  // 同排一对玩家 puzzle 相同时(同 puzzle 打乱本就相等,见 loadNewScramble),
  // 只在两格之间渲染一份共享打乱;不同项目则各自沿用格内打乱(共享行塌陷)。
  const bottomSame = store.puzzleIds[0] === store.puzzleIds[1];
  const topSame = store.puzzleIds[2] === store.puzzleIds[3];
  // 上排是否翻转 180°(围坐一桌面向对面 = true;同向观看 = false,用户可关)。
  //   关掉后上排文字/图正立,控制条也从「对面视角上角」回到本屏上角。
  const flipTop = store.flipTopRow;
  return <>
    <BattlePresenceReporter playerCount={playerCount} onChange={onPresenceChange} />
    <TimerLocalBattlePage className="battle-container" toolbar={{
      language: i18n.language === 'zh' ? 'zh' : 'en',
      eventControl: <BattleEventButton playerId={0} />,
      onSettings: handleSettingsClick,
      onHistory: () => setVsHistoryOpen(true),
      controls: <>{playersControl}{presenceControl}</>,
      brand: <HomeLink className="tb-btn shell-topbar-home" data-no-timer aria-label={tr({ zh: '返回首页', en: 'Back to home' })}><ArrowLeft size={18} /></HomeLink>
    }} layout={{
      playerCount: playerCount as 2 | 3 | 4,
      layout: store.layout,
      flipTopRow: flipTop,
      bottomScramble: bottomSame ? <ScramblePanel ids={[0, 1]} imgHeight="var(--timer-cube-h)" /> : undefined,
      topScramble: topSame ? <ScramblePanel ids={[2, 3]} imgHeight="var(--timer-cube-h)" /> : undefined,
      renderPlayer: (playerId, cell) => <TimerArea playerId={playerId}
        hideScramble={cell.hideScramble} controlsCorner={cell.controlsCorner} />
    }}
      settings={settingsOpen && settingsProps}
      history={vsHistoryOpen && historyProps}
      feedback={toastMsg && <MilestoneToast message={toastMsg} onDone={() => setToastMsg(null)} />} />
  </>;
}

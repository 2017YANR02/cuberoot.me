'use client';

/**
 * BattleView — the 对战 (1v1 Battle) mode hosted inside /timer.
 *
 * This is the battle experience moved out of app/[lang]/battle/page.tsx. The
 * engine (battle_store.ts) + the RAF DOM-write display hooks are kept
 * BEHAVIORALLY UNTOUCHED — they still write timeRef.innerHTML and the per-player
 * opponent-N span directly with ZERO per-tick React render. Components + engine
 * are imported from their original folder (app/[lang]/battle/_components/...) to
 * avoid a risky Windows directory git-mv while the dev watcher holds files.
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
 *   - the ⚔️ emoji opponent prefix + icon_timer.png nav icon are replaced with
 *     lucide Swords / Timer (no-emoji rule); the RAF path writes ONLY the time
 *     string into a child span, the icon is rendered once in JSX
 *   - per-player RankBadge after a round ends; hidden while solving
 *   - imports re-pointed to timer/_shared (stats-core / format)
 */

import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Settings as SettingsIcon, ClipboardList, Trophy, RotateCcw, Eye, EyeOff, Swords, Timer as TimerIcon } from 'lucide-react';
import { useBattleStore, battleToTimerEvent, prefetchBattleScrambles } from '@/app/[lang]/battle/_components/engine/battle_store';
import { KEY_MAP, PUZZLES, PENALTY, I18N_TEXT, BG_MAX_BYTES } from '@/app/[lang]/battle/_components/engine/constants';
import { formatTimeHtml as formatTime } from '@/app/[lang]/timer/_shared/format';
import { computeAo5 } from '@/app/[lang]/timer/_shared/stats-core';
import { formatScrambleForEvent } from '@/lib/sq1-svg';
import type { PenaltyType } from '@/app/[lang]/battle/_components/engine/constants';
import HistoryPanel from '@/app/[lang]/battle/_components/HistoryPanel';
import VsHistoryPanel from '@/app/[lang]/battle/_components/VsHistoryPanel';
import { MilestoneToast } from '@/app/[lang]/battle/_components/AdvancedFeatures';
import CubeRootLogo from '@/components/CubeRootLogo';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import CubingPreview from '@/components/CubingPreview';
import WcaEventSelector from '@/components/WcaEventSelector';
import { EventIcon } from '@/components/EventIcon';
import { isWcaEvent } from '@/lib/wca-events';
import RankBadge from './RankBadge';
import { useRankCountry } from '@/app/[lang]/timer/_shared/use-rank-country';
import { useSettings, updateSettings } from '@/app/[lang]/timer/_lib/settings';
import WcaSourceConfig from '@/app/[lang]/timer/_components/WcaSourceConfig';
import { wcaMetaFor } from '@/app/[lang]/timer/_lib/scramble/wca_pool';
import { Flag } from '@/components/Flag';
import { compFlagIso2, loadFlagData, flagDataVersion } from '@/lib/country-flags';
import { localizeCompName } from '@/lib/comp-localize';
import { compSourceLine } from '@/lib/comp-schedule';

import '@/app/[lang]/battle/battle.css';
import './shell.css';
import { tr } from '@/i18n/tr';
import BoolToggle from '@/components/BoolToggle';

// NOTE: 根据打乱字符串长度自动计算字号缩放因子
// ≤100 字符（2x2~3x3）= 1.0，更长则 sqrt 曲线平滑缩小，最小 0.7
function getScrambleAutoScale(scramble: string): number {
  if (!scramble) return 1;
  const len = scramble.length;
  if (len <= 100) return 1;
  return Math.max(0.7, Math.sqrt(100 / len));
}

// NOTE: battle 的 18 个项目里有两个非 WCA(fto / kilominx)，走 appendEvents 文字标签。
// 其余直接映射到 ALL_EVENT_IDS 的 WCA id(333mbf / minx / pyram 等本就一致)。
const BATTLE_WCA_IDS = new Set<string>(
  PUZZLES.map(p => p.id).filter(id => isWcaEvent(id)),
);
const BATTLE_APPEND_EVENTS: ReadonlyArray<{ id: string; iconClass: string; textLabel?: string }> = [
  { id: 'fto', iconClass: '', textLabel: 'FTO' },
  { id: 'kilominx', iconClass: '', textLabel: 'Kilominx' },
];
const BATTLE_AVAILABLE_EVENTS = new Set<string>([
  ...BATTLE_WCA_IDS,
  ...BATTLE_APPEND_EVENTS.map(e => e.id),
]);

// NOTE: 有效成绩 ms → RankBadge 厘秒(DNF/未完成 → null)
function effectiveCentis(time: number, penalty: PenaltyType): number | null {
  if (penalty === PENALTY.DNF) return null;
  if (time <= 0) return null;
  const ms = penalty === PENALTY.PLUS2 ? time + 2000 : time;
  return Math.round(ms / 10);
}

// NOTE: 加载 scramble_module.js 全局脚本（打乱引擎）
// scramble_module.js 是 csTimer 打包代码，依赖 jQuery 子集 + kernel 配色
function useScrambleScript() {
  useEffect(() => {
    if (typeof window.scrMgr !== 'undefined') return;

    // NOTE: 1:1 翻译自 battle/index.html 行 308~328
    // scramble_module.js 内部使用 jQuery 的 $.isArray / $.now / $.noop / $.map / $.fn 等
    // 提供最小 shim 而非引入完整 jQuery（原版方案）
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    if (!w.$) {
      const jqShim: Record<string, unknown> = {
        isArray: Array.isArray,
        now: Date.now,
        noop: () => {},
        map: (arr: unknown[], fn: (item: unknown, i: number) => unknown) =>
          Array.prototype.map.call(arr, fn),
        fn: {},
      };
      w.$ = jqShim;
    }
    // NOTE: kernel.getProp 为 image.js 提供 WCA 标准配色（默认值），不读取 localStorage
    if (!w.kernel) {
      w.kernel = {
        getProp: (key: string): string | null => {
          const defaults: Record<string, string> = {
            'colcube': '#ff0#fa0#00f#fff#f00#0d0',
            'colclk': '#f00#37b#5cf#ff0#850',
            'colsq1': '#ff0#f80#0f0#fff#f00#00f',
            'colpyr': '#0f0#f00#00f#ff0',
            'colskb': '#ff0#fa0#00f#fff#f00#0d0',
            'colmgm': '#fff#d00#060#81f#fc0#00b#ffb#8df#f83#7e0#f9f#999',
            'colfto': '#fff#808#0d0#f00#00f#bbb#ff0#fa0',
            'colico': '#fff#084#b36#a85#088#811#e71#b9b#05a#ed1#888#6a3#e8b#a52#6cb#c10#fa0#536#49c#ec9',
            'col15p': '#f00#fa0#ff0#0d0#00f#fff#888#000',
            'col-font': '#fff',
            'col-board': '#000',
          };
          return defaults[key] !== undefined ? defaults[key] : null;
        },
      };
    }

    const script = document.createElement('script');
    script.src = '/' +'scramble_module.js';
    script.async = true;
    document.head.appendChild(script);


    return () => {
      // NOTE: 不移除 script — 加载后全局持久化
    };
  }, []);
}

// NOTE: 键盘控制 hook — 1:1 翻译自 battle.js handleKeyDown/handleKeyUp（行 755~783）
// 输入控件聚焦时跳过(设置面板里有比赛搜索输入框,空格/字母不能被计时器吃掉)
function isTypingTarget(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null;
  if (!t) return false;
  return t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable;
}

function useKeyboardControls() {
  const keyPressedRef = useRef<Record<string, boolean>>({});

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const store = useBattleStore.getState();

      const playerId = KEY_MAP[e.key];
      if (playerId === undefined) return;
      if (isTypingTarget(e)) return;

      if (store.mode === 'solo' && playerId !== 0) return;
      // 未参战槽位的键不拦(4 人键位 Q/P 在 2 人模式下保持正常输入行为)
      if (store.mode !== 'solo' && playerId >= store.playerCount) return;

      e.preventDefault();

      if (keyPressedRef.current[e.key]) return;
      keyPressedRef.current[e.key] = true;

      store.playerDown(playerId);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const store = useBattleStore.getState();
      const playerId = KEY_MAP[e.key];
      if (playerId === undefined) return;
      if (isTypingTarget(e)) return;
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
  }, []);
}

// NOTE: 计时器动画 hook — 通过 RAF 直接写 DOM（不走 React state）
// 1:1 翻译自 battle.js startTimerAnimation()（行 918~934）
// 唯一改动:对手区域只写时间到 #opponent-N 子 span,⚔️ 图标由 JSX 静态渲染一次。
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
          // NOTE: 对手已停表时，在对手区域实时显示此玩家还在跑的时间
          // 1:1 翻译自 battle.js startTimerAnimation()（行 928~930）
          // 只写时间到 #opponent-N 子 span(图标静态);仅 2 人模式有镜像区
          if (curr.mode === '1v1' && curr.playerCount === 2) {
            const oppId = 1 - playerId;
            if (curr.players[oppId].hasFinished) {
              const oppEl = document.getElementById(`opponent-${oppId}`);
              if (oppEl) {
                oppEl.innerHTML = timeStr;
              }
            }
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

// NOTE: 对手成绩显示 hook — 在本方区域显示对手的最终成绩
// 1:1 翻译自 battle.js renderOpponent() 调用逻辑（行 616~618, 996~1001）
// 只写时间到 #opponent-N 子 span(⚔️ 图标由 JSX 静态渲染)
function useOpponentDisplay(playerId: number, iconRef: React.RefObject<HTMLSpanElement | null>) {
  useEffect(() => {
    const unsubscribe = useBattleStore.subscribe((state) => {
      if (state.mode !== '1v1' || state.playerCount !== 2) return;

      const el = document.getElementById(`opponent-${playerId}`);
      if (!el) return;

      const oppId = 1 - playerId;
      const opp = state.players[oppId];

      if (opp.hasFinished && !opp.isTiming) {
        // NOTE: 对手已完成 → 显示对手的最终成绩（含罚时）
        const effTime = opp.penalty === PENALTY.DNF ? Infinity
          : (opp.penalty === PENALTY.PLUS2 ? opp.time + 2000 : opp.time);
        const label = effTime === Infinity ? 'DNF' : formatTime(effTime, state.timerPrecision);
        el.innerHTML = label;
        if (iconRef.current) iconRef.current.style.display = '';
      } else if (!opp.hasFinished && !opp.isTiming) {
        // NOTE: 回合重置 → 清空对手成绩
        el.innerHTML = '';
        if (iconRef.current) iconRef.current.style.display = 'none';
      }
    });
    return () => unsubscribe();
  }, [playerId, iconRef]);
}

// ===== PenaltyDropdown 组件 =====
// 1:1 翻译自 battle/index.html penalty-dropdown 结构

function PenaltyDropdown({ playerId }: { playerId: number }) {
  const player = useBattleStore(s => s.players[playerId]);
  const handlePenalty = useBattleStore(s => s.handlePenalty);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isOpen = useRef(false);

  const enabled = player.hasFinished && !player.isTiming && player.time > 0;

  // NOTE: 原生事件阻止冒泡 — 必须用原生而非 React 合成事件
  useEffect(() => {
    const el = dropdownRef.current;
    if (!el) return;

    const stop = (e: PointerEvent) => {
      e.stopPropagation();
    };

    el.addEventListener('pointerdown', stop);
    el.addEventListener('pointerup', stop);
    el.addEventListener('pointercancel', stop);

    return () => {
      el.removeEventListener('pointerdown', stop);
      el.removeEventListener('pointerup', stop);
      el.removeEventListener('pointercancel', stop);
    };
  }, []);

  const toggleOpen = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!enabled) return;
    isOpen.current = !isOpen.current;
    dropdownRef.current?.classList.toggle('open', isOpen.current);
  }, [enabled]);

  const selectPenalty = useCallback((penalty: PenaltyType, e: React.MouseEvent) => {
    e.stopPropagation();
    handlePenalty(playerId, penalty);
    isOpen.current = false;
    dropdownRef.current?.classList.remove('open');
  }, [playerId, handlePenalty]);

  // NOTE: 点击外部关闭
  useEffect(() => {
    const handler = () => {
      isOpen.current = false;
      dropdownRef.current?.classList.remove('open');
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  return (
    <div className="penalty-dropdown" ref={dropdownRef}>
      <button className="penalty-trigger" disabled={!enabled} onClick={toggleOpen}>
        <span className="penalty-label">{player.penalty.toUpperCase()}</span>
        <span className="penalty-arrow">▼</span>
      </button>
      <div className="penalty-menu">
        {([PENALTY.OK, PENALTY.PLUS2, PENALTY.DNF] as PenaltyType[]).map(p => (
          <div
            key={p}
            className={`penalty-option${player.penalty === p ? ' active' : ''}`}
            onClick={(e) => selectPenalty(p, e)}
          >
            {p.toUpperCase()}
          </div>
        ))}
      </div>
    </div>
  );
}

// ===== ScramblePanel 组件 =====
// 打乱文字(点击复制) + 打乱图 + WCA 来源行。可被同排一对玩家共用:
//   ids = 参与共享的玩家槽位,取 ids[0] 为代表读打乱(同 puzzle 时全组打乱相等);
//   任一玩家计时中则整条隐藏。单人格传 [playerId],共享行传该排的一对(如 [0,1] / [2,3])。
function ScramblePanel({ ids }: { ids: number[] }) {
  const store = useBattleStore();
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  const rep = ids[0];
  const anyTiming = ids.some((id) => store.players[id].isTiming);
  const scrambleRef = useRef<HTMLDivElement>(null);
  const [scrambleCopied, setScrambleCopied] = useState(false);
  const copiedTimerRef = useRef<number | null>(null);
  // WCA 来源行:打乱图正下方显示「国旗 + 比赛名 · 轮次/组别」。国旗 + 中文名需异步
  // 加载的比赛索引,落地后 bump flagVer 重渲。
  const [flagVer, setFlagVer] = useState(() => flagDataVersion());
  useEffect(() => { void loadFlagData().then((v) => setFlagVer((cur) => (v !== cur ? v : cur))); }, []);

  // 点击打乱文字复制;阻止 pointer 冒泡到 .player-area(否则任何 pointerdown 都会 arm 计时器)。
  // 共享行虽在 player-area 之外,保留此拦截无害。
  useEffect(() => {
    const el = scrambleRef.current;
    if (!el) return;
    const stop = (e: PointerEvent) => e.stopPropagation();
    el.addEventListener('pointerdown', stop);
    el.addEventListener('pointerup', stop);
    el.addEventListener('pointercancel', stop);
    return () => {
      el.removeEventListener('pointerdown', stop);
      el.removeEventListener('pointerup', stop);
      el.removeEventListener('pointercancel', stop);
    };
  }, []);
  useEffect(() => () => { if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current); }, []);

  const copyScramble = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const st = useBattleStore.getState();
    const s = st.scrambles[rep];
    if (!s || s.startsWith('⚠️')) return;
    // SQ1 copies in compact notation (4/-36/...) to match the displayed text.
    try { void navigator.clipboard.writeText(formatScrambleForEvent(st.puzzleIds[rep], s)); } catch { /* ignore */ }
    setScrambleCopied(true);
    if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current);
    copiedTimerRef.current = window.setTimeout(() => setScrambleCopied(false), 1200);
  }, [rep]);

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
      {/* 打乱文字 — 放在打乱图正上方;点击复制 */}
      <div
        ref={scrambleRef}
        className={`scramble-text${anyTiming ? ' hidden' : ''}`}
        data-no-timer
        onClick={copyScramble}
        title={tr({ zh: '点击复制打乱', en: 'Click to copy'
        })}
        style={{ '--scramble-auto': getScrambleAutoScale(myScrambleDisplay || ''), cursor: 'pointer' } as React.CSSProperties}
        dangerouslySetInnerHTML={{ __html: scrambleContent }}
      />
      {scrambleCopied && (
        <div className="battle-scramble-copied" data-no-timer>{tr({ zh: '已复制', en: 'Copied'
        })}</div>
      )}

      {/* 打乱图 — 复用 timer 的 CubingPreview（scramble-display） */}
      <div className={`scramble-img${anyTiming ? ' hidden' : ''}`}>
        {myScramble && !myScramble.startsWith('⚠️') && store.showImage && (
          <CubingPreview event={myPuzzle} scramble={myScramble} className="scramble-svg-img" />
        )}
      </div>

      {/* WCA 来源行(真实比赛打乱时) */}
      {wcaSrc && !anyTiming && (
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

function TimerArea({ playerId, rotated, hideScramble, cellClass }: { playerId: number; rotated?: boolean; hideScramble?: boolean; cellClass?: string }) {
  const player = useBattleStore(s => s.players[playerId]);
  const store = useBattleStore();
  const areaRef = useRef<HTMLDivElement>(null);
  const timeRef = useRef<HTMLDivElement>(null);
  const oppIconRef = useRef<HTMLSpanElement>(null);
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  const rankCountry = useRankCountry();

  // NOTE: 高频计时器动画（不走 React re-render）
  useTimerAnimation(playerId, timeRef);
  // NOTE: Inspection 倒计时显示
  useInspectionDisplay(playerId, timeRef);
  // NOTE: 对手成绩显示（1v1 模式）
  useOpponentDisplay(playerId, oppIconRef);

  // NOTE: 原生 pointer 事件处理 — 每位玩家独立 pointerId(两个拇指可独立 arm)
  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;

    const onDown = (e: PointerEvent) => {
      const curr = useBattleStore.getState();
      const p = curr.players[playerId];
      if (p.pointerId !== null) return;

      el.setPointerCapture(e.pointerId);

      const newPlayers = [...curr.players];
      newPlayers[playerId] = { ...p, pointerId: e.pointerId };
      useBattleStore.setState({ players: newPlayers });

      curr.playerDown(playerId);
    };

    const onUp = (e: PointerEvent) => {
      const curr = useBattleStore.getState();
      const p = curr.players[playerId];
      if (p.pointerId !== e.pointerId) return;

      const newPlayers = [...curr.players];
      newPlayers[playerId] = { ...p, pointerId: null };
      useBattleStore.setState({ players: newPlayers });

      curr.playerUp(playerId);
    };

    const onCancel = (e: PointerEvent) => {
      const curr = useBattleStore.getState();
      const p = curr.players[playerId];
      if (p.pointerId !== e.pointerId) return;

      const newPlayers = [...curr.players];
      newPlayers[playerId] = { ...p, pointerId: null };
      useBattleStore.setState({ players: newPlayers });

      curr.playerUp(playerId);
    };

    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onCancel);

    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onCancel);
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

  const myPuzzle = store.puzzleIds[playerId];

  const bgColor = store.bgColors[playerId];
  const bgImage = store.bgImages[playerId];
  const bgStyle: React.CSSProperties = {
    '--bg-image': bgImage ? `url(${bgImage})` : 'none',
    '--bg-color': bgColor || '',
    '--bg-opacity': String(store.bgOpacity),
  } as React.CSSProperties;

  // NOTE: 回合结束(本方完成且未计时)显示 RankBadge
  const showRank = player.hasFinished && !player.isTiming && player.time > 0;
  const rankCentis = showRank ? effectiveCentis(player.time, player.penalty) : null;
  // 对手已完成才显示对手区(图标默认隐藏,subscribe 控制显隐);仅 2 人模式有镜像区
  const opp = store.playerCount === 2 ? store.players[1 - playerId] : null;
  const oppShown = !!opp && opp.hasFinished && !opp.isTiming;

  return (
    <div
      className={areaClasses}
      ref={areaRef}
      style={bgStyle}
    >
      {/* 计时数字 */}
      <div
        className={timeClasses}
        ref={timeRef}
        dangerouslySetInnerHTML={{ __html: renderTimeContent() }}
      />

      {/* 排名徽章(回合结束后,本方有效成绩) */}
      {showRank && !player.isInspecting && (
        <div className="battle-rank-slot" data-no-timer>
          <RankBadge eventId={myPuzzle} centis={rankCentis} type="single" country={rankCountry} isZh={isZh} />
        </div>
      )}

      {/* Ao5 统计 */}
      <div
        className="ao5-display"
        dangerouslySetInnerHTML={{ __html: ao5Text }}
      />

      {/* 对手成绩（仅 2 人 versus 布局）— ⚔️ 用 lucide Swords 静态渲染,RAF 只写时间到子 span */}
      {store.mode === '1v1' && store.playerCount === 2 && store.layout === 'versus' && (
        <div className="opponent-display">
          <span className="opponent-icon" ref={oppIconRef} style={{ display: oppShown ? '' : 'none' }}>
            <Swords size={14} />
          </span>
          <span id={`opponent-${playerId}`} className="opponent-time" />
        </div>
      )}

      {/* 打乱文字 + 图 + WCA 来源。田字格里同排一对玩家共用一条打乱时 hideScramble=true,
          改由父级在两格之间的共享行(grid-scramble-row)统一渲染一份。 */}
      {!hideScramble && <ScramblePanel ids={[playerId]} />}

      {/* 多人田字格:比分/项目/罚时归各自区域(2 人模式这些在 middle-bar) */}
      {store.mode === '1v1' && store.playerCount > 2 && (
        <CellControls playerId={playerId} />
      )}

      {/* Event picker 全区域覆盖 — 由项目图标按钮触发,改用 WcaEventSelector */}
      {store.eventPickerOpen[playerId] && (
        <EventPickerOverlay playerId={playerId} />
      )}
    </div>
  );
}

// ===== CellControls — 多人田字格 cell 内控制条 =====
// 比分 + 项目 + 罚时,随 cell 旋转朝向各自玩家;pointer 停止冒泡防误触发计时

function CellControls({ playerId }: { playerId: number }) {
  const points = useBattleStore(s => s.players[playerId].points);
  const isWin = useBattleStore(s => s.winners.includes(playerId));
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const stop = (e: PointerEvent) => e.stopPropagation();
    el.addEventListener('pointerdown', stop);
    el.addEventListener('pointerup', stop);
    el.addEventListener('pointercancel', stop);
    return () => {
      el.removeEventListener('pointerdown', stop);
      el.removeEventListener('pointerup', stop);
      el.removeEventListener('pointercancel', stop);
    };
  }, []);

  return (
    <div className="cell-controls" ref={ref} data-no-timer>
      <span className="score-value">
        {points}
        {isWin && <Trophy className="score-trophy" size={14} />}
      </span>
      <BattleEventButton playerId={playerId} />
      <PenaltyDropdown playerId={playerId} />
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
        <WcaEventSelector
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

function MiddleBar({
  onSettingsClick,
  onHistoryClick,
  playersControl,
  playerCount,
}: {
  onSettingsClick: () => void;
  onHistoryClick?: () => void;
  playersControl?: React.ReactNode;
  playerCount: number;
}) {
  const store = useBattleStore();
  const { players, winners, layout } = store;
  const grid = playerCount > 2;

  // NOTE: versus 布局 → P1(上方/旋转180°) 在左，P0(下方) 在右
  //       side   布局 → P0(左) 在左，P1(右) 在右 — 与计时区域位置一致
  const leftId  = layout === 'side' ? 0 : 1;
  const rightId = layout === 'side' ? 1 : 0;

  const keyHint = playerCount === 4
    ? 'Q P ↑ · ↓ Space Enter'
    : (playerCount === 3 ? 'Q ↑ · ↓ Space Enter' : 'Enter ↑ · ↓ Space');

  return (
    <div className="middle-bar" data-no-timer>
      {/* 左侧比分 + 项目 + 罚时(2 人模式) */}
      {!grid && (
        <div className="score-section">
          <span className="score-value">
            {players[leftId].points}
            {winners.includes(leftId) && <Trophy className="score-trophy" size={14} />}
          </span>
          <BattleEventButton playerId={leftId} />
          <PenaltyDropdown playerId={leftId} />
        </div>
      )}

      {/* 中间操作按钮 */}
      <div className="middle-actions">
        {playersControl}
        <span className="key-hint">{keyHint}</span>
        <CubeRootLogo className="middle-logo" />
        <button className="middle-btn" title={tr({ zh: '历史', en: 'History'
        })} onClick={onHistoryClick}>
          <ClipboardList size={16} />
        </button>
        <button className="middle-btn" title={tr({ zh: '设置', en: 'Settings'
        })} onClick={onSettingsClick}>
          <SettingsIcon size={16} />
        </button>
      </div>

      {/* 右侧比分 + 项目 + 罚时(2 人模式) */}
      {!grid && (
        <div className="score-section">
          <span className="score-value">
            {winners.includes(rightId) && <Trophy className="score-trophy" size={14} />}
            {players[rightId].points}
          </span>
          <BattleEventButton playerId={rightId} />
          <PenaltyDropdown playerId={rightId} />
        </div>
      )}
    </div>
  );
}


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

  return (
    <div className={`settings-overlay${visible ? ' visible' : ''}`} onClick={(e) => {
      if (e.target === e.currentTarget) onClose();
    }}>
      <div className="settings-panel">
        <div className="settings-header-bar">
          <span className="settings-title">
            <SettingsIcon size={16} />
            {tr({ zh: '设置', en: 'Settings'
            })}
          </span>
          <button className="settings-x-btn" onClick={onClose}>✕</button>
        </div>

        {/* 双人模式恒为 1v1 — 顶层已有「单人」入口(SoloView),内部 solo 布局是
            退役遗留,已移除 单人/1v1 切换。并排/对向布局由视口自动决定,无手动开关。 */}

        {/* 项目选择 — 仅 Solo;1v1 已移到 middle-bar 的项目按钮 */}
        {store.mode === 'solo' && (
          <div className="settings-group">
            <div className="settings-label" data-i18n="puzzle">{tr({ zh: '项目', en: 'PUZZLE'
            })}</div>
            <div className="puzzle-grid">
              {PUZZLES.map(puz => (
                <button
                  key={puz.id}
                  className={`puzzle-btn${puz.id === store.puzzleIds[0] ? ' active' : ''}`}
                  onClick={() => { store.changePuzzle(0, puz.id); onClose(); }}
                >
                  {isWcaEvent(puz.id)
                    ? <EventIcon event={puz.id} />
                    : <span className="event-fallback">{puz.name.en}</span>}
                  <span className="puzzle-btn-name">{puz.name[(i18n.language.startsWith('zh') ? 'zh' : 'en')] || puz.name.en}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 打乱来源 — 复用 Solo 的 WcaSourceConfig + 共享 timer 设置(随机 / WCA 真实比赛打乱)。
            Duo 同 puzzle 时双方拿同一条真实打乱(沿用共享 scramble 不变量)。 */}
        <div className="settings-group">
          <div className="settings-label">{tr({ zh: '打乱来源', en: 'Scramble source'
          })}</div>
          <div className="setting-item">
            <span>{tr({ zh: '来源', en: 'Source'
            })}</span>
            <select
              className="settings-select"
              value={settings.scrambleSource}
              onChange={(e) => updateSettings({ scrambleSource: e.target.value as 'random' | 'wca' })}
            >
              <option value="wca">{tr({ zh: 'WCA 真题', en: 'WCA real'
              })}</option>
              <option value="random">{tr({ zh: '随机生成', en: 'Random'
              })}</option>
            </select>
          </div>
          {settings.scrambleSource === 'wca' && (
            <WcaSourceConfig
              isZh={isZh}
              event={battleToTimerEvent(store.puzzleIds[0])}
              settings={settings}
              updateSettings={updateSettings}
            />
          )}
        </div>

        {/* 计时器精确度 */}
        <div className="settings-group">
          <div className="setting-item">
            <span data-i18n="precision">{tr({ zh: '精度', en: 'Precision' })}</span>
            <select
              className="settings-select"
              value={store.timerPrecision}
              onChange={e => store.setTimerPrecision(parseInt(e.target.value))}
            >
              <option value="0">1s</option>
              <option value="1">0.1s</option>
              <option value="2">0.01s</option>
              <option value="3">0.001s</option>
            </select>
          </div>
        </div>

        {/* Inspection */}
        <div className="settings-group solo-setting">
          <div className="setting-item">
            <span data-i18n="inspection">{tr({ zh: '观察', en: 'Inspection'
            })}</span>
            <select
              className="settings-select"
              value={store.inspectionTime}
              onChange={e => store.setInspectionTime(parseInt(e.target.value))}
            >
              <option value="0">{tr({ zh: '关闭', en: 'OFF'
            })}</option>
              <option value="8">8s</option>
              <option value="15">15s (WCA)</option>
              <option value="9999">∞</option>
            </select>
          </div>
        </div>

        {/* Voice */}
        <div className="settings-group solo-setting">
          <div className="setting-item">
            <BoolToggle
              value={store.voice}
              onChange={store.setVoice}
              label={tr({ zh: '语音提示', en: 'Voice Alert' })}
            />
          </div>
        </div>

        {/* Show Image */}
        <div className="settings-group">
          <div className="setting-item">
            <BoolToggle
              value={store.showImage}
              onChange={store.setShowImage}
              label={tr({ zh: '显示打乱图', en: 'Show Image' })}
            />
          </div>
        </div>

        {/* Scramble Size */}
        <div className="settings-group">
          <div className="setting-item slider-row">
            <span data-i18n="scramble_size">{tr({ zh: '打乱大小', en: 'Scramble Size'
            })}</span>
            <input
              type="range"
              min="0.5"
              max="2.0"
              step="0.1"
              value={store.scrambleScale}
              onChange={e => {
                const val = parseFloat(e.target.value);
                store.setScrambleScale(val);
              }}
            />
          </div>
        </div>

        {/* Phases */}
        <div className="settings-group solo-setting">
          <div className="setting-item">
            <span data-i18n="phases">{tr({ zh: '分段', en: 'Phases' })}</span>
            <select
              className="settings-select"
              value={store.phases}
              onChange={e => store.setPhases(parseInt(e.target.value))}
            >
              <option value="1">1 ({tr({ zh: '普通', en: 'Normal' })})</option>
              <option value="2">2 (BLD)</option>
              <option value="4">4 (CFOP)</option>
            </select>
          </div>
        </div>

        {/* Start Delay */}
        <div className="settings-group">
          <div className="setting-item slider-row">
            <span data-i18n="start_delay">{tr({ zh: '启动延迟', en: 'Start Delay'
            })}</span>
            <span className="delay-value">{(store.startDelay / 1000).toFixed(2)}s</span>
            <input
              type="range"
              min="0"
              max="1000"
              step="50"
              value={store.startDelay}
              onChange={e => store.setStartDelay(parseInt(e.target.value))}
            />
          </div>
        </div>

        {/* 背景自定义 — 1v1 双人独立,Solo 只显示 P1 */}
        <BackgroundSettingsGroup mode={store.mode} isZh={isZh} />

        {/* 操作按钮 */}
        <div className="settings-group">
          <button className="settings-action-btn" onClick={() => {
            store.toggleShowTime();
            onClose();
          }}>
            {store.showTime ? <EyeOff size={16} /> : <Eye size={16} />}
            {(store.showTime ? I18N_TEXT.hide_time : I18N_TEXT.show_time)[(i18n.language.startsWith('zh') ? 'zh' : 'en')]}
          </button>
          <button className="settings-action-btn danger" onClick={() => {
            store.resetAll();
            onClose();
          }}>
            <RotateCcw size={16} />
            {tr({ zh: '全部重置', en: 'Reset All' })}
          </button>
        </div>
      </div>
    </div>
  );
}

// ===== 主组件 =====

interface BattleViewProps {
  /** 参战人数(2~4),由 TimerShell 的 ?players= URL 参数驱动 */
  playerCount: number;
  /** 人数下拉(TimerShell 构建),注入到 middle-bar */
  playersControl?: React.ReactNode;
}

export default function BattleView({ playerCount, playersControl }: BattleViewProps) {
  useScrambleScript();
  useKeyboardControls();

  const { i18n } = useTranslation();
  const store = useBattleStore();
  const { mode } = store;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [vsHistoryOpen, setVsHistoryOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // NOTE: 人数由 URL 驱动(TimerShell),store 跟随同步
  useEffect(() => {
    useBattleStore.getState().setPlayerCount(playerCount);
  }, [playerCount]);

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

  // NOTE: 初始化 store — 加载历史 + 生成第一个打乱
  useEffect(() => {
    const checkAndInit = () => {
      if (typeof window.scrMgr !== 'undefined') {
        useBattleStore.getState().init();
      } else {
        setTimeout(checkAndInit, 100);
      }
    };
    checkAndInit();
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

  // NOTE: 自动检测横竖屏 — 横屏自动切 side 布局，竖屏自动切 versus
  useEffect(() => {
    if (mode !== '1v1') return;

    const mql = window.matchMedia('(orientation: landscape)');
    const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
      const s = useBattleStore.getState();
      if (s.mode !== '1v1') return;
      s.setLayout(e.matches ? 'side' : 'versus');
    };
    handleChange(mql);

    mql.addEventListener('change', handleChange);
    return () => mql.removeEventListener('change', handleChange);
  }, [mode]);

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
  const middleBar = (
    <MiddleBar
      onSettingsClick={handleSettingsClick}
      onHistoryClick={() => setVsHistoryOpen(true)}
      playersControl={playersControl}
      playerCount={playerCount}
    />
  );

  return (
    <div className={`battle-container${mode === '1v1' && !isGrid && store.layout === 'side' ? ' side-layout' : ''}${isGrid ? ' grid-layout' : ''}`}>

      {/* === 田字格布局：上排旋转 180° 面向对面;3 人时上排单区跨两列 ===
          同排一对玩家共用一条打乱时,由跨两列的 .grid-scramble-row 统一渲染,
          各 TimerArea 传 hideScramble 抹掉格内那份;共享行未启用则 :empty 塌陷。 */}
      {isGrid && (
        <div className={`grid-players ${playerCount === 3 ? 'grid-p3' : 'grid-p4'}`}>
          {/* 4 人:上排(旋转)两格共享一条打乱 */}
          {playerCount === 4 && (
            <div className="grid-scramble-row rotated">
              {topSame && <ScramblePanel ids={[2, 3]} />}
            </div>
          )}
          <TimerArea playerId={2} rotated hideScramble={playerCount === 4 && topSame} cellClass={playerCount === 4 ? 'grid-col-left' : ''} />
          {playerCount === 4 && <TimerArea playerId={3} rotated hideScramble={topSame} />}
          {middleBar}
          <TimerArea playerId={0} hideScramble={bottomSame} cellClass="grid-col-left" />
          <TimerArea playerId={1} hideScramble={bottomSame} />
          {/* 下排两格共享一条打乱(3/4 人皆有) */}
          <div className="grid-scramble-row">
            {bottomSame && <ScramblePanel ids={[0, 1]} />}
          </div>
        </div>
      )}

      {/* === Side 布局：左右分屏，每侧独立 scramble === */}
      {mode === '1v1' && !isGrid && store.layout === 'side' && (
        <>
          {middleBar}
          <div className="side-players">
            <TimerArea playerId={0} />
            <div className="side-divider" />
            <TimerArea playerId={1} />
          </div>
        </>
      )}

      {/* === Versus 布局：上下分屏 === */}
      {mode === '1v1' && !isGrid && store.layout === 'versus' && (
        <>
          <TimerArea playerId={1} rotated />
          {middleBar}
          <TimerArea playerId={0} />
        </>
      )}

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
  );
}

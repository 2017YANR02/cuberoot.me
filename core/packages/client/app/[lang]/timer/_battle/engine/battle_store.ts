/**
 * Battle 模块 Zustand Store
 * 1:1 翻译自 battle.js state 对象 + 全部 action 函数
 *
 * NOTE: 所有函数体逐行翻译 JS → TS，仅加类型注解，不改逻辑
 */

import { create } from 'zustand';
import type { PlayerState, SolveEntry, Session, BattleMode, BattleLayout, TabName } from './types';
import { PENALTY, LS_PREFIX, MIN_SOLVE_TIME, DEFAULT_PLAYER_KEYS } from './constants';
import type { PenaltyType } from './constants';
import { generateScramble, generateScrambleImageUrl } from './scramble_engine';
import { isScrambleEngineReady, loadScrambleEngine } from './engine_loader';
import { getEffectiveTimeFromEntry, computeAo5, computeAverage } from '@/app/[lang]/timer/_shared/stats-core';
import { getSettings } from '@/app/[lang]/timer/_lib/settings';
import { peekWca, nextWca, prefetchWca, hasWcaSource, type WcaSourceSpec } from '@/app/[lang]/timer/_lib/scramble/wca_pool';
import { fromWcaSpelling, toWcaSpelling, type EventId } from '@/app/[lang]/timer/_lib/types';
import { persistItem } from '@/lib/safe-storage';
import {
  BATTLE_EVENT_IDS,
  LOCAL_BATTLE_MAX_PLAYERS,
  assignLocalBattlePlayerKey,
  groupLocalBattlePlayersByEvent,
  isLocalBattleScrambleHidden,
  localBattlePlayerForKey,
  localBattlePlayerSlots,
  localBattleRoundWinners,
  localBattleWinnerIndices,
  normalizeLocalBattlePlayerCount,
  decodeLocalBattleRounds,
  type LocalBattleRound,
  type Solve as SharedSolve,
} from '@cuberoot/shared/timer';

// Battle puzzle id ⇄ timer EventId. Both directions come from the ONE mapping
// table in timer/_lib/types.ts (`toWcaSpelling` / `fromWcaSpelling`) — battle
// keeps its cubing.js spellings ('333bf', 'minx', …) because EVENT_TO_CSTIMER is
// keyed on them, so the two vocabularies are reconciled by mapping, not renaming.
//
// battleToTimerEvent feeds the shared wca_pool (keyed by timer EventId); events
// with no real comp scrambles (fto / kilominx) resolve to no source there and
// fall back to a generated scramble.
export function battleToTimerEvent(id: string): EventId {
  return fromWcaSpelling(id);
}
// Used to read a shared /timer?event= link (written in timer EventId form,
// matching Solo) back into battle-native puzzle ids.
export function timerToBattleEvent(id: string): string {
  return toWcaSpelling(id as EventId);
}

// KeyboardEvent.key → player slot, given the store's (possibly user-customized)
// playerKeys. Single-letter keys compare case-insensitively (so 'q'/'Q' both hit
// the slot bound to 'q'); Space/Enter/etc. compare exactly.
export const keyToPlayer = localBattlePlayerForKey;

/** Build the WCA source spec for a battle puzzle, reading the shared timer
 *  settings (scramble source config is shared across Solo + Duo). */
function wcaSpecFor(puzzleId: string): WcaSourceSpec {
  const st = getSettings();
  return {
    event: battleToTimerEvent(puzzleId),
    mode: st.wcaScrambleMode,
    comp: st.wcaComp,
    compName: st.wcaCompName,
    round: st.wcaRound,
    group: st.wcaGroup,
    from: st.wcaDateFrom,
    to: st.wcaDateTo,
    optimal: st.wcaUseOptimal,
  };
}

// SSR shim: Next renders Server Components without window/localStorage.
// We give a no-op store so module-level `localStorage.getItem(...)` calls don't
// throw at first render; client hydration uses the real DOM storage afterwards.
const localStorage: Storage = typeof window !== 'undefined'
  ? window.localStorage
  : {
      length: 0,
      key: () => null,
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined,
      clear: () => undefined,
    };

const battleRoundsKey = (sessionId: string) => `${LS_PREFIX}rounds_v1_${sessionId}`;
const battleRoundsRecoveryKey = (sessionId: string) => `${LS_PREFIX}rounds_v1_recovery_${sessionId}`;
export type BattleHistoryWarning = 'corrupt' | 'write-failed' | 'legacy-mirror-stale';

function loadStoredBattleRounds(sessionId: string): {
  rounds: LocalBattleRound[];
  warning: BattleHistoryWarning | null;
} {
  try {
    const raw = localStorage.getItem(battleRoundsKey(sessionId));
    if (!raw) return { rounds: [], warning: null };
    const parsed = JSON.parse(raw) as unknown;
    const decoded = decodeLocalBattleRounds(parsed);
    if (decoded) return { rounds: decoded, warning: null };

    // Never turn one damaged/future round into an empty history that the next
    // save silently overwrites. Keep the original bytes once, then salvage
    // only independently valid rounds for the visible canonical list.
    if (!localStorage.getItem(battleRoundsRecoveryKey(sessionId))) {
      persistItem(battleRoundsRecoveryKey(sessionId), raw);
    }
    const rounds: LocalBattleRound[] = [];
    if (Array.isArray(parsed)) {
      for (const candidate of parsed) {
        const decodedRound = decodeLocalBattleRounds([candidate])?.[0];
        if (!decodedRound) continue;
        const cumulative = decodeLocalBattleRounds([...rounds, decodedRound]);
        if (cumulative) rounds.push(decodedRound);
      }
    }
    return { rounds, warning: 'corrupt' };
  } catch {
    try {
      const raw = localStorage.getItem(battleRoundsKey(sessionId));
      if (raw && !localStorage.getItem(battleRoundsRecoveryKey(sessionId))) {
        persistItem(battleRoundsRecoveryKey(sessionId), raw);
      }
    } catch { /* storage itself may be unavailable */ }
    return { rounds: [], warning: 'corrupt' };
  }
}

function persistBattleRounds(sessionId: string, rounds: readonly LocalBattleRound[]): boolean {
  // Do not silently discard old rounds by count. A quota failure leaves the
  // previous value intact and is surfaced by battleHistoryWarning instead.
  if (typeof window === 'undefined') return true;
  return persistItem(battleRoundsKey(sessionId), JSON.stringify(rounds));
}

function warningAfterBattleHistoryWrite(
  current: BattleHistoryWarning | null,
  canonicalPersisted: boolean,
  legacyPersisted = true,
): BattleHistoryWarning | null {
  if (!canonicalPersisted) return 'write-failed';
  if (current === 'corrupt') return 'corrupt';
  if (!legacyPersisted) return 'legacy-mirror-stale';
  return null;
}

function createLocalBattleRoundId(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') return cryptoApi.randomUUID();
  if (cryptoApi && typeof cryptoApi.getRandomValues === 'function') {
    const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

export interface LegacyBattleRecord {
  event: EventId;
  playerId: number;
  entry: SolveEntry;
}

/**
 * Read pre-atomic per-player records without inventing round membership.
 * The history panel exposes unmatched entries separately; migration must never
 * pair them by parallel-array index.
 */
export function loadLegacyBattleRecords(sessionId: string): {
  records: LegacyBattleRecord[];
  skippedKeys: number;
} {
  if (typeof window === 'undefined') return { records: [], skippedKeys: 0 };
  const prefix = `${LS_PREFIX}1v1_history_${sessionId}_`;
  const allowedEvents = new Set<EventId>(BATTLE_EVENT_IDS);
  const records: LegacyBattleRecord[] = [];
  let skippedKeys = 0;
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key?.startsWith(prefix)) continue;
      const suffix = key.slice(prefix.length);
      const splitAt = suffix.lastIndexOf('_');
      if (splitAt <= 0) continue;
      const event = battleToTimerEvent(suffix.slice(0, splitAt));
      const playerId = Number(suffix.slice(splitAt + 1));
      if (!allowedEvents.has(event)
        || !Number.isInteger(playerId)
        || playerId < 0
        || playerId >= LOCAL_BATTLE_MAX_PLAYERS) continue;
      try {
        const parsed = JSON.parse(window.localStorage.getItem(key) || '[]') as unknown;
        if (!Array.isArray(parsed)) {
          skippedKeys++;
          continue;
        }
        for (const candidate of parsed) {
          if (!candidate || typeof candidate !== 'object') continue;
          const entry = candidate as Partial<SolveEntry>;
          if (typeof entry.time !== 'number'
            || !Number.isFinite(entry.time)
            || entry.time < 0
            || (entry.penalty !== 'ok' && entry.penalty !== '+2' && entry.penalty !== 'dnf')
            || typeof entry.scramble !== 'string'
            || typeof entry.date !== 'string'
            || !Number.isFinite(Date.parse(entry.date))) continue;
          records.push({ event, playerId, entry: entry as SolveEntry });
        }
      } catch {
        skippedKeys++;
      }
    }
  } catch { /* an entirely unavailable storage area cannot expose legacy records */ }
  return {
    records: records.sort((a, b) => Date.parse(a.entry.date) - Date.parse(b.entry.date)),
    skippedKeys,
  };
}

function legacyBattleRecordIdentity(record: LegacyBattleRecord): string {
  return JSON.stringify([
    record.event,
    record.playerId,
    record.entry.time,
    record.entry.penalty,
    record.entry.scramble,
    Date.parse(record.entry.date),
  ]);
}

/** Remove only exact atomic compatibility mirrors; unmatched old data remains visible. */
export function filterUnpairedLegacyBattleRecords(
  records: readonly LegacyBattleRecord[],
  rounds: readonly LocalBattleRound[],
): LegacyBattleRecord[] {
  const mirrored = new Map<string, number>();
  for (const round of rounds) {
    for (const attempt of round.attempts) {
      const identity = JSON.stringify([
        attempt.solve.event,
        attempt.playerId,
        attempt.solve.timeMs,
        attempt.solve.penalty === 'DNF' ? 'dnf' : attempt.solve.penalty,
        attempt.solve.scramble,
        attempt.solve.ts,
      ]);
      mirrored.set(identity, (mirrored.get(identity) ?? 0) + 1);
    }
  }
  return records.filter((record) => {
    const identity = legacyBattleRecordIdentity(record);
    const count = mirrored.get(identity) ?? 0;
    if (count === 0) return true;
    mirrored.set(identity, count - 1);
    return false;
  });
}

// NOTE: createPlayer 工厂函数 — 1:1 翻译自 battle.js（行 143~171）
function createPlayer(id: number): PlayerState {
  return {
    id,
    isReady: false,
    canStart: false,
    isTiming: false,
    hasFinished: false,
    // NOTE: WCA 观察状态（Solo 模式）
    isInspecting: false,
    inspectionStart: 0,
    inspectionTimer: null,
    inspectionPenalty: null,
    penalty: PENALTY.OK,
    // NOTE: 以 ms 为单位的解题时间
    time: 0,
    // performance.now() 时间戳（单调时钟，更精确）
    startTime: 0,
    // NOTE: 多阶段计时 — phaseSplits 存储每次分段的时间戳
    phaseSplits: [],
    // 累积比分（刷新即清零）
    points: 0,
    // 此玩家绑定的 pointerId（多点触控隔离）
    pointerId: null,
    // requestAnimationFrame ID
    rafId: null,
    // NOTE: 成绩历史 — 对象数组
    solveHistory: [],
  };
}

// NOTE: 是否为盲拧项目（3BLD/4BLD/5BLD）— 自动启用 memo 分段
function isBLD(puzzleId: string): boolean {
  return ['333bf', '444bf', '555bf'].includes(puzzleId);
}

/**
 * 共用同一条打乱的一组玩家(ids)当前该不该把打乱藏起来。
 *
 * 条件是「组里已经有人在计时,且没人还没起表」:
 *   - 同时开始 —— 全员同一刻起表,等价于「有人在计时」这个老判据;
 *   - 各自开始 —— 先起表的人不能把打乱从还没起表的队友眼前抽走,得等最后一个人也起表。
 * 全员停表后 isTiming 全假 → 重新显示(下一轮的新打乱由 checkBothFinished 换上)。
 */
export const isScrambleHidden = isLocalBattleScrambleHidden;

// NOTE: 引擎固定承载 4 个玩家槽位;实际参战人数由 playerCount (2~4) 决定,
//   多余槽位保持空闲,不参与状态机/渲染。
export const MAX_PLAYERS = LOCAL_BATTLE_MAX_PLAYERS;

function freshPlayers(): PlayerState[] {
  return Array.from({ length: MAX_PLAYERS }, (_, i) => createPlayer(i));
}

// NOTE: 启动时载入各槽位的 puzzle。新 key (battle_puzzle_N) 缺失时回退到旧 key (battle_puzzle)
function loadInitialPuzzleIds(): string[] {
  const legacy = localStorage.getItem(LS_PREFIX + 'puzzle');
  return Array.from({ length: MAX_PLAYERS }, (_, i) =>
    localStorage.getItem(LS_PREFIX + `puzzle_${i}`) ?? legacy ?? '333');
}

// NOTE: Web Speech API 语音播报（零依赖）— 1:1 翻译自 battle.js（行 1975~1990）
function speakAlert(text: string, locale: string): void {
  try {
    if ('speechSynthesis' in window) {
      const isZh = locale === 'zh';
      const zhMap: Record<string, string> = { '8 seconds': '八秒', '12 seconds': '十二秒' };
      const u = new SpeechSynthesisUtterance(isZh ? (zhMap[text] || text) : text);
      u.lang = isZh ? 'zh-CN' : 'en-US';
      u.rate = 1.2;
      u.volume = 0.8;
      speechSynthesis.speak(u);
    }
  } catch (_) {
    // NOTE: 不支持时静默失败
  }
}

// NOTE: Mo3 — 最近 3 次 Mean（不去最好最差，含 DNF 则 DNF）
// 1:1 翻译自 battle.js（行 2010~2015）
export function computeMo3(history: SolveEntry[]): number | null {
  if (history.length < 3) return null;
  const last3 = history.slice(-3).map(getEffectiveTimeFromEntry);
  if (last3.some(t => t === Infinity)) return Infinity;
  return Math.round((last3[0] + last3[1] + last3[2]) / 3);
}

// NOTE: 遍历所有历史，找出 session best average（最小非 null 非 Infinity 值）
// 1:1 翻译自 battle.js（行 2023~2032）
export function findBestAverage(
  history: SolveEntry[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  computeFn: (h: SolveEntry[]) => number | null,
  minLen: number,
): number | null {
  let best: number | null = null;
  for (let i = minLen; i <= history.length; i++) {
    const val = computeFn(history.slice(0, i));
    if (val !== null && val !== Infinity) {
      if (best === null || val < best) best = val;
    }
  }
  return best;
}

/** 这个槽位现在算不算参战(solo 只有 0 号)。三个 cube* 动作共用同一道闸。 */
function inPlay(s: BattleState, playerId: number): boolean {
  if (playerId < 0) return false;
  return s.mode === 'solo' ? playerId === 0 : playerId < s.playerCount;
}

// ===== Store 接口定义 =====

export interface BattleState {
  // NOTE: Solo/1v1 模式（'solo' 或 '1v1'）
  mode: BattleMode;
  // NOTE: 1v1 布局（versus=面对面, side=并排）;3/4 人时由 UI 强制田字格,忽略此值
  layout: BattleLayout;
  // NOTE: 参战人数(2~4)。所有 per-player 数组固定 MAX_PLAYERS 长,只有前 playerCount 个槽位参战
  playerCount: number;
  // 每位玩家的项目 ID。Solo 只用 puzzleIds[0]
  // NOTE: 1v1 中各自独立选；同 id 的玩家强制同 scramble（见 loadNewScramble）
  puzzleIds: string[];
  // NOTE: 每位玩家的计时键(KeyboardEvent.key 原样存;单字母大小写不敏感,由 keyToPlayer
  //   归一化比较)。可在设置里自定义;冲突(和另一位玩家重复)时与对方互换,不会撞键。
  playerKeys: string[];
  // NOTE: 正在设置面板里录键的玩家槽位(null=没在录)。非持久化 UI 态 —— 录键期间
  //   全局 useKeyboardControls 必须跳过(见 keyToPlayer 调用点),否则按下的键会先
  //   被当成「计时按下」触发,而不是被捕获成新绑定。
  recordingKeyFor: number | null;
  // 是否显示计时中的时间
  showTime: boolean;
  // 是否显示打乱图
  showImage: boolean;
  // NOTE: 多人对战时是否把上排(3/4 人田字格)/ versus 上方玩家旋转 180°。
  //   默认 true(围坐一桌、上排面向对面玩家);同向观看(如都站一侧)时可关。
  flipTopRow: boolean;
  // NOTE: 多人对战起表方式。默认 false = 各自开始:每人自己按住 → 自己的红灯延时 →
  //   自己松手起表,谁都不用等别人。true = 同时开始(旧行为):全员按住才进红灯延时,
  //   第一个松手的人带着全员一起起表(共用同一 startTime)。
  //   两种模式下一轮的结算口径不变 —— 仍是全员停表后才记历史 / 判胜负 / 换打乱。
  syncStart: boolean;
  // WCA 观察倒计时时长（秒）：0=OFF, 8, 15(WCA), 9999=∞
  inspectionTime: number;
  // 观察语音提示（8s/12s）
  voice: boolean;
  // NOTE: 多阶段计时（1=正常, 2=BLD-style, 4=CFOP）
  phases: number;
  // 当前打乱图字号缩放比例
  scrambleScale: number;
  // NOTE: 背景不透明度（0.1~1.0），双方共用
  bgOpacity: number;
  // NOTE: 每位玩家自定义背景色（hex；空串 = 默认黑底）
  bgColors: string[];
  // NOTE: 每位玩家自定义背景图（base64 data URL；null = 不用图片）
  bgImages: (string | null)[];
  // NOTE: 每位玩家的 event picker 是否打开(打开时在自己 TimerArea 内覆盖大网格)
  eventPickerOpen: boolean[];
  // NOTE: 计时器精确度（小数位数：0=秒, 1=0.1s, 2=0.01s, 3=0.001s）
  timerPrecision: number;
  // NOTE: 启动延时（ms），按住多久后才能开始计时
  startDelay: number;
  /**
   * 智能魔方的语义:一人一颗,还是一颗轮流拧。
   *
   * `'own'`   — 每人自己一颗。四路蓝牙各连各的,谁拧谁起表,互不影响。
   * `'shared'`— 全场一颗,拧完传给下一个。只连一路,事件全记在「现在拿着魔方的
   *             那个人」(`cubeHolder`)头上;他停表之后自动传给下一个还没拧完的人。
   *
   * 两种都要,因为它们是两种真实场景:自己家里几个人各带各的魔方,和线下活动上
   * 只有一颗智能魔方轮流上。
   */
  cubeMode: 'own' | 'shared';
  /** `'shared'` 下现在拿着魔方的是谁。`'own'` 下无意义。 */
  cubeHolder: number;
  // NOTE: 用户选择显示的 Average 类型
  enabledAverages: number[];
  // NOTE: 目标 Ao5 时间（秒，用于进度条显示）
  goalTime: number;
  // 每位玩家当前的打乱
  scrambles: (string | null)[];
  // 每位玩家当前的打乱图 data URL
  scrambleImageUrls: (string | null)[];
  // 每位玩家是否正在加载打乱
  scrambleLoadings: boolean[];
  // 赢家标识
  winners: number[];
  /** Atomic multiplayer history; never reconstructed from per-player array indexes. */
  battleRounds: LocalBattleRound[];
  /** Visible persistence/recovery warning; failures must never look saved. */
  battleHistoryWarning: BattleHistoryWarning | null;
  // NOTE: 红灯→绿灯的延时计时器 ID,按玩家槽位存(各自开始模式下每人一条独立延时)。
  //   同时开始模式只有一条延时,写进全部参战槽位(同一 handle,clearTimeout 幂等)。
  readyTimers: (ReturnType<typeof setTimeout> | null)[];
  // 两个玩家状态
  players: PlayerState[];
  // NOTE: 撤销栈
  undoStack: Array<{ index: number; entry: SolveEntry }>;
  // NOTE: Session 管理
  sessionId: string;
  sessions: Session[];
  // NOTE: 当前 locale
  locale: string;
  // NOTE: 当前 tab（Solo 模式）
  activeTab: TabName;

  // ===== Actions =====
  // NOTE: 初始化 — 从 localStorage 加载所有设置
  init: () => void;
  // NOTE: 打乱相关。playerId 不传则两人都重生
  loadNewScramble: (playerId?: number) => void;
  // NOTE: 状态机核心
  playerDown: (playerId: number) => boolean;
  playerUp: (playerId: number) => void;
  /** Abort a held/armed press without starting; used by pointercancel and lifecycle loss. */
  playerCancel: (playerId: number) => void;
  /**
   * 智能魔方三件套。和按键那条路**并存**而不是互相翻译 —— 合成假的按键事件会
   * 把「按住多久」这种按键才有的语义强加给一颗魔方。
   *
   * `cubeArm`   拧到与打乱一致 → 直接绿灯。没有红灯延时:按键那 300ms 防的是
   *             「手放上去还没准备好」,而把魔方拧回打乱状态本身就是准备好了。
   * `cubeStart` 第一下转动起表(csTimer 的规矩,solo 那边已经这么干了)。
   * `cubeStop`  拧回复原 → 停表。
   *
   * 两个时刻参数都是 `performance.now()` 口径的**本地**时刻,由调用方把设备时钟
   * 换算好再传进来 —— store 里全部时间都是本地时钟,混进设备时钟会让计时错几百毫秒。
   *
   * 返回值 = 这一下有没有被采纳(状态不对时什么也不做)。
   */
  cubeArm: (playerId: number) => boolean;
  cubeStart: (playerId: number, atMs: number) => boolean;
  cubeStop: (playerId: number, atMs: number) => boolean;
  setCubeMode: (mode: 'own' | 'shared') => void;
  setCubeHolder: (playerId: number) => void;
  /** 传给下一个还没拧完的人;都拧完了就停在原地。 */
  advanceCubeHolder: () => void;
  // NOTE: 罚时处理
  handlePenalty: (playerId: number, penaltyType: PenaltyType) => void;
  // NOTE: 设置操作
  deleteLast: () => void;
  toggleShowTime: () => void;
  resetAll: () => void;
  // target 只换该玩家。Solo 始终 target=0；1v1 各自独立
  changePuzzle: (target: number, puzzleId: string) => void;
  // NOTE: 自定义按键;和另一位玩家当前键冲突时与其互换
  setPlayerKey: (target: number, key: string) => void;
  setRecordingKeyFor: (target: number | null) => void;
  setMode: (mode: BattleMode) => void;
  setLayout: (layout: BattleLayout) => void;
  // NOTE: 参战人数(2~4)。切换时重置回合/比分,按槽位重新加载各自历史
  setPlayerCount: (n: number) => void;
  setInspectionTime: (time: number) => void;
  setVoice: (voice: boolean) => void;
  setPhases: (phases: number) => void;
  setShowImage: (show: boolean) => void;
  setFlipTopRow: (flip: boolean) => void;
  setSyncStart: (sync: boolean) => void;
  setScrambleScale: (scale: number) => void;
  setBgOpacity: (opacity: number) => void;
  // NOTE: 单侧背景色;传空串清除
  setBgColor: (playerId: number, color: string) => void;
  // NOTE: 单侧背景图(base64);传 null 清除。返回 false 表示图片超过 BG_MAX_BYTES
  setBgImage: (playerId: number, dataUrl: string | null) => void;
  // NOTE: 单侧背景重置(色 + 图都清)
  resetBg: (playerId: number) => void;
  // NOTE: 切换 / 关闭某玩家的 event picker overlay
  setEventPickerOpen: (playerId: number, open: boolean) => void;
  setTimerPrecision: (precision: number) => void;
  setStartDelay: (delay: number) => void;
  setGoalTime: (goal: number) => void;
  setEnabledAverages: (averages: number[]) => void;
  setLocale: (locale: string) => void;
  // NOTE: Session 管理
  switchSession: (sessionId: string) => void;
  newSession: () => void;
  renameSession: () => void;
  deleteSession: () => void;
  // NOTE: Tab 切换
  switchTab: (tab: TabName) => void;
  // NOTE: 历史操作
  undoDelete: () => void;
  deleteHistoryItem: (index: number) => void;
  // NOTE: 1v1 模式删除某一轮(同时去掉双方对应 entry;最后一轮还会撤销该轮 points)
  deleteVsRound: (index: number) => void;
  // NOTE: Solo 数据持久化
  saveSolveHistory: () => void;
  loadSolveHistory: () => void;
  // NOTE: 检查里程碑
  checkMilestone: () => void;
  // NOTE: 检查疲劳
  checkFatigue: () => void;
  // NOTE: inspection
  startInspection: (playerId: number) => void;
  clearInspection: (playerId: number) => void;
  // NOTE: 内部辅助方法（状态机内部调用）
  resetForNextRound: () => void;
  // 刚按住的那位玩家;各自开始模式下只为他起红灯延时,同时开始模式忽略此参数看全员
  checkBothReady: (playerId: number) => void;
  checkBothFinished: () => void;
  // 不传 playerId = 清掉全部槽位的红灯延时
  cancelReadyTimer: (playerId?: number) => void;
  computeWinner: () => void;
  removeLastWinner: () => void;
}

// ===== Store 实现 =====

const initialBattleSessionId = localStorage.getItem(LS_PREFIX + 'sessionId') || '1';
const initialBattleHistory = loadStoredBattleRounds(initialBattleSessionId);

export const useBattleStore = create<BattleState>((set, get) => ({
  // NOTE: 初始值 — 1:1 翻译自 battle.js state 对象（行 99~141）
  mode: (localStorage.getItem(LS_PREFIX + 'mode') as BattleMode) || '1v1',
  layout: (localStorage.getItem(LS_PREFIX + 'layout') as BattleLayout) || 'versus',
  // NOTE: 人数由 URL ?players= 驱动(BattleView 同步进来),不持久化
  playerCount: 2,
  puzzleIds: loadInitialPuzzleIds(),
  playerKeys: Array.from({ length: MAX_PLAYERS }, (_, i) =>
    localStorage.getItem(LS_PREFIX + `key_${i}`) ?? DEFAULT_PLAYER_KEYS[i]),
  recordingKeyFor: null,
  showTime: localStorage.getItem(LS_PREFIX + 'showTime') !== 'false',
  showImage: localStorage.getItem(LS_PREFIX + 'showImage') !== 'false',
  flipTopRow: localStorage.getItem(LS_PREFIX + 'flipTopRow') !== 'false',
  // 默认各自开始(=== 'true' 而非 !== 'false':没存过时取 false)
  syncStart: localStorage.getItem(LS_PREFIX + 'syncStart') === 'true',
  inspectionTime: parseInt(localStorage.getItem(LS_PREFIX + 'inspectionTime') || '0') || 0,
  voice: localStorage.getItem(LS_PREFIX + 'voice') !== 'false',
  phases: parseInt(localStorage.getItem(LS_PREFIX + 'phases') || '1') || 1,
  scrambleScale: parseFloat(localStorage.getItem(LS_PREFIX + 'scrambleScale') || '1.0') || 1.0,
  bgOpacity: parseFloat(localStorage.getItem(LS_PREFIX + 'bgOpacity') || '1.0') || 1.0,
  bgColors: Array.from({ length: MAX_PLAYERS }, (_, i) =>
    localStorage.getItem(LS_PREFIX + `bg_color_${i}`) || ''),
  bgImages: Array.from({ length: MAX_PLAYERS }, (_, i) =>
    localStorage.getItem(LS_PREFIX + `bg_img_${i}`)),
  eventPickerOpen: Array.from({ length: MAX_PLAYERS }, () => false),
  timerPrecision: (() => { const v = localStorage.getItem(LS_PREFIX + 'timerPrecision'); return v !== null ? parseInt(v) : 3; })(),
  startDelay: (() => { const v = localStorage.getItem(LS_PREFIX + 'startDelay'); return v !== null ? parseInt(v) : 300; })(),
  cubeMode: (() => {
    const v = localStorage.getItem(LS_PREFIX + 'cubeMode');
    return v === 'shared' ? 'shared' as const : 'own' as const;
  })(),
  cubeHolder: 0,
  enabledAverages: JSON.parse(localStorage.getItem(LS_PREFIX + 'enabledAverages') || '[5, 12]'),
  goalTime: parseFloat(localStorage.getItem(LS_PREFIX + 'goalTime') || '0') || 0,
  scrambles: Array.from({ length: MAX_PLAYERS }, () => null),
  scrambleImageUrls: Array.from({ length: MAX_PLAYERS }, () => null),
  scrambleLoadings: Array.from({ length: MAX_PLAYERS }, () => false),
  winners: [],
  battleRounds: initialBattleHistory.rounds,
  battleHistoryWarning: initialBattleHistory.warning,
  readyTimers: Array.from({ length: MAX_PLAYERS }, () => null),
  players: freshPlayers(),
  undoStack: [],
  sessionId: initialBattleSessionId,
  sessions: JSON.parse(localStorage.getItem(LS_PREFIX + 'sessions') || '[{"id":"1","name":"Session 1"}]'),
  locale: (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('lang') : null) || 'en',
  activeTab: 'timer',

  // ===== init =====
  init: () => {
    // NOTE: 一次性迁移:BattleEventPicker 上线前的 puzzle 选择经常因为旧 split 逻辑
    //   被设成奇怪的值(测试残留),首次进入新版时强制清掉,从默认 333 起步。
    //   设置 VERSION_KEY 后刷新不再重置(用户自己后续改的项目正常持久化)。
    const VERSION_KEY = LS_PREFIX + 'event_picker_v1';
    if (localStorage.getItem(VERSION_KEY) !== 'done') {
      localStorage.removeItem(LS_PREFIX + 'puzzle_0');
      localStorage.removeItem(LS_PREFIX + 'puzzle_1');
      localStorage.removeItem(LS_PREFIX + 'puzzle');
      localStorage.removeItem(LS_PREFIX + 'splitPuzzles');
      persistItem(VERSION_KEY, 'done');
      set({ puzzleIds: Array.from({ length: MAX_PLAYERS }, () => '333') });
    }
    get().loadSolveHistory();
    get().loadNewScramble();
  },

  // ===== 打乱生成 =====
  // playerId 不传则全员重生（Solo 始终只对 0 生效）
  // NOTE: 不变量——1v1 模式下同 puzzle 的玩家 scrambles 必须相等。
  //   即使只针对单侧调用,影响范围也扩展到该玩家所在的整个同 puzzle 组。
  loadNewScramble: (playerId?: number) => {
    // 引擎(scrMgr)是异步 <script>,任何早于它的调用都会抛 ReferenceError。所有重生打乱的
    // 路径都汇到这里,所以只在这一处等待,调用方不必各自判空。
    if (!isScrambleEngineReady()) {
      void loadScrambleEngine().then(() => get().loadNewScramble(playerId));
      return;
    }
    const s = get();
    const n = s.mode === 'solo' ? 1 : s.playerCount;
    const targets = playerId === undefined
      ? Array.from({ length: n }, (_, i) => i)
      : [playerId];

    // NOTE: 按 puzzle 分组——每组共享一条打乱
    const targetEvents = new Set(targets.map((target) => s.puzzleIds[target]));
    const activeSlots = n === 1 ? [0] : localBattlePlayerSlots(n);
    const groups = groupLocalBattlePlayersByEvent(
      s.puzzleIds,
      activeSlots.filter((playerId) => targetEvents.has(s.puzzleIds[playerId])),
    );
    const affected = [...groups.values()].flat();
    // WCA 真实打乱模式(打乱来源在共享的 timer 设置里,Solo / Duo 同一份配置)
    const useWca = getSettings().scrambleSource === 'wca';

    // 1) 把受影响的槽位标记为加载中(清掉旧打乱)
    const loadings: boolean[] = [...s.scrambleLoadings];
    const scramblesNext: (string | null)[] = [...s.scrambles];
    const imagesNext: (string | null)[] = [...s.scrambleImageUrls];
    for (const i of affected) {
      loadings[i] = true;
      scramblesNext[i] = null;
      imagesNext[i] = null;
    }
    set({ scrambleLoadings: loadings, scrambles: scramblesNext, scrambleImageUrls: imagesNext });

    // 把一个具体打乱写进若干槽位(同 puzzle 共享时一份复制给两人),并解除 loading。
    // 打乱图由 TimerArea 的 CubingPreview 从打乱串直接渲染,scrambleImageUrls 已是死状态
    // (无组件读取),故不再调 generateScrambleImageUrl(该函数在 Next port 缺 image.js 全局会抛)。
    const commit = (idxs: number[], text: string) => {
      const cur = get();
      const ns: (string | null)[] = [...cur.scrambles];
      const ni: (string | null)[] = [...cur.scrambleImageUrls];
      const nl: boolean[] = [...cur.scrambleLoadings];
      for (const i of idxs) { ns[i] = text; ni[i] = null; nl[i] = false; }
      set({ scrambles: ns, scrambleImageUrls: ni, scrambleLoadings: nl });
    };

    // 队列为空时异步取一条真实打乱填回。期间若 puzzle 改了 / 关了 WCA / 已被填,放弃;
    // 取不到(该比赛无此项目 / 网络失败)→ 回退本地生成。
    const fillWca = (idxs: number[], puzzleId: string, spec: WcaSourceSpec) => {
      void nextWca(spec).then((real) => {
        if (getSettings().scrambleSource !== 'wca') return;
        const cur = get();
        for (const i of idxs) if (cur.puzzleIds[i] !== puzzleId) return;
        if (idxs.some((i) => cur.scrambles[i] != null)) return;
        commit(idxs, real ?? generateScramble(puzzleId));
      });
    };

    // 2) 派发:同 puzzle 组一份复制给全组;不同 puzzle 各组独立生成
    const drawInto = (idxs: number[], puzzleId: string) => {
      const spec = useWca ? wcaSpecFor(puzzleId) : null;
      if (spec && hasWcaSource(spec)) {
        const sync = peekWca(spec);
        if (sync != null) commit(idxs, sync);
        else fillWca(idxs, puzzleId, spec); // 队列空 → 保持 loading,异步填
      } else {
        commit(idxs, generateScramble(puzzleId));
      }
    };

    for (const [puz, idxs] of groups) drawInto(idxs, puz);
  },

  // ===== 状态机核心 =====

  // ===== 智能魔方三件套 =====
  // 走的是和按键同一套 player 字段(isReady / canStart / isTiming / hasFinished),
  // 所以「一半人用魔方、一半人用键盘」是自然成立的,不需要第二套状态。

  cubeArm: (playerId: number): boolean => {
    const s = get();
    if (!inPlay(s, playerId)) return false;
    // 上一轮全员拧完了 → 这一下是「开下一轮」。和 playerDown 同一条规则。
    if (s.mode !== 'solo' && s.players.slice(0, s.playerCount).every(pl => pl.hasFinished)) {
      get().resetForNextRound();
    } else if (s.mode === 'solo' && s.players[0].hasFinished) {
      get().resetForNextRound();
    }
    const st = get();
    const p = st.players[playerId];
    if (p.isTiming || p.hasFinished) return false;
    if (!st.scrambles[playerId]) return false;
    get().cancelReadyTimer(playerId);
    const players = [...st.players];
    /**
     * 「同时开始」下,预备是一次**集合**:全员到齐才一起绿灯(checkBothReady 的判据
     * 是 `every(isReady && !canStart)`)。魔方这一路要是自己先绿了,那条判据就永远
     * 凑不齐 —— 谁都起不了表,而且这一轮连结算都走不到(全员 hasFinished 才收尾),
     * 只能靠关掉「同时开始」或刷新页面脱身。所以这里按「他已经准备好了」入列,
     * 绿灯仍旧由集合那条统一给。
     */
    if (st.syncStart && st.mode !== 'solo') {
      players[playerId] = { ...p, isReady: true, canStart: false };
      set({ players });
      get().checkBothReady(playerId);
      return true;
    }
    // 各自开始:直接绿灯,不走红灯延时 —— 那 300ms 防的是「手放上去还没准备好」,
    // 而把魔方拧回打乱状态本身就是准备好了,再让人干等 300ms 只是噪声。
    players[playerId] = { ...p, isReady: false, canStart: true };
    set({ players });
    return true;
  },

  cubeStart: (playerId: number, atMs: number): boolean => {
    const s = get();
    if (!inPlay(s, playerId)) return false;
    const p = s.players[playerId];
    if (p.isTiming || p.hasFinished) return false;
    // 没预备就转动 = 还在打乱 / 手滑,不起表。预备是 cubeArm 给的。
    if (!p.canStart) return false;
    get().cancelReadyTimer(playerId);
    const players = [...s.players];
    // startTime 用魔方那一下的**本地时刻**,不是现在 —— BLE 一批可以晚到几十毫秒,
    // 用 performance.now() 会白送出去那几十毫秒。
    players[playerId] = {
      ...p,
      canStart: false,
      isReady: false,
      isTiming: true,
      startTime: atMs,
      time: 0,
      phaseSplits: [],
      penalty: p.inspectionPenalty ? p.penalty : PENALTY.OK,
    };
    set({ players });
    get().clearInspection(playerId);
    return true;
  },

  cubeStop: (playerId: number, atMs: number): boolean => {
    const s = get();
    if (!inPlay(s, playerId)) return false;
    const p = s.players[playerId];
    if (!p.isTiming) return false;
    const elapsed = atMs - p.startTime;
    // 起表后立刻又「复原」= 打乱没拧完 / 误报,不算一把。和按键那条同一道闸。
    if (elapsed <= MIN_SOLVE_TIME) return false;
    let penalty = p.penalty;
    if (p.inspectionPenalty === '+2') penalty = PENALTY.PLUS2;
    else if (p.inspectionPenalty === 'dnf') penalty = PENALTY.DNF;
    const players = [...s.players];
    players[playerId] = { ...p, time: elapsed, isTiming: false, hasFinished: true, penalty };
    if (p.rafId !== null) cancelAnimationFrame(p.rafId);
    set({ players });
    get().checkBothFinished();      // 传魔方也在里面 —— 见 advanceCubeHolder 的注释
    return true;
  },

  setCubeMode: (mode: 'own' | 'shared') => {
    persistItem(LS_PREFIX + 'cubeMode', mode);
    set({ cubeMode: mode, cubeHolder: 0 });
  },

  setCubeHolder: (playerId: number) => {
    const s = get();
    if (playerId < 0 || playerId >= s.playerCount) return;
    set({ cubeHolder: playerId });
  },

  /**
   * 维持一条不变量:**魔方不停在已经拧完的人手里**。
   *
   * 原先这一步只挂在 `cubeStop` 上,可是「拧完」不止魔方那一条路 —— 队友用按键停表、
   * 观察超时自动 DNF,都会让持有者变成一个已经拧完的人。而 `checkArm` 对已完成的人
   * 恒拒(`cubeArm` 的 `p.hasFinished` 那道),于是下一位怎么拧都预备不了,整颗魔方
   * 这一轮就废了,只能手点「轮到」那排按钮救回来。所以改挂在 `checkBothFinished` 上
   * —— 四个「拧完」的落点全都会走到那里。
   *
   * 因此这里必须**幂等**:持有者还没拧完就原地不动,不能见谁拧完都往下推一格。
   */
  advanceCubeHolder: () => {
    const s = get();
    if (s.cubeMode !== 'shared' || s.mode === 'solo') return;
    if (!s.players[s.cubeHolder]?.hasFinished) return;
    const n = s.playerCount;
    for (let step = 1; step <= n; step++) {
      const cand = (s.cubeHolder + step) % n;
      if (!s.players[cand].hasFinished) { set({ cubeHolder: cand }); return; }
    }
    // 全员拧完了 —— 停在原地,下一轮由 resetForNextRound 之后的 arm 决定。
  },

  // 1:1 翻译自 battle.js playerDown()（行 542~636）
  playerDown: (playerId: number): boolean => {
    const s = get();
    const isSolo = s.mode === 'solo';

    // NOTE: Solo 模式只处理 player 0;1v1 忽略未参战槽位
    if (isSolo && playerId !== 0) return false;
    if (!isSolo && playerId >= s.playerCount) return false;

    const p = s.players[playerId];

    if (isSolo) {
      // === Solo 模式状态机 ===
      if (p.hasFinished) {
        // 上一轮已完成 → 重置进入下一轮
        get().resetForNextRound();
      }
      if (p.isInspecting) {
        // NOTE: 观察中按下 → 进入准备状态
        const newPlayers = [...s.players];
        newPlayers[playerId] = { ...p, isReady: true };
        set({ players: newPlayers });
        get().checkBothReady(playerId);
        return true;
      }
      if (p.isTiming) {
        // 计时中按下
        const elapsed = performance.now() - p.startTime;
        if (elapsed > MIN_SOLVE_TIME) {
          // NOTE: 多阶段计时 — 获取有效阶段数（BLD 强制 2 阶段）
          const numPhases = isBLD(s.puzzleIds[0]) ? 2 : s.phases;
          if (numPhases > 1 && p.phaseSplits.length < numPhases - 1) {
            // 记录分段时间（不停表）
            const newPlayers = [...s.players];
            newPlayers[playerId] = {
              ...p,
              phaseSplits: [...p.phaseSplits, elapsed],
            };
            set({ players: newPlayers });
            return true;
          }
          // NOTE: 应用观察罚时（如果有）
          let penalty = p.penalty;
          if (p.inspectionPenalty === '+2') {
            penalty = PENALTY.PLUS2;
          } else if (p.inspectionPenalty === 'dnf') {
            penalty = PENALTY.DNF;
          }
          const newPlayers = [...s.players];
          newPlayers[playerId] = {
            ...p,
            time: elapsed,
            hasFinished: true,
            isTiming: false,
            penalty,
          };
          if (p.rafId !== null) cancelAnimationFrame(p.rafId);
          set({ players: newPlayers });
          get().checkBothFinished();
        }
        return true;
      }
      if (!p.hasFinished && !p.canStart && s.scrambles[0]) {
        // 空闲状态按下 → 准备
        const newPlayers = [...s.players];
        newPlayers[playerId] = { ...p, isReady: true };
        set({ players: newPlayers });
        get().checkBothReady(playerId);
        return true;
      }
      return false;
    }

    // === 1v1 模式原有逻辑(推广到 N 人:全员完成才能进入下一轮) ===
    if (s.players.slice(0, s.playerCount).every(pl => pl.hasFinished)) {
      get().resetForNextRound();
    }

    // NOTE: 重新读取——resetForNextRound 可能改了 players
    const ps = get().players[playerId];

    if (ps.isTiming) {
      const elapsed = performance.now() - ps.startTime;
      if (elapsed > MIN_SOLVE_TIME) {
        const newPlayers = [...get().players];
        newPlayers[playerId] = {
          ...ps,
          time: elapsed,
          hasFinished: true,
          isTiming: false,
        };
        if (ps.rafId !== null) cancelAnimationFrame(ps.rafId);
        set({ players: newPlayers });
        // NOTE: 立即触发 confetti + vibrate（在 UI 组件中处理）
        get().checkBothFinished();
      }
      return true;
    } else if (!ps.hasFinished && !ps.canStart && get().scrambles[playerId]) {
      const newPlayers = [...get().players];
      newPlayers[playerId] = { ...ps, isReady: true };
      set({ players: newPlayers });
      get().checkBothReady(playerId);
      return true;
    }
    return false;
  },

  // 1:1 翻译自 battle.js playerUp()（行 641~711）
  playerUp: (playerId: number) => {
    const s = get();
    const isSolo = s.mode === 'solo';

    if (isSolo && playerId !== 0) return;
    if (!isSolo && playerId >= s.playerCount) return;

    const p = s.players[playerId];

    if (isSolo) {
      // === Solo 模式 ===
      if (p.canStart) {
        // NOTE: inspection 开启时，松手开始观察倒计时
        if (s.inspectionTime > 0 && !p.isInspecting && !p.isTiming) {
          const newPlayers = [...s.players];
          newPlayers[playerId] = { ...p, canStart: false, isReady: false };
          set({ players: newPlayers });
          get().startInspection(playerId);
          return;
        }
        // 松手开始计时
        const newPlayers = [...s.players];
        newPlayers[playerId] = {
          ...p,
          canStart: false,
          isTiming: true,
          isReady: false,
          startTime: performance.now(),
          time: 0,
          phaseSplits: [],
          penalty: p.inspectionPenalty ? p.penalty : PENALTY.OK,
        };
        set({ players: newPlayers });
        // NOTE: 清除观察状态
        get().clearInspection(playerId);
        return;
      }
      if (p.isReady && !p.isTiming && !p.hasFinished) {
        get().cancelReadyTimer(0);
        const newPlayers = [...s.players];
        newPlayers[playerId] = { ...p, isReady: false };
        set({ players: newPlayers });
      }
      return;
    }

    // === 1v1 模式原有逻辑 ===
    if (p.canStart) {
      const startTime = performance.now();
      const newPlayers = [...s.players];
      if (s.syncStart) {
        // --- 同时开始:第一名玩家松手触发,带着全部已绿灯的玩家共用同一 startTime ---
        for (let i = 0; i < s.playerCount; i++) {
          const player = s.players[i];
          if (player.canStart) {
            newPlayers[i] = {
              ...player,
              canStart: false,
              isTiming: true,
              isReady: false,
              startTime,
              time: 0,
              penalty: PENALTY.OK,
            };
          }
        }
      } else {
        // --- 各自开始:只起自己这一路,别人还在看打乱 / 还在拧都不受影响 ---
        newPlayers[playerId] = {
          ...p,
          canStart: false,
          isTiming: true,
          isReady: false,
          startTime,
          time: 0,
          penalty: PENALTY.OK,
        };
      }
      set({ players: newPlayers });
    } else if (p.isReady && !p.isTiming && !p.hasFinished) {
      // NOTE: 红灯期间松手 → 恢复 idle（黑色），取消红灯延时。
      //   同时开始:延时是全员共有的,整条作废;各自开始:只作废自己那条。
      get().cancelReadyTimer(s.syncStart ? undefined : playerId);
      const newPlayers = [...s.players];
      newPlayers[playerId] = { ...p, isReady: false };
      set({ players: newPlayers });
    }
  },

  playerCancel: (playerId: number) => {
    const s = get();
    if (!inPlay(s, playerId)) return;
    const player = s.players[playerId];
    // Stopping happens on pointer/key down. If that already completed a solve, a later platform
    // cancel must not rewrite the finished state or disturb another player's live timer.
    if (player.isTiming || player.hasFinished) return;
    const synchronized = s.mode !== 'solo' && s.syncStart;
    get().cancelReadyTimer(synchronized ? undefined : playerId);
    const targets = synchronized
      ? Array.from({ length: s.playerCount }, (_, index) => index)
      : [playerId];
    const players = [...s.players];
    for (const target of targets) {
      const current = players[target];
      if (!current.isTiming && !current.hasFinished) {
        players[target] = { ...current, isReady: false, canStart: false };
      }
    }
    set({ players });
  },

  // ===== 内部辅助方法（挂在 action 上但不对外暴露接口） =====

  // 1:1 翻译自 battle.js checkBothReady()（行 785~815）
  // 红灯 → 绿灯的延时。谁进绿灯取决于起表方式:
  //   solo / 各自开始 → 只看刚按住的这位,延时到点只点亮他自己;
  //   同时开始       → 全员按住才起延时,到点一起点亮(旧行为)。
  checkBothReady: (playerId: number) => {
    const s = get();
    const solo = s.mode === 'solo';

    // 单人点亮:solo 与「各自开始」共用同一条路径
    if (solo || !s.syncStart) {
      const target = solo ? 0 : playerId;
      const p = s.players[target];
      if (!p.isReady || p.canStart) return;
      const timer = setTimeout(() => {
        const curr = get();
        if (curr.players[target].isReady) {
          const newPlayers = [...curr.players];
          newPlayers[target] = { ...curr.players[target], canStart: true };
          const timers = [...curr.readyTimers];
          timers[target] = null;
          set({ players: newPlayers, readyTimers: timers });
        }
      }, s.startDelay);
      const timers = [...s.readyTimers];
      timers[target] = timer;
      set({ readyTimers: timers });
      return;
    }

    // === 同时开始(推广到 N 人:全员按住才进入红灯延时) ===
    const active = s.players.slice(0, s.playerCount);
    if (active.every(pl => pl.isReady && !pl.canStart)) {
      const timer = setTimeout(() => {
        const curr = get();
        if (curr.players.slice(0, curr.playerCount).every(pl => pl.isReady)) {
          const newPlayers = [...curr.players];
          const timers = [...curr.readyTimers];
          for (let i = 0; i < curr.playerCount; i++) {
            newPlayers[i] = { ...curr.players[i], canStart: true };
            timers[i] = null;
          }
          set({ players: newPlayers, readyTimers: timers });
        }
      }, s.startDelay);
      // 同一 handle 写进全部参战槽位 —— 任一槽位被取消即整条作废
      const timers = [...s.readyTimers];
      for (let i = 0; i < s.playerCount; i++) timers[i] = timer;
      set({ readyTimers: timers });
    }
  },

  // playerId 省略 = 清掉全部槽位(换人数 / 同时开始模式下任一人松手)
  cancelReadyTimer: (playerId?: number) => {
    const s = get();
    const targets = playerId === undefined
      ? s.readyTimers.map((_, i) => i)
      : [playerId];
    if (!targets.some(i => s.readyTimers[i])) return;
    const timers = [...s.readyTimers];
    for (const i of targets) {
      if (timers[i]) clearTimeout(timers[i]);
      timers[i] = null;
    }
    set({ readyTimers: timers });
  },

  // 1:1 翻译自 battle.js checkBothFinished()（行 835~880）
  checkBothFinished: () => {
    // 有人拧完了 = 该重新看一眼魔方在谁手里(四条「拧完」的路都汇到这儿)。
    get().advanceCubeHolder();
    const s = get();
    const isSolo = s.mode === 'solo';

    if (isSolo) {
      const p = s.players[0];
      if (p.hasFinished) {
        const entry: SolveEntry = {
          time: p.time,
          penalty: p.penalty === PENALTY.DNF ? 'dnf' : (p.penalty === PENALTY.PLUS2 ? '+2' : 'ok'),
          scramble: s.scrambles[0] || '',
          date: new Date().toISOString(),
        };
        // NOTE: 多阶段分段记录
        if (p.phaseSplits.length > 0) entry.phases = [...p.phaseSplits, p.time];
        const newPlayers = [...s.players];
        newPlayers[0] = { ...p, solveHistory: [...p.solveHistory, entry] };
        set({ players: newPlayers });
        get().saveSolveHistory();
        get().checkMilestone();
        get().checkFatigue();
        // NOTE: 普通停表触觉反馈（非 PB 时的轻微震动）
        if (navigator.vibrate) navigator.vibrate(30);
        get().loadNewScramble();
      }
      return;
    }
    // === 1v1 原有逻辑(推广到 N 人:全员停表才记轮) ===
    if (s.players.slice(0, s.playerCount).every(pl => pl.hasFinished)) {
      // NOTE: 记录成绩到历史
      const roundTs = Date.now();
      const roundDate = new Date(roundTs).toISOString();
      const newPlayers = [...s.players];
      for (let i = 0; i < s.playerCount; i++) {
        const pi = s.players[i];
        newPlayers[i] = {
          ...pi,
          solveHistory: [...pi.solveHistory, {
            time: pi.time,
            penalty: pi.penalty === PENALTY.DNF ? 'dnf' : (pi.penalty === PENALTY.PLUS2 ? '+2' : 'ok'),
            scramble: s.scrambles[i] || '',
            date: roundDate,
          }],
        };
      }
      set({ players: newPlayers });
      get().computeWinner();
      const finalized = get();
      const roundId = createLocalBattleRoundId();
      const attempts = finalized.players.slice(0, finalized.playerCount).map((player, playerId) => {
        const solve: SharedSolve = {
          id: `${roundId}-${playerId}`,
          timeMs: player.time,
          penalty: player.penalty === PENALTY.DNF ? 'DNF' : player.penalty,
          scramble: finalized.scrambles[playerId] || '',
          event: battleToTimerEvent(finalized.puzzleIds[playerId]),
          ts: roundTs,
        };
        return { playerId, solve };
      });
      const round: LocalBattleRound = {
        id: roundId,
        ts: roundTs,
        attempts,
        winners: finalized.winners,
      };
      const battleRounds = [...finalized.battleRounds, round];
      const persisted = persistBattleRounds(finalized.sessionId, battleRounds);
      set({
        battleRounds,
        battleHistoryWarning: warningAfterBattleHistoryWrite(
          finalized.battleHistoryWarning,
          persisted,
        ),
      });
      get().saveSolveHistory();
      get().loadNewScramble();
    }
  },

  // 1:1 翻译自 battle.js resetForNextRound()（行 887~914）
  resetForNextRound: () => {
    const s = get();
    const isSolo = s.mode === 'solo';

    if (isSolo) {
      const p = s.players[0];
      get().clearInspection(0);
      const newPlayers = [...s.players];
      newPlayers[0] = {
        ...p,
        isReady: false,
        canStart: false,
        isTiming: false,
        hasFinished: false,
        inspectionPenalty: null,
      };
      set({ players: newPlayers });
      return;
    }
    // === 1v1 原有逻辑(推广到 N 人) ===
    const newPlayers = [...s.players];
    for (let i = 0; i < s.playerCount; i++) {
      newPlayers[i] = {
        ...s.players[i],
        isReady: false,
        canStart: false,
        isTiming: false,
        hasFinished: false,
      };
    }
    set({ players: newPlayers, winners: [] });
  },

  // 1:1 翻译自 battle.js computeWinner()（行 963~1001;推广到 N 人,最小有效成绩者胜,可并列）
  computeWinner: () => {
    const s = get();
    // 全 DNF → 无胜者(不加分);并列最快 → 共享胜利各 +1。Web/Mobile 共用此规则。
    const winners = localBattleWinnerIndices(s.players.slice(0, s.playerCount));

    const newPlayers = [...s.players];
    for (const i of winners) {
      newPlayers[i] = { ...newPlayers[i], points: newPlayers[i].points + 1 };
    }
    set({ winners, players: newPlayers });
  },

  // ===== 罚时处理 =====
  // 1:1 翻译自 battle.js handlePenalty()（行 1059~1097）
  handlePenalty: (playerId: number, penaltyType: PenaltyType) => {
    const s = get();
    const p = s.players[playerId];
    if (!p.hasFinished || p.isTiming) return;

    const newPlayers = [...s.players];
    newPlayers[playerId] = { ...p, penalty: penaltyType };

    if (s.mode === 'solo') {
      // NOTE: Solo 模式——更新历史中最后一条记录的 penalty 字段
      const h = [...newPlayers[playerId].solveHistory];
      if (h.length > 0) {
        h[h.length - 1] = {
          ...h[h.length - 1],
          penalty: penaltyType === PENALTY.DNF ? 'dnf' : (penaltyType === PENALTY.PLUS2 ? '+2' : 'ok'),
        };
        newPlayers[playerId] = { ...newPlayers[playerId], solveHistory: h };
      }
      set({ players: newPlayers });
      get().saveSolveHistory();
      return;
    }

    // === 1v1 原有逻辑(推广到 N 人) ===
    // NOTE: 更新历史中最后一条记录的 penalty
    for (let i = 0; i < s.playerCount; i++) {
      const ph = [...newPlayers[i].solveHistory];
      if (ph.length > 0) {
        ph[ph.length - 1] = {
          ...ph[ph.length - 1],
          penalty: newPlayers[i].penalty === PENALTY.DNF ? 'dnf' : (newPlayers[i].penalty === PENALTY.PLUS2 ? '+2' : 'ok'),
        };
        newPlayers[i] = { ...newPlayers[i], solveHistory: ph };
      }
    }
    set({ players: newPlayers });

    // NOTE: 全员完成后才重算积分
    if (newPlayers.slice(0, s.playerCount).every(pl => pl.hasFinished)) {
      get().removeLastWinner();
      get().computeWinner();
      const finalized = get();
      const latest = finalized.battleRounds.at(-1);
      if (latest) {
        const updatedRound: LocalBattleRound = {
          ...latest,
          attempts: latest.attempts.map((attempt) => (
            attempt.playerId === playerId
              ? {
                  ...attempt,
                  solve: {
                    ...attempt.solve,
                    penalty: penaltyType === PENALTY.DNF ? 'DNF' : penaltyType,
                  },
                }
              : attempt
          )),
        };
        updatedRound.winners = localBattleRoundWinners(updatedRound);
        const battleRounds = [...finalized.battleRounds.slice(0, -1), updatedRound];
        const persisted = persistBattleRounds(finalized.sessionId, battleRounds);
        set({
          battleRounds,
          battleHistoryWarning: warningAfterBattleHistoryWrite(
            finalized.battleHistoryWarning,
            persisted,
          ),
        });
      }
      get().saveSolveHistory();
    }
  },

  // 1:1 翻译自 battle.js removeLastWinner()（行 1184~1196;按 winners 列表撤销加分）
  removeLastWinner: () => {
    const s = get();
    const newPlayers = [...s.players];
    for (const i of s.winners) {
      newPlayers[i] = { ...newPlayers[i], points: newPlayers[i].points - 1 };
    }
    set({ winners: [], players: newPlayers });
  },

  // ===== 设置操作 =====
  // 1:1 翻译自 battle.js deleteLast()（行 1106~1139）
  deleteLast: () => {
    const s = get();
    if (s.mode === 'solo') {
      const p = s.players[0];
      if (p.solveHistory.length === 0) return;
      const newPlayers = [...s.players];
      newPlayers[0] = {
        ...p,
        solveHistory: p.solveHistory.slice(0, -1),
        time: 0,
        hasFinished: false,
        penalty: PENALTY.OK,
      };
      set({ players: newPlayers });
      get().saveSolveHistory();
      return;
    }
    // === 1v1 原有逻辑(推广到 N 人) ===
    if (!s.players.slice(0, s.playerCount).every(pl => pl.hasFinished)) return;
    if (s.battleRounds.length > 0) {
      // Atomic history is the source of truth for all newly recorded rounds.
      // Reuse its exact-identity deletion path so mixed-event legacy mirrors
      // cannot be truncated by an unrelated array index.
      get().deleteVsRound(s.battleRounds.length - 1);
      const afterDelete = get();
      const resetPlayers = [...afterDelete.players];
      for (let i = 0; i < afterDelete.playerCount; i++) {
        resetPlayers[i] = {
          ...afterDelete.players[i],
          time: 0,
          hasFinished: false,
          penalty: PENALTY.OK,
        };
      }
      set({ players: resetPlayers, winners: [] });
      get().saveSolveHistory();
      return;
    }
    // Legacy-only sessions predate atomic rounds. Preserve their old undo
    // behaviour without pretending the parallel arrays form canonical rounds.
    get().removeLastWinner();
    const newPlayers = [...s.players];
    for (let i = 0; i < s.playerCount; i++) {
      newPlayers[i] = {
        ...s.players[i],
        time: 0,
        hasFinished: false,
        penalty: PENALTY.OK,
        solveHistory: s.players[i].solveHistory.slice(0, -1),
      };
    }
    set({ players: newPlayers });
    get().saveSolveHistory();
  },

  toggleShowTime: () => {
    const s = get();
    const newVal = !s.showTime;
    persistItem(LS_PREFIX + 'showTime', String(newVal));
    set({ showTime: newVal });
  },

  // 1:1 翻译自 battle.js resetAll()（行 1151~1182）
  resetAll: () => {
    const beforeReset = get();
    if (beforeReset.mode === '1v1') {
      const legacyPrefix = `${LS_PREFIX}1v1_history_${beforeReset.sessionId}_`;
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key?.startsWith(legacyPrefix)) localStorage.removeItem(key);
      }
      localStorage.removeItem(battleRoundsKey(beforeReset.sessionId));
      localStorage.removeItem(battleRoundsRecoveryKey(beforeReset.sessionId));
    }
    const newPlayers = freshPlayers();
    set({
      winners: [],
      battleRounds: [],
      battleHistoryWarning: null,
      players: newPlayers,
      undoStack: [],
    });
    const s = get();
    localStorage.removeItem(battleRoundsRecoveryKey(s.sessionId));
    s.saveSolveHistory();
    s.loadNewScramble();
  },

  // target → 仅换该玩家。Solo 始终 target=0；1v1 各自调用
  // NOTE: 同 puzzle 共享 scramble 由 loadNewScramble 的分组逻辑处理
  changePuzzle: (target: number, newPuzzleId: string) => {
    const s = get();
    if (s.puzzleIds[target] === newPuzzleId) return;

    s.saveSolveHistory();

    const newPuzzleIds: string[] = [...s.puzzleIds];
    newPuzzleIds[target] = newPuzzleId;
    persistItem(LS_PREFIX + `puzzle_${target}`, newPuzzleId);
    if (newPuzzleIds.slice(0, s.playerCount).every(p => p === newPuzzleIds[0])) {
      persistItem(LS_PREFIX + 'puzzle', newPuzzleIds[0]);
    }

    // 重置受影响玩家的当前回合（保留 points，loadSolveHistory 会替换 history）
    const newPlayers = [...s.players];
    newPlayers[target] = createPlayer(target);
    newPlayers[target].points = s.players[target].points;

    // NOTE: 其他玩家也重置当前回合状态(保留 points / history)。
    //   否则 P0 切项目后,其他人还卡在上轮 hasFinished=true,playerDown 拒绝进入红灯。
    if (s.mode === '1v1') {
      for (let i = 0; i < s.playerCount; i++) {
        if (i === target) continue;
        newPlayers[i] = {
          ...s.players[i],
          isReady: false,
          canStart: false,
          isTiming: false,
          hasFinished: false,
          isInspecting: false,
          inspectionPenalty: null,
          pointerId: null,
          time: 0,
        };
      }
    }

    set({
      puzzleIds: newPuzzleIds,
      winners: [],
      players: newPlayers,
    });
    get().loadSolveHistory();
    // NOTE: loadNewScramble 内部按同 puzzle 分组,共享组整体重生
    get().loadNewScramble(target);
  },

  setPlayerKey: (target: number, key: string) => {
    const s = get();
    const newKeys = assignLocalBattlePlayerKey(s.playerKeys, target, key);
    newKeys.forEach((next, index) => {
      if (next !== s.playerKeys[index]) persistItem(LS_PREFIX + `key_${index}`, next);
    });
    set({ playerKeys: newKeys });
  },

  setRecordingKeyFor: (target: number | null) => {
    set({ recordingKeyFor: target });
  },

  setMode: (mode: BattleMode) => {
    get().saveSolveHistory();
    persistItem(LS_PREFIX + 'mode', mode);
    const newPlayers = freshPlayers();
    set({
      mode,
      winners: [],
      players: newPlayers,
      activeTab: 'timer',
      cubeHolder: 0,       // 同 setPlayerCount:solo 只有 0 号在场,别留个越界的持有者
    });
    get().loadSolveHistory();
  },

  setLayout: (layout: BattleLayout) => {
    const s = get();
    if (s.layout === layout) return; // NOTE: 避免重复设置
    persistItem(LS_PREFIX + 'layout', layout);
    // Layout is presentation state. Orientation/viewport changes must never stop timers, clear
    // winners, or replace a scramble; Mobile and Web can derive different layouts over one round.
    set({ layout });
  },

  // NOTE: 参战人数(2~4)。切换 = 开新一局:重置回合/比分,按槽位重新加载各自历史
  setPlayerCount: (n: number) => {
    const count = normalizeLocalBattlePlayerCount(n);
    const s = get();
    if (s.playerCount === count) return;
    s.saveSolveHistory();
    get().cancelReadyTimer();
    set({
      playerCount: count,
      winners: [],
      players: freshPlayers(),
      eventPickerOpen: Array.from({ length: MAX_PLAYERS }, () => false),
      // 人数缩了要把魔方交回 0 号:`cubeHolder` 是指进玩家数组的下标,4→2 之后
      // 停在 3 号手里就指到了不参战的槽,`inPlay` 一路 false —— arm/start/stop 全
      // 拒掉,魔方彻底哑掉且没有自愈路径(3 号的传递 chip 压根不渲染)。
      cubeHolder: 0,
    });
    get().loadSolveHistory();
    get().loadNewScramble();
  },

  setInspectionTime: (time: number) => {
    persistItem(LS_PREFIX + 'inspectionTime', String(time));
    set({ inspectionTime: time });
  },

  setVoice: (voice: boolean) => {
    persistItem(LS_PREFIX + 'voice', String(voice));
    set({ voice });
  },

  setPhases: (phases: number) => {
    persistItem(LS_PREFIX + 'phases', String(phases));
    set({ phases });
  },

  setShowImage: (show: boolean) => {
    persistItem(LS_PREFIX + 'showImage', String(show));
    set({ showImage: show });
    if (show) {
      const s = get();
      const newImages: (string | null)[] = [...s.scrambleImageUrls];
      const targets = s.mode === 'solo' ? [0] : Array.from({ length: s.playerCount }, (_, i) => i);
      for (const i of targets) {
        const sc = s.scrambles[i];
        if (sc && !sc.startsWith('⚠️')) {
          newImages[i] = generateScrambleImageUrl(s.puzzleIds[i], sc);
        }
      }
      set({ scrambleImageUrls: newImages });
    } else {
      set({ scrambleImageUrls: Array.from({ length: MAX_PLAYERS }, () => null) });
    }
  },

  setFlipTopRow: (flip: boolean) => {
    persistItem(LS_PREFIX + 'flipTopRow', String(flip));
    set({ flipTopRow: flip });
  },

  // NOTE: 切换起表方式时把在途的红灯 / 绿灯全部作废 —— 两种模式对「谁该亮绿灯」的判定
  //   不同,留着半截状态会出现按住的人永远等不到绿灯。已在计时 / 已完成的不动。
  setSyncStart: (sync: boolean) => {
    persistItem(LS_PREFIX + 'syncStart', String(sync));
    get().cancelReadyTimer();
    const s = get();
    const newPlayers = s.players.map(p =>
      (p.isReady || p.canStart) ? { ...p, isReady: false, canStart: false } : p);
    set({ syncStart: sync, players: newPlayers });
  },

  setScrambleScale: (scale: number) => {
    persistItem(LS_PREFIX + 'scrambleScale', String(scale));
    set({ scrambleScale: scale });
    // NOTE: 同步更新 CSS 变量，确保 .scramble-text 的 calc() 立即生效
    document.documentElement.style.setProperty('--scramble-scale', String(scale));
  },

  setBgOpacity: (opacity: number) => {
    persistItem(LS_PREFIX + 'bgOpacity', String(opacity));
    set({ bgOpacity: opacity });
  },

  // NOTE: 设置背景色;同时清掉图片(色 / 图二选一)
  setBgColor: (playerId: number, color: string) => {
    const s = get();
    const newColors: string[] = [...s.bgColors];
    const newImages: (string | null)[] = [...s.bgImages];
    newColors[playerId] = color;
    newImages[playerId] = null;
    if (color) persistItem(LS_PREFIX + `bg_color_${playerId}`, color);
    else localStorage.removeItem(LS_PREFIX + `bg_color_${playerId}`);
    localStorage.removeItem(LS_PREFIX + `bg_img_${playerId}`);
    set({ bgColors: newColors, bgImages: newImages });
  },

  // NOTE: 设置背景图(base64);同时清掉颜色
  setBgImage: (playerId: number, dataUrl: string | null) => {
    const s = get();
    const newImages: (string | null)[] = [...s.bgImages];
    const newColors: string[] = [...s.bgColors];
    newImages[playerId] = dataUrl;
    if (dataUrl) {
      newColors[playerId] = '';
      try {
        persistItem(LS_PREFIX + `bg_img_${playerId}`, dataUrl);
        localStorage.removeItem(LS_PREFIX + `bg_color_${playerId}`);
      } catch (e) {
        console.warn('Failed to save bg image:', e);
      }
    } else {
      localStorage.removeItem(LS_PREFIX + `bg_img_${playerId}`);
    }
    set({ bgImages: newImages, bgColors: newColors });
  },

  resetBg: (playerId: number) => {
    const s = get();
    const newColors: string[] = [...s.bgColors];
    const newImages: (string | null)[] = [...s.bgImages];
    newColors[playerId] = '';
    newImages[playerId] = null;
    localStorage.removeItem(LS_PREFIX + `bg_color_${playerId}`);
    localStorage.removeItem(LS_PREFIX + `bg_img_${playerId}`);
    set({ bgColors: newColors, bgImages: newImages });
  },

  setEventPickerOpen: (playerId: number, open: boolean) => {
    const s = get();
    // NOTE: 同一时刻只允许一个玩家的 picker 开着(避免遮挡 + 简化交互)
    const next = s.eventPickerOpen.map((v, i) => (i === playerId ? open : (open ? false : v)));
    set({ eventPickerOpen: next });
  },

  setTimerPrecision: (precision: number) => {
    persistItem(LS_PREFIX + 'timerPrecision', String(precision));
    set({ timerPrecision: precision });
  },

  setStartDelay: (delay: number) => {
    persistItem(LS_PREFIX + 'startDelay', String(delay));
    set({ startDelay: delay });
  },

  setGoalTime: (goal: number) => {
    persistItem(LS_PREFIX + 'goalTime', String(goal));
    set({ goalTime: goal });
  },

  setEnabledAverages: (averages: number[]) => {
    persistItem(LS_PREFIX + 'enabledAverages', JSON.stringify(averages));
    set({ enabledAverages: averages });
  },

  setLocale: (locale: string) => {
    set({ locale });
  },

  // ===== Tab 切换 =====
  switchTab: (tab: TabName) => {
    set({ activeTab: tab });
  },

  // ===== Session 管理 =====
  // 1:1 翻译自 battle.js（行 3118~3210 大致区间）
  switchSession: (newSessionId: string) => {
    const s = get();
    s.saveSolveHistory();
    persistItem(LS_PREFIX + 'sessionId', newSessionId);
    const newPlayers = freshPlayers();
    const history = loadStoredBattleRounds(newSessionId);
    set({
      sessionId: newSessionId,
      winners: [],
      battleRounds: history.rounds,
      battleHistoryWarning: history.warning,
      players: newPlayers,
    });
    get().loadSolveHistory();
    get().loadNewScramble();
  },

  newSession: () => {
    const s = get();
    s.saveSolveHistory();
    const newId = String(Date.now());
    const name = `Session ${s.sessions.length + 1}`;
    const newSessions = [...s.sessions, { id: newId, name }];
    persistItem(LS_PREFIX + 'sessions', JSON.stringify(newSessions));
    persistItem(LS_PREFIX + 'sessionId', newId);
    const newPlayers = freshPlayers();
    set({
      sessions: newSessions,
      sessionId: newId,
      winners: [],
      battleRounds: [],
      battleHistoryWarning: null,
      players: newPlayers,
    });
    get().loadNewScramble();
  },

  renameSession: () => {
    const s = get();
    const current = s.sessions.find(ses => ses.id === s.sessionId);
    if (!current) return;
    const newName = prompt('Session name:', current.name);
    if (newName === null || newName.trim() === '') return;
    const newSessions = s.sessions.map(ses =>
      ses.id === s.sessionId ? { ...ses, name: newName.trim() } : ses
    );
    persistItem(LS_PREFIX + 'sessions', JSON.stringify(newSessions));
    set({ sessions: newSessions });
  },

  deleteSession: () => {
    const s = get();
    if (s.sessions.length <= 1) return;
    if (!confirm('Delete this session and all its data?')) return;
    // NOTE: 删除当前 session 的所有 localStorage 数据（solo + legacy 1v1 + atomic rounds）
    const soloPrefix = `${LS_PREFIX}solo_history_${s.sessionId}_`;
    const vsPrefix = `${LS_PREFIX}1v1_history_${s.sessionId}_`;
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && (key.startsWith(soloPrefix) || key.startsWith(vsPrefix))) {
        localStorage.removeItem(key);
      }
    }
    localStorage.removeItem(battleRoundsKey(s.sessionId));
    localStorage.removeItem(battleRoundsRecoveryKey(s.sessionId));
    const newSessions = s.sessions.filter(ses => ses.id !== s.sessionId);
    persistItem(LS_PREFIX + 'sessions', JSON.stringify(newSessions));
    const newSessionId = newSessions[0].id;
    persistItem(LS_PREFIX + 'sessionId', newSessionId);
    const newPlayers = freshPlayers();
    const history = loadStoredBattleRounds(newSessionId);
    set({
      sessions: newSessions,
      sessionId: newSessionId,
      winners: [],
      battleRounds: history.rounds,
      battleHistoryWarning: history.warning,
      players: newPlayers,
    });
    get().loadSolveHistory();
  },

  // ===== 历史操作 =====
  undoDelete: () => {
    const s = get();
    if (s.undoStack.length === 0) return;
    const lastUndo = s.undoStack[s.undoStack.length - 1];
    const newPlayers = [...s.players];
    const p = newPlayers[0];
    const newHistory = [...p.solveHistory];
    newHistory.splice(lastUndo.index, 0, lastUndo.entry);
    newPlayers[0] = { ...p, solveHistory: newHistory };
    set({
      players: newPlayers,
      undoStack: s.undoStack.slice(0, -1),
    });
    get().saveSolveHistory();
  },

  deleteHistoryItem: (index: number) => {
    const s = get();
    const p = s.players[0];
    if (index < 0 || index >= p.solveHistory.length) return;
    const entry = p.solveHistory[index];
    const newHistory = [...p.solveHistory];
    newHistory.splice(index, 1);
    const newPlayers = [...s.players];
    newPlayers[0] = { ...p, solveHistory: newHistory };
    set({
      players: newPlayers,
      undoStack: [...s.undoStack, { index, entry }],
    });
    get().saveSolveHistory();
  },

  // NOTE: 删除一条原子 round；legacy per-player history 只按该 attempt 的完整身份清理，
  // 绝不再用平行数组的同一个 index 猜测它们属于同一场。
  deleteVsRound: (index: number) => {
    const s = get();
    if (s.mode !== '1v1') return;
    if (index < 0 || index >= s.battleRounds.length) return;
    const round = s.battleRounds[index];
    const isLast = index === s.battleRounds.length - 1;
    const battleRounds = s.battleRounds.filter((_, roundIndex) => roundIndex !== index);
    const persisted = persistBattleRounds(s.sessionId, battleRounds);
    if (!persisted) {
      set({ battleHistoryWarning: 'write-failed' });
      return;
    }
    const newPoints = s.players.map(p => p.points);
    if (isLast) for (const winner of round.winners) {
      newPoints[winner] = Math.max(0, (newPoints[winner] ?? 0) - 1);
    }

    const newPlayers = [...s.players];
    let legacyPersisted = true;
    for (const attempt of round.attempts) {
      const legacyPenalty = attempt.solve.penalty === 'DNF' ? 'dnf' : attempt.solve.penalty;
      const matches = (entry: SolveEntry) => entry.time === attempt.solve.timeMs
        && entry.penalty === legacyPenalty
        && entry.scramble === attempt.solve.scramble
        && Date.parse(entry.date) === attempt.solve.ts;
      const player = newPlayers[attempt.playerId];
      const legacyEvent = timerToBattleEvent(attempt.solve.event);
      if (player && s.puzzleIds[attempt.playerId] === legacyEvent) {
        const position = player.solveHistory.findIndex(matches);
        if (position !== -1) {
          const solveHistory = [...player.solveHistory];
          solveHistory.splice(position, 1);
          newPlayers[attempt.playerId] = { ...player, solveHistory };
        }
      }
      try {
        const key = `${LS_PREFIX}1v1_history_${s.sessionId}_${legacyEvent}_${attempt.playerId}`;
        const raw = localStorage.getItem(key);
        const history = raw ? JSON.parse(raw) as unknown : [];
        if (Array.isArray(history)) {
          const position = history.findIndex((entry) => typeof entry === 'object'
            && entry !== null && matches(entry as SolveEntry));
          if (position !== -1) {
            const next = [...history];
            next.splice(position, 1);
            legacyPersisted = persistItem(key, JSON.stringify(next)) && legacyPersisted;
          }
        }
      } catch { /* corrupted legacy history is ignored; the atomic round is still deleted */ }
    }
    for (let i = 0; i < newPlayers.length; i++) {
      const deletedCurrentResult = isLast
        && round.attempts.some((attempt) => attempt.playerId === i)
        && newPlayers[i].hasFinished;
      newPlayers[i] = {
        ...newPlayers[i],
        points: newPoints[i],
        ...(deletedCurrentResult ? {
          time: 0,
          hasFinished: false,
          penalty: PENALTY.OK,
        } : {}),
      };
    }

    set({
      players: newPlayers,
      battleRounds,
      winners: isLast ? [] : s.winners,
      battleHistoryWarning: warningAfterBattleHistoryWrite(
        s.battleHistoryWarning,
        true,
        legacyPersisted,
      ),
    });
  },

  // ===== 数据持久化（Solo + 1v1 共用） =====
  // NOTE: Solo  key = solo_history_{session}_{puzzleP0}
  //       1v1   key = 1v1_history_{session}_{puzzleI}_{i}（每人各自的 puzzle）
  saveSolveHistory: () => {
    const s = get();
    try {
      if (s.mode === 'solo') {
        const key = `${LS_PREFIX}solo_history_${s.sessionId}_${s.puzzleIds[0]}`;
        const h = s.players[0].solveHistory;
        const toSave = h.length > 1000 ? h.slice(-1000) : h;
        persistItem(key, JSON.stringify(toSave));
      } else {
        let legacyPersisted = true;
        for (let i = 0; i < s.playerCount; i++) {
          const key = `${LS_PREFIX}1v1_history_${s.sessionId}_${s.puzzleIds[i]}_${i}`;
          const h = s.players[i].solveHistory;
          const toSave = h.length > 1000 ? h.slice(-1000) : h;
          legacyPersisted = persistItem(key, JSON.stringify(toSave)) && legacyPersisted;
        }
        const canonicalPersisted = persistBattleRounds(s.sessionId, s.battleRounds);
        set({
          battleHistoryWarning: warningAfterBattleHistoryWrite(
            s.battleHistoryWarning,
            canonicalPersisted,
            legacyPersisted,
          ),
        });
      }
    } catch (e) {
      console.warn('Failed to save solve history:', e);
    }
  },

  loadSolveHistory: () => {
    const s = get();
    try {
      if (s.mode === 'solo') {
        const key = `${LS_PREFIX}solo_history_${s.sessionId}_${s.puzzleIds[0]}`;
        const data = localStorage.getItem(key);
        const newPlayers = [...s.players];
        newPlayers[0] = { ...s.players[0], solveHistory: data ? JSON.parse(data) : [] };
        set({ players: newPlayers });
      } else {
        const newPlayers = [...s.players];
        for (let i = 0; i < s.playerCount; i++) {
          const key = `${LS_PREFIX}1v1_history_${s.sessionId}_${s.puzzleIds[i]}_${i}`;
          const data = localStorage.getItem(key);
          newPlayers[i] = { ...s.players[i], solveHistory: data ? JSON.parse(data) : [] };
        }
        const history = loadStoredBattleRounds(s.sessionId);
        set({
          players: newPlayers,
          battleRounds: history.rounds,
          battleHistoryWarning: history.warning,
        });
      }
    } catch (e) {
      console.warn('Failed to load solve history:', e);
    }
  },

  // ===== WCA Inspection =====
  // 1:1 翻译自 battle.js startInspection()（行 1912~1968）
  startInspection: (playerId: number) => {
    const s = get();
    const p = s.players[playerId];
    const limit = s.inspectionTime;

    let voiced8 = false;
    let voiced12 = false;

    const timer = setInterval(() => {
      const curr = get();
      const cp = curr.players[playerId];
      if (!cp.isInspecting) {
        clearInterval(timer);
        return;
      }
      const elapsed = (performance.now() - cp.inspectionStart) / 1000;

      // NOTE: 语音提示（8s 和 12s 时）
      if (curr.voice && elapsed >= 8 && !voiced8) {
        voiced8 = true;
        speakAlert('8 seconds', curr.locale);
      }
      if (curr.voice && elapsed >= 12 && !voiced12) {
        voiced12 = true;
        speakAlert('12 seconds', curr.locale);
      }

      if (limit < 9999) {
        if (elapsed >= limit + 2) {
          // >limit+2s → 自动 DNF
          clearInterval(timer);
          const newPlayers = [...curr.players];
          newPlayers[playerId] = {
            ...cp,
            inspectionPenalty: 'dnf',
            isInspecting: false,
            inspectionTimer: null,
            isReady: false,
            canStart: false,
            isTiming: false,
            hasFinished: true,
            time: 0,
            penalty: PENALTY.DNF,
          };
          set({ players: newPlayers });
          get().checkBothFinished();
        } else if (elapsed >= limit) {
          // NOTE: +2 罚时标记（UI 组件读取 inspectionPenalty 来显示）
          const newPlayers = [...curr.players];
          newPlayers[playerId] = { ...cp, inspectionPenalty: '+2' };
          set({ players: newPlayers });
        }
        // NOTE: elapsed < limit 时的倒计时显示由 UI 组件处理
      }
    }, 100);

    const newPlayers = [...s.players];
    newPlayers[playerId] = {
      ...p,
      isInspecting: true,
      inspectionStart: performance.now(),
      inspectionPenalty: null,
      inspectionTimer: timer,
    };
    set({ players: newPlayers });
  },

  // 1:1 翻译自 battle.js clearInspection()（行 1995~2003）
  clearInspection: (playerId: number) => {
    const s = get();
    const p = s.players[playerId];
    if (p.inspectionTimer) {
      clearInterval(p.inspectionTimer);
    }
    const newPlayers = [...s.players];
    newPlayers[playerId] = {
      ...p,
      isInspecting: false,
      inspectionTimer: null,
    };
    set({ players: newPlayers });
  },

  // NOTE: 里程碑检测 — 通过自定义事件通知 UI 组件
  // 1:1 翻译自 battle.js checkMilestone()（行 2719~2788）
  checkMilestone: () => {
    const s = get();
    const h = s.players[0].solveHistory;
    if (h.length === 0) return;

    const isZh = get().locale === 'zh';
    const lastEntry = h[h.length - 1];
    const effTime = getEffectiveTimeFromEntry(lastEntry);
    const messages: string[] = [];

    // NOTE: PB single 检测
    if (effTime !== Infinity) {
      let isPB = true;
      for (let i = 0; i < h.length - 1; i++) {
        if (getEffectiveTimeFromEntry(h[i]) <= effTime) { isPB = false; break; }
      }
      if (isPB) messages.push(isZh ? '🏆 新 PB!' : '🏆 New PB!');
    }

    // NOTE: PB ao5 检测
    if (h.length >= 5) {
      const ao5 = computeAo5(h);
      if (ao5 !== null && ao5 !== Infinity) {
        if (h.length === 5) {
          messages.push(isZh ? '🥇 新 PB Ao5!' : '🥇 New PB Ao5!');
        } else {
          let prevBest: number | null = null;
          for (let i = 5; i <= h.length - 1; i++) {
            const val = computeAo5(h.slice(0, i));
            if (val !== null && val !== Infinity) {
              if (prevBest === null || val < prevBest) prevBest = val;
            }
          }
          if (prevBest === null || ao5 < prevBest) {
            messages.push(isZh ? '🥇 新 PB Ao5!' : '🥇 New PB Ao5!');
          }
        }
      }
    }

    // NOTE: PB ao12 检测
    if (h.length >= 12) {
      const ao12 = computeAverage(h, 12);
      if (ao12 !== null && ao12 !== Infinity) {
        if (h.length === 12) {
          messages.push(isZh ? '🥇 新 PB Ao12!' : '🥇 New PB Ao12!');
        } else {
          let prevBest: number | null = null;
          for (let i = 12; i <= h.length - 1; i++) {
            const val = computeAverage(h.slice(0, i), 12);
            if (val !== null && val !== Infinity) {
              if (prevBest === null || val < prevBest) prevBest = val;
            }
          }
          if (prevBest === null || ao12 < prevBest) {
            messages.push(isZh ? '🥇 新 PB Ao12!' : '🥇 New PB Ao12!');
          }
        }
      }
    }

    // NOTE: 整数里程碑
    const count = h.length;
    if ([100, 200, 500, 1000, 2000, 5000, 10000].includes(count)) {
      messages.push(isZh ? `🎯 ${count} 次完成!` : `🎯 ${count} solves!`);
    }

    if (messages.length > 0) {
      // NOTE: 通过自定义事件通知 UI 组件（避免 store 直接操作 DOM）
      window.dispatchEvent(new CustomEvent('battle-milestone', { detail: messages.join(' ') }));
      // 触觉反馈
      if (navigator.vibrate) navigator.vibrate([50, 50, 100]);
    }
  },

  // NOTE: 疲劳预警 — 1:1 翻译自 battle.js checkFatigue()（行 2812~2834）
  checkFatigue: () => {
    const s = get();
    const h = s.players[0].solveHistory;
    if (h.length < 15) return;

    const times = h.slice(-10).map(getEffectiveTimeFromEntry).filter(t => t !== Infinity);
    if (times.length < 8) return;

    let rising = 0;
    for (let i = 0; i <= times.length - 5; i++) {
      const avg = (times[i] + times[i + 1] + times[i + 2] + times[i + 3] + times[i + 4]) / 5;
      if (i > 0) {
        const prevAvg = (times[i - 1] + times[i] + times[i + 1] + times[i + 2] + times[i + 3]) / 5;
        if (avg > prevAvg) rising++;
      }
    }

    if (rising >= 4) {
      const locale = s.locale;
      const msg = locale === 'zh' ? '建议休息一下 🍵' : 'Take a break? 🍵';
      window.dispatchEvent(new CustomEvent('battle-milestone', { detail: msg }));
    }
  },
}));

/** Warm the WCA pool ahead of demand for all active players' current puzzles
 *  (no-op unless the shared scramble source is set to WCA). */
export function prefetchBattleScrambles(): void {
  if (getSettings().scrambleSource !== 'wca') return;
  const st = useBattleStore.getState();
  const seen = new Set<string>();
  for (const pid of st.puzzleIds.slice(0, st.playerCount)) {
    if (seen.has(pid)) continue;
    seen.add(pid);
    const spec = wcaSpecFor(pid);
    if (hasWcaSource(spec)) prefetchWca(spec);
  }
}

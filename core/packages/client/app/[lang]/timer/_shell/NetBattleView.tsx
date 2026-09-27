'use client';

import type { CubeMoveMetadata } from '../_lib/bluetooth';

/**
 * NetBattleView — /timer 的「联机对战」模式(?players=net)。
 *
 * 多设备对战:每人用自己的设备,一人创建房间(拿到 4 位数字房间码 / 邀请链接),其余人
 * 加入;全房共用同一条打乱,各自在本机计时,成绩与实时状态互相可见,任一玩家可开
 * 下一轮(CAS)。参照 /alg 训练器协同房间的成熟模式:HTTP 轮询(1s,no-store)+
 * PG 单行 jsonb 原子合并(见 lib/battle-room-api.ts / server routes/battle_rooms.ts);
 * 智能魔方实况单独走不落库的 WebSocket relay,不改变房间状态的权威来源。
 *
 * 本机计时完整复用 Solo 的 useTimer 状态机 + TimingSurface 呈现(观察/hold/精度/
 * 字体等沿用用户的 timer 设置);对手「计时中」的滚动读数是本地推算:status 上报
 * 起表时刻(服务器时钟),客户端用轮询响应的 now 估时钟偏移后本地滚动,停表后以
 * 上报的最终成绩为准。
 *
 * 身份:无需登录,随机 playerId;sessionStorage 使用 shared 的 NetBattleSession
 * schema 保存私有 capability，刷新页面原地恢复身份(不重复加入);昵称记 localStorage。
 *
 * 房主:建房者是首任房主,可转让、可踢人、可改房设(授权在服务端,按钮只是装饰)。
 * 房设「同时开始计时」开启后,本轮在线未交卷的人(≥2)全部点过准备,服务端落一个
 * start_at,各端按时钟偏移换算到本机同一时刻,倒计时归零 → timer.startNow() 同时起表
 * (倒计时即观察,不再走 inspection)。
 *
 * 智能魔方(蓝牙):与 Solo 共用 useBluetoothCube + BluetoothModal。房内做两件事 ——
 * ①魔方回到还原态即停表(与 Solo 完全一致);②赛前自动预备。自动预备在「同时起表」
 * 的门控期 / 倒计时期被完整禁用(理由见 autoReadyEnabled 处的长注释):那种房里按下
 * 的语义是「向全房上报准备」,不是「起自己的表」,不能交给魔方代劳。
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQueryState } from 'nuqs';


import { SegmentTime, TimerTopbar, TimerDeviceCenter, TimerRoomRoundStatus, TimerRoomLobby, TimerRoomIdentity, TimerRoomDialog, TimerRoomAdmin, TimerRoomHistory, TimerRoomToolbar, TimerRoomLayout, TimerRoomPlayers, timerRoomPlayerName, TimerScrambleStrip, TimingSurface } from '@cuberoot/timer-ui';
import { SmartCubeAttemptProducer, timerSupportsNetBattleSmartCube } from '@cuberoot/shared/timer';
import { LiveSmartCubeAnchor, type LiveSmartCubeAnchorSnapshot } from '@cuberoot/shared/smart-cube/anchor';
import VideoStrip, { VideoToggle, useVideoRoom } from '../_battle/VideoStrip';
import BluetoothModal from '../_components/BluetoothModal';
import LiveCubeState from '../_components/LiveCubeState';
import { useBluetoothCube } from '../_lib/bluetooth';
import { mirrorForBrand, sensorBasisForBrand, type Quat } from '../_lib/bluetooth/orientation';
import type { TimerPresenceReport } from '../_lib/presence';
import { useAutoReady } from '../_lib/bluetooth/auto_ready';
import { installFakeCube } from '../_lib/bluetooth/fake_cube';
import { useNetBattleLiveCube, type NetBattleLiveCubePlayer } from '../_lib/net-battle-live';
import { useTimer, type SolveResult } from '../_shared/useTimer';
import { formatInspectionDisplay, inspectionPenalty } from '../_shared/inspection';
import { appendSolves, makeSolve, updateSolves } from '../_lib/storage/db';
import { hintScramble, type ScrambleHint } from '../_lib/bluetooth/scramble_hint';
import { applyScramble, facesEqual, type CubeFaces } from '../_lib/cube/state';
import { useSettings } from '../_lib/settings';
import { formatMs } from '../_lib/stats';
import type { EventId, Solve } from '../_lib/types';
import { CubePreview } from '../_lib/cube';
import CubeRootLogo from '@/components/CubeRootLogo';
import { EventSelect } from '@/components/EventSelect';
import { RoomQrModal } from '@/components/RoomQrModal';
import { EventIcon } from '@/components/EventIcon';
import { getPerson, type WcaPersonLite } from '@/lib/wca-api';
import { shouldIgnoreTimerTarget } from '@/lib/timer-ignore-target';
import { useAuthStore } from '@/lib/auth-store';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { eventDisplayName } from '@/lib/wca-events';
import { persistItem } from '@/lib/safe-storage';
import { formatScrambleForEvent } from '@cuberoot/shared/sq1-notation';
import { tr } from '@/i18n/tr';
import { useTranslation } from 'react-i18next';

import {
  createNetRoom, joinNetRoom, getNetRoom, postNetStatus, postNetResult,
  nextNetRound, leaveNetRoom, postNetEvent, ensureNetScramble,
  postNetSyncStart, postNetAdmin, postNetKick, renameNetPlayer,
  type NetRoomState, type NetPenalty, type NetResult, type NetIdentity,
  type NetBattleCredentials, type NetBattleEventId,
} from '@/lib/battle-room-api';
import {
  effectiveNetMs, sortedNetPlayers, isNetOnline, blendClockOffset,
  isRoundComplete, pendingCount, NET_EVENTS, netEventToSelectorId, selectorIdToNetEvent,
  playerEventOf, myScramble, netErrorMessage,
  isNetAdmin, syncGate, normalizeNetBattleRoomCode,
  isNetRoundParticipant,
  decodeNetBattleSession, isNetBattleRoomCode, preferLatestNetRoomState, type NetBattleSession,
  acceptNetRoomResponse,
  createNetAdmissionGate,
} from '@/lib/battle-room-logic';

// BluetoothModal 与打乱条(.scramble-strip / .timer-modal*)的样式都在 timer.css。
import '../timer.css';
import './shell.css';
import './net.css';

const LS_NAME = 'net_battle_name';
const SS_KEY = 'net_battle_session';
/** 访客不填昵称时的回落名(与服务端 sanitizeName 的默认值一致)。 */
const GUEST_NAME = 'Cuber';
type SavedSession = NetBattleSession;

/** 服务端给重名加的「 (2)」尾巴。 */
const DEDUP_SUFFIX_RE = / \(\d+\)$/;
/** 剥掉去重后缀,拿到基名。判「名字是不是已经对了」用它。 */
const baseName = (n: string) => n.replace(DEDUP_SUFFIX_RE, '');

/**
 * 房里挂出去的名字是 WCA 名册原名(`Ruimin Yan (颜瑞民)`),渲染按站内规范去括号 ——
 * 中文界面只留中文名,和 /wca 各页(displayCuberName)一个样。
 * 自由昵称原样输出:那不是 WCA 名,里头的括号是用户自己写的。
 * 去重后缀留在末尾,否则两个同名的人在名单上又长得一模一样。
 */
function netPlayerName(p: { name: string; wcaId?: string }, isZh: boolean): string {
  return timerRoomPlayerName(p, isZh ? 'zh' : 'en');
}

interface RemoteTimerDigitsProps {
  player: NetRoomState['players'][string] | null;
  result?: NetResult;
  online: boolean;
  clockOffsetMs: number | null;
  precision: Parameters<typeof formatMs>[1];
}

function remoteTimerText(
  player: NetRoomState['players'][string] | null,
  result: NetResult | undefined,
  online: boolean,
  clockOffsetMs: number | null,
  precision: Parameters<typeof formatMs>[1],
): string {
  if (result) {
    if (result.p === 'dnf') return 'DNF';
    return `${formatMs(effectiveNetMs(result), precision)}${result.p === '+2' ? '+' : ''}`;
  }
  if (!player || !online || player.ph !== 'solving') return formatMs(0, precision);
  return formatMs(Math.max(0, Date.now() + (clockOffsetMs ?? 0) - player.at), 2);
}

/** Keep the opponent's fast clock updates isolated from the room shell. */
function RemoteTimerDigits({
  player,
  result,
  online,
  clockOffsetMs,
  precision,
}: RemoteTimerDigitsProps) {
  const [text, setText] = useState(() => remoteTimerText(player, result, online, clockOffsetMs, precision));
  useEffect(() => {
    let raf = 0;
    let previous = '';
    const tick = () => {
      const next = remoteTimerText(player, result, online, clockOffsetMs, precision);
      if (next !== previous) {
        previous = next;
        setText(next);
      }
      if (!result && player?.ph === 'solving' && online) raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [clockOffsetMs, online, player, precision, result]);
  return <SegmentTime text={text} />;
}

interface NetPkLock {
  code: string;
  round: number;
  opponentId: string;
  opponentName: string;
}
function readSession(): SavedSession | null {
  try {
    const raw = sessionStorage.getItem(SS_KEY);
    if (!raw) return null;
    return decodeNetBattleSession(JSON.parse(raw));
  } catch { return null; }
}

/** 联机房间项目选择器的可选项(WCA id 形式,顺序即 NET_EVENTS)。 */
const NET_SELECTOR_EVENTS = NET_EVENTS.map(netEventToSelectorId);

interface NetBattleViewProps {
  /** 人数下拉(TimerShell 构建),注入到顶栏 */
  playersControl?: ReactNode;
  presenceControl?: ReactNode;
  onPresenceChange?: (report: TimerPresenceReport) => void;
  /** 彻底退出联机模式(清 room + 人数回单人)。 */
  onExitNet?: () => void;
}

export default function NetBattleView({ playersControl, presenceControl, onPresenceChange, onExitNet }: NetBattleViewProps) {
  useDocumentTitle('联机对战', 'Online Battle');
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const settings = useSettings();
  const authUser = useAuthStore((st) => st.user);

  // ── 房间状态 ────────────────────────────────────────────────
  const [roomParam, setRoomParam] = useQueryState('room');
  const [room, setRoom] = useState<NetRoomState | null>(null);
  const [pid, setPid] = useState<string | null>(null);
  const [playerToken, setPlayerToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showStats, setShowStats] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  /** 邀请二维码弹窗(队友扫码直接落加入页)。建房时自动弹一次,所以要声明在 doCreate 之前。 */
  const [qrOpen, setQrOpen] = useState(false);
  const roomRef = useRef(room); roomRef.current = room;
  const activeRoomCodeRef = useRef<string | null>(null);
  const acceptedStateRef = useRef<NetRoomState | null>(null);
  /** Keep each device on the completed round until that device asks to continue. */
  const holdAdvancedRoundRef = useRef(true);
  const pendingAdvancedStateRef = useRef<NetRoomState | null>(null);
  /** Synchronous latch + monotonic intent; React state alone cannot stop same-tick double submit. */
  const admissionGateRef = useRef<ReturnType<typeof createNetAdmissionGate> | null>(null);
  admissionGateRef.current ??= createNetAdmissionGate();
  const admissionGate = admissionGateRef.current;
  useEffect(() => () => { admissionGate.cancel(); }, [admissionGate]);
  const pidRef = useRef(pid); pidRef.current = pid;
  const credentialsRef = useRef<NetBattleCredentials | null>(null);
  credentialsRef.current = pid && playerToken ? { playerId: pid, playerToken } : null;
  /** 服务器时钟 - 本机时钟(EMA;对手滚动读数换算用)。 */
  const offsetRef = useRef<number | null>(null);

  // ── 大厅表单 ────────────────────────────────────────────────
  // 访客自由昵称(未选 WCA 选手时用)。同步读 localStorage 而不是挂 effect 补:扫码进来
  // 的自动加入在首个 effect pass 就要拿到昵称,effect 补的值那时还没写进 identity。
  // allow-hydration-volatile-state: NetBattleView 只在 TimerShell 的 mounted 门控后渲染(服务端永远是 SoloView),
  // 这里读 localStorage 不会造成 hydration 错配;window 判空只是防守。
  const [name, setName] = useState(() => {
    if (typeof window === 'undefined') return '';
    try { return localStorage.getItem(LS_NAME) || ''; } catch { return ''; }
  });
  const [picked, setPicked] = useState<WcaPersonLite | null>(null); // 访客选中的 WCA 选手
  const [joinCode, setJoinCode] = useState('');
  const [lobbyEvent, setLobbyEvent] = useState<NetBattleEventId>('333');
  // 登录用户名下 WCA ID 在名册上的那条记录。账号的 display_name 未必等于 WCA 姓名
  // (邮箱/手机注册、之后才绑 WCA 的账号,display_name 是自己起的),而房里该显示的是
  // WCA 名册上的名字 —— 对手照着它就能去 /person 查到人。取不到就退回账号名。
  const [wcaSelf, setWcaSelf] = useState<WcaPersonLite | null>(null);
  const selfWcaId = authUser?.wcaId || '';
  useEffect(() => {
    if (!selfWcaId) { setWcaSelf(null); return; }
    let dead = false;
    void getPerson(selfWcaId).then((p) => { if (!dead && p) setWcaSelf(p); }).catch(() => {});
    return () => { dead = true; };
  }, [selfWcaId]);

  // 身份:登录用户用 WCA 姓名+ID(不填昵称);访客选了 WCA 选手用其姓名+ID,否则用自由昵称。
  // 访客什么都不填也能开房/加入 —— 回落默认名(与服务端 sanitizeName 同一个 'Cuber',
  // 重名由服务端加 (2)(3) 后缀)。身份永不为 null:否则未登录用户会撞上「按钮灰着、
  // 房间码填满也毫无反应」的死路。
  const identity: NetIdentity = useMemo(() => {
    if (authUser) return {
      name: wcaSelf?.name || authUser.name,
      wcaId: authUser.wcaId || undefined,
      iso2: wcaSelf?.country_iso2 || authUser.country || undefined,
    };
    if (picked) return { name: picked.name, wcaId: picked.id, iso2: picked.country_iso2 || undefined };
    return { name: name.trim() || GUEST_NAME };
  }, [authUser, wcaSelf, picked, name]);
  const identityRef = useRef(identity); identityRef.current = identity;

  const applyState = useCallback((st: NetRoomState) => {
    const current = roomRef.current;
    if (current && st.round > current.round && holdAdvancedRoundRef.current) {
      pendingAdvancedStateRef.current = preferLatestNetRoomState(pendingAdvancedStateRef.current, st);
      // 保持上一轮的成绩/轮次，但更新时钟和在线心跳，避免等待期间把对手误判为离线。
      setRoom(prev => {
        if (!prev || prev.round >= st.round) return prev;
        const players = Object.fromEntries(Object.entries(prev.players).map(([id, player]) => {
          const latest = st.players[id];
          return [id, latest ? { ...player, seen: latest.seen } : player];
        })) as NetRoomState['players'];
        return { ...prev, now: st.now, players };
      });
      return;
    }
    const accepted = acceptNetRoomResponse(activeRoomCodeRef.current, acceptedStateRef.current, st);
    if (accepted !== st) return;
    acceptedStateRef.current = st;
    offsetRef.current = blendClockOffset(offsetRef.current, st.now, Date.now());
    holdAdvancedRoundRef.current = true;
    pendingAdvancedStateRef.current = null;
    setRoom(prev => preferLatestNetRoomState(prev, st));
  }, []);

  const adopt = useCallback((state: NetRoomState, credentials: NetBattleCredentials, nm: string) => {
    activeRoomCodeRef.current = state.code;
    holdAdvancedRoundRef.current = true;
    pendingAdvancedStateRef.current = null;
    setPid(credentials.playerId);
    setPlayerToken(credentials.playerToken);
    applyState(state);
    setErr(null);
    try { sessionStorage.setItem(SS_KEY, JSON.stringify({ code: state.code, ...credentials, name: nm } satisfies SavedSession)); } catch { /* ignore */ }
    if (nm) persistItem(LS_NAME, nm);
  }, [applyState]);

  // ── 计时器(复用 Solo 的状态机;设置沿用用户 timer 设置)──────
  const myResult = room && pid ? room.results[String(room.round)]?.[pid] : undefined;
  const myEvent = room && pid ? playerEventOf(room, pid) : (room?.event ?? '333');
  const onlinePlayerCount = room
    ? Math.max(1, Object.values(room.players).filter(player => isNetOnline(player, room.now)).length)
    : 1;
  /** A synchronized countdown freezes its roster. Players outside it observe this round but
      cannot accidentally start or submit a solve until the next round. */
  const inRoundRoster = !!room && isNetRoundParticipant(room, pid);
  const canSolve = !!room && !!pid && inRoundRoster && !myResult;
  const complete = room ? isRoundComplete(room) : false;
  /** 还没交本轮成绩的在线玩家数。 */
  const waiting = room ? pendingCount(room) : 0;
  /** 本轮已无人可等(全交卷,或房里只剩我)。isRoundComplete 在「在线不足 2 人」时
      恒 false(那是同时起表门控的口径),单独用它会让一个人开好房等朋友时既看到
      「还差 0 人」,又按不动空格开下一轮。 */
  const roundSettled = !!room && (complete || waiting === 0);
  const canSolveRef = useRef(canSolve); canSolveRef.current = canSolve;

  // ── 房主 / 同时开始 ─────────────────────────────────────────
  const iAmAdmin = !!room && isNetAdmin(room, pid);
  const gate = room
    ? syncGate(room, pid)
    : { gated: false, ready: false, waiting: 0 };
  const startAt = room?.startAt ?? null;
  /** 倒计时剩余毫秒(仅倒计时期间非 null,驱动读数显示 3/2/1)。 */
  const [countdownMs, setCountdownMs] = useState<number | null>(null);
  const gateRef = useRef(gate.gated); gateRef.current = gate.gated;
  const startAtRef = useRef(startAt); startAtRef.current = startAt;

  const solvingRoundRef = useRef(0);
  const advBusyRef = useRef(false);

  const advance = useCallback((force = false) => {
    const r = roomRef.current, auth = credentialsRef.current;
    if (!r || !auth || advBusyRef.current) return;
    holdAdvancedRoundRef.current = false;
    advBusyRef.current = true;
    // 服务端为开轮者项目生成新打乱；客户端不能自报有利打乱。
    void nextNetRound(r.code, auth, r.round, force)
      .then(applyState)
      .catch((e: Error) => setErr(tr(netErrorMessage(e))))
      .finally(() => {
        advBusyRef.current = false;
        holdAdvancedRoundRef.current = true;
      });
  }, [applyState]);

  // 双方交卷后不自动推进；每台设备在自己的下一次操作时独立进入下一轮。

  // 改自己的项目(仅本轮尚未交卷时可改)。服务端用共享生成器 set-if-absent 回填。
  const changeEvent = useCallback((selId: string) => {
    const r = roomRef.current, auth = credentialsRef.current;
    if (!r || !auth) return;
    const ev = selectorIdToNetEvent(selId);
    if (!ev || ev === playerEventOf(r, auth.playerId)) return;
    void postNetEvent(r.code, auth, ev)
      .then((st) => { applyState(st); timerReset(); })
      .catch((e: Error) => setErr(tr(netErrorMessage(e))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyState]);

  /**
   * 这一把的转动流(智能魔方才有)。房间只收一个成绩数字,所以在此之前,联机房里
   * 用智能魔方拧的每一把都是**扔掉的** —— 没有复盘、没有回放、不进统计。
   * 记下来之后走的是和 Solo 完全同一条:同样的 `makeSolve` + `finishSolveFields`
   * + `appendSolves`,于是复盘 / 回放 / 分段统计一行新代码都不用写就都有了。
   */
  const attemptProducerRef = useRef(new SmartCubeAttemptProducer());
  /** 起表那一刻的打乱与设备 —— 中途换轮 / 掉线都不该改写这一把记的是什么。 */
  const scrambleAtStartRef = useRef('');
  const eventAtStartRef = useRef<EventId>('333');

  /** 刚留档的那条本机记录 —— 之后改罚时要跟着改,别让两边对同一把给出两个判罚。 */
  const localSolveRef = useRef<{ event: EventId; solve: Solve } | null>(null);

  const onSolve = useCallback((res: SolveResult) => {
    const r = roomRef.current, auth = credentialsRef.current;
    // 本机留档先做:上传失败也不该连自己的复盘一起丢。
    localSolveRef.current = null;
    const fields = attemptProducerRef.current.finishSolveFields({
      event: eventAtStartRef.current,
      scramble: scrambleAtStartRef.current,
      timeMs: res.timeMs,
    });
    if (fields.moves && scrambleAtStartRef.current) {
      const ev = eventAtStartRef.current;
      const solve = makeSolve({
        timeMs: res.timeMs,
        scramble: scrambleAtStartRef.current,
        event: ev,
        penalty: res.autoPenalty,
      });
      Object.assign(solve, fields);
      if (res.inspectionMs > 0) solve.inspectionMs = Math.round(res.inspectionMs);

      appendSolves(ev, [solve]);
      localSolveRef.current = { event: ev, solve };
    }
    if (!r || !auth) return;
    const p: NetPenalty = res.autoPenalty === 'DNF' ? 'dnf' : res.autoPenalty === '+2' ? '+2' : 'ok';
    const round = solvingRoundRef.current || r.round;
    void postNetResult(r.code, auth, round, res.timeMs, p)
      .then((st) => applyState(st))
      .catch(() => {
        // 一次静默重试;仍失败给出提示(下一轮照常,丢的是本轮成绩)
        void postNetResult(r.code, auth, round, res.timeMs, p).then(applyState).catch(() =>
          setErr(tr({ zh: '成绩上传失败,请检查网络', en: 'Failed to upload result — check your connection' })));
      });
  }, [applyState]);

  // Every start path (keys, countdown and cube) freezes the context synchronously.
  // A room poll or the running-phase effect must never reset the first BLE move.
  const timer = useTimer(onSolve, (startedAtMs: number) => {
    const r = roomRef.current, id = pidRef.current;
    scrambleAtStartRef.current = (r && id ? myScramble(r, id) : null) ?? '';
    eventAtStartRef.current = (r && id
      ? netEventToSelectorId(playerEventOf(r, id))
      : '333') as EventId;
    solvingRoundRef.current = r?.round ?? 0;
    const bt = btStatusRef.current;
    attemptProducerRef.current.begin(startedAtMs, bt?.connected
      ? { model: bt.brand, name: bt.deviceName } : undefined);
    phaseRef.current = 'running';
  });
  const phaseRef = useRef(timer.phase); phaseRef.current = timer.phase;
  const cubeStartedRef = useRef(false);
  useEffect(() => {
    if (timer.phase !== 'running') cubeStartedRef.current = false;
    if (timer.phase === 'idle') attemptProducerRef.current.reset();
  }, [timer.phase]);

  // 实时状态上报(观察中/计时中)— 纯装饰,失败静默
  useEffect(() => {
    const r = roomRef.current, auth = credentialsRef.current;
    if (!r || !auth) return;
    if (timer.phase === 'inspecting') void postNetStatus(r.code, auth, 'inspecting').catch(() => {});
    else if (timer.phase === 'running') void postNetStatus(r.code, auth, 'solving').catch(() => {});
  }, [timer.phase]);

  // ── 同时开始:准备开关 + 倒计时归零同时起表 ────────────────────
  const { reset: timerReset, startNow: timerStartNow } = timer;

  /** 切换自己的「准备」状态;最后一个准备的人这一跳会带回 startAt(服务端落的倒计时起点)。 */
  const toggleReady = useCallback(() => {
    const r = roomRef.current, auth = credentialsRef.current;
    if (!r || !auth) return;
    const next = r.players[auth.playerId]?.ph === 'ready' ? 'idle' : 'ready';
    void postNetStatus(r.code, auth, next).then(applyState).catch(() => {});
  }, [applyState]);

  // 倒计时:startAt(服务器时钟)换算到本机(减去时钟偏移),归零即 startNow 同时起表。
  // 每个 startAt 只消费一次;断线/后台后迟到的 roster 成员从服务器起点恢复。
  const autoStartedRef = useRef<number | null>(null);
  useEffect(() => {
    if (startAt === null || !inRoundRoster) { setCountdownMs(null); return; }
    if (autoStartedRef.current === startAt) return;
    let iv = 0;
    const tick = () => {
      const left = startAt - (Date.now() + (offsetRef.current ?? 0));
      if (left > 0) { setCountdownMs(left); return; }
      window.clearInterval(iv);
      setCountdownMs(null);
      if (autoStartedRef.current === startAt) return;
      autoStartedRef.current = startAt;
      const late = -left;
      const r = roomRef.current, id = pidRef.current;
      if (!r || !id || r.results[String(r.round)]?.[id]) return; // 已交卷的人不跟着起表
      timerStartNow(late);
    };
    tick();
    iv = window.setInterval(tick, 50);
    return () => window.clearInterval(iv);
  }, [inRoundRoster, startAt, timerStartNow]);

  // 新一轮到达(自己开的或轮询收到):计时器空闲/停止时归零;计时中不打断
  const prevRoundRef = useRef<number | null>(null);
  useEffect(() => {
    if (!room) { prevRoundRef.current = null; return; }
    if (prevRoundRef.current !== null && room.round > prevRoundRef.current) {
      const ph = phaseRef.current;
      if (ph === 'idle' || ph === 'stopped') timerReset();
    }
    prevRoundRef.current = room.round;
  }, [room, timerReset]);

  // ── 轮询(1s;标签页隐藏时暂停,回来立即刷)────────────────────
  const handleRoomGone = useCallback((msg: string) => {
    admissionGate.cancel();
    setBusy(false);
    activeRoomCodeRef.current = null;
    acceptedStateRef.current = null;
    setRoom(null); setPid(null); setPlayerToken(null); setErr(msg);
    try { sessionStorage.removeItem(SS_KEY); } catch { /* ignore */ }
    void setRoomParam(null);
  }, [admissionGate, setRoomParam]);

  const code = room?.code ?? null;
  useEffect(() => {
    if (!code || !pid || !playerToken) return;
    const auth = { playerId: pid, playerToken } satisfies NetBattleCredentials;
    let stopped = false;
    let running = false;
    const tick = async () => {
      if (running) return;
      running = true;
      try {
        const st = await getNetRoom(code, auth);
        if (stopped) return;
        // 自己已不在玩家表里 = 被房主踢了(房间还在,只是没我了)
        if (!st.players[pid]) {
          handleRoomGone(tr({ zh: '你已被房主移出房间', en: 'The host removed you from the room' }));
          return;
        }
        applyState(st);
      } catch (e) {
        if (!stopped && (e as Error).message === 'room not found') {
          handleRoomGone(tr({ zh: '房间已解散或过期', en: 'Room was closed or expired' }));
        } else if (!stopped && (e as Error).message === 'invalid player capability') {
          handleRoomGone(tr(netErrorMessage(e)));
        }
      } finally { running = false; }
    };
    const iv = window.setInterval(() => { if (!document.hidden) void tick(); }, 1000);
    const onVis = () => { if (!document.hidden) void tick(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { stopped = true; window.clearInterval(iv); document.removeEventListener('visibilitychange', onVis); };
  }, [code, pid, playerToken, applyState, handleRoomGone]);

  // 计时中的玩家滚动读数:rAF 直接写 span.textContent(0.01s 精度,60fps 平滑),
  // 不走 React 重渲(同 Solo 计时器的做法)—— 否则整个 NetBattleView 每帧重渲太重。
  // 读数 = 本地估算:(本机时钟 + 时钟偏移)- 该玩家上报的起表时刻。停表/离开自动停。
  useEffect(() => {
    if (!room) return;
    const anySolving = Object.values(room.players)
      .some((p) => p.ph === 'solving' && isNetOnline(p, room.now));
    if (!anySolving) return;
    let raf = 0;
    const tick = () => {
      const r = roomRef.current;
      if (r) {
        const est = Date.now() + (offsetRef.current ?? 0);
        for (const [id2, p] of Object.entries(r.players)) {
          if (p.ph !== 'solving') continue;
          const el = document.getElementById(`net-live-${id2}`);
          if (el) el.textContent = formatMs(Math.max(0, est - p.at), 2);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [room]);

  // 我的项目当前轮打乱缺失 → 请求服务端共享生成器 set-if-absent 回填。
  const ensuredKeyRef = useRef<string>('');
  useEffect(() => {
    const auth = credentialsRef.current;
    if (!room || !auth) return;
    const ev = playerEventOf(room, auth.playerId);
    if (room.scrambles?.[ev]) return;
    const key = `${room.round}:${ev}`;
    if (ensuredKeyRef.current === key) return;
    ensuredKeyRef.current = key;
    void ensureNetScramble(room.code, auth, ev)
      .then(applyState)
      .catch(() => { ensuredKeyRef.current = ''; });
  }, [room, pid, playerToken, applyState]);

  // ── 建房 / 加入 / 恢复 / 离开 ───────────────────────────────
  const doCreate = useCallback(() => {
    const id = identityRef.current;
    const intent = admissionGate.beginExclusive();
    if (intent === null) return;
    setBusy(true); setErr(null);
    const ev = lobbyEvent;
    void createNetRoom(ev, id)
      // 建完就把二维码摆出来:开房的下一步必然是喊人进来,不该还要自己去找那个按钮。
      // (加入房间不弹 —— 那边人已经在房里了。)
      .then(({ state, credentials }) => {
        if (!admissionGate.isCurrent(intent)) {
          void leaveNetRoom(state.code, credentials).catch(() => {});
          return;
        }
        adopt(state, credentials, id.name); void setRoomParam(state.code); setQrOpen(true);
      })
      .catch((e: Error) => { if (admissionGate.isCurrent(intent)) setErr(tr(netErrorMessage(e))); })
      .finally(() => { if (admissionGate.finish(intent)) setBusy(false); });
  }, [admissionGate, lobbyEvent, adopt, setRoomParam]);

  const doJoin = useCallback((rawCode: string) => {
    const codeUp = normalizeNetBattleRoomCode(rawCode);
    const id = identityRef.current;
    if (!isNetBattleRoomCode(codeUp)) {
      admissionGate.cancel();
      setErr(tr({ zh: '房间码必须是 4 位数字', en: 'Room code must be exactly four digits' }));
      void setRoomParam(null);
      return;
    }
    const intent = admissionGate.beginExclusive();
    if (intent === null) return;
    setBusy(true); setErr(null);
    void Promise.resolve().then(() => joinNetRoom(codeUp, id))
      .then(({ state, credentials }) => {
        if (!admissionGate.isCurrent(intent)) {
          void leaveNetRoom(state.code, credentials).catch(() => {});
          return;
        }
        adopt(state, credentials, id.name); setJoinCode(''); void setRoomParam(state.code);
      })
      .catch((e: Error) => { if (admissionGate.isCurrent(intent)) setErr(tr(netErrorMessage(e))); })
      .finally(() => { if (admissionGate.finish(intent)) setBusy(false); });
  }, [admissionGate, adopt, setRoomParam]);

  // 邀请链接 / 扫码 ?room=CODE:直接进房,不停确认页 —— 扫码的人要的就是「进这个房」,
  // 中间再插一屏点「加入」纯属挡路。身份取现成的(登录用户 = WCA 姓名,访客 =
  // localStorage 记的昵称,都没有就回落 Cuber,重名由服务端加 (2)(3))。
  // 先试 sessionStorage 同码恢复:刷新页面原地回到同一个 pid,不在玩家条里多一个自己。
  const autoJoinRef = useRef(false);
  useEffect(() => {
    if (!roomParam || room || busy || autoJoinRef.current) return;
    const intent = admissionGate.beginBackground();
    if (intent === null) return;
    autoJoinRef.current = true;
    let dead = false;
    const codeUp = normalizeNetBattleRoomCode(roomParam);
    void (async () => {
      try {
        const saved = readSession();
        if (saved && saved.code === codeUp) {
          const savedAuth = { playerId: saved.playerId, playerToken: saved.playerToken } satisfies NetBattleCredentials;
          const st = await getNetRoom(codeUp, savedAuth);
          if (!dead && admissionGate.isCurrent(intent) && st.players[saved.playerId]) {
            adopt(st, savedAuth, saved.name); return;
          }
        }
      } catch { /* 读不到就当新人,照常加入 */ }
      if (!dead && admissionGate.isCurrent(intent)) doJoin(codeUp);
    })();
    return () => {
      dead = true;
      if (admissionGate.isCurrent(intent)) admissionGate.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomParam, room, busy, admissionGate, adopt, doJoin]);

  // ── 房主操作(授权在服务端;这里只管发请求 + 同步状态)────────────
  const setSyncStart = useCallback((v: boolean) => {
    const r = roomRef.current, auth = credentialsRef.current;
    if (!r || !auth) return;
    void postNetSyncStart(r.code, auth, v).then(applyState).catch((e: Error) => setErr(tr(netErrorMessage(e))));
  }, [applyState]);

  const transferAdmin = useCallback((target: string) => {
    const r = roomRef.current, auth = credentialsRef.current;
    if (!r || !auth) return;
    void postNetAdmin(r.code, auth, target)
      .then((st) => { applyState(st); setShowAdmin(false); })
      .catch((e: Error) => setErr(tr(netErrorMessage(e))));
  }, [applyState]);

  const kickPlayer = useCallback((target: string) => {
    const r = roomRef.current, auth = credentialsRef.current;
    if (!r || !auth) return;
    void postNetKick(r.code, auth, target).then(applyState).catch((e: Error) => setErr(tr(netErrorMessage(e))));
  }, [applyState]);

  // ── 房内改名 ────────────────────────────────────────────────
  const doRename = useCallback((next: NetIdentity) => {
    const r = roomRef.current, auth = credentialsRef.current;
    if (!r || !auth) return;
    void renameNetPlayer(r.code, auth, next)
      .then(applyState)
      .catch((e: Error) => setErr(tr(netErrorMessage(e))));
    // 记的是「我要的名字」而不是服务端去重后的结果:存下 'Cuber (2)' 的话,
    // 下次进别的房就成了 'Cuber (2) (2)'。
    if (!authUser && next.name) persistItem(LS_NAME, next.name);
  }, [applyState, authUser]);

  // 登录用户的房内名字跟着账号走(所以不给他们改名入口)。建房/加入时已经用的是账号名,
  // 但 WCA 官方姓名是异步查回来的,晚到就在这儿补一次。
  // 比的是**基名**:房里已有同名时服务端会加 (2) 后缀,拿带后缀的名字去比会次次判「不等」,
  // 变成每秒一次的改名风暴(轮询每秒换一个 room 对象)。
  const nameSyncRef = useRef('');
  useEffect(() => {
    if (!authUser || !room || !pid) return;
    const want = identity.name;
    const cur = room.players[pid]?.name;
    if (!want || !cur || baseName(cur) === want) return;
    const key = `${room.code}:${want}`;
    if (nameSyncRef.current === key) return;
    nameSyncRef.current = key;
    doRename(identity);
  }, [authUser, room, pid, identity, doRename]);

  const doLeave = useCallback(() => {
    const r = roomRef.current, auth = credentialsRef.current;
    activeRoomCodeRef.current = null;
    admissionGate.cancel();
    setBusy(false);
    acceptedStateRef.current = null;
    holdAdvancedRoundRef.current = true;
    pendingAdvancedStateRef.current = null;
    setRoom(null); setPid(null); setPlayerToken(null); setErr(null);
    autoJoinRef.current = false;
    prevRoundRef.current = null;
    try { sessionStorage.removeItem(SS_KEY); } catch { /* ignore */ }
    void setRoomParam(null);
    timerReset();
    if (r && auth) void leaveNetRoom(r.code, auth).catch(() => {});
  }, [admissionGate, setRoomParam, timerReset]);

  // ── 智能魔方(蓝牙)──────────────────────────────────────────
  // 与 Solo 同一个 hook + 同一个弹窗(不 fork BluetoothModal)。房内只接两件事:
  // 还原即停表、赛前自动预备。手动 MAC 输入沿用 Solo 那套「延迟 promise」:
  // hook 需要 MAC 时挂起,弹窗把用户输入的值 resolve 回去。
  const [bluetoothOpen, setBluetoothOpen] = useState(false);
  const [bluetoothConnectAttempt, setBluetoothConnectAttempt] = useState<Promise<void> | null>(null);
  const [macPrompt, setMacPrompt] = useState<{ deviceName: string; isWrongKey?: boolean } | null>(null);
  const macResolverRef = useRef<((m: string | null) => void) | null>(null);
  const requestMac = useCallback((deviceName: string, isWrongKey?: boolean) => new Promise<string | null>((resolve) => {
    macResolverRef.current = resolve;
    setMacPrompt({ deviceName, isWrongKey });
  }), []);
  const resolveMac = useCallback((mac: string | null) => {
    macResolverRef.current?.(mac);
    macResolverRef.current = null;
    setMacPrompt(null);
  }, []);

  // 连接提示复用房间自己的 err 行 —— 本文件唯一的通知位,不引 Solo 的 toast。
  // 掉线 / 重连中 / 重连失败写进去;重连成功只撤「我们写的那条」,不误清别人的报错。
  const btNoticeRef = useRef<string | null>(null);
  const setBtNotice = useCallback((msg: string | null) => {
    const prev = btNoticeRef.current;
    btNoticeRef.current = msg;
    if (msg !== null) { setErr(msg); return; }
    setErr((cur) => (cur !== null && cur === prev ? null : cur));
  }, []);

  // hook 只给一个 onMove;订阅者(自动预备、实况魔方和录制)统一从这里分发,与 Solo 的
  // bluetoothSubscribersRef 同构,避免为每条消费路径各自读一套蓝牙状态。
  const btSubscribersRef = useRef<Set<(m: string, ts: number, metadata?: CubeMoveMetadata) => void>>(new Set());
  // Orientation samples are consumed by the live cube frame loop, not by the
  // room timer. Keep them in a ref so BLE cadence never re-renders this shell.
  const gyroQuatRef = useRef<Quat | null>(null);
  const [calibrateNonce, setCalibrateNonce] = useState(0);

  /**
   * 预备之后第一下转动即起表(与 Solo 同一条规则,时间取魔方自己的时钟)。
   * 这里额外挡三种房间态:门控期 / 倒计时期 / 已交卷 —— 那三种情况下起表权不在
   * 自己手上(见下面 autoReadyEnabled 那段注释),魔方不该替全房发车。
   */
  const startFromCubeRef = useRef<(ts: number) => void>(() => {});
  startFromCubeRef.current = (ts: number) => {
    if (gateRef.current || startAtRef.current !== null || !canSolveRef.current) return;
    if (!timer.startFromCube(ts)) return;
    // useTimer has already begun the producer synchronously in onStart.
    cubeStartedRef.current = true;
    phaseRef.current = 'running';
  };

  const bluetoothCube = useBluetoothCube({
    onGyro: settings.gyroEnabled ? (q) => { gyroQuatRef.current = q; } : undefined,
    onMove: (move, ts, _facelets, metadata) => {
      // 双方都交卷后，自己的下一次转动才切到下一轮；另一台设备继续保留结算画面。
      if (myResult && roundSettled && !advBusyRef.current) advance(false);
      // 先起表,后广播:如果这一手就是起表那一手,下面的录制订阅必须已经看到
      // 「在计时」。它读的是 `phaseRef`,而上面那行是同步写的 —— 等 React 重渲染
      // 就会丢掉这一步,而 BLE 可能在同一个调用栈里连给两手。
      startFromCubeRef.current(ts);
      for (const sub of btSubscribersRef.current) {
        try { sub(move, ts, metadata); } catch (e) { console.error('[bt-broadcast]', e); }
      }
    },
    // 魔方回到还原态 = 停表,与 Solo 同一条规则。只在真的在计时时停,所以别人回合里
    // 随手把魔方拧回还原不会替你交卷。结算使用最后一手的校准时刻,同时起表
    // (startNow 起的表)和普通起表仍落在同一条 useTimer 路径上。
    onSolved: (atMs) => {
      if (phaseRef.current === 'running' && timer.stopFromCube(atMs)) {
        phaseRef.current = 'stopped';
      }
    },
    onNeedMac: requestMac,
    onConnectionEvent: (ev) => {
      if (ev.kind === 'disconnected' && ev.reason === 'manual') return; // 用户自己点的断开
      if (ev.kind === 'reconnected') { setBtNotice(null); return; }
      setBtNotice(
        ev.kind === 'disconnected'
          ? tr({ zh: '智能魔方连接断开', en: 'Smart cube disconnected' })
          : ev.kind === 'reconnecting'
            ? tr({
                zh: `正在重连智能魔方(第 ${ev.attempt}/${ev.maxAttempts} 次)`,
                en: `Reconnecting to smart cube (${ev.attempt}/${ev.maxAttempts})`,
              })
            : tr({ zh: '智能魔方重连失败,请重新配对', en: 'Smart cube reconnect failed — pair again' }),
      );
    },
  });
  const connectSmartCubeCenter = useCallback(() => {
    setBluetoothOpen(true);
    if (bluetoothCube.status.connected) return;
    const attempt = bluetoothCube.connect();
    setBluetoothConnectAttempt(attempt);
    void attempt.catch(() => undefined);
  }, [bluetoothCube]);
  const cubeConnected = bluetoothCube.status.connected;
  useEffect(() => {
    onPresenceChange?.({
      ...(cubeConnected ? { normal: 0, smart: 1 } : { normal: 1, smart: 0 }),
      mode: 'net',
      players: onlinePlayerCount,
      events: [myEvent],
      results: myResult ? [{ event: myEvent, timeMs: myResult.t, penalty: myResult.p }] : [],
      devices: cubeConnected ? [{
        name: bluetoothCube.status.deviceName,
        ...(bluetoothCube.status.deviceId ? { id: bluetoothCube.status.deviceId } : {}),
      }] : [],
    });
  }, [
    cubeConnected,
    bluetoothCube.status.deviceId,
    bluetoothCube.status.deviceName,
    myEvent,
    myResult?.p,
    myResult?.t,
    onlinePlayerCount,
    onPresenceChange,
  ]);

  /**
   * 自动预备:拧完打乱把魔方放稳 2 秒(或 U U' U U')= 替你按一下「预备」。
   * 注意它并不起表 —— useTimer 收到的是 onPressDown,进的是观察 / hold,真正起表仍
   * 要松手,与 Solo 同义。
   *
   * 「同时起表」房里必须整段关掉,不是保守,是那个房设下按下的语义变了:
   *   1) 门控期(gate.gated)按下 = toggleReady,向服务端上报「我准备好了」。全员准备
   *      服务端就落 startAt,3 秒后**全房**一起起表。让魔方替人上报等于让「把魔方放
   *      桌上两秒」去替全房按发车键 —— 起身倒杯水就满足条件,把还没就位的人拖进起表。
   *   2) 上报走的是 toggle,而 useAutoReady 每次布防只 fire 一次:万一在「已准备」时
   *      打中,反而把自己的准备取消掉,房间卡在等一个不会再自己准备的人 —— 正是要
   *      避免的死锁。
   *   3) 倒计时期(startAt !== null)已无「预备」可言,起表由 startNow 接管;此时进
   *      hold 只会和它打架。
   * 交卷后(!canSolve)同样关闭:那时按下 = 开下一轮,绝不能让魔方替全房翻页。
   * 于是同时起表房里魔方只剩「还原即停表」,发车键始终在人手上;非同时起表的房
   * (默认)行为与 Solo 完全一致。
   * 顺带一个好处:enabled 随轮次翻转(交卷→关,新一轮→开),等于每轮自动重新布防,
   * useAutoReady 的「一次性 fire」正好按轮复位。
   */
  // 'scrambled'(全站默认)不走这个 hook —— 它只认转动手势,而「打乱对了」是状态,
  // 由下面的打乱校验那段直接触发预备。两条路的房间态门控是同一套。
  const autoReadyEnabled =
    (settings.bluetoothAutoReady === 'still' || settings.bluetoothAutoReady === 'double-flick')
    && bluetoothCube.status.connected
    && canSolve
    && !gate.gated
    && startAt === null;
  useAutoReady({
    enabled: autoReadyEnabled,
    mode: settings.bluetoothAutoReady === 'double-flick' ? 'double-flick' : 'still',
    onReady: () => {
      // fire 与判定之间隔着 2 秒静置,期间房间状态可能已经变(别人开了同时起表 /
      // 倒计时落下来了),这里按 ref 复查一遍,门一合上就作废。
      if (gateRef.current || startAtRef.current !== null || !canSolveRef.current) return;
      const ph = phaseRef.current;
      if (ph === 'idle' || ph === 'inspecting' || ph === 'stopped') timer.onPressDown();
    },
    onMoveSubscriber: (cb) => {
      const subs = btSubscribersRef.current;
      subs.add(cb);
      return () => { subs.delete(cb); };
    },
  });

  const btStatusRef = useRef(bluetoothCube.status);
  btStatusRef.current = bluetoothCube.status;
  const btCubeRef = useRef(bluetoothCube);
  useEffect(() => { btCubeRef.current = bluetoothCube; }, [bluetoothCube]);

  // The 3D live view is driven by a move log, while the flat views use the
  // cube''s authoritative facelets. Anchor the log from that state exactly as
  // SoloView does, including reconnects and state resyncs.
  const [{ moves: liveMoves, algAnchored }, setLiveAnchor] = useState<LiveSmartCubeAnchorSnapshot>({ moves: [], algAnchored: false });
  const liveAnchor = useMemo(() => new LiveSmartCubeAnchor({
    solve: async (state) => {
      const { solve333 } = await import('../_lib/scramble/kociemba/random_state');
      return solve333(state);
    },
    onChange: setLiveAnchor,
  }), []);
  useEffect(() => {
    const subs = btSubscribersRef.current;
    const mirror = (m: string) => { liveAnchor.move(m); };
    subs.add(mirror);
    return () => { subs.delete(mirror); liveAnchor.setConnection(null); };
  }, [liveAnchor]);
  useEffect(() => {
    liveAnchor.setConnection(cubeConnected
      ? bluetoothCube.status.deviceId || bluetoothCube.status.deviceName || 'cube'
      : null);
  }, [liveAnchor, cubeConnected, bluetoothCube.status.deviceId, bluetoothCube.status.deviceName]);
  useEffect(() => {
    liveAnchor.observeFacelets(bluetoothCube.facelets);
  }, [liveAnchor, cubeConnected, bluetoothCube.facelets]);

  const liveCredentials = useMemo<NetBattleCredentials | null>(() => (
    pid && playerToken ? { playerId: pid, playerToken } : null
  ), [pid, playerToken]);
  const {
    players: liveCubePlayers,
    ready: liveRoomReady,
    publishMove: publishLiveMove,
  } = useNetBattleLiveCube({
    code: room?.code ?? null,
    credentials: liveCredentials,
    round: room?.round ?? 1,
    localConnected: cubeConnected,
    localFacelets: bluetoothCube.facelets,
  });
  useEffect(() => {
    const subs = btSubscribersRef.current;
    const publish = (move: string) => publishLiveMove(move);
    subs.add(publish);
    return () => { subs.delete(publish); };
  }, [publishLiveMove]);

  const roomPlayers = useMemo(() => room ? sortedNetPlayers(room.players) : [], [room]);
  const [viewedCubePlayerId, setViewedCubePlayerId] = useState<string | null>(null);
  useEffect(() => { setViewedCubePlayerId(pid); }, [pid, room?.code]);
  useEffect(() => {
    if (!viewedCubePlayerId || viewedCubePlayerId === pid) return;
    const live = liveCubePlayers[viewedCubePlayerId];
    if (!room
      || !live?.connected
      || !live.smart
      || live.round !== room.round
      || !live.facelets) {
      setViewedCubePlayerId(pid);
    }
  }, [liveCubePlayers, pid, room, viewedCubePlayerId]);

  const [pkLock, setPkLock] = useState<NetPkLock | null>(null);
  useEffect(() => {
    setPkLock((current) => {
      if (!room || !pid) return null;
      if (current?.code === room.code && current.round === room.round) return current;
      const contenders = roomPlayers.filter((player) => (
        isNetOnline(player, room.now) && isNetRoundParticipant(room, player.id)
      ));
      if (contenders.length !== 2 || !contenders.some((player) => player.id === pid)) return null;
      const hasCurrentSnapshot = (playerId: string): boolean => {
        const live = liveCubePlayers[playerId];
        if (playerId === pid) {
          return liveRoomReady
            && cubeConnected
            && !!bluetoothCube.facelets
            && !!live?.connected
            && live.smart
            && live.round === room.round;
        }
        return !!live?.connected
          && live.smart
          && live.round === room.round
          && !!live.facelets;
      };
      if (!contenders.every((player) => hasCurrentSnapshot(player.id))) return null;
      const opponent = contenders.find((player) => player.id !== pid);
      return opponent ? {
        code: room.code,
        round: room.round,
        opponentId: opponent.id,
        opponentName: netPlayerName(opponent, isZh),
      } : null;
    });
  }, [
    bluetoothCube.facelets,
    cubeConnected,
    isZh,
    liveCubePlayers,
    liveRoomReady,
    pid,
    room,
    roomPlayers,
  ]);
  const activePkLock = room && pkLock?.code === room.code && pkLock.round === room.round ? pkLock : null;

  // dev 专用假魔方(生产构建里整段是空操作)。房里这条路和 Solo 不是同一条 —— 起表
  // 门控、打乱校验、录制都是这个文件自己的 —— 所以没硬件时也要能真的走一遍。
  const scrambleForFakeRef = useRef<string>('');
  useEffect(() => { installFakeCube(() => scrambleForFakeRef.current); }, []);

  // 录制:计时中的每一手进缓冲,时刻相对起表点。和 Solo 同一个订阅位。
  useEffect(() => {
    const subs = btSubscribersRef.current;
    const recorder = (m: string, ts: number) => {
      if (phaseRef.current !== 'running') return;
      attemptProducerRef.current.recordMove(m, ts);
    };
    subs.add(recorder);
    return () => { subs.delete(recorder); };
  }, []);

  // 我这一轮要拧的打乱。房里可以各选各的项目,所以是 per-player 的;没身份时退回
  // 房间项目那条(大厅预览)。
  const myScr = room && pid ? myScramble(room, pid) : (room?.scrambles[room.event] ?? null);
  scrambleForFakeRef.current = myScr ?? '';

  // ── 打乱校验 + 逐步提示 ─────────────────────────────────────
  // 联机房原来没有这个信号,于是全站默认的「打乱正确即预备」在房里等于关着。
  // 魔方本来就知道自己是什么状态,这是它比按键强的地方,没有理由只在 Solo 用。
  // 只比三阶:追踪器建模的就是三阶,而 FMC / 多盲的打乱串根本没有可比对象。
  const scrambleTarget = useMemo<CubeFaces | null>(() => {
    if (!timerSupportsNetBattleSmartCube(myEvent)) return null;
    const s = myScr ?? '';
    if (!s.trim()) return null;
    try { return applyScramble(3, s); } catch { return null; }
  }, [myEvent, myScr]);
  const [scrambleMatch, setScrambleMatch] = useState<boolean | null>(null);
  const [scrambleHint, setScrambleHint] = useState<ScrambleHint | null>(null);
  const scrambleTargetRef = useRef<CubeFaces | null>(null);
  const scrambleTextRef = useRef('');
  useEffect(() => {
    scrambleTargetRef.current = scrambleTarget;
    scrambleTextRef.current = scrambleTarget ? (myScr ?? '') : '';
    setScrambleMatch(null);
    setScrambleHint(null);
  }, [scrambleTarget, myScr]);
  useEffect(() => {
    const subs = btSubscribersRef.current;
    const verify = (_move: string, _ts: number, metadata?: CubeMoveMetadata) => {
      if (metadata?.futureHistory) return;
      const target = scrambleTargetRef.current;
      if (!target) return;
      // 计时中魔方本来就不该等于打乱了,这时比对没有意义。
      if (phaseRef.current === 'running') return;
      const faces = btCubeRef.current?.getFaces();
      if (!faces) return;
      const match = facesEqual(faces, target);
      setScrambleMatch(match);
      // 「打乱正确即预备」放在这里而不是放在 scrambleMatch 的 effect 里:它是
      // 「这一手把打乱拧完了」这个**事件**,不是「等于打乱」这个状态。当成状态的话,
      // 停表那一次提交也会命中(计时中跳过比对,所以那时的值还是拧完打乱时的 true),
      // 于是每把结束都会自动预备下一把,下一条打乱的头几手就把表起了。
      // 房间态门控与 useAutoReady 那段同一套(理由见其上的长注释)。
      if (match
        && settings.bluetoothAutoReady === 'scrambled'
        && !gateRef.current && startAtRef.current === null && canSolveRef.current) {
        const ph = phaseRef.current;
        if (ph === 'idle' || ph === 'stopped') timer.onPressDown();
      }
      const text = scrambleTextRef.current;
      if (!text) { setScrambleHint(null); return; }
      setScrambleHint(hintScramble(text, faces));
    };
    subs.add(verify);
    return () => { subs.delete(verify); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.bluetoothAutoReady]);
  useEffect(() => {
    if (bluetoothCube.status.connected) return;
    setScrambleMatch(null);
    setScrambleHint(null);
  }, [bluetoothCube.status.connected]);

  // ── 按压接线(pointer 在计时面板 + 空格全局)────────────────────
  const pressDown = useCallback(() => {
    if (phaseRef.current === 'running') { timer.onPressDown(); return; }
    if (!canSolveRef.current) {
      // 已交卷时按下也视为本机进入下一轮的明确动作。
      if (myResult && roundSettled) advance(false);
      return;
    }
    // 房间要求同时起表且还没进倒计时:按压 = 切换「准备」,不直接起表
    if (gateRef.current) { toggleReady(); return; }
    timer.onPressDown();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [advance, myResult, roundSettled, toggleReady]);
  const pressDownRef = useRef(pressDown); pressDownRef.current = pressDown;
  const pressUpRef = useRef(timer.onPressUp); pressUpRef.current = timer.onPressUp;

  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const opponentSurfaceRef = useRef<HTMLDivElement | null>(null);
  const inRoom = !!room;
  useEffect(() => {
    if (!inRoom) return;
    const el = surfaceRef.current;
    if (!el) return;
    const down = (e: PointerEvent) => {
      if (shouldIgnoreTimerTarget(e.target)) return;
      e.preventDefault();
      pressDownRef.current();
    };
    const up = (e: PointerEvent) => {
      if (shouldIgnoreTimerTarget(e.target)) return;
      pressUpRef.current();
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
    };
  }, [inRoom]);

  // 弹层打开时全局空格不进计时(同 Solo 的 anyModalOpen)。蓝牙弹窗里有 MAC 输入框,
  // 战绩 / 管理面板可以点到背景 —— 焦点一旦不在 button/input 上,空格就会穿透去
  // 「准备」或起表。
  const overlayOpen = showStats || showAdmin || bluetoothOpen || renameOpen || qrOpen;
  const overlayOpenRef = useRef(overlayOpen); overlayOpenRef.current = overlayOpen;
  useEffect(() => {
    if (!inRoom) return;
    const kd = (e: KeyboardEvent) => {
      if (overlayOpenRef.current) return;
      if (shouldIgnoreTimerTarget(e.target)) return;
      if (phaseRef.current === 'running') { e.preventDefault(); pressDownRef.current(); return; }
      if (e.code === 'Space') {
        e.preventDefault();
        if (!e.repeat) pressDownRef.current();
      }
    };
    const ku = (e: KeyboardEvent) => {
      if (overlayOpenRef.current) return;
      if (shouldIgnoreTimerTarget(e.target)) return;
      if (e.code === 'Space') { e.preventDefault(); pressUpRef.current(); }
    };
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    return () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); };
  }, [inRoom]);

  // ── 罚时调整(交卷后可改,改 = 重交同一时间新罚时)──────────────
  const adjustPenalty = useCallback((p: NetPenalty) => {
    const r = roomRef.current, id = pidRef.current;
    if (!r || !id) return;
    const cur = r.results[String(r.round)]?.[id];
    if (!cur) return;
    // 本机那条记录也要跟着改 —— 同一把在房间记分板上是 DNF、在自己的历史里还是有效
    // 成绩,那两边就对不上了。留档只在有转动流时发生,所以这里可能是 null。
    const local = localSolveRef.current;
    if (local) {
      local.solve.penalty = p === 'dnf' ? 'DNF' : p === '+2' ? '+2' : 'ok';
      updateSolves(local.event, [local.solve]);
    }
    const auth = credentialsRef.current;
    if (!auth || auth.playerId !== id) return;
    void postNetResult(r.code, auth, r.round, cur.t, p).then(applyState).catch(() => {});
  }, [applyState]);

  // ── 邀请链接复制 ────────────────────────────────────────────
  const [linkCopied, setLinkCopied] = useState(false);
  const copyTimerRef = useRef<number | null>(null);
  useEffect(() => () => { if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current); }, []);
  // 邀请链接 = 当前页 URL + ?players=net&room=CODE(队友粘进浏览器 / 扫码打开即落加入页)。
  // 复制按钮与二维码共用这一份,别各拼各的。
  const roomInviteUrl = useCallback((): string | null => {
    const r = roomRef.current;
    if (typeof window === 'undefined' || !r) return null;
    const u = new URL(window.location.href);
    u.searchParams.set('players', 'net');
    u.searchParams.set('room', r.code);
    return u.toString();
  }, []);
  const copyLink = useCallback(() => {
    const url = roomInviteUrl();
    if (!url) return;
    try { void navigator.clipboard.writeText(url); } catch { /* ignore */ }
    setLinkCopied(true);
    if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
    copyTimerRef.current = window.setTimeout(() => setLinkCopied(false), 1200);
  }, [roomInviteUrl]);

  // ── 读数呈现(与 Solo 同口径)──────────────────────────────────
  const myPenalty: NetPenalty = myResult?.p ?? 'ok';
  const inspectionLimit = settings.inspectionSec > 0 ? settings.inspectionSec : 15;

  /** 同时起表倒计时正在走(且我还没交卷)→ 读数位显示 3/2/1。 */
  const showCountdown = countdownMs !== null && !myResult;

  const colorClass = useMemo(() => {
    if (showCountdown) return 'inspection';
    if (timer.phase === 'holding') return 'holding';
    if (timer.phase === 'ready') return 'ready';
    if (timer.phase === 'running') return 'running';
    if (timer.phase === 'inspecting') {
      const penalty = inspectionPenalty(timer.inspectionDisplayMs, inspectionLimit);
      if (penalty === 'DNF') return 'inspection-dnf';
      if (penalty === '+2') return 'inspection-plus2';
      const sec = Math.floor(timer.inspectionDisplayMs / 1000);
      if (sec >= 12) return 'inspection-warn-12';
      if (sec >= 8) return 'inspection-warn-8';
      return 'inspection';
    }
    if (myResult && myPenalty === 'dnf') return 'dnf';
    return '';
  }, [showCountdown, timer.phase, timer.inspectionDisplayMs, inspectionLimit, myResult, myPenalty]);

  const digitsText = useMemo(() => {
    if (showCountdown) return String(Math.max(1, Math.ceil((countdownMs ?? 0) / 1000)));
    if (timer.phase === 'inspecting') {
      return formatInspectionDisplay(timer.inspectionDisplayMs, inspectionLimit);
    }
    if (timer.phase === 'running') {
      return settings.hideTime ? '' : formatMs(timer.displayMs, settings.runningPrecision);
    }
    // 已交卷:以房间里的成绩(含罚时调整)为准
    if (myResult) {
      if (myPenalty === 'dnf') return 'DNF';
      if (myPenalty === '+2') return formatMs(myResult.t + 2000, settings.precision) + '+';
      return formatMs(myResult.t, settings.precision);
    }
    return formatMs(timer.displayMs, settings.precision);
  }, [showCountdown, countdownMs, timer.phase, timer.inspectionDisplayMs, timer.displayMs, inspectionLimit, myResult, myPenalty, settings.hideTime, settings.precision, settings.runningPrecision]);

  const fontSize = `calc(clamp(48px, 10vw, 132px) * ${settings.timerFontScale})`;

  // 视频通话。开关在顶栏、画面在玩家条下方,两处共用这一份状态。
  // code / pid 任一为空 = 身份还没落定(正在加入 / 恢复),此时签不出 token,整套 UI 不出现。
  const video = useVideoRoom(room?.code ?? null, pid, playerToken, room?.videoGeneration ?? null);

  // ── 渲染 ────────────────────────────────────────────────────
  const topbar = (
    <TimerTopbar brand={<CubeRootLogo className="shell-topbar-brand" />} controls={<>
        {room && (
          // 我的项目:本轮未交卷时可改(每人独立选,默认房间项目);已交卷则显示为静态芯片。
          !myResult && inRoundRoster ? (
            <span className="net-my-event" title={tr({ zh: '选择你的项目', en: 'Choose your event' })}>
              <EventSelect
                events={NET_SELECTOR_EVENTS}
                value={netEventToSelectorId(myEvent)}
                onChange={changeEvent}
              />
            </span>
          ) : (
            <span className="net-event-chip" title={eventDisplayName(netEventToSelectorId(myEvent), isZh)}>
              <EventIcon event={netEventToSelectorId(myEvent)} />
              <span className="net-event-name">{eventDisplayName(netEventToSelectorId(myEvent), isZh)}</span>
            </span>
          )
        )}
        <VideoToggle video={video} />
        {playersControl}
      </>} actions={presenceControl} />
  );

  const identityField = <TimerRoomIdentity language={isZh ? 'zh' : 'en'}
    account={authUser ? identity : null} value={picked} defaultQuery={name}
    onChange={(person) => { setPicked(person); setName(''); }} onQueryChange={setName} disabled={busy} />;

  if (!room) {
    return <div className="timer-shell net-shell">
      {topbar}
      <div className="shell-main">
        <TimerRoomLobby language={isZh ? 'zh' : 'en'} identity={identityField}
          event={<EventSelect events={NET_SELECTOR_EVENTS} value={netEventToSelectorId(lobbyEvent)}
            onChange={(id) => { const event = selectorIdToNetEvent(id); if (event) setLobbyEvent(event); }} />}
          code={joinCode} busy={busy} error={err} inviteCode={roomParam?.trim().toUpperCase()}
          onCodeChange={setJoinCode} onJoin={doJoin} onCreate={doCreate}
          onCancelInvite={() => { setErr(null); void setRoomParam(null); }} onExit={onExitNet} />
      </div>
    </div>;
  }
  const curResults = room.results[String(room.round)] ?? {};
  const serverNowEst = Date.now() + (offsetRef.current ?? 0);
  const displayScramble = myScr ? formatScrambleForEvent(myEvent, myScr) : '';
  const renderRemoteCubeSlot = (
    playerId: string,
    live: NetBattleLiveCubePlayer,
    ownerLabel?: string,
    reconnecting = false,
  ): ReactNode => (
    <div className="shell-corner-net net-remote-cube-slot">
      {ownerLabel && <div className="net-cube-owner">{ownerLabel} · {tr({ zh: '实况', en: 'live' })}</div>}
      <div className="shell-corner-net-imgbox">
        <div
          className="timer-live-cube"
          data-no-timer
          title={tr({ zh: '对方智能魔方实时状态', en: "Opponent's live smart-cube state" })}
        >
          <LiveCubeState
            key={`${playerId}:${live.round ?? room.round}`}
            facelets={live.facelets}
            moves={[...live.moves]}
            algAnchored={live.algAnchored}
            mode={settings.liveCubeView}
            useGyro={false}
          />
        </div>
      </div>
      {reconnecting && (
        <div className="net-cube-connection-state">
          {tr({ zh: '实况重连中…', en: 'Reconnecting live feed…' })}
        </div>
      )}
    </div>
  );
  const ownLiveCubeSlot = bluetoothCube.facelets ? (
    <div className="shell-corner-net">
      <div className="shell-corner-net-imgbox">
        <div
          className="timer-live-cube"
          data-no-timer
          title={tr({ zh: '智能魔方实时状态（每次拧动同步）', en: 'Live smart-cube state (updates per move)' })}
        >
          <LiveCubeState
            key={bluetoothCube.status.deviceId || bluetoothCube.status.deviceName}
            facelets={bluetoothCube.facelets}
            moves={[...liveMoves]}
            algAnchored={algAnchored}
            mode={settings.liveCubeView}
            useGyro={settings.gyroEnabled}
            quatRef={settings.gyroEnabled ? gyroQuatRef : undefined}
            calibrateToken={calibrateNonce}
            sensorBasis={sensorBasisForBrand(bluetoothCube.status.brand)}
            mirror={mirrorForBrand(bluetoothCube.status.brand)}
          />
        </div>
      </div>
      {activePkLock && (!cubeConnected || !liveRoomReady) && (
        <div className="net-cube-connection-state">
          {tr({ zh: '实况重连中…', en: 'Reconnecting live feed…' })}
        </div>
      )}
    </div>
  ) : undefined;
  const ownDefaultCubeSlot = (cubeConnected || cubeStartedRef.current) && ownLiveCubeSlot
    ? ownLiveCubeSlot
    : settings.showCubePreview && myScr ? (
        <div className="shell-corner-net">
          <div className="shell-corner-net-imgbox">
            <div className="shell-corner-net-img">
              <CubePreview
                event={myEvent as EventId}
                scramble={myScr}
                height="var(--cube-h)"
                visualization={settings.prefer3D ? '3D' : '2D'}
              />
            </div>
          </div>
        </div>
      ) : undefined;
  const selectedRemoteId = viewedCubePlayerId && viewedCubePlayerId !== pid
    ? viewedCubePlayerId
    : null;
  const selectedRemoteLive = selectedRemoteId ? liveCubePlayers[selectedRemoteId] : undefined;
  const selectedRemotePlayer = selectedRemoteId ? room.players[selectedRemoteId] : undefined;
  const selectedCubeSlot = selectedRemoteId
    && selectedRemoteLive?.connected
    && selectedRemoteLive.smart
    && selectedRemoteLive.round === room.round
    && selectedRemoteLive.facelets
    ? renderRemoteCubeSlot(
        selectedRemoteId,
        selectedRemoteLive,
        selectedRemotePlayer ? netPlayerName(selectedRemotePlayer, isZh) : selectedRemoteId,
      )
    : ownDefaultCubeSlot;

  const opponentId = activePkLock?.opponentId ?? null;
  const opponent = opponentId ? room.players[opponentId] ?? null : null;
  const opponentResult = opponentId ? curResults[opponentId] : undefined;
  const opponentLive = opponentId ? liveCubePlayers[opponentId] : undefined;
  const opponentOnline = !!opponent && isNetOnline(opponent, room.now);
  const opponentFeedReady = !!opponentLive?.connected
    && opponentLive.smart
    && opponentLive.round === room.round;
  const opponentPhase = opponentResult
    ? 'stopped'
    : opponent?.ph === 'solving'
      ? 'running'
      : opponent?.ph === 'inspecting'
        ? 'inspecting'
        : opponent?.ph === 'ready'
          ? 'ready'
          : 'idle';
  const opponentColorClass = `${
    opponentResult?.p === 'dnf'
      ? 'dnf'
      : opponentPhase === 'running'
        ? 'running'
        : opponentPhase === 'inspecting'
          ? 'inspection'
          : opponentPhase === 'ready'
            ? 'ready'
            : ''
  } tf-${settings.timerFont}`.trim();
  const opponentStatus = !opponentOnline
    ? tr({ zh: '对手离线', en: 'Opponent offline' })
    : !opponentFeedReady
      ? tr({ zh: '实况重连中…', en: 'Reconnecting live feed…' })
      : opponentResult
        ? tr({ zh: '已完成', en: 'Finished' })
        : opponent?.ph === 'solving'
          ? tr({ zh: '计时中', en: 'Solving' })
          : opponent?.ph === 'inspecting'
            ? tr({ zh: '观察中', en: 'Inspecting' })
            : opponent?.ph === 'ready'
              ? tr({ zh: '已准备', en: 'Ready' })
              : tr({ zh: '待开始', en: 'Waiting' });
  const ownPkStatus = !cubeConnected || !liveRoomReady
    ? tr({ zh: '实况重连中…', en: 'Reconnecting live feed…' })
    : myResult
      ? tr({ zh: '已完成', en: 'Finished' })
      : timer.phase === 'running'
        ? tr({ zh: '计时中', en: 'Solving' })
        : timer.phase === 'inspecting'
          ? tr({ zh: '观察中', en: 'Inspecting' })
          : gate.ready
            ? tr({ zh: '已准备', en: 'Ready' })
            : tr({ zh: '待开始', en: 'Waiting' });
  const myPlayer = pid ? room.players[pid] : undefined;
  const myPkName = myPlayer ? netPlayerName(myPlayer, isZh) : tr({ zh: '我', en: 'Me' });
  const opponentPkName = opponent
    ? netPlayerName(opponent, isZh)
    : activePkLock?.opponentName ?? tr({ zh: '对手', en: 'Opponent' });
  const opponentCubeSlot = opponentId && opponentLive?.facelets
    ? renderRemoteCubeSlot(opponentId, opponentLive, undefined, !opponentFeedReady)
    : undefined;
  /** 房内是否存在多种项目(决定玩家条/历史是否显示各自项目图标)。 */

  const ownTimingSurface = (
    <TimingSurface
      layout="net"
      phase={timer.phase}
      colorClass={`${colorClass} tf-${settings.timerFont}`.trim()}
      fontScale={settings.timerFontScale}
      digits={<SegmentTime text={digitsText} />}
      surfaceRef={surfaceRef}
      scrambleSlot={
        <TimerScrambleStrip
          copied={false}
          copiedLabel={tr({ zh: '已复制', en: 'Copied' })}
          fallback={tr({ zh: '生成打乱中…', en: 'Generating scramble…' })}
          fallbackKind="custom"
          font={settings.scrambleFont}
          fontScale={settings.scrambleFontScale}
          hint={scrambleHint}
          match={scrambleMatch}
          scramble={displayScramble}
          verificationLabels={{
            copiedCorrection: tr({ zh: '已复制原打乱', en: 'Copied the scramble' }),
          }}
        />
      }
      cornerSlot={activePkLock ? ownLiveCubeSlot : selectedCubeSlot}
    >
      <TimerRoomRoundStatus room={room} currentPlayerId={pid!} language={isZh ? 'zh' : 'en'}
        idle={timer.phase === 'idle' || timer.phase === 'stopped'} countdown={showCountdown}
        cubeAutoReadySuspended={cubeConnected && (settings.bluetoothAutoReady === 'still' || settings.bluetoothAutoReady === 'double-flick')}
        onPenalty={adjustPenalty} onReady={toggleReady} onNext={advance} />
      {err && <div className="net-err" data-no-timer>{err}</div>}
    </TimingSurface>
  );

  return (
    <div className="timer-shell net-shell" data-solving={timer.phase === 'running' ? 'true' : undefined}>
      {topbar}

      <TimerRoomLayout className="shell-main"
        devices={<TimerDeviceCenter ariaLabel={tr({ en: 'Timer devices', zh: '计时设备' })}
          menuLabel={tr({ en: 'Timer devices', zh: '计时设备' })} triggerLabel={tr({ en: 'Devices', zh: '设备' })}
          items={[{ id: 'smart-cube', kind: 'smart-cube', active: cubeConnected,
            label: tr({ en: 'Smart cube', zh: '智能魔方' }), detail: bluetoothCube.status.deviceName ?? undefined,
            onSelect: connectSmartCubeCenter }]} />}
        toolbar={<TimerRoomToolbar language={isZh ? 'zh' : 'en'} code={room.code} round={room.round}
        syncStart={room.syncStart} copied={linkCopied} copyKind="invite" disabled={timer.phase !== 'idle' && timer.phase !== 'stopped'}
        historyOpen={showStats} adminOpen={showAdmin} onCopy={copyLink}
        onQr={() => setQrOpen(true)} onHistory={() => setShowStats(true)}
        onAdmin={iAmAdmin ? () => setShowAdmin(true) : undefined} onLeave={doLeave} />}

        players={!activePkLock && <TimerRoomPlayers room={room} currentPlayerId={pid}
          language={isZh ? 'zh' : 'en'} precision={settings.precision} nowMs={serverNowEst}
          viewedPlayerId={viewedCubePlayerId} onViewPlayer={setViewedCubePlayerId}
          canViewPlayer={(id) => {
            const live = liveCubePlayers[id];
            return id === pid ? cubeConnected && !!bluetoothCube.facelets
              : !!live?.connected && live.smart && live.round === room.round && !!live.facelets;
          }}
          onRename={!authUser ? (name) => { setName(baseName(name)); setRenameOpen(true); } : undefined}
          runningTime={(id, elapsed) => <span id={`net-live-${id}`}>{formatMs(elapsed, 2)}</span>}
          eventIcon={(event) => <EventIcon event={netEventToSelectorId(event)} title={eventDisplayName(netEventToSelectorId(event), isZh)} />}
        />}
        media={<VideoStrip video={video} />}
      >
        {activePkLock ? (
          <div className="net-pk-arena">
            <section className="net-pk-side is-self" aria-label={tr({ zh: '我的计时与智能魔方', en: 'My timer and smart cube' })}>
              <header className="net-pk-side-head surface-chrome">
                <span className="net-pk-side-name">{myPkName}</span>
                <span className="net-pk-side-role">{tr({ zh: '我', en: 'Me' })}</span>
                <span className="net-pk-side-status">{ownPkStatus}</span>
              </header>
              {ownTimingSurface}
            </section>
            <section className="net-pk-side is-opponent" aria-label={tr({ zh: '对手计时与智能魔方', en: 'Opponent timer and smart cube' })}>
              <header className="net-pk-side-head surface-chrome">
                <span className="net-pk-side-name">{opponentPkName}</span>
                <span className="net-pk-side-status">{opponentStatus}</span>
              </header>
              <TimingSurface
                phase={opponentPhase}
                colorClass={opponentColorClass}
                fontSize={fontSize}
                digits={(
                  <RemoteTimerDigits
                    player={opponent}
                    result={opponentResult}
                    online={opponentOnline}
                    clockOffsetMs={offsetRef.current}
                    precision={settings.precision}
                  />
                )}
                surfaceRef={opponentSurfaceRef}
                cornerSlot={opponentCubeSlot}
                className="net-pk-opponent-timing"
                ariaLabel={tr({ zh: '对手计时', en: 'Opponent timer' })}
              />
            </section>
          </div>
        ) : ownTimingSurface}
      </TimerRoomLayout>

      {showAdmin && iAmAdmin && (
        <TimerRoomAdmin
          room={room}
          currentPlayerId={pid}
          language={isZh ? 'zh' : 'en'}
          onSyncStart={setSyncStart}
          onTransfer={transferAdmin}
          onKick={kickPlayer}
          onClose={() => setShowAdmin(false)}
        />
      )}

      {qrOpen && (() => {
        const url = roomInviteUrl();
        return url ? <RoomQrModal url={url} code={room.code} onClose={() => setQrOpen(false)} /> : null;
      })()}

      {/* 改名:复用大厅那个身份字段(纯昵称 or 认领 WCA 选手,认了就带上国旗和 WCA ID)。 */}
      {renameOpen && (
        <TimerRoomDialog language={isZh ? 'zh' : 'en'} title={tr({ en: 'Change name', zh: '改名' })} onClose={() => setRenameOpen(false)}>
          {identityField}
          <div className="timer-room-actions"><button type="button"
            onClick={() => { doRename(identityRef.current); setRenameOpen(false); }}>
            {tr({ en: 'Save', zh: '保存' })}
          </button></div>
        </TimerRoomDialog>
      )}

      {showStats && (
        <TimerRoomHistory
          room={room}
          currentPlayerId={pid}
          language={isZh ? 'zh' : 'en'}
          precision={settings.precision}
          onClose={() => setShowStats(false)}
        />
      )}

      {bluetoothOpen && (
        <BluetoothModal
          isZh={isZh}
          cube={bluetoothCube}
          connectAttempt={bluetoothConnectAttempt}
          onResetGyro={() => setCalibrateNonce(n => n + 1)}
          macPrompt={macPrompt}
          onSubmitMac={(mac) => resolveMac(mac)}
          onCancelMac={() => resolveMac(null)}
          onClose={() => {
            if (macResolverRef.current) resolveMac(null);
            setBluetoothOpen(false);
            setBluetoothConnectAttempt(null);
          }}
          // 失败也交给弹窗:它知道断在哪一步(选设备 / GATT / 握手),说得比这里清楚,
          // 而且 Solo、对战、房间三处不会再各报各的。
          onConnect={pick => bluetoothCube.connect(pick)}
        />
      )}
    </div>
  );
}

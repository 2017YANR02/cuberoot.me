'use client';

/**
 * NetBattleView — /timer 的「联机对战」模式(?players=net)。
 *
 * 多设备对战:每人用自己的设备,一人创建房间(拿到 5 位房间码 / 邀请链接),其余人
 * 加入;全房共用同一条打乱,各自在本机计时,成绩与实时状态互相可见,任一玩家可开
 * 下一轮(CAS)。参照 /alg 训练器协同房间的成熟模式:HTTP 轮询(1s,no-store)+
 * PG 单行 jsonb 原子合并,无 WebSocket(见 lib/battle-room-api.ts / server
 * routes/battle_rooms.ts)。
 *
 * 本机计时完整复用 Solo 的 useTimer 状态机 + TimingSurface 呈现(观察/hold/精度/
 * 字体等沿用用户的 timer 设置);对手「计时中」的滚动读数是本地推算:status 上报
 * 起表时刻(服务器时钟),客户端用轮询响应的 now 估时钟偏移后本地滚动,停表后以
 * 上报的最终成绩为准。
 *
 * 身份:无需登录,随机 playerId;sessionStorage 存 {code,pid,name},刷新页面原地
 * 恢复身份(不重复加入);昵称记 localStorage,登录用户默认用 WCA 姓名。
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
import { Copy, Check, LogOut, Swords, Trophy, RotateCcw, BarChart3, X, Crown, UserMinus, Bluetooth, QrCode } from 'lucide-react';

import TimingSurface from './TimingSurface';
import BluetoothModal from '../_components/BluetoothModal';
import { useBluetoothCube } from '../_lib/bluetooth';
import { useAutoReady } from '../_lib/bluetooth/auto_ready';
import { useTimer, type SolveResult } from '../_shared/useTimer';
import { useSettings } from '../_lib/settings';
import { formatMs } from '../_lib/stats';
import { generateScramble } from '../_lib/scramble';
import type { EventId } from '../_lib/types';
import { CubePreview } from '../_lib/cube';
import { SegmentTime } from '@/components/SegmentTime';
import CubeRootLogo from '@/components/CubeRootLogo';
import { EventSelect } from '@/components/EventSelect';
import { RoomQrModal } from '@/components/RoomQrModal';
import { EventIcon } from '@/components/EventIcon';
import { WcaPersonPicker } from '@/components/WcaPersonPicker';
import { Flag } from '@/components/Flag';
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
} from '@/lib/battle-room-api';
import {
  effectiveNetMs, roundWinners, sortedNetPlayers, isNetOnline, blendClockOffset,
  isRoundComplete, pendingCount, NET_EVENTS, netEventToSelectorId, selectorIdToNetEvent,
  playerEventOf, myScramble, playerStats, playerTimeline, roundViews, netErrorMessage,
  isNetAdmin, syncGate,
} from '@/lib/battle-room-logic';
import BoolToggle from '@/components/BoolToggle';

// BluetoothModal 与打乱条(.scramble-strip / .timer-modal*)的样式都在 timer.css。
import '../timer.css';
import './shell.css';
import './net.css';

const LS_NAME = 'net_battle_name';
const SS_KEY = 'net_battle_session';
/** 访客不填昵称时的回落名(与服务端 sanitizeName 的默认值一致)。 */
const GUEST_NAME = 'Cuber';
/** 生成的房间码固定 5 位;填满即自动加入。 */
const JOIN_CODE_LEN = 5;

interface SavedSession { code: string; pid: string; name: string }

function readSession(): SavedSession | null {
  try {
    const raw = sessionStorage.getItem(SS_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as SavedSession;
    return v && typeof v.code === 'string' && typeof v.pid === 'string' ? v : null;
  } catch { return null; }
}

/** 联机房间项目选择器的可选项(WCA id 形式,顺序即 NET_EVENTS)。 */
const NET_SELECTOR_EVENTS = NET_EVENTS.map(netEventToSelectorId);

interface NetBattleViewProps {
  /** 人数下拉(TimerShell 构建),注入到顶栏 */
  playersControl?: ReactNode;
  /** 彻底退出联机模式(清 room + 人数回单人)。 */
  onExitNet?: () => void;
}

export default function NetBattleView({ playersControl, onExitNet }: NetBattleViewProps) {
  useDocumentTitle('联机对战', 'Online Battle');
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const settings = useSettings();
  const authUser = useAuthStore((st) => st.user);

  // ── 房间状态 ────────────────────────────────────────────────
  const [roomParam, setRoomParam] = useQueryState('room');
  const [room, setRoom] = useState<NetRoomState | null>(null);
  const [pid, setPid] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showStats, setShowStats] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const roomRef = useRef(room); roomRef.current = room;
  const pidRef = useRef(pid); pidRef.current = pid;
  /** 服务器时钟 - 本机时钟(EMA;对手滚动读数换算用)。 */
  const offsetRef = useRef<number | null>(null);

  // ── 大厅表单 ────────────────────────────────────────────────
  // 访客自由昵称(未选 WCA 选手时用)。同步读 localStorage 而不是挂 effect 补:扫码进来
  // 的自动加入在首个 effect pass 就要拿到昵称,effect 补的值那时还没写进 identity。
  // NetBattleView 只在 TimerShell 的 mounted 门控后渲染(服务端永远是 SoloView),
  // 这里读 localStorage 不会造成 hydration 错配;window 判空只是防守。
  const [name, setName] = useState(() => {
    if (typeof window === 'undefined') return '';
    try { return localStorage.getItem(LS_NAME) || ''; } catch { return ''; }
  });
  const [picked, setPicked] = useState<WcaPersonLite | null>(null); // 访客选中的 WCA 选手
  const [joinCode, setJoinCode] = useState('');
  const [lobbyEvent, setLobbyEvent] = useState('333');
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
    offsetRef.current = blendClockOffset(offsetRef.current, st.now, Date.now());
    setRoom(prev => (prev && prev.code === st.code && st.round < prev.round ? prev : st));
  }, []);

  const adopt = useCallback((st: NetRoomState & { playerId: string }, nm: string) => {
    setPid(st.playerId);
    applyState(st);
    setErr(null);
    try { sessionStorage.setItem(SS_KEY, JSON.stringify({ code: st.code, pid: st.playerId, name: nm } satisfies SavedSession)); } catch { /* ignore */ }
    if (nm) persistItem(LS_NAME, nm);
  }, [applyState]);

  // ── 计时器(复用 Solo 的状态机;设置沿用用户 timer 设置)──────
  const myResult = room && pid ? room.results[String(room.round)]?.[pid] : undefined;
  const myEvent = room && pid ? playerEventOf(room, pid) : (room?.event ?? '333');
  const canSolve = !!room && !!pid && !myResult;
  const complete = room ? isRoundComplete(room) : false;
  /** 还没交本轮成绩的在线玩家数。 */
  const waiting = room ? pendingCount(room) : 0;
  /** 本轮已无人可等(全交卷,或房里只剩我)。isRoundComplete 在「在线不足 2 人」时
      恒 false(那是同时起表门控的口径),单独用它会让一个人开好房等朋友时既看到
      「还差 0 人」,又按不动空格开下一轮。 */
  const roundSettled = !!room && (complete || waiting === 0);
  const canAdvance = !!room && !!pid && !!myResult;
  const canSolveRef = useRef(canSolve); canSolveRef.current = canSolve;
  const canAdvanceRef = useRef(canAdvance && roundSettled); canAdvanceRef.current = canAdvance && roundSettled;

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

  const advance = useCallback(() => {
    const r = roomRef.current, id = pidRef.current;
    if (!r || !id || advBusyRef.current) return;
    advBusyRef.current = true;
    // 开轮者为「自己的项目」生成新打乱;其余项目由各玩家进轮后 lazy 生成回填。
    const ev = playerEventOf(r, id);
    const scr = generateScramble(ev as EventId);
    void nextNetRound(r.code, id, r.round, scr)
      .then(applyState)
      .catch((e: Error) => setErr(tr(netErrorMessage(e))))
      .finally(() => { advBusyRef.current = false; });
  }, [applyState]);

  // 改自己的项目(仅本轮尚未交卷时可改)。生成新项目打乱一并提交,服务端 set-if-absent 回填。
  const changeEvent = useCallback((selId: string) => {
    const r = roomRef.current, id = pidRef.current;
    if (!r || !id) return;
    const ev = selectorIdToNetEvent(selId);
    if (ev === playerEventOf(r, id)) return;
    const scr = generateScramble(ev as EventId);
    void postNetEvent(r.code, id, ev, scr)
      .then((st) => { applyState(st); timerReset(); })
      .catch((e: Error) => setErr(tr(netErrorMessage(e))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyState]);

  const onSolve = useCallback((res: SolveResult) => {
    const r = roomRef.current, id = pidRef.current;
    if (!r || !id) return;
    const p: NetPenalty = res.autoPenalty === 'DNF' ? 'dnf' : res.autoPenalty === '+2' ? '+2' : 'ok';
    const round = solvingRoundRef.current || r.round;
    void postNetResult(r.code, id, round, res.timeMs, p)
      .then((st) => applyState(st))
      .catch(() => {
        // 一次静默重试;仍失败给出提示(下一轮照常,丢的是本轮成绩)
        void postNetResult(r.code, id, round, res.timeMs, p).then(applyState).catch(() =>
          setErr(tr({ zh: '成绩上传失败,请检查网络', en: 'Failed to upload result — check your connection' })));
      });
  }, [applyState]);

  const timer = useTimer(onSolve);
  const phaseRef = useRef(timer.phase); phaseRef.current = timer.phase;

  // 起表瞬间锁定「这条打乱属于第几轮」:交卷投递到该轮,轮次已被推进则服务端拒收
  useEffect(() => {
    if (timer.phase === 'running') solvingRoundRef.current = roomRef.current?.round ?? 0;
  }, [timer.phase]);

  // 实时状态上报(观察中/计时中)— 纯装饰,失败静默
  useEffect(() => {
    const r = roomRef.current, id = pidRef.current;
    if (!r || !id) return;
    if (timer.phase === 'inspecting') void postNetStatus(r.code, id, 'inspecting').catch(() => {});
    else if (timer.phase === 'running') void postNetStatus(r.code, id, 'solving').catch(() => {});
  }, [timer.phase]);

  // ── 同时开始:准备开关 + 倒计时归零同时起表 ────────────────────
  const { reset: timerReset, startNow: timerStartNow } = timer;

  /** 切换自己的「准备」状态;最后一个准备的人这一跳会带回 startAt(服务端落的倒计时起点)。 */
  const toggleReady = useCallback(() => {
    const r = roomRef.current, id = pidRef.current;
    if (!r || !id) return;
    const next = r.players[id]?.ph === 'ready' ? 'idle' : 'ready';
    void postNetStatus(r.code, id, next).then(applyState).catch(() => {});
  }, [applyState]);

  // 倒计时:startAt(服务器时钟)换算到本机(减去时钟偏移),归零即 startNow 同时起表。
  // 每个 startAt 只消费一次;迟到超过 3s(刚切回页面/刚进房)不硬起表,免得读数一上来就是几十秒。
  const autoStartedRef = useRef<number | null>(null);
  useEffect(() => {
    if (startAt === null) { setCountdownMs(null); return; }
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
      if (late > 3000) return;
      const r = roomRef.current, id = pidRef.current;
      if (!r || !id || r.results[String(r.round)]?.[id]) return; // 已交卷的人不跟着起表
      timerStartNow(late);
    };
    tick();
    iv = window.setInterval(tick, 50);
    return () => window.clearInterval(iv);
  }, [startAt, timerStartNow]);

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
    setRoom(null); setPid(null); setErr(msg);
    try { sessionStorage.removeItem(SS_KEY); } catch { /* ignore */ }
    void setRoomParam(null);
  }, [setRoomParam]);

  const code = room?.code ?? null;
  useEffect(() => {
    if (!code || !pid) return;
    let stopped = false;
    const tick = async () => {
      try {
        const st = await getNetRoom(code, pid);
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
        }
      }
    };
    const iv = window.setInterval(() => { if (!document.hidden) void tick(); }, 1000);
    const onVis = () => { if (!document.hidden) void tick(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { stopped = true; window.clearInterval(iv); document.removeEventListener('visibilitychange', onVis); };
  }, [code, pid, applyState, handleRoomGone]);

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

  // 我的项目当前轮打乱缺失(进新一轮、或刚切到别人没在玩的项目)→ 本机生成并 set-if-absent
  // 回填(同项目玩家共享;并发只一个生效)。按 (round, event) 去重,失败可重试。
  const ensuredKeyRef = useRef<string>('');
  useEffect(() => {
    if (!room || !pid) return;
    const ev = playerEventOf(room, pid);
    if (room.scrambles?.[ev]) return;
    const key = `${room.round}:${ev}`;
    if (ensuredKeyRef.current === key) return;
    ensuredKeyRef.current = key;
    const scr = generateScramble(ev as EventId);
    void ensureNetScramble(room.code, ev, scr)
      .then(applyState)
      .catch(() => { ensuredKeyRef.current = ''; });
  }, [room, pid, applyState]);

  // ── 建房 / 加入 / 恢复 / 离开 ───────────────────────────────
  const doCreate = useCallback(() => {
    const id = identityRef.current;
    if (busy) return;
    setBusy(true); setErr(null);
    const ev = lobbyEvent;
    const scr = generateScramble(ev as EventId);
    void createNetRoom(ev, scr, id)
      .then((st) => { adopt(st, id.name); void setRoomParam(st.code); })
      .catch((e: Error) => setErr(tr(netErrorMessage(e))))
      .finally(() => setBusy(false));
  }, [busy, lobbyEvent, adopt, setRoomParam]);

  const doJoin = useCallback((rawCode: string) => {
    const codeUp = rawCode.trim().toUpperCase();
    const id = identityRef.current;
    if (!codeUp || busy) return;
    setBusy(true); setErr(null);
    void joinNetRoom(codeUp, id)
      .then((st) => { adopt(st, id.name); setJoinCode(''); void setRoomParam(st.code); })
      .catch((e: Error) => setErr(tr(netErrorMessage(e))))
      .finally(() => setBusy(false));
  }, [busy, adopt, setRoomParam]);

  // 房间码填满(5 位)即自动加入,无需按钮;同一码只试一次(改码 / 失败后可再试)。
  // 只在「房间码」变化时触发(身份走 ref,不进依赖),避免访客还在逐字打名字时就
  // 拿半截昵称抢先加入。
  const autoJoinedRef = useRef('');
  useEffect(() => {
    const c = joinCode.trim().toUpperCase();
    if (c.length !== JOIN_CODE_LEN || busy) return;
    if (autoJoinedRef.current === c) return;
    autoJoinedRef.current = c;
    doJoin(c);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joinCode, busy, doJoin]);

  // 邀请链接 / 扫码 ?room=CODE:直接进房,不停确认页 —— 扫码的人要的就是「进这个房」,
  // 中间再插一屏点「加入」纯属挡路。身份取现成的(登录用户 = WCA 姓名,访客 =
  // localStorage 记的昵称,都没有就回落 Cuber,重名由服务端加 (2)(3))。
  // 先试 sessionStorage 同码恢复:刷新页面原地回到同一个 pid,不在玩家条里多一个自己。
  // 自动加入前把码记进 autoJoinedRef,否则下面「填满 5 位即加入」的 effect 会再加入一次。
  const autoJoinRef = useRef(false);
  useEffect(() => {
    if (!roomParam || room || busy || autoJoinRef.current) return;
    autoJoinRef.current = true;
    const codeUp = roomParam.trim().toUpperCase();
    void (async () => {
      try {
        const saved = readSession();
        if (saved && saved.code === codeUp) {
          const st = await getNetRoom(codeUp, saved.pid);
          if (st.players[saved.pid]) { setPid(saved.pid); applyState(st); return; }
        }
      } catch { /* 读不到就当新人,照常加入 */ }
      autoJoinedRef.current = codeUp;
      doJoin(codeUp);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomParam, room, busy, applyState, doJoin]);

  // ── 房主操作(授权在服务端;这里只管发请求 + 同步状态)────────────
  const setSyncStart = useCallback((v: boolean) => {
    const r = roomRef.current, id = pidRef.current;
    if (!r || !id) return;
    void postNetSyncStart(r.code, id, v).then(applyState).catch((e: Error) => setErr(tr(netErrorMessage(e))));
  }, [applyState]);

  const transferAdmin = useCallback((target: string) => {
    const r = roomRef.current, id = pidRef.current;
    if (!r || !id) return;
    void postNetAdmin(r.code, id, target)
      .then((st) => { applyState(st); setShowAdmin(false); })
      .catch((e: Error) => setErr(tr(netErrorMessage(e))));
  }, [applyState]);

  const kickPlayer = useCallback((target: string) => {
    const r = roomRef.current, id = pidRef.current;
    if (!r || !id) return;
    void postNetKick(r.code, id, target).then(applyState).catch((e: Error) => setErr(tr(netErrorMessage(e))));
  }, [applyState]);

  // ── 房内改名 ────────────────────────────────────────────────
  /** 剥掉服务端为去重加的「 (2)」尾巴,拿到基名。判「名字是不是已经对了」用它。 */
  const baseName = (n: string) => n.replace(/ \(\d+\)$/, '');

  const doRename = useCallback((next: NetIdentity) => {
    const r = roomRef.current, id = pidRef.current;
    if (!r || !id) return;
    void renameNetPlayer(r.code, id, next)
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
    const r = roomRef.current, id = pidRef.current;
    setRoom(null); setPid(null); setErr(null);
    autoJoinRef.current = false;
    prevRoundRef.current = null;
    try { sessionStorage.removeItem(SS_KEY); } catch { /* ignore */ }
    void setRoomParam(null);
    timerReset();
    if (r && id) void leaveNetRoom(r.code, id).catch(() => {});
  }, [setRoomParam, timerReset]);

  // ── 智能魔方(蓝牙)──────────────────────────────────────────
  // 与 Solo 同一个 hook + 同一个弹窗(不 fork BluetoothModal)。房内只接两件事:
  // 还原即停表、赛前自动预备。手动 MAC 输入沿用 Solo 那套「延迟 promise」:
  // hook 需要 MAC 时挂起,弹窗把用户输入的值 resolve 回去。
  const [bluetoothOpen, setBluetoothOpen] = useState(false);
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

  // hook 只给一个 onMove;订阅者(当前只有自动预备)统一从这里分发,与 Solo 的
  // bluetoothSubscribersRef 同构 —— 以后要加实时魔方/TPS 直接往里加订阅即可。
  const btSubscribersRef = useRef<Set<(m: string, ts: number) => void>>(new Set());

  const bluetoothCube = useBluetoothCube({
    onMove: (move, ts) => {
      for (const sub of btSubscribersRef.current) {
        try { sub(move, ts); } catch (e) { console.error('[bt-broadcast]', e); }
      }
    },
    // 魔方回到还原态 = 停表,与 Solo 逐字一致。只在真的在计时时停,所以别人回合里
    // 随手把魔方拧回还原不会替你交卷。停表走 onPressDown → useTimer 结算 → onSolve
    // 上报成绩,同时起表(startNow 起的表)和普通起表都落在同一条路径上。
    onSolved: () => {
      if (phaseRef.current === 'running') timer.onPressDown();
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
  const autoReadyEnabled =
    settings.bluetoothAutoReady !== 'off'
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

  // ── 按压接线(pointer 在计时面板 + 空格全局)────────────────────
  const pressDown = useCallback(() => {
    if (phaseRef.current === 'running') { timer.onPressDown(); return; }
    if (!canSolveRef.current) {
      // 已交卷:全员完赛时按压 = 直接开下一轮(与连续计时的手感一致)
      if (canAdvanceRef.current) advance();
      return;
    }
    // 房间要求同时起表且还没进倒计时:按压 = 切换「准备」,不直接起表
    if (gateRef.current) { toggleReady(); return; }
    timer.onPressDown();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [advance, toggleReady]);
  const pressDownRef = useRef(pressDown); pressDownRef.current = pressDown;
  const pressUpRef = useRef(timer.onPressUp); pressUpRef.current = timer.onPressUp;

  const surfaceRef = useRef<HTMLDivElement | null>(null);
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
  const overlayOpen = showStats || showAdmin || bluetoothOpen || renameOpen;
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
    void postNetResult(r.code, id, r.round, cur.t, p).then(applyState).catch(() => {});
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
  /** 邀请二维码弹窗(队友扫码直接落加入页)。 */
  const [qrOpen, setQrOpen] = useState(false);

  const [scrambleCopied, setScrambleCopied] = useState(false);
  const copyScramble = useCallback(() => {
    const r = roomRef.current, id = pidRef.current;
    if (!r || !id) return;
    const ev = playerEventOf(r, id);
    const scr = r.scrambles?.[ev];
    if (!scr) return;
    try { void navigator.clipboard.writeText(formatScrambleForEvent(ev, scr)); } catch { /* ignore */ }
    setScrambleCopied(true);
    if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
    copyTimerRef.current = window.setTimeout(() => setScrambleCopied(false), 1200);
  }, []);

  // ── 读数呈现(与 Solo 同口径)──────────────────────────────────
  const inspectionLimit = settings.inspection > 0 ? settings.inspection : 15;
  const myPenalty: NetPenalty = myResult?.p ?? 'ok';

  /** 同时起表倒计时正在走(且我还没交卷)→ 读数位显示 3/2/1。 */
  const showCountdown = countdownMs !== null && !myResult;

  const colorClass = useMemo(() => {
    if (showCountdown) return 'inspection';
    if (timer.phase === 'holding') return 'holding';
    if (timer.phase === 'ready') return 'ready';
    if (timer.phase === 'running') return 'running';
    if (timer.phase === 'inspecting') {
      const sec = Math.floor(timer.inspectionDisplayMs / 1000);
      if (sec >= inspectionLimit + 2) return 'inspection-dnf';
      if (sec >= inspectionLimit) return 'inspection-plus2';
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
      const remaining = Math.max(0, Math.ceil((inspectionLimit * 1000 - timer.inspectionDisplayMs) / 1000));
      if (timer.inspectionDisplayMs > inspectionLimit * 1000 + 2000) return 'DNF';
      if (timer.inspectionDisplayMs > inspectionLimit * 1000) return '+2';
      return remaining.toString();
    }
    if (timer.phase === 'running') {
      return settings.hideTime ? '…' : formatMs(timer.displayMs, settings.runningPrecision);
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

  // ── 渲染 ────────────────────────────────────────────────────
  const topbar = (
    <header className="shell-topbar surface-chrome">
      <CubeRootLogo className="shell-topbar-brand" />
      <div className="shell-topbar-left">
        {playersControl}
        {room && (
          // 我的项目:本轮未交卷时可改(每人独立选,默认房间项目);已交卷则显示为静态芯片。
          !myResult ? (
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
        {room && (
          <span className="net-round-chip">
            {tr({ zh: `第 ${room.round} 轮`, en: `Round ${room.round}` })}
          </span>
        )}
        {room?.syncStart && (
          <span className="net-sync-chip" title={tr({ zh: '本房要求全员同时起表', en: 'This room requires a synchronized start' })}>
            {tr({ zh: '同时起表', en: 'Sync start' })}
          </span>
        )}
      </div>
      <div className="shell-topbar-right">
        {room && (
          <>
            <button
              type="button"
              className={`tb-btn${bluetoothCube.status.connected ? ' connected' : ''}`}
              onClick={() => setBluetoothOpen(true)}
              title={bluetoothCube.status.connected
                ? tr({
                    zh: `已连接 ${bluetoothCube.status.deviceName}（还原即停表）`,
                    en: `Connected: ${bluetoothCube.status.deviceName} (solving the cube stops the timer)`,
                  })
                : tr({ zh: '智能魔方（iOS 用 Bluefy）', en: 'Smart cube (use Bluefy on iOS)' })}
              aria-label={tr({ zh: '智能魔方', en: 'Smart cube' })}
            >
              <Bluetooth size={14} />
            </button>
            <button
              type="button"
              className="tb-btn"
              onClick={() => setShowStats(true)}
              title={tr({ zh: '战绩', en: 'Results' })}
              aria-label={tr({ zh: '战绩', en: 'Results' })}
            >
              <BarChart3 size={14} />
            </button>
            {iAmAdmin && (
              <button
                type="button"
                className="tb-btn net-admin-btn"
                onClick={() => setShowAdmin(true)}
                title={tr({ zh: '房间管理', en: 'Room settings' })}
                aria-label={tr({ zh: '房间管理', en: 'Room settings' })}
              >
                <Crown size={14} />
              </button>
            )}
            <button
              type="button"
              className="net-code-badge"
              onClick={copyLink}
              title={tr({ zh: '复制邀请链接', en: 'Copy invite link' })}
            >
              <span className="net-code-label">{tr({ zh: '房间', en: 'Room' })}</span>
              <span className="net-code-code">{room.code}</span>
              {linkCopied ? <Check size={13} /> : <Copy size={13} />}
            </button>
            <button
              type="button"
              className="tb-btn"
              onClick={() => setQrOpen(true)}
              title={tr({ zh: '二维码(队友扫码加入)', en: 'QR code (teammates scan to join)' })}
              aria-label={tr({ zh: '房间二维码', en: 'Room QR code' })}
            >
              <QrCode size={14} />
            </button>
            <button
              type="button"
              className="tb-btn"
              onClick={doLeave}
              title={tr({ zh: '离开房间', en: 'Leave room' })}
              aria-label={tr({ zh: '离开房间', en: 'Leave room' })}
            >
              <LogOut size={14} />
            </button>
          </>
        )}
      </div>
    </header>
  );

  // 身份字段:登录用户直接显示其 WCA 姓名+ID(不填昵称);访客用 WcaPersonPicker
  // (搜姓名/WCA ID,复用 recon 的选手选择器),选不到就把输入当自由昵称。
  const identityField = (
    <div className="net-field">
      <span className="net-field-label">{tr({ zh: '选手', en: 'Player' })}</span>
      {authUser ? (
        <div className="net-identity-me">
          {authUser.avatar
            ? <img src={authUser.avatar} alt="" className="net-identity-avatar" width={24} height={24} />
            : null}
          {/* 显示 identity.name 而非 authUser.name:房里挂出去的是 WCA 名册上的名字,
              这里照着账号的 display_name 写就成了「预览的名字和房里的名字对不上」。 */}
          <span className="net-identity-name">{identity.name}</span>
          {authUser.wcaId ? <span className="net-identity-wcaid">{authUser.wcaId}</span> : null}
        </div>
      ) : (
        <WcaPersonPicker
          value={picked}
          // 选中/清空选手都把自由昵称一并清掉(选手栏内的输入已被 picker 清空,
          // 不清则 name 留着半截旧文字,清掉选手后会拿它当昵称)。
          onChange={(p) => { setPicked(p); setName(''); }}
          onQueryChange={setName}
          // 框里先摆着上次用的名字:localStorage 里记着它、加入时也真会用它,
          // 却给人看一个空框,等于让人以为自己还没名字。
          defaultQuery={name}
          isZh={isZh}
          placeholder={tr({ zh: '昵称,或搜姓名 / WCA ID(可留空)', en: 'Nickname, or search name / WCA ID (optional)' })}
        />
      )}
    </div>
  );

  if (!room) {
    // 邀请链接 / 扫码进来(URL 带 room=)→ 已在上面直接加入,这里只剩两种过场:
    // 正在进房、以及房间不在了(给明确出口)。
    const inviteCode = roomParam ? roomParam.trim().toUpperCase() : null;
    return (
      <div className="timer-shell net-shell">
        {topbar}
        {/* shell-main 承接大厅 —— timer-shell 桌面端是命名区域 grid,大厅直接做
            它的子元素会落进隐式格被挤出视口(同 net-players 的处理)。 */}
        <div className="shell-main">
        <div className="net-lobby">
          {inviteCode ? (
            err ? (
              /* ───── 房间不存在 / 已过期:给明确出口 ───── */
              <>
                <h2 className="net-lobby-title">
                  <Swords size={20} />
                  {tr({ zh: '加入房间', en: 'Join room' })}
                  <span className="net-lobby-code">{inviteCode}</span>
                </h2>
                <div className="net-err">{err}</div>
                <button
                  type="button"
                  className="net-btn net-btn-primary net-btn-lg"
                  onClick={() => { setErr(null); void setRoomParam(null); }}
                >
                  {tr({ zh: '创建自己的房间', en: 'Create my own room' })}
                </button>
                <button
                  type="button"
                  className="net-btn is-ghost net-lobby-switch"
                  onClick={() => onExitNet?.()}
                >
                  {tr({ zh: '退出联机', en: 'Exit online mode' })}
                </button>
              </>
            ) : (
              <p className="net-lobby-hint">{tr({ zh: '正在进入房间…', en: 'Joining room…' })}</p>
            )
          ) : (
            /* ───── 创建模式(直接进来)───── */
            <>
              {identityField}

              <div className="net-field">
                <span className="net-field-label">{tr({ zh: '项目', en: 'Event' })}</span>
                <EventSelect
                  events={NET_SELECTOR_EVENTS}
                  value={netEventToSelectorId(lobbyEvent)}
                  onChange={(id) => setLobbyEvent(selectorIdToNetEvent(id))}
                />
              </div>

              <button type="button" className="net-btn net-btn-primary net-btn-lg" onClick={doCreate} disabled={busy}>
                {tr({ zh: '创建房间', en: 'Create room' })}
              </button>

              <div className="net-lobby-or">{tr({ zh: '有房间码?', en: 'Have a code?' })}</div>

              <div className="net-join-row">
                {/* 填满 5 位即自动加入,无「加入」按钮 */}
                <input
                  className="net-input net-input-code"
                  data-no-timer
                  value={joinCode}
                  maxLength={JOIN_CODE_LEN}
                  placeholder={tr({ zh: '房间码', en: 'Room code' })}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => { if (e.key === 'Enter') doJoin(joinCode); }}
                  aria-label={tr({ zh: '房间码', en: 'Room code' })}
                />
              </div>

              {err && <div className="net-err">{err}</div>}
            </>
          )}
        </div>
        </div>
      </div>
    );
  }

  const players = sortedNetPlayers(room.players);
  const curResults = room.results[String(room.round)] ?? {};
  const winners = roundSettled ? roundWinners(curResults, room.players) : [];
  const serverNowEst = Date.now() + (offsetRef.current ?? 0);
  const myScr = pid ? myScramble(room, pid) : (room.scrambles[room.event] ?? null);
  const displayScramble = myScr ? formatScrambleForEvent(myEvent, myScr) : '';
  /** 房内是否存在多种项目(决定玩家条/历史是否显示各自项目图标)。 */
  const mixedEvents = new Set(players.map((p) => p.event || room.event)).size > 1;

  return (
    <div className="timer-shell net-shell" data-solving={timer.phase === 'running' ? 'true' : undefined}>
      {topbar}

      <div className="shell-main">
      {/* 玩家条:名字 + 胜场 + 实时状态(计时中滚动读数为本地推算)。
          放在 shell-main 里(TimingSurface 上方)—— timer-shell 在桌面端是命名
          区域 grid,直接做它的子元素会落进隐式格被挤出视口。 */}
      <div className="net-players surface-chrome" data-no-timer>
        {players.map((p) => {
          const mine = p.id === pid;
          const online = isNetOnline(p, room.now);
          const res = curResults[p.id];
          const isWinner = winners.includes(p.id);
          let statusNode: ReactNode;
          if (res) {
            const eff = effectiveNetMs(res);
            statusNode = (
              <span className={`net-p-time${res.p === 'dnf' ? ' is-dnf' : ''}`}>
                {res.p === 'dnf' ? 'DNF' : formatMs(eff, settings.precision) + (res.p === '+2' ? '+' : '')}
              </span>
            );
          } else if (!online) {
            statusNode = <span className="net-p-status is-off">{tr({ zh: '离线', en: 'offline' })}</span>;
          } else if (p.ph === 'solving') {
            // 初值按轮询时刻的估算渲染,随后由 rAF 每帧写 textContent 滚动到 0.01s。
            statusNode = (
              <span className="net-p-status is-live net-p-live" id={`net-live-${p.id}`}>
                {formatMs(Math.max(0, serverNowEst - p.at), 2)}
              </span>
            );
          } else if (p.ph === 'inspecting') {
            statusNode = <span className="net-p-status is-live">{tr({ zh: '观察中', en: 'inspecting' })}</span>;
          } else if (p.ph === 'ready') {
            statusNode = <span className="net-p-status is-ready">{tr({ zh: '已准备', en: 'ready' })}</span>;
          } else {
            statusNode = <span className="net-p-status">{tr({ zh: '等待', en: 'waiting' })}</span>;
          }
          const pEvent = p.event || room.event;
          return (
            <div key={p.id} className={`net-player${mine ? ' is-me' : ''}${online ? '' : ' is-offline'}`}>
              {mixedEvents && (
                <EventIcon
                  event={netEventToSelectorId(pEvent)}
                  className="net-p-event"
                  title={eventDisplayName(netEventToSelectorId(pEvent), isZh)}
                />
              )}
              {p.iso2 && <Flag iso2={p.iso2} className="net-p-flag" />}
              {p.id === room.admin && (
                <Crown size={12} className="net-p-crown" aria-label={tr({ zh: '房主', en: 'Host' })} />
              )}
              {/* 自己的名字可点开改(登录用户除外:他们的名字就是账号 / WCA 名册上的名字)。 */}
              {mine && !authUser ? (
                <button
                  type="button"
                  className="net-p-name net-p-name-btn"
                  onClick={() => { setName(baseName(p.name)); setRenameOpen(true); }}
                  title={tr({ zh: '改名', en: 'Change name' })}
                >
                  {p.name}
                  <span className="net-p-me">{tr({ zh: '(我)', en: ' (me)' })}</span>
                </button>
              ) : (
                <span className="net-p-name" title={p.wcaId ? `${p.name} · ${p.wcaId}` : p.name}>
                  {p.name}
                  {mine && <span className="net-p-me">{tr({ zh: '(我)', en: ' (me)' })}</span>}
                </span>
              )}
              <span className="net-p-score">
                {isWinner && <Trophy size={12} className="net-p-trophy" />}
                {room.scores[p.id] ?? 0}
              </span>
              {statusNode}
            </div>
          );
        })}
      </div>

        <TimingSurface
          phase={timer.phase}
          colorClass={`${colorClass} tf-${settings.timerFont}`.trim()}
          fontSize={fontSize}
          digits={<SegmentTime text={digitsText} />}
          surfaceRef={surfaceRef}
          scrambleSlot={
            <div
              className={`scramble-strip sf-${settings.scrambleFont}`}
              style={{ '--scramble-scale': settings.scrambleFontScale } as React.CSSProperties}
              onClick={copyScramble}
              title={tr({ zh: '点击复制打乱', en: 'Click to copy' })}
            >
              <span className="scramble-text">
                {displayScramble || tr({ zh: '生成打乱中…', en: 'Generating scramble…' })}
              </span>
              {scrambleCopied && <span className="net-copied">{tr({ zh: '已复制', en: 'Copied' })}</span>}
            </div>
          }
          cornerSlot={settings.showCubePreview && myScr ? (
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
          ) : undefined}
        >
          {/* 读数下方的阶段提示区 */}
          {myResult && (timer.phase === 'idle' || timer.phase === 'stopped') && (
            <div className="net-substate" data-no-timer>
              {/* 罚时调整:交卷后仍可改(重交同一时间) */}
              <div className="net-penalty-row">
                {(['ok', '+2', 'dnf'] as NetPenalty[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    className={`net-pen-btn${myPenalty === p ? ' active' : ''}`}
                    onClick={() => adjustPenalty(p)}
                  >
                    {p === 'ok' ? 'OK' : p === '+2' ? '+2' : 'DNF'}
                  </button>
                ))}
              </div>
              {/* 没人可等(complete,或房里暂时只有我)→ 直接给「下一轮」。
                  isRoundComplete 在「在线不足 2 人」时恒 false(那是同时起表门控的
                  口径),照它渲染的话,一个人开好房等朋友时会看到「还差 0 人」。 */}
              {roundSettled ? (
                <>
                  <div className="net-round-result">
                    {winners.length > 0
                      ? tr({
                          zh: `本轮最快:${winners.map(w => room.players[w]?.name ?? '?').join(' / ')}`,
                          en: `Round winner: ${winners.map(w => room.players[w]?.name ?? '?').join(' / ')}`,
                        })
                      : tr({ zh: '本轮无有效成绩', en: 'No valid result this round' })}
                  </div>
                  <button type="button" className="net-btn net-btn-primary" onClick={advance}>
                    <RotateCcw size={14} />
                    {tr({ zh: '下一轮', en: 'Next round' })}
                  </button>
                  <div className="net-substate-hint">
                    {tr({ zh: '按空格 / 点击也可直接开下一轮', en: 'Space / tap also starts the next round' })}
                  </div>
                </>
              ) : (
                <>
                  <div className="net-substate-hint">
                    {tr({
                      zh: `等待其他玩家完成(还差 ${waiting} 人)…`,
                      en: `Waiting for others to finish (${waiting} left)…`,
                    })}
                  </div>
                  <button type="button" className="net-btn is-ghost" onClick={advance}>
                    {tr({ zh: '不等了,直接开下一轮', en: 'Skip waiting — next round' })}
                  </button>
                </>
              )}
            </div>
          )}
          {/* 同时起表:全员准备才开倒计时(按空格 / 点击也等同「准备」)*/}
          {!myResult && gate.gated && (timer.phase === 'idle' || timer.phase === 'stopped') && (
            <div className="net-substate" data-no-timer>
              <button
                type="button"
                className={`net-btn${gate.ready ? '' : ' net-btn-primary'}`}
                onClick={toggleReady}
              >
                {gate.ready ? tr({ zh: '取消准备', en: 'Cancel ready' }) : tr({ zh: '我准备好了', en: "I'm ready" })}
              </button>
              <div className="net-substate-hint">
                {gate.ready
                  ? tr({
                      zh: `等其他人准备(还差 ${gate.waiting} 人)…`,
                      en: `Waiting for others to get ready (${gate.waiting} left)…`,
                    })
                  : tr({
                      zh: '本房要求同时起表:全员准备后 3 秒倒计时一起开始',
                      en: 'This room starts together — a 3s countdown begins once everyone is ready',
                    })}
              </div>
              {/* 连了魔方且开了自动预备的人,这里要明说自动预备被停用了 —— 否则会
                  站着等魔方替自己准备,把全房卡住。 */}
              {bluetoothCube.status.connected && settings.bluetoothAutoReady !== 'off' && (
                <div className="net-substate-hint">
                  {tr({
                    zh: '同时起表期间不自动预备:请自己点「准备」,魔方只负责还原时停表',
                    en: 'Auto-ready is off during a synchronized start — tap “ready” yourself; the cube only stops the timer',
                  })}
                </div>
              )}
            </div>
          )}
          {showCountdown && (
            <div className="net-substate net-substate-hint" data-no-timer>
              {tr({ zh: '一起起表,准备!', en: 'Starting together — get ready!' })}
            </div>
          )}
          {!myResult && !gate.gated && !showCountdown && timer.phase === 'idle' && players.length < 2 && (
            <div className="net-substate net-substate-hint">
              {tr({ zh: '把房间码或邀请链接发给朋友,等 TA 加入', en: 'Share the room code or invite link and wait for others' })}
            </div>
          )}
          {err && <div className="net-err" data-no-timer>{err}</div>}
        </TimingSurface>
      </div>

      {showAdmin && iAmAdmin && (
        <NetAdminPanel
          room={room}
          pid={pid}
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
        <div className="net-stats-overlay" onClick={() => setRenameOpen(false)} role="presentation">
          <div className="net-stats-panel net-rename-panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <header className="net-stats-head">
              <h2 className="net-stats-title">{tr({ zh: '改名', en: 'Change name' })}</h2>
              <button
                type="button"
                className="tb-btn"
                onClick={() => setRenameOpen(false)}
                title={tr({ zh: '关闭', en: 'Close' })}
                aria-label={tr({ zh: '关闭', en: 'Close' })}
              >
                <X size={16} />
              </button>
            </header>
            {identityField}
            <button
              type="button"
              className="net-btn net-btn-primary"
              onClick={() => { doRename(identityRef.current); setRenameOpen(false); }}
            >
              {tr({ zh: '保存', en: 'Save' })}
            </button>
          </div>
        </div>
      )}

      {showStats && (
        <NetStatsPanel
          room={room}
          pid={pid}
          isZh={isZh}
          precision={settings.precision}
          onClose={() => setShowStats(false)}
        />
      )}

      {bluetoothOpen && (
        <BluetoothModal
          isZh={isZh}
          cube={bluetoothCube}
          macPrompt={macPrompt}
          onSubmitMac={(mac) => resolveMac(mac)}
          onCancelMac={() => resolveMac(null)}
          onClose={() => { if (macResolverRef.current) resolveMac(null); setBluetoothOpen(false); }}
          onConnect={async () => {
            try { await bluetoothCube.connect(); }
            catch (e) {
              // NO_WEB_BLUETOOTH 由弹窗自己讲(envAdvice 那一段),不重复报。
              const msg = (e as Error).message ?? String(e);
              if (msg !== 'NO_WEB_BLUETOOTH') {
                setBtNotice(tr({ zh: `连接失败:${msg}`, en: `Connection failed: ${msg}` }));
              }
            }
          }}
        />
      )}
    </div>
  );
}

// ── 房间管理面板(仅房主可见:房设 + 转让房主 + 踢人)──────────────────────────
interface NetAdminPanelProps {
  room: NetRoomState;
  pid: string | null;
  onSyncStart: (v: boolean) => void;
  onTransfer: (target: string) => void;
  onKick: (target: string) => void;
  onClose: () => void;
}

function NetAdminPanel({ room, pid, onSyncStart, onTransfer, onKick, onClose }: NetAdminPanelProps) {
  const players = sortedNetPlayers(room.players);
  // 踢人两步确认:误点一下不会直接把人踢出去(对战中很恼人)。
  const [confirmKick, setConfirmKick] = useState<string | null>(null);

  return (
    <div className="net-stats-overlay" onClick={onClose} role="presentation">
      <div className="net-stats-panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <header className="net-stats-head">
          <h2 className="net-stats-title net-admin-title">
            <Crown size={16} />
            {tr({ zh: '房间管理', en: 'Room settings' })}
          </h2>
          <button
            type="button"
            className="tb-btn"
            onClick={onClose}
            title={tr({ zh: '关闭', en: 'Close' })}
            aria-label={tr({ zh: '关闭', en: 'Close' })}
          >
            <X size={16} />
          </button>
        </header>

        <div className="net-admin-setting">
          <BoolToggle
            value={room.syncStart}
            onChange={onSyncStart}
            label={tr({ zh: '同时开始计时', en: 'Synchronized start' })}
          />
          <p className="net-admin-note">
            {tr({
              zh: '开启后各自不能想开就开:本轮在场的人都点过「准备」,才会 3 秒倒计时,归零全房同时起表(倒计时即观察时间)。',
              en: 'When on, nobody starts alone — once everyone still in this round taps “ready”, a 3-second countdown runs and all timers start together (the countdown doubles as inspection).',
            })}
          </p>
        </div>

        <div className="net-admin-list">
          {players.map((p) => {
            const isAdminRow = p.id === room.admin;
            const mine = p.id === pid;
            return (
              <div key={p.id} className="net-admin-row">
                {p.iso2 && <Flag iso2={p.iso2} className="net-st-flag" />}
                {isAdminRow && <Crown size={12} className="net-p-crown" />}
                <span className="net-admin-name" title={p.wcaId ? `${p.name} · ${p.wcaId}` : p.name}>{p.name}</span>
                {mine ? (
                  <span className="net-admin-metext">{tr({ zh: '(我)', en: '(me)' })}</span>
                ) : (
                  <>
                    <button type="button" className="net-btn is-ghost" onClick={() => onTransfer(p.id)}>
                      {tr({ zh: '设为房主', en: 'Make host' })}
                    </button>
                    <button
                      type="button"
                      className={`net-btn is-ghost net-admin-kick${confirmKick === p.id ? ' is-confirm' : ''}`}
                      onClick={() => {
                        if (confirmKick === p.id) { onKick(p.id); setConfirmKick(null); }
                        else setConfirmKick(p.id);
                      }}
                      onBlur={() => setConfirmKick((c) => (c === p.id ? null : c))}
                    >
                      <UserMinus size={12} />
                      {confirmKick === p.id ? tr({ zh: '确认踢出', en: 'Confirm' }) : tr({ zh: '踢出', en: 'Kick' })}
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── 战绩面板(single / ao5 / moX 榜 + 每轮回放:打乱公式 + 打乱图 + 各方成绩)──────────
type Precision = 0 | 1 | 2 | 3;

interface NetStatsPanelProps {
  room: NetRoomState;
  pid: string | null;
  isZh: boolean;
  precision: Precision;
  onClose: () => void;
}

/** 统计值格式化:null(无成绩)→ —,Infinity(DNF)→ DNF,否则计时串。 */
function fmtStat(v: number | null, precision: Precision): string {
  if (v === null) return '—';
  if (!Number.isFinite(v)) return 'DNF';
  return formatMs(v, precision);
}

/** 单次成绩格式化(含罚时角标)。 */
function fmtNetResult(r: NetResult | undefined, precision: Precision): string {
  if (!r) return '—';
  if (r.p === 'dnf') return 'DNF';
  return formatMs(effectiveNetMs(r), precision) + (r.p === '+2' ? '+' : '');
}

function NetStatsPanel({ room, pid, isZh, precision, onClose }: NetStatsPanelProps) {
  const players = sortedNetPlayers(room.players);
  const views = roundViews(room);

  return (
    <div className="net-stats-overlay" onClick={onClose} role="presentation">
      <div className="net-stats-panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <header className="net-stats-head">
          <h2 className="net-stats-title">
            <Trophy size={16} />
            {tr({ zh: '战绩', en: 'Results' })}
          </h2>
          <button
            type="button"
            className="tb-btn"
            onClick={onClose}
            title={tr({ zh: '关闭', en: 'Close' })}
            aria-label={tr({ zh: '关闭', en: 'Close' })}
          >
            <X size={16} />
          </button>
        </header>

        {/* 榜:每人 single / ao5 / moX + 累计胜场 */}
        <div className="net-standings-scroll">
          <table className="net-standings">
            <thead>
              <tr>
                <th className="net-st-name">{tr({ zh: '选手', en: 'Player' })}</th>
                <th>{tr({ zh: '胜场', en: 'Wins' })}</th>
                <th>{tr({ zh: '最佳', en: 'Single' })}</th>
                <th>ao5</th>
                <th>{tr({ zh: '平均', en: 'Mean' })}</th>
              </tr>
            </thead>
            <tbody>
              {players.map((p) => {
                const stats = playerStats(playerTimeline(room, p.id));
                const pEvent = p.event || room.event;
                const mine = p.id === pid;
                return (
                  <tr key={p.id} className={mine ? 'is-me' : undefined}>
                    <td className="net-st-name">
                      <EventIcon
                        event={netEventToSelectorId(pEvent)}
                        className="net-st-eventicon"
                        title={eventDisplayName(netEventToSelectorId(pEvent), isZh)}
                      />
                      {p.iso2 && <Flag iso2={p.iso2} className="net-st-flag" />}
                      <span className="net-st-nametext" title={p.wcaId ? `${p.name} · ${p.wcaId}` : p.name}>{p.name}</span>
                    </td>
                    <td className="net-st-wins">{room.scores[p.id] ?? 0}</td>
                    <td>{fmtStat(stats.single, precision)}</td>
                    <td>{fmtStat(stats.ao5, precision)}</td>
                    <td>
                      {fmtStat(stats.mean, precision)}
                      <span className="net-st-mox">mo{stats.count}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* 每轮回放:按项目分组显示打乱公式 + 打乱图 + 该项目各方成绩 */}
        <div className="net-rounds">
          {views.map((rv) => {
            // 本轮参赛者按项目分组(playerEvents 快照);逐组一条打乱一张图。
            const groups = new Map<string, string[]>();
            for (const [id, ev] of Object.entries(rv.playerEvents)) {
              const arr = groups.get(ev) ?? [];
              arr.push(id);
              groups.set(ev, arr);
            }
            return (
              <div key={rv.round} className="net-round-card">
                <div className="net-round-head">
                  {tr({ zh: `第 ${rv.round} 轮`, en: `Round ${rv.round}` })}
                  {rv.live && <span className="net-round-live">{tr({ zh: '进行中', en: 'live' })}</span>}
                </div>
                {[...groups.entries()].map(([ev, ids]) => {
                  const scr = rv.scrambles[ev];
                  const selId = netEventToSelectorId(ev);
                  // 该组按有效成绩升序;缺成绩者垫底
                  const ordered = [...ids].sort((a, b) => {
                    const ra = rv.results[a], rb = rv.results[b];
                    return (ra ? effectiveNetMs(ra) : Infinity) - (rb ? effectiveNetMs(rb) : Infinity);
                  });
                  return (
                    <div key={ev} className="net-round-egroup">
                      {scr ? (
                        <div className="net-round-cube">
                          <CubePreview event={ev as EventId} scramble={scr} height="52px" visualization="2D" />
                        </div>
                      ) : null}
                      <div className="net-round-body">
                        <div className="net-round-scr">
                          <EventIcon event={selId} className="net-round-eventicon" title={eventDisplayName(selId, isZh)} />
                          <span className="net-round-scrtext">
                            {scr ? formatScrambleForEvent(ev, scr) : tr({ zh: '(打乱未生成)', en: '(no scramble)' })}
                          </span>
                        </div>
                        <div className="net-round-rows">
                          {ordered.map((id) => {
                            const won = rv.winners.includes(id);
                            const dnf = rv.results[id]?.p === 'dnf';
                            return (
                              <div key={id} className={`net-round-row${won ? ' is-winner' : ''}`}>
                                <span className="net-round-pname" title={room.players[id]?.name ?? '?'}>
                                  {won && <Trophy size={11} className="net-p-trophy" />}
                                  {room.players[id]?.name ?? '?'}
                                </span>
                                <span className={`net-round-ptime${dnf ? ' is-dnf' : ''}`}>
                                  {fmtNetResult(rv.results[id], precision)}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

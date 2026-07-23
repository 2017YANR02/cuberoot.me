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
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQueryState } from 'nuqs';
import { Copy, Check, LogOut, Swords, Trophy, RotateCcw, BarChart3, X } from 'lucide-react';

import TimingSurface from './TimingSurface';
import { useTimer, type SolveResult } from '../_lib/useTimer';
import { useSettings } from '../_lib/settings';
import { formatMs } from '../_lib/stats';
import { generateScramble } from '../_lib/scramble';
import type { EventId } from '../_lib/types';
import { CubePreview } from '../_lib/cube';
import { SegmentTime } from '@/components/SegmentTime';
import CubeRootLogo from '@/components/CubeRootLogo';
import WcaEventSelector from '@/components/WcaEventSelector';
import { EventIcon } from '@/components/EventIcon';
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
  type NetRoomState, type NetPenalty, type NetResult,
} from '@/lib/battle-room-api';
import {
  effectiveNetMs, roundWinners, sortedNetPlayers, isNetOnline, blendClockOffset,
  isRoundComplete, pendingCount, NET_EVENTS, netEventToSelectorId, selectorIdToNetEvent,
  playerEventOf, myScramble, playerStats, playerTimeline, roundViews, netErrorMessage,
} from '@/lib/battle-room-logic';

import './shell.css';
import './net.css';

const LS_NAME = 'net_battle_name';
const SS_KEY = 'net_battle_session';

interface SavedSession { code: string; pid: string; name: string }

function readSession(): SavedSession | null {
  try {
    const raw = sessionStorage.getItem(SS_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as SavedSession;
    return v && typeof v.code === 'string' && typeof v.pid === 'string' ? v : null;
  } catch { return null; }
}

/** 联机房间项目选择器的可选集(WCA id 形式)。 */
const NET_SELECTOR_EVENTS = new Set(NET_EVENTS.map(netEventToSelectorId));

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
  const roomRef = useRef(room); roomRef.current = room;
  const pidRef = useRef(pid); pidRef.current = pid;
  /** 服务器时钟 - 本机时钟(EMA;对手滚动读数换算用)。 */
  const offsetRef = useRef<number | null>(null);

  // ── 大厅表单 ────────────────────────────────────────────────
  const [name, setName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [lobbyEvent, setLobbyEvent] = useState('333');
  /** 邀请链接进来时预读的房间信息(项目 + 在场者),让加入者先确认进的是哪个房。 */
  const [peek, setPeek] = useState<{ event: string; names: string[] } | null>(null);
  useEffect(() => {
    try { setName(localStorage.getItem(LS_NAME) || ''); } catch { /* ignore */ }
  }, []);
  // 登录用户默认用 WCA 姓名(本地存过昵称则本地优先)
  const effName = (name.trim() || authUser?.name || '').trim();
  const effNameRef = useRef(effName); effNameRef.current = effName;

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
  const canAdvance = !!room && !!pid && !!myResult;
  const canSolveRef = useRef(canSolve); canSolveRef.current = canSolve;
  const canAdvanceRef = useRef(canAdvance && complete); canAdvanceRef.current = canAdvance && complete;

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

  // 新一轮到达(自己开的或轮询收到):计时器空闲/停止时归零;计时中不打断
  const prevRoundRef = useRef<number | null>(null);
  const { reset: timerReset } = timer;
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
        if (!stopped) applyState(st);
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
    if (busy) return;
    const nm = effNameRef.current;
    setBusy(true); setErr(null);
    const ev = lobbyEvent;
    const scr = generateScramble(ev as EventId);
    void createNetRoom(ev, scr, nm)
      .then((st) => { adopt(st, nm); void setRoomParam(st.code); })
      .catch((e: Error) => setErr(tr(netErrorMessage(e))))
      .finally(() => setBusy(false));
  }, [busy, lobbyEvent, adopt, setRoomParam]);

  const doJoin = useCallback((rawCode: string) => {
    const codeUp = rawCode.trim().toUpperCase();
    if (!codeUp || busy) return;
    const nm = effNameRef.current;
    setBusy(true); setErr(null);
    void joinNetRoom(codeUp, nm)
      .then((st) => { adopt(st, nm); setJoinCode(''); void setRoomParam(st.code); })
      .catch((e: Error) => setErr(tr(netErrorMessage(e))))
      .finally(() => setBusy(false));
  }, [busy, adopt, setRoomParam]);

  // 邀请链接 ?room=CODE 自动进房:先试 sessionStorage 同码恢复身份(刷新不重复加入),
  // 只有「刷新同一房间」(sessionStorage 有本房身份)才自动恢复、不重复加入;
  // 其余情况(别人点邀请链接首次进来)一律落加入页,把房间码预填好,昵称也从
  // localStorage 预填(可改),用户点「加入」才真进房 —— 不静默替对方加入,避免
  // 共享存储/别人的昵称把人稀里糊涂拉进房(如同一浏览器多窗口共享 localStorage)。
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
        // 非本房刷新 → 停在加入页:预读房间(项目 + 在场者)供确认,房间码预填。
        const st = await getNetRoom(codeUp);
        setPeek({
          event: st.event,
          names: sortedNetPlayers(st.players).filter(p => isNetOnline(p, st.now)).map(p => p.name),
        });
        setJoinCode(codeUp);
      } catch {
        setErr(tr({ zh: '房间不存在或已过期', en: 'Room not found or expired' }));
        setJoinCode(codeUp);
      }
    })();
  }, [roomParam, room, busy, applyState]);

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

  // ── 按压接线(pointer 在计时面板 + 空格全局)────────────────────
  const pressDown = useCallback(() => {
    if (phaseRef.current === 'running') { timer.onPressDown(); return; }
    if (!canSolveRef.current) {
      // 已交卷:全员完赛时按压 = 直接开下一轮(与连续计时的手感一致)
      if (canAdvanceRef.current) advance();
      return;
    }
    timer.onPressDown();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [advance]);
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

  useEffect(() => {
    if (!inRoom) return;
    const kd = (e: KeyboardEvent) => {
      if (shouldIgnoreTimerTarget(e.target)) return;
      if (phaseRef.current === 'running') { e.preventDefault(); pressDownRef.current(); return; }
      if (e.code === 'Space') {
        e.preventDefault();
        if (!e.repeat) pressDownRef.current();
      }
    };
    const ku = (e: KeyboardEvent) => {
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
  const copyLink = useCallback(() => {
    const r = roomRef.current;
    if (!r) return;
    const u = new URL(window.location.href);
    u.searchParams.set('players', 'net');
    u.searchParams.set('room', r.code);
    try { void navigator.clipboard.writeText(u.toString()); } catch { /* ignore */ }
    setLinkCopied(true);
    if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
    copyTimerRef.current = window.setTimeout(() => setLinkCopied(false), 1200);
  }, []);

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

  const colorClass = useMemo(() => {
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
  }, [timer.phase, timer.inspectionDisplayMs, inspectionLimit, myResult, myPenalty]);

  const digitsText = useMemo(() => {
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
  }, [timer.phase, timer.inspectionDisplayMs, timer.displayMs, inspectionLimit, myResult, myPenalty, settings.hideTime, settings.precision, settings.runningPrecision]);

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
              <WcaEventSelector
                availableEvents={NET_SELECTOR_EVENTS}
                isZh={isZh}
                selectedEvent={netEventToSelectorId(myEvent)}
                onSelect={changeEvent}
                onlyAvailable
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
      </div>
      <div className="shell-topbar-right">
        {room && (
          <>
            <button
              type="button"
              className="tb-btn"
              onClick={() => setShowStats(true)}
              title={tr({ zh: '战绩', en: 'Results' })}
              aria-label={tr({ zh: '战绩', en: 'Results' })}
            >
              <BarChart3 size={14} />
            </button>
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

  if (!room) {
    // 邀请链接进来(URL 带 room=)→ 加入模式:聚焦「加入这个房」,不喧宾夺主放创建。
    const inviteCode = roomParam ? roomParam.trim().toUpperCase() : null;
    return (
      <div className="timer-shell net-shell">
        {topbar}
        {/* shell-main 承接大厅 —— timer-shell 桌面端是命名区域 grid,大厅直接做
            它的子元素会落进隐式格被挤出视口(同 net-players 的处理)。 */}
        <div className="shell-main">
        <div className="net-lobby">
          {inviteCode ? (
            err && !peek ? (
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
                  onClick={() => { setPeek(null); setErr(null); void setRoomParam(null); }}
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
            /* ───── 加入模式(有人邀请你)───── */
            <>
              <h2 className="net-lobby-title">
                <Swords size={20} />
                {tr({ zh: '加入房间', en: 'Join room' })}
                <span className="net-lobby-code">{inviteCode}</span>
              </h2>
              {peek ? (
                <p className="net-lobby-hint">
                  {peek.names.length > 0
                    ? tr({
                        zh: `${eventDisplayName(netEventToSelectorId(peek.event), true)} · 房内:${peek.names.join('、')}`,
                        en: `${eventDisplayName(netEventToSelectorId(peek.event), false)} · in room: ${peek.names.join(', ')}`,
                      })
                    : tr({
                        zh: `${eventDisplayName(netEventToSelectorId(peek.event), true)} · 暂时只有你`,
                        en: `${eventDisplayName(netEventToSelectorId(peek.event), false)} · you're the first here`,
                      })}
                </p>
              ) : !err ? (
                <p className="net-lobby-hint">{tr({ zh: '正在读取房间…', en: 'Loading room…' })}</p>
              ) : null}

              <label className="net-field">
                <span className="net-field-label">{tr({ zh: '你的昵称', en: 'Your nickname' })}</span>
                <input
                  className="net-input"
                  data-no-timer
                  value={name}
                  maxLength={24}
                  placeholder={authUser?.name || tr({ zh: '你的名字', en: 'Your name' })}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && peek) doJoin(inviteCode); }}
                />
              </label>

              <button
                type="button"
                className="net-btn net-btn-primary net-btn-lg"
                onClick={() => doJoin(inviteCode)}
                disabled={busy || !peek}
              >
                {tr({ zh: '加入房间', en: 'Join room' })}
              </button>

              <button
                type="button"
                className="net-btn is-ghost net-lobby-switch"
                onClick={() => { setPeek(null); setErr(null); void setRoomParam(null); }}
              >
                {tr({ zh: '创建自己的房间', en: 'Create my own room instead' })}
              </button>

              {err && <div className="net-err">{err}</div>}
            </>
            )
          ) : (
            /* ───── 创建模式(直接进来)───── */
            <>
              <h2 className="net-lobby-title">
                <Swords size={20} />
                {tr({ zh: '联机对战', en: 'Online battle' })}
              </h2>
              <p className="net-lobby-hint">
                {tr({
                  zh: '创建房间,把邀请链接发给朋友;每人用自己的设备计时,同一条打乱实时比拼,任何人都能开下一轮。',
                  en: 'Create a room and share the invite link. Everyone times on their own device with the same scramble, results sync live, and anyone can start the next round.',
                })}
              </p>

              <label className="net-field">
                <span className="net-field-label">{tr({ zh: '昵称', en: 'Nickname' })}</span>
                <input
                  className="net-input"
                  data-no-timer
                  value={name}
                  maxLength={24}
                  placeholder={authUser?.name || tr({ zh: '你的名字', en: 'Your name' })}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>

              <div className="net-field">
                <span className="net-field-label">{tr({ zh: '项目', en: 'Event' })}</span>
                <WcaEventSelector
                  availableEvents={NET_SELECTOR_EVENTS}
                  isZh={isZh}
                  selectedEvent={netEventToSelectorId(lobbyEvent)}
                  onSelect={(id) => setLobbyEvent(selectorIdToNetEvent(id))}
                  onlyAvailable
                />
              </div>

              <button type="button" className="net-btn net-btn-primary net-btn-lg" onClick={doCreate} disabled={busy}>
                {tr({ zh: '创建房间', en: 'Create room' })}
              </button>

              <div className="net-lobby-or">{tr({ zh: '有房间码?', en: 'Have a code?' })}</div>

              <div className="net-join-row">
                <input
                  className="net-input net-input-code"
                  data-no-timer
                  value={joinCode}
                  maxLength={12}
                  placeholder={tr({ zh: '房间码', en: 'Room code' })}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => { if (e.key === 'Enter') doJoin(joinCode); }}
                  aria-label={tr({ zh: '房间码', en: 'Room code' })}
                />
                <button
                  type="button"
                  className="net-btn"
                  onClick={() => doJoin(joinCode)}
                  disabled={busy || !joinCode.trim()}
                >
                  {tr({ zh: '加入', en: 'Join' })}
                </button>
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
  const winners = complete ? roundWinners(curResults, room.players) : [];
  const waiting = pendingCount(room);
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
              <span className="net-p-name" title={p.name}>
                {p.name}
                {mine && <span className="net-p-me">{tr({ zh: '(我)', en: ' (me)' })}</span>}
              </span>
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
                    colors={settings.colors}
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
              {complete ? (
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
          {!myResult && timer.phase === 'idle' && players.length < 2 && (
            <div className="net-substate net-substate-hint">
              {tr({ zh: '把房间码或邀请链接发给朋友,等 TA 加入', en: 'Share the room code or invite link and wait for others' })}
            </div>
          )}
          {err && <div className="net-err" data-no-timer>{err}</div>}
        </TimingSurface>
      </div>

      {showStats && (
        <NetStatsPanel
          room={room}
          pid={pid}
          isZh={isZh}
          precision={settings.precision}
          colors={settings.colors}
          onClose={() => setShowStats(false)}
        />
      )}
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
  colors: React.ComponentProps<typeof CubePreview>['colors'];
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

function NetStatsPanel({ room, pid, isZh, precision, colors, onClose }: NetStatsPanelProps) {
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
                      <span className="net-st-nametext" title={p.name}>{p.name}</span>
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
                          <CubePreview event={ev as EventId} scramble={scr} height="52px" colors={colors} visualization="2D" />
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

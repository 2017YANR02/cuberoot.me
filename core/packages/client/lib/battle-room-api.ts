// /timer 联机对战「房间」客户端 API(对应 server/routes/battle_rooms.ts)。
// 房间持有当前轮「各项目的打乱」+ 玩家实时状态/所选项目 + 每轮成绩;实时性 = 1s 轮询 GET(no-store)。
// 项目模型:每人可选自己的项目(默认 = 建房项目),同项目玩家共享一条打乱(公平),不同项目各一条。
import { apiUrl } from './api-base';

export type NetPhase = 'idle' | 'ready' | 'inspecting' | 'solving' | 'done';
export type NetPenalty = 'ok' | '+2' | 'dnf';

export interface NetPlayerEntry {
  name: string;
  /** WCA ID(登录用户 / 选了 WCA 选手时有;纯昵称访客为空)。 */
  wcaId?: string;
  /** 国家 iso2(有则玩家条显国旗)。 */
  iso2?: string;
  /** 加入时刻(服务器毫秒)— 玩家条按此排序,顺序稳定。 */
  joined: number;
  /** 最近一次心跳(服务器毫秒)— 离线判定。 */
  seen: number;
  /** 实时状态;solving/inspecting 配合 at 可本地推算滚动读数。 */
  ph: NetPhase;
  /** ph 进入时刻(服务器毫秒)。 */
  at: number;
  /** 该玩家所选项目(timer EventId);缺省回落房间默认项目。 */
  event?: string;
}

/** 加入房间的身份:登录用户 = WCA 姓名+ID;访客 = 选中的 WCA 选手,或纯昵称。 */
export interface NetIdentity {
  name: string;
  wcaId?: string;
  iso2?: string;
}

export interface NetResult { t: number; p: NetPenalty }

/** 已结束一轮的战绩历史条目(服务端在开下一轮时结算写入)。 */
export interface NetRoundHistory {
  round: number;
  /** 该轮各项目的打乱 {event:scramble}(玩家按当轮 playerEvents 里的自己项目取用)。 */
  scrambles: Record<string, string>;
  /** 该轮各玩家所选项目快照(玩家可能中途改项目,历史按当轮记)。 */
  playerEvents: Record<string, string>;
  results: Record<string, NetResult>;
  /** 该轮各项目组的最快有效成绩者(可并列;全 DNF/无成绩为空)。 */
  winners: string[];
}

/** 房间状态(所有端点统一返回,客户端一把同步)。 */
export interface NetRoomState {
  code: string;
  /** 房间默认项目(timer EventId '333' '222' 'mega' …)= 新加入者默认。 */
  event: string;
  round: number;
  /** 当前轮各项目打乱 {event:scramble};玩家取自己项目那条,缺则 lazy 生成并回填。 */
  scrambles: Record<string, string>;
  players: Record<string, NetPlayerEntry>;
  /** 当前轮成绩 {round:{pid:{t,p}}} */
  results: Record<string, Record<string, NetResult>>;
  /** 已结束各轮战绩(最近 50 轮,旧→新);single/ao5/moX + 战绩面板据此算。 */
  history: NetRoundHistory[];
  scores: Record<string, number>;
  /** 房主 pid(建房者;可转让/踢人/改房设。房主离场后服务端读时回落最早加入者)。 */
  admin: string;
  /** 房设:是否要求全员同时起表(房主开关)。 */
  syncStart: boolean;
  /** 本轮同时起表时刻(服务器毫秒);未进入倒计时为 null。 */
  startAt: number | null;
  /** 服务器当前毫秒 — 时钟偏移估计用 */
  now: number;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(apiUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const msg = await res.json().catch(() => ({}));
    throw new Error((msg as { error?: string }).error || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

/** 建房(建房者即首位玩家,项目=建房项目)。scramble = 本机为第 1 轮该项目生成的打乱。 */
export function createNetRoom(event: string, scramble: string, id: NetIdentity): Promise<NetRoomState & { playerId: string }> {
  return postJson('/v1/battle/rooms', { event, scramble, name: id.name, wcaId: id.wcaId, iso2: id.iso2 });
}

/** 加入房间(满员/不存在/重名 → 抛错)。默认项目 = 房间项目。 */
export function joinNetRoom(code: string, id: NetIdentity): Promise<NetRoomState & { playerId: string }> {
  return postJson(`/v1/battle/rooms/${code}/join`, { name: id.name, wcaId: id.wcaId, iso2: id.iso2 });
}

/** 轮询房间状态;带 pid 顺手刷新在线心跳。房间不存在 → 抛。 */
export async function getNetRoom(code: string, pid?: string): Promise<NetRoomState> {
  const res = await fetch(apiUrl(`/v1/battle/rooms/${code}${pid ? `?pid=${pid}` : ''}`));
  if (!res.ok) {
    const msg = await res.json().catch(() => ({}));
    throw new Error((msg as { error?: string }).error || `HTTP ${res.status}`);
  }
  return res.json();
}

/**
 * 上报实时状态(准备/开始观察/开始计时/回到空闲),返回最新房间状态。
 * ph='ready' 且房间开了「同时开始」时,最后一个准备的人这一跳会带回 startAt(倒计时起点)。
 */
export function postNetStatus(
  code: string, pid: string, ph: 'idle' | 'ready' | 'inspecting' | 'solving',
): Promise<NetRoomState> {
  return postJson(`/v1/battle/rooms/${code}/status`, { pid, ph });
}

/** 房主改房设:是否要求全员同时起表。非房主 → 抛 'not admin'。 */
export function postNetSyncStart(code: string, pid: string, syncStart: boolean): Promise<NetRoomState> {
  return postJson(`/v1/battle/rooms/${code}/settings`, { pid, syncStart });
}

/** 房主把房主身份转让给房里另一位玩家。 */
export function postNetAdmin(code: string, pid: string, target: string): Promise<NetRoomState> {
  return postJson(`/v1/battle/rooms/${code}/admin`, { pid, target });
}

/** 房主把某位玩家移出房间(不能踢自己)。 */
export function postNetKick(code: string, pid: string, target: string): Promise<NetRoomState> {
  return postJson(`/v1/battle/rooms/${code}/kick`, { pid, target });
}

/** 改自己所选项目 + 顺带 lazy 填该项目当前轮打乱(已有则沿用)。返回新房间状态。 */
export function postNetEvent(code: string, pid: string, event: string, scramble: string): Promise<NetRoomState> {
  return postJson(`/v1/battle/rooms/${code}/event`, { pid, event, scramble });
}

/** lazy 填某项目当前轮打乱(set-if-absent,同项目玩家共享)。返回含该项目打乱的最新状态。 */
export function ensureNetScramble(code: string, event: string, scramble: string): Promise<NetRoomState> {
  return postJson(`/v1/battle/rooms/${code}/scramble`, { event, scramble });
}

/** 交本轮成绩(重复交 = 改罚时)。轮次已被推进 → 返回 {advanced,...新状态}。 */
export function postNetResult(
  code: string, pid: string, round: number, t: number, p: NetPenalty,
): Promise<NetRoomState & { advanced?: boolean }> {
  return postJson(`/v1/battle/rooms/${code}/result`, { pid, round, t, p });
}

/** 开下一轮(CAS,只第一个成功;其余幂等拿到已推进的状态)。scramble = 本机为自己项目生成的新打乱。 */
export function nextNetRound(code: string, pid: string, round: number, scramble: string): Promise<NetRoomState> {
  return postJson(`/v1/battle/rooms/${code}/next`, { pid, round, scramble });
}

/** 离开房间(房间空了服务端即删)。 */
export function leaveNetRoom(code: string, pid: string): Promise<void> {
  return postJson<{ ok: true }>(`/v1/battle/rooms/${code}/leave`, { pid }).then(() => undefined);
}

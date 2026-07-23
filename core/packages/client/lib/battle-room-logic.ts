// /timer 联机对战 — 纯逻辑层(不碰 React/网络,tests/battle_room_logic.test.ts 直测)。
// 胜负判定、在线判定、时钟偏移估计、玩家排序、每人 single/ao5/moX、可开房项目表都在这。
import type { NetPlayerEntry, NetResult, NetRoomState } from './battle-room-api';

/** 心跳超过这个毫秒数视为离线(轮询 1s 一跳,给足网络抖动余量)。 */
export const OFFLINE_MS = 15_000;

/**
 * 把网络/后端错误映射成给用户看的双语文案(调用方 tr() 落地)。
 * 裸的 `HTTP 404`(后端未挂该路由,响应无 error 字段 → api 层回退到状态码)对用户毫无意义,
 * 这里统一翻成人话;已知业务错误(room not found / full)给对应措辞。
 */
export function netErrorMessage(e: unknown): { zh: string; en: string } {
  const msg = e instanceof Error ? e.message : String(e ?? '');
  if (msg === 'room not found') return { zh: '房间不存在或已过期', en: 'Room not found or expired' };
  if (msg === 'room full') return { zh: '房间人数已满', en: 'Room is full' };
  if (/HTTP 404/.test(msg)) return { zh: '联机服务暂不可用,请稍后重试', en: 'Online service is unavailable — please try again later' };
  if (/HTTP 5\d\d/.test(msg)) return { zh: '服务器开小差了,请稍后重试', en: 'Server error — please try again later' };
  if (/failed to fetch|networkerror|load failed/i.test(msg)) return { zh: '网络连接失败,请检查网络', en: 'Network error — check your connection' };
  return { zh: msg || '出错了,请重试', en: msg || 'Something went wrong — please retry' };
}

/** 有效成绩毫秒:dnf → Infinity,+2 → t+2000。 */
export function effectiveNetMs(r: NetResult): number {
  if (r.p === 'dnf') return Infinity;
  return r.p === '+2' ? r.t + 2000 : r.t;
}

/**
 * 一轮的获胜者 pid 列表(按「同项目分组」,各组最快有效成绩者,可并列;全 DNF/无成绩 → 空)。
 * 与服务端 next 结算同口径:只数仍在房间里的玩家,不同项目各评各的胜者。
 * 玩家 event 缺省(旧行/单项目房)则全归一组 → 退化为「全房最快」。
 */
export function roundWinners(
  results: Record<string, NetResult> | undefined,
  players: Record<string, NetPlayerEntry>,
): string[] {
  if (!results) return [];
  const entries = Object.entries(results).filter(([id]) => players[id]);
  if (entries.length === 0) return [];
  const byEvent: Record<string, Array<[string, NetResult]>> = {};
  for (const [id, r] of entries) {
    const ev = players[id]?.event ?? '';
    (byEvent[ev] ??= []).push([id, r]);
  }
  const winners: string[] = [];
  for (const grp of Object.values(byEvent)) {
    const best = Math.min(...grp.map(([, r]) => effectiveNetMs(r)));
    if (!Number.isFinite(best)) continue;
    for (const [id, r] of grp) if (effectiveNetMs(r) === best) winners.push(id);
  }
  return winners;
}

/** 某玩家当前所选项目(缺省回落房间默认项目)。 */
export function playerEventOf(state: NetRoomState, pid: string): string {
  return state.players[pid]?.event || state.event;
}

/** 某玩家当前轮该用的打乱:scrambles[自己项目];尚未生成则 null(调用方 lazy 生成回填)。 */
export function myScramble(state: NetRoomState, pid: string): string | null {
  return state.scrambles?.[playerEventOf(state, pid)] ?? null;
}

/** 玩家按加入顺序排序(顺序稳定,自己不置顶 — 全房一致的排布)。 */
export function sortedNetPlayers(players: Record<string, NetPlayerEntry>): Array<{ id: string } & NetPlayerEntry> {
  return Object.entries(players)
    .map(([id, p]) => ({ id, ...p }))
    .sort((a, b) => a.joined - b.joined || a.id.localeCompare(b.id));
}

/** 在线判定:seen 距服务器"现在"不超过 OFFLINE_MS。 */
export function isNetOnline(p: NetPlayerEntry, serverNow: number): boolean {
  return serverNow - p.seen <= OFFLINE_MS;
}

/**
 * 时钟偏移(服务器时钟 - 本机时钟)的 EMA 估计:每次轮询响应带 now,融合进旧值。
 * 首个样本直接采用;之后 0.2 权重平滑,吸掉单次网络延迟毛刺。
 */
export function blendClockOffset(prev: number | null, serverNow: number, clientNow: number): number {
  const sample = serverNow - clientNow;
  if (prev === null) return sample;
  return prev + (sample - prev) * 0.2;
}

/**
 * 本轮是否「全员完赛」:所有在线玩家都交了成绩(至少 2 人在线才谈完赛;
 * 离线者不阻塞 — AFK 的人不该卡住全房)。
 */
export function isRoundComplete(state: NetRoomState): boolean {
  const online = sortedNetPlayers(state.players).filter(p => isNetOnline(p, state.now));
  if (online.length < 2) return false;
  const res = state.results[String(state.round)] ?? {};
  return online.every(p => !!res[p.id]);
}

/** 还没交本轮成绩的在线玩家数(等待提示用)。 */
export function pendingCount(state: NetRoomState): number {
  const online = sortedNetPlayers(state.players).filter(p => isNetOnline(p, state.now));
  const res = state.results[String(state.round)] ?? {};
  return online.filter(p => !res[p.id]).length;
}

/**
 * 某玩家按轮次顺序(旧→新)的成绩序列:历史各轮 + 当前轮(若已交)。
 * single/ao5/moX 全从这条时间线算。history 已是 chronological,当前轮追加末尾。
 */
export function playerTimeline(state: NetRoomState, pid: string): NetResult[] {
  const out: NetResult[] = [];
  for (const h of state.history ?? []) {
    const r = h.results[pid];
    if (r) out.push(r);
  }
  const cur = state.results[String(state.round)]?.[pid];
  if (cur) out.push(cur);
  return out;
}

/** 每人聚合统计。single = 最快有效;ao5 = 末 5 去掉最好最差取中 3(≥2 DNF 即 DNF);
 *  mean = 全部 X 次的平均(任一 DNF 即整体 DNF)。无成绩项返回 null,DNF 返回 Infinity。 */
export interface NetStats {
  count: number;
  single: number | null;
  ao5: number | null;
  mean: number | null;
}
export function playerStats(results: NetResult[]): NetStats {
  const count = results.length;
  const eff = results.map(effectiveNetMs);

  const valid = eff.filter(Number.isFinite);
  const single = valid.length ? Math.min(...valid) : null;

  // moX:X 次全平均;任一 DNF → 整体 DNF(WCA mean 口径)
  let mean: number | null = null;
  if (count > 0) {
    mean = eff.some(t => !Number.isFinite(t)) ? Infinity : Math.round(eff.reduce((a, b) => a + b, 0) / count);
  }

  // ao5:末 5 次,排序去掉最好最差,取中 3;≥2 DNF 即 DNF;不足 5 次为 null
  let ao5: number | null = null;
  if (count >= 5) {
    const last5 = eff.slice(-5).sort((a, b) => a - b);
    const dnf = last5.filter(t => !Number.isFinite(t)).length;
    ao5 = dnf >= 2 ? Infinity : Math.round((last5[1] + last5[2] + last5[3]) / 3);
  }

  return { count, single, ao5, mean };
}

/**
 * 战绩面板的轮次列表(新→旧):当前进行中的一轮置顶(含实时成绩),其后是已结束各轮。
 * 每条含 {round, scrambles(各项目打乱), playerEvents(各人当轮项目), results, winners, live}。
 * live=当前轮尚可变。玩家的打乱/打乱图 = scrambles[playerEvents[pid]]。
 */
export interface NetRoundView {
  round: number;
  scrambles: Record<string, string>;
  playerEvents: Record<string, string>;
  results: Record<string, NetResult>;
  winners: string[];
  live: boolean;
}
export function roundViews(state: NetRoomState): NetRoundView[] {
  const curResults = state.results[String(state.round)] ?? {};
  const curPlayerEvents: Record<string, string> = {};
  for (const [id, p] of Object.entries(state.players)) curPlayerEvents[id] = p.event || state.event;
  const out: NetRoundView[] = [{
    round: state.round,
    scrambles: state.scrambles ?? {},
    playerEvents: curPlayerEvents,
    results: curResults,
    winners: roundWinners(curResults, state.players),
    live: true,
  }];
  for (const h of [...(state.history ?? [])].reverse()) {
    out.push({
      round: h.round, scrambles: h.scrambles ?? {}, playerEvents: h.playerEvents ?? {},
      results: h.results, winners: h.winners, live: false,
    });
  }
  return out;
}

/**
 * 联机房间可选项目(timer EventId):有真随机状态/随机步生成器且适合对战计时的集合。
 * 与 WcaEventSelector 的显示 id 映射见 NET_EVENT_TO_SELECTOR。
 */
export const NET_EVENTS: readonly string[] = [
  '333', '222', '444', '555', '666', '777', '333oh', '333bld',
  'mega', 'pyra', 'clock', 'skewb', 'sq1',
];

/** timer EventId → WcaEventSelector 的 WCA id(与 SoloView 的映射同口径)。 */
export function netEventToSelectorId(ev: string): string {
  if (ev === '333bld') return '333bf';
  if (ev === 'mega') return 'minx';
  if (ev === 'pyra') return 'pyram';
  return ev;
}

/** 逆映射:WcaEventSelector id → timer EventId。 */
export function selectorIdToNetEvent(id: string): string {
  if (id === '333bf') return '333bld';
  if (id === 'minx') return 'mega';
  if (id === 'pyram') return 'pyra';
  return id;
}

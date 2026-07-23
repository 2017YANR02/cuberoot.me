// 公式训练器「协同房间」客户端 API(对应 server/routes/trainer_rooms.ts)。
// 房间协调「谁做哪个 case」——领取返回 caseKey,打乱串仍由客户端本地按 case 生成。
import { apiUrl } from './api-base';

export type RoomOrder = 'seq' | 'shuffle';

export interface RoomInfo {
  code: string;
  puzzle: string;
  set: string;
  order: RoomOrder;
  round: number;
  total: number;
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

/**
 * 建房:keys = 全集(池)。start(默认 0)= 建房者已单机刷过的前缀数,房间从第 start+1 格派发,
 * 前 start 格记为已完成、永不派发(队友接着分工);total 仍是全集大小。返回房间码等 + claimed(=start)。
 */
export async function createRoom(
  puzzle: string, set: string, order: RoomOrder, keys: string[], start = 0,
): Promise<RoomInfo & { claimed?: number }> {
  return postJson<RoomInfo & { claimed?: number }>('/v1/trainer/rooms', { puzzle, set, order, keys, start });
}

/** 房间状态(轮询合并进度 / 探知是否已开下一轮)。房间不存在 → 抛。 */
export async function getRoom(code: string): Promise<RoomInfo & { claimed: number; done: boolean }> {
  const res = await fetch(apiUrl(`/v1/trainer/rooms/${code}`));
  if (!res.ok) {
    const msg = await res.json().catch(() => ({}));
    throw new Error((msg as { error?: string }).error || `HTTP ${res.status}`);
  }
  return res.json();
}

/** 一批领取的一格。 */
export interface ClaimedCase { caseKey: string; index: number }
/** 批量领取结果:一批 case / 本轮领完 / 本机落后需重同步。 */
export type ClaimBatchResult =
  | { kind: 'cases'; cases: ClaimedCase[]; round: number; total: number }
  | { kind: 'done'; round: number; total: number }
  | { kind: 'advanced'; round: number; total: number };

/**
 * 一次原子领取最多 count 题(三条一屏一次占三格,省一次网络往返 + 一次限流额度)。
 * 兼容旧后端:旧 `/claim` 忽略 count 只回单格 `{caseKey,index}` → 归一成 1 个 case,
 * 前端照常工作(仅领到 1 条,后端升级后即领满 count)。
 */
export async function claimRoomBatch(code: string, round: number, count: number): Promise<ClaimBatchResult> {
  const r = await postJson<
    | { advanced: true; round: number; total: number }
    | { done: true; round: number; total: number }
    | { cases: ClaimedCase[]; round: number; total: number }
    | { caseKey: string; index: number; round: number; total: number } // 旧后端单格
  >(`/v1/trainer/rooms/${code}/claim`, { round, count });
  if ('advanced' in r) return { kind: 'advanced', round: r.round, total: r.total };
  if ('done' in r) return { kind: 'done', round: r.round, total: r.total };
  if ('cases' in r) return { kind: 'cases', cases: r.cases, round: r.round, total: r.total };
  return { kind: 'cases', cases: [{ caseKey: r.caseKey, index: r.index }], round: r.round, total: r.total };
}

/** 开下一轮(CAS,只第一个真正推进;其余读到已推进的轮)。 */
export async function nextRoundRoom(code: string, round: number): Promise<{ round: number; total: number }> {
  return postJson<{ round: number; total: number }>(`/v1/trainer/rooms/${code}/next-round`, { round });
}

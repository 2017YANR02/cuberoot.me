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

/** 领取结果三态:拿到一题 / 本轮领完(done)/ 本机落后需重同步到新一轮(advanced)。 */
export type ClaimResult =
  | { kind: 'case'; caseKey: string; index: number; round: number; total: number }
  | { kind: 'done'; round: number; total: number }
  | { kind: 'advanced'; round: number; total: number };

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

/** 建房:keys 应为规范序全集(池)。返回房间码等。 */
export async function createRoom(
  puzzle: string, set: string, order: RoomOrder, keys: string[],
): Promise<RoomInfo> {
  return postJson<RoomInfo>('/v1/trainer/rooms', { puzzle, set, order, keys });
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

/** 原子领取下一题(带本机所在轮次)。 */
export async function claimRoom(code: string, round: number): Promise<ClaimResult> {
  const r = await postJson<
    | { advanced: true; round: number; total: number }
    | { done: true; round: number; total: number }
    | { caseKey: string; index: number; round: number; total: number }
  >(`/v1/trainer/rooms/${code}/claim`, { round });
  if ('advanced' in r) return { kind: 'advanced', round: r.round, total: r.total };
  if ('done' in r) return { kind: 'done', round: r.round, total: r.total };
  return { kind: 'case', caseKey: r.caseKey, index: r.index, round: r.round, total: r.total };
}

/** 开下一轮(CAS,只第一个真正推进;其余读到已推进的轮)。 */
export async function nextRoundRoom(code: string, round: number): Promise<{ round: number; total: number }> {
  return postJson<{ round: number; total: number }>(`/v1/trainer/rooms/${code}/next-round`, { round });
}

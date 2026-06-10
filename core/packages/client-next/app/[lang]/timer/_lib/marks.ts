/**
 * Scramble marks client — 公开「打卡」:登录用户给做过的 WCA 真实打乱做标记,
 * 所有人可见(打乱条下「N 人做过」+ /timer/marks 最近标记 feed)。
 * 打乱用六元自然键 (ci,e,r,g,x,n) 标识,与 WcaScrambleMeta 短键对齐。
 * 写操作走 Bearer JWT(lib/admin-api authHeaders);读公开免登录。
 */
import { apiUrl } from '@/lib/api-base';
import { authHeaders, handleApi } from '@/lib/admin-api';
import type { WcaScrambleMeta } from './scramble/wca_pool';

const ENDPOINT = '/v1/scramble-marks';

export type ScrambleKey = Pick<WcaScrambleMeta, 'ci' | 'e' | 'r' | 'g' | 'n' | 'x'>;

export interface ScrambleMark {
  wcaId: string;
  name: string;
  country: string;
  timeCs: number | null;
  createdAt: number; // epoch 秒
}

export interface RecentMark extends ScrambleMark, WcaScrambleMeta {
  id: number;
  /** 打乱原文(镜像 join;极新比赛可能为 null) */
  scramble: string | null;
}

/** 稳定字符串键(SoloView 缓存当前打乱的标记列表用)。 */
export function markKey(k: ScrambleKey): string {
  return `${k.ci}|${k.e}|${k.r}|${k.g}|${k.x}|${k.n}`;
}

function keyQs(k: ScrambleKey): string {
  return new URLSearchParams({
    ci: k.ci, e: k.e, r: k.r, g: k.g, x: String(k.x), n: String(k.n),
  }).toString();
}

/** 某条打乱的公开标记列表(新→旧,服务端截 100)。 */
export async function fetchMarks(k: ScrambleKey): Promise<{ count: number; marks: ScrambleMark[] }> {
  const res = await fetch(apiUrl(`${ENDPOINT}?${keyQs(k)}`));
  return handleApi<{ count: number; marks: ScrambleMark[] }>(res);
}

/** 标记(upsert;timeCs = 本次在该打乱上的成绩,country 纯装饰旗帜)。 */
export async function addMark(k: ScrambleKey, timeCs: number | null, country: string): Promise<void> {
  const res = await fetch(apiUrl(ENDPOINT), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ ...k, timeCs, country }),
  });
  await handleApi<{ ok: boolean }>(res);
}

/** 取消自己的标记。 */
export async function removeMark(k: ScrambleKey): Promise<void> {
  const res = await fetch(apiUrl(`${ENDPOINT}?${keyQs(k)}`), {
    method: 'DELETE',
    headers: authHeaders(false),
  });
  await handleApi<{ ok: boolean }>(res);
}

/** 最近标记 feed(/timer/marks)。keyset 分页:before = 上页最后一条 id。 */
export async function fetchRecentMarks(opts: {
  event?: string; wcaId?: string; before?: number; limit?: number;
} = {}): Promise<RecentMark[]> {
  const qs = new URLSearchParams();
  if (opts.event) qs.set('event', opts.event);
  if (opts.wcaId) qs.set('wcaId', opts.wcaId);
  if (opts.before) qs.set('before', String(opts.before));
  if (opts.limit) qs.set('limit', String(opts.limit));
  const res = await fetch(apiUrl(`${ENDPOINT}/recent${qs.size > 0 ? `?${qs}` : ''}`));
  const data = await handleApi<{ marks: RecentMark[] }>(res);
  return data.marks ?? [];
}

/**
 * Scramble marks client — 公开「打卡」:登录用户给做过的 WCA 真实打乱做标记,
 * 所有人可见(打乱条下「N 人做过」+ /timer/marks 最近标记 feed)。
 * 打乱用六元自然键 (ci,e,r,g,x,n) 标识,与 WcaScrambleMeta 短键对齐。
 * 写操作走 Bearer JWT(lib/admin-api authHeaders);读公开免登录。
 */
import { apiUrl } from '@/lib/api-base';
import { authHeaders, handleApi } from '@/lib/admin-api';
import { isWcaIdFormat } from '@cuberoot/shared/account';
import {
  fetchTimerWcaScrambleMarks,
  postTimerWcaScrambleMark,
  timerWcaScrambleMarkKeyIdentity,
  updateTimerWcaScrambleMarkIfExists,
  type TimerWcaScrambleMark,
  type TimerWcaScrambleMarkKey,
  type TimerWcaScrambleMarksHttp,
} from '@cuberoot/shared/timer';
import type { WcaScrambleMeta } from './scramble/wca_pool';

const ENDPOINT = '/v1/scramble-marks';

export type ScrambleKey = TimerWcaScrambleMarkKey;
export type ScrambleMark = TimerWcaScrambleMark;

export interface RecentMark extends ScrambleMark, WcaScrambleMeta {
  id: number;
  /** 打乱原文(镜像 join;极新比赛可能为 null) */
  scramble: string | null;
}

/** 稳定字符串键(SoloView 缓存当前打乱的标记列表用)。 */
export function markKey(k: ScrambleKey): string {
  return timerWcaScrambleMarkKeyIdentity(k);
}

/** Only real WCA identities have a `/wca/persons/*` destination. */
export function markPersonHref(languagePrefix: string, wcaId: string): string | undefined {
  return isWcaIdFormat(wcaId)
    ? `${languagePrefix}/wca/persons/${encodeURIComponent(wcaId)}`
    : undefined;
}

function marksHttp(write = false): TimerWcaScrambleMarksHttp {
  const authorization = write ? authHeaders(false).Authorization : undefined;
  return {
    apiBase: apiUrl(''),
    fetcher: (input, init) => fetch(input, init),
    token: authorization?.slice('Bearer '.length),
  };
}

function keyQs(k: ScrambleKey): string {
  return new URLSearchParams({
    ci: k.ci, e: k.e, r: k.r, g: k.g, x: String(k.x), n: String(k.n),
  }).toString();
}

/** 某条打乱的公开标记列表(新→旧,服务端截 100)。 */
export async function fetchMarks(k: ScrambleKey): Promise<{ count: number; marks: ScrambleMark[] }> {
  return fetchTimerWcaScrambleMarks(k, marksHttp());
}

/** 标记(upsert;timeCs = 本次在该打乱上的成绩,country 纯装饰旗帜)。 */
export async function addMark(k: ScrambleKey, timeCs: number | null, country: string): Promise<void> {
  await postTimerWcaScrambleMark(k, { timeCs, country }, marksHttp(true));
}

/** Update the signed-in user's existing mark without creating a public record. */
export async function updateMarkIfExists(
  k: ScrambleKey,
  timeCs: number | null,
  country: string,
): Promise<boolean> {
  return updateTimerWcaScrambleMarkIfExists(k, { timeCs, country }, marksHttp(true));
}

/** 取消自己的标记(按自然键,timer 弹层用)。 */
export async function removeMark(k: ScrambleKey): Promise<void> {
  const res = await fetch(apiUrl(`${ENDPOINT}?${keyQs(k)}`), {
    method: 'DELETE',
    headers: authHeaders(false),
  });
  await handleApi<{ ok: boolean }>(res);
}

/** 按 id 删一条标记(feed 行内删除);本人删自己,管理员删任何人。 */
export async function deleteMarkById(id: number): Promise<void> {
  const res = await fetch(apiUrl(`${ENDPOINT}/${id}`), {
    method: 'DELETE',
    headers: authHeaders(false),
  });
  await handleApi<{ ok: boolean }>(res);
}

/** 最近标记 feed(/timer/marks)。keyset 分页:before = 上页最后一条 id;q 模糊搜。 */
export async function fetchRecentMarks(opts: {
  event?: string; wcaId?: string; q?: string; before?: number; limit?: number;
} = {}): Promise<RecentMark[]> {
  const qs = new URLSearchParams();
  if (opts.event) qs.set('event', opts.event);
  if (opts.wcaId) qs.set('wcaId', opts.wcaId);
  if (opts.q) qs.set('q', opts.q);
  if (opts.before) qs.set('before', String(opts.before));
  if (opts.limit) qs.set('limit', String(opts.limit));
  const res = await fetch(apiUrl(`${ENDPOINT}/recent${qs.size > 0 ? `?${qs}` : ''}`));
  const data = await handleApi<{ marks: RecentMark[] }>(res);
  return data.marks ?? [];
}

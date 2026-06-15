// 比赛关注客户端 API — 首页「报名」标签的「盯一下」。
// 身份从 Bearer JWT 服务端推导（authHeaders / handleApi 复用 lib/admin-api），不传 wca_id。
// server 实现见 routes/comp_follows.ts。
import { apiUrl } from '@/lib/api-base';
import { authHeaders, handleApi } from '@/lib/admin-api';

const ENDPOINT = '/v1/comp/follows';

/** 拉当前用户关注的 comp id 列表（未登录会 401，调用方先判断登录态）。 */
export async function fetchFollows(): Promise<string[]> {
  const r = await fetch(apiUrl(ENDPOINT), { headers: authHeaders(false) });
  const d = await handleApi<{ compIds?: string[] }>(r);
  return d.compIds ?? [];
}

/** 关注一场比赛。 */
export async function addFollow(compId: string): Promise<void> {
  const r = await fetch(apiUrl(`${ENDPOINT}/${encodeURIComponent(compId)}`), {
    method: 'PUT',
    headers: authHeaders(false),
  });
  await handleApi<{ ok: boolean }>(r);
}

/** 取消关注。 */
export async function removeFollow(compId: string): Promise<void> {
  const r = await fetch(apiUrl(`${ENDPOINT}/${encodeURIComponent(compId)}`), {
    method: 'DELETE',
    headers: authHeaders(false),
  });
  await handleApi<{ ok: boolean }>(r);
}

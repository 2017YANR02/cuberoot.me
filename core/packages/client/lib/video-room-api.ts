import { sessionFetch } from '@/lib/session-fetch';
// 视频通话的客户端 API(对应 server/routes/video_rooms.ts)。两种房共用:
//   /timer 联机对战房 —— 免登录,身份是对战房的 pid,服务端回库校验
//   /meet  会议室      —— **必须登录**,身份和显示名都由服务端从 session token 里取;
//                        这里只报会议码,报不了自己是谁
//
// 媒体面走自建 LiveKit(SFU):这里只负责换凭证,拿到 {url,token} 之后就交给 livekit-client
// 直连,本文件不参与任何媒体传输。对战状态仍走 battle-room-api 的 1s 轮询,两套互不干扰。
import { apiUrl } from './api-base';
import { getSessionToken } from './auth-store';

/**
 * 单路视频最大码率(bps)。1080p30 取 LiveKit h1080 预设的 3 Mbps。
 * **与 server/routes/video_rooms.ts 的 PER_STREAM_MBPS 同口径,改一处必须改两处** ——
 * 服务端按这个数守带宽预算,客户端真发得比它多就会超卖。
 */
export * from '@cuberoot/shared/video';
import { VideoDeniedError, isMeetCode, type VideoDenyReason, type VideoToken, createBattleVideoClient } from '@cuberoot/shared/video';
const battleVideoClient = createBattleVideoClient({ apiUrl, fetcher: (...args) => sessionFetch(...args) });
/**
 * 问一次站点视频配置。
 *
 * 失败返回 **null(不知道)** 而不是 `{enabled:false}`(本站没开)—— 这两件事的界面差得远:
 * 后者是终局页面「本站未启用视频」,没有重试也没有出路;而 core-api 重启时的一个 502 只是
 * 两秒钟的事。把二者混为一谈,等于让一次瞬时抖动把 /meet 变成一块写着「本站不做视频」的砖。
 * 调用方按 `cfg && !cfg.enabled` 判终局,null 一律当「先按能用走,真去签 token 时再报错」。
 */
export const getVideoConfig = battleVideoClient.getConfig;
export const getVideoToken = battleVideoClient.getToken;

/**
 * 换取会议室凭证。**必须登录**:身份与显示名全部由服务端从 token 里取,这里只报会议码 ——
 * 客户端报不了自己是谁,所以会议里不可能出现顶着别人名字的画面。
 * 拿到 token 意味着「已登录 + 码合法 + 房没满 + 有带宽」。
 */
export async function getMeetToken(code: string, signal?: AbortSignal): Promise<VideoToken> {
  return postToken('/v1/video/meet/token', { code }, true, {}, signal);
}

export async function getCompetitionVideoToken(registrationId: string): Promise<VideoToken> {
  return postToken('/v1/video/competition/token', { registrationId }, true);
}

/**
 * 分配一个当前未被活跃会议或待入会创建流程占用的四位数字码。
 * 由服务端分配，客户端本地随机无法看见其他活跃房间。
 */
export async function createMeetCode(): Promise<string> {
  const res = await sessionFetch(apiUrl('/v1/video/meet/code'), {
    method: 'POST',
    headers: { Authorization: `Bearer ${getSessionToken()}` },
  });
  if (!res.ok) return throwVideoDenied(res);
  const data = (await res.json()) as { code?: unknown };
  if (typeof data.code !== 'string' || !isMeetCode(data.code)) throw new VideoDeniedError('invalid');
  return data.code;
}

async function postToken(
  path: string,
  body: Record<string, string>,
  authed = false,
  extraHeaders: Record<string, string> = {},
  signal?: AbortSignal,
): Promise<VideoToken> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...extraHeaders };
  if (authed) headers.Authorization = `Bearer ${getSessionToken()}`;
  const deadline = AbortSignal.timeout(20_000);
  const res = await sessionFetch(apiUrl(path), {
    method: 'POST', headers, body: JSON.stringify(body),
    signal: signal ? AbortSignal.any([signal, deadline]) : deadline,
  });
  if (!res.ok) return throwVideoDenied(res);
  return res.json();
}

async function throwVideoDenied(res: Response): Promise<never> {
  if (res.status === 401) throw new VideoDeniedError('auth');
  const msg = (await res.json().catch(() => ({}))) as { error?: string };
  // 服务端的 400 文案是 'invalid code/id/name' 这种带细节的串,收敛成一个 reason。
  const raw = msg.error ?? '';
  const known: ReadonlySet<string> = new Set([
    'full', 'bandwidth', 'unavailable', 'not in room', 'changed', 'auth', 'cancelled', 'video not configured',
  ]);
  const reason: VideoDenyReason = raw.startsWith('invalid')
    ? 'invalid'
    : known.has(raw) ? raw as VideoDenyReason : 'unavailable';
  throw new VideoDeniedError(reason);
}

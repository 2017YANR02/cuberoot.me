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
export const VIDEO_MAX_BITRATE = 3_000_000;

/**
 * 屏幕共享的码率上限(bps)。**与 server 的 SCREEN_SHARE_MBPS 同口径,改一处必须改两处** ——
 * 屏幕共享是摄像头之外**额外**的一路,不在 n*(n-1) 那个模型里,两处不一致就是悄悄超发。
 */
export const SCREEN_SHARE_MAX_BITRATE = 1_500_000;

export interface VideoConfig {
  /** 站点是否配了 LiveKit。false 时客户端应完全隐藏视频入口,而不是点了才报错。 */
  enabled: boolean;
  /** 对战房上限(先有的字段,保持原义)。 */
  maxParticipants: number;
  /** 会议室上限。老服务端没有这个字段,故 optional —— 前后端不是同一次部署上线的。 */
  meetMaxParticipants?: number;
  maxBitrateMbps: number;
}

/** 必须与服务端 video_rooms.ts 的 MEET_CODE_RE 完全一致。 */
export const MEET_CODE_ALPHABET = '0123456789';
export const MEET_CODE_LEN = 4;

/**
 * 把用户手抄 / 粘贴进来的会议码归一:只留数字，整条邀请链接则读取 room 参数。
 */
export function normalizeMeetCode(raw: string): string {
  // 粘进来的多半是整条邀请链接,先把 ?room= 挖出来。
  const fromUrl = /[?&]room=([^&#\s]*)/i.exec(raw);
  if (fromUrl) return keepAlphabet(fromUrl[1]!);

  // 看着像链接、却没有 room= —— 直接判空，不能拿 URL 里的其他数字拼成会议码。
  if (/[:/?#]/.test(raw)) return '';

  return keepAlphabet(raw);
}

/** 只留数字(丢掉空格、连字符这些手抄进来的噪声),截到码长。 */
function keepAlphabet(raw: string): string {
  let out = '';
  for (const ch of raw) if (MEET_CODE_ALPHABET.includes(ch)) out += ch;
  return out.slice(0, MEET_CODE_LEN);
}

export function isMeetCode(s: string): boolean {
  return s.length === MEET_CODE_LEN && [...s].every((ch) => MEET_CODE_ALPHABET.includes(ch));
}

export interface VideoToken {
  /** LiveKit 服务器地址(wss://…),直接喂给 livekit-client 的 Room.connect。 */
  url: string;
  token: string;
  identity: string;
  room: string;
  maxParticipants: number;
  maxBitrateMbps: number;
}

/** 服务端拒发 token 的原因(客户端据此给出可操作的提示,而不是笼统的「失败」)。 */
export type VideoDenyReason =
  /** 该视频房已满(人数上限比对战房小)。 */
  | 'full'
  /** 全站视频带宽预算用尽 —— 不是你的问题,过会儿再试。 */
  | 'bandwidth'
  /** LiveKit 服务器连不上;此时连也白连,提前拦下。 */
  | 'unavailable'
  /** 该 pid 不在该房间(房间过期 / 被踢 / 伪造)。 */
  | 'not in room'
  /** 会议码不合法(手抄错了)。 */
  | 'invalid'
  /** 会议室要求登录。 */
  | 'auth'
  | 'video not configured';

export class VideoDeniedError extends Error {
  readonly reason: VideoDenyReason;
  constructor(reason: VideoDenyReason) {
    super(reason);
    this.name = 'VideoDeniedError';
    this.reason = reason;
  }
}

/**
 * 问一次站点视频配置。
 *
 * 失败返回 **null(不知道)** 而不是 `{enabled:false}`(本站没开)—— 这两件事的界面差得远:
 * 后者是终局页面「本站未启用视频」,没有重试也没有出路;而 core-api 重启时的一个 502 只是
 * 两秒钟的事。把二者混为一谈,等于让一次瞬时抖动把 /meet 变成一块写着「本站不做视频」的砖。
 * 调用方按 `cfg && !cfg.enabled` 判终局,null 一律当「先按能用走,真去签 token 时再报错」。
 */
export async function getVideoConfig(): Promise<VideoConfig | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(apiUrl('/v1/video/config'));
      // 4xx 是服务端明确答复「没有这个端点」,重试没有意义;5xx / 网络错误才值得再试一次。
      if (res.ok) return await res.json();
      if (res.status < 500) return null;
    } catch { /* 网络错误,下一轮重试 */ }
    if (attempt === 0) await new Promise((r) => setTimeout(r, 600));
  }
  return null;
}

/**
 * 换取 LiveKit 连接凭证。服务端会回库确认该 pid 确实在该对战房里,并过一遍带宽预算,
 * 所以这里拿到 token 就意味着「授权通过 + 有带宽」。被拒时抛 VideoDeniedError,
 * 调用方据 reason 给不同文案。
 */
export async function getVideoToken(code: string, pid: string): Promise<VideoToken> {
  return postToken('/v1/video/token', { code, pid });
}

/**
 * 换取会议室凭证。**必须登录**:身份与显示名全部由服务端从 token 里取,这里只报会议码 ——
 * 客户端报不了自己是谁,所以会议里不可能出现顶着别人名字的画面。
 * 拿到 token 意味着「已登录 + 码合法 + 房没满 + 有带宽」。
 */
export async function getMeetToken(code: string): Promise<VideoToken> {
  return postToken('/v1/video/meet/token', { code }, true);
}

/**
 * 分配一个当前未被活跃会议或待入会创建流程占用的四位数字码。
 * 由服务端分配，客户端本地随机无法看见其他活跃房间。
 */
export async function createMeetCode(): Promise<string> {
  const res = await fetch(apiUrl('/v1/video/meet/code'), {
    method: 'POST',
    headers: { Authorization: `Bearer ${getSessionToken()}` },
  });
  if (!res.ok) return throwVideoDenied(res);
  const data = (await res.json()) as { code?: unknown };
  if (typeof data.code !== 'string' || !isMeetCode(data.code)) throw new VideoDeniedError('invalid');
  return data.code;
}

async function postToken(path: string, body: Record<string, string>, authed = false): Promise<VideoToken> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authed) headers.Authorization = `Bearer ${getSessionToken()}`;
  const res = await fetch(apiUrl(path), { method: 'POST', headers, body: JSON.stringify(body) });
  if (!res.ok) return throwVideoDenied(res);
  return res.json();
}

async function throwVideoDenied(res: Response): Promise<never> {
  if (res.status === 401) throw new VideoDeniedError('auth');
  const msg = (await res.json().catch(() => ({}))) as { error?: string };
  // 服务端的 400 文案是 'invalid code/id/name' 这种带细节的串,收敛成一个 reason。
  const raw = msg.error ?? '';
  const reason: VideoDenyReason = raw.startsWith('invalid') ? 'invalid' : (raw as VideoDenyReason);
  throw new VideoDeniedError(reason || 'unavailable');
}

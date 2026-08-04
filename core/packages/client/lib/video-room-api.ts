// 视频通话的客户端 API(对应 server/routes/video_rooms.ts)。两种房共用:
//   /timer 联机对战房 —— 身份是对战房的 pid,服务端回库校验
//   /meet  会议室      —— 链接即凭证,身份是本机随机生成的一次性 id
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

/** 视频采集分辨率上限。宫格里的小窗会由 simulcast 自动降层,这里只定「最高能到多少」。 */
export const VIDEO_MAX_WIDTH = 1920;
export const VIDEO_MAX_HEIGHT = 1080;

export interface VideoConfig {
  /** 站点是否配了 LiveKit。false 时客户端应完全隐藏视频入口,而不是点了才报错。 */
  enabled: boolean;
  /** 对战房上限(先有的字段,保持原义)。 */
  maxParticipants: number;
  /** 会议室上限。老服务端没有这个字段,故 optional —— 前后端不是同一次部署上线的。 */
  meetMaxParticipants?: number;
  maxBitrateMbps: number;
}

/**
 * 会议码字母表:32 个字符,去掉了 0/1/I/O 这些照着念或抄会错的。
 * **必须与服务端 video_rooms.ts 的 MEET_CODE_RE 完全一致** —— 客户端生成、服务端校验,
 * 分叉的话每一次「新建会议」都会 400。守卫见 tests/meet-code-format.test.ts。
 */
export const MEET_CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

/** 9 位 × 32 字符 = 45 bit。会议室没有名单可查,链接就是凭证,熵是唯一的防线。 */
export const MEET_CODE_LEN = 9;

/** 从 32 字符表里取 n 个字符。32 整除 256,所以 `byte % 32` 是均匀的,不需要拒绝采样。 */
function randomFrom(alphabet: string, n: number): string {
  const bytes = new Uint8Array(n);
  crypto.getRandomValues(bytes);
  let out = '';
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out;
}

/** 新建一个会议码。用 crypto 而不是 Math.random —— 后者可预测,等于没有熵。 */
export function newMeetCode(): string {
  return randomFrom(MEET_CODE_ALPHABET, MEET_CODE_LEN);
}

/**
 * 把用户手抄 / 粘贴进来的会议码归一:大写,丢掉字母表以外的一切(空格、连字符、
 * 整条 URL 里的斜杠)。抄错成 0/O、1/I 的那两对不在这里纠 —— 猜错人家的房间比报错更糟。
 */
export function normalizeMeetCode(raw: string): string {
  // 粘进来的多半是整条邀请链接,先把 ?room= 挖出来。
  const fromUrl = /[?&]room=([^&#\s]*)/i.exec(raw);
  if (fromUrl) return keepAlphabet(fromUrl[1]!);

  // 看着像链接、却没有 room= —— 直接判空。硬过滤的话 "https://cuberoot.me/" 里的
  // H T T P S C U B E 全在字母表里,会拼出 HTTPSCUBE 这么个**合法**会议码,
  // 把人静默送进一个陌生人的房间。宁可什么都不给。
  if (/[:/?#]/.test(raw)) return '';

  return keepAlphabet(raw);
}

/** 只留字母表里的字符(丢掉空格、连字符这些手抄进来的噪声),截到码长。 */
function keepAlphabet(raw: string): string {
  let out = '';
  for (const ch of raw.toUpperCase()) if (MEET_CODE_ALPHABET.includes(ch)) out += ch;
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

/** 问一次站点视频配置。失败按「没开」处理 —— 视频是增强功能,不该拖累对战本身。 */
export async function getVideoConfig(): Promise<VideoConfig> {
  try {
    const res = await fetch(apiUrl('/v1/video/config'));
    if (!res.ok) return { enabled: false, maxParticipants: 0, maxBitrateMbps: 0 };
    return await res.json();
  } catch {
    return { enabled: false, maxParticipants: 0, maxBitrateMbps: 0 };
  }
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

async function postToken(path: string, body: Record<string, string>, authed = false): Promise<VideoToken> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authed) headers.Authorization = `Bearer ${getSessionToken()}`;
  const res = await fetch(apiUrl(path), { method: 'POST', headers, body: JSON.stringify(body) });
  if (res.status === 401) throw new VideoDeniedError('auth');
  if (!res.ok) {
    const msg = (await res.json().catch(() => ({}))) as { error?: string };
    // 服务端的 400 文案是 'invalid code/id/name' 这种带细节的串,收敛成一个 reason ——
    // 细节对用户没用,而漏收敛会让未知串混进 VideoDenyReason 的联合类型里当合法值。
    const raw = msg.error ?? '';
    const reason: VideoDenyReason = raw.startsWith('invalid') ? 'invalid' : (raw as VideoDenyReason);
    throw new VideoDeniedError(reason || 'unavailable');
  }
  return res.json();
}

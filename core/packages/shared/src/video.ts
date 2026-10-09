import { NET_BATTLE_TOKEN_HEADER } from "./timer/net-battle";

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
  /** Battle membership rotated repeatedly while admission was being checked; retryable. */
  | 'changed'
  /** 会议码不合法(手抄错了)。 */
  | 'invalid'
  /** 会议室要求登录。 */
  | 'auth'
  | 'cancelled'
  | 'video not configured';

export class VideoDeniedError extends Error {
  readonly reason: VideoDenyReason;
  constructor(reason: VideoDenyReason) {
    super(reason);
    this.name = 'VideoDeniedError';
    this.reason = reason;
  }
}


export interface BattleVideoClient {
  getConfig(signal?: AbortSignal): Promise<VideoConfig | null>;
  getToken(code: string, pid: string, playerToken: string, signal?: AbortSignal): Promise<VideoToken>;
}

/** Shared HTTP boundary; hosts supply only their API origin and fetch transport. */
export function createBattleVideoClient(host: { apiUrl(path: string): string; fetcher: typeof fetch }): BattleVideoClient {
  async function request(path: string, init: RequestInit, signal?: AbortSignal): Promise<{ ok: boolean; status: number; value: unknown }> {
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (signal?.aborted) controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    const timeout = setTimeout(abort, 20_000);
    try {
      const response = await host.fetcher(host.apiUrl(path), { ...init, signal: controller.signal });
      const value: unknown = await response.json().catch((error: unknown) => { if (response.ok) throw error; return null; });
      return { ok: response.ok, status: response.status, value };
    }
    finally { clearTimeout(timeout); signal?.removeEventListener('abort', abort); }
  }
  return {
    async getConfig(signal) {
      for (let attempt = 0; attempt < 2; attempt++) {
        if (signal?.aborted) return null;
        try {
          const response = await request('/v1/video/config', {}, signal);
          if (response.ok) {
            const value = response.value as VideoConfig;
            return value && typeof value.enabled === 'boolean' && Number.isFinite(value.maxParticipants) ? value : null;
          }
          if (response.status < 500) return null;
        } catch { if (signal?.aborted) return null; }
      }
      return null;
    },
    async getToken(code, pid, playerToken, signal) {
      const response = await request('/v1/video/token', { method: 'POST',
        headers: { 'Content-Type': 'application/json', [NET_BATTLE_TOKEN_HEADER]: playerToken },
        body: JSON.stringify({ code, pid }),
      }, signal);
      if (!response.ok) {
        if (response.status === 401) throw new VideoDeniedError('auth');
        const value = (response.value ?? {}) as { error?: string };
        const known = ['full', 'bandwidth', 'unavailable', 'not in room', 'changed', 'auth', 'cancelled', 'video not configured'];
        const raw = typeof value.error === 'string' ? value.error : '';
        throw new VideoDeniedError(raw.startsWith('invalid') ? 'invalid' : known.includes(raw) ? raw as VideoDenyReason : 'unavailable');
      }
      const value = response.value as VideoToken;
      if (!value || typeof value.url !== 'string' || !/^wss?:\/\//.test(value.url)
        || typeof value.token !== 'string' || !value.token || typeof value.room !== 'string'
        || typeof value.identity !== 'string') throw new VideoDeniedError('unavailable');
      return value;
    },
  };
}

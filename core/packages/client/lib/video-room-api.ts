// /timer 联机对战房间的视频通话客户端 API(对应 server/routes/video_rooms.ts)。
//
// 媒体面走自建 LiveKit(SFU):这里只负责换凭证,拿到 {url,token} 之后就交给 livekit-client
// 直连,本文件不参与任何媒体传输。对战状态仍走 battle-room-api 的 1s 轮询,两套互不干扰。
import { apiUrl } from './api-base';

/**
 * 单路视频最大码率(bps)。1080p30 取 LiveKit h1080 预设的 3 Mbps。
 * **与 server/routes/video_rooms.ts 的 PER_STREAM_MBPS 同口径,改一处必须改两处** ——
 * 服务端按这个数守带宽预算,客户端真发得比它多就会超卖。
 */
export const VIDEO_MAX_BITRATE = 3_000_000;

/** 视频采集分辨率上限。宫格里的小窗会由 simulcast 自动降层,这里只定「最高能到多少」。 */
export const VIDEO_MAX_WIDTH = 1920;
export const VIDEO_MAX_HEIGHT = 1080;

export interface VideoConfig {
  /** 站点是否配了 LiveKit。false 时客户端应完全隐藏视频入口,而不是点了才报错。 */
  enabled: boolean;
  maxParticipants: number;
  maxBitrateMbps: number;
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
  const res = await fetch(apiUrl('/v1/video/token'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, pid }),
  });
  if (!res.ok) {
    const msg = (await res.json().catch(() => ({}))) as { error?: string };
    throw new VideoDeniedError((msg.error as VideoDenyReason) || 'unavailable');
  }
  return res.json();
}

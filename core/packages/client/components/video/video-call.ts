// 视频通话里与「哪种房」无关的那部分:连接参数和失败文案。
// /timer 对战房(app/[lang]/timer/_battle/VideoStrip.tsx)和 /meet 会议室共用 ——
// 两边只有授权方式不同,连上之后的行为必须一致,所以这些常量只能有一份。

import { VideoPresets, type RoomOptions } from 'livekit-client';

import { tr } from '@/i18n/tr';
import { VIDEO_MAX_BITRATE, type VideoDenyReason } from '@/lib/video-room-api';

/** 失败原因:服务端给的那几种,加上只可能发生在浏览器这侧的三种。 */
export type FailReason = VideoDenyReason | 'media' | 'connect' | 'camera';

/**
 * 被拒 / 出错时给出**可操作**的说明,而不是笼统的「失败」。
 * 人数上限由服务端 /video/config 给,不在这里写死 —— 写死就会和服务端的常量各改各的,
 * 文案说 4 人而实际拦在 3 人。对战房和会议室的上限本来就不一样,更不能写死。
 */
export function denyMessage(reason: FailReason, maxParticipants: number): string {
  switch (reason) {
    case 'full':
      return tr({
        zh: `视频位已满(最多 ${maxParticipants} 人),可以先让别人退出`,
        en: `Video is full (${maxParticipants} max) — someone needs to leave first`,
      });
    case 'bandwidth':
      return tr({ zh: '服务器视频带宽已满,过一会儿再试', en: 'Server video capacity is full — try again shortly' });
    case 'unavailable':
      return tr({ zh: '视频服务暂时连不上', en: 'Video service is unreachable' });
    case 'not in room':
      return tr({ zh: '你已不在这个房间里', en: 'You are no longer in this room' });
    case 'invalid':
      return tr({ zh: '会议码或名字不对,请检查后重试', en: 'Bad meeting code or name — check and try again' });
    case 'video not configured':
      return tr({ zh: '本站未启用视频', en: 'Video is not enabled on this site' });
    case 'media':
      return tr({ zh: '无法使用摄像头/麦克风,请检查浏览器权限', en: 'Cannot access camera/mic — check browser permissions' });
    case 'camera':
      return tr({ zh: '切换摄像头失败,可能被其他应用占用', en: 'Could not switch camera — another app may be using it' });
    default:
      return tr({ zh: '视频连接失败', en: 'Video connection failed' });
  }
}

/**
 * LiveKitRoom 的连接参数。simulcast 三层 + adaptiveStream 是多人 1080p 房能塞进带宽预算的
 * 关键,别关:宫格里的小窗自动订阅低层,只有点开大图那一路才拉满。
 *
 * maxBitrate 必须引用 VIDEO_MAX_BITRATE 这个常量,不许就地写数字 —— 服务端按同一个数守
 * 带宽预算,写死了改常量根本不生效(守卫:tests/video-bitrate-sync.test.ts)。
 */
export const LIVEKIT_ROOM_OPTIONS: RoomOptions = {
  adaptiveStream: true,
  dynacast: true,
  videoCaptureDefaults: { resolution: VideoPresets.h1080.resolution },
  publishDefaults: {
    simulcast: true,
    videoEncoding: { maxBitrate: VIDEO_MAX_BITRATE, maxFramerate: 30 },
    // 只列两条附加层:宫格小窗吃 180p,半屏吃 540p,点开大图才用主层 1080p。
    videoSimulcastLayers: [VideoPresets.h180, VideoPresets.h540],
  },
};

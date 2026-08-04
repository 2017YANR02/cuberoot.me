// 视频通话里与「哪种房」无关的那部分:连接参数和失败文案。
// /timer 对战房(app/[lang]/timer/_battle/VideoStrip.tsx)和 /meet 会议室共用 ——
// 两边只有授权方式不同,连上之后的行为必须一致,所以这些常量只能有一份。

import { DisconnectReason, VideoPresets, type RoomOptions } from 'livekit-client';

import { tr } from '@/i18n/tr';
import { SCREEN_SHARE_MAX_BITRATE, VIDEO_MAX_BITRATE, type VideoDenyReason } from '@/lib/video-room-api';

/** 失败原因:服务端给的那几种,加上只可能发生在浏览器这侧的四种。 */
export type FailReason = VideoDenyReason | 'media' | 'connect' | 'camera' | 'stale-api';

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
      return tr({ zh: '会议码不对,请检查后重试', en: 'Bad meeting code — check and try again' });
    case 'stale-api':
      // 「码不对」这句话只有在**用户可能抄错**时才该说。会议码在发出去之前已经过了
      // isMeetCode(同一张字母表、同一个长度),所以服务端此时再说 invalid,唯一的解释是
      // 两边不是同一个版本(前端已上线、后端还没)。把这个说成用户抄错会让人对着一个
      // 完全正确的码反复重试。
      return tr({
        zh: '服务端暂时不认这个会议码(前后端版本不一致),稍后再试',
        en: 'The server does not accept this code yet — the site is mid-deploy, try again shortly',
      });
    case 'auth':
      return tr({ zh: '会议需要登录后使用', en: 'Meetings require you to be signed in' });
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
 * 掉线原因翻成人话。**只有自己按挂断(CLIENT_INITIATED)才返回 null** —— 其余每一种
 * 都是「画面突然没了而我什么都没做」,不给话就等于静默失败。
 *
 * 最要紧的是 DUPLICATE_IDENTITY:一个账号只占一个席位(见 server 的 video_rooms.ts),
 * 从第二台设备进来会把第一台踢掉。没有这句话,用户看到的是笔记本莫名其妙掉出会议、
 * 再点进去又把手机踢掉 —— 来回弹,毫无线索。
 */
export function disconnectMessage(reason: DisconnectReason | undefined): string | null {
  switch (reason) {
    case undefined:
    case DisconnectReason.CLIENT_INITIATED:
      return null;
    case DisconnectReason.DUPLICATE_IDENTITY:
      return tr({
        zh: '你在另一台设备上进入了这场会议,这一端已退出',
        en: 'You joined this meeting on another device, so this one was disconnected',
      });
    case DisconnectReason.PARTICIPANT_REMOVED:
      return tr({ zh: '你已被移出这个房间', en: 'You were removed from this room' });
    case DisconnectReason.ROOM_DELETED:
    case DisconnectReason.ROOM_CLOSED:
      return tr({ zh: '这个房间已经结束了', en: 'This room has ended' });
    case DisconnectReason.SERVER_SHUTDOWN:
      return tr({ zh: '视频服务正在重启,过一会儿再进', en: 'The video service is restarting — try again shortly' });
    case DisconnectReason.JOIN_FAILURE:
      // LiveKit 侧把人数上限钉死了,超编的那一个就是在这里被拒的。
      return tr({ zh: '进不去这个房间,可能已经满了', en: 'Could not join — the room may be full' });
    default:
      return tr({ zh: '与房间的连接断开了', en: 'Disconnected from the room' });
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
    // 屏幕共享(只有 /meet 有)。15 帧足够看幻灯片和代码,而它是摄像头之外额外的一路,
    // 帧率给高了直接吃掉给别人摄像头留的带宽。
    screenShareEncoding: { maxBitrate: SCREEN_SHARE_MAX_BITRATE, maxFramerate: 15 },
  },
};

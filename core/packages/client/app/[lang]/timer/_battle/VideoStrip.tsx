'use client';

/**
 * VideoStrip — /timer 联机对战房间里的视频通话(LiveKit SFU)。
 *
 * 一份状态、两个落点:开关是顶栏上一个裸图标(挨着人数下拉),画面在玩家条下方。两处在 DOM 上
 * 离得很远,所以连接状态住在 useVideoRoom 里由双方共用,而不是各自持一份。
 *
 * 默认**不连接**:进房不等于开摄像头,要用户自己点。这样既不吓人,也不会让只想计时的人白白
 * 占带宽 —— 服务端的带宽预算是按「已连接的人」算的。
 *
 * 身份复用对战房的 {code, pid, playerToken}:服务端签 token 前会同时确认在册玩家与私有
 * capability。pid 会出现在公开房态里,不能单独作为凭据。视频房名 `battle-<code>`,
 * 与对战房一一对应。/meet 会议室是另一套授权(必须登录,身份取自 session token),而且它
 * 用的是会议软件那套完整界面;与这里共用的只有 components/video/video-call.ts 里的连接参数
 * 和失败文案。
 *
 * 画质:采集上限 1080p,publish 走 simulcast 三层。码率上限 VIDEO_MAX_BITRATE 与服务端的
 * PER_STREAM_MBPS 是同一个数,改一处必须改两处,否则服务端会按错误的口径算带宽。
 *
 * 视频是纯增强:任何一步失败(没配 LiveKit / 没带宽 / 用户拒绝授权 / 连不上)都只影响这一条,
 * 对战计时本身照常跑。
 */

import { useCallback, useEffect, useState } from 'react';
import { LiveKitRoom } from '@livekit/components-react';
import type { DisconnectReason } from 'livekit-client';
import { Video } from 'lucide-react';

import VideoTiles from '@/components/video/VideoTiles';
import { LIVEKIT_ROOM_OPTIONS, denyMessage, disconnectMessage, type FailReason } from '@/components/video/video-call';
import { tr } from '@/i18n/tr';
import {
  VideoDeniedError,
  getVideoConfig,
  getVideoToken,
  type VideoConfig,
  type VideoToken,
} from '@/lib/video-room-api';

import './video-strip.css';

/** 顶栏开关与画面共用的那份连接状态。 */
export interface VideoRoom {
  /** 本站启用了视频、且身份已落定 —— false 时开关和画面都不出现。 */
  enabled: boolean;
  token: VideoToken | null;
  busy: boolean;
  err: string | null;
  maxParticipants: number;
  /** 开 / 关视频。已连接时再点就是挂断。 */
  toggle: () => void;
  leave: (reason?: DisconnectReason) => void;
  fail: (reason: FailReason) => void;
}

/**
 * @param code 对战房房间码;@param pid 本人在房里的 playerId。
 * 任一为空 = 身份还没落定(正在加入 / 恢复),此时签不出 token,整套 UI 不出现。
 */
export function useVideoRoom(code: string | null, pid: string | null, playerToken: string | null): VideoRoom {
  /** null = 还没问过站点配置;enabled:false = 本站没开视频。 */
  const [cfg, setCfg] = useState<VideoConfig | null>(null);
  const [token, setToken] = useState<VideoToken | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let dead = false;
    void getVideoConfig().then((c) => { if (!dead) setCfg(c); });
    return () => { dead = true; };
  }, []);

  const maxParticipants = cfg?.maxParticipants ?? 0;

  const fail = useCallback(
    (reason: FailReason) => setErr(denyMessage(reason, maxParticipants)),
    [maxParticipants],
  );

  const leave = useCallback((reason?: DisconnectReason) => {
    setToken(null);
    setErr(disconnectMessage(reason));
  }, []);

  const toggle = useCallback(() => {
    if (token) { leave(); return; }
    if (!code || !pid || !playerToken) return;
    setBusy(true);
    setErr(null);
    getVideoToken(code, pid, playerToken)
      .then(setToken)
      .catch((e: unknown) => fail(e instanceof VideoDeniedError ? e.reason : 'connect'))
      .finally(() => setBusy(false));
  }, [token, code, pid, playerToken, leave, fail]);

  // 换房间(或换身份)时必须断开:旧 token 是签给旧房间的,留着会连到别人的房里。
  useEffect(() => { setToken(null); setErr(null); }, [code, pid, playerToken]);

  return {
    enabled: !!cfg?.enabled && !!code && !!pid && !!playerToken,
    token, busy, err, maxParticipants, toggle, leave, fail,
  };
}

/** 顶栏那个开关。裸图标,不带边框和文字 —— 它挨着人数下拉,再套一层框就成了两个并排的芯片。 */
export function VideoToggle({ video }: { video: VideoRoom }) {
  if (!video.enabled) return null;
  const on = !!video.token;
  const label = on ? tr({ zh: '关闭视频', en: 'Stop video' }) : tr({ zh: '开视频', en: 'Start video' });
  return (
    <button
      type="button"
      className="vs-toggle"
      data-no-timer
      aria-pressed={on}
      aria-label={label}
      title={label}
      disabled={video.busy}
      onClick={video.toggle}
    >
      <Video size={17} />
    </button>
  );
}

export default function VideoStrip({ video }: { video: VideoRoom }) {
  // 没连上就什么都不占:开关在顶栏,这里空着不该留下一条空框。出错信息是例外 ——
  // 点了没反应比报错更糟,得让人知道为什么没开起来。
  if (!video.token) {
    return video.err ? (
      <div className="vs-strip is-idle surface-chrome" data-no-timer>
        <span className="vc-err">{video.err}</span>
      </div>
    ) : null;
  }

  return (
    <div className="vs-strip surface-chrome" data-no-timer>
      <LiveKitRoom
        serverUrl={video.token.url}
        token={video.token.token}
        connect
        video
        audio
        options={LIVEKIT_ROOM_OPTIONS}
        onDisconnected={video.leave}
        onError={() => video.fail('connect')}
        onMediaDeviceFailure={() => video.fail('media')}
      >
        <VideoTiles onLeave={video.leave} onCameraError={() => video.fail('camera')} />
      </LiveKitRoom>
      {video.err && <span className="vc-err">{video.err}</span>}
    </div>
  );
}

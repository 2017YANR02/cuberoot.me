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
 * capability。pid 会出现在公开房态里,不能单独作为凭据。视频房名还绑定服务端随机
 * videoGeneration；成员被移出时 generation 轮换，仍在房内的人自动断开旧媒体房并重连。
 * /meet 会议室是另一套授权(必须登录,身份取自 session token),而且它
 * 用的是会议软件那套完整界面;与这里共用的只有 components/video/video-call.ts 里的连接参数
 * 和失败文案。
 *
 * 画质:采集上限 1080p,publish 走 simulcast 三层。码率上限 VIDEO_MAX_BITRATE 与服务端的
 * PER_STREAM_MBPS 是同一个数,改一处必须改两处,否则服务端会按错误的口径算带宽。
 *
 * 视频是纯增强:任何一步失败(没配 LiveKit / 没带宽 / 用户拒绝授权 / 连不上)都只影响这一条,
 * 对战计时本身照常跑。
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { LiveKitRoom } from '@livekit/components-react';
import { DisconnectReason } from 'livekit-client';
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
  leave: (reason?: DisconnectReason, disconnectedToken?: string) => void;
  fail: (reason: FailReason) => void;
}

/**
 * @param code 对战房房间码;@param pid 本人在房里的 playerId。
 * 任一为空 = 身份还没落定(正在加入 / 恢复),此时签不出 token,整套 UI 不出现。
 */
export function useVideoRoom(
  code: string | null,
  pid: string | null,
  playerToken: string | null,
  videoGeneration: string | null,
): VideoRoom {
  /** null = 还没问过站点配置;enabled:false = 本站没开视频。 */
  const [cfg, setCfg] = useState<VideoConfig | null>(null);
  const [token, setToken] = useState<VideoToken | null>(null);
  const [wanted, setWanted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const changedRetriesRef = useRef(0);

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

  const leave = useCallback((reason?: DisconnectReason, disconnectedToken?: string) => {
    setToken((current) => {
      if (disconnectedToken && current?.token !== disconnectedToken) return current;
      // Membership rotation retires the entire old LiveKit room. Preserve the user's video
      // intent so this authorized member immediately asks the API for the new generation.
      if (reason !== DisconnectReason.ROOM_DELETED && reason !== DisconnectReason.ROOM_CLOSED) {
        setWanted(false);
      }
      setErr(disconnectMessage(reason));
      return null;
    });
  }, []);

  const toggle = useCallback(() => {
    if (wanted) {
      setWanted(false);
      setToken(null);
      setErr(null);
      return;
    }
    if (!code || !pid || !playerToken || !videoGeneration) return;
    setWanted(true);
  }, [wanted, code, pid, playerToken, videoGeneration]);

  // 换房间/身份是新会话，不继承视频意图；generation 轮换则保留意图并自动换 token。
  useEffect(() => {
    changedRetriesRef.current = 0;
    setWanted(false); setToken(null); setErr(null);
  }, [code, pid, playerToken]);
  useEffect(() => { changedRetriesRef.current = 0; setToken(null); }, [videoGeneration]);

  useEffect(() => {
    if (!wanted || token || !code || !pid || !playerToken || !videoGeneration) return;
    let dead = false;
    setBusy(true);
    setErr(null);
    void getVideoToken(code, pid, playerToken)
      .then((next) => {
        if (dead) return;
        changedRetriesRef.current = 0;
        setToken(next);
      })
      .catch((e: unknown) => {
        if (dead) return;
        if (e instanceof VideoDeniedError && e.reason === 'changed' && changedRetriesRef.current < 2) {
          changedRetriesRef.current += 1;
          window.setTimeout(() => { if (!dead) setRetryNonce((value) => value + 1); }, 150);
          return;
        }
        setWanted(false);
        fail(e instanceof VideoDeniedError ? e.reason : 'connect');
      })
      .finally(() => { if (!dead) setBusy(false); });
    return () => { dead = true; };
  }, [wanted, token, code, pid, playerToken, videoGeneration, retryNonce, fail]);

  return {
    enabled: !!cfg?.enabled && !!code && !!pid && !!playerToken && !!videoGeneration,
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
        onDisconnected={(reason) => video.leave(reason, video.token?.token)}
        onError={() => video.fail('connect')}
        onMediaDeviceFailure={() => video.fail('media')}
      >
        <VideoTiles onLeave={video.leave} onCameraError={() => video.fail('camera')} />
      </LiveKitRoom>
      {video.err && <span className="vc-err">{video.err}</span>}
    </div>
  );
}

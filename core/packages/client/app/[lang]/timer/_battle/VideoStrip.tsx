'use client';

/**
 * VideoStrip — /timer 联机对战房间里的视频通话条(LiveKit SFU)。
 *
 * 挂在对战房的玩家条下方,默认**不连接**:进房不等于开摄像头,要用户自己点。这样既不吓人,
 * 也不会让只想计时的人白白占带宽 —— 服务端的带宽预算是按「已连接的人」算的。
 *
 * 身份复用对战房的 {code, pid}:服务端签 token 前会回库确认该 pid 确实在该房间的 players
 * 里(房间码只有 5 位,可猜),所以这里不需要额外的登录态。视频房名 `battle-<code>`,
 * 与对战房一一对应。
 *
 * 画质:采集上限 1080p,publish 走 simulcast 三层(180p / 540p / 1080p)。宫格里的小窗由
 * adaptiveStream 自动订阅低层,只有点开大图那一路才拉满 —— 这是四人 1080p 房能塞进带宽
 * 预算的关键,别关。码率上限 VIDEO_MAX_BITRATE 与服务端的 PER_STREAM_MBPS 是同一个数,
 * 改一处必须改两处,否则服务端会按错误的口径算带宽。
 *
 * 视频是纯增强:任何一步失败(没配 LiveKit / 没带宽 / 用户拒绝授权 / 连不上)都只影响这一条,
 * 对战计时本身照常跑。
 */

import { useCallback, useEffect, useState } from 'react';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  VideoTrack,
  isTrackReference,
  useLocalParticipant,
  useTracks,
} from '@livekit/components-react';
import { Track, VideoPresets } from 'livekit-client';
import { Video, VideoOff, Mic, MicOff, PhoneOff, UserRound } from 'lucide-react';

import { tr } from '@/i18n/tr';
import {
  VIDEO_MAX_BITRATE,
  VideoDeniedError,
  getVideoConfig,
  getVideoToken,
  type VideoConfig,
  type VideoDenyReason,
  type VideoToken,
} from '@/lib/video-room-api';

import './video-strip.css';

/**
 * 被拒 / 出错时给出**可操作**的说明,而不是笼统的「失败」。
 * 人数上限由服务端 /video/config 给,不在这里写死 —— 写死就会和服务端的
 * MAX_VIDEO_PARTICIPANTS 各改各的,文案说 4 人而实际拦在 3 人。
 */
function denyMessage(reason: VideoDenyReason | 'media' | 'connect', maxParticipants: number): string {
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
    case 'video not configured':
      return tr({ zh: '本站未启用视频', en: 'Video is not enabled on this site' });
    case 'media':
      return tr({ zh: '无法使用摄像头/麦克风,请检查浏览器权限', en: 'Cannot access camera/mic — check browser permissions' });
    default:
      return tr({ zh: '视频连接失败', en: 'Video connection failed' });
  }
}

/** 房内画面 + 本地控制。必须是 LiveKitRoom 的子组件(这些 hook 依赖它提供的 context)。 */
function VideoTiles({ onLeave }: { onLeave: () => void }) {
  // withPlaceholder:对方还没开摄像头时也占一格,否则别人开关摄像头会导致宫格跳动。
  const tracks = useTracks([{ source: Track.Source.Camera, withPlaceholder: true }]);
  const { localParticipant, isCameraEnabled, isMicrophoneEnabled } = useLocalParticipant();

  return (
    <>
      {/* 远端音频的实际播放者。没有它就是「有画面没声音」。 */}
      <RoomAudioRenderer />

      <div className="vs-tiles" data-count={tracks.length}>
        {tracks.map((t) => {
          const name = t.participant.name || t.participant.identity;
          return (
            <div key={`${t.participant.identity}-${t.source}`} className="vs-tile">
              {isTrackReference(t) ? (
                // 自己那格镜像显示 —— 不镜像的自拍画面会让人对不准手和魔方的左右。
                <VideoTrack trackRef={t} className="vs-video" data-local={t.participant.isLocal || undefined} />
              ) : (
                <div className="vs-video vs-video-off">
                  <UserRound size={28} aria-hidden />
                </div>
              )}
              <span className="vs-name">
                {name}
                {t.participant.isLocal && <span className="vs-me">{tr({ zh: '(我)', en: ' (me)' })}</span>}
              </span>
            </div>
          );
        })}
      </div>

      <div className="vs-controls">
        <button
          type="button"
          className="vs-ctrl"
          aria-pressed={isMicrophoneEnabled}
          title={isMicrophoneEnabled ? tr({ zh: '静音', en: 'Mute' }) : tr({ zh: '取消静音', en: 'Unmute' })}
          onClick={() => void localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)}
        >
          {isMicrophoneEnabled ? <Mic size={16} /> : <MicOff size={16} />}
        </button>
        <button
          type="button"
          className="vs-ctrl"
          aria-pressed={isCameraEnabled}
          title={isCameraEnabled ? tr({ zh: '关摄像头', en: 'Turn camera off' }) : tr({ zh: '开摄像头', en: 'Turn camera on' })}
          onClick={() => void localParticipant.setCameraEnabled(!isCameraEnabled)}
        >
          {isCameraEnabled ? <Video size={16} /> : <VideoOff size={16} />}
        </button>
        <button
          type="button"
          className="vs-ctrl is-leave"
          title={tr({ zh: '退出视频', en: 'Leave video' })}
          onClick={onLeave}
        >
          <PhoneOff size={16} />
        </button>
      </div>
    </>
  );
}

export default function VideoStrip({ code, pid }: { code: string; pid: string }) {
  /** null = 还没问过站点配置;enabled:false = 本站没开视频(整条不渲染)。 */
  const [cfg, setCfg] = useState<VideoConfig | null>(null);
  const [tok, setTok] = useState<VideoToken | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let dead = false;
    void getVideoConfig().then((c) => { if (!dead) setCfg(c); });
    return () => { dead = true; };
  }, []);

  const maxParticipants = cfg?.maxParticipants ?? 0;

  const join = useCallback(() => {
    setBusy(true);
    setErr(null);
    getVideoToken(code, pid)
      .then(setTok)
      .catch((e: unknown) => {
        setErr(denyMessage(e instanceof VideoDeniedError ? e.reason : 'connect', maxParticipants));
      })
      .finally(() => setBusy(false));
  }, [code, pid, maxParticipants]);

  const leave = useCallback(() => { setTok(null); }, []);

  // 换房间(或换身份)时必须断开:旧 token 是签给旧房间的,留着会连到别人的房里。
  useEffect(() => { setTok(null); setErr(null); }, [code, pid]);

  if (!cfg?.enabled) return null;

  if (!tok) {
    return (
      <div className="vs-strip is-idle surface-chrome" data-no-timer>
        <button type="button" className="vs-join" onClick={join} disabled={busy}>
          <Video size={15} />
          {busy ? tr({ zh: '连接中…', en: 'Connecting…' }) : tr({ zh: '开视频', en: 'Start video' })}
        </button>
        {err && <span className="vs-err">{err}</span>}
      </div>
    );
  }

  return (
    <div className="vs-strip surface-chrome" data-no-timer>
      <LiveKitRoom
        serverUrl={tok.url}
        token={tok.token}
        connect
        video
        audio
        options={{
          adaptiveStream: true,
          dynacast: true,
          videoCaptureDefaults: { resolution: VideoPresets.h1080.resolution },
          publishDefaults: {
            simulcast: true,
            videoEncoding: { maxBitrate: VIDEO_MAX_BITRATE, maxFramerate: 30 },
            // 只列两条附加层:宫格小窗吃 180p,半屏吃 540p,点开大图才用主层 1080p。
            videoSimulcastLayers: [VideoPresets.h180, VideoPresets.h540],
          },
        }}
        onDisconnected={leave}
        onError={() => setErr(denyMessage('connect', maxParticipants))}
        onMediaDeviceFailure={() => setErr(denyMessage('media', maxParticipants))}
      >
        <VideoTiles onLeave={leave} />
      </LiveKitRoom>
      {err && <span className="vs-err">{err}</span>}
    </div>
  );
}

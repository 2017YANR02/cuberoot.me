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
 * 身份复用对战房的 {code, pid}:服务端签 token 前会回库确认该 pid 确实在该房间的 players
 * 里(房间码只有 5 位,可猜),所以这里不需要额外的登录态。视频房名 `battle-<code>`,
 * 与对战房一一对应。
 *
 * 画质:采集上限 1080p,publish 走 simulcast 三层(180p / 540p / 1080p)。宫格里的小窗由
 * adaptiveStream 自动订阅低层,点开大图那一路才拉满 —— 这是四人 1080p 房能塞进带宽
 * 预算的关键,别关。码率上限 VIDEO_MAX_BITRATE 与服务端的 PER_STREAM_MBPS 是同一个数,
 * 改一处必须改两处,否则服务端会按错误的口径算带宽。
 *
 * 所以**点开大图这个交互是画质的一部分,不是锦上添花**:adaptiveStream 认的是 <video> 元素
 * 在屏幕上的实际尺寸,250px 宽的小窗永远只会收到 180p。没有放大入口 = 用户手上的 1080p
 * 一辈子看不到,只会觉得「这网站画质真差」。
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
import { Room, Track, VideoPresets } from 'livekit-client';
import { Video, VideoOff, Mic, MicOff, PhoneOff, SwitchCamera, UserRound } from 'lucide-react';

import { tr } from '@/i18n/tr';
import { facingOf, nextCamera, type CameraFacing } from '@/lib/video-camera';
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

/** 失败原因:服务端给的那几种,加上只可能发生在浏览器这侧的三种。 */
type FailReason = VideoDenyReason | 'media' | 'connect' | 'camera';

/**
 * 被拒 / 出错时给出**可操作**的说明,而不是笼统的「失败」。
 * 人数上限由服务端 /video/config 给,不在这里写死 —— 写死就会和服务端的
 * MAX_VIDEO_PARTICIPANTS 各改各的,文案说 4 人而实际拦在 3 人。
 */
function denyMessage(reason: FailReason, maxParticipants: number): string {
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
    case 'camera':
      return tr({ zh: '切换摄像头失败,可能被其他应用占用', en: 'Could not switch camera — another app may be using it' });
    default:
      return tr({ zh: '视频连接失败', en: 'Video connection failed' });
  }
}

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
  leave: () => void;
  fail: (reason: FailReason) => void;
}

/**
 * @param code 对战房房间码;@param pid 本人在房里的 playerId。
 * 任一为空 = 身份还没落定(正在加入 / 恢复),此时签不出 token,整套 UI 不出现。
 */
export function useVideoRoom(code: string | null, pid: string | null): VideoRoom {
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

  const leave = useCallback(() => { setToken(null); setErr(null); }, []);

  const toggle = useCallback(() => {
    if (token) { leave(); return; }
    if (!code || !pid) return;
    setBusy(true);
    setErr(null);
    getVideoToken(code, pid)
      .then(setToken)
      .catch((e: unknown) => fail(e instanceof VideoDeniedError ? e.reason : 'connect'))
      .finally(() => setBusy(false));
  }, [token, code, pid, leave, fail]);

  // 换房间(或换身份)时必须断开:旧 token 是签给旧房间的,留着会连到别人的房里。
  useEffect(() => { setToken(null); setErr(null); }, [code, pid]);

  return {
    enabled: !!cfg?.enabled && !!code && !!pid,
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

/** 房内画面 + 本地控制。必须是 LiveKitRoom 的子组件(这些 hook 依赖它提供的 context)。 */
function VideoTiles({ onLeave, onFail }: { onLeave: () => void; onFail: (r: FailReason) => void }) {
  // withPlaceholder:对方还没开摄像头时也占一格,否则别人开关摄像头会导致宫格跳动。
  const tracks = useTracks([{ source: Track.Source.Camera, withPlaceholder: true }]);
  const { localParticipant, isCameraEnabled, isMicrophoneEnabled } = useLocalParticipant();

  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [facing, setFacing] = useState<CameraFacing>('user');
  const [switching, setSwitching] = useState(false);
  /** 被放大的那一格(参与者 key);null = 平铺宫格。 */
  const [spotlight, setSpotlight] = useState<string | null>(null);

  const camTrack = localParticipant.getTrackPublication(Track.Source.Camera)?.videoTrack;

  // 摄像头清单。权限在开摄像头时已经拿过,所以这里能读到真实的 deviceId(没权限时浏览器
  // 只给一条空标签的占位,会误判成「只有一个摄像头」而藏掉切换按钮)。
  // 跟着 devicechange 走:插拔外接摄像头、手机切后台回来,列表都会变。
  useEffect(() => {
    let dead = false;
    const refresh = () => {
      void Room.getLocalDevices('videoinput', false)
        .then((d) => { if (!dead) setCameras(d); })
        .catch(() => { if (!dead) setCameras([]); });
    };
    refresh();
    navigator.mediaDevices?.addEventListener('devicechange', refresh);
    return () => {
      dead = true;
      navigator.mediaDevices?.removeEventListener('devicechange', refresh);
    };
  }, []);

  // 起始朝向以轨道自己报的为准,不假定「一开始一定是前置」—— 手机上浏览器记住过上次的
  // 选择时开出来就可能是后置,那时候还镜像就全反了。
  useEffect(() => {
    if (camTrack) setFacing(facingOf(camTrack.mediaStreamTrack.getSettings()));
  }, [camTrack]);

  const switchCamera = useCallback(() => {
    if (!camTrack) return;
    const next = nextCamera(camTrack.mediaStreamTrack.getSettings(), cameras);
    if (!next) return;
    setSwitching(true);
    // 必须带上 resolution:restartTrack 的约束是整套替换的,不写就掉回浏览器默认档(多半 480p)。
    camTrack
      .restartTrack({ ...next, resolution: VideoPresets.h1080.resolution })
      // 换完回读一次真实朝向,而不是信我们请求的那个 —— 约束是「尽量满足」,设备可以不给。
      .then(() => setFacing(facingOf(camTrack.mediaStreamTrack.getSettings())))
      .catch(() => onFail('camera'))
      .finally(() => setSwitching(false));
  }, [camTrack, cameras, onFail]);

  const keyOf = (t: (typeof tracks)[number]) => `${t.participant.identity}-${t.source}`;
  // 被放大的人退房了 → 放大态自动失效。否则 is-spotlight 还在、却没有任何一格是大图,
  // 剩下的人全缩成 84px 缩略图排在那儿。
  const spot = tracks.some((t) => keyOf(t) === spotlight) ? spotlight : null;

  return (
    <>
      {/* 远端音频的实际播放者。没有它就是「有画面没声音」。 */}
      <RoomAudioRenderer />

      <div className={`vs-tiles${spot ? ' is-spotlight' : ''}`} data-count={tracks.length}>
        {tracks.map((t) => {
          const key = keyOf(t);
          const name = t.participant.name || t.participant.identity;
          const big = key === spot;
          return (
            <button
              key={key}
              type="button"
              className="vs-tile"
              data-spot={big ? '' : undefined}
              aria-pressed={big}
              title={big ? tr({ zh: '还原', en: 'Shrink' }) : tr({ zh: '放大(画质拉满)', en: 'Enlarge (full quality)' })}
              onClick={() => setSpotlight(big ? null : key)}
            >
              {isTrackReference(t) ? (
                <VideoTrack
                  trackRef={t}
                  className="vs-video"
                  // 只有自己的前置画面镜像:不镜像的自拍会让人对不准手和魔方的左右,
                  // 而后置拍的是外部世界,镜像了字全是反的。
                  data-mirror={t.participant.isLocal && facing === 'user' ? '' : undefined}
                />
              ) : (
                <div className="vs-video vs-video-off">
                  <UserRound size={28} aria-hidden />
                </div>
              )}
              <span className="vs-name">
                {name}
                {t.participant.isLocal && <span className="vs-me">{tr({ zh: '(我)', en: ' (me)' })}</span>}
              </span>
            </button>
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
        {/* 只有一个摄像头就不出这个按钮 —— 出了也只能点个寂寞。 */}
        {cameras.length > 1 && (
          <button
            type="button"
            className="vs-ctrl"
            disabled={!isCameraEnabled || switching}
            title={tr({ zh: '切换摄像头(前置 / 后置)', en: 'Switch camera (front / back)' })}
            onClick={switchCamera}
          >
            <SwitchCamera size={16} />
          </button>
        )}
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

export default function VideoStrip({ video }: { video: VideoRoom }) {
  // 没连上就什么都不占:开关在顶栏,这里空着不该留下一条空框。出错信息是例外 ——
  // 点了没反应比报错更糟,得让人知道为什么没开起来。
  if (!video.token) {
    return video.err ? (
      <div className="vs-strip is-idle surface-chrome" data-no-timer>
        <span className="vs-err">{video.err}</span>
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
        onDisconnected={video.leave}
        onError={() => video.fail('connect')}
        onMediaDeviceFailure={() => video.fail('media')}
      >
        <VideoTiles onLeave={video.leave} onFail={video.fail} />
      </LiveKitRoom>
      {video.err && <span className="vs-err">{video.err}</span>}
    </div>
  );
}

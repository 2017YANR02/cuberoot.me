'use client';

/**
 * VideoTiles — 视频通话的画面宫格 + 本地控制条。/timer 联机对战和 /meet 会议室共用。
 *
 * 必须是 LiveKitRoom 的子组件(这些 hook 依赖它提供的 context)。它只管「已经连上之后」
 * 的事:谁的画面放哪、镜不镜像、麦克风摄像头开关、换前后置。**换 token / 授权 / 带宽**
 * 全部由各自的调用方负责 —— 那正是两种房唯一不同的地方。
 *
 * 画质与放大:publish 走 simulcast 三层(180p / 540p / 1080p),adaptiveStream 按 <video>
 * 元素在屏幕上的**实际尺寸**挑订阅哪一层。所以点开大图不是锦上添花,而是画质本身的一部分:
 * 250px 宽的小窗永远只会收到 180p,没有放大入口 = 用户手上的 1080p 一辈子看不到。
 */

import { useCallback, useEffect, useState } from 'react';
import {
  RoomAudioRenderer,
  VideoTrack,
  isTrackReference,
  useLocalParticipant,
  useTracks,
} from '@livekit/components-react';
import { Room, Track, VideoPresets } from 'livekit-client';
import { Video, VideoOff, Mic, MicOff, PhoneOff, SwitchCamera, UserRound } from 'lucide-react';

import { tr } from '@/i18n/tr';
import { facingOf, nextCamera, usableCameras, type CameraFacing } from '@/lib/video-camera';

import './video-call.css';

export default function VideoTiles({
  onLeave,
  onCameraError,
}: {
  onLeave: () => void;
  /** 切换摄像头失败(设备被别的应用占着等)。文案由调用方给,这里不假定用的是哪套。 */
  onCameraError: () => void;
}) {
  // withPlaceholder:对方还没开摄像头时也占一格,否则别人开关摄像头会导致宫格跳动。
  const tracks = useTracks([{ source: Track.Source.Camera, withPlaceholder: true }]);
  const { localParticipant, isCameraEnabled, isMicrophoneEnabled } = useLocalParticipant();

  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [facing, setFacing] = useState<CameraFacing>('user');
  const [switching, setSwitching] = useState(false);
  /** 被放大的那一格(参与者 key);null = 平铺宫格。 */
  const [spotlight, setSpotlight] = useState<string | null>(null);

  const camTrack = localParticipant.getTrackPublication(Track.Source.Camera)?.videoTrack;

  // 摄像头清单,过一遍 usableCameras —— 浏览器报的 videoinput 条目不都是另一个摄像头
  // (Windows Hello 的红外镜头是同模组的第二路,切过去一片噪点)。
  // 权限在开摄像头时已经拿过,所以这里能读到真实的 deviceId 和 groupId。
  // 跟着 devicechange 走:插拔外接摄像头、手机切后台回来,列表都会变。
  useEffect(() => {
    let dead = false;
    const refresh = () => {
      void Room.getLocalDevices('videoinput', false)
        .then((d) => { if (!dead) setCameras(usableCameras(d)); })
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
      .catch(onCameraError)
      .finally(() => setSwitching(false));
  }, [camTrack, cameras, onCameraError]);

  const keyOf = (t: (typeof tracks)[number]) => `${t.participant.identity}-${t.source}`;
  // 被放大的人退房了 → 放大态自动失效。否则 is-spotlight 还在、却没有任何一格是大图,
  // 剩下的人全缩成 84px 缩略图排在那儿。
  const spot = tracks.some((t) => keyOf(t) === spotlight) ? spotlight : null;

  return (
    <>
      {/* 远端音频的实际播放者。没有它就是「有画面没声音」。 */}
      <RoomAudioRenderer />

      <div className={`vc-tiles${spot ? ' is-spotlight' : ''}`} data-count={tracks.length}>
        {tracks.map((t) => {
          const key = keyOf(t);
          const name = t.participant.name || t.participant.identity;
          const big = key === spot;
          return (
            <button
              key={key}
              type="button"
              className="vc-tile"
              data-spot={big ? '' : undefined}
              aria-pressed={big}
              title={big ? tr({ zh: '还原', en: 'Shrink' }) : tr({ zh: '放大(画质拉满)', en: 'Enlarge (full quality)' })}
              onClick={() => setSpotlight(big ? null : key)}
            >
              {isTrackReference(t) ? (
                <VideoTrack
                  trackRef={t}
                  className="vc-video"
                  // 只有自己的前置画面镜像:不镜像的自拍会让人对不准手和魔方的左右,
                  // 而后置拍的是外部世界,镜像了字全是反的。
                  data-mirror={t.participant.isLocal && facing === 'user' ? '' : undefined}
                />
              ) : (
                <div className="vc-video vc-video-off">
                  <UserRound size={28} aria-hidden />
                </div>
              )}
              <span className="vc-name">
                {name}
                {t.participant.isLocal && <span className="vc-me">{tr({ zh: '(我)', en: ' (me)' })}</span>}
              </span>
            </button>
          );
        })}
      </div>

      <div className="vc-controls">
        <button
          type="button"
          className="vc-ctrl"
          aria-pressed={isMicrophoneEnabled}
          title={isMicrophoneEnabled ? tr({ zh: '静音', en: 'Mute' }) : tr({ zh: '取消静音', en: 'Unmute' })}
          onClick={() => void localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)}
        >
          {isMicrophoneEnabled ? <Mic size={16} /> : <MicOff size={16} />}
        </button>
        <button
          type="button"
          className="vc-ctrl"
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
            className="vc-ctrl"
            disabled={!isCameraEnabled || switching}
            title={tr({ zh: '切换摄像头(前置 / 后置)', en: 'Switch camera (front / back)' })}
            onClick={switchCamera}
          >
            <SwitchCamera size={16} />
          </button>
        )}
        <button
          type="button"
          className="vc-ctrl is-leave"
          title={tr({ zh: '退出视频', en: 'Leave video' })}
          onClick={onLeave}
        >
          <PhoneOff size={16} />
        </button>
      </div>
    </>
  );
}

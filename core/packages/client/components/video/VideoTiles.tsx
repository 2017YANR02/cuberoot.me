'use client';

/**
 * VideoTiles — 视频通话的画面宫格 + 本地控制条。/timer 联机对战房用。
 * (/meet 会议室不用这个:它要的是会议软件那一整套界面,见 app/[lang]/meet/MeetStage.tsx。
 *  两边共用的只有 video-call.ts 里的连接参数和失败文案。)
 *
 * 必须是 LiveKitRoom 的子组件(这些 hook 依赖它提供的 context)。它只管「已经连上之后」
 * 的事:谁的画面放哪、镜不镜像、麦克风摄像头开关、换前后置。**换 token / 授权 / 带宽**
 * 全部由调用方负责。
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
import { Track, VideoPresets } from 'livekit-client';
import { Video, VideoOff, Mic, MicOff, PhoneOff, SwitchCamera, UserRound } from 'lucide-react';

import { tr } from '@/i18n/tr';
import { canFlipCamera, facingOf, hasFacing, oppositeFacing, type CameraFacing } from '@/lib/video-camera';

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

  const [facing, setFacing] = useState<CameraFacing>('user');
  /** 这台设备有前后置(手机 / 平板)。一旦确认就不再撤销 —— 否则关掉摄像头时按钮会消失,
      控制条跟着跳一下。 */
  const [flippable, setFlippable] = useState(false);
  const [switching, setSwitching] = useState(false);
  /** 被放大的那一格(参与者 key);null = 平铺宫格。 */
  const [spotlight, setSpotlight] = useState<string | null>(null);

  const camTrack = localParticipant.getTrackPublication(Track.Source.Camera)?.videoTrack;

  // 起始朝向以轨道自己报的为准,不假定「一开始一定是前置」—— 手机上浏览器记住过上次的
  // 选择时开出来就可能是后置,那时候还镜像就全反了。
  // 同一处判定这台设备有没有前后置:报得出朝向的才是手机 / 平板,才给切换按钮。
  useEffect(() => {
    const mst = camTrack?.mediaStreamTrack;
    if (!mst) return;
    const settings = mst.getSettings();
    setFacing(facingOf(settings));
    if (canFlipCamera(settings, mst.getCapabilities?.())) setFlippable(true);
  }, [camTrack]);

  const switchCamera = useCallback(() => {
    if (!camTrack) return;
    const want = oppositeFacing(facing);
    setSwitching(true);
    // 必须带上 resolution:restartTrack 的约束是整套替换的,不写就掉回浏览器默认档(多半 480p)。
    camTrack
      .restartTrack({ facingMode: want, resolution: VideoPresets.h1080.resolution })
      .then(() => {
        // 优先回读真实朝向(约束是「尽量满足」,设备可以不给);读不到就只能信我们请求的那个,
        // 否则 settings 不填 facingMode 的浏览器上镜像会一直按前置来。
        const after = camTrack.mediaStreamTrack.getSettings();
        setFacing(hasFacing(after) ? facingOf(after) : want);
      })
      .catch(onCameraError)
      .finally(() => setSwitching(false));
  }, [camTrack, facing, onCameraError]);

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
        {/* 桌面摄像头没有「朝向」,翻不了面,所以那里根本不出这个按钮 —— 出了也只能点个寂寞。 */}
        {flippable && (
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

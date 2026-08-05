'use client';

/**
 * 会议中那一屏。
 *
 * 为什么不直接用 @livekit/components-react 的 <VideoConference/>:它把 ControlBar 和 Chat
 * 里的每一句话都写死成英文,而且不给 label 参数(「Microphone」「Share screen」「Send」…)。
 * 本站只有 en + zh-Hans 两种语言,/zh 下大厅和入会前都是中文、一进会议全变英文,是能一眼
 * 看见的断层。所以这里照抄它的**编排**(布局切换、屏幕共享自动聚焦、pin 上下文),把两个
 * 写死文案的成品件换成走 tr() 的自己人;宫格 / 焦点 / 轮播 / 参与者格这些没有文案的
 * 照旧直接用库的,别重写。
 *
 * 顺带补上成品件没有的两件会议软件标配:
 *   参与者面板 —— 谁在会里、谁静音了、谁网络差,宫格翻页之后这是唯一的答案;
 *   屏幕共享互斥 —— 已经有人在共享时按钮变灰。带宽闸只按「同时一路共享」算钱
 *                   (server 的 roomEgressMbps),真有三个人一起共享就是悄悄超发。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ConnectionState, RoomEvent, Track } from 'livekit-client';
import {
  CarouselLayout,
  FocusLayout,
  FocusLayoutContainer,
  GridLayout,
  LayoutContextProvider,
  ParticipantTile,
  RoomAudioRenderer,
  Toast,
  isTrackReference,
  useCreateLayoutContext,
  useConnectionState,
  usePinnedTracks,
  useTracks,
  type TrackReferenceOrPlaceholder,
} from '@livekit/components-react';
import { LoaderCircle } from 'lucide-react';

import { tr } from '@/i18n/tr';
import MeetChat from './MeetChat';
import MeetControlBar from './MeetControlBar';
import MeetRoster from './MeetRoster';

/**
 * 两个轨道引用是不是同一路。库里的 isEqualTrackRef 没有导出到包入口,而只为它去 import
 * @livekit/components-core 就得把一个传递依赖写进 package.json —— 判据本身只有两行。
 */
function sameTrackRef(
  a: TrackReferenceOrPlaceholder,
  b: TrackReferenceOrPlaceholder | undefined,
): boolean {
  if (!b) return false;
  if (isTrackReference(a) && isTrackReference(b)) {
    return a.publication.trackSid === b.publication.trackSid;
  }
  return a.participant.identity === b.participant.identity && a.source === b.source;
}

/** LiveKit 成品提示写死英文,这里保留同一状态机,只把可见文案接入本站双语。 */
function MeetConnectionToast() {
  const state = useConnectionState();
  let message: string | null = null;
  let spinning = false;

  switch (state) {
    case ConnectionState.Connecting:
      message = tr({ zh: '连接中…', en: 'Connecting…' });
      spinning = true;
      break;
    case ConnectionState.Reconnecting:
      message = tr({ zh: '正在重新连接…', en: 'Reconnecting…' });
      spinning = true;
      break;
    case ConnectionState.Disconnected:
      message = tr({ zh: '连接已断开', en: 'Disconnected' });
      break;
    default:
      break;
  }

  if (!message) return null;
  return (
    <Toast className="lk-toast-connection-state">
      {spinning && <LoaderCircle className="lk-spinner" size={16} />}
      {message}
    </Toast>
  );
}

export default function MeetStage() {
  const [showChat, setShowChat] = useState(false);
  const [showRoster, setShowRoster] = useState(false);
  const [unread, setUnread] = useState(0);

  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { updateOnlyOn: [RoomEvent.ActiveSpeakersChanged], onlySubscribed: false },
  );

  const layoutContext = useCreateLayoutContext();

  const screenShareTracks = useMemo(
    () => tracks.filter(isTrackReference).filter((t) => t.publication.source === Track.Source.ScreenShare),
    [tracks],
  );

  const focusTrack = usePinnedTracks(layoutContext)?.[0];
  const carouselTracks = tracks.filter((t) => !sameTrackRef(t, focusTrack));

  // 有人开始共享屏幕就自动切到焦点布局,他停了再切回宫格 —— 与 <VideoConference/> 同款,
  // 也是所有会议软件的默认行为(共享的内容才是这一刻的主角)。
  const lastAutoFocused = useRef<TrackReferenceOrPlaceholder | null>(null);
  const shareKey = screenShareTracks.map((r) => `${r.publication.trackSid}_${r.publication.isSubscribed}`).join();
  useEffect(() => {
    if (screenShareTracks.some((t) => t.publication.isSubscribed) && lastAutoFocused.current === null) {
      layoutContext.pin.dispatch?.({ msg: 'set_pin', trackReference: screenShareTracks[0]! });
      lastAutoFocused.current = screenShareTracks[0]!;
    } else if (
      lastAutoFocused.current &&
      !screenShareTracks.some((t) => t.publication.trackSid === lastAutoFocused.current?.publication?.trackSid)
    ) {
      layoutContext.pin.dispatch?.({ msg: 'clear_pin' });
      lastAutoFocused.current = null;
    }
    // 被 pin 的那一路从占位变成真轨道(对方刚开摄像头)时要换成新的引用,否则焦点框是空的。
    if (focusTrack && !isTrackReference(focusTrack)) {
      const updated = tracks.find(
        (t) => t.participant.identity === focusTrack.participant.identity && t.source === focusTrack.source,
      );
      if (updated !== focusTrack && updated && isTrackReference(updated)) {
        layoutContext.pin.dispatch?.({ msg: 'set_pin', trackReference: updated });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shareKey, focusTrack?.publication?.trackSid, tracks]);

  /**
   * 手机上弹出软键盘时,布局视口**不缩** —— 而会议台是 position:fixed 钉在布局视口上的,
   * 于是聊天输入框和「发送」被推到键盘底下,人在盲打。visualViewport 是唯一能感知键盘的
   * 东西,把它的高度和滚动偏移写成 CSS 变量,让整个台子跟着缩(见 meet.css)。
   */
  useEffect(() => {
    const vv = typeof window === 'undefined' ? null : window.visualViewport;
    if (!vv) return;
    const root = document.documentElement.style;
    const apply = () => {
      root.setProperty('--meet-vvh', `${vv.height}px`);
      root.setProperty('--meet-vvt', `${vv.offsetTop}px`);
    };
    apply();
    vv.addEventListener('resize', apply);
    vv.addEventListener('scroll', apply);
    return () => {
      vv.removeEventListener('resize', apply);
      vv.removeEventListener('scroll', apply);
      root.removeProperty('--meet-vvh');
      root.removeProperty('--meet-vvt');
    };
  }, []);

  const toggleChat = useCallback(() => {
    setShowChat((v) => {
      if (!v) setUnread(0);
      return !v;
    });
    setShowRoster(false);
  }, []);

  const toggleRoster = useCallback(() => {
    setShowRoster((v) => !v);
    setShowChat(false);
  }, []);

  return (
    <div className="lk-video-conference meet-stage">
      <LayoutContextProvider value={layoutContext}>
        <div className="lk-video-conference-inner">
          {!focusTrack ? (
            <div className="lk-grid-layout-wrapper">
              <GridLayout tracks={tracks}>
                <ParticipantTile />
              </GridLayout>
            </div>
          ) : (
            <div className="lk-focus-layout-wrapper">
              <FocusLayoutContainer>
                <CarouselLayout tracks={carouselTracks}>
                  <ParticipantTile />
                </CarouselLayout>
                <FocusLayout trackRef={focusTrack} />
              </FocusLayoutContainer>
            </div>
          )}
          <MeetControlBar
            showChat={showChat}
            unread={unread}
            onToggleChat={toggleChat}
            showRoster={showRoster}
            onToggleRoster={toggleRoster}
            remoteScreenShare={screenShareTracks.some((t) => !t.participant.isLocal)}
          />
        </div>
        <MeetChat open={showChat} onClose={toggleChat} onUnread={setUnread} />
        <MeetRoster open={showRoster} onClose={toggleRoster} />
      </LayoutContextProvider>
      <RoomAudioRenderer />
      <MeetConnectionToast />
    </div>
  );
}

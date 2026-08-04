'use client';

/**
 * 会议底部控制条。库里 <ControlBar/> 的中文版,外加参与者面板和屏幕共享互斥。
 *
 * 沿用库的 .lk-control-bar / .lk-button-group 等类名 —— 样式是现成的,而且升级时跟着变;
 * 这里只负责「说人话」和「什么时候该灰掉」。
 *
 * 按钮的显隐照库的规矩走 useLocalParticipantPermissions:服务端签 token 时把
 * canPublishSources 钉死了(对战房只有摄像头和麦克风),没有的权限就不该画出一个按了没反应
 * 的按钮。
 */

import { useCallback, useState } from 'react';
import { Track } from 'livekit-client';
import {
  DisconnectButton,
  MediaDeviceMenu,
  StartMediaButton,
  TrackToggle,
  useLocalParticipantPermissions,
  usePersistentUserChoices,
} from '@livekit/components-react';
import { MessageSquare, PhoneOff, ScreenShare, Users } from 'lucide-react';

import { tr } from '@/i18n/tr';
import { useIsMobile } from '@/hooks/useIsMobile';

/** 与库的 ControlBar 同一张表(protocol 的 TrackSource 数值),免得为它多装一个包。 */
const SOURCE_TO_PROTOCOL: Partial<Record<Track.Source, number>> = {
  [Track.Source.Camera]: 1,
  [Track.Source.Microphone]: 2,
  [Track.Source.ScreenShare]: 3,
};

export interface MeetControlBarProps {
  showChat: boolean;
  unread: number;
  onToggleChat: () => void;
  showRoster: boolean;
  onToggleRoster: () => void;
  /** 别人正在共享屏幕。带宽闸只按同时一路算钱,所以此时本人的共享按钮要灰掉。 */
  remoteScreenShare: boolean;
}

export default function MeetControlBar({
  showChat,
  unread,
  onToggleChat,
  showRoster,
  onToggleRoster,
  remoteScreenShare,
}: MeetControlBarProps) {
  // 窄屏只留图标:六个按钮带文字在手机上必然换行,把画面挤没。
  const compact = useIsMobile(760);
  const [sharing, setSharing] = useState(false);
  const permissions = useLocalParticipantPermissions();

  const {
    saveAudioInputEnabled,
    saveVideoInputEnabled,
    saveAudioInputDeviceId,
    saveVideoInputDeviceId,
  } = usePersistentUserChoices({});

  const can = useCallback(
    (source: Track.Source) => {
      if (!permissions?.canPublish) return false;
      const wanted = SOURCE_TO_PROTOCOL[source];
      return (
        permissions.canPublishSources.length === 0 ||
        (wanted !== undefined && permissions.canPublishSources.includes(wanted))
      );
    },
    [permissions],
  );

  // 浏览器不支持就别画:iOS Safari 至今没有 getDisplayMedia。
  const canShareScreen =
    can(Track.Source.ScreenShare) &&
    typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices?.getDisplayMedia === 'function';

  const micLabel = tr({ zh: '麦克风', en: 'Microphone' });
  const camLabel = tr({ zh: '摄像头', en: 'Camera' });
  const shareLabel = sharing
    ? tr({ zh: '停止共享', en: 'Stop share' })
    : tr({ zh: '共享屏幕', en: 'Share screen' });
  const chatLabel = tr({ zh: '聊天', en: 'Chat' });
  const rosterLabel = tr({ zh: '参与者', en: 'People' });
  const leaveLabel = tr({ zh: '离开会议', en: 'Leave' });

  // 已经有人在共享:换成一个真 disabled 的按钮,而不是给 TrackToggle 传 disabled ——
  // useTrackToggle 的 buttonProps 里 `disabled: pending` 排在展开之后,会把它盖掉。
  const shareBlocked = remoteScreenShare && !sharing;

  return (
    <div className="lk-control-bar">
      {can(Track.Source.Microphone) && (
        <div className="lk-button-group">
          <TrackToggle
            source={Track.Source.Microphone}
            showIcon
            onChange={(enabled, userInitiated) => { if (userInitiated) saveAudioInputEnabled(enabled); }}
          >
            {!compact && micLabel}
          </TrackToggle>
          <div className="lk-button-group-menu">
            <MediaDeviceMenu
              kind="audioinput"
              aria-label={tr({ zh: '选择麦克风', en: 'Select microphone' })}
              onActiveDeviceChange={(_kind, deviceId) => saveAudioInputDeviceId(deviceId ?? 'default')}
            />
          </div>
        </div>
      )}

      {can(Track.Source.Camera) && (
        <div className="lk-button-group">
          <TrackToggle
            source={Track.Source.Camera}
            showIcon
            onChange={(enabled, userInitiated) => { if (userInitiated) saveVideoInputEnabled(enabled); }}
          >
            {!compact && camLabel}
          </TrackToggle>
          <div className="lk-button-group-menu">
            <MediaDeviceMenu
              kind="videoinput"
              aria-label={tr({ zh: '选择摄像头', en: 'Select camera' })}
              onActiveDeviceChange={(_kind, deviceId) => saveVideoInputDeviceId(deviceId ?? 'default')}
            />
          </div>
        </div>
      )}

      {canShareScreen && (shareBlocked ? (
        <button
          type="button"
          className="lk-button"
          disabled
          aria-label={shareLabel}
          title={tr({ zh: '已经有人在共享屏幕了', en: 'Someone else is already sharing' })}
        >
          <ScreenShare size={16} />
          {!compact && shareLabel}
        </button>
      ) : (
        <TrackToggle
          source={Track.Source.ScreenShare}
          captureOptions={{ audio: true, selfBrowserSurface: 'include' }}
          showIcon={false}
          aria-label={shareLabel}
          title={shareLabel}
          onChange={setSharing}
        >
          <ScreenShare size={16} />
          {!compact && shareLabel}
        </TrackToggle>
      ))}

      <button
        type="button"
        className="lk-button meet-widget-toggle"
        aria-pressed={showRoster}
        aria-label={rosterLabel}
        title={rosterLabel}
        onClick={onToggleRoster}
      >
        <Users size={16} />
        {!compact && rosterLabel}
      </button>

      <button
        type="button"
        className="lk-button meet-widget-toggle"
        aria-pressed={showChat}
        aria-label={chatLabel}
        title={chatLabel}
        onClick={onToggleChat}
      >
        <MessageSquare size={16} />
        {!compact && chatLabel}
        {unread > 0 && !showChat && <span className="meet-unread">{unread}</span>}
      </button>

      <DisconnectButton aria-label={leaveLabel} title={leaveLabel}>
        <PhoneOff size={16} />
        {!compact && leaveLabel}
      </DisconnectButton>

      {/* 浏览器的自动播放策略把声音拦下来时才出现的那个按钮。 */}
      <StartMediaButton label={tr({ zh: '点击播放声音', en: 'Click to allow audio' })} />
    </div>
  );
}

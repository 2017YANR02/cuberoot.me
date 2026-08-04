'use client';

/**
 * 参与者面板。库的成品件没有这个 —— 而宫格在手机上一页只放得下两格,没有名单的话
 * 「还有谁在会里」根本无从得知(Zoom / 腾讯会议都把它放在控制条上)。
 *
 * 每行三样:是谁、麦克风和摄像头开没开、网络质量。都取自 LiveKit 的参与者对象,
 * 不额外发一条自己的心跳。
 */

import { Mic, MicOff, Video, VideoOff } from 'lucide-react';
import { ConnectionQualityIndicator, useParticipants } from '@livekit/components-react';

import { tr } from '@/i18n/tr';

export interface MeetRosterProps {
  open: boolean;
  onClose: () => void;
}

export default function MeetRoster({ open, onClose }: MeetRosterProps) {
  const participants = useParticipants();

  return (
    <div className="meet-roster" style={{ display: open ? 'grid' : 'none' }}>
      <div className="lk-chat-header">
        {tr({ zh: `参与者 ${participants.length}`, en: `People (${participants.length})` })}
        <button
          type="button"
          className="lk-button lk-close-button"
          aria-label={tr({ zh: '关闭参与者列表', en: 'Close people panel' })}
          onClick={onClose}
        >
          ✕
        </button>
      </div>

      <ul className="lk-list meet-roster-list">
        {participants.map((p) => (
          <li key={p.identity} className="meet-roster-row">
            <span className="meet-roster-name">
              {p.name || p.identity}
              {p.isLocal && <span className="meet-roster-me">{tr({ zh: '(我)', en: '(you)' })}</span>}
            </span>
            <span
              className="meet-roster-state"
              data-off={!p.isMicrophoneEnabled || undefined}
              title={p.isMicrophoneEnabled ? tr({ zh: '麦克风开启', en: 'Mic on' }) : tr({ zh: '已静音', en: 'Muted' })}
            >
              {p.isMicrophoneEnabled ? <Mic size={14} /> : <MicOff size={14} />}
            </span>
            <span
              className="meet-roster-state"
              data-off={!p.isCameraEnabled || undefined}
              title={p.isCameraEnabled ? tr({ zh: '摄像头开启', en: 'Camera on' }) : tr({ zh: '摄像头关闭', en: 'Camera off' })}
            >
              {p.isCameraEnabled ? <Video size={14} /> : <VideoOff size={14} />}
            </span>
            <ConnectionQualityIndicator participant={p} />
          </li>
        ))}
      </ul>
    </div>
  );
}

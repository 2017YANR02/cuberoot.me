import { CubingIcon } from '@cuberoot/event-icon';
import type { ComponentProps, ReactNode } from 'react';
import { RoomQrModal } from './RoomQrModal';
import { TimerTopbar, type TimerTopbarProps } from './TimerChrome';
import { TimerPuzzlePicker } from './TimerPuzzlePicker';
import { TimerRoomAdmin } from './TimerRoomAdmin';
import { TimerRoomDialog } from './TimerRoomDialog';
import { TimerRoomHistory } from './TimerRoomHistory';
import { TimerRoomLayout } from './TimerRoomLayout';
import { TimerRoomLobby } from './TimerRoomLobby';
import { TimerRoomPlayers } from './TimerRoomPlayers';
import { TimerRoomRoundStatus } from './TimerRoomRoundStatus';
import { TimerRoomToolbar } from './TimerRoomToolbar';
import { TimerScrambleStrip } from './TimerScrambleStrip';
import { TimerWorkspace } from './TimerWorkspace';
import TimingSurface from './TimingSurface';
import VideoStrip, { VideoToggle, type VideoRoom } from './video/TimerBattleVideo';

export interface TimerNetBattleStageProps {
  timing: Omit<ComponentProps<typeof TimingSurface>, 'children' | 'layout' | 'scrambleSlot'>;
  status: ComponentProps<typeof TimerRoomRoundStatus>;
  scramble: Omit<ComponentProps<typeof TimerScrambleStrip>, 'copiedLabel' | 'fallback' | 'fallbackKind' | 'verificationLabels'>;
  error?: string | null;
}
export function TimerNetBattleStage({ timing, status, scramble, error }: TimerNetBattleStageProps) {
  return <TimingSurface {...timing} layout="net" scrambleSlot={<TimerScrambleStrip {...scramble}
    copiedLabel={{ en: 'Copied', zh: '已复制' }[status.language]}
    fallback={{ en: 'Generating scramble…', zh: '生成打乱中…' }[status.language]} fallbackKind="custom"
    verificationLabels={{ copiedCorrection: { en: 'Copied the scramble', zh: '已复制原打乱' }[status.language] }} />} >
    <TimerRoomRoundStatus {...status} />
    {error && <p role="alert" data-no-timer>{error}</p>}
  </TimingSurface>;
}
export interface TimerNetBattlePageProps {
  language: 'en' | 'zh';
  className?: string;
  mainClassName?: string;
  ariaLabel?: string;
  solving?: boolean;
  topbar: TimerTopbarProps;
  video: VideoRoom;
  unavailable?: ReactNode;
  lobby?: ComponentProps<typeof TimerRoomLobby>;
  room?: {
    devices?: ReactNode;
    toolbar: ComponentProps<typeof TimerRoomToolbar>;
    players?: ComponentProps<typeof TimerRoomPlayers>;
    stage: TimerNetBattleStageProps;
    /** Existing specialized Web arena; no new entry is introduced by this slot. */
    renderStage?(own: ReactNode): ReactNode;
    admin?: ComponentProps<typeof TimerRoomAdmin> | false;
    history?: ComponentProps<typeof TimerRoomHistory> | false;
    qr?: Omit<ComponentProps<typeof RoomQrModal>, 'labels'> & { labels?: ComponentProps<typeof RoomQrModal>['labels'] } | false;
    rename?: { identity: ReactNode; busy?: boolean; onClose(): void; onSave(): void } | false;
  };
  overlays?: ReactNode;
  recap?: ReactNode;
}

/** Complete online page presentation. Hosts supply room/input/storage/device adapters. */
export function TimerNetBattlePage({ language, className, mainClassName, ariaLabel, solving, topbar, video, unavailable, lobby, room, overlays, recap }: TimerNetBattlePageProps) {
  const ownStage = room && <TimerNetBattleStage {...room.stage} />;
  return <TimerWorkspace className={className} aria-label={ariaLabel} data-solving={solving ? 'true' : undefined}>
    <TimerTopbar {...topbar} controls={<>{topbar.controls}<VideoToggle video={video} /></>} />
    {unavailable && <div className="timer-workspace-main"><p className="battle-empty">{unavailable}</p></div>}
    {!room && lobby && <div className={`timer-workspace-main ${mainClassName ?? ''}`}><TimerRoomLobby {...lobby} /></div>}
    {room && <>
      <TimerRoomLayout className={`timer-workspace-main ${mainClassName ?? ''}`} devices={room.devices}
        toolbar={<TimerRoomToolbar {...room.toolbar} />}
        players={room.players && <TimerRoomPlayers {...room.players} />}
        media={<VideoStrip video={video} />}>
        {room.renderStage ? room.renderStage(ownStage) : ownStage}
        {recap}
      </TimerRoomLayout>
      {room.admin && <TimerRoomAdmin {...room.admin} />}
      {room.qr && <RoomQrModal {...room.qr} labels={room.qr.labels ?? {
        close: { en: 'Close', zh: '关闭' }[language], copied: { en: 'Copied', zh: '已复制' }[language],
        copyFailed: { en: 'Copy failed. Try again.', zh: '复制失败，请重试' }[language],
        copyInvite: { en: 'Copy invite link', zh: '复制邀请链接' }[language], scanToJoin: { en: 'Scan to join', zh: '扫码加入' }[language],
      }} />}
      {room.rename && <TimerRoomDialog language={language} title={{ en: 'Change name', zh: '改名' }[language]} onClose={room.rename.onClose}>
        {room.rename.identity}
        <div className="timer-room-actions"><button type="button" disabled={room.rename.busy} onClick={room.rename.onSave}>
          {{ en: 'Save', zh: '保存' }[language]}
        </button></div>
      </TimerRoomDialog>}
      {room.history && <TimerRoomHistory {...room.history} />}
    </>}
    {overlays}
  </TimerWorkspace>;
}

/** Completed and late-joining players see the same static event label in every host. */
export function TimerNetBattleEvent({ picker, locked }: { picker: ComponentProps<typeof TimerPuzzlePicker>; locked: boolean }) {
  if (!locked) return <TimerPuzzlePicker {...picker} />;
  const item = picker.groups.flatMap(group => group.items).find(item => item.id === picker.selectedEvent);
  return <span className="timer-room-event" title={item?.label}>
    {item?.iconClass && <CubingIcon icon={item.iconClass} />}
    <span>{item?.label ?? picker.selectedEvent}</span>
  </span>;
}

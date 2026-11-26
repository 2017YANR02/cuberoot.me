import { CubingIcon } from '@cuberoot/event-icon';
import { TIMER_NET_SCRAMBLE_COPY, TIMER_ROOM_TOOLBAR_COPY } from '@cuberoot/shared/timer/net-battle';
import type { ComponentProps, ReactNode } from 'react';
import { useClipboardFeedback } from './browser-clipboard';
import { RoomQrModal } from './RoomQrModal';
import { TimerNetBattleSettings } from './TimerNetBattleSettings';
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
  copyScramble?: { text: string; writeText(text: string): Promise<void> };
  error?: string | null;
  deviceNotice?: string | null;
}
export function TimerNetBattleStage({ timing, status, scramble, copyScramble, error, deviceNotice }: TimerNetBattleStageProps) {
  const { room, currentPlayerId, language } = status;
  const rawScramble = copyScramble?.text ?? '';
  const text = TIMER_NET_SCRAMBLE_COPY[language];
  const { copy, feedback } = useClipboardFeedback(
    JSON.stringify([room.code, room.round, currentPlayerId, rawScramble]), copyScramble?.writeText,
  );
  return <TimingSurface {...timing} layout="net" scrambleSlot={<TimerScrambleStrip {...scramble}
    onActivate={rawScramble ? () => void copy(rawScramble) : scramble.onActivate}
    activationLabel={rawScramble ? `${text.action}: ${scramble.scramble}` : scramble.activationLabel}
    copied={feedback?.copied ?? scramble.copied}
    copiedLabel={text.copied}
    fallback={text.loading} fallbackKind="custom"
    verificationLabels={{ copiedCorrection: text.copied }} />} >
    <TimerRoomRoundStatus {...status} />
    <span className="sr-only" role="status">{feedback?.copied ? text.copied : ''}</span>
    {feedback && !feedback.copied && <p role="alert" data-no-timer>{text.failed}</p>}
    {error && <p role="alert" data-no-timer>{error}</p>}
    {deviceNotice && <p className="timer-room-device-notice" role="status" data-no-timer>{deviceNotice}</p>}
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
    toolbar: Omit<ComponentProps<typeof TimerRoomToolbar>, 'room'>;
    players?: ComponentProps<typeof TimerRoomPlayers>;
    stage: TimerNetBattleStageProps;
    /** Existing specialized Web arena; no new entry is introduced by this slot. */
    renderStage?(own: ReactNode): ReactNode;
    admin?: ComponentProps<typeof TimerRoomAdmin> | false;
    history?: ComponentProps<typeof TimerRoomHistory> | false;
    settings?: Omit<ComponentProps<typeof TimerNetBattleSettings>, 'language'> | false;
    qr?: Omit<ComponentProps<typeof RoomQrModal>, 'labels' | 'language'> | false;
    rename?: { identity: ReactNode; busy?: boolean; onClose(): void; onSave(): void } | false;
  };
  overlays?: ReactNode;
  recap?: ReactNode;
}

/** Complete online page presentation. Hosts supply room/input/storage/device adapters. */
export function TimerNetBattlePage({ language, className, mainClassName, ariaLabel, solving, topbar, video, unavailable, lobby, room, overlays, recap }: TimerNetBattlePageProps) {
  const ownStage = room && <TimerNetBattleStage {...room.stage} />;
  const toolbarCopy = TIMER_ROOM_TOOLBAR_COPY[language];
  return <TimerWorkspace className={className} aria-label={ariaLabel} data-solving={solving ? 'true' : undefined}>
    <TimerTopbar {...topbar} controls={<>{topbar.controls}<VideoToggle video={video} /></>} />
    {unavailable && <div className="timer-workspace-main"><p className="battle-empty">{unavailable}</p></div>}
    {!room && lobby && <div className={`timer-workspace-main ${mainClassName ?? ''}`}><TimerRoomLobby {...lobby} /></div>}
    {room && <>
      <TimerRoomLayout className={`timer-workspace-main ${mainClassName ?? ''}`} devices={room.devices}
        toolbar={<TimerRoomToolbar {...room.toolbar} room={room.stage.status.room} />}
        players={room.players && <TimerRoomPlayers {...room.players} />}
        media={<VideoStrip video={video} />}>
        {room.renderStage ? room.renderStage(ownStage) : ownStage}
        {!solving && recap && <div data-no-timer>{recap}</div>}
      </TimerRoomLayout>
      {room.admin && <TimerRoomAdmin {...room.admin} />}
      {room.qr && <RoomQrModal {...room.qr} language={language} labels={{
        copiedCode: toolbarCopy.copiedCode,
        copiedInvite: toolbarCopy.copiedInvite,
        copyCode: toolbarCopy.code,
        copyInvite: toolbarCopy.invite,
        copyFailed: TIMER_NET_SCRAMBLE_COPY[language].failed,
        scanToJoin: { en: 'Scan to join', zh: '扫码加入' }[language],
      }} />}
      {room.rename && <TimerRoomDialog language={language} title={{ en: 'Change name', zh: '改名' }[language]} onClose={room.rename.onClose}>
        {room.rename.identity}
        <div className="timer-room-actions"><button type="button" disabled={room.rename.busy} onClick={room.rename.onSave}>
          {{ en: 'Save', zh: '保存' }[language]}
        </button></div>
      </TimerRoomDialog>}
      {room.history && <TimerRoomHistory {...room.history} />}
      {room.settings && <TimerNetBattleSettings {...room.settings} language={language} />}
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

import type { ReactNode } from 'react';
import { TimerStageLayout } from './TimerStageLayout';

export function TimerRoomLayout({ children, players, media, toolbar, devices, className }: {
  children: ReactNode;
  players?: ReactNode;
  media?: ReactNode;
  toolbar?: ReactNode;
  devices?: ReactNode;
  className?: string;
}) {
  return <TimerStageLayout className={`timer-room-layout${className ? ` ${className}` : ''}`} devices={devices}>
    {toolbar}
    {players}
    {media}
    <div className="timer-room-stage">{children}</div>
  </TimerStageLayout>;
}

import type { ReactNode } from 'react';

export function TimerRoomLayout({ children, players, media, className }: {
  children: ReactNode;
  players?: ReactNode;
  media?: ReactNode;
  className?: string;
}) {
  return <div className={`timer-room-layout${className ? ` ${className}` : ''}`}>
    {players}
    {media}
    <div className="timer-room-stage">{children}</div>
  </div>;
}

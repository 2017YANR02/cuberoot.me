import type { HTMLAttributes, ReactNode, RefObject } from 'react';

export interface TimerStageLayoutProps {
  children: ReactNode;
  className?: string;
  devices?: ReactNode;
  fullscreen?: boolean;
  rankings?: ReactNode;
  source?: ReactNode;
  statistics?: ReactNode;
  inputRef?: RefObject<HTMLDivElement | null>;
  inputHandlers?: Pick<HTMLAttributes<HTMLDivElement>, 'onContextMenu' | 'onMouseDown' | 'onMouseUp' | 'onPointerDown' | 'onPointerUp' | 'onPointerCancel'>;
}

/** Shared single-player composition. Hosts supply controls and callbacks;
 * this layer owns source/content/footer order and the device-menu anchor. */
export function TimerStageLayout({
  children, className, devices, fullscreen = false, rankings, source, statistics, inputRef, inputHandlers,
}: TimerStageLayoutProps) {
  return (
    <div ref={inputRef} {...inputHandlers} className={`timer-stage-layout${className ? ` ${className}` : ''}`} data-stage-fullscreen={fullscreen}>
      {source && <div className="timer-stage-source surface-chrome" data-no-timer hidden={fullscreen}>{source}</div>}
      {children}
      {(statistics || devices || rankings) && (
        <div className="timer-stage-footer surface-chrome" hidden={fullscreen}>
          <div className="timer-stage-statistics" data-no-timer>{statistics}</div>
          {rankings && <div className="timer-stage-rankings" data-no-timer>{rankings}</div>}
          <div className="timer-stage-devices" data-no-timer>{devices}</div>
        </div>
      )}
    </div>
  );
}

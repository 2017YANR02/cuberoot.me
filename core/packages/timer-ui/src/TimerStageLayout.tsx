import type { ReactNode } from 'react';

export interface TimerStageLayoutProps {
  children: ReactNode;
  className?: string;
  devices?: ReactNode;
  fullscreen?: boolean;
  source?: ReactNode;
  statistics?: ReactNode;
}

/** Shared single-player composition. Hosts supply controls and callbacks;
 * this layer owns source/content/footer order and the device-menu anchor. */
export function TimerStageLayout({
  children, className, devices, fullscreen = false, source, statistics,
}: TimerStageLayoutProps) {
  return (
    <div className={`timer-stage-layout${className ? ` ${className}` : ''}`}>
      {source && <div className="timer-stage-source surface-chrome" hidden={fullscreen}>{source}</div>}
      {children}
      {(statistics || devices) && (
        <div className="timer-stage-footer surface-chrome" data-no-timer hidden={fullscreen}>
          <div className="timer-stage-statistics">{statistics}</div>
          <div className="timer-stage-devices">{devices}</div>
        </div>
      )}
    </div>
  );
}

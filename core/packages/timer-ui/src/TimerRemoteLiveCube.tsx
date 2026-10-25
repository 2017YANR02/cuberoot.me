import type { ComponentProps } from 'react';
import LiveCubeState from './LiveCubeState';
import type { NetBattleLiveCubePlayer } from './net-battle-live';
import './net-live.css';
export function TimerRemoteLiveCube({ playerId, live, ownerLabel, reconnecting = false, mode, language }: {
  playerId: string; live: NetBattleLiveCubePlayer; ownerLabel?: string; reconnecting?: boolean;
  mode: ComponentProps<typeof LiveCubeState>['mode']; language: 'en' | 'zh';
}) {
  const tr = (text: { en: string; zh: string }) => text[language];
  return (
    <div className="shell-corner-net net-remote-cube-slot">
      {ownerLabel && <div className="net-cube-owner">{ownerLabel} · {tr({ zh: '实况', en: 'live' })}</div>}
      <div className="shell-corner-net-imgbox">
        <div
          className="timer-live-cube"
          data-no-timer
          title={tr({ zh: '对方智能魔方实时状态', en: "Opponent's live smart-cube state" })}
        >
          <LiveCubeState
            key={`${playerId}:${live.round ?? 0}`}
            facelets={live.facelets}
            moves={[...live.moves]}
            algAnchored={live.algAnchored}
            mode={mode} language={language}
            useGyro={false}
          />
        </div>
      </div>
      {reconnecting && (
        <div className="net-cube-connection-state">
          {tr({ zh: '实况重连中…', en: 'Reconnecting live feed…' })}
        </div>
      )}
    </div>
  );
}

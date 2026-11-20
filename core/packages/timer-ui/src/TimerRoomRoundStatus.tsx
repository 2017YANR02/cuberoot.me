import { TIMER_ROOM_ROUND_STATUS_COPY } from '@cuberoot/shared/timer/net-battle';
import { isNetRoundParticipant, pendingCount, roundWinners, syncGate, type NetRoomState, type NetPenalty } from '@cuberoot/shared/timer';
import { TimerPenaltyActions } from './TimerPenaltyActions';
import { timerRoomPlayerName } from './TimerRoomPlayers';

export interface TimerRoomRoundStatusProps {
  room: NetRoomState;
  currentPlayerId: string;
  language: 'en' | 'zh';
  idle: boolean;
  countdown: boolean;
  cubeAutoReadySuspended?: boolean;
  onPenalty(value: NetPenalty): void;
  onReady(): void;
  onNext(force: boolean): void;
}

export function TimerRoomRoundStatus({ room, currentPlayerId, language, idle, countdown, cubeAutoReadySuspended, onPenalty, onReady, onNext }: TimerRoomRoundStatusProps) {
  const copy = TIMER_ROOM_ROUND_STATUS_COPY[language];
  const result = room.results[String(room.round)]?.[currentPlayerId];
  const gate = syncGate(room, currentPlayerId);
  const waiting = pendingCount(room);
  const winners = roundWinners(room.results[String(room.round)], room.players);
  if (countdown) return <div className="timer-room-round-status" data-no-timer role="status">{copy.countdown}</div>;
  if (!idle) return null;
  if (result) return <div className="timer-room-round-status" data-no-timer>
    <TimerPenaltyActions language={language} value={result.p} onChange={onPenalty} />
    <p role="status">{waiting > 0 ? copy.pending(waiting) : winners.length ? winners.map((id) => timerRoomPlayerName(room.players[id], language)).join(' / ') : copy.noResult}</p>
    <div className="timer-room-actions"><button type="button" onClick={() => onNext(waiting > 0)}>{waiting > 0 ? copy.skip : copy.next}</button></div>
  </div>;
  if (!isNetRoundParticipant(room, currentPlayerId)) return <p className="timer-room-round-status" data-no-timer>{copy.spectator}</p>;
  if (!gate.gated) return null;
  return <div className="timer-room-round-status" data-no-timer>
    <div className="timer-room-actions"><button type="button" aria-pressed={gate.ready} onClick={onReady}>{gate.ready ? copy.cancel : copy.ready}</button></div>
    <p role="status">{gate.ready ? copy.waiting(gate.waiting) : copy.sync}</p>
    {cubeAutoReadySuspended && <p>{copy.auto}</p>}
  </div>;
}

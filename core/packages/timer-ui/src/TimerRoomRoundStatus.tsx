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
const COPY = {
  en: { ready: "I'm ready", cancel: 'Cancel ready', skip: 'Skip waiting — next round', next: 'Next round', noResult: 'No valid result this round', pending: (n: number) => `Waiting for others to finish (${n} left)…`, waiting: (n: number) => `Waiting for others to get ready (${n} left)…`, sync: 'A 3s countdown begins once everyone is ready', auto: 'Auto-ready is off during a synchronized start. Tap ready; the cube stops the timer when solved.', spectator: 'This round has started. You can watch and join the next round.', countdown: 'Starting together — get ready!' },
  zh: { ready: '我准备好了', cancel: '取消准备', skip: '不等了，直接开下一轮', next: '下一轮', noResult: '本轮无有效成绩', pending: (n: number) => `等待其他玩家完成（还差 ${n} 人）…`, waiting: (n: number) => `等其他人准备（还差 ${n} 人）…`, sync: '全员准备后，3 秒倒计时一起开始', auto: '同时起表期间不自动预备，请手动准备；魔方还原时停表。', spectator: '本轮已经开始，你可以旁观并等待下一轮', countdown: '一起起表，准备！' },
};
export function TimerRoomRoundStatus({ room, currentPlayerId, language, idle, countdown, cubeAutoReadySuspended, onPenalty, onReady, onNext }: TimerRoomRoundStatusProps) {
  const copy = COPY[language];
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

import { TIMER_ROOM_HISTORY_COPY, TIMER_NET_SCRAMBLE_COPY, formatNetHistoryStat, formatNetHistoryResult, formatNetRoomStandings, netRoomStandings } from '@cuberoot/shared/timer/net-battle';
import { effectiveNetMs, roundViews, type NetRoomState, type NetBattleEventId } from '@cuberoot/shared/timer';
import { formatScrambleForEvent } from '@cuberoot/shared/sq1-notation';
import { Check, Copy, Trophy } from 'lucide-react';
import { useClipboardFeedback } from './browser-clipboard';
import { Flag } from './CountryFlag';
import { TimerCubePreview } from './TimerCubePreview';
import { TimerRoomDialog } from './TimerRoomDialog';
import { timerRoomPlayerName } from './TimerRoomPlayers';

export interface TimerRoomHistoryProps {
  room: NetRoomState;
  currentPlayerId: string | null;
  language: 'en' | 'zh';
  precision: 0 | 1 | 2 | 3;
  onClose(): void;
  writeClipboardText?(text: string): Promise<void>;
  canInspectAttempt?(round: number): boolean;
  onInspectAttempt?(round: number): void;
}


export function TimerRoomHistory({ room, currentPlayerId, language, precision, onClose, writeClipboardText, canInspectAttempt, onInspectAttempt }: TimerRoomHistoryProps) {
  const copy = TIMER_ROOM_HISTORY_COPY[language];
  const name = (id: string) => room.players[id] ? timerRoomPlayerName(room.players[id], language) : copy.unknown;
  const standings = netRoomStandings(room);
  const clipboard = useClipboardFeedback(room.code, writeClipboardText);
  const headerControls = writeClipboardText && <>
    <button type="button" className="timer-room-copy-standings" aria-label={copy.copy}
      onClick={() => void clipboard.copy(formatNetRoomStandings(room, language, precision, standings))}>
      {clipboard.feedback?.copied ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}{copy.copy}
    </button>
    <span className="sr-only" role="status">
      {clipboard.feedback && (clipboard.feedback.copied ? copy.copied : TIMER_NET_SCRAMBLE_COPY[language].failed)}
    </span>
  </>;
  return <TimerRoomDialog title={copy.title} language={language} onClose={onClose} headerControls={headerControls}>
    <div className="timer-room-standings-scroll"><table className="timer-room-standings">
      <thead><tr><th>{copy.player}</th><th>{copy.wins}</th><th>{copy.best}</th><th>ao5</th><th>ao12</th><th>ao50</th><th>ao100</th><th>{copy.mean}</th></tr></thead>
      <tbody>{standings.map(({ player, wins, stats }) => <tr key={player.id} className={player.id === currentPlayerId ? 'is-me' : undefined}>
          <td>{player.iso2 && <Flag iso2={player.iso2} className="timer-room-player-flag" />}{name(player.id)} <small>{player.event || room.event}</small></td>
          <td>{wins}</td><td>{formatNetHistoryStat(stats.single, precision)}</td><td>{formatNetHistoryStat(stats.ao5, precision)}</td>
          <td>{formatNetHistoryStat(stats.ao12, precision)}</td><td>{formatNetHistoryStat(stats.ao50, precision)}</td><td>{formatNetHistoryStat(stats.ao100, precision)}</td>
          <td>{formatNetHistoryStat(stats.mean, precision)} <small>mo{stats.count}</small></td>
        </tr>)}</tbody>
    </table></div>
    <h3>{copy.history}</h3>
    <ol className="timer-room-history">
      {roundViews(room).map((round) => {
        const events = [...new Set([...Object.keys(round.scrambles), ...Object.values(round.playerEvents)])] as NetBattleEventId[];
        return <li key={round.round}><h4>{copy.round} {round.round} {round.live && <small>{copy.live}</small>}</h4>
          {events.map((event) => {
            const scramble = round.scrambles[event];
            const ids = Object.keys(round.playerEvents).filter((id) => round.playerEvents[id] === event)
              .sort((a, b) => (round.results[a] ? effectiveNetMs(round.results[a]) : Infinity) - (round.results[b] ? effectiveNetMs(round.results[b]) : Infinity));
            return <section key={event} className="timer-room-history-event">
              {scramble && <TimerCubePreview event={event} scramble={scramble} height="64px" visualization="2D" ariaLabel={copy.cube} />}
              <div><p><strong>{event}</strong> {scramble ? formatScrambleForEvent(event, scramble) : copy.noScramble}</p>
                {ids.map((id) => {
                  const result = round.results[id];
                  const time = formatNetHistoryResult(result, precision);
                  const inspect = id === currentPlayerId && result && onInspectAttempt && canInspectAttempt?.(round.round);
                  return <div className="timer-room-history-result" key={id}>
                    <span>{round.winners.includes(id) && <Trophy size={14} aria-label={copy.wins} />}{name(id)}</span>
                    {inspect
                      ? <button type="button" aria-label={copy.replay + ': ' + copy.round + ' ' + round.round + ' · ' + time}
                          onClick={(event) => { event.currentTarget.focus(); onInspectAttempt(round.round); }}>{time}</button>
                      : <strong>{time}</strong>}
                  </div>;
                })}
              </div>
            </section>;
          })}
        </li>;
      })}
    </ol>
  </TimerRoomDialog>;
}

import { TIMER_ROOM_HISTORY_COPY, formatNetHistoryStat, formatNetHistoryResult } from '@cuberoot/shared/timer/net-battle';
import { effectiveNetMs, playerStats, playerTimeline, roundViews, sortedNetPlayers, type NetRoomState, type NetBattleEventId } from '@cuberoot/shared/timer';
import { formatScrambleForEvent } from '@cuberoot/shared/sq1-notation';
import { Trophy } from 'lucide-react';
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
}


export function TimerRoomHistory({ room, currentPlayerId, language, precision, onClose }: TimerRoomHistoryProps) {
  const copy = TIMER_ROOM_HISTORY_COPY[language];
  const name = (id: string) => room.players[id] ? timerRoomPlayerName(room.players[id], language) : copy.unknown;
  return <TimerRoomDialog title={copy.title} language={language} onClose={onClose}>
    <div className="timer-room-standings-scroll"><table className="timer-room-standings">
      <thead><tr><th>{copy.player}</th><th>{copy.wins}</th><th>{copy.best}</th><th>ao5</th><th>ao12</th><th>ao50</th><th>ao100</th><th>{copy.mean}</th></tr></thead>
      <tbody>{sortedNetPlayers(room.players).map((player) => {
        const stats = playerStats(playerTimeline(room, player.id));
        return <tr key={player.id} className={player.id === currentPlayerId ? 'is-me' : undefined}>
          <td>{player.iso2 && <Flag iso2={player.iso2} className="timer-room-player-flag" />}{name(player.id)} <small>{player.event || room.event}</small></td>
          <td>{room.scores[player.id] ?? 0}</td><td>{formatNetHistoryStat(stats.single, precision)}</td><td>{formatNetHistoryStat(stats.ao5, precision)}</td>
          <td>{formatNetHistoryStat(stats.ao12, precision)}</td><td>{formatNetHistoryStat(stats.ao50, precision)}</td><td>{formatNetHistoryStat(stats.ao100, precision)}</td>
          <td>{formatNetHistoryStat(stats.mean, precision)} <small>mo{stats.count}</small></td>
        </tr>;
      })}</tbody>
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
                {ids.map((id) => <div className="timer-room-history-result" key={id}>
                  <span>{round.winners.includes(id) && <Trophy size={14} aria-label={copy.wins} />}{name(id)}</span><strong>{formatNetHistoryResult(round.results[id], precision)}</strong>
                </div>)}
              </div>
            </section>;
          })}
        </li>;
      })}
    </ol>
  </TimerRoomDialog>;
}

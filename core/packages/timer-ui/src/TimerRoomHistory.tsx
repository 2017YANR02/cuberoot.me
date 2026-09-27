import { effectiveNetMs, formatMs, playerStats, playerTimeline, roundViews, sortedNetPlayers, type NetRoomState, type NetResult, type NetBattleEventId } from '@cuberoot/shared/timer';
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
const COPY = {
  en: { title: 'Scramble history and results', player: 'Player', wins: 'Wins', best: 'Best', mean: 'Mean', history: 'Scramble history', round: 'Round', live: 'In progress', noScramble: 'No scramble', unknown: 'Former player', cube: 'Scramble preview' },
  zh: { title: '历史打乱与战绩', player: '选手', wins: '胜场', best: '最佳', mean: '平均', history: '历史打乱', round: '轮次', live: '进行中', noScramble: '打乱未生成', unknown: '已离开玩家', cube: '打乱预览' },
};
function stat(value: number | null, precision: 0 | 1 | 2 | 3) {
  return value === null ? '—' : !Number.isFinite(value) ? 'DNF' : formatMs(value, precision);
}
function resultText(result: NetResult | undefined, precision: 0 | 1 | 2 | 3) {
  return !result ? '—' : result.p === 'dnf' ? 'DNF' : formatMs(effectiveNetMs(result), precision) + (result.p === '+2' ? '+' : '');
}

export function TimerRoomHistory({ room, currentPlayerId, language, precision, onClose }: TimerRoomHistoryProps) {
  const copy = COPY[language];
  const name = (id: string) => room.players[id] ? timerRoomPlayerName(room.players[id], language) : copy.unknown;
  return <TimerRoomDialog title={copy.title} language={language} onClose={onClose}>
    <div className="timer-room-standings-scroll"><table className="timer-room-standings">
      <thead><tr><th>{copy.player}</th><th>{copy.wins}</th><th>{copy.best}</th><th>ao5</th><th>{copy.mean}</th></tr></thead>
      <tbody>{sortedNetPlayers(room.players).map((player) => {
        const stats = playerStats(playerTimeline(room, player.id));
        return <tr key={player.id} className={player.id === currentPlayerId ? 'is-me' : undefined}>
          <td>{player.iso2 && <Flag iso2={player.iso2} className="timer-room-player-flag" />}{name(player.id)} <small>{player.event || room.event}</small></td>
          <td>{room.scores[player.id] ?? 0}</td><td>{stat(stats.single, precision)}</td><td>{stat(stats.ao5, precision)}</td><td>{stat(stats.mean, precision)} <small>mo{stats.count}</small></td>
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
                  <span>{round.winners.includes(id) && <Trophy size={14} aria-label={copy.wins} />}{name(id)}</span><strong>{resultText(round.results[id], precision)}</strong>
                </div>)}
              </div>
            </section>;
          })}
        </li>;
      })}
    </ol>
  </TimerRoomDialog>;
}

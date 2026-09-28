import { useEffect, useState, type ReactNode } from 'react';
import { effectiveMs, formatMs, summarizeLocalBattleRounds, type LocalBattleRound } from '@cuberoot/shared/timer';
import { TimerRoomDialog } from './TimerRoomDialog';
import { TimerCubePreview } from './TimerCubePreview';
import { Trophy } from 'lucide-react';

export interface TimerBattleHistoryProps {
  rounds: readonly LocalBattleRound[];
  playerCount: number;
  language: 'en' | 'zh';
  precision: 0 | 1 | 2 | 3;
  warning?: ReactNode;
  legacy?: ReactNode;
  onClose(): void;
  onBackChange?(close: (() => void) | null): void;
  onDelete?(roundId: string): void;
  onClear?(): void;
  onExport?(): void;
  roundActions?(round: LocalBattleRound): ReactNode;
}
const COPY = {
  en: { title: 'Local battle history', empty: 'No rounds yet', player: 'Player', attempts: 'Attempts', wins: 'Wins', best: 'Best', round: 'Round', scramble: 'Scramble', delete: 'Delete round', clear: 'Clear history', confirm: 'Confirm', back: 'Back to rounds', preview: 'Scramble preview' },
  zh: { title: '本地对战历史', empty: '暂无对战记录', player: '玩家', attempts: '次数', wins: '胜场', best: '最佳', round: '轮次', scramble: '打乱', delete: '删除此轮', clear: '清空历史', confirm: '确认', back: '返回轮次', preview: '打乱预览' },
};

export function TimerBattleHistory({ rounds, playerCount, language, precision, warning, legacy, onClose, onBackChange, onDelete, onClear, onExport, roundActions }: TimerBattleHistoryProps) {
  const copy = COPY[language];
  const [detailId, setDetailId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const detail = rounds.find((round) => round.id === detailId);
  useEffect(() => {
    onBackChange?.(detail ? () => setDetailId(null) : onClose);
    return () => onBackChange?.(null);
  }, [detail, onBackChange, onClose]);
  const summaries = summarizeLocalBattleRounds(rounds, playerCount);
  const result = (solve: LocalBattleRound['attempts'][number]['solve']) => {
    const ms = effectiveMs(solve);
    return !Number.isFinite(ms) ? 'DNF' : formatMs(ms, precision) + (solve.penalty === '+2' ? '+' : '');
  };
  return <TimerRoomDialog key={detail?.id ?? 'list'} title={copy.title} language={language} onClose={detail ? () => setDetailId(null) : onClose}>
    {warning}
    {detail ? <>
      <div className="timer-room-actions"><button type="button" onClick={() => { setDetailId(null); setConfirm(null); }}>{copy.back}</button></div>
      <h3>{copy.round} {rounds.indexOf(detail) + 1}</h3>
      <time dateTime={new Date(detail.ts).toISOString()}>{new Date(detail.ts).toLocaleString(language === 'zh' ? 'zh-CN' : 'en-US')}</time>
      <div className="timer-battle-history-results">{detail.attempts.map(({ playerId, solve }) => <div key={playerId}>
        <span>{copy.player} {playerId + 1} · {solve.event}</span><strong>{result(solve)}</strong>
        {detail.winners.includes(playerId) && <Trophy size={18} aria-label={copy.wins} />}
      </div>)}</div>
      {detail.attempts.filter((attempt, index, all) => all.findIndex((other) => other.solve.event === attempt.solve.event && other.solve.scramble === attempt.solve.scramble) === index).map(({ solve }) => <section className="timer-battle-history-scramble" key={`${solve.event}:${solve.scramble}`}>
        <h4>{copy.scramble} · {solve.event}</h4><p>{solve.scramble}</p>
        <TimerCubePreview event={solve.event} scramble={solve.scramble} height="100px" visualization="2D" ariaLabel={copy.preview} />
      </section>)}
      <div className="timer-room-actions">
        {roundActions?.(detail)}
        {onDelete && <button type="button" onBlur={() => setConfirm(null)} onClick={() => {
          if (confirm !== detail.id) { setConfirm(detail.id); return; }
          onDelete(detail.id); setDetailId(null); setConfirm(null);
        }}>{confirm === detail.id ? copy.confirm : copy.delete}</button>}
      </div>
    </> : <>
      <div className="timer-room-actions">
        {onExport && <button type="button" onClick={onExport}>CSV</button>}
        {onClear && rounds.length > 0 && <button type="button" onBlur={() => setConfirm(null)} onClick={() => {
          if (confirm !== 'clear') { setConfirm('clear'); return; }
          onClear(); setConfirm(null);
        }}>{confirm === 'clear' ? copy.confirm : copy.clear}</button>}
      </div>
      {rounds.length === 0 ? <p>{copy.empty}</p> : <>
        <div className="timer-room-standings-scroll"><table className="timer-room-standings">
          <thead><tr><th>{copy.player}</th><th>{copy.attempts}</th><th>{copy.wins}</th><th>{copy.best}</th></tr></thead>
          <tbody>{summaries.map((summary) => <tr key={summary.playerId}><td>{copy.player} {summary.playerId + 1}</td><td>{summary.attempts}</td><td>{summary.wins}</td><td>{summary.bestMs === null ? '—' : formatMs(summary.bestMs, precision)}</td></tr>)}</tbody>
        </table></div>
        <ol className="timer-battle-history-list">{[...rounds].reverse().map((round, index) => <li key={round.id}>
          <button type="button" onClick={() => { setDetailId(round.id); setConfirm(null); }}>
            <span>{copy.round} {rounds.length - index}</span>
            <time dateTime={new Date(round.ts).toISOString()}>{new Date(round.ts).toLocaleDateString(language === 'zh' ? 'zh-CN' : 'en-US')}</time>
            <span>{round.attempts.map(({ playerId, solve }) => `${copy.player} ${playerId + 1}: ${result(solve)}`).join(' · ')}</span>
          </button>
        </li>)}</ol>
      </>}
      {legacy}
    </>}
  </TimerRoomDialog>;
}

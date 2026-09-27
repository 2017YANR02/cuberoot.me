import type { ReactNode } from 'react';

export interface TimerBattlePlayerProps {
  playerNumber: number;
  language: 'en' | 'zh';
  score: number;
  winner?: boolean;
  controls: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}
const COPY = {
  en: { player: (value: number) => `Player ${value}`, winner: 'Winner', score: 'Score' },
  zh: { player: (value: number) => `玩家 ${value}`, winner: '胜者', score: '得分' },
};

export function TimerBattlePlayer({ playerNumber, language, score, winner, controls, actions, children, className }: TimerBattlePlayerProps) {
  const copy = COPY[language];
  return <article className={`timer-battle-player${winner ? ' is-winner' : ''}${className ? ` ${className}` : ''}`}>
    <header className="timer-battle-player-header" data-no-timer>
      <strong>{copy.player(playerNumber)}</strong>
      <span aria-label={copy.score}>{score}</span>
      {winner && <span className="timer-battle-player-winner">{copy.winner}</span>}
      <div className="timer-battle-player-controls">{controls}</div>
    </header>
    {children}
    {actions && <footer className="timer-battle-player-actions" data-no-timer>{actions}</footer>}
  </article>;
}

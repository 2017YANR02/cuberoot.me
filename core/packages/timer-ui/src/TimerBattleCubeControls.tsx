import './compact-select.css';

import type { ReactNode } from 'react';

export interface TimerBattleCubeControlsProps {
  language: 'en' | 'zh';
  mode: 'shared' | 'own';
  holder: number;
  players: readonly { id: number; disabled?: boolean }[];
  onModeChange?(mode: 'shared' | 'own'): void;
  onHolderChange(id: number): void;
  deviceControl(playerId: number): ReactNode;
}
const COPY = {
  en: { title: 'Smart cube', mode: 'Smart cube mode', shared: 'Pass around', own: 'One each', holder: 'Now up', player: 'Player', hint: 'Match the scramble to arm, first turn starts, solved stops.', pass: 'After a solve, pass the cube to the next player.' },
  zh: { title: '智能魔方', mode: '智能魔方模式', shared: '一颗轮流', own: '每人一颗', holder: '轮到', player: '玩家', hint: '拧到打乱即预备，第一下转动起表，还原停表。', pass: '停表后把魔方传给下一位玩家。' },
};
export function TimerBattleCubeControls({ language, mode, holder, players, onModeChange, onHolderChange, deviceControl }: TimerBattleCubeControlsProps) {
  const copy = COPY[language];
  return <section className="timer-battle-cube-controls"><h3>{copy.title}</h3>
    {onModeChange ? (
      <select
        value={String(mode === 'shared')}
        onChange={event => { const value = event.currentTarget.value === 'true'; onModeChange(value ? 'shared' : 'own'); }}
        aria-label={copy.mode}
        className="native-select"
      >
        <option value="true">{copy.shared}</option>
        <option value="false">{copy.own}</option>
      </select>
    ) : <p>{copy.shared}</p>}
    {mode === 'shared' ? <>
      <div className="timer-battle-cube-device">{deviceControl(holder)}</div>
      <div className="timer-room-actions" role="group" aria-label={copy.holder}>{players.map((player) => <button type="button" key={player.id} aria-pressed={holder === player.id} disabled={player.disabled} onClick={() => onHolderChange(player.id)}>{copy.player} {player.id + 1}</button>)}</div>
    </> : players.map((player) => <div className="timer-battle-cube-device" key={player.id}><span>{copy.player} {player.id + 1}</span>{deviceControl(player.id)}</div>)}
    <p>{copy.hint} {mode === 'shared' && copy.pass}</p>
  </section>;
}

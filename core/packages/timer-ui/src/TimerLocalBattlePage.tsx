import type { ComponentProps, ReactNode } from 'react';
import { TimerBattleHistory } from './TimerBattleHistory';
import { TimerBattleLayout } from './TimerBattleLayout';
import { TimerBattlePlayer } from './TimerBattlePlayer';
import { TimerBattleSettings } from './TimerBattleSettings';
import { TimerBattleToolbar } from './TimerBattleToolbar';
import { TimerStageLayout } from './TimerStageLayout';
import TimingSurface from './TimingSurface';

export interface TimerLocalBattlePageProps {
  className?: string;
  ariaLabel?: string;
  devices?: ReactNode;
  layout: Omit<ComponentProps<typeof TimerBattleLayout>, 'middle'>;
  toolbar: ComponentProps<typeof TimerBattleToolbar>;
  settings?: ComponentProps<typeof TimerBattleSettings> | false;
  history?: ComponentProps<typeof TimerBattleHistory> | false;
  feedback?: ReactNode;
  error?: string | null;
}
/** One page tree for local multiplayer; stores and native event subscriptions stay in adapters. */
export function TimerLocalBattlePage({ className, ariaLabel, devices, layout, toolbar, settings, history, feedback, error }: TimerLocalBattlePageProps) {
  return <section className={className} aria-label={ariaLabel}>
    <TimerStageLayout devices={devices}>
      <TimerBattleLayout {...layout} middle={<TimerBattleToolbar {...toolbar} />} />
    </TimerStageLayout>
    {settings && <TimerBattleSettings {...settings} />}
    {history && <TimerBattleHistory {...history} />}
    {feedback}
    {error && <p role="alert">{error}</p>}
  </section>;
}

export function TimerLocalBattlePlayer({ player, timing, average }: {
  player: Omit<ComponentProps<typeof TimerBattlePlayer>, 'children' | 'hideHeader'>;
  timing: Omit<ComponentProps<typeof TimingSurface>, 'layout' | 'readoutLabel' | 'children'>;
  average?: ReactNode;
}) {
  const label = { en: `Player ${player.playerNumber}`, zh: `玩家 ${player.playerNumber}` }[player.language];
  return <TimerBattlePlayer {...player} hideHeader>
    <TimingSurface {...timing} layout="local" readoutLabel={<strong className="battle-readout-label">{label}</strong>}>
      {average}
    </TimingSurface>
  </TimerBattlePlayer>;
}

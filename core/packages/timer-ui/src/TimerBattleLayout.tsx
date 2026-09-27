import { useEffect, type ReactNode } from 'react';

export interface TimerBattleCell {
  hideScramble: boolean;
  controlsCorner: 'left' | 'right' | 'center';
}

export interface TimerBattleLayoutProps {
  playerCount: 2 | 3 | 4;
  layout: 'side' | 'versus';
  flipTopRow: boolean;
  middle?: ReactNode;
  bottomScramble?: ReactNode;
  topScramble?: ReactNode;
  renderPlayer(id: number, cell: TimerBattleCell): ReactNode;
}

const COPY = {
  en: { layout: 'Layout', side: 'Side by side', versus: 'Face to face', flip: 'Rotate top players' },
  zh: { layout: '布局', side: '并排', versus: '面对面', flip: '旋转上方玩家' },
} as const;

export function TimerBattleLayoutControls({ playerCount, layout, flipTopRow, language, onLayoutChange, onFlipChange }: {
  playerCount: 2 | 3 | 4;
  layout: 'side' | 'versus';
  flipTopRow: boolean;
  language: 'en' | 'zh';
  onLayoutChange(value: 'side' | 'versus'): void;
  onFlipChange(value: boolean): void;
}) {
  const copy = COPY[language];
  useEffect(() => {
    if (playerCount !== 2 || typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia('(orientation: landscape)');
    const update = () => onLayoutChange(media.matches ? 'side' : 'versus');
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [onLayoutChange, playerCount]);
  return <div className="timer-battle-layout-controls" role="group" aria-label={copy.layout} data-no-timer>
    {playerCount === 2 && (['versus', 'side'] as const).map((value) => (
      <button type="button" key={value} aria-pressed={layout === value} onClick={() => onLayoutChange(value)}>{copy[value]}</button>
    ))}
    {(playerCount > 2 || layout === 'versus') && <label>
      <input type="checkbox" checked={flipTopRow} onChange={(event) => onFlipChange(event.target.checked)} />{copy.flip}
    </label>}
  </div>;
}

/** Shared player ordering, paired scramble rows and facing direction. */
export function TimerBattleLayout({
  playerCount, layout, flipTopRow, middle, bottomScramble, topScramble, renderPlayer,
}: TimerBattleLayoutProps) {
  const cell = (id: number, flipped: boolean, hideScramble = false, controlsCorner: TimerBattleCell['controlsCorner'] = 'center') => (
    <div className="timer-battle-cell" data-player-id={id} data-flipped={flipped || undefined} key={id}>
      {renderPlayer(id, { hideScramble, controlsCorner })}
    </div>
  );
  const pair = (ids: number[], flipped: boolean, scramble: ReactNode) => (
    <div className="timer-battle-pair" data-flipped={flipped || undefined}>
      {scramble && <div className="timer-battle-scramble" data-no-timer>{scramble}</div>}
      <div className="timer-battle-row">
        {ids.map((id, index) => cell(id, flipped, Boolean(scramble),
          index === 0 ? (flipped ? 'right' : 'left') : (flipped ? 'left' : 'right')))}
      </div>
    </div>
  );
  return (
    <div className="timer-battle-layout" data-layout={playerCount > 2 ? 'grid' : layout}>
      {playerCount > 2 ? <>
        {playerCount === 4 ? pair([2, 3], flipTopRow, topScramble) : cell(2, flipTopRow)}
        {middle}
        {pair([0, 1], false, bottomScramble)}
      </> : layout === 'side' ? <>
        {middle}
        {pair([0, 1], false, bottomScramble)}
      </> : <>
        {cell(1, flipTopRow)}
        {middle}
        {cell(0, false)}
      </>}
    </div>
  );
}

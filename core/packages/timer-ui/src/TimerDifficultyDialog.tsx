import { useEffect, type ReactNode } from 'react';
import { TimerRoomDialog } from './TimerRoomDialog';
import './timer-difficulty-dialog.css';

/** Difficulty editors own a draft; closing this shared dialog only cancels it. */
export function TimerDifficultyDialog({ language, disabled, canApply = true, onClose, onApply, onClear, children }: {
  language: 'en' | 'zh';
  disabled?: boolean;
  canApply?: boolean;
  onClose(): void;
  onApply(): void;
  onClear(): void;
  children: ReactNode;
}) {
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, []);
  return <TimerRoomDialog title={{ en: 'Difficulty', zh: '难度' }[language]}
    className="timer-difficulty-dialog" language={language} onClose={onClose}>
    {children}
    <footer className="timer-difficulty-actions">
      <button type="button" disabled={disabled} onClick={onClear}>
        {{ en: 'Any difficulty', zh: '不限难度' }[language]}
      </button>
      <button type="button" disabled={disabled || !canApply} onClick={onApply} data-primary>
        {{ en: 'Apply', zh: '应用' }[language]}
      </button>
    </footer>
  </TimerRoomDialog>;
}

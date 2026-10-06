import { useState } from 'react';
import TimerSolverBody from '@cuberoot/timer-ui/TimerSolverBody';
import { TimerRoomDialog } from '@cuberoot/timer-ui';
import { configureStageSolverTables } from '@cuberoot/timer-ui/stage-solver/rust-cross-tables';

// Executable workers/WASM are bundled locally; only versioned table data is remote.
configureStageSolverTables('https://static.cuberoot.me/tools/solver/rust-cross/tables');

export default function StageSolverDialog({ scramble, language, onClose, onPrevScramble, onNextScramble, onDismissChange }: {
  scramble: string; language: 'en' | 'zh'; onClose(): void;
  onDismissChange?(dismiss: (() => boolean) | null): void;
  onPrevScramble(): void; onNextScramble(): void;
}) {
  const [settingsSlot, setSettingsSlot] = useState<HTMLSpanElement | null>(null);
  return <TimerRoomDialog title={({ zh: '解法', en: 'Solve' })[language]} language={language} onClose={onClose}
    headerControls={<span className="app-solver-settings-slot" ref={setSettingsSlot} />}>
    <div className="app-stage-solver">
      <TimerSolverBody scramble={scramble} language={language} onDismissChange={onDismissChange} settingsSlot={settingsSlot} compact onPrevScramble={onPrevScramble} onNextScramble={onNextScramble} />
    </div>
  </TimerRoomDialog>;
}

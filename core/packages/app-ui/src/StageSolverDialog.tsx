import TimerSolverPanel, { type TimerSolverPanelProps } from '@cuberoot/timer-ui/TimerSolverPanel';
import { configureStageSolverTables } from '@cuberoot/timer-ui/stage-solver/rust-cross-tables';

// Executable workers/WASM are local; only versioned table data is remote.
configureStageSolverTables('https://static.cuberoot.me/tools/solver/rust-cross/tables');

/** Installed hosts supply overlay/Back state; the full responsive surface is shared. */
export default function StageSolverDialog(props: TimerSolverPanelProps & {
  onPrevScramble(): void; onNextScramble(): void;
}) {
  return <TimerSolverPanel {...props} />;
}

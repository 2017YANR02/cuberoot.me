import { copyFileSync, cpSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const source = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../tools/solver/rust-cross');
export const STAGE_SOLVER_ASSETS = ['cross-solver-worker.js', 'xcross-table-worker.js', 'cross_solver.js', 'cross_solver_bg.wasm'] as const;
export function copyStageSolverAssets(publicDir: string): void {
  const destination = path.join(publicDir, 'tools/solver/rust-cross');
  mkdirSync(destination, { recursive: true });
  for (const name of STAGE_SOLVER_ASSETS) copyFileSync(path.join(source, name), path.join(destination, name));
  // Same vendored SQ1 solver as Web; never fetch executable code remotely.
  cpSync(path.resolve(source, '../../cstimer-scramble'), path.join(publicDir, 'tools/cstimer-scramble'), { recursive: true });
  console.log(`[stage-solver] copied ${STAGE_SOLVER_ASSETS.length} executable assets to ${destination}`);
}

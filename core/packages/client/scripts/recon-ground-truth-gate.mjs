/** Compatibility command. Cross-workspace evidence belongs to the core orchestrator. */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runGroundTruthGate } from '../../../scripts/recon-ground-truth-gate.mjs';
export * from '../../../scripts/recon-ground-truth-gate.mjs';

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  process.exitCode = runGroundTruthGate();
}

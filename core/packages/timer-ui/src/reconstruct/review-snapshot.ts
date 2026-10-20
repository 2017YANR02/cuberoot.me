import { reconSnapshot } from '@cuberoot/shared/recon-ground-truth';
import type { ReconTextResult } from '@cuberoot/shared/timer/reconstruct/recon-text';
import { projectReconNotation } from './report-presentation';

/** The default displayed notation, including cross/inspection normalization.
 * For review/assertions only; playback retains the original lossless ranges. */
export function snapshotReconNotation(recon: ReconTextResult) {
  const projection = projectReconNotation(recon, 'cfop');
  return reconSnapshot({ ...projection.shownRecon!, inspection: projection.inspection,
    lines: projection.lines.map(({ line, moves }) => ({ ...line, moves })) });
}

import { configureAlgFileLoader, type AlgFile } from '@cuberoot/shared/alg';
import { recordingSolve, reconCanonicalJson, type ReconIntakeCase, type ReconSnapshot } from '@cuberoot/shared/recon-ground-truth';
import { prepareReconstruction, type ReconTextResult } from '@cuberoot/shared/timer/reconstruct/recon-text';
import { runReconstructionAnalysis } from '@cuberoot/timer-ui/reconstruct/analysis-runner';
import { projectReconNotation } from '@cuberoot/timer-ui/reconstruct/report-presentation';
import { snapshotReconNotation } from '@cuberoot/timer-ui/reconstruct/review-snapshot';
import { applyScramble } from '@cuberoot/shared/timer/reconstruct/state';
import { applyOneToken } from '@cuberoot/shared/timer/reconstruct/apply-token';
import { isSolved, isCross, isF2l } from '@cuberoot/shared/timer/reconstruct/cfop-detect';
import { reconstructedTrack } from '@cuberoot/timer-ui/reconstruct/playback-track';
import { patternFromAlg } from '@cuberoot/shared/recon/cube3';
import { detectStage } from '@cuberoot/shared/recon/stage-detect';
import { crossFamilyCancelInto } from '@cuberoot/shared/recon/popup-suggest';

/** ESM for direct Node/tsx execution with cubing's import-only exports.
 * Sequential runner, with the same preparation, library correction and default
 * notation as the report. Never feeds observed/expected/manual notation into it. */
export async function checkReconIntake(item: Pick<ReconIntakeCase, 'id' | 'input' | 'expected'>,
  libraries: Record<string, AlgFile>): Promise<{ actual: ReconSnapshot | null; errors: string[] }> {
  const errors: string[] = [];
  let actual: ReconSnapshot | null = null;
  const recordingBefore = JSON.stringify(item.input.recording);
  const load = async (set: string) => {
    if (!libraries[set]) throw new Error('Missing frozen library: ' + set);
    return libraries[set];
  };
  configureAlgFileLoader(async (_, set) => load(set));
  try {
    const solve = recordingSolve(item.input.recording, item.id);
    const prepared = prepareReconstruction(solve, 'cfop', item.input.language);
    if (!prepared.text) throw new Error('No reconstruction input');
    let result: ReconTextResult | null = null;
    await runReconstructionAnalysis({ id: 1, input: { text: prepared.text, scoreable: false } }, message => {
      if (message.error) errors.push(message.error);
      if (message.patch?.text) result = message.patch.text;
    });
    if (!result) throw new Error('Reconstruction produced no output');
    const shown = projectReconNotation(result, 'cfop').shownRecon!;
    actual = snapshotReconNotation(result);
    const track = reconstructedTrack(shown.lines, solve.moves!);
    if (!track || JSON.stringify(track.map(m => m.m)) !== JSON.stringify(shown.lines.flatMap(l => l.moves)))
      errors.push('Displayed moves do not retain complete encoder coverage');
    let state = applyOneToken(applyScramble(3, solve.scramble), shown.inspection);
    for (const [index, line] of shown.lines.entries()) {
      const beforeLine = state;
      state = applyOneToken(state, line.moves.join(' '));
      // A final pair may include the first last-layer turn as a cancellation.
      // Prove F2L was complete immediately before that turn; a label alone
      // cannot excuse a broken intermediate pair or a sideways cross.
      const cancelsIntoLastLayer = line.kind === 'f2l' && /\bcancel into$/.test(line.label ?? '')
        && ['oll', 'pll'].includes(shown.lines[index + 1]?.kind ?? '') && line.moves.length > 1
        && isF2l(applyOneToken(beforeLine, line.moves.slice(0, -1).join(' ')));
      // A pseudo-cross boundary deliberately precedes an exact cross. Verify
      // its claimed pair with the bounded state search; never trust the label.
      let cancelsIntoCross = false;
      if (line.kind === 'cross' && shown.crossColor && /\bpsxcross .* cancel into$/.test(line.label ?? '')) {
        const prefix = [solve.scramble, shown.inspection];
        const face = 'URFLBD'.indexOf(shown.crossColor ?? '');
        const initial = await detectStage(await patternFromAlg(prefix.join(' ')), face);
        const current = await patternFromAlg([...prefix, ...shown.lines.slice(0, index + 1).flatMap(row => row.moves)].join(' '));
        const candidates = await crossFamilyCancelInto(initial, current, face);
        cancelsIntoCross = candidates.some(candidate => candidate.stage === 'psxcross'
          && line.label === `${candidate.colorLetter} psxcross (${candidate.pairs.join('+')}) cancel into`);
      }
      if ((line.kind === 'cross' || line.kind === 'f2l')
        && ((!isCross(state) && !cancelsIntoLastLayer && !cancelsIntoCross) || state.D[4] !== shown.crossColor))
        errors.push('Cross is not down after ' + line.key);
    }
    if (!isSolved(state)) errors.push('Displayed reconstruction does not solve the cube');
    if (!isSolved(applyOneToken(applyScramble(3, solve.scramble), solve.moves!.map(m => m.m).join(' '))))
      errors.push('Original recording does not solve the cube');
    if (item.expected && reconCanonicalJson(actual) !== reconCanonicalJson(item.expected))
      errors.push('Actual notation differs from the administrator-approved expectation');
    // Exact annotations can be checked independently of a complete approved answer.
    for (const note of item.input.annotations) {
      if (!note.expectedAlgorithm.trim()) continue;
      const lines = note.range ? actual.lines.filter(l => l.fromIdx >= note.range!.fromIdx && l.toIdx <= note.range!.toIdx) : actual.lines;
      const expected = note.expectedAlgorithm.trim().split(/\s+/).join(' ');
      if (lines.flatMap(l => l.moves).join(' ') !== expected)
        errors.push(`Annotation ${note.id}: expected algorithm does not match its original move range`);
    }
    if (JSON.stringify(item.input.recording) !== recordingBefore) errors.push('Original recording was modified');
  } catch (error) { errors.push(String(error)); }
  finally { configureAlgFileLoader(null); }
  return { actual, errors };
}

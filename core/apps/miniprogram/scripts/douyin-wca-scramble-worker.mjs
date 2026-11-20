import { generateTimerScramble } from '@cuberoot/shared/timer/scramble-runtime';
import { rediScrambleForCubing } from '@cuberoot/shared/timer/redi-notation';
import { toCubingKilominx } from '@cuberoot/shared/kilominx-notation';
import { randomScrambleForEvent } from 'cubing-native-inside';
import { puzzles } from 'cubing-native-puzzles';
import { TwistyAnimatedSVG } from 'cubing-native-svg-animator';
import { serializeTimerPreviewSvg } from './douyin-cubing-svg-document.mjs';
import { beginScrambleEntropy, endScrambleEntropy } from './douyin-wca-scramble-runtime.mjs';

async function generateCubingScramble(event) {
  return (await randomScrambleForEvent(event)).toString();
}

export async function handleWcaScramblePayload({ event, timerRequest, entropy }) {
  beginScrambleEntropy(entropy);
  try {
    if (!timerRequest) return await generateCubingScramble(event);
    const result = await generateTimerScramble(timerRequest, { generateCubingScramble, requestTimeoutMs: null });
    if (result.ok) return result.scramble;
    throw new Error(`Shared timer scramble failed: ${result.code}`);
  } finally {
    endScrambleEntropy();
  }
}

export async function handleTimerPreviewPayload({ puzzle, scramble }) {
  if (puzzle === 'sphere') {
    const { renderSphereScrambleSvg } = await import('@cuberoot/puzzle-render-core/sphere-svg');
    return renderSphereScrambleSvg(scramble);
  }
  const loader = puzzles[puzzle];
  if (!loader) throw new Error(`Unknown timer preview puzzle: ${puzzle}`);
  const [kpuzzle, svg] = await Promise.all([loader.kpuzzle(), loader.svg()]);
  const alg = puzzle === 'redi_cube' ? rediScrambleForCubing(scramble)
    : puzzle === 'kilominx' ? toCubingKilominx(scramble) : scramble;
  const renderer = new TwistyAnimatedSVG(kpuzzle, svg);
  renderer.drawPattern(kpuzzle.defaultPattern().applyAlg(alg));
  return serializeTimerPreviewSvg(renderer.svgElement);
}

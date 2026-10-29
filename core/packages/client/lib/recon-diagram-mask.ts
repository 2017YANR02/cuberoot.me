import { CUBE_ORIENTATIONS, orientedFaceColors } from '@cuberoot/shared/timer';
import type { CubeFaces } from '@cuberoot/shared/timer/reconstruct/state';
import { FACE_COLOR_KEY } from '@cuberoot/shared/timer/reconstruct/orient';
import { AllFaces, CubeData, Face, makeMasking, Masking, parseAlgorithm } from '@cuberoot/visualcube';

/** Map a stage mask to its actual cubies, then replay the exact pre-line grip. */
export function maskedReconFacelets(setup: string, canonical: CubeFaces, masking: Masking): string | undefined {
  const maskRotation = CUBE_ORIENTATIONS.find(option => {
    const shown = orientedFaceColors(option.value);
    return shown[canonical.D[4]] === 'D' && shown[canonical.F[4]] === 'F' && shown[canonical.R[4]] === 'R';
  });
  if (!maskRotation) return;
  const mask = new CubeData(3, makeMasking(masking, 3));
  for (const turn of parseAlgorithm(maskRotation.value)) mask.turn(turn);
  const cube = new CubeData(3, Object.fromEntries(AllFaces.map(face => [face,
    mask.faces[face].map(visible => visible ? FACE_COLOR_KEY[Face[face] as keyof CubeFaces][0] : 'd'),
  ])));
  // Canonical orientation selects cubies only; never rotate the displayed state.
  for (const turn of parseAlgorithm(setup)) cube.turn(turn);
  return AllFaces.map(face => cube.faces[face].join('')).join('');
}

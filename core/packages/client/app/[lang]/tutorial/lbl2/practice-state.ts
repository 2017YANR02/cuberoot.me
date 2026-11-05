import { Alg } from 'cubing/alg';
import { AllFaces, CubeData, parseAlgorithm } from '@cuberoot/visualcube';
import { CUBE_ORIENTATIONS } from '@/lib/cube-orientation';

/** Compare all six masked faces, not the move text or only the visible camera side. */
export function practiceState(colors: string[], alg: string): string {
  const faces = Object.fromEntries(AllFaces.map((face, i) => [face, colors.slice(i * 9, (i + 1) * 9)]));
  const cube = new CubeData(3, faces);
  for (const turn of parseAlgorithm(new Alg(alg).expand().toString())) cube.turn(turn);
  return JSON.stringify(AllFaces.map(face => cube.faces[face]));
}

/** Rotate independent masked states; never change the player's state or camera. */
export function practiceTargetStates(colors: string[], alg: string): Set<string> {
  return new Set(CUBE_ORIENTATIONS.map(({ value }) => practiceState(colors, `${alg} ${value}`)));
}

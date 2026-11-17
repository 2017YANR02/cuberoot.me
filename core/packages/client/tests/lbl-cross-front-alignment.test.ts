import { describe, expect, it } from 'vitest';
import { AllFaces, CubeData, Face, parseAlgorithm } from '@cuberoot/visualcube';
import { buildBottomCrossFromDaisy, demoGoalReached } from '@/app/[lang]/tutorial/lbl/complete-demo-state';
const setups = ['R2 U', 'F2 U', 'F2 U2', "F2 U R2 U2 B2 U L2 U'", "F2 U R2 U2 B2 U L2 U' U2", 'F2 R2 B2 L2'];
describe('front-focused white cross', () => {
  for (const setup of setups) it(setup, () => {
    const alg = buildBottomCrossFromDaisy(setup);
    const cube = new CubeData(3, Object.fromEntries(AllFaces.map(face => [face, Array(9).fill(Face[face])])));
    const apply = (moves: string) => { for (const move of parseAlgorithm(moves)) cube.turn(move); };
    apply(setup);
    const moves = alg.split(/\s+/);
    for (let index = 0; index < moves.length; index++) {
      const move = moves[index];
      if (/^U/.test(move)) expect(cube.faces[Face.U][7]).not.toBe(cube.faces[Face.D][4]);
      if (/^d/.test(move)) expect(cube.faces[Face.U][7]).toBe(cube.faces[Face.D][4]);
      if (move === "y'") {
        expect(cube.faces[Face.F][1]).toBe(cube.faces[Face.F][4]);
        expect(moves[index + 1]).toBe('R2');
      }
      if (move === 'R2') expect(cube.faces[Face.R][1]).toBe(cube.faces[Face.R][4]);
      apply(move);
    }
    expect(demoGoalReached('cross', `${setup} ${alg}`)).toBe(true);
  });
});

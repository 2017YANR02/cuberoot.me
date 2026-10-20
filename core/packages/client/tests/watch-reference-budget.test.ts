import { afterEach, expect, it, vi } from 'vitest';
import { configureGSolverBudget, GSolver, solveParallel } from '@cuberoot/puzzle-solvers/cstimer-gsolver';
afterEach(() => configureGSolverBudget(null));
it('stops the whole reference search on exhaustion instead of reporting a later, nonoptimal solution', () => {
  const move = (s: string) => s === '0' ? '1' : '0';
  const solver = new GSolver(['0'], move, { R: 0 });
  expect(solver.search('1', 0, 2)).toEqual(['R']);
  configureGSolverBudget({ pruningDepth: 0, nodes: 0 });
  const search = vi.spyOn(solver,'search');
  expect(solveParallel(move,['R'],[{solver,target:'0',mask:1}],0,5)).toEqual({sol:undefined,mask:0});
  expect(solver.budgetExhausted).toBe(true);
  expect(search).toHaveBeenCalledTimes(1);
});

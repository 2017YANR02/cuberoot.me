import type { AlgFile } from '@cuberoot/shared/alg';
import { findPhotoAlg } from '@cuberoot/shared/cube-photo/lookup';
import { executionBodyKey, identifyLibraryCase, sharesLibraryExecution } from '@cuberoot/shared/timer/reconstruct/library-correction';
import { applyScramble, toFaceletString } from '@cuberoot/shared/timer/reconstruct/state';
import { isF2l, isOll, isSolved } from '@cuberoot/shared/timer/reconstruct/cfop-detect';
import { normalizeSolve } from '@cuberoot/shared/timer/reconstruct/orient';
import type { ReconTextInput } from '@cuberoot/shared/timer/reconstruct/recon-text';

export interface ReplayZbll {
  caseName: string;
  sharedWith?: string[];
  disposition: 'executed' | 'combined' | 'opportunity';
  setup: string;
  original: string;
  reference: string;
}

export async function identifyReplayZbll(input: Pick<ReconTextInput, 'scramble'|'moves'|'physical'|'segs'>, load: (set:string) => Promise<AlgFile>): Promise<ReplayZbll | undefined> {
  const physical = input.physical ?? input;
  const end = input.segs.f2lEndIdx;
  if (end == null || end >= physical.moves.length - 1 || input.segs.solvedEndIdx !== physical.moves.length - 1) return;
  const frame = normalizeSolve(physical.scramble, physical.moves);
  const position = [frame.scramble, ...frame.moves.slice(0,end + 1).map(move => move.m)].join(' ');
  const state = applyScramble(3, position);
  if (!isF2l(state) || isOll(state) || ![1,3,5,7].every(i => state.U[i] === state.U[4])) return;
  const moves = frame.moves.slice(end + 1).map(move => move.m);
  const original = moves.join(' ');
  if (!isSolved(applyScramble(3, position + ' ' + original))) return;
  const file = await load('zbll');
  const item = await identifyLibraryCase({moves}, file.cases, 'zbll');
  if (!item?.id) return;
  const setup = [frame.rotation, position].filter(Boolean).join(' ');
  const single = {...file, cases:[item]};
  const path = executionBodyKey(moves);
  const split = input.segs.ollEndIdx;
  const separatePll = split != null && frame.moves.slice(split+1).some(move => !/^U[2']?$/.test(move.m));
  let candidate: ReplayZbll | undefined;
  for (const rotation of ['', 'y', 'y2', "y'"]) {
    const facelet = toFaceletString(applyScramble(3, position+' '+rotation));
    const centers = Object.fromEntries([...('URFDLB')].map((face,i) => [facelet[i*9+4],face]));
    const normalized = [...facelet].map(color => centers[color]).join('');
    for (const entry of item.algs.flat()) {
      const match = findPhotoAlg(normalized, 'zbll', {...single, cases:[{...item, algs:[[entry]]}]});
      if (!match) continue;
      const reference = [rotation,match.alg].filter(Boolean).join(' ');
      if (!isSolved(applyScramble(3, position+' '+reference))) continue;
      const exact = executionBodyKey(reference.split(/\s+/)) === path;
      const result: ReplayZbll = {caseName:item.meta?.ollcp || item.name, setup, original, reference,
        disposition:exact ? 'executed' : separatePll ? 'opportunity' : 'combined'};
      if (exact) {
        // A PLL skip can make a normal OLL or COLL indistinguishable from this ZBLL.
        const families = await Promise.all(['oll','coll'].map(set => load(set).catch(() => undefined)));
        if (separatePll && split != null && families[0] && sharesLibraryExecution(moves.slice(0,split-end),families[0].cases)) {
          const pll=await load('pll').catch(() => undefined);
          if (pll && sharesLibraryExecution(moves.slice(split-end),pll.cases)) {
            return {...(candidate ?? result),disposition:'opportunity'};
          }
        }
        const sharedWith = families.flatMap(family => family && sharesLibraryExecution(moves,family.cases) ? [family.set.toUpperCase()] : []);
        if (sharedWith.length) result.sharedWith=sharedWith;
        if (families.some(family => !family)) result.disposition='combined';
        return result;
      }
      candidate ??= result;
    }
  }
  return candidate;
}

import { expect, it } from 'vitest';
import { computeStageSegments } from '@cuberoot/shared/timer/reconstruct/stage-segments';
import { applyScramble } from '@cuberoot/shared/timer/reconstruct/state';
import { isSolved } from '@cuberoot/shared/timer/reconstruct/cfop-detect';
import type { AlgFile } from '@cuberoot/shared/alg';
import { identifyReplayZbll } from '@cuberoot/timer-ui/reconstruct/analysis-runner';
import { practiceTransfer } from '@cuberoot/timer-ui/reconstruct/cfop-personal-baseline';
import type { Solve } from '@cuberoot/shared/timer/types';
import ub4 from './fixtures/recon-workbook/ghlip__YsRw.json';
import pib6 from './fixtures/recon-workbook/wK8NnBt_kHU.json';
import libraries from './fixtures/recon-workbook/libraries.json';

const load = async (set:string) => libraries[set as keyof typeof libraries] as unknown as AlgFile;
function classify(solve:Pick<Solve,'scramble'|'timeMs'> & {moves:NonNullable<Solve['moves']>}) {
  const segs = computeStageSegments(solve.scramble, solve.moves, solve.timeMs)!;
  return identifyReplayZbll({...solve,segs},load);
}

it.each([['UB4',ub4.recording],['PiB6',pib6.recording]] as const)('checks the recorded and reference last layers for %s', async (expected, solve) => {
  const result = await classify(solve);
  expect(result?.caseName).toBe(expected);
  expect(result?.disposition).toBe('executed');
  for (const line of [result!.original,result!.reference]) expect(isSolved(applyScramble(3,result!.setup+' '+line))).toBe(true);
  if (expected==='PiB6') expect(result?.sharedWith?.length).toBeGreaterThan(0);
});

const sune="R U R' U R U2 R'";
const tperm="R U R' U' R' F R2 U' R' U' R U R' F'";
function generated(line:string) {
  const tokens=("R' D2 L F "+line).split(' ');
  const scramble=tokens.slice().reverse().map(m=>m.endsWith('2') ? m : m.endsWith("'") ? m.slice(0,-1) : m+"'").join(' ');
  return {scramble,moves:tokens.map((m,i)=>({m,ts:i*170})),timeMs:tokens.length*170};
}
it('retains OLL and PLL timing for a two-algorithm solution and excludes a pure PLL',async()=>{
  expect((await classify(generated(sune+' '+tperm)))?.disposition).toBe('opportunity');
  expect(await classify(generated(tperm))).toBeUndefined();
});
it('retains an uncertain one-look route without assigning an execution match', async()=>{
  // A four-turn commutator repeated six times return to the same cube state.
  const prefix = Array(6).fill("R U R' U'").join(' ');
  const solve=generated(prefix+' '+pib6.displayRows.at(-1)!.moves.replaceAll("2'","2"));
  const segs=computeStageSegments(solve.scramble,solve.moves,solve.timeMs)!;
  // This is the verified F2L boundary before the extra sequence, not its later recurrence.
  const result=await identifyReplayZbll({...solve,segs:{...segs,f2lEndIdx:3}},load);
  expect(result).toMatchObject({caseName:'PiB6',disposition:'combined'});
});

it('counts only later independent whole solves with the same ZBLL', async()=>{
  const current:Solve={...ub4.recording, event:'333', penalty:'ok', id:'source',ts:10};
  const later:Solve={...pib6.recording,event:'333',penalty:'ok',id:'natural',ts:50_000};
  const history:Solve[]=[later,{...later,id:'copy'}, {...later,id:'drill',caseId:'PiB6'}, {...later,id:'old',ts:100},
    {...later,id:'dnf',penalty:'DNF'}, {...current,id:'same-scramble',ts:100_000}];
  const metrics=await practiceTransfer(history,current,['PiB6','UB4'].map(caseName=>({
    since:1_000,formula:{set:'zbll',caseName},signal:'executionMs',
  })),load);
  expect(metrics).toEqual([{count:1,medianMs:2014,opportunities:1},{count:0,medianMs:null,opportunities:0}]);
});

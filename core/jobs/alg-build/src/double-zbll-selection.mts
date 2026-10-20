/** Rank saved solutions only; do not search for additional optimal solutions. */
export const SELECTION_ORDER = ['htm', 'qtm', 'generators'] as const;
export interface SolutionRank { htm: number; qtm: number; generators: number }
export function rankSolution(solution: string): SolutionRank {
  const moves = solution.trim().split(/\s+/);
  if (!moves.length || moves.some(m => !/^[URFDLB](?:2|')?$/.test(m))) throw Error('Invalid HTM solution');
  return { htm: moves.length, qtm: moves.reduce((n,m)=>n+(m.endsWith('2')?2:1),0),
    generators: new Set(moves.map(m=>m[0])).size };
}
export function compareSolutions(a: SolutionRank, b: SolutionRank): number {
  return a.htm-b.htm || a.qtm-b.qtm || a.generators-b.generators;
}
interface SelectionModel { N: number; cases: unknown[]; states: {caseIndex: number}[] }
export interface SelectedPair extends SolutionRank {
  pair: number; top: number; bottom: number; stateId: number; solution: string;
}
export class PairSelection {
  private selected = new Map<number, SelectedPair>();
  constructor(private model: SelectionModel) {}
  accept(stateId: number, htm: number, solution: string) {
    const rank = rankSolution(solution), n = this.model.N;
    if (!Number.isSafeInteger(stateId) || stateId<0 || stateId>=n*n || htm!==rank.htm) throw Error('Invalid saved candidate');
    const a=this.model.states[Math.floor(stateId/n)].caseIndex, b=this.model.states[stateId%n].caseIndex;
    const top=Math.min(a,b), bottom=Math.max(a,b), pair=top*this.model.cases.length+bottom;
    const old=this.selected.get(pair);
    // Equal face counts are equal: there is no RU/RF/RUF spelling preference.
    // Regex captures may retain the entire streamed CSV chunk. Own only the
    // winning short formula; keep all original candidates in the disk journal.
    if (!old || compareSolutions(rank,old)<0) this.selected.set(pair,{pair,top,bottom,stateId,solution:Buffer.from(solution).toString(),...rank});
  }
  get(pair: number) { return this.selected.get(pair); }
  snapshot() {
    return { schema: 1, order: SELECTION_ORDER, scope: 'best among saved canonical-state solutions; not exhaustive QTM optimality',
      orientation: 'solution solves model.setup(stateId); use model rotations for the requested top/bottom orientation',
      rows: [...this.selected.values()].sort((a,b)=>a.pair-b.pair) };
  }
}

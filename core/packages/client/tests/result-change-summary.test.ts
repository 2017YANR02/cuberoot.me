import { describe, expect, it } from 'vitest';
import { summarizeResultChanges } from '@/lib/result-change-summary';
import type { ResultChange } from '@/lib/result-watch-api';

function change(id: number, fields: ResultChange['fields'], extra: Partial<ResultChange> = {}): ResultChange {
  return { id, wcaId:'2019WANY36', competitionId:'Test2026', eventId:'333', roundTypeId:'f',
    changeType:'modified', status:'approved', detectedAt:`2026-01-${String(id).padStart(2,'0')}T00:00:00Z`,
    fields, ...extra } as ResultChange;
}
const attempts = (old: number[], next: number[]) => ({field:'attempts',old,new:next});

describe('result change attempt summary', () => {
  it('counts +2/+4/+6 once, ignoring best/average and duplicate penalty annotations', () => {
    const rows = [change(1,[attempts([100,200,300],[300,600,900]),{field:'best',old:100,new:300},{field:'average',old:200,new:600}]),
      change(2,[{field:'attempt_penalties',old:null,new:[200,400,600]}])];
    expect(summarizeResultChanges(rows)).toEqual({penalties:[[2,1],[4,1],[6,1]],dnf:0,cancelled:0});
  });
  it('counts final net changes once and DNF attempts rather than DNF averages', () => {
    const rows = [change(1,[attempts([100,200,300],[300,-1,500]),{field:'average',old:200,new:-1}]),
      change(2,[attempts([300,-1,500],[500,-1,300])])];
    expect(summarizeResultChanges(rows.reverse())).toEqual({penalties:[[4,1]],dnf:1,cancelled:0});
  });
  it('counts removed attempts once and excludes missing attempts and pending changes', () => {
    const rows = [change(1,[attempts([100,200],[300,-1])]),change(2,null,{changeType:'removed',before:{at:[300,-1,0]} as ResultChange['before']}),
      change(3,[attempts([100],[300])],{competitionId:'Pending2026',status:'pending'})];
    expect(summarizeResultChanges(rows)).toEqual({penalties:[],dnf:0,cancelled:2});
  });
  it('accepts metadata-only penalties, but does not interpret FMC or multi-blind encodings as seconds', () => {
    expect(summarizeResultChanges([change(1,[{field:'attempt_penalties',old:null,new:[200,400,0]}])]).penalties).toEqual([[2,1],[4,1]]);
    expect(summarizeResultChanges([change(1,[attempts([100],[300])],{eventId:'333mbf'})]).penalties).toEqual([]);
  });
});

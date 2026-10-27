import { expect, it } from 'vitest';
import { isReplacedResultRemoval, type ResultChange } from '@/lib/result-watch-api';
import type { WcaResultRow } from '@/lib/wca-person-api';

const before = {c:'MidAtlanticChampionship2026',e:'333',r:'f',f:'h',b:344,a:0,p:1,
  at:[387,344,428,520,407,632,510,617,368,529,452,554,403,444,493],rs:null,ra:null};
const change = {source:'auto',changeType:'removed',resultId:8431058,before} as ResultChange;
const row: WcaResultRow = {id:8452464,competition_id:before.c,event_id:before.e,round_type_id:before.r,
  format_id:before.f,best:before.b,average:before.a,pos:before.p,attempts:before.at};
it('recognizes an unchanged official replacement without hiding genuine or manual cancellations',()=>{
  expect(isReplacedResultRemoval(change,[row])).toBe(true);
  for(const different of [{...row,id:change.resultId},{...row,id:undefined},{...row,live:true},
    {...row,pos:2},{...row,attempts:[-1,...row.attempts.slice(1)]},{...row,round_type_id:'3'}]) {
    expect(isReplacedResultRemoval(change,[different])).toBe(false);
  }
  expect(isReplacedResultRemoval({...change,source:'manual'},[row])).toBe(false);
  expect(isReplacedResultRemoval(change,[])).toBe(false);
});

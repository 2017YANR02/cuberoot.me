import { describe, expect, it, vi } from 'vitest';
import { assistantAnswerHistory, type AssistantAnswer, type AssistantMessage } from '@cuberoot/shared/site-assistant';
import { answerSiteQuestion, canReadPublicResult } from '../src/utils/site_assistant.js';
import { assistantAnswerContext } from '../src/utils/site_assistant_context.js';
import { attendanceLocationFollowUp } from '../src/utils/site_assistant_locations.js';
import { refersToDisplayedAnswer } from '../src/utils/site_assistant_memory.js';

const id='2017YANR02';
const person={name:'Test Person',wca_id:id};
const comps=[
  {id:'A',city:'Xuzhou, Jiangsu',country_iso2:'CN',start_date:'2025-03-10'},
  {id:'B',city:'Shanghai',country_iso2:'CN',start_date:'2025-07-10'},
  {id:'C',city:'Nanjing, Jiangsu',country_iso2:'CN',start_date:'2024-01-10'},
  {id:'D',city:'Beijing',country_iso2:'CN',start_date:'2025-09-10'},
  {id:'E',city:'Multiple Cities',country_iso2:'CN',start_date:'2025-10-10'},
];
const results=comps.map(comp=>({competition_id:comp.id,event_id:comp.id==='D'?'222':'333'}));
const profile={wcaId:id,profile:{person},comps,results:[...results,results[0]]};
const fetcher=vi.fn<typeof fetch>(async input=>String(input).includes('/meta')?Response.json({lastImportedAt:'2026-11-01'}):Response.json(profile));
const turn=(question:string,answer:AssistantAnswer):AssistantMessage[]=>[
  {role:'user',content:question},{role:'assistant',content:assistantAnswerHistory(answer,'https://cuberoot.me')},
];
async function ask(question:string,history:AssistantMessage[],viewer?:string) {
  return answerSiteQuestion(question,'zh',null,AbortSignal.timeout(3000),fetcher,history,viewer);
}
const firstQuestion='我参加过哪些国家的比赛？';

describe('drilling down into the previous displayed attendance answer',()=>{
  it('uses the selected person from the preceding answer across three turns with no model',async()=>{
    const answer=await ask(firstQuestion,[],id);
    const history=turn(firstQuestion,answer);
    expect(history[1].content).toContain('中国\t5');
    const question='中国的哪些地区';
    expect(canReadPublicResult({question,history})).toBe(true);
    fetcher.mockClear();
    const next=await ask(question,history,'2012PARK03');
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(next.sources[0].href).toContain(id);
    expect(next.answer).toContain('5 场');
    expect(next.answer).toContain('1 场缺少');
    expect(next.artifacts?.[0]).toMatchObject({rows:expect.arrayContaining([['江苏','2'],['上海','1'],['北京','1']])});
    const third=await ask('那具体是哪些城市呢？',[...history,...turn(question,next)]);
    expect(third.artifacts?.[0]).toMatchObject({rows:expect.arrayContaining([['徐州','1'],['南京','1']])});
    expect(attendanceLocationFollowUp(question,[...history,{role:'user',content:'讲解 CFOP'},{role:'assistant',content:'CFOP 包括四个阶段。'}],assistantAnswerContext(answer))).toBeUndefined();
    expect(attendanceLocationFollowUp('中国的哪些地区适合旅游？',history)).toBeUndefined();
    expect(attendanceLocationFollowUp('只看去年，中国的哪些地区？',history)).toBeUndefined();
  });
  it('retains the event and date and deduplicates rounds, including after reloading a scoped table',async()=>{
    const first=await ask(firstQuestion,[],id);
    const filtered={...first,sources:[{...first.sources[0],id:'person-countries:'+id+':2025-01-01:2025-12-31:333'}]};
    const next=await ask('这几场分别在哪些城市？',turn('去年三阶呢？',filtered));
    expect(next.answer).toContain('3 场');
    expect(next.artifacts?.[0]).toMatchObject({rows:expect.arrayContaining([['上海','1'],['徐州','1']])});
    expect(next.sources[0].id).toContain(':2025-01-01:2025-12-31:333:CN:cities');
    const old=turn(firstQuestion,first);
    old[1].content=old[1].content.replace(/^Attendance source: .+\n/m,'');
    expect(canReadPublicResult({question:'中国的哪些地区',history:old})).toBe(true);
    expect(attendanceLocationFollowUp('中国的哪些地区',old,assistantAnswerContext(first))).toMatchObject({call:{wcaId:id,location:{country:'CN'}}});
  });
  it('asks which country when ambiguous and accepts the short reply',async()=>{
    const first=await ask(firstQuestion,[],id);
    const table=first.artifacts![0];
    if (table.kind!=='table') throw Error('Expected countries');
    const history=turn(firstQuestion,{...first,artifacts:[{...table,rows:[...table.rows,['日本','2']]}]});
    expect(attendanceLocationFollowUp('那 5 场分别在哪些城市？',history)).toMatchObject({call:{location:{country:'CN',view:'cities'}}});
    const question='分别在哪些城市？';
    const clarify=await ask(question,history);
    expect(clarify.answer).toContain('哪个国家');
    const answer=await ask('中国',[...history,...turn(question,clarify)]);
    expect(answer.sources[0].id).toContain(':CN:cities');
  });
  it('keeps the selected province when drilling down again and excludes out-of-region hosts',async()=>{
    const first=await ask(firstQuestion,[],id);
    const history=turn(firstQuestion,first);
    const regions=await ask('中国的哪些地区',history);
    history.push(...turn('中国的哪些地区',regions));
    const cities=await ask('那江苏省有哪些城市？',history);
    expect(cities.artifacts?.[0]).toMatchObject({rows:expect.arrayContaining([['徐州','1'],['南京','1']])});
    expect(cities.answer).toContain('有 2 场');
    expect(cities.answer).toContain('另有 1 场');
    history.push(...turn('那江苏省有哪些城市？',cities));
    const events=await ask('具体是哪几场比赛？',history);
    expect(events.artifacts?.[0]).toMatchObject({rows:[['C','南京，江苏','2024-01-10'],['A','徐州，江苏','2025-03-10']]});
    expect(events.sources[0].id).toContain(':CN:competitions:江苏');
  });
  it('uses a public fallback for failed mirrors and preserves event filters when the fallback cannot answer',async()=>{
    const first=await ask(firstQuestion,[],id);
    const read=vi.fn<typeof fetch>(async url=>String(url).includes('worldcubeassociation.org') ?
      Response.json([{id:'Official',city:'Shanghai',country_iso2:'CN',cancelled_at:null,results_posted_at:'2020-01-01'}]) : Response.json({}));
    const answer=await answerSiteQuestion('中国的哪些地区','zh',null,AbortSignal.timeout(3000),read,turn(firstQuestion,first));
    expect(answer.artifacts?.[0]).toMatchObject({rows:[['上海','1']]});
    expect(answer.sources[0].href).toContain('worldcubeassociation.org');
    const scoped={...first,sources:[{...first.sources[0],id:'person-countries:'+id+':all:all:333'}]};
    read.mockClear();
    const unavailable=await answerSiteQuestion('中国的哪些地区','zh',null,AbortSignal.timeout(3000),read,turn(firstQuestion,scoped));
    expect(unavailable.answer).toContain('逐场参赛记录');
    expect(read).toHaveBeenCalledTimes(1);
    expect(unavailable.sources[0].read).toBe(false);
  });
  it('recognizes a term introduced in the answer and avoids treating an unrelated question as a reference',()=>{
    const previous={role:'assistant' as const,content:'建议比较慢拧和录像复盘。'};
    expect(refersToDisplayedAnswer('录像复盘怎么操作？',previous)).toBe(true);
    expect(refersToDisplayedAnswer('后者适合什么时候练？',previous)).toBe(true);
    expect(refersToDisplayedAnswer('计时器怎么操作？',previous)).toBe(false);
  });
});

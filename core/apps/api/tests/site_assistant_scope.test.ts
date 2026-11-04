import {describe, expect, it, vi} from 'vitest';
import {assistantAttendanceScope, attendanceScopeError, applyAttendanceScope} from '../src/utils/site_assistant_scope.js';
import {answerSiteQuestion} from '../src/utils/site_assistant.js';
import {modelResponse, wireEvidence} from './fixtures/site_assistant_model.js';

const original = '只看我 2025 年三阶的参赛情况：参加过多少场比赛？';
const history = [{role:'user' as const, content:original}, {role:'assistant' as const, content:'2025 年三阶共 26 场。'}];
const scope = (question: string, prior = history) => assistantAttendanceScope(question, prior, new Date('2026-11-03T12:00:00Z'), 'UTC', '2017YANR02');

describe('personal attendance scope', () => {
  it.each(['那我去过哪些国家比赛？', '那我参加过多少场比赛？'])('retains the actual user constraints for %s', question => {
    const active = scope(question);
    expect(active).toEqual({date:{text:'2025',from:'2025-01-01',to:'2025-12-31'},event:{text:'三阶'}});
    for(const tool of ['person', 'person_countries', 'person_competitions']) expect(attendanceScopeError(active,{tool})).toContain('2025 / 三阶');
  });
  it('allows date-only tools only when their bounds match the requested scope', () => {
    const active = scope('那我 2026 年所有项目参加过多少场比赛？');
    expect(active).toEqual({date:{text:'2026',from:'2026-01-01',to:'2026-12-31'}});
    expect(attendanceScopeError(active,{tool:'person_competitions',wcaId:'2017YANR02',from:'2026-01-01',to:'2026-12-31'},'2017YANR02')).toBeUndefined();
    expect(attendanceScopeError(active,{tool:'person_competitions',from:'2025-01-01',to:'2025-12-31'})).toContain('constraints');
  });
  it('can reset only the year without bringing it back through the event hint', () => {
    const active = scope('不限年份，我参加过多少场比赛？');
    expect(active).toEqual({event:{text:'三阶'}});
    expect(attendanceScopeError(active,{tool:'person_countries'})).not.toContain('2025');
  });
  it.each(['Max Park 参加过多少场比赛？', '我的全部 PB 是多少？'])('releases stale scope for a new topic: %s', question => {
    expect(scope(question)).toBeUndefined();
  });
  it.each(['不限年份和项目，我一共参加过多少场比赛？', '我生涯所有项目参加过多少场比赛？'])('retains an explicit unrestricted scope after %s', question=>{
    const active=scope(question);
    expect(active).toEqual({});
    expect(attendanceScopeError(active,{tool:'person_competitions',wcaId:'2017YANR02'},'2017YANR02')).toBeUndefined();
    expect(attendanceScopeError(active,{tool:'person_countries',wcaId:'2017YANR02'},'2017YANR02')).toBeUndefined();
    expect(attendanceScopeError(active,{tool:'person',wcaId:'2017YANR02',view:'profile'},'2017YANR02')).toBeUndefined();
    for(const stale of [{event:'333'},{from:'2025-01-01',to:'2025-12-31'}]) expect(attendanceScopeError(active,{tool:'person_competitions',wcaId:'2017YANR02',...stale},'2017YANR02')).toContain('Retain these user constraints');
    expect(attendanceScopeError(active,{tool:'person',wcaId:'2012PARK03',view:'profile'},'2017YANR02')).toContain('Retain these user constraints');
    expect(attendanceScopeError(active,{tool:'person',wcaId:'2017YANR02',view:'profile',from:'2025-01-01'},'2017YANR02')).toContain('Retain these user constraints');
  });
  it('does not carry a different person or assistant-invented scope into personal attendance', () => {
    expect(scope('那我参加过多少场比赛？', [{role:'user',content:'Max Park 2025 年三阶参加过多少场比赛？'}])).toBeUndefined();
    expect(scope('我去过哪些国家比赛？', [{role:'assistant',content:original}] as typeof history)).toBeUndefined();
    expect(scope('我想看 2012PARK03 的 2025 年参赛情况')).toBeUndefined();
  });
  it('retains English event and calendar constraints', () => {
    const active = scope('Which countries have I competed in?', [{role:'user',content:'How many 3x3 competitions did I attend in 2025?'}]);
    expect(active?.event).toBeDefined();
    expect(active?.date?.from).toBe('2025-01-01');
  });
  it('understands an unspaced year and bare year/event continuations for the established subject', () => {
    expect(scope('那我去过哪些国家比赛？', [{role:'user',content:'我2025年三阶参加过多少场比赛？'}])?.date?.from).toBe('2025-01-01');
    expect(scope('那去年呢？')).toEqual({date:{text:'去年',from:'2025-01-01',to:'2025-12-31'},event:{text:'三阶'}});
    expect(scope('那四阶呢？')?.event?.text).toBe('四阶');
    expect(scope('What about 3x3?', [{role:'user',content:'How many competitions did I attend in 2025?'}])?.event?.text).toBe('3x3');
    expect(scope('那三阶呢？', [{role:'user',content:'我参加过多少场比赛？'}])?.event?.text).toBe('三阶');
    expect(scope('那去年呢？', [...history, {role:'user',content:'怎么练 PLL 识别？'}])).toBeUndefined();
    expect(scope('那王艺衡呢？')).toBeUndefined();
  });
  it('retains a clear attendance subject through country follow-ups and changes only the explicitly reset dimension',()=>{
    const prior=[...history,{role:'user' as const,content:'那二阶呢？'}];
    for(const question of ['哪些国家？','分别在哪些国家或地区？']) expect(scope(question,prior)).toEqual({date:{text:'2025',from:'2025-01-01',to:'2025-12-31'},event:{text:'二阶'}});
    const countries=[...prior,{role:'user' as const,content:'分别在哪些国家或地区？'}];
    expect(scope('那所有年份呢？',countries)).toEqual({event:{text:'二阶'}});
    expect(scope('那全部项目呢？',countries)).toEqual({date:{text:'2025',from:'2025-01-01',to:'2025-12-31'}});
    expect(scope('改成全部年份全部项目',countries)).toEqual({});
    expect(scope('改成所有年份、全部项目，合计多少场？',countries)).toEqual({});
    const reset=[...countries,{role:'user' as const,content:'改成所有年份、全部项目，合计多少场？'}];
    expect(scope('哪些国家？',reset)).toEqual({});
    expect(scope('Max Park 参加过多少场比赛？',reset)).toBeUndefined();
    expect(scope('Max Park 分别在哪些国家或地区？',countries)).toBeUndefined();
    expect(scope('哪些国家？',[{role:'user',content:'世界纪录现在是什么？'}])).toBeUndefined();
  });
  it('fills only omitted self-attendance filters and rejects contradictions, wrong identities and unresolved ranges',()=>{
    const active=scope('我参加过多少场比赛？');
    const call:{tool:string;wcaId:string;event?:string;from?:string;to?:string}={tool:'person_competitions',wcaId:'2017YANR02'};
    applyAttendanceScope(active,call,'2017YANR02');
    expect(call).toEqual({tool:'person_competitions',wcaId:'2017YANR02',event:'333',from:'2025-01-01',to:'2025-12-31'});
    expect(attendanceScopeError(active,call,'2017YANR02')).toBeUndefined();
    for(const difference of [{event:'222'},{from:'2024-01-01'},{wcaId:'2012PARK03'}]) {
      const wrong={...call,...difference}; applyAttendanceScope(active,wrong,'2017YANR02');
      expect(wrong).toMatchObject(difference);
      expect(attendanceScopeError(active,wrong,'2017YANR02')).toContain('Retain these user constraints');
    }
    const other={tool:'person_countries',wcaId:'2012PARK03'}; applyAttendanceScope(active,other,'2017YANR02');
    expect(other).toEqual({tool:'person_countries',wcaId:'2012PARK03'});
    const unresolved=scope('我 2024 年和 2025 年参加过多少场比赛？');
    expect(attendanceScopeError(unresolved,call,'2017YANR02')).toContain('Retain these user constraints');
  });
  it('requires global attendance filters and rejects the observed lifetime-plus-filtered-total plan', () => {
    const col = (col:string) => ({col}), value = (value:string|number) => ({value});
    const person = {op:'=',args:[col('r.wca_id'),value('2017YANR02')]};
    const event = {op:'=',args:[col('r.event_id'),value('333')]};
    const year = {op:'=',args:[{fn:'year',args:[col('r.comp_date')]},value(2025)]};
    const count = {fn:'count',args:[col('r.comp_id')],distinct:true};
    const correct = {from:{dataset:'results',as:'r'},select:[{as:'n',label:'比赛场数',expr:count}],where:{op:'and',args:[person,event,year]}};
    const active = scope('我参加过多少场比赛了？');
    const check = (query:unknown) => attendanceScopeError(active,{tool:'analysis_query',query},'2017YANR02');
    expect(check(correct)).toBeUndefined();
    expect(check({...correct,where:person,select:[...correct.select,{as:'scoped',label:'2025 三阶',expr:{...count,filter:{op:'and',args:[event,year]}}}]})).toContain('unrequested lifetime/all-event');
    expect(check({...correct,where:{op:'or',args:[person,event,year]}})).toContain('global AND');
    expect(check({...correct,where:{op:'and',args:[person,event,{...year,args:[year.args[0],value(2026)]}]}})).toContain('outside');
    const dates = [{op:'>=',args:[col('r.comp_date'),value('2025-01-01')]},{op:'<',args:[col('r.comp_date'),value('2026-01-01')]}];
    expect(check({...correct,where:{op:'and',args:[person,event,...dates]}})).toBeUndefined();
    const joined = {...correct,joins:[{dataset:'competitions',as:'c',type:'inner',on:{op:'=',args:[col('r.comp_id'),col('c.id')]}}],where:{op:'and',args:[person,event,{op:'=',args:[{fn:'year',args:[col('c.start_date')]},value(2025)]}]}};
    expect(check(joined)).toBeUndefined();
    const cte = {steps:[{name:'filtered',query:correct}],from:{dataset:'filtered',as:'f'},select:[{as:'n',label:'Count',expr:col('f.n')}]};
    expect(check(cte)).toBeUndefined();
    expect(check({...cte,steps:[{name:'filtered',query:{...correct,where:person}}]})).toContain('CTE base');
    expect(check({...cte,from:{dataset:'competitions',as:'c'},select:[{as:'n',label:'Unrelated total',expr:{fn:'count',args:[]}}]})).toContain('outside');
  });
  it('rejects stale raw event/date WHERE filters after an explicit full reset while preserving selections and grouping',()=>{
    const active=scope('改成所有年份、全部项目，合计多少场？');
    const person={op:'=',args:[{col:'r.wca_id'},{value:'2017YANR02'}]};
    const count={fn:'count',args:[{col:'r.comp_id'}],distinct:true};
    const total={from:{dataset:'results',as:'r'},select:[{as:'n',label:'Competitions',expr:count}],where:person};
    const check=(query:unknown)=>attendanceScopeError(active,{tool:'analysis_query',query},'2017YANR02');
    expect(check(total)).toBeUndefined();
    for(const stale of [{op:'=',args:[{col:'r.event_id'},{value:'333'}]},{op:'=',args:[{fn:'year',args:[{col:'r.comp_date'}]},{value:2025}]}]) {
      const query={...total,where:{op:'and',args:[person,stale]}};
      expect(check(query)).toContain('explicitly reset');
      expect(check({steps:[{name:'old',query}],from:{dataset:'old',as:'f'},select:[{as:'n',label:'Competitions',expr:{col:'f.n'}}]})).toContain('explicitly reset');
    }
    const joined={...total,joins:[{dataset:'competitions',as:'c',type:'inner',on:{op:'=',args:[{col:'r.comp_id'},{col:'c.id'}]}}],where:{op:'and',args:[person,{op:'>=',args:[{col:'c.start_date'},{value:'2025-01-01'}]}]}};
    expect(check(joined)).toContain('explicitly reset');
    expect(check({...total,select:[{as:'event',label:'Event',expr:{col:'r.event_id'}},{as:'n',label:'Competitions',expr:count}],groupBy:[{col:'r.event_id'}]})).toBeUndefined();
  });
  it.each(['person_countries','person_competitions'])('fills omitted %s filters and completes scoped attendance without a schema or repair round', async tool => {
    const config = {key:'test',baseUrl:'https://model.example/v1',model:'test'};
    const id=`${tool==='person_countries'?'person-countries':'person-competitions'}:2017YANR02:2025-01-01:2025-12-31:333`;
    let rounds=0;
    const fetcher=vi.fn<typeof fetch>(async(input)=>{
      if(String(input).endsWith('/chat/completions')) return ++rounds===1
        ? modelResponse({calls:[{tool,wcaId:'2017YANR02'}]})
        : modelResponse({answerKind:'grounded',answer:'2025 年三阶共 1 场比赛。',sourceIds:[id]});
      return Response.json(String(input).includes('/meta')?{lastImportedAt:'2026-11-03'}:{
        profile:{person:{name:'Test'}},results:[{competition_id:'A',event_id:'333'},{competition_id:'OtherEvent',event_id:'222'},{competition_id:'OtherYear',event_id:'333'}],
        comps:[{id:'A',start_date:'2025-06-01',country_iso2:'CN'},{id:'OtherEvent',start_date:'2025-06-01',country_iso2:'MY'},{id:'OtherYear',start_date:'2024-06-01',country_iso2:'US'}],
      });
    });
    const result=await answerSiteQuestion('那我去过哪些国家比赛？','zh',config,AbortSignal.timeout(5000),fetcher,history,'2017YANR02');
    expect(rounds).toBe(2);
    expect(result.sources.map(source=>source.id)).toEqual([id]);
    const modelRequests=fetcher.mock.calls.filter(([url])=>String(url).endsWith('/chat/completions'));
    const evidence=wireEvidence(JSON.parse(String(modelRequests[1][1]?.body)));
    expect(evidence[0]).toMatchObject({tool:{tool,wcaId:'2017YANR02',event:'333',from:'2025-01-01',to:'2025-12-31'}});
    expect(evidence[0].data).toMatchObject(tool==='person_countries'?{countries:[{iso2:'CN',competitions:1}]}:{count:1});
  });
});

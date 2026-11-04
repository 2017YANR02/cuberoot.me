import {describe, expect, it, vi} from 'vitest';
import {assistantAttendanceScope, attendanceScopeError} from '../src/utils/site_assistant_scope.js';
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
    expect(attendanceScopeError(active,{tool:'person_competitions',from:'2026-01-01',to:'2026-12-31'})).toBeUndefined();
    expect(attendanceScopeError(active,{tool:'person_competitions',from:'2025-01-01',to:'2025-12-31'})).toContain('constraints');
  });
  it('can reset only the year without bringing it back through the event hint', () => {
    const active = scope('不限年份，我参加过多少场比赛？');
    expect(active).toEqual({event:{text:'三阶'}});
    expect(attendanceScopeError(active,{tool:'person_countries'})).not.toContain('2025');
  });
  it.each(['不限年份和项目，我一共参加过多少场比赛？', '我生涯所有项目参加过多少场比赛？', 'Max Park 参加过多少场比赛？', '我的全部 PB 是多少？'])('releases stale scope for a reset or new topic: %s', question => {
    expect(scope(question)).toBeUndefined();
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
  it.each(['person_countries','person_competitions'])('rejects an incompatible %s before fetching lifetime data and gives the planner a repair turn', async tool => {
    const config = {key:'test',baseUrl:'https://model.example/v1',model:'test'};
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(modelResponse({calls:[{tool,wcaId:'2017YANR02'}]}))
      .mockResolvedValueOnce(modelResponse({answerKind:'general',answer:'需要按 2025 年三阶范围继续查询。',sourceIds:[]}));
    await answerSiteQuestion('那我去过哪些国家比赛？','zh',config,AbortSignal.timeout(5000),fetcher,history,'2017YANR02');
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls.every(([url])=>String(url).endsWith('/chat/completions'))).toBe(true);
    const request = JSON.parse(String(fetcher.mock.calls[1][1]?.body));
    const errors = wireEvidence(request);
    expect(errors[0].data).toMatchObject({notEvidence:true,error:expect.stringContaining('2025 / 三阶')});
    expect(request.messages.some((m:any)=>typeof m.content==='string' && m.content.includes('attendanceScope'))).toBe(true);
  });
});

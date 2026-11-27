import { assistantAnswerHistory } from "@cuberoot/shared/site-assistant";
import { rankingRowOperation } from '../src/utils/site_assistant_ranking_rows.js';
import { rankingCalculation } from '../src/utils/site_assistant_ranking_calculations.js';
import { describe, expect, it, vi } from 'vitest';
import { answerRanking, verifiedRankingSelection, cumulativeRanking, isRankingQuestion } from '../src/utils/site_assistant_rankings.js';

const page=(id:string,title:string)=>({lang:'zh',href:'/wca/about/'+id,title,text:title+'。按发布顺序显示。'});
const pages=[page('most_finals','进入决赛最多'),page('most_podiums_together','最多共同登台次数')];
const catalog={categories:[{stats:pages.map(p=>({id:p.href.split('/').pop()}))}]};
const result={id:'most_finals',titleZh:'进入决赛最多',header:[{key:'person',labelZh:'选手'},{key:'finals',labelZh:'决赛次数'}],rows:[['Person A',30],['Person B',28],['Person C',28]]};
const groups={id:'most_podiums_together',title:'共同登台',header:[{key:'podiums',labelZh:'次数'}],sections:[{title:'Pairs',rows:[[5]]},{title:'Triples',rows:[[1]]}]};
const read=async(url:string)=>url==='pages'?{pages}:url.endsWith('/index.json')?catalog:url.includes('most_finals')?result:groups;
const operation=(section='',start=1,end=1)=>'TABLE '+JSON.stringify({op:'rows',section,start,end});
describe('published ranking questions',()=>{
  it('reads the precise number of requested rows without a model',async()=>{
    const model=vi.fn();
    const answer=await answerRanking('进入决赛最多的前两位和次数',[],read,'pages',model);
    expect(answer?.answer).toContain('Person B');expect(answer?.answer).not.toContain('Person C');expect(model).not.toHaveBeenCalled();
  });
  it('computes differences from both published endpoints',async()=>{
    const answer=await answerRanking('进入决赛最多榜首比第三行多几次？',[],read,'pages',async()=>'TABLE {"op":"gap","section":"","start":1,"end":3}');
    expect(answer?.answer).toContain('相差 2');expect(answer?.answer).toContain('Person C');
  });
  it('requires selection when the population is unspecified',async()=>{
    const answer=await answerRanking('共同登台榜第一组是谁',[],read,'pages',async()=>operation());
    expect(answer?.answer).toMatch(/对子.*三人组/);
  });
  it('resolves a changed grouping from the latest cited table',async()=>{
    const answer=await answerRanking('那换成三人组呢？',[{role:'user',content:'共同登台对子第一是谁'},{role:'assistant',content:'[[stat:most_podiums_together]]'}],read,'pages',async()=>operation('Triples'));
    expect(answer?.answer).toContain('次数 1');expect(answer?.answer).not.toContain('次数 5');
  });
  it.each(['进入决赛最多榜只看日本选手前三','进入决赛最多榜的四阶前三','2021 年进入决赛最多的是谁'])('rejects a plan that dropped a constraint (%s)',async(q)=>{
    expect(await answerRanking(q,[],read,'pages',async()=>operation())).toBeUndefined();
  });
  it('does not use an arbitrary published table for unrelated questions or unavailable data',async()=>{
    expect(isRankingQuestion('网球大满贯谁最多？',[])).toBe(false);
    const model=vi.fn();
    expect(await answerRanking('海外参赛榜首',[],async()=>({}),'pages',model)).toBeUndefined();
    expect(model).not.toHaveBeenCalled();
  });
  it('links to the verified methodology when only the explanation page is wanted',async()=>{
    const model=vi.fn();
    const answer=await answerRanking('进入决赛最多的口径说明链接发给我',[],read,'pages',model);
    expect(answer?.sources[0].href).toBe('/wca/about/most_finals');expect(model).not.toHaveBeenCalled();
  });
});


describe('published calculations',()=>{
  it('computes the actual trimmed window, including ceiling and both ends',()=>{
    expect(rankingCalculation('average_of','滚动 Ao50 去掉几把，剩下多少？','N≥5 每端 ceil(N × 5%) 个')).toMatch(/最快的 3 把.*最慢的 3 把.*中间 44 把/);
    expect(rankingCalculation('average_of','滚动 Ao8 去掉几把？','N≥5 每端 ceil(N × 5%) 个')).toBeUndefined();
  });
  it('distinguishes eligibility to rise from guaranteed overtaking',()=>{
    expect(rankingCalculation('cohort-ranks','届别里后来的 PB 能改善名次吗？','生涯累积最佳')).toContain('取决于');
  });
  it('distinguishes attempts from rounds and computes the counterfactual',()=>{
    expect(rankingCalculation('success-rate','八个实际出手里两个 DNF，若分在不同轮次？','solved / attempted')).toMatch(/6\/8 = 75%/);
  });
  it('does not treat a world-wide scope as a country filter',async()=>{
    const answer=await answerRanking('全球进入决赛最多的第一行？',[],read,'pages',async()=>operation());
    expect(answer?.answer).toContain('Person A');
  });
  it('does not reuse a whole-history leaderboard when the user changes the year',async()=>{
    const answer=await answerRanking('那改成 2022 年呢？',[{role:'user',content:'进入决赛最多的前三位'},{role:'assistant',content:'[[stat:most_finals]]'}],read,'pages',async()=>operation());
    expect(answer).toBeUndefined();
  });
});


it('separates current and year-end standings from year-only performance filters',()=>{
  expect(cumulativeRanking('截至 2022 年底，中国三阶单次排名前三名的成绩',3,2026)).toMatchObject({type:'single',event:'333',country:'CN',year:2022,limit:3});
  expect(cumulativeRanking('2022 年内中国三阶单次排名前三名',3,2026)).toBeUndefined();
  expect(cumulativeRanking('只看北京的三阶平均排名前三名',3,2026)).toBeUndefined();
});

it('uses only actual attempts when DNS is supplied as an additional count',()=>{
  const q='各项目 DNF 率：二十次实际尝试有五次 DNF，另外六次 DNS，是多少？';
  expect(rankingCalculation('dnf_rate_by_event',q,'value = -1')).toContain('5/20 = 25%');
});
it('computes the difference when the question compares two rolling windows',()=>{
  const q='滚动 Ao50 比 Ao100 各少裁几把？两边加起来呢？';
  expect(rankingCalculation('average_of',q,'ceil(N × 5%)')).toContain('两端合计相差 4 把');
});

it('sums the selected metric and keeps row ordinals separate from values',async()=>{
  const answer=await answerRanking('进入决赛最多第二条和第三条求一个总和',[],read,'pages',vi.fn());
  expect(answer?.answer).toContain('合计 56');
  expect(answer?.answer).not.toContain('Person A');
});

it('looks up the literal competitor in published data and rejects a missing name',async()=>{
  const find=(name:string)=>async()=>'TABLE '+JSON.stringify({op:'rows',section:'',start:1,end:1,name});
  const hit=await answerRanking('进入决赛最多表里 Person B 有多少次？',[],read,'pages',find('Person B'));
  expect(hit?.answer).toMatch(/第 2 行.*Person B.*28/);
  const miss=await answerRanking('进入决赛最多表里 Person Brown 有多少次？',[],read,'pages',find('Person Brown'));
  expect(miss).toBeUndefined();
});

it('computes one Mo3 across rounds and distinguishes attempted solves from DNS',()=>{
  expect(rankingCalculation('average_of','滚动 Mo3，跨轮的 12、9、6秒可以连算吗？','Mo3 不裁剪')).toContain('9.00 秒');
  expect(rankingCalculation('dnf_rate_by_event','20 把真的动手，3 把失败，其余没到场的另计','value = -1')).toContain('3/20 = 15%');
});

it.each(['TABLE\n{"op":"rows","start":2,"end":2}', '{"op":"rows","start":2,"end":2}'])('accepts a validated table instruction regardless of transport formatting',async(decision)=>{
  const response=await answerRanking('帮我翻翻进入决赛最多表，次席到底是哪位？',[],read,'pages',async()=>decision);
  expect(response?.answer).toMatch(/第 2 行.*Person B/);
});

it('keeps a hypothetical about podium grouping on the methodology path',async()=>{
  const model=vi.fn(async()=>'FACT: 可以分别计入。');
  const response=await answerRanking('同一个领奖台能同时贡献到共同登台的对子榜和三人组榜吗？会混成一个数吗？',[],read,'pages',model);
  expect(response?.answer).toContain('可以分别计入');
  expect(model.mock.calls[0]?.[1]).not.toHaveProperty('table',expect.any(Array));
});

it('requires the two people to share the same event podium within the competition',()=>{
  expect(rankingCalculation('most_podiums_together','我拿二阶银牌，他拿五阶金牌，同一场比赛算共同登台吗？','')).toContain('0 次');
  expect(rankingCalculation('most_podiums_together','我拿二阶银牌，他拿二阶金牌，同一场比赛算共同登台吗？','')).toBeUndefined();
});

it('derives the difference between a named person and a row from the actual table',async()=>{
  const model=vi.fn(async()=>'TABLE {"op":"gap","start":1,"end":2}');
  const answer=await answerRanking('Person C 和进入决赛最多榜第一行差几次？',[],read,'pages',model);
  expect(answer?.answer).toContain('相差 2');
  expect(answer?.answer).toContain('Person C');
});

it('distinguishes a zero failure rate from an empty denominator',()=>{
  expect(rankingCalculation('dnf_rate_by_event','十二次实际尝试全成功，另有两个 DNS，怎么算？','value')).toContain('0%');
  expect(rankingCalculation('dnf_rate_by_event','只有四次DNS，没一个人出手，可以填零吗？','value')).toContain('分母为 0');
});

it('uses strict inequality even for numerically equal decimal strings',()=>{
  const q='屠榜时别人最好12秒，我有11.99、12.00、12.01，算几条？';
  expect(rankingCalculation('wr_dominance',q,'严格快于')).toMatch(/为 1 条.*11.99/);
});

it('answers both the per-end difference and the combined trimming cost',()=>{
  expect(rankingCalculation('average_of','滚动 Ao25 和 Ao50，后者每端多裁几把？两端一起呢？','ceil(N × 5%)')).toMatch(/少裁 1 把.*两端合计相差 2 把/);
});

describe('short published rankings and qualifiers',()=>{
  it('sums successive displayed positions and does not sum intervening rows for a sparse list',async()=>{
    const noModel=vi.fn(async()=>'LOOKUP');
    const summed=await answerRanking('进入决赛最多榜，第一、二、三位的次数相加等于多少？',[],read,'pages',noModel);
    expect(summed?.answer).toContain('合计 86');
    expect(noModel).not.toHaveBeenCalled();
    expect(await answerRanking('进入决赛最多榜，第一、三位的次数相加等于多少？',[],read,'pages',noModel)).toBeUndefined();
    expect(noModel).toHaveBeenCalledTimes(1);
  });
  it('retains a named grouping when a planner selects a different section',async()=>{
    const hit=await answerRanking('三人共同领奖这张表，麻烦念一遍排最前的组合',[],read,'pages',async()=>operation('Pairs'));
    expect(hit?.answer).toContain('Triples');
    expect(hit?.answer).toContain('次数 1');
  });
  it('keeps the year when filtering published weeks, and rejects a mixed-year plan',async()=>{
    const key='competitions_count_by_week';
    const data={id:key,titleZh:'每周比赛数量',header:[{key:'week_start',labelZh:'周起始'},{key:'competitions',labelZh:'比赛数'}],rows:[['1 Jan 2026',30],['6 Jan 2025',24]]};
    const reader=async(url:string)=>url==='pages'?{pages:[page(key,'每周比赛数量')]}:url.endsWith('index.json')?{categories:[{stats:[{id:key}]}]}:data;
    const hit=await answerRanking('就每周比赛数量表上已有的纪录，挑2025年排最前那周的起止和场数。',[],reader,'pages',vi.fn());
    expect(hit?.answer).toContain('6 Jan 2025');
    expect(hit?.answer).not.toContain('1 Jan 2026');
    expect(await answerRanking('每周比赛数量表上已有的2024与2025年第一周',[],reader,'pages',async()=>operation())).toBeUndefined();
  });
});

describe('compound operations on published rows',()=>{
  it('accepts a row read and calculation on the same operands; never mixes different scopes',async()=>{
    const q='进入决赛最多第二行跟第三行，我还想知道两者的差额。';
    const rows={op:'rows',start:2,end:3,section:''};
    const response=(end:number)=>async()=>'TABLE\n'+JSON.stringify(rows)+'\nTABLE\n'+JSON.stringify({...rows,op:'gap',end});
    expect((await answerRanking(q,[],read,'pages',response(3)))?.answer).toContain('相差 0');
    expect(await answerRanking(q,[],read,'pages',response(2))).toBeUndefined();
  });
  it('counts only the specified run before the first blind success',()=>{
    const question='盲拧成功前，先连续七次DNF然后成功，后来再失败三次，记多少？';
    expect(rankingCalculation('most_solves_before_bld_success',question,'findIndex')).toContain('7 次失败');
    expect(rankingCalculation('most_solves_before_bld_success',question.replace('然后成功','然后没成功'),'findIndex')).toBeUndefined();
  });
  it('resolves a paraphrase only to an existing table and uses its schema',async()=>{
    const model=vi.fn().mockResolvedValueOnce('most_finals').mockResolvedValueOnce(operation('',2,2));
    const answer=await answerRanking('比赛里闯到最后一轮最多的榜，请读第二行',[],read,'pages',model);
    expect(answer?.answer).toContain('Person B');
    expect(answer?.answer).not.toContain('Person A');
    expect(model).toHaveBeenCalledTimes(2);
    expect(await answerRanking('比赛里闯到最后一轮最多的榜，请读第二行',[],read,'pages',async()=>'unknown_table')).toBeUndefined();
  });
});

it('recomputes displayed arithmetic from the cited table when summarizing statistics evidence',async()=>{
  const q='决赛次数排第1到第3这三个人，加起来进了多少次决赛？';
  expect((await verifiedRankingSelection(q,'most_finals',read))?.answer).toContain('合计 86');
  expect(await verifiedRankingSelection(q,'most_completed_solves',read)).toBeUndefined();
  expect(await verifiedRankingSelection('只算日本选手，'+q,'most_finals',read)).toBeUndefined();
});

describe('published rows and their operands',()=>{
  it('preserves the requested count for a year-end ranking with a conversational suffix',()=>{
    const q='截至2018年底，日本选手的三阶平均最快两人和各自时间帮我列出。';
    expect(cumulativeRanking(q,undefined,2026)).toMatchObject({country:'JP',event:'333',type:'average',year:2018,limit:2});
    expect(cumulativeRanking(q.replace('日本选手','日本女子选手'),undefined,2026)).toBeUndefined();
  });
  it('adds just the requested adjacent rows and keeps disjoint sums with the planner',async()=>{
    expect((await verifiedRankingSelection('决赛次数榜的第二第三笔不去重直接相加为几？','most_finals',read))?.answer).toContain('合计 56');
    expect(await verifiedRankingSelection('决赛次数榜的第一第三笔不去重直接相加为几？','most_finals',read)).toBeUndefined();
  });
  it('resolves a comparison against the single cited row from the preceding reply',async()=>{
    const history=[{role:'user' as const,content:'决赛次数榜第三位是谁'},{role:'assistant' as const,content:'第 3 行：Person C，28 [[stat:most_finals]]'}];
    const model=vi.fn(async()=>'LOOKUP');
    const q='第一名和刚读的这个人差几次？';
    expect((await answerRanking(q,history,read,'pages',model))?.answer).toContain('相差 2');
    expect(model).not.toHaveBeenCalled();
    expect(await answerRanking(q,[{...history[0],content:'只看女子，决赛次数榜第三位是谁'},history[1]],read,'pages',model)).toBeUndefined();
  });
  it('compares every supplied value and leaves an extra or negative operand for interpretation',()=>{
    const calc=(q:string)=>rankingCalculation('wr_dominance',q,'严格 bisectLeft');
    expect(calc('屠榜门槛6.20秒，我做出6.15、6.19和6.20，打平也算吗？')).toMatch(/2 条.*6.15、6.19.*打平/);
    expect(calc('屠榜门槛6.20秒，我做出6.15、6.19和-1秒')).toBeUndefined();
  });
});

describe('selection used for the final ranking answer',()=>{
  it('projects only the two requested published rows when a lookup retrieved the entire table',async()=>{
    const answer=await verifiedRankingSelection('决赛次数最多的第二行和第三行分别是谁？','most_finals',read);
    const rows=answer?.answer.split('\n').filter(line=>line.startsWith('第 '));
    expect(rows).toEqual([
      expect.stringMatching(/^第 2 行：选手 Person B，决赛次数 28/),
      expect.stringMatching(/^第 3 行：选手 Person C，决赛次数 28/),
    ]);
    expect(answer?.answer).not.toContain('Person A');
    expect(await verifiedRankingSelection('只看女子，决赛次数最多的第二行和第三行分别是谁？','most_finals',read)).toBeUndefined();
  });
  it('uses the actual previous reply for consecutive follow-ups',async()=>{
    const model=vi.fn(async()=>'LOOKUP');
    const history:Array<{role:'user'|'assistant';content:string}>=[];
    for(const [q,expected] of [['决赛次数榜第一行是谁','Person A'],['再下一行呢？','Person B'],['再下一条呢？','Person C']]) {
      const a=await answerRanking(q,history,read,'pages',model);
      expect(a?.answer).toContain(expected);
      history.push({role:'user',content:q},{role:'assistant',content:a!.answer});
    }
    expect(model).not.toHaveBeenCalled();
  });
  it('calculates from the two previous rows, including tied scores',async()=>{
    const model=vi.fn(async()=>'LOOKUP'),q='决赛次数榜第二和第三行';
    const previous=await answerRanking(q,[],read,'pages',model);
    const sum=await answerRanking('把上面两行加起来是多少？',[{role:'user',content:q},{role:'assistant',content:previous!.answer}],read,'pages',model);
    expect(sum?.answer).toContain('合计 56');
    expect(model).not.toHaveBeenCalled();
  });
});


it('parses the whole date or group phrase before consuming its prefix',()=>{
  expect(rankingRowOperation('单月参赛最多榜，头两条各是哪年哪月的纪录，场数差多少？',/单月参赛最多/,'most_attended_competitions_in_single_month'))
    .toMatchObject({op:'gap',start:1,end:2});
  expect(rankingRowOperation('按大洲排成功还原数，第二、三行对应哪些大洲，各有多少？',/成功还原数/,'most_completed_solves'))
    .toMatchObject({op:'rows',section:'Continent',start:2,end:3});
  expect(rankingRowOperation('单月最能跑比赛的排行取第六至八笔，每笔谁在哪年哪月打了几站？',/单月最能跑比赛/,'most_attended_competitions_in_single_month'))
    .toMatchObject({op:'rows',start:6,end:8});
});

describe('follow-ups on the rows displayed in chat',()=>{
  it('sums the two visible rows after chat history expands the citation',async()=>{
    const q='决赛次数榜第二和第三行';
    const model=vi.fn(async()=>'LOOKUP');
    const first=await answerRanking(q,[],read,'pages',model);
    expect(first?.answer).toContain('Person C');
    const history=[{role:'user' as const,content:q},{role:'assistant' as const,content:assistantAnswerHistory(first!,'https://cuberoot.me')}];
    const follow=await answerRanking('把这两位的决赛次数放一起，一共有多少？',history,read,'pages',model);
    expect(follow?.answer).toContain('合计 56');
    expect(model).not.toHaveBeenCalled();
    const changed=history.map(m=>({...m,content:m.content.replace('Person B','Other B')}));
    expect((await answerRanking('这两位一共多少？',changed,read,'pages',model))?.answer).toBeUndefined();
    expect(model).toHaveBeenCalled();
  });

  it('uses the newly selected group when the user keeps the same row number',async()=>{
    const q='共同登台榜对子第一行';
    const first=await answerRanking(q,[],read,'pages',async()=>operation('Pairs'));
    expect(first?.answer).toContain('次数 5');
    const history=[{role:'user' as const,content:q},{role:'assistant' as const,content:assistantAnswerHistory(first!,'https://cuberoot.me')}];
    const model=vi.fn(async()=>'LOOKUP');
    const follow=await answerRanking('换成三人组，行号不动。',history,read,'pages',model);
    expect(follow?.answer).toContain('Triples');
    expect(follow?.answer).toContain('次数 1');
    expect(model).not.toHaveBeenCalled();
  });
});

it('adds just the two previously compared rows even when they are not adjacent',async()=>{
  const q='进入决赛最多榜首比第三行多几次？';
  const first=await answerRanking(q,[],read,'pages',async()=>'TABLE {"op":"gap","start":1,"end":3}');
  const history=[{role:'user' as const,content:q},{role:'assistant' as const,content:assistantAnswerHistory(first!,'https://cuberoot.me')}];
  const model=vi.fn(async()=>'LOOKUP');
  const answer=await answerRanking('这两位的次数一共多少？',history,read,'pages',model);
  expect(answer?.answer).toContain('合计 58');
  expect(answer?.answer).not.toContain('Person B');
  expect(model).not.toHaveBeenCalled();
});

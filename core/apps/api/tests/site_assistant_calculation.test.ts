import {expect,it,vi} from 'vitest';
import {suppliedAverageAnswer,suppliedTrainingComparison,suppliedTargetMean} from '../src/utils/site_assistant_calculation.js';
import {answerSiteQuestion,canReadPublicResult} from '../src/utils/site_assistant.js';

it.each([
 ['五次成绩是12秒、13秒、14秒、15秒和DNF，ao5是多少？','ao5 = 14.00 秒'],
 ['成绩为9.23秒,9.24,9.25,9.26,DNS，ao5是多少？','ao5 = 9.25 秒'],
 ['成绩是12秒、13、14、DNF、DNS，ao5是多少？','ao5 = DNF'],
 ['成绩是12秒、13、14、15、16，ao5是多少？','ao5 = 14.00 秒'],
 ['三次成绩是1.24秒、1.25和1.26，mo3是多少？','mo3 = 1.25 秒'],
 ['成绩是12秒、13和DNF，mo3是多少？','mo3 = DNF'],
 ['成绩是600秒、601和602，mo3是多少？','mo3 = 601 秒'],
])('uses the shared timed-statistics engine: %s',(question,result)=>{
 expect(suppliedAverageAnswer(question,'zh')).toContain(result);
});
it('supports an explicit English seconds list',()=>{
 expect(suppliedAverageAnswer('What is the ao5 of 12 seconds, 13, 14, 15 and DNF?','en')).toContain('ao5 = 14.00 seconds');
});
it.each([
 '成绩是12、13、14、15和DNF，ao5是多少？',
 '成绩是12秒、13、14和DNF，ao5是多少？',
 '三次成绩是12秒、13、14、15和DNF，ao5是多少？',
 '成绩是12秒、13、14、15+2和DNF，ao5是多少？',
 '成绩是12步、13、14、15和DNF，ao5是多少？',
 '成绩是12秒、13、14、15和DNF，ao5是多少？再查我的PB。',
 '成绩是0秒、13、14、15和DNF，ao5是多少？',
 '统计2017YANR02在2025年的ao5。',
])('leaves ambiguous or compound requests to the planner: %s',question=>{
 expect(suppliedAverageAnswer(question,'zh')).toBeUndefined();
});
it('returns computed supplied-data results without model, embedding or database reads',async()=>{
 const fetcher=vi.fn<typeof fetch>().mockRejectedValue(new Error('No reads expected'));
 const result=await answerSiteQuestion('五次成绩是12秒、13秒、14秒、15秒和DNF，ao5是多少？','zh',{key:'test',baseUrl:'https://model.example/v1',model:'fixture'},AbortSignal.timeout(2000),fetcher);
 expect(result.answer).toContain('14.00 秒');expect(result.sources).toEqual([]);expect(fetcher).not.toHaveBeenCalled();
});

const comparison='甲组尝试12次，成功3次；乙组共8次，其中成功6次。两组的成功率分别是多少？相差多少个百分点？说明为什么这些数据不能证明因果关系，并设计一次公平的复测。';

it('answers the complete comparison from supplied counts, including the direction and retest',async()=>{
  const fetcher=vi.fn<typeof fetch>();
  expect(canReadPublicResult({question:comparison,history:[]})).toBe(true);
  const result=await answerSiteQuestion(comparison,'zh',null,AbortSignal.timeout(1000),fetcher,[],undefined,undefined,'UTC',[],'deep');
  expect(result.answer).toContain('3/12 = 25%');
  expect(result.answer).toContain('6/8 = 75%');
  expect(result.answer).toMatch(/甲组比 乙组低 50 个百分点/);
  expect(result.answer).toMatch(/归因/);
  expect(result.answer).toMatch(/随机.*顺序/);
  expect(fetcher).not.toHaveBeenCalled();
});
it('reports equal rates with unequal denominators and rounds fractional percentages',()=>{
  const text=suppliedTrainingComparison('Group C: 1 success in 3 trials; group D: 2 successes in 6 attempts. Calculate both success rates and the percentage-point difference.','en');
  expect(text).toContain('1/3 ≈ 33.3333%');
  expect(text).toContain('0 percentage points apart');
  expect(text).not.toContain('random');
});
it.each([
  comparison.replace('成功3次','成功13次'),
  comparison.replace('共8次','共0次'),
  comparison.replace('乙组','甲组'),
  comparison+'并给出置信区间。',
  comparison.replace('说明为什么','不要说明为什么'),
  comparison.replace('两组的成功率','仅用决赛成绩计算两组的成功率'),
])('preserves invalid counts and additional instructions for the planner: %s',q=>{
  expect(suppliedTrainingComparison(q,'zh')).toBeUndefined();
});

it('derives a remaining target from supplied counts, and declines inconsistent or mixed requests',()=>{
  const q='我前2次均值3.00秒，后1次均值4.00秒。前3次合并的平均是多少？要让总共5次平均3秒，最后2次该平均多少？写出算式。';
  expect(suppliedTargetMean(q,'zh')).toBe('(2 × 3.00 + 1 × 4.00) ÷ 3 ≈ 3.33 秒\n\n(5 × 3 − 10.00) ÷ 2 = 2.50 秒');
  expect(suppliedTargetMean(q.replace('总共5次','总共6次'),'zh')).toBeUndefined();
  expect(suppliedTargetMean(q+'再算我的 Ao5。','zh')).toBeUndefined();
  expect(suppliedTargetMean(q.replace('5次平均3秒','5次平均1秒'),'zh')).toContain('无法达到');
});

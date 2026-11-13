import {expect,it,vi} from 'vitest';
import {suppliedAverageAnswer} from '../src/utils/site_assistant_calculation.js';
import {answerSiteQuestion} from '../src/utils/site_assistant.js';

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

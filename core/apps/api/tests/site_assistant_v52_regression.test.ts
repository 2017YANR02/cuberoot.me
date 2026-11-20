import { expect, it, vi } from 'vitest';
import { answerSiteQuestion } from '../src/utils/site_assistant.js';
import { assistantPlanExceedsDuration, assistantPlanSemanticViolation, assistantPlanShape, assistantStructuredPlanSchema } from '../src/utils/site_assistant_plan.js';
import fixtures from './fixtures/assistant-v52-al.json';

const config={key:'fixture',baseUrl:'https://api.deepseek.com/v1',model:'deepseek-flash'};
const response=(value:unknown)=>Response.json({choices:[{index:0,finish_reason:'stop',message:{role:'assistant',content:JSON.stringify(value)}}]});
type Sample=typeof fixtures[keyof typeof fixtures];
const run=(row:Sample,fetcher:typeof fetch)=>answerSiteQuestion(
  row.question,row.lang==='en'?'en':'zh',config,AbortSignal.timeout(5000),fetcher,
  row.history.map(({role,content})=>({role:role==='user'?'user':'assistant',content})),
);
const repeat=(draft:unknown)=>vi.fn<typeof fetch>().mockImplementation(async()=>response(draft));

it.each([fixtures.AL04.drafts[0],fixtures.AL04.drafts[2]])('keeps both locally checked branches from call $call',async({value})=>{
  const fetcher=repeat(value);
  const result=await run(fixtures.AL04,fetcher);
  expect(result.answer).toMatch(/对上就做一次熟悉的插入[\s\S]+若摆不出[，就]改做一次 D2/);
  expect(result.answer).toMatch(/若摆不出[，就]改做一次 R′/);
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it('still rejects an insertion after setup failure or without a local positive match',()=>{
  const row=fixtures.AL04, plan=assistantStructuredPlanSchema.parse(row.drafts[0].value.plan);
  const step=plan.activities[1].steps[0], original=step.action;
  for(const action of [
    original.replace('对上就做','直接做'),
    original.replace('与观察比较，然后停','与观察比较，然后做一次熟悉的插入'),
    original.replace('目视核对目标槽、边块和角块三处，',''),
  ]){
    step.action=action;
    expect(assistantPlanSemanticViolation(row.question,'',row.history[0].content,plan)).toBe('plan_fallback_branch_missing');
  }
});

it.each(fixtures.AL06.drafts)('distinguishes the B face from a clockwise B turn in call $call',async({value})=>{
  const fetcher=repeat(value);
  expect((await run(fixtures.AL06,fetcher)).answer).toMatch(/在 B (?:面|转动层)上选一张贴纸[\s\S]+做一次 B′/);
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it('still rejects executing a clockwise B',()=>{
  const row=fixtures.AL06, plan=assistantStructuredPlanSchema.parse(row.drafts[0].value.plan);
  const step=plan.activities[1].steps[0], original=step.action;
  for(const action of [original.replace('做一次 B′','做一次 B'),original+'然后转动 B 面一次。']){
    step.action=action;
    expect(assistantPlanSemanticViolation(row.question,'','',plan)).toBe('plan_unsupplied_move_sequence');
  }
});

it.each(fixtures.AL09.drafts.filter(draft=>draft.call===25 || draft.call===65))('counts each card drill once in call $call',async({value})=>{
  const fetcher=repeat(value);
  const result=await run(fixtures.AL09,fetcher);
  expect(result.answer).toMatch(/write the German name[^\n]+flip once to check[^\n]+(?:picture-side up)/);
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(assistantPlanExceedsDuration(value.answer,98/60)).toBe(false);
  expect(assistantPlanExceedsDuration(value.answer.replace('49 seconds','50 seconds'),98/60)).toBe(true);
  expect(assistantPlanExceedsDuration(value.answer.replace('\n- ','\n- 50 seconds: '),98/60)).toBe(true);
});

it('maps each timed substep and its reason to the correct activity',async()=>{
  const row=fixtures.AL08;
  expect(assistantPlanShape(row.question)).toMatchObject({activities:2,substepsPerActivity:2});
  const factory=vi.fn<typeof fetch>().mockResolvedValueOnce(response(row.drafts[2].value))
    .mockResolvedValueOnce(response(row.drafts[1].value));
  const {answer}=await run(row,factory);
  expect(answer.match(/^  - (?:31|32) seconds:/gm)).toHaveLength(4);
  const words=answer.trim().split(/\s+/).length;
  expect(words).toBeGreaterThanOrEqual(127);
  expect(words).toBeLessThanOrEqual(151);
});

it.each(fixtures.AL12.drafts)('renders the coherent two-direction outline in one paragraph in call $call',async({value})=>{
  const fetcher=repeat(value);
  const {answer}=await run(fixtures.AL12,fetcher);
  expect(answer).not.toMatch(/[\r\n]/);
  expect(answer).toMatch(/72 seconds[\s\S]+Cover the meaning column[\s\S]+Cover the word column/);
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it('enforces the revised time and rejects an inconsistent paragraph outline',async()=>{
  const row=fixtures.AL12,draft=row.drafts[0].value;
  for(const answer of [draft.answer.replace('72 seconds','74 seconds').replaceAll('36 seconds','37 seconds'),draft.answer.replace('36 seconds','37 seconds')]){
    await expect(run(row,repeat({...draft,answer}))).rejects.toMatchObject({code:'model_output_invalid'});
  }
});

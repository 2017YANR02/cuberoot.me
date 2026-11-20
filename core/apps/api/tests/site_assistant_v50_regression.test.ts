import { expect, it, vi } from 'vitest';
import { answerSiteQuestion } from '../src/utils/site_assistant.js';
import { assistantPlanSemanticViolation, assistantStructuredPlanSchema, capAssistantPlanSteps } from '../src/utils/site_assistant_plan.js';
import { assistantPlanSupplement, assistantPresentationContract, assistantPresentationViolation } from '../src/utils/site_assistant_presentation.js';
import fixtures from './fixtures/assistant-v50-aj.json';

const config={key:'fixture',baseUrl:'https://api.deepseek.com/v1',model:'deepseek-flash'};
const responseText=(content:string)=>Response.json({choices:[{index:0,finish_reason:'stop',message:{role:'assistant',content}}]});
const response=(value:unknown)=>responseText(JSON.stringify(value));
const replay=(row:typeof fixtures[keyof typeof fixtures],fetcher:typeof fetch)=>answerSiteQuestion(row.question,row.lang==='en'?'en':'zh',config,AbortSignal.timeout(5000),fetcher,row.history.map(({role,content})=>({role:role==='user'?'user':'assistant',content})));

it.each(fixtures.AJ03.drafts)('keeps the validated activities and the distinct ending from AJ03 call $call',async ({value})=>{
  const fetcher=vi.fn<typeof fetch>().mockImplementation(async()=>response(value));
  const result=await replay(fixtures.AJ03,fetcher);
  expect(result.answer).toMatch(/^1\. .+: \d+ seconds\n/);
  expect(result.answer).toMatch(/\n\nMona, please mark each early release on the recording\.$/);
  expect(result.answer.match(/Mona/g)).toHaveLength(1);
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it.each([...fixtures.AJ04.drafts,fixtures.AJ05.drafts[0]])('accepts the supported slow-turn alternatives in call $call',async ({value,call})=>{
  const fetcher=vi.fn<typeof fetch>().mockImplementation(async()=>response(value));
  const row=call===60 ? fixtures.AJ05 : fixtures.AJ04;
  const result=await replay(row,fetcher);
  expect(result.answer).toMatch(call===60?/(?:OTHERWISE)[\s\S]+(?:OTHERWISE)/:/否则[\s\S]+(?:慢转|慢拧)/);
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it('returns the AJ05 repair through the normal JSON and plan checks when the first response is malformed',async()=>{
  const row=fixtures.AJ05;
  const fetcher=vi.fn<typeof fetch>().mockResolvedValueOnce(responseText(row.malformedDraft))
    .mockImplementation(async()=>response(row.drafts[1].value));
  const result=await replay(row,fetcher);
  expect(result.answer).toMatch(/OTHERWISE[\s\S]+U2[\s\S]+OTHERWISE[\s\S]+F/);
  expect(fetcher.mock.calls.length).toBeLessThanOrEqual(2);
});

it('still rejects an undeclared move or a subsequent unguarded insertion on the slow-turn fallback',()=>{
  const row=fixtures.AJ05;
  const plan=assistantStructuredPlanSchema.parse(row.drafts[0].value.plan);
  const step=plan.activities[1].steps[0];
  const original=step.action;
  step.action=original.replace('single slow F or U2 turn','single slow D2 turn');
  expect(assistantPlanSemanticViolation(row.question,'',row.history[0].content,plan)).toBe('plan_slow_turn_alternative_missing');
  step.action=original.replace('stop without inserting','then perform the insertion');
  expect(assistantPlanSemanticViolation(row.question,'',row.history[0].content,plan)).toBe('plan_fallback_branch_missing');
});

it('corrects a child allocation above its explicit cap while retaining the original executable drill',async ()=>{
  const row=fixtures.AJ07;
  const value=row.drafts[0].value;
  const fetcher=vi.fn<typeof fetch>().mockImplementation(async()=>response(value));
  const result=await replay(row,fetcher);
  expect(result.answer).toMatch(/\(40 秒\)\n  - 12 秒:/);
  expect(result.answer.match(/  - 28 秒:/g)).toHaveLength(2);
  expect(result.answer).toContain(value.plan.activities[1].steps[1].action);
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it('keeps duration-bearing actions unchanged and still rejects a second independent paragraph',()=>{
  const timed=assistantStructuredPlanSchema.parse(fixtures.AJ07.drafts[0].value.plan);
  for(const activity of timed.activities)activity.steps[1].action+=' 至少练三十五秒。';
  expect(capAssistantPlanSteps(timed,28)).toBeUndefined();
  const row=fixtures.AJ03;
  const draft=row.drafts[1].value;
  const plan=assistantStructuredPlanSchema.parse(draft.plan);
  const answer=draft.answer+'\n\nThen label the timestamp.';
  expect(assistantPlanSupplement(answer,2,plan)).toBe(answer);
  expect(assistantPresentationViolation(answer,assistantPresentationContract(row.question),2)).toBe('presentation_local_sentence_scope');
});

it.each([...fixtures.AJ10.drafts,...fixtures.AJ12.drafts])('reuses the supplied two-sided deck and usable repeat branch in call $call',async ({value,call})=>{
  const row=call<30?fixtures.AJ10:fixtures.AJ12;
  const fetcher=vi.fn<typeof fetch>().mockImplementation(async()=>response(value));
  const result=await replay(row,fetcher);
  expect(result.answer).toContain(value.plan.activities[0].steps[0].action);
  expect(result.answer).toContain(value.plan.activities[1].steps[0].action);
  expect(fetcher).toHaveBeenCalledTimes(1);
});

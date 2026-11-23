import { expect, it, vi } from 'vitest';
import { answerSiteQuestion } from '../src/utils/site_assistant.js';
import { assistantPlanSemanticViolation, assistantPlanShape, assistantStructuredPlanSchema, normalizeAssistantHandPractice } from '../src/utils/site_assistant_plan.js';
import fixtures from './fixtures/assistant-v51-ak.json';

const config={key:'fixture',baseUrl:'https://api.deepseek.com/v1',model:'deepseek-flash'};
const response=(value:unknown)=>Response.json({choices:[{index:0,finish_reason:'stop',message:{role:'assistant',content:JSON.stringify(value)}}]});
const replay=(row:typeof fixtures[keyof typeof fixtures],fetcher:typeof fetch)=>answerSiteQuestion(row.question,row.lang==='en'?'en':'zh',config,AbortSignal.timeout(5000),fetcher,row.history.map(({role,content})=>({role:role==='user'?'user':'assistant',content})));
const repeat=(draft:unknown)=>vi.fn<typeof fetch>().mockImplementation(async()=>response(draft));

it.each(fixtures.AK02.drafts)('keeps the timed practice and the independent request in call $call',async ({value})=>{
  const fetcher=repeat(value);
  const result=await replay(fixtures.AK02,fetcher);
  expect(result.answer).toMatch(/^1\. .+: 30 seconds\n/);
  expect(result.answer).toMatch(/^2\. .+: 31 seconds\n/m);
  expect(result.answer).toMatch(/\n\nSam, please flag the early releases in my video\.$/);
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it('keeps the already separated untimed grip practice without review',async()=>{
  const fetcher=repeat(fixtures.AK03.drafts[0].value);
  const result=await replay(fixtures.AK03,fetcher);
  expect(result.answer).toContain('Alternating two-hand regrip');
  expect(result.answer).toMatch(/\n\nNoor, could you compare the clips on Thursday\?$/);
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it('uses a direct plan repair for unrecognized source-free hand-practice formatting',async()=>{
  const {drafts}=fixtures.AK03;
  const fetcher=vi.fn<typeof fetch>().mockResolvedValueOnce(response(drafts[1].value)).mockResolvedValueOnce(response(drafts[2].value));
  const result=await replay(fixtures.AK03,fetcher);
  expect(result.answer).toMatch(/\n\nNoor, please compare the clips on Thursday\.$/);
  expect(fetcher).toHaveBeenCalledTimes(2);
  const repair=JSON.parse(String(fetcher.mock.calls[1][1]?.body));
  expect(repair.thinking.type).toBe('disabled');
  expect(repair.max_tokens).toBeLessThanOrEqual(4096);
});

it('keeps the total cap and refuses to treat a second ending paragraph as a drill',async()=>{
  const row=fixtures.AK02,draft=row.drafts[0].value;
  const over={...draft,answer:draft.answer.replaceAll('30 seconds','35 seconds')};
  await expect(replay(row,repeat(over))).rejects.toMatchObject({code:'model_output_invalid'});
  expect(normalizeAssistantHandPractice(draft.answer+'\n\nAlso send the video.',assistantPlanShape(row.question)!,true)).toBeUndefined();
});

it.each([...fixtures.AK04.drafts,fixtures.AK05.drafts[0]])('accepts named fallback turns and local visual checks in call $call',async ({call,value})=>{
  const row=call===17?fixtures.AK05:fixtures.AK04;
  const fetcher=repeat(value);
  const result=await replay(row,fetcher);
  expect(result.answer).toContain(call===17?'if setup fails':'若摆不出');
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it('continues rejecting unlisted turns or an insertion on a failed setup',()=>{
  const row=fixtures.AK05;
  const plan=assistantStructuredPlanSchema.parse(row.drafts[0].value.plan);
  const step=plan.activities[1].steps[0], original=step.action;
  step.action=original.replace('then do L2 slowly','then do B2 slowly');
  expect(assistantPlanSemanticViolation(row.question,'',row.history[0].content,plan)).toBe('plan_slow_turn_alternative_missing');
  step.action=original.replace('stop without inserting','then perform the known insertion');
  expect(assistantPlanSemanticViolation(row.question,'',row.history[0].content,plan)).toBe('plan_fallback_branch_missing');
});

it.each(fixtures.AK09.drafts)('recognizes written recall before a flip in call $call',async ({value})=>{
  const fetcher=repeat(value);
  const result=await replay(fixtures.AK09,fetcher);
  expect(result.answer).toMatch(/write the Korean word[\s\S]+flip once to check/);
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it.each(fixtures.AK13.drafts)('verifies the exact sheet quote from the preceding user turn in call $call',async ({value})=>{
  const fetcher=repeat(value);
  const result=await replay(fixtures.AK13,fetcher);
  expect(result.answer).toContain('Cover the meaning column');
  expect(result.answer).not.toMatch(/[\r\n]/);
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it('repairs an instruction used as a quote using the original user turns only',async()=>{
  const row=fixtures.AK05;
  const fetcher=vi.fn<typeof fetch>().mockResolvedValueOnce(response(row.drafts[1].value))
    .mockResolvedValueOnce(response(row.drafts[0].value));
  await expect(replay(row,fetcher)).resolves.toHaveProperty('answer');
  expect(fetcher).toHaveBeenCalledTimes(2);
  const repair=JSON.parse(String(fetcher.mock.calls[1][1]?.body));
  expect(JSON.stringify(repair.messages)).toContain('Copy each plan input quote verbatim');
  expect(repair.thinking.type).toBe('disabled');
});

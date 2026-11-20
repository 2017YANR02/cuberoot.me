import { expect, it, vi } from 'vitest';
import { answerSiteQuestion } from '../src/utils/site_assistant.js';
import { assistantPlanSemanticViolation, assistantStructuredPlanSchema, renderAssistantPlan } from '../src/utils/site_assistant_plan.js';
import { assistantPresentationContract, assistantPresentationViolation } from '../src/utils/site_assistant_presentation.js';
import replays from './fixtures/assistant-v44-ad.json';

const config={key:'fixture',baseUrl:'https://api.deepseek.com/v1',model:'deepseek-flash'};
type Replay=typeof replays[number];
type Draft=Replay['drafts'][number];
const replay=(id:string)=>replays.find(row=>row.id===id)!;
const response=(value:unknown)=>Response.json({choices:[{index:0,finish_reason:'stop',message:{role:'assistant',content:JSON.stringify(value)}}]});
const answer=(row:Replay,fetcher:typeof fetch)=>answerSiteQuestion(row.question,row.lang==='zh'?'zh':'en',config,AbortSignal.timeout(5000),fetcher,row.history.map(({role,content})=>({role:role==='user'?'user':'assistant',content})));
const semantic=(row:Replay,draft:Draft)=>{
  const plan=assistantStructuredPlanSchema.parse(draft.plan);
  return assistantPlanSemanticViolation(row.question,renderAssistantPlan(plan,true,row.lang==='zh'?'zh':'en'),row.history[0]?.content,plan);
};

const slow=replay('AD01');
it.each(slow.drafts.map((draft,index)=>({draft,call:slow.calls[index]})))('accepts visual confirmation and distinct slow-turn alternatives in AD01 draft $call on the first call',async({draft})=>{
  expect(semantic(slow,draft)).toBeUndefined();
  const fetcher=vi.fn<typeof fetch>().mockResolvedValueOnce(response(draft));
  const result=await answer(slow,fetcher);
  expect(result.answer).toMatch(/停一下[\s\S]*预测/);
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it.each(['撤掉验证','核对结果有误','并未目视核对目标槽和两块所在位置'])('does not permit insertion on a missing or negative check (%s)',condition=>{
  const draft=structuredClone(slow.drafts[0]);
  const step=draft.plan!.activities[1].steps[0];
  step.action=step.action.replace('停手目视核对目标槽和两块所在位置',condition);
  expect(semantic(slow,draft)).toBe('plan_fallback_branch_missing');
});

const empty=replay('AD06');
it.each(empty.drafts)('recognizes the no-missed-words branch without accepting an empty retry',draft=>{
  expect(semantic(empty,draft)).toBeUndefined();
  const wrong=structuredClone(draft);
  const step=wrong.plan!.activities[1].steps[1];
  step.action=step.action.replace('repeat the complete list','repeat the missed words');
  expect(semantic(empty,wrong)).toBe('plan_subset_availability');
});

it.each(empty.drafts.slice(2))('delivers an in-range AD06 draft without another call',async draft=>{
  const fetcher=vi.fn<typeof fetch>().mockResolvedValueOnce(response(draft));
  const result=await answer(empty,fetcher);
  expect(result.answer).toMatch(/If no words were missed, repeat the complete list/);
  expect(fetcher).toHaveBeenCalledTimes(1);
});

const mixed=replay('AD12');
it.each(mixed.drafts.map((draft,index)=>({draft,call:mixed.calls[index]})))('preserves activities and the independent closing sentence in AD12 draft $call',async({draft})=>{
  const fetcher=vi.fn<typeof fetch>().mockResolvedValueOnce(response(draft));
  const result=await answer(mixed,fetcher);
  expect(result.answer).toMatch(/^1\.[\s\S]*^2\./m);
  expect(result.answer.trim().split(/\n\s*\n/).at(-1)).toMatch(/^Morgan, .* Sunday[.?!]$/);
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it('only requests the missing ending when a validated plan already exists',async()=>{
  const original=structuredClone(mixed.drafts[2]);
  original.answer='';
  const ending='Morgan, please try these drills on Sunday.';
  const fetcher=vi.fn<typeof fetch>().mockResolvedValueOnce(response(original))
    .mockResolvedValueOnce(response({answerKind:'general',answer:ending,sourceIds:[]}));
  const result=await answer(mixed,fetcher);
  const plan=assistantStructuredPlanSchema.parse(original.plan);
  expect(result.answer).toBe(renderAssistantPlan(plan,false,'en')+'\n\n'+ending);
  expect(fetcher).toHaveBeenCalledTimes(2);
  const repair=JSON.parse(String(fetcher.mock.calls[1][1]?.body));
  expect(repair.thinking).toEqual({type:'disabled'});
  expect(JSON.stringify(repair.messages)).toContain('ONLY the requested independent writing in answer');
});

it('does not count a separately split second invitation as an activity',()=>{
  const contract=assistantPresentationContract(mixed.question);
  const original=mixed.drafts[0].answer;
  expect(assistantPresentationViolation(original,contract,2)).toBeUndefined();
  expect(assistantPresentationViolation(original+'\n\nRemember to bring the cube.',contract,2)).toBe('presentation_local_sentence_scope');
  expect(assistantPresentationViolation(original+' Remember to bring the cube.',contract,2)).toBe('presentation_local_sentence_count');
});

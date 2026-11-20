import { expect, it, vi } from 'vitest';
import { answerSiteQuestion } from '../src/utils/site_assistant.js';
import { assistantCubePlanGuidance, assistantObservationOnlyPlan, assistantPlanSemanticViolation, assistantPlanShape, renderAssistantPlan, assistantStructuredPlanSchema } from '../src/utils/site_assistant_plan.js';
import replays from './fixtures/assistant-v43-ac.json';

const config={key:'fixture',baseUrl:'https://api.deepseek.com/v1',model:'deepseek-flash'};
type Replay=typeof replays[number];
type Draft=Replay['drafts'][number];
const replay=(id:string)=>replays.find(row=>row.id===id)!;
const modelResponse=(draft:unknown)=>Response.json({choices:[{index:0,finish_reason:'stop',message:{role:'assistant',content:JSON.stringify(draft)}}]});
const answer=(row:Replay,fetcher:typeof fetch)=>answerSiteQuestion(row.question,row.lang==='zh'?'zh':'en',config,AbortSignal.timeout(5000),fetcher,row.history.map(({role,content})=>({role:role==='user'?'user':'assistant',content})));
const violation=(row:Replay,draft:Draft)=>{
  const plan=draft.plan?assistantStructuredPlanSchema.parse(draft.plan):undefined;
  const text=plan?renderAssistantPlan(plan,true,'en'):draft.answer;
  return assistantPlanSemanticViolation(row.question,text,row.history[0]?.content,plan);
};

const confirmed=replay('AC02');
it.each(confirmed.drafts.map((draft,index)=>({draft,call:confirmed.calls[index]})))('accepts exact prior quotes and observed confirmation in AC02 draft $call without repair',async({draft})=>{
  expect(violation(confirmed,draft)).toBeUndefined();
  const fetcher=vi.fn<typeof fetch>().mockResolvedValueOnce(modelResponse(draft));
  const result=await answer(confirmed,fetcher);
  expect(result.answer).toMatch(/77 秒[\s\S]*77 秒/);
  expect(result.answer).toMatch(/停一下[\s\S]*预测/);
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it.each(['核对失败，','', '目视核对目标槽和两块位置，直接'])('rejects execution without a successful local check (%s)',prefix=>{
  const row=replay('AC02');
  const draft=structuredClone(row.drafts[2]);
  const step=draft.plan!.activities[1].steps[0];
  step.action=step.action.replace('目视核对目标槽和两块位置无误后',prefix);
  expect(violation(row,draft)).toBe('plan_fallback_branch_missing');
});

for(const id of ['AC01','AC03']) {
  const row=replay(id);
  it.each(row.drafts.map((draft,index)=>({draft,call:row.calls[index]})))('uses current turning permission and rejects static output for '+id+' draft $call',async({draft})=>{
    const prior=row.history[0].content;
    expect(assistantObservationOnlyPlan(row.question,prior)).toBe(false);
    expect(assistantPlanShape(row.question)).toMatchObject({activities:2});
    expect(assistantCubePlanGuidance(row.question,prior)).toContain('distinct, concrete known-turn exercise');
    expect(violation(row,draft)).toMatch(/^plan_(?:slow_turn_alternative|fallback_branch)_missing$/);
    const fetcher=vi.fn<typeof fetch>().mockImplementation(async()=>modelResponse(draft));
    await expect(answer(row,fetcher)).rejects.toThrow('model_output_invalid');
    const initialRequest=String(fetcher.mock.calls[0][1]?.body);
    expect(initialRequest).toContain('distinct, concrete known-turn exercise');
    const messages=JSON.parse(initialRequest).messages as Array<{role:string;content:string}>;
    const contexts=messages.filter(message=>message.role==='user' && message.content.startsWith('{"question"')).map(message=>JSON.parse(message.content));
    expect(contexts[0]).toMatchObject({maximumTotalSeconds:id==='AC01'?132:107});
  });
}

it('applies the latest explicit observation constraint and keeps negated permissions inactive',()=>{
  expect(assistantObservationOnlyPlan('可以慢转了。\n现在只观察，不转层。')).toBe(true);
  expect(assistantObservationOnlyPlan('不可以慢转，只观察。','I can turn slowly now.')).toBe(true);
  expect(assistantObservationOnlyPlan('I can now turn the cube slowly.','No cube turns for now.')).toBe(false);
});

const column=replay('AC11');
it.each(column.drafts.slice(0,2))('accepts exposing the new meaning cue before an attempt at spelling',draft=>{
  expect(violation(column,draft)).toBeUndefined();
});

it('still rejects uncovering the spelling answer before writing the original attempt',()=>{
  const draft=structuredClone(column.drafts[0]);
  draft.plan!.activities[1].steps[0].action='Uncover the Ukrainian word column to reveal the spelling answer, then write your attempted word on paper.';
  expect(violation(column,draft)).toBe('plan_answer_revealed_before_attempt');
});

const empty=replay('AC12');
it.each(empty.drafts.slice(2))('accepts using the complete list if there are no errors without another model call',async draft=>{
  const fetcher=vi.fn<typeof fetch>().mockResolvedValueOnce(modelResponse(draft));
  const result=await answer(empty,fetcher);
  expect(result.answer).toContain('if zero errors reuse the complete list');
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it('scopes the zero-error exception before otherwise and rejects repeating an empty set',()=>{
  const draft=structuredClone(empty.drafts[2]);
  const step=draft.plan!.activities[1].steps[1];
  step.action=step.action.replace('; otherwise',', otherwise');
  expect(violation(empty,draft)).toBeUndefined();
  step.action=step.action.replace('reuse the complete list for another round','repeat the missed items');
  expect(violation(empty,draft)).toBe('plan_subset_availability');
});

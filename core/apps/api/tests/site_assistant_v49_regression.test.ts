import { expect, it, vi } from 'vitest';
import { answerSiteQuestion } from '../src/utils/site_assistant.js';
import { assistantPlanShape, assistantPlanTimeBounds, assistantStructuredPlanSchema, validateAssistantPlan } from '../src/utils/site_assistant_plan.js';
import { assistantPresentationContract, assistantPresentationViolation } from '../src/utils/site_assistant_presentation.js';
import fixtures from './fixtures/assistant-v49-ai.json';

const config={key:'fixture',baseUrl:'https://api.deepseek.com/v1',model:'deepseek-flash'};
const response=(value:unknown)=>Response.json({choices:[{index:0,finish_reason:'stop',message:{role:'assistant',content:JSON.stringify(value)}}]});
const replay=(row:typeof fixtures[keyof typeof fixtures],fetcher:typeof fetch)=>answerSiteQuestion(row.question,row.lang==='en'?'en':'zh',config,AbortSignal.timeout(5000),fetcher,row.history.map(({role,content})=>({role:role==='user'?'user':'assistant',content})));

it('limits “结尾单独一段 … 只写一句” to the invitation in AI03',()=>{
  const contract=assistantPresentationContract(fixtures.AI03.question);
  expect(contract.sentences).toBeUndefined();
  expect(contract.localTail).toMatchObject({sentences:1,separateParagraph:true});
  const body='1. 慢拨观察：30 秒\n检查拨动时中指何时离面。\n2. 换方向：34 秒\n记录离面的时点。';
  expect(assistantPresentationViolation(body+'\n\n小海，周三一起试这两项吧。',contract,2)).toBeUndefined();
  expect(assistantPresentationViolation(body+'\n\n小海，周三一起试吧。记得带上魔方。',contract,2)).toBe('presentation_local_sentence_count');
  expect(assistantPresentationViolation(body+' 小海，周三一起试吧。',contract,2)).toBe('presentation_local_sentence_scope');
  expect(assistantPresentationContract('单独一段，只写一句邀请小海的话。')).toEqual({sentences:1});
});

it('retains the AI03 draft activities and repairs only the absent invitation',async()=>{
  const row=fixtures.AI03;
  const ending='小海，周三一起试试这两项练习吧。';
  const fetcher=vi.fn<typeof fetch>().mockResolvedValueOnce(response(row.draft))
    .mockResolvedValueOnce(response({answerKind:'general',answer:ending,sourceIds:[]}));
  const result=await replay(row,fetcher);
  expect(result.answer).toMatch(/^1\. 慢拨一层观察中指松开：30 秒\n/);
  expect(result.answer).toContain(row.draft.plan.activities[0].steps[0].action);
  expect(result.answer).toContain('\n\n'+ending);
  expect(fetcher).toHaveBeenCalledTimes(2);
  const repair=JSON.parse(String(fetcher.mock.calls[1][1]?.body));
  expect(repair.messages[1].content).toContain('Repair only the final writing request');
  expect(repair.thinking.type).toBe('disabled');
});

it('repairs the unstructured AI02 draft as an untimed plan without an evidence review',async()=>{
  const row=fixtures.AI02;
  const fetcher=vi.fn<typeof fetch>().mockResolvedValueOnce(response(row.draft)).mockResolvedValueOnce(response(row.repair));
  const result=await replay(row,fetcher);
  expect(result.answer).toMatch(/^1\. 桌面换手目视检查/);
  expect(result.answer).toMatch(/^2\. 口令换手触感检查/m);
  expect(result.answer).toContain('\n\n'+row.repair.answer);
  expect(result.answer).not.toMatch(/秒|数两拍/);
  expect(fetcher).toHaveBeenCalledTimes(2);
  const repair=JSON.parse(String(fetcher.mock.calls[1][1]?.body));
  expect(JSON.stringify(repair.messages)).toContain('Repair plan_structure_missing');
  expect(repair.thinking.type).toBe('disabled');
});

it('renders each numeric allocation once and honours either requested title style',async()=>{
  const row=fixtures.AI01;
  const fetcher=vi.fn<typeof fetch>().mockResolvedValueOnce(response(row.draft));
  const result=await replay(row,fetcher);
  expect(result.answer).toMatch(/^1\. Thumb contact pause: 30 seconds\n/);
  expect(result.answer).toMatch(/^2\. Thumb slide trace: 33 seconds\n/m);
  expect(result.answer).not.toContain('(30 seconds)');
  expect(result.answer).toContain('\n\n'+row.draft.answer);
  expect(fetcher).toHaveBeenCalledTimes(1);
  const plan=assistantStructuredPlanSchema.parse(row.draft.plan);
  plan.activities[0].title='Thumb contact pause';
  const shape=assistantPlanShape(row.question.split('Then,')[0]);
  const options={shape,maximumMinutes:63/60,timed:true,userTexts:[row.question],lang:'en' as const};
  expect(validateAssistantPlan(plan,options).answer).toMatch(/^1\. Thumb contact pause: 30 seconds\n/);
  plan.activities[0].title='Thumb contact pause: 31 seconds';
  expect(validateAssistantPlan(plan,options).error).toBe('plan_duration_mismatch');
});

it.each([fixtures.AI04,fixtures.AI05])('replays verified slow-turn plan and both executable alternatives in original call $call',async row=>{
  const fetcher=vi.fn<typeof fetch>().mockResolvedValueOnce(response(row.draft));
  const result=await replay(row,fetcher);
  expect(result.answer).toMatch(/观察[\s\S]+预测/);
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it('does not accept a fabricated quote in a similarly referenced plan',()=>{
  const row=fixtures.AI05;
  const plan=assistantStructuredPlanSchema.parse(row.draft.plan);
  plan.inputs[0].quote='我已经练过这一个特定的公式';
  expect(validateAssistantPlan(plan,{timed:true,maximumMinutes:139/60,userTexts:[row.history[0].content,row.question],lang:'zh'}).error).toBe('plan_unverified_input');
});

it('keeps the separately phrased AI10 substep cap alongside the plan cap',()=>{
  const question='借用我手边的捷克语词表给两项各有两小步的练习。各小步给理由和各自秒数，最多三十一秒，两项合计最多一百一十八秒。第一项看词说词义，第二项让词义可见，先写拼法再核对，零错时把全表再过一遍。';
  expect(assistantPlanTimeBounds(question)).toEqual({step:31,total:118});
  expect(assistantPlanTimeBounds('各小步都写出理由和秒数。最多三十一秒。')).toEqual({total:31});
  expect(assistantPlanTimeBounds('各小步都写出理由和秒数，两项合计最多三十一秒。')).toEqual({total:31});
  const activity=(first:number)=>({title:'核对词义',seconds:first+20,steps:[{action:'说出词义',reason:'练习回忆',seconds:first},{action:'核对答案',reason:'纠正错误',seconds:20}]});
  const options={shape:assistantPlanShape(question),timed:true,maximumMinutes:118/60,userTexts:[question],lang:'zh' as const};
  expect(validateAssistantPlan({activities:[activity(38),activity(20)]},options).error).toBe('duration_limit_exceeded');
  expect(validateAssistantPlan({activities:[activity(31),activity(20)]},options).error).toBeUndefined();
});

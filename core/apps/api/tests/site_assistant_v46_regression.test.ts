import { expect, it, vi } from 'vitest';
import { answerSiteQuestion } from '../src/utils/site_assistant.js';
import { assistantPlanShape, validateAssistantPlan } from '../src/utils/site_assistant_plan.js';
import { assistantPresentationContract, assistantPresentationViolation } from '../src/utils/site_assistant_presentation.js';
import fixture from './fixtures/assistant-v46-af.json';

const config={key:'fixture',baseUrl:'https://api.deepseek.com/v1',model:'deepseek-flash'};
const reply=(value:unknown)=>Response.json({choices:[{index:0,finish_reason:'stop',message:{role:'assistant',content:JSON.stringify(value)}}]});

it.each(Object.entries(fixture.questions))('attributes the sentence count to the final paragraph (%s)',(_id,question)=>{
  const contract=assistantPresentationContract(question);
  expect(contract.sentences).toBeUndefined();
  expect(contract.localTail).toMatchObject({sentences:1,separateParagraph:true});
  const answer='1. Check the first movement.\n2. Check the second movement.\n\nWant to try these together?';
  expect(assistantPresentationViolation(answer,contract,2)).toBeUndefined();
  expect(assistantPresentationViolation(answer+' Bring a cube.',contract,2)).toBe('presentation_local_sentence_count');
  expect(assistantPresentationViolation(answer.replace('\n\n',' '),contract,2)).toBe('presentation_local_sentence_scope');
});

it('keeps whole-answer and nested JSON constraints independent of final-paragraph detection',()=>{
  expect(assistantPresentationContract('In a fresh paragraph, give exactly one sentence explaining PLL.')).toEqual({sentences:1});
  expect(assistantPresentationContract('Return valid JSON. In a fresh paragraph, include one sentence only in the reminder field.')).toEqual({json:true});
  expect(assistantPresentationContract('Explain this rule and use one sentence per step.').localTail).toBeUndefined();
});

it.each([
  '安排两项慢拧练习。每做一次允许的转动就停下，用一句话说清贴纸的位置变化。',
  'Give two drills. After each turn, use one sentence to say where the sticker moved.',
])('leaves a per-turn instruction in the drill instead of limiting the whole answer',question=>{
  expect(assistantPresentationContract(question)).toEqual({});
});

it('accepts the previously rejected complete AF01 draft in one model call',async()=>{
  const model=vi.fn<typeof fetch>().mockResolvedValueOnce(reply(fixture.drafts['4']));
  const result=await answerSiteQuestion(fixture.questions.AF01,'en',config,AbortSignal.timeout(5000),model);
  expect(result.answer).toMatch(/^1\..*34 seconds[\s\S]+^2\..*35 seconds[\s\S]+\n\nMira, please try both drills on Friday\.$/m);
  expect(model).toHaveBeenCalledTimes(1);
  const request=JSON.parse(String(model.mock.calls[0][1]?.body));
  expect(request.tools).toBeUndefined();
  expect(request.messages[1].content).toContain('Observe the requested hand movement itself.');
  expect(request.messages[1].content).not.toContain('The complete user-visible answer must contain exactly 1');
});

it('only asks for the missing invitation when both real AF01 activities already validate',async()=>{
  const model=vi.fn<typeof fetch>().mockResolvedValueOnce(reply(fixture.drafts['3']))
    .mockResolvedValueOnce(reply({answerKind:'general',answer:fixture.drafts['4'].answer,sourceIds:[]}));
  const result=await answerSiteQuestion(fixture.questions.AF01,'en',config,AbortSignal.timeout(5000),model);
  expect(result.answer).toContain(fixture.drafts['3'].plan.activities[0].steps[0].action);
  expect(result.answer).toContain('\n\n'+fixture.drafts['4'].answer);
  expect(model).toHaveBeenCalledTimes(2);
  const request=JSON.parse(String(model.mock.calls[1][1]?.body));
  expect(request.messages[1].content).toContain('Repair only the final writing request');
  expect(request.thinking.type).toBe('disabled');
});

it('accepts the valid AF02 draft with two timer-free drills and the separate invitation',async()=>{
  const model=vi.fn<typeof fetch>().mockResolvedValueOnce(reply(fixture.drafts['6']));
  const result=await answerSiteQuestion(fixture.questions.AF02,'zh',config,AbortSignal.timeout(5000),model);
  expect(result.answer).toMatch(/^1\.[^\n]+\n2\.[^\n]+\n\n小宁，周三[\s\S]+？$/);
  expect(model).toHaveBeenCalledTimes(1);
  const request=JSON.parse(String(model.mock.calls[0][1]?.body));
  expect(request.messages[1].content).toContain('Omit seconds fields');
});

it('omits unrequested timer allocations for an explicit timer-free plan while retaining explicit duration checks',()=>{
  const question=fixture.questions.AF02.split('。',1)[0];
  const shape=assistantPlanShape(question);
  expect(shape).toMatchObject({activities:2});
  const options={shape,lang:'zh' as const,withoutTimer:true,userTexts:[]};
  const plan={activities:fixture.drafts['6'].plan.activities.map(activity=>({
    ...activity,seconds:35,steps:activity.steps.map(step=>({...step,seconds:35})),
  }))};
  const untimed=validateAssistantPlan(plan,{...options,timed:false});
  expect(untimed.error).toBeUndefined();
  expect(untimed.answer).not.toContain('(35 秒)');
  expect(untimed.answer).toContain(plan.activities[0].steps[0].action);
  expect(validateAssistantPlan(plan,{...options,timed:true,maximumMinutes:60/60}).error).toBe('duration_limit_exceeded');
});

import { expect, it, vi } from 'vitest';
import { answerSiteQuestion, requestedAssistantEvidence } from '../src/utils/site_assistant.js';
import { assistantCubePlanGuidance, assistantPlanSemanticViolation, assistantPlanShape, assistantPlanTimeBounds, renderAssistantPlan, assistantStructuredPlanSchema } from '../src/utils/site_assistant_plan.js';
import fixture from './fixtures/assistant-v47-ag.json';

const config={key:'fixture',baseUrl:'https://api.deepseek.com/v1',model:'deepseek-flash'};
const reply=(value:unknown)=>Response.json({choices:[{index:0,finish_reason:'stop',message:{role:'assistant',content:JSON.stringify(value)}}]});

async function replay(question:string,lang:'en'|'zh',history:Array<{role:string;content:string}>,output:unknown) {
  const model=vi.fn<typeof fetch>().mockResolvedValueOnce(reply(output));
  const result=await answerSiteQuestion(question,lang,config,AbortSignal.timeout(5000),model,history.map(({role,content})=>({role:role==='user'?'user':'assistant',content})));
  expect(model).toHaveBeenCalledTimes(1);
  return result.answer;
}

it.each([...fixture.AG04.drafts,...fixture.AG06.drafts])('accepts the scoped known-turn alternative in original provider draft $call',async({call,output})=>{
  const record=call===16 || call===65?fixture.AG06:fixture.AG04;
  const lang=record.lang==='en'?'en':'zh';
  const answer=await replay(record.question,lang,record.history,output);
  expect(answer).toMatch(lang==='en'?/OTHERWISE[\s\S]+predict/i:/已会[\s\S]+预测/);
});

it('requires an actual slow-turn alternative in each activity when the user replaces a static instruction',()=>{
  const row=fixture.AG05;
  const guidance=assistantCubePlanGuidance(row.question,row.history[0].content);
  expect(guidance).toContain('distinct, concrete known-turn exercise in EACH activity');
  const plan=assistantStructuredPlanSchema.parse(row.drafts[0].output.plan);
  plan.activities[1].steps[0].action='看一眼当前状态。';
  expect(assistantPlanSemanticViolation(row.question,renderAssistantPlan(plan,false,'zh'),row.history[0].content,plan)).toBe('plan_slow_turn_alternative_missing');
});

it.each(fixture.AG08.drafts)('renders each actual child allocation in draft $call',async({output})=>{
  const {question,history}=fixture.AG08;
  expect(assistantPlanShape(question)).toMatchObject({activities:2,substepsPerActivity:2});
  expect(assistantPlanTimeBounds(question)).toMatchObject({total:179});
  const answer=await replay(question,'en',history,output);
  expect([...answer.matchAll(/^  - (\d+) seconds:/gm)]).toHaveLength(4);
  expect(answer.trim().split(/\s+/).length).toBeGreaterThanOrEqual(144);
  expect(answer.trim().split(/\s+/).length).toBeLessThanOrEqual(169);
});

it.each(fixture.AG13.drafts)('keeps the existing prepared cards and their Chinese cue in original draft $call',async({output})=>{
  const {question,history}=fixture.AG13;
  const answer=await replay(question,'zh',history,output);
  expect(answer).toMatch(/看中文[\s\S]+默写[\s\S]+翻面核对[\s\S]+放回中文朝上/);
  expect(answer).not.toContain('原词表');
});

it('restores both Chinese cues before a retry in the separate check step',async()=>{
  const row=fixture.AG12;
  const answer=await replay(row.question,'zh',row.history,row.drafts[0].output);
  expect(answer).toMatch(/先说出中文，再翻面核对[^\n]*两张卡都翻回本次的题面/);
  expect(answer).toMatch(/翻到英文正面核对[\s\S]*两张卡都翻回中文面朝上[\s\S]*把错词在纸上重写/);
});

it('recovers OLL using the two required glossary entries without model review',async()=>{
  const row=fixture.AG17;
  expect(requestedAssistantEvidence(row.question)).toBe('auto');
  expect(requestedAssistantEvidence(row.question+' Does the glossary support changing the timer?')).toBe('pages');
  const fetcher=vi.fn<typeof fetch>().mockImplementation(async input=>{
    expect(String(input)).toBe('https://api.cuberoot.me/v1/wiki/terms');
    return Response.json(row.glossary);
  });
  const response=await answerSiteQuestion(row.question,'en',config,AbortSignal.timeout(5000),fetcher);
  expect(response.answer).toMatch(/^Orientation of Last Layer\s+\[\[wiki:1\]\]\[\[wiki:3\]\]\.?$/);
  expect(response.sources.map(source=>source.id)).toEqual(['wiki:1','wiki:3']);
  expect(fetcher).toHaveBeenCalledTimes(1);
});

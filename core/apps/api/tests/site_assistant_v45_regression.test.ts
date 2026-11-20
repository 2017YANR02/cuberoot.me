import { expect, it, vi } from 'vitest';
import { answerSiteQuestion, requestedAssistantGlossary } from '../src/utils/site_assistant.js';
import { assistantPlanDurationViolation, assistantPlanShape, assistantCubePlanGuidance, assistantPlanSemanticViolation, assistantStructuredPlanSchema, renderAssistantPlan } from '../src/utils/site_assistant_plan.js';
import { assistantPresentationContract, assistantPresentationViolation } from '../src/utils/site_assistant_presentation.js';
import { glossaryNameOnlyAnswer, runDataTool } from '../src/utils/site_assistant_tools.js';
import replays from './fixtures/assistant-v45-ae.json';

const config={key:'fixture',baseUrl:'https://api.deepseek.com/v1',model:'deepseek-flash'};
type Replay=typeof replays[number];
const replay=(id:string)=>replays.find(row=>row.id===id)!;
const model=(content:string,finish_reason='stop')=>Response.json({choices:[{index:0,finish_reason,message:{role:'assistant',content}}]});
const answer=(row:Replay,fetcher:typeof fetch)=>answerSiteQuestion(row.question,row.lang==='zh'?'zh':'en',config,AbortSignal.timeout(5000),fetcher,row.history.map(({role,content})=>({role:role==='user'?'user':'assistant',content})));

const prose=replay('AE03');
it.each(prose.drafts)('accepts the original ordinary list and independent invitation from call $call',async({wire})=>{
  const fetcher=vi.fn<typeof fetch>().mockResolvedValueOnce(model(wire));
  const result=await answer(prose,fetcher);
  expect(result.answer).toBe(JSON.parse(wire).answer);
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it('preserves the list without accepting split or repeated invitation instructions',()=>{
  const contract=assistantPresentationContract(prose.question);
  const text=JSON.parse(prose.drafts[0].wire).answer;
  expect(assistantPresentationViolation(text+'\n\nBring your cube, too.',contract)).toBe('presentation_local_sentence_scope');
  expect(assistantPresentationViolation(text.replace(/Cleo, [^\n]+$/,'In a separate paragraph, invite Cleo.'),contract)).toBe('presentation_local_sentence_content');
  expect(assistantPresentationViolation(text.replace(/Cleo, [^\n]+$/,'In a separate paragraph, ask Cleo to test the ideas.'),contract)).toBe('presentation_local_sentence_content');
});

for(const id of ['AE04','AE05']){
  const slow=replay(id);
  it.each(slow.drafts)(id+' accepts the observed confirmation and executes distinct fallback actions in call $call',async({wire})=>{
    const plan=assistantStructuredPlanSchema.parse(JSON.parse(wire).plan);
    expect(assistantPlanSemanticViolation(slow.question,renderAssistantPlan(plan,false,'zh'),slow.history[0].content,plan)).toBeUndefined();
    const fetcher=vi.fn<typeof fetch>().mockResolvedValueOnce(model(wire));
    const result=await answer(slow,fetcher);
    expect(result.answer).toMatch(/观察[\s\S]*预测/);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it(id+' accepts the same valid plan as ordinary prose',async()=>{
    const plan=assistantStructuredPlanSchema.parse(JSON.parse(slow.drafts[0].wire).plan);
    const text=renderAssistantPlan(plan,false,'zh');
    expect(assistantPlanSemanticViolation(slow.question,text,slow.history[0].content)).toBeUndefined();
    const fetcher=vi.fn<typeof fetch>().mockResolvedValueOnce(model(JSON.stringify({answerKind:'general',answer:text,sourceIds:[]})));
    await answer(slow,fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
}

it.each(['直接执行','核对结果有误，只要试摆过','不用眼睛核对，直接'])('continues to reject insertion without a passing visual check (%s)',replacement=>{
  const slow=replay('AE04');
  const plan=assistantStructuredPlanSchema.parse(JSON.parse(slow.drafts[0].wire).plan);
  const step=plan.activities[1].steps[0];
  step.action=step.action.replace('用眼睛核对目标槽和两块位置无误后',replacement);
  expect(assistantPlanSemanticViolation(slow.question,renderAssistantPlan(plan,false,'zh'),slow.history[0].content,plan)).toBe('plan_fallback_branch_missing');
});

const timed=replay('AE02');
it.each([replay('AE01').question,timed.question])('guides observation to the requested hand movement',question=>{
  const guidance=assistantCubePlanGuidance(question);
  expect(guidance).toContain('Observe the requested hand movement itself.');
  expect(guidance).not.toContain('ONE corner currently in view');
  expect(guidance).not.toContain('choose ONE insertion');
});

it.each(timed.drafts)('recovers a complete source-free plan and its trailing invitation in call $call',async({wire})=>{
  const fetcher=vi.fn<typeof fetch>().mockResolvedValueOnce(model(wire));
  const result=await answer(timed,fetcher);
  expect(result.answer).toMatch(/^1\.[\s\S]*^2\.[\s\S]*\n\n阿晴，周四.*[。！]$/m);
  expect(fetcher).toHaveBeenCalledTimes(1);
  const system=JSON.parse(String(fetcher.mock.calls[0][1]?.body)).messages.filter((m:{role:string})=>m.role==='system').map((m:{content:string})=>m.content).join('\n');
  const messages=JSON.parse(String(fetcher.mock.calls[0][1]?.body)).messages;
  expect(system).toContain('actual independent ending in the answer string inside the same JSON object');
  expect(system).not.toContain('with answer:""');
  expect(JSON.stringify(messages)).toContain('Observe the requested hand movement itself.');
});

it('does not recover truncated output or attach an unverified citation as an ending',async()=>{
  const base=timed.drafts[0].wire;
  for(const bad of [()=>model(base,'length'),()=>model(base+' [[wiki:unknown]]')]){
    const fetcher=vi.fn<typeof fetch>().mockImplementation(async()=>bad());
    await expect(answer(timed,fetcher)).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(2);
  }
});

it('repairs a repeated invitation instruction using the existing plan and a short non-thinking call',async()=>{
  const mistaken=replay('AE01');
  const ending='Rowan, would you like to try both drills on Tuesday?';
  const fetcher=vi.fn<typeof fetch>().mockResolvedValueOnce(model(mistaken.drafts[0].wire))
    .mockResolvedValueOnce(model(JSON.stringify({answerKind:'general',answer:ending,sourceIds:[]})));
  const result=await answer(mistaken,fetcher);
  const plan=assistantStructuredPlanSchema.parse(JSON.parse(mistaken.drafts[0].wire).plan);
  expect(result.answer).toBe(renderAssistantPlan(plan,false,'en')+'\n\n'+ending);
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(JSON.parse(String(fetcher.mock.calls[1][1]?.body)).thinking).toMatchObject({type:'disabled'});
});

const preparedCards=replay('AE13');
it.each(preparedCards.drafts)('reuses the existing two-sided cards in call $call without preparation or an invented word list',async({wire})=>{
  const fetcher=vi.fn<typeof fetch>().mockResolvedValueOnce(model(wire));
  const result=await answer(preparedCards,fetcher);
  expect(result.answer).toMatch(/先在纸上写[^；。]+再翻面核对单词/);
  expect(result.answer).toMatch(/同一张翻回中文面朝上/);
  expect(result.answer).not.toContain('原词表');
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it.each(['两项各有两小步','两项练习，各自两小步'])('enforces the written allocation for %s',wording=>{
  const shape=assistantPlanShape('安排'+wording+'，每小步不超过20秒。两项合计65秒内。');
  expect(shape).toMatchObject({activities:2,substepsPerActivity:2,stepSecondsMaximum:20});
  const allocated='1. 熟悉词 (30 秒)\n   - 15 秒：说词义\n   - 15 秒：核对\n2. 复习词 (30 秒)\n   - 15 秒：写单词\n   - 15 秒：对答案';
  expect(assistantPlanDurationViolation(allocated,65/60,shape)).toBeUndefined();
  expect(assistantPlanDurationViolation(allocated,59/60,shape)).toBe('duration_limit_exceeded');
  expect(assistantPlanDurationViolation(allocated.replace('15 秒：说词义','说词义'),65/60,shape)).toBe('plan_duration_unverifiable');
  expect(assistantPlanDurationViolation(allocated.replace('15 秒：说词义','21 秒：说词义'),65/60,shape)).toBe('duration_limit_exceeded');
});

it('returns only the verified expansion and its citation for a glossary request',async()=>{
  const q='In the CubeRoot glossary, give just the expansion of F2L and the citation that supports it.';
  const call=requestedAssistantGlossary(q)!;
  expect(call).toEqual({tool:'glossary',query:'F2L'});
  const result=await runDataTool(call,'en',async()=>({sections:[{entries:[{id:4,headEn:'F2L (First Two Layers)',headZh:'前两层'}]}]}));
  expect(glossaryNameOnlyAnswer(q,[{call,result}],'en')?.answer).toContain('First Two Layers [[wiki:4]]');
  expect(glossaryNameOnlyAnswer(q,[{call,result}],'en')?.answer).not.toContain('前两层');
  expect(glossaryNameOnlyAnswer(q+' Include an invented detail.',[{call,result}],'en')).toBeUndefined();
});

it('keeps a standalone translation of card orientation on the direct path',async()=>{
  const english='With the meaning side up, write the word from memory, flip the card to check, and turn the same card back meaning side up.';
  const fetcher=vi.fn<typeof fetch>().mockResolvedValueOnce(model(JSON.stringify({answerKind:'general',answer:english,sourceIds:[]})));
  const result=await answerSiteQuestion('只把这句话翻成英文：“词义朝上时先默写单词，翻卡核对后把这一张翻回词义朝上。”','zh',config,AbortSignal.timeout(5000),fetcher);
  expect(result.answer).toBe(english);
  expect(fetcher).toHaveBeenCalledTimes(1);
  const request=JSON.parse(String(fetcher.mock.calls[0][1]?.body));
  expect(request.tools).toBeUndefined();
  expect(request.messages[1].content).toContain('Translate the quoted Chinese text into natural English.');
  expect(JSON.parse(request.messages.at(-1).content)).toEqual({text:'词义朝上时先默写单词，翻卡核对后把这一张翻回词义朝上。',targetLanguage:'English'});
});

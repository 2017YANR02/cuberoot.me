import { expect, it, vi } from 'vitest';
import { answerSiteQuestion } from '../src/utils/site_assistant.js';
import { assistantPlanSemanticViolation, assistantStructuredPlanSchema } from '../src/utils/site_assistant_plan.js';
import fixtures from './fixtures/assistant-v54-an.json';

const config={key:'fixture',baseUrl:'https://api.deepseek.com/v1',model:'deepseek-flash'};
const response=(value:unknown)=>Response.json({choices:[{index:0,finish_reason:'stop',message:{role:'assistant',content:JSON.stringify(value)}}]});
type Sample=typeof fixtures[keyof typeof fixtures];
const run=(row:Sample,fetcher:typeof fetch)=>answerSiteQuestion(
  row.question,row.lang==='en'?'en':'zh',config,AbortSignal.timeout(5000),fetcher,
  row.history.map(({role,content})=>({role:role==='user'?'user':'assistant',content})),
);
const repeat=(draft:unknown)=>vi.fn<typeof fetch>().mockImplementation(async()=>response(draft));

it.each(fixtures.AN03.drafts)('accepts explicit matching and nonmatching branches in call $call',async({value})=>{
  const fetcher=repeat(value);
  const {answer}=await run(fixtures.AN03,fetcher);
  expect(answer).toMatch(/若吻合就做[\s\S]*B2[\s\S]*再做一次 D′/);
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it.each(fixtures.AN04.drafts)('ties the goal slot to the visual condition in call $call',async({value})=>{
  const fetcher=repeat(value);
  const {answer}=await run(fixtures.AN04,fetcher);
  expect(answer).toMatch(/if they visibly (?:line up|match)[\s\S]*if setup fails or does not match/ig);
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it('continues rejecting an insertion on the failed branch and a turn the user did not supply',()=>{
  const row=fixtures.AN03,plan=assistantStructuredPlanSchema.parse(row.drafts[0].value.plan);
  const step=plan.activities[1].steps[0],action=step.action;
  step.action=action.replace('做完停手','做完继续插入');
  expect(assistantPlanSemanticViolation(row.question,'',row.history[0].content,plan)).toBe('plan_fallback_branch_missing');
  step.action=action.replaceAll('D′','R2');
  expect(assistantPlanSemanticViolation(row.question,'',row.history[0].content,plan)).toBe('plan_slow_turn_alternative_missing');
});

it.each(fixtures.AN10.drafts)('recognizes handwritten attempts before checking in call $call',async({value})=>{
  const fetcher=repeat(value);
  const {answer}=await run(fixtures.AN10,fetcher);
  expect(answer).toMatch(/在纸上分别手写[\s\S]*核对/);
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it('does not treat an optional or oral answer as written work',()=>{
  const row=fixtures.AN10, plan=assistantStructuredPlanSchema.parse(row.drafts[0].value.plan);
  plan.activities[1].steps[0].action='看中文后口述或手写英文 thyme 和 sage。';
  expect(assistantPlanSemanticViolation(row.question,'','',plan)).toBe('plan_missing_written_answer');
});

it.each(fixtures.AN11.drafts)('keeps unknown meaning language generic and checks both directions in call $call',async({value})=>{
  const fetcher=repeat(value);
  const {answer}=await run(fixtures.AN11,fetcher);
  expect(answer).not.toMatch(/English|[\r\n]/);
  expect(answer.match(/uncover the (?:\w+ )?column and check/gi)).toHaveLength(2);
  expect(answer.match(/38 seconds/g)).toHaveLength(2);
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it('preserves an explicitly supplied meaning language',async()=>{
  const row=structuredClone(fixtures.AN11),draft=row.drafts[0].value;
  row.history[0].content=row.history[0].content.replace('word-and-meaning sheet','word-and-meaning sheet with English meanings');
  draft.plan.inputs[0].quote=row.history[0].content;
  expect((await run(row,repeat(draft))).answer).toContain('English meaning');
});

it('retains the same side of the supplied sheet without a model repair',async()=>{
  const row=fixtures.AN12,fetcher=repeat(row.drafts[0].value);
  const {answer}=await run(row,fetcher);
  expect(answer).toContain('保持词表同一面朝上');
  expect(answer).toContain('中文解释列');
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it.each([[39,40],[78,79]])('keeps the independent ending after repair %s/%s',async(draftCall,repairCall)=>{
  const row=fixtures.AN18;
  const draft=row.drafts.find(d=>d.call===draftCall)!.value;
  const repaired=row.drafts.find(d=>d.call===repairCall)!.value;
  const fetcher=vi.fn<typeof fetch>().mockResolvedValueOnce(response(draft)).mockResolvedValueOnce(response(repaired));
  const {answer}=await run(row,fetcher);
  expect(answer).toMatch(/^1\. Trial 1.*: (?:25|30) seconds\n/);
  expect(answer).toMatch(/\n\nMel, [^\n]+tomorrow[.?]$/);
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(JSON.parse(String(fetcher.mock.calls[1][1]?.body)).thinking.type).toBe('disabled');
});

it('still rejects explicit reverse-side use for a single-face word sheet',async()=>{
  const row=fixtures.AN12,draft=structuredClone(row.drafts[0].value);
  draft.plan.activities[1].steps[0].action=draft.plan.activities[1].steps[0].action.replace('同一面','背面');
  await expect(run(row,repeat(draft))).rejects.toMatchObject({code:'model_output_invalid'});
});

it('still enforces the combined trial time and the separated ending',async()=>{
  const row=fixtures.AN18,draft=row.drafts.find(d=>d.call===79)!.value;
  const over={...draft,answer:draft.answer.replace('30–60 seconds','30–61 seconds')};
  const joined={...draft,answer:draft.answer.replace('\n\nMel,','\nMel,')};
  for(const value of [over,joined])await expect(run(row,repeat(value))).rejects.toMatchObject({code:'model_output_invalid'});
});

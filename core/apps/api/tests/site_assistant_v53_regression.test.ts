import { expect, it, vi } from 'vitest';
import { answerSiteQuestion } from '../src/utils/site_assistant.js';
import { assistantPlanSemanticViolation, assistantStructuredPlanSchema } from '../src/utils/site_assistant_plan.js';
import fixtures from './fixtures/assistant-v53-am.json';

const config={key:'fixture',baseUrl:'https://api.deepseek.com/v1',model:'deepseek-flash'};
const response=(value:unknown)=>Response.json({choices:[{index:0,finish_reason:'stop',message:{role:'assistant',content:JSON.stringify(value)}}]});
type Sample=typeof fixtures[keyof typeof fixtures];
const run=(row:Sample,fetcher:typeof fetch)=>answerSiteQuestion(
  row.question,row.lang==='en'?'en':'zh',config,AbortSignal.timeout(5000),fetcher,
  row.history.map(({role,content})=>({role:role==='user'?'user':'assistant',content})),
);
const repeat=(draft:unknown)=>vi.fn<typeof fetch>().mockImplementation(async()=>response(draft));

it.each(fixtures.AM04.drafts.filter(d=>[8,52].includes(d.call)))('accepts a named turn or prediction followed by a turn in call $call',async({value})=>{
  const fetcher=repeat(value);
  const {answer}=await run(fixtures.AM04,fetcher);
  expect(answer).toMatch(/对齐才做一次会的插入[\s\S]*若摆不成[\s\S]*预测|对齐才做一次会的插入[\s\S]*若摆不成[\s\S]*先说出/);
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it.each(fixtures.AM05.drafts.filter(d=>[12,53,54].includes(d.call)))('accepts both visual outcomes in call $call',async({value})=>{
  const fetcher=repeat(value);
  const {answer}=await run(fixtures.AM05,fetcher);
  expect(answer).toMatch(/only if (?:they|both) visibly match/);
  expect(answer).toMatch(/(?:do R2 once|do one R2)/);
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it('still rejects missing fallback, undeclared turns and failed-case insertion',()=>{
  const row=fixtures.AM04, source=row.history[0].content;
  const missing=row.drafts.find(d=>d.call===51)!;
  expect(assistantPlanSemanticViolation(row.question,'',source,missing.value.plan)).toBe('plan_slow_turn_alternative_missing');
  const plan=assistantStructuredPlanSchema.parse(row.drafts[0].value.plan);
  const step=plan.activities[1].steps[0], action=step.action;
  step.action=action.replace('预测一次 U′','预测一次 B2');
  expect(assistantPlanSemanticViolation(row.question,'',source,plan)).toBe('plan_slow_turn_alternative_missing');
  step.action=action.replace('做完即结束','随后做一次会的插入');
  expect(assistantPlanSemanticViolation(row.question,'',source,plan)).toBe('plan_fallback_branch_missing');
});

it.each(fixtures.AM09.drafts.filter(d=>d.call===21 || d.call===62))('reuses the two sides of the picture card in call $call',async({value})=>{
  const fetcher=repeat(value);
  const {answer}=await run(fixtures.AM09,fetcher);
  expect(answer.match(/48 seconds/g)?.length).toBeGreaterThanOrEqual(2);
  expect(answer).toMatch(/return that same card (?:to )?drawing-side up/);
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it('still rejects a blank deck and a repeated flip without returning the card',()=>{
  const row=fixtures.AM09,draft=row.drafts[0].value.answer;
  const question=row.question.replace('ready-made Spanish cards, a kitchen-tool drawing on one side and the Spanish word on the other','blank Spanish cards');
  expect(assistantPlanSemanticViolation(question,draft)).toMatch(/^plan_card_(?:layout|reference)_missing$/);
  const repeatWithoutReset='Place the card drawing-side up. Write the Spanish word before you flip to check, then repeat the same pass.';
  expect(assistantPlanSemanticViolation(row.question,repeatWithoutReset)).toBe('plan_card_reset_missing');
});

it.each(fixtures.AM10.drafts.filter(d=>d.call===23 || d.call===66))('preserves the all-correct deck repeat in call $call',async({value})=>{
  const fetcher=repeat(value);
  expect((await run(fixtures.AM10,fetcher)).answer).toMatch(/若上一轮全对[，,](?:则|就)(?:把|用)整套卡/);
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it('still rejects a zero-error branch that repeats only missed cards',()=>{
  const row=fixtures.AM10;
  const answer='先逐张看中文，写俄语后翻查并翻回中文面。若上一轮全对，就重做错卡；若上一轮有错，重做错卡。';
  expect(assistantPlanSemanticViolation(row.question,answer)).toBe('plan_clean_deck_repeat_missing');
});

it.each(fixtures.AM12.drafts)('expresses actual cover and visibility actions in one paragraph in call $call',async({value})=>{
  const fetcher=repeat(value);
  const {answer}=await run(fixtures.AM12,fetcher);
  expect(answer).not.toMatch(/[\r\n]|say that .* column is covered/);
  expect(answer).toMatch(/Cover the meaning column, keep the other column visible[\s\S]+Cover the Romanian column, keep the other column visible/);
  expect(answer.match(/34 seconds/g)).toHaveLength(2);
  expect(fetcher).toHaveBeenCalledTimes(1);
});

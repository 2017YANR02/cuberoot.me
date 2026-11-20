import { expect, it, vi } from 'vitest';
import { answerSiteQuestion } from '../src/utils/site_assistant.js';
import { assistantPlanSubsetFallback, validateAssistantPlan, assistantPlanWordInstruction, assistantPlanReasonSelection, renderAssistantPlan, assistantStructuredPlanOutputSchema, resolveAssistantPlanShape, assistantPlanSemanticViolation, assistantPlanDurationViolation, type AssistantStructuredPlan } from '../src/utils/site_assistant_plan.js';
import { glossaryDefinitionScopeViolation, glossaryNameOnlyAnswer, runDataTool } from '../src/utils/site_assistant_tools.js';
import { startAssistantMonitor } from '../src/utils/site_assistant_monitor.js';
import { ASSISTANT_POLICY_VERSION } from '../src/utils/site_assistant_policy.js';
import { AssistantOutputError } from '../src/utils/site_assistant_model.js';
import { assistantTopicRelevance } from '../src/utils/site_assistant_memory.js';
import { assistantPresentationContract, assistantPresentationViolation } from '../src/utils/site_assistant_presentation.js';
import cardResetFailure from './fixtures/assistant-v24-card-reset.json';
import v25Failures from './fixtures/assistant-v25-failures.json';
import v26NegationFailure from './fixtures/assistant-v26-negation.json';
import v27TableFailures from './fixtures/assistant-v27-table-state.json';
import v28Failures from './fixtures/assistant-v28-failures.json';
import v29Failures from './fixtures/assistant-v29-failures.json';
import v30Failures from './fixtures/assistant-v30-failures.json';
import v32SlowTurn from './fixtures/assistant-v32-slow-turn.json';
import v38Failures from './fixtures/assistant-v38-failures.json';
import v39Failures from './fixtures/assistant-v39-failures.json';
import v40Failures from './fixtures/assistant-v40-failures.json';
import v41SlowTurn from './fixtures/assistant-v41-aa01.json';

it('accepts the actual conditional slow-turn draft without a repair call',async()=>{
  const item=v32SlowTurn;
  const fetcher=vi.fn<typeof fetch>().mockResolvedValue(response(item.models[0]));
  const result=await answerSiteQuestion(item.case.question,'zh',config,AbortSignal.timeout(5000),fetcher,item.case.history as Array<{role:'user'|'assistant';content:string}>);
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(result.answer).toContain('只有上一项确认过熟悉情形');
  expect(result.answer).toContain('否则全程只用自己会的动作慢拧');
});
it.each([
  ['只有上一项确认过熟悉情形，才复位同一情形后慢速插入；否则只慢拧已会转法。',undefined],
  ['仅当上一项验证过熟悉情形，才复位同一情形后慢速插入；否则只慢拧已会转法。',undefined],
  ['沿用上一项选定的同一插入动作：只有上一项确认过熟悉情形，才复位同一情形后慢速插入；否则只慢拧已会转法。',undefined],
  ['继续使用前一项选择的同一个插入法：若上一项已验证熟悉情形，复位同一情形后慢速插入；否则只慢拧已会转法。',undefined],
  ['只有上一项没有确认过熟悉情形，才复位同一情形后慢速插入；否则只慢拧已会转法。','plan_fallback_branch_missing'],
  ['只有上一项未验证过熟悉情形，才复位同一情形后慢速插入；否则只慢拧已会转法。','plan_fallback_branch_missing'],
  ['沿用上一项选定的同一插入动作：复位同一情形后慢速插入；否则只慢拧已会转法。','plan_fallback_branch_missing'],
  ['用上一项选定的同一插入动作复位情形：只有上一项确认过熟悉情形，才继续；否则只慢拧已会转法。','plan_fallback_branch_missing'],
  ['先做一次插入；只有上一项确认过熟悉情形，才复位同一情形后慢速插入；否则只慢拧已会转法。','plan_fallback_branch_missing'],
  ['沿用上一项选定的同一插入动作：只有上一项确认过熟悉情形，才复位同一情形后慢速插入；否则只慢拧已会转法，然后再做一次插入。','plan_fallback_branch_missing'],
])('distinguishes conditional references from executed slow-turn actions: %s',(action,error)=>{
  const p=structuredClone(v32SlowTurn.models[0].plan);
  p.activities[1].steps[0].action=action;
  expect(assistantPlanSemanticViolation(v32SlowTurn.case.question,renderAssistantPlan(p,true,'zh'),'',p)).toBe(error);
});

it('uses a small material-specific request for a pure card plan and preserves validation',async()=>{
  const item=v29Failures.find(x=>x.key==='1/after/H08')!;
  const fetcher=vi.fn<typeof fetch>().mockResolvedValue(response(item.models[1]));
  const result=await answerSiteQuestion(item.case.question,'en',config,AbortSignal.timeout(5000),fetcher);
  expect(result.answer).toContain('return that card word-side up');expect(fetcher).toHaveBeenCalledTimes(1);
  const request=JSON.parse(String(fetcher.mock.calls[0][1]?.body)),text=JSON.stringify(request);
  expect(request.tools).toBeUndefined();expect(text).not.toContain('statisticsCatalog');
  expect(text).not.toContain('Use a simple two-column');expect(text).toContain('the first makes cards and the second practises recall');
  expect(text.length).toBeLessThan(15000);
});
it.each([' Also write a birthday greeting.',' Use research sources.'])('keeps mixed card requests on the full route: %s',suffix=>{
  const item=v29Failures.find(x=>x.key==='1/after/H08')!;
  const fetcher=vi.fn<typeof fetch>().mockImplementation(async()=>response(item.models[1]));
  return answerSiteQuestion(item.case.question+suffix,'en',config,AbortSignal.timeout(5000),fetcher).catch(()=>undefined).then(()=>{
    expect(JSON.stringify(JSON.parse(String(fetcher.mock.calls[0][1]?.body)))).toContain('statisticsCatalog');
  });
});

it.each(v30Failures)('accepts the actual valid source/column draft without a repair call: $key',async item=>{
  const fetcher=vi.fn<typeof fetch>().mockResolvedValue(response(item.models[0]));
  const result=await answerSiteQuestion(item.case.question,item.case.lang as 'zh'|'en',config,AbortSignal.timeout(5000),fetcher,item.case.history as Array<{role:'user'|'assistant';content:string}>);
  expect(fetcher).toHaveBeenCalledTimes(1);expect(result.answer).not.toBe('');
});
it('still rejects a fabricated quote rather than treating the time limit as proof of any input',async()=>{
  const item=v30Failures.find(x=>x.key.endsWith('H15'))!,bad=structuredClone(item.models[0]);
  bad.plan.inputs.find(i=>i.id==='time_limit')!.quote='总共最多99分钟';
  const fetcher=vi.fn<typeof fetch>().mockImplementation(async()=>response(bad));
  await expect(answerSiteQuestion(item.case.question,'zh',config,AbortSignal.timeout(5000),fetcher,item.case.history as Array<{role:'user'|'assistant';content:string}>)).rejects.toMatchObject({code:'model_output_invalid'});
});
it.each(['MEANING','the MEANING column','it','that column'])('resolves the same target column in a shortened reset: %s',reference=>{
  const prefix='Cover the MEANING column, read each WORD, say its meaning, uncover to check, then ';
  expect(assistantPlanSemanticViolation(question,prefix+`cover ${reference} again before the next word.`)).toBeUndefined();
  expect(assistantPlanSemanticViolation(question,prefix+`do not cover ${reference} again.`)).toBe('plan_column_reset_missing');
});
it('binds a pronoun to its nearest explicit column, never to whichever column would pass',()=>{
  expect(assistantPlanSemanticViolation(question,'Cover MEANING, read each WORD, say the meaning, uncover to check each answer, uncover WORD and cover it again.')).toBe('plan_column_reset_missing');
  expect(assistantPlanSemanticViolation(question,'Cover WORD, uncover MEANING, cover it, read each MEANING.')).toBe('plan_column_visibility_conflict');
});

it('accepts the real fully reset card-cycle repair without requesting another repair',async()=>{
  const item=v29Failures.find(x=>x.key==='1/after/H08')!;
  const fetcher=vi.fn<typeof fetch>().mockResolvedValueOnce(response(item.models[0])).mockResolvedValueOnce(response(item.models[1]));
  const result=await answerSiteQuestion(item.case.question,'en',config,AbortSignal.timeout(5000),fetcher);
  expect(fetcher).toHaveBeenCalledTimes(2);expect(result.answer).toContain('return that card word-side up');
  expect(result.answer).toContain('returning each card meaning-side up');
});
it.each(['that card','this card','the same card','each card'])('credits %s reset inside a repeated cycle, without inventing a reset',card=>{
  const start='Write words on card fronts and meanings on backs. Place every card meaning-side up. ';
  const loop=`For each card, say the word, flip to check; return ${card} meaning-side up. Repeat the deck the same way. Repeat the deck again.`;
  expect(assistantPlanSemanticViolation(question,start+loop)).toBeUndefined();
  expect(assistantPlanSemanticViolation(question,start+loop.replace(`return ${card} meaning-side up.`,''))).toBe('plan_card_reset_missing');
});
it('rejects the real mixed greeting that attributes a mechanical claim to a heading-only glossary',async()=>{
  const item=v29Failures.find(x=>x.key==='2/after/H04')!;
  const result=await runDataTool({tool:'glossary',query:'PLL'},'zh',async()=>glossary);
  const observations=[{call:{tool:'glossary'},result}];
  expect(glossaryDefinitionScopeViolation(item.case.question,item.result.result!.answer,observations)).toBe('glossary_heading_scope');
  expect(glossaryDefinitionScopeViolation(item.case.question,'PLL 是顶层排列。[[wiki:1]] 愿你新的一岁每一步都归位，生日快乐！',observations)).toBeUndefined();
});

it.each(v28Failures.filter(x=>x.key.endsWith('H05')||x.key.endsWith('H10')))('rejects a contradictory exposure assertion: $key',item=>{
  const p=item.models.at(-1)!.plan;
  const q=[...item.case.history.filter(h=>h.role==='user').map(h=>h.content),item.case.question].join(' ');
  expect(assistantPlanSemanticViolation(q,item.result.result!.answer,'',p)).toBe('plan_column_visibility_conflict');
});
it.each([
  ['Uncover the WORD column and cover the MEANING column so only meanings show.',true],
  ['Cover the MEANING column, read each MEANING and write the word.',true],
  ['Cover the WORD column so only meanings are visible.',false],
  ['Uncover the MEANING column and cover the WORD column so only meanings are visible.',false],
  ['Cover the MEANING column, then uncover the MEANING column to read it.',false],
  ['Do not cover the MEANING column. Read each MEANING.',false],
  ['遮住释义列，因此只能看到释义。',true],
  ['遮住单词列，因此只能看到释义。',false],
])('keeps visibility assertions separate from physical operations: %s',(action,bad)=>{
  expect(assistantPlanSemanticViolation(question,action)).toBe(bad?'plan_column_visibility_conflict':undefined);
});
it('does not allow preparation-only card making to hide behind an activity title',()=>{
  const item=v28Failures.find(x=>x.key==='1/after/H08')!;
  for(const title of ['Make and check cards','Learn the words','Prepare materials']) {
    const p=structuredClone(item.models[0].plan);p.activities[0].title=title;
    expect(assistantPlanSemanticViolation(item.case.question,'','',p)).toBe('plan_preparation_only_activity');
  }
});
it('repairs the actual reversed-column actions before delivery',async()=>{
  const item=v28Failures.find(x=>x.key==='1/after/H05')!,good=structuredClone(item.models[0]);
  good.plan.activities[1].steps[0].action='Uncover the MEANING column and cover the WORD column so only meanings show; use the whole list.';
  const fetcher=vi.fn<typeof fetch>().mockResolvedValueOnce(response(item.models[0])).mockResolvedValueOnce(response(good));
  const result=await answerSiteQuestion(item.case.question,'en',config,AbortSignal.timeout(5000),fetcher);
  expect(fetcher).toHaveBeenCalledTimes(2);expect(result.answer).toContain('Uncover the MEANING column and cover the WORD column');
});

it.each(v27TableFailures)('rejects the real table-state failure before delivery: $key',item=>{
  expect(assistantPlanSemanticViolation([...item.case.history.filter(h=>h.role==='user').map(h=>h.content),item.case.question].join(' '),item.answer,'',item.model.plan))
    .toBe(item.key.endsWith('H06')?'plan_table_material_mismatch':'plan_column_reset_missing');
});

it('still rejects the real hidden cue after the unrelated table flip is corrected',()=>{
  const item=v27TableFailures[0],p=structuredClone(item.model.plan);
  p.activities[1].steps[0].action='遮住左列单词，露出右列释义作为提示。';
  expect(assistantPlanSemanticViolation(item.case.question,renderAssistantPlan(p,true,'zh'),'',p)).toBe('plan_prompt_hidden');
});
it.each([
  ['把词义对照表的两列都遮住。','看单词时口头说中文。','plan_prompt_hidden'],
  ['遮住两栏，只留下答题位置。','逐个看中文，在纸上写英文。','plan_prompt_hidden'],
  ['Cover both columns of the list.','Read each word and say its meaning.','plan_prompt_hidden'],
  ['Both columns remain hidden.','Look at the meaning and recall the word.','plan_prompt_hidden'],
  ['Cover both columns.','Do not reveal the prompt. Read the word.','plan_prompt_hidden'],
  ['把两列都遮住。','先露出单词作为提示，保持释义遮住，看单词并说中文。',undefined],
  ['Cover both columns.','Uncover the meaning column as the prompt, write the matching word, then check.',undefined],
  ['Cover both columns.','Leave the WORD column visible, read each word and say its meaning.',undefined],
  ['Do not cover both columns.','Read each word and say its meaning.',undefined],
  ['把两列都遮住。','从记忆默写全部单词，再核对词表。',undefined],
])('carries hidden-prompt state between steps without rejecting free recall: %s / %s',(prepare,practice,error)=>{
  const p=plan();p.activities[0].steps[0].action=prepare;p.activities[0].steps[1].action=practice;
  expect(assistantPlanSemanticViolation(question,renderAssistantPlan(p,true,'en'),'',p)).toBe(error);
});
it.each([
  ['把词义对照表翻到释义一侧，遮住左列。','plan_table_material_mismatch'],
  ['Flip the word list over to its meaning side.','plan_card_layout_missing'],
  ['Turn the table to the word side.','plan_table_material_mismatch'],
  ['不要把词义对照表翻到释义一侧，只露出右列。',undefined],
  ['Do not flip the list to a meaning side; leave the meaning column visible.',undefined],
  ['Write words on the front and meanings on the back of each card. Flip each card to check.',undefined],
])('distinguishes same-face tables from actual two-sided cards: %s',(action,error)=>{
  expect(assistantPlanSemanticViolation(question,action)).toBe(error);
});
it('repairs the real table mismatch and hidden prompt together without streaming the failed draft',async()=>{
  const item=v27TableFailures[0],good=structuredClone(item.model);
  good.plan.activities[1].steps[0].action='遮住左列单词，露出右列释义作为提示，只看中文。';
  good.plan.activities[2].steps[0].action='保持左列单词可见，遮住右列释义，准备看单词回忆意思。';
  good.plan.activities[2].steps[1].action='逐个看左列单词，口头说出中文，再揭开右列核对，重新遮住右列后看下一个单词。';
  good.plan.activities[2].steps[0].reason='保持题目可见、答案隐藏，才能先回忆再核对。';
  const fetcher=vi.fn<typeof fetch>().mockResolvedValueOnce(response(item.model,true)).mockResolvedValueOnce(response(good,true));
  const visible:string[]=[];
  const result=await answerSiteQuestion(item.case.question,'zh',config,AbortSignal.timeout(5000),fetcher,[],undefined,async event=>{if(event.type==='answer'&&event.answer)visible.push(event.answer);});
  expect(fetcher).toHaveBeenCalledTimes(2);expect(result.answer).toContain('保持左列单词可见');
  expect(visible.every(text=>text===result.answer)).toBe(true);
});

it('does not spend a repair call on the valid negated-use statement',async()=>{
  const fetcher=vi.fn<typeof fetch>().mockResolvedValue(response(v26NegationFailure.model));
  const result=await answerSiteQuestion(v26NegationFailure.case.question,'zh',config,AbortSignal.timeout(5000),fetcher);
  expect(result.answer).toContain('没有使用任何公式或插入动作');
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it('recovers a length repair that only recases its original input quote',async()=>{
  const item=v25Failures.find(x=>x.key==='1/before/H07')!;
  const fetcher=vi.fn<typeof fetch>().mockResolvedValueOnce(response(item.models[0])).mockResolvedValueOnce(response(item.models[1]));
  const result=await answerSiteQuestion(item.case.question,'en',config,AbortSignal.timeout(5000),fetcher);
  expect(fetcher).toHaveBeenCalledTimes(2);
  const words=result.answer.trim().split(/\s+/).length;
  expect(words>=140 && words<=180).toBe(true);
  expect(result.answer).toContain('Write a two-column WORD / MEANING list');
});
it.each(v25Failures.filter(x=>x.key==='2/after/H14'||x.key==='2/after/H15'))('accepts valid slow-turn output without a wasted repair: $key',async item=>{
  const fetcher=vi.fn<typeof fetch>().mockResolvedValue(response(item.models[0]));
  const result=await answerSiteQuestion(item.case.question,'zh',config,AbortSignal.timeout(5000),fetcher,item.case.history as Array<{role:'user'|'assistant';content:string}>);
  expect(result.answer).not.toBe('');expect(fetcher).toHaveBeenCalledTimes(1);
});

it('repairs a subset-only card reset before exposing the real v24 answer',async()=>{
  const good=structuredClone(cardResetFailure.model);
  good.plan.activities[1].steps[1].action=good.plan.activities[1].steps[1].action.replace('if nothing was missed, run','if nothing was missed, reset every card meaning-side up, then run');
  const fetcher=vi.fn<typeof fetch>().mockResolvedValueOnce(response(cardResetFailure.model,true)).mockResolvedValueOnce(response(good,true));
  const visible:string[]=[];
  const result=await answerSiteQuestion(cardResetFailure.case.question,'en',config,AbortSignal.timeout(5000),fetcher,[],undefined,async event=>{if(event.type==='answer'&&event.answer)visible.push(event.answer);});
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(JSON.stringify(JSON.parse(String(fetcher.mock.calls[1][1]?.body)))).toContain('plan_card_reset_missing');
  expect(result.answer).toContain('if nothing was missed, reset every card meaning-side up');
  expect(visible.every(text=>text===result.answer)).toBe(true);
});

const question='Plan two vocabulary activities with two timed substeps each, at most 4 minutes total. Use my word list.';
it('preserves the plan protocol during a JSON format repair',()=>{
  const error=new AssistantOutputError('invalid_json');
  const instruction=error.repairInstruction({activities:2,substepsPerActivity:2,timed:true});
  expect(instruction).toContain('answer:""');expect(instruction).toContain('do not replace the plan with prose');
  expect(instruction).toContain('supporting source IDs');expect(instruction).not.toContain('a non-empty plain string');
  expect(error.repairInstruction()).toContain('a non-empty plain string');
});
it('repairs a source-free structured plan without missing answerKind triggering evidence reasoning',async()=>{
  const bad=plan();bad.activities[0].seconds=119;
  const fetcher=vi.fn<typeof fetch>().mockResolvedValueOnce(response({answer:'',plan:bad,sourceIds:[]}))
    .mockResolvedValueOnce(response({answerKind:'general',answer:'',plan:plan(),sourceIds:[]}));
  await answerSiteQuestion(question,'en',config,AbortSignal.timeout(5000),fetcher);
  expect(fetcher).toHaveBeenCalledTimes(2);
  const repair=JSON.parse(String(fetcher.mock.calls[1][1]?.body));
  expect(repair.thinking).toEqual({type:'disabled'});
  expect(JSON.stringify(repair)).toContain('rejectedPlan');
});
it('recovers a terminal plan bracket without an extra provider call',async()=>{
  const value={answerKind:'general',answer:'',plan:plan(),sourceIds:[]};
  const malformed=await response(value).json();malformed.choices[0].message.content+='}';
  const fetcher=vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json(malformed)).mockResolvedValueOnce(response(value));
  await answerSiteQuestion(question,'en',config,AbortSignal.timeout(5000),fetcher);
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it('still validates plan duration after a delimiter recovery',async()=>{
  const bad=plan();bad.activities[0].seconds=119;
  const malformed=await response({answerKind:'general',answer:'',plan:bad,sourceIds:[]}).json();malformed.choices[0].message.content+='}';
  const fetcher=vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json(malformed)).mockResolvedValueOnce(response({answerKind:'general',answer:'',plan:plan(),sourceIds:[]}));
  await answerSiteQuestion(question,'en',config,AbortSignal.timeout(5000),fetcher);
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(JSON.stringify(JSON.parse(String(fetcher.mock.calls[1][1]?.body)))).toContain('plan_duration_mismatch');
});
it('keeps preparation inside a practice activity unless separately requested',()=>{
  const p=plan();p.activities[0].title='Prepare word list';
  p.activities[0].steps[0].action='Write the WORD / MEANING list with known meanings.';
  p.activities[0].steps[1].action='Read the list once, then cover the MEANING column and leave the WORD column visible.';
  const check=(q:string)=>assistantPlanSemanticViolation(q,renderAssistantPlan(p,true,'en'),'',p);
  expect(check(question)).toBe('plan_preparation_only_activity');
  expect(check(question+' The first activity should prepare the list.')).toBeUndefined();
  p.activities[0].steps[1].action='Cover the MEANING column, attempt each meaning aloud, then uncover to check and cover the MEANING column again before each new attempt.';
  expect(check(question)).toBeUndefined();
  p.activities[0].steps[1].action='Cover the MEANING column, look at each WORD, say its meaning aloud, then uncover and check; after each check cover the MEANING column again before the next word.';
  expect(check(question)).toBeUndefined();
  p.activities[0].steps[1].action='Cover the WORD column, write the word from its meaning, then uncover and check.';
  expect(check(question)).toBeUndefined();
  p.activities[0].steps[1].action='Practise by covering the MEANING column, saying its meaning aloud, then uncovering and checking.';
  expect(check(question)).toBeUndefined();
  p.activities[0].steps[1].action='For each word, say its meaning aloud while the MEANING column stays covered, then uncover and check that entry, and cover the MEANING column again before the next word.';
  expect(check(question)).toBeUndefined();
});
it.each([
  ['Read the list once, then cover the MEANING column and attempt the meaning of each word in order, uncovering to check each attempt.','plan_column_reset_missing'],
  ['Cover the WORD column, write the word for each meaning, then uncover to check every answer.','plan_column_reset_missing'],
  ['Cover the MEANING column, attempt each meaning, uncover to check each answer; cover the MEANING column again before the next attempt.',undefined],
  ['Read the list, then cover the MEANING column and attempt each meaning, uncovering to check each attempt and covering the MEANING column again before the next word.',undefined],
  ['Cover the MEANING column, attempt each meaning, uncover to check each answer, hiding the MEANING column again before the next word.',undefined],
  ['Cover the MEANING column, attempt each meaning, uncover to check each answer, re-covering the MEANING column before the next word.',undefined],
  ['Cover the MEANING column, attempt each meaning, uncover to check each answer without covering the MEANING column again.','plan_column_reset_missing'],
  ['For each word, cover the MEANING column, attempt the meaning, uncover to check each answer.',undefined],
  ['Cover the MEANING column, attempt every meaning before uncovering, then check all answers together.',undefined],
  ['Cover the MEANING column, attempt each meaning, uncover to check each answer; do not cover the MEANING column again.','plan_column_reset_missing'],
  ['Cover the MEANING column, attempt each meaning, uncover to check each answer; cover the WORD column for another drill.','plan_column_reset_missing'],
])('checks a per-answer column reveal without rejecting batch recall: %s',(answer,error)=>{
  expect(assistantPlanSemanticViolation(question,answer)).toBe(error);
});
it.each([
  ['Cover the MEANING column, attempt each meaning, uncover to check each one, then cover the MEANING column again. Activity 2: cover the WORD column, attempt each word on paper, uncover to check each attempt, then cover the WORD column again.',undefined],
  ['Cover the MEANING column, attempt each meaning, uncover to check each one, then cover the MEANING column again. Activity 2: cover the WORD column, attempt each word on paper, uncover to check each attempt.','plan_column_reset_missing'],
  ['Cover the MEANING column, attempt each meaning, uncover to check each one. Activity 2: cover the MEANING column and read the list.','plan_column_reset_missing'],
  ['Cover the MEANING column, attempt each meaning, uncover to check each one, then cover the WORD column.','plan_column_reset_missing'],
])('binds each paragraph reveal to its own column and does not borrow a later activity reset: %s',(answer,error)=>{
  expect(assistantPlanSemanticViolation(question,answer)).toBe(error);
});
it.each([
  ['Use a two-column word list and prioritise weak items; never require a fixed number of mistakes.',undefined],
  ['Use a two column word list and prioritise weak items; never require a fixed number of mistakes.',undefined],
  ['Pick two missed words.','plan_subset_availability'],
  ['Prepare the list using only words whose meanings you already know. Repeat the cycle across the whole list, prioritising words you missed, with no requirement for a nonempty error pile or a fixed number of mistakes.',undefined],
  ['Prepare the list using only known meanings. Review only the missed words.','plan_subset_availability'],
  ['Prepare the whole list. Just review marked words.','plan_subset_availability'],
  ['Review only marked words; if there are zero errors, use the original list.',undefined],
  ['Review only marked words; if there are zero errors, repeat only marked words.','plan_subset_availability'],
  ['Cover the WORD column, attempt each word on paper, then uncover to check. Review the written attempts.',undefined],
  ['Cover the WORD column, attempt each word aloud, then uncover to check. Review the written attempts.','plan_missing_written_answer'],
  ['Cover the meaning column, recall meanings, then uncover to check; next cover the word column, write your attempted word, then uncover and check.',undefined],
  ['Uncover to check the reference; do not cover the word column, write your attempted word.','plan_answer_revealed_before_attempt'],
])('preserves layout counts and fresh written retrieval cycles: %s',(answer,error)=>{
  expect(assistantPlanSemanticViolation(question,answer)).toBe(error);
});
it.each(['zh','en'] as const)('keeps an explicit glossary-only property answer within heading evidence: %s',async lang=>{
  const result=await runDataTool({tool:'glossary',query:'PLL'},lang,async()=>glossary);
  const q=lang==='zh'?'只根据百科词条，PLL 是否保持角块朝向？':'Based only on the glossary, does PLL preserve corner orientation?';
  const answer=glossaryNameOnlyAnswer(q,[{call:{tool:'glossary',query:'PLL'},result}],lang);
  expect(answer?.answer).toContain('[[wiki:1]]');
  expect(answer?.answer).toContain(lang==='zh'?'无法判断':'cannot answer');
  expect(answer?.answer).not.toContain('F2L');
  const richer=structuredClone(result);(richer.evidence as {entries:Array<{claimScope:string}>}).entries[0].claimScope='entry_text';
  expect(glossaryNameOnlyAnswer(q,[{call:{tool:'glossary',query:'PLL'},result:richer}],lang)).toBeUndefined();
});
it.each([
  ['PLL 的中文名是顶层排列——也就是把最后一层的块归位到正确位置。[[wiki:1]] 生日快乐！','glossary_heading_scope'],
  ['PLL 是顶层排列，同时保持朝向与已完成的 F2L 不变。[[wiki:1]] 生日快乐！','glossary_heading_scope'],
  ['PLL means Permutation of Last Layer. It does not rotate corners. HAPPY BIRTHDAY!','glossary_heading_scope'],
  ['词条无法判断朝向，但 PLL 保持角块朝向。生日快乐！','glossary_heading_scope'],
  ['PLL 是顶层排列。[[wiki:1]] 词条没有说明是否保持角块朝向。生日快乐！',undefined],
  ['PLL means Permutation of Last Layer. The entry does not establish whether it preserves orientation. HAPPY BIRTHDAY!',undefined],
  ['PLL 是顶层排列。[[wiki:1]] 生日快乐，愿你每天都有好运！',undefined],
])('keeps heading-only mixed answers in their factual scope: %s',async(answer,error)=>{
  const result=await runDataTool({tool:'glossary',query:'PLL'},'zh',async()=>glossary);
  const observations=[{call:{tool:'glossary'},result}];
  expect(glossaryDefinitionScopeViolation('查百科，PLL 的定义是什么？另外写一句生日祝福。',answer,observations)).toBe(error);
  const richer=structuredClone(result);(richer.evidence as {entries:Array<{claimScope:string}>}).entries[0].claimScope='entry_text';
  expect(glossaryDefinitionScopeViolation('PLL 的定义是什么？',answer,[{call:{tool:'glossary'},result:richer}])).toBeUndefined();
});
it('repairs a mixed glossary claim while preserving the independent writing request without reasoning escalation',async()=>{
  let calls=0;
  const fetcher=vi.fn<typeof fetch>(async(input,init)=>String(input).endsWith('/wiki/terms')?Response.json(glossary):response({answerKind:'grounded',answer:++calls===1?'PLL 是顶层排列，它把块归位到正确位置。[[wiki:1]] 生日快乐！':'PLL 的全称是 Permutation of Last Layer，中文名是顶层排列。[[wiki:1]] 生日快乐！',sourceIds:['wiki:1']},!!JSON.parse(String(init?.body)).stream));
  const result=await answerSiteQuestion('查百科，PLL 的定义是什么？另外写一句生日祝福。','zh',config,AbortSignal.timeout(5000),fetcher);
  expect(calls).toBe(2);expect(result.answer).toContain('生日快乐');expect(result.answer).not.toContain('正确位置');
  const repair=JSON.parse(String(fetcher.mock.calls.at(-1)![1]?.body));
  expect(repair.thinking).toEqual({type:'disabled'});
  expect(JSON.stringify(repair)).toContain('Preserve independent writing requests');
});
it('does not inject a slow-turn fallback into an observation-only plan',async()=>{
  const p={inputs:[],activities:[{title:'Observe',seconds:120,steps:[{action:'记录可见红色贴纸的位置，其他颜色保持未知。',reason:'只记录可见信息。',seconds:120,requires:[],produces:[]}]},{title:'Recall',seconds:120,steps:[{action:'回忆并核对同一红色贴纸的位置，不转动魔方。',reason:'检查观察记忆。',seconds:120,requires:[],produces:[]}]}]};
  const fetcher=vi.fn<typeof fetch>().mockResolvedValueOnce(response({answerKind:'general',answer:'',plan:p,sourceIds:[]}));
  await answerSiteQuestion('我只能看见一个角块的一张红色贴纸，其余颜色被挡住。安排两项静态F2L观察练习，最多4分钟，不转动魔方。','zh',config,AbortSignal.timeout(5000),fetcher);
  const text=JSON.stringify(JSON.parse(String(fetcher.mock.calls[0][1]?.body)));
  expect(text).not.toContain('statisticsCatalog');expect(text).not.toContain('Every slow-turn activity');expect(text).toContain('UNKNOWN');
});
it.each([
  ['先在纸上写出对应单词，再揭开答案核对；若没有错词，就从原词表选择可用词同样默写。',undefined],
  ['Write your attempted word, then uncover and check; if no errors remain, write a new attempt using the same routine.',undefined],
  ['Uncover the answer to check; then write your attempted word.','plan_answer_revealed_before_attempt'],
  ['先揭开答案核对，再在纸上写出对应单词。','plan_answer_revealed_before_attempt'],
])('separates new conditional attempts without hiding reveal-then-write continuations: %s',(answer,error)=>{
  expect(assistantPlanSemanticViolation(question,answer)).toBe(error);
});
it.each([
  ['Write two new pairs with word and meaning on opposite sides.',undefined],
  ['Write two new word-meaning pairs with both faces completed.',undefined],
  ['Write two new word-meaning pairs together on the back.','plan_card_reference_missing'],
])('recognizes explicit complete two-face fallback pairs: %s',(preparation,error)=>{
  expect(assistantPlanSemanticViolation(question,'Write words on card fronts and meanings on backs. If no cards remain, '+preparation+' Flip each card to check.')).toBe(error);
});
it('keeps a general vocabulary plan focused on user constraints without unrelated catalogs',async()=>{
  const fetcher=vi.fn<typeof fetch>().mockResolvedValueOnce(response({answerKind:'general',answer:'',plan:plan(),sourceIds:[]}));
  await answerSiteQuestion(question,'en',config,AbortSignal.timeout(5000),fetcher);
  const request=JSON.parse(String(fetcher.mock.calls[0][1]?.body)),text=JSON.stringify(request);
  expect(request.tools).toBeUndefined();expect(text).not.toContain('statisticsCatalog');
  expect(text).toContain('maximumMinutes');expect(text).toContain('planConstraintSources');
  expect(text).toContain('two-column WORD / MEANING');
  expect(text).toContain('Unless the user explicitly requests a separate preparation activity, every requested activity must include actual vocabulary practice');
  expect(text).toContain('after EACH individual check');
});
it.each(['Use flashcards with research sources.','Also write a birthday greeting.','Use research sources.'])('preserves the ordinary route for explicit materials or mixed evidence requests: %s',async suffix=>{
  const fetcher=vi.fn<typeof fetch>().mockImplementation(async()=>response({answerKind:'general',answer:'',plan:plan(),sourceIds:[]}));
  await answerSiteQuestion(question+' '+suffix,'en',config,AbortSignal.timeout(5000),fetcher).catch(()=>undefined);
  const text=JSON.stringify(JSON.parse(String(fetcher.mock.calls[0][1]?.body)));
  expect(text).toContain('statisticsCatalog');expect(text).not.toContain('Use a simple two-column WORD / MEANING list throughout');
});
it.each([
  ['Write each meaning on the front of a card. Write the corresponding word on the back.',undefined],
  ['Write each word on the back of a card. Write the corresponding meaning on the front.',undefined],
  ['卡片正面写释义。背面写对应单词。',undefined],
  ['先把释义写在正面，再把对应单词写在背面。',undefined],
  ['Write each word and its meaning together on the back of a card.','plan_card_layout_missing'],
  ['Write each word and its meaning together on the front of a card.','plan_card_layout_missing'],
  ['把单词和释义一起写在卡片背面。','plan_card_layout_missing'],
])('binds the word and meaning to distinct faces across preparation sentences: %s',(preparation,error)=>{
  expect(assistantPlanSemanticViolation(question,preparation+' Flip the card to check.')).toBe(error);
});
it.each([
  ['Review only missed words; if no errors remain, repeat only the missed words.','plan_subset_availability'],
  ['Review only wrong words; if no errors remain, repeat only wrong words, then use the full list.','plan_subset_availability'],
  ['只复习错词；若没有错词，就重复错词。','plan_subset_availability'],
  ['Review only missed words; if no errors remain, repeat the original word list.',undefined],
  ['Review only missed words; if no errors remain, finish early.',undefined],
  ['只复习错词；若没有错词，就用原词表。',undefined],
  ['Review only missed words; if no errors remain, use the full list and do not repeat missed words.',undefined],
])('checks what an empty-subset alternative repeats: %s',(answer,error)=>{
  expect(assistantPlanSemanticViolation(question,answer)).toBe(error);
});
const plan=():AssistantStructuredPlan=>({inputs:[{id:'words',quote:'Use my word list.'}],activities:[
  {title:'Write',seconds:120,steps:[
    {action:'Read the list.',reason:'Recall the meanings.',seconds:60,requires:['words'],produces:[]},
    {action:'Write sentences using the words.',reason:'Make a written record to check.',seconds:60,requires:['words'],produces:['written_sentences']},
  ]},
  {title:'Check',seconds:120,steps:[
    {action:'Read the sentences aloud.',reason:'Check the wording.',seconds:60,requires:['written_sentences'],produces:[]},
    {action:'Edit the sentences.',reason:'Correct mistakes, or reread them if none need correction.',seconds:60,requires:['written_sentences'],produces:[]},
  ]},
]});
const options={shape:{activities:2,substepsPerActivity:2},maximumMinutes:4,timed:true,userTexts:[question],lang:'en' as const};
it('renders validated structured plans with exact parent and child allocations',()=>{
  const result=validateAssistantPlan(plan(),options);
  expect(result.error).toBeUndefined();
  expect(result.answer).toContain('1. Write (120 seconds)\n  - 60 seconds:');
  expect(result.answer?.match(/^  - /gm)).toHaveLength(4);
});
it.each([
  ['unproduced material',(p:AssistantStructuredPlan)=>{p.activities[0].steps[1].produces=[];},'plan_missing_prerequisite'],
  ['self dependency',(p:AssistantStructuredPlan)=>{p.activities[0].steps[1].requires.push('written_sentences');},'plan_missing_prerequisite'],
  ['invented input',(p:AssistantStructuredPlan)=>{p.inputs[0].quote='The user supplied written sentences';},'plan_unverified_input'],
  ['wrong sum',(p:AssistantStructuredPlan)=>{p.activities[0].seconds=119;},'plan_duration_mismatch'],
  ['missing allocation',(p:AssistantStructuredPlan)=>{delete p.activities[0].steps[0].seconds;},'plan_duration_unverifiable'],
  ['extra child',(p:AssistantStructuredPlan)=>{p.activities[0].steps.push(p.activities[0].steps[0]);},'plan_substep_count'],
  ['extra activity',(p:AssistantStructuredPlan)=>{p.activities.push(p.activities[0]);},'plan_activity_count'],
  ['hidden list',(p:AssistantStructuredPlan)=>{p.activities[0].steps[0].action+='\n3. Do extra work';},'plan_invalid_structure'],
] as const)('rejects %s before rendering',(name,mutate,error)=>{const p=plan();mutate(p);expect(validateAssistantPlan(p,options).error).toBe(error);});
it('enforces total seconds and word counts on the actual rendered answer',()=>{
  expect(validateAssistantPlan(plan(),{...options,maximumMinutes:3}).error).toBe('duration_limit_exceeded');
  expect(validateAssistantPlan(plan(),{...options,shape:{...options.shape,englishWords:{minimum:180,maximum:230}}}).error).toBe('plan_word_count');
});
it('allows preparation steps unless the user specified an exact child count',()=>{
  const p=plan();
  expect(validateAssistantPlan(p,{...options,shape:{activities:2}}).error).toBeUndefined();
  expect(validateAssistantPlan(p,{...options,shape:{activities:2,substepsPerActivity:1}}).error).toBe('plan_substep_count');
  expect(assistantStructuredPlanOutputSchema({activities:2,timed:true}).safeParse(p).success).toBe(true);
  delete p.activities[0].steps[0].seconds;
  expect(assistantStructuredPlanOutputSchema({activities:2,timed:true}).safeParse(p).success).toBe(false);
});
it('removes redundant title numbering and matching time labels without hiding contradictions',()=>{
  const p=plan();p.activities[0].title='1. Write (2 minutes)';
  expect(validateAssistantPlan(p,options).answer).toContain('1. Write (120 seconds)');
  p.activities[0].title='Write (3 minutes)';
  expect(validateAssistantPlan(p,options).error).toBe('plan_duration_mismatch');
});
it('retains relevant structure and replaces only the explicitly corrected field',()=>{
  const resolved=resolveAssistantPlanShape('Change to three activities.',[question]);
  expect(resolved.shape).toEqual({activities:3,substepsPerActivity:2});
  expect(resolved.sources.map(s=>s.text)).toEqual([question,'Change to three activities.']);
  expect(assistantTopicRelevance('Change to three activities.',question)).toBe('strong');
  expect(resolveAssistantPlanShape('Explain PLL.',[question]).shape).toBeUndefined();
  expect(resolveAssistantPlanShape('Make it a paragraph.',[question]).shape).toEqual({activities:2,substepsPerActivity:2,paragraph:true});
  expect(resolveAssistantPlanShape('Change to at most one activity.',[question]).shape?.activities).toBeUndefined();
});
it.each([
  ['1. Say a sentence aloud.\n2. Read it back and edit the sentence.','plan_missing_written_material'],
  ['1. Write a sentence.\n2. Read the sentence aloud.',undefined],
  ['1. Read the word list.\n2. Say the meanings aloud.',undefined],
])('checks legacy written-material prerequisites: %s',(answer,error)=>{
  expect(assistantPlanSemanticViolation(question,answer)).toBe(error);
});
const config={key:'fixture',baseUrl:'https://api.deepseek.com/v1',model:'deepseek-flash'};
const response=(value:unknown,stream=false)=>stream
  ? new Response('data: '+JSON.stringify({id:'test',object:'chat.completion.chunk',created:1,model:'test',choices:[{index:0,delta:{role:'assistant',content:JSON.stringify(value)},finish_reason:'stop'}],usage:{prompt_tokens:100,completion_tokens:50}})+'\n\ndata: [DONE]\n\n',{headers:{'content-type':'text/event-stream'}})
  : Response.json({id:'test',created:1,model:'test',choices:[{index:0,message:{role:'assistant',content:JSON.stringify(value)},finish_reason:'stop'}],usage:{prompt_tokens:100,completion_tokens:50}});
it('accepts valid numeric allocations without reparsing punctuation in structured titles',async()=>{
  const p=plan();p.activities[0].title='1. Recall: write';p.activities[1].title='Activity 2: Check';
  const fetcher=vi.fn<typeof fetch>().mockResolvedValue(response({answerKind:'general',answer:'',plan:p,sourceIds:[]}));
  const result=await answerSiteQuestion(question,'en',config,AbortSignal.timeout(5000),fetcher);
  expect(result.answer).toContain('1. Recall: write (120 seconds)');
  expect(result.answer).not.toContain('1. 1.');
  expect(fetcher).toHaveBeenCalledTimes(1);
});
function wordSizedPlan(words:number) {
  const p=plan();p.activities[0].steps[0].action+=' Mark weak words.';
  const steps=p.activities.flatMap(activity=>activity.steps);
  let index=0;
  while(renderAssistantPlan(p,true,'en').split(/\s+/).length<words)steps[index++%steps.length].reason+=' carefully';
  return p;
}
it('does not expand an in-range bounded draft with a renderer fallback',async()=>{
  const fetcher=vi.fn<typeof fetch>().mockResolvedValue(response({answerKind:'general',answer:'',plan:wordSizedPlan(225),sourceIds:[]}));
  const result=await answerSiteQuestion(question+' Use 180–230 English words.','en',config,AbortSignal.timeout(5000),fetcher);
  expect(result.answer).not.toContain('if this subset is empty');
  expect(result.answer.split(/\s+/).length).toBe(225);expect(fetcher).toHaveBeenCalledTimes(1);
});
it('repairs the actual unaugmented word count without concealing a short draft',async()=>{
  const fetcher=vi.fn<typeof fetch>().mockResolvedValueOnce(response({answerKind:'general',answer:'',plan:wordSizedPlan(175),sourceIds:[]}))
    .mockResolvedValueOnce(response({answerKind:'general',answer:'',plan:wordSizedPlan(190),sourceIds:[]}));
  const result=await answerSiteQuestion(question+' Use 180–230 English words.','en',config,AbortSignal.timeout(5000),fetcher);
  expect(fetcher).toHaveBeenCalledTimes(2);expect(result.answer.split(/\s+/).length).toBe(190);
  const request=JSON.stringify(JSON.parse(String(fetcher.mock.calls[1][1]?.body)));
  expect(request).toContain('175');expect(request).toContain('rejectedPlan');
});

it.each([
  ['Write words on card fronts and meanings on backs; lay the cards meaning-side up. Pick up each card, say the word aloud, flip it, and check the meaning.','plan_card_flip_direction'],
  ['词卡正面写单词，背面写释义。释义面朝上，回忆单词，翻面核对释义。','plan_card_flip_direction'],
  ['Write words on card fronts and meanings on backs. Start each card word-side up, recall the meaning, flip it and check the meaning. Reset word-side up.',undefined],
  ['Write words on card fronts and meanings on backs. Start each card meaning-side up, recall the word, flip it and check the word. Reset meaning-side up.',undefined],
  ['卡片正面写英文，背面写中文释义。卡片英文面朝上，回忆释义，翻面核对释义。然后释义面朝上，回忆单词，翻面核对单词。',undefined],
  ['Write words on card fronts and meanings on backs. Start meaning-side up. Do not flip it; check the meaning.',undefined],
])('tracks explicit card orientation without rejecting reverse recall: %s',(answer,error)=>{
  expect(assistantPlanSemanticViolation(question,answer)).toBe(error);
});

it('repairs a wrong flip direction before showing the plan',async()=>{
  const bad=plan();bad.activities[0].steps[0].action='Write words on card fronts and meanings on backs; lay the cards meaning-side up.';
  bad.activities[0].steps[1].action='Say the word aloud, flip the card over, and check the meaning. Write a sentence.';
  const good=structuredClone(bad);good.activities[0].steps[0].action='Write words on card fronts and meanings on backs; lay the cards word-side up.';
  const fetcher=vi.fn<typeof fetch>().mockResolvedValueOnce(response({answerKind:'general',answer:'',plan:bad,sourceIds:[]})).mockResolvedValueOnce(response({answerKind:'general',answer:'',plan:good,sourceIds:[]}));
  const result=await answerSiteQuestion(question,'en',config,AbortSignal.timeout(5000),fetcher);
  expect(result.answer).toContain('word-side up');expect(fetcher).toHaveBeenCalledTimes(2);
  expect(JSON.stringify(JSON.parse(String(fetcher.mock.calls[1][1]?.body)))).toContain('plan_card_flip_direction');
});

it.each([
  ["用已知的R U R' U'把一组已配对的角块与棱块从底层取出，摆到右前槽上方。",'plan_unsupplied_move_sequence'],
  ["Slowly use R U R’ U’ to put the pair above the left slot.",'plan_unsupplied_move_sequence'],
  ['选择自己熟悉的插入，先用其逆序准备并检查情况；若无法准备，就慢练已知转动，不宣称完成配对。',undefined],
])('rejects invented slow-turn algorithms for an unknown case: %s',(answer,error)=>{
  expect(assistantPlanSemanticViolation('安排两项F2L慢拧活动，不教新公式。',answer)).toBe(error);
});

it('does not duplicate an explicit whole-plan empty-subset fallback',async()=>{
  const p=plan();p.activities[0].steps[0].action='Mark weak words. In any step, if none remain, use the original word list.';
  const fetcher=vi.fn<typeof fetch>().mockResolvedValue(response({answerKind:'general',answer:'',plan:p,sourceIds:[]}));
  const result=await answerSiteQuestion(question,'en',config,AbortSignal.timeout(5000),fetcher);
  expect(result.answer).not.toContain('if this subset is empty');expect(fetcher).toHaveBeenCalledTimes(1);
});

it.each([
  ['Take the word list, read the word side, say the meaning, then flip to the meaning side to check; reset each card word-side up.','plan_card_layout_missing'],
  ['从单词表挑词，看正面单词说中文意思，翻到背面核对，再翻回正面；用翻卡自测即时检验记忆。','plan_card_layout_missing'],
  ['Write words on card fronts and meanings on backs. Start word-side up, recall the meaning, flip to the meaning side and check.',undefined],
  ['从单词表挑词，卡片正面写单词、背面写释义；看正面回忆释义，翻到背面核对。',undefined],
])('requires actual card preparation for implicit flip practice: %s',(answer,error)=>{
  expect(assistantPlanSemanticViolation(question,answer)).toBe(error);
});

it.each([
  ['把单词表上的词逐个抄到卡片正面，把对应释义写在背面，抄完按顺序排好。逐张卡片词面朝上，先说出释义再翻面核对。',undefined],
  ['把对应释义写在卡片背面，把单词抄在正面。词面朝上，说出释义再翻面核对。',undefined],
  ['Write each word on one side of a card and its meaning on the other. Start each card word-side up and flip to check the meaning.',undefined],
  ['Write each word on one side of a card and its meaning on the other side. Start each card meaning-side up and flip to check the word.',undefined],
  ['Write each word and its meaning together on the front of a card. Flip the card over to check.','plan_card_layout_missing'],
  ['把单词和释义都写在卡片正面。翻面核对。','plan_card_layout_missing'],
])('recognizes equivalent two-sided layouts, keeping one-sided negatives: %s',(answer,error)=>{
  expect(assistantPlanSemanticViolation(question,answer)).toBe(error);
});

it.each([
  ['1. 制卡 (120 秒): 正面写单词，背面写释义。\n2. 看意思写单词 (120 秒): 看卡片意思面，回想并说出单词，再核对；写错的词单独记下。','plan_missing_written_answer'],
  ['Write words on card fronts and meanings on backs. Say the matching word aloud, then correct misspellings in your written answers.','plan_missing_written_answer'],
  ['Write words on card fronts and meanings on backs. Write your guessed word on paper, then correct misspellings in your written answers.',undefined],
  ['卡片正面写单词、背面写释义。先默写单词，再核对并把写错的词记下。',undefined],
  ['卡片正面写单词、背面写释义。口述单词并核对，把说错的词记下。',undefined],
])('distinguishes written test answers from reference cards and titles: %s',(answer,error)=>{
  expect(assistantPlanSemanticViolation(question,answer)).toBe(error);
});

it.each([
  ['Lay the cards meaning-side up. Say each word, flip to check the spelling, and restart the stack once from the beginning.','plan_card_reset_missing'],
  ['Lay the cards meaning-side up. Say each word, flip to check the spelling, reset meaning-side up, and restart the stack.',undefined],
  ['For each card, start meaning-side up, say the word, flip to check the spelling, and repeat the round.',undefined],
  ['卡片释义面朝上，回忆单词，翻面核对单词，然后整叠重来。','plan_card_reset_missing'],
  ['卡片释义面朝上，回忆单词，翻面核对单词，再把每张卡片释义面朝上，然后整叠重来。',undefined],
  ['Start each card word-side up, say the meaning, flip to check, then repeat an unrelated sentence.',undefined],
])('requires restoring the prompt face before another pass: %s',(answer,error)=>{
  const prefix=/[\u4e00-\u9fff]/.test(answer)?'卡片正面写单词、背面写释义。':'Write words on card fronts and meanings on backs. ';
  expect(assistantPlanSemanticViolation(question,prefix+answer)).toBe(error);
});
it('includes rejected structured fields in a structural repair instead of sending an empty draft',async()=>{
  const bad=plan();bad.activities[0].seconds=119;
  const fetcher=vi.fn<typeof fetch>().mockResolvedValueOnce(response({answerKind:'general',answer:'',plan:bad,sourceIds:[]}))
    .mockResolvedValueOnce(response({answerKind:'general',answer:'',plan:plan(),sourceIds:[]}));
  await answerSiteQuestion(question,'en',config,AbortSignal.timeout(5000),fetcher);
  const repair=JSON.stringify(JSON.parse(String(fetcher.mock.calls[1][1]?.body)));
  expect(repair).toContain('rejectedPlan');expect(repair).toContain('119');
});
it('keeps the total time limit when a follow-up changes permission to turn the cube',async()=>{
  const makePlan=(seconds:number)=>({inputs:[],activities:[1,2].map(i=>({title:`慢拧${i}`,seconds,steps:[
    {action:'用熟悉的转动准备一组配对。',reason:'先准备再练习。',seconds:seconds/2,requires:[],produces:[`pair${i}`]},
    {action:'慢速插入这组配对。',reason:'观察插入过程。',seconds:seconds/2,requires:[`pair${i}`],produces:[]},
  ]}))});
  const fetcher=vi.fn<typeof fetch>().mockResolvedValueOnce(response({answerKind:'general',answer:'',plan:makePlan(300),sourceIds:[]}))
    .mockResolvedValueOnce(response({answerKind:'general',answer:'',plan:makePlan(180),sourceIds:[]}));
  const result=await answerSiteQuestion('现在允许转动魔方，安排两项慢拧活动。','zh',config,AbortSignal.timeout(5000),fetcher,[
    {role:'user',content:'F2L只观察，不转动魔方，最多6分钟。'},
    {role:'assistant',content:'保持原状态观察。'},
  ]);
  expect(result.answer.match(/180 秒/g)).toHaveLength(2);
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(JSON.stringify(JSON.parse(String(fetcher.mock.calls[1][1]?.body)))).toContain('duration_limit_exceeded');
});
it('uses the real answer path to render a plan and record private-safe version fingerprints',async()=>{
  let metrics:any;
  const fetcher=vi.fn<typeof fetch>().mockResolvedValue(response({answerKind:'general',answer:'',plan:plan(),sourceIds:[]}));
  const monitor=await startAssistantMonitor({uid:null,question,lang:'en',model:config.model,streaming:false,imageCount:0,historyCount:0},async(sql,params=[])=>{if(sql.startsWith('UPDATE'))metrics=params[7];return [];});
  const result=await monitor.run(()=>answerSiteQuestion(question,'en',config,AbortSignal.timeout(5000),fetcher));
  await monitor.finish('success',undefined,result);
  expect(result.answer).toContain('Read the sentences aloud.');
  expect(result).not.toHaveProperty('plan');
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(metrics.policy.version).toBe(ASSISTANT_POLICY_VERSION);
  expect(metrics.models[0].promptFingerprint).toMatch(/^[a-f0-9]{64}$/);
  expect(metrics.models[0].configurationFingerprint).toMatch(/^[a-f0-9]{64}$/);
  expect(JSON.stringify(metrics)).not.toContain('Use my word list.');
});
it('repairs invalid dependencies before any answer becomes visible',async()=>{
  const invalid=plan();invalid.activities[0].steps[1].produces=[];
  const fetcher=vi.fn<typeof fetch>().mockResolvedValueOnce(response({answerKind:'general',answer:'',plan:invalid,sourceIds:[]},true))
    .mockResolvedValueOnce(response({answerKind:'general',answer:'',plan:plan(),sourceIds:[]},true));
  const visible:string[]=[];
  const result=await answerSiteQuestion(question,'en',config,AbortSignal.timeout(5000),fetcher,[],undefined,async event=>{if(event.type==='answer' && event.answer)visible.push(event.answer);});
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(result.answer).toContain('Write sentences');
  expect(visible.every(text=>text===result.answer)).toBe(true);
});
const glossary={sections:[{entries:[{id:1,headEn:'PLL (Permutation of Last Layer)',headZh:'顶层排列'}]}]};
it('keeps inherited JSON formatting on the normal glossary answer path',async()=>{
  const answer='{"definition":"PLL: Permutation of Last Layer，顶层排列 [[wiki:1]]"}';
  const fetcher=vi.fn<typeof fetch>(async(input,init)=>String(input).endsWith('/wiki/terms')
    ? Response.json(glossary)
    : response({answerKind:'grounded',answer,sourceIds:['wiki:1']},!!JSON.parse(String(init?.body)).stream));
  const result=await answerSiteQuestion('查站内百科，PLL 的定义是什么？','zh',config,AbortSignal.timeout(5000),fetcher,[
    {role:'user',content:'后续词条定义请用 JSON 输出。'},
    {role:'assistant',content:'好的。'},
  ]);
  expect(JSON.parse(result.answer)).toEqual({definition:'PLL: Permutation of Last Layer，顶层排列 [[wiki:1]]'});
});
it('repairs plain text returned for a JSON request and keeps citations inside the JSON',async()=>{
  let calls=0;
  const fetcher=vi.fn<typeof fetch>(async(input,init)=>String(input).endsWith('/wiki/terms')?Response.json(glossary):response({answerKind:'grounded',answer:++calls===1?'PLL means Permutation of Last Layer [[wiki:1]].':'{"definition":"Permutation of Last Layer","translation":"顶层排列"}',sourceIds:['wiki:1']},!!JSON.parse(String(init?.body)).stream));
  const visible:string[]=[];
  const result=await answerSiteQuestion('查百科，PLL 的定义是什么？请用 JSON 输出。','zh',config,AbortSignal.timeout(5000),fetcher,[],undefined,async event=>{if(event.type==='answer'&&event.answer)visible.push(event.answer);});
  expect(calls).toBe(2);
  expect(JSON.parse(result.answer)).toEqual({definition:'Permutation of Last Layer',translation:'顶层排列'});
  expect(result.sources.map(source=>source.id)).toEqual(['wiki:1']);
  expect(visible.every(text=>text===result.answer)).toBe(true);
});
it('does not treat JSON as the topic as an output request, and permits an explicit format change',()=>{
  expect(assistantPresentationContract('Explain JSON and give an example.')).toEqual({});
  expect(assistantPresentationContract('请解释 JSON 的用途。')).toEqual({});
  expect(assistantPresentationContract('现在不用 JSON，请用普通文本。',['请用 JSON 输出。'])).toEqual({});
  expect(assistantPresentationContract('Make it a paragraph instead.',['Return JSON.'])).toEqual({});
  expect(assistantPresentationContract('查百科，PLL 的定义是什么？另外写一句生日祝福。')).toEqual({localTail:{sentences:1,request:'写一句生日祝福。'}});
  expect(assistantPresentationViolation('Hey! Come practise with me. Bring your cube.',{sentences:2})).toBe('presentation_sentence_count');
  expect(assistantPresentationViolation('Meet at 3.5 p.m. tomorrow. Bring your cube.',{sentences:2})).toBeUndefined();
});
it.each([
  ['PLL 是顶层排列。[[wiki:1]]\n\n生日快乐！愿你新的一岁万事顺心。','presentation_local_sentence_count'],
  ['PLL 是顶层排列。[[wiki:1]]\n\n生日快乐！\n\n愿你新的一岁万事顺心。','presentation_local_sentence_count'],
  ['PLL 是顶层排列。[[wiki:1]] 生日快乐！愿你万事顺心。','presentation_local_sentence_count'],
  ['PLL 是顶层排列。[[wiki:1]] 生日快乐！[[wiki:1]] 愿你万事顺心。','presentation_local_sentence_count'],
  ['PLL 是顶层排列。[[wiki:1]] 生日快乐！',undefined],
  ['PLL 是顶层排列。[[wiki:1]] 条目没有正文。\n\n祝你生日快乐，万事顺心！',undefined],
  ['PLL 是顶层排列。[[wiki:1]]\n\n','presentation_local_sentence_count'],
])('counts the complete independent writing scope, not the full answer or just its last paragraph: %s',(answer,expected)=>{
  const contract=assistantPresentationContract('查百科，PLL 的定义是什么？另外写一句生日祝福。');
  expect(assistantPresentationViolation(answer,contract)).toBe(expected);
});
it('keeps local counts generic and honors explicit format changes without claiming per-step or negated scopes',()=>{
  const q='Explain retrieval. Also write two friendly sentences inviting a friend to practise.';
  const c=assistantPresentationContract(q);
  expect(c.localTail?.sentences).toBe(2);expect(c.sentences).toBeUndefined();
  expect(assistantPresentationViolation('Retrieval finds information. It can help answer questions.\n\nCome practise with me. Bring your cube.',c)).toBeUndefined();
  expect(assistantPresentationContract('Write one sentence instead.',[q])).toEqual({sentences:1});
  expect(assistantPresentationContract('Return JSON.',[q])).toEqual({json:true});
  for(const text of ['查百科，另外不要写一句生日祝福。','Explain this, also write one sentence per step.','查百科，另外每项写一句说明。'])expect(assistantPresentationContract(text).localTail).toBeUndefined();
});
it('repairs the observed local two-sentence wish without dropping the evidence paragraph or streaming the rejected draft',async()=>{
  const bad='PLL 的全称是 Permutation of Last Layer，即顶层排列。[[wiki:1]] 条目仅提供名称。\n\n生日祝福：生日快乐！愿你新的一岁每一步都顺心，每一次挑战都能漂亮收官。';
  const good='PLL 的全称是 Permutation of Last Layer，即顶层排列。[[wiki:1]] 条目仅提供名称。\n\n祝你生日快乐，新的一岁万事顺心！';
  let calls=0;const visible:string[]=[];
  const fetcher=vi.fn<typeof fetch>(async(input,init)=>String(input).endsWith('/wiki/terms')?Response.json(glossary):response({answerKind:'grounded',answer:++calls===1?bad:good,sourceIds:['wiki:1']},!!JSON.parse(String(init?.body)).stream));
  const result=await answerSiteQuestion('查百科，PLL 的定义是什么？另外写一句生日祝福。','zh',config,AbortSignal.timeout(5000),fetcher,[],undefined,async e=>{if(e.type==='answer'&&e.answer)visible.push(e.answer);});
  expect(calls).toBe(2);expect(result.answer).toBe(good);expect(result.sources.map(s=>s.id)).toEqual(['wiki:1']);
  expect(visible.every(text=>text===good)).toBe(true);
  expect(JSON.stringify(JSON.parse(String(fetcher.mock.calls.at(-1)![1]?.body)))).toContain('presentation_local_sentence_count');
});
it('does not spend another call on a valid local sentence but rejects a still-invalid repair',async()=>{
  for(const bad of [false,true]) {
    let calls=0;
    const answer='PLL 是顶层排列。[[wiki:1]]\n\n生日快乐！'+(bad?'愿你万事顺心。':'');
    const fetcher=vi.fn<typeof fetch>(async(input,init)=>String(input).endsWith('/wiki/terms')?Response.json(glossary):(calls++,response({answerKind:'grounded',answer,sourceIds:['wiki:1']},!!JSON.parse(String(init?.body)).stream)));
    const result=answerSiteQuestion('查百科，PLL 的定义是什么？另外写一句生日祝福。','zh',config,AbortSignal.timeout(5000),fetcher);
    if(bad)await expect(result).rejects.toMatchObject({code:'model_output_invalid'});else expect((await result).answer).toBe(answer);
    expect(calls).toBe(bad?2:1);
  }
});
it('repairs an extra greeting sentence before streaming a requested two-sentence answer',async()=>{
  const fetcher=vi.fn<typeof fetch>().mockResolvedValueOnce(response({answerKind:'general',answer:'Hey! Come practise with me. Bring your cube.',sourceIds:[]},true))
    .mockResolvedValueOnce(response({answerKind:'general',answer:'Hey, come practise with me. Bring your cube.',sourceIds:[]},true));
  const visible:string[]=[];
  const result=await answerSiteQuestion('Write two friendly sentences inviting a friend to practise cubing.','en',config,AbortSignal.timeout(5000),fetcher,[],undefined,async event=>{if(event.type==='answer'&&event.answer)visible.push(event.answer);});
  expect(result.answer).toBe('Hey, come practise with me. Bring your cube.');
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(visible.every(text=>text===result.answer)).toBe(true);
});
it('fails closed when a JSON repair still returns prose',async()=>{
  const fetcher=vi.fn<typeof fetch>().mockImplementation(async(_input,init)=>response({answerKind:'general',answer:'Hello.',sourceIds:[]},!!JSON.parse(String(init?.body)).stream));
  await expect(answerSiteQuestion('Return JSON with a greeting.','en',config,AbortSignal.timeout(5000),fetcher)).rejects.toMatchObject({code:'model_output_invalid'});
  expect(fetcher).toHaveBeenCalledTimes(2);
});
it.each([
  ['en', '', 'In any step'],
  ['zh', '', '本计划任一步骤'],
  ['zh', ' Answer in English.', 'In any step'],
  ['en', ' 用中文回答。', '本计划任一步骤'],
] as const)('keeps bilingual study pairs intact when adding a %s fallback %s', (lang, instruction, expected) => {
  const pairs = 'apple = 苹果, river = 河流';
  const draft = '1. Recall (120 seconds)\n  - 60 seconds: ' + pairs + '. Prioritise weak words.';
  const answer = assistantPlanSubsetFallback('Make a vocabulary plan.' + instruction, draft, lang);
  expect(answer.slice(0, draft.length)).toBe(draft);
  expect(answer.slice(draft.length).trimStart()).toMatch(new RegExp('^' + expected));
});

it('keeps the inherited vocabulary empty-subset fallback on a short follow-up',async()=>{
  const p=plan();p.inputs=[];p.activities[0].steps[0].requires=[];
  p.activities[0].steps[0].action='Write a short word list and mark weak words.';
  p.activities[0].steps[0].produces=['words'];
  p.activities[1].steps[0].action='Read only the marked weak words.';
  p.activities[1].steps[0].requires=[];
  p.activities.push({...p.activities[1],title:'Repeat'});
  const fetcher=vi.fn<typeof fetch>().mockResolvedValue(response({answerKind:'general',answer:'',plan:p,sourceIds:[]}));
  const result=await answerSiteQuestion('Change to three activities.','en',config,AbortSignal.timeout(5000),fetcher,[{role:'user',content:'Plan two vocabulary activities with two timed substeps each, at most 6 minutes total.'},{role:'assistant',content:'Read and recall the word list.'}]);
  expect(result.answer).toContain('In any step, if this subset is empty or too small');
  expect(result.answer.match(/^\d\./gm)).toHaveLength(3);
  expect(result.answer.match(/^  - /gm)).toHaveLength(6);
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it('repairs card preparation before flip practice while preserving existing allocations',async()=>{
  const bad=plan();bad.activities[0].steps[0].action='Write the words and their meanings on cards.';
  bad.activities[0].steps[1].action='Turn the cards over and check the meanings.';
  const good=structuredClone(bad);good.activities[0].steps[0].action='Write each word on the front of a card and its meaning on the back.';
  good.activities[0].steps[1].action='Place each card word-side up, recall its meaning, flip to check, and return it word-side up.';
  const fetcher=vi.fn<typeof fetch>().mockResolvedValueOnce(response({answerKind:'general',answer:'',plan:bad,sourceIds:[]}))
    .mockResolvedValueOnce(response({answerKind:'general',answer:'',plan:good,sourceIds:[]}));
  const result=await answerSiteQuestion(question,'en',config,AbortSignal.timeout(5000),fetcher);
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(result.answer).toContain('meaning on the back');
});
it.each([
  ['把单词和中文释义写在卡片上。看卡片英文面，翻面核对。','plan_card_layout_missing'],
  ['正面写英文单词，背面写中文释义。看卡片英文面，翻面核对。',undefined],
  ['Read the words on the list and cover the meanings.',undefined],
  ['Read each word card. Do not turn it over.',undefined],
  ['Write each word on the front of a card. Write its meaning on the back. Turn the card over to check.',undefined],
])('checks card layout without rejecting ordinary list practice: %s',(answer,error)=>{
  expect(assistantPlanSemanticViolation(question,answer)).toBe(error);
});
it('repairs private resource IDs in visible prose rather than exposing them',async()=>{
  const bad=plan();bad.activities[1].steps[0].action='Read written_sentences aloud.';
  const fetcher=vi.fn<typeof fetch>().mockResolvedValueOnce(response({answerKind:'general',answer:'',plan:bad,sourceIds:[]}))
    .mockResolvedValueOnce(response({answerKind:'general',answer:'',plan:plan(),sourceIds:[]}));
  const result=await answerSiteQuestion(question,'en',config,AbortSignal.timeout(5000),fetcher);
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(result.answer).not.toContain('written_sentences');
  expect(result.answer).toContain('Read the sentences aloud.');
});
it('closes a correction over the name-only source without retaining unsupported behavior',async()=>{
  const result=await runDataTool({tool:'glossary',query:'PLL'},'zh',async()=>glossary);
  const answer=glossaryNameOnlyAnswer('纠正之前的说法，PLL 的定义是什么？',[{call:{tool:'glossary',query:'PLL'},result}],'zh');
  expect(answer?.answer).toBe('PLL：Permutation of Last Layer，即“顶层排列”[[wiki:1]]。');
  expect(glossaryNameOnlyAnswer('Look up PLL in the site glossary. What does PLL mean? Correct the previous statement.',[{call:{tool:'glossary',query:'PLL'},result}],'en')?.answer).toContain('PLL means Permutation of Last Layer');
});
it.each(['PLL 的定义是什么？另外写一封信。','PLL 的定义和前提是什么？','PLL 的定义是什么？请用 JSON 输出。','PLL 的定义是什么？再给一个使用场景。','PLL 的定义是什么？画成一幅图。'])('preserves mixed or special-format requests: %s',async question=>{
  const result=await runDataTool({tool:'glossary',query:'PLL'},'zh',async()=>glossary);
  expect(glossaryNameOnlyAnswer(question,[{call:{tool:'glossary',query:'PLL'},result}],'zh')).toBeUndefined();
});

it.each([
  ['Write each word on one card side and its meaning on the other. Flip the card to check.',undefined],
  ['Write each word on one card side and its meaning on the other side. Flip the card to check.',undefined],
  ['Write each word and meaning on one card side. Flip the card to check.','plan_card_layout_missing'],
  ['Write each word on the front. Write its meaning somewhere on the card. Flip the card to check.','plan_card_layout_missing'],
])('accepts equivalent card-side layout without accepting single-sided references: %s',(answer,error)=>{
  expect(assistantPlanSemanticViolation(question,answer)).toBe(error);
});
it.each([
  ['Learners write or say target words from memory, then compare lists.','plan_missing_written_answer'],
  ['Learners say or write target words from memory, then compare their lists.','plan_missing_written_answer'],
  ['Learners write target words from memory, then compare lists.',undefined],
  ['Learners say target words from memory, then compare answers aloud.',undefined],
  ['先口述或写下单词，然后比较清单。','plan_missing_written_answer'],
])('requires every offered branch to create a later written list: %s',(answer,error)=>{
  expect(assistantPlanSemanticViolation(question,answer)).toBe(error);
});
it('requires a bounded error-only drill to supply its own zero-error alternative',()=>{
  expect(assistantPlanSemanticViolation(question+' Use 180–230 English words.','Review only marked words.')).toBe('plan_subset_availability');
  expect(assistantPlanSemanticViolation(question+' Use 180–230 English words.','Review marked words; if no errors remain, reuse the whole list.')).toBeUndefined();
});
it.each([
  ['若第一项是备用转法，则继续慢拧同一套已会转法。然后再做一次插入，检查槽位。','plan_fallback_branch_missing'],
  ['用同一插入的逆操作复位情形；若第一项用了备用转法，则继续该转法。','plan_fallback_branch_missing'],
  ['若第一项已确认熟悉情形，用同一插入的逆操作复位，再做一次插入并检查槽位；否则全程慢拧已会转法，不做插入。',undefined],
  ['If the familiar case was verified, reset the case and perform the insertion; otherwise practise known slow turns without an insertion.',undefined],
  ['If the first activity used the fallback, continue known turns. Then repeat the insertion.','plan_fallback_branch_missing'],
])('keeps later slow-turn actions inside the selected branch: %s',(action,error)=>{
  const p={inputs:[],activities:[
    {title:'First',seconds:180,steps:[{action:'若无法准备熟悉情形，改为慢拧已会转法。',reason:'Keep a repeatable starting point.',seconds:180,requires:[],produces:[]}]},
    {title:'Second',seconds:180,steps:[{action,reason:'重复插入可巩固手感，但备用方式不声称完成 F2L。',seconds:180,requires:[],produces:[]}]},
  ]};
  expect(assistantPlanSemanticViolation('安排两项F2L慢拧活动。',renderAssistantPlan(p,false,'zh'),'',p)).toBe(error);
});
it('requires a structured paragraph repair so inherited counts and timings survive',async()=>{
  const bad='First learners write or say target words from memory, then compare lists; next they read meanings and recall the words aloud.';
  const good=plan();good.inputs=[];for(const a of good.activities)for(const step of a.steps)step.requires=step.requires.filter(id=>id!=='words');
  good.activities[0].steps[0].action='Prepare a word list with known meanings and read it.';
  const expected=renderAssistantPlan(good,true,'en',true);
  const fetcher=vi.fn<typeof fetch>().mockResolvedValueOnce(response({answerKind:'general',answer:bad,sourceIds:[]},true))
    .mockResolvedValueOnce(response({answerKind:'general',answer:'',plan:good,sourceIds:[]},true));
  const visible:string[]=[];
  const result=await answerSiteQuestion('Make it a paragraph instead.','en',config,AbortSignal.timeout(5000),fetcher,[
    {role:'user',content:'Plan two vocabulary activities with two timed substeps each.'},
    {role:'assistant',content:'Use a short recall and review plan.'},
  ],undefined,async event=>{if(event.type==='answer'&&event.answer)visible.push(event.answer);});
  expect(result.answer).toBe(expected);expect(result.answer).not.toContain('\n');expect(fetcher).toHaveBeenCalledTimes(2);
  expect(visible.every(text=>text===expected)).toBe(true);
  expect(JSON.stringify(JSON.parse(String(fetcher.mock.calls[1][1]?.body)))).toContain('plan_structure_missing');
});

it.each([
  ['Write each word from your current vocabulary list on the front of its own card and its meaning on the back; then flip to check.',undefined],
  ['Write each word from the full vocabulary list that you selected for this practice on one card side and its corresponding meaning on the other; flip to check.',undefined],
  ['Write words and meanings together on the front of each card from your vocabulary list. Flip the card to check.','plan_card_layout_missing'],
  ['Write words on the front. The following practice involves meanings. Flip the card to check.','plan_card_layout_missing'],
])('uses sentence boundaries instead of distance for card layouts: %s',(answer,error)=>{
  expect(assistantPlanSemanticViolation(question,answer)).toBe(error);
});
it.each([
  ['Turn the same cards meaning-side up and write your attempted word for each on paper. Compare your written attempts with the cards.',undefined],
  ['把卡片翻到释义面，再在纸上写下对应单词；核对写错的词。',undefined],
  ['Write the reference word on the front and its meaning on the back. Compare your written attempts.','plan_missing_written_answer'],
  ['Turn the cards meaning-side up and write or say your answer. Compare your written attempts.','plan_missing_written_answer'],
])('separates reference preparation from mixed paper-writing actions: %s',(answer,error)=>{
  expect(assistantPlanSemanticViolation(question+' I already have double-sided word cards.',answer)).toBe(error);
});
it.each([
  ['Flip to check spelling, and write your attempted answer on paper before comparing.','plan_answer_revealed_before_attempt'],
  ['Uncover the reference, then write your guessed word on paper.','plan_answer_revealed_before_attempt'],
  ['Write your attempted answer after flipping to check.','plan_answer_revealed_before_attempt'],
  ['Write your attempted answer before flipping to check.',undefined],
  ['Before flipping to check, write your attempted answer.',undefined],
  ['Flip to check after writing your attempted answer.',undefined],
  ['Do not flip the card; write your attempted answer first.',undefined],
  ['Flip to check, then copy the correct spelling as a correction.',undefined],
  ['先翻面核对，再写下对应单词。','plan_answer_revealed_before_attempt'],
  ['先写下对应单词，再翻面核对。',undefined],
])('keeps attempt-before-reveal order while allowing corrections: %s',(action,error)=>{
  const prefix='Write words on card fronts and meanings on backs. ';
  expect(assistantPlanSemanticViolation(question,prefix+action)).toBe(error);
});
it.each([
  ['Repeat only the missed ones.','plan_subset_availability'],
  ['Review only your mistakes.','plan_subset_availability'],
  ['Repeat only the missed ones; if no errors remain, use all cards.',undefined],
  ['Review your mistakes; if none remain, finish early.',undefined],
  ['只练错的词，没有错误时重过全部词表。',undefined],
])('covers error-set pronouns and explicit zero-error exits: %s',(answer,error)=>{
  expect(assistantPlanSemanticViolation(question,answer)).toBe(error);
});
it('checks actions rather than treating a rationale as a new writing or reveal instruction',()=>{
  const p=plan();p.activities[0].steps[0].reason='Written answers need to exist before checking; do not flip first and write your attempt afterwards.';
  expect(assistantPlanSemanticViolation(question,renderAssistantPlan(p,true,'en'),'',p)).toBeUndefined();
});

it.each([
  ['Write each meaning on a separate slip of paper. Flip each slip to check the word on the back.','plan_card_reference_missing'],
  ['Write each meaning on a separate slip, with its word on the reverse. Flip each slip to check the word.',undefined],
  ['Write each meaning on a separate slip. Write the word on the back. Flip each slip to check the word.',undefined],
])('requires reference words on newly prepared meaning slips: %s',(answer,error)=>{
  expect(assistantPlanSemanticViolation(question,'Write words on card fronts and meanings on backs. '+answer)).toBe(error);
});


it('allocates the short draft repair using measured step words and rendering overhead',()=>{
  const draft=wordSizedPlan(173),text=renderAssistantPlan(draft,true,'en');
  const instruction=assistantPlanWordInstruction({activities:2,substepsPerActivity:2,englishWords:{minimum:180,maximum:230}},text,draft);
  const budgets=JSON.parse(instruction.match(/budgets: (\[.*?\])/s)![1]);
  expect(budgets.reduce((sum:number,b:{change:number})=>sum+b.change,0)).toBe(32);
  expect(instruction).toContain('173');expect(instruction).toContain('205');
  expect(budgets.every((b:{change:number})=>b.change>0)).toBe(true);
  expect(instruction).toContain('Expand ONLY the reasons');
});
it.each([
  ['Rewrite both words from the meaning side once more without flipping until both are written.','plan_card_reset_missing'],
  ['Reset both cards meaning-side up. Rewrite both words from the meaning side once more without flipping until both are written.',undefined],
  ['Rewrite an unrelated sentence once more.',undefined],
  ['If nothing was missed, use the whole deck again.','plan_card_reset_missing'],
  ['Reset every card meaning-side up; if nothing was missed, use the whole deck again.',undefined],
  ['Repeat both words from the meaning-side again.','plan_card_reset_missing'],
])('requires restoring hidden prompts before another written card pass: %s',(repeat,error)=>{
  const text='Write words on card fronts and meanings on backs. Turn the cards meaning-side up. Write each attempted word on paper, then flip to check the word. '+repeat;
  expect(assistantPlanSemanticViolation(question,text)).toBe(error);
});


it.each([
  'Rewrite both words once more from the meaning side.',
  'Rewrite both words from the meaning side once more.',
  'Once more, rewrite both words from the meaning side.',
  'Again, write both words from the meaning-side.',
  'Use the same deck once more.',
  'Use once more the same deck.',
  'Once more, use the same deck.',
  'Redo the whole deck once more.',
])('recognizes repeated card prompts in either word order: %s',(repeat)=>{
  const prefix='Write words on card fronts and meanings on backs. Turn both cards meaning-side up. Write each attempted word on paper, then flip to check the word. ';
  expect(assistantPlanSemanticViolation(question,prefix+repeat)).toBe('plan_card_reset_missing');
  expect(assistantPlanSemanticViolation(question,prefix+'Reset both cards meaning-side up. '+repeat)).toBeUndefined();
});
it.each([
  'Do not rewrite both words once more from the meaning side.',
  'Rewrite an unrelated sentence once more.',
  'Review the unrelated word list again.',
  'Rewrite both words after resetting both cards meaning-side up, from the meaning side once more.',
])('does not invent a repeated card attempt or ignore an explicit prior reset: %s',(repeat)=>{
  const prefix='Write words on card fronts and meanings on backs. Turn both cards meaning-side up. Write each attempted word on paper, then flip to check the word. ';
  expect(assistantPlanSemanticViolation(question,prefix+repeat)).toBeUndefined();
});
it('isolates short-plan repair from catalogs and provides additive reason budgets',async()=>{
  const fetcher=vi.fn<typeof fetch>().mockResolvedValueOnce(response({answerKind:'general',answer:'',plan:wordSizedPlan(173),sourceIds:[]}))
    .mockResolvedValueOnce(response({answerKind:'general',answer:'',plan:wordSizedPlan(205),sourceIds:[]}));
  const result=await answerSiteQuestion(question+' Use 180–230 English words.','en',config,AbortSignal.timeout(5000),fetcher);
  expect(result.answer.trim().split(/\s+/).length).toBe(205);expect(fetcher).toHaveBeenCalledTimes(2);
  const request=JSON.parse(String(fetcher.mock.calls[1][1]?.body));
  const text=JSON.stringify(request);
  expect(text).toContain('Expand ONLY the reasons');expect(text).toContain('targetReasonWords');
  expect(text).toContain('rejectedPlan');expect(text).toContain('maximumMinutes');
  expect(text).not.toContain('statisticsCatalog');expect(text).not.toContain('announcementCatalog');
  expect(request.tools).toBeUndefined();
});
it('keeps rejecting an unchanged short repair without padding or another model call',async()=>{
  const fetcher=vi.fn<typeof fetch>().mockImplementation(async()=>response({answerKind:'general',answer:'',plan:wordSizedPlan(173),sourceIds:[]}));
  await expect(answerSiteQuestion(question+' Use 180–230 English words.','en',config,AbortSignal.timeout(5000),fetcher)).rejects.toMatchObject({code:'model_output_invalid'});
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it.each([
  ['Write each meaning from the list on a separate slip, shuffle the slips, then for each slip write your attempted word on paper before turning the slip over to compare with the correct word.','plan_card_reference_missing'],
  ['Write each meaning on a slip and its corresponding word on the reverse. Write your attempted word before turning the slip over to compare with the correct word.',undefined],
  ['Lay out the word cards word-side up, say the meaning, flip to check, then reset every card word-side up.','plan_card_layout_missing'],
  ['把单词表的词逐个读出，翻到释义面核对。','plan_card_layout_missing'],
  ['Read the word list, cover the meaning column, say the meaning, then uncover it and check.',undefined],
  ['Flip through the word list and read each word aloud.',undefined],
  ['Do not flip the cards. Read the original word list aloud.',undefined],
  ['Lay out cards with words on the front and meanings on the back, then flip to check.','plan_card_layout_missing'],
])('checks material preparation before both bare flips and turn-over wording: %s',(answer,error)=>{
  expect(assistantPlanSemanticViolation(question,answer)).toBe(error);
});
it.each([
  ['If the deck is empty, write two new meanings from memory and continue the same way.','plan_card_reference_missing'],
  ['If no cards exist, write five meanings from memory first. Write the word for each meaning before flipping to compare.','plan_card_reference_missing'],
  ['If the deck is empty, write two new meanings and attempt their words the same way.','plan_card_reference_missing'],
  ['If the deck is empty, write two new meanings on slips and their words on the reverse, then continue the same way.',undefined],
  ['If the deck is empty, read meanings from the original list and recall the words aloud.',undefined],
])('does not borrow reference answers for new fallback slips: %s',(fallback,error)=>{
  expect(assistantPlanSemanticViolation(question,'Write words on card fronts and meanings on backs. Write each attempted word on paper, then flip to check the word. '+fallback)).toBe(error);
});
it.each(['nothing was marked','nothing is wrong','none were marked'])('accepts a usable zero-error alternative: %s',condition=>{
  expect(assistantPlanSemanticViolation(question+' Use 180–230 English words.',`Review only marked words; if ${condition}, run one more full pass through the original list.`)).toBeUndefined();
});
it('still rejects an empty error-only subset when nothing was marked has no usable branch',()=>{
  expect(assistantPlanSemanticViolation(question+' Use 180–230 English words.','Review only marked words; if nothing was marked, review the marked ones.')).toBe('plan_subset_availability');
});
it.each([
  ['Reset only wrong cards word-side up; if nothing was marked, use the whole deck again.','plan_card_reset_missing'],
  ['Reset every card word-side up; if nothing was marked, use the whole deck again.',undefined],
])('does not apply an error-subset reset to the entire deck: %s',(repeat,error)=>{
  expect(assistantPlanSemanticViolation(question,'Write words on card fronts and meanings on backs. Start word-side up, say the meaning, flip to check. '+repeat)).toBe(error);
});
it('requires a reset in the Chinese no-error reshuffle branch',()=>{
  const answer='把单词表上的词抄到卡片正面，把释义写在背面。把卡片词面朝上逐张看词，先说出释义，再翻到背面核对；答错的卡记下后翻回词面，全部过完后重做错卡，若没有错卡就重洗整叠再练一遍。';
  expect(assistantPlanSemanticViolation(question,answer)).toBe('plan_card_reset_missing');
});
it('checks material prerequisites inside a structured paragraph before streaming',async()=>{
  const good:AssistantStructuredPlan={inputs:[{id:'words',quote:'my word list'}],activities:[
    {title:'Recall',steps:[{action:'Cover the MEANING column, say each meaning, uncover to check, then cover the MEANING column again before each next word.',reason:'Retrieve before checking.',requires:['words'],produces:[]}]},
    {title:'Read',steps:[{action:'Read the original list aloud.',reason:'Practise pronunciation.',requires:['words'],produces:[]}]},
  ]};
  const bad=structuredClone(good);bad.activities[0].steps[0].action='Lay out the word cards word-side up, say each meaning, flip to check and reset word-side up.';
  const fetcher=vi.fn<typeof fetch>().mockResolvedValueOnce(response({answerKind:'general',answer:'',plan:bad,sourceIds:[]},true))
    .mockResolvedValueOnce(response({answerKind:'general',answer:'',plan:good,sourceIds:[]},true));
  const visible:string[]=[];
  const result=await answerSiteQuestion('Make it a paragraph instead.','en',config,AbortSignal.timeout(5000),fetcher,[
    {role:'user',content:'Plan two vocabulary activities using my word list.'},
    {role:'assistant',content:'Use recall and review.'},
  ],undefined,async event=>{if(event.type==='answer'&&event.answer)visible.push(event.answer);});
  const expected=renderAssistantPlan(good,false,'en',true);
  expect(result.answer).toBe(expected);expect(fetcher).toHaveBeenCalledTimes(2);
  expect(visible.every(text=>text===expected)).toBe(true);
  expect(JSON.stringify(JSON.parse(String(fetcher.mock.calls[1][1]?.body)))).toContain('plan_card_layout_missing');
});

const expandedReasonsPlan=()=>{
  const p=wordSizedPlan(173);
  const explanations=[
    ' Reading familiar meanings gives you a reference against which to check the words recalled later.',
    ' A sentence links the word to a concrete situation so its intended meaning becomes easier to remember.',
    ' Reading aloud makes awkward wording audible so you can identify the exact sentence needing a correction.',
    ' Comparing the corrected sentence with the original makes the change visible and helps prevent repeating that mistake.',
  ];
  p.activities.flatMap(a=>a.steps).forEach((step,index)=>{step.reason+=explanations[index];});return p;
};
it('selects complete independent reasons when a short-plan repair overshoots',()=>{
  const before=wordSizedPlan(173),after=expandedReasonsPlan(),range={minimum:180,maximum:230};
  expect(renderAssistantPlan(after,true,'en').split(/\s+/).length).toBeGreaterThan(230);
  const selected=assistantPlanReasonSelection(before,after,range,true,'en')!;
  expect(selected).toBeDefined();
  expect(validateAssistantPlan(selected,{...options,shape:{...options.shape,englishWords:range}}).error).toBeUndefined();
  selected.activities.flatMap(a=>a.steps).forEach((step,index)=>{
    const original=before.activities.flatMap(a=>a.steps)[index],edited=after.activities.flatMap(a=>a.steps)[index];
    expect([original.reason,edited.reason]).toContain(step.reason);
    expect({...step,reason:original.reason}).toEqual(original);
  });
  expect(assistantPlanSemanticViolation(question,renderAssistantPlan(selected,true,'en'),'',selected)).toBeUndefined();
  expect(assistantPlanReasonSelection(before,before,range,true,'en')).toBeUndefined();
  after.activities[0].steps[0].action='Use cards that have not been prepared.';
  expect(assistantPlanReasonSelection(before,after,range,true,'en')).toBeUndefined();
});
it('recovers an oversized reason-only repair with the same two provider calls',async()=>{
  const fetcher=vi.fn<typeof fetch>().mockResolvedValueOnce(response({answerKind:'general',answer:'',plan:wordSizedPlan(173),sourceIds:[]}))
    .mockResolvedValueOnce(response({answerKind:'general',answer:'',plan:expandedReasonsPlan(),sourceIds:[]}));
  const result=await answerSiteQuestion(question+' Use 180–230 English words.','en',config,AbortSignal.timeout(5000),fetcher);
  expect(result.answer.split(/\s+/).length).toBe(205);expect(fetcher).toHaveBeenCalledTimes(2);
});

it.each(v38Failures.filter(item=>item.case.id==='X02'))('replays the original bounded card plan without a repair: $key',async item=>{
  const fetcher=vi.fn<typeof fetch>().mockResolvedValueOnce(response(item.models[0])).mockResolvedValueOnce(response(item.models[1]));
  const result=await answerSiteQuestion(item.case.question,'en',config,AbortSignal.timeout(5000),fetcher);
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(result.answer).toContain('紫罗兰');
  expect(assistantPlanDurationViolation(result.answer,160/60)).toBeUndefined();
  expect(assistantPlanDurationViolation(result.answer,159/60)).toBe('duration_limit_exceeded');
  expect(JSON.stringify(JSON.parse(String(fetcher.mock.calls[0][1]?.body)))).toContain('maximumTotalSeconds');
});

it.each(v38Failures.filter(item=>item.case.id==='X10'))('repairs the original photo-only reply as two executable alternatives: $key',async item=>{
  const plan={inputs:[],activities:[
    {title:'慢拧观察',seconds:70,steps:[{action:'仅在确认熟悉情形时慢速插入；否则每次缓慢转一个已会的基本转动，停下观察可见颜色变化。',reason:'把转动和观察联系起来。',seconds:70,requires:[],produces:[]}]},
    {title:'预测与核对',seconds:80,steps:[{action:'只有上一项确认过熟悉情形，才复位同一情形再练；否则先预测一个可见变化，用一个已会的动作缓慢转动，再核对实际变化。',reason:'用当前魔方检查预测。',seconds:80,requires:[],produces:[]}]},
  ]};
  const fetcher=vi.fn<typeof fetch>().mockResolvedValueOnce(response(item.models[0])).mockResolvedValueOnce(response({answerKind:'general',answer:'',plan,sourceIds:[]}));
  const result=await answerSiteQuestion(item.case.question,'zh',config,AbortSignal.timeout(5000),fetcher,item.case.history as Array<{role:'user'|'assistant';content:string}>);
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(result.answer.match(/否则/g)).toHaveLength(2);
  expect(result.answer).toContain('80 秒');
  const request=JSON.stringify(JSON.parse(String(fetcher.mock.calls[0][1]?.body)));
  expect(request).toContain('maximumTotalSeconds');
  expect(request).toContain('150');
  expect(request).toContain('Do not ask for clarification in place of the drills');
  const missingSecond=structuredClone(plan);
  missingSecond.activities[1].steps[0].action='只有上一项确认过熟悉情形，才复位同一情形再练。';
  expect(assistantPlanSemanticViolation(item.case.question,renderAssistantPlan(missingSecond,false,'zh'),item.case.history[0].content,missingSecond)).toBe('plan_slow_turn_alternative_missing');
});

it('requires the prompt face to be restored before repeating a relative-face recall cycle',()=>{
  const request='Use my two-sided vocabulary cards for recall practice.';
  const first='For each card place it prompt-side up, attempt the hidden answer, flip once to check, and return that card to the same prompt face.';
  const repeat='Repeat the same attempt–flip–check–reset cycle through the full card set.';
  expect(assistantPlanSemanticViolation(request,first+'\n'+repeat)).toBeUndefined();
  expect(assistantPlanSemanticViolation(request,first.replace(', and return that card to the same prompt face','')+'\n'+repeat))
    .toBe('plan_card_reset_missing');
});

it.each(v39Failures)('accepts the original v39 draft without repair after fixing the matching contract: $key',async item=>{
  const history=item.case.history as Array<{role:'user'|'assistant';content:string}>;
  const lang=item.case.lang as 'zh'|'en';
  const fetcher=vi.fn<typeof fetch>().mockResolvedValueOnce(response(item.models[0])).mockImplementation(async()=>{throw new Error('Unexpected repair');});
  const result=await answerSiteQuestion(item.case.question,lang,config,AbortSignal.timeout(5000),fetcher,history);
  expect(fetcher).toHaveBeenCalledTimes(1);
  if(item.case.id==='Y07'){
    expect(result.answer.split('\n').filter(line=>/^\d+\. .*否则/.test(line))).toHaveLength(2);
    const original=item.models[0].plan!;
    const unsafe=structuredClone(original);
    unsafe.activities[1].steps[0].action=unsafe.activities[1].steps[0].action.replace(/。$/,'，再做一次插入。');
    expect(assistantPlanSemanticViolation(item.case.question,renderAssistantPlan(unsafe,false,lang),history[0].content,unsafe))
      .toBe('plan_fallback_branch_missing');
    const messages=JSON.parse(String(fetcher.mock.calls[0][1]?.body)).messages as {content:string}[];
    expect(messages.some(message=>message.content.includes('"maximumTotalSeconds":165'))).toBe(true);
  }else if(item.case.id==='Y09'){
    expect(result.answer.match(/\(40 秒\)/g)).toHaveLength(3);
    const messages=JSON.parse(String(fetcher.mock.calls[0][1]?.body)).messages as {content:string}[];
    expect(messages.some(message=>message.content.includes('"maximumTotalSeconds":120'))).toBe(true);
    const over=structuredClone(item.models[0].plan!);
    over.activities[0].seconds=over.activities[0].steps[0].seconds=41;
    expect(validateAssistantPlan(over,{maximumMinutes:2,timed:true,lang,userTexts:[item.case.question]}).error)
      .toBe('duration_limit_exceeded');
  }else {
    expect(result.answer.split('\n\n')).toHaveLength(2);
    const contract=assistantPresentationContract(item.case.question);
    expect(contract.localTail).toMatchObject({sentences:1,separateParagraph:true});
    expect(assistantPresentationViolation(result.answer.replace('\n\n',' '),contract)).toBe('presentation_local_sentence_scope');
  }
});

it.each(v40Failures)('validates the original v40 draft without an unnecessary repair: $key',async item=>{
  const history=item.case.history as Array<{role:'user'|'assistant';content:string}>;
  const lang=item.case.lang as 'zh'|'en';
  const fetcher=vi.fn<typeof fetch>().mockResolvedValueOnce(response(item.models[0])).mockImplementation(async()=>{throw new Error('Unexpected repair');});
  const result=await answerSiteQuestion(item.case.question,lang,config,AbortSignal.timeout(5000),fetcher,history);
  expect(fetcher).toHaveBeenCalledTimes(1);
  if(item.case.id==='Z01'){
    expect(result.answer.match(/\(100 秒\)/g)).toHaveLength(2);
    const original=item.models[0].plan!;
    const unsafe=structuredClone(original);
    unsafe.activities[1].steps[0].action=unsafe.activities[1].steps[0].action
      .replace(/并目视确认局面和目标槽位；确认后/, '；确认后');
    expect(assistantPlanSemanticViolation(item.case.question,renderAssistantPlan(unsafe,false,lang),history[0].content,unsafe))
      .toBe('plan_fallback_branch_missing');
  }else if(item.case.id==='Z04'){
    expect(result.answer).toContain('做一次 D2');
    const unsafe=structuredClone(item.models[0].plan!);
    unsafe.activities[1].steps[0].action=unsafe.activities[1].steps[0].action.replaceAll('D2','D');
    expect(assistantPlanSemanticViolation(item.case.question,renderAssistantPlan(unsafe,false,lang),'',unsafe))
      .toBe('plan_unsupplied_move_sequence');
  }else if(item.case.id==='Z11'){
    expect(result.answer).toContain('drawing-side up');
    expect(result.answer.match(/\(50 seconds\)/g)).toHaveLength(2);
    const notMade='I have not made any two-sided vocabulary cards. Give two card recall drills.';
    expect(assistantPlanSemanticViolation(notMade,result.answer)).toBe('plan_card_layout_missing');
  }else {
    const draft=item.models[0].plan!;
    const rendering=renderAssistantPlan(draft,true,lang);
    expect(rendering.trim().split(/\s+/)).toHaveLength(178);
    expect(result.answer.trim().split(/\s+/)).toHaveLength(168);
    for(const activity of draft.activities)for(const step of activity.steps)expect(result.answer).toContain(step.action);
    expect(assistantPlanDurationViolation(result.answer,3)).toBeUndefined();
  }
});

it('uses a measured shortening budget without redistributing valid actions',()=>{
  const item=v40Failures.find(row=>row.case.id==='Z12')!;
  const draft=item.models[0].plan!;
  const bounds={activities:2,substepsPerActivity:2,englishWords:{minimum:140,maximum:170}};
  const prompt=assistantPlanWordInstruction(bounds,renderAssistantPlan(draft,true,'en'),draft);
  expect(prompt).toContain('Remove at least 8 words by shortening ONLY the reasons');
  expect(prompt).toContain('Copy every action, title, timing, input and dependency unchanged');
});

it.each(v41SlowTurn.flatMap(item=>item.models.map((draft,index)=>({repeat:item.repeat,phase:index===0?'draft':'repair',case:item.case,draft}))))
('accepts AA01 $phase from round $repeat without an extra model call',async item=>{
  const history=item.case.history as Array<{role:'user'|'assistant';content:string}>;
  const fetcher=vi.fn<typeof fetch>().mockResolvedValueOnce(response(item.draft)).mockImplementation(async()=>{throw new Error('Unexpected repair');});
  const result=await answerSiteQuestion(item.case.question,'zh',config,AbortSignal.timeout(5000),fetcher,history);
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(result.answer.match(/\(90 秒\)/g)).toHaveLength(2);
  for(const activity of item.draft.plan.activities)expect(result.answer).toContain(activity.steps[0].action);
});

it.each([
  ['missing visual check',(text:string)=>text.replace('，并目视确认局面和目标槽位','')],
  ['failed visual check',(text:string)=>text.replace('目视确认局面和目标槽位','目视确认局面未摆出')],
  ['insert before confirmation',(text:string)=>text.replace('，并目视确认','随后直接插入，并目视确认')],
  ['insert on the fallback path',(text:string)=>text.replace(/。$/,'，然后插入。')],
])('still rejects an unverified AA01 insertion (%s)',(_label,mutate)=>{
  const item=v41SlowTurn[0];
  const plan=structuredClone(item.models[0].plan);
  const step=plan.activities[1].steps[0];
  const previous=step.action;
  step.action=mutate(previous);
  expect(step.action).not.toBe(previous);
  expect(assistantPlanSemanticViolation(item.case.question,renderAssistantPlan(plan,false,'zh'),item.case.history[0].content,plan))
    .toBe('plan_fallback_branch_missing');
});

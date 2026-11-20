import {expect,it} from 'vitest';
import failures from './fixtures/assistant-v25-failures.json';
import negationFailure from './fixtures/assistant-v26-negation.json';
import {assistantPlanSemanticViolation,assistantPlanRestoreInputQuotes,assistantPlanReasonSelection,validateAssistantPlan,assistantPlanShape} from '../src/utils/site_assistant_plan.js';

for(const item of failures.filter(x=>x.key.endsWith('H08')||x.key.endsWith('H09')))it(`checks actual repeated-card state: ${item.key}`,()=>{
 const model=item.models.at(-1)!;
 expect(assistantPlanSemanticViolation(item.case.question,item.answer??'','',model.plan)).toBe('plan_card_reset_missing');
});
for(const item of failures.filter(x=>x.key.endsWith('H14')||x.key.endsWith('H15')))it(`accepts the valid slow-turn branches: ${item.key}`,()=>{
 const q=[...item.case.history.filter(x=>x.role==='user').map(x=>x.content),item.case.question].join('\n');
 expect(assistantPlanSemanticViolation(q,'','',item.models.at(-1)!.plan)).toBeUndefined();
});
const cards='Plan two vocabulary activities. I already have double-sided cards.';
it('accepts the exact v26 negated-use output',()=>{
 expect(assistantPlanSemanticViolation(negationFailure.case.question,'','',negationFailure.model.plan)).toBeUndefined();
});
it.each(['没有使用','未使用','不使用','没有采用','未采用','不采用','没有引入','未引入','不引入','没有加入','未加入','不加入'])('separates %s from a later affirmative action',negative=>{
 const q='我不会任何F2L插入。安排两项慢拧练习。';
 const good=`1. 用已会的基本转动慢拧；检查${negative}公式或插入动作。\n2. 用已会的基本转动慢拧。`;
 expect(assistantPlanSemanticViolation(q,good)).toBeUndefined();
 expect(assistantPlanSemanticViolation(q,good.replace('公式或插入动作。','公式或插入动作，但是用插入复位。'))).toBe('plan_unlearned_insertion');
});
const prefix='Lay every card meaning-side up, say each word, then flip to check. ';
it.each(['put any missed card back in the pile for a second pass','repeat the missed cards once','do a full extra round','repeat the same meaning-side-up recall once more'])('requires prompt faces before %s',repeat=>{
 expect(assistantPlanSemanticViolation(cards,prefix+repeat+'.')).toBe('plan_card_reset_missing');
 expect(assistantPlanSemanticViolation(cards,prefix+'Reset every card meaning-side up. '+repeat+'.')).toBeUndefined();
});
it('carries the unreset end state of a referenced routine into a subsequent pass',()=>{
 const again='Reset every card meaning-side up, then re-run the full set the same way; shuffle and do a final full pass.';
 expect(assistantPlanSemanticViolation(cards,prefix+again)).toBe('plan_card_reset_missing');
 expect(assistantPlanSemanticViolation(cards,prefix+again.replace('; shuffle','; reset every card meaning-side up, then shuffle'))).toBeUndefined();
 expect(assistantPlanSemanticViolation(cards,prefix.replace('flip to check.','flip to check, then return each card meaning-side up.')+again)).toBeUndefined();
});
it('does not apply a zero-error reset to the alternative missed-card branch',()=>{
 const answer=prefix+'If no errors occurred, reset every card meaning-side up and repeat the full set; otherwise repeat the missed cards once.';
 expect(assistantPlanSemanticViolation(cards,answer)).toBe('plan_card_reset_missing');
 expect(assistantPlanSemanticViolation(cards,answer.replace('otherwise repeat','otherwise reset the missed cards meaning-side up and repeat'))).toBeUndefined();
});
it.each(['没有尝试插入，但是用插入复位。','未做插入，然后执行插入。','不尝试插入；接着做插入。'])('does not hide affirmative turns after a negation: %s',action=>{
 expect(assistantPlanSemanticViolation('我不会任何F2L插入。安排两项慢拧练习。',action)).toBe('plan_unlearned_insertion');
});
it.each(['仅在上一项未确认熟悉情形时','仅在上一项没有确认熟悉情形时','仅在上一项无法确认熟悉情形时'])('does not treat a negative condition as verified: %s',condition=>{
 const answer=`1. 只用已会的基本转动慢拧；若无法确认情形，则全程慢拧基本转动。\n2. ${condition}，用同一逆操作复位情形并插入；否则只用已会的基本转动慢拧。`;
 expect(assistantPlanSemanticViolation('安排两项F2L慢拧练习。',answer)).toBe('plan_fallback_branch_missing');
});
it('restores only verified unchanged inputs during a length-only repair',()=>{
 const item=failures.find(x=>x.key==='1/before/H07')!;
 const [draft,repair]=item.models.map(x=>x.plan),q=item.case.question;
 const restored=assistantPlanRestoreInputQuotes(draft,repair,[q]);
 expect(restored?.inputs).toEqual(draft.inputs);
 const selected=assistantPlanReasonSelection(draft,restored,{minimum:140,maximum:180},true,'en')??restored;
 expect(selected).toBeDefined();
 expect(validateAssistantPlan(selected,{shape:assistantPlanShape(q),timed:true,maximumMinutes:4,userTexts:[q],lang:'en'}).error).toBeUndefined();
 const changedQuote=structuredClone(repair);changedQuote.inputs[0].quote+=' I have cards.';
 expect(assistantPlanRestoreInputQuotes(draft,changedQuote,[q])).toBeUndefined();
 const changedAction=structuredClone(repair);changedAction.activities[0].steps[0].action='Flip the cards.';
 expect(assistantPlanRestoreInputQuotes(draft,changedAction,[q])).toBeUndefined();
 expect(assistantPlanRestoreInputQuotes(draft,repair,['A different request.'])).toBeUndefined();
});

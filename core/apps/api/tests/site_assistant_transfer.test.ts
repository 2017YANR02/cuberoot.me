import {expect,it} from 'vitest';
import failures from './fixtures/assistant-v23-transfer-failures.json';
import cardResetFailure from './fixtures/assistant-v24-card-reset.json';
import {assistantPlanShape,resolveAssistantPlanShape,validateAssistantPlan,assistantPlanSemanticViolation,assistantCubePlanGuidance,assistantObservationOnlyPlan} from '../src/utils/site_assistant_plan.js';
it.each(['每项两步','每项2步','每个活动两个步骤','每项两个子步骤'])('preserves Chinese child allocations: %s',wording=>{
 expect(assistantPlanShape(`安排三项词汇练习，${wording}，每步给动作、理由和时长，最多6分钟。`)).toMatchObject({activities:3,substepsPerActivity:2});
});
it.each(['每项最多两步','每项至少两步'])('does not turn a bound into an exact count: %s',wording=>{
 expect(assistantPlanShape(`安排三项词汇练习，${wording}。`)?.substepsPerActivity).toBeUndefined();
});
it('keeps semantic counts through paragraph and list changes',()=>{
 const prior='Plan two vocabulary activities with two timed substeps each.';
 expect(resolveAssistantPlanShape('Make it one paragraph instead.',[prior]).shape).toEqual({activities:2,substepsPerActivity:2,paragraph:true});
 expect(resolveAssistantPlanShape('Change to a list.',[prior,'Make it one paragraph instead.']).shape).toEqual({activities:2,substepsPerActivity:2});
});
for(const item of failures)it(`replays exact v23 output ${item.key}`,()=>{
 const prior=item.case.history.filter(x=>x.role==='user').map(x=>x.content);
 const shape=resolveAssistantPlanShape(item.case.question,prior).shape;
 const checked=validateAssistantPlan(item.model.plan,{shape,timed:true,userTexts:[...prior,item.case.question],lang:item.case.lang as 'en'|'zh'});
 if(item.key.endsWith('H06')){expect(checked.error).toBeUndefined();expect(checked.answer?.match(/^  - \d+ 秒:/gm)).toHaveLength(6);}
 else if(item.key.endsWith('H10')){expect(shape).toMatchObject({activities:2,substepsPerActivity:2,paragraph:true});expect(checked.error).toBe('plan_invalid_structure');}
 else expect(assistantPlanSemanticViolation([...prior,item.case.question].join('\n'),item.answer??checked.answer??'', '',item.model.plan)).toBe(item.key.endsWith('H09')?'plan_card_reset_missing':item.key.endsWith('H14')?'plan_unlearned_insertion':'plan_slow_turn_activity_missing');
});
it.each(['run one faster pass','do a quick mixed pass','make another clean pass','take a second pass'])('requires reset before %s',pass=>{
 const q='Plan two vocabulary activities. I have double-sided cards with words on the front and meanings on the back.';
 const prefix='Lay the cards meaning-side up, say each word, then flip to check. ';
 expect(assistantPlanSemanticViolation(q,prefix+`If no errors occurred, shuffle the done pile and ${pass}.`)).toBe('plan_card_reset_missing');
 expect(assistantPlanSemanticViolation(q,prefix+`If no errors occurred, reset every card meaning-side up, shuffle the done pile and ${pass}.`)).toBeUndefined();
});
it.each(['run one more pass','do one more full pass','take another quick pass'])('does not borrow a missed-card reset for the no-error branch: %s',pass=>{
 const q='Plan two vocabulary activities. I have double-sided cards with words on the front and meanings on the back.';
 const prefix='Place every card meaning-side up, say each word, then flip to check. ';
 const subset='Repeat only the cards you missed, resetting each to meaning-side up first; ';
 expect(assistantPlanSemanticViolation(q,prefix+`If nothing was missed, ${pass} through the full list instead.`)).toBe('plan_card_reset_missing');
 expect(assistantPlanSemanticViolation(q,prefix+subset+`if nothing was missed, ${pass} through the full list instead.`)).toBe('plan_card_reset_missing');
 expect(assistantPlanSemanticViolation(q,prefix+subset+`if nothing was missed, reset every card meaning-side up, then ${pass} through the full list instead.`)).toBeUndefined();
});
it('accepts resetting every card before either error branch',()=>{
 const q='Plan two vocabulary activities. I already have double-sided cards.';
 const answer='Place every card meaning-side up, say each word, then flip to check. Reset every card meaning-side up. Repeat only the cards you missed; if nothing was missed, run one more pass through the full list instead.';
 expect(assistantPlanSemanticViolation(q,answer)).toBeUndefined();
});
it('rejects the exact v24 card-reset failure and accepts a full-deck reset',()=>{
 const {case:input,answer,model}=cardResetFailure;
 expect(assistantPlanSemanticViolation(input.question,answer,'',model.plan)).toBe('plan_card_reset_missing');
 const fixed=structuredClone(model.plan);
 fixed.activities[1].steps[1].action=fixed.activities[1].steps[1].action.replace('if nothing was missed, run','if nothing was missed, reset every card meaning-side up, then run');
 expect(assistantPlanSemanticViolation(input.question,answer,'',fixed)).toBeUndefined();
});
it('uses only known basic turns when no insertion is learned',()=>{
 const q='我不会任何 F2L 插入，只会几个基本转动。安排两项慢拧活动，总计最多4分钟，不要让我先学公式。';
 expect(assistantCubePlanGuidance(q)).toContain('knows NO insertion');expect(assistantCubePlanGuidance(q)).not.toContain('choose ONE insertion');
 const good='1. 练习：用已会的基本转动慢拧，不做插入、逆序设置或已解槽检查。\n2. 复习：用已会的基本转动慢拧，逐步停顿观察，不做插入或逆准备。';
 expect(assistantPlanSemanticViolation(q,good)).toBeUndefined();
 expect(assistantPlanSemanticViolation(q,good.replace('逐步停顿观察','用插入的逆序复位'))).toBe('plan_unlearned_insertion');
 expect(assistantPlanSemanticViolation(q,good.replace('不做插入、逆序设置或已解槽检查','不做插入，然后用插入复位'))).toBe('plan_unlearned_insertion');
});
it('honors new turn permission and requires both activities to turn',()=>{
 const old='安排两项静态F2L观察练习，不转魔方。',current='现在允许转动，请改为两项慢拧练习。';
 expect(assistantObservationOnlyPlan(current,old)).toBe(false);
 const answer='1. 记录：只记录可见颜色。\n2. 慢拧：只用已会的基本转动慢拧。';
 expect(assistantPlanSemanticViolation(old+'\n'+current,answer)).toBe('plan_slow_turn_activity_missing');
 expect(assistantPlanSemanticViolation(old+'\n'+current,answer.replace('只记录可见颜色','只用已会的基本转动慢拧并记录可见颜色'))).toBeUndefined();
});

it('lets explicitly learned insertion replace an older no-insertion constraint',()=>{
 const q='我不会任何 F2L 插入。\n现在已经学会一个插入，安排两项慢拧练习。';
 expect(assistantCubePlanGuidance(q)).not.toContain('knows NO insertion');
});

it('does not lose timing validation when rendering a paragraph',()=>{
 const fixture=failures.find(x=>x.key==='1/after/H06')!;
 const shape={activities:3,substepsPerActivity:2,paragraph:true};
 const model=structuredClone(fixture.model.plan)!;
 model.activities[0].seconds+=1;
 expect(validateAssistantPlan(model,{shape,timed:true,userTexts:[fixture.case.question],lang:'zh'}).error).toBe('plan_duration_mismatch');
});
it('keeps word bounds on the final paragraph',()=>{
 const fixture=failures.find(x=>x.key==='1/after/H06')!;
 const shape={activities:3,substepsPerActivity:2,paragraph:true,englishWords:{minimum:1,maximum:2}};
 expect(validateAssistantPlan(fixture.model.plan,{shape,timed:true,userTexts:[fixture.case.question],lang:'en'}).error).toBe('plan_word_count');
});
it('uses an inherited no-insertion premise in a short follow-up',()=>{
 expect(assistantCubePlanGuidance('改成两项慢拧练习。','我不会任何F2L插入，只会基本转动。')).toContain('knows NO insertion');
});

it.each(['不做插入，但是用插入复位。','Do not insert, but use the inverse insertion.'])('does not let negation hide a later affirmative action: %s',action=>{
 expect(assistantPlanSemanticViolation('我不会任何F2L插入。安排两项慢拧练习。',action)).toBe('plan_unlearned_insertion');
});

import { expect, it } from 'vitest';
import { assistantPlanShape, assistantPlanTimeBounds, validateAssistantPlan, assistantPlanSemanticViolation, restoreAssistantCardPromptAfterCheck, retainAssistantKnownTurnOptions } from '../src/utils/site_assistant_plan.js';
import { assistantPresentationContract, assistantPresentationViolation } from '../src/utils/site_assistant_presentation.js';

it('binds a seconds cap to the full drill and separates each allocation bound', () => {
  expect(assistantPlanTimeBounds('Give two drills in 90 seconds total, each drill at most 60 seconds, each step no more than 30 seconds.')).toEqual({
    total:90, activity:60, step:30,
  });
  expect(assistantPlanTimeBounds('我有两分半钟。')).toEqual({total:150});
  expect(assistantPlanTimeBounds('每个小步最多四十秒。')).toEqual({step:40});
  expect(assistantPlanShape('Write a 148–168 word English vocabulary plan.')).toMatchObject({englishWords:{minimum:148,maximum:168}});
});

it('requires individually timed substeps and rejects an overlong allocation', () => {
  const question='给出两项练习，每项两小步，每项不超过一分钟。';
  const shape=assistantPlanShape(question);
  expect(shape).toMatchObject({activities:2,substepsPerActivity:2,activitySecondsMaximum:60});
  const step={action:'读词表。',reason:'熟悉材料。',seconds:31,requires:[],produces:[]};
  const activity={title:'词表练习',seconds:62,steps:[step,step]};
  expect(validateAssistantPlan({inputs:[],activities:[activity,activity]},{
    shape,timed:true,userTexts:[question],lang:'zh',
  }).error).toBe('duration_limit_exceeded');
});

it('requires a blank line before a separately requested one-sentence invitation', () => {
  const contract=assistantPresentationContract('Give two reasons. Then, in a separate paragraph, write exactly one sentence inviting a friend.');
  expect(contract.localTail).toMatchObject({sentences:1,separateParagraph:true});
  expect(assistantPresentationViolation('Build recall and reduce stress. Would you like to practise?',contract)).toBe('presentation_local_sentence_scope');
  expect(assistantPresentationViolation('Build recall and reduce stress.\n\nWould you like to practise?',contract)).toBeUndefined();
});

it.each([
  ['在两张纸上写 maple 和 birch 作为正面，在背面分别写 枫树 和 桦树，做成卡片。',undefined],
  ['卡片正面写枫树和桦树，背面写 maple 和 birch。',undefined],
  ['卡片正面写 maple 和 birch 及枫树和桦树，背面留白。','plan_card_layout_missing'],
  ['卡片正面写 maple 和 birch，背面只写枫树。','plan_card_layout_missing'],
])('validates the supplied literal references on separate card faces: %s',(preparation,error)=>{
  const question='用词表 maple=枫树、birch=桦树做两项卡片练习。';
  expect(assistantPlanSemanticViolation(question,preparation+'先回忆，再翻面核对。')).toBe(error);
});

it('adds a per-card return to both rounds of a repeated check without changing allocations',()=>{
  const input={inputs:[],activities:[
    {title:'Recall',seconds:40,steps:[{action:'Read the French front, say the meaning, then flip to check.',reason:'Practise recall.',seconds:40,requires:[],produces:[]}]},
    {title:'Retry',seconds:40,steps:[{action:"Re-read each missed card's French front, say the meaning, flip to confirm, and repeat until correct.",reason:'Revisit a miss.',seconds:40,requires:[],produces:[]}]},
  ]};
  const question='Plan two vocabulary activities using my two-sided cards.';
  const result=restoreAssistantCardPromptAfterCheck(input,question,'en')!;
  expect(result.activities.map(a=>a.seconds)).toEqual([40,40]);
  expect(result.activities.map(a=>a.steps[0].seconds)).toEqual([40,40]);
  expect(result.activities.every(a=>a.steps[0].action.includes('return that card to its prompt face'))).toBe(true);
  expect(restoreAssistantCardPromptAfterCheck(result,question,'en')).toBeUndefined();
  expect(restoreAssistantCardPromptAfterCheck(input,question+' Leave the answer side up.','en')).toBeUndefined();
});

it.each([
  ['My two-sided word cards have French on the front and English meanings on the back.',undefined],
  ['I use my two-sided flashcards with a picture on the front and a phrase on the back.',undefined],
  ['I have no two-sided word cards.', 'plan_card_layout_missing'],
  ['I will make my two-sided flashcards later.', 'plan_card_layout_missing'],
])('requires preparation only when the card deck is not supplied: %s',(materials,error)=>{
  const question=materials+' Give two vocabulary activities using cards.';
  const modelReply='Read each card front, say the meaning, flip to check and reset the card.';
  expect(assistantPlanSemanticViolation(question,modelReply)).toBe(error);
});

it.each([
  ['Write maple on one face and 枫树 on the opposite face; write birch on one side and 桦树 on the other side.',undefined],
  ['在一面写 maple 和 birch，翻面写 枫树 和 桦树。', undefined],
  ['在一面写 maple 和 birch，另写 枫树 和 桦树。', 'plan_card_layout_missing'],
  ['在一面写 maple 和 birch，翻面在另一面写 枫树 和 桦树。',undefined],
  ['在一面写 maple、birch、枫树和桦树，另一面留空。','plan_card_layout_missing'],
])('verifies literal references on distinct faces: %s',(preparation,error)=>{
  const question='词表 maple=枫树、birch=桦树。请做卡片词汇练习。';
  const actions=preparation+' 逐张说出意思，再翻面核对卡片。';
  expect(assistantPlanSemanticViolation(question,actions)).toBe(error);
});

it('counts an explicit spoken attempt followed by a flip as practice inside a making activity',()=>{
  const question='词表 bay=海湾。用空白纸笔做两项卡片练习，第一项也要回忆。';
  const prepare={action:'把 bay 写在正面，海湾写在背面，做成双面卡片。',reason:'建立两面参考。',requires:[],produces:['deck']};
  const recall={action:'卡片正面朝上，逐张看单词说出中文意思，翻一次核对背面，再翻回正面。',reason:'检验记忆。',requires:['deck'],produces:[]};
  const plan={inputs:[],activities:[{title:'制作卡片并自测',steps:[prepare,recall]},{title:'单词回忆',steps:[recall]}]};
  expect(assistantPlanSemanticViolation(question,'','',plan)).toBeUndefined();
  expect(assistantPlanSemanticViolation(question,'','',{...plan,activities:[{...plan.activities[0],steps:[prepare]},plan.activities[1]]})).toBe('plan_preparation_only_activity');
});

it('recognizes recall and checking across a semicolon, without counting a future instruction as practice',()=>{
  const question='词表 bay=海湾。用空白纸笔做两项卡片练习。';
  const make={action:'把 bay 写在正面，海湾写在背面，做成词卡。',reason:'建立参考。',requires:[],produces:['cards']};
  const recall={action:'拿起卡片，词面朝上且不看背面，口头说出它的意思；翻一次核对，再翻回词面。',reason:'检验记忆。',requires:['cards'],produces:[]};
  const plan={inputs:[],activities:[{title:'制作卡片并自测',steps:[make,recall]},{title:'看词自测',steps:[recall]}]};
  expect(assistantPlanSemanticViolation(question,'','',plan)).toBeUndefined();
  const preparationOnly={...plan,activities:[{...plan.activities[0],steps:[make]},plan.activities[1]]};
  expect(assistantPlanSemanticViolation(question,'','',preparationOnly)).toBe('plan_preparation_only_activity');
});

it('credits return to a named language face in a repeated card cycle and still detects missing resets',()=>{
  const question='I have two-sided vocabulary cards. Give two recall activities.';
  const first='Place the card English-side up, say its Chinese meaning without looking, flip once to check, then return it English-side up; repeat the same cycle with the second card.';
  const second='Place the card Chinese-side up, say its English word without looking, flip once to check, then return it Chinese-side up; repeat the same cycle with the second card.';
  expect(assistantPlanSemanticViolation(question,first+'\n'+second)).toBeUndefined();
  expect(assistantPlanSemanticViolation(question,first.replace(', then return it English-side up','')+'\n'+second)).toBe('plan_card_reset_missing');
});

it('keeps an offered known basic turn and continues rejecting obligatory unlearned moves or insertion',()=>{
  const question='我只会 U 和 F 的基本转动，不会插入。给两项慢拧练习。';
  const steps=["只做 U 或 U′ 转动，每次停下观察；全程不插入。","只做 F或者F' 转动，每次停下观察。"];
  const draft={inputs:[],activities:steps.map((action,index)=>({
    title:'慢拧 '+index,seconds:30,steps:[{action,reason:'观察位置。',seconds:30,requires:[],produces:[]}],
  }))};
  const edited=retainAssistantKnownTurnOptions(draft,question)!;
  expect(edited.activities.map(a=>a.steps[0].action)).toEqual(['只做 U 转动，每次停下观察；全程不插入。','只做 F 转动，每次停下观察。']);
  expect(assistantPlanSemanticViolation(question,'','',edited)).toBeUndefined();
  expect(assistantPlanSemanticViolation(question,"先做 U' 转动，再停下观察。")).toBe('plan_unsupplied_move_sequence');
  expect(assistantPlanSemanticViolation(question,'全程不插入；再做一个插入。')).toBe('plan_unlearned_insertion');
  expect(retainAssistantKnownTurnOptions(draft,"我只会 U、U′、F 和 F′ 的基本转动，不会插入。给两项慢拧练习。")).toBeUndefined();
});

it.each([
  ['总用时不超过一百二十秒，每项不超过四十五秒。',{total:120,activity:45}],
  ['我有两分四十五秒，每小步最多二十五秒。',{total:165,step:25}],
  ['I have two minutes and 15 seconds total. Each activity at most 50 seconds.',{total:135,activity:50}],
])('keeps the whole duration quantity with its own scope: %s',(question,bounds)=>{
  expect(assistantPlanTimeBounds(question)).toEqual(bounds);
});

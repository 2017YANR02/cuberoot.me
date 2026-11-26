import { describe, expect, it, vi } from 'vitest';
import { answerSiteQuestion } from '../src/utils/site_assistant.js';
import { assistantPlanSemanticViolation, assistantPlanShape, assistantPlanTimeBounds, completeAssistantSlowTurnSuccess, normalizeAssistantCleanCardPass, normalizeAssistantWordSheetOralRecall, normalizeAssistantWordSheetPlan, omitAssistantOptionalInsertionRepeat, validateAssistantPlan } from '../src/utils/site_assistant_plan.js';
import { modelResponse } from './fixtures/site_assistant_model.js';

const config = { key: 'fixture', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-flash' };
const slowTurnQuestion = '给三阶做两项慢拧练习，合计不超过 86 秒。每项先试着摆出自己已会的插入情形，亲眼核对边块、角块和目标槽都无误才执行一次。摆不出或不吻合时，第一项改做已会的 B2，第二项改做已会的 L′，各自做完就停止，备用支路别做插入或检查目标槽。';
const cardQuestion = '已有双面希腊语／中文卡片。给两项合计 76 秒以内的练习，每一项都先从中文面提示在纸上手写希腊语，再翻到希腊语面核对，查完当场翻回同一张卡的中文面再拿下一张。第一项如全部正确，第二项要再做一轮复位后的整套卡。';

function plan(question:string,seconds:number,actions:string[]) {
  return { inputs:[{id:'request',quote:question}], activities:actions.map((action,index)=>({
    title:['第一轮','第二轮'][index], seconds, steps:[{action,seconds,reason:'按条件完成练习。',requires:[],produces:[]}],
  })) };
}

describe('site assistant capability regressions', () => {
  it('keeps a single timed translation-sheet paragraph on a shared clock', async () => {
    const question='Write a single timed paragraph for my existing Polish–French translation sheet. Within 61 seconds say the French aloud from Polish, then say the Polish aloud from French. Cover only the response column during each attempt; after speaking, uncover and check it. Describe what to show and cover after changing direction.';
    const fetcher=vi.fn<typeof fetch>().mockImplementation(async()=>modelResponse({
      answerKind:'general',answer:'Here is a plan.\n\nSet a 61-second timer, then reset it for the second direction.\n\nBoth directions take 61 seconds each.',
    }));
    const result=await answerSiteQuestion(question,'en',config,AbortSignal.timeout(5000),fetcher);
    expect(result.answer).not.toMatch(/[\r\n]/);
    expect(result.answer.match(/61-second/g)).toHaveLength(1);
    expect(result.answer).toContain('cover only French');
    expect(result.answer).toContain('cover only Polish');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('selects the longest measured ZZ stage for a first-rewatch request', async () => {
    const fetcher = vi.fn<typeof fetch>();
    const result=await answerSiteQuestion([
      'Timer replay summary','3×3 raw time 13.600 s','STM 41 · TPS 3.59','ZZ stages (inferred by timer)',
      '- EO 2.230 s, playback through 2.230 s','- F2L 6.250 s, playback through 8.480 s',
      '- LL 5.120 s, playback through 13.600 s','',
      'Which timed stage of the selected ZZ solve should I rewatch first to save the most time? Give its endpoint and one drill relevant to that stage.',
    ].join('\n'),'en',config,AbortSignal.timeout(5000),fetcher);
    expect(result.answer).toContain('F2L stage took 6.250 s');
    expect(result.answer).toContain('8.480 s');
    expect(result.answer).toContain('Preserve edge orientation');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('accepts an implied reset of the checked column and adds a genuinely missing reset', () => {
    const question='I have a two-column Galician vocabulary sheet. Plan one activity. Say the meaning aloud and keep it hidden during each attempt, then uncover it to check.';
    const attempt='Cover the meaning column, leaving Galician words visible; read each word and say its meaning aloud, then uncover to check';
    const reset=plan(question,25,[attempt+' and cover again.']);
    expect(assistantPlanSemanticViolation(question,'','',reset)).toBeUndefined();
    const missing=plan(question,25,[attempt+'.']);
    expect(assistantPlanSemanticViolation(question,'','',missing)).toBe('plan_column_reset_missing');
    normalizeAssistantWordSheetPlan(missing,question,[question],false);
    expect(missing.activities[0].steps[0].action).toContain('check and re-cover the meaning column');
    expect(assistantPlanSemanticViolation(question,'','',missing)).toBeUndefined();
    const wrongColumn=plan(question,25,[attempt+' and cover the word column.']);
    normalizeAssistantWordSheetPlan(wrongColumn,question,[question],false);
    expect(assistantPlanSemanticViolation(question,'','',wrongColumn)).toBeDefined();
  });

  it('uses selected OLL measurements and a registered practice link without searching for public evidence', async () => {
    const question = [
      '计时器复盘摘要',
      '三阶原始用时 12.370 秒',
      'STM 50 · TPS 5.00',
      'CFOP 阶段（计时器推断）',
      '- Cross 1.720 秒, 识别 0.490 秒, 执行 1.230 秒, 8 步 (HTM), 回放截至 1.720 秒',
      '- F2L 4.800 秒, 识别 1.140 秒, 执行 3.660 秒, 26 步 (HTM), 回放截至 6.520 秒',
      '- OLL 4.090 秒, 识别 3.180 秒, 执行 0.910 秒, 7 步 (HTM), 回放截至 10.610 秒',
      '- PLL 1.760 秒, 识别 0.270 秒, 执行 1.490 秒, 9 步 (HTM), 回放截至 12.370 秒',
      '',
      '我想练的是减少识别时间。依据这局最多选一个阶段，写出它结束时的回放时间，并建议一项训练。能查到该阶段的站内训练入口时附上。',
    ].join('\n');
    const fetcher = vi.fn<typeof fetch>();
    const result = await answerSiteQuestion(question,'zh',config,AbortSignal.timeout(5000),fetcher);
    expect(result.answer).toContain('OLL 的识别用时为 3.180 秒');
    expect(result.answer).toContain('10.610 秒');
    expect(result.actions?.map(action=>action.href)).toEqual(['/alg/3x3/oll/select']);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('accepts the archived independent known-turn fallbacks on the first draft', async () => {
    const actions = ['B2','L′'].map(move=>'用自己已会的方法或已知插入的逆操作尝试摆出熟悉的插入情形；若摆出，则亲眼核对边块、角块和目标槽三者都吻合，吻合才执行一次已知插入；若摆不出或不吻合，改做一次已会的 '+move+'，做完即停，不做插入、逆摆或目标槽检查。');
    const draft = plan(slowTurnQuestion,43,actions);
    expect(assistantPlanSemanticViolation(slowTurnQuestion,'','',draft)).toBeUndefined();
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async()=>{
      const wire=await modelResponse({answerKind:'general'}).json();
      wire.choices[0].message.content=JSON.stringify({answerKind:'general',answer:'',sourceIds:[],plan:draft});
      return Response.json(wire);
    });
    const result = await answerSiteQuestion(slowTurnQuestion,'zh',config,AbortSignal.timeout(5000),fetcher);
    expect(result.answer).toContain('改做一次已会的 B2');
    expect(result.answer).toContain('改做一次已会的 L′');
    expect(fetcher).toHaveBeenCalledTimes(1);
    const invalid = plan(slowTurnQuestion,43,[actions[0].replace('不做插入、逆摆或目标槽检查','再执行一次插入'),actions[1]]);
    expect(assistantPlanSemanticViolation(slowTurnQuestion,'','',invalid)).toBe('plan_slow_turn_alternative_missing');
  });

  it('distinguishes an incomplete pass and enforces the requested reset and full-deck repeat', () => {
    const first = '把整套卡中文面朝上叠好，逐张看中文提示，在纸上手写对应的希腊语，写完翻到希腊语面核对，再当场翻回同一张卡的中文面，才拿下一张；时间不够时只做已翻到的部分，并记下是否全部正确。';
    const second = '若第一项全部正确，先把整套卡逐张翻回中文面朝上并确认复位，再做一轮整套卡：看中文面，在纸上手写希腊语，翻到希腊语面核对，立刻翻回同一张卡的中文面再拿下一张。';
    const normalized = normalizeAssistantCleanCardPass(plan(cardQuestion,38,[first,second]),cardQuestion);
    expect(normalized?.activities[0].steps[0].action).toContain('只有整套都做完且无错才算全对');
    expect(assistantPlanSemanticViolation(cardQuestion,'','',normalized)).toBeUndefined();
    expect(assistantPlanSemanticViolation(cardQuestion,'','',plan(cardQuestion,38,[first,second+'没有错卡时本项无需再做。']))).toBe('plan_clean_deck_repeat_missing');
  });

  it('keeps a shared deadline and exact activity counts across natural phrasing', () => {
    expect(assistantPlanTimeBounds('给我两个三阶慢拧活动，限 94 秒。')).toEqual({total:94});
    expect(assistantPlanTimeBounds('Write one paragraph in under 74 seconds.')).toEqual({total:73});
    expect(assistantPlanShape('Write two separate slow-turn exercises, 92 seconds total at most.')).toMatchObject({activities:2});
    expect(assistantPlanShape('我已经有双面韩语／中文卡片。给两轮练习，合计最多 82 秒。')).toMatchObject({activities:2});
    expect(assistantPlanShape('Give two activities with two separately timed steps each, in at most 96 seconds.')).toMatchObject({activities:2,substepsPerActivity:2});
  });

  it('requires separate counts and timings for the independently timed vocabulary steps in AX14', () => {
    const question='Use my existing two-column Icelandic vocabulary list. Give two activities of two independently timed steps each, with a reason per step, in 122–150 words including headings, within 106 seconds. In the first activity say the meaning aloud from the word; in the second activity handwrite the Icelandic word from the meaning. Hide the answer until after each attempt, then uncover it to check.';
    const shape=assistantPlanShape(question);
    expect(shape).toMatchObject({activities:2,substepsPerActivity:2,englishWords:{minimum:122,maximum:150}});
    const draft=plan('Use my existing two-column Icelandic vocabulary list.',53,[
      'On your existing sheet, keep the Icelandic word visible and cover its meaning. Say each meaning aloud before moving the cover.',
      'Swap the cover so the meaning is visible and the Icelandic word is hidden. Handwrite each Icelandic word from its visible meaning.',
    ]);
    const options={shape,timed:true,maximumMinutes:106/60,userTexts:[question],withoutTimer:false,lang:'en' as const};
    expect(validateAssistantPlan(draft,options).error).toBe('plan_substep_count');
    for(const [i,activity] of draft.activities.entries()){
      const step=activity.steps[0];
      step.seconds=27;
      step.reason='Keeping the answer hidden makes the attempt rely on memory.';
      activity.steps.push({...step,seconds:26,
        action:i===0?'Uncover the meaning and compare it with your spoken answer. Cover it again before attempting another word.':'Uncover the Icelandic word and compare it with what you wrote. Cover that word column again before trying another meaning.',
        reason:'Checking after the attempt shows which answers need more practice.'});
    }
    const result=validateAssistantPlan(draft,options);
    expect(result.error).toBeUndefined();
    expect(result.answer?.match(/^  - 27 seconds:/gm)).toHaveLength(2);
    expect(result.answer?.match(/^  - 26 seconds:/gm)).toHaveLength(2);
    const invalid=structuredClone(draft);
    invalid.activities[0].steps[1].seconds=27;
    expect(validateAssistantPlan(invalid,options).error).toBe('plan_duration_mismatch');
  });

  it('removes AX10 repeat advice after one insertion and retains the specified fallbacks', () => {
    const question='Give me two independent slow-turn drills in at most 94 seconds combined. In each, try a familiar insertion setup, visibly confirm the edge, corner and destination slot, and only insert once if all three match. If setup is not possible or the visual check fails, use D2 for the first fallback and F prime for the second, then stop without inserting or checking the slot again.';
    const advice='perform the familiar insertion once (if you repeat it, reset and check again first)';
    expect(omitAssistantOptionalInsertionRepeat(advice,question)).toBe('perform the familiar insertion once');
    expect(omitAssistantOptionalInsertionRepeat(advice,'Practise a familiar insertion.')).toBe(advice);
    const actions=['D2',"F'"].map(move=>'Try to set up a familiar case. Visually check the edge, corner and target slot. Only if all three match, perform the insertion once. If setup is impossible or the check fails, do '+move+' and stop without insertion, inverse setup or a slot check.');
    expect(assistantPlanSemanticViolation(question,'','',plan(question,47,actions))).toBeUndefined();
    actions[0]=actions[0].replace('perform the insertion once','perform the insertion twice');
    expect(assistantPlanSemanticViolation(question,'','',plan(question,47,actions))).toBe('plan_insertion_repeat');
  });

  it('treats 先确认再插入 as ordered actions and still rejects an actual second insertion', () => {
    const question='给两个三阶慢拧活动，合计不超过 88 秒。每项先尝试摆位，亲眼核对棱块、角块和目标槽，只插入一次。摆不出或不吻合时，分别改做已会的 U2 和 R′。';
    const make=(move:string)=>'先尝试用你已会的方法或已知插入的逆操作，把当前魔方摆成你熟悉的棱角配对与目标槽情形；随后用眼睛核对棱块、角块和目标槽，只有三者都吻合，才按你已知的插入原样做一次并结束。理由：先确认再插入，避免盲目转动。若摆位不可能或核对不吻合，改做已会的 '+move+'，观察变化后停。不做插入、不检查槽位。';
    const good='1. 活动一（40秒）：'+make('U2')+'\n2. 活动二（40秒）：'+make('R′');
    expect(assistantPlanSemanticViolation(question,good)).toBeUndefined();
    expect(assistantPlanSemanticViolation(question,good.replace('按你已知的插入原样做一次并结束','做一次熟悉的插入，再插入一次'))).toBe('plan_insertion_repeat');
  });

  it('accepts a separate named fallback without counting prohibited operations as positive actions', () => {
    const question='Write two separate slow-turn exercises, 92 seconds total at most. In each, try to set up a familiar insertion and visually check the edge, the corner and the target slot before performing it once. If setup fails or the pieces do not match the slot, use L2 for the first fallback and R prime for the second, then stop, with no insertion or slot check in either fallback.';
    const actions=['L2',"R'"].map(move=>'Try to set up a familiar case. Visually check the edge, the corner and the target slot. Only if all three match, perform the insertion once. If setup fails or they do not match, do '+move+', then stop with no insertion, inverse setup or slot check.');
    expect(assistantPlanSemanticViolation(question,'','',plan(question,46,actions))).toBeUndefined();
    expect(assistantPlanSemanticViolation(question,'','',plan(question,46,[actions[0].replace('L2','F2'),actions[1]]))).toBe('plan_slow_turn_alternative_missing');
  });

  it('honors ordered English substitute moves, including spoken prime notation', () => {
    const question='For two slow-turn drills, keep the total within 93 seconds. In each, recreate a familiar case and visually verify the edge, corner and destination slot. If setup is impossible or the check fails, substitute D prime in drill one and B2 in drill two, with no insertion or slot check in that branch.';
    const action=(move:string)=>'Try to set up a familiar case. Visually check the edge, corner and target slot. Only if all three match, perform the familiar insertion once. If the setup is impossible or the check fails, do one '+move+' on the current cube and stop without insertion, inverse setup or slot check.';
    expect(assistantPlanSemanticViolation(question,'','',plan(question,46,[action('D prime'),action('B2')]))).toBeUndefined();
    expect(assistantPlanSemanticViolation(question,'','',plan(question,46,[action('B2'),action('D prime')]))).toBe('plan_slow_turn_alternative_missing');
    expect(assistantPlanSemanticViolation(question,'','',plan(question,46,[action('D'),action('B2')]))).toBe('plan_slow_turn_alternative_missing');
    expect(assistantPlanSemanticViolation(question,'','',plan(question,46,[action('known slow turns'),action('B2')]))).toBe('plan_slow_turn_alternative_missing');
  });

  it('keeps a visual mismatch in the condition separate from the fallback action and later success', () => {
    const question='给我两个三阶慢拧训练，总共不超过 83 秒。每项先试着摆位，亲眼核对棱块、角块和目标槽，三处都对上后再做一次已会的插入。若摆不出或核对不通过，第一项改做我会的 F2。第二项改做我会的 D′。备用动作做完就停，不插入也不核对槽位。';
    const action=(move:string)=>'用你已会的方法或已知插入的逆动作尝试把棱块、角块和目标槽摆成熟悉的插入情形；若摆不出或摆好后亲眼核对棱块、角块、目标槽三处未全部对上，就做一次 '+move+' 并停住观察，做完即停，不插入也不核对槽位；若三处全部对上，只做一次已会的插入后结束。';
    const good=[action('F2'),action('D′')];
    expect(assistantPlanSemanticViolation(question,'','',plan(question,41,good))).toBeUndefined();
    const failureFirst=good.map(text=>text.replace('摆不出或摆好后亲眼核对','摆不出，或者摆好后目视发现'));
    expect(assistantPlanSemanticViolation(question,'','',plan(question,41,failureFirst))).toBeUndefined();
    const explicitMatch=failureFirst.map(text=>text.replace('三处未全部对上','没有全部对上').replace('若三处全部对上，只做','只有棱块、角块、目标槽三处都确认相符，才做'));
    expect(assistantPlanSemanticViolation(question,'','',plan(question,41,explicitMatch))).toBeUndefined();
    const sequentialCheck=(move:string)=>'用已会的插入法或其逆序尝试摆出熟悉的插入情形；摆好后依次看边块、角块和目标槽：若三者都相符，就做一次熟悉的插入并结束；若摆不成或核对不符，就做一次 '+move+' 并停住观察，做完即停，不插入也不核对槽位。';
    const checked=[sequentialCheck('F2'),sequentialCheck('D′')];
    expect(assistantPlanSemanticViolation(question,'','',plan(question,41,checked))).toBeUndefined();
    expect(assistantPlanSemanticViolation(question,'','',plan(question,41,[checked[0].replace('边块、角块和目标槽','边块、角块'),checked[1]]))).toBe('plan_fallback_branch_missing');
    const unchecked=good[0].replace('亲眼核对棱块、角块、目标槽三处未全部对上','不确定是否对上');
    expect(assistantPlanSemanticViolation(question,'','',plan(question,41,[unchecked,good[1]]))).toBe('plan_fallback_branch_missing');
    const unsafe=good[0].replace('做完即停，不插入也不核对槽位','然后核对目标槽并继续插入');
    expect(assistantPlanSemanticViolation(question,'','',plan(question,41,[unsafe,good[1]]))).toBe('plan_fallback_branch_missing');
  });

  it('restores an explicitly requested visual check and conditional insertion from a fallback-only draft',()=>{
    const question='给两个三阶慢拧活动，限时 92 秒合计。我知道一种插入，每项尝试重摆那个情形，亲眼核对棱块、角块和目标槽，确认无误再插入一次。若无法摆出或核对不通过，各做一项我已经会的基本转动当备选，两个练法的观察方式不同，做完就停。请别给我具体转法、也别让备用支路检查目标槽。';
    const setup='用你已知的方法或已知插入的逆操作尝试摆出那个熟悉情形';
    const fallback='若摆不出或核对不通过，就做一次你已会的基本转动，';
    const draft=plan(question,46,[
      setup+'；'+fallback+'转后暂停观察可见变化，然后停止，不插入、不逆摆、不检查目标槽。',
      setup+'；'+fallback+'转前预测，转后对照实际观察，然后停止，不插入、不逆摆、不检查目标槽。',
    ]);
    expect(assistantPlanSemanticViolation(question,'','',draft)).toBe('plan_fallback_branch_missing');
    const completed=completeAssistantSlowTurnSuccess(draft,question,'zh');
    expect(completed?.activities.map(activity=>activity.seconds)).toEqual([46,46]);
    expect(completed?.activities[0].steps[0].action).toContain('亲眼核对棱块、角块和目标槽，只有三者都一致才做一次已会的插入');
    expect(assistantPlanSemanticViolation(question,'','',completed)).toBeUndefined();
    expect(completeAssistantSlowTurnSuccess(draft,question+'失败分支写在前面。','zh')).toBeUndefined();
    const invalid=plan(question,46,[setup+'；'+fallback+'然后执行插入并结束。']);
    expect(completeAssistantSlowTurnSuccess(invalid,question,'zh')).toBeUndefined();
  });

  it('accepts AW11 when setup is impossible or the check fails, without accepting observation alone', () => {
    const question='Write two separate slow-turn drills, no more than 98 seconds combined. Each should attempt a familiar insertion setup and visually confirm the edge, corner and target slot before doing it once. If setup fails or the check does not match, use B2 for the first fallback and U prime for the second. Stop after the fallback, with no insertion or slot check.';
    const precondition='Slowly attempt to set up the familiar insertion case using your own known method or the inverse of a known insertion, then visually check that the edge, corner and target slot all match; only if all three match, perform the familiar insertion once. If setup is impossible or the check fails, ';
    const first=precondition+'do B2 once, pause to observe the visible change, and stop with no insertion, inverse setup or solved-slot check.';
    const second=precondition+"predict the change before doing U' once, compare it with what you observe, then stop with no insertion, inverse setup or solved-slot check.";
    expect(assistantPlanSemanticViolation(question,'','',plan(question,49,[first,second]))).toBeUndefined();
    expect(assistantPlanSemanticViolation(question,'','',plan(question,49,[first,precondition+"observe what U' would change, then stop."]))).toBe('plan_slow_turn_alternative_missing');
  });

  it('restores uncover-and-check to an independent repeat without merging a separately timed check', () => {
    const question='Use my existing two-column Hungarian vocabulary list. In 118–146 words including headings, write two activities of two separately timed steps each, with a reason for each step. First say the meaning from the word, then in the second activity handwrite the Hungarian word from its meaning. Hide the answer until after each attempt.';
    const draft=plan(question,51,[
      'Keep WORD visible and cover the MEANING column; say each meaning aloud, then uncover to check.',
      'Cover the WORD column. Handwrite the Hungarian word for each visible meaning.',
    ]);
    const repeat={action:'Cover the MEANING column again; repeat the full list, prioritising weak words, or finish if none are weak.',seconds:25,reason:'Consolidates recall.',requires:[],produces:[]};
    draft.activities[0].steps.push(repeat);
    draft.activities[1].steps.push({...repeat,action:'Uncover the WORD column and check both answers.'});
    normalizeAssistantWordSheetPlan(draft,question,[question],false);
    expect(draft.activities[0].steps[1].action).toBe('Cover the MEANING column again; repeat the full list, prioritising weak words, then uncover and check.');
    expect(draft.activities[1].steps[0].action).toBe('Cover the WORD column. Handwrite the Hungarian word for each visible meaning.');
  });

  it('keeps both directions spoken only when the visitor requested oral recall for both', () => {
    const question='Give one paragraph using my Polish–French word sheet. Include both recall directions. Say the answer from the visible prompt while its column is hidden, then uncover to check.';
    const draft='Cover French, say the French answer aloud, then uncover to check. Cover Polish, write the Polish word on paper before uncovering, then check.';
    expect(normalizeAssistantWordSheetOralRecall(draft,question)).toBe('Cover French, say the French answer aloud, then uncover to check. Cover Polish, say the Polish word aloud before uncovering, then check.');
    expect(normalizeAssistantWordSheetOralRecall(draft,question+' In the second direction, write the word by hand.')).toBe(draft);
  });

  it('interprets an F2L pair in the selected report and preserves the localized ZZ stage names', async () => {
    const fetcher = vi.fn<typeof fetch>();
    const read = (method:string,rows:string) => answerSiteQuestion([
      '计时器复盘摘要','三阶原始用时 8.200 秒','STM 35 · TPS 4.27',method+' 阶段（计时器推断）',rows,'',
      '请根据以上数据指出一个最值得回放的阶段、对应的回放时间和一项针对练习。如果有合适的站内训练入口，请查找并提供。缺数据时请说明能判断到哪里。',
    ].join('\n'),'zh',config,AbortSignal.timeout(5000),fetcher);
    const cfop=await read('CFOP','- F3 3.450 秒, 识别 1.500 秒, 执行 1.950 秒, 8 步 (HTM), 回放截至 7.000 秒');
    const zz=await read('ZZ','- 左块 3.450 秒, 识别 1.500 秒, 执行 1.950 秒, 8 步 (HTM), 回放截至 7.000 秒');
    expect(cfop.answer).toContain('F3');
    expect(cfop.answer).toContain('7.000 秒');
    expect(cfop.actions?.map(action=>action.href)).toEqual(['/alg/3x3/f2l/select']);
    expect(zz.answer).toContain('左块');
    expect(fetcher).not.toHaveBeenCalled();
  });
});
it('gives a comparable retest from the selected stage and stays at the evidence boundary without splits', async () => {
  const raw = '计时器复盘摘要\n三阶原始用时 8.200 秒\n';
  const request = '\n\n哪个阶段最该练？给我练习和复测标准。';
  const timed = raw + 'CFOP 阶段 (计时器推断)\n- F3 2.000 秒, 回放截至 4.000 秒\n- PLL 1.500 秒, 回放截至 8.200 秒';
  const fetcher = vi.fn<typeof fetch>();
  const signal = AbortSignal.timeout(3000);
  const result = await answerSiteQuestion(timed + request, 'zh', null, signal, fetcher);
  expect(result.answer).toContain('F3 的阶段用时为 2.000 秒');
  expect(result.answer).toContain('练习前后各做 5 次');
  expect(result.answer).toContain('正确样本的该阶段总用时中位数');
  expect(result.actions?.[0].href).toBe('/alg/3x3/f2l/select');
  const missing = await answerSiteQuestion(raw + '没有可靠的分阶段用时。' + request, 'zh', null, signal, fetcher);
  expect(missing.answer).toContain('没有可靠的分段用时');
  expect(missing.actions).toBeUndefined();
  expect(fetcher).not.toHaveBeenCalled();
});

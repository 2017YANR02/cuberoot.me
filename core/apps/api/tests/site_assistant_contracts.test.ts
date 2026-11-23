import {afterEach,expect,it,vi} from 'vitest';
import {assistantPlanShape,assistantPlanShapeViolation,assistantPlanDurationViolation,assistantObservationOnlyPlan,assistantCubePlanGuidance,assistantPlanWordInstruction,assistantPlanPrerequisites,assistantPlanSubsetFallback,assistantPlanPieceFacts,assistantPlanSemanticViolation} from '../src/utils/site_assistant_memory.js';
import {glossaryFieldAnswer,completeGlossaryExpansionCitations,glossaryDefinitionScopeViolation,runDataTool} from '../src/utils/site_assistant_tools.js';
import {answerSiteQuestion,requestedAssistantEvidence} from '../src/utils/site_assistant.js';
import {modelResponse} from './fixtures/site_assistant_model.js';
afterEach(()=>vi.unstubAllEnvs());
it('selects compatible observation modes without inferring hidden or solved states',()=>{
  expect(assistantCubePlanGuidance('我只能看见一个角块的红色贴纸，其余两色被挡住，安排F2L练习。')).toContain('Do NOT search for a partner');
  expect(assistantCubePlanGuidance('Plan F2L observation; do not guess hidden colours.')).toContain('starting arrangement is unspecified');
  expect(assistantCubePlanGuidance('沿用F2L限制。','只做慢拧和观察，最多12分钟。')).toContain('ACTUAL resulting state');
  expect(assistantCubePlanGuidance('今天允许慢拧，请安排两项慢拧练习。','F2L只观察，不转动魔方。')).toContain('Both activities must actually turn');
  expect(assistantCubePlanGuidance('沿用F2L限制。','只观察，不转动魔方，最多6分钟。')).toContain('cube stays untouched');
  expect(assistantCubePlanGuidance('For F2L, with blue as the cross colour, a blue-red-white corner and red-white edge are visible.')).toContain('current positions are UNKNOWN');
  expect(assistantCubePlanGuidance('Inspect F2L-solved diagrams.')).toContain('REGARDLESS of edges');
  expect(assistantCubePlanGuidance('Plan vocabulary practice.')).toBeUndefined();
});
it.each([
  ['安排不转动魔方的静态练习。','在已复原的魔方上找一个角块。',undefined,'plan_start_state_assumption'],
  ['安排练习。','在已复原的魔方上找一个角块。','只观察，不转动魔方。','plan_start_state_assumption'],
  ['安排已复原魔方的静态练习。','在已复原的魔方上找一个角块。',undefined,undefined],
  ['安排不转动魔方的静态练习。','如果在已复原的魔方上，则观察对齐的颜色。',undefined,undefined],
])('checks invented starting states without rejecting supplied/conditional states',(q,a,history,expected)=>expect(assistantPlanSemanticViolation(q,a,history)).toBe(expected));
it('recognizes vocabulary revision activities and a reason between child count and under each',()=>{
  const shape=assistantPlanShape('Plan two vocabulary revision activities with two timed substeps and a reason under each activity.');
  expect(shape).toEqual({activities:2,substepsPerActivity:2});
  expect(assistantPlanShapeViolation('1. Recall: 1 min read; 1 min check.\n2. Review: 1 min say; 1 min write.',shape!)).toBe('plan_substep_count');
});
it('gives quantified word repair instead of repeating the same vague instruction',()=>{
  const shape=assistantPlanShape('Plan two activities with two timed substeps each in 180–230 words.');
  const instruction=assistantPlanWordInstruction(shape,Array(176).fill('word').join(' '));
  expect(instruction).toContain('ADD about 29 words');
  expect(instruction).toContain('INCLUDING headings');
  expect(assistantPlanWordInstruction(assistantPlanShape('Plan two activities.'))).toBe('');
});
it('edits a length failure using measured feedback without copying earlier assistant prose',async()=>{
  const q='Plan two vocabulary activities in English, 40–60 words, at most 4 minutes total.';
  const bad='1. Recall (2 minutes): Read.\n2. Review (2 minutes): Check.';
  const good='1. Recall (2 minutes): Read the complete word list once, then cover it and say each meaning aloud; retrieving meanings makes the review active.\n2. Review (2 minutes): Uncover the same list and compare your recalled meanings with the written definitions, then say every corrected meaning aloud to consolidate accurate recall.';
  const fetcher=vi.fn<typeof fetch>().mockResolvedValueOnce(modelResponse({answerKind:'general',answer:bad,sourceIds:[]})).mockResolvedValueOnce(modelResponse({answerKind:'general',answer:good,sourceIds:[]}));
  const result=await answerSiteQuestion(q,'en',{key:'fixture',baseUrl:'https://api.deepseek.com/v1',model:'deepseek-flash'},AbortSignal.timeout(5000),fetcher,[{role:'user',content:'Use my word list.'},{role:'assistant',content:'OLD_ASSISTANT_ANCHOR'}]);
  expect(result.answer).toBe(good);expect(fetcher).toHaveBeenCalledTimes(2);
  const request=JSON.parse(String(fetcher.mock.calls[1][1]?.body));
  expect(JSON.stringify(request)).toContain('ADD about');expect(JSON.stringify(request)).toContain('rejectedWordCount');expect(JSON.stringify(request)).toContain('Edit the supplied rejectedPlan');
  expect(JSON.stringify(request)).not.toContain('OLD_ASSISTANT_ANCHOR');expect(request.thinking).toEqual({type:'disabled'});
});
it('retains schema rejection and uses a fast JSON repair for a bounded plan',async()=>{
  const answer='1. Recall (2 minutes): Read the full list.\n2. Review (2 minutes): Check the full list.';
  const missingSources=await modelResponse({answerKind:'general',answer}).json();
  missingSources.choices[0].message.content=JSON.stringify({answerKind:'grounded',answer});
  const fetcher=vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json(missingSources)).mockResolvedValueOnce(modelResponse({answerKind:'general',answer,sourceIds:[]}));
  const result=await answerSiteQuestion('Plan two vocabulary activities, at most 4 minutes total.','en',{key:'fixture',baseUrl:'https://api.deepseek.com/v1',model:'deepseek-flash'},AbortSignal.timeout(5000),fetcher);
  expect(result.answer).toBe(answer);expect(fetcher).toHaveBeenCalledTimes(2);
  const repair=JSON.parse(String(fetcher.mock.calls[1][1]?.body));expect(repair.thinking).toEqual({type:'disabled'});expect(JSON.stringify(repair)).toContain('sourceIds: invalid_type');
});
it.each([
  ['Plan vocabulary revision.','Pick five words from the shaky pile.','plan_subset_availability'],
  ['安排单词复习。','从圈出的错词中挑5个造句。','plan_subset_availability'],
  ['安排单词复习。','从红圈词中任选5个造句。','plan_subset_availability'],
  ['安排单词复习。','只看红圈词，逐个朗读。','plan_subset_availability'],
  ['Plan vocabulary revision.','Quiz only the ticked words.','plan_subset_availability'],
  ['Plan vocabulary revision.','Quiz only the ticked words; if none, use the original list.',undefined],
  ['Plan vocabulary revision.','Pick five shaky words; if fewer are available, top up from the original list.',undefined],
  ['I have six missed words. Plan vocabulary revision.','Pick five of the missed words.',undefined],
  ['I have two missed words. Plan vocabulary revision.','Pick five of the missed words.','plan_subset_availability'],
  ['安排单词复习。','用5分钟复习错词。',undefined],
  ['Plan checks on F2L-solved OLL diagrams.','Name corner states: all oriented, one twisted, two twisted.','plan_illegal_orientation_example'],
  ['Plan checks on F2L-solved OLL diagrams.','A single twisted corner is impossible; flag that diagram as invalid.',undefined],
  ['Plan checks on F2L-solved OLL diagrams.','Sort diagrams with at least one twisted corner; check all four twists sum to zero modulo three.',undefined],
  ['Plan checks on F2L-solved OLL diagrams.','Sort diagrams with at least one twisted corner. A has exactly one twisted corner.','plan_illegal_orientation_example'],
  ['Plan checks on F2L-solved OLL diagrams.','A has exactly one twisted corner. This pattern is impossible.',undefined],
  ['Plan checks on F2L-solved OLL diagrams.','1. Inspect one twisted corner\n  - Read the diagram.\n  - This orientation is illegal.',undefined],
  ['Plan checks on an unsolved cube.','One twisted corner in the last layer.',undefined],
])('checks unavailable selections and illegal examples without rejecting valid conditions: %s',(q,a,expected)=>expect(assistantPlanSemanticViolation(q,a)).toBe(expected));
it.each([
  ['Plan two observation-only checks on F2L-solved OLL diagrams, at most 4 minutes total.','1. Inspect (2 minutes): Name states: one twisted corner, two twisted corners.\n2. Recall (2 minutes): Check the diagrams.','1. Inspect (2 minutes): Read visible orientation on the supplied diagrams.\n2. Recall (2 minutes): Recheck the same diagrams.','plan_illegal_orientation_example'],
])('repairs the semantic defect through the bounded fast plan path: %s',async(q,bad,good,reason)=>{
  const fetcher=vi.fn<typeof fetch>().mockResolvedValueOnce(modelResponse({answerKind:'general',answer:bad,sourceIds:[]})).mockResolvedValueOnce(modelResponse({answerKind:'general',answer:good,sourceIds:[]}));
  const result=await answerSiteQuestion(q,'en',{key:'fixture',baseUrl:'https://api.deepseek.com/v1',model:'deepseek-flash'},AbortSignal.timeout(5000),fetcher);
  expect(result.answer).toBe(good);expect(fetcher).toHaveBeenCalledTimes(2);
  const request=JSON.parse(String(fetcher.mock.calls[1][1]?.body));expect(request.thinking).toEqual({type:'disabled'});expect(JSON.stringify(request)).toContain(reason);
});
it('adds a zero-subset fallback once without a model repair or extra timed step',async()=>{
  const q='Plan two vocabulary activities, at most 4 minutes total, with two timed substeps each.';
  const draft='1. Recall (2 minutes)\n  - 1 minute: Mark weak words.\n  - 1 minute: Quiz only the marked words.\n2. Review (2 minutes)\n  - 1 minute: Say the missed words.\n  - 1 minute: Check the same words.';
  const fixed=assistantPlanSubsetFallback(q,draft,'en');
  expect(assistantPlanSubsetFallback(q,fixed,'en')).toBe(fixed);
  expect(assistantPlanShapeViolation(fixed,{activities:2,substepsPerActivity:2})).toBeUndefined();
  expect(assistantPlanDurationViolation(fixed,4)).toBeUndefined();
  expect(assistantPlanSemanticViolation(q,fixed)).toBeUndefined();
  const fetcher=vi.fn<typeof fetch>().mockResolvedValue(modelResponse({answerKind:'general',answer:draft,sourceIds:[]}));
  const result=await answerSiteQuestion(q,'en',{key:'fixture',baseUrl:'https://api.deepseek.com/v1',model:'deepseek-flash'},AbortSignal.timeout(5000),fetcher);
  expect(result.answer).toBe(fixed);expect(fetcher).toHaveBeenCalledTimes(1);
  expect(assistantPlanSubsetFallback('Explain F2L',draft,'en')).toBe(draft);
  expect(assistantPlanSubsetFallback(q+' Answer in English.',draft,'zh')).toBe(fixed);
  expect(assistantPlanSubsetFallback('安排单词复习。','1. 回忆（2分钟）\n  - 1分钟：只看弱词。\n  - 1分钟：复习打了记号的词。','zh')).toContain('本计划任一步骤若没有可用错词');
  expect(assistantPlanSubsetFallback(q,draft+' If none remain in the last step, use the whole list.','en')).toContain('In any step, if this subset is empty');
});
it('does not treat an English word-count limit as vocabulary practice',()=>{
  const q='Plan two observation-only F2L activities in 180–230 words.';
  expect(assistantPlanPrerequisites(q)).toContain('Cube:');
  expect(assistantPlanPrerequisites(q)).not.toContain('Vocabulary:');
  const answer='1. Check (2 minutes): Avoid a wrong slot.';
  expect(assistantPlanSubsetFallback(q,answer,'en')).toBe(answer);
});
it('projects only supplied full identities and compares both side colours',()=>{
  const facts=assistantPlanPieceFacts('Use white as the cross colour. A white-red-green corner, white-red edge and red-green edge are visible; another white-red corner is partly hidden.');
  expect(facts?.pieces.map(p=>p.completeIdentity)).toEqual([true,true,true,false]);
  expect(facts?.pairs.map(p=>({edge:p.edge,matches:p.matches,expected:p.expectedEdgeColours}))).toEqual([
    {edge:'white-red edge',matches:false,expected:['red','green']},
    {edge:'red-green edge',matches:true,expected:['red','green']},
  ]);
  expect(assistantPlanPieceFacts('A red sticker is visible; the other two corner colours are hidden.')).toBeUndefined();
  expect(assistantPlanPieceFacts('A white-red-green corner and red-green edge are visible.')?.pairs).toEqual([]);
});
const question='请给三阶安排三项静态观察练习，总时长最多9分钟，全程不转动。每项用编号写标题和时长，下面用两个缩进的项目符号分别写子步骤的时长、具体动作和这样做的理由。';
it.each([
  [question,{activities:3,substepsPerActivity:2}],
  ['Plan two observation-only F2L activities, at most 8 minutes total. Under each one, use indented bullets for two timed substeps.',{activities:2,substepsPerActivity:2}],
  ['Plan two observation-only activities, at most 8 minutes total, with two timed substeps under each activity.',{activities:2,substepsPerActivity:2}],
  ['安排两项练习，最多6分钟。每项列出两个子练习。',{activities:2,substepsPerActivity:2}],
  ['Plan at most two activities.',undefined],
  ['请安排最多三项练习。',undefined],
  ['Give three activities in a table.',undefined],
  ['Plan two or three activities.',undefined],
])('extracts exact structure without changing a bound: %s',(text,expected)=>expect(assistantPlanShape(text)).toEqual(expected));
const good='1. 观察（3分钟）\n  - 角块（1分钟）：找配色。\n  - 棱块（2分钟）：记位置。\n2. 复盘（3分钟）\n  - 角块（1分钟）：回忆。\n    - 可选的说明，不是同级子练习\n  - 棱块（2分钟）：核对。';
it.each([
  [good,6,undefined],
  ['1. 观察（3分钟）\n  - 45秒：观察，若没有目标再找30秒。\n  - 45秒：回忆。',6,'plan_duration_mismatch'],
  ['1. 观察（3分钟）\n  - 1分30秒：观察。\n  - 90秒：回忆。',3,undefined],
  ['1. Observe (3 minutes)\n  - 1 minute 30 seconds: inspect.\n  - 1.5 minutes: recall.',3,undefined],
  ['1. Observe (180 seconds)\n  - 0:00–1:30 inspect.\n  - 1:30–3:00 recall.',3,undefined],
  ['1. Observe (150 s)\n  - 0–90 s: inspect.\n  - 90–150 seconds: recall.',2.5,undefined],
  ['1. Observe (3 minutes)\n  - 0:00–1:30 inspect.\n  - 1:00–2:30 recall.',3,'plan_duration_mismatch'],
  ['1. Observe (3 minutes)\n  - 0–90 seconds: inspect.\n  - 100–190 seconds: recall.',3,'plan_duration_mismatch'],
  ['1. Observe (2 minutes)\n  - 30 seconds: inspect.\n  - 90 seconds: recall.',1,'duration_limit_exceeded'],
  ['1. 观察（3分钟）\n  - 1–2分钟：观察。\n  - 1分钟：回忆。',3,'plan_duration_unverifiable'],
  ['1. Observe (5 minutes)\n  - 2:00 — inspect.\n  - 3:00 — recall.',5,undefined],
  ['1. Observe (5 minutes)\n  - 2:60 — inspect.\n  - 3:00 — recall.',5,'plan_duration_unverifiable'],
  ['1. Observe (5 minutes)\n  - 2:00 — inspect.\n  - 2:00 — recall.',5,'plan_duration_mismatch'],
  ['1. Observe (5 minutes)\n  - At 2:00 — inspect.\n  - 3:00 — recall.',5,'plan_duration_unverifiable'],
  ['1. Observe (3 minutes)\n  - about 90 seconds: inspect.\n  - 90 seconds: recall.',3,'plan_duration_unverifiable'],
  ['1. 观察（3分钟）\n  - 观察：每次看30秒。\n  - 90秒：回忆。',3,'plan_duration_unverifiable'],
])('checks direct child allocations without double-counting: %s',(answer,limit,expected)=>{
  expect(assistantPlanDurationViolation(answer,limit)).toBe(expected);
});
it.each([false,true])('repairs inconsistent child time once before returning an answer (%s)',async stillInvalid=>{
  const bad='1. 观察（3分钟）\n  - 45秒：看可见中心。\n  - 45秒：回忆中心颜色。\n2. 复盘（3分钟）\n  - 60秒：看可见角块。\n  - 60秒：回忆可见颜色。';
  const fetcher=vi.fn<typeof fetch>().mockResolvedValueOnce(modelResponse({answerKind:'general',answer:bad,sourceIds:[]})).mockResolvedValueOnce(modelResponse({answerKind:'general',answer:stillInvalid?bad:good,sourceIds:[]}));
  const task=answerSiteQuestion('安排两项静态观察练习，总时长最多6分钟。每项列出两个子练习及各自时长。','zh',{key:'fixture',baseUrl:'https://api.deepseek.com/v1',model:'deepseek-flash'},AbortSignal.timeout(5000),fetcher);
  if(stillInvalid)await expect(task).rejects.toMatchObject({code:'model_output_invalid'});
  else expect((await task).answer).toBe(good);
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(String(fetcher.mock.calls[1][1]?.body)).toContain('plan_duration_mismatch');
  expect(JSON.parse(String(fetcher.mock.calls[1][1]?.body)).thinking).toEqual({type:'disabled'});
});
it('accepts continuous parent and child timelines without summing endpoints as durations',async()=>{
  const answer='1. 观察（0–3分钟）\n  - 0–90秒：看可见中心。\n  - 90–180秒：回忆中心颜色。\n2. 核对（3–6分钟）\n  - 180–270秒：看可见角块。\n  - 270–360秒：回忆可见颜色。';
  const fetcher=vi.fn<typeof fetch>().mockResolvedValue(modelResponse({answerKind:'general',answer,sourceIds:[]}));
  const result=await answerSiteQuestion('安排两项静态观察练习，总时长最多6分钟。每项列出两个子练习及各自时长。','zh',{key:'fixture',baseUrl:'https://api.deepseek.com/v1',model:'deepseek-flash'},AbortSignal.timeout(5000),fetcher);
  expect(result.answer).toBe(answer);expect(fetcher).toHaveBeenCalledTimes(1);
});
it.each([
  ['请安排三项静态观察练习。','',true],
  ['Plan two F2L activities.','Observation only. Do not turn the cube.',true],
  ['今天允许慢拧，安排两项练习。','只观察，不转动魔方。',false],
  ['Plan two activities; I can turn the cube today.','observation-only',false],
  ['只允许慢拧和观察，不计时。','',false],
])('scopes static guidance without overriding permission to turn: %s',(question,source,expected)=>expect(assistantObservationOnlyPlan(question,source)).toBe(expected));
it('counts immediate children, ignores deeper detail and rejects an extra sibling',()=>{
  const shape={activities:2,substepsPerActivity:2};
  expect(assistantPlanShapeViolation(good,shape)).toBeUndefined();
  expect(assistantPlanShapeViolation(good+'\n  - 额外（1分钟）：多练。',shape)).toBe('plan_substep_count');
  expect(assistantPlanShapeViolation(good+'\n3. 加练（1分钟）',shape)).toBe('plan_activity_count');
  expect(assistantPlanShapeViolation('一段没有列表的回答',shape)).toBe('plan_structure_missing');
});
it('validates the explicitly requested English word range as well as list shape',()=>{
  const shape=assistantPlanShape('Plan two activities in 180–230 words.')!;
  expect(shape.englishWords).toEqual({minimum:180,maximum:230});
  expect(assistantPlanShapeViolation(good,shape)).toBe('plan_word_count');
});
it.each([
  ['请查站内百科，给出 OLL 的英文全称和中文含义，再核对它是否必须先完成 F2L。仅按已读词条的内容回答，不得用常识补足词条没有给出的前提；附来源。','auto'],
  ['查站内百科 OLL 的含义；计时器是否支持双人对战？','pages'],
  ['站内百科是否支持全文搜索？','pages'],
  ['查站内百科，用两句话比较 OLL 和 PLL 的含义，附来源；不添加操作步骤。','auto'],
  ['查站内百科 OLL 含义，不要操作步骤；计时器是否支持双人？','pages'],
])('does not mistake a glossary prerequisite for website behavior: %s',(question,expected)=>expect(requestedAssistantEvidence(question)).toBe(expected));
it.each([false,true])('buffers invalid list structure, repairs once, and rejects repeated violations (%s)',async stillInvalid=>{
  const bad=good+'\n  - 额外（1分钟）：多练。';
  const stream=(answer:string)=>new Response('data: '+JSON.stringify({id:'test',object:'chat.completion.chunk',created:1,model:'test',choices:[{index:0,delta:{role:'assistant',content:JSON.stringify({answerKind:'general',answer,sourceIds:[]})},finish_reason:'stop'}]})+'\n\ndata: [DONE]\n\n',{headers:{'content-type':'text/event-stream'}});
  const fetcher=vi.fn<typeof fetch>().mockResolvedValueOnce(stream(bad)).mockResolvedValueOnce(stream(stillInvalid?bad:good));
  const emit=vi.fn();const task=answerSiteQuestion('安排两项练习，每项列出两个子练习。','zh',{key:'fixture',baseUrl:'https://api.deepseek.com/v1',model:'deepseek-flash'},AbortSignal.timeout(5000),fetcher,[],undefined,emit);
  if(stillInvalid)await expect(task).rejects.toMatchObject({code:'model_output_invalid'});
  else expect((await task).answer).toBe(good);
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(JSON.parse(String(fetcher.mock.calls[1][1]?.body)).thinking).toEqual({type:'disabled'});
  expect(String(fetcher.mock.calls[1][1]?.body)).toContain('draft has');
  expect(emit.mock.calls.some(([event])=>event.type==='answer'&&event.answer?.includes('额外'))).toBe(false);
});

const data={sections:[{entries:[{id:439,headEn:'OLL (Orientation of LL)',headZh:'还原顶层色向'}, {id:348,headEn:'LL (Last Layer)',headZh:'顶层'}]}]};
const lookup='根据站内百科，OLL 的英文全称和中文含义是什么？只写一句话并附来源。';
it('closes used expansions over readable dependencies without adding unrequested claims',async()=>{
  const result=await runDataTool({tool:'glossary',query:'OLL'},'zh',async()=>data);
  const answer='OLL 是 Orientation of Last Layer。[[wiki:439]]';
  const observations=[{call:{tool:'glossary'},result}];
  const fixed=completeGlossaryExpansionCitations(answer,observations);
  expect(fixed.answer).toBe('OLL 是 Orientation of Last Layer[[wiki:348]]。[[wiki:439]]');
  expect(fixed.sourceIds).toEqual(['wiki:439','wiki:348']);
  expect(completeGlossaryExpansionCitations(fixed.answer,observations)).toEqual(fixed);
  expect(completeGlossaryExpansionCitations(answer,[{call:{tool:'glossary'},result:{...result,sources:result.sources.slice(0,1)}}]).sourceIds).toEqual([]);
  expect(completeGlossaryExpansionCitations('PLL 是顶层排列。',observations).sourceIds).toEqual([]);
});
it('returns the omitted linked source without an extra model call',async()=>{
  let models=0;
  const fetcher=vi.fn<typeof fetch>(async input=>String(input).endsWith('/wiki/terms')?Response.json(data):(models++,modelResponse({answerKind:'grounded',answer:'OLL 是 Orientation of Last Layer。[[wiki:439]]',sourceIds:['wiki:439']})));
  const result=await answerSiteQuestion(lookup,'zh',{key:'fixture',baseUrl:'https://api.deepseek.com/v1',model:'deepseek-flash'},AbortSignal.timeout(5000),fetcher,[{role:'user',content:'请核对之前的定义。'}]);
  expect(models).toBe(1);expect(result.sources.map(s=>s.id)).toEqual(['wiki:439','wiki:348']);expect(result.answer).toContain('[[wiki:348]]');
});
it('detects unread glossary comparisons while retaining requested, body-backed and independent parts',async()=>{
  const result=await runDataTool({tool:'glossary',query:'OLL'},'zh',async()=>data);
  const observations=[{call:{tool:'glossary'},result}];
  expect(glossaryDefinitionScopeViolation(lookup,'OLL 是顶层定向，而 PLL 是顶层排列。[[wiki:439]]',observations)).toBe('glossary_unread_term:PLL');
  expect(glossaryDefinitionScopeViolation(lookup,'OLL = Orientation of Last Layer（LL）。[[wiki:439]][[wiki:348]]',observations)).toBeUndefined();
  expect(glossaryDefinitionScopeViolation('比较 OLL 和 PLL 的含义。','OLL 和 PLL 不同。',observations)).toBeUndefined();
  expect(glossaryDefinitionScopeViolation(lookup+'另外写一封通知。','OLL... FYI, lunch is cancelled.',observations)).toBeUndefined();
  expect(glossaryDefinitionScopeViolation(lookup,'OLL ... PLL', [{call:{tool:'pages'},result}])).toBeUndefined();
  const backed=await runDataTool({tool:'glossary',query:'OLL'},'zh',async()=>({sections:[{entries:[{id:439,headEn:'OLL (Orientation of Last Layer)',headZh:'顶层定向',bodyEn:'OLL precedes PLL.'}]}]}));
  expect(glossaryDefinitionScopeViolation(lookup,'OLL ... PLL',[{call:{tool:'glossary'},result:backed}])).toBeUndefined();
});
it.each([false,true])('closes a heading-only correction over actual fields even when model drafts overclaim (%s)',async repeat=>{
  const bad='OLL 是 Orientation of Last Layer，中文为还原顶层色向；PLL 是顶层排列。[[wiki:439]][[wiki:348]]';
  const good='OLL 是 Orientation of Last Layer，中文为还原顶层色向。[[wiki:439]][[wiki:348]]';
  const requests:Array<Record<string,any>>=[];
  const fetcher=vi.fn<typeof fetch>(async(input,init)=>{
    if(String(input).endsWith('/wiki/terms'))return Response.json(data);
    requests.push(JSON.parse(String(init?.body)));
    return modelResponse({answerKind:'grounded',answer:requests.length===1||repeat?bad:good,sourceIds:['wiki:439','wiki:348']});
  });
  const result=await answerSiteQuestion(lookup+'纠正之前的说法。','zh',{key:'fixture',baseUrl:'https://api.deepseek.com/v1',model:'deepseek-flash'},AbortSignal.timeout(5000),fetcher);
  expect(requests).toHaveLength(1);
  expect(result.answer).toBe('OLL：Orientation of Last Layer，即“还原顶层色向”[[wiki:439]][[wiki:348]]。');
  expect(result.answer).not.toContain('PLL');
  expect(result.sources.map(s=>s.id)).toEqual(['wiki:439','wiki:348']);
});
it('renders only retrieved fields with both supporting entries, without a model call',async()=>{
  const fetcher=vi.fn<typeof fetch>(async input=>{expect(String(input)).toContain('/wiki/terms');return Response.json(data);});
  const result=await answerSiteQuestion(lookup,'zh',{key:'fixture',baseUrl:'https://model.example/v1',model:'test'},AbortSignal.timeout(3000),fetcher);
  expect(result.answer).toBe('OLL 的英文全称是 Orientation of Last Layer，中文含义为“还原顶层色向”[[wiki:439]][[wiki:348]]。');
  expect(result.sources.map(s=>s.id)).toEqual(['wiki:439','wiki:348']);expect(fetcher).toHaveBeenCalledTimes(1);
});
it.each(['另外说一下前提。','比较它和 PLL 的区别。','请用 JSON 输出。','再给一个使用场景。','额外告诉我今天日期。'])('keeps additional requests on the model path: %s',async extra=>{
  const result=await runDataTool({tool:'glossary',query:'OLL'},'zh',async()=>data);
  expect(glossaryFieldAnswer(lookup+extra,'OLL',result,'zh')).toBeUndefined();
});
it('cannot render an expansion with a missing dependency or partial evidence',async()=>{
  const result=await runDataTool({tool:'glossary',query:'OLL'},'zh',async()=>data);
  expect(glossaryFieldAnswer(lookup,'OLL',{...result,sources:result.sources.slice(0,1)},'zh')).toBeUndefined();
  expect(glossaryFieldAnswer(lookup,'OLL',{...result,evidence:{...(result.evidence as object),truncated:true}},'zh')).toBeUndefined();
});
it('preserves the model path when earlier conversation may supply additional constraints',async()=>{
  let models=0;const fetcher=vi.fn<typeof fetch>(async input=>String(input).endsWith('/wiki/terms')?Response.json(data):(models++,modelResponse({answerKind:'grounded',answer:'OLL: Orientation of Last Layer，含义为还原顶层色向。[[wiki:439]][[wiki:348]]',sourceIds:['wiki:439','wiki:348']})));
  await answerSiteQuestion(lookup,'zh',{key:'fixture',baseUrl:'https://model.example/v1',model:'test'},AbortSignal.timeout(3000),fetcher,[{role:'user',content:'请保持之前的格式。'}]);
  expect(models).toBeGreaterThan(0);
});

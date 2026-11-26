import {runDataTool,glossaryItemPreview,glossaryDefinitionExcerpt} from '../src/utils/site_assistant_tools.js';
import {glossaryWritingRequest} from '../src/utils/site_assistant_glossary_aliases.js';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {answerSiteQuestion,requestedAssistantGlossary} from '../src/utils/site_assistant.js';
import {modelResponse,wireEvidence} from './fixtures/site_assistant_model.js';

const config={key:'fixture',baseUrl:'https://model.example/v1',model:'test'};
const glossary={sections:[{entries:[
  {id:439,headEn:'OLL (Orientation of LL)',headZh:'还原顶层色向'},
  {id:348,headEn:'LL (Last Layer)',headZh:'顶层'},
]}]};
afterEach(()=>vi.unstubAllEnvs());

it.each([
  ['根据站内百科核对 OLL 的英文全称和中文含义，一句话附来源。','OLL'],
  ['Look up OLL in the site glossary. Expand every abbreviation.','OLL'],
  ['查百科说明 OLL 和 PLL；再根据计时器页面说明一个功能。','OLL PLL'],
  ['请查站内百科核对 F2L 的含义；不要沿用之前的说法。','F2L'],
  ['查百科 DNS 和 DNF 的全称。','DNS DNF'],
  ['查站内百科，分别给出 OLL 和 PLL 的全称。','OLL PLL'],
  ['查站内百科，分别用一句话给出 OLL 和 PLL 的完整英文全称及中文含义，展开所有缩写，每句都附上完整来源。','OLL PLL'],
  ['别查百科，解释 OLL。',undefined],
  ['不查百科，直接解释 OLL。',undefined],
  ["Don't consult the glossary for OLL.",undefined],
  ['If I consult the glossary for OLL, what can I find?',undefined],
  ['OLL 是什么意思？',undefined],
  ['百科页面怎么使用？',undefined],
  ['查百科中的完整短语 First Two Layers。',undefined],
])('only prefills an explicit acronym lookup: %s',(question,query)=>{
  expect(requestedAssistantGlossary(question)?.query).toBe(query);
});

it('returns the verified expansion and all its sources before model composition',async()=>{
  const fetcher=vi.fn<typeof fetch>(async input=>{
    expect(String(input)).toMatch(/\/wiki\/terms$/);
    return Response.json(glossary);
  });
  const result=await answerSiteQuestion('查站内百科核对 OLL 全称和含义。','zh',config,AbortSignal.timeout(4000),fetcher);
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(result.answer).toContain('Orientation of Last Layer');
  expect(result.sources.map(source=>source.id)).toEqual(['wiki:439','wiki:348']);
});

it('combines the required page and glossary evidence before composition without losing either obligation',async()=>{
  vi.stubEnv('SITE_ASSISTANT_KNOWLEDGE_ENABLED','0');
  const order:string[]=[];
  const fetcher=vi.fn<typeof fetch>(async(input,init)=>{
    if(String(input).endsWith('/assistant/pages.json')){order.push('pages');return Response.json({version:2,updated:'2026-11-15T00:00:00Z',pages:[{lang:'zh',href:'/timer',title:'计时器',text:'先选择练习项目，再开始计时。'}]});}
    if(String(input).endsWith('/wiki/terms')){order.push('glossary');return Response.json(glossary);}
    order.push('model');const evidence=wireEvidence(JSON.parse(String(init?.body)));
    const page=evidence.find(item=>item.tool.tool==='pages')?.data.pages[0];
    expect(page).toBeDefined();expect(evidence.some(item=>item.tool.tool==='glossary')).toBe(true);
    return modelResponse({answerKind:'site_content',answer:`OLL 是 Orientation of Last Layer（还原顶层色向）[[wiki:439]][[wiki:348]]。计时器先选择练习项目，再开始计时。[[${page.id}]]`,sourceIds:['wiki:439','wiki:348',page.id]});
  });
  const result=await answerSiteQuestion('查站内百科说明 OLL 的含义；再根据计时器页面说明操作。','zh',config,AbortSignal.timeout(5000),fetcher);
  expect(order).toEqual(['pages','glossary','model']);
  expect(result.sources).toHaveLength(3);
});

it('does not turn a verification challenge into an unverified answer',async()=>{
  const fetcher=vi.fn<typeof fetch>(async()=>new Response('',{status:403}));
  await expect(answerSiteQuestion('查百科 OLL 的含义。','zh',config,AbortSignal.timeout(3000),fetcher)).rejects.toMatchObject({code:'source_verification_required'});
  expect(fetcher).toHaveBeenCalledTimes(1);
});

const notationEntries=[
  {id:1,headEn:'(…)',headZh:'括号',bodyEn:'Brackets are for grouping moves to help you memorize.'},
  {id:3,headEn:'+2 (Plus Two Seconds)',headZh:'加2秒'},
  {id:112,headEn:'Comm (Commutator)',headZh:'换位子'},
  {id:115,headEn:'Conj (Conjugate)',headZh:'共轭子'},
  {id:324,headEn:'Karnaukh Notation',bodyEn:'Parentheses and commas are omitted.'},
  {id:503,headEn:"Prime (')",headZh:'撇号'},
  ...glossary.sections[0].entries,
];
const readNotation=(query:string,entries=notationEntries)=>runDataTool({tool:'glossary',query},'en',async()=>({sections:[{entries}]}));

it.each([
  ['parenthesis',1],['parentheses move notation',1],['parentheses brackets notation',1],
  ['round brackets',1],['小括号',1],['（ … ）',1],['()',1],['「圆括号」',1],['括号 转动记号',1],['括号 分组 转动',1],['转动序列 圆括号 分组',1],
  ['撇号',503],['′',503],["'",503],['prime marks',503],['apostrophes',503],
  ['commutators',112],['交换子',112],['［Ａ，Ｂ］',112],['[A : B]',115],['共轭',115],
  ['＋２',3],['plus two seconds',3],['Karnaukh Notation',324],
] as const)('resolves the whole notation term %s to the actual head',async(query,id)=>{
  expect((await readNotation(query)).sources.map(s=>s.id)).toEqual(['wiki:'+id]);
});
it('preserves whole templates and signed terms in a mixed lookup',async()=>{
  expect((await readNotation('[ A, B ], [A:B], +2, parentheses')).sources.map(s=>s.id)).toEqual(['wiki:112','wiki:115','wiki:3','wiki:1']);
  expect((await readNotation('OLL+PLL')).sources.some(s=>s.id==='wiki:439')).toBe(true);
});
it('keeps named systems, unrelated punctuation and absent entries out of alias matches',async()=>{
  for(const q of ['square brackets','[R,U]',"R′",'Karnaukh notation parentheses','Karnaukh 括号 分组 转动']){
    expect((await readNotation(q)).sources.map(s=>s.id)).not.toContain('wiki:1');
  }
  expect((await readNotation('parentheses',notationEntries.filter(e=>e.id!==1))).sources).toEqual([]);
  const specific={id:900,headEn:'Parentheses',headZh:'自定义同名标题'};
  expect((await readNotation('parentheses',[...notationEntries,specific])).sources.map(s=>s.id)).toEqual(['wiki:900']);
});
it('uses the verified grouping entry for the first part and preserves other lookup subjects',async()=>{
  const q='Use the CubeRoot glossary. What purpose do parentheses serve in move notation? What does OLL expand to?';
  expect(requestedAssistantGlossary(q)?.query).toBe('parentheses、OLL');
  const result=await readNotation('parentheses、OLL');
  expect(glossaryItemPreview('What purpose do parentheses serve in move notation?',result,'en')?.sources.map(s=>s.id)).toEqual(['wiki:1']);
  expect(requestedAssistantGlossary('Check the glossary for [A,B] and [A:B]. Cite both entries.')?.query).toBe('[a,b]、[a:b]');
  expect(requestedAssistantGlossary('Use the glossary. What purpose do parentheses serve in Karnaukh notation?')).toBeUndefined();
});

it.each([
  ['Search the glossary for Unknownterm.', ['deliberate','glossary']],
  ['Search the forum for “Recognition”.', ['deliberate','forum']],
  ['Search the glossary for Unknownterm and find a forum thread.', undefined],
] as const)('offers the appropriate first tool set and opens the catalog after a miss: %s',async(question,expected)=>{
  const menus:string[][]=[];
  const fetcher=vi.fn<typeof fetch>(async(input,init)=>{
    if(String(input).endsWith('/wiki/terms'))return Response.json({sections:[]});
    if(String(input).includes('/forum/search'))return Response.json({threads:[]});
    const wire=JSON.parse(String(init?.body));
    menus.push((wire.tools??[]).map((t:any)=>t.function.name).sort());
    if(menus.length===1)return modelResponse([{tool:expected?.includes('forum')?'forum':'glossary',query:'Unknownterm'}]);
    return modelResponse({answer:'The requested term could not be verified.',sourceIds:[]});
  });
  await answerSiteQuestion(question,'en',config,AbortSignal.timeout(4000),fetcher);
  if(expected)expect(menus[0]).toEqual(expected);
  else expect(menus[0]).toEqual(expect.arrayContaining(['forum','glossary','pages','person']));
  expect(menus[1]).toEqual(expect.arrayContaining(['forum','glossary','pages','person']));
  expect(menus[1]).not.toContain('analysis_query');
});

it('resolves a heading-only property question with its reason and zero model calls',async()=>{
  const fetcher=vi.fn<typeof fetch>(async input=>{
    expect(String(input)).toMatch(/\/wiki\/terms$/);
    return Response.json(glossary);
  });
  const answer=await answerSiteQuestion('只凭站内百科的 OLL 词条标题，能否判断一个公式会不会保留四条底层棱？请说明理由。','zh',config,AbortSignal.timeout(4000),fetcher);
  expect(answer.answer).toContain('没有说明所问的性质');
  expect(answer.sources.map(s=>s.id)).toEqual(['wiki:439']);
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it('normalizes a uniquely read citation before requesting a model repair',async()=>{
  const fetcher=vi.fn<typeof fetch>(async input=>{
    if(String(input).endsWith('/wiki/terms'))return Response.json({sections:[{entries:notationEntries}]});
    return modelResponse({answerKind:'grounded',answer:'Parentheses group moves to help memorization [wiki:1].',sourceIds:[]});
  });
  const answer=await answerSiteQuestion('Check the glossary for parentheses. Why are they useful?','en',config,AbortSignal.timeout(4000),fetcher);
  expect(answer.answer).toContain('[[wiki:1]]');
  expect(fetcher).toHaveBeenCalledTimes(2);
});

describe('glossary lookup with independent writing',()=>{
  const question='According to the glossary, what is a conjugate? Also rewrite “Pass me the cube” as a polite request.';
  const body="[A: B] = A B A'. A is the setup.";
  const entry={id:115,headEn:'Conj (Conjugate)',headZh:'共轭子',bodyEn:body};
  it('keeps a quoted heading or initial letter, and leaves a dependent writing request with the planner',()=>{
    const tail=' Then translate “两个魔方” into English.';
    expect(glossaryWritingRequest('From the glossary, what is A Perm?'+tail)?.term).toBe('A Perm');
    expect(glossaryWritingRequest('根据站内词典，什么是「共轭子」？'+tail)?.term).toBe('共轭子');
    expect(glossaryWritingRequest('From the glossary, what is a conjugate? Then translate its definition into English.')).toBeUndefined();
  });
  it('streams the exact sourced definition before composing the independent writing',async()=>{
    let calls=0;
    const previews:string[]=[];
    const fetcher=vi.fn<typeof fetch>(async(input,init)=>{
      if(String(input).endsWith('/wiki/terms'))return Response.json({sections:[{entries:[entry]}]});
      calls++;
      const wire=JSON.parse(String(init?.body));
      expect(wire.tools??[]).toHaveLength(0);
      expect(wire.messages.map((m:any)=>m.content).join(' ')).not.toContain(body);
      expect(wire.messages.map((m:any)=>m.content).join(' ')).toContain('Pass me the cube');
      return modelResponse({answerKind:'general',answer:'Could you please pass me the cube?',sourceIds:[]});
    });
    const result=await answerSiteQuestion(question,'en',config,AbortSignal.timeout(4000),fetcher,[],undefined,async event=>{
      if(event.type==='answer' && event.answer && !calls)previews.push(event.answer);
    });
    expect(previews).toEqual(['1. Conj (Conjugate): '+body+' [[wiki:115]]']);
    expect(result.answer).toBe(previews[0]+'\n\n2. Could you please pass me the cube?');
    expect(result.sources.map(s=>s.id)).toEqual(['wiki:115']);
    expect(calls).toBe(1);
  });
  it('follows the referenced entry when the requested heading has no definition of its own',async()=>{
    const rows={sections:[{entries:[
      {id:67,headEn:'Blindsolving',bodyEn:'See also "BLD".'},
      {id:63,headEn:'BLD (Blindfolded Solving)',bodyEn:'Solving cubes blindfolded.'},
    ]}]};
    const result=await runDataTool({tool:'glossary',query:'Blindsolving'},'en',async()=>rows);
    expect(glossaryDefinitionExcerpt('Blindsolving',result,'en')).toBeUndefined();
    let calls=0;
    const fetcher=vi.fn<typeof fetch>(async(input,init)=>{
      if(String(input).endsWith('/wiki/terms'))return Response.json(rows);
      const wire=JSON.parse(String(init?.body));
      if(++calls===1){
        expect(JSON.stringify(wire.messages)).toContain('read that heading');
        return modelResponse([{tool:'glossary',query:'BLD'}]);
      }
      expect(wireEvidence(wire).some((e:any)=>e.data.entries?.some((row:any)=>row.sourceId==='wiki:63'))).toBe(true);
      return modelResponse({answerKind:'grounded',answer:'1. Blindsolving points to BLD [[wiki:67]], solving cubes blindfolded [[wiki:63]].\n2. Please pass me the cube.',sourceIds:['wiki:67','wiki:63']});
    });
    const answer=await answerSiteQuestion(question.replace('a conjugate','Blindsolving'),'en',config,AbortSignal.timeout(4000),fetcher);
    expect(answer.answer).toContain('solving cubes blindfolded [[wiki:63]]');
    expect(answer.answer).toContain('Please pass me the cube.');
    expect(calls).toBe(2);
  });
  it('keeps full planning and declines to preview an ambiguous definition',async()=>{
    let calls=0;
    const fetcher=vi.fn<typeof fetch>(async(input,init)=>{
      if(String(input).endsWith('/wiki/terms'))return Response.json({sections:[{entries:[entry,{...entry,id:616}]}]});
      const wire=JSON.parse(String(init?.body));
      if(++calls===1)expect(wire.tools.map((t:any)=>t.function.name)).toContain('pages');
      const content=JSON.stringify({answerKind:'grounded',answer:'1. Two glossary entries match [[wiki:115]][[wiki:616]].\n2. Could you please pass me the cube?',sourceIds:['wiki:115','wiki:616']});
      return new Response('data: '+JSON.stringify({id:'test',created:1,model:'test',choices:[{index:0,delta:{content},finish_reason:'stop'}]})+'\n\ndata: [DONE]\n\n',{headers:{'Content-Type':'text/event-stream'}});
    });
    const early:string[]=[];
    const result=await answerSiteQuestion(question,'en',config,AbortSignal.timeout(4000),fetcher,[],undefined,async e=>{if(!calls && e.type==='answer' && e.answer)early.push(e.answer)});
    expect(early).toEqual([]);
    expect(result.answer).toContain('Could you please');
  });
});

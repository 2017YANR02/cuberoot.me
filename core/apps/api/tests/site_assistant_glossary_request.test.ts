import {afterEach,expect,it,vi} from 'vitest';
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

it('reads the glossary before the sole model call and retains all expansion sources',async()=>{
  const order:string[]=[];
  const fetcher=vi.fn<typeof fetch>(async(input,init)=>{
    if(String(input).endsWith('/wiki/terms')){order.push('glossary');return Response.json(glossary);}
    order.push('model');
    const evidence=wireEvidence(JSON.parse(String(init?.body)));
    expect(evidence.find(item=>item.tool.tool==='glossary')?.data.entries).toMatchObject([
      {sourceId:'wiki:439',expandedEnglish:'Orientation of Last Layer',expansionSourceIds:['wiki:439','wiki:348']},
      {sourceId:'wiki:348'},
    ]);
    return modelResponse({answerKind:'grounded',answer:'OLL 即 Orientation of Last Layer，中文是还原顶层色向。[[wiki:439]][[wiki:348]]',sourceIds:['wiki:439','wiki:348']});
  });
  const result=await answerSiteQuestion('查站内百科核对 OLL 全称和含义。','zh',config,AbortSignal.timeout(4000),fetcher);
  expect(order).toEqual(['glossary','model']);
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

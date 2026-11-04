import { describe, expect, it, vi } from 'vitest';
import { answerSiteQuestion } from '../src/utils/site_assistant.js';
import { modelResponse, wireEvidence } from './fixtures/site_assistant_model.js';

vi.mock('../src/utils/site_assistant_people.js',()=>({findAssistantPeople:vi.fn(async()=>[])}));

const config={key:'test-secret',baseUrl:'https://model.example/v1',model:'qwen3.8-flash'};

describe('assistant task and guide navigation',()=>{
  it.each([
    {question:'我想练 PLL 识别，入口在哪？',query:'PLL 识别',selected:'/recognize/pll',guide:false},
    {question:'打开 PLL 识别指南',query:'PLL 识别指南',selected:'/recognize/pll/guide',guide:true},
    {question:'I want OLL recognition practice',query:'OLL recognition',selected:'/recognize/oll',guide:false},
  ])('keeps the task distinct from its guide: $question',async({question,query,selected,guide})=>{
    let requests=0;
    let destinations:any[]=[];
    const lang=question.startsWith('I ')?'en':'zh';
    const subject=lang==='en'?'OLL recognition':'PLL 识别';
    const root=lang==='en'?'/recognize/oll':'/recognize/pll';
    const fetcher=vi.fn<typeof fetch>(async(input,init)=>{
      if(String(input).includes('/assistant/pages.json'))return Response.json({
        destinations:[{lang,href:root,title:lang==='en'?'Observation':'观察'},{lang,href:root+'/guide',title:lang==='en'?'Guide':'识别指南'}],
        pages:[{lang,href:root+'/guide',title:subject+(lang==='en'?' guide':'指南'),text:'Public instructions'}],
      });
      requests++;
      if(requests===1)return modelResponse({calls:[{tool:'navigation',kind:'training',query}]});
      const evidence=wireEvidence(JSON.parse(String(init?.body)));
      destinations=evidence.find((item:any)=>item.tool.tool==='navigation').data.destinations;
      return modelResponse({answerKind:'general',answer:'入口如下。',sourceIds:['page:'+selected]});
    });
    const result=await answerSiteQuestion(question,lang,config,AbortSignal.timeout(5000),fetcher);
    expect(destinations[0].href).toBe(selected);
    if(guide)expect(destinations[0]).toMatchObject({purpose:'guide',entryHref:root});
    else {
      expect(destinations[0]).toMatchObject({purpose:'entry',aliases:expect.arrayContaining([subject.toLowerCase()])});
      expect(destinations.some((p:any)=>p.href===root+'/guide')).toBe(false);
    }
    expect(result.actions?.map(action=>action.href)).toEqual([selected]);
    expect(requests).toBe(2);
  });
});

import {describe,it,expect,vi} from 'vitest';
import {runDataTool,toolCallSchema} from '../src/utils/site_assistant_tools.js';

describe('assistant public data adapters',()=>{
  it('shows all tied record holders, filters invalid values and uses actual freshness',async()=>{
    const row={e:'333',t:'s',v:276,l:'WR',p:'2021ZAJD03',pn:'One',c:'C2026',cn:'Comp 2026',d:'2026-01-01',a:null};
    const read=vi.fn(async()=>({updated:'2026-09-28',rows:[row,{...row,p:'2019WANY36',pn:'Two'},{...row,v:280},{...row,v:-1},{...row,t:'a',v:351}]}));
    const result=await runDataTool({tool:'records',event:'333',region:'world'},'en',read);
    const table=result.artifacts[0];
    expect(table.kind==='table' && table.rows.map(r=>r[1])).toEqual(['2.76','2.76','3.51']);
    expect(result.evidence).toMatchObject({updated:'2026-09-28'});
  });
  it('excludes past competitions from a stale upcoming index',async()=>{
    vi.useFakeTimers();vi.setSystemTime(new Date('2026-09-28T12:00:00Z'));
    try{
      const base={city:'Delhi',country:'IN',start_date:'2026-09-01'};
      const result=await runDataTool({tool:'competitions',query:'',country:'IN',upcoming:true,limit:10},'en',async()=>[{...base,id:'Past',name:'Past',end_date:'2026-09-02'},{...base,id:'Future',name:'Future',start_date:'2026-10-01',end_date:'2026-10-02'}]);
      expect(result.sources.map(s=>s.id)).toEqual(['comp:Future']);
    }finally{vi.useRealTimers();}
  });
  it('never puts an unlisted reconstruction into model evidence',async()=>{
    await expect(runDataTool({tool:'recon',id:123},'en',async()=>({visibility:'unlisted',solution:'private text'}))).rejects.toThrow('Only published');
  });
  it('allows only bounded typed tool arguments',()=>{
    expect(toolCallSchema.safeParse({tool:'rankings',limit:100000}).success).toBe(false);
    expect(toolCallSchema.safeParse({tool:'scrambles',compId:'../../.env'}).success).toBe(false);
    expect(toolCallSchema.safeParse({tool:'person',wcaId:'2012PARK03',headers:{Authorization:'x'}}).success).toBe(false);
  });
});

it('PR charts use positive strict improvements and retain the actual final average',async()=>{
  const rows=[{best:800,average:1000},{best:-1,average:0},{best:800,average:900},{best:700,average:950},{best:600,average:850}].map((r,i)=>({...r,event_id:'333',round_type_id:'f',competition_id:`C${i}`}));
  const data={profile:{person:{name:'Test'},personal_records:{333:{single:{best:600},average:{best:850}}}},results:rows,comps:rows.map((r,i)=>({id:r.competition_id,start_date:`2026-01-0${i+1}`}))};
  const result=await runDataTool({tool:'person',wcaId:'2012PARK03',event:'333',progress:true},'en',async url=>url.includes('/meta')?{lastImportedAt:'2026-09-28'}:data);
  const charts=result.artifacts.filter(a=>a.kind==='progress');
  expect(charts[0].points.map(p=>p.value)).toEqual([800,700,600]);
  expect(charts[1].points.map(p=>p.value)).toEqual([1000,900,850]);
  expect(charts[1].points.at(-1)?.label).toBe('8.50');
});

it('reads only registered statistics and preserves section scope before taking top rows',async()=>{
  const read=vi.fn(async(url:string)=>url.endsWith('/index.json')?{categories:[{stats:[{id:'example',titleEn:'Example',titleZh:'示例'}]}]}:{header:[{label:'Result'}],sections:[{title:'World',recordScope:{region:'world'},rows:[[1],[2]]},{title:'Asia',recordScope:{region:'asia'},rows:[[3],[4]]}]});
  const unknown=await runDataTool({tool:'statistics',id:'secrets',limit:10},'en',read);
  expect(read).toHaveBeenCalledTimes(1);expect(unknown.artifacts).toHaveLength(0);
  const result=await runDataTool({tool:'statistics',id:'example',tableKey:'0.2.1',limit:1},'en',read);
  expect(result.evidence).toMatchObject({selected:{scope:{region:'asia'},rows:[[3]]}});
  expect(result.artifacts[0]).toMatchObject({rows:[['3']]});
});

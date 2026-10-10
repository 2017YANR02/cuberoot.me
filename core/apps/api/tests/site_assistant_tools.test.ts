import {describe,it,expect,vi} from 'vitest';
import {runDataTool,toolCallSchema} from '../src/utils/site_assistant_tools.js';

describe('assistant public data adapters',()=>{
  it('keeps the complete requested-puzzle case-count catalog within the evidence budget',async()=>{
    const data=[...Array.from({length:80},(_,i)=>({puzzle:'2x2',setSlug:'other'+i,count:40,source:'x'.repeat(300)})),{puzzle:'3x3',setSlug:'oll',count:57,updatedAt:'2026-10-10',source:'upstream'},{puzzle:'3x3',setSlug:'pll',count:21,updatedAt:'2026-10-10',source:'upstream'}];
    const result=await runDataTool({tool:'algorithms',puzzle:'3x3'},'en',async()=>data);
    expect(result.evidence).toMatchObject({puzzle:'3x3',sets:[{setSlug:'oll',count:57},{setSlug:'pll',count:21}]});
    expect(JSON.stringify(result.evidence).length).toBeLessThan(14000);
    expect(JSON.stringify(result.evidence)).not.toContain('other79');
  });
  it('counts calendar-year participation from distinct result-bearing competitions before filtering',async()=>{
    const read=async(url:string)=>url.includes('/meta')?{lastImportedAt:'2026-10-01'}:{
      profile:{person:{name:'Ruimin Yan (颜瑞民)'},competition_count:113},
      results:[{competition_id:'Previous'},{competition_id:'A'},{competition_id:'A'},{competition_id:'B',best:-1},{competition_id:'Next'},{competition_id:'Missing'},{competition_id:'Invalid'}],
      comps:[{id:'Previous',start_date:'2025-12-31',end_date:'2026-01-01'},{id:'A',start_date:'2026-01-01'},{id:'B',start_date:'2026-12-31'},{id:'Next',start_date:'2027-01-01'},{id:'Unattended',start_date:'2026-07-01'},{id:'Invalid',start_date:'2026-02-30'}],
    };
    const result=await runDataTool({tool:'person_competitions',wcaId:'2017YANR02',from:'2026-01-01',to:'2026-12-31'},'zh',read);
    expect(result.evidence).toMatchObject({count:2,byYear:[{year:'2026',competitions:2}],unknownDateCompetitions:2,updated:'2026-10-01'});
    expect(result.artifacts[0]).toMatchObject({rows:[['2026','2']]});
    expect(result.factualSummary).toContain('以上数量可能不完整');
    const all=await runDataTool({tool:'person_competitions',wcaId:'2017YANR02'},'en',read);
    expect(all.evidence).toMatchObject({count:4,byYear:[{year:'2025',competitions:1},{year:'2026',competitions:2},{year:'2027',competitions:1}]});
    expect(toolCallSchema.safeParse({tool:'person_competitions',wcaId:'2017YANR02',from:'2026-02-30'}).success).toBe(false);
    expect(toolCallSchema.safeParse({tool:'person_competitions',wcaId:'2017YANR02',from:'2026-12-31',to:'2026-01-01'}).success).toBe(false);
  });
  it('returns a genuine zero for a year with no imported participation and complete dates',async()=>{
    const result=await runDataTool({tool:'person_competitions',wcaId:'2017YANR02',from:'2026-01-01',to:'2026-12-31'},'en',async url=>url.includes('/meta')?{}:{
      profile:{person:{name:'Ruimin Yan'}},results:[{competition_id:'Previous'}],comps:[{id:'Previous',start_date:'2025-01-01'}],
    });
    expect(result.evidence).toMatchObject({count:0,byYear:[],unknownDateCompetitions:0});
    expect(result.factualSummary).toContain('0 competitions');
  });
  it('does not describe future missing results as a completed zero-attendance year',async()=>{
    const result=await runDataTool({tool:'person_competitions',wcaId:'2017YANR02',from:'2027-01-01',to:'2027-12-31'},'en',async url=>url.includes('/meta')?{lastImportedAt:'2026-10-10'}:{profile:{person:{name:'Ruimin Yan'}},results:[],comps:[]},undefined,'2026-10-10');
    expect(result.factualSummary).toContain('Official results do not exist yet');
    expect(result.factualSummary).not.toContain('show 0 competitions');
  });
  it('retains ranking competition IDs separately from the competitor country',async()=>{
    const rows=[
      {rank:1,name:'One',wcaId:'2017WANY29',value:1271,iso2:'CN',compId:'Hefei2026',compName:'Hefei 2026',compDate:'2026-05-10'},
      {rank:2,name:'Two',wcaId:'2024LUUZ11',value:1505,iso2:'CN',compId:'VietnamChampionship2026',compName:'Vietnam Championship 2026',compDate:'2026-08-14'},
    ];
    const result=await runDataTool({tool:'rankings',event:'333bf',type:'single',country:'CN',limit:10},'en',async url=>url.includes('/meta') ? {lastImportedAt:'2026-10-01'} : {rows,total:2});
    expect(result.artifacts[0]).toMatchObject({
      links:['/wca/persons/2017WANY29','/wca/persons/2024LUUZ11'],
      cellLinks:[[null,null,null,null,null,'/wca/comp/Hefei2026',null],[null,null,null,null,null,'/wca/comp/VietnamChampionship2026',null]],
    });
  });
  it('filters an inclusive date interval before limiting, including overlapping multi-day competitions',async()=>{
    const rows=[
      {id:'Before',name:'Before',city:'City',country:'US',start_date:'2026-09-20',end_date:'2026-09-24'},
      {id:'Overlap',name:'Overlap',city:'City',country:'US',start_date:'2026-09-27',end_date:'2026-09-29'},
      {id:'Inside',name:'Inside',city:'City',country:'US',start_date:'2026-10-02',end_date:'2026-10-03'},
      {id:'After',name:'After',city:'City',country:'US',start_date:'2026-10-05',end_date:'2026-10-05'},
    ];
    const result=await runDataTool({tool:'competitions',query:'',country:'',upcoming:true,from:'2026-09-28',to:'2026-10-04',limit:20},'en',async url=>url.endsWith('/all_past_comps.json')?rows:[],undefined,'2026-10-02');
    expect(result.sources.map(s=>s.id)).toEqual(['comp:Inside','comp:Overlap']);
    expect(toolCallSchema.safeParse({tool:'competitions',from:'2026-02-30'}).success).toBe(false);
    expect(toolCallSchema.safeParse({tool:'competitions',from:'2026-10-03',to:'2026-10-01'}).success).toBe(false);
  });
  it.each(['WC2025','WC 2025','世锦赛2025','World Championship 2025'])('resolves explicit historical editions despite the upcoming default: %s',async query=>{
    const result=await runDataTool({tool:'competitions',query,country:'',upcoming:true,limit:20},'en',async url=>url.endsWith('/all_past_comps.json') ? [
      {id:'WC2025',name:"Rubik's WCA World Championship 2025",city:'Seattle',country:'US',start_date:'2025-07-03',end_date:'2025-07-06'},
    ] : []);
    expect(result.sources.map(s=>s.id)).toEqual(['comp:WC2025']);
    expect(result.artifacts[0]).toMatchObject({rows:[["Rubik's World Championship",'Seattle','US','2025-07-03~06']]});
  });
  it('groups all attended competitions by host country, deduplicates rounds and preserves missing-location limits',async()=>{
    const result=await runDataTool({tool:'person_countries',wcaId:'2017YANR02'},'en',async url=>url.includes('/meta')?{lastImportedAt:'2026-10-01'}:{
      profile:{person:{name:'Ruimin Yan (颜瑞民)',country_iso2:'CN'}},
      results:[{competition_id:'A'},{competition_id:'A'},{competition_id:'B'},{competition_id:'C'},{competition_id:'Missing'}],
      comps:[{id:'A',country_iso2:'JP'},{id:'B',country_iso2:'JP'},{id:'C',country_iso2:'US'},{id:'Unattended',country_iso2:'CN'}],
    });
    expect(result.artifacts[0]).toMatchObject({rows:[['JP','2'],['US','1']],columnKinds:['country','text']});
    expect(result.evidence).toMatchObject({updated:'2026-10-01',unknownCompetitions:1,countries:[{iso2:'JP',competitions:2},{iso2:'US',competitions:1}]});
    expect(result.factualSummary).toContain('1 competitions lack a valid host location');
  });
  it('shows all tied record holders, filters invalid values and uses actual freshness',async()=>{
    const row={e:'333',t:'s',v:276,l:'WR',p:'2021ZAJD03',pn:'One',c:'C2026',cn:'Comp 2026',d:'2026-01-01',a:null};
    const read=vi.fn(async()=>({updated:'2026-09-28',rows:[row,{...row,p:'2019WANY36',pn:'Two'},{...row,v:280},{...row,v:-1},{...row,t:'a',v:351}]}));
    const result=await runDataTool({tool:'records',event:'333',region:'world'},'en',read);
    const table=result.artifacts[0];
    expect(table.kind==='table' && table.rows.map(r=>r[1])).toEqual(['2.76','2.76','3.51']);
    expect(table).toMatchObject({cellLinks:Array.from({length:3},()=>[null,null,null,null,'/wca/comp/C2026',null])});
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
  it('resolves names from the imported public people, without a WCA HTTP lookup',async()=>{
    const read=vi.fn();
    const people=vi.fn().mockResolvedValue([{wcaId:'2017YANR02',name:'Ruimin Yan (颜瑞民)',country:'China'}]);
    const result=await runDataTool({tool:'find_person',query:'颜瑞民'},'zh',read,people);
    expect(result.sources[0]).toMatchObject({id:'person:2017YANR02',title:'颜瑞民'});
    expect(people).toHaveBeenCalledWith('颜瑞民');
    expect(read).not.toHaveBeenCalled();
  });
  it('uses the real camelCase recon fields and applies requested count and event',async()=>{
    const rows=[{id:1,person:'One',personId:'2017YANR02',event:'3x3',rawTime:6.98,official:'practice',comp:'Home'}, {id:2,event:'2x2'}, {id:3,event:'3x3'}];
    const result=await runDataTool({tool:'recons',event:'333',limit:1,value:6.98},'en',async()=>rows);
    expect(result.evidence).toMatchObject([{id:1,personId:'2017YANR02',rawTime:6.98,official:'practice'}]);
    expect(result.artifacts[0]).toMatchObject({rows:[['One','6.98','Home','']]});
    const detail=await runDataTool({tool:'recon',id:1},'en',async()=>({...rows[0],optimalScramble:"R U",solution:"R // raw"}));
    expect(detail.evidence).toMatchObject({rawTime:6.98,optimalScramble:'R U',solution:'R // raw'});
  });
  it('allows only bounded typed tool arguments',()=>{
    expect(toolCallSchema.safeParse({tool:'statistics',tableKey:'0.2.0'}).success).toBe(false);
    expect(toolCallSchema.safeParse({tool:'statistics',id:'most_frequent_results',tableKey:'0.2.0'}).success).toBe(true);
    expect(toolCallSchema.safeParse({tool:'rankings',limit:100000}).success).toBe(false);
    expect(toolCallSchema.safeParse({tool:'scrambles',compId:'../../.env'}).success).toBe(false);
    expect(toolCallSchema.safeParse({tool:'recons',compId:'2012PARK03'}).success).toBe(false);
    expect(toolCallSchema.safeParse({tool:'person',wcaId:'2012PARK03',headers:{Authorization:'x'}}).success).toBe(false);
    expect(toolCallSchema.safeParse({tool:'person',wcaId:'2012PARK03',event:'all'}).success).toBe(true);
    expect(toolCallSchema.safeParse({tool:'person',wcaId:'2012PARK03',event:'all',progress:true}).success).toBe(false);
  });
  it('keeps single-event and all-event PB evidence aligned with tables, including untimed and retired events',async()=>{
    const data={profile:{person:{name:'Test'},personal_records:{
      '333fm':{single:{best:20,world_rank:5},average:{best:2500,world_rank:6}},
      '333ft':{single:{best:3000,world_rank:9}},
      '333':{single:{best:313,world_rank:1},average:{best:500,world_rank:2}},
      '222':{single:{best:100,world_rank:3},average:{best:200,world_rank:4}},
    }}};
    const read=vi.fn(async(url:string)=>url.includes('/meta')?{lastImportedAt:'2026-10-01'}:data);
    const all=await runDataTool({tool:'person',wcaId:'2012PARK03',event:'all',progress:false},'en',read);
    expect(read).toHaveBeenCalledTimes(2);
    expect(all.evidence).toMatchObject({event:'all',personalRecords:[{event:'333'},{event:'222'},{event:'333fm'},{event:'333ft'}]});
    expect(all.artifacts[0]).toMatchObject({rows:[
      ['3×3','3.13','1','5.00','2'],['2×2','1.00','3','2.00','4'],['FMC','20','5','25.00','6'],['Feet','30.00','9','—','—'],
    ]});
    const one=await runDataTool({tool:'person',wcaId:'2012PARK03',event:'333',progress:false},'en',read);
    expect(one.evidence).toMatchObject({event:'333',personalRecords:[{event:'333'}]});
    expect(one.artifacts[0]).toMatchObject({rows:[['3×3','3.13','1','5.00','2']]});
  });
});

it('does not infer a person-level statistic from person and competition links',async()=>{
  for(const id of ['round_top3_sum','best_round','tied_podium_results','most_records_at_single_competition']) {
    const read=async(url:string)=>url.endsWith('/index.json')?{categories:[{stats:[{id,titleEn:id,titleZh:id}]}]}:{title:id,header:[{key:'person',label:'Person'},{key:'competition',label:'Competition'}],rows:[['[One](https://www.worldcubeassociation.org/persons/2017YANR02)','[Comp](https://www.worldcubeassociation.org/competitions/Comp2026)']]};
    const result=await runDataTool({tool:'statistics',id,limit:5},'en',read);
    expect(result.factualSummary?.includes('one person at one competition')).toBe(id==='most_records_at_single_competition');
    expect((result.evidence as {interpretation:string[]}).interpretation.some(text=>text.includes('PERSON at a COMPETITION'))).toBe(id==='most_records_at_single_competition');
  }
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

it('reads nested source panels and distinguishes a published empty file from no achievers',async()=>{
  const index={categories:[{stats:[{id:'nested',titleEn:'Nested',titleZh:'分层'}]}]};
  const read=vi.fn(async(url:string)=>url.endsWith('/index.json')?index:{metricPanels:[{labelEn:'Single',sourcePanels:[{labelEn:'Finals',panels:[{labelEn:'Ranking',header:[{label:'Result'}],rows:[[123]]}]}]}]});
  const result=await runDataTool({tool:'statistics',id:'nested',limit:5},'en',read);
  expect(result.evidence).toMatchObject({selected:{key:'0.0.0.3.0.1.0',rows:[[123]]}});
  const empty=await runDataTool({tool:'statistics',id:'nested',limit:5},'en',async(url)=>url.endsWith('/index.json')?index:{rows:[]});
  expect(empty.evidence).toMatchObject({availability:'published_file_has_no_rows',selected:null});
  expect(empty.artifacts).toEqual([]);
});

it('retains legacy competition cells without a heading and serializes solves instead of object Object',async()=>{
  const read=async(url:string)=>url.endsWith('/index.json')?{categories:[{stats:[{id:'legacy',titleZh:'旧表',titleEn:'Legacy'}]}]}:{header:[{key:'details',label:'Details'}],rows:[[{_type:'solves',csv:'4.11,4.20'},'[Example](https://www.worldcubeassociation.org/competitions/Example2026)']]};
  const result=await runDataTool({tool:'statistics',id:'legacy',limit:5},'en',read);
  expect(result.artifacts[0]).toMatchObject({columns:['Details','Competition'],rows:[['4.11,4.20','Example']]});
});

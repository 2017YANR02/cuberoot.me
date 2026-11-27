// Model a dated competition as actual UTC days before discarding the year.
// Only a known overlap with the visitor's initial set permits a numeric total.
type Interval = {start:number;end:number};

const dayMs=86_400_000;

function day(year:number,month:number,date:number):number|undefined {
  const time=Date.UTC(year,month-1,date);
  const checked=new Date(time);
  if(checked.getUTCFullYear()===year && checked.getUTCMonth()===month-1 && checked.getUTCDate()===date)return time;
}

function interval(text:string):Interval|undefined {
  const m=text.match(/(\d{4})年(\d{1,2})月(\d{1,2})日?(?:到|至)(?:(\d{4})年)?(\d{1,2})月(\d{1,2})日?/);
  if(!m)return;
  const start=day(+m[1],+m[2],+m[3]),end=day(+(m[4]??m[1]),+m[5],+m[6]);
  if(start!==undefined && end!==undefined && end>=start && end-start<10*dayMs)return {start,end};
}

export function distinctDatesExample(turns:readonly string[],page:{href:string;text:string}):string|undefined {
  if(page.href!=='/wca/about/most_distinct_dates_competed_on' || !page.text.includes('DISTINCT MM/DD'))return;
  const threshold=page.text.match(/HAVING attended_dates >= (\d+)/);
  const [setup,...changes]=turns.map(t=>t.normalize('NFKC').replace(/\s+/g,''));
  const initial=setup?.match(/(?:原有|已有)(\d{1,3})个不同月日[,。]不含([^。,.?]+)/);
  const first=setup && interval(setup);
  if(!threshold || !initial || !first || +initial[1]>366)return;
  let month:number|undefined;
  const absent=new Set<string>();
  for(const s of initial[2].split(/[、和及]/)){
    const m=s.match(/^(?:(\d{1,2})月)?(\d{1,2})日?$/);
    if(!m)return;
    month=m[1]?+m[1]:month;
    if(!month || day(2000,month,+m[2])===undefined)return;
    absent.add(month+'/'+Number(m[2]));
  }
  const known=new Set<string>();
  const intervals=[first];
  for(const turn of changes){
    const next=interval(turn);
    const revised=turn.match(/(?:终场|结束)日期(?:更正为|改成)(\d{1,2})月(\d{1,2})日?/);
    const removed=turn.match(/撤(?:掉|销)(\d{4})年?那站/);
    const included=turn.match(/已(?:经)?包括(\d{1,2})月(\d{1,2})日?/);
    if([!!next,!!revised,!!removed,!!included].filter(Boolean).length!==1)return;
    if(next && /再来|再加|新增/.test(turn))intervals.push(next);
    else if(revised && intervals.length===1){
      const visit=intervals[0],year=new Date(visit.start).getUTCFullYear();
      const end=day(year,+revised[1],+revised[2]);
      if(end===undefined || end<visit.start || end-visit.start>=10*dayMs)return;
      visit.end=end;
    }else if(removed){
      const choices=intervals.filter(v=>new Date(v.start).getUTCFullYear()===+removed[1]);
      if(choices.length!==1)return;
      intervals.splice(intervals.indexOf(choices[0]),1);
    }else if(included){
      const key=Number(included[1])+'/'+Number(included[2]);
      if(!absent.delete(key))return;
      known.add(key);
    }else return;
  }
  // Limit direct replies to questions about these dates, counts and threshold.
  const clauses=turns.at(-1)!.normalize('NFKC').split(/[。?!]/).filter(Boolean);
  const search=clauses.at(-1)??'';
  const remainder=search.replace(/这场|这站|现在|刚好|这两站|两站|这场比赛|以前没有的|合起来|覆盖|带来|哪几个|多少|几个|几天|是否|还够吗|算入吗|还能|能加|总计|总数|门槛|新月日|月日|天数|不同日期|贡献|变|过|离|算|还|够|差|几|吗|和|[0-9,、]/g,'');
  if(remainder || clauses.slice(0,-1).some(c=>/谁|为什么|如何|怎么|能否|是不是/.test(c)))return;
  const fresh=new Set<string>();
  for(const visit of intervals)for(let t=visit.start;t<=visit.end;t+=dayMs){
    const d=new Date(t),key=(d.getUTCMonth()+1)+'/'+d.getUTCDate();
    if(!known.has(key) && !absent.has(key))return;
    if(absent.has(key))fresh.add(key);
  }
  const count=Number(initial[1])+fresh.size,limit=Number(threshold[1]);
  if(count>366 || +initial[1]+absent.size>366)return;
  return '各场按实际起止日展开，跨年相同月日只算一次。本版新增 '+fresh.size+' 个不同月日'+
    (fresh.size?'（'+[...fresh].join('、')+'）':'')+'，总计 '+initial[1]+' + '+fresh.size+' = '+count+' 个。入榜要求至少 '+limit+
    ' 个，刚好 '+limit+' 也算。'+(count>=limit?'已达标。':'还差 '+(limit-count)+' 个不同月日。');
}

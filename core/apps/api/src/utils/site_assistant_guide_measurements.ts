// Direct replies only for closed measurements. A different unit, operation,
// or an extra question outside the supported quantities stays with the reader.
type Guide = {href:string;text:string};
const number = (s:string) => /^\d+$/.test(s) ? +s : '零一二三四五六七八九十'.indexOf(s.replace('两','二'));
const fmt = (v:number) => Number(v.toFixed(2));

function stageRates(setup:string, changes:string[]) {
  const m=setup.match(/整局(\d{1,5})步、(\d+(?:\.\d+)?)秒,前段(\d{1,5})步、(\d+(?:\.\d+)?)秒/);
  if (!m) return;
  let moves=+m[1], duration=+m[2], stage=+m[3];
  const old:number[]=[];
  for (const s of changes) {
    const clause=s.split('。')[0];
    const replace=clause.match(/前段少记了([一二两三四五六七八九\d]+)步,其实是(\d+)步$/);
    const time=clause.match(/整局用时改成(\d+(?:\.\d+)?)秒/);
    const undo=clause.match(/^撤回加到前段的([一二两三四五六七八九\d]+)步,保留新的总用时$/);
    const reset=clause.match(/发现(\d+(?:\.\d+)?)秒才是对的,把总时间恢复,另外整局总步数改成(\d+)$/);
    if (replace && stage+number(replace[1])===+replace[2]) {old.push(stage); stage=+replace[2];}
    else if (time) duration=+time[1];
    else if (undo && old.length && stage-old.at(-1)! === number(undo[1])) stage=old.pop()!;
    else if (reset && +reset[1]===+m[2]) {duration=+reset[1]; moves=+reset[2];}
    else return;
  }
  const seconds=+m[4];
  if (!(duration>seconds && seconds>0 && moves>=stage)) return;
  return '前段 '+stage+' 步、'+seconds+' 秒，'+fmt(stage/seconds)+' TPS。余段 '+(moves-stage)+' 步、'+(duration-seconds)+' 秒，'+fmt((moves-stage)/(duration-seconds))+' TPS。整局 '+moves+' 步、'+duration+' 秒，'+fmt(moves/duration)+' TPS。';
}

function timeAdvantage(setup:string, changes:string[]) {
  const players=[...setup.matchAll(/([甲乙丙丁])(\d+)步每秒(\d+(?:\.\d+)?)步、识别(\d+(?:\.\d+)?)秒/g)];
  if (players.length!==2 || players[0][1]===players[1][1]) return;
  const rows=players.map(([,name,m,s,r])=>({name,moves:+m,speed:+s,initial:+r,recognition:+r}));
  const times=()=>rows.map(r=>r.moves/r.speed+r.recognition);
  let previous=times();
  for (const turn of changes) {
    previous=times();
    const clause=turn.split('。')[0];
    const undo=clause.match(/^取消([甲乙丙丁])识别时间那步更改(?:,只保留([甲乙丙丁])降到每秒(\d+(?:\.\d+)?)步)?$/);
    if (undo) {
      const changed=rows.find(r=>r.name===undo[1]);
      if (!changed || (undo[2] && rows.find(r=>r.name===undo[2])?.speed!==+undo[3])) return;
      changed.recognition=changed.initial;
      continue;
    }
    const row=rows.find(r=>clause.startsWith(r.name) || clause.startsWith('再把'+r.name));
    if (!row) return;
    const overhead=clause.match(/识别开销更正为(\d+(?:\.\d+)?)秒(?:,其他照旧)?$/);
    const speed=clause.match(/速度纠正为每秒(\d+(?:\.\d+)?)步$/);
    if (overhead) row.recognition=+overhead[1];
    else if (speed && +speed[1]>0) row.speed=+speed[1];
    else return;
  }
  if (rows.some(r=>r.speed<=0)) return;
  const [a,b]=times(), winner=a<b?0:1, gap=Math.abs(a-b);
  const delta=fmt(gap-(previous[1-winner]-previous[winner]));
  return rows[0].name+' '+fmt(a)+' 秒，'+rows[1].name+' '+fmt(b)+' 秒。'+(a===b?'两人用时相同。':
    rows[winner].name+'快 '+fmt(gap)+' 秒，与上一版相比其领先幅度'+(delta===0?'不变':(delta>0?'扩大':'减小')+Math.abs(delta)+' 秒')+'。');
}

function badgeSetup(q:string, text:string):string|undefined {
  const streak=q.match(/我先有([一二两三四五六七八九十\d]+)轮(\d+(?:\.\d+)?),下一轮(\d+(?:\.\d+)?)。/);
  if (streak && q.includes('五秒连击') && text.includes('个正式轮次的平均低于 5 秒') &&
      /。当前连续、这段最长和五轮档分别怎样\?$/.test(q)) {
    const count=number(streak[1]), before=+streak[2]<5?count:0;
    const current=+streak[3]<5?before+1:0, longest=Math.max(before,current);
    return '末轮 '+streak[3]+' 秒'+(+streak[3]<5?'低于':'未低于')+' 5 秒。当前连续 '+current+' 轮，历史最长 '+longest+' 轮，'+(longest>=5?'达到':'未达到')+'五轮档。';
  }
  const podium=q.match(/我连续([一二两三四五六七八九十\d]+)场([二三四五六七]阶)登台,第([一二三四五六七八九十\d]+)站只比([二三四五六七]阶)拿[金银铜],第([一二三四五六七八九十\d]+)站又是([二三四五六七]阶)[金银铜]。/);
  if (podium && q.includes('领奖台常客') && text.includes('未参加该项目的比赛不计') &&
      /^([二三四五六七]阶)当前连了几场\?哪一站跳过\?$/.exec(q.split('。').at(-1)!)?.[1]===podium[2]) {
    const [,n,event,skipped,other,last,lastEvent]=podium;
    if (number(skipped)!==number(n)+1 || number(last)!==number(n)+2 || event===other || event!==lastEvent) return;
    return '第 '+number(skipped)+' 站只参加'+other+'，跳过。'+event+'当前连续 '+(number(n)+1)+' 场（前 '+number(n)+' 场加第 '+number(last)+' 站）。';
  }
  const overseas=q.match(/我代表([\p{Script=Han}]{2,6}),只在(.+?)登过台。/u);
  if (overseas && q.includes('海外奖牌收藏家') && text.includes('海外奖牌收藏家') && /合格地点几个,距(\d+)地档差几个\?$/.test(q)) {
    const locations=overseas[2].split(/、|和/).map(s=>s.match(/^([\p{Script=Han}]{2,6}?)(?:[一二两三四五六七八九]|\d+)站$/u)?.[1]);
    const tier=Number(q.match(/距(\d+)地档/)![1]);
    if(locations.includes(undefined) || !text.match(/海外奖牌收藏家\s+[^。]+/)?.[0].includes(String(tier))) return;
    const unique=[...new Set(locations.filter(s=>s!==overseas[1]))];
    return '按当前代表地排除'+overseas[1]+'，其余获奖地点去重后为'+unique.join('、')+'，共 '+unique.length+' 个，距 '+tier+' 地档差 '+Math.max(0,tier-unique.length)+' 个。';
  }
}

export function measuredGuideAnswer(turns:readonly string[], guide:Guide):string|undefined {
  const [setup,...changes]=turns.map(s=>s.normalize('NFKC').replace(/\s/g,''));
  if (!setup) return;
  if (guide.href==='/wca/achievements' && !changes.length) return badgeSetup(setup,guide.text);
  const ask=changes.at(-1)?.split('。').slice(1).join('');
  if (!ask) return;
  if (guide.href==='/recon-about' && guide.text.includes('总时间与步数可以算整体 TPS') &&
      !ask.replace(/前段|余段|整局|各段|时间照旧|三个|怎样更新|都|是|多少|各|几|步|秒|和|TPS|[?、,]/gi,'')) return stageRates(setup,changes);
  if (guide.href==='/wca/prediction-about' && guide.text.includes('步数 ÷ 手速 + 识别等额外时间') &&
      !ask.replace(/哪一边|谁|更快|优势|扩大了|多少|秒|[?,]/g,'')) return timeAdvantage(setup,changes);
}

export function medalGuideAnswer(turns:readonly string[], guide:Guide):string|undefined {
  if (guide.href!=='/wca/achievements' || turns.length<2) return;
  const [setup,...changes]=turns.map(s=>s.normalize('NFKC').replace(/\s/g,''));
  const ask=changes.at(-1)!.split('。').slice(1).join('');
  if (!ask) return;
  if (/冠军拼图/.test(setup) && /领奖台拼图/.test(setup) && guide.text.includes('曾在至少 5／10／全部 17 个现行项目夺冠')) {
    const m=setup.match(/^((?:[二三四五六七]阶、)*[二三四五六七]阶)我都拿过金,另在同样.{1,3}各拿一次铜。/);
    if (!m || ask.replace(/更新|两个计数|[二三四五六七]阶这枚|有新增贡献吗|[?,]/g,'')) return;
    const gold=new Set(m[1].split('、')), medals=new Set(gold);
    let repeated='';
    for (const s of changes) {
      const clause=s.split('。')[0];
      const add=clause.match(/^补一个从没拿过奖的([二三四五六七]阶)银牌$/);
      const revise=clause.match(/^刚才([二三四五六七]阶)从银改成金;同场又加一个([二三四五六七]阶)金$/);
      if (add && !medals.has(add[1])) medals.add(add[1]);
      else if (revise && medals.has(revise[1]) && !gold.has(revise[1])) {
        gold.add(revise[1]);
        if (gold.has(revise[2])) repeated=revise[2];
        gold.add(revise[2]); medals.add(revise[2]);
      } else return;
    }
    return '冠军拼图 '+gold.size+' 项，领奖台拼图 '+medals.size+' 项。'+(repeated?repeated+'此前已经夺冠并登台，这枚金牌不增加不同项目数。':'');
  }
  if (setup.startsWith('海外奖牌收藏家') && guide.text.includes('海外奖牌收藏家')) {
    const original=setup.match(/我代表([\p{Script=Han}]{2,6}),只在(.+?)登过台。/u);
    if (!original || ask.replace(/哪些|奖牌地点|现在|算海外|数量|与改前比|变没变|[?,、]/g,'')) return;
    const names=original[2].split(/、|和/).map(s=>s.match(/^([\p{Script=Han}]{2,6}?)(?:[一二两三四五六七八九]|\d+)站$/u)?.[1]);
    if (names.includes(undefined)) return;
    let home=original[1];
    const sites=new Set(names as string[]);
    const eligible=()=>[...sites].filter(s=>s!==home);
    let before=eligible();
    for (const edit of changes) {
      before=eligible();
      const clause=edit.split('。')[0];
      const add=clause.match(/^又在([\p{Script=Han}]{2,6})登台一次;[\p{Script=Han}]{2,6}另去第[一二三四五六七八九\d]+站但没上台$/u);
      const move=clause.match(/^代表地改成([\p{Script=Han}]{2,6}),原先各地成绩都保留$/u);
      if (add) sites.add(add[1]);
      else if (move) home=move[1];
      else return;
    }
    const now=eligible();
    return '当前代表'+home+'，海外奖牌地点为'+now.join('、')+'，共 '+now.length+' 个。改前 '+before.length+' 个，'+(now.length===before.length?'数量不变':'数量变化 '+(now.length-before.length)+' 个')+'。';
  }
}

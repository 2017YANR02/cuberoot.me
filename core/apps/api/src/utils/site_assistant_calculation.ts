import {averageOfN,meanOfN} from '@cuberoot/shared/timer/stats';
import type {Solve} from '@cuberoot/shared/timer/types';

function suppliedAverage(tokens:string[],n:3|5) {
  const solves:Solve[]=tokens.map((text,i)=>({id:String(i),ts:i,event:'333',scramble:'',
    penalty:/^DNF$/i.test(text)?'DNF':/^DNS$/i.test(text)?'DNS':'ok',
    timeMs:/^DN[FS]$/i.test(text)?0:Math.round(parseFloat(text)*1000)}));
  if(solves.some(s=>s.penalty==='ok'&&(!Number.isSafeInteger(s.timeMs)||s.timeMs<=0||s.timeMs>86_400_000)))return;
  return n===5?averageOfN(solves,n):meanOfN(solves,n);
}

/** Four completed solves and a target trimmed mean, all measured in hundredths. */
function lastAo5Limit(question:string,lang:'zh'|'en') {
  const seconds=String.raw`(\d{1,4}(?:\.\d{1,2})?)`;
  const sep=String.raw`\s*秒?\s*[,，、和]\s*`;
  const pattern=new RegExp('^(?:我(?:要|想要)|目标(?:是)?)?(?:五把平均|Ao5(?:目标)?(?:平均)?)\\s*'+seconds+'\\s*秒[，,。]前[四4]把(?:是|为)?\\s*'+[seconds,seconds,seconds,seconds].join(sep)+'\\s*秒?[，,。]最后一把(?:最慢|最多)(?:能|可以|是)?多少(?:秒)?[？?。]?(?:按\\s*Ao5[。.]?)?$','i');
  const match=pattern.exec(question.trim());
  if(!match) return;
  const [target,...times]=match.slice(1).map(v=>Math.round(Number(v)*100));
  if(!target || target>=60_000 || times.some(v=>!v || v>=60_000)) return;
  const [a,b,c,d]=times.sort((x,y)=>x-y);
  const limit=3*target-b-c;
  const sec=(v:number)=>(v/100).toFixed(2);
  if(limit<a || limit>d) return lang==='zh'?'这个精确目标无法达到。第五把无论多快或多慢，去掉最好和最差后，平均只能在 '+sec((a+b+c)/3)+' 至 '+sec((b+c+d)/3)+' 秒之间。':'That exact target is outside the range of possible trimmed means.';
  if(limit===d) return lang==='zh'?'最后一把没有有限的最慢上限。只要不快于 '+sec(d)+' 秒，第五把会作为最慢成绩去掉，平均正好是 '+sec(target)+' 秒。':'There is no finite upper limit. At '+sec(d)+' s or slower, the last solve is dropped and the mean equals the target.';
  const display=limit+1>=d?(lang==='zh'?'没有有限上限':'unbounded'):sec(limit+1)+(lang==='zh'?' 秒':' s');
  return lang==='zh'?'按未舍入的平均，最后一把最慢为 '+sec(limit)+' 秒。中间三把需合计 '+sec(3*target)+' 秒，扣除 '+sec(b)+' 和 '+sec(c)+' 秒即可。若只要求四舍五入到百分秒后显示目标值，最慢为'+display+'。':'For the exact mean the slowest last solve is '+sec(limit)+' s. For the target rounded to hundredths, the upper limit is '+display+'.';
}
/** Only a complete, explicitly timed list and a single calculation request.
 * Unknown units, penalties, extra questions and stored-record requests stay
 * with the normal planner. Never extract incidental numbers from prose. */
export function suppliedAverageAnswer(question:string,lang:'zh'|'en'):string|undefined {
  const last=lastAo5Limit(question,lang);
  if(last) return last;
  const token=String.raw`(?:\d+(?:\.\d{1,3})?\s*(?:秒|seconds?|s)?|DNF|DNS)`;
  const list=String.raw`(${token}(?:\s*(?:[,，、]|和|及|and)\s*${token}){2,4})`;
  const replaceSlowest=new RegExp(String.raw`^(?:练习)?成绩(?:是|为)?\s*${list}\s*[,，。]\s*(?:如果|若)?只?把最慢的?(?:一把)?改成\s*(\d+(?:\.\d{1,3})?)\s*秒[,，。]\s*Ao5\s*(?:会不会变|会变吗)[,，。]\s*(?:还是|现在是|变成)几秒[？?。]?$`,'i').exec(question.trim());
  if(replaceSlowest) {
    const times=replaceSlowest[1].split(/\s*(?:[,，、]|和|及|and)\s*/i);
    if(times.length!==5 || times.some(t=>!Number.isFinite(parseFloat(t))))return;
    const before=suppliedAverage(times,5);
    const worst=Math.max(...times.map(t=>parseFloat(t)));
    times[times.findIndex(t=>parseFloat(t)===worst)]=replaceSlowest[2];
    const after=suppliedAverage(times,5);
    if(before==null || after==null)return;
    const original=(before/1000).toFixed(2),updated=(after/1000).toFixed(2);
    if(lang==='en')return 'The Ao5 '+(original===updated?'stays the same':'changes')+'. Before: '+original+' s. After: '+updated+' s. Both discard the fastest and slowest solve.';
    return (original===updated?'不会变。':'会变。')+'两组都去掉最快和最慢各一把，原 Ao5 为 '+original+' 秒，替换后为 '+updated+' 秒。';
  }
  // An explicit change to one named attempt is two independent Ao5 calculations.
  const change=new RegExp(String.raw`^(?:三阶|3x3)\s*(?:一轮)?(?:五|5)(?:把|次)(?:成绩)?(?:依次)?(?:是|为|[:：])\s*${list}[。；;，,]\s*(?:WCA\s*)?(?:平均|ao5)(?:成绩)?是多少[？?。]\s*如果把\s*(\d+(?:\.\d{1,3})?)\s*(?:秒)?\s*(?:也)?改成\s*(DNF|DNS)\s*[，,]?\s*(?:平均|ao5)(?:又)?是多少[？?。](?:请说明怎么算[。.]?)?$`,'i').exec(question.trim());
  if(change) {
    const times=change[1].split(/\s*(?:[,，、]|和|及|and)\s*/i);
    const indices=times.flatMap((value,i)=>parseFloat(value)===Number(change[2])?[i]:[]);
    if(times.length!==5 || indices.length!==1 || !/秒/.test(change[1]))return;
    const calculate=(values:string[])=>suppliedAverageAnswer('what is the ao5 of '+values.map(v=>/^DN[FS]$/i.test(v)?v:parseFloat(v)+' seconds').join(', '),lang);
    const before=calculate(times);
    const kept=times.map(t=>/^DN[FS]$/i.test(t)?Infinity:parseFloat(t)).sort((a,b)=>a-b).slice(1,-1);
    const arithmetic=kept.every(Number.isFinite)
      ? (lang==='zh'?' 本轮计算式为 ':' This round uses ')+'('+kept.map(v=>Number.isInteger(v*100)?v.toFixed(2):String(v)).join(' + ')+') ÷ 3.'
      : '';
    times[indices[0]]=change[3];
    const after=calculate(times);
    if(before && after)return before+arithmetic+'\n'+(lang==='zh'?'把 '+change[2]+' 秒改为 '+change[3]+' 后，':'After replacing '+change[2]+' s with '+change[3]+', ')+after.split(lang==='zh'?'。':'. ')[0];
    return;
  }
  const zh=new RegExp(String.raw`^(?:([五三53])次)?成绩\s*(?:是|为|[:：])\s*${list}\s*[,，;；]?\s*(?:请)?(?:计算|算一下|求)?\s*(ao5|mo3|五次平均|三次平均)\s*(?:是|为|等于)?\s*(?:多少)?[?？。]*$`,'i').exec(question.trim());
  const en=new RegExp(String.raw`^what(?:'s| is)\s+(?:the\s+)?(ao5|mo3)\s+(?:of|for)\s+${list}\s*\??$`,'i').exec(question.trim());
  if(!zh&&!en)return;
  const raw=zh?.[2]??en![2],format=/ao5|五次/i.test(zh?.[3]??en![1])?'ao5':'mo3',n=format==='ao5'?5:3;
  if(zh?.[1] && ({五:5,三:3,'5':5,'3':3} as Record<string,number>)[zh[1]]!==n)return;
  // At least one explicit seconds unit is required; bare numbers could be FMC.
  if(!/(?:秒|seconds?|s\b)/i.test(raw.replace(/DNS/gi,'')))return;
  const tokens=raw.split(/\s*(?:[,，、]|和|及|and)\s*/i);
  if(tokens.length!==n)return;
  const value=suppliedAverage(tokens,n);
  if(value==null)return;
  const result=Number.isFinite(value)?(value/1000).toFixed(value>=600_000?0:2):'DNF';
  const unit=Number.isFinite(value)?{zh:' 秒',en:' seconds'}[lang]:'';
  const method=format==='ao5'
    ? {zh:'去掉一个最好和一个最差成绩后，计算剩余三次的平均；两次及以上 DNF/DNS 则为 DNF。',en:'Discard one best and one worst result, then average the remaining three; two or more DNF/DNS results make the average DNF.'}[lang]
    : {zh:'三次全部计入平均；任意一次 DNF/DNS 都使平均为 DNF。',en:'Average all three results; any DNF/DNS makes the mean DNF.'}[lang];
  return `${format} = ${result}${unit}。${method}`.replace(/。/g,lang==='en'?'. ':'。');
}

/** Self-contained two-block arithmetic means, with an explicit overall target.
 * Parse the entire question so extra goals, rounded input, and other average
 * conventions still reach the planner. Work in integer centiseconds. */
export function suppliedTargetMean(question:string,lang:'zh'|'en'):string|undefined {
  const text=question.replace(/\s/g,'');
  const count=String.raw`([1-9]\d{0,4})`;
  const seconds=String.raw`(\d{1,4}(?:\.\d{1,2})?)秒`;
  const block=count+'(?:把|次)(?:的)?(?:算术)?(?:平均|均值)(?:用时|成绩)?(?:是|为)?'+seconds;
  const sequence=new RegExp('^(?:训练记录分成两组[。；;])?(?:我)?前'+block+'[，,；;]后'+block+'[。；;，,]');
  const groups=sequence.exec(text);
  if(!groups)return;
  const combined=new RegExp('^(?:前'+count+'(?:把|次))?(?:合起来|合并|合在一起)(?:的)?(?:算术)?(?:平均|均值)(?:是|为)?多少[？?，,。]');
  const ask=combined.exec(text.slice(groups[0].length));
  if(!ask)return;
  const target=new RegExp('^(?:想|要)?让(?:全部|总共|总计|一共)?'+count+'(?:把|次)(?:的)?(?:算术)?(?:平均|均值)(?:恰好|正好)?(?:是|为)?'+seconds+'[，,]'+
    '(?:接下来|最后|剩下)(?:的)?'+count+'(?:把|次)(?:该|要)?(?:的)?(?:平均|均值)(?:该|需|要)?多少[？?。]?(?:(?:请)?(?:写出|给我|列出)算式[。.]?)?$');
  const goal=target.exec(text.slice(groups[0].length+ask[0].length));
  if(!goal)return;
  const n=Number(groups[1]),m=Number(groups[3]),total=Number(goal[1]),remaining=Number(goal[3]);
  if ((ask[1] && Number(ask[1])!==n+m) || total!==n+m+remaining)return;
  const cents=(value:string)=>Math.round(Number(value)*100);
  const a=cents(groups[2]),b=cents(groups[4]),desired=cents(goal[2]);
  if(!a || !b || !desired)return;
  const used=n*a+m*b, needed=total*desired-used;
  const value=(amount:number)=>(amount/100).toFixed(2);
  const mean=(sum:number,size:number)=>(sum%size?' ≈ ':' = ')+value(sum/size);
  const first='('+n+' × '+groups[2]+' + '+m+' × '+groups[4]+') ÷ '+(n+m)+mean(used,n+m);
  const unit=lang==='zh'?' 秒':' s';
  if(needed<=0)return first+unit+'\n\n'+(lang==='zh'?'已用时间达到或超过目标总用时，剩余每次用时为正，无法达到目标平均。':'The time already used reaches or exceeds the target total, so positive remaining times cannot meet it.');
  return first+unit+'\n\n('+total+' × '+goal[2]+' − '+value(used)+') ÷ '+remaining+mean(needed,remaining)+unit;
}

type TrainingGroup = { label: string; successes: number; trials: number };

function trainingGroup(text: string): TrainingGroup | undefined {
  const zh = /^([A-Z甲乙丙丁])\s*组\s*(?:(?:共|完成|尝试|做了|共做了)\s*)?(\d{1,7})\s*(?:次|把)\s*[,、]?\s*(?:其中)?成功\s*(\d{1,7})\s*(?:次|把)$/i.exec(text);
  const en = /^group\s+([a-z])\s*:?\s*(\d{1,7})\s+success(?:es)?\s+(?:in|out of)\s+(\d{1,7})\s+(?:attempts?|trials?)$/i.exec(text);
  if (!zh && !en) return;
  const label = (zh ?? en)![1].toUpperCase();
  const trials = Number(zh ? zh[2] : en![3]);
  const successes = Number(zh ? zh[3] : en![2]);
  if (trials > 0 && successes <= trials) return {label, trials, successes};
}

// Accept complete requests for these operations. Additional study details,
// statistical tests or presentation constraints need the regular analysis path.
const trainingOperations = {
  comparison: /^(?:(?:请)?(?:分别)?(?:算出|计算|给出|比较|列出)?(?:两组|各组|两组的|各组的)?成功率(?:和|及|与)(?:相差多少个百分点|百分点(?:差|差值))|(?:compare|calculate|give) (?:the |both )?success rates? and (?:the |their )?(?:percentage.point (?:gap|difference)|difference in percentage points))$/i,
  rates: /^(?:(?:请)?(?:分别)?(?:算出|计算|给出|列出)?(?:两组的?|各组的?)?成功率(?:分别)?(?:是多少|各是多少)?|(?:calculate|give) (?:the |both )?success rates?)$/i,
  difference: /^(?:相差多少个百分点|(?:计算|给出)?(?:两组的?)?百分点差(?:值)?|(?:what is|give) the difference in percentage points)$/i,
  causality: /^(?:(?:再)?(?:解释|说明)(?:一下)?为什么(?:这两组(?:数据)?|这些数据|这组数据|这)?(?:无法|不能)(?:证明|说明)(?:(?:训练)?方法(?:有|具有)?)?(?:因果效[果应]|因果关系)|explain why (?:these (?:groups|counts|results|data)|this) (?:cannot|can't|do not|does not) (?:establish|prove|show) (?:causality|a causal effect))$/i,
  retest: /^(?:(?:并)?(?:建议|说明|给出)?(?:如何|怎么)?(?:设计|安排|做)(?:一次|一个)?公平的?(?:复测|对照试验|对照实验)|(?:suggest|design|propose) (?:a |one )?fair retest)$/i,
};

export function suppliedTrainingComparison(question: string, lang: 'zh'|'en'): string | undefined {
  if (!/成功率|success rates?/i.test(question)) return;
  const input = question.normalize('NFKC').trim().replace(/^(?:(?:请)?比较(?:我)?这两组训练|compare (?:my |these )?two training groups)[。.:]\s*/i,'');
  const rows = input.split(/\s*[;。.?!]\s*/).filter(Boolean);
  if (rows.length < 3) return;
  const [a,b] = rows.slice(0,2).map(trainingGroup);
  if (!a || !b || a.label===b.label) return;
  const clauses = rows.slice(2).flatMap(row=>row.split(/\s*,\s*|\s+and\s+(?=(?:explain|suggest|design|propose)\b)/i)).filter(Boolean);
  const operations = new Set<string>();
  for (const clause of clauses) {
    const match = Object.entries(trainingOperations).find(([,pattern])=>pattern.test(clause));
    if (!match) return;
    operations.add(match[0]);
  }
  const showRates = operations.has('rates') || operations.has('comparison');
  const showDifference = operations.has('difference') || operations.has('comparison');
  if (!showRates && !showDifference) return;

  // Cross multiplication keeps the sign and ties exact, even for very close rates.
  const difference = 100 * (a.successes*b.trials - b.successes*a.trials) / (a.trials*b.trials);
  const format = new Intl.NumberFormat('en-US',{maximumSignificantDigits:6,useGrouping:false});
  const name = (group: TrainingGroup) => lang==='en' ? 'Group '+group.label : group.label+(/^[A-Z]$/.test(group.label)?' 组':'组');
  const rates = [a,b].map(group=>{
    const value=100*group.successes/group.trials;
    const percentage=format.format(value);
    const sign=Number(percentage)===value ? ' = ' : ' ≈ ';
    return name(group)+(lang==='zh'?'：':': ')+group.successes+'/'+group.trials+sign+percentage+'%';
  }).join(lang==='zh'?'，':', ')+(lang==='zh'?'。':'.');
  const gap = format.format(Math.abs(difference));
  const rounded = Number(gap)!==Math.abs(difference);
  if (lang==='zh') {
    const comparison = !difference ? '两组成功率相同，相差 0 个百分点。' : name(a)+'比 '+name(b)+(difference>0?'高':'低')+(rounded?'约 ':' ')+gap+' 个百分点。';
    const lines = [[showRates?rates:'',showDifference?comparison:''].filter(Boolean).join(' ')];
    if (operations.has('causality')) lines.push('这两组汇总数只能说明本次观察到的差异。它们没有交代训练方法如何分配、两组任务是否同样难。打乱难度、先后顺序、疲劳和随机波动都可能影响成功率，因此仅凭这些记录无法把差异归因于训练方法。');
    if (operations.has('retest')) lines.push('复测时先定好成功标准和每种方法的尝试次数。把难度相近的任务配成对，每对任务随机分给两种方法，再随机决定执行顺序，统一热身和休息时间。记录每次成败，跨几天重复，再比较两种方法的成功率和百分点差。');
    return lines.join('\n\n');
  }
  const comparison = !difference ? 'The rates are equal (0 percentage points apart).' : name(a)+' is '+(rounded?'about ':'')+gap+' percentage points '+(difference>0?'higher':'lower')+' than '+name(b)+'.';
  const lines = [[showRates?rates:'',showDifference?comparison:''].filter(Boolean).join(' ')];
  if (operations.has('causality')) lines.push('These totals describe the observed rates. They do not tell us how methods were assigned or whether the tasks had comparable difficulty. Task difficulty, order, fatigue and chance could explain the difference, so the counts alone cannot establish a causal effect.');
  if (operations.has('retest')) lines.push('Define success and fix the number of attempts per method in advance. Pair tasks of similar difficulty, randomly assign the two methods within each pair and randomize their order, and keep warm-up and breaks consistent. Record each outcome across several days, then compare the rates and their percentage-point difference.');
  return lines.join('\n\n');
}

import {averageOfN,meanOfN} from '@cuberoot/shared/timer/stats';
import type {Solve} from '@cuberoot/shared/timer/types';

/** Only a complete, explicitly timed list and a single calculation request.
 * Unknown units, penalties, extra questions and stored-record requests stay
 * with the normal planner. Never extract incidental numbers from prose. */
export function suppliedAverageAnswer(question:string,lang:'zh'|'en'):string|undefined {
  const token=String.raw`(?:\d+(?:\.\d{1,3})?\s*(?:秒|seconds?|s)?|DNF|DNS)`;
  const list=String.raw`(${token}(?:\s*(?:[,，、]|和|及|and)\s*${token}){2,4})`;
  const zh=new RegExp(String.raw`^(?:([五三53])次)?成绩\s*(?:是|为|[:：])\s*${list}\s*[,，;；]?\s*(?:请)?(?:计算|算一下|求)?\s*(ao5|mo3|五次平均|三次平均)\s*(?:是|为|等于)?\s*(?:多少)?[?？。]*$`,'i').exec(question.trim());
  const en=new RegExp(String.raw`^what(?:'s| is)\s+(?:the\s+)?(ao5|mo3)\s+(?:of|for)\s+${list}\s*\??$`,'i').exec(question.trim());
  if(!zh&&!en)return;
  const raw=zh?.[2]??en![2],format=/ao5|五次/i.test(zh?.[3]??en![1])?'ao5':'mo3',n=format==='ao5'?5:3;
  if(zh?.[1] && ({五:5,三:3,'5':5,'3':3} as Record<string,number>)[zh[1]]!==n)return;
  // At least one explicit seconds unit is required; bare numbers could be FMC.
  if(!/(?:秒|seconds?|s\b)/i.test(raw.replace(/DNS/gi,'')))return;
  const tokens=raw.split(/\s*(?:[,，、]|和|及|and)\s*/i);
  if(tokens.length!==n)return;
  const solves:Solve[]=tokens.map((text,i)=>({id:String(i),ts:i,event:'333',scramble:'',
    penalty:/^DNF$/i.test(text)?'DNF':/^DNS$/i.test(text)?'DNS':'ok',
    timeMs:/^DN[FS]$/i.test(text)?0:Math.round(parseFloat(text)*1000)}));
  if(solves.some(s=>s.penalty==='ok'&&(!Number.isSafeInteger(s.timeMs)||s.timeMs<=0||s.timeMs>86_400_000)))return;
  const value=format==='ao5'?averageOfN(solves,n):meanOfN(solves,n);
  if(value==null)return;
  const result=Number.isFinite(value)?(value/1000).toFixed(value>=600_000?0:2):'DNF';
  const unit=Number.isFinite(value)?{zh:' 秒',en:' seconds'}[lang]:'';
  const method=format==='ao5'
    ? {zh:'去掉一个最好和一个最差成绩后，计算剩余三次的平均；两次及以上 DNF/DNS 则为 DNF。',en:'Discard one best and one worst result, then average the remaining three; two or more DNF/DNS results make the average DNF.'}[lang]
    : {zh:'三次全部计入平均；任意一次 DNF/DNS 都使平均为 DNF。',en:'Average all three results; any DNF/DNS makes the mean DNF.'}[lang];
  return `${format} = ${result}${unit}。${method}`.replace(/。/g,lang==='en'?'. ':'。');
}

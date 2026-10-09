import { formatDateRangeIso } from './iso-date';

export interface AssistantTimePeriod {
  phrase: string;
  unit: 'year' | 'month' | 'week' | 'day';
  start: string;
  end: string;
}

const rules: Array<{pattern:RegExp;unit:AssistantTimePeriod['unit'];offset:number}> = [
  {pattern:/大前年/gi,unit:'year',offset:-3},
  {pattern:/前年|\byear before last\b/gi,unit:'year',offset:-2},
  {pattern:/去年|\blast year(?:'s)?\b/gi,unit:'year',offset:-1},
  {pattern:/今年|\bthis year(?:'s)?\b/gi,unit:'year',offset:0},
  {pattern:/明年|\bnext year(?:'s)?\b/gi,unit:'year',offset:1},
  {pattern:/后年|\byear after next\b/gi,unit:'year',offset:2},
  {pattern:/大后年/gi,unit:'year',offset:3},
  {pattern:/上(?:个)?月|\blast month\b/gi,unit:'month',offset:-1},
  {pattern:/本月|这个月|\bthis month\b/gi,unit:'month',offset:0},
  {pattern:/下(?:个)?月|\bnext month\b/gi,unit:'month',offset:1},
  {pattern:/前一周|上(?:一)?周|上(?:个)?星期|\blast week\b/gi,unit:'week',offset:-1},
  {pattern:/本周|这周|这个星期|\bthis week\b/gi,unit:'week',offset:0},
  {pattern:/下(?:一)?周|下(?:个)?星期|\bnext week\b/gi,unit:'week',offset:1},
  {pattern:/一周前|七天前|\ba week ago\b/gi,unit:'day',offset:-7},
  {pattern:/一周后|七天后|\ba week from now\b/gi,unit:'day',offset:7},
  {pattern:/前天|\bday before yesterday\b/gi,unit:'day',offset:-2},
  {pattern:/昨天|\byesterday\b/gi,unit:'day',offset:-1},
  {pattern:/今天|\btoday\b/gi,unit:'day',offset:0},
  {pattern:/明天|\btomorrow\b/gi,unit:'day',offset:1},
  {pattern:/后天|\bday after tomorrow\b/gi,unit:'day',offset:2},
];
const iso=(date:Date)=>date.toISOString().slice(0,10);
const shift=(date:Date,days:number)=>new Date(date.getTime()+days*86400000);

/** Clock supplied by the server; calendar boundaries follow the visitor's zone. */
export function resolveAssistantTime(question:string, now:Date, timeZone='UTC') {
  const parts=new Intl.DateTimeFormat('en-US',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
  const field=(type:string)=>parts.find(p=>p.type===type)!.value;
  const today=`${field('year')}-${field('month')}-${field('day')}`;
  const base=new Date(`${today}T00:00:00Z`);
  const matches=rules.flatMap(rule=>[...question.matchAll(rule.pattern)].map(match=>({rule,phrase:match[0],index:match.index!})))
    .sort((a,b)=>b.phrase.length-a.phrase.length);
  const accepted:Array<{index:number;period:AssistantTimePeriod}>=[];
  const unresolvedPhrases:string[]=[];
  for(const {rule,phrase,index} of matches) {
    if(accepted.some(m=>index<m.index+m.period.phrase.length && index+phrase.length>m.index))continue;
    if(phrase==='前一周' && /(?:比赛|赛事|世锦赛|锦标赛|WC\s*\d{4}|\d{4}-\d{2}-\d{2})(?:的)?$/i.test(question.slice(0,index))) {
      unresolvedPhrases.push(phrase);continue;
    }
    // A week plus weekday needs its own interpretation, not the whole week.
    if(rule.unit==='week' && /^[一二三四五六日天1-7]/.test(question.slice(index+phrase.length))) {
      unresolvedPhrases.push(phrase+question[index+phrase.length]);continue;
    }
    let start:Date,end:Date;
    if(rule.unit==='year') {
      const year=base.getUTCFullYear()+rule.offset;
      start=new Date(Date.UTC(year,0,1));end=new Date(Date.UTC(year,11,31));
    } else if(rule.unit==='month') {
      start=new Date(Date.UTC(base.getUTCFullYear(),base.getUTCMonth()+rule.offset,1));
      end=new Date(Date.UTC(base.getUTCFullYear(),base.getUTCMonth()+rule.offset+1,0));
    } else if(rule.unit==='week') {
      start=shift(base,-((base.getUTCDay()+6)%7)+rule.offset*7);end=shift(start,6);
    } else start=end=shift(base,rule.offset);
    accepted.push({index,period:{phrase,unit:rule.unit,start:iso(start),end:iso(end)}});
  }
  accepted.sort((a,b)=>a.index-b.index);
  let normalizedQuestion=question;
  for(const {index,period} of [...accepted].reverse()) {
    const value=period.unit==='year'?period.start.slice(0,4):formatDateRangeIso(period.start,period.end);
    normalizedQuestion=normalizedQuestion.slice(0,index)+value+normalizedQuestion.slice(index+period.phrase.length);
  }
  return {today,timeZone,weekStartsOn:'Monday' as const,periods:accepted.map(m=>m.period),normalizedQuestion,unresolvedPhrases};
}

/** Shared announcement discovery uses the same year rules without reading a clock. */
export function resolveAssistantYears(question:string, referenceYear?:number):number[] {
  const explicit=(question.match(/(?:19|20)\d{2}/g) ?? []).map(Number);
  if(explicit.length || referenceYear===undefined)return [...new Set(explicit)];
  return [...new Set(resolveAssistantTime(question,new Date(Date.UTC(referenceYear,0,1))).periods.filter(period=>period.unit==='year').map(period=>Number(period.start.slice(0,4))))];
}

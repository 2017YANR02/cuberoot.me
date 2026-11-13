import { ALG_CATALOG, getAlgSetMeta, type AlgFile, type AlgPuzzle } from '@cuberoot/shared/alg';
import { assistantAlgorithmSelection } from '@cuberoot/shared/site-assistant-algorithms';
import type { AssistantMessage, AssistantAlgorithms } from '@cuberoot/shared/site-assistant';
import { algorithmCards, matchingAlgorithmCases, type AlgorithmSelection } from './site_assistant_algorithms.js';

type CardReference = {id:number; name:string; alg:string; alternative:number};
type DisplayReference = {puzzle:AlgPuzzle; set:string; display:AssistantAlgorithms['display']; offset:number; total:number; nextOffset?:number; query?:string; cards:CardReference[]};
type Resolution = {selection:AlgorithmSelection; explain:boolean; cards?:AssistantAlgorithms['cards']} | {message:string};
const escape = (text:string) => text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const clean = (text:string) => text.normalize('NFKC').toLowerCase().replace(/\bperm(?:utation)?\b/g,'').replace(/[\s_()（）]/g,'');
function mentioned(text:string,name:string) {
  const pattern=escape(name.normalize('NFKC')).replace(/\s+/g,'\\s*');
  return new RegExp(`(?<![a-z0-9+])${pattern}(?![a-z0-9+\\-])`,'i').test(text);
}
function setsIn(text:string,puzzle?:AlgPuzzle) {
  const matches=Object.entries(ALG_CATALOG).flatMap(([p,sets])=>puzzle && p!==puzzle ? [] : sets.flatMap(meta=>
    [meta.slug,meta.short,meta.zh,meta.en].filter((name):name is string=>!!name).flatMap(name=>{
      // A trailing case number is allowed: OLL57 and COLL AS1 are natural inputs.
      const pattern=escape(name).replace(/\s+/g,'\\s*');
      const match=new RegExp(`(?<![a-z0-9-])${pattern}(?![a-z-])`,'i').exec(text);
      return match ? [{puzzle:p as AlgPuzzle,set:meta.slug,length:match[0].length,start:match.index,end:match.index+match[0].length}] : [];
    })));
  return [...new Map(matches.filter(m=>!matches.some(other=>other.start<=m.start && other.end>=m.end && other.length>m.length))
    .map(({start:_start,end:_end,...m})=>[`${m.puzzle}/${m.set}`,m])).values()];
}
function ordinal(text:string) {
  const match=text.match(/第\s*([一二两三四五六七八九十\d]+)\s*(?:个|张|条)|\b(first|second|third|\d+(?:st|nd|rd|th))\b/i);
  if(!match)return;
  const value=match[1] ?? match[2].toLowerCase().replace(/^(\d+)(st|nd|rd|th)$/,'$1');
  const digits:Record<string,number>={一:1,二:2,两:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9,first:1,second:2,third:3};
  if(value.includes('十')) {const [t,u]=value.split('十');return (t ? digits[t] : 1)*10+(u ? digits[u] : 0);}
  return Number(value)||digits[value];
}

/** Read the shared assistantAnswerHistory format, not arbitrary prose or user
 * messages. References select public library records; they are never evidence
 * for moves/stickers, which are always fetched again. */
function displayed(history:AssistantMessage[]) {
  for(let index=history.length-1;index>=0;index--) {
    const message=history[index];
    if(message.role!=='assistant')continue;
    const groups:DisplayReference[]=[];
    const sections=[...message.content.matchAll(/^puzzle=([^;\n]+); set=([^;\n]+); offset=(\d+); total=(\d+); display=(both|image|text)(?:; query=([^\n]*))?$/gm)];
    for(let i=0;i<sections.length;i++) {
      const m=sections[i],puzzle=m[1] as AlgPuzzle,set=m[2];
      if(!getAlgSetMeta(puzzle,set))continue;
      const body=message.content.slice(m.index!+m[0].length,sections[i+1]?.index);
      const cards=[...body.matchAll(/^\d+\. (.{1,200}) \[caseId=(\d+); alternative=(\d+)\/\d+\] \(\/alg\/[^\n]+\)\n([^\n]*)/gm)]
        .slice(0,24).map(c=>({id:Number(c[2]),name:c[1],alternative:Number(c[3]),alg:c[4]}));
      if(!cards.length)continue;
      let query:string|undefined;
      try {query=m[6] ? decodeURIComponent(m[6]) : undefined;}catch {continue;}
      groups.push({puzzle,set,display:m[5] as DisplayReference['display'],offset:Number(m[3]),total:Number(m[4]),query,cards,
        nextOffset:body.match(/^nextOffset=(\d+)$/m)?.[1] ? Number(body.match(/^nextOffset=(\d+)$/m)![1]) : undefined});
    }
    if(groups.length)return {groups,immediate:!history.slice(index+1).some(m=>m.role==='assistant')};
  }
}

/** Resolve concrete formula requests centrally for every client. Case names
 * come from the selected library, so sentence wording is not a fixed command.
 * Concept/navigation questions remain with the ordinary planner. */
export async function resolveAssistantAlgorithmRequest(question:string,history:AssistantMessage[],lang:'zh'|'en',load:(puzzle:AlgPuzzle,set:string)=>Promise<AlgFile>):Promise<Resolution|undefined> {
  const text=question.normalize('NFKC').trim();
  if(!text || text.length>1000)return;
  const say=(zh:string,en:string)=>({message:lang==='zh'?zh:en});
  // Explicit negation, counts, navigation and drills do not ask for formula content.
  if(/(?:不要|不用|别)(?:给我|提供|显示|展示)?(?:公式|卡片)|只(?:要|给|发).*(?:链接|入口|网址)|(?:打开|进入|跳转|在哪|哪里).*(?:页面|公式库)|(?:入口|链接|网址)|(?:多少|几个|数量|总数)|\b(?:how many|count|link|url|open|navigate)\b/i.test(text))return;
  if(/训练|练习|学习顺序|\b(?:training|practice)\b/i.test(text)
    && !/(?:给|发|列出|展示|附上|带上|show|give|list).*(?:公式|卡片|状态图|algorithms?|cards?|diagrams?)/i.test(text))return;

  const previous=displayed(history);
  const size=text.match(/([2-7])\s*[x×]\s*\1|([二三四五六七])阶/i);
  const n=size?.[1] ?? (size?.[2] ? String('零一二三四五六七'.indexOf(size[2])) : undefined);
  const puzzle=(n ? `${n}x${n}` : /\bsq[- ]?1\b/i.test(text) ? 'sq1' : undefined) as AlgPuzzle|undefined;
  let targets=setsIn(text,puzzle);
  if(targets.length>1 && !puzzle) {
    const recent=previous?.groups;
    const inherited=targets.filter(t=>recent?.some(g=>g.puzzle===t.puzzle && g.set===t.set));
    targets=inherited.length===1 ? inherited : targets.filter(t=>t.puzzle==='3x3');
  }
  const explicit=targets.length>0;
  const perm=text.match(/(?<![a-z0-9])([a-z][abcd]?|[au][+-])\s*[- ]?perm(?:utation)?\b/i);
  if(!targets.length && perm && (!puzzle || puzzle==='3x3'))targets=[{puzzle:'3x3',set:'pll',length:0}];
  if(!targets.length && previous && !previous.immediate) {
    const lastUser=[...history].reverse().find(m=>m.role==='user');
    const recent=lastUser ? setsIn(lastUser.content,puzzle ?? '3x3') : [];
    if(recent.length===1)targets=recent;
  }
  if(!targets.length && previous)targets=previous.groups.filter(g=>!puzzle || puzzle===g.puzzle).map(g=>({...g,length:0}));
  if(!targets.length) {
    const lastUser=[...history].reverse().find(m=>m.role==='user');
    const recent=lastUser ? setsIn(lastUser.content,puzzle ?? '3x3') : [];
    if(recent.length===1)targets=recent;
  }
  // Conventional "T 公式" names default to PLL only without another subject.
  if(!targets.length && /(?<![a-z])(?:T|Ua|Ub|Ga|Gb|Gc|Gd|Ja|Jb|Ra|Rb|Na|Nb|Aa|Ab|H|Z|Y|V|F|E)\s*(?:公式|换位|怎么(?:拧|转|做)|如何(?:拧|转|做))|(?:公式|换位)\s*(?:T|Ua|Ub|Ga|Gb|Gc|Gd|Ja|Jb|Ra|Rb|Na|Nb|Aa|Ab|H|Z|Y|V|F|E)(?![a-z])/i.test(text)
    && (!puzzle || puzzle==='3x3'))targets=[{puzzle:'3x3',set:'pll',length:0}];

  const nextCase=/(?:下一个|换一个|另一个)\s*(?:case|情况|状态)|^(?:那|看)?下(?:一)?个(?:呢|吧)?[?？。!！\s]*$|\bnext\s+case\b/i.test(text);
  const another=!nextCase && /换(?:一(?:条|个|种|下)|条|个|种|公式)|再来|另一|(?:其他|其它|别的).*(?:公式|手顺|算法)|还有别|还有其他|还有其它|\b(?:another|alternative|different)\b/i.test(text);
  const more=/^(?:请|再)?(?:继续|接着|剩下的|还有呢|后面的)[。！?？\s]*$|(?:继续|加载|剩下|后面).*(?:公式|case)|\b(?:continue|remaining|load more|next page)\b/i.test(text);
  const onlyImage=/(?:只|仅|换成|改成).*(?:图|图片)|\b(?:images?|diagrams?)\s+only\b|\bonly\s+(?:images?|diagrams?)\b/i.test(text);
  const onlyText=/(?:只|仅|换成|改成).*(?:文字|文本)|(?:不要|不用|不需要)(?:状态)?图|\b(?:text only|only text|no (?:images?|diagrams?))\b/i.test(text);
  const both=/(?:带|加|附|配|要|看|看看).*(?:图|图片)|(?:图文|状态图和公式)|\b(?:with|add|both).*(?:images?|diagrams?)\b/i.test(text);
  const format=onlyText?'text':onlyImage?'image':both?'both':undefined;
  const refer=/[这那](?:个|条|张)|刚才|刚刚|上(?:一)?[个条]|第\s*[一二两三四五六七八九十\d]+\s*个|\b(?:this|that|previous|first|second|third)\b/i.test(text);
  const formula=/公式|手顺|算法|case|卡片|状态图|\b(?:algorithms?|moves?|perms?)\b/i.test(text);
  const want=/(?:给|发|来|要|看|有哪些|列出|展示|显示|附上|提供|怎么做|怎么拧|怎么转|如何做|如何拧)|\b(?:show|give|list|want|need|see|how.*(?:do|solve|execute))\b/i.test(text);
  const contextual=!!previous && (previous.immediate || formula || refer) && (another||more||nextCase||refer||!!format);
  if(!targets.length)return contextual ? say('你想看哪个公式集或 case？','Which algorithm set or case do you mean?') : undefined;
  if(targets.length!==1)return contextual ? say('你指的是哪个公式集或 case？请说出名称。','Which algorithm set or case do you mean? Please name it.') : undefined;
  const target=targets[0];
  const priorGroups=previous?.groups.filter(g=>g.puzzle===target.puzzle && g.set===target.set) ?? [];
  const prior=priorGroups.length===1 ? priorGroups[0] : undefined;
  const short=clean(text.replace(/(?:那|呢|吧|吗|的|公式|case|[?？。!！])/gi,''));
  const meta=getAlgSetMeta(target.puzzle,target.set);
  const namedCase=explicit && [meta?.slug,meta?.short,meta?.zh,meta?.en].some(name=>name &&
    new RegExp(`^${escape(name)}\\s*(?:的\\s*)?[a-z0-9][a-z0-9+\\-\\s]{0,11}[?？]?$`,'i').test(text));
  // Mentioning a set in a page, glossary or reconstruction question is not a
  // request to fetch its formulas. Keep concise case names such as "PLL T".
  if(!formula && !want && !contextual && !perm && !namedCase && !(prior && short.length<=12))return;
  if(!explicit && !perm && previous && !previous.immediate && !formula && !refer)return;

  const data=await load(target.puzzle,target.set);
  if(data.puzzle!==target.puzzle || data.set!==target.set || !Array.isArray(data.cases))throw new Error('Mismatched algorithm library');
  const names=data.cases.filter(c=>mentioned(text,c.name) || mentioned(text,c.name.replace(/\s+perm(?:utation)?$/i,'')) || (perm && clean(c.name)===clean(perm[1]))
    || (c.name.toLowerCase().startsWith(target.set.toLowerCase()) && mentioned(text,c.name.slice(target.set.length).trim())));
  const named=names;
  const display=format ?? (!explicit && prior ? prior.display : 'both');
  const explain=/解释|讲解|原理|识别|记忆|怎么记|如何记|为什么|区别|\b(?:explain|recognize|recognise|why|memorize|difference)\b/i.test(text);
  const start=text.match(/从第\s*(\d+)\s*个\s*(?:case)?\s*开始|starting at case\s*(\d+)/i);
  if(start && more) {
    const offset=Number(start[1] ?? start[2])-1;
    if(offset<0 || offset>50000)return;
    return {selection:{puzzle:target.puzzle,set:target.set,query:prior?.query,offset,display,limit:24},explain};
  }
  const row=ordinal(text);
  let selected=named.length===1 ? named[0] : undefined;
  if(named.length>1)return say('你想看哪个 case？请补充完整名称。','Which case do you mean? Please give its full name.');
  if(!selected && row && !/第\s*[一二两三四五六七八九十\d]+\s*条/.test(text)) {
    const ref=!explicit && prior ? prior.cards[row-1] : undefined;
    selected=!explicit && prior ? data.cases.find(c=>c.id===ref?.id) : data.cases[row-1];
    if(!selected)return say('这个位置没有已展示的 case，请指定名称。','There is no displayed case at that position. Please name the case.');
  }
  if(!selected && (another||nextCase||refer||format||row) && prior?.cards.length===1)selected=data.cases.find(c=>c.id===prior.cards[0].id);
  if((another||nextCase||refer) && !selected && !more && !format)return say('你指哪个 case？请说名称，或“第几个 case”。','Which case do you mean? Give its name or position in the displayed cards.');
  if(nextCase && selected) {
    const cases=matchingAlgorithmCases(data,{puzzle:target.puzzle,set:target.set,query:prior?.query});
    const index=cases.findIndex(c=>c.id===selected!.id);
    selected=cases[index+1];
    if(!selected)return say('已经是这个公式集的最后一个 case。','This is the last case in this algorithm set.');
  }
  if(selected) {
    const ref=prior?.cards.find(c=>c.id===selected!.id);
    let alternative=0;
    if(another) {
      const entries=selected.algs[0]?.filter(entry=>entry.alg.trim()) ?? [];
      const current=ref ? entries.findIndex(entry=>entry.alg===ref.alg) : -1;
      alternative=entries.length ? ((current>=0?current:ref?.alternative ?? 0)+1)%entries.length : 0;
    } else if(!nextCase && !explicit && ref && (format||refer)) {
      const entries=selected.algs[0]?.filter(entry=>entry.alg.trim()) ?? [];
      alternative=Math.max(0,entries.findIndex(entry=>entry.alg===ref.alg));
    }
    if(/第\s*[一二两三四五六七八九十\d]+\s*条/.test(text) && row)alternative=row-1;
    if(!assistantAlgorithmSelection(selected,target.puzzle,target.set,alternative))return say('这个 case 没有对应的备选公式。','This case has no algorithm at that alternative position.');
    return {selection:{puzzle:target.puzzle,set:target.set,caseId:selected.id,alternative,display},explain};
  }
  if(more && prior) {
    if(prior.nextOffset===undefined)return say('这一组 case 已全部展示。','All cases in this selection have been shown.');
    return {selection:{puzzle:target.puzzle,set:target.set,query:prior.query,offset:prior.nextOffset,display,limit:24},explain};
  }
  if(format && prior && !explicit)return {selection:{puzzle:target.puzzle,set:target.set,query:prior.query,offset:prior.offset,limit:prior.cards.length,display},explain,
    cards:prior.cards.flatMap(ref=>{
      const c=data.cases.find(c=>c.id===ref.id);if(!c)return [];
      const alternative=Math.max(0,(c.algs[0]?.filter(entry=>entry.alg.trim()) ?? []).findIndex(entry=>entry.alg===ref.alg));
      return algorithmCards(data,{puzzle:target.puzzle,set:target.set,caseId:c.id,alternative,display},lang).cards;
    })};
  const subgroups=[...new Set(data.cases.map(c=>c.subgroup).filter(group=>group && mentioned(text,group)))];
  if(subgroups.length===1 && (want||formula))return {selection:{puzzle:target.puzzle,set:target.set,query:subgroups[0],display,limit:24},explain};
  // Do not turn an unresolved named/numbered case into the entire library.
  if(/(?:case\s*[a-z0-9]|\b(?:oll|pll|coll|zbll|f2l)\s*\d|第.*(?:号|case))/i.test(text) || /\b[A-Z][a-d]?\s*(?:公式|perm|case)|\b[A-Z][a-d]\b/.test(text))return say('未找到这个 case，请核对公式集和 case 名称。','This case was not found. Please check the algorithm set and case name.');
  if(explicit && want && (formula||format))return {selection:{puzzle:target.puzzle,set:target.set,display,limit:24},explain};
}

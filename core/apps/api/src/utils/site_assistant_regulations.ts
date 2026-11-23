import {parseHTML} from 'linkedom';
import {knowledgeTokens} from './site_assistant_knowledge.js';
import type {AssistantContext} from './site_assistant_context.js';

// Fixed authority, never a model/user supplied fetch destination. This reader
// supplements the public site's explanatory excerpts with the actual clauses.
export const WCA_REGULATIONS_URL='https://www.worldcubeassociation.org/regulations/';
export const WCA_REGULATIONS_MIRROR_URL='https://next.cuberoot.me/en/regulation/full';
const articles:Record<string,string>={officials:'1',competitors:'2',puzzles:'3',scrambling:'4',defects:'5',environment:'7',events:'9','solved-state':'10',incidents:'11',notation:'12','speed-solving':'A',blindfolded:'B','one-handed':'C','fewest-moves':'E','multi-blind':'H','head-to-head':'I'};
export function regulationArticle(href:string){return articles[href.replace(/^\/regulation\//,'').split('#')[0]];}
export function regulationChapterHref(sourceId:string){
  const article=/^wca:regulations:(\d+|[A-Z])$/.exec(sourceId)?.[1];
  const slug=Object.keys(articles).find(slug=>articles[slug]===article);
  return slug?'/regulation/'+slug:undefined;
}
type Excerpt={href:string;content:string};
const clauseReferences=(text:string)=>text.match(/\b(?:\d+[a-z]|[A-Z]\d)[a-z\d]*\+*/g)??[];
export function savedRegulationChapter(context:AssistantContext|undefined,id:string) {
  const articleId=(sourceId:string)=>sourceId.replace(/^wca:clause:(\d+[a-z]|[A-Z]\d)[a-z\d]*\+*$/,(_id,family:string)=>'wca:regulations:'+family.slice(0,-1));
  const chapter=articleId(id);
  const source=context?.sources.find(s=>(s.id===id || (id===chapter && articleId(s.id)===chapter)) && s.read &&
    [WCA_REGULATIONS_URL,WCA_REGULATIONS_MIRROR_URL].some(url=>s.href.startsWith(url+'#') && (!s.id.startsWith('wca:clause:') || s.href===url+'#'+s.id.slice(11))));
  return source ? regulationChapterHref(chapter) : undefined;
}

/** A saved reference chooses what to read again, never what answer to give.
 * Only an unambiguous official chapter with an actual prior clause query is
 * eligible. Shared content words justify a speculative read; all other tools
 * remain available if the fresh clauses do not answer the current question. */
export function regulationFollowUpRead(question:string,lang:'zh'|'en',context?:AssistantContext) {
  if(!context?.sources.length)return;
  const href=savedRegulationChapter(context,context.sources[0].id);
  if(!href || context.sources.some(s=>!s.read || savedRegulationChapter(context,s.id)!==href))return;
  const article=regulationArticle(href);
  const contentWords=(text:string)=>knowledgeTokens(text,lang).filter(word=>
    /\p{L}/u.test(word) && (/\p{Script=Han}/u.test(word)?word.length>=2:word.length>=5));
  const words=new Set(contentWords(question));
  const queries=context.observations.flatMap(observation=>{
    if(observation.call.tool!=='pages' || !observation.sourceIds.some(id=>context.sources.some(s=>s.id===id)))return [];
    const query=observation.call.query;
    if(!clauseReferences(query).some(id=>id.match(/^(\d+|[A-Z])/)?.[0]===article)
      || !contentWords(query).some(word=>words.has(word)))return [];
    return [query];
  });
  if(!queries.length)return;
  return {tool:'pages' as const,query:[question.slice(0,350),queries[0].slice(0,149)].join('\n'),pageIds:['wca:regulations:'+article],audience:'user' as const};
}
export function regulationExcerptArticles(excerpt:Excerpt,query=''):string[] {
  const article=regulationArticle(excerpt.href);
  if(article)return [article];
  if(excerpt.href.split('#')[0]!=='/regulation/full')return [];
  // The full-text index contains the same numbered clauses as chapter pages.
  // Resolve actual references rather than guessing a chapter from topic words.
  return [...new Set(clauseReferences(query+'\n'+excerpt.content).map(id=>id.match(/^(\d+|[A-Z])/)![0]))]
    .filter(id=>Object.values(articles).includes(id));
}

/** Preserve whole clause families, including + examples and overriding rules.
 * Small chapters are read in full; large ones use explicit references from the
 * retrieved chapter. Incompleteness is visible, never filled by model memory. */
export function officialRegulationPassages(html:string,excerpts:Excerpt[],query='',sourceUrl=WCA_REGULATIONS_URL) {
  const {document}=parseHTML(html);
  const version=document.querySelector('version,.reg-doc-version')?.textContent?.trim()
    ?? document.body.textContent?.match(/Version:\s*[^\n]+/)?.[0]?.slice(0,100);
  const snapshot=sourceUrl===WCA_REGULATIONS_MIRROR_URL;
  if(snapshot && !document.querySelector('.reg-doc-version')?.textContent?.trim())return [];
  const clauses=[...document.querySelectorAll('li[id]')].flatMap(node=>{
    const id=node.id;if(!/^(?:\d+[a-z]|[A-Z]\d)[a-z\d]*\+*$/.test(id))return [];
    const own=node.cloneNode(true) as typeof node;own.querySelectorAll('ul,ol').forEach(child=>child.remove());
    return [{id,article:id.match(/^(\d+|[A-Z])/)![0],text:(own.textContent ?? '').replace(/\s+/g,' ').trim()}];
  });
  const scoped=excerpts.flatMap(p=>regulationExcerptArticles(p,query).map(article=>({...p,article})));
  const requested=[...new Set(scoped.map(p=>p.article))];
  let remaining=12500;
  return requested.flatMap(article=>{
    const chapter=clauses.filter(c=>c.article===article);
    if(!chapter.length)return [];
    const full=chapter.map(c=>c.text).join('\n');
    const refs=new Set([query,...scoped.filter(p=>p.article===article).map(p=>p.content)].flatMap(clauseReferences));
    // Top-level subrules carry their prerequisites, exceptions and examples.
    const families=new Set([...refs].map(id=>id.match(/^(?:\d+[a-z]|[A-Z]\d)/)?.[0]).filter(Boolean));
    // A selected family can explicitly depend on another in the same article
    // (inspection A3 references starting the solve A4). Include that dependency
    // in this read, keeping the existing whole-family budget and omission flag.
    const linked=chapter.filter(c=>families.has(c.id.match(/^(?:\d+[a-z]|[A-Z]\d)/)?.[0]));
    for(const clause of linked)for(const ref of clauseReferences(clause.text)) {
      if(ref.match(/^(\d+|[A-Z])/)?.[0]===article)families.add(ref.match(/^(?:\d+[a-z]|[A-Z]\d)/)?.[0]);
    }
    const relevant=full.length<=remaining?chapter:chapter.filter(c=>families.has(c.id.match(/^(?:\d+[a-z]|[A-Z]\d)/)?.[0]));
    const groups=new Map<string,typeof chapter>();
    for(const clause of relevant){const key=clause.id.match(/^(?:\d+[a-z]|[A-Z]\d)/)![0];groups.set(key,[...(groups.get(key)??[]),clause]);}
    const kept:typeof chapter=[];
    for(const group of groups.values()){
      const size=group.reduce((sum,c)=>sum+c.text.length+1,0);
      if(size>remaining)continue;
      kept.push(...group);remaining-=size;
    }
    if(!kept.length)return [];
    const family=(id:string)=>id.match(/^(?:\d+[a-z]|[A-Z]\d)/)![0];
    const completeFamilies=[...new Set(kept.map(c=>family(c.id)))];
    const omittedFamilies=[...new Set(chapter.map(c=>family(c.id)))].filter(id=>!completeFamilies.includes(id));
    const exceptions=kept.flatMap(c=>{
      const text=c.text.match(/\bExceptions?:\s*([\s\S]+)/i)?.[0];
      return text?[{clause:c.id,text,references:clauseReferences(text)}]:[];
    });
    return [{id:`wca:regulations:${article}`,title:`WCA Regulations — Article ${article}`,href:sourceUrl+`#${kept[0].id}`,
      content:kept.map(c=>c.text).join('\n'),metadata:{sourceType:'rule',authority:'WCA official regulations',sourceVersion:version,...(snapshot?{snapshot:true,canonicalUrl:WCA_REGULATIONS_URL,instruction:'Published official English full-text snapshot at the stated version. Do not claim the current official site was verified; cite this mirror and state the version when relevant.'}:{}),clauses:kept.map(c=>c.id),completeFamilies,omittedFamilies,exceptions,coverageInstruction:'Every listed completeFamily includes all its clauses, qualifications and examples from this source. Only omittedFamilies are missing from this chapter. Use relevant exceptions actually supplied when the user asks about special cases; an incomplete chapter does not make included families incomplete. Other chapters are outside this read; request a focused follow-up if their contents are needed.'},relatedOmitted:kept.length!==chapter.length}];
  });
}

/** Only standard inspection-start scenarios. Other incidents and first-turn
 * timestamps require additional facts and stay with the full rule reader. */
const headToHead = /head[ -]to[ -]head|对决|对抗赛|面对面|\bH2H\b/i;
const stopping = /停表|停下?计时器|stop(?:s|ped|ping)? (?:the )?(?:speedsolving )?timer/i;
const otherIncident = /故障|触碰|碰到|没(?:有)?放|未(?:完全)?松|掉件|残障|盲|最少步|秒表|额外|重置|抢跑|第三次|malfunction|touch|defect|stopwatch|blind|extra attempt|third attempt|reset/i;

export function inspectionStartTimes(question:string):number[]|undefined {
  if (headToHead.test(question) || stopping.test(question)) return;
  if (!/观察|inspection/i.test(question) || !/裁判|WCA|判罚|怎么判|是否罚|罚时|\b(?:judge|penalty|penalized|ruling)\b/i.test(question) ||
      !/起表|启动计时器|开始还原|start(?:s|ed)? (?:the (?:timer|solve)|solving)/i.test(question) ||
      /第一步|第一转|首转|转动|触碰|盲|单手|最少步|故障|掉件|残障|例外|额外|\b(?:turn|move|blind|touch|exception|incident|extra|defect|stopwatch|accommodation)\b/i.test(question)) return;
  const list=question.match(/(?:^|[^.\d-])(\d+(?:\.\d+)?(?:\s*(?:、|，|,|和|与|或|以及|and|or)\s*\d+(?:\.\d+)?)*)\s*(?:秒|seconds?\b)/i);
  if (!list || list.index===undefined) return;
  const after=question.slice(list.index+list[0].length);
  const before=question.slice(0,list.index+1);
  if (!/^\s*(?:时|整|后|就|才)?\s*(?:起表|启动计时器|开始还原|starts? (?:the (?:timer|solve)|solving))/i.test(after)
      && !/(?:起表|开始还原|启动计时器|start(?:s|ed)? (?:the (?:timer|solve)|solving))\s*(?:时间|时刻)?\s*(?:为|是|在|at)?\s*[:：]?\s*$/i.test(before)) return;
  const times = list[1].match(/\d+(?:\.\d+)?/g)!.map(Number);
  if (times.length>12 || times.some(t=>t>120)) return;
  // Extra numbers may represent another stage of the attempt.
  const rest=question.replace(list[1],'').replace(/3\s*[x×]\s*3(?:\s*[x×]\s*3)?|3阶/gi,'');
  if (/\d/.test(rest)) return;
  return times;
}

type InspectionScenario =
  | {kind:'standard'|'independent-stop';times:number[]}
  | {kind:'head-to-head'};

export function inspectionScenario(question:string):InspectionScenario|undefined {
  if (otherIncident.test(question)) return;
  if (headToHead.test(question)) {
    if (!stopping.test(question) && /观察|inspection/i.test(question) &&
        /起表|启动|开始还原|\b(?:start|starts|started|GO)\b/i.test(question) &&
        !/报时|倒数|倒计时|countdown|callouts?|同时.*普通|compare|分别/i.test(question)) return {kind:'head-to-head'};
    return;
  }
  if (stopping.test(question)) {
    // Only split explicitly independent attempts. A stop in the same solve can
    // carry cumulative penalties and needs the full rule reader.
    const parts=question.split(/第二次|第二把|另一次|第二个尝试|(?:the |a )?second (?:attempt|solve)|(?:on|in) (?:the )?second\b/i);
    if (parts.length!==2) return;
    const stop=parts[1];
    const oneHandStop=/(?:一只手|一手|单手)\s*(?:去|来|按)?\s*(?:停表|停止?计时器)|(?:stop(?:ped|s|ping)? (?:the )?timer (?:with|using) (?:only )?(?:one|a single) hand|(?:one hand|a single hand) to stop the timer)/i;
    const released=/放下|松开|放开|松手|releas(?:e[ds]?|ing)|put(?:s)? (?:it|the (?:cube|puzzle)) down/i.exec(stop);
    const stopped=oneHandStop.exec(stop);
    if (!released || !stopped || /不是|并非|未放|没放|没松|未松|未还原|没还原|没有用|不用|双手|did not|didn’t|didn't|without releasing|before releasing|unsolved|both hands/i.test(stop)) return;
    if (released.index>stopped.index && !/after (?:fully )?releasing|after (?:they|he|she) released/i.test(stop)) return;
    const times=inspectionStartTimes(parts[0]+' WCA');
    return times?.length===1 ? {kind:'independent-stop',times} : undefined;
  }
  const times=inspectionStartTimes(question);
  return times && {kind:'standard',times};
}

export function inspectionVerdicts(html:string, sourceUrl:string, scenario:InspectionScenario, lang:'zh'|'en') {
  const {document}=parseHTML(html);
  const clause=(id:string)=>{
    const element=document.getElementById(id);
    const node=element?.cloneNode(true) as typeof element;
    node?.querySelectorAll('ul,ol').forEach(child=>child.remove());
    return node?.textContent?.replace(/\s+/g,' ') ?? '';
  };
  const version = document.querySelector('.reg-doc-version')?.textContent?.trim() ?? document.body.textContent?.match(/Version:\s*([A-Za-z]+ \d{1,2}, \d{4})/i)?.[1];
  if(sourceUrl===WCA_REGULATIONS_MIRROR_URL && !version)return;
  const cite=(id:string)=>'[[wca:clause:'+id+']]';
  const versionLabel=sourceUrl===WCA_REGULATIONS_MIRROR_URL?{zh:'规则快照版本 ',en:'Regulations snapshot '}:{zh:'WCA 规则版本 ',en:'WCA Regulations version '};
  const result=(answer:string,ids:string[])=>({
    answer:answer+(version?'\n\n'+versionLabel[lang]+version:''),
    sources:ids.map(id=>({id:'wca:clause:'+id,title:'WCA '+id,href:sourceUrl+'#'+id,read:true})),
  });
  if (scenario.kind==='head-to-head') {
    if (!/usual penalties.*do not apply in Head to Head/i.test(clause('I4c6')) ||
        !/14 seconds.*GO.*intentionally delaying.*DNF.*discretion/i.test(clause('I4c5')) ||
        !/before.*GO.*DNF.*discretion/i.test(clause('I4c7'))) return;
    return result([
      (lang==='zh'?'对决中不能仅凭观察秒数加罚。普通轮次的 15 秒、17 秒罚则不适用。':'In Head to Head, elapsed inspection time alone does not trigger the ordinary 15- or 17-second penalties.')+' '+cite('I4c6'),
      (lang==='zh'?'广播员在 14 秒喊 GO，选手应在此时起表。若故意延迟，裁判可判本次 DNF。':'The announcer calls GO at 14 seconds. Start then. The judge may give a DNF for an intentional delay.')+' '+cite('I4c5'),
      (lang==='zh'?'若在 GO 之前起表，裁判也可判本次 DNF。':'Starting before GO can also receive a DNF at the judge’s discretion.')+' '+cite('I4c7'),
    ].join('\n'),['I4c6','I4c5','I4c7']);
  }
  const penalty=clause('A4d1+').match(/exactly (\d+) seconds.*time penalty \(\+(\d+) seconds\) must be applied/i);
  const dnf=clause('A4d2+').match(/exactly (\d+) seconds.*must be disqualified \(DNF\)/i);
  const calls=['A3b3','A3b4'].map(id=>clause(id).match(/when (\d+) seconds.*judge calls ["“](\d+) SECONDS/i));
  if (!penalty || !dnf || Number(penalty[1])>=Number(dnf[1]) || calls.some(m=>!m || m[1]!==m[2]) ||
      !clause('A4d1').includes('within '+penalty[1]+' seconds') || !clause('A4d2').includes('within '+dnf[1]+' seconds') ||
      !/starts the solve by starting the timer/i.test(clause('A4d')) ||
      !/uncovers the puzzle and starts timing the inspection/i.test(clause('A3b2'))) return;
  const ids = new Set<string>();
  const ref=(id:string)=>{ids.add(id);return cite(id);};
  const lines=scenario.times.map(t=>{
    const seconds=t===Number(t.toFixed(2))?t.toFixed(2):String(t);
    let verdict=lang==='zh'?'无观察超时罚时':'no inspection penalty';
    if(t>=Number(dnf[1])) verdict='DNF '+ref(t===Number(dnf[1])?'A4d2+':'A4d2');
    else if(t>=Number(penalty[1])) verdict='+'+penalty[2]+' '+ref(t===Number(penalty[1])?'A4d1+':'A4d1');
    return seconds+(lang==='zh'?' 秒：':' s: ')+verdict;
  });
  if (scenario.kind==='independent-stop') {
    if (!/both hands.*palms down.*penalty \(\+2 seconds\)/i.test(clause('A6d'))) return;
    return result([
      (lang==='zh'?'第一次，观察 ':'First attempt, inspection ')+lines[0],
      (lang==='zh'?'第二次，单手停表加罚 2 秒（+2）。放下魔方后，仍须双手手掌朝下平放在感应区停表。':'Second attempt: +2 seconds for stopping with one hand. After releasing the puzzle, stop the timer with both hands flat on the sensors, palms down.')+' '+ref('A6d'),
    ].join('\n\n'),[...ids]);
  }
  const intro=lang==='zh'?'裁判揭罩时开始观察计时，以选手启动速拧计时器为开始还原的时刻。':'Inspection begins when the judge uncovers the puzzle. The solve starts when the competitor starts the speedsolving timer.';
  const callouts = calls.map((m,i)=>m![1]+(lang==='zh'?' 秒喊':' s: call ')+'“'+m![2]+' SECONDS” '+ref(i===0?'A3b3':'A3b4')).join(lang==='zh'?'，':', ');
  return result([intro+' '+ref('A3b2')+' '+ref('A4d'),lines.join('\n'),callouts].join('\n\n'),[...ids]);
}

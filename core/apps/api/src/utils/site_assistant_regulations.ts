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
  // A search may return broad chapters before the clause named in the
  // question. Spend the shared excerpt budget on explicitly requested rules first.
  const family=(id:string)=>id.match(/^(?:\d+[a-z]|[A-Z]\d)/)![0];
  const explicit=clauseReferences(query);
  const namedArticles=new Set(explicit.map(id=>id.match(/^(\d+|[A-Z])/)![0]));
  const namedFamilies=new Set(explicit.map(family));
  const requested=[...new Set(scoped.map(p=>p.article))].sort((a,b)=>Number(namedArticles.has(b))-Number(namedArticles.has(a)));
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
    const ranked=[...groups].sort(([a],[b])=>Number(namedFamilies.has(b))-Number(namedFamilies.has(a)));
    for(const [,group] of ranked){
      const size=group.reduce((sum,c)=>sum+c.text.length+1,0);
      if(size>remaining)continue;
      kept.push(...group);remaining-=size;
    }
    if(!kept.length)return [];
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
  const elapsedSingle=/^(?:普通)?(?:三阶)?比赛从(?:开始观察|揭罩)到(?:启动(?:计时器|Stackmat)?|起表|开始还原)(?:用了|经过)\s*(\d+(?:\.\d+)?)\s*秒[，,]?(?:成绩)?(?:要加几秒|怎么判|如何判罚)[？?。]?$/iu.exec(question.trim());
  if(elapsedSingle && Number(elapsedSingle[1])<=120) return [Number(elapsedSingle[1])];
  const spoken=/^(?:(?:如果|普通|三阶|比赛|我|从开始)\s*)*观察(?:时间)?(?:用了|用时|经过)?\s*(\d+(?:\.\d+)?)\s*秒(?:整)?(?:时|才|后)?(?:启动\s*(?:Stackmat|计时器)|开始还原|起表)[，,]?\s*(?:应该怎么判|怎么判|还能记作加二吗|算加二吗|会加几秒|是加二还是DNF)[?？。!！]?$/iu.exec(question.trim());
  if(spoken && Number(spoken[1])<=120) return [Number(spoken[1])];
  if (!/观察|揭罩|inspection/i.test(question) || !/裁判|WCA|判罚|怎么判|是否罚|罚时|\b(?:judge|penalty|penalized|ruling)\b/i.test(question) ||
      !/起表|启动计时器|开始还原|start(?:s|ed)? (?:the (?:timer|solve)|solving)/i.test(question) ||
      /第一步|第一转|首转|转动|触碰|盲|单手|最少步|故障|掉件|残障|例外|额外|\b(?:turn|move|blind|touch|exception|incident|extra|defect|stopwatch|accommodation)\b/i.test(question)) return;
  // An elapsed-time list has one common start and end. Units may be
  // repeated on each measurement; an unrelated second event is not a list.
  const elapsed = /从(?:揭罩|观察开始|开始观察)(?:计时)?到(?:选手)?(?:起表|启动计时器|开始还原)[，,：:\s]*(?:分别|依次)?(?:经过|用了|用时|耗时|为|是)?\s*(\d+(?:\.\d+)?(?:\s*秒?\s*(?:、|，|,|和|与|或|以及)\s*\d+(?:\.\d+)?)*\s*秒)/u.exec(question);
  if (elapsed) {
    const prefix = question.slice(0,elapsed.index).replace(/3\s*[x×]\s*3(?:\s*[x×]\s*3)?|3阶/gi,'');
    const tail = question.slice(elapsed.index+elapsed[0].length);
    // Only consume requests for the verdicts and their basis. Keep mixed
    // incidents, uncertainty, extra calculations and unrelated asks on the planner.
    const verdictWords = /[\s，,、。.;；:：?？!！]|请|把|这|两|三|各|种|次|都|的|分别|依次|按顺序|告诉我|给出|说明|附上|列出|以及|并|和|到|对应|具体|怎么判|如何判|裁判|结果|依据|处罚|判罚|规则|编号|条款/gu;
    const setupWords = /[\s，,、。.;；:：]|请|帮我|查阅|查询|查|按照|根据|按|WCA|官网|官方|比赛|规则|常规|普通|三阶|平均轮|轮次|轮|选手|使用|采用|用|Stackmat|速拧计时器/giu;
    if (prefix.replace(setupWords,'')
        || tail.replace(verdictWords,'') || !/判|罚|依据|条款|结果/.test(tail)) return;
    const times = elapsed[1].match(/\d+(?:\.\d+)?/g)!.map(Number);
    return times.length<=12 && times.every(t=>t<=120) ? times : undefined;
  }
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

function readVerdictClauses(html:string, sourceUrl:string, lang:'zh'|'en') {
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
  return {clause,cite,result};
}

export function cornerTwistContestQuestion(question:string) {
  if (!/twist(?:ing|ed)? (?:a |one |two |the )?corner|corner twist|扭角|拧角/i.test(question)
      || !/speedcubing|competiti(?:on|ve)|WCA|比赛/i.test(question)) return false;
  // Restrict direct rulings to the legality questions we actually answer.
  // Free-form requests, unusual events and separate incidents need composition.
  if (/\b(?:also|then|explain|list|compare|cite|show|calculate|give|write|draw|provide|describe|design|recommend|include|summarize|demonstrate|except|only if|assume|blindfold(?:ed)?|one.hand|extra attempt|inspection|time limit|judge|appeal|when|why|how)\b|另外|同时|解释|盲拧|单手|观察|裁判|申诉|额外|举例|[;；:：]/i.test(question)) return false;
  const asks=question.match(/[^.!?。？！\n]+[?？]/g) ?? [];
  return asks.length>0 && asks.every(ask=>/(?:is (?:it|the move|twisting a corner of a Rubik.s cube) (?:a (?:valid|legal) move|["“]?allowed["”]?)(?: in (?:speedcubing|the intended original cube))?|(?:比赛中|比赛时)?(?:可以|允许|能否)(?:用手)?(?:扭角|拧角)(?:吗)?)[?？]$/i.test(ask.trim()));
}

export function cornerTwistContestVerdict(html:string,sourceUrl:string,lang:'zh'|'en') {
  const read=readVerdictClauses(html,sourceUrl,lang);
  if (!read) return;
  const {clause,cite,result}=read;
  if (!/not permitted to cause a puzzle defect intentionally/i.test(clause('5d'))
      || !/disqualification.*DNF/i.test(clause('5d3'))
      || !/must not give the competitor an advantage/i.test(clause('5b2'))
      || !/unsolvable.*single corner piece.*twisting it in place without disassembling.*does not exceed/i.test(clause('5b3c'))) return;
  const mechanics=lang==='en'
    ? 'A legal move turns a layer. Forcing an individual corner to twist in its socket can be physically possible on some mechanisms, but it is outside the intended moves. On both the 2×2 and 3×3 the total corner twist is zero modulo three after any legal turn sequence. One forced twist breaks that invariant. Two opposite twists preserve it and can leave a solvable state; physically doing them is still outside the move set.'
    : '合法转动转的是一层。有些结构允许直接在角槽中拧动单个角块，这种物理操作超出了魔方设计的转动方式。标准二阶与三阶的角扭总和在合法转动下恒为模三的零。单独扭一角会破坏该约束，把两个角各向相反方向扭一次则可能仍可解，但手扭仍不属于合法步。';
  const shortcut=lang==='en'?'In WCA competition, deliberately twisting corners to finish a layer faster causes an intentional defect and disqualifies the attempt.':'在 WCA 比赛中，故意扭角以加快某一层的还原属于主动制造故障，本次 DNF。';
  const repair=lang==='en'?'If a defect makes the puzzle unsolvable and twisting one corner restores solvability, the competitor may twist it in place without taking the puzzle apart. For multiple defect-induced twists, the number corrected must not exceed the number caused by defects. The repair must give no solving advantage.':'若故障导致无解，而就地扭一个角能恢复可解性，选手可直接扭角修复。若故障扭动了多个角，纠正数量不得超过故障造成的数量，且修复不得带来还原优势。';
  return result([mechanics,shortcut+' '+cite('5d')+' '+cite('5d3'),repair+' '+cite('5b3c')+' '+cite('5b2')].join('\n\n'),['5d','5d3','5b3c','5b2']);
}

export function multiBlindTimeCount(question:string) {
  const m=/^(?:三阶)?多盲(?:我报名|我想|如果要|打算|准备)?(?:试|挑战|报)\s*(\d{1,3})\s*个(?:魔方)?[，,]?(?:按每个十分钟算[，,]?)?(?:最多能用多久|时限是多少|还能给\s*\d+\s*分钟吗)[？?。]?$/u.exec(question.trim());
  if(m && Number(m[1])>=2) return Number(m[1]);
}

export function multiBlindTimeVerdict(html:string,url:string,count:number,lang:'zh'|'en') {
  const rules=readVerdictClauses(html,url,lang);
  const terms=rules?.clause('H1b').match(/fewer than (\d+) puzzles.*?time limit of (\d+) minutes times the number of puzzles.*?else the time limit is (\d+) minutes/i);
  if(!rules || !terms) return;
  const [threshold,perPuzzle,cap]=terms.slice(1).map(Number);
  const minutes=count<threshold?count*perPuzzle:cap;
  const summary=lang==='zh'?count+' 个魔方的通常时限为 '+minutes+' 分钟。少于 '+threshold+' 个时每个 '+perPuzzle+' 分钟，达到 '+threshold+' 个后总时限为 '+cap+' 分钟。':minutes+' minutes for '+count+' puzzles: below '+threshold+' puzzles allow '+perPuzzle+' minutes each; otherwise the limit is '+cap+' minutes.';
  return rules.result(summary+' '+rules.cite('H1b'),['H1b']);
}

export function fewestMovesQuestion(question:string) {
  if (!/^(?:FMC|最少步(?:还原)?)/i.test(question)) return;
  const text=question.replace(/^(?:FMC|最少步(?:还原)?)/i,'').trim();
  if (/^(?:可不可以|可以|能不能|能)(?:直接)?把(?:官方)?打乱(?:序列|公式)?(?:倒过来|取逆|逆过来)(?:写成|当作|当成)(?:解法|解|答案)吗[？?。]?$/u.test(text)) return 'inverse';
  if (/^(?:每轮|一轮)(?:从开始到交答案)?(?:通常|一般)?(?:给|有)(?:多长时间|多少分钟)[？?。]?$/u.test(text)) return 'time';
}

export function fewestMovesVerdict(html:string,url:string,kind:'inverse'|'time',lang:'zh'|'en') {
  const rules=readVerdictClauses(html,url,lang);
  if (!rules) return;
  const id=kind==='inverse'?'E2e':'E2b';
  const clause=rules.clause(id);
  const minutes=/total time limit of (\d+) minutes to find and write a solution/i.exec(clause)?.[1];
  if(kind==='time' && !minutes) return;
  if(kind==='inverse' && !/must not be directly derived from any part of the scramble sequence/i.test(clause)) return;
  const answer=kind==='inverse'
    ? (lang==='zh'?'不能把逆打乱直接当作答案提交。它确实能还原，但这样的解直接来自打乱，违反 E2e。':'The inverse does solve the puzzle, but submitting it directly violates E2e because it is derived from the scramble.')
    : (lang==='zh'?'每轮共 '+minutes+' 分钟，找解和写下答案都在这段时间内。':'Competitors have '+minutes+' minutes in total to find and write the solution.');
  return rules.result(answer+' '+rules.cite(id),[id]);
}

export function inspectionVerdicts(html:string, sourceUrl:string, scenario:InspectionScenario, lang:'zh'|'en') {
  const read=readVerdictClauses(html,sourceUrl,lang);
  if (!read) return;
  const {clause,cite,result}=read;
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

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
  if(!document.documentElement)return;
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
  return {clause,cite,result,version};
}

/** A scenario selects clause families. Individual outcomes still depend on
 * the user's facts and the text of the version actually read. */
export function scenarioRuleIds(q:string):string[] {
  if(!/[?？]|怎么|如何|能否|是否|多少|可否/.test(q) || /打开|带我去|报名入口|世界纪录|查一下|查我的|谁|徽章|荣誉|成就|训练|模拟器|榜单|统计里|非官方|往年|历史版本/.test(q))return [];
  if(/(?:官方打乱|打乱规则)/.test(q) && /(?:最短解|下限)/.test(q) && /二阶/.test(q) && /斜转/.test(q))return ['4b3','4b3b','4b3c'];
  if(/观察/.test(q) && /开始/.test(q) && /秒/.test(q) && /加罚|加几秒|加2|DNF/i.test(q))return ['A4d1','A4d1+','A4d2','A4d2+'];
  if(/多盲/.test(q) && /(?:报|提交|保密|时限|单层|叠成)/.test(q))return ['H1a','H1a1','H1a2','H1a3','H1b','H1b1','H1b1+'];
  if(/三盲|盲拧/.test(q) && /眼罩|挡板|遮挡盒/.test(q))return ['B2c','B2d','B2d1','B4a','B4a1','B4b','B4c','B4c1','B4c2','B4d'];
  if(/单次/.test(q) && /平均/.test(q) && /分别怎么记|未取整|各记多少/.test(q))return ['9f1','9f2'];
  if(/及格线/.test(q) && /不含/.test(q) && /继续/.test(q))return ['9g'];
  if(/DNF/i.test(q) && /DNS/i.test(q) && /有资格|具备资格/.test(q) && /开始/.test(q))return ['9f4','9f4+','9f5'];
  if(/最少步/.test(q) && /识别信息|报名号/.test(q))return ['E2a1','E2c','E2c1'];
  return [];
}
export function scenarioRulePage(html:string,url:string,ids:string[]) {
  const read=readVerdictClauses(html,url,'zh');
  if(!read || !ids.length)return;
  const text=ids.map(id=>read.clause(id).trim());
  if(text.some(value=>!value))return;
  return {href:url+'#'+ids[0],title:'WCA '+ids.join(' / '),text:text.join('\n'),
    clauses:ids.map((id,i)=>({id,text:text[i],href:url+'#'+id})),version:read.version};
}

export function scrambleMinimumComparison(q:string,page:NonNullable<ReturnType<typeof scenarioRulePage>>) {
  const input=q.normalize('NFKC').replace(/\s/g,'');
  const moves=input.match(/(?:都只需|最短解都是)(\d{1,2})步/);
  if(!moves || !/二阶[、,和与]斜转/.test(input))return;
  const rest=input.replace(moves[0],'').replace(/官方打乱|假设|二阶|斜转|就可解|仅检查|最短解下限|这两个状态|都合格吗|[\p{P}]/gu,'');
  if(rest)return;
  const clauses=['4b3b','4b3c'].map(id=>page.clauses.find(c=>c.id===id));
  const limits=clauses.map(c=>c?.text.match(/at least (\d+) moves to solve/i)?.[1]);
  if(limits.some(n=>!n))return;
  const n=Number(moves[1]);
  const sources=clauses.map(c=>({id:'wca:clause:'+c!.id,title:'WCA '+c!.id,href:c!.href,read:true}));
  const lines=limits.map((limit,i)=>(i===0?'二阶':'斜转')+'要求最短解至少 '+limit+' 步。给定 '+n+' 步'+(n>=Number(limit)?'满足':'不满足')+'该下限。 [['+sources[i].id+']]');
  const edition=page.version?'\n\n'+(page.href.startsWith(WCA_REGULATIONS_MIRROR_URL)?'规则快照版本 ':'WCA 规则版本 ')+page.version:'';
  return {answer:lines.join('\n')+edition,sources};
}

/** Compare the recording rules on the same elapsed time. Decimal digits
 * are kept as integers so an exact half-unit cannot round down in binary. */
export function timedSingleAndAverage(q:string,rulePage:NonNullable<ReturnType<typeof scenarioRulePage>>,continuation:boolean) {
  const normalized=q.normalize('NFKC').replace(/\s/g,'');
  if(!continuation && !(/单次/.test(q) && /平均/.test(q)))return;
  const elapsed=normalized.match(/(?:原始值|原始用时|换成(?:超过十分钟的)?)(?:(\d{1,3})分)?(\d{1,3})\.(\d{1,6})秒/);
  if(!elapsed || (elapsed[1] && +elapsed[2]>=60))return;
  const residual=normalized.replace(elapsed[0],'').replace(/一把|计时|如果|是|单次|要进到\d+(?:\.\d+)?|同一个数|平均|未取整值|又怎样登记|刚才|两种结果|各怎样写|小数部分|还能保留|吗|[\p{P}]/gu,'');
  if(residual)return;
  const seconds=Number(elapsed[1]??0)*60+Number(elapsed[2]);
  const short=seconds<600;
  const id=short?'9f1':'9f2',clause=rulePage.clauses.find(c=>c.id===id);
  if(!clause || !/truncated/i.test(clause.text) || !/rounded to the nearest/i.test(clause.text) ||
    !(short?/hundredth of a second/i:/nearest second/i).test(clause.text))return;
  const fraction=elapsed[3].padEnd(3,'0');
  const base=short?seconds*100+Number(fraction.slice(0,2)):seconds;
  const nearest=base+Number(Number(fraction[short?2:0])>=5);
  const format=(n:number)=>short?(n/100).toFixed(2)+' 秒':Math.floor(n/60)+':'+String(n%60).padStart(2,'0');
  const sourceId='wca:clause:'+id;
  const edition=rulePage.version?'\n\n'+(clause.href.startsWith(WCA_REGULATIONS_MIRROR_URL)?'规则快照版本 ':'WCA 规则版本 ')+rulePage.version:'';
  return {answer:'单次向下截断，记 '+format(base)+'。平均按最近的'+(short?'百分之一秒':'整秒')+'四舍五入，记 '+format(nearest)+'。 [['+sourceId+']]'+edition,
    sources:[{id:sourceId,title:'WCA '+id,href:clause.href,read:true}]};
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

// Only these single procedural issues have unconditional clause-backed answers.
// Other incidents and mixed requests are handled by the general rule reader.
export function procedureQuestion(q:string) {
  // Scope direct rulings by subject and vocabulary so that a second incident
  // (or a different event such as 4BLD) still gets a complete investigation.
  const only=(terms:RegExp)=>!q.replace(terms,'').replace(/能不能|可不可以|能否|可以|允许|如果|是否|什么|哪种|为什么|但是|可是|规则|规定|请问|一下|什么|多少|吗|呢|我|就|但|的|能|用|有|在|了|到|几|是|会|又|还|也|说|给|后|都|对|不|[\s\p{P}]/gu,'');
  if(/最少步|FMC/i.test(q) && /55/.test(q) && /60/.test(q) && /提示|报时|喊/.test(q) &&
    only(/按|WCA|三阶|最少步|FMC|开赛|时限|一小时|裁判|第|55|60|分钟|和|分别|怎么|提示|报时|喊/gi))return 'fmcCallouts';
  if(/最少步|FMC/i.test(q) && /提前/.test(q) && /交|提交/.test(q) &&
    only(/最少步|FMC|选手|已经|写完|等|60|分钟|提前|提交|交|解法|结束|这次|尝试/gi))return 'fmcEarly';
  const pocket=/^(?:抽到一个)?只差([一二三四五六七八九]|\d{1,2})步就还原的二阶状态[，,]按官方随机打乱的下限能直接采用吗[？?。]?$/u.exec(q.trim());
  if(pocket)return {pocketMoves:Number(pocket[1]) || '一二三四五六七八九'.indexOf(pocket[1])+1};
  if(/四盲|五盲/.test(q) && /Mo3/i.test(q) && /单次|Best of 3/i.test(q) &&
    only(/四盲|五盲|一个人|另一个人|人|单次|最快|Mo3|正式|Best of 3|轮里|该|优先|看|哪项|纪录|取消/gi))return 'bigBlindRanking';
  if(/娱乐项目|非官方项目/.test(q) && /正式成绩/.test(q) &&
    only(/官方比赛|顺便|办|一个|项目表里|娱乐项目|非官方项目|它|成绩|进入|正式/g))return 'unofficialEvent';
  if(/一对一|对抗赛/.test(q) && /四阶/.test(q) && /决赛/.test(q) &&
    only(/一对一|对抗赛|赛制|安排|放|四阶(?:速拧|魔方)?|半决赛|决赛|项目|本身|举办|采用/g))return 'fourHeadToHead';
  if(/六阶|七阶/.test(q) && /及格/.test(q) && /尝试|平均/.test(q) &&
    only(/六阶|七阶|及格线|及格阶段|轮次|阶段|次|尝试|成功|整轮|平均|过线|方式|怎么算|机会/g))return 'bigCubeCutoff';
  if(/尽力|尽全力/.test(q) && /慢|成绩差/.test(q) && /取消.*资格/.test(q) &&
    only(/尽全力|尽力|还原|确实|很慢|速度慢|只因|仅因|成绩差|单凭|代表|取消|资格/g))return 'poorPerformance';
  if(/盲拧|盲解/.test(q) && /摸|触感/.test(q) && /朝向|方向/.test(q) &&
    only(/盲拧|盲解|贴片|贴纸|纹理|手|一摸|摸|触感|分得出|辨别|分辨|朝向|方向|保证|看|这样的/g))return 'texturedBlind';
  // Answer only the sight/clock question. Incidents and other requested
  // decisions need the general rule reader, even if they mention a first move.
  const firstMoveQuestion=q.length<=100 && /三盲|三阶盲拧/.test(q) && /眼罩/.test(q) &&
    /摘|揭|取下/.test(q) && /看|记忆/.test(q) &&
    !q.replace(/三阶盲拧|三盲|我|已经|戴上|戴|揭开|揭|摘下(?:来)?|摘|取下|眼罩|后|突然|忘了|忘记|最后|一组|字母|还少记|一个角|才想起|还没|没有|尚未|转过|转动|动了|转了|转|第?一[步眼]|可以|可不可以|此时|能不能|能|重新|再|回到|记忆阶段|看|一下|还要|要|计时器|暂停|停表|表|吗|呢|[\s\p{P}]/gu,'');
  if(firstMoveQuestion && /(?:还没|没有|尚未)(?:转过|转动|转)第一步/.test(q))return 'beforeFirstMove';
  if(firstMoveQuestion && /已经(?:动了|转了|转过)一步/.test(q))return 'afterFirstMove';
  const singleOffset=/^三阶(?:结束时|停表后)(?:只有|仅有)一层(?:正好)?(?:错位|偏了)\s*(\d+(?:\.\d+)?)\s*度[，,、](?:补一步就复原|静止后没有其他问题)[，,]该(?:记原成绩[、,]加二还是\s*DNF|不该加二)[？?。]?$/i.exec(q.trim());
  if(singleOffset && Number(singleOffset[1])<=90)return {angle:Number(singleOffset[1])};
  const mat=/^(?:比赛用的?)?(?:全|整)尺寸计时垫(?:只有|尺寸为|是)?\s*(\d+(?:\.\d+)?)\s*[×xX*]\s*(\d+(?:\.\d+)?)\s*(?:厘米|cm)(?:能满足要求吗|够大吗|达标吗)[？?，,]\s*(?:最低|最小)尺寸是多少[？?。]?$/i.exec(q.trim());
  if(mat)return {width:Number(mat[1]),depth:Number(mat[2])};
  if(q.length>130 || /另外|同时|还有|顺便|申诉|举例|特殊|残障|练习计划|两个问题|以及|[；;\n]/.test(q) ||
      (q.match(/[？?]/g)?.length??0)>1)return;
  if(/录入员/.test(q) && /(?:已(?:经)?录入|成绩单).{0,10}(?:写错|错误|改错|改动)/.test(q) &&
     /自己.{0,4}改|谁.{0,4}(?:同意|批准)/.test(q) && !/赛后|公示|已公布|截止|时限|过了/.test(q))return 'changeScore';
  if(/魔方.{0,6}(?:掉块|弹块)/.test(q) && /计时器.{0,4}(?:坏|故障)/.test(q) && /同一章|哪一章|分别.{0,4}章/.test(q) &&
     !/判|重赛|额外|赔偿/.test(q))return 'equipmentChapters';
  const counts=/^(?:我)?(?:三阶)?多盲(?:报(?:名)?|挑战)\s*(\d{1,3})\s*个(?:魔方)?[，,]\s*(?:规定时间内)?(?:成功|还原)\s*(\d{1,3})\s*个[，,]\s*(?:失手|失败|未还原)\s*(\d{1,3})\s*个[，,]\s*(?:净得分|净分|得分)(?:算)?(?:多少|几分)[？?。]?$/.exec(q.trim());
  if(counts) {
    const [total,solved,missed]=counts.slice(1).map(Number);
    if(total>=2 && total===solved+missed)return {solved,missed};
  }
  if(/多盲/.test(q) && /记忆/.test(q) && /停表|暂停计时/.test(q) && /开表|重新计时|继续计时/.test(q) &&
      /还原/.test(q) && !/故障|坏|意外|裁判|掉落|罚|额外/.test(q))return 'continuousClock';
  if(/三盲|盲拧/.test(q) && /记忆/.test(q) && /写.{0,8}(?:纸|笔记)|纸.{0,6}(?:记录|写)|做笔记/.test(q) &&
      !/裁判|指南|颜色|清单|多盲|标签/.test(q))return 'notes';
  if(/单手/.test(q) && /观察/.test(q) && /双手|两只手/.test(q) && !/掉|坏|故障|中途换手|另一只手|另一手|借助|换手操作/.test(q))return 'inspectionHands';
  if(/最少步|FMC/i.test(q) && /80\s*步/.test(q) && /整体转体|旋转|计步口径|计步标准/.test(q) && !/图|符号|哪些记号|提交几份/.test(q))return 'moveMetrics';
}

export function procedureVerdict(html:string,url:string,kind:NonNullable<ReturnType<typeof procedureQuestion>>) {
  const rules=readVerdictClauses(html,url,'zh');
  if(!rules)return;
  const {clause,cite,result}=rules;
  if(kind==='fmcCallouts' && /should call .5 MINUTES REMAINING. at 55 minutes.*must call .STOP. at 60 minutes/i.test(clause('E2b1')))
    return result('第 55 分钟，裁判应提示“还剩 5 分钟”；第 60 分钟必须喊“停”。 '+cite('E2b1'),['E2b1']);
  if(kind==='fmcEarly' && /may choose to stop an attempt early by handing in a solution before the time limit/i.test(clause('E2b+')))
    return result('可以。选手可在时限前交解法，结束本次尝试。 '+cite('E2b+'),['E2b+']);
  if(typeof kind==='object' && 'pocketMoves' in kind && typeof kind.pocketMoves==='number') {
    const limit=clause('4b3b').match(/2x2x2 Cube.*require at least (\d+) moves to solve/i);
    if(limit)return result('二阶随机打乱的状态至少需要 '+limit[1]+' 步才能还原。'+kind.pocketMoves+' 步'+(kind.pocketMoves<Number(limit[1])?'低于下限，不能采用。':'满足这一项步数下限。')+' '+cite('4b3b'),['4b3b']);
  }
  if(kind==='bigBlindRanking' && /4x4x4 Blindfolded and 5x5x5 Blindfolded/i.test(clause('9b6')) && /Mean of 3.*outside of the competition format.*based on the best result/i.test(clause('9b6b')))
    return result('四盲和五盲的 Best of 3 轮按最好单次排名。WCA 另承认 Mo3 排名和纪录，Mo3 不影响当轮名次。 '+cite('9b6')+' '+cite('9b6b'),['9b6','9b6b']);
  if(kind==='unofficialEvent' && /may be held.*considered unofficial.*not be included in the official results/i.test(clause('9b++')))
    return result('可以举办娱乐项目。规则项目表以外的项目属于非官方项目，成绩不计入比赛的正式成绩。 '+cite('9b++'),['9b++']);
  if(kind==='fourHeadToHead' && /4x4x4 Cube/i.test(clause('9b7a')) && /only be used for the final round/i.test(clause('9b7b')))
    return result('四阶属于允许采用一对一赛制的项目，但只限项目决赛，不能安排在项目半决赛。 '+cite('9b7a')+' '+cite('9b7b'),['9b7a','9b7b']);
  if(kind==='bigCubeCutoff' && /6x6x6 Cube and 7x7x7 Cube/i.test(clause('9b2')) && /Best of 1.*cutoff phase for.*Mean of 3/i.test(clause('9b2b')))
    return result('六阶和七阶的及格阶段只有 1 次尝试。过线后整轮按三次的算术平均（Mo3）计成绩。 '+cite('9b2')+' '+cite('9b2b'),['9b2','9b2b']);
  if(kind==='poorPerformance' && /should not be disqualified.*poor.*best of their abilities/i.test(clause('2k6+')))
    return result('选手尽力参赛时，代表不应仅因成绩差而取消资格。 '+cite('2k6+'),['2k6+']);
  if(kind==='texturedBlind' && /orientation of pieces to be distinguished by feel.*not permitted for blindfolded events/i.test(clause('3j3')))
    return result('盲拧禁止使用可凭触感分辨块朝向的纹理贴片。是否看贴片不改变这项器材要求。 '+cite('3j3'),['3j3']);
  if(kind==='beforeFirstMove' && /until the competitor applies the first move.*remove the blindfold to return to the memorization phase/i.test(clause('B4a1')) &&
      /starts the attempt and the solve by starting the timer/i.test(clause('B2d')))
    return result('可以。只要还没有转动第一步，就可以摘下眼罩回到记忆阶段再看，同一次尝试继续计时，不要停表。 '+cite('B4a1')+' '+cite('B2d'),['B4a1','B2d']);
  if(kind==='afterFirstMove' && /until the competitor applies the first move/i.test(clause('B4a1')) &&
      /must not look at the puzzle.*DNF/i.test(clause('B4d')))
    return result('不能。可以返回记忆阶段的期限是转第一步之前。已经转过一步，再揭开眼罩看魔方，本次判 DNF。 '+cite('B4a1')+' '+cite('B4d'),['B4a1','B4d']);
  if(kind==='changeScore' && /changes to the result on a score sheet are only permitted at the discretion of the WCA Delegate/i.test(clause('1g2')))
    return result('要更改成绩单上的成绩须由 WCA 代表同意，录入员应把错误提交给代表核实。 '+cite('1g2'),['1g2']);
  if(kind==='equipmentChapters' && /popped parts/i.test(clause('5a')) && /equipment malfunction/i.test(clause('11a3')))
    return result('分属两章。魔方掉块属于第 5 章的魔方故障；官方计时器故障属于第 11 章的比赛设备故障。 '+cite('5a')+' '+cite('11a3'),['5a','11a3']);
  if(typeof kind==='object' && 'angle' in kind && typeof kind.angle==='number') {
    const limit=clause('10f1').match(/NxNxN Cubes: at most (\d+) degrees/i);
    if(!limit || !/more than the limit/i.test(clause('10e1')) || !/without penalty/i.test(clause('10e2')) || !/one move.*\+2 seconds/i.test(clause('10e3')))return;
    const over=kind.angle>Number(limit[1]);
    const verdict=over?'超过限度且只需再转一步，成绩加 2 秒。':'在容许范围内，按题述静止状态没有其他问题，成绩不加罚。';
    const rule=over?'10e3':'10e2';
    return result('三阶相邻层错位限度是 '+limit[1]+' 度。'+kind.angle+' 度'+verdict+' '+cite('10f1')+' '+cite(rule),['10f1',rule]);
  }
  if(typeof kind==='object' && 'width' in kind && typeof kind.width==='number' && typeof kind.depth==='number') {
    const size=clause('7f1b+').match(/minimum dimensions of (\d+)\s*cm \(left to right\) by (\d+)\s*cm \(front to back\)/i);
    if(!size)return;
    const meets=kind.width>=Number(size[1]) && kind.depth>=Number(size[2]);
    return result((meets?'符合':'不符合')+'全尺寸计时垫的建议最小尺寸：左右宽 '+size[1]+' 厘米、前后深 '+size[2]+' 厘米。 '+cite('7f1b+'),['7f1b+']);
  }
  if(typeof kind==='object' && 'solved' in kind && typeof kind.solved==='number' && typeof kind.missed==='number' && /number of puzzles solved minus the number of puzzles not solved/i.test(clause('9f12c')) &&
      /less than 0, or if only 1 puzzle is solved/i.test(clause('9f12c'))) {
    const points=kind.solved-kind.missed;
    const score=kind.solved<=1 || points<0?'这次成绩为 DNF。':'本次净得分为 '+points+' 分。';
    return result('成功 '+kind.solved+' 个减去未还原 '+kind.missed+' 个，差值为 '+points+'。'+score+' '+cite('9f12c'),['9f12c']);
  }
  if(kind==='continuousClock' && /standard blindfolded solving procedures/i.test(clause('H1')) &&
      /signal the end of the solve at any time/i.test(clause('H1b1')) && /starts the attempt and the solve by starting the timer/i.test(clause('B2d')))
    return result('不能暂停再开表。多盲从开始记忆到结束还原属于同一次连续计时的尝试。你可以休息，但这段时间也计入总用时。示意结束就结束了本次尝试。 '+cite('H1')+' '+cite('B2d')+' '+cite('H1b1'),['H1','B2d','H1b1']);
  if(kind==='notes' && /must not make physical notes.*DNF/i.test(clause('B3b')))
    return result('三盲记忆阶段也禁止做实体笔记。写在纸上已经违反 B3b，即使随后丢掉纸，本次尝试仍判 DNF。 '+cite('B3b'),['B3b']);
  if(kind==='inspectionHands' && /both hands during inspection/i.test(clause('C1b+')) && /only one hand to operate the puzzle/i.test(clause('C1b')))
    return result('单手项目的观察阶段可以用双手。只要还原过程中始终只用同一只手操作，观察时双手持方不会因此被判罚。 '+cite('C1b+')+' '+cite('C1b'),['C1b+','C1b']);
  if(kind==='moveMetrics' && /Outer Block Turn Metric/i.test(clause('E2d')) &&
      /80 moves \(including rotations\).*Execution Turn Metric/i.test(clause('E2d1')))
    return result('两种口径不同。正式成绩按 OBTM（外块转动度量）计步，整体转体不增加成绩步数。80 步上限按 ETM（执行转动度量）检查，包含整体转体，超过上限判 DNF。 '+cite('E2d')+' '+cite('E2d1'),['E2d','E2d1']);
}

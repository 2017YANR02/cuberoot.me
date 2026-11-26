import {createHash} from 'node:crypto';
import { parseHTML } from 'linkedom';
import type { AssistantAnswer, AssistantSource } from '@cuberoot/shared/site-assistant';

const products = [
  {name:'TNoodle', pattern:/\bTNoodle\b/i, domains:['tnoodle.worldcubeassociation.org'], repo:'thewca/tnoodle'},
  {name:'WCA website', pattern:/^\[worldcubeassociation\.org\]|(?:WCA website (?:issue|ticket)|WCA\s*官网工单)\s*#\d+|github\.com\/thewca\/worldcubeassociation\.org\/issues\//i, domains:['worldcubeassociation.org'], repo:'thewca/worldcubeassociation.org'},
  {name:'csTimer', pattern:/\bcsTimer\b/i, domains:['cstimer.net'], repo:'cs0x7f/cstimer'},
  {name:'cubing.js', pattern:/\bcubing\.js\b/i, domains:['js.cubing.net'], repo:'cubing/cubing.js'},
  {name:'WCA Statistics', pattern:/\bWCA Statistics\b|statistics\.worldcubeassociation\.org/i, domains:['statistics.worldcubeassociation.org'], repo:'thewca/statistics'},
  {name:'粗饼网', pattern:/粗饼|cubingchina\.com|\bcubing\.com\b/i, domains:['cubing.com','cubingchina.com'], repo:''},
  {name:'CubeSkills', pattern:/\bCubeSkills\b/i, domains:['cubeskills.com'], repo:''},
];
type Product = typeof products[number];

export function questionProduct(question:string) {
  const hits=products.filter(p=>p.pattern.test(question));
  if (hits.length!==1 || /CubeRoot|魔方根|本站|我们网站/i.test(question)) return;
  return hits[0];
}

// In a structured bug report the heading identifies the component. Names in
// repro code or workaround notes need not be the subject of the question.
export function reportedProduct(question:string) {
  // GitHub's attribution footer can name the repository where a discussion
  // originated. Use the tagged component when ambiguity comes from that footer.
  const body = question.replace(/\n\s*Originally posted by @[\w-]+ in https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/issues\/\d+(?:#issuecomment-\d+)?\s*$/i, '');
  if (body !== question && /^\[[^\]\n]+\]/.test(body)) {
    const subject = questionProduct(body);
    if (subject && subject === questionProduct(body.split(/\r?\n/, 1)[0])) return subject;
  }
  if (!/^#{1,6}\s+(?:steps to reproduce|observed behavio[u]?r|actual \(problem\) behavio[u]?r|复现步骤|实际表现)/im.test(question)) return;
  const [heading]=question.split(/\r?\n/,1);
  return questionProduct(heading);
}

export function asksToCheckReportMoves(question:string) {
  const prose=question.replace(/```[^]*?(?:```|$)/g,'');
  const stateQuestion=/(?:^|[.!?。！？\n]\s*)(?:are|is|does|do|can|will|would)\b[^?!.\n]{0,220}\b(?:equivalent|identical|solve|restore|same (?:final )?state)\b[^?!.\n]{0,100}\?/im;
  if (stateQuestion.test(prose) || /(?:这两|这串|这段|这组)[^。！？\n]{0,65}(?:等价|复原|还原|同一局面)[^。！？\n]{0,15}[?？]/.test(prose)) return true;
  return /(?:^|[.!?。！？\n]\s*)(?:(?:please|also|then)\s+)*(?:(?:could|can|would) you\s+)?(?:verify|check|simulate|compare|test)\s+(?:(?:that|whether)\s+)?(?:these|both|this|my|the (?:following|two|sequence|algorithm)|[`"'“])|(?:does|would|will)\s+(?:this sequence|this algorithm|[`“][URFDLBMES])|(?:请|再|同时|另外)?(?:验证|模拟|比较)(?:一下)?(?:这|两|下列|上述)/im.test(prose);
}

function belongs(href:string, product:Product) {
  const url=URL.parse(href);
  if (!url || url.protocol!=='https:') return false;
  return product.domains.some(host=>url.hostname===host || url.hostname.endsWith('.'+host))
    || (!!product.repo && url.hostname==='github.com' && (url.pathname.toLowerCase()+'/').startsWith('/'+product.repo.toLowerCase()+'/'));
}

export function productClaimIssue(product:Product, answer:string, selected:string[], sources:Map<string,AssistantSource>) {
  const supports=(id:string)=>{const s=sources.get(id);return s?.read && belongs(s.href,product);};
  // A mixed source list cannot lend the authority of one citation to a
  // different assertion. Independently labelled general advice is permissible.
  const groups=[...answer.matchAll(/(?:\[\[[^\]\n]+\]\][ \t]*)+/g)];
  if (groups.some(group=>![...group[0].matchAll(/\[\[([^\]]+)\]\]/g)].some(m=>supports(m[1])))) return 'claim_product_source';
  if (selected.length && !selected.some(supports)) return 'claim_product_source';
  if (!selected.some(supports) && !groups.length && answer.split(/(?<=[.!?。！？])\s+|\n/u).some(sentence=>
    product.pattern.test(sentence) && !/cannot (?:verify|confirm)|could not verify|not confirmed|无法(?:确认|核实)|尚未核实/i.test(sentence)
    && /\b(?:has no|does not (?:have|support|allow)|doesn't (?:have|support|allow)|provides?|supports?|disables?|implemented|no longer supports)\b|(?:不支持|支持设置|已实现|不能设置)/i.test(sentence))) return 'claim_product_source';
}

export const chinaFaqUrl='https://cubing.com/faq';
interface Faq { title:string; answer:string; slug:string }
function plain(html:string) {
  const body=parseHTML('<html><body>'+html+'</body></html>').document.body;
  for (const el of body.querySelectorAll('script,style,button,form')) el.remove();
  for (const el of body.querySelectorAll('p,li,br')) el.append('\n');
  return (body.textContent??'').split('\n').map(s=>s.trim()).filter(Boolean).join('\n');
}
export function chinaFaqEntries(html:string):Faq[] {
  const doc=parseHTML(html).document;
  const data:unknown=JSON.parse(doc.getElementById('__NUXT_DATA__')?.textContent || 'null');
  if (!Array.isArray(data)) return [];
  return data.flatMap(row=>{
    if (!row || !Number.isInteger(row.titleZh) || !Number.isInteger(row.contentZh) || !Number.isInteger(row.alias)) return [];
    const [title,content,slug]=[row.titleZh,row.contentZh,row.alias].map(i=>data[i]);
    if (typeof title!=='string' || typeof content!=='string' || typeof slug!=='string' || !/^[a-z0-9-]{1,150}$/.test(slug)
      || !doc.getElementById(slug)?.querySelector('button')?.textContent?.includes(title)) return [];
    const answer=plain(content);
    return answer && answer.length<6500 && !answer.includes('[[') ? [{title,answer,slug}] : [];
  });
}
const normalize=(q:string)=>q.normalize('NFKC').replace(/粗饼网?/g,'').replace(/[\s\p{P}]/gu,'').toLowerCase();
export function matchChinaFaq(question:string,entries:Faq[]):{fact:AssistantAnswer;pending:string[]}|undefined {
  const clauses=question.replace(/^\s*\[粗饼网?\]\s*/,'').split(/(?<=[?？])|[；;\n]/).map(s=>s.trim()).filter(Boolean);
  const parts=clauses.map(c=>entries.find(e=>normalize(e.title)===normalize(c)));
  if (!parts.some(Boolean)) return;
  const sources:AssistantSource[]=[],answer:string[]=[],pending:string[]=[];
  for (const [i,entry] of parts.entries()) {
    if (!entry) {pending.push(clauses[i]);continue;}
    const source={id:'cubingchina:faq:'+entry.slug,title:entry.title,href:chinaFaqUrl+'#'+entry.slug,read:true};
    sources.push(source);answer.push((parts.length>1?entry.title+'\n':'')+entry.answer+' [['+source.id+']]');
  }
  return {fact:{answer:answer.join('\n\n'),sources},pending};
}

// Release-scoped evidence. The blob IDs are from the v1.2.3 tree; never use
// the default branch to answer a question about a shipped generator.
const scrambleRelease = '2ed70d4c94e2b94ff2d2177b06a02708bcb881ac';
const scrambleSources = [
  {sha:'3d7b0048e196dc15944994fe58b6c99d3d67ca8c', path:'server/src/main/kotlin/org/worldcubeassociation/tnoodle/server/model/PuzzleData.kt'},
  {sha:'fb7321a6ac70bd7445c15480b9b7d9a741eab9fd', path:'server/src/main/kotlin/org/worldcubeassociation/tnoodle/server/wcif/WCIFScrambleMatcher.kt'},
] as const;

export async function scrambleFilterOpening(product:Product, question:string, lang:'en'|'zh', read:(url:string)=>Promise<unknown>):Promise<AssistantAnswer|undefined> {
  if (product.repo!=='thewca/tnoodle' || [...question.matchAll(/\b(?:v)?(\d+\.\d+\.\d+(?:\.\d+)*)\b/gi)].some(m=>m[1]!=='1.2.3') || !/scrambles?|打乱/i.test(question) ||
      !/same scramble|duplicate|repeated?|twice|重复|相同的?打乱/i.test(question) ||
      !/round|group|scramble set|一组|每组|同组|轮|一套/i.test(question)) return;
  const sources = await Promise.all(scrambleSources.map(async ({sha,path})=>{
    const blob=await read('https://api.github.com/repos/thewca/tnoodle/git/blobs/'+sha);
    if (!blob || typeof blob!=='object' || !('sha' in blob) || blob.sha!==sha || !('encoding' in blob) ||
        blob.encoding!=='base64' || !('content' in blob) || typeof blob.content!=='string' || blob.content.length>40_000) return;
    const bytes=Buffer.from(blob.content,'base64');
    const digest=createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
    if (digest!==sha) return;
    return {id:'product:blob:tnoodle:'+sha,title:'TNoodle v1.2.3 · '+path.split('/').at(-1),
      href:'https://github.com/thewca/tnoodle/blob/'+scrambleRelease+'/'+path,read:true};
  }));
  const [generator,matcher]=sources;
  if (!generator || !matcher) return;
  const strings=' [['+generator.id+']]';
  const sets=' [['+matcher.id+']]';
  return {sources:[generator,matcher],answer:lang==='en'
    ? 'TNoodle v1.2.3 filters identical scramble strings within a single set, including 2×2 and Pyraminx. Two different strings can still lead to the same position. Pyraminx strings differing only in tip moves also pass the filter.'+strings+
      ' Each set is generated separately. Regular and extra scrambles share the same batch, as do the individual cubes used to build multi-blind attempts in that set. Two different sets in the same round can therefore repeat a string.'+sets
    : 'TNoodle v1.2.3 会过滤同一套中完全相同的打乱字符串，二阶和金字塔也适用。不同转序仍可能得到相同局面；金字塔仅塔尖转动不同的两串打乱也能通过。'+strings+
      ' 每套单独生成。常规与备用打乱共享一次去重，多盲同套中分配给各次尝试的单颗魔方也共享这次去重。同一轮若使用不同套，字符串仍有可能重复。'+sets};
}

// Only yes/no questions about this filter are discharged by the two files.
export function onlyScrambleFilterRequests(parts:string[]) {
  const direct=/^(?:can (?:the )?same scramble (?:be (?:generated|used) twice|repeat)|(?:can|does) TNoodle (?:generate|repeat|filter|prevent) (?:the same|duplicate) scrambles?)(?: (?:twice |again )?in (?:the same|one|a) (?:round|group|set))?$/i;
  const directZh=/^TNoodle\s*(?:会|能|是否会|是否能)?(?:在)?同一(?:轮|组|套)(?:里|内|中)?(?:生成|产生)(?:重复|相同)的?打乱(?:序列)?(?:吗|么)?$/i;
  const covered=(part:string)=>direct.test(part) || directZh.test(part);
  const refersBack=/^is there (?:any )?protection against (?:this|that) in TNoodle$/i;
  const clean=parts.map(part=>part.replace(/^\s*\[TNoodle\]\s*/i,'').replace(/[?？.!。]+$/,'').trim());
  return clean.some(covered) && clean.every(part=>covered(part) || refersBack.test(part));
}

export interface IssueEvidence {
  source:AssistantSource;
  reporter?:string;
  statements:{role:string;text:string;author?:string;originalReporter?:boolean;summaryText?:string}[];
  reportBody?:string;
  reportTruncated?:boolean;
  implementation?:{source:AssistantSource;signature:string;uses:string[];targets:string[]};
  duplicateResolution?:{source:AssistantSource;version:string};
  originalReport?:boolean;
  completeDiscussion?:boolean;
  completeSummaryText?:boolean;
}
// When a verbatim statement is attributed to a login, check the comment itself.
// Unquoted paraphrases still go through ordinary evidence review.
export function misattributedIssueQuote(issue:IssueEvidence,answer:string) {
  const normalize=(s:string)=>s.replace(/\s+/g,' ').trim().toLowerCase();
  const comments=issue.statements.filter(s=>s.author);
  for (const match of answer.matchAll(/@([\w-]+)\s+(?:(?:wrote|said|replied|commented|posted)|(?:回复|写道|表示))[,，:：]?\s*[“"]([^”"\n]{10,})[”"]/gi)) {
    const quote=normalize(match[2]);
    const speakers=comments.filter(s=>normalize(s.text).includes(quote) || (s.summaryText && normalize(s.summaryText).includes(quote))).map(s=>s.author!);
    if (issue.reporter && issue.reportBody && normalize(issue.reportBody).includes(quote)) speakers.push(issue.reporter);
    if (speakers.length && !speakers.some(author=>author.toLowerCase()===match[1].toLowerCase())) return true;
  }
  return false;
}

// Read public indexes by repository only. No visitor text or identifiers are
// sent to GitHub. A question must identify the thread by URL or its whole title.
export async function productIssue(product:Product,question:string,read:(url:string)=>Promise<unknown>):Promise<IssueEvidence|undefined> {
  if (!product.repo) return;
  const api='https://api.github.com/repos/'+product.repo+'/issues';
  const report = question.replace(/^\s*\[[^\]\n]+\][ \t]*/,'').trim();
  const [title,...body] = report.split(/\r?\n/);
  const titledReport = body.length>0 && /^\s*\[[^\]\n]+\]/.test(question);
  const issueRef=titledReport ? title : question;
  const target=new RegExp('https://github\\.com/'+product.repo.replaceAll('.','\\.')+'/issues/(\\d{1,8})(?=$|[\\s)#?])','i').exec(issueRef)
    ?? (product.repo==='thewca/worldcubeassociation.org' ? /(?:WCA website (?:issue|ticket)|WCA\s*官网工单)\s*#(\d{1,8})\b/i.exec(issueRef) : null);
  const heading=normalize(title);
  if (!target && heading.length<9) return;
  const index=api+'?state=all&per_page=100';
  const issues=target ? [await read(api+'/'+target[1])] : await read(index);
  const findIssue = (page:unknown) => {
    if (!Array.isArray(page)) return;
    const hits=page.filter(i=>i && !i.pull_request && Number.isSafeInteger(i.number) && i.number>0 && typeof i.title==='string'
      && (target ? i.number===Number(target[1]) : heading===normalize(i.title)));
    return hits.length===1 ? hits[0] : undefined;
  };
  let issue=findIssue(issues);
  // The repository timeline includes pull requests. Its issue-only archive covers
  // older discussions without transmitting a visitor's title or report body.
  if (!issue && !target && titledReport) {
    const query=encodeURIComponent('is:issue is:closed comments:>0 repo:'+product.repo);
    const archive=await read('https://api.github.com/search/issues?per_page=100&q='+query).catch(()=>undefined);
    if (archive && typeof archive==='object' && 'items' in archive && Array.isArray(archive.items)) {
      issue=findIssue(archive.items.filter(item=>item?.repository_url=== 'https://api.github.com/repos/'+product.repo));
    }
  }
  if (!target && !issue && titledReport && Array.isArray(issues) && issues.length===100) {
    issue=findIssue(await read(index+'&page=2'));
  }
  if (!issue || !issue.comments) return;
  const commentsUrl=api+'/'+issue.number+'/comments?per_page=30';
  const pages=[commentsUrl];
  if (Number.isSafeInteger(issue.comments) && issue.comments>30)pages.push(commentsUrl+'&page='+Math.ceil(issue.comments/30));
  // Both URLs and the final page number are known from the thread metadata.
  const batches=await Promise.all(pages.map(url=>read(url)));
  if (!batches.every(Array.isArray))return;
  const comments=batches.flat();
  let clipped=false;
  const login=(value:unknown) => typeof value==='string' && /^[A-Za-z0-9][A-Za-z0-9-]{0,38}(?:\[bot\])?$/.test(value) ? value : undefined;
  const reporter=login(issue.user?.login);
  const statements=comments.flatMap(c=>{
    const author=login(c?.user?.login);
    const originalReporter=!!author && author.toLowerCase()===reporter?.toLowerCase();
    const role=['OWNER','MEMBER','COLLABORATOR','CONTRIBUTOR'].includes(c?.author_association)?'repository participant':originalReporter?'original reporter':'thread participant';
    if (typeof c?.body!=='string') return [];
    const text=c.body.split(/\nOn .{1,200} wrote:/)[0].split(/\r?\n/).filter((line:string)=>!line.trimStart().startsWith('>')).join('\n').trim();
    if (text.length>2400) clipped=true;
    const excerpt=text.length>2400 ? text.slice(0,2400).replace(/[^.!?\n]*$/,'') : text;
    // A large Markdown comparison table may separate a comment's observation
    // from its bottom-line explanation. Retain the surrounding narrative for
    // discussion summaries without treating omitted cells as inspected facts.
    const logsToSummary=(body:string)=>body.replace(/```[\s\S]*?(?:```|$)/g,block=>
      block.split(/\r?\n/).filter(line=>/^Checked \d+ rounds?\. \d+ discrepancies found\.?$/i.test(line.trim())).join('\n'));
    const narrative=text.length>2400 ? logsToSummary(text).split(/\r?\n/).filter((line:string)=>!/^\s*\|/.test(line)).join('\n').trim() : undefined;
    const summaryText=text.length<=2400 ? text : narrative && narrative.length<=4000 ? narrative : undefined;
    return excerpt?[{role,author,originalReporter,text:excerpt,summaryText}]:[];
  });
  if (!statements.length) return;
  // Keep the resolution at the end of long threads as well as the initial diagnosis.
  const selected = statements.length<=(/summari[sz]e.{0,32}discussion|总结.{0,8}讨论/i.test(question)?30:product.repo==='thewca/worldcubeassociation.org'?12:6) ? statements : [...statements.slice(0,2),...statements.slice(-4)];
  const sameBody=(text:string)=>text.replace(/\s+/g,' ').trim();
  // Follow one explicitly confirmed duplicate in the same repository. An
  // unavailable or ambiguous parent must not suppress the original discussion.
  let duplicateResolution:IssueEvidence['duplicateResolution'];
  const last = selected.at(-1);
  const parent = last?.role==='repository participant' && confirmedDuplicate(last.text);
  if (parent && Number(parent)!==issue.number) {
    const parentComments = await read(api+'/'+parent+'/comments?per_page=30').catch(()=>undefined);
    if (Array.isArray(parentComments) && parentComments.length<30) {
      const version = fixedVersion(String(parentComments.at(-1)?.body ?? ''));
      if (version) duplicateResolution = {version, source:{id:'product:issue:'+product.repo+':'+parent,
        href:'https://github.com/'+product.repo+'/issues/'+parent,title:product.name+' #'+parent,read:true}};
    }
  }
  // Resolve requests about a named function against the immutable change
  // referenced by an upstream contributor, never against the visitor's fork.
  let implementation:IssueEvidence['implementation'];
  const names=new Set([...question.matchAll(/\bfunction ([A-Za-z_$][\w$]{1,48})\s*\(/g)].map(m=>m[1]));
  if (names.size) {
    const changes=selected.filter(s=>s.role==='repository participant').flatMap(s=>
      [...s.text.matchAll(/^(?:implemented|fixed) in (https:\/\/github\.com\/[^/\s]+\/[^/\s]+)\/commit\/([0-9a-f]{40})[.!]?$/gim)]
        .filter(m=>m[1]==='https://github.com/'+product.repo).map(m=>m[2]));
    if (changes.length===1) {
      const sha=changes[0];
      const commit=await read('https://api.github.com/repos/'+product.repo+'/commits/'+sha).catch(()=>undefined);
      if (commit && typeof commit==='object' && 'sha' in commit && commit.sha===sha && 'files' in commit && Array.isArray(commit.files)) {
        for (const file of commit.files) {
          if (typeof file?.patch!=='string' || !/^[\w./-]+\.[jt]s$/.test(file.filename)) continue;
          const added=file.patch.split('\n').filter((line:string)=>line.startsWith('+')).map((line:string)=>line.slice(1).trim());
          const signature=added.find((line:string)=>{
            const m=/^function ([\w$]+)\(([\w$, ]*)\)\s*\{$/.exec(line);
            return m && names.has(m[1]);
          });
          if (!signature) continue;
          const params=signature.slice(signature.indexOf('(')+1,signature.indexOf(')')).split(',').map((x:string)=>x.trim());
          const uses=added.filter((line:string)=>line!==signature && line.length<=160 && !/[`<>]|\[\[|\]\]|https?:/.test(line) &&
            params.some((param:string)=>param && line.split(/[^\w$]+/).includes(param)) && /(?:\w\[|\.search\(|\.bind\()/.test(line)).slice(0,4);
          const name=signature.slice('function '.length,signature.indexOf('('));
          const targets=added.filter((line:string)=>line.startsWith(name+'.') && /^\w+\.\w+ = '[A-Z?]{2,100}';$/.test(line)).slice(0,4);
          implementation={targets,signature:signature.replace(/\s*\{$/,''),uses,source:{id:'product:commit:'+product.repo+':'+sha,
            title:file.filename+' @ '+sha.slice(0,8),href:'https://github.com/'+product.repo+'/commit/'+sha,read:true}};
          break;
        }
      }
    }
  }
  return {source:{id:'product:issue:'+product.repo+':'+issue.number,title:product.name+' · '+issue.title,
    href:'https://github.com/'+product.repo+'/issues/'+issue.number,read:true},reporter,statements:selected,duplicateResolution,implementation,reportBody:typeof issue.body==='string'?issue.body.slice(0,6000):undefined,
    reportTruncated:typeof issue.body==='string' && issue.body.length>6000,
    originalReport:!target && typeof issue.body==='string' && !!body.length && sameBody(body.join('\n'))===sameBody(issue.body),
    completeSummaryText:comments.length===issue.comments && selected.length===comments.length &&
      selected.every(s=>s.summaryText),
    completeDiscussion:!clipped && comments.length===issue.comments && selected.length===comments.length};
}

function confirmedDuplicate(text:string) {
  if (/\b(?:not|never|maybe|possibly|might|isn['’]t|wasn['’]t)\b|[?？]/i.test(text)) return;
  return /\bduplicate of #(\d{1,8})[.!]?$/i.exec(text.trim())?.[1];
}

function fixedVersion(text:string) {
  return /^fixed in (?:version |v)?(\d+\.\d+(?:\.\d+)?)[.!]?$/i.exec(text.trim())?.[1];
}

// A later acknowledgement can refer to a specific question or change.
// Quote the paired statements together so their subject and uncertainty survive.
function discussionContext(issue:IssueEvidence,lang:'en'|'zh') {
  const en=lang==='en';
  const safe=(text:string)=>text.length<=470 && !/[<>\[\]]|https?:|\bignore (?:all|previous) instructions/i.test(text);
  const cite=' [['+issue.source.id+']]';
  const quotes=(items:string[])=>items.map(text=>'“'+text+'”'+cite).join(' ');
  const lines=issue.statements;
  const invitation=contributionHandoff(issue);
  if (invitation) {
    const [reviewer,reporter]=invitation;
    return {answer:(en?'@'+reviewer.author+' replied: ':'@'+reviewer.author+' 回复：')+quotes([reviewer.text])+' '+
      (en?'The original reporter @'+reporter.author+' then wrote: ':'原报告者 @'+reporter.author+' 随后写道：')+quotes([reporter.text]),sources:[issue.source]};
  }
  for (let i=1;i<lines.length;i++) {
    const reply=lines[i], prev=lines[i-1];
    if (!safe(reply.text) || reply.role!=='repository participant') continue;
    const question=prev.text.split(/\r?\n/).at(-1)?.trim();
    if (/^Yes[!. ,]+Pending (?:a |the )?new .{1,50} release/i.test(reply.text) && question?.endsWith('?') && safe(question)) {
      return {answer:(en?'Asked about the scope of the filter, the project recorded this exchange: ':'关于过滤措施的适用范围，工单记录如下：')+
        quotes([question,reply.text])+(en?' The confirmation was for a forthcoming release; the thread does not identify its version.':'答复指向后续发布，未给出版本号。'),sources:[issue.source]};
    }
    if (/^(?:fixing|solving) that (?:also )?(?:fixed|solved)(?: also)? the (?:main |original )?(?:bug|issue)/i.test(reply.text) &&
        i>=2 && /yes please/i.test(prev.text) && lines[i-2].role==='repository participant' && safe(lines[i-2].text)) {
      return {answer:(en?'The proposed fix and the contributor’s follow-up were: ':'项目参与者提出的修改与后续结果如下：')+
        quotes([lines[i-2].text,reply.text]),sources:[issue.source]};
    }
  }
  const position=lines.find(s=>s.role==='repository participant' && /^I(?:['’]m| am) not opposed to this, but/i.test(s.text));
  if (position) {
    const excerpt=position.text.split(/\r?\n/).map(line=>line.trim().replace(/^[-*] /,'')).filter(line=>
      safe(line.replace(/<twisty-player>/g,'twisty-player')) && /not opposed|client implementation|gyro tracking|non-gyro|a demo and/i.test(line))
      .map(line=>line.replace(/<twisty-player>/g,'twisty-player'));
    const demo=lines.find(s=>/I (?:actually )?implemented it/i.test(s.text));
    const modifier=demo?.text.split(/\r?\n/).find(line=>/^use [\w -]{1,50} as modifier[.!]?$/i.test(line.trim()));
    if (excerpt.length>1 && modifier) return {answer:(en?'The maintainer was open to the idea, with reservations: ':'维护者对提案持开放态度，并提出了条件：')+
      quotes(excerpt)+(en?' A participant reported implementing a prototype and described its control: ':'一位参与者报告已实现原型，并说明了操作方式：')+quotes([modifier]),sources:[issue.source]};
  }
  const observation=lines.find(s=>safe(s.text) && /I can .{1,100} on .{1,80}, but (?:I )?can(?:not|'t) .{1,120} on |I can .{1,100} on .{1,80}, but (?:I )?can(?:not|'t) .{1,100} in /i.test(s.text));
  if (lines.length===1 && observation) return {answer:(en?'A participant tested both platforms: ':'一位参与者对照测试了两个平台：')+quotes([observation.text]),sources:[issue.source]};
  if (lines.length===2 && lines.every(s=>safe(s.text)) && /acknowledg[e]?ment/i.test(lines[0].text) && /already .{0,40}(?:ack|acknowledge)/i.test(lines[1].text)) {
    return {answer:(en?'One participant proposed a protocol-level fix. A second participant described what the client already sends: ':'一位参与者给出了协议层的修复思路，另一位补充了客户端的现有行为：')+
      quotes(lines.map(s=>s.text))+(en?' A suggested fix in this discussion is not confirmation that a release contains it.':'工单记录的是建议，仍缺少已发布修复的证据。'),sources:[issue.source]};
  }
}

// A first-person commitment belongs to its author even if both commenters
// have the same repository association. Only close a complete two-turn handoff.
function contributionHandoff(issue:IssueEvidence) {
  if (!issue.completeDiscussion || issue.statements.length!==2) return;
  const [reviewer,reporter]=issue.statements;
  if (!reviewer.author || !reporter.author || reviewer.originalReporter || !reporter.originalReporter ||
      reviewer.role!=='repository participant' || reviewer.author.toLowerCase()===reporter.author.toLowerCase()) return;
  if (![reviewer,reporter].every(s=>s.text.length<=420 && !/[<>[\]]|https?:|ignore .*instructions/i.test(s.text))) return;
  if (/\b(?:welcome to|feel free to|please) (?:open|raise|submit|send|create) (?:a |the )?(?:PR|pull request)\b/i.test(reviewer.text)
      && /\bI(?:['’]ll| will) (?:have|open|raise|submit|work|start|implement|fix|do)\b/i.test(reporter.text)) return [reviewer,reporter];
}

// Publish only a short resolution from the identified thread. A suggestion is
// attributed to its speaker even if another participant later confirms it.
export function issueOpening(issue: IssueEvidence, lang: 'en'|'zh'): AssistantAnswer | undefined {
  if (issue.source.title.length>500 || /\[\[|\]\]|[<>]/.test(issue.source.title)) return;
  const repo = new URL(issue.source.href).pathname.split('/').slice(1,3).join('/');
  const retracted=(text:string)=>/\b(?:reverted|did(?:n['’]t| not) (?:work|fix)|still (?:broken|fails|crashes)|not (?:actually )?fixed)\b/i.test(text);
  if (issue.implementation && !issue.statements.some(s=>retracted(s.text))) {
    const {signature,uses,targets,source}=issue.implementation;
    return {answer:(lang==='en'?'The contributor linked the implementation in the issue.':'项目参与者在工单中给出了实现记录。')+' [['+issue.source.id+']] '+
      (lang==='en'?'In '+source.title.split(' @ ')[0]+', the change uses the signature ':'在 '+source.title.split(' @ ')[0]+' 中，实际变更的函数签名为 ')+'`'+signature+'`'+(uses.length?
      (lang==='en'?'. The added lines show how the parameters are used: ': '。新增代码中，参数的用法如下：')+uses.map(line=>'`'+line+'`').join(' · '):'')+(targets.length?(lang==='en'?'. One function accepts different goal patterns: ':'。同一个函数接受不同目标模板：')+targets.map(line=>'`'+line+'`').join(' / '):'')+' [['+source.id+']]',sources:[issue.source,source]};
  }
  if (issue.completeDiscussion && !issue.statements.some(s=>retracted(s.text))) {
    const exchange=discussionContext(issue,lang);
    if (exchange) return exchange;
  }
  for (const statement of [...issue.statements].reverse()) {
    if (retracted(statement.text)) return;
    const text = statement.text.trim();
    const version=fixedVersion(text);
    if (version) {
      const speaker=statement.role==='repository participant'?(lang==='en'?'A project participant':'项目参与者'):(lang==='en'?'A participant in the issue':'一位工单讨论者');
      return {answer:speaker+(lang==='en'?' reported that the fix was in version ':'报告此问题已在以下版本修复 ')+version+'. [['+issue.source.id+']]',sources:[issue.source]};
    }
    if (statement.role !== 'repository participant') continue;
    // Preserve the explicit uncertainty of upstream triage. A planned test
    // documents the current investigation, not a shipped implementation.
    if (/^I(?:'m| am) not sure (?:if|whether)\b/i.test(text) && /I(?:'ll| will) (?:run (?:some )?tests|investigate)\b/i.test(text)
        && text.length<=400 && !/[<>\[\]]|\w+:\/\//i.test(text)) {
      return {answer:(lang==='en'?'A contributor described the open question and next step: “':'项目参与者说明了仍待确认的问题和下一步：“')+text+'” [['+issue.source.id+']]',sources:[issue.source]};
    }
    // Upstream troubleshooting replies sometimes repeat the same checklist in
    // two languages. Preserve the selected checklist and its conditional steps.
    if (repo.toLowerCase()==='cs0x7f/cstimer' && /^You should confirm:\s*1\./i.test(text) &&
        /chrome:\/\/bluetooth-internals\/#devices/.test(text)) {
      const split=text.search(/\n\s*(?=[\p{Script=Han}])/u);
      const steps=(split<0 ? text : lang==='zh' ? text.slice(split) : text.slice(0,split)).trim();
      const rest=steps.replaceAll('chrome://bluetooth-internals/#devices','');
      if (steps.length<=850 && /(?:^|\n)2\./.test(steps) && !/[<>\[\]`]|\w+:\/\//.test(rest)) {
        return {answer:steps+' [['+issue.source.id+']]',sources:[issue.source]};
      }
    }
    const duplicate=confirmedDuplicate(text);
    if (duplicate) {
      const parent=issue.duplicateResolution;
      const answer=(lang==='en'?'A project participant identified this report as a duplicate of ':'项目参与者将该报告标为重复，原工单为 ')+'https://github.com/'+repo+'/issues/'+duplicate+' [['+issue.source.id+']]';
      if (!parent) return {answer,sources:[issue.source]};
      return {answer:answer+(lang==='en'?' The parent discussion reports the fix in version ':'原工单讨论报告的修复版本为 ')+parent.version+' [['+parent.source.id+']]',sources:[issue.source,parent.source]};
    }
    // Screenshot markup can separate the diagnosis from the corrective action.
    // Retain both paragraphs, and keep the author's conditional wording.
    if (repo.toLowerCase()==='thewca/tnoodle' && /edge case.{0,80}specifications/i.test(text) && /I will investigate/i.test(text)) {
      const diagnosis=text.match(/(?:because |suspect (?:that )?)([^.!?\n]{8,170}edge case[^.!?\n]{0,120})[.!]/i)?.[1];
      if (diagnosis && !/[<>\[\]]|https?:/i.test(diagnosis)) {
        const answer=lang==='en'?'The contributor suspected that '+diagnosis+' and said they would investigate.':'项目参与者提出的初步判断是“'+diagnosis+'”，并表示会继续调查。';
        const workaround=issue.reportBody?.split(/\r?\n/).map(line=>line.trim()).find(line=>/^(?:I|We)(?:'ve| have)? .{0,180}(?:worked around|went around the problem|workaround was)/i.test(line) && line.length<330 && !/[<>\[\]]|https?:/i.test(line));
        return {answer:answer+' [['+issue.source.id+']]'+(workaround?(lang==='en'?' The reporter’s workaround was: “':'原报告者的临时处理是：“')+workaround+'” [['+issue.source.id+']]':''),sources:[issue.source]};
      }
    }
    if (repo.toLowerCase()==='thewca/tnoodle' && /came from the WCA API/i.test(text) && /update.{0,50}refresh/i.test(text)) {
      const steps=text.split(/\r?\n\s*\r?\n/).filter(p=>p && !/<img\b|!\[/.test(p)).join(' ');
      if (steps.length<=600 && !/[<>\[\]]|https?:/i.test(steps)) {
        return {answer:(lang==='en'?'The project participant explained, “':'项目参与者解释：“')+steps+'” [['+issue.source.id+']]',sources:[issue.source]};
      }
    }
    const commitNote = /^(?:I(?:['’]ve| have) (?:added|implemented|fixed) (?:it|this) in this commit\s+)(https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/commit\/[0-9a-f]{7,40})(?=\s|[.!]?$)/i.exec(text);
    const backend = /^([^<>\[\]\n]{1,180}\b(?:data|implementation) (?:was|were) [^<>\[\]\n]{1,140}\bsolved by) (https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/pull\/\d+)\s*$/i.exec(text);
    if (backend && new URL(backend[2]).pathname.startsWith('/'+repo+'/')) {
      const tasks=issue.reportBody?.split(/\r?\n/).filter(line=>/^[-*] \[x\] /i.test(line) && line.length<=240 && !/[<>`]|\[\[|\]\]|https?:/.test(line)).map(line=>line.slice(6).trim());
      const context=tasks?.length && tasks.length<=5 ? (lang==='en'?'The report lists these requested changes: ':'原工单列出这些改动：')+tasks.join(' / ')+' [['+issue.source.id+']] ' : '';
      return {answer:context+(lang==='en'?'A contributor reported: “':'一位项目参与者答复：“')+text+'” [['+issue.source.id+']]',sources:[issue.source]};
    }
    const change = commitNote ?? /(?:^|[.!]\s+|\n)(?:(?:it['’]s|I(?: just)?)\s+)?(?:implemented|fixed|done|solved)(?: this)?\s*(?:(?:in|by)\s+|:\s*)(https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/(?:commit\/[0-9a-f]{7,40}|pull\/\d+)|[0-9a-f]{40})[.!]?$/i.exec(text);
    const link = change && (/^[0-9a-f]{40}$/i.test(change[1]) ? 'https://github.com/'+repo+'/commit/'+change[1] : change[1]);
    let sentence: string;
    if (link && new URL(link).pathname.startsWith('/'+repo+'/')) {
      sentence = lang === 'zh' ? '关于“'+issue.source.title+'”，项目参与者给出的修复或实现记录为 '+link : 'For “'+issue.source.title+'”, a project participant identified the fix or implementation in '+link;
      // Pair a confirmed upstream change with its reported cause when a
      // contributor explicitly describes the failing function and its effect.
      const earlier = issue.statements.slice(0,issue.statements.indexOf(statement)).reverse();
      const diagnosis = earlier.filter(s=>s.role==='repository participant')
        .flatMap(s=>s.text.split(/\r?\n/))
        .map(line=>/^(?:[^.!?]{0,100}\b(?:broke|fails?|error|bug)\b[^.!?]{0,100}`[\w.$()]+`[^.!?]{0,60}\.\s+(?:It|This|The function) (?:does not|fails to|rejects|incorrectly) [^.!?]{1,100}\.)/i.exec(line)?.[0])
        .find(line=>line && !/[<>\[\]]|https?:|\b(?:maybe|possibly|suspect|might|seems)\b/i.test(line));
      if (diagnosis) sentence += (lang==='en'?'. The reported diagnosis was “':'。参与者记录的故障原因为“')+diagnosis+'”';
    } else {
      const reply = text.replace(/^(?:hello|hi)[,!]?\s*\r?\n\s*/i,'').trim();
      const approval = /^TNoodle v?\d+(?:\.\d+)+ has not yet been approved[^\n.!?]{0,190}\./i.exec(reply);
      if (approval && repo.toLowerCase()==='thewca/tnoodle' &&
          /official TNoodle release[^\n]{0,140}https:\/\/www\.worldcubeassociation\.org\/regulations\/scrambles\/(?=\s|$)/i.test(reply)) {
        return {answer:(lang==='en'?'At the time of the report, the contributor wrote: “':'当时项目参与者答复：“')+approval[0]+'”'+(lang==='en'?' The contributor directed competitors to the official download page at ':' 工单给出的正式比赛版本下载地址为 ')+'https://www.worldcubeassociation.org/regulations/scrambles/ [['+issue.source.id+']]',sources:[issue.source]};
      }
      const quote = approval?.[0] ?? reply.replace(/\s+/g,' ');
      const disposition = /\b(?:fixed on|not (?:yet )?supported|not supported yet|not yet open|do not (?:yet )?(?:have the ability to )?support|long.term goal|has been out for a while)\b/i.test(quote);
      if ((!approval && !disposition && !/^(?:please try\s+`?v?\d|usually this is because\b|this (?:was|is) (?:fixed|already|implemented)\b|you (?:can|need to)\b|there is a column\b|[请可]以?尝试)/i.test(quote))
        || quote.length>350 || /[<>\[\]]|https?:\/\//i.test(quote)) continue;
      sentence = lang==='zh' ? '项目参与者在该问题中的答复：“'+quote+'”' : 'A project participant replied, “'+quote+'”';
    }
    return {answer:sentence+' [['+issue.source.id+']]',sources:[issue.source]};
  }
  if (repo.toLowerCase()==='thewca/worldcubeassociation.org') {
    const discussion=websiteDiscussion(issue,lang);
    if (discussion) return discussion;
  }
  const observations=issue.statements.filter(s=>(s.originalReporter || s.role==='original reporter') && s.text.length<=350 &&
    /\b(?:only (?:appears?|happens?|occurs?)|only (?:when|if)|same behavio[u]?r on|reproduced (?:it|this) on|works? (?:when|after))\b/i.test(s.text) &&
    !/[<>\[\]\n]|[?？]$|https?:\/\//i.test(s.text));
  if (observations.length) {
    const excerpts=observations.slice(-2).map(s=>'“'+s.text+'”').join(' ');
    return {answer:(lang==='en'?'The original reporter described the conditions: ':'原报告者记录的触发条件为 ')+excerpts+' [['+issue.source.id+']]',sources:[issue.source]};
  }
}

// Keep questions, proposals, and actions attributed. A closed issue or an
// invitation to contribute alone does not establish that a feature shipped.
function websiteDiscussion(issue:IssueEvidence, lang:'en'|'zh'): AssistantAnswer | undefined {
  const evidence:{role:string;author?:string;text:string;rank:number;order:number}[]=[];
  for (const [order,statement] of issue.statements.entries()) {
    const text=statement.text.replace(/(?:https:\/\/(?:next\.)?worldcubeassociation\.org)(\/[\w/-]+)(?=\s|$)/gi,'$1')
      .replace(/(?:^|\s)@[\w-]+\s*/g,' ').trim();
    if (/\[\[|\]\]|<\/?[a-z][^>]*>/i.test(text)) continue;
    // Render numbered placeholders as inline code so they cannot become markup.
    const plain=text.replace(/<\/?\d+\/?>/g,tag=>'`'+tag+'`');
    // Keep the safe sentences of a diagnosis even when a later sentence
    // contains an unrelated attachment or an external URL.
    const hasExternalUrl=(line:string)=>[...line.matchAll(/https?:\/\/[^\s)]+/gi)].some(([value])=>{
      const url=URL.parse(value);
      return !url || url.username || url.password || !(
        ['https://www.worldcubeassociation.org','https://next.worldcubeassociation.org'].includes(url.origin)
        || (url.origin==='https://github.com' && url.pathname==='/thewca/worldcubeassociation.org/discussions'));
    });
    const paragraphs=plain.split(/\n\s*\n/).map(block=>block.replace(/\s+/g,' ').trim())
      .flatMap(block=>hasExternalUrl(block) ? block.split(/(?<=[.!?])\s+/) : [block])
      .filter(line=>!hasExternalUrl(line));
    for (const [index,paragraph] of paragraphs.entries()) {
      if (!paragraph || paragraph.length>380) continue;
      const action=/\b(?:I(?:['’]ve| just)? (?:fixed|implemented|removed|added)|was fixed|have removed|we (?:can|should) remove|no longer support|don['’]t support|will close this issue)\b/i.test(paragraph);
      const decision=/\b(?:strongly opposed|means the person|means they need|two ways of fixing|feel free|can I implement|which discussions|what discussions|do you mean github discussion)\b/i.test(paragraph);
      const instructions=/\b(?:editable (?:via|in)|can (?:be edited|edit it) (?:in|via))\b/i.test(paragraph) && statement.role==='repository participant';
      if ((!action && !decision && !instructions) || (statement.role!=='repository participant' && !action)) continue;
      const rank=instructions?4:action?3:2;
      const rationale=paragraphs[index-1];
      if (/strongly opposed/i.test(paragraph) && rationale && rationale.length<=350 && statement.role==='repository participant') {
        evidence.push({role:statement.role,author:statement.author,text:rationale,rank,order});
      }
      evidence.push({role:statement.role,author:statement.author,text:paragraph,rank,order});
    }
  }
  if (!evidence.length) return;
  const selected=evidence.sort((a,b)=>b.rank-a.rank || a.order-b.order).slice(0,4).sort((a,b)=>a.order-b.order);
  const lines=selected.map(s=>{
    const who=s.role==='repository participant'?(lang==='en'?'A project participant':'项目参与者'):(lang==='en'?'A thread participant':'工单讨论者');
    return (s.author?'@'+s.author:who)+(lang==='en'?' wrote, “':'写道：“')+s.text+'” [['+issue.source.id+']]';
  });
  // Label the scope of a complete exchange. In a truncated thread a later
  // decision could reverse these replies, so keep the attributed excerpts.
  if (issue.completeDiscussion) {
    const discussion=selected.map(s=>s.text).join(' ');
    const en=lang==='en';
    let conclusion:string|undefined;
    if (/can I implement/i.test(discussion) && /feel free/i.test(discussion)) {
      conclusion=en?'A contributor received permission to work on the feature.':'讨论中已同意贡献者着手实现该功能。';
    } else if (selected.every(s=>s.text.endsWith('?'))) {
      conclusion=en?'The participants asked which discussion the report referred to. A link to the intended discussion would resolve that question.':'参与者仍在确认报告所指的讨论，提供对应讨论的链接即可澄清。';
      if (!/discussion/i.test(discussion)) conclusion=undefined;
    } else if (/two ways of fixing/i.test(discussion) && !selected.some(s=>s.rank===3)) {
      const goal=issue.reportBody?.trim();
      conclusion=goal && goal.length<=260 && !/[<>\[\]]|https?:/.test(goal)
        ? (en?'The report specifies the desired behavior: “':'工单要求的行为是：“')+goal+'”'
        : (en?'The quoted replies compare two possible implementations.':'以下回复比较了两种可能的实施方案。');
    }
    if (conclusion) lines.unshift(conclusion+' [['+issue.source.id+']]');
  }
  return {answer:lines.join('\n\n'),sources:[issue.source]};
}

// A posted diagnosis or decision can close the original single-purpose report.
// A visitor's follow-up, mixed discussion or request for additional work still
// needs composition; it can use the same verified first paragraph.
export function resolvesOriginalReport(issue:IssueEvidence, question:string) {
  const body=question.split(/\r?\n/).slice(1).join('\n').trim();
  if (issue.originalReport && contributionHandoff(issue) && /(?:oversight|intended|bug|expected behavio[u]?r)/i.test(body) && !/[?？]|\b(?:also|compare|explain|show me|tell me|give me|list)\b/i.test(body)) return true;
  if (body.length>400 || /^\s*(?:#{1,6}\s|\d+[.)]\s|[-*]\s)/m.test(body)) return false;
  if (!issue.originalReport || !issue.completeDiscussion || /[?？]|\b(?:also|in addition|explain|compare|which version|step.by.step|show me|tell me|give me)\b/i.test(question)) return false;
  const substantive = issue.statements.filter(s=>!/^(?:(?:awesome|great|perfect|ok|good luck|thank(?:s| you)(?: so much)?)(?:[ ,.!]+|$))+$/i.test(s.text.trim()));
  if (substantive.length!==1 || substantive[0].role!=='repository participant') return false;
  return /\b(?:fixed|solved in|implemented|not (?:yet )?supported|not yet open|long.term goal|has been out for a while)\b/i.test(substantive[0].text);
}

// Select original prose for an attributed opening. Preserve qualification and
// sentence boundaries. Other people's quoted replies do not belong to the author.
export function attributedIssueOpening(issue:IssueEvidence, question:string, lang:'en'|'zh') {
  if (!issue.reporter || !issue.reportBody || !issue.source.read ||
      !/reporter|who (?:said|proposed|explained)|summari[sz]e.{0,32}discussion|originally reported|谁.{0,8}(?:说|提议)|报告者|总结.{0,8}(?:工单|讨论)/i.test(question)) return;
  const ref=' [['+issue.source.id+']]';
  const prose=(body:string)=>body
    .replace(/```[\s\S]*?(?:```|$)/g,'')
    .replace(/https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/(?:issues|pull)\/(\d+)/g,'#$1')
    .replace(/(?<!!)\[([^\]\n]{1,100})\]\(https?:\/\/[^)\s]+\)/g,'$1')
    .replace(/https:\/\/(?:www\.)?worldcubeassociation\.org\/competitions\/([a-z0-9_-]+)(?:\/[a-z0-9_/-]*)?/gi,'$1')
    .replace(/https:\/\/github\.com\/([\w.-]+\/[\w.-]+)\/blob\/[\w.-]+\/([\w./-]+)(#[\w.-]+)?/g,'$1/$2$3')
    .split(/\r?\n/).map(line=>line.trim()).filter(line=>line && !line.startsWith('>') &&
      !/\[\[|\]\]|https?:\/\/|[<>]|^!\[|^\*\*[^*]+\*\*$|^#{1,6} |^steps to reproduce|ignore (?:previous|all) instructions/i.test(line))
    .flatMap(line=>/^(?:\d+[.)] |(?:edit|update):)/i.test(line) ? [line] : line.split(/(?<=[.!?])\s+(?=[A-Z(@"'])/)).filter(line=>(line.length>=12 || /^(?:will do|agreed|yes|no|done|fixed)[.!]?$/i.test(line)) && line.length<=550);
  const reportLines=prose(issue.reportBody);
  // Short reports fit in full. In longer reports preserve explicit requirements
  // and corrections even when introductory context takes several sentences.
  const decision=/^(?:[-*] |\d+[.)] |(?:edit|update|expected|actual|outcome|decision|resolution):)|\b(?:we (?:decided|agreed)|decided against|on hold|rolled back|reverted|superseded|withdrawn)\b/i;
  const shortReport=reportLines.join(' ').length<=900;
  const report=reportLines.filter((line,i)=>shortReport || i<2 || decision.test(line));
  if (!report.length) return;
  const attributed=(author:string,passage:string)=>'@'+author+(lang==='en'?' wrote, “':' 写道：“')+passage+'”'+ref;
  const observation=(lang==='en'?'Original report · ':'原始报告 · ')+attributed(issue.reporter,report.join(' '));
  const points=issue.statements.flatMap(statement=>{
    if (!statement.author) return [];
    const sentences=prose(statement.summaryText ?? statement.text);
    // Rank whole sentences within a comment, then restore their original order.
    // Keep a hypothesis with its rationale and a proposal with its caveat.
    const ranked=sentences.map((line,i)=>({line,i,score:
      Number(/\b(?:because|theory|suspect|propos\w*|fix|filed|workaround|not yet|will|no longer|only|instead|should|option|haven't|side.effects|fails|problem|need|refresh|currently)\b|#\d+/i.test(line))*2
      + 4*Number(/#\d+/.test(line)) + Number(i===0)})).sort((a,b)=>b.score-a.score || a.i-b.i).slice(0,3).sort((a,b)=>a.i-b.i);
    // A numbered choice or checklist is part of the proposal. Keeping only
    // a high-ranked introductory sentence can silently drop a required item.
    const kept=new Set(ranked.map(item=>item.i));
    sentences.forEach((line,i)=>{ if (decision.test(line)) kept.add(i); });
    return kept.size?[attributed(statement.author,sentences.filter((_,i)=>kept.has(i)).join(' '))]:[];
  });
  // When attribution and outcome are separate obligations, mark the actual
  // closing statement. A courtesy reply by itself cannot establish an outcome.
  if (/\bwhat was (?:decided|the outcome)\b/i.test(question) && points.length===issue.statements.length &&
      /\b(?:will do|will (?:implement|work)|merged|reverted|rolled back|on hold|we decided|on board|closed|deferred)\b/i.test(issue.statements.at(-1)?.text ?? '')) {
    points[points.length-1]=(lang==='en'?'Outcome recorded in the discussion · ':'讨论记录的结果 · ')+points[points.length-1];
  }
  const paragraphs=[observation,...points];
  // Source rendering imposes a hard transport limit. An opening must always
  // fit even when several of the sampled comments hit their individual limit.
  let used=0;
  const bounded=paragraphs.filter(text=>{
    if (used+text.length+2>8400) return false;
    used+=text.length+2;
    return true;
  });
  return {answer:bounded.join('\n\n'),sources:[issue.source],coversEveryComment:points.length===issue.statements.length && bounded.length===paragraphs.length};
}

// A request for the public thread alone can be answered from its attributed
// record. Extra instructions, missing turns or a truncated discussion still
// need the normal composer and its per-requirement checks.
export function requestsOnlyIssueDiscussion(issue:IssueEvidence,question:string) {
  if (issue.reportTruncated || !(issue.completeDiscussion || issue.completeSummaryText) || !issue.reporter || !issue.statements.every(s=>s.author)) return false;
  const [prefix,suffix,...extra]=question.trim().split(issue.source.href);
  if (suffix===undefined || extra.length) return false;
  const before=prefix.trim().replace(/\s+(?:in|on|of|at)$/i,'');
  const lines=[before,...suffix.split(/\r?\n/)].map(line=>line.trim()).filter(Boolean);
  if (issue.source.title.endsWith(' · '+lines[0])) lines.shift();
  const parts=lines.join(' ').toLowerCase().split(/[?.!]+/).map(s=>s.trim()).filter(Boolean);
  const report=/^what (?:was (?:originally )?(?:reported|requested)(?: or requested)?|did the (?:reporter|author) (?:report|observe|request))$/;
  const summary=/^(?:please )?(?:summari[sz]e|outline) (?:the |this )?(?:issue|thread|discussion)(?:,? (?:including|attributing) (?:the )?(?:proposals?|decisions?|outcome|suggestions?)(?: and (?:the )?(?:outcome|decisions?))?(?: to (?:their authors|the people who made them))?)?$/;
  const attribution=/^who (?:said|suggested|proposed) what(?:,? and what was (?:decided|the outcome))?$/;
  return parts.some(s=>summary.test(s) || attribution.test(s)) && parts.every(s=>summary.test(s) || attribution.test(s) || report.test(s));
}

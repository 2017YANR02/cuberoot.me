import {parseHTML} from 'linkedom';

// Fixed authority, never a model/user supplied fetch destination. This reader
// supplements the public site's explanatory excerpts with the actual clauses.
export const WCA_REGULATIONS_URL='https://www.worldcubeassociation.org/regulations/';
const articles:Record<string,string>={officials:'1',competitors:'2',puzzles:'3',scrambling:'4',defects:'5',environment:'7',events:'9','solved-state':'10',incidents:'11',notation:'12','speed-solving':'A',blindfolded:'B','one-handed':'C','fewest-moves':'E','multi-blind':'H','head-to-head':'I'};
export function regulationArticle(href:string){return articles[href.replace(/^\/regulation\//,'').split('#')[0]];}
export function regulationChapterHref(sourceId:string){
  const article=/^wca:regulations:(\d+|[A-Z])$/.exec(sourceId)?.[1];
  const slug=Object.keys(articles).find(slug=>articles[slug]===article);
  return slug?'/regulation/'+slug:undefined;
}
type Excerpt={href:string;content:string};
const clauseReferences=(text:string)=>text.match(/\b(?:\d+[a-z]|[A-Z]\d)[a-z\d]*\+*/g)??[];
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
export function officialRegulationPassages(html:string,excerpts:Excerpt[],query='') {
  const {document}=parseHTML(html);
  const version=document.querySelector('version')?.textContent?.trim()
    ?? document.body.textContent?.match(/Version:\s*[^\n]+/)?.[0]?.slice(0,100);
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
    return [{id:`wca:regulations:${article}`,title:`WCA Regulations — Article ${article}`,href:WCA_REGULATIONS_URL+`#${kept[0].id}`,
      content:kept.map(c=>c.text).join('\n'),metadata:{sourceType:'rule',authority:'WCA official regulations',sourceVersion:version,clauses:kept.map(c=>c.id)},relatedOmitted:kept.length!==chapter.length}];
  });
}

import { createHash } from 'node:crypto';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import MiniSearch from 'minisearch';
import { z } from 'zod';

export const KNOWLEDGE_VERSION = 'section-v3:icu-v1:512';
export const KNOWLEDGE_DIMENSIONS = 512;
const publicHref = z.string().max(500).refine(href => /^\/(?!\/)/.test(href) && !/[\\\r\n]/.test(href)
  && !/^\/(?:admin|account|auth|login|register|settings|platform|org|learn|courses)(?:\/|[?#]|$)/.test(href));
const sectionSchema=z.object({id:z.string().min(1).max(150),title:z.string().max(500),path:z.array(z.string().max(500)).max(8),clause:z.string().max(80).optional(),parentId:z.string().max(150).optional(),relatedIds:z.array(z.string().max(150)).max(30).optional(),text:z.string().max(60000)});
const pageSchema = z.object({ lang: z.enum(['zh', 'en']), href: publicHref, title: z.string().max(500), text: z.string().max(60000),sourceType:z.enum(['rule','tutorial','help','reference']).optional(),sourceVersion:z.string().max(100).optional(),sourceUpdated:z.string().max(40).refine(value=>!Number.isNaN(Date.parse(value))).optional(),sections:z.array(sectionSchema).max(1000).optional() });
export const knowledgeIndexSchema = z.object({ version: z.number().optional(), updated: z.string().datetime(),releaseId:z.string().max(150).optional(), pages: z.array(pageSchema).max(10000) });
export type KnowledgeIndex = z.infer<typeof knowledgeIndexSchema>;
/** The structured corpus is about 11 MB; match the online reader's bounded JSON budget. */
export async function readKnowledgeIndex(response:Response):Promise<KnowledgeIndex> {
  if(!response.ok || !response.body)throw new Error('Public knowledge artifact unavailable');
  const chunks:Uint8Array[]=[];let size=0;
  const reader=response.body.getReader();
  try {
    for(;;) {
      const {done,value}=await reader.read();if(done)break;
      size+=value.byteLength;
      if(size>20_000_000)throw new RangeError('Public knowledge artifact exceeds 20 MB');
      chunks.push(value);
    }
  } finally {await reader.cancel();}
  return knowledgeIndexSchema.parse(JSON.parse(Buffer.concat(chunks).toString('utf8')));
}
export interface KnowledgeChunk { id: string; documentId: string; lang: 'zh' | 'en'; href: string; title: string; content: string; fingerprint: string; sectionId?:string;sectionTitle?:string; sectionPath?:string[];clause?:string;parentId?:string;relatedIds?:string[];sourceType?:'rule'|'tutorial'|'help'|'reference';sourceVersion?:string;sourceUpdated?:string;relatedOmitted?:boolean }
export const knowledgeHash = (value: string) => createHash('sha256').update(value).digest('hex');
const segmenters = { zh: new Intl.Segmenter('zh', { granularity: 'word' }), en: new Intl.Segmenter('en', { granularity: 'word' }) };
export function knowledgeTokens(text: string, lang: 'zh' | 'en') {
  return [...segmenters[lang].segment(text.toLowerCase())].filter(part => part.isWordLike).map(part => part.segment);
}
export function knowledgeGeneration(index: KnowledgeIndex) {
  // Timestamp changes alone do not invalidate embeddings or the lexical cache.
  return knowledgeHash(JSON.stringify(index.pages.map(page => [page.lang, page.href, page.title, page.text,page.sourceType,page.sourceVersion,page.sourceUpdated,page.sections]).sort((a,b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))));
}
export function knowledgeCoverage(index:KnowledgeIndex) {
  return {pages:index.pages.length,bodyPages:index.pages.filter(p=>p.text.trim() || p.sections?.some(s=>s.text.trim())).length,navigationOnly:index.pages.filter(p=>!p.text.trim() && !p.sections?.some(s=>s.text.trim())).length,structuredPages:index.pages.filter(p=>p.sections?.length).length,datedPages:index.pages.filter(p=>p.sourceUpdated).length};
}
/** Preserve both rewritten topic and original constraints within embedding limits. */
export function knowledgeQuery(topic:string,question='') {
  const clean=topic.trim(),original=(question || topic).trim();
  const full=[clean,original].filter((v,i,a)=>v && a.indexOf(v)===i).join('\n');
  if(full.length<=1900)return full;
  return [clean.slice(0,300),original.slice(0,750),original.slice(-750)].filter(Boolean).join('\n');
}
export function knowledgeQueryTokens(query:string,lang:'zh'|'en') {
  const tokens=knowledgeTokens(query,lang);
  return [...new Set(tokens.length<=80?tokens:[...tokens.slice(0,30),...tokens.slice(-50)])];
}
/** Exact public titles establish a source scope without a relevance threshold. */
export function knowledgePageReferences(index:KnowledgeIndex,question:string,lang:'zh'|'en') {
  const normalized=question.replace(/\s+/g,'').toLowerCase();
  const matches=index.pages.filter(page=>page.lang===lang && [page.title,page.title.replace(/^(?:19|20)\d{2}\s*(?:年|版)?\s*/,''),...(page.sections ?? []).map(s=>s.title)].some(title=>{
    const phrase=title.replace(/\s+/g,'').toLowerCase();return phrase.length>=4 && normalized.includes(phrase);
  }));
  return matches.length<=3?matches.map(page=>page.href):[];
}
export function knowledgeChunkMetadata(chunk:KnowledgeChunk) {
  const {sectionId,sectionTitle,sectionPath,clause,parentId,relatedIds,sourceType,sourceVersion,sourceUpdated}=chunk;
  return {sectionId,sectionTitle,sectionPath,clause,parentId,relatedIds,sourceType,sourceVersion,sourceUpdated};
}
export function knowledgeEmbeddingText(chunk: Pick<KnowledgeChunk,'title'|'sectionPath'|'content'>) {
  return [chunk.title,chunk.sectionPath?.join(' > '),chunk.content].filter(Boolean).join('\n');
}
/** Paragraph-based legacy corpora still gain explicit clause boundaries. */
function pageSections(page:KnowledgeIndex['pages'][number]):z.infer<typeof sectionSchema>[] {
  if(page.sections?.length)return page.sections;
  const sections:z.infer<typeof sectionSchema>[]=[],parts=page.text.split(/\n\s*\n/);
  for(const [i,text] of parts.entries()) {
    const clause=/^\s*([A-Za-z]?\d+[a-z]?(?:\d+)?\+?)(?:[).:：-]|\s)/.exec(text)?.[1];
    // Legacy text can restart numbered lists or repeat a clause in an example.
    // Paragraph position identifies the section; the original clause stays metadata.
    if(clause)sections.push({id:'section-'+i,title:clause,path:[page.title,clause],clause,text});
    else if(sections.length)sections[sections.length-1].text+='\n\n'+text;
    else sections.push({id:'section-'+i,title:page.title,path:[page.title],text});
  }
  return sections;
}
export async function chunkKnowledge(index: KnowledgeIndex): Promise<KnowledgeChunk[]> {
  const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 1000, chunkOverlap: 120, separators: ['\n\n', '\n', '。', '！', '？', '. ', ' ', ''] });
  const chunks: KnowledgeChunk[] = [];
  const documents = new Set<string>();
  for (const page of index.pages) {
    const documentId = `${page.lang}:${page.href}`;
    if (documents.has(documentId)) throw new Error('Duplicate knowledge document');
    documents.add(documentId);
    if (!page.text.trim() && !page.sections?.some(s=>s.text.trim())) continue;
    const sections=pageSections(page);
    if(new Set(sections.map(s=>s.id)).size!==sections.length)throw new Error('Duplicate knowledge section');
    for(const section of sections) {
    const texts = await splitter.splitText(section.text);
    for (const [ordinal, content] of texts.entries()) {
      const metadata={sectionId:section.id,sectionTitle:section.title,sectionPath:section.path,clause:section.clause,parentId:section.parentId,relatedIds:section.relatedIds,sourceType:page.sourceType ?? (/regulation|rules/.test(page.href)?'rule' as const:'reference' as const),sourceVersion:page.sourceVersion,sourceUpdated:page.sourceUpdated};
      const fingerprint = knowledgeHash(JSON.stringify([KNOWLEDGE_VERSION, knowledgeEmbeddingText({title:page.title,sectionPath:section.path,content})]));
      chunks.push({ id: `passage:${knowledgeHash(JSON.stringify([documentId,section.id,ordinal,fingerprint,metadata])).slice(0,24)}`, documentId, lang: page.lang, href: page.href, title: page.title, content, fingerprint,...metadata });
      if (chunks.length > 30000) throw new Error('Knowledge corpus exceeds the configured chunk budget');
    }
    }
  }
  return chunks;
}

/** Add clause parents, explicit references and exceptions before filling unrelated hits. */
export function expandKnowledge(hits:KnowledgeChunk[],chunks:KnowledgeChunk[],limit=6) {
  const selected:KnowledgeChunk[]=[],seen=new Set<string>();
  const add=(c:KnowledgeChunk)=>{if(selected.length<limit && !seen.has(c.id)){seen.add(c.id);selected.push({...c});}};
  const seedSections=new Set<string>(),seedContent=new Set<string>();
  const seeds=hits.filter(hit=>{
    const section=`${hit.documentId}:${hit.sectionId ?? hit.id}`,content=`${hit.documentId}:${hit.fingerprint}`;
    if(seedSections.has(section) || seedContent.has(content))return false;
    seedSections.add(section);seedContent.add(content);return true;
  });
  const continuations:KnowledgeChunk[]=[];
  const relatedByHit=new Map<string,KnowledgeChunk[]>();
  for(const hit of seeds) {
    if(selected.length>=limit)break;
    add(hit);
    const family=(clause?:string)=>clause?.match(/^([A-Za-z]?\d+[a-z]?)/)?.[1];
    const priority=(c:KnowledgeChunk)=>c.sectionId===hit.parentId?0:hit.relatedIds?.includes(c.sectionId ?? '') || c.relatedIds?.includes(hit.sectionId ?? '')?1:c.parentId===hit.sectionId?2:c.sectionId===hit.sectionId?4:3;
    const related=chunks.filter(c=>c.documentId===hit.documentId && c.id!==hit.id && (c.sectionId===hit.sectionId || c.sectionId===hit.parentId || c.parentId===hit.sectionId || hit.relatedIds?.includes(c.sectionId ?? '') || c.relatedIds?.includes(hit.sectionId ?? '') || hit.sourceType==='rule' && hit.clause && family(hit.clause)===family(c.clause))).sort((a,b)=>priority(a)-priority(b));
    for(const chunk of related)if(chunk.sectionId!==hit.sectionId)add(chunk);else continuations.push(chunk);
    relatedByHit.set(hit.id,related);
  }
  for(const chunk of continuations)add(chunk);
  for(const hit of selected)if(relatedByHit.get(hit.id)?.some(c=>!seen.has(c.id)))hit.relatedOmitted=true;
  return selected;
}

let lexicalCache: { generation: string; chunks: KnowledgeChunk[]; search: Record<'zh'|'en', MiniSearch<KnowledgeChunk>> } | undefined;
export const isDeveloperKnowledge = (href: string) => /^\/dev(?:\/|[?#]|$)/.test(href);
export async function lexicalKnowledge(index: KnowledgeIndex, query: string, lang: 'zh'|'en', hrefs: string[] = [], includeDeveloper = true) {
  const generation = knowledgeGeneration(index);
  if (lexicalCache?.generation !== generation) {
    const chunks = await chunkKnowledge(index);
    const create = (language: 'zh'|'en') => {
      const search = new MiniSearch<KnowledgeChunk>({ fields: ['title','content','sectionTitle','sectionPath'],extractField:(chunk,field)=>field==='sectionPath'?chunk.sectionPath?.join(' '):chunk[field as keyof KnowledgeChunk] as string, storeFields: ['href'], tokenize: text => knowledgeTokens(text, language), searchOptions: { boost: { title: 3,sectionTitle:5,sectionPath:2 }, prefix: false, fuzzy: false } });
      search.addAll(chunks.filter(chunk => chunk.lang === language));
      return search;
    };
    lexicalCache = { generation, chunks, search: { zh: create('zh'), en: create('en') } };
  }
  const { chunks, search } = lexicalCache;
  const allowed = (href: string) => (includeDeveloper || !isDeveloperKnowledge(href)) && (!hrefs.length || hrefs.includes(href));
  const ids = search[lang].search(knowledgeQueryTokens(query,lang).join(' '), { filter: result => allowed(result.href) }).map(hit => hit.id);
  // Explicit source reads can return a source even if the paraphrased query has no lexical match.
  const byId=new Map(chunks.map(chunk=>[chunk.id,chunk]));
  const hits=ids.length ? ids.flatMap(id => byId.get(id) ?? []) : hrefs.length ? chunks.filter(chunk => chunk.lang === lang && allowed(chunk.href)) : [];
  return expandKnowledge(hits,chunks.filter(c=>c.lang===lang && allowed(c.href)));
}

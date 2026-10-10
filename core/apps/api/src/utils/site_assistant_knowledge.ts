import { createHash } from 'node:crypto';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import MiniSearch from 'minisearch';
import { z } from 'zod';

export const KNOWLEDGE_VERSION = 'paragraph-v1:icu-v1:512';
export const KNOWLEDGE_DIMENSIONS = 512;
const publicHref = z.string().max(500).refine(href => /^\/(?!\/)/.test(href) && !/[\\\r\n]/.test(href)
  && !/^\/(?:admin|account|auth|login|register|settings|platform|org|learn|courses)(?:\/|[?#]|$)/.test(href));
const pageSchema = z.object({ lang: z.enum(['zh', 'en']), href: publicHref, title: z.string().max(500), text: z.string().max(60000) });
export const knowledgeIndexSchema = z.object({ version: z.number().optional(), updated: z.string().datetime(), pages: z.array(pageSchema).max(10000) });
export type KnowledgeIndex = z.infer<typeof knowledgeIndexSchema>;
export interface KnowledgeChunk { id: string; documentId: string; lang: 'zh' | 'en'; href: string; title: string; content: string; fingerprint: string }
export const knowledgeHash = (value: string) => createHash('sha256').update(value).digest('hex');
const segmenters = { zh: new Intl.Segmenter('zh', { granularity: 'word' }), en: new Intl.Segmenter('en', { granularity: 'word' }) };
export function knowledgeTokens(text: string, lang: 'zh' | 'en') {
  return [...segmenters[lang].segment(text.toLowerCase())].filter(part => part.isWordLike).map(part => part.segment);
}
export function knowledgeGeneration(index: KnowledgeIndex) {
  // Timestamp changes alone do not invalidate embeddings or the lexical cache.
  return knowledgeHash(JSON.stringify(index.pages.map(page => [page.lang, page.href, page.title, page.text]).sort((a,b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))));
}
export async function chunkKnowledge(index: KnowledgeIndex): Promise<KnowledgeChunk[]> {
  const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 1400, chunkOverlap: 180, separators: ['\n\n', '\n', '。', '！', '？', '. ', ' ', ''] });
  const chunks: KnowledgeChunk[] = [];
  const documents = new Set<string>();
  for (const page of index.pages) {
    const documentId = `${page.lang}:${page.href}`;
    if (documents.has(documentId)) throw new Error('Duplicate knowledge document');
    documents.add(documentId);
    if (!page.text.trim()) continue; // Navigation-only entries are never factual evidence.
    const texts = await splitter.splitText(page.text);
    for (const [ordinal, content] of texts.entries()) {
      const fingerprint = knowledgeHash(JSON.stringify([KNOWLEDGE_VERSION, page.title, content]));
      chunks.push({ id: `passage:${knowledgeHash(`${documentId}:${ordinal}:${fingerprint}`).slice(0,24)}`, documentId, lang: page.lang, href: page.href, title: page.title, content, fingerprint });
      if (chunks.length > 30000) throw new Error('Knowledge corpus exceeds the configured chunk budget');
    }
  }
  return chunks;
}

let lexicalCache: { generation: string; chunks: KnowledgeChunk[]; search: Record<'zh'|'en', MiniSearch<KnowledgeChunk>> } | undefined;
export async function lexicalKnowledge(index: KnowledgeIndex, query: string, lang: 'zh'|'en', hrefs: string[] = []) {
  const generation = knowledgeGeneration(index);
  if (lexicalCache?.generation !== generation) {
    const chunks = await chunkKnowledge(index);
    const create = (language: 'zh'|'en') => {
      const search = new MiniSearch<KnowledgeChunk>({ fields: ['title','content'], storeFields: ['href'], tokenize: text => knowledgeTokens(text, language), searchOptions: { boost: { title: 3 }, prefix: false, fuzzy: false } });
      search.addAll(chunks.filter(chunk => chunk.lang === language));
      return search;
    };
    lexicalCache = { generation, chunks, search: { zh: create('zh'), en: create('en') } };
  }
  const { chunks, search } = lexicalCache;
  const ids = search[lang].search(query, { filter: result => !hrefs.length || hrefs.includes(result.href) }).slice(0,6).map(hit => hit.id);
  // Explicit source reads can return a source even if the paraphrased query has no lexical match.
  return (ids.length ? ids.flatMap(id => chunks.find(chunk => chunk.id === id) ?? []) : hrefs.length ? chunks.filter(chunk => chunk.lang === lang && hrefs.includes(chunk.href)) : []).slice(0,6);
}

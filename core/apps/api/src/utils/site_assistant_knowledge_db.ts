import postgres, { type Sql } from 'postgres';
import { databaseSettings } from '../db/settings.js';
import { assistantEmbeddingConfig, embedKnowledge } from './site_assistant_embedding.js';
import { chunkKnowledge, knowledgeGeneration, knowledgeHash, knowledgeTokens, KNOWLEDGE_VERSION, type KnowledgeIndex, type KnowledgeChunk } from './site_assistant_knowledge.js';

export function knowledgeDatabase() {
  const settings=databaseSettings();
  return postgres({ ...settings, database: process.env.SITE_ASSISTANT_KNOWLEDGE_DB_NAME || settings.database, max: 1, connect_timeout: 2, idle_timeout: 2,
    connection: { application_name: 'cuberoot-assistant-knowledge', statement_timeout: 4000, lock_timeout: 500, work_mem: '4MB', max_parallel_workers_per_gather: 0 } });
}
type Embed = typeof embedKnowledge;
const vectorLiteral = (vector: number[]) => JSON.stringify(vector);

/** Staging rows may survive a failed build for reuse, but never become searchable. */
export async function indexKnowledge(db: Sql, index: KnowledgeIndex, identity: string, signal: AbortSignal, embed: Embed = embedKnowledge) {
  const connection = await db.reserve();
  let locked = false;
  try {
    const [lock] = await connection`SELECT pg_try_advisory_lock(707270) AS acquired`;
    if (!lock.acquired) throw new Error('Another knowledge indexing job is running');
    locked = true;
    const corpusHash = knowledgeGeneration(index);
    const generation = knowledgeHash(`${KNOWLEDGE_VERSION}:${identity}:${corpusHash}`);
    const [current] = await connection`SELECT * FROM site_assistant_knowledge_state WHERE singleton`;
    if (current?.generation === generation) return { unchanged: true, embedded: 0, reused: 0, generation };
    const chunks = await chunkKnowledge(index);
    if (!chunks.length) throw new Error('Refusing to publish an empty knowledge corpus');
    let embedded = 0, reused = 0;
    for (let offset = 0; offset < chunks.length; offset += 10) {
      signal.throwIfAborted();
      const batch = chunks.slice(offset, offset + 10);
      const found = await connection`SELECT DISTINCT ON(fingerprint) fingerprint,embedding::text AS vector FROM site_assistant_knowledge_chunks
        WHERE embedding_identity=${identity} AND fingerprint IN ${connection(batch.map(chunk => chunk.fingerprint))}`;
      const cached = new Map(found.map(row => [row.fingerprint as string, row.vector as string]));
      const missing = [...new Map(batch.filter(chunk => !cached.has(chunk.fingerprint)).map(chunk => [chunk.fingerprint, chunk])).values()];
      if (missing.length) {
        const vectors = await embed(missing.map(chunk => `${chunk.title}\n${chunk.content}`), signal);
        missing.forEach((chunk, i) => cached.set(chunk.fingerprint, vectorLiteral(vectors[i])));
        embedded += missing.length;
      }
      reused += batch.length - missing.length;
      for (const chunk of batch) {
        signal.throwIfAborted();
        const terms = knowledgeTokens(`${chunk.title}\n${chunk.content}`, chunk.lang).join(' ');
        await connection`INSERT INTO site_assistant_knowledge_chunks(generation,id,document_id,lang,href,title,content,fingerprint,embedding_identity,search,embedding)
          VALUES(${generation},${chunk.id},${chunk.documentId},${chunk.lang},${chunk.href},${chunk.title},${chunk.content},${chunk.fingerprint},${identity},to_tsvector('simple',${terms}),${cached.get(chunk.fingerprint)!}::vector)
          ON CONFLICT(generation,id) DO NOTHING`;
      }
    }
    signal.throwIfAborted();
    // One atomic pointer change: readers see all old passages or all new passages.
    await connection`INSERT INTO site_assistant_knowledge_state(singleton,generation,corpus_hash,embedding_identity,source_updated)
      VALUES(true,${generation},${corpusHash},${identity},${index.updated})
      ON CONFLICT(singleton) DO UPDATE SET generation=EXCLUDED.generation,corpus_hash=EXCLUDED.corpus_hash,
        embedding_identity=EXCLUDED.embedding_identity,source_updated=EXCLUDED.source_updated,published_at=now()`;
    await connection`DELETE FROM site_assistant_knowledge_chunks WHERE generation<>${generation}`;
    return { unchanged: false, embedded, reused, generation, chunks: chunks.length };
  } finally {
    try { if (locked) await connection`SELECT pg_advisory_unlock(707270)`; } finally { connection.release(); }
  }
}

/** Both rankings operate on the current complete snapshot and language/source filter. */
export async function retrieveKnowledge(db: Sql, input: { corpusHash: string; identity: string; lang: 'zh'|'en'; query: string; hrefs: string[]; vector?: number[] }, signal: AbortSignal): Promise<KnowledgeChunk[]> {
  signal.throwIfAborted();
  const tokens = knowledgeTokens(input.query.slice(0,500), input.lang).slice(0,40);
  const tsquery = tokens.map(token => `'${token.replace(/'/g,"''")}'`).join(' | ');
  const vector = input.vector ? vectorLiteral(input.vector) : null;
  const task = db`WITH corpus AS (
      SELECT c.* FROM site_assistant_knowledge_chunks c JOIN site_assistant_knowledge_state s USING(generation)
      WHERE s.singleton AND s.corpus_hash=${input.corpusHash} AND s.embedding_identity=${input.identity}
        AND c.lang=${input.lang} AND (${input.hrefs.length === 0} OR c.href=ANY(${input.hrefs}::text[]))
    ), lexical AS (
      SELECT id,row_number() OVER(ORDER BY ts_rank_cd(search,to_tsquery('simple',${tsquery})) DESC,id) AS rank FROM corpus
      WHERE ${!!tsquery} AND search @@ to_tsquery('simple',${tsquery}) ORDER BY rank LIMIT 20
    ), semantic AS (
      SELECT id,row_number() OVER(ORDER BY embedding <=> ${vector}::vector,id) AS rank FROM corpus
      WHERE ${vector !== null} ORDER BY rank LIMIT 20
    ), ranked AS (
      SELECT id,sum(score) AS score FROM (
        SELECT id,1.0/(60+rank) AS score FROM lexical UNION ALL SELECT id,1.0/(60+rank) FROM semantic
      ) r GROUP BY id
    ) SELECT c.id,c.document_id AS "documentId",c.lang,c.href,c.title,c.content,c.fingerprint
      FROM ranked r JOIN corpus c USING(id) ORDER BY r.score DESC,c.id LIMIT 6`;
  const abort = () => task.cancel();
  signal.addEventListener('abort', abort, { once: true });
  try { const rows = await task; signal.throwIfAborted(); return [...rows] as KnowledgeChunk[]; }
  finally { signal.removeEventListener('abort', abort); }
}

export async function hybridKnowledge(index: KnowledgeIndex, query: string, lang: 'zh'|'en', hrefs: string[], signal: AbortSignal) {
  const config = assistantEmbeddingConfig();
  if (process.env.SITE_ASSISTANT_KNOWLEDGE_ENABLED === '0' || !config) return [];
  const db = knowledgeDatabase();
  try {
    const corpusHash=knowledgeGeneration(index);
    const [state]=await db`SELECT corpus_hash,embedding_identity FROM site_assistant_knowledge_state WHERE singleton`;
    if(state?.corpus_hash!==corpusHash || state?.embedding_identity!==config.identity) return [];
    let vector: number[] | undefined;
    try { [vector] = await embedKnowledge([query.slice(0,500)], signal); } catch { signal.throwIfAborted(); }
    return await retrieveKnowledge(db, { corpusHash, identity: config.identity, query, lang, hrefs, vector }, signal);
  } finally { await db.end({ timeout: 0 }); }
}

import { recordAssistantRetrieval } from './site_assistant_monitor.js';
import { assistantRerankConfig, rerankKnowledge } from './site_assistant_rerank.js';
import postgres, { type Sql } from 'postgres';
import { databaseSettings } from '../db/settings.js';
import { assistantEmbeddingConfig, embedKnowledge } from './site_assistant_embedding.js';
import { chunkKnowledge, expandKnowledge, knowledgeChunkMetadata, knowledgeCoverage, knowledgeEmbeddingText, knowledgeGeneration, knowledgeHash, knowledgeQuery, knowledgeQueryTokens, knowledgeTokens, KNOWLEDGE_VERSION, type KnowledgeIndex, type KnowledgeChunk } from './site_assistant_knowledge.js';

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
    if (current?.generation === generation && current?.release_id===(index.releaseId ?? null) && current?.chunk_version===KNOWLEDGE_VERSION && current?.chunk_count>0) return { unchanged: true, embedded: 0, reused: 0, generation,releaseId:index.releaseId,coverage:knowledgeCoverage(index),ready:true };
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
        const vectors = await embed(missing.map(knowledgeEmbeddingText), signal);
        missing.forEach((chunk, i) => cached.set(chunk.fingerprint, vectorLiteral(vectors[i])));
        embedded += missing.length;
      }
      reused += batch.length - missing.length;
      for (const chunk of batch) {
        signal.throwIfAborted();
        const headingTerms = knowledgeTokens(`${chunk.title}\n${chunk.sectionTitle ?? ''}\n${chunk.sectionPath?.join(' ') ?? ''}\n${chunk.clause ?? ''}`, chunk.lang).join(' ');
        const terms = knowledgeTokens(chunk.content, chunk.lang).join(' ');
        await connection`INSERT INTO site_assistant_knowledge_chunks(generation,id,document_id,lang,href,title,content,fingerprint,embedding_identity,search,embedding,metadata)
          VALUES(${generation},${chunk.id},${chunk.documentId},${chunk.lang},${chunk.href},${chunk.title},${chunk.content},${chunk.fingerprint},${identity},setweight(to_tsvector('simple',${headingTerms}),'A') || setweight(to_tsvector('simple',${terms}),'B'),${cached.get(chunk.fingerprint)!}::vector,${connection.json(knowledgeChunkMetadata(chunk))})
          ON CONFLICT(generation,id) DO NOTHING`;
      }
    }
    signal.throwIfAborted();
    const [count]=await connection`SELECT count(*)::int AS n FROM site_assistant_knowledge_chunks WHERE generation=${generation}`;
    if(count.n!==chunks.length) throw new Error('Incomplete knowledge generation');
    // One atomic pointer change: readers see all old passages or all new passages.
    await connection`INSERT INTO site_assistant_knowledge_state(singleton,generation,corpus_hash,embedding_identity,source_updated,release_id,chunk_version,coverage,chunk_count)
      VALUES(true,${generation},${corpusHash},${identity},${index.updated},${index.releaseId ?? null},${KNOWLEDGE_VERSION},${connection.json(knowledgeCoverage(index))},${chunks.length})
      ON CONFLICT(singleton) DO UPDATE SET generation=EXCLUDED.generation,corpus_hash=EXCLUDED.corpus_hash,
        previous_snapshot=CASE WHEN site_assistant_knowledge_state.generation<>EXCLUDED.generation
          THEN to_jsonb(site_assistant_knowledge_state)-'previous_snapshot' ELSE site_assistant_knowledge_state.previous_snapshot END,
        embedding_identity=EXCLUDED.embedding_identity,source_updated=EXCLUDED.source_updated,published_at=now(),release_id=EXCLUDED.release_id,chunk_version=EXCLUDED.chunk_version,coverage=EXCLUDED.coverage,chunk_count=EXCLUDED.chunk_count`;
    await connection`DELETE FROM site_assistant_knowledge_chunks WHERE generation<>${generation}
      AND generation<>COALESCE((SELECT previous_snapshot->>'generation' FROM site_assistant_knowledge_state WHERE singleton),'')`;
    return { unchanged: false, embedded, reused, generation, chunks: chunks.length,releaseId:index.releaseId,coverage:knowledgeCoverage(index),ready:true };
  } finally {
    try { if (locked) await connection`SELECT pg_advisory_unlock(707270)`; } finally { connection.release(); }
  }
}

/** Explicit compare-and-swap rollback under the same publisher lock. No model calls.
 * The matching web artifact must also be restored; mismatches use lexical fallback. */
export async function rollbackKnowledge(db:Sql, expectedCurrent:string, targetGeneration:string) {
  const connection=await db.reserve();let locked=false;
  try {
    const [lock]=await connection`SELECT pg_try_advisory_lock(707270) AS acquired`;
    if(!lock.acquired) throw new Error('Another knowledge indexing job is running');
    locked=true;
    const [state]=await connection`SELECT * FROM site_assistant_knowledge_state WHERE singleton`;
    const previous=state?.previous_snapshot;
    if(state?.generation!==expectedCurrent || previous?.generation!==targetGeneration || !(previous.chunk_count>0)) throw new Error('Rollback target is not the retained complete snapshot');
    const [count]=await connection`SELECT count(*)::int AS n FROM site_assistant_knowledge_chunks WHERE generation=${targetGeneration} AND embedding_identity=${previous.embedding_identity}`;
    if(count.n!==previous.chunk_count) throw new Error('Rollback snapshot is incomplete');
    await connection`UPDATE site_assistant_knowledge_state SET generation=${previous.generation},corpus_hash=${previous.corpus_hash},
      embedding_identity=${previous.embedding_identity},source_updated=${previous.source_updated},release_id=${previous.release_id},
      chunk_version=${previous.chunk_version},coverage=${connection.json(previous.coverage)},chunk_count=${previous.chunk_count},published_at=now(),
      previous_snapshot=to_jsonb(site_assistant_knowledge_state)-'previous_snapshot' WHERE singleton AND generation=${expectedCurrent}`;
    return {generation:targetGeneration,previousGeneration:expectedCurrent,releaseId:previous.release_id};
  } finally {
    try {if(locked)await connection`SELECT pg_advisory_unlock(707270)`;}finally{connection.release();}
  }
}

/** Both rankings operate on the current complete snapshot and language/source filter. */
export async function retrieveKnowledge(db: Sql, input: { corpusHash: string; identity: string; generation?:string; lang: 'zh'|'en'; query: string; hrefs: string[]; vector?: number[]; limit?: number; includeDeveloper?: boolean }, signal: AbortSignal): Promise<KnowledgeChunk[]> {
  signal.throwIfAborted();
  const tokens = knowledgeQueryTokens(input.query, input.lang);
  const tsquery = tokens.map(token => `'${token.replace(/'/g,"''")}'`).join(' | ');
  const vector = input.vector ? vectorLiteral(input.vector) : null;
  const limit = Number.isSafeInteger(input.limit) ? Math.max(1, Math.min(40, input.limit!)) : 6;
  const task = db`WITH corpus AS (
      SELECT c.* FROM site_assistant_knowledge_chunks c JOIN site_assistant_knowledge_state s USING(generation)
      WHERE s.singleton AND s.corpus_hash=${input.corpusHash} AND s.embedding_identity=${input.identity}
        AND s.generation=${input.generation ?? knowledgeHash(`${KNOWLEDGE_VERSION}:${input.identity}:${input.corpusHash}`)}
        AND s.chunk_version=${KNOWLEDGE_VERSION} AND s.chunk_count>0
        AND c.lang=${input.lang} AND (${input.hrefs.length === 0} OR c.href=ANY(${input.hrefs}::text[]))
        AND (${input.includeDeveloper !== false} OR c.href !~ '^/dev(/|[?#]|$)')
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
    ) SELECT c.id,c.document_id AS "documentId",c.lang,c.href,c.title,c.content,c.fingerprint,c.metadata,r.score
      FROM ranked r JOIN corpus c USING(id) ORDER BY r.score DESC,c.id LIMIT ${limit}`;
  const abort = () => task.cancel();
  signal.addEventListener('abort', abort, { once: true });
  try { const rows = await task; signal.throwIfAborted(); return rows.map(row=>({...row,...row.metadata})) as KnowledgeChunk[]; }
  finally { signal.removeEventListener('abort', abort); }
}

export function knowledgeIndexStatus(index:KnowledgeIndex,identity:string,state:Record<string,any>|undefined) {
  const expectedGeneration=knowledgeHash(`${KNOWLEDGE_VERSION}:${identity}:${knowledgeGeneration(index)}`);
  const reason=!state?'index_missing':state.generation!==expectedGeneration || state.chunk_version!==KNOWLEDGE_VERSION?'index_mismatch':index.releaseId && state.release_id!==index.releaseId?'release_mismatch':!(state.chunk_count>0)?'index_incomplete':undefined;
  return {indexReady:!reason,reason,generation:state?.generation,expectedGeneration,releaseId:state?.release_id ?? undefined,expectedReleaseId:index.releaseId,coverage:knowledgeCoverage(index)};
}

export async function hybridKnowledge(index: KnowledgeIndex, query: string, lang: 'zh'|'en', hrefs: string[], signal: AbortSignal, includeDeveloper = true) {
  const config = assistantEmbeddingConfig();
  if (process.env.SITE_ASSISTANT_KNOWLEDGE_ENABLED === '0' || !config) { recordAssistantRetrieval({ mode: 'fallback', reason: 'disabled_or_unconfigured', hits: [] }); return []; }
  const db = knowledgeDatabase();
  try {
    const corpusHash=knowledgeGeneration(index);
    const [state]=await db`SELECT corpus_hash,embedding_identity,generation,release_id,chunk_version,coverage,chunk_count FROM site_assistant_knowledge_state WHERE singleton`;
    const status=knowledgeIndexStatus(index,config.identity,state);
    if(!status.indexReady || state?.corpus_hash!==corpusHash || state?.embedding_identity!==config.identity) { recordAssistantRetrieval({ mode: 'fallback',...status, reason: status.reason ?? 'index_mismatch', hits: [] }); return []; }
    let vector: number[] | undefined;
    try { [vector] = await embedKnowledge([knowledgeQuery(query)], signal); } catch { signal.throwIfAborted(); }
    let rerank = false;
    try { rerank = !!assistantRerankConfig(); } catch { /* Invalid optional config preserves baseline retrieval. */ }
    const candidates = await retrieveKnowledge(db, { corpusHash, identity: config.identity, generation:state.generation, query, lang, hrefs, vector, limit: 40, includeDeveloper }, signal);
    const ranked = rerank ? await rerankKnowledge(query, candidates, signal) : candidates;
    const documentIds=[...new Set(ranked.map(c=>c.documentId))];
    const sectionIds=[...new Set(ranked.flatMap(c=>[c.sectionId,c.parentId,...(c.relatedIds ?? [])]).filter((id):id is string=>!!id))];
    const families=[...new Set(ranked.filter(c=>c.sourceType==='rule').flatMap(c=>c.clause?.match(/^([A-Za-z]?\d+[a-z]?)/)?.[1] ?? []))];
    const related= documentIds.length ? await db`SELECT id,document_id AS "documentId",lang,href,title,content,fingerprint,metadata FROM site_assistant_knowledge_chunks
      WHERE generation=${state.generation} AND document_id=ANY(${documentIds}::text[])
        AND (metadata->>'sectionId'=ANY(${sectionIds}::text[]) OR metadata->>'parentId'=ANY(${sectionIds}::text[])
          OR metadata->'relatedIds' ?| ${sectionIds}::text[]
          OR metadata->>'sourceType'='rule' AND substring(metadata->>'clause' FROM '^[A-Za-z]?[0-9]+[a-z]?')=ANY(${families}::text[]))
      ORDER BY document_id,id LIMIT 200` : [];
    const hits=expandKnowledge(ranked,related.map(row=>({...row,...row.metadata})) as KnowledgeChunk[]);
    if(related.length===200)for(const hit of hits)hit.relatedOmitted=true;
    recordAssistantRetrieval({ mode: vector ? 'hybrid' : 'database_lexical',...status, ...(vector ? {} : { reason: 'embedding_unavailable' }), hits });
    return hits;
  } finally { await db.end({ timeout: 0 }); }
}

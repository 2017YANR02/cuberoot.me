import {readFile} from 'node:fs/promises';
import {afterAll,beforeAll,describe,it,expect,vi} from 'vitest';
import {knowledgeDatabase,indexKnowledge,retrieveKnowledge,rollbackKnowledge} from '../src/utils/site_assistant_knowledge_db.js';
import {knowledgeGeneration} from '../src/utils/site_assistant_knowledge.js';
const enabled=process.env.ASSISTANT_ANALYSIS_PG_TEST==='1' && process.env.DB_HOST==='127.0.0.1' && process.env.DB_NAME==='assistant_analysis_test';
const db=knowledgeDatabase();
const vector=(axis:number)=>Array.from({length:512},(_,i)=>i===axis?1:0);
const corpus={updated:'2026-10-10T00:00:00.000Z',pages:[
  {lang:'zh' as const,href:'/timer',title:'训练',text:'选择公式集后，勾选需要练习的情况。'},
  {lang:'zh' as const,href:'/wca',title:'比赛',text:'查看世界魔方协会的公开比赛成绩。'},
  {lang:'en' as const,href:'/timer',title:'Training',text:'Select cases before practising.'},
]};
const signal=()=>AbortSignal.timeout(10000);
const embedding=vi.fn(async(texts:string[])=>texts.map(text=>vector(text.includes('比赛')?1:0)));
const search=(index=corpus,query='怎样开始练习',v=vector(0),hrefs:string[]=[])=>retrieveKnowledge(db,{corpusHash:knowledgeGeneration(index),identity:'fixture:512',lang:'zh',query,vector:v,hrefs},signal());
describe.skipIf(!enabled)('assistant pgvector snapshot lifecycle',()=>{
  beforeAll(async()=>{
    await db.unsafe('CREATE EXTENSION IF NOT EXISTS vector');
    await db.unsafe(await readFile(new URL('../migrations/0270_assistant_knowledge.sql',import.meta.url),'utf8'));
    await db`INSERT INTO site_assistant_knowledge_state(singleton,generation,corpus_hash,embedding_identity,source_updated) VALUES(true,'legacy','legacy','fixture:512',${corpus.updated})`;
    await db`INSERT INTO site_assistant_knowledge_chunks(generation,id,document_id,lang,href,title,content,fingerprint,embedding_identity,search,embedding)
      VALUES('legacy','legacy','zh:/legacy','zh','/legacy','Legacy','Legacy','legacy','fixture:512',''::tsvector,${JSON.stringify(vector(0))}::vector)`;
    await db.unsafe(await readFile(new URL('../migrations/0327_assistant_knowledge_metadata.sql',import.meta.url),'utf8'));
    expect((await db`SELECT chunk_count,chunk_version FROM site_assistant_knowledge_state`)[0]).toMatchObject({chunk_count:1,chunk_version:null});
  });
  afterAll(async()=>{await db.end({timeout:0});});
  it('retrieves Chinese lexical and semantic passages, with language and source filters',async()=>{
    const result=await indexKnowledge(db,corpus,'fixture:512',signal(),embedding);
    expect(result.embedded).toBe(3);
    expect((await search())[0].href).toBe('/timer');
    expect((await search(corpus,'比赛',vector(1)))[0].href).toBe('/wca');
    expect((await search(corpus,'练习',vector(0),['/wca'])).map(hit=>hit.href)).toEqual(['/wca']);
    expect((await search()).every(hit=>hit.lang==='zh')).toBe(true);
    await rollbackKnowledge(db,result.generation,'legacy');
    expect(await search()).toEqual([]);
    await rollbackKnowledge(db,'legacy',result.generation);
    expect((await search()).length).toBe(2);
  });
  it('reuses vectors and publishes edits/deletions atomically, keeping old snapshot on failure',async()=>{
    embedding.mockClear();
    expect((await indexKnowledge(db,corpus,'fixture:512',signal(),embedding)).unchanged).toBe(true);expect(embedding).not.toHaveBeenCalled();
    const changed={...corpus,pages:[{...corpus.pages[0],text:'新的公开训练说明。'}]};
    await expect(indexKnowledge(db,changed,'fixture:512',signal(),async()=>{throw new Error('provider unavailable');})).rejects.toThrow('provider unavailable');
    expect((await search()).length).toBe(2);
    const next=await indexKnowledge(db,changed,'fixture:512',signal(),embedding);
    expect(await search()).toEqual([]); // Stale index cannot serve a new source generation.
    expect((await search(changed)).map(hit=>hit.content)).toEqual(['新的公开训练说明。']);
    expect((await db`SELECT count(*)::int AS n FROM site_assistant_knowledge_chunks`)[0].n).toBe(4);
    const [state]=await db`SELECT * FROM site_assistant_knowledge_state`;
    expect(state.previous_snapshot.chunk_count).toBe(3);
    await expect(rollbackKnowledge(db,'stale-generation',state.previous_snapshot.generation)).rejects.toThrow('Rollback target');
    await rollbackKnowledge(db,next.generation,state.previous_snapshot.generation);
    expect((await search()).length).toBe(2);
    expect(await search(changed)).toEqual([]);
    expect(embedding).toHaveBeenCalledTimes(1);
  });
});

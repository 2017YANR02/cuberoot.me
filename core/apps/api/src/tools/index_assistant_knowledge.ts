/** Offline worker. Only the fixed public build artifact is sent to the embedding provider. */
import { createCompetitionProof, COMPETITION_SERVICE_HEADER } from '@cuberoot/shared/competition-access';
import { assistantEmbeddingConfig, embedKnowledge } from '../utils/site_assistant_embedding.js';
import { knowledgeIndexSchema } from '../utils/site_assistant_knowledge.js';
import { knowledgeDatabase, indexKnowledge } from '../utils/site_assistant_knowledge_db.js';

let phase='configuration';
async function main() {
  if (process.env.SITE_ASSISTANT_KNOWLEDGE_ENABLED === '0') { console.log('Assistant knowledge indexing disabled'); return; }
  const config = assistantEmbeddingConfig();
  if (!config) throw new Error('Embedding configuration is missing');
  // Full indexing runs on the remote Linux server under the bounded systemd unit.
  // The maintainer's local Mac still permits only small development fixtures.
  phase='server_preflight';
  if (process.platform !== 'linux') throw new Error('Run full knowledge indexing on the remote Linux server; local computer swap restrictions still apply');
  phase='public_artifact';
  const signal = AbortSignal.timeout(15 * 60 * 1000);
  const headers: Record<string,string> = { Accept: 'application/json' };
  if (process.env.COMPETITION_ACCESS_SECRET) headers[COMPETITION_SERVICE_HEADER] = await createCompetitionProof(process.env.COMPETITION_ACCESS_SECRET, 'service', '/assistant/pages.json');
  const response = await fetch('https://next.cuberoot.me/assistant/pages.json', { headers, redirect: 'error', signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]) });
  if (!response.ok || !response.body) throw new Error('Public knowledge artifact unavailable');
  const chunks: Uint8Array[]=[]; let size=0;
  const reader=response.body.getReader();
  try { for(;;) { const {done,value}=await reader.read(); if(done) break; size+=value.byteLength; if(size>8_000_000) throw new Error('Public knowledge artifact exceeds 8 MB'); chunks.push(value); } }
  finally { await reader.cancel(); }
  const index = knowledgeIndexSchema.parse(JSON.parse(Buffer.concat(chunks).toString('utf8')));
  if(index.version !== 2) throw new Error('Deploy the version 2 public content index before enabling knowledge indexing');
  let embedded=0;
  const budget=Number(process.env.SITE_ASSISTANT_EMBEDDING_JOB_LIMIT || 2000);
  if(!Number.isSafeInteger(budget) || budget<1 || budget>30000) throw new Error('Invalid embedding job budget');
  const db=knowledgeDatabase();
  try {
    phase='index';
    const result=await indexKnowledge(db,index,config.identity,signal,async(texts,requestSignal)=>{
      embedded+=texts.length;
      if(embedded>budget) throw new Error('Embedding job budget reached; completed batches are reusable on the next run');
      return embedKnowledge(texts,requestSignal,fetch,{timeoutMs:30000,maxRetries:2});
    });
    console.log(JSON.stringify({event:'assistant_knowledge_index',...result}));
  } finally { await db.end({timeout:0}); }
}
main().catch(error=>{ console.error(JSON.stringify({event:'assistant_knowledge_index_failed',phase,code:error?.name ?? 'Error'}));process.exitCode=1; });

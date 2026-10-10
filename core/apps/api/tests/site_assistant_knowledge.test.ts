import { afterEach,describe,it,expect,vi } from 'vitest';
import { embedKnowledge } from '../src/utils/site_assistant_embedding.js';
import { chunkKnowledge, knowledgeIndexSchema, knowledgeTokens, lexicalKnowledge, knowledgeGeneration } from '../src/utils/site_assistant_knowledge.js';
const index = {updated:'2026-10-10T00:00:00.000Z',pages:[
  {lang:'zh' as const,href:'/timer?training=home',title:'计时器训练',text:'打开计时器训练菜单，选择项目与公式集。\n\n选择要练习的情况，再开始公式训练。'},
  {lang:'zh' as const,href:'/wca',title:'WCA 比赛',text:'世界魔方协会比赛与选手成绩。'},
  {lang:'en' as const,href:'/timer',title:'Timer training',text:'Choose cases before starting algorithm practice.'},
  {lang:'zh' as const,href:'/empty',title:'只有导航',text:''},
]};
afterEach(()=>vi.unstubAllEnvs());
it('retries an offline timeout but not access denial or caller cancellation',async()=>{
  vi.stubEnv('SITE_ASSISTANT_EMBEDDING_API_KEY','fixture');
  vi.stubEnv('SITE_ASSISTANT_EMBEDDING_BASE_URL','https://dashscope.aliyuncs.com/compatible-mode/v1');
  const vector=Array.from({length:512},(_,i)=>i===0?1:0);
  const fetcher=vi.fn<typeof fetch>().mockRejectedValueOnce(new DOMException('timed out','TimeoutError'))
    .mockResolvedValueOnce(Response.json({data:[{embedding:vector,index:0}],usage:{prompt_tokens:1,total_tokens:1}}));
  expect(await embedKnowledge(['公开资料'],AbortSignal.timeout(2000),fetcher,{maxRetries:2})).toEqual([vector]);
  expect(fetcher).toHaveBeenCalledTimes(2);
  const denied=vi.fn<typeof fetch>().mockResolvedValue(Response.json({error:{message:'denied'}},{status:403}));
  await expect(embedKnowledge(['公开资料'],AbortSignal.timeout(2000),denied,{maxRetries:2})).rejects.toThrow();
  expect(denied).toHaveBeenCalledTimes(1);
  const aborted=vi.fn<typeof fetch>();
  await expect(embedKnowledge(['公开资料'],AbortSignal.abort(),aborted,{maxRetries:2})).rejects.toThrow();
  expect(aborted).not.toHaveBeenCalled();
});
describe('assistant public knowledge retrieval',()=>{
  it('segments Chinese words, restricts language, and keeps source citations',async()=>{
    expect(knowledgeTokens('计时器训练','zh')).toContain('训练');
    const hits=await lexicalKnowledge(index,'怎么练公式','zh');
    expect(hits[0]).toMatchObject({href:'/timer?training=home',lang:'zh'});
    expect(hits[0].id).toMatch(/^passage:/);
    expect(hits.every(hit=>hit.lang==='zh')).toBe(true);
    expect((await chunkKnowledge(index)).some(chunk=>chunk.href==='/empty')).toBe(false);
  });
  it('honors explicit source selection and invalidates deleted and edited passages',async()=>{
    expect((await lexicalKnowledge(index,'计时器','zh',['/wca']))[0].href).toBe('/wca');
    const changed={...index,pages:index.pages.filter(page=>page.href!=='/timer?training=home')};
    expect(await lexicalKnowledge(changed,'公式训练','zh')).toEqual([]);
    expect(knowledgeGeneration({...index,updated:'2026-10-11T00:00:00.000Z'})).toBe(knowledgeGeneration(index));
    expect(knowledgeGeneration(changed)).not.toBe(knowledgeGeneration(index));
  });
  it('keeps long documents bounded and rejects private destinations',async()=>{
    const chunks=await chunkKnowledge({...index,pages:[{...index.pages[0],text:('这是分段后的公式训练说明。\n\n').repeat(250)}]});
    expect(chunks.length).toBeGreaterThan(1);expect(Math.max(...chunks.map(chunk=>chunk.content.length))).toBeLessThanOrEqual(1400);
    for(const href of ['/account','/admin/x','/platform/org','//evil.test','/\\evil.test']) expect(knowledgeIndexSchema.safeParse({...index,pages:[{...index.pages[0],href}]}).success).toBe(false);
  });
});

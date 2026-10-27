import { assistantPrice } from '../src/utils/site_assistant_pricing.js';
import { describe, expect, it, vi } from 'vitest';
import { HTTPException } from 'hono/http-exception';
import { startAssistantMonitor, recordAssistantStage, recordAssistantModel, recordAssistantEmbedding, recordAssistantSearch, recordAssistantRetrieval, redactAssistantText } from '../src/utils/site_assistant_monitor.js';
import { createAdminAssistantRoutes } from '../src/routes/admin_assistant.js';
import { createSiteAssistantRoutes } from '../src/routes/site_assistant.js';
import { AssistantFailure } from '../src/utils/site_assistant_diagnostics.js';

const input = { uid: 7, question: 'How do I practise PLL?', lang: 'en', model: 'test-model', streaming: true, imageCount: 1, historyCount: 2 };
describe('private assistant monitoring', () => {
  it('keeps a full Chinese answer durable when artifacts and retrieval metadata exceed the journal byte budget', async () => {
    const run = vi.fn().mockResolvedValue([]);
    const monitor = await startAssistantMonitor(input, run);
    await monitor.run(async () => {
      recordAssistantStage('tool', 12, false, 'web_search');
      recordAssistantSearch('https://dashscope.aliyuncs.com')(1);
      for (let i = 0; i < 30; i++) recordAssistantRetrieval({ mode: 'hybrid', hits: Array.from({ length: 6 }, (_, n) => ({ id: `${i}-${n}`, href: '/' + '路径'.repeat(900) })) });
    });
    await monitor.finish('success', undefined, {
      answer: '完整回答'.repeat(3000), sources: [{ id: 'source', title: '资料', href: '/learn', read: true }],
      artifacts: [{ kind: 'table', title: '结果', columns: ['内容'], rows: Array.from({ length: 100 }, () => ['中文内容'.repeat(200)]) }],
    });
    const params = run.mock.calls.find(([statement]) => statement.startsWith('UPDATE'))![1];
    expect(params[5]).toBe('完整回答'.repeat(3000));
    expect(params[6]).toMatchObject({ truncated: true, sources: [{ id: 'source' }] });
    expect(params[7]).toMatchObject({ retrievalDetailsTruncated: true, tools: { web_search: 1 }, cost: { grossCny: 0.003, unpricedCalls: 0 } });
    expect(params[7].retrievals.every((r: { hits: unknown[] }) => r.hits.length === 0)).toBe(true);
    expect(Buffer.byteLength(JSON.stringify({ id: monitor.id, createdAt: new Date().toISOString(), params }), 'utf8')).toBeLessThan(256_000);
  });
  it('retains longer questions and answers while accounting for separate search charges and missing usage',async()=>{
    const run=vi.fn().mockResolvedValue([]);
    const monitor=await startAssistantMonitor({...input,question:'问'.repeat(8000),thinking:'deep'},run);
    monitor.run(()=>{recordAssistantSearch('https://dashscope.aliyuncs.com')(2);recordAssistantSearch('https://dashscope.aliyuncs.com')();});
    await monitor.finish('success',undefined,{answer:'答'.repeat(12000),sources:[]});
    expect(run.mock.calls[0][1][7]).toHaveLength(8000);
    const completed=run.mock.calls.find(([statement])=>statement.startsWith('UPDATE'))!;
    expect(completed[1][5]).toHaveLength(12000);
    expect(completed[1][7]).toMatchObject({policy:{thinking:'deep'},searches:[{requests:2,grossCny:0.006},{requests:null,grossCny:null}],cost:{grossCny:0.006,unpricedCalls:1}});
  });
  it('estimates only verified provider/model tariffs and leaves unknown usage unpriced',()=>{
    expect(assistantPrice('qwen3.8-flash','https://dashscope.aliyuncs.com',1000000,1000000).grossCny).toBe(3.5);
    expect(assistantPrice('text-embedding-v4','https://dashscope.aliyuncs.com',1000000).grossCny).toBe(0.5);
    expect(assistantPrice('qwen3-rerank','https://dashscope.aliyuncs.com',1000000).grossCny).toBe(0.5);
    expect(assistantPrice('qwen3-rerank','https://model.example',1000000).grossCny).toBeNull();
    expect(assistantPrice('qwen3-rerank','https://dashscope.aliyuncs.com',null).grossCny).toBeNull();
    expect(assistantPrice('qwen3.8-flash','https://other.invalid',100,100).grossCny).toBeNull();
    expect(assistantPrice('qwen3.8-flash','https://dashscope.aliyuncs.com',null,100).grossCny).toBeNull();
    expect(assistantPrice('unknown','https://dashscope.aliyuncs.com',100,100).grossCny).toBeNull();
    expect(assistantPrice('deepseek-flash','https://api.deepseek.com',1000000,1000000).grossCny).toBe(10);
    expect(assistantPrice('deepseek-flash','https://api.deepseek.com',1000000,1000000,800000).cacheAdjustedCny).toEqual({min:4.216,max:8.432});
    expect(assistantPrice('qwen3.8-flash','https://dashscope.aliyuncs.com',1000000,1000000,800000).cacheAdjustedCny).toEqual({min:2.94,max:2.94});
    expect(assistantPrice('deepseek-flash','https://api.deepseek.com',100,10,101).cacheAdjustedCny).toBeNull();
    expect(assistantPrice('deepseek-flash','https://api.deepseek.com',100,10).cacheAdjustedCny).toBeNull();
    expect(assistantPrice('deepseek-v4-pro','https://api.deepseek.com',1000000,1000000).grossCny).toBe(36);
    expect(assistantPrice('deepseek-flash','https://dashscope.aliyuncs.com',100,100).grossCny).toBeNull();
    expect(assistantPrice('deepseek-flash','https://api.deepseek.com',100,null).grossCny).toBeNull();
  });
  it('does not spend quota or call a model when durable admission fails',async()=>{
    const reserve=vi.fn(),answer=vi.fn(),entry=vi.fn();
    const app=createSiteAssistantRoutes({config:()=>({key:'test',baseUrl:'https://test.invalid',model:'test'}),now:Date.now,
      authenticate:async()=>({uid:7,wcaId:'2017YANR02'}),reserve,answer,entry,
      monitor:async()=>{throw new Error('private DB failure');}});
    const response=await app.request('/site-assistant',{method:'POST',body:JSON.stringify({question:'PLL?',lang:'en'})});
    expect(response.status).toBe(503);expect(await response.text()).not.toContain('private');expect(answer).not.toHaveBeenCalled();expect(reserve).not.toHaveBeenCalled();expect(entry).toHaveBeenCalledWith('recording_unavailable');
  });
  it('isolates concurrent telemetry and stores only bounded, redacted response fields once', async () => {
    const run = vi.fn().mockResolvedValue([]);
    const a = await startAssistantMonitor(input, run), b = await startAssistantMonitor({ ...input, uid: 8 }, run);
    await Promise.all([a.run(async () => {
      await Promise.resolve(); recordAssistantStage('tool', 17, false, 'navigation');
      const usage = recordAssistantModel('test-model', true);
      usage({ inputTokens: 10, outputTokens: 7, totalTokens: 17, inputTokenDetails: { noCacheTokens: 8, cacheReadTokens: 2, cacheWriteTokens: undefined }, outputTokenDetails: { textTokens: 4, reasoningTokens: 3 } });
      recordAssistantEmbedding('embedding-test')(5);
      a.text('partial');
    }), b.run(async () => { recordAssistantStage('page', 9, true); recordAssistantModel('unreported', false); })]);
    await a.finish('success', undefined, { answer: 'api_key=sk-secretcredentials123456', sources: [], actions: [] });
    await a.finish('error', 'timeout');
    await b.finish('cancelled', 'timeout');
    const updates = run.mock.calls.filter(([sql]) => sql.startsWith('UPDATE'));
    expect(updates).toHaveLength(2);
    expect(updates[0][1][5]).toBe('api_key=[redacted]');
    expect(updates[0][1][7].tools).toEqual({ navigation: 1 });
    expect(updates[0][1][7].models[0]).toMatchObject({ input: 10, output: 7, cached: 2, reasoning: 3, thinking: true });
    expect(updates[1][1][7].tools).toEqual({});
    expect(updates[1][1][7].models[0].input).toBeNull();
    expect(JSON.stringify(run.mock.calls)).not.toContain('secretcredentials');
    expect(redactAssistantText('Bearer secret-token password=hunter2')).toBe('Bearer [redacted] password=[redacted]');
  });
  it('requires admin authorization before every read and never caches private responses', async () => {
    const runQuery = vi.fn();
    const app = createAdminAssistantRoutes({ runQuery, authorize: async () => { throw new HTTPException(403); } });
    for (const path of ['summary', 'requests', 'requests/aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa']) {
      const response = await app.request(`/admin/assistant/${path}`);
      expect(response.status).toBe(403);
      expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    }
    expect(runQuery).not.toHaveBeenCalled();
  });
  it('rejects unbounded filters and IDs before reading records', async () => {
    const runQuery = vi.fn();
    const app = createAdminAssistantRoutes({ runQuery, authorize: async () => {} });
    for (const path of ['summary?days=365', 'requests?page=-1', 'requests?status=invalid', `requests?q=${'x'.repeat(101)}`, 'requests/not-a-uuid']) {
      expect((await app.request(`/admin/assistant/${path}`)).status).toBe(400);
    }
    expect(runQuery).not.toHaveBeenCalled();
  });
  it.each([false, true])('captures JSON/SSE success and actual model usage (stream=%s)', async streaming => {
    const writes: Promise<unknown>[] = [], run = vi.fn().mockResolvedValue([]);
    const app = createSiteAssistantRoutes({ config: () => ({ key: 'test', baseUrl: 'https://test.invalid', model: 'test' }), now: Date.now,
      authenticate: async () => ({ uid: 7, wcaId: '2017YANR02' }), reserve: async () => ({ allowed: true, retryAfter: 1 }),
      monitor: async value => { const recorder = await startAssistantMonitor(value, run); return { ...recorder, finish: (...args) => { const p = recorder.finish(...args); writes.push(p); return p; } }; },
      answer: async (_q, _lang, _config, _signal, _fetch, _history, _viewer, emit) => {
        recordAssistantStage('tool', 5, false, 'navigation'); recordAssistantModel('test', false);
        await emit?.({ type: 'answer', answer: 'PLL here', sources: [] });
        return { answer: 'PLL here', sources: [] };
      },
    });
    const response = await app.request('/site-assistant', { method: 'POST', body: JSON.stringify({ question: 'PLL?', lang: 'en' }), headers: { Accept: streaming ? 'text/event-stream' : 'application/json' } });
    expect(response.status).toBe(200); await response.text(); await Promise.all(writes);
    const update = run.mock.calls.find(([sql]) => sql.startsWith('UPDATE'))!;
    expect(update[1][0]).toBe('success'); expect(update[1][5]).toBe('PLL here');
    expect(update[1][7].tools.navigation).toBe(1); expect(update[1][7].models).toHaveLength(1);
    expect(update[1][4] == null).toBe(!streaming);
  });
  it.each(['error', 'cancelled', 'rejected'] as const)('records terminal outcome %s without changing quota or exposing provider bodies', async outcome => {
    const finish = vi.fn().mockResolvedValue(undefined), controller = new AbortController();
    const app = createSiteAssistantRoutes({ config: () => ({ key: 'test', baseUrl: 'https://test.invalid', model: 'test' }), now: Date.now,
      authenticate: async () => ({ uid: 7, wcaId: '2017YANR02' }), reserve: async () => ({ allowed: outcome !== 'rejected', retryAfter: 1 }),
      monitor: async () => ({ id: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa', run: fn => fn(), text: () => {}, finish }),
      answer: async () => { if (outcome === 'cancelled') controller.abort(); throw new AssistantFailure('model_unavailable'); },
    });
    const response = await app.request('/site-assistant', { method: 'POST', signal: controller.signal, body: JSON.stringify({ question: 'PLL?', lang: 'en' }) });
    await response.text();
    expect(finish.mock.calls[0][0]).toBe(outcome);
  });
  it('refuses admission when recording is unavailable, without exposing connection details', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      await expect(startAssistantMonitor(input, vi.fn().mockRejectedValue(new Error('private database connection details')))).rejects.toThrow('Assistant monitoring unavailable');
      expect(warn.mock.calls.join('')).not.toContain('private database');
    } finally { warn.mockRestore(); }
  });
});

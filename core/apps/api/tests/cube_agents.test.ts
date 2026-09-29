import { describe, expect, it, vi } from 'vitest';
import { createCubeAgentRoutes } from '../src/routes/cube_agents.js';
import { cubeAgentConfig, parseAgentMoves, runCubeAgents, type CubeAgentConfig } from '../src/utils/cube_agents.js';

const config: CubeAgentConfig = {
  qwen: { key: 'private-qwen-test-key', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1' },
  deepseek: { key: 'private-deepseek-test-key', baseUrl: 'https://api.deepseek.com' },
};
const response = (value: unknown, usage = true) => Response.json({
  choices: [{ message: { content: JSON.stringify(value) } }],
  ...(usage ? { usage: { prompt_tokens: 100, completion_tokens: 20, prompt_tokens_details: { cached_tokens: 30 } } } : {}),
});
const model = (moves: string, usage = true) => vi.fn<typeof fetch>(async (_url, init) => {
  const body = JSON.parse(String(init?.body));
  return response(body.messages[0].content.includes('You are the coordinator')
    ? { strategies: ['try U first', 'try R first', 'try F first', 'reason backwards'] }
    : { moves }, usage);
});

describe('real cube agents', () => {
  it('keeps provider credentials and request formats separate', async () => {
    const fetcher = model("U'");
    await runCubeAgents('U', config, AbortSignal.timeout(5000), () => {}, { fetcher });
    for (const [url, init] of fetcher.mock.calls) {
      const body = JSON.parse(String(init?.body));
      const authorization = new Headers(init?.headers).get('Authorization');
      if (body.model === 'deepseek-flash') {
        expect(url).toBe('https://api.deepseek.com/chat/completions');
        expect(authorization).toBe(`Bearer ${config.deepseek.key}`);
        expect(body.thinking).toEqual({ type: 'disabled' });
        expect(body).not.toHaveProperty('enable_thinking');
      } else {
        expect(url).toBe('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions');
        expect(authorization).toBe(`Bearer ${config.qwen.key}`);
        expect(body.enable_thinking).toBe(false);
        expect(body).not.toHaveProperty('thinking');
      }
    }
  });
  it('requires both keys and fixes DeepSeek to its official endpoint', () => {
    try {
      vi.stubEnv('SITE_ASSISTANT_API_KEY', 'qwen-test');
      vi.stubEnv('SITE_ASSISTANT_BASE_URL', 'https://dashscope.aliyuncs.com/compatible-mode/v1');
      vi.stubEnv('DEEPSEEK_API_KEY', '');
      expect(cubeAgentConfig()).toBeNull();
      vi.stubEnv('DEEPSEEK_API_KEY', 'deepseek-test');
      expect(cubeAgentConfig()?.deepseek.baseUrl).toBe('https://api.deepseek.com');
      vi.stubEnv('SITE_ASSISTANT_BASE_URL', 'https://untrusted.example/v1');
      expect(cubeAgentConfig()).toBeNull();
    } finally { vi.unstubAllEnvs(); }
  });
  it('records DeepSeek cache tokens and the returned model without applying an unstated discount', async () => {
    const fetcher: typeof fetch = async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      return Response.json({ model: 'provider-version', choices: [{ message: { content: JSON.stringify(
        body.messages[0].content.includes('You are the coordinator') ? { strategies: ['A', 'B', 'C', 'D'] } : { moves: "U'" }) } }],
        usage: { prompt_tokens: 100, completion_tokens: 20, prompt_cache_hit_tokens: 40 } });
    };
    const run = await runCubeAgents('U', config, AbortSignal.timeout(5000), () => {}, { fetcher });
    expect(run.teams[1].cachedTokens).toBe(200);
    expect(run.teams[1].returnedModel).toBe('provider-version');
    expect(run.teams[1].estimatedCny).toBeCloseTo(0.0018, 10);
    expect(run.teams[1].pricing?.basis).toBe('list-before-discounts');
  });
  it('accepts bounded verbose strategies and keeps invalid coordinator responses explicit', async () => {
    const fetcher: typeof fetch = async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      return response(body.messages[0].content.includes('You are the coordinator')
        ? { strategies: Array.from({ length: 4 }, () => 'Use the permutation tables to reason backwards. '.repeat(5)) }
        : { moves: "U'" });
    };
    const run = await runCubeAgents('U', config, AbortSignal.timeout(5000), () => {}, { fetcher });
    expect(run.teams.map(team => team.status)).toEqual(['solved', 'solved']);
    const invalid = await runCubeAgents('U', config, AbortSignal.timeout(5000), () => {}, { fetcher: async () => response({ strategies: [] }) });
    expect(invalid.teams.map(team => team.error)).toEqual(['provider_invalid_response', 'provider_invalid_response']);
    expect(invalid.teams.map(team => team.modelCalls)).toEqual([1, 1]);
  });
  it('verifies a proposed solution with the real cube, aggregates all in-flight usage and hides the scramble from models', async () => {
    const fetcher = model("U' R'");
    const run = await runCubeAgents('R U', config, AbortSignal.timeout(5000), () => {}, { fetcher });
    for (const [index, team] of run.teams.entries()) {
      expect(team.status).toBe('solved');
      expect(team.winner).toBe(0);
      expect(team.modelCalls).toBe(5);
      expect(team.toolCalls).toBe(1);
      expect(team.positions).toBe(3);
      expect(team.inputTokens).toBe(500);
      expect(team.outputTokens).toBe(100);
      expect(team.cachedTokens).toBe(150);
      expect(team.usageComplete).toBe(true);
      expect(team.estimatedCny).toBeCloseTo(index === 0 ? 0.00067 : 0.0018, 10);
      expect(team.agents[0].trials[0]).toMatchObject({ moves: "U' R'", solved: true, correct: 8 });
    }
    for (const [, init] of fetcher.mock.calls) {
      const body = JSON.parse(String(init?.body));
      const problem = JSON.parse(body.messages[1].content);
      expect(problem).not.toHaveProperty('scramble');
      expect(problem.initial).toHaveProperty('pieces');
      expect(['qwen3.8-flash', 'deepseek-flash']).toContain(body.model);
    }
    for (const provider of Object.values(config)) expect(JSON.stringify(run)).not.toContain(provider.key);
  });
  it('never declares a failed candidate solved and stops at the model-call cap', async () => {
    const fetcher = model('F');
    const run = await runCubeAgents('R U', config, AbortSignal.timeout(5000), () => {}, { fetcher });
    expect(fetcher).toHaveBeenCalledTimes(50);
    for (const team of run.teams) {
      expect(team.status).toBe('exhausted'); expect(team.winner).toBeNull(); expect(team.solvedMs).toBeNull();
      expect(team.toolCalls).toBe(24); expect(team.positions).toBe(2);
      expect(team.agents.every(agent => agent.trials.length === 6)).toBe(true);
    }
  });
  it('marks missing usage unknown instead of claiming zero cost', async () => {
    const run = await runCubeAgents('U', config, AbortSignal.timeout(5000), () => {}, { fetcher: model("U'", false) });
    expect(run.teams.map(team => team.usageComplete)).toEqual([false, false]);
  });
  it('reports a provider permission denial without exposing the provider response or retrying another model', async () => {
    const fetcher = vi.fn<typeof fetch>(async () => new Response('private provider details', { status: 403 }));
    const run = await runCubeAgents('U', config, AbortSignal.timeout(5000), () => {}, { fetcher });
    expect(fetcher).toHaveBeenCalledTimes(2);
    for (const team of run.teams) {
      expect(team.error).toBe('provider_access_denied');
      expect(team.status).toBe('error');
      expect(team.toolCalls).toBe(0);
      expect(team.usageComplete).toBe(false);
    }
    expect(JSON.stringify(run)).not.toContain('private provider details');
  });
  it('rejects arbitrary code, wide moves and oversized algorithms', () => {
    for (const bad of ['fetch(secret)', 'x', 'Rw', 'R4', 'L', 'U '.repeat(13)]) expect(() => parseAgentMoves(bad)).toThrow();
    expect(parseAgentMoves(" R2  U' F ")).toBe("R2 U' F");
  });
  it('cancels provider requests and reports incomplete usage', async () => {
    const abort = new AbortController();
    const fetcher: typeof fetch = async (_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
      queueMicrotask(() => abort.abort());
    });
    const run = await runCubeAgents('R', config, abort.signal, () => {}, { fetcher });
    expect(run.status).toBe('stopped');
    expect(run.teams.map(team => team.usageComplete)).toEqual([false, false]);
  });
  it('checkpoints received usage during a run and recovers unfinished calls after restart', async () => {
    const run = await runCubeAgents('U', config, AbortSignal.timeout(5000), () => {}, { fetcher: model("U'") });
    run.status = 'running';
    run.teams[0].finishedMs = null; // Winner found; peers may still be billable.
    run.teams[1].status = 'running'; run.teams[1].finishedMs = null;
    const saved: unknown[] = [];
    const deps = { config: () => config, reserve: () => true,
      authenticate: async () => ({ name: 'Admin', wcaId: '__test__', isAdmin: true }),
      latest: () => structuredClone(run), save: (value: unknown) => { saved.push(structuredClone(value)); },
      run: vi.fn<typeof runCubeAgents>(async (_scramble, _config, _signal, emit) => {
        emit(run);
        expect(saved).toHaveLength(1);
        return { ...run, status: 'stopped' };
      }),
    };
    const routes = createCubeAgentRoutes(deps);
    const latest = (await (await routes.request('/cube-agents')).json()).latest;
    expect(latest.status).toBe('stopped');
    expect(latest.teams[0].status).toBe('solved');
    expect(latest.teams[1].status).toBe('stopped');
    expect(latest.teams.map((team: { usageComplete: boolean }) => team.usageComplete)).toEqual([false, false]);
    expect(latest.teams[0].inputTokens).toBe(500);
    await (await routes.request('/cube-agents/runs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"difficulty":2}' })).text();
    expect(saved).toHaveLength(2);
  });
  it('requires admin before quota or paid calls and rejects an arbitrary model override', async () => {
    const reserve = vi.fn(() => true);
    const run = vi.fn(runCubeAgents);
    const deps = { config: () => config, run, reserve, latest: () => null, save: () => {},
      authenticate: async () => ({ name: 'Admin', wcaId: '__test__', isAdmin: true }) };
    const denied = createCubeAgentRoutes({ ...deps, authenticate: async () => { throw new Error('denied'); } });
    const request = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ difficulty: 3 }) };
    expect((await denied.request('/cube-agents/runs', request)).status).toBe(403);
    expect(reserve).not.toHaveBeenCalled(); expect(run).not.toHaveBeenCalled();
    const allowed = createCubeAgentRoutes(deps);
    expect((await allowed.request('/cube-agents/runs', { ...request, body: JSON.stringify({ difficulty: 3, model: 'expensive' }) })).status).toBe(400);
    const info = await allowed.request('/cube-agents');
    expect(info.headers.get('cache-control')).toBe('no-store');
    const publicInfo = await info.text();
    for (const provider of Object.values(config)) expect(publicInfo).not.toContain(provider.key);
    const limited = createCubeAgentRoutes({ ...deps, reserve: () => false });
    expect((await limited.request('/cube-agents/runs', request)).status).toBe(429);
    expect(run).not.toHaveBeenCalled();
  });
});

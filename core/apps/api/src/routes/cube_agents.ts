import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { streamSSE } from 'hono/streaming';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import { CUBE_AGENT_LIMITS, CUBE_AGENT_MODELS, type CubeAgentRun } from '@cuberoot/shared/cube-agents';
import { requireAdminOrApiKey } from '../utils/recon_helpers.js';
import { cubeAgentConfig, generateAgentScramble, runCubeAgents } from '../utils/cube_agents.js';

const directory = () => process.env.CUBE_AGENTS_DATA_DIR || resolve('data/cube-agents');
function load<T>(name: string, fallback: T): T {
  try { return JSON.parse(readFileSync(resolve(directory(), name), 'utf8')); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return fallback; throw error; }
}
function save(name: string, data: unknown) {
  mkdirSync(directory(), { recursive: true });
  const file = resolve(directory(), name);
  writeFileSync(`${file}.tmp`, JSON.stringify(data), { mode: 0o600 });
  renameSync(`${file}.tmp`, file);
}
export function createCubeAgentRoutes(deps = {
  config: cubeAgentConfig, run: runCubeAgents, authenticate: requireAdminOrApiKey,
  latest: () => load<CubeAgentRun | null>('latest.json', null),
  save: (run: CubeAgentRun) => save('latest.json', run),
  reserve: () => {
    const day = new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);
    const ledger = load('quota.json', { day, count: 0 });
    const count = ledger.day === day ? ledger.count : 0;
    if (!Number.isSafeInteger(count) || count < 0 || count >= CUBE_AGENT_LIMITS.dailyRuns) return false;
    save('quota.json', { day, count: count + 1 }); return true;
  },
}) {
  const routes = new Hono();
  let active = false;
  routes.use('/cube-agents', async (c, next) => { c.header('Cache-Control', 'no-store'); await next(); });
  routes.use('/cube-agents/*', async (c, next) => { c.header('Cache-Control', 'no-store'); await next(); });
  routes.use('/cube-agents/runs', bodyLimit({ maxSize: 1024 }));
  routes.get('/cube-agents', c => {
    const latest = deps.latest();
    // Recover the last checkpoint after a process restart without claiming final billing.
    if (latest?.status === 'running' && !active) {
      latest.status = 'stopped';
      for (const team of latest.teams) if (team.finishedMs === null) {
        if (team.status === 'running' || team.status === 'planning') team.status = 'stopped';
        team.usageComplete = false;
        for (const agent of team.agents) if (agent.status === 'thinking' || agent.status === 'waiting') agent.status = 'stopped';
      }
    }
    return c.json({ available: Boolean(deps.config()), busy: active, models: CUBE_AGENT_MODELS, latest });
  });
  routes.post('/cube-agents/runs', async c => {
    try { await deps.authenticate(c); } catch { return c.json({ error: 'admin_required' }, 403); }
    const parsed = z.object({ difficulty: z.union([z.literal(2), z.literal(3), z.literal(5), z.literal(8)]) }).strict()
      .safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: 'invalid_input' }, 400);
    const config = deps.config();
    if (!config) return c.json({ error: 'unavailable' }, 503);
    if (active) return c.json({ error: 'busy' }, 429);
    if (!deps.reserve()) return c.json({ error: 'daily_limit' }, 429);
    active = true; c.header('X-Accel-Buffering', 'no');
    return streamSSE(c, async stream => {
      const controller = new AbortController();
      stream.onAbort(() => controller.abort());
      const signal = AbortSignal.any([controller.signal, c.req.raw.signal, AbortSignal.timeout(CUBE_AGENT_LIMITS.timeoutMs)]);
      let pending = Promise.resolve();
      const emit = (run: CubeAgentRun) => { deps.save(run); pending = pending.then(async () => {
        if (!stream.aborted) await stream.writeSSE({ event: 'run', data: JSON.stringify(run) });
      }).catch(() => { controller.abort(); }); };
      const heartbeat = setInterval(() => { pending = pending.then(async () => {
        if (!stream.aborted) await stream.writeSSE({ event: 'heartbeat', data: '{}' });
      }).catch(() => controller.abort()); }, 5000);
      try {
        const result = await deps.run(generateAgentScramble(parsed.data.difficulty), config, signal, emit);
        deps.save(result); await pending;
      } catch {
        if (!stream.aborted) await stream.writeSSE({ event: 'error', data: JSON.stringify({ error: 'run_failed' }) });
      } finally { clearInterval(heartbeat); controller.abort(); active = false; }
    });
  });
  return routes;
}
export const cubeAgentRoutes = createCubeAgentRoutes();

import { randomInt, randomUUID } from 'node:crypto';
import { puzzles } from 'cubing/puzzles';
import { z } from 'zod';
import { CUBE_AGENT_MODELS, CUBE_AGENT_LIMITS, type CubeAgentRun, type CubeAgentTeam } from '@cuberoot/shared/cube-agents';

export interface CubeAgentConfig { key: string; baseUrl: string }
export function cubeAgentConfig(): CubeAgentConfig | null {
  const key = process.env.SITE_ASSISTANT_API_KEY;
  const baseUrl = process.env.SITE_ASSISTANT_BASE_URL;
  if (!key || !baseUrl) return null;
  let url: URL;
  try { url = new URL(baseUrl); } catch { return null; }
  // Prices are specific to Beijing. Never send this key to another provider.
  if (url.protocol !== 'https:' || !(url.hostname === 'dashscope.aliyuncs.com' || url.hostname.endsWith('.cn-beijing.maas.aliyuncs.com'))) return null;
  return { key, baseUrl: baseUrl.replace(/\/$/, '') };
}

export function parseAgentMoves(value: unknown): string {
  const moves = z.string().max(100).parse(value).trim().split(/\s+/).filter(Boolean);
  if (moves.length > 12 || moves.some(move => !/^[URF](2|')?$/.test(move))) throw new Error('invalid_moves');
  return moves.join(' ');
}

export function generateAgentScramble(length: number): string {
  const result: string[] = [];
  let previous = '';
  for (let i = 0; i < length; i++) {
    const faces = ['U', 'R', 'F'].filter(face => face !== previous);
    previous = faces[randomInt(faces.length)];
    result.push(previous + ['', '2', "'"][randomInt(3)]);
  }
  return result.join(' ');
}

const usageSchema = z.object({ prompt_tokens: z.number().int().nonnegative(), completion_tokens: z.number().int().nonnegative(),
  prompt_tokens_details: z.object({ cached_tokens: z.number().int().nonnegative().optional() }).optional() });
const SYSTEM = `Solve a 2x2 cube using only U, U2, U', R, R2, R', F, F2, F'. You have a test_moves tool implemented by the server. Each answer invokes it once with a candidate sequence FROM THE ORIGINAL starting state, not from your last attempt. Return JSON {"moves":"R U' ..."}, at most 12 moves. You get 6 attempts. An empty sequence tests the starting state. Do not claim success: the server checks it. You cannot call a solver, execute code or use other tools.
States contain CORNERS.pieces (piece ID at each slot) and CORNERS.orientation (twist modulo 3). The goal is pieces [0,1,2,3,4,5,6,7], orientations all zero. A move with permutation p and orientationDelta d transforms a state by newPieces[i]=oldPieces[p[i]], newOrientation[i]=(oldOrientation[p[i]]+d[i])%3. Repeating a quarter turn twice gives 2; three times gives prime. The fixed corner stays fixed. Use the move tables provided to reason about candidate solutions. The hidden scramble is not available. Different agents explore different approaches; the first server-verified solution wins.`;

export async function runCubeAgents(scramble: string, config: CubeAgentConfig, signal: AbortSignal,
  emit: (run: CubeAgentRun) => void, deps: { fetcher?: typeof fetch; now?: () => number } = {},
): Promise<CubeAgentRun> {
  const fetcher = deps.fetcher ?? fetch;
  const now = deps.now ?? performance.now.bind(performance);
  const kpuzzle = await puzzles['2x2x2'].kpuzzle();
  const initial = kpuzzle.defaultPattern().applyAlg(parseAgentMoves(scramble));
  const solved = kpuzzle.defaultPattern();
  const start = now();
  const run: CubeAgentRun = {
    version: 1, id: randomUUID(), startedAt: new Date().toISOString(), scramble,
    elapsedMs: 0, status: 'running', teams: CUBE_AGENT_MODELS.map(model => ({
      model: model.id, name: model.name, status: 'planning', winner: null, solvedMs: null, finishedMs: null,
      agents: Array.from({ length: 4 }, () => ({ status: 'waiting', trials: [] })),
      positions: 1, toolCalls: 0, modelCalls: 0, inputTokens: 0, outputTokens: 0, cachedTokens: 0,
      estimatedCny: 0, usageComplete: true,
    })),
  };
  const publish = () => { run.elapsedMs = Math.round(now() - start); emit(structuredClone(run)); };
  const tables = Object.fromEntries(['U', 'R', 'F'].map(move => [move, kpuzzle.moveToTransformation(move).transformationData.CORNERS]));
  const problem = { initial: initial.patternData.CORNERS, quarterTurns: tables };
  publish();
  const complete = async (team: CubeAgentTeam, prompt: unknown, coordinator = false): Promise<unknown> => {
    signal.throwIfAborted();
    const content = JSON.stringify(prompt);
    if (content.length > 12_000) throw new Error('prompt_limit');
    team.modelCalls++;
    publish();
    let accounted = false;
    try {
      const response = await fetcher(`${config.baseUrl}/chat/completions`, {
        method: 'POST', redirect: 'error', signal: AbortSignal.any([signal, AbortSignal.timeout(30_000)]),
        headers: { Authorization: `Bearer ${config.key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: team.model, enable_thinking: false, temperature: 0.4,
          max_tokens: CUBE_AGENT_LIMITS.outputTokens, response_format: { type: 'json_object' },
          messages: [{ role: 'system', content: coordinator
            ? `${SYSTEM}\nYou are the coordinator. Assign four distinct brief strategies, one per agent. Return JSON {"strategies":["...","...","...","..."]}. Each strategy is at most 160 characters. Do not output a solution.` : SYSTEM },
          { role: 'user', content }],
        }),
      });
      if (!response.ok) {
        team.error = response.status === 401 || response.status === 403 ? 'provider_access_denied'
          : response.status === 429 ? 'provider_rate_limited' : 'provider_error';
        await response.body?.cancel();
        throw new Error(team.error);
      }
      const reader = response.body?.getReader();
      if (!reader) throw new Error('provider_empty');
      let text = '';
      const decoder = new TextDecoder();
      try {
        for (;;) {
          const chunk = await reader.read();
          if (chunk.done) break;
          text += decoder.decode(chunk.value, { stream: true });
          if (text.length > 100_000) throw new Error('provider_oversize');
        }
        text += decoder.decode();
      } finally { await reader.cancel(); }
      const payload = JSON.parse(text);
      const usage = usageSchema.safeParse(payload.usage);
      if (usage.success) {
        const u = usage.data;
        team.inputTokens += u.prompt_tokens;
        team.outputTokens += u.completion_tokens;
        team.cachedTokens += Math.min(u.prompt_tokens, u.prompt_tokens_details?.cached_tokens ?? 0);
        const price = CUBE_AGENT_MODELS.find(model => model.id === team.model)!;
        team.estimatedCny += (u.prompt_tokens * price.inputPerMillion + u.completion_tokens * price.outputPerMillion) / 1_000_000;
        accounted = true;
      }
      return JSON.parse(payload.choices?.[0]?.message?.content ?? '');
    } finally { if (!accounted) team.usageComplete = false; publish(); }
  };
  await Promise.all(run.teams.map(async team => {
    const visited = new Set([JSON.stringify(initial.patternData.CORNERS)]);
    try {
      const plan = z.object({ strategies: z.array(z.string().min(1).max(160)).length(4) }).parse(await complete(team, problem, true));
      team.status = 'running'; publish();
      await Promise.all(team.agents.map(async (agent, index) => {
        const feedback: unknown[] = [];
        try {
          for (let round = 0; round < CUBE_AGENT_LIMITS.rounds; round++) {
            if (signal.aborted || team.winner !== null) break;
            agent.status = 'thinking'; publish();
            const answer = await complete(team, { ...problem, strategy: plan.strategies[index], agent: index + 1, attempts: feedback });
            // Account for calls already in flight after a peer succeeds before stopping.
            if (signal.aborted || team.winner !== null) break;
            let moves: string;
            try { moves = parseAgentMoves(z.object({ moves: z.unknown() }).parse(answer).moves); }
            catch { feedback.push({ error: 'Only up to 12 space-separated U/R/F moves are valid.' }); continue; }
            let state = initial;
            for (const move of moves.split(' ').filter(Boolean)) {
              state = state.applyMove(move);
              visited.add(JSON.stringify(state.patternData.CORNERS));
            }
            const corners = state.patternData.CORNERS;
            const correct = corners.pieces.reduce((count, piece, slot) => count + Number(piece === slot && corners.orientation[slot] === 0), 0);
            const verified = state.isIdentical(solved);
            const atMs = Math.round(now() - start);
            agent.trials.push({ atMs, moves, solved: verified, correct });
            team.toolCalls++; team.positions = visited.size;
            feedback.push({ moves, state: corners, correct, solved: verified });
            if (verified) {
              agent.status = 'solved'; team.status = 'solved'; team.winner = index; team.solvedMs = atMs;
              publish(); break;
            }
            publish();
          }
          if (agent.status !== 'solved') agent.status = signal.aborted || team.winner !== null ? 'stopped' : 'exhausted';
        } catch { agent.status = signal.aborted ? 'stopped' : 'error'; }
        publish();
      }));
      if (team.winner === null) team.status = signal.aborted ? 'stopped' : team.agents.every(agent => agent.status === 'error') ? 'error' : 'exhausted';
    } catch {
      team.status = signal.aborted ? 'stopped' : 'error';
      for (const agent of team.agents) if (agent.status === 'waiting') agent.status = signal.aborted ? 'stopped' : 'error';
    }
    team.finishedMs = Math.round(now() - start); publish();
  }));
  run.status = signal.aborted ? 'stopped' : 'done'; publish();
  return run;
}

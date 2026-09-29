/** Explicit opt-in, bounded real-provider validation; writes only public run data. */
import { writeFileSync } from 'node:fs';
import { cubeAgentConfig, runCubeAgents } from '../src/utils/cube_agents.js';
const output = process.argv.find(arg => arg.startsWith('--output='))?.slice(9);
const scramble = process.argv.find(arg => arg.startsWith('--scramble='))?.slice(11) ?? 'R U';
if (!process.argv.includes('--run') || !output) throw new Error('Use --run --output=/absolute/path.json [--scramble="R U"]');
const config = cubeAgentConfig();
if (!config) throw new Error('Beijing Model Studio and DEEPSEEK_API_KEY configuration are required');
let state = '';
const fetcher: typeof fetch = async (input, init) => {
  const result = await fetch(input, init);
  if (process.argv.includes('--diagnostic')) {
    const body = await result.clone().json().catch(() => ({}));
    let response = String(body.error?.message ?? body.choices?.[0]?.message?.content ?? '');
    for (const provider of Object.values(config)) response = response.replaceAll(provider.key, '[redacted]');
    console.log(JSON.stringify({ status: result.status, model: JSON.parse(String(init?.body)).model, response: response.slice(0, 1500) }));
  }
  return result;
};
const run = await runCubeAgents(scramble, config, AbortSignal.timeout(120_000), value => {
  const next = value.teams.map(team => `${team.name}: ${team.status}, ${team.modelCalls} calls, ${team.toolCalls} tests`).join(' | ');
  if (next !== state) { state = next; console.log(next); }
}, { fetcher });
writeFileSync(output, JSON.stringify(run, null, 2));
console.log(JSON.stringify({ id: run.id, status: run.status, teams: run.teams.map(({ agents: _agents, ...team }) => team) }));

import { apiUrl, streamApiUrl } from './api-base';
import { authHeaders, handleApi } from './admin-api';
import type { CubeAgentOverview, CubeAgentRun } from '@cuberoot/shared/cube-agents';

export async function getCubeAgentOverview(signal?: AbortSignal): Promise<CubeAgentOverview> {
  return handleApi(await fetch(apiUrl('/v1/cube-agents'), { cache: 'no-store', signal }));
}
export async function startCubeAgentRun(difficulty: number, signal: AbortSignal, onRun: (run: CubeAgentRun) => void) {
  const response = await fetch(streamApiUrl('/v1/cube-agents/runs'), {
    method: 'POST', headers: authHeaders(), body: JSON.stringify({ difficulty }), signal,
  });
  if (!response.ok) await handleApi(response);
  const reader = response.body?.getReader();
  if (!reader) throw new Error('empty_stream');
  const decoder = new TextDecoder();
  let buffer = '';
  let finished = false;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      buffer = buffer.replace(/\r\n/g, '\n');
      if (buffer.length > 1_000_000) throw new Error('invalid_stream');
      let end: number;
      while ((end = buffer.indexOf('\n\n')) >= 0) {
        const event = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        const type = event.split('\n').find(line => line.startsWith('event:'))?.slice(6).trim();
        const data = event.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trim()).join('\n');
        if (type === 'error') throw new Error('run_failed');
        if (type === 'run') {
          const run = JSON.parse(data) as CubeAgentRun;
          if (run.version !== 1 || run.teams.length !== 2) throw new Error('invalid_stream');
          onRun(run);
          finished = run.status !== 'running';
        }
      }
      if (done) break;
    }
    if (!finished) throw new Error('stream_interrupted');
  } finally { await reader.cancel(); }
}

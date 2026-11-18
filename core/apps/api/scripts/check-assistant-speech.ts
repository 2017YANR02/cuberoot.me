/** Local-only real-provider acceptance. No server auth/DB bypass or production configuration writes. */
import { mkdir, readFile, writeFile, lstat } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { createSpeechSynthesizer, speechChunks, speechConfig, speechAudioType } from '../src/utils/site_assistant_speech.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const configPath = resolve(root, process.argv.find(arg => arg.startsWith('--env-file='))?.slice('--env-file='.length) || '.local-data/assistant-tts/config.env');
const samples = [
  { id: 'zh-short', lang: 'zh' as const, text: '你好，欢迎来到 CubeRoot。今天我们练习三阶魔方。请先观察，再开始计时。' },
  { id: 'mixed', lang: 'zh' as const, text: '这次平均成绩是十二点三四秒。CFOP 包括十字、F2L、OLL 和 PLL。Let’s practise one step at a time. 比赛将在十二月十九日举行，请提前三十分钟签到。' },
  { id: 'zh-long', lang: 'zh' as const, text: '练习时，先观察魔方的状态，再选择合适的步骤。保持动作连贯，不必一开始就追求速度。完成一次还原后，记录用时，并回顾哪些地方出现了停顿。下一次练习，可以只关注其中一个问题。'.repeat(8) },
];
async function main() {
  const stat = await lstat(configPath);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.mode & 0o077) throw Error('Private config must be an owner-only regular file (0600).');
  const env = parseEnv(await readFile(configPath, 'utf8'));
  // Load only provider settings from the existing private config; never DB/auth secrets.
  for (const key of ['DASHSCOPE_API_KEY', 'SITE_ASSISTANT_API_KEY', 'SITE_ASSISTANT_BASE_URL', 'SITE_ASSISTANT_TTS_ENABLED', 'SITE_ASSISTANT_TTS_API_KEY', 'SITE_ASSISTANT_TTS_BASE_URL', 'SITE_ASSISTANT_TTS_MODEL', 'SITE_ASSISTANT_TTS_VOICE']) process.env[key] = env[key]?.trim() || process.env[key] || '';
  process.env.SITE_ASSISTANT_TTS_ENABLED = env.SITE_ASSISTANT_TTS_ENABLED || '1';
  const config = speechConfig();
  if (!config) throw Error('Missing or invalid local Bailian key / Beijing Bailian origin. No request sent.');
  const plan = { model: config.model, voice: config.voice, samples: samples.map(s => ({ id: s.id, characters: s.text.length, segments: speechChunks(s.text).length })) };
  if (!process.argv.includes('--run')) { console.log(JSON.stringify({ ready: true, paidCalls: false, ...plan }, null, 2)); return; }
  const out = resolve(root, '.local-data/assistant-tts', new Date().toISOString().replace(/[:.]/g, '-'));
  await mkdir(out, { recursive: true, mode: 0o700 });
  const metrics: Array<Record<string, unknown>> = [];
  let requests: Array<{ phase: string; headersMs: number; status: number }> = [];
  const fetcher: typeof fetch = async (input, init) => {
    const start = performance.now();
    const response = await fetch(input, init);
    requests.push({ phase: init?.method === 'POST' ? 'synthesis' : 'audio-download', headersMs: Math.round(performance.now() - start), status: response.status });
    return response;
  };
  const speak = createSpeechSynthesizer(fetcher);
  const signal = AbortSignal.timeout(180_000);
  const save = async () => writeFile(resolve(out, 'result.json'), JSON.stringify({ ...plan, metrics, quality: 'not_yet_listened', note: 'Single cold call per segment; headersMs is not first audible playback latency.' }, null, 2), { mode: 0o600 });
  for (const sample of samples) {
    const chunks = speechChunks(sample.text);
    await writeFile(resolve(out, `${sample.id}.txt`), sample.text, { mode: 0o600 });
    for (const [index, text] of chunks.entries()) {
      requests = [];
      const start = performance.now();
      try {
        const audio = await speak(0, text, sample.lang, signal);
        const readyMs = Math.round(performance.now() - start);
        await writeFile(resolve(out, `${sample.id}-${index}.${speechAudioType(audio) === 'audio/wav' ? 'wav' : 'mp3'}`), audio, { mode: 0o600 });
        const cacheStart = performance.now();
        const cached = await speak(0, text, sample.lang, signal);
        metrics.push({ sample: sample.id, segment: index, readyMs, cacheMs: Math.round(performance.now() - cacheStart), cacheEqual: audio.equals(cached), bytes: audio.length, requests });
        await save();
      } catch {
        metrics.push({ sample: sample.id, segment: index, failed: true, elapsedMs: Math.round(performance.now() - start), requests });
        await save();
        throw Error(`Real TTS failed; stopped without retry. Sanitized results: ${out}`);
      }
    }
  }
  console.log(JSON.stringify({ out, metrics }, null, 2));
}
main().catch(error => { console.error(error instanceof Error && !error.message.includes('http') ? error.message : 'Invalid local configuration.'); process.exitCode = 1; });

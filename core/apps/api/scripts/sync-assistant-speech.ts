/** Accept a private, narrowly scoped TTS config on stdin; never log its contents. */
import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { pathToFileURL } from 'node:url';
import { speechConfig } from '../src/utils/site_assistant_speech.js';

const fields = ['SITE_ASSISTANT_TTS_ENABLED', 'SITE_ASSISTANT_TTS_API_KEY', 'SITE_ASSISTANT_TTS_BASE_URL', 'SITE_ASSISTANT_TTS_MODEL', 'SITE_ASSISTANT_TTS_VOICE'];
export function mergeSpeechConfiguration(original: string, input: string): string {
  if (!input.trim() || Buffer.byteLength(input) > 16_384) throw new Error('Invalid private speech configuration');
  const incoming = parseEnv(input), existing = parseEnv(original);
  if (Object.keys(incoming).some(key => !fields.includes(key))) throw new Error('Private speech configuration contains unrelated settings');
  if (!/^[A-Za-z0-9_.-]{10,512}$/.test(incoming.SITE_ASSISTANT_TTS_API_KEY || '') || !incoming.SITE_ASSISTANT_TTS_BASE_URL) throw new Error('Independent speech key and Beijing origin are required');
  if (incoming.SITE_ASSISTANT_TTS_ENABLED && !['0', '1'].includes(incoming.SITE_ASSISTANT_TTS_ENABLED)) throw new Error('Invalid speech switch');
  for (const key of fields) if (/[\r\n]/.test(incoming[key] || '') || /[\r\n]/.test(existing[key] || '')) throw new Error('Multiline speech settings are not supported');
  for (const key of ['SITE_ASSISTANT_TTS_MODEL', 'SITE_ASSISTANT_TTS_VOICE']) if (incoming[key] && !/^[A-Za-z0-9_.-]{1,100}$/.test(incoming[key])) throw new Error('Invalid speech model or voice');
  const desired = Object.fromEntries(fields.map(key => [key, incoming[key] || '']));
  // Runtime opt-out is a kill switch and must survive future releases.
  desired.SITE_ASSISTANT_TTS_ENABLED = existing.SITE_ASSISTANT_TTS_ENABLED === '0' ? '0' : incoming.SITE_ASSISTANT_TTS_ENABLED || '1';
  if (!speechConfig({ ...desired, SITE_ASSISTANT_TTS_ENABLED: '1' })) throw new Error('Unsupported speech provider configuration');
  if (fields.every(key => (existing[key] || '') === desired[key])) return original;
  const assignment = new RegExp(`^(?:export\\s+)?(?:${fields.join('|')})\\s*=`);
  const kept = original.split(/(?<=\n)/).filter(line => !assignment.test(line.trimStart())).join('');
  return `${kept}${kept.endsWith('\n') ? '' : '\n'}${fields.map(key => `${key}=${desired[key]}`).join('\n')}\n`;
}

function main() {
  const file = process.argv[2];
  if (!file) throw new Error('Runtime env path required');
  const original = readFileSync(file, 'utf8'), updated = mergeSpeechConfiguration(original, readFileSync(0, 'utf8'));
  if (updated !== original) {
    try { writeFileSync(`${file}.before-assistant-speech-secret`, original, { mode: 0o600, flag: 'wx' }); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }
    const pending = `${file}.assistant-speech-secret.pending`;
    writeFileSync(pending, updated, { mode: 0o600, flag: 'wx' }); renameSync(pending, file);
  }
  console.log('Independent assistant speech configuration synchronized; credentials omitted');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { main(); } catch { console.error('Private speech configuration rejected; runtime configuration was not replaced'); process.exitCode = 1; }
}

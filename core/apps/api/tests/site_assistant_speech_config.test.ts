import { expect, it } from 'vitest';
import { parseEnv } from 'node:util';
import { mergeSpeechConfiguration } from '../scripts/sync-assistant-speech.js';

const privateConfig = 'SITE_ASSISTANT_TTS_API_KEY=fixture-private-key\nSITE_ASSISTANT_TTS_BASE_URL=https://ws-test.cn-beijing.maas.aliyuncs.com\n';
it('updates only speech fields, preserves unrelated bytes and is idempotent', () => {
  const original = '# runtime\nDB_PASS="unchanged value"\nSITE_ASSISTANT_API_KEY=chat-key\nSITE_ASSISTANT_TTS_API_KEY=old-key\n';
  const updated = mergeSpeechConfiguration(original, privateConfig);
  expect(updated).toContain('# runtime\nDB_PASS="unchanged value"\nSITE_ASSISTANT_API_KEY=chat-key\n');
  expect(parseEnv(updated)).toMatchObject({ SITE_ASSISTANT_TTS_API_KEY: 'fixture-private-key', SITE_ASSISTANT_TTS_ENABLED: '1' });
  expect(updated).not.toContain('old-key');
  expect(mergeSpeechConfiguration(updated, privateConfig)).toBe(updated);
});
it('keeps an explicit runtime opt-out after secrets are updated', () => {
  expect(parseEnv(mergeSpeechConfiguration('SITE_ASSISTANT_TTS_ENABLED=0\n', privateConfig + 'SITE_ASSISTANT_TTS_ENABLED=1\n')).SITE_ASSISTANT_TTS_ENABLED).toBe('0');
});
it.each([
  privateConfig + 'DB_PASS=must-not-overwrite\n',
  privateConfig.replace('https://ws-test.cn-beijing.maas.aliyuncs.com', 'https://example.com'),
  privateConfig.replace('fixture-private-key', ''),
  privateConfig + 'SITE_ASSISTANT_TTS_MODEL="invalid\nvalue"\n',
  privateConfig + 'SITE_ASSISTANT_TTS_BASE_URL=https://dashscope.aliyuncs.com\nSITE_ASSISTANT_TTS_MODEL=qwen-audio-3.1-tts-flash\n',
])('rejects unsafe or unsupported configuration without exposing its values', input => {
  try { mergeSpeechConfiguration('DB_PASS=unchanged\n', input); throw new Error('Expected rejection'); }
  catch (error) { expect((error as Error).message).not.toMatch(/fixture-private-key|must-not-overwrite|https:/); expect((error as Error).message).not.toBe('Expected rejection'); }
});

import { afterAll, describe, expect, it, vi } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkApnsConfig, loadApnsEnv, reportApnsConfig } from '../scripts/apns-config-check';
import { readApnsConfig } from '../src/utils/apns_config';

const directory = mkdtempSync(join(tmpdir(), 'apns-config-'));
afterAll(() => rmSync(directory, { recursive: true, force: true }));
const options = { topic: 'me.cuberoot.app', environment: 'sandbox' };
const keyPath = join(directory, 'fixture.p8');
const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
writeFileSync(keyPath, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
const complete = { RECORD_PUSH_ENABLED: '1', APNS_ENABLED: '1', APNS_TEAM_ID: 'PRIVATE_TEAM_FIXTURE', APNS_KEY_ID: 'PRIVATE_KEY_ID_FIXTURE', APNS_PRIVATE_KEY_PATH: keyPath };

describe('offline APNs config check', () => {
  it('reports empty config as disabled, but required mode fails every missing field', () => {
    expect(checkApnsConfig({}, options).errors).toEqual([]);
    expect(checkApnsConfig({}, options).configured).toBe(false);
    expect(checkApnsConfig({}, { ...options, requireEnabled: true }).errors).toHaveLength(5);
    expect(checkApnsConfig({ APNS_TEAM_ID: 'fixture' }, options).errors).toHaveLength(2);
    expect(checkApnsConfig({ APNS_ENABLED: 'true' }, options).errors).toContain('APNS_ENABLED: expected 0 or 1');
  });

  it('checks an actual local P-256 key without network/token creation and retains runtime gate semantics', () => {
    expect(checkApnsConfig(complete, options)).toMatchObject({ errors: [], configured: true, privateKeyStatus: 'EC-P256-sign-verify-passed' });
    expect(checkApnsConfig(complete, { ...options, environment: 'production' }).errors).toEqual([]);
    expect(readApnsConfig(options.topic, complete)?.topic).toBe(options.topic);
    expect(readApnsConfig(options.topic, { ...complete, RECORD_PUSH_ENABLED: '0' })).toBeNull();
    expect(readApnsConfig('unsupported', complete)).toBeNull();
    expect(readApnsConfig('me.cuberoot.app.debug', complete)?.topic).toBe('me.cuberoot.app.debug');
  });

  it('rejects wrong curves, malformed/missing keys and unsupported topic/environment', () => {
    const wrongPath = join(directory, 'wrong.p8');
    const wrongKey = generateKeyPairSync('ec', { namedCurve: 'secp384r1' }).privateKey;
    writeFileSync(wrongPath, wrongKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
    expect(checkApnsConfig({ ...complete, APNS_PRIVATE_KEY_PATH: wrongPath }, options).errors.join()).toContain('P-256');
    writeFileSync(wrongPath, 'PRIVATE_INVALID_CONTENT');
    expect(checkApnsConfig({ ...complete, APNS_PRIVATE_KEY_PATH: wrongPath }, options).privateKeyStatus).toBe('invalid');
    expect(checkApnsConfig({ ...complete, APNS_PRIVATE_KEY_PATH: join(directory, 'absent') }, options).privateKeyStatus).toBe('invalid');
    expect(checkApnsConfig(complete, { topic: 'PRIVATE_BAD_TOPIC', environment: 'PRIVATE_BAD_ENV' })).toMatchObject({ topic: 'invalid', environment: 'invalid' });
  });

  it.skipIf(process.platform === 'win32')('rejects a key readable by other users', () => {
    chmodSync(keyPath, 0o644);
    try { expect(checkApnsConfig(complete, options).errors.join()).toContain('0600'); }
    finally { chmodSync(keyPath, 0o600); }
  });

  it('selects only APNs fields from the API env file, preserves shell precedence and rejects APNs typos', () => {
    const path = join(directory, 'api.env');
    writeFileSync(path, 'DB_PASS=PRIVATE_DB_FIXTURE\nAPNS_ENABLED=0\nAPNS_TEAM_ID=FILE_FIXTURE\n');
    const loaded = loadApnsEnv(path, { APNS_TEAM_ID: 'SHELL_FIXTURE' });
    expect(loaded.APNS_TEAM_ID).toBe('SHELL_FIXTURE');
    expect(loaded).not.toHaveProperty('DB_PASS');
    expect(loadApnsEnv(path, { APNS_TEAM_ID: '' }).APNS_TEAM_ID).toBe('');
    writeFileSync(path, 'APNS_ENABELD=1\n');
    expect(() => loadApnsEnv(path, {})).toThrow('Unsupported APNS_ variable');
  });

  it('does not log team/key IDs, paths, content or rejected values', () => {
    const output: string[] = [];
    const log = vi.spyOn(console, 'log').mockImplementation(line => { output.push(String(line)); });
    const error = vi.spyOn(console, 'error').mockImplementation(line => { output.push(String(line)); });
    try {
      expect(reportApnsConfig(checkApnsConfig(complete, options))).toBe(true);
      expect(reportApnsConfig(checkApnsConfig({ ...complete, APNS_PRIVATE_KEY_PATH: 'PRIVATE_ABSENT_PATH' }, { topic: 'PRIVATE_TOPIC', environment: 'PRIVATE_ENV' }))).toBe(false);
      for (const value of [complete.APNS_TEAM_ID, complete.APNS_KEY_ID, 'PRIVATE_ABSENT_PATH', 'PRIVATE_TOPIC', 'PRIVATE_ENV']) {
        expect(output.join('\n')).not.toContain(value);
      }
      expect(output.join('\n')).not.toContain(directory);
      expect(output.join('\n')).not.toContain('BEGIN PRIVATE KEY');
    } finally { log.mockRestore(); error.mockRestore(); }
  });
});

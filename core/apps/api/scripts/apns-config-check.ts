import { readFileSync, statSync } from 'node:fs';
import { createPrivateKey, createPublicKey, sign, verify } from 'node:crypto';
import { parseArgs, parseEnv } from 'node:util';
import { pathToFileURL } from 'node:url';
import { APNS_APP_IDS, APNS_CONFIG_KEYS, readApnsConfig, type ApnsConfigEnv } from '../src/utils/apns_config.js';

// Read only the APNs fields, never source/evaluate a shell file or mutate process.env.
// Explicitly supports the existing API .env as well as the APNs-only template.
export function loadApnsEnv(file: string | undefined, env: ApnsConfigEnv): ApnsConfigEnv {
  let parsed: Record<string, string> = {};
  if (file) {
    try { parsed = parseEnv(readFileSync(file, 'utf8')); }
    catch { throw new Error('Cannot read APNs configuration file'); }
  }
  const allowed = new Set<string>(APNS_CONFIG_KEYS);
  if ([...Object.keys(parsed), ...Object.keys(env)].some(key => key.startsWith('APNS_') && !allowed.has(key))) {
    throw new Error('Unsupported APNS_ variable; check the APNs template');
  }
  return Object.fromEntries(APNS_CONFIG_KEYS.map(key => [key, env[key] ?? parsed[key]]));
}

export function checkApnsConfig(env: ApnsConfigEnv, options: { topic: string; environment: string; requireEnabled?: boolean }) {
  const errors: string[] = [];
  const rows: { name: string; status: string }[] = [];
  for (const key of ['RECORD_PUSH_ENABLED', 'APNS_ENABLED'] as const) {
    const value = env[key];
    rows.push({ name: key, status: value === '1' ? 'enabled' : value === '0' ? 'disabled' : value === undefined || value === '' ? 'missing' : 'invalid' });
    if (value !== undefined && !['0', '1'].includes(value)) errors.push(`${key}: expected 0 or 1`);
    if (options.requireEnabled && value !== '1') errors.push(`${key}: must be 1 for --require-enabled`);
  }
  const credentialKeys = ['APNS_TEAM_ID', 'APNS_KEY_ID', 'APNS_PRIVATE_KEY_PATH'] as const;
  const present = credentialKeys.filter(key => Boolean(env[key]?.trim()));
  const enabled = env.RECORD_PUSH_ENABLED === '1' && env.APNS_ENABLED === '1';
  for (const key of credentialKeys) {
    const value = env[key]?.trim();
    rows.push({ name: key, status: value ? 'present' : 'missing' });
    if (!value && (present.length > 0 || enabled || env.APNS_ENABLED === '1' || options.requireEnabled)) errors.push(`${key}: missing`);
    if (value && /[\u0000-\u001f\u007f]/.test(value)) errors.push(`${key}: invalid control characters`);
  }
  const validTopic = APNS_APP_IDS.some(id => id === options.topic);
  if (!validTopic) errors.push('Unsupported APNs topic');
  const validEnvironment = ['sandbox', 'production'].includes(options.environment);
  if (!validEnvironment) errors.push('Expected APNs environment sandbox or production');
  let privateKeyStatus = 'not-checked';
  let permissionStatus = process.platform === 'win32' ? 'not-checked-windows-acl' : 'not-checked';
  const keyPath = env.APNS_PRIVATE_KEY_PATH?.trim();
  if (keyPath) {
    try {
      const metadata = statSync(keyPath);
      if (!metadata.isFile() || metadata.size === 0 || metadata.size > 16_384) throw new Error();
      if (process.platform !== 'win32') {
        permissionStatus = (metadata.mode & 0o077) === 0 ? 'owner-only' : 'too-broad';
        if (permissionStatus === 'too-broad') errors.push('APNS_PRIVATE_KEY_PATH: restrict file permissions to its owner (0600)');
      }
      const key = createPrivateKey({ key: readFileSync(keyPath), format: 'pem' });
      if (key.asymmetricKeyType !== 'ec' || key.asymmetricKeyDetails?.namedCurve !== 'prime256v1') {
        privateKeyStatus = 'invalid';
        errors.push('APNS_PRIVATE_KEY_PATH: expected an unencrypted EC P-256 private key');
      } else {
        const probe = Buffer.from('CubeRoot APNs offline key check');
        if (!verify('sha256', probe, createPublicKey(key), sign('sha256', probe, key))) throw new Error();
        privateKeyStatus = 'EC-P256-sign-verify-passed';
      }
    } catch {
      privateKeyStatus = 'invalid';
      errors.push('APNS_PRIVATE_KEY_PATH: unreadable, oversized or invalid unencrypted private key');
    }
  }
  return {
    rows, errors, privateKeyStatus,
    topic: validTopic ? options.topic : 'invalid',
    environment: validEnvironment ? options.environment : 'invalid',
    configured: readApnsConfig(options.topic, env) !== null,
    enabled, permissionStatus,
  };
}

export function reportApnsConfig(report: ReturnType<typeof checkApnsConfig>): boolean {
  console.log(`APNs offline check: topic=${report.topic}; expected environment=${report.environment}`);
  for (const row of report.rows) console.log(`${row.name}: ${row.status}`);
  console.log(`Private key: ${report.privateKeyStatus}`);
  console.log(`Runtime configuration gate: ${report.configured ? 'configured' : 'disabled-or-incomplete'}`);
  console.log(`Private key file permissions: ${report.permissionStatus}`);
  console.log('Apple key authorization, signed-app entitlements and device delivery: unverified. No network request sent.');
  for (const error of report.errors) console.error(error);
  return report.errors.length === 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    let args: ReturnType<typeof parseArgs>;
    try {
      args = parseArgs({ options: {
        'push-env-file': { type: 'string' }, topic: { type: 'string', default: 'me.cuberoot.app' },
        environment: { type: 'string', default: 'sandbox' }, 'require-enabled': { type: 'boolean' },
      } });
    } catch { throw new Error('Usage: apns:check [--push-env-file path] [--environment sandbox|production] [--topic bundle-id] [--require-enabled]'); }
    process.exitCode = reportApnsConfig(checkApnsConfig(loadApnsEnv(args.values['push-env-file'] as string | undefined, process.env), {
      topic: args.values.topic as string, environment: args.values.environment as string,
      requireEnabled: args.values['require-enabled'] === true,
    })) ? 0 : 1;
  } catch {
    // No raw parser, filesystem or OpenSSL error may expose file content/paths/keys.
    console.error('APNs configuration could not be loaded. Check CLI options, file readability and supported APNS_ variable names.');
    process.exitCode = 1;
  }
}

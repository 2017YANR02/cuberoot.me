import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { pathToFileURL } from 'node:url';

export const pushVendors: { name: string; keys: string[] }[] = JSON.parse(
  readFileSync(new URL('../android/push-vendors.json', import.meta.url), 'utf8'),
);
type Env = Record<string, string | undefined>;
export type PushVariant = 'debug' | 'release';
const suffixes = ['APP_ID', ...pushVendors.flatMap(vendor => vendor.keys)];
const allowedKeys = new Set(['ANDROID_PUSH_REQUIRED', 'ANDROID_PUSH_VENDORS',
  ...['GETUI_', 'GETUI_DEBUG_'].flatMap(prefix => suffixes.map(key => prefix + key))]);

// Explicit local file only. Never load the API's .env or print parser errors/values.
export function loadPushEnv(file: string | undefined, env: Env): Env {
  if (!file) return { ...env };
  let parsed: Record<string, string>;
  try { parsed = parseEnv(readFileSync(file, 'utf8')); }
  catch { throw new Error('Cannot read Android push env file'); }
  if (Object.keys(parsed).some(key => !allowedKeys.has(key))) {
    throw new Error('Android push env file contains unsupported keys; use only the mobile template');
  }
  return { ...parsed, ...Object.fromEntries(Object.entries(env).filter(([, value]) => value !== undefined)) };
}

export function checkPushConfig(env: Env, variant: PushVariant) {
  const prefix = variant === 'debug' ? 'GETUI_DEBUG_' : 'GETUI_';
  const errors: string[] = [];
  const required = env.ANDROID_PUSH_REQUIRED ?? 'false';
  if (!['true', 'false'].includes(required)) errors.push('ANDROID_PUSH_REQUIRED must be true or false');
  const vendors = (env.ANDROID_PUSH_VENDORS ?? '').split(',').map(value => value.trim()).filter(Boolean);
  if (vendors.some(name => !pushVendors.some(vendor => vendor.name === name))) {
    errors.push('ANDROID_PUSH_VENDORS contains an unsupported vendor');
  }
  const rows = [{ name: 'getui', keys: ['APP_ID'] }, ...pushVendors].map(group => {
    const keys = group.keys.map(key => prefix + key);
    const present = keys.filter(key => Boolean(env[key]));
    const missing = keys.filter(key => !env[key]);
    for (const key of present) {
      // Reject accidental whitespace/control characters without guessing provider key formats.
      if (/[\s\u0000-\u001f\u007f]/.test(env[key]!)) errors.push(`${key}: invalid credential format`);
    }
    const mustExist = group.name === 'getui' ? required === 'true' || vendors.length > 0 : vendors.includes(group.name);
    if ((mustExist || present.length > 0) && missing.length > 0) errors.push(`Missing: ${missing.join(', ')}`);
    if (group.name !== 'getui' && present.length > 0 && !env[prefix + 'APP_ID']) {
      errors.push(`Missing: ${prefix}APP_ID (required by ${group.name})`);
    }
    return { name: group.name, status: missing.length === 0 ? 'configured' : present.length ? 'incomplete' : 'disabled', missing };
  });
  return { variant, packageName: variant === 'debug' ? 'me.cuberoot.app.debug' : 'me.cuberoot.app', rows, errors: [...new Set(errors)] };
}

export function reportPushConfig(env: Env, variant: PushVariant): boolean {
  const report = checkPushConfig(env, variant);
  console.log(`Android push ${report.variant} (${report.packageName}) — configuration only, delivery unverified`);
  for (const row of report.rows) console.log(`${row.name}: ${row.status}${row.missing.length ? `; missing ${row.missing.join(', ')}` : ''}`);
  for (const error of report.errors) console.error(error);
  return report.errors.length === 0;
}

export function pushEnvFileArg(args: string[]): string | undefined {
  const index = args.indexOf('--push-env-file');
  if (index === -1) return undefined;
  if (!args[index + 1] || args[index + 1].startsWith('--')) throw new Error('--push-env-file requires a path');
  return args[index + 1];
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const args = process.argv.slice(2);
    const variant = args[0];
    if (variant !== 'debug' && variant !== 'release') throw new Error('Expected debug or release');
    const file = pushEnvFileArg(args);
    const expected = file ? [variant, '--push-env-file', file] : [variant];
    if (JSON.stringify(args) !== JSON.stringify(expected)) throw new Error('Usage: android:push:check debug|release [--push-env-file path]');
    process.exitCode = reportPushConfig(loadPushEnv(file, process.env), variant) ? 0 : 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Android push configuration check failed');
    process.exitCode = 1;
  }
}

import { readFileSync } from 'node:fs';

const app = JSON.parse(readFileSync(new URL('../AppScope/app.json5', import.meta.url), 'utf8')).app;
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const backup = JSON.parse(readFileSync(
  new URL('../entry/src/main/resources/base/profile/backup_config.json', import.meta.url),
  'utf8',
));
const secureStore = readFileSync(
  new URL('../entry/src/main/ets/bridge/SecureAuthStore.ets', import.meta.url),
  'utf8',
);
const rawfileResponder = readFileSync(
  new URL('../entry/src/main/ets/web/RawfileResponder.ets', import.meta.url),
  'utf8',
);
const [major, minor, patch] = pkg.version.split('.').map(Number);

if (app.versionName !== pkg.version || app.versionCode !== major * 1_000_000 + minor * 1_000 + patch) {
  throw new Error('Harmony native version must match package.json');
}
if (app.vendor !== 'CubeRoot') throw new Error('Harmony vendor must be CubeRoot');
if (backup.allowToBackupRestore !== false) throw new Error('Harmony app backup must remain disabled');
if (!secureStore.includes('asset.Accessibility.DEVICE_UNLOCKED')
  || secureStore.includes('asset.Accessibility.DEVICE_FIRST_UNLOCKED')) {
  throw new Error('Harmony secrets must be available only while the device is unlocked');
}
if (!rawfileResponder.includes("const CUBING_WORKER_PREFIX = 'https://localhost/cubing-chunks/'")
  || !rawfileResponder.includes('path = `cubing-chunks/${url.substring(CUBING_WORKER_PREFIX.length)}`')) {
  throw new Error('Harmony must map the shared cubing worker root URL into app rawfiles');
}

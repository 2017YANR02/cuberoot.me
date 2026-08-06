import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const CLIENT_ROOT = resolve(SCRIPT_DIR, '..');
const SNAPSHOT_PATH = resolve(CLIENT_ROOT, 'tests/fixtures/recon-ground-truth.json');
const DEFAULT_EXPORT_URL = 'https://api.cuberoot.me/v1/recon-ground-truth/export';

function fail(message) {
  throw new Error(message);
}

export function validateSnapshot(value) {
  if (!value || typeof value !== 'object' || value.version !== 1 || !Array.isArray(value.fixtures)) {
    fail('recon-ground-truth export 格式错误');
  }
  if (Array.isArray(value.blockedConfirmed) && value.blockedConfirmed.length > 0) {
    const summary = value.blockedConfirmed.map((item) => `${item.id}:${item.reasons?.join(',')}`).join(' ');
    fail(`存在需要管理员重新确认的 confirmed 复盘：${summary}`);
  }
  if (value.fixtures.length === 0) fail('recon-ground-truth export 没有 confirmed fixture');
  const ids = new Set();
  for (const [index, fixture] of value.fixtures.entries()) {
    const at = `fixture ${index + 1}`;
    if (!fixture || typeof fixture !== 'object') fail(`${at} 不是对象`);
    for (const key of ['id', 'source', 'replay', 'truth', 'currentWrong', 'note']) {
      if (typeof fixture[key] !== 'string') fail(`${at}.${key} 必须是字符串`);
    }
    if (!/^\d+$/.test(fixture.id)) fail(`${at}.id 必须是数字字符串`);
    if (ids.has(fixture.id)) fail(`复盘 ID ${fixture.id} 重复`);
    if (!fixture.source.includes(`/recon/${fixture.id}`)) fail(`${at}.source 与 id 不一致`);
    if (!fixture.replay) fail(`${at}.replay 不能为空`);
    if (!fixture.truth.includes('\n')) fail(`${at}.truth 必须含打乱和解法`);
    ids.add(fixture.id);
  }
  const sorted = [...value.fixtures].sort((a, b) => Number(a.id) - Number(b.id));
  return { version: 1, fixtures: sorted };
}

function serialize(value) {
  return `${JSON.stringify(validateSnapshot(value), null, 2)}\n`;
}

async function fetchExport() {
  const url = process.env.RECON_GROUND_TRUTH_EXPORT_URL || DEFAULT_EXPORT_URL;
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) fail(`ground-truth export 请求失败：${response.status} ${url}`);
  return response.json();
}

async function main() {
  const mode = process.argv[2] ?? 'sync';
  const currentText = existsSync(SNAPSHOT_PATH) ? readFileSync(SNAPSHOT_PATH, 'utf8') : '';

  if (mode === 'check') {
    if (!currentText) fail(`缺少 ${SNAPSHOT_PATH}`);
    const canonical = serialize(JSON.parse(currentText));
    if (currentText !== canonical) fail('recon-ground-truth.json 不是确定性格式或排序不正确');
    process.stdout.write(`Ground-truth snapshot valid: ${JSON.parse(canonical).fixtures.length} fixtures\n`);
    return;
  }
  if (mode !== 'sync') fail(`未知模式：${mode}`);

  const nextText = serialize(await fetchExport());
  if (currentText !== nextText) writeFileSync(SNAPSHOT_PATH, nextText, 'utf8');
  process.stdout.write(`Ground-truth manager synced: ${JSON.parse(nextText).fixtures.length} fixtures\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});

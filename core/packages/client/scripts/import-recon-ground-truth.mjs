import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const CLIENT_ROOT = resolve(SCRIPT_DIR, '..');
const SNAPSHOT_PATH = resolve(CLIENT_ROOT, 'tests/fixtures/recon-ground-truth.json');
const BASE = process.env.RECON_GROUND_TRUTH_API_URL || 'https://api.cuberoot.me/v1/recon-ground-truth';
const key = process.env.ADMIN_API_KEY;

if (!key) throw new Error('缺少 ADMIN_API_KEY；不会发送导入请求');
const snapshot = JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8'));
if (snapshot.version !== 1 || !Array.isArray(snapshot.fixtures) || snapshot.fixtures.length === 0) {
  throw new Error('recon-ground-truth.json 格式错误或为空');
}

for (const fixture of snapshot.fixtures) {
  const response = await fetch(`${BASE}/${fixture.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-Admin-Key': key },
    body: JSON.stringify({
      status: 'confirmed',
      replay: fixture.replay,
      currentWrong: fixture.currentWrong,
      note: fixture.note,
      acknowledgeWarnings: true,
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`#${fixture.id} 导入失败：${body.error || response.status}`);
  if (body.assessment?.truth !== fixture.truth) {
    throw new Error(`#${fixture.id} 的管理器规范化文本与跟踪快照不一致，停止导入`);
  }
  process.stdout.write(`Imported #${fixture.id}\n`);
}

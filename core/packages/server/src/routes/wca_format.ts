/**
 * /v1/wca/format-record — Bark 推送文案格式化(供前端 comp 弹窗复制按钮用)。
 *
 * 协议: POST body `{events: [<kwargs>, ...]}` → `{cn, en, url}`。
 *       events 长度 1 = 单条,长度 2 = 同 round 合并(WCA Live single+average 双纪录)。
 *
 * 实现: spawn 跨 repo 的 Python `/opt/wca-monitor/format_cli.py` — record_format.py 模板
 *       是 Python 单一来源,这里只是壳。spawn 一次 ~50-150ms,够偶发的复制按钮用。
 *       Python 文件路径用 env `WCA_MONITOR_DIR` 可覆盖(默认 `/opt/wca-monitor`)。
 */
import { Hono } from 'hono';
import { spawn } from 'node:child_process';

export const wcaFormatRoutes = new Hono();

const WCA_MONITOR_DIR = process.env.WCA_MONITOR_DIR || '/opt/wca-monitor';
const PYTHON_BIN = process.env.PYTHON_BIN || 'python3';
const SPAWN_TIMEOUT_MS = 5000;

export function runFormatCli(payload: unknown): Promise<{ cn: string; en: string; url: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(PYTHON_BIN, [`${WCA_MONITOR_DIR}/format_cli.py`], {
      cwd: WCA_MONITOR_DIR,
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    });
    const chunks: Buffer[] = [];
    const errChunks: Buffer[] = [];
    let timedOut = false;

    const killer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, SPAWN_TIMEOUT_MS);

    child.stdout.on('data', (b: Buffer | string) => chunks.push(Buffer.isBuffer(b) ? b : Buffer.from(b)));
    child.stderr.on('data', (b: Buffer | string) => errChunks.push(Buffer.isBuffer(b) ? b : Buffer.from(b)));
    child.on('error', err => {
      clearTimeout(killer);
      reject(err);
    });
    child.on('close', code => {
      clearTimeout(killer);
      if (timedOut) return reject(new Error(`format_cli timeout (${SPAWN_TIMEOUT_MS}ms)`));
      const stdout = Buffer.concat(chunks).toString('utf-8');
      const stderr = Buffer.concat(errChunks).toString('utf-8');
      if (code !== 0 && !stdout.trim()) {
        return reject(new Error(`format_cli exit ${code}: ${stderr || '(no output)'}`));
      }
      try {
        const parsed = JSON.parse(stdout);
        if (parsed.error) return reject(new Error(parsed.error));
        resolve(parsed);
      } catch (e) {
        reject(new Error(`format_cli bad JSON: ${stdout.slice(0, 200)}`));
      }
    });

    child.stdin.write(JSON.stringify(payload));
    child.stdin.end();
  });
}

wcaFormatRoutes.post('/wca/format-record', async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body || !Array.isArray(body.events) || body.events.length === 0) {
    return c.json({ error: 'events array required' }, 400);
  }
  if (body.events.length > 2) {
    return c.json({ error: 'events max length 2' }, 400);
  }

  try {
    const result = await runFormatCli(body);
    return c.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[wca/format-record] failed:', msg);
    return c.json({ error: `format_cli unavailable: ${msg}` }, 503);
  }
});

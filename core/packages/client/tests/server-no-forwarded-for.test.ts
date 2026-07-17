// 请求 IP 来源守卫:server 源码禁止读取可伪造的 X-Forwarded-For 头作 IP 来源。
// 规则:core/packages/server/src/** 里任何真实读取 x-forwarded-for 的行(引号 / [ 紧邻头名),
// 都算违规,除非同行带 allow-forwarded-for 豁免注释。
//
// 为什么:XFF 由客户端自填,谁都能伪造 → IP / visitor_id / 国家 spoofing、绕过限流、污染统计。
// 全站请求 IP 统一走 getIp(c)(utils/analytics_helpers.ts 单一源),只读 nginx 写入的可信 x-real-ip
//(权威 getClientIp 刻意不留 XFF 回退)。原来 21 个 route 各自抄了带 XFF 回退的本地 getIp,已收敛成这一份
//(commit 6f58d59e);这条测试防止哪个新 route 又把 XFF 回退抄回来。
//
// CI 跑 vitest(server 包无测试集),故跨包扫源码当红灯。写入态配套 hook:.claude/hooks/block-server-forwarded-for.ps1。
// guard-registry: tracked at /code/guards (app/[lang]/code/guards/_guards.ts)
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const SRC_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'server', 'src');
// 真实头读取:头名紧跟在引号 / [ 之后;散文注释里的 "NO X-Forwarded-For"(前面是空格)不算。
const XFF_READ = /["'`\[]x-forwarded-for/i;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === 'node_modules') continue;
    const p = join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walk(p));
    else if (ent.name.endsWith('.ts') && !ent.name.endsWith('.test.ts')) out.push(p);
  }
  return out;
}

describe('server request-IP source — no forgeable X-Forwarded-For reads', () => {
  const files = walk(SRC_DIR);

  it('scans a meaningful number of server source files', () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it('no route/source reads x-forwarded-for as an IP source', () => {
    const violations: string[] = [];
    for (const f of files) {
      const rel = f.replace(/\\/g, '/').split('/server/src/')[1] ?? f;
      readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
        if (XFF_READ.test(line) && !/allow-forwarded-for/.test(line)) {
          violations.push(`${rel}:${i + 1}  ${line.trim()}`);
        }
      });
    }
    expect(
      violations,
      `X-Forwarded-For 可被客户端伪造,禁作请求 IP 来源(会导致 IP / visitor_id / 国家 spoofing、绕限流、污染统计)。` +
        `请用 getIp(c)(utils/analytics_helpers.ts,只读可信 x-real-ip);确有正当用途在该行加 allow-forwarded-for。\n` +
        violations.join('\n'),
    ).toEqual([]);
  });
});

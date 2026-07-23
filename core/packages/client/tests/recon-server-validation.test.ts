// 守卫:recon「记号区只许 ASCII」校验的装饰字符例外,前端(lib/recon-alg-utils.ts 的
// COSMETIC_ANNOTATION_CHARS)与后端(server/src/utils/recon_helpers.ts 的 COSMETIC_ANNOTATION_RE)
// 必须放行同一组字符。2026-06 踩过:前端 task#7 放行了 ↑↓·,后端没同步 → 带 regrip 箭头的解法
// 过得了前端却被后端拒("Validation failed")。两端任一改动都要让对方同步,否则这里红灯。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  validateRow, visibilityDiscoverFilter, visibilityOwnerFilter, ADMIN_WCA_IDS,
} from '../../server/src/utils/recon_helpers';

const here = dirname(fileURLToPath(import.meta.url));
const CLIENT = join(here, '..', 'lib', 'recon-alg-utils.ts');
const SERVER = join(here, '..', '..', 'server', 'src', 'utils', 'recon_helpers.ts');

function chars(s: string): Set<string> {
  return new Set([...s]);
}

describe('recon cosmetic-char validation parity (client ↔ server)', () => {
  const clientSrc = readFileSync(CLIENT, 'utf8');
  const serverSrc = readFileSync(SERVER, 'utf8');

  // 前端:const COSMETIC_ANNOTATION_CHARS = '<chars>';
  const clientMatch = clientSrc.match(/COSMETIC_ANNOTATION_CHARS\s*=\s*'([^']*)'/);
  // 后端:const COSMETIC_ANNOTATION_RE = /[<chars>]/g;
  const serverMatch = serverSrc.match(/COSMETIC_ANNOTATION_RE\s*=\s*\/\[([^\]]*)\]\/g/);

  it('both definitions are present and parseable', () => {
    expect(clientMatch, 'client COSMETIC_ANNOTATION_CHARS not found').not.toBeNull();
    expect(serverMatch, 'server COSMETIC_ANNOTATION_RE not found').not.toBeNull();
  });

  it('client and server allow exactly the same cosmetic chars', () => {
    const c = chars(clientMatch![1]);
    const s = chars(serverMatch![1]);
    expect([...s].sort()).toEqual([...c].sort());
  });

  it('regrip arrows + middle dot are allowed on both sides', () => {
    for (const ch of ['↑', '↓', '·']) {
      expect(clientMatch![1].includes(ch), `client missing ${ch}`).toBe(true);
      expect(serverMatch![1].includes(ch), `server missing ${ch}`).toBe(true);
    }
  });
});

// 功能验证:后端 validateRow 真的放行带 regrip 箭头(↑)的解法(2026-06 "Validation failed" 的根因),
// 但真正的中文等非装饰非 ASCII 仍被拒。对应真实样例 HuanggangOpen2026 / 2024LIZH03。
describe('server validateRow accepts cosmetic chars outside comments', () => {
  const SOLUTION = [
    "y' // insp",
    "↑D B U R2' U' R L F' L' DU' // Y xcross (RG)",
    "L U2 L' U' L...U L' // BR",
    "(U U') r...U R' U' r' F R F' U // ZBLL-T17 (0.530+0.710)",
  ].join('\n');

  it('solution with regrip arrows (↑) passes', () => {
    const errs = validateRow({ solution: SOLUTION });
    expect(errs.filter(e => e.includes('non-ASCII'))).toEqual([]);
  });

  it('real non-ASCII text (中文) is still rejected', () => {
    const errs = validateRow({ solution: "R U 中文 // ok" });
    expect(errs.some(e => e.includes('non-ASCII'))).toBe(true);
  });
});

// 可见性(migrations/0085):public / unlisted / private 三值枚举;缺省(不带该字段)由 DB
// 默认 'public' 兜底,校验放行;非法值必须被拒,防绕过前端写入坏数据。
describe('server validateRow enforces visibility enum', () => {
  it('accepts the three valid values', () => {
    for (const v of ['public', 'unlisted', 'private']) {
      expect(validateRow({ visibility: v }).filter(e => e.includes('visibility'))).toEqual([]);
    }
  });

  it('accepts rows that omit visibility (DB default fills in)', () => {
    expect(validateRow({ event: '3x3' }).filter(e => e.includes('visibility'))).toEqual([]);
  });

  it('rejects an unknown visibility value', () => {
    expect(validateRow({ visibility: 'secret' }).some(e => e.includes('visibility'))).toBe(true);
  });
});

// 可见性读过滤(server routes/recon.ts 各读端点的鉴权核心):
//   · 发现面(社区总表 / 比赛页):管理员看全部,其余人(含内容所有者)只看 public;
//   · 定向面(个人页 / 按选手查):管理员看全部,所有者额外看自己添加的非公开,匿名只 public。
// 锁住 SQL 子句 + 参数,防回归把非公开泄露进公共发现流。
describe('visibility read filters (admin bypass / owner / anon)', () => {
  const adminId = ADMIN_WCA_IDS[0];
  const admin = adminId ? { wcaId: adminId, name: 'Admin' } : null;
  const user = { wcaId: '2015ZZZZ01', name: 'User' };

  it('discover: anon → public only', () => {
    expect(visibilityDiscoverFilter(null)).toEqual({ clause: "visibility = 'public'", params: [] });
  });
  it('discover: normal user → public only (own non-public never enters discovery)', () => {
    expect(visibilityDiscoverFilter(user)).toEqual({ clause: "visibility = 'public'", params: [] });
  });
  it('discover: admin → all rows', () => {
    if (!admin) return; // 无配置管理员时跳过(理论上 allowlist 至少一人)
    expect(visibilityDiscoverFilter(admin)).toEqual({ clause: '1=1', params: [] });
  });

  it('owner: anon → public only', () => {
    expect(visibilityOwnerFilter(null)).toEqual({ clause: "visibility = 'public'", params: [] });
  });
  it('owner: user → public OR own', () => {
    expect(visibilityOwnerFilter(user)).toEqual({
      clause: "(visibility = 'public' OR added_by_id = ?)", params: [user.wcaId],
    });
  });
  it('owner: admin → all rows', () => {
    if (!admin) return;
    expect(visibilityOwnerFilter(admin)).toEqual({ clause: '1=1', params: [] });
  });
  it('owner: honors table-prefixed columns for JOIN queries', () => {
    expect(visibilityOwnerFilter(user, 'recons.visibility', 'recons.added_by_id')).toEqual({
      clause: "(recons.visibility = 'public' OR recons.added_by_id = ?)", params: [user.wcaId],
    });
  });
});

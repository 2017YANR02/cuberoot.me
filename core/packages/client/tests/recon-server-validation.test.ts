// 守卫:recon「记号区只许 ASCII」校验的装饰字符例外,前端(lib/recon-alg-utils.ts 的
// COSMETIC_ANNOTATION_CHARS)与后端(server/src/utils/recon_helpers.ts 的 COSMETIC_ANNOTATION_RE)
// 必须放行同一组字符。2026-06 踩过:前端 task#7 放行了 ↑↓·,后端没同步 → 带 regrip 箭头的解法
// 过得了前端却被后端拒("Validation failed")。两端任一改动都要让对方同步,否则这里红灯。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { validateRow } from '../../server/src/utils/recon_helpers';

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

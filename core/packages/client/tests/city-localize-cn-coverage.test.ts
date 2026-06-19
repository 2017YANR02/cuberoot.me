// CI 守卫:保证每个 upcoming 比赛城市在中文界面下都有中文译名,不回退成拉丁原文
// (如「Eagan, Minnesota」「Sollentuna」)。覆盖全部国家(大中华区走 CN_PLACE_ZH,
// 其余走生成的全球字典 lib/data/place-zh.ts)。
//
// 触发场景:WCA 新办了一场比赛,落在某个生成字典还没收录的城市(以前没办过比赛)。
// upcoming 管道刷新 all_upcoming_comps.json 后这条测试就红 —— 重跑 scripts/gen-place-zh.mjs
// + scripts/merge-place-zh.mjs(新城市进 LLM 兜底 scripts/place-tail-zh.json)即可。
//
// 判定:中文化后整串含 CJK 即视为已覆盖(逐段译,城市段译出即够;纯数字邮编段例外)。
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { localizeCity } from '@/lib/city-localize';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..'); // packages/client
const DATA = join(ROOT, '..', '..', '..', 'stats', 'all_upcoming_comps.json'); // 仓库根 stats/

const hasCjk = (s: string) => /[㐀-鿿]/.test(s);
// 纯数字 / 符号城市段(WCA 个别数据把邮编填进城市)无中文可译,豁免。
const isUntranslatable = (s: string) => !/[A-Za-z㐀-鿿]/.test(s);

interface RawComp { id: string; city?: string; country?: string }

describe('city-localize coverage (all countries)', () => {
  it('每个 upcoming 比赛城市在中文下都有中文译名', () => {
    if (!existsSync(DATA)) {
      console.warn(`[city-localize] 跳过:${DATA} 不存在`);
      return;
    }
    const comps = JSON.parse(readFileSync(DATA, 'utf8')) as RawComp[];

    const missing = new Map<string, { raw: string; country: string; id: string }>();
    for (const c of comps) {
      if (!c.city || !c.country) continue;
      if (isUntranslatable(c.city)) continue;
      const zh = localizeCity(c.city, true, c.country);
      if (!hasCjk(zh)) {
        const key = `${c.country}|${c.city}`;
        if (!missing.has(key)) missing.set(key, { raw: c.city, country: c.country, id: c.id });
      }
    }

    const hint = [...missing.values()]
      .map((v) => `  [${v.country}] "${v.raw}"  e.g. ${v.id}`)
      .join('\n');
    expect(
      missing.size,
      missing.size === 0
        ? ''
        : `以下 upcoming 比赛城市缺中文译名。重跑 scripts/gen-place-zh.mjs + merge-place-zh.mjs`
          + `(必要时往 scripts/place-tail-zh.json 补译):\n${hint}`,
    ).toBe(0);
  });
});

// 魔方术语错译黑名单(termbase 守卫):AI 写双语文案时按通用语感直译魔方黑话,
// 产出"语法对但术语错"的中文 —— typecheck / lint 全测不出。
//
// 权威译法单一源 = app/[lang]/wiki/glossary.json(713 条社区标准中英对照,/wiki 种子)。
// 写文案规范(先查 termbase + 高频陷阱表)见 skill i18n「魔方术语」节。
//
// 本测试只锁**已确认修过的错译**(高精度黑名单,不做模糊判定):
//   - 每条 = zh 错译 pattern → 正确译法。发现并修掉新错译后,把它加进 RULES 防回归。
//   - 《…》书名号内为外部作品原标题(如 b23 视频名),原文照录不算错译,匹配前剥除。
//   - 个别行确需豁免:行内注释 `allow-cubing-term: <理由>`。
// guard-registry: tracked at /code/guards (app/[lang]/code/guards/_guards.ts)
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..'); // packages/client
const SRC_DIRS = ['app', 'components', 'lib', 'hooks'];

interface Rule {
  /** en 术语(报错信息用) */
  term: string;
  /** zh 错译 pattern(按行匹配,《…》已剥除) */
  ban: RegExp;
  /** 社区标准译法 */
  fix: string;
}

const RULES: Rule[] = [
  // trangium MCC:同一手指连续使用要等它回位 —— 社区叫「复用」,不是劳累义的直译
  { term: 'overwork', ban: /过劳/, fix: '复用' },
  // glossary: Finger Trick 指法
  { term: 'finger trick', ban: /手指技巧/, fix: '指法' },
  // glossary: Comm (Commutator) 换位子(math/group 群论章节同款)
  { term: 'commutator', ban: /交换子/, fix: '换位子' },
  // glossary: Corner Cutting 容错(硬件容错角度,不是几何切角)
  { term: 'corner cutting', ban: /(?:corner.{0,3}cutting.{0,30}切角|切角.{0,30}corner.{0,3}cutting)/i, fix: '容错' },
  // 用户定名:Roux = 桥式,FB = 左桥,SB = 右桥(禁直译"第一/二块")
  { term: 'Roux FB/SB', ban: /Roux[^,。;:]{0,6}第[一二]块/, fix: '左桥 / 右桥' },
  // 用户定名:extra scrambles 在 UI 文案统一简称「备打」。只查文案行
  // (t( / tr( / zh: / label),注释与官方规则条文(json 数据)不受限。
  { term: 'extra scrambles', ban: /(?:\bt\(|\btr\(|zh\s*[:=]|[aA]riaLabel|label)[^\n]*备用打乱/, fix: '备打' },
];

function sourceFiles(): string[] {
  const out: string[] = [];
  for (const d of SRC_DIRS) {
    for (const e of readdirSync(join(ROOT, d), { recursive: true, withFileTypes: true })) {
      if (!e.isFile() || !/\.tsx?$/.test(e.name) || /\.test\./.test(e.name)) continue;
      out.push(join(e.parentPath, e.name));
    }
  }
  return out;
}

describe('魔方术语错译黑名单(termbase = wiki/glossary.json)', () => {
  it('已修正的错译不再出现', () => {
    const violations: string[] = [];
    for (const p of sourceFiles()) {
      const text = readFileSync(p, 'utf8');
      // 快筛:全文无任何 CJK 直接跳过
      if (!/[㐀-鿿]/.test(text)) continue;
      const lines = text.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('allow-cubing-term:')) continue;
        const line = lines[i].replace(/《[^》]*》/g, '《》'); // 外部作品原标题豁免
        for (const r of RULES) {
          if (r.ban.test(line)) {
            violations.push(`${p}:${i + 1} [${r.term}] 应作「${r.fix}」: ${lines[i].trim().slice(0, 120)}`);
          }
        }
      }
    }
    expect(
      violations,
      `发现魔方术语错译(权威译法查 app/[lang]/wiki/glossary.json,规范见 skill i18n):\n${violations.join('\n')}`,
    ).toEqual([]);
  });
});

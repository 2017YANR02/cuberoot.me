import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CUBE3_STATES, GOD_DIST_333, GOD_DIST_333_NORMALIZED, GOD_EXACT_THROUGH,
  GOD_EXACT_TOTAL, GOD_MEAN_HTM, GOD_SHARE_16_19_PCT, GOD_SHARE_17_19_PCT,
  GOD_TAIL_TOTAL, godShare,
} from '@/lib/god-distance-333';

/**
 * 三阶 HTM 距离分布的单一源。
 *
 * 立这个源之前站上有四份手抄表,d=16..19 四处打架(2.49e19 / 2.929e19 / 12.217e18 …),
 * 其中一份的伪精度 `1_100_531_606_815_050_000` cube20.org 从没公布过。这里锁两件事:
 *   1. 数值本身(精确档逐位 + 尾部真值),改了要有人主动改 baseline;
 *   2. **归一化档 Σ 恰为 |G|** —— 这是四份手抄表全都做不到的那条硬约束。
 * 外加一条棱柱:除了单一源文件,谁都不许再写 d≥16 那个量级的字面量。
 */

describe('三阶 HTM 距离分布(单一源)', () => {
  it('精确档 0..15 逐位锁死', () => {
    const exact = GOD_DIST_333.filter((b) => b.kind === 'exact').map((b) => b.count);
    expect(exact).toEqual([
      '1', '18', '243', '3240', '43239', '574908', '7618438', '100803036',
      '1332343288', '17596479795', '232248063316', '3063288809012',
      '40374425656248', '531653418284628', '6989320578825358', '91365146187124313',
    ]);
    expect(exact.length).toBe(GOD_EXACT_THROUGH + 1);
    expect(GOD_EXACT_TOTAL).toBe('98929809184629081');
  });

  it('尾部真值 = |G| − Σ(d ≤ 15),这是对 d ≥ 16 唯一能说的精确话', () => {
    expect(GOD_TAIL_TOTAL).toBe('43153073465305226919');
    expect(BigInt(GOD_EXACT_TOTAL) + BigInt(GOD_TAIL_TOTAL)).toBe(BigInt(CUBE3_STATES));
  });

  it('cube20.org 的四个估计值加起来比真实尾部大 1.03% —— 是四舍五入,不是数据错', () => {
    const approx = GOD_DIST_333.filter((b) => b.kind === 'approx');
    expect(approx.map((b) => b.d)).toEqual([16, 17, 18, 19]);
    const sum = approx.reduce((a, b) => a + BigInt(b.count), 0n);
    // 只留两位有效数字的必然结果;超过 2% 就说明有人抄错了某一档
    const overshoot = Number((sum * 10000n) / BigInt(GOD_TAIL_TOTAL)) / 10000;
    expect(overshoot.toFixed(4)).toBe('1.0103');
  });

  it('归一化档 Σ 恰等于 |G|,且只动了 approx 那四档', () => {
    const sum = GOD_DIST_333_NORMALIZED.reduce((a, c) => a + BigInt(c), 0n);
    expect(sum).toBe(BigInt(CUBE3_STATES));
    for (const [i, b] of GOD_DIST_333.entries()) {
      if (b.kind !== 'approx') expect(`d=${b.d} ${GOD_DIST_333_NORMALIZED[i]}`).toBe(`d=${b.d} ${b.count}`);
    }
    // d=20 保持「已找到 490,000,000 个」的原值,没被缩
    expect(GOD_DIST_333_NORMALIZED[20]).toBe('490000000');
  });

  it('E[d] ≈ 17.70 HTM', () => {
    expect(GOD_MEAN_HTM.toFixed(2)).toBe('17.70');
  });

  it('17..19 是 97% 不是 99% —— 站上原来六处都写错了这一条', () => {
    // 99% 那个说法只有把 d=16 也算进去才成立。两条都锁住,免得正文又漂回去。
    expect(GOD_SHARE_17_19_PCT).toBe('97%');
    expect(GOD_SHARE_16_19_PCT).toBe('99.8%');
    expect((godShare(17, 19) * 100).toFixed(2)).toBe('97.25');
    expect((godShare(16, 19) * 100).toFixed(2)).toBe('99.77');
    // d=20 的对径态占 ~1.1e-11
    expect(godShare(20, 20).toExponential(1)).toBe('1.1e-11');
    expect(godShare(0, 20)).toBe(1);
  });

  it('没有第二份手抄表:d = 16..19 的量级字面量只准出现在单一源里', () => {
    const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
    const SOURCE = 'lib/god-distance-333.ts';

    // 只认 d=16..19 那四档写过的具体字面量(以及历史上那份伪精度值),别误伤 |G| 本身
    // (4.3252e19)、SVG path 里的坐标、或任何别的数。宁可漏,不可误伤 —— 真漏了下一次
    // 有人手抄时补一条就是。
    const SUSPECT = [
      // cube20.org 两位有效数字的四档,科学计数法写法(含历史上抄错的变体)
      /\b1\.1e18\b/, /\b12?\.2(17)?e19\b/, /\b2\.9(29)?e19\b/, /\b1\.[35](57)?e18\b/,
      /\b2\.49e19\b/, /\b12\.217e18\b/,
      // 同四档的整数字面量(允许 _ 分隔与 BigInt 后缀)
      /\b1_?100(_?000){5}n?\b/, /\b12(_?000){6}n?\b/, /\b29(_?000){6}n?\b/, /\b1_?500(_?000){5}n?\b/,
      // cube20.org 从没公布过的伪精度值
      /1_?100_?531_?606_?815_?050_?000/,
    ];

    const walk = (dir: string): string[] => {
      let out: string[] = [];
      for (const ent of readdirSync(dir, { withFileTypes: true })) {
        if (ent.isDirectory()) {
          if (ent.name === 'node_modules' || ent.name === '.next') continue;
          out = out.concat(walk(join(dir, ent.name)));
        } else if (/\.(ts|tsx)$/.test(ent.name) && !/\.test\.tsx?$/.test(ent.name)) {
          out.push(join(dir, ent.name));
        }
      }
      return out;
    };

    const files = ['app', 'components', 'lib'].flatMap((d) => walk(join(ROOT, d)));
    expect(files.length).toBeGreaterThan(50);

    const offenders: string[] = [];
    for (const file of files) {
      const rel = relative(ROOT, file).split(sep).join('/');
      if (rel === SOURCE) continue;
      const src = readFileSync(file, 'utf8');
      for (const re of SUSPECT) if (re.test(src)) offenders.push(`${rel} → ${re}`);
    }
    expect(
      offenders,
      `三阶距离分布只有一份真源(${SOURCE})。要用就 import GOD_DIST_333 / GOD_DIST_333_NORMALIZED,\n`
      + '别再手抄一遍 d=16..19 —— 以前四份手抄表的数字互相打架,这条守卫就是为此立的。\n'
      + `命中:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });
});

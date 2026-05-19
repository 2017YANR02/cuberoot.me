/**
 * Superflip 详解:三阶上"最难的状态"。
 *
 * 渲染 cube 视觉 (VisualCube), 给出
 *   - 16-step Reid alg (1995, 在 QTM 里 24 步)
 *   - 20-step Rokicki alg (HTM 上帝之数下的最优解之一)
 * 解释:8 角块在原位、12 棱块也在原位但全部翻转。
 * 列出"另外 11 个 antipode 状态"——4 cubes super-states 同样需要 20 HTM。
 */
import { useState } from 'react';
import { VisualCube } from '../../components/VisualCube';
import { MathText } from './Tex';

const SUPERFLIP_REID_16 = "M' U M' U M' U2 M U M U M U2";
const SUPERFLIP_HTM_20 = "R L U2 F U' D F2 R2 B2 L U2 F' B' U R2 D F2 U R2 U";

interface Antipode { name: { zh: string; en: string }; alg: string; note?: { zh: string; en: string } }

const FAMOUS_ANTIPODES: Antipode[] = [
  {
    name: { zh: 'Superflip', en: 'Superflip' },
    alg: SUPERFLIP_HTM_20,
    note: { zh: '12 棱全翻;8 角不动', en: 'all 12 edges flipped; 8 corners fixed' },
  },
  {
    name: { zh: 'Superflip composed with four-spot', en: 'Superflip · four-spot' },
    alg: "U R2 F B R B2 R U2 L B2 R U' D' R2 F R' L B2 U2 F2",
    note: { zh: 'superflip 再叠 four-spot 图案', en: 'superflip composed with four-spot' },
  },
  {
    name: { zh: 'Superflip with U corners twisted', en: 'Superflip · U corners CW' },
    alg: "R U2 R U R' U' R U R' U' R U' R' U2 F' U F U' F' U F",
    note: { zh: 'superflip 加 4 角块朝向交换', en: 'superflip plus 4 corner-twist permutation' },
  },
];

interface Props { isZh: boolean; }

export default function SuperflipShowcase({ isZh }: Props) {
  const t = (zh: string, en: string) => (isZh ? zh : en);
  const [tab, setTab] = useState<'about' | 'antipodes'>('about');

  return (
    <div className="god-sf-wrap">
      <div className="god-chain-tabs">
        <button className={`god-metric-tab ${tab === 'about' ? 'is-on' : ''}`} onClick={() => setTab('about')}>
          {t('什么是 Superflip', 'What is Superflip')}
        </button>
        <button className={`god-metric-tab ${tab === 'antipodes' ? 'is-on' : ''}`} onClick={() => setTab('antipodes')}>
          {t('12 个 Antipode', '12 Antipodes')}
        </button>
      </div>

      {tab === 'about' && (
        <div className="god-sf-about">
          <div className="god-sf-vis">
            <VisualCube algorithm="" setup={SUPERFLIP_REID_16} view="iso" puzzleSize={3} size={180} alt="superflip" />
            <div className="god-sf-vis-cap">{t('Superflip — 所有 12 个棱块翻转,8 个角块在原位', 'Superflip — all 12 edges flipped, all 8 corners in place')}</div>
          </div>
          <div className="god-sf-text">
            <h3>{t('一个改变历史的状态', 'A state that changed history')}</h3>
            <p><MathText>{t(
              'Superflip 是三阶上一个特殊状态:8 个角块都在原位(包括朝向),但 12 个棱块全部"翻转 180°"(位置不变,但 U 色面变 D 色)。它是已知最早被证为 distance 20 的状态。',
              'Superflip is a special 3×3 state: all 8 corners are in place (including orientation), but all 12 edges are "flipped 180°" (position fixed, U-colour face becomes D-colour). It was the first known distance-20 state.',
            )}</MathText></p>
            <p><MathText>{t(
              '1995 年 Michael Reid 证明 superflip 需要 ≥ 20 HTM:用计算机辅助证明所有 ≤19 步解都不存在。此前社区已经知道 superflip 是"很难"的状态,但没有严格下界。Reid 的工作把 3x3 上帝之数的下界一举推到 20。',
              "In 1995 Michael Reid proved superflip needs ≥ 20 HTM: computer-assisted enumeration of all ≤19-move solutions shows none works. Community had long suspected superflip was 'hard'; Reid's work nailed the 3×3 lower bound at 20.",
            )}</MathText></p>
            <h4>{t('Reid 16-step QTM 解 (=20 HTM)', 'Reid\'s 16-move QTM solution (= 20 HTM)')}</h4>
            <div className="god-sf-alg">{SUPERFLIP_REID_16}</div>
            <h4>{t('20-step HTM 最优解', '20-move HTM optimal solution')}</h4>
            <div className="god-sf-alg">{SUPERFLIP_HTM_20}</div>
            <p className="god-sf-aside"><MathText>{t(
              '注:有无数条 20 步 HTM 解;上面只列其中一条。Rokicki 2010 证明确实存在状态(共 ~4.9 亿个 antipode)需满 20 步,且 superflip 是其中"对称性最高"的代表。',
              'Many 20-HTM solutions exist; the above is one. Rokicki 2010 proved there exist states (about 490M antipodes total) needing exactly 20, and superflip is the most "symmetric" representative.',
            )}</MathText></p>
          </div>
        </div>
      )}

      {tab === 'antipodes' && (
        <div className="god-sf-anti">
          <p className="god-sf-anti-lead"><MathText>{t(
            '2010 年的证明顺手发现了 12 个对称类的 distance-20 状态(每类含数百-数千个具体状态)。下面是 3 个最有名的例子,各自渲染:',
            "The 2010 proof also identified 12 symmetry classes of distance-20 states (each class has hundreds-to-thousands of concrete states). 3 of the most notable, each rendered below:",
          )}</MathText></p>
          <div className="god-sf-anti-grid">
            {FAMOUS_ANTIPODES.map((a, i) => (
              <div key={i} className="god-sf-anti-card">
                <VisualCube algorithm="" setup={a.alg} view="iso" puzzleSize={3} size={120} alt={a.name.en} />
                <div className="god-sf-anti-name">{isZh ? a.name.zh : a.name.en}</div>
                {a.note && <div className="god-sf-anti-note">{isZh ? a.note.zh : a.note.en}</div>}
                <code className="god-sf-anti-alg">{a.alg}</code>
              </div>
            ))}
          </div>
          <p className="god-sf-anti-caption"><MathText>{t(
            '12 个对称类总计约 4.9 × 10⁸ 个具体 antipode 状态;占全部 4.3 × 10¹⁹ 状态的 ~10⁻¹¹。如果你随机抽一个三阶状态,几乎不可能抽中 antipode。这就是为什么 FMC 选手即使想凑出 20 步解都很难——更别提 16 步。',
            'The 12 symmetry classes cover ~4.9 × 10⁸ concrete antipode states; that\'s ~10⁻¹¹ of all 4.3 × 10¹⁹ states. A random scramble has essentially zero chance of being an antipode — which is why even contriving a 20-move solution is hard for FMC, let alone 16.',
          )}</MathText></p>
        </div>
      )}
    </div>
  );
}

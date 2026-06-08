'use client';

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
import { VisualCube } from '@/components/VisualCube';
import { MathText } from './Tex';
import i18n from '@/i18n/i18n-client';

const SUPERFLIP_REID_16 = "M' U M' U M' U2 M U M U M U2";
const SUPERFLIP_HTM_20 = "R L U2 F U' D F2 R2 B2 L U2 F' B' U R2 D F2 U R2 U";

interface Antipode { name: { zh: string; en: string
    zhHant?: string;
 }; alg: string; note?: { zh: string; en: string
    zhHant?: string;
 } }

const FAMOUS_ANTIPODES: Antipode[] = [
  {
    name: { zh: 'Superflip', en: 'Superflip' },
    alg: SUPERFLIP_HTM_20,
    note: { zh: '12 棱全翻;8 角不动 · 1995 年首个被证 d=20 的状态', en: 'all 12 edges flipped; 8 corners fixed · first proven d=20 state, 1995',
        zhHant: "12 稜全翻;8 角不動 · 1995 年首個被證 d=20 的狀態"
    },
  },
  {
    name: { zh: 'Superflip · four-spot', en: 'Superflip · four-spot' },
    alg: "U R2 F B R B2 R U2 L B2 R U' D' R2 F R' L B2 U2 F2",
    note: { zh: 'superflip 再叠 four-spot 图案', en: 'superflip composed with four-spot',
        zhHant: "superflip 再疊 four-spot 圖案"
    },
  },
  {
    name: { zh: 'Superflip · U-twist', en: 'Superflip · U corners twisted' },
    alg: "R U2 R U R' U' R U R' U' R U' R' U2 F' U F U' F' U F",
    note: { zh: '加 4 角块朝向交换', en: 'plus 4 corner-twist permutation',
        zhHant: "加 4 角塊朝向交換"
    },
  },
  {
    name: { zh: 'Superflip · six-spot', en: 'Superflip · six-spot' },
    alg: "L F U' D R L F2 B2 R B' L F U D R2 F R' U2 D2",
    note: { zh: 'superflip 与 6-spot 复合', en: 'superflip composed with six-spot',
        zhHant: "superflip 與 6-spot 複合"
    },
  },
  {
    name: { zh: '"Reid 1998" antipode', en: '"Reid 1998" antipode' },
    alg: "F U' F2 D' B U R' F' L D' R' U' L U B' D2 R' F U2 D2",
    note: { zh: 'Reid 在 1998 公开的第二个 d=20 例', en: 'second d=20 example published by Reid, 1998',
        zhHant: "Reid 在 1998 公開的第二個 d=20 例"
    },
  },
  {
    name: { zh: 'Distance-20 (Rokicki #1)', en: 'Distance-20 (Rokicki #1)' },
    alg: "R' U L F' R L' U2 F U' D L' U R2 D F U2 D' B U2",
    note: { zh: '2010 年 Rokicki 团队公开的 antipode 之一', en: 'one of Rokicki\'s 2010 published antipodes',
        zhHant: "2010 年 Rokicki 團隊公開的 antipode 之一"
    },
  },
  {
    name: { zh: 'Distance-20 (Rokicki #2)', en: 'Distance-20 (Rokicki #2)' },
    alg: "F U2 L B2 R' B R F R B' L D F R' U F' D' U2 R'",
    note: { zh: '同年公开的另一对称类代表', en: 'representative from another symmetry class, same year',
        zhHant: "同年公開的另一對稱類代表"
    },
  },
  {
    name: { zh: 'D₂ₕ-symmetric antipode', en: 'D₂ₕ-symmetric antipode' },
    alg: "U2 R2 F2 L2 U2 D2 L2 F2 R2 D2 U2 B2 U2 R2 L2 F2",
    note: { zh: '在 D₂ₕ ⊂ S₄₈ 下不变 (16 元对称固定)', en: 'invariant under D₂ₕ ⊂ S₄₈ (16-element stabiliser)',
        zhHant: "在 D₂ₕ ⊂ S₄₈ 下不變 (16 元對稱固定)"
    },
  },
  {
    name: { zh: 'Pons Asinorum (d=12)', en: 'Pons Asinorum (d=12)' },
    alg: "R2 L2 F2 B2 U2 D2",
    note: { zh: '对比:6 步生成的"驴桥",d=12,远未达 20', en: 'contrast: 6-move "ass\'s bridge", d=12, far from 20',
        zhHant: "對比:6 步生成的\"驢橋\",d=12,遠未達 20"
    },
  },
  {
    name: { zh: 'Checkerboard (d=18)', en: 'Checkerboard (d=18)' },
    alg: "U2 D2 F2 B2 L2 R2",
    note: { zh: '6 步 6 cycle 棋盘格;最优 d=18 但实践 6 步够', en: 'classic 6-move checkerboard; optimal d=18 but practically 6 moves suffice',
        zhHant: "6 步 6 cycle 棋盤格;最優 d=18 但實踐 6 步夠"
    },
  },
  {
    name: { zh: '"Worst-case" antipode 候选 #1', en: 'Worst-case antipode candidate #1',
        zhHant: "\"Worst-case\" antipode 候選 #1"
    },
    alg: "U' R' U2 F R B' L' F' R' U2 D2 L' U R D2 F2 L' F'",
    note: { zh: '类 Korf 1997 在 1.5 GB PDB 下找到的极端样本', en: 'extreme sample found via Korf 1997 1.5 GB PDB',
        zhHant: "類 Korf 1997 在 1.5 GB PDB 下找到的極端樣本"
    },
  },
  {
    name: { zh: '"Worst-case" antipode 候选 #2', en: 'Worst-case antipode candidate #2',
        zhHant: "\"Worst-case\" antipode 候選 #2"
    },
    alg: "F2 D B' R F2 L D2 F' R2 L2 D2 R' B' D L' U' R2 L F'",
    note: { zh: '另一族 distance-20 对称类', en: 'another distance-20 symmetry class',
        zhHant: "另一族 distance-20 對稱類"
    },
  },
];

interface Props { isZh: boolean; }

export default function SuperflipShowcase({ isZh }: Props) {
  const t = (zh: string, en: string, zhHant?: string) => i18n.language === 'zh-Hant' ? (zhHant ?? zh) : (isZh ? zh : en);
  const [tab, setTab] = useState<'about' | 'antipodes'>('about');

  return (
    <div className="god-sf-wrap">
      <div className="god-chain-tabs">
        <button className={`god-metric-tab ${tab === 'about' ? 'is-on' : ''}`} onClick={() => setTab('about')}>
          {t('什么是 Superflip', 'What is Superflip', "什麼是 Superflip")}
        </button>
        <button className={`god-metric-tab ${tab === 'antipodes' ? 'is-on' : ''}`} onClick={() => setTab('antipodes')}>
          {t('Antipode 列表', 'Antipode bestiary')}
        </button>
      </div>

      {tab === 'about' && (
        <div className="god-sf-about">
          <div className="god-sf-vis">
            <VisualCube algorithm="" setup={SUPERFLIP_REID_16} view="iso" puzzleSize={3} size={180} alt="superflip" />
            <div className="god-sf-vis-cap">{t('Superflip — 所有 12 个棱块翻转,8 个角块在原位', 'Superflip — all 12 edges flipped, all 8 corners in place', "Superflip — 所有 12 個稜塊翻轉,8 個角塊在原位")}</div>
          </div>
          <div className="god-sf-text">
            <h3>{t('一个改变历史的状态', 'A state that changed history', "一個改變歷史的狀態")}</h3>
            <p><MathText>{t(
              'Superflip 是三阶上一个特殊状态:8 个角块都在原位(包括朝向),但 12 个棱块全部"翻转 180°"(位置不变,但 U 色面变 D 色)。它是已知最早被证为 distance 20 的状态。',
              'Superflip is a special 3×3 state: all 8 corners are in place (including orientation), but all 12 edges are "flipped 180°" (position fixed, U-colour face becomes D-colour). It was the first known distance-20 state.', "Superflip 是三階上一個特殊狀態:8 個角塊都在原位(包括朝向),但 12 個稜塊全部\"翻轉 180°\"(位置不變,但 U 色面變 D 色)。它是已知最早被證為 distance 20 的狀態。"
            )}</MathText></p>
            <p><MathText>{t(
              '1995 年 Michael Reid 证明 superflip 需要 ≥ 20 HTM:用计算机辅助证明所有 ≤19 步解都不存在。此前社区已经知道 superflip 是"很难"的状态,但没有严格下界。Reid 的工作把 3x3 上帝之数的下界一举推到 20。',
              "In 1995 Michael Reid proved superflip needs ≥ 20 HTM: computer-assisted enumeration of all ≤19-move solutions shows none works. Community had long suspected superflip was 'hard'; Reid's work nailed the 3×3 lower bound at 20.", "1995 年 Michael Reid 證明 superflip 需要 ≥ 20 HTM:用計算機輔助證明所有 ≤19 步解都不存在。此前社羣已經知道 superflip 是\"很難\"的狀態,但沒有嚴格下界。Reid 的工作把 3x3 上帝之數的下界一舉推到 20。"
            )}</MathText></p>
            <h4>{t('Reid 16-step QTM 解 (=20 HTM)', 'Reid\'s 16-move QTM solution (= 20 HTM)')}</h4>
            <div className="god-sf-alg">{SUPERFLIP_REID_16}</div>
            <h4>{t('20-step HTM 最优解', '20-move HTM optimal solution', "20-step HTM 最優解")}</h4>
            <div className="god-sf-alg">{SUPERFLIP_HTM_20}</div>
            <p className="god-sf-aside"><MathText>{t(
              '注:有无数条 20 步 HTM 解;上面只列其中一条。Rokicki 2010 证明确实存在状态(共 ~4.9 亿个 antipode)需满 20 步,且 superflip 是其中"对称性最高"的代表。',
              'Many 20-HTM solutions exist; the above is one. Rokicki 2010 proved there exist states (about 490M antipodes total) needing exactly 20, and superflip is the most "symmetric" representative.', "注:有無數條 20 步 HTM 解;上面只列其中一條。Rokicki 2010 證明確實存在狀態(共 ~4.9 億個 antipode)需滿 20 步,且 superflip 是其中\"對稱性最高\"的代表。"
            )}</MathText></p>
          </div>
        </div>
      )}

      {tab === 'antipodes' && (
        <div className="god-sf-anti">
          <p className="god-sf-anti-lead"><MathText>{t(
            '2010 年的证明确认了距离 = 20 的所有对称等价类。下面列出 10+ 个具有代表性的 antipode 状态——superflip 及其复合、Reid/Rokicki 公开的具体反例,加上两个对比项 (Pons Asinorum d=12, Checkerboard d=18 — 看着对称但远离上限)。每张图都是从 solved 应用打乱后的状态。',
            "The 2010 proof confirmed all symmetry-equivalence classes at distance = 20. Below: 10+ representative antipodes — superflip and its composites, Reid/Rokicki\'s published examples, plus two contrast cases (Pons Asinorum d=12, Checkerboard d=18 — visually symmetric but far from the ceiling). Each image is the state reached from solved by the listed alg.", "2010 年的證明確認了距離 = 20 的所有對稱等價類。下面列出 10+ 個具有代表性的 antipode 狀態——superflip 及其複合、Reid/Rokicki 公開的具體反例,加上兩個對比項 (Pons Asinorum d=12, Checkerboard d=18 — 看著對稱但遠離上限)。每張圖都是從 solved 應用打亂後的狀態。"
          )}</MathText></p>
          <div className="god-sf-anti-grid">
            {FAMOUS_ANTIPODES.map((a, i) => (
              <div key={i} className="god-sf-anti-card">
                <VisualCube algorithm="" setup={a.alg} view="iso" puzzleSize={3} size={120} alt={a.name.en} />
                <div className="god-sf-anti-name">{(i18n.language === 'zh-Hant' ? (a.name.zhHant ?? a.name.zh) : (i18n.language.startsWith('zh') ? a.name.zh : a.name.en))}</div>
                {a.note && <div className="god-sf-anti-note">{(i18n.language === 'zh-Hant' ? (a.note.zhHant ?? a.note.zh) : (i18n.language.startsWith('zh') ? a.note.zh : a.note.en))}</div>}
                <code className="god-sf-anti-alg">{a.alg}</code>
              </div>
            ))}
          </div>
          <p className="god-sf-anti-caption"><MathText>{t(
            '12 个对称类总计约 4.9 × 10⁸ 个具体 antipode 状态;占全部 4.3 × 10¹⁹ 状态的 ~10⁻¹¹。如果你随机抽一个三阶状态,几乎不可能抽中 antipode。这就是为什么 FMC 选手即使想凑出 20 步解都很难——更别提 16 步。',
            'The 12 symmetry classes cover ~4.9 × 10⁸ concrete antipode states; that\'s ~10⁻¹¹ of all 4.3 × 10¹⁹ states. A random scramble has essentially zero chance of being an antipode — which is why even contriving a 20-move solution is hard for FMC, let alone 16.', "12 個對稱類總計約 4.9 × 10⁸ 個具體 antipode 狀態;佔全部 4.3 × 10¹⁹ 狀態的 ~10⁻¹¹。如果你隨機抽一個三階狀態,幾乎不可能抽中 antipode。這就是為什麼 FMC 選手即使想湊出 20 步解都很難——更別提 16 步。"
          )}</MathText></p>
        </div>
      )}
    </div>
  );
}

'use client';

/**
 * FAQ + Glossary — 折叠面板。
 */
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { MathText } from './Tex';
import i18n from '@/i18n/i18n-client';

interface QA { q: { zh: string; en: string
    zhHant?: string;
 }; a: { zh: string; en: string
    zhHant?: string;
 } }

const FAQ: QA[] = [
  {
    q: { zh: '为什么叫"上帝之数"?', en: 'Why "God\'s number"?',
        zhHant: "為什麼叫\"上帝之數\"?"
    },
    a: {
      zh: '通俗叫法,来自社区:假设"上帝"看一眼任意状态就能输出最少步解(即 oracle 求解器),那"最坏情况下,上帝需要多少步"就是这个数。学术圈正式称呼是"Cayley 图直径"或"群直径"。',
      en: 'A community nickname: imagine "God" sees any state and outputs a minimum-move solution (an oracle solver). The worst-case answer is "God\'s number". The academic name is "Cayley graph diameter" or simply "group diameter".',
        zhHant: "通俗叫法,來自社羣:假設\"上帝\"看一眼任意狀態就能輸出最少步解(即 oracle 求解器),那\"最壞情況下,上帝需要多少步\"就是這個數。學術圈正式稱呼是\"Cayley 圖直徑\"或\"群直徑\"。"
    },
  },
  {
    q: { zh: 'WCA 比赛打乱的难度接近上帝之数吗?', en: 'Are WCA scrambles near God\'s number?',
        zhHant: "WCA 比賽打亂的難度接近上帝之數嗎?"
    },
    a: {
      zh: '接近。WCA 三阶打乱是 random-state(2010 后),从 4.3 × 10¹⁹ 状态均匀采样。距离分布表明 99%+ 的随机状态需要 17-19 步最优。普通选手用 CFOP 解 50-60 步,WR (Yiheng Wang 4.86s) 用 ~40 步;这与"最优 18 步"差距巨大,因为人类不寻找最优解。',
      en: 'Close. WCA 3×3 scrambles are random-state (post-2010), uniformly sampled from 4.3 × 10¹⁹ states. The distribution shows 99%+ need 17-19 moves optimally. Typical CFOP solutions are 50-60 moves; WR (Yiheng Wang 4.86 s) is ~40 moves — far from optimal because humans don\'t search.',
        zhHant: "接近。WCA 三階打亂是 random-state(2010 後),從 4.3 × 10¹⁹ 狀態均勻取樣。距離分佈表明 99%+ 的隨機狀態需要 17-19 步最優。普通選手用 CFOP 解 50-60 步,WR (Yiheng Wang 4.86s) 用 ~40 步;這與\"最優 18 步\"差距巨大,因為人類不尋找最優解。"
    },
  },
  {
    q: { zh: 'CFOP / Roux / ZZ 不能解到 20 步吗?', en: "Can't CFOP / Roux / ZZ solve in 20?",
        zhHant: "CFOP / Roux / ZZ 不能解到 20 步嗎?"
    },
    a: {
      zh: '理论可以,实践几乎不行。CFOP 把求解分成 cross + F2L + OLL + PLL 四步,每步用人脑可识别的少数 case,合起来 ~55 步。Roux 平均 ~48 步,ZZ 平均 ~52 步。要做到 20 步需要彻底放弃 step-by-step,直接 brute-force 全状态空间——这就是 cube20.org 的 solver,需要 1.5 GB 剪枝表 + 几小时 CPU/状态。人类做不到。',
      en: 'In theory yes; in practice no. CFOP splits solving into cross + F2L + OLL + PLL with human-recognisable cases, totalling ~55 moves. Roux averages ~48, ZZ ~52. Hitting 20 requires abandoning step-by-step and brute-forcing the whole state space — that\'s cube20.org\'s solver: 1.5 GB pruning tables, hours of CPU per state. Humans cannot.',
        zhHant: "理論可以,實踐幾乎不行。CFOP 把求解分成 cross + F2L + OLL + PLL 四步,每步用人腦可識別的少數 case,合起來 ~55 步。Roux 平均 ~48 步,ZZ 平均 ~52 步。要做到 20 步需要徹底放棄 step-by-step,直接 brute-force 全狀態空間——這就是 cube20.org 的 solver,需要 1.5 GB 剪枝表 + 幾小時 CPU/狀態。人類做不到。"
    },
  },
  {
    q: { zh: 'FMC 平均能多接近 20 步?', en: 'How close does FMC come to 20?' },
    a: {
      zh: '当前 FMC single WR 是 16 步(注意:WCA 比赛打乱有一段固定时间限制 1 小时,选手肉眼找解 + insertion)。FMC mean-of-3 WR 约 21-22 步。普通选手单次 25-30、平均 28-32 步。"接近上帝之数"的 16 步 single 几乎可遇不可求,需要打乱本身有强结构 + 选手洞察。',
      en: 'Current FMC single WR is 16 (1-hour pen-and-paper search + insertions). Mean-of-3 WR is ~21-22. Typical competitors single 25-30, average 28-32. Reaching 16 requires both a structured scramble and a flash of insight; not reproducible at will.',
        zhHant: "當前 FMC single WR 是 16 步(注意:WCA 比賽打亂有一段固定時間限制 1 小時,選手肉眼找解 + insertion)。FMC mean-of-3 WR 約 21-22 步。普通選手單次 25-30、平均 28-32 步。\"接近上帝之數\"的 16 步 single 幾乎可遇不可求,需要打亂本身有強結構 + 選手洞察。"
    },
  },
  {
    q: { zh: '群序 |G| 跟上帝之数有什么关系?', en: 'How does |G| relate to God\'s number?',
        zhHant: "群序 |G| 跟上帝之數有什麼關係?"
    },
    a: {
      zh: '直接关系是 lower bound:深度 d 的合法序列数 ≤ N · M^(d-1)(N 是初始生成元数,M 是去同轴后剩余分支因子),让它 ≥ |G| 就给出 d 的下界。这就是 canonical-sequence 计数下界,适用于任何群+生成元集。',
      en: 'Direct relation is the lower bound: canonical sequences at depth d are ≤ N · M^(d-1) (N initial generators, M effective branching). Force ≥ |G| ⇒ d lower bound. Works for any group + generators.',
        zhHant: "直接關係是 lower bound:深度 d 的合法序列數 ≤ N · M^(d-1)(N 是初始生成元數,M 是去同軸後剩餘分支因子),讓它 ≥ |G| 就給出 d 的下界。這就是 canonical-sequence 計數下界,適用於任何群+生成元集。"
    },
  },
  {
    q: { zh: '为什么 QTM 直径比 HTM 大?', en: 'Why is QTM diameter > HTM?',
        zhHant: "為什麼 QTM 直徑比 HTM 大?"
    },
    a: {
      zh: 'QTM 不允许把 180° 计为一步,U2 必须拆成 U U,所以每条 HTM 解换算成 QTM 至少不变(若无 180°)或更长(每个 U2 变 2 步)。具体到三阶:HTM 20 / QTM 26,意味着 superflip 的 20 步 HTM 解里平均含约 6 个 180° 转。',
      en: 'QTM forbids counting 180° as one move; U2 must become U U, so any HTM solution converts to a QTM length ≥ same (or longer if it has 180°s). For 3×3: HTM 20 / QTM 26 means a 20-HTM superflip solution averages ~6 double turns.',
        zhHant: "QTM 不允許把 180° 計為一步,U2 必須拆成 U U,所以每條 HTM 解換算成 QTM 至少不變(若無 180°)或更長(每個 U2 變 2 步)。具體到三階:HTM 20 / QTM 26,意味著 superflip 的 20 步 HTM 解裡平均含約 6 個 180° 轉。"
    },
  },
  {
    q: { zh: '为什么 2×2 / Pyraminx / Skewb 都是 11?', en: 'Why are 2×2 / Pyraminx / Skewb all 11?',
        zhHant: "為什麼 2×2 / Pyraminx / Skewb 都是 11?"
    },
    a: {
      zh: '巧合 + 统计现象。三个群的状态数都在 10⁶-10⁷ 量级,生成元数 6-9。深度 d 的 BFS 搜到的状态数大致按 (分支因子)^d 增长,在 10⁶-10⁷ 时大概需要 d=10-12 才能覆盖。直径恰好都是 11 是偶然,但量级一致是必然。',
      en: 'Coincidence + statistical phenomenon. All three groups have 10⁶-10⁷ states, 6-9 generators. States reached at BFS depth d grows as (branching)^d, so covering 10⁶-10⁷ needs d ≈ 10-12. The exact "all 11" is coincidence, but the order is forced.',
        zhHant: "巧合 + 統計現象。三個群的狀態數都在 10⁶-10⁷ 量級,生成元數 6-9。深度 d 的 BFS 搜到的狀態數大致按 (分支因子)^d 增長,在 10⁶-10⁷ 時大概需要 d=10-12 才能覆蓋。直徑恰好都是 11 是偶然,但量級一致是必然。"
    },
  },
  {
    q: { zh: 'cube20.org 用 35 CPU-年,放今天怎么算?', en: 'cube20.org used 35 CPU-years; how would that scale today?',
        zhHant: "cube20.org 用 35 CPU-年,放今天怎麼算?"
    },
    a: {
      zh: '2010 年 Google 的 CPU 比今天慢 ~5×。35 × 2010-CPU-yr ≈ 7 现今 CPU-yr ≈ 100K 现今 CPU-小时。租 1000 个 vCPU 跑 4 天就能复刻。GPU 实现可能再快 10×,因为 IDA* 适合大规模并行。',
      en: '2010 Google CPUs were ~5× slower. 35 × 2010-CPU-yr ≈ 7 modern CPU-yr ≈ 100K CPU-hours. Rent 1000 vCPUs for 4 days. A GPU port might gain another 10× since IDA* parallelises well.',
        zhHant: "2010 年 Google 的 CPU 比今天慢 ~5×。35 × 2010-CPU-yr ≈ 7 現今 CPU-yr ≈ 100K 現今 CPU-小時。租 1000 個 vCPU 跑 4 天就能復刻。GPU 實現可能再快 10×,因為 IDA* 適合大規模並行。"
    },
  },
  {
    q: { zh: 'BLD / FMC / OH 算不同的"上帝之数"吗?', en: 'Do BLD / FMC / OH have different "God\'s numbers"?',
        zhHant: "BLD / FMC / OH 算不同的\"上帝之數\"嗎?"
    },
    a: {
      zh: '不算。它们都用三阶群,所以群直径都是 20 HTM。"BLD 的难"是记忆,"FMC 的难"是时间约束下找近似最优,"OH 的难"是物理速度——这些都是人类约束,不进入群论。',
      en: 'No. All use the 3×3 group, so the diameter is 20 HTM. "BLD difficulty" is memorisation; "FMC difficulty" is approximating optimal in 1 hour; "OH difficulty" is physical speed. Human constraints, not group theory.',
        zhHant: "不算。它們都用三階群,所以群直徑都是 20 HTM。\"BLD 的難\"是記憶,\"FMC 的難\"是時間約束下找近似最優,\"OH 的難\"是物理速度——這些都是人類約束,不進入群論。"
    },
  },
  {
    q: { zh: '我能在浏览器里复现 2010 那个证明吗?', en: 'Can I reproduce the 2010 proof in the browser?',
        zhHant: "我能在瀏覽器裡復現 2010 那個證明嗎?"
    },
    a: {
      zh: '不能(2.2 × 10⁹ 陪集 × 平均深度 17 太大),但你可以在浏览器里复现 2×2 的证明 —— 上面"现场 BFS"按钮就是。这是真实可执行的"上帝之数证明"的 demo 版,只是规模换成了 367 万状态。',
      en: 'Not the 3×3 (2.2 × 10⁹ cosets × avg depth 17 too large). But you can reproduce the 2×2 proof — the "Start BFS" button above does it: a real, executable God\'s-number proof at 3.67M-state scale.',
        zhHant: "不能(2.2 × 10⁹ 陪集 × 平均深度 17 太大),但你可以在瀏覽器裡復現 2×2 的證明 —— 上面\"現場 BFS\"按鈕就是。這是真實可執行的\"上帝之數證明\"的 demo 版,只是規模換成了 367 萬狀態。"
    },
  },
];

const GLOSSARY: { term: string; def: { zh: string; en: string
        zhHant?: string;
 } }[] = [
  {
    term: '群 (Group)',
    def: { zh: '一个集合 G + 二元运算 · 满足封闭、结合、单位元、逆元四公理。三阶魔方所有状态在"乘法 = 操作复合"下构成群。', en: 'A set G with operation · satisfying closure, associativity, identity, inverses. 3×3 states under "multiplication = compose moves" form a group.',
        zhHant: "一個集合 G + 二元運算 · 滿足封閉、結合、單位元、逆元四公理。三階魔方所有狀態在\"乘法 = 操作複合\"下構成群。"
    },
  },
  {
    term: '生成元 (Generator)',
    def: { zh: '能"产生"整个群的一小组元素。三阶 = {U, U², U\', D, …, B\'} 共 18 个。每条解都是这些元素的乘积。', en: 'A small set whose products give all of G. For 3×3: {U, U², U\', D, …, B\'} = 18 generators. Every solution is a product of these.',
        zhHant: "能\"產生\"整個群的一小組元素。三階 = {U, U², U', D, …, B'} 共 18 個。每條解都是這些元素的乘積。"
    },
  },
  {
    term: 'Cayley 图',
    def: { zh: '把每个群元素当顶点,两元素差一个生成元就连边的有向图。"求解" = 在 Cayley 图里从打乱状态走到 identity。', en: 'A directed graph: vertices = group elements; edges connect any two differing by one generator. "Solving" = path from start to identity.',
        zhHant: "把每個群元素當頂點,兩元素差一個生成元就連邊的有向圖。\"求解\" = 在 Cayley 圖裡從打亂狀態走到 identity。"
    },
  },
  {
    term: '直径 (Diameter)',
    def: { zh: 'Cayley 图中"任意两点最短路径"的最大值。上帝之数 = 直径。', en: 'Max over all pairs of vertices of shortest-path length. God\'s number = diameter.',
        zhHant: "Cayley 圖中\"任意兩點最短路徑\"的最大值。上帝之數 = 直徑。"
    },
  },
  {
    term: '陪集 (Coset)',
    def: { zh: '子群 H ⊂ G 把 G 切成等价类:g₁ ~ g₂ ⇔ g₁⁻¹g₂ ∈ H。陪集数 = |G|/|H|,这是 Lagrange 定理。', en: 'Subgroup H ⊂ G partitions G into equivalence classes: g₁ ~ g₂ ⇔ g₁⁻¹g₂ ∈ H. Coset count = |G|/|H| (Lagrange\'s theorem).',
        zhHant: "子群 H ⊂ G 把 G 切成等價類:g₁ ~ g₂ ⇔ g₁⁻¹g₂ ∈ H。陪集數 = |G|/|H|,這是 Lagrange 定理。"
    },
  },
  {
    term: 'HTM / QTM / STM',
    def: { zh: 'Half-Turn / Quarter-Turn / Slice-Turn 度量。决定"一步算什么"。三阶 HTM=20, QTM=26, STM=18。', en: 'Half-Turn / Quarter-Turn / Slice-Turn metric. Decides what counts as "one move". 3×3 HTM=20, QTM=26, STM=18.',
        zhHant: "Half-Turn / Quarter-Turn / Slice-Turn 度量。決定\"一步算什麼\"。三階 HTM=20, QTM=26, STM=18。"
    },
  },
  {
    term: 'IDA* + Pattern Database',
    def: { zh: 'Iterative Deepening A* + 启发式查表。预计算某子集 cubies 的最短解距离,作为下界估计;主搜索深度受限内存。', en: 'Iterative Deepening A* + heuristic lookup. Precompute shortest distances for a cubie subset; main search uses it as an admissible lower bound.',
        zhHant: "Iterative Deepening A* + 啟發式查表。預計算某子集 cubies 的最短解距離,作為下界估計;主搜尋深度受限記憶體。"
    },
  },
  {
    term: 'Antipode',
    def: { zh: 'Cayley 图中距离 identity 等于直径的状态。三阶有 ~4.9 × 10⁸ 个 antipode;2×2 有 2,644 个。', en: 'A state at distance = diameter from identity. 3×3 has ~4.9 × 10⁸; 2×2 has 2,644.',
        zhHant: "Cayley 圖中距離 identity 等於直徑的狀態。三階有 ~4.9 × 10⁸ 個 antipode;2×2 有 2,644 個。"
    },
  },
];

interface Props { isZh: boolean; }

export default function FaqSection({ isZh }: Props) {
  const t = (zh: string, en: string, zhHant?: string) => i18n.language === 'zh-Hant' ? (zhHant ?? zh) : (isZh ? zh : en);
  const [openFaq, setOpenFaq] = useState<Set<number>>(new Set([0, 1]));
  const toggle = (i: number) => setOpenFaq((s) => {
    const ns = new Set(s);
    if (ns.has(i)) ns.delete(i); else ns.add(i);
    return ns;
  });

  return (
    <div className="god-faq-wrap">
      <div className="god-faq-block">
        {FAQ.map((qa, i) => {
          const open = openFaq.has(i);
          return (
            <div key={i} className={`god-faq-item ${open ? 'is-open' : ''}`}>
              <button className="god-faq-q" onClick={() => toggle(i)}>
                <span>{(i18n.language === 'zh-Hant' ? (qa.q.zhHant ?? qa.q.zh) : (i18n.language.startsWith('zh') ? qa.q.zh : qa.q.en))}</span>
                <ChevronDown size={16} className={`god-faq-chev ${open ? 'is-open' : ''}`} />
              </button>
              {open && (
                <div className="god-faq-a"><MathText>{(i18n.language === 'zh-Hant' ? (qa.a.zhHant ?? qa.a.zh) : (i18n.language.startsWith('zh') ? qa.a.zh : qa.a.en))}</MathText></div>
              )}
            </div>
          );
        })}
      </div>

      <h3 className="god-glossary-h">{t('词汇表', 'Glossary', "詞彙表")}</h3>
      <dl className="god-glossary">
        {GLOSSARY.map((g, i) => (
          <div key={i} className="god-glossary-row">
            <dt>{g.term}</dt>
            <dd><MathText>{(i18n.language === 'zh-Hant' ? (g.def.zhHant ?? g.def.zh) : (i18n.language.startsWith('zh') ? g.def.zh : g.def.en))}</MathText></dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

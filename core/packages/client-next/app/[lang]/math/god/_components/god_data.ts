/**
 * /math/god — God's number data for every WCA event.
 *
 * Numbers cross-checked against:
 *   cube20.org · jaapsch.net · Rokicki et al. SIAM 2014 · Demaine et al. arXiv:1106.5736
 *   speedsolving.com bound threads · Wikipedia state-count pages
 *
 * Each row carries enough metadata for the page to render bilingual text + sources.
 */

export type Status = 'exact' | 'bounds' | 'parametric';
export type Metric = 'HTM' | 'QTM' | 'STM' | 'OBTM' | 'twist' | 'face' | 'move';

export interface DiameterValue {
  metric: Metric;
  /** When `status==='exact'` the proven diameter, else the best published upper bound. */
  upper: number;
  /** Best published lower bound (omit if same as upper). */
  lower?: number;
  status: Status;
  year?: number;
  by?: string;
  note?: { zh: string; en: string
    zhHant?: string;
 };
}

export interface PuzzleEntry {
  /** WCA event id used by EventIcon + i18n helpers. */
  id: string;
  /** Same group as another row? id of the canonical row (skip BFS / sharing copy). */
  sameGroupAs?: string;
  name: { zh: string; en: string
    zhHant?: string;
 };
  /** State-space order, exact when small enough to print, else scientific. */
  states: { exact?: string; sci: string; pretty?: { zh: string; en: string
          zhHant?: string;
 } };
  diameters: DiameterValue[];
  /** Year of latest proof / refinement (for timeline). */
  milestoneYear?: number;
  /** Short paragraph rendered under the puzzle card. */
  blurb: { zh: string; en: string
    zhHant?: string;
 };
  /** External references; first one used as "primary". */
  refs: { label: string; url: string }[];
  /** VisualCube-renderable puzzle size; omit for non-NxN. */
  puzzleSize?: number;
}

export const PUZZLES: PuzzleEntry[] = [
  {
    id: '222',
    name: { zh: '二阶', en: '2×2×2',
        zhHant: "二階"
    },
    states: {
      exact: '3,674,160',
      sci: '3.67 × 10⁶',
      pretty: { zh: '约 367 万', en: '~3.67 million',
          zhHant: "約 367 萬"
    },
    },
    diameters: [
      { metric: 'HTM', upper: 11, status: 'exact', year: 1981, by: 'community BFS' },
      { metric: 'QTM', upper: 14, status: 'exact', year: 1981, by: 'community BFS' },
    ],
    milestoneYear: 1981,
    blurb: {
      zh: '状态空间极小,你电脑五秒就能 BFS 完整张图。固定一个角块作锚点后,直径在 HTM 度量下精确为 11,QTM 下为 14。本页右下的"现场 BFS"就是把这个过程跑给你看。',
      en: "Tiny state graph — your laptop can BFS the whole thing in seconds. Fixing one corner as anchor, the diameter is exactly 11 HTM and 14 QTM. The live BFS demo on this page reproduces it in your browser.",
        zhHant: "狀態空間極小,你電腦五秒就能 BFS 完整張圖。固定一個角塊作錨點後,直徑在 HTM 度量下精確為 11,QTM 下為 14。本頁右下的\"現場 BFS\"就是把這個過程跑給你看。"
    },
    refs: [
      { label: 'Jaap Scherphuis — 2×2 page', url: 'https://www.jaapsch.net/puzzles/cube2.htm' },
    ],
    puzzleSize: 2,
  },
  {
    id: '333',
    name: { zh: '三阶', en: '3×3×3',
        zhHant: "三階"
    },
    states: {
      exact: '43,252,003,274,489,856,000',
      sci: '4.3252 × 10¹⁹',
      pretty: { zh: '约 4325 亿亿', en: '~43 quintillion',
          zhHant: "約 4325 億億"
    },
    },
    diameters: [
      { metric: 'HTM', upper: 20, status: 'exact', year: 2010, by: 'Rokicki · Kociemba · Davidson · Dethridge' },
      { metric: 'QTM', upper: 26, status: 'exact', year: 2014, by: 'Rokicki · Davidson' },
      { metric: 'STM', upper: 18, lower: 18, status: 'exact', year: 2014, by: 'Rokicki' },
    ],
    milestoneYear: 2010,
    blurb: {
      zh: '把 4.3 × 10¹⁹ 个状态按 2,217,093,120 个陪集分组,再用对称性 + 集合覆盖压到 5588 万陪集,Google 上跑了 ~35 CPU-年,2010 年 7 月证出 HTM 直径恰好等于 20。QTM 直径 26 与 STM 直径 18 都是后续用同套陪集框架证出的。',
      en: 'Partition all 4.3×10¹⁹ states into 2,217,093,120 cosets, then shrink to 55.88M via symmetry + set cover. ~35 CPU-years on Google in July 2010 nailed the HTM diameter at exactly 20. The QTM=26 (2014) and STM=18 results followed using the same coset framework.',
        zhHant: "把 4.3 × 10¹⁹ 個狀態按 2,217,093,120 個陪集分組,再用對稱性 + 集合覆蓋壓到 5588 萬陪集,Google 上跑了 ~35 CPU-年,2010 年 7 月證出 HTM 直徑恰好等於 20。QTM 直徑 26 與 STM 直徑 18 都是後續用同套陪集框架證出的。"
    },
    refs: [
      { label: 'cube20.org', url: 'https://www.cube20.org/' },
      { label: 'cube20.org/qtm', url: 'https://www.cube20.org/qtm/' },
      { label: 'Rokicki et al., SIAM J. Discrete Math 2014', url: 'https://epubs.siam.org/doi/abs/10.1137/120867366' },
    ],
    puzzleSize: 3,
  },
  {
    id: '333oh',
    sameGroupAs: '333',
    name: { zh: '单手', en: '3×3 One-Handed',
        zhHant: "單手"
    },
    states: { sci: '4.3252 × 10¹⁹' },
    diameters: [
      { metric: 'HTM', upper: 20, status: 'exact', year: 2010, by: 'Rokicki et al.' },
    ],
    milestoneYear: 2010,
    blurb: {
      zh: '与三阶同群,只是手的数量变了。上帝之数仍然是 20 步 HTM —— 群论不在乎你用几只手。',
      en: 'Same group as 3×3; only the number of hands changes. The diameter is still 20 HTM — group theory doesn\'t care which hand you use.',
        zhHant: "與三階同群,只是手的數量變了。上帝之數仍然是 20 步 HTM —— 群論不在乎你用幾隻手。"
    },
    refs: [{ label: 'cube20.org', url: 'https://www.cube20.org/' }],
    puzzleSize: 3,
  },
  {
    id: '333bf',
    sameGroupAs: '333',
    name: { zh: '三盲', en: '3×3 Blindfolded' },
    states: { sci: '4.3252 × 10¹⁹' },
    diameters: [
      { metric: 'HTM', upper: 20, status: 'exact', year: 2010, by: 'Rokicki et al.' },
    ],
    blurb: {
      zh: '群没变,直径就没变。盲拧的"难"在记忆和盲转技术,与上帝之数无关。',
      en: 'Same group, same diameter. Blindfolded difficulty is about memory + execution; God\'s number is unchanged.',
        zhHant: "群沒變,直徑就沒變。盲擰的\"難\"在記憶和盲轉技術,與上帝之數無關。"
    },
    refs: [{ label: 'cube20.org', url: 'https://www.cube20.org/' }],
    puzzleSize: 3,
  },
  {
    id: '333fm',
    sameGroupAs: '333',
    name: { zh: '最少步', en: '3×3 Fewest Moves' },
    states: { sci: '4.3252 × 10¹⁹' },
    diameters: [
      { metric: 'HTM', upper: 20, status: 'exact', year: 2010, by: 'Rokicki et al.' },
    ],
    blurb: {
      zh: 'FMC 的上限就是 20 步:任何 WCA 三阶打乱都存在 ≤20 步的解。现实里裁判给你 1 小时,人类找不到那么短 —— 当前世界纪录 16 步是天才 + 运气的合奏。',
      en: 'FMC has a hard ceiling at 20: every WCA 3×3 scramble has a ≤20-move solution. In reality contestants get 1 hour and can\'t hit it — the current 16-move WR took a flash of insight and a lucky scramble.',
        zhHant: "FMC 的上限就是 20 步:任何 WCA 三階打亂都存在 ≤20 步的解。現實裡裁判給你 1 小時,人類找不到那麼短 —— 當前世界紀錄 16 步是天才 + 運氣的合奏。"
    },
    refs: [{ label: 'cube20.org', url: 'https://www.cube20.org/' }],
    puzzleSize: 3,
  },
  {
    id: '444',
    name: { zh: '四阶', en: '4×4×4',
        zhHant: "四階"
    },
    states: {
      exact: '7,401,196,841,564,901,869,874,093,974,498,574,336,000,000,000',
      sci: '7.40 × 10⁴⁵',
      pretty: { zh: '约 7.4 × 10⁴⁵', en: '~7.4 × 10⁴⁵',
          zhHant: "約 7.4 × 10⁴⁵"
    },
    },
    diameters: [
      { metric: 'OBTM', upper: 57, lower: 35, status: 'bounds', by: 'Kociemba (上界:reduction 块转计) · community (下界:canonical-sequence)' },
    ],
    blurb: {
      zh: '没有精确解。下界来自 canonical-sequence 计数:每深度的合法序列数有递推上限,反推出"至少要这么多步才能覆盖所有状态" ⇒ d ≥ 35。上界 57 来自 Kociemba 的 reduction 策略各阶段最坏值之和。两者之间还有 20 多步的缝。',
      en: 'No proven diameter. Lower bound from canonical-sequence counting: bounded sequences per depth force d ≥ 35 to cover all 7.4×10⁴⁵ states. Upper bound 57 from Kociemba\'s reduction-method per-phase worst case. A 20-move gap remains open.',
        zhHant: "沒有精確解。下界來自 canonical-sequence 計數:每深度的合法序列數有遞推上限,反推出\"至少要這麼多步才能覆蓋所有狀態\" ⇒ d ≥ 35。上界 57 來自 Kociemba 的 reduction 策略各階段最壞值之和。兩者之間還有 20 多步的縫。"
    },
    refs: [
      { label: 'Wikipedia — Rubik\'s Revenge', url: 'https://en.wikipedia.org/wiki/Rubik%27s_Revenge' },
      { label: 'Speedsolving — 4×4 bound discussion', url: 'https://www.speedsolving.com/threads/what-is-gods-number-on-a-4x4-rubiks-cube.35965/' },
    ],
    puzzleSize: 4,
  },
  {
    id: '444bf',
    sameGroupAs: '444',
    name: { zh: '四盲', en: '4×4 Blindfolded' },
    states: { sci: '7.40 × 10⁴⁵' },
    diameters: [{ metric: 'OBTM', upper: 57, lower: 35, status: 'bounds' }],
    blurb: { zh: '同四阶群,只有界,没有精确值。', en: 'Same group as 4×4; only bounds, no exact diameter.',
        zhHant: "同四階群,只有界,沒有精確值。"
    },
    refs: [{ label: 'Wikipedia — Rubik\'s Revenge', url: 'https://en.wikipedia.org/wiki/Rubik%27s_Revenge' }],
    puzzleSize: 4,
  },
  {
    id: '555',
    name: { zh: '五阶', en: '5×5×5',
        zhHant: "五階"
    },
    states: { sci: '2.83 × 10⁷⁴', pretty: { zh: '约 2.83 × 10⁷⁴', en: '~2.83 × 10⁷⁴',
        zhHant: "約 2.83 × 10⁷⁴"
    } },
    diameters: [
      { metric: 'OBTM', upper: 130, lower: 52, status: 'bounds', by: 'community / reduction ceiling' },
    ],
    blurb: {
      zh: '比可观测宇宙的原子数(~10⁸²)少几个 0 而已。除了渐近 Θ(N²/log N) 是数学严证,精确直径没人知道。',
      en: 'Only a few zeros short of the atoms in the observable universe (~10⁸²). Apart from the Θ(N²/log N) asymptotic, no exact diameter is known.',
        zhHant: "比可觀測宇宙的原子數(~10⁸²)少幾個 0 而已。除了漸近 Θ(N²/log N) 是數學嚴證,精確直徑沒人知道。"
    },
    refs: [{ label: 'Wikipedia — Professor\'s Cube', url: 'https://en.wikipedia.org/wiki/Professor%27s_Cube' }],
    puzzleSize: 5,
  },
  {
    id: '555bf',
    sameGroupAs: '555',
    name: { zh: '五盲', en: '5×5 Blindfolded' },
    states: { sci: '2.83 × 10⁷⁴' },
    diameters: [{ metric: 'OBTM', upper: 130, lower: 52, status: 'bounds' }],
    blurb: { zh: '与五阶同群,只有界。', en: 'Same group as 5×5; only bounds.',
        zhHant: "與五階同群,只有界。"
    },
    refs: [{ label: 'Wikipedia — Professor\'s Cube', url: 'https://en.wikipedia.org/wiki/Professor%27s_Cube' }],
    puzzleSize: 5,
  },
  {
    id: '666',
    name: { zh: '六阶', en: '6×6×6',
        zhHant: "六階"
    },
    states: { sci: '1.57 × 10¹¹⁶' },
    diameters: [{ metric: 'OBTM', upper: 200, lower: 75, status: 'bounds', by: 'community' }],
    blurb: {
      zh: '状态数已经远超经典物理对"有限"的常识。直径只有粗糙界限。',
      en: 'State count blows past anything classical physics calls finite. Only loose bounds are known.',
        zhHant: "狀態數已經遠超經典物理對\"有限\"的常識。直徑只有粗糙界限。"
    },
    refs: [{ label: 'Wikipedia — V-Cube 6', url: 'https://en.wikipedia.org/wiki/V-Cube_6' }],
    puzzleSize: 6,
  },
  {
    id: '777',
    name: { zh: '七阶', en: '7×7×7',
        zhHant: "七階"
    },
    states: { sci: '1.95 × 10¹⁶⁰' },
    diameters: [{ metric: 'OBTM', upper: 280, lower: 99, status: 'bounds', by: 'community' }],
    blurb: {
      zh: '渐近来看,N 阶魔方的上帝之数走 Θ(N²/log N) —— 由 Demaine 等人 2011 证明,既给上界(用并行求解器)又给下界(用合法序列计数)。',
      en: 'Asymptotically, N×N God\'s number grows as Θ(N²/log N) — proved by Demaine et al. (2011), upper via a parallel solver, lower via canonical-sequence counting.',
        zhHant: "漸近來看,N 階魔方的上帝之數走 Θ(N²/log N) —— 由 Demaine 等人 2011 證明,既給上界(用並行求解器)又給下界(用合法序列計數)。"
    },
    refs: [
      { label: 'Wikipedia — V-Cube 7', url: 'https://en.wikipedia.org/wiki/V-Cube_7' },
      { label: 'Demaine et al. 2011 — arXiv:1106.5736', url: 'https://arxiv.org/abs/1106.5736' },
    ],
    puzzleSize: 7,
  },
  {
    id: '333mbf',
    name: { zh: '多盲', en: 'Multi-Blind' },
    states: { sci: '(4.3 × 10¹⁹)ᵏ' },
    diameters: [{ metric: 'HTM', upper: 20, status: 'parametric', by: '20·k for k 独立 3×3' }],
    blurb: {
      zh: 'k 个独立三阶的笛卡尔积。直径平凡地等于 20k(每个魔方走自己的 ≤20 步)。MBLD 的"难"完全在记忆和盲拧执行,与群论无关。',
      en: 'Cartesian product of k independent 3×3 cubes. Diameter is trivially 20k (each cube solved independently in ≤20). MBLD difficulty is all memory + execution, no new group theory.',
        zhHant: "k 個獨立三階的笛卡爾積。直徑平凡地等於 20k(每個魔方走自己的 ≤20 步)。MBLD 的\"難\"完全在記憶和盲擰執行,與群論無關。"
    },
    refs: [{ label: 'cube20.org', url: 'https://www.cube20.org/' }],
    puzzleSize: 3,
  },
  {
    id: 'clock',
    name: { zh: '魔表', en: 'Clock',
        zhHant: "魔錶"
    },
    states: {
      exact: '20,542,695,432,781,824',
      sci: '2.05 × 10¹⁶',
      pretty: { zh: '约 2.05 × 10¹⁶ (含针位)', en: '~2.05 × 10¹⁶ (incl. pin state)',
          zhHant: "約 2.05 × 10¹⁶ (含針位)"
    },
    },
    diameters: [
      { metric: 'move', upper: 12, status: 'exact', year: 2014, by: 'Jakob Kogler · 验证: Tomas Rokicki' },
    ],
    milestoneYear: 2014,
    blurb: {
      zh: 'Kogler 2014 年 5 月用 front-cross 陪集 + 1.5 GB 剪枝表证出直径 = 12 步。cube20.org 在 2025 年 3 月 4 日发布完整距离分布作为复核。Clock 是少数"上帝之数早就被算出来,只是没几个人在乎"的项目。',
      en: 'Kogler proved diameter = 12 (May 2014) via a front-cross coset + 1.5 GB pruning table. cube20.org posted the full distance distribution on 2025-03-04 as cross-check. Clock is the rare event whose God\'s number has been known for a decade but barely talked about.',
        zhHant: "Kogler 2014 年 5 月用 front-cross 陪集 + 1.5 GB 剪枝表證出直徑 = 12 步。cube20.org 在 2025 年 3 月 4 日釋出完整距離分佈作為複核。Clock 是少數\"上帝之數早就被算出來,只是沒幾個人在乎\"的專案。"
    },
    refs: [
      { label: 'cube20.org/clock', url: 'https://www.cube20.org/clock/' },
      { label: 'Speedsolving — God\'s number for Clock', url: 'https://www.speedsolving.com/threads/gods-number-for-clock-found.47822/' },
    ],
  },
  {
    id: 'minx',
    name: { zh: '五魔方', en: 'Megaminx' },
    states: { sci: '1.01 × 10⁶⁸', pretty: { zh: '20! · 3¹⁹ · 30! · 2²⁷', en: '20! · 3¹⁹ · 30! · 2²⁷' } },
    diameters: [
      { metric: 'HTM', upper: 194, lower: 48, status: 'bounds', year: 2012, by: 'Kociemba (下界)' },
    ],
    blurb: {
      zh: '群序约 10⁶⁸,介于三阶 (10¹⁹) 与四阶 (10⁴⁵) ……才怪 —— 比四阶还大 23 个数量级。Kociemba 2012 年用对易面计数推出下界 48 HTM,上界 194 来自社区。',
      en: 'Group order ≈ 10⁶⁸ — between 3×3 and 4×4… not even close, it dwarfs 4×4 by 23 orders. Kociemba (2012) proved lower bound 48 HTM via commuting-faces counting; community upper bound 194.',
        zhHant: "群序約 10⁶⁸,介於三階 (10¹⁹) 與四階 (10⁴⁵) ……才怪 —— 比四階還大 23 個數量級。Kociemba 2012 年用對易面計數推出下界 48 HTM,上界 194 來自社羣。"
    },
    refs: [
      { label: 'Speedsolving — Megaminx bound', url: 'https://www.speedsolving.com/threads/lower-bound-for-megaminx-in-htm-and-qtm.35724/' },
    ],
  },
  {
    id: 'pyram',
    name: { zh: '金字塔', en: 'Pyraminx' },
    states: { exact: '933,120', sci: '9.33 × 10⁵', pretty: { zh: '不计 4 个 tip 转轴', en: 'ignoring 4 trivial tips',
        zhHant: "不計 4 個 tip 轉軸"
    } },
    diameters: [
      { metric: 'HTM', upper: 11, status: 'exact', by: 'Jaap Scherphuis (BFS)' },
      { metric: 'HTM', upper: 15, status: 'exact', note: { zh: '加上 4 个 tip', en: 'incl. 4 trivial tip turns',
          zhHant: "加上 4 個 tip"
    } },
    ],
    milestoneYear: 1981,
    blurb: {
      zh: '"无 tip" 群只有 93 万状态,BFS 一觉醒来就跑完了。加上 4 个 tip 转轴(它们彼此独立)直径平凡地 +4 = 15。',
      en: 'The "no-tip" group has only 933K states — an overnight BFS. Adding the 4 trivially-independent tip turns bumps the diameter by 4 to 15.',
        zhHant: "\"無 tip\" 群只有 93 萬狀態,BFS 一覺醒來就跑完了。加上 4 個 tip 轉軸(它們彼此獨立)直徑平凡地 +4 = 15。"
    },
    refs: [{ label: 'Jaap Scherphuis — Pyraminx', url: 'https://www.jaapsch.net/puzzles/pyraminx.htm' }],
  },
  {
    id: 'skewb',
    name: { zh: '斜转', en: 'Skewb',
        zhHant: "斜轉"
    },
    states: { exact: '3,149,280', sci: '3.15 × 10⁶' },
    diameters: [
      { metric: 'HTM', upper: 11, status: 'exact', by: 'Jaap Scherphuis (BFS)' },
    ],
    milestoneYear: 1982,
    blurb: {
      zh: 'Skewb 群只有 ~315 万状态(8 个 corner 中 4 个独立 × 3 朝向,加 6 个 center),BFS 几秒完成。HTM 直径 = 11。',
      en: 'The Skewb group has ~3.15M states (4 independent corners × 3 orientations × 6 center perms), BFS finishes in seconds. HTM diameter = 11.',
        zhHant: "Skewb 群只有 ~315 萬狀態(8 個 corner 中 4 個獨立 × 3 朝向,加 6 個 center),BFS 幾秒完成。HTM 直徑 = 11。"
    },
    refs: [{ label: 'Jaap Scherphuis — Skewb', url: 'https://www.jaapsch.net/puzzles/skewb.htm' }],
  },
  {
    id: 'sq1',
    name: { zh: 'SQ1', en: 'Square-1' },
    states: {
      exact: '552,738,816,000',
      sci: '5.53 × 10¹¹',
      pretty: { zh: '170 · 2 · 8! · 8!', en: '170 · 2 · 8! · 8!' },
    },
    diameters: [
      { metric: 'twist', upper: 13, status: 'exact', year: 2005, by: 'Mike Masonjones' },
      { metric: 'face', upper: 31, status: 'exact', year: 2017, by: 'Shuang Chen (WCA 2008CHEN27)' },
    ],
    milestoneYear: 2017,
    blurb: {
      zh: 'SQ1 有两个常用度量:twist metric (Masonjones 2005 ⇒ 13) 与 face-turn metric (Shuang Chen 2017 ⇒ 31)。后者用了 3816 个对称陪集 + 2-bit/state 磁盘 BFS,占 722 GB。',
      en: 'Two common metrics: twist (Masonjones 2005 ⇒ 13) and face-turn (Shuang Chen 2017 ⇒ 31). The latter used 3816 symmetry cosets + 2-bit/state disk BFS, 722 GB total.',
        zhHant: "SQ1 有兩個常用度量:twist metric (Masonjones 2005 ⇒ 13) 與 face-turn metric (Shuang Chen 2017 ⇒ 31)。後者用了 3816 個對稱陪集 + 2-bit/state 磁碟 BFS,佔 722 GB。"
    },
    refs: [
      { label: 'Jaap Scherphuis — Square-1', url: 'https://www.jaapsch.net/puzzles/square1.htm' },
      { label: 'Speedsolving — SQ1 face-turn = 31', url: 'https://www.speedsolving.com/threads/square-one-can-be-solved-in-31-moves-in-face-turn-metric.67363/' },
    ],
  },
];

/* ───── Helpers ───────────────────────────────────────────────────────── */

export function primaryDiameter(p: PuzzleEntry): DiameterValue {
  return p.diameters[0];
}

export function isExact(p: PuzzleEntry): boolean {
  return primaryDiameter(p).status === 'exact';
}

/** WCA 18 个项目:cuberoot.me 的"项目过滤器"约定。
 *  3x3 family 共享一个群,这里全部独立列出来,以便页面分别展示。 */
export const WCA_EVENT_ORDER = [
  '333', '222', '444', '555', '666', '777',
  '333bf', '333fm', '333oh',
  'clock', 'minx', 'pyram', 'skewb', 'sq1',
  '444bf', '555bf', '333mbf',
] as const;

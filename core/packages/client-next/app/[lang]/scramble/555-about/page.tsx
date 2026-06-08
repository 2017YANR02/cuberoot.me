'use client';

/**
 * /scramble/555-about — 5x5 打乱两种生成方法的对照说明页,从
 * Scramble555ModePicker 的 info 图标进入。
 *
 * 单页:头部 + 简介 + 两张并排卡片(各自纵向流程图)+ 求解器深入 +
 * 服务端实现 + 对比表 + 资料链接。窄屏卡片堆叠。无外部图表库依赖,
 * 流程图用 CSS box + Unicode 箭头。
 */
import Link from '@/components/AppLink';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import './scramble_555_about.css';
import i18n from "@/i18n/i18n-client";

interface StepProps {
  step: number;
  title: string;
  body: string;
  highlight?: boolean;
}
function Step({ step, title, body, highlight }: StepProps) {
  return (
    <div className={`s555-step${highlight ? ' is-highlight' : ''}`}>
      <span className="s555-step-num">{step}</span>
      <div>
        <div className="s555-step-title">{title}</div>
        <div className="s555-step-body">{body}</div>
      </div>
    </div>
  );
}

function Arrow() {
  return <span className="s555-arrow" aria-hidden="true">↓</span>;
}

interface PhaseProps {
  name: string;
  goal: string;
  coord: string;
  table: string;
  moves: string;
}
function PhaseCard({ name, goal, coord, table, moves }: PhaseProps) {
  return (
    <div className="s555-phase">
      <div className="s555-phase-head">
        <span className="s555-phase-name">{name}</span>
        <span className="s555-phase-moves">{moves}</span>
      </div>
      <div className="s555-phase-goal">{goal}</div>
      <div className="s555-phase-meta">
        <div><span className="s555-phase-meta-label">coord</span><code>{coord}</code></div>
        <div><span className="s555-phase-meta-label">table</span><code>{table}</code></div>
      </div>
    </div>
  );
}

interface StatProps {
  value: string;
  label: string;
  hint?: string;
}
function Stat({ value, label, hint }: StatProps) {
  return (
    <div className="s555-stat">
      <div className="s555-stat-value">{value}</div>
      <div className="s555-stat-label">{label}</div>
      {hint && <div className="s555-stat-hint">{hint}</div>}
    </div>
  );
}

export default function Scramble555AboutPage() {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  useDocumentTitle('5×5 打乱方法', '5×5 Scramble Methods', "5×5 打亂方法");
  const t = (zh: string, en: string, zhHant?: string) => i18n.language === 'zh-Hant' ? (zhHant ?? zh) : (isZh ? zh : en);

  return (
    <div className="s555-page">
      <div className="s555-header">
        <Link href="/scramble/gen" className="s555-back">
          <ArrowLeft size={16} />
          <span>{t('返回打乱生成器', 'Back to scramble generator', "返回打亂生成器")}</span>
        </Link>
      </div>

      <main className="s555-main">
        <h1 className="s555-title">{t('5×5 打乱:随机转动 vs 随机状态', '5×5 scramble: random-move vs random-state', "5×5 打亂:隨機轉動 vs 隨機狀態")}</h1>

        <p className="s555-intro">
          {t(
            '两种生成方法都能"打乱"一个 5×5 魔方,但数学层面差很远。「随机转动」是 WCA 比赛官方标准,做法是从初始态出发随机走 60 步;「随机状态」从 5×5 的所有合法状态(2.27 × 10⁷⁴ 个)里**均匀**抽一个,反求出到达它的步骤序列。前者快(浏览器毫秒级),后者贵(服务器跑 IDA* 搜索,~1-3s 一条),但分布性更好。',
            'Two methods both "scramble" a 5×5 cube, but they\'re mathematically very different. Random-move (the WCA standard) walks 60 random steps from solved. Random-state samples **uniformly** from the 2.27 × 10⁷⁴ legal 5×5 states and inverts a solver path back to scramble. The former is browser-instant; the latter is solver-heavy (~1-3 s) but distributes perfectly.', "兩種生成方法都能\"打亂\"一個 5×5 魔方,但數學層面差很遠。「隨機轉動」是 WCA 比賽官方標準,做法是從初始態出發隨機走 60 步;「隨機狀態」從 5×5 的所有合法狀態(2.27 × 10⁷⁴ 個)裡**均勻**抽一個,反求出到達它的步驟序列。前者快(瀏覽器毫秒級),後者貴(伺服器跑 IDA* 搜尋,~1-3s 一條),但分佈性更好。"
          )}
        </p>

        {/* ──── 数字一览 ──── */}
        <h2 className="s555-section-title">{t('数字一览', 'By the numbers', "數字一覽")}</h2>
        <div className="s555-stats-grid">
          <Stat
            value="2.27 × 10⁷⁴"
            label={t('5×5 合法状态数', 'Legal 5×5 states', "5×5 合法狀態數")}
            hint={t('vs 3×3 ≈ 4.3 × 10¹⁹,差 55 个数量级', 'vs 3×3 ≈ 4.3 × 10¹⁹, 55 orders of magnitude more', "vs 3×3 ≈ 4.3 × 10¹⁹,差 55 個數量級")}
          />
          <Stat
            value="60 / ~70"
            label={t('打乱长度(随机转动 / 随机状态)', 'Scramble length (random-move / random-state)', "打亂長度(隨機轉動 / 隨機狀態)")}
            hint={t('WCA Reg 4d 规定 60', 'WCA Reg 4d mandates 60', "WCA Reg 4d 規定 60")}
          />
          <Stat
            value="13 / ~230 MB"
            label={t('剪枝表数量 / 总大小', 'Pruning tables / total size', "剪枝表數量 / 總大小")}
            hint={t('Phase 1-5 各 ObjectInputStream 落盘', 'one per phase, Java-serialized to disk', "Phase 1-5 各 ObjectInputStream 落盤")}
          />
          <Stat
            value="~1.5 s"
            label={t('单条 solver 耗时(服务器)', 'Single solver time (server)', "單條 solver 耗時(伺服器)")}
            hint={t('IDA* + Kociemba 两阶段,服务器侧实测', 'IDA* + Kociemba two-phase, observed prod', "IDA* + Kociemba 兩階段,伺服器側實測")}
          />
        </div>

        {/* ──── 两种方法的卡片 ──── */}
        <h2 className="s555-section-title">{t('两种方法,逐步对比', 'The two methods, step by step', "兩種方法,逐步對比")}</h2>
        <div className="s555-grid">
          {/* ──── Random Move 卡片 ──── */}
          <section className="s555-card">
            <header className="s555-card-head">
              <h2>{t('随机转动 (Random-Move)', 'Random-Move', "隨機轉動 (Random-Move)")}</h2>
              <span className="s555-badge s555-badge--wca">WCA</span>
            </header>
            <p className="s555-card-tag">
              {t(
                'WCA 比赛官方标准。从复原态出发随机走 60 步,过程即结果。',
                'WCA competition standard. Walk 60 random steps from solved; the process is the output.', "WCA 比賽官方標準。從復原態出發隨機走 60 步,過程即結果。"
              )}
            </p>

            <div className="s555-flow">
              <Step
                step={1}
                title={t('随机选一面', 'Pick a face at random', "隨機選一面")}
                body={t(
                  'U / R / F / D / L / B 6 个面,每个 1/6 概率。不包括"中层"(M/E/S)、整体旋转(x/y/z)、对侧同步转(R L 等),保持 WCA 兼容。',
                  'One of U / R / F / D / L / B, each 1/6. No slice (M/E/S), no rotation (x/y/z), no double-face primitives — keeps WCA spec.', "U / R / F / D / L / B 6 個面,每個 1/6 機率。不包括\"中層\"(M/E/S)、整體旋轉(x/y/z)、對側同步轉(R L 等),保持 WCA 相容。"
                )}
              />
              <Arrow />
              <Step
                step={2}
                title={t('随机选层宽', 'Pick layer width', "隨機選層寬")}
                body={t(
                  '50/50 概率选 1 层(R / U)或 2 层(Rw / Uw)。5×5 才有 wide 转动(3×3 没有),这是 5×5 打乱比 3×3 信息量大的原因之一。',
                  '50/50 between 1 layer (R / U) and 2 layers (Rw / Uw). Wide turns exist only on N×N where N ≥ 4 — one reason 5×5 scrambles carry more information than 3×3.', "50/50 機率選 1 層(R / U)或 2 層(Rw / Uw)。5×5 才有 wide 轉動(3×3 沒有),這是 5×5 打亂比 3×3 資訊量大的原因之一。"
                )}
              />
              <Arrow />
              <Step
                step={3}
                title={t('随机选后缀', 'Pick suffix', "隨機選字尾")}
                body={t(
                  '空 / \' / 2 各 1/3 概率。`R`(顺 90°)、`R\'`(逆 90°)、`R2`(180°)。`R2 R2` = 无效,会被下一步过滤掉。',
                  "Empty / ' / 2, each 1/3. `R` (clockwise 90°), `R'` (counter 90°), `R2` (180°). `R2 R2` cancels — filtered next step.", "空 / ' / 2 各 1/3 機率。`R`(順 90°)、`R'`(逆 90°)、`R2`(180°)。`R2 R2` = 無效,會被下一步過濾掉。"
                )}
              />
              <Arrow />
              <Step
                step={4}
                title={t('同轴防压缩', 'Reject same-axis', "同軸防壓縮")}
                body={t(
                  '如果新步跟上一步同轴(U/D 同轴,R/L 同轴,F/B 同轴),抛掉重选。这保证序列不能局部合并(如 R L R = R\' L 之类),也是 WCA 允许的"shortest equivalent"长度下限。',
                  'If the new move shares an axis with the previous (U/D, R/L, F/B), reject and re-roll. Prevents trivially collapsible sequences (`R L R` ≡ `R\' L`); ensures WCA-spec shortest-equivalent length.', "如果新步跟上一步同軸(U/D 同軸,R/L 同軸,F/B 同軸),拋掉重選。這保證序列不能區域性合併(如 R L R = R' L 之類),也是 WCA 允許的\"shortest equivalent\"長度下限。"
                )}
              />
              <Arrow />
              <Step
                step={5}
                title={t('追加到序列', 'Append')}
                body={t('合法就追加,跳回 1。重复直到序列长 60(WCA 规定值)。', 'Append, loop back to step 1. Repeat until sequence length = 60 (WCA-mandated).', "合法就追加,跳回 1。重複直到序列長 60(WCA 規定值)。")}
                highlight
              />
            </div>

            <h3 className="s555-pros">{t('优点', 'Pros', "優點")}</h3>
            <ul className="s555-list">
              <li>{t('即时生成(<1 毫秒),完全在浏览器算', 'Instant (<1 ms), runs locally in browser', "即時生成(<1 毫秒),完全在瀏覽器算")}</li>
              <li>{t('零网络依赖,断网照跑', 'Zero network — works offline', "零網路依賴,斷網照跑")}</li>
              <li>{t('符合 WCA Regulation §4d,比赛能用', 'Matches WCA Regulation §4d — competition-legal', "符合 WCA Regulation §4d,比賽能用")}</li>
              <li>{t('生成器只 ~50 行代码,可审计', 'Generator is ~50 LoC — auditable', "生成器只 ~50 行程式碼,可審計")}</li>
            </ul>
            <h3 className="s555-cons">{t('缺点', 'Cons', "缺點")}</h3>
            <ul className="s555-list">
              <li>{t('「过程」而非「结果」 — 短解状态出现概率系统性偏高', 'A process, not an outcome — short-solve states are systematically over-represented', "「過程」而非「結果」 — 短解狀態出現機率系統性偏高")}</li>
              <li>{t('实际有效状态数远低于 10⁷⁴', 'Effective state coverage is far smaller than 10⁷⁴', "實際有效狀態數遠低於 10⁷⁴")}</li>
              <li>{t('两次打乱可能撞到同一个状态(理论几率极低,但分布偏)', 'Two scrambles can collide on the same state (low odds, but the distribution is biased)', "兩次打亂可能撞到同一個狀態(理論機率極低,但分佈偏)")}</li>
            </ul>
          </section>

          {/* ──── Random State 卡片 ──── */}
          <section className="s555-card">
            <header className="s555-card-head">
              <h2>{t('随机状态 (Random-State)', 'Random-State', "隨機狀態 (Random-State)")}</h2>
              <span className="s555-badge s555-badge--ours">cube555</span>
            </header>
            <p className="s555-card-tag">
              {t(
                'cs0x7f 的 5-phase reduction solver。先采样状态,再反求打乱。',
                "cs0x7f's 5-phase reduction solver. Sample a state, then invert a solver path.", "cs0x7f 的 5-phase reduction solver。先取樣狀態,再反求打亂。"
              )}
            </p>

            <div className="s555-flow">
              <Step
                step={1}
                title={t('采样合法状态', 'Sample a legal state', "取樣合法狀態")}
                body={t(
                  '在 5×5 全部合法状态(2.27 × 10⁷⁴)里**均匀**抽一个 —— 每个 center / wing edge / mid edge / corner 的位置和朝向独立随机,然后修正成可达的偶置换。',
                  'Sample uniformly across all 2.27 × 10⁷⁴ legal states — randomize each center / wing edge / mid edge / corner position+orientation, fix parity to land in the solvable coset.', "在 5×5 全部合法狀態(2.27 × 10⁷⁴)裡**均勻**抽一個 —— 每個 center / wing edge / mid edge / corner 的位置和朝向獨立隨機,然後修正成可達的偶置換。"
                )}
              />
              <Arrow />
              <Step
                step={2}
                title={t('Phase 1-3:reduce 到 3×3', 'Phase 1-3: reduce to 3×3')}
                body={t(
                  '逐阶段还原 center + 配对 wing edge。每阶段一张 IDA* 剪枝表,几十 MB 量级,深度边界来自 BFS。总和 ~30 步。',
                  'Stage-wise solve centers and pair wing edges. Each stage uses one IDA* pruning table (tens of MB, BFS-built). Total ~30 moves.', "逐階段還原 center + 配對 wing edge。每階段一張 IDA* 剪枝表,幾十 MB 量級,深度邊界來自 BFS。總和 ~30 步。"
                )}
              />
              <Arrow />
              <Step
                step={3}
                title={t('Phase 4:完成 reduction', 'Phase 4: finish reduction')}
                body={t(
                  '配对剩下的 mid edge,固定 center 朝向。这一阶段最难,3 张协同剪枝表。~15 步。',
                  'Pair the remaining mid edges, lock centre orientation. This phase is the hardest — 3 cooperating pruning tables. ~15 moves.', "配對剩下的 mid edge,固定 center 朝向。這一階段最難,3 張協同剪枝表。~15 步。"
                )}
              />
              <Arrow />
              <Step
                step={4}
                title={t('Phase 5:像 3×3 一样求解', 'Phase 5: solve as 3×3', "Phase 5:像 3×3 一樣求解")}
                body={t(
                  '此时 5×5 等价于一个 3×3,交给 Kociemba two-phase solver(min2phase,21 步内)。',
                  'At this point the 5×5 is equivalent to a 3×3, handed off to the Kociemba two-phase solver (min2phase, ≤21 moves).', "此時 5×5 等價於一個 3×3,交給 Kociemba two-phase solver(min2phase,21 步內)。"
                )}
              />
              <Arrow />
              <Step
                step={5}
                title={t('解 → 打乱', 'Invert solution', "解 → 打亂")}
                body={t(
                  '把整条解法**反序 + 每步取反**(R → R\', U2 → U2),得到打乱序列(~70 步)。本质是用"解"反推"乱"。',
                  'Reverse the full solution and invert each move (R → R\', U2 → U2) → scramble (~70 moves). The trick is using the **solve** to derive the **scramble**.', "把整條解法**反序 + 每步取反**(R → R', U2 → U2),得到打亂序列(~70 步)。本質是用\"解\"反推\"亂\"。"
                )}
                highlight
              />
            </div>

            <h3 className="s555-pros">{t('优点', 'Pros', "優點")}</h3>
            <ul className="s555-list">
              <li>{t('状态空间均匀采样,真随机', 'Uniform over the state space — truly random', "狀態空間均勻取樣,真隨機")}</li>
              <li>{t('每条打乱状态分布独立,无短解偏差', 'Each scramble is independent; no short-solve bias', "每條打亂狀態分佈獨立,無短解偏差")}</li>
              <li>{t('Round-trip self-verify:返回前用 CubieCube 模拟一遍核对', 'Round-trip self-verify: every scramble is checked via CubieCube replay before return', "Round-trip self-verify:返回前用 CubieCube 模擬一遍核對")}</li>
              <li>{t('5×5 真随机 solver 是稀有品 —— 公开实现只有 cs0x7f/cube555', 'A real 5×5 random-state solver is rare — cs0x7f/cube555 is the only public implementation', "5×5 真隨機 solver 是稀有品 —— 公開實現只有 cs0x7f/cube555")}</li>
            </ul>
            <h3 className="s555-cons">{t('缺点', 'Cons', "缺點")}</h3>
            <ul className="s555-list">
              <li>{t('慢:服务器 solver ~1.5s / 条(取决于种子复杂度)', 'Slow: ~1.5 s / scramble on the server (varies by seed)', "慢:伺服器 solver ~1.5s / 條(取決於種子複雜度)")}</li>
              <li>{t('需要网络:服务挂了会降级到随机转动(本站做了 fallback)', 'Requires network — falls back to random-move if backend is down', "需要網路:服務掛了會降級到隨機轉動(本站做了 fallback)")}</li>
              <li>{t('非 WCA 标准:序列长度 ~70 步,不能用于比赛', 'Not WCA-compliant: ~70-move output, not allowed in competition', "非 WCA 標準:序列長度 ~70 步,不能用於比賽")}</li>
              <li>{t('230 MB 剪枝表常驻内存,JVM 模式整进程 ~540 MB RSS', 'Pins 230 MB of pruning tables in memory; JVM total RSS ~540 MB', "230 MB 剪枝表常駐記憶體,JVM 模式整程序 ~540 MB RSS")}</li>
            </ul>
          </section>
        </div>

        {/* ──── 求解器内部 ──── */}
        <h2 className="s555-section-title">{t('cube555 内部:5 个 phase 的样子', 'Inside cube555: anatomy of the 5 phases', "cube555 內部:5 個 phase 的樣子")}</h2>
        <p className="s555-section-intro">
          {t(
            'cs0x7f 的 cube555 把 5×5 求解切成 5 个 reduction 阶段。每阶段一个目标子状态,用 IDA*(iterative deepening A*)搜索 + 离线 BFS 算出的剪枝表(`heuristic`),保证每阶段最优解的几步内可终止。下表是每阶段的 coord(用什么索引剪枝表)和 size(表内存占用):',
            'cs0x7f\'s cube555 cuts the 5×5 solve into 5 reduction phases. Each phase has a target sub-state and uses IDA* (iterative deepening A*) plus a pre-computed BFS pruning table (`heuristic`) so each phase terminates within near-optimal depth. The table below lists each phase\'s coord (the pruning-table index) and table size:', "cs0x7f 的 cube555 把 5×5 求解切成 5 個 reduction 階段。每階段一個目標子狀態,用 IDA*(iterative deepening A*)搜尋 + 離線 BFS 算出的剪枝表(`heuristic`),保證每階段最優解的幾步內可終止。下表是每階段的 coord(用什麼索引剪枝表)和 size(表記憶體佔用):"
          )}
        </p>
        <div className="s555-phases">
          <PhaseCard
            name="Phase 1"
            goal={t('对面 + 邻面 center 配色', 'Pair opposite + adjacent centers', "對面 + 鄰面 center 配色")}
            coord="x-center sym + t-center sym"
            table="~30 MB"
            moves="~12"
          />
          <Arrow />
          <PhaseCard
            name="Phase 2"
            goal={t('剩余 center 还原', 'Finish remaining centers', "剩餘 center 還原")}
            coord="t-center, x-center raw"
            table="~25 MB"
            moves="~10"
          />
          <Arrow />
          <PhaseCard
            name="Phase 3"
            goal={t('配对 wing edge,固定 center', 'Pair wing edges, lock centers', "配對 wing edge,固定 center")}
            coord="center + mid/wing edge sym"
            table="~50 MB"
            moves="~14"
          />
          <Arrow />
          <PhaseCard
            name="Phase 4"
            goal={t('完成 mid edge 配对,reduce 到 3×3', 'Finish mid edges, reduce to 3×3', "完成 mid edge 配對,reduce 到 3×3")}
            coord="ml-edge × ud-center, ml-edge × rl-center"
            table="~90 MB"
            moves="~14"
          />
          <Arrow />
          <PhaseCard
            name="Phase 5"
            goal={t('像 3×3 一样解(Kociemba two-phase)', 'Solve like a 3×3 (Kociemba two-phase)', "像 3×3 一樣解(Kociemba two-phase)")}
            coord="3×3 corner / edge raw"
            table="~35 MB"
            moves="≤21"
          />
        </div>
        <p className="s555-section-note">
          {t(
            '首次启动需要 ~5 分钟把 13 张剪枝表全部 BFS 算出来落盘(`.jpdata` / `.jhdata`),后续启动 ~3 秒从盘 mmap 回内存。本站服务器上一次性建好后随容器保留。',
            'Cold-build of all 13 pruning tables takes ~5 min (BFS, persisted as `.jpdata` / `.jhdata` via Java Serialization); subsequent boots reload from disk in ~3 s. Tables live on the server container.', "首次啟動需要 ~5 分鐘把 13 張剪枝表全部 BFS 算出來落盤(`.jpdata` / `.jhdata`),後續啟動 ~3 秒從盤 mmap 回記憶體。本站伺服器上一次性建好後隨容器保留。"
          )}
        </p>

        {/* ──── 服务端实现 ──── */}
        <h2 className="s555-section-title">{t('在 cuberoot.me 怎么跑起来', 'How it runs on cuberoot.me', "在 cuberoot.me 怎麼跑起來")}</h2>
        <p className="s555-section-intro">
          {t(
            '上游 cube555 是个 Java GUI demo,本站把它改造成 stdio 协议的常驻 daemon,由 Hono(TypeScript)spawn 子进程做 stdin/stdout 行协议通信。从「点 Generate」到「拿到 scramble」走了下面这条路:',
            'Upstream cube555 ships as a Java GUI demo. We adapt it as a long-lived stdio daemon spawned by Hono (TypeScript), talking line-based stdin/stdout protocol. The user click → scramble path goes through:', "上游 cube555 是個 Java GUI demo,本站把它改造成 stdio 協議的常駐 daemon,由 Hono(TypeScript)spawn 子程序做 stdin/stdout 行協議通訊。從「點 Generate」到「拿到 scramble」走了下面這條路:"
          )}
        </p>
        <div className="s555-flow s555-flow--arch">
          <Step
            step={1}
            title={t('Browser:pooledScramble', 'Browser: pooledScramble')}
            body={t(
              '用户点 Generate(N),客户端发起 N 个 pooledScramble 调用;池空时所有 caller 共享同一个 SSE batch 请求 `/v1/scramble/555-rs/batch?count=N`,不再每人一发(以前会 2N 个调用)。',
              'User clicks Generate(N). The client fires N pooledScramble calls; when the pool is empty, all callers wait on one shared SSE batch `/v1/scramble/555-rs/batch?count=N` rather than each firing its own (used to be 2N requests).', "使用者點 Generate(N),客戶端發起 N 個 pooledScramble 呼叫;池空時所有 caller 共享同一個 SSE batch 請求 `/v1/scramble/555-rs/batch?count=N`,不再每人一發(以前會 2N 個呼叫)。"
            )}
          />
          <Arrow />
          <Step
            step={2}
            title={t('Edge:nginx 反代', 'Edge: nginx reverse proxy')}
            body={t(
              'api.cuberoot.me 由 nginx 反代到 Hono(127.0.0.1:3001)。SSE 端点带 `X-Accel-Buffering: no`,关掉 nginx 默认 proxy_buffering,scramble 一条流出就立刻下行。',
              'api.cuberoot.me is nginx-proxied to Hono (127.0.0.1:3001). The SSE endpoint sets `X-Accel-Buffering: no` to disable nginx\'s default proxy_buffering, so each scramble streams downstream as the solver produces it.', "api.cuberoot.me 由 nginx 反代到 Hono(127.0.0.1:3001)。SSE 端點帶 `X-Accel-Buffering: no`,關掉 nginx 預設 proxy_buffering,scramble 一條流出就立刻下行。"
            )}
          />
          <Arrow />
          <Step
            step={3}
            title={t('Hono:streamSSE → daemon', 'Hono: streamSSE → daemon')}
            body={t(
              'Hono 用 `streamSSE` 开 N 个并发 `getScramble()`;每个走 stdio 协议发 id 行给 Java daemon,daemon 内部 3-worker 线程池并行求解,解完按 id tab-separated 回 stdout。',
              'Hono uses `streamSSE` to open N concurrent `getScramble()` calls; each sends an id line over stdio to the Java daemon. The daemon\'s 3-worker thread pool solves in parallel, returning each result as a tab-separated id\\tscramble\\tstate line.', "Hono 用 `streamSSE` 開 N 個併發 `getScramble()`;每個走 stdio 協議發 id 行給 Java daemon,daemon 內部 3-worker 執行緒池並行求解,解完按 id tab-separated 回 stdout。"
            )}
          />
          <Arrow />
          <Step
            step={4}
            title={t('Daemon:cube555 native binary', 'Daemon: cube555 native binary')}
            body={t(
              '生产环境用 GraalVM `native-image --static --libc=musl` 编出的 ~18 MB 静态二进制(不依赖系统 glibc),`-Xmx512m`。3 worker 实测 12 条 batch ~14s wall(~1.5s / 条 × 4 轮)。',
              'Production runs a ~18 MB GraalVM `native-image --static --libc=musl` binary (no glibc dependency), `-Xmx512m`. With 3 workers: 12-scramble batch ≈ 14 s wall (~1.5 s/solve × 4 rounds).', "生產環境用 GraalVM `native-image --static --libc=musl` 編出的 ~18 MB 靜態二進位制(不依賴系統 glibc),`-Xmx512m`。3 worker 實測 12 條 batch ~14s wall(~1.5s / 條 × 4 輪)。"
            )}
            highlight
          />
        </div>
        <p className="s555-section-note">
          {t(
            '实测「切到随机状态 + 点 Generate(5/项)」冷击场景:17.6 s → 9.69 s(-45%),首条 4.7 s → 2.48 s(-47%)。完整 bench 在 ',
            'Real-world bench of the "switch to random-state + click Generate(5/event)" cold path: 17.6 s → 9.69 s (-45%), first-scramble 4.7 s → 2.48 s (-47%). Full numbers in ', "實測「切到隨機狀態 + 點 Generate(5/項)」冷擊場景:17.6 s → 9.69 s(-45%),首條 4.7 s → 2.48 s(-47%)。完整 bench 在 "
          )}
          <a href="https://github.com/RuiminYan/cuberoot.me/blob/main/core/cube555-daemon/BENCHMARKS.md" target="_blank" rel="noopener noreferrer">
            BENCHMARKS.md
          </a>
          {t('。', '.')}
        </p>

        {/* ──── 对比表 ──── */}
        <h2 className="s555-section-title">{t('一眼对比', 'At a glance', "一眼對比")}</h2>
        <div className="s555-table-wrap">
          <table className="s555-table">
            <thead>
              <tr>
                <th>{t('维度', 'Dimension', "維度")}</th>
                <th>{t('随机转动', 'Random-Move', "隨機轉動")}</th>
                <th>{t('随机状态', 'Random-State', "隨機狀態")}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th>{t('WCA 合规', 'WCA-compliant', "WCA 合規")}</th>
                <td>✓</td>
                <td>✗</td>
              </tr>
              <tr>
                <th>{t('序列长度', 'Length', "序列長度")}</th>
                <td>60</td>
                <td>~70</td>
              </tr>
              <tr>
                <th>{t('生成耗时', 'Generation time', "生成耗時")}</th>
                <td>{t('<1 毫秒', '<1 ms')}</td>
                <td>~1.5 s</td>
              </tr>
              <tr>
                <th>{t('计算位置', 'Where it runs', "計算位置")}</th>
                <td>{t('浏览器(本地)', 'browser (local)', "瀏覽器(本地)")}</td>
                <td>{t('服务器(daemon)', 'server (daemon)', "伺服器(daemon)")}</td>
              </tr>
              <tr>
                <th>{t('状态分布', 'State distribution', "狀態分佈")}</th>
                <td>{t('非均匀,偏短解', 'non-uniform, biased to easy solves', "非均勻,偏短解")}</td>
                <td>{t('均匀(uniform)', 'uniform', "均勻(uniform)")}</td>
              </tr>
              <tr>
                <th>{t('需要剪枝表?', 'Needs pruning tables?')}</th>
                <td>{t('无', 'none', "無")}</td>
                <td>~230 MB</td>
              </tr>
              <tr>
                <th>{t('依赖网络?', 'Needs network?', "依賴網路?")}</th>
                <td>{t('否', 'no')}</td>
                <td>{t('是(失败回落随机转动)', 'yes (fallback to random-move on failure)', "是(失敗回落隨機轉動)")}</td>
              </tr>
              <tr>
                <th>{t('实现复杂度', 'Implementation complexity', "實現複雜度")}</th>
                <td>{t('~50 行 TypeScript', '~50 lines of TypeScript')}</td>
                <td>{t('~20 个 Java 类,~5000 行', '~20 Java classes, ~5000 LoC', "~20 個 Java 類,~5000 行")}</td>
              </tr>
              <tr>
                <th>{t('适用场景', 'Use when', "適用場景")}</th>
                <td>{t('比赛、官方计时、离线训练', 'competition, official timing, offline practice', "比賽、官方計時、離線訓練")}</td>
                <td>{t('家庭训练、数据集采样、无偏 benchmark', 'home training, dataset sampling, unbiased benchmarks', "家庭訓練、資料集取樣、無偏 benchmark")}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ──── 资料 ──── */}
        <h2 className="s555-section-title">{t('参考资料', 'References', "參考資料")}</h2>
        <ul className="s555-refs">
          <li>
            <a href="https://github.com/cs0x7f/cube555" target="_blank" rel="noopener noreferrer">cs0x7f/cube555</a>
            {' — '}
            {t('5-phase reduction solver 上游(Java),本站 daemon 就是它的胶水', 'upstream 5-phase reduction solver (Java); our daemon wraps it', "5-phase reduction solver 上游(Java),本站 daemon 就是它的膠水")}
          </li>
          <li>
            <a href="https://github.com/cs0x7f/min2phase" target="_blank" rel="noopener noreferrer">cs0x7f/min2phase</a>
            {' — '}
            {t('cube555 Phase 5 用的 3×3 Kociemba two-phase 求解器', "cube555's Phase 5 driver — Kociemba two-phase for the residual 3×3")}
          </li>
          <li>
            <a href="https://www.worldcubeassociation.org/regulations/#article-4-scrambling" target="_blank" rel="noopener noreferrer">{t('WCA Regulation §4:Scrambling', 'WCA Regulation §4: Scrambling')}</a>
            {' — '}
            {t('为什么比赛用 60 步随机转动(§4d4)', 'why competitions use 60-move random-move (§4d4)', "為什麼比賽用 60 步隨機轉動(§4d4)")}
          </li>
          <li>
            <a href="https://www.cubing.net/cubing.js/" target="_blank" rel="noopener noreferrer">cubing.js</a>
            {' — '}
            {t('Lucas Garron 的浏览器端随机转动 / 随机状态生成器(2×2-4×4 是 random-state,5×5+ 是 random-move)', "Lucas Garron's in-browser random-move / random-state generators (random-state for 2×2-4×4, random-move for 5×5+)", "Lucas Garron 的瀏覽器端隨機轉動 / 隨機狀態生成器(2×2-4×4 是 random-state,5×5+ 是 random-move)")}
          </li>
          <li>
            <a href="https://kociemba.org/cube.htm" target="_blank" rel="noopener noreferrer">Herbert Kociemba — Cube Explorer</a>
            {' — '}
            {t('Two-phase algorithm 原始论文与实现,3×3 求解器的事实标准', 'Original paper + implementation of the two-phase algorithm — the de-facto 3×3 solver standard', "Two-phase algorithm 原始論文與實現,3×3 求解器的事實標準")}
          </li>
          <li>
            <a href="https://en.wikipedia.org/wiki/Iterative_deepening_A*" target="_blank" rel="noopener noreferrer">{t('IDA* 算法(维基百科)', 'IDA* algorithm (Wikipedia)', "IDA* 演算法(維基百科)")}</a>
            {' — '}
            {t('Korf 1985,cube555 每阶段搜索的内核', "Korf 1985 — the search kernel cube555 uses at every phase", "Korf 1985,cube555 每階段搜尋的核心")}
          </li>
          <li>
            <a href="https://github.com/RuiminYan/cuberoot.me/blob/main/core/cube555-daemon/BENCHMARKS.md" target="_blank" rel="noopener noreferrer">BENCHMARKS.md</a>
            {' — '}
            {t('本站 daemon 各阶段实测数据(JVM → batch SSE → GraalVM native → client cold-path 修复)', 'real-world numbers for our daemon (JVM → batch SSE → GraalVM native → client cold-path fix)', "本站 daemon 各階段實測資料(JVM → batch SSE → GraalVM native → client cold-path 修復)")}
          </li>
        </ul>
      </main>
    </div>
  );
}

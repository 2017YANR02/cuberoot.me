'use client';

// /regulation — WCA 竞赛规则精要的图文移植。
// 通用条款整理自官方《WCA Regulations》;末节「拼装缺陷判定」的全部配图 + 文字
// 移植自 WCA Regulations Committee 的《Regulation 5b5f Visual Guide》(见页脚 + /about credits)。
// 文案走 @/i18n/tr 的 <T>(zh/en;zh-Hant 由 build 注入回退 zh)。
// 硬数值(15s / 17s / 45° / 80 步 / 60min)为社区公认且经官方原文核验;条号只引 article 级。

import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Info, Ban } from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { EventIcon } from '@/components/EventIcon';
import { T, tr } from '@/i18n/tr';
import './regulation.css';

const SOURCE_URL = 'https://drive.google.com/file/d/15XszaCGNvy3Dk6X6qERzZWZaDH1RH04z';
const WCA_REG_FULL = 'https://www.worldcubeassociation.org/regulations/full/';
const WCA_REG_ZH = 'https://www.worldcubeassociation.org/regulations/translations/chinese/';
const WCA_REG_5B5F = 'https://www.worldcubeassociation.org/regulations/full/#5b5f';

/* ── 目录 ──────────────────────────────────────────── */
const TOC: { id: string; zh: string; en: string }[] = [
  { id: 'inspection', zh: '检查时间', en: 'Inspection'
},
  { id: 'scramble', zh: '打乱', en: 'Scrambling'
},
  { id: 'solved', zh: '判定还原', en: 'Solved state'
},
  { id: 'penalty', zh: '罚时', en: 'Penalties'
},
  { id: 'limit', zh: '时间上限', en: 'Time limits'
},
  { id: 'special', zh: '特殊项目', en: 'Special events'
},
  { id: 'puzzle', zh: '魔方要求', en: 'Puzzle rules' },
  { id: 'defects', zh: '拼装缺陷 5b5f', en: 'Defects 5b5f'
},
];

/* ── 项目名 ────────────────────────────────────────── */
const EV: Record<string, { zh: string; en: string }> = {
  '222': { zh: '二阶', en: '2×2×2'
},
  '333': { zh: '三阶', en: '3×3×3'
},
  '444': { zh: '四阶', en: '4×4×4'
},
  '555': { zh: '五阶', en: '5×5×5'
},
  '666': { zh: '六阶', en: '6×6×6'
},
  '777': { zh: '七阶', en: '7×7×7'
},
  pyram: { zh: '金字塔', en: 'Pyraminx' },
  skewb: { zh: '斜转', en: 'Skewb'
},
  sq1: { zh: 'Square-1', en: 'Square-1' },
  minx: { zh: '五魔方', en: 'Megaminx' },
  clock: { zh: '魔表', en: 'Clock'
},
  '333bf': { zh: '三阶盲拧', en: '3×3 Blindfolded'
},
  '333fm': { zh: '最少步', en: 'Fewest Moves' },
  '333mbf': { zh: '多盲', en: 'Multi-Blind' },
};

/* ── 打乱最少步数(随机状态项目)────────────────────── */
const SCRAMBLE_MIN: { ev: string; min: string }[] = [
  { ev: '222', min: '≥ 4' },
  { ev: 'pyram', min: '≥ 6' },
  { ev: 'skewb', min: '≥ 7' },
  { ev: 'sq1', min: '≥ 11' },
];
// 随机打乱步(非随机状态)的项目
const SCRAMBLE_RANDMOVE = ['555', '666', '777', 'minx'];

/* ── 错位限度(判定还原)──────────────────────────── */
const MISALIGN: { zh: string; en: string; limit: ReactNode }[] = [
  { zh: 'NxN 魔方(2–7 阶)', en: 'NxN cubes (2–7)', limit: '≤ 45°'
},
  { zh: '五魔方', en: 'Megaminx', limit: '≤ 36°' },
  { zh: '金字塔 / 斜转', en: 'Pyraminx / Skewb', limit: '≤ 60°'
},
  { zh: 'Square-1', en: 'Square-1', limit: <T zh="层 ≤ 45°,中层 ≤ 90°" en="layers ≤ 45°, slash ≤ 90°" /> },
];

/* ── 罚时触发 ──────────────────────────────────────── */
const PLUS2: { zh: string; en: string }[] = [
  { zh: '检查超过 15 秒,但未超过 17 秒', en: 'Inspection over 15 s but not over 17 s'
},
  { zh: '结束时恰好一处相邻层错位超过限度(差一步还原)', en: 'Exactly one pair of adjacent layers misaligned past the limit (one move from solved)'
},
  { zh: '与开始计时相关的轻微违规(由裁判 / 代表裁量)', en: 'Minor faults around starting the timer (at judge / Delegate discretion)'
},
];
const DNFS: { zh: string; en: string }[] = [
  { zh: '检查超过 17 秒', en: 'Inspection over 17 s'
},
  { zh: '结束时超过一步未还原,或根本没有还原', en: 'More than one move from solved at the end, or simply not solved'
},
  { zh: '计时停止后又转动了魔方', en: 'Applying a move after the timer has stopped'
},
  { zh: '比赛中掉块 / 解体,且无法在不增加还原步数的前提下复原', en: 'A pop that cannot be fixed without adding a move to the solution'
},
  { zh: '盲拧项目中睁眼偷看魔方', en: 'Looking at the puzzle during a blindfolded attempt'
},
  { zh: '未按规程把手放平、正确开始或停止计时', en: 'Failing to start / stop the timer per the procedure (hands flat, palms down)'
},
  { zh: '超过该轮时间上限仍未完成', en: 'Exceeding the round time limit without finishing'
},
];

/* ── 5b5f 实例(沿用原 Visual Guide)────────────────── */
type Verdict = 'solved' | 'dnf' | 'plus2' | 'delegate';

const VERDICT: Record<Verdict, { cls: string; zh: string; en: string }> = {
  solved: { cls: 'v-solved', zh: '判定成功', en: 'Solved' },
  dnf: { cls: 'v-dnf', zh: 'DNF', en: 'DNF' },
  plus2: { cls: 'v-plus2', zh: '+2 罚秒', en: '+2'
},
  delegate: { cls: 'v-delegate', zh: '代表裁量', en: 'Delegate discretion' },
};

interface Ex { n: number; img: string; verdict: Verdict; zh: string; en: string; }

const EXAMPLES: Ex[] = [
  {
    n: 1, img: 'example-1', verdict: 'solved',
    zh: `这块 wing 唯一能正常装回的位置,就是它还原后的位置。4×4 的结构不允许这块片在原位翻转,所以那个「翻转」状态不是需要考虑的有效位置。`,
    en: `The only place where the piece would normally fit is the place where the piece is solved. A 4×4 mechanism does not allow the wing to be twisted on its spot, so that is not a valid position to consider.`
},
  {
    n: 2, img: 'example-2', verdict: 'solved',
    zh: `按 5b6 对「部件」的定义,这里有 3 个部件部分脱出。但它们都更靠近各自的还原位置,因此没有任何块被视为受影响。`,
    en: `Given the definition of "part" in Regulation 5b6, here we have 3 parts partially detached. However, all of them are closer to their solved place. Therefore, no pieces are considered to be affected.`
},
  {
    n: 3, img: 'example-3', verdict: 'delegate',
    zh: `最近的有效位置,要么是还原状态,要么是「角块翻转」状态。代表需要仔细判断:当前状态更接近哪一个。`,
    en: `The closest valid position is either the solved state, or the "corner twist" state. The Delegate should carefully evaluate which state is the closest to the current one.`
},
  {
    n: 4, img: 'example-4', verdict: 'solved',
    zh: `这个角块唯一能放进去的有效位置就是正确位置;而且它的朝向看起来更接近还原朝向。`,
    en: `The only valid place available for the corner is the correct one. The orientation of the piece seems to be closer to the solved orientation.`
},
  {
    n: 5, img: 'example-5', verdict: 'dnf',
    zh: `这个角块唯一能放进去的有效位置是正确位置;但无论如何,它的朝向都不能让该块算作还原。`,
    en: `The only valid place available for the corner is the correct one. However, the orientation of the piece does not render the piece solved in any case.`
},
  {
    n: 6, img: 'example-6', verdict: 'dnf',
    zh: `棘手的边界情况。左侧那块蓝色中心片占据了黄色中心片的位置(黄色块此时离正确位置很远)。由于黄色块已部分脱出,它最近的有效位置落在蓝色面上 —— 于是最终状态有两块未还原。`,
    en: `Difficult edge case. The blue center piece at the left seems to be taking the space of the yellow center piece (which is now far from its correct place). Considering that the yellow one is now partially detached, the closest valid spot for it is in the blue face. This leads to a final state with two unsolved pieces.`
},
  {
    n: 7, img: 'example-7', verdict: 'plus2',
    zh: `多块受影响,但它们都更靠近各自的正确位置。该魔方算还原,但带一个错位(misalignment)罚秒。`,
    en: `Several pieces affected, but all of them are closer to their correct place. The puzzle is solved with a misalignment penalty.`
},
  {
    n: 8, img: 'example-8', verdict: 'solved',
    zh: `尽管这块看起来更靠近红框标出的位置,但它在那里无法正常装入(结构不允许)。因此最近的有效位置仍是正确位置。`,
    en: `Although the piece may be closer to the red square's position, the affected piece does not normally fit in such position (the mechanism does not allow it). Therefore, the closest valid position is the correct one.`
},
  {
    n: 9, img: 'example-9', verdict: 'dnf',
    zh: `依据 5b5d,此情况判 DNF —— 因为缺失了红绿棱块。`,
    en: `This case is DNF as per Regulation 5b5d, because of the missing red-green edge piece.`
},
  {
    n: 10, img: 'example-10', verdict: 'dnf',
    zh: `与实例 1 相反,这里的「翻转」位置在结构上是有效的。因此最近的有效位置并不能让该块算作还原。`,
    en: `As opposed to Example 1, the "twisted" position is valid in terms of mechanism. For this reason, the closest valid position does not render the piece solved.`
},
  {
    n: 11, img: 'example-11', verdict: 'solved',
    zh: `相对中心块 A,块 1 几乎完全到位;相对中心块 B,块 3 完全到位。由于 1 和 3 比 2「更到位」,2 唯一可用的有效位置就是正确位置。2 的朝向没有问题,因为它的黄色面大体朝向黄色面。`,
    en: `1 is almost fully placed relative to center A, and 3 is fully placed relative to center B. Given that 1 and 3 are "more placed" than 2, the only valid available position for 2 is the correct one. The orientation of 2 is not a problem because the yellow side of the piece is mostly facing towards the yellow face.`
},
];

const CONSIDERATIONS: { zh: string; en: string }[] = [
  {
    zh: `完全脱落的块由 5b5a、5b5b、5b5c、5b5d 处理。`,
    en: `Pieces completely detached are covered by 5b5a, 5b5b, 5b5c and 5b5d.`
},
  {
    zh: `这套措辞旨在贴合通常的直觉:「块离它该在的地方足够近,就算还原」。`,
    en: `This wording aims to follow the usual intuition: "If the piece is near to where it should be, the piece is solved".`
},
  {
    zh: `块的最终状态,取决于魔方当前的整体状态。`,
    en: `The final state of the piece depends on the current state of the puzzle.`
},
  {
    zh: `确定最终位置之后,需要据此位置与朝向来判断魔方是否还原。`,
    en: `Once the final position has been determined, that position and orientation needs to be judged in order to know if the puzzle is either solved or not.`
},
  {
    zh: `个别情况可能需要由代表(Delegate)裁定 —— 就像接近临界的 +2 错位一样。`,
    en: `Some particular cases may need to be judged by a Delegate (just like a close +2 misalignment).`
},
];

/* ── 检查时间轴 ────────────────────────────────────── */
function InspectionTimeline() {
  const scale = 19; // 0..19s,17 落在 ~89%
  const pct = (s: number) => `${((s / scale) * 100).toFixed(1)}%`;
  const ticks = [8, 12, 15, 17];
  return (
    <figure className="reg-timeline">
      <div className="reg-timeline-track">
        {ticks.map((s) => (
          <span key={s} className="reg-timeline-tick" style={{ left: pct(s) }} />
        ))}
      </div>
      <div className="reg-timeline-axis">
        {ticks.map((s) => (
          <span key={s} className="reg-timeline-num" style={{ left: pct(s) }}>{s}s</span>
        ))}
      </div>
      <ul className="reg-timeline-legend">
        <li className="ok"><T zh="0–15 秒 正常检查" en="0–15 s — normal inspection" /></li>
        <li className="tick"><T zh="8 / 12 秒 裁判报时提醒" en="8 / 12 s — judge calls the time" /></li>
        <li className="warn"><T zh="15–17 秒 → +2 罚秒" en="15–17 s → +2 penalty" /></li>
        <li className="bad"><T zh="超过 17 秒 → DNF" en="over 17 s → DNF" /></li>
      </ul>
    </figure>
  );
}

/* ── 错位角度图 ────────────────────────────────────── */
function AngleFigure({ deg, tone, cap }: { deg: number; tone: 'ok' | 'warn'; cap: ReactNode }) {
  const cx = 50, cy = 50, r = 23;
  const rad = (deg - 90) * Math.PI / 180;
  const ex = (cx + r * Math.cos(rad)).toFixed(2);
  const ey = (cy + r * Math.sin(rad)).toFixed(2);
  const large = deg > 180 ? 1 : 0;
  return (
    <figure className={`reg-angle reg-angle-${tone}`}>
      <svg viewBox="0 0 100 100" className="reg-angle-svg" aria-hidden="true">
        <rect x="22" y="22" width="56" height="56" rx="8" className="reg-angle-target" />
        <g transform={`rotate(${deg} 50 50)`}>
          <rect x="22" y="22" width="56" height="56" rx="8" className="reg-angle-cur" />
        </g>
        <path d={`M ${cx} ${cy - r} A ${r} ${r} 0 ${large} 1 ${ex} ${ey}`} className="reg-angle-arc" />
        <text x="50" y="55" className="reg-angle-deg">{deg}°</text>
      </svg>
      <figcaption className="reg-angle-cap">{cap}</figcaption>
    </figure>
  );
}

export default function RegulationPage() {
  useTranslation(); // subscribe to language toggle so tr() alt strings re-evaluate

  useDocumentTitle('WCA 规则精要:检查 · 打乱 · 判定 · 罚时', 'WCA Regulations Essentials', 'WCA 規則精要:檢查 · 打亂 · 判定 · 罰時');

  return (
    <div className="reg-page">
      <div className="reg-wrap">

        {/* ── Hero ── */}
        <header className="reg-hero">
          <div className="reg-eyebrow">
            <img src="/icons/wca.svg" alt="WCA" />
            <T zh="WCA 竞赛规则 · 图解" en="WCA Regulations · Illustrated" zhHant="WCA 競賽規則 · 圖解" />
          </div>
          <h1 className="reg-title">
            <T zh={<>WCA <span className="reg-code">规则精要</span></>} en={<>WCA <span className="reg-code">Regulations</span></>} zhHant={<>WCA <span className="reg-code">規則精要</span></>} />
          </h1>
          <p className="reg-subtitle">
            <T zh="检查、打乱、判定、罚时 —— 每个选手该知道的核心条款,用图说清楚" en="Inspection, scrambling, judging, penalties — the core regulations every competitor should know, made visual" zhHant="檢查、打亂、判定、罰時 —— 每個選手該知道的核心條款,用圖說清楚" />
          </p>
          <p className="reg-lede">
            <T
              zh="这一页把 WCA《竞赛规则》里最常被问到的部分挑出来,配上图和实例:15 秒检查、随机状态打乱、45° 错位临界、+2 与 DNF 的界线。最后一节是官方《5b5f 可视化指南》的完整图文移植 —— 用 11 个真实案例讲透「拼装缺陷怎么判」。"
              en="This page pulls the most frequently asked parts out of the WCA Regulations and pairs them with diagrams and real cases: the 15-second inspection, random-state scrambles, the 45° misalignment threshold, and the line between +2 and DNF. The final section is a full illustrated port of the official 5b5f Visual Guide — 11 real cases that nail down how assembly defects are judged."
              zhHant="這一頁把 WCA《競賽規則》裡最常被問到的部分挑出來,配上圖和實例:15 秒檢查、隨機狀態打亂、45° 錯位臨界、+2 與 DNF 的界線。最後一節是官方《5b5f 視覺化指南》的完整圖文移植 —— 用 11 個真實案例講透「拼裝缺陷怎麼判」。"
            />
          </p>
          <nav className="reg-toc" aria-label="目录">
            {TOC.map((t) => (
              <a key={t.id} href={`#${t.id}`}><T zh={t.zh} en={t.en} /></a>
            ))}
          </nav>
        </header>

        {/* ── 检查时间 ── */}
        <section className="reg-sec" id="inspection">
          <div className="reg-sec-eyebrow"><T zh="检查 · Article A3" en="Inspection · Article A3" zhHant="檢查 · Article A3" /></div>
          <h2 className="reg-sec-title"><T zh="15 秒检查,过线就罚" en="15 seconds to inspect, then it costs you" zhHant="15 秒檢查,過線就罰" /></h2>
          <p className="reg-sec-lede">
            <T
              zh="拿到打乱好的魔方,你有 15 秒检查(可拿起、翻看,但不能转动)。计时从你示意准备开始走,裁判会在第 8、12 秒口头报时提醒。"
              en="Once you pick up the scrambled puzzle, you get 15 seconds to inspect it (you may pick it up and rotate it in your hands, but not turn any layers). Inspection starts when you signal you are ready; the judge calls out at 8 and 12 seconds."
              zhHant="拿到打亂好的魔方,你有 15 秒檢查(可拿起、翻看,但不能轉動)。計時從你示意準備開始走,裁判會在第 8、12 秒口頭報時提醒。"
            />
          </p>

          <InspectionTimeline />

          <div className="reg-key" style={{ marginTop: 34 }}>
            <div className="reg-key-label">
              <Info size={17} />
              <T zh="开始之前" en="Before you start" zhHant="開始之前" />
            </div>
            <p className="reg-key-text">
              <T
                zh="开始计时前,双手要平放在计时器上、掌心向下;魔方平稳静置在垫子上。手离开计时器,solve 即开始,计时同步启动。检查期间不得转动任何层。"
                en="Before starting, place both hands flat on the timer with palms down; the puzzle rests still on the mat. The solve begins the moment your hands leave the timer. You may not turn any layer during inspection."
                zhHant="開始計時前,雙手要平放在計時器上、掌心向下;魔方平穩靜置在墊子上。手離開計時器,solve 即開始,計時同步啟動。檢查期間不得轉動任何層。"
              />
            </p>
          </div>
        </section>

        {/* ── 打乱 ── */}
        <section className="reg-sec" id="scramble">
          <div className="reg-sec-eyebrow"><T zh="打乱 · Article 4" en="Scrambling · Article 4" zhHant="打亂 · Article 4" /></div>
          <h2 className="reg-sec-title"><T zh="打乱是「随机状态」,不是随手转" en="Scrambles are random-state, not hand-mixed" zhHant="打亂是「隨機狀態」,不是隨手轉" /></h2>
          <p className="reg-sec-lede">
            <T
              zh="所有打乱都由官方打乱程序(TNoodle)生成:对大多数项目,它先随机抽一个合法状态,再算出一条把魔方从还原态带到该状态的序列。同一轮里,所有选手用完全相同的打乱,确保公平。"
              en="Every scramble is produced by the official program (TNoodle): for most events it first picks a random legal state, then computes a sequence that takes a solved puzzle into that state. Within a round, every competitor gets the exact same scrambles — that's what keeps it fair."
              zhHant="所有打亂都由官方打亂程式(TNoodle)生成:對大多數項目,它先隨機抽一個合法狀態,再算出一條把魔方從還原態帶到該狀態的序列。同一輪裡,所有選手用完全相同的打亂,確保公平。"
            />
          </p>

          <p className="reg-sec-lede" style={{ marginTop: 4 }}>
            <T zh="规则还要求打乱「不能太简单」—— 随机状态距离还原至少要有这么多步:" en="The regulations also require scrambles not to be too easy — the random state must be at least this far from solved:" zhHant="規則還要求打亂「不能太簡單」—— 隨機狀態距離還原至少要有這麼多步:" />
          </p>

          <table className="reg-table">
            <thead>
              <tr>
                <th><T zh="项目" en="Event" /></th>
                <th><T zh="最少步数" en="Min. moves" /></th>
              </tr>
            </thead>
            <tbody>
              {SCRAMBLE_MIN.map((r) => (
                <tr key={r.ev}>
                  <td><span className="reg-evt"><EventIcon event={r.ev} /><T zh={EV[r.ev].zh} en={EV[r.ev].en} /></span></td>
                  <td><span className="reg-num">{r.min}</span></td>
                </tr>
              ))}
              <tr>
                <td><span className="reg-evt-text"><T zh="其余随机状态项目(三阶 / 四阶 / 魔表…)" en="Other random-state events (3×3 / 4×4 / Clock…)" /></span></td>
                <td><span className="reg-num">≥ 2</span></td>
              </tr>
            </tbody>
          </table>

          <p className="reg-sec-lede" style={{ marginTop: 28 }}>
            <T
              zh="少数项目随机状态计算量过大,改用「足够多的随机转动步」打乱:"
              en="A few events are too expensive to scramble by random state, so they use sufficiently many random moves instead:"
              zhHant="少數項目隨機狀態計算量過大,改用「足夠多的隨機轉動步」打亂:"
            />
          </p>
          <div className="reg-evt-chips">
            {SCRAMBLE_RANDMOVE.map((ev) => (
              <span className="reg-evt-chip" key={ev}>
                <EventIcon event={ev} /><T zh={EV[ev].zh} en={EV[ev].en} />
              </span>
            ))}
          </div>
          <p className="reg-foot-note">
            <T zh="每条打乱从首次施加起,通常应在 2 小时内用完,以防被提前研究。" en="Each scramble should normally be used up within 2 hours of first being applied, to prevent it being studied in advance." zhHant="每條打亂從首次施加起,通常應在 2 小時內用完,以防被提前研究。" />
          </p>
        </section>

        {/* ── 判定还原 ── */}
        <section className="reg-sec" id="solved">
          <div className="reg-sec-eyebrow"><T zh="判定还原 · Article 10" en="Solved state · Article 10" zhHant="判定還原 · Article 10" /></div>
          <h2 className="reg-sec-title"><T zh="还原与否,只看停表那一刻" en="Only the moment you stop the timer counts" zhHant="還原與否,只看停錶那一刻" /></h2>
          <p className="reg-sec-lede">
            <T
              zh="判定只看停表后魔方的静止状态。关键不是「转回去要几下」的直觉,而是相邻层之间错开了多少角度。对三阶等 NxN 魔方,临界是 45°。"
              en="Judging looks only at the resting state after the timer stops. What matters isn't a vague 'how many turns to fix it', but how far adjacent layers are rotated apart. For NxN cubes like the 3×3, the threshold is 45°."
              zhHant="判定只看停錶後魔方的靜止狀態。關鍵不是「轉回去要幾下」的直覺,而是相鄰層之間錯開了多少角度。對三階等 NxN 魔方,臨界是 45°。"
            />
          </p>

          <div className="reg-angle-row">
            <AngleFigure deg={30} tone="ok" cap={<T zh="错位 ≤ 45° · 判定还原,不罚" en="≤ 45° off · solved, no penalty" />} />
            <AngleFigure deg={62} tone="warn" cap={<T zh="错位 > 45° · 差一步 → +2" en="> 45° off · one move away → +2" />} />
          </div>

          <ul className="reg-list" style={{ marginTop: 30 }}>
            <li><T zh="所有相邻层错位都在限度内 → 算还原,不罚秒。" en="All adjacent layers within the limit → solved, no penalty." /></li>
            <li><T zh="恰好一处错位超过限度(差一步)→ 还原,但 +2。" en="Exactly one misalignment past the limit (one move away) → solved, but +2." /></li>
            <li><T zh="超过一处 → 判 DNF。" en="More than one → DNF." /></li>
          </ul>

          <p className="reg-sec-lede" style={{ marginTop: 30 }}>
            <T zh="不同魔方的错位限度不一样:" en="The misalignment limit differs by puzzle:" zhHant="不同魔方的錯位限度不一樣:" />
          </p>
          <table className="reg-table">
            <thead>
              <tr>
                <th><T zh="魔方" en="Puzzle" /></th>
                <th><T zh="单处错位限度" en="Per-misalignment limit" /></th>
              </tr>
            </thead>
            <tbody>
              {MISALIGN.map((m, i) => (
                <tr key={i}>
                  <td><T zh={m.zh} en={m.en} /></td>
                  <td><span className="reg-num">{m.limit}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* ── 罚时 ── */}
        <section className="reg-sec" id="penalty">
          <div className="reg-sec-eyebrow"><T zh="罚时 · Article 10 / A" en="Penalties · Article 10 / A" zhHant="罰時 · Article 10 / A" /></div>
          <h2 className="reg-sec-title"><T zh="+2 与 DNF 的界线" en="The line between +2 and DNF" zhHant="+2 與 DNF 的界線" /></h2>
          <p className="reg-sec-lede">
            <T
              zh="WCA 只有两种处罚:轻微问题加 2 秒(+2),严重问题判该把无效(DNF,记为不计成绩)。下面是最常见的触发情形。"
              en="WCA has just two penalties: a +2 seconds for minor issues, and a DNF (Did Not Finish) that voids the attempt for serious ones. Here are the most common triggers."
              zhHant="WCA 只有兩種處罰:輕微問題加 2 秒(+2),嚴重問題判該把無效(DNF,記為不計成績)。下面是最常見的觸發情形。"
            />
          </p>

          <div className="reg-pen-grid">
            <div className="reg-pen-card plus2">
              <div className="reg-pen-head">
                <span className="reg-pen-badge">+2</span>
                <T zh="加 2 秒" en="Plus two" zhHant="加 2 秒" />
              </div>
              <ul className="reg-pen-list">
                {PLUS2.map((p, i) => <li key={i}><T zh={p.zh} en={p.en} /></li>)}
              </ul>
            </div>
            <div className="reg-pen-card dnf">
              <div className="reg-pen-head">
                <Ban size={20} />
                <T zh="DNF · 该把无效" en="DNF · attempt void" zhHant="DNF · 該把無效" />
              </div>
              <ul className="reg-pen-list">
                {DNFS.map((p, i) => <li key={i}><T zh={p.zh} en={p.en} /></li>)}
              </ul>
            </div>
          </div>
        </section>

        {/* ── 时间上限 ── */}
        <section className="reg-sec" id="limit">
          <div className="reg-sec-eyebrow"><T zh="时间上限 · Article A1 / 9" en="Time limits · Article A1 / 9" zhHant="時間上限 · Article A1 / 9" /></div>
          <h2 className="reg-sec-title"><T zh="时间上限与晋级线" en="Time limits and cutoffs" zhHant="時間上限與晉級線" /></h2>
          <ul className="reg-list">
            <li><T zh="每轮都有时间上限(常见上限 10 分钟,主办方可按项目调整);单把超时未完成 → DNF。" en="Every round has a time limit (commonly up to 10 minutes, adjustable per event by the organizers); exceeding it without finishing → DNF." /></li>
            <li><T zh="累计时间上限:主办方可设「一轮 N 把合计不超过 X 分钟」,超出后续把数全判 DNF。" en="Cumulative limit: organizers may set 'N attempts must total under X minutes'; once exceeded, remaining attempts are DNF." /></li>
            <li><T zh="晋级线(cutoff):如「Best of 2,2 分钟」—— 前两把里没有一把快过 2 分钟,就不再打剩下的把数。" en="Cutoff: e.g. 'Best of 2, 2:00' — if neither of the first attempts beats 2 minutes, you don't get the remaining attempts." /></li>
            <li><T zh="低于 10 分钟的成绩记到百分之一秒;10 分钟及以上记到整秒。" en="Results under 10 minutes are recorded to the hundredth of a second; 10 minutes and over, to the whole second." /></li>
          </ul>
        </section>

        {/* ── 特殊项目 ── */}
        <section className="reg-sec" id="special">
          <div className="reg-sec-eyebrow"><T zh="特殊项目 · Article B / E" en="Special events · Article B / E" zhHant="特殊項目 · Article B / E" /></div>
          <h2 className="reg-sec-title"><T zh="盲拧、多盲、最少步" en="Blindfolded, Multi-Blind, Fewest Moves" zhHant="盲擰、多盲、最少步" /></h2>
          <div className="reg-cards">
            <div className="reg-card">
              <div className="reg-card-head">
                <EventIcon event="333bf" className="reg-card-icon" />
                <div>
                  <div className="reg-card-title"><T zh="盲拧" en="Blindfolded" zhHant="盲擰" /></div>
                  <div className="reg-card-sub">3BLD · 4BLD · 5BLD</div>
                </div>
              </div>
              <p>
                <T
                  zh="计时包含记忆。看清后戴上眼罩,全程不得再看魔方;一旦睁眼或偷看即判 DNF。成绩取一组里最快的成功一把。"
                  en="The timer includes memorization. Once you've seen it you put on the blindfold and may never look at the puzzle again; peeking is an instant DNF. Your result is the fastest successful attempt in the group."
                  zhHant="計時包含記憶。看清後戴上眼罩,全程不得再看魔方;一旦睜眼或偷看即判 DNF。成績取一組裡最快的成功一把。"
                />
              </p>
            </div>
            <div className="reg-card">
              <div className="reg-card-head">
                <EventIcon event="333mbf" className="reg-card-icon" />
                <div>
                  <div className="reg-card-title"><T zh="多盲" en="Multi-Blind" zhHant="多盲" /></div>
                  <div className="reg-card-sub">3×3 MBLD</div>
                </div>
              </div>
              <p>
                <T
                  zh="一次记忆并蒙眼还原多个三阶,总时限最长 1 小时。排名先看「还原数 − 未还原数」,同分再比用时。"
                  en="Memorize and solve several 3×3s blindfolded in one sitting, up to a 1-hour limit. Ranked first by (solved − unsolved), then by time as a tiebreaker."
                  zhHant="一次記憶並蒙眼還原多個三階,總時限最長 1 小時。排名先看「還原數 − 未還原數」,同分再比用時。"
                />
              </p>
            </div>
            <div className="reg-card">
              <div className="reg-card-head">
                <EventIcon event="333fm" className="reg-card-icon" />
                <div>
                  <div className="reg-card-title"><T zh="最少步" en="Fewest Moves" zhHant="最少步" /></div>
                  <div className="reg-card-sub">3×3 FMC</div>
                </div>
              </div>
              <p>
                <T
                  zh="60 分钟内用纸笔写出一条还原给定打乱的转动序列。解法不得超过 80 步(WCA 记号),超出不计;通常一轮 3 把,取平均。"
                  en="In 60 minutes, write down (on paper) a sequence that solves the given scramble. A solution may be at most 80 moves (WCA notation); longer is not accepted. A round is usually 3 attempts, scored by mean."
                  zhHant="60 分鐘內用紙筆寫出一條還原給定打亂的轉動序列。解法不得超過 80 步(WCA 記號),超出不計;通常一輪 3 把,取平均。"
                />
              </p>
            </div>
          </div>
        </section>

        {/* ── 魔方要求 ── */}
        <section className="reg-sec" id="puzzle">
          <div className="reg-sec-eyebrow"><T zh="魔方要求 · Article 3" en="Puzzle rules · Article 3" zhHant="魔方要求 · Article 3" /></div>
          <h2 className="reg-sec-title"><T zh="什么样的魔方能上场" en="What puzzle you may use" zhHant="什麼樣的魔方能上場" /></h2>
          <ul className="reg-list">
            <li><T zh="配色:每面一种纯色,六个颜色互相清晰可辨;不得使用会混淆的相近色或图案面。" en="Colours: one solid colour per face, all clearly distinct from one another; no confusingly similar shades or patterned faces." /></li>
            <li><T zh="Logo / 标记:最多允许一处带 logo 的色块;4 盲、5 盲、多盲不得有任何 logo 或可借以定位的标记。" en="Logos / markings: at most one coloured part may carry a logo; 4BLD, 5BLD and Multi-Blind may not have any logo or orientation marking." /></li>
            <li><T zh="改装:允许内部打磨、润滑、加磁等以提升稳定性 / 手感的调整;但禁止改变魔方基本玩法概念的改装。" en="Modifications: internal sanding, lubrication and magnets that improve stability/feel are allowed; modifications that change the puzzle's basic concept are not." /></li>
          </ul>
        </section>

        {/* ════════ 深入:5b5f 拼装缺陷 ════════ */}
        <section className="reg-sec reg-sec-major" id="defects">
          <div className="reg-sec-eyebrow"><T zh="深入 · Visual Guide" en="Deep dive · Visual Guide" zhHant="深入 · Visual Guide" /></div>
          <h2 className="reg-sec-title"><T zh="规则 5b5f:拼装缺陷怎么判" en="Regulation 5b5f: judging assembly defects" zhHant="規則 5b5f:拼裝缺陷怎麼判" /></h2>
          <p className="reg-sec-lede">
            <T
              zh="还原结束时,如果有块没完全卡到位,它到底算在哪个位置?5b5f 给出了判定原则,下面这份官方可视化指南用 11 个真实案例把它讲清楚 —— 每个案例标出最终判定(成功 / +2 / DNF / 代表裁量)。"
              en="When a solve ends with a piece not fully seated, where does it count as being? Regulation 5b5f gives the principle, and this official visual guide makes it concrete with 11 real cases — each labelled with its verdict (Solved / +2 / DNF / Delegate discretion)."
              zhHant="還原結束時,如果有塊沒完全卡到位,它到底算在哪個位置?5b5f 給出了判定原則,下面這份官方視覺化指南用 11 個真實案例把它講清楚 —— 每個案例標出最終判定(成功 / +2 / DNF / 代表裁量)。"
            />
          </p>

          <div className="reg-quote" style={{ marginTop: 26 }}>
            <span className="reg-quote-num">5b5</span>
            <p className="reg-quote-text">
              <T
                zh="“如果在还原结束时,魔方的某些部件物理脱离或未完全到位,则适用以下规定(……)”"
                en={`"If some parts of the puzzle are physically detached or not fully placed at the end of the solve, the following regulations apply (…)"`}
                zhHant="「如果在還原結束時,魔方的某些部件物理脫離或未完全到位,則適用以下規定(……)」"
              />
            </p>
          </div>
          <div className="reg-quote">
            <span className="reg-quote-num">5b5f</span>
            <p className="reg-quote-text">
              <T
                zh="“如果某块部分脱出或未完全到位,它的最终位置是:在魔方当前状态下,该块能在结构中正常装入的最近位置。如果这个最终位置使该块处于还原状态,则该块不算受魔方缺陷影响。”"
                en={`"If a piece is partially detached or not fully placed, its final position is the closest position in which the affected piece would normally fit within the puzzle mechanism, considering the current state of the puzzle. If the final position renders the piece solved, the piece is not considered to be affected by the puzzle defect."`}
                zhHant="「如果某塊部分脫出或未完全到位,它的最終位置是:在魔方當前狀態下,該塊能在結構中正常裝入的最近位置。如果這個最終位置使該塊處於還原狀態,則該塊不算受魔方缺陷影響。」"
              />
            </p>
          </div>

          <div className="reg-key" style={{ marginTop: 30 }}>
            <div className="reg-key-label">
              <Info size={17} />
              <T zh="一句话原则" en="The principle, in one line" zhHant="一句話原則" />
            </div>
            <p className="reg-key-text">
              <T
                zh="块的最终位置,是在魔方当前状态下、它能在结构中正常装入的最近位置。换句话说:把一块放到某位置后,如果魔方仍能正常操作(不一定能还原)而没有问题,那这个位置就是「有效」的。"
                en="The final position of the piece is the closest position in which it would normally fit within the puzzle mechanism, considering the current state of the puzzle. In other words: a position is valid if it is possible to operate (not necessarily solve) the puzzle without issues, when the piece is placed in such position."
                zhHant="塊的最終位置,是在魔方當前狀態下、它能在結構中正常裝入的最近位置。換句話說:把一塊放到某位置後,如果魔方仍能正常操作(不一定能還原)而沒有問題,那這個位置就是「有效」的。"
              />
            </p>
          </div>

          {/* Considerations */}
          <h3 className="reg-sub-title"><T zh="几个前提" en="Things to keep in mind" zhHant="幾個前提" /></h3>
          <ul className="reg-list">
            {CONSIDERATIONS.map((c, i) => (
              <li key={i}><T zh={c.zh} en={c.en} /></li>
            ))}
          </ul>

          {/* Examples */}
          <h3 className="reg-sub-title"><T zh="11 个真实案例" en="11 real cases" zhHant="11 個真實案例" /></h3>
          <p className="reg-sec-lede" style={{ marginTop: -8 }}>
            <T
              zh="每张图都是比赛或实物中真实出现过的状态。先想想你会怎么判,再看右侧的判定与理由。"
              en="Each photo is a state that actually showed up on a real puzzle. Try to call it yourself first, then read the verdict and the reasoning."
              zhHant="每張圖都是比賽或實物中真實出現過的狀態。先想想你會怎麼判,再看右側的判定與理由。"
            />
          </p>
          <div className="reg-examples">
            {EXAMPLES.map((ex) => {
              const v = VERDICT[ex.verdict];
              return (
                <article className="reg-ex" key={ex.n}>
                  <div className="reg-ex-media">
                    <img
                      className="reg-ex-img"
                      src={`/images/regulation/${ex.img}.jpg`}
                      alt={tr({ zh: `实例 ${ex.n}`, en: `Example ${ex.n}` })}
                      loading="lazy"
                      width={1341}
                      height={1500}
                    />
                  </div>
                  <div className="reg-ex-body">
                    <div className="reg-ex-n"><T zh={`实例 ${ex.n}`} en={`Example ${ex.n}`} zhHant={`實例 ${ex.n}`} /></div>
                    <span className={`reg-ex-verdict ${v.cls}`}>
                      <T zh={v.zh} en={v.en} />
                    </span>
                    <p className="reg-ex-text"><T zh={ex.zh} en={ex.en} /></p>
                  </div>
                </article>
              );
            })}
          </div>

          {/* Explanation */}
          <h3 className="reg-sub-title"><T zh="为什么 4×4 算还原,3×3 不算?" en="Why is the 4×4 solved, but the 3×3 not?" zhHant="為什麼 4×4 算還原,3×3 不算?" /></h3>
          <div className="reg-explain">
            <div className="reg-explain-text">
              <p>
                <T
                  zh="如你所见,前面那块翻转的 4×4 wing 被判还原,而结构相似的 3×3 角块却不算。差别在哪?"
                  en="As you have seen, the 4×4 is considered solved, but the 3×3 is not. But why?"
                  zhHant="如你所見,前面那塊翻轉的 4×4 wing 被判還原,而結構相似的 3×3 角塊卻不算。差別在哪?"
                />
              </p>
              <p>
                <T
                  zh="原因很简单:从 4×4 上取下一块棱(比如橙蓝棱中的一块),再试着把它上下颠倒装回去。你会发现结构根本不允许 —— 这不是需要考虑的有效位置。"
                  en="The reason is simple: remove one edge piece from a 4×4 puzzle (i.e. one of the orange-blue edge pieces). Now try to put it back in the puzzle, but upside down. As you can see, the mechanism does not allow that. It is not a valid position to consider."
                  zhHant="原因很簡單:從 4×4 上取下一塊稜(比如橙藍稜中的一塊),再試著把它上下顛倒裝回去。你會發現結構根本不允許 —— 這不是需要考慮的有效位置。"
                />
              </p>
              <p>
                <T
                  zh="换成 3×3 的棱块做同样的实验:你会得到一个不可能的状态,但这块确实能装进那个位置。既然位置有效,它就可能是最终位置(而根据朝向,结果是一个未还原的魔方,DNF)。"
                  en="Try the same experiment, but with a 3×3 edge piece. You will get an impossible state, but the piece fits in such position. As it is a valid position, it may be the final one (and the result, given the orientation, is an unsolved puzzle — DNF)."
                  zhHant="換成 3×3 的稜塊做同樣的實驗:你會得到一個不可能的狀態,但這塊確實能裝進那個位置。既然位置有效,它就可能是最終位置(而根據朝向,結果是一個未還原的魔方,DNF)。"
                />
              </p>
            </div>
            <img
              className="reg-explain-img"
              src="/images/regulation/explanation.jpg"
              alt={tr({ zh: '4×4 与 3×3 棱块对比', en: '4×4 vs 3×3 edge piece',
                  zhHant: "4×4 與 3×3 稜塊對比"
            })}
              loading="lazy"
              width={1341}
              height={1500}
            />
          </div>
        </section>

        {/* ── Footer / credit ── */}
        <footer className="reg-footer">
          <p>
            <T
              zh={<>本页内容整理自 <strong>WCA 官方《竞赛规则与指南》</strong>;其中「拼装缺陷判定」一节的全部配图与文字,移植自 WCA Regulations Committee 的《Regulation 5b5f Visual Guide》(Revision 5,2025-10-04)。原文为英文,中文为本站整理翻译,仅供学习参考;一切判定以官方现行版本为准。</>}
              en={<>This page is compiled from the <strong>official WCA Regulations &amp; Guidelines</strong>; the "assembly defects" section reproduces all photos and text from the WCA Regulations Committee's "Regulation 5b5f Visual Guide" (Revision 5, 2025-10-04). The originals are in English; the Chinese is our own translation, for educational reference only. Judging always follows the current official version.</>}
              zhHant={<>本頁內容整理自 <strong>WCA 官方《競賽規則與指南》</strong>;其中「拼裝缺陷判定」一節的全部配圖與文字,移植自 WCA Regulations Committee 的《Regulation 5b5f Visual Guide》(Revision 5,2025-10-04)。原文為英文,中文為本站整理翻譯,僅供學習參考;一切判定以官方現行版本為準。</>}
            />
          </p>
          <p style={{ marginTop: 12 }}>
            <a href={WCA_REG_FULL} target="_blank" rel="noopener noreferrer"><T zh="官方规则全文" en="Official Regulations (full)" zhHant="官方規則全文" /></a>
            {' · '}
            <a href={WCA_REG_ZH} target="_blank" rel="noopener noreferrer"><T zh="官方中文翻译" en="Official Chinese translation" zhHant="官方中文翻譯" /></a>
            {' · '}
            <a href={WCA_REG_5B5F} target="_blank" rel="noopener noreferrer"><T zh="规则 5b5f" en="Regulation 5b5f" zhHant="規則 5b5f" /></a>
            {' · '}
            <a href={SOURCE_URL} target="_blank" rel="noopener noreferrer"><T zh="原始 Visual Guide (Google Drive)" en="Original Visual Guide (Google Drive)" zhHant="原始 Visual Guide (Google Drive)" /></a>
          </p>
          <div className="reg-revisions">
            5b5f Visual Guide revisions — 2023-06-02 fix Example 6 · 2023-06-24 retitle · 2024-04-04 add Example 11 · 2025-08-03 drop old-reg comparison · 2025-10-04 drop Guidelines mention
          </div>
        </footer>

      </div>
    </div>
  );
}

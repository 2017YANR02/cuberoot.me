'use client';

// /regulation — WCA Regulation 5b5f「Visual Guide」的图文移植。
// 内容与配图来源:WCA Regulations Committee(Google Drive,见页脚 + /about credits)。
// 文案走 @/i18n/tr 的 <T>(zh/en;zh-Hant 由 build 注入回退 zh)。

import { useTranslation } from 'react-i18next';
import { Info, ExternalLink, FileText } from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { T, tr } from '@/i18n/tr';
import './regulation.css';

const SOURCE_URL = 'https://drive.google.com/file/d/15XszaCGNvy3Dk6X6qERzZWZaDH1RH04z';
const WCA_REG_URL = 'https://www.worldcubeassociation.org/regulations/full/#5b5f';

type Verdict = 'solved' | 'dnf' | 'plus2' | 'delegate';

const VERDICT: Record<Verdict, { cls: string; zh: string; en: string }> = {
  solved:   { cls: 'v-solved',   zh: '判定成功', en: 'Solved' },
  dnf:      { cls: 'v-dnf',      zh: 'DNF',      en: 'DNF' },
  plus2:    { cls: 'v-plus2',    zh: '+2 罚秒',  en: '+2' },
  delegate: { cls: 'v-delegate', zh: '代表裁量', en: 'Delegate discretion' },
};

interface Ex { n: number; img: string; verdict: Verdict; zh: string; en: string; }

const EXAMPLES: Ex[] = [
  {
    n: 1, img: 'example-1', verdict: 'solved',
    zh: `这块 wing 唯一能正常装回的位置,就是它还原后的位置。4×4 的结构不允许这块片在原位翻转,所以那个「翻转」状态不是需要考虑的有效位置。`,
    en: `The only place where the piece would normally fit is the place where the piece is solved. A 4×4 mechanism does not allow the wing to be twisted on its spot, so that is not a valid position to consider.`,
  },
  {
    n: 2, img: 'example-2', verdict: 'solved',
    zh: `按 5b6 对「部件」的定义,这里有 3 个部件部分脱出。但它们都更靠近各自的还原位置,因此没有任何块被视为受影响。`,
    en: `Given the definition of "part" in Regulation 5b6, here we have 3 parts partially detached. However, all of them are closer to their solved place. Therefore, no pieces are considered to be affected.`,
  },
  {
    n: 3, img: 'example-3', verdict: 'delegate',
    zh: `最近的有效位置,要么是还原状态,要么是「角块翻转」状态。代表需要仔细判断:当前状态更接近哪一个。`,
    en: `The closest valid position is either the solved state, or the "corner twist" state. The Delegate should carefully evaluate which state is the closest to the current one.`,
  },
  {
    n: 4, img: 'example-4', verdict: 'solved',
    zh: `这个角块唯一能放进去的有效位置就是正确位置;而且它的朝向看起来更接近还原朝向。`,
    en: `The only valid place available for the corner is the correct one. The orientation of the piece seems to be closer to the solved orientation.`,
  },
  {
    n: 5, img: 'example-5', verdict: 'dnf',
    zh: `这个角块唯一能放进去的有效位置是正确位置;但无论如何,它的朝向都不能让该块算作还原。`,
    en: `The only valid place available for the corner is the correct one. However, the orientation of the piece does not render the piece solved in any case.`,
  },
  {
    n: 6, img: 'example-6', verdict: 'dnf',
    zh: `棘手的边界情况。左侧那块蓝色中心片占据了黄色中心片的位置(黄色块此时离正确位置很远)。由于黄色块已部分脱出,它最近的有效位置落在蓝色面上 —— 于是最终状态有两块未还原。`,
    en: `Difficult edge case. The blue center piece at the left seems to be taking the space of the yellow center piece (which is now far from its correct place). Considering that the yellow one is now partially detached, the closest valid spot for it is in the blue face. This leads to a final state with two unsolved pieces.`,
  },
  {
    n: 7, img: 'example-7', verdict: 'plus2',
    zh: `多块受影响,但它们都更靠近各自的正确位置。该魔方算还原,但带一个错位(misalignment)罚秒。`,
    en: `Several pieces affected, but all of them are closer to their correct place. The puzzle is solved with a misalignment penalty.`,
  },
  {
    n: 8, img: 'example-8', verdict: 'solved',
    zh: `尽管这块看起来更靠近红框标出的位置,但它在那里无法正常装入(结构不允许)。因此最近的有效位置仍是正确位置。`,
    en: `Although the piece may be closer to the red square's position, the affected piece does not normally fit in such position (the mechanism does not allow it). Therefore, the closest valid position is the correct one.`,
  },
  {
    n: 9, img: 'example-9', verdict: 'dnf',
    zh: `依据 5b5d,此情况判 DNF —— 因为缺失了红绿棱块。`,
    en: `This case is DNF as per Regulation 5b5d, because of the missing red-green edge piece.`,
  },
  {
    n: 10, img: 'example-10', verdict: 'dnf',
    zh: `与实例 1 相反,这里的「翻转」位置在结构上是有效的。因此最近的有效位置并不能让该块算作还原。`,
    en: `As opposed to Example 1, the "twisted" position is valid in terms of mechanism. For this reason, the closest valid position does not render the piece solved.`,
  },
  {
    n: 11, img: 'example-11', verdict: 'solved',
    zh: `相对中心块 A,块 1 几乎完全到位;相对中心块 B,块 3 完全到位。由于 1 和 3 比 2「更到位」,2 唯一可用的有效位置就是正确位置。2 的朝向没有问题,因为它的黄色面大体朝向黄色面。`,
    en: `1 is almost fully placed relative to center A, and 3 is fully placed relative to center B. Given that 1 and 3 are "more placed" than 2, the only valid available position for 2 is the correct one. The orientation of 2 is not a problem because the yellow side of the piece is mostly facing towards the yellow face.`,
  },
];

const CONSIDERATIONS: { zh: string; en: string }[] = [
  {
    zh: `完全脱落的块由 5b5a、5b5b、5b5c、5b5d 处理。`,
    en: `Pieces completely detached are covered by 5b5a, 5b5b, 5b5c and 5b5d.`,
  },
  {
    zh: `这套措辞旨在贴合通常的直觉:「块离它该在的地方足够近,就算还原」。`,
    en: `This wording aims to follow the usual intuition: "If the piece is near to where it should be, the piece is solved".`,
  },
  {
    zh: `块的最终状态,取决于魔方当前的整体状态。`,
    en: `The final state of the piece depends on the current state of the puzzle.`,
  },
  {
    zh: `确定最终位置之后,需要据此位置与朝向来判断魔方是否还原。`,
    en: `Once the final position has been determined, that position and orientation needs to be judged in order to know if the puzzle is either solved or not.`,
  },
  {
    zh: `个别情况可能需要由代表(Delegate)裁定 —— 就像接近临界的 +2 错位一样。`,
    en: `Some particular cases may need to be judged by a Delegate (just like a close +2 misalignment).`,
  },
];

export default function RegulationPage() {
  useTranslation(); // subscribe to language toggle so tr() alt strings re-evaluate

  useDocumentTitle('规则:5b5f 可视化指南', 'Regulation: 5b5f Visual Guide', '規則:5b5f 視覺化指南');

  return (
    <div className="reg-page">
      <div className="reg-wrap">

        {/* ── Hero ── */}
        <header className="reg-hero">
          <div className="reg-eyebrow">
            <img src="/icons/wca.svg" alt="WCA" />
            <T zh="WCA 规则 · 可视化指南" en="WCA Regulations · Visual Guide" zhHant="WCA 規則 · 視覺化指南" />
          </div>
          <h1 className="reg-title">
            <T zh={<>规则 <span className="reg-code">5b5f</span></>} en={<>Regulation <span className="reg-code">5b5f</span></>} zhHant={<>規則 <span className="reg-code">5b5f</span></>} />
          </h1>
          <p className="reg-subtitle">
            <T zh="拼装缺陷的判定 —— 部分脱出或未完全到位的块,怎么算" en="Judging assembly defects — pieces partially detached or not fully placed" zhHant="拼裝缺陷的判定 —— 部分脫出或未完全到位的塊,怎麼算" />
          </p>
          <p className="reg-lede">
            <T
              zh="还原结束时,如果有块没完全卡到位,它到底算在哪个位置?5b5f 给出了判定原则,这份官方可视化指南用 11 个真实案例把它讲清楚 —— 每个案例标出最终判定(成功 / +2 / DNF / 代表裁量)。"
              en="When a solve ends with a piece not fully seated, where does it count as being? Regulation 5b5f gives the principle, and this official visual guide makes it concrete with 11 real cases — each labelled with its verdict (Solved / +2 / DNF / Delegate discretion)."
              zhHant="還原結束時,如果有塊沒完全卡到位,它到底算在哪個位置?5b5f 給出了判定原則,這份官方視覺化指南用 11 個真實案例把它講清楚 —— 每個案例標出最終判定(成功 / +2 / DNF / 代表裁量)。"
            />
          </p>
          <a className="reg-source" href={SOURCE_URL} target="_blank" rel="noopener noreferrer">
            <FileText size={15} />
            <T zh="来源:WCA Regulations Committee · Visual Guide" en="Source: WCA Regulations Committee · Visual Guide" zhHant="來源:WCA Regulations Committee · Visual Guide" />
            <ExternalLink size={13} />
          </a>
        </header>

        {/* ── Regulation text ── */}
        <section className="reg-sec">
          <div className="reg-sec-eyebrow"><T zh="规则原文" en="The regulation" zhHant="規則原文" /></div>
          <h2 className="reg-sec-title"><T zh="5b5f 怎么说" en="What 5b5f says" zhHant="5b5f 怎麼說" /></h2>

          <div className="reg-quote">
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
        </section>

        {/* ── Key principle ── */}
        <section className="reg-sec">
          <div className="reg-key">
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
        </section>

        {/* ── Considerations ── */}
        <section className="reg-sec">
          <div className="reg-sec-eyebrow"><T zh="判定要点" en="Considerations" zhHant="判定要點" /></div>
          <h2 className="reg-sec-title"><T zh="几个前提" en="Things to keep in mind" zhHant="幾個前提" /></h2>
          <ul className="reg-list">
            {CONSIDERATIONS.map((c, i) => (
              <li key={i}><T zh={c.zh} en={c.en} /></li>
            ))}
          </ul>
        </section>

        {/* ── Examples ── */}
        <section className="reg-sec">
          <div className="reg-sec-eyebrow"><T zh="实例" en="Examples" zhHant="實例" /></div>
          <h2 className="reg-sec-title"><T zh="11 个真实案例" en="11 real cases" zhHant="11 個真實案例" /></h2>
          <p className="reg-sec-lede">
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
        </section>

        {/* ── Explanation ── */}
        <section className="reg-sec">
          <div className="reg-sec-eyebrow"><T zh="进阶解释" en="Explanation" zhHant="進階解釋" /></div>
          <h2 className="reg-sec-title"><T zh="为什么 4×4 算还原,3×3 不算?" en="Why is the 4×4 solved, but the 3×3 not?" zhHant="為什麼 4×4 算還原,3×3 不算?" /></h2>
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
              alt={tr({ zh: '4×4 与 3×3 棱块对比', en: '4×4 vs 3×3 edge piece' })}
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
              zh={<>本页内容与全部配图移植自 <strong>WCA Regulations Committee</strong> 的官方文档《Regulation 5b5f Visual Guide》(Revision 5,2025-10-04)。原文为英文,中文为本站翻译,仅供学习参考;判定以 <a href={WCA_REG_URL} target="_blank" rel="noopener noreferrer">WCA 官方规则</a> 现行版本为准。</>}
              en={<>This page reproduces the content and all photos from the <strong>WCA Regulations Committee</strong>'s official "Regulation 5b5f Visual Guide" (Revision 5, 2025-10-04), for educational reference. Judging always follows the current <a href={WCA_REG_URL} target="_blank" rel="noopener noreferrer">official WCA Regulations</a>.</>}
              zhHant={<>本頁內容與全部配圖移植自 <strong>WCA Regulations Committee</strong> 的官方文件《Regulation 5b5f Visual Guide》(Revision 5,2025-10-04)。原文為英文,中文為本站翻譯,僅供學習參考;判定以 <a href={WCA_REG_URL} target="_blank" rel="noopener noreferrer">WCA 官方規則</a> 現行版本為準。</>}
            />
          </p>
          <p style={{ marginTop: 12 }}>
            <a href={SOURCE_URL} target="_blank" rel="noopener noreferrer">
              <T zh="查看原始 Visual Guide (Google Drive)" en="View the original Visual Guide (Google Drive)" zhHant="查看原始 Visual Guide (Google Drive)" />
            </a>
          </p>
          <div className="reg-revisions">
            Revisions — 2023-06-02 fix Example 6 · 2023-06-24 retitle · 2024-04-04 add Example 11 · 2025-08-03 drop old-reg comparison · 2025-10-04 drop Guidelines mention
          </div>
        </footer>

      </div>
    </div>
  );
}

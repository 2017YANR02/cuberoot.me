'use client';

// /regulation/defects — Article 5: Puzzle Defects (魔方故障).
//
// Two parts:
//   A) Article 5 basics — no modification/replacement mid-solve; pops & fixing
//      without adding a move; misalignment / defect → solved / +2 / DNF.
//   B) Deep dive on Regulation 5b5f (closest-valid-position principle), porting
//      the official "Regulation 5b5f Visual Guide" — 11 photo cases + the
//      4×4-vs-3×3 explanation, each judged with a VerdictBadge.
//
// Shell (breadcrumb, hero, prev/next, general credit footer) comes from
// RegArticleLayout. Visual-guide example classes live in ../regulation.css.
import { useT } from '../../../../hooks/useT';
import RegArticleLayout from '../_components/RegArticleLayout';
import FullClauses from '../_components/FullClauses';
import clauses from '../_data/reg-clauses/5.json';
import {
  RegSection, Callout, RegQuote, RegList, VerdictBadge, type Verdict,
} from '../_components/primitives';
import { T } from '@/i18n/tr';

interface ExampleCase {
  img: string;
  verdict: Verdict;
  zh: string;
  en: string;
}

// The 11 official cases, ported verbatim from the 5b5f Visual Guide.
const EXAMPLES: ExampleCase[] = [
  {
    img: 'example-1', verdict: 'solved',
    zh: '这块 wing 唯一能正常装回的位置,就是它还原后的位置。4×4 的结构不允许这块片在原位翻转,所以那个「翻转」状态不是需要考虑的有效位置。',
    en: 'The only place where the piece would normally fit is the place where the piece is solved. A 4×4 mechanism does not allow the wing to be twisted on its spot, so that is not a valid position to consider.',
  },
  {
    img: 'example-2', verdict: 'solved',
    zh: '按 5b6 对「部件」的定义,这里有 3 个部件部分脱出。但它们都更靠近各自的还原位置,因此没有任何块被视为受影响。',
    en: 'Given the definition of "part" in Regulation 5b6, here we have 3 parts partially detached. However, all of them are closer to their solved place. Therefore, no pieces are considered to be affected.',
  },
  {
    img: 'example-3', verdict: 'delegate',
    zh: '最近的有效位置,要么是还原状态,要么是「角块翻转」状态。代表需要仔细判断:当前状态更接近哪一个。',
    en: 'The closest valid position is either the solved state, or the "corner twist" state. The Delegate should carefully evaluate which state is the closest to the current one.',
  },
  {
    img: 'example-4', verdict: 'solved',
    zh: '这个角块唯一能放进去的有效位置就是正确位置;而且它的朝向看起来更接近还原朝向。',
    en: 'The only valid place available for the corner is the correct one. The orientation of the piece seems to be closer to the solved orientation.',
  },
  {
    img: 'example-5', verdict: 'dnf',
    zh: '这个角块唯一能放进去的有效位置是正确位置;但无论如何,它的朝向都不能让该块算作还原。',
    en: 'The only valid place available for the corner is the correct one. However, the orientation of the piece does not render the piece solved in any case.',
  },
  {
    img: 'example-6', verdict: 'dnf',
    zh: '棘手的边界情况。左侧那块蓝色中心片占据了黄色中心片的位置(黄色块此时离正确位置很远)。由于黄色块已部分脱出,它最近的有效位置落在蓝色面上 —— 于是最终状态有两块未还原。',
    en: 'Difficult edge case. The blue center piece at the left seems to be taking the space of the yellow center piece (which is now far from its correct place). Considering that the yellow one is now partially detached, the closest valid spot for it is in the blue face. This leads to a final state with two unsolved pieces.',
  },
  {
    img: 'example-7', verdict: 'plus2',
    zh: '多块受影响,但它们都更靠近各自的正确位置。该魔方算还原,但带一个错位(misalignment)罚时。',
    en: 'Several pieces affected, but all of them are closer to their correct place. The puzzle is solved with a misalignment penalty.',
  },
  {
    img: 'example-8', verdict: 'solved',
    zh: '尽管这块看起来更靠近红框标出的位置,但它在那里无法正常装入(结构不允许)。因此最近的有效位置仍是正确位置。',
    en: "Although the piece may be closer to the red square's position, the affected piece does not normally fit in such position (the mechanism does not allow it). Therefore, the closest valid position is the correct one.",
  },
  {
    img: 'example-9', verdict: 'dnf',
    zh: '依据 5b5d,此情况判 DNF —— 因为缺失了红绿棱块。',
    en: 'This case is DNF as per Regulation 5b5d, because of the missing red-green edge piece.',
  },
  {
    img: 'example-10', verdict: 'dnf',
    zh: '与案例 1 相反,这里的「翻转」位置在结构上是有效的。因此最近的有效位置并不能让该块算作还原。',
    en: 'As opposed to Example 1, the "twisted" position is valid in terms of mechanism. For this reason, the closest valid position does not render the piece solved.',
  },
  {
    img: 'example-11', verdict: 'solved',
    zh: '相对中心块 A,块 1 几乎完全到位;相对中心块 B,块 3 完全到位。由于 1 和 3 比 2「更到位」,2 唯一可用的有效位置就是正确位置。2 的朝向没有问题,因为它的黄色面大体朝向黄色面。',
    en: '1 is almost fully placed relative to center A, and 3 is fully placed relative to center B. Given that 1 and 3 are "more placed" than 2, the only valid available position for 2 is the correct one. The orientation of 2 is not a problem because the yellow side of the piece is mostly facing towards the yellow face.',
  },
];

const VERDICT_LABEL: Record<Verdict, { zh: string; en: string }> = {
  solved: { zh: '判定还原', en: 'Solved' },
  dnf: { zh: 'DNF', en: 'DNF' },
  plus2: { zh: '+2 罚时', en: '+2' },
  delegate: { zh: '代表裁量', en: 'Delegate discretion' },
};

export default function DefectsChapter() {
  const t = useT();

  return (
    <RegArticleLayout slug="defects">
      {/* ── A) Article 5 basics ─────────────────────────────────────── */}
      <RegSection
        eyebrow={t('第 5 章 · 概览', 'Article 5 · Overview')}
        title={t('掉块、解体、错位:基本原则', 'Pops, breakage, misalignment: the basics')}
        lede={t(
          '还原过程中魔方出了状况 —— 弹片、解体、某块卡住或翻转 —— 怎么办?第 5 章给出了一套连贯的处理办法,核心只有几条。',
          'A puzzle misbehaves mid-solve — a piece pops, the puzzle comes apart, something jams or twists. Article 5 gives a coherent way to handle it; the core is just a few rules.'
        )}
      >
        <RegList
          items={[
            (<T zh={<>还原过程中,<strong>不得改装或更换</strong>魔方,只能在规则允许的范围内修复故障(例如把弹出的块放回去)。</>} en={<>During an attempt you may <strong>not modify or replace</strong> the puzzle — only repair a defect within what the regulations allow (for example, putting popped pieces back).</>} />),
            (<T zh={<>发生<strong>弹片(pop)</strong>时,你可以选择就地修复后继续,也可以选择停止本次还原。修复只能动出问题的部件,不能借助工具或别的魔方的零件。</>} en={<>When a <strong>pop</strong> happens you may choose to repair and continue, or to stop the attempt. A repair may touch only the defective parts — never tools or parts from another puzzle.</>} />),
            (<T zh={<>修复故障本身<strong>不算一步转动</strong>:把块装回原位、归位螺丝/中心盖,都不会被计入步数,也不会因此罚时。但修复不得给你带来还原上的便利。</>} en={<>Fixing a defect <strong>does not count as a move</strong>: placing a piece back, reseating a screw or cap is not a turn and carries no penalty by itself. The repair must not give you a solving advantage.</>} />),
            (<T zh={<>还原结束时,错位或残留缺陷会按程度判为<strong>成功 / +2 / DNF</strong> —— 这正是下面 5b5f 视觉指南要讲透的部分。</>} en={<>At the end, a misalignment or leftover defect is judged <strong>solved / +2 / DNF</strong> by how severe it is — exactly what the 5b5f visual guide below makes concrete.</>} />),
          ]}
        />

        <Callout tone="warn" label={t('什么时候直接 DNF?', 'When is it a straight DNF?')} style={{ marginTop: 26 }}>
          {<T zh={<>用工具或别的魔方零件修复、修复给了还原便利、盲拧阶段睁眼修复、故意制造故障 —— 这些都直接判 DNF。另外要记住:魔方出故障<strong>不会</strong>因此给你额外的还原机会。</>} en={<>Using a tool or parts from another puzzle, a repair that gives a solving advantage, repairing with eyes open during a blindfolded phase, or deliberately causing a defect — each is an outright DNF. And note: a puzzle defect does <strong>not</strong> entitle you to an extra attempt.</>} />}
        </Callout>
      </RegSection>

      {/* ── B) Deep dive: Regulation 5b5f ───────────────────────────── */}
      <section className="reg-sec reg-sec-major">
        <div className="reg-sec-eyebrow">{t('深度解读 · 5b5f 视觉指南', 'Deep dive · 5b5f Visual Guide')}</div>
        <h2 className="reg-sec-title">
          {t('规则 5b5f:拼装缺陷怎么判', 'Regulation 5b5f: judging assembly defects')}
        </h2>
        <p className="reg-sec-lede">
          {t(
            '当一块没有完全脱落、却也没完全到位,它到底算在哪个位置?5b5f 给出了判定依据。',
            'When a piece is neither fully detached nor fully placed, where does it actually count as being? Regulation 5b5f gives the rule.'
          )}
        </p>

        <RegQuote num="5b5">
          {t(
            '如果在还原结束时,魔方的某些部件物理脱离或未完全到位,则适用以下规定(……)',
            'If some parts of the puzzle are physically detached or not fully placed at the end of the solve, the following regulations apply (…)'
          )}
        </RegQuote>
        <RegQuote num="5b5f">
          {t(
            '如果某块部分脱出或未完全到位,它的最终位置是:在魔方当前状态下,该块能在结构中正常装入的最近位置。如果这个最终位置使该块处于还原状态,则该块不算受魔方缺陷影响。',
            'If a piece is partially detached or not fully placed, its final position is the closest position in which the affected piece would normally fit within the puzzle mechanism, considering the current state of the puzzle. If the final position renders the piece solved, the piece is not considered to be affected by the puzzle defect.'
          )}
        </RegQuote>

        <Callout tone="info" label={t('一句话原则', 'The principle, in one line')} style={{ marginTop: 6, marginBottom: 36 }}>
          {t(
            '块的最终位置,是在魔方当前状态下、它能在结构中正常装入的最近位置。换句话说:把一块放到某位置后,如果魔方仍能正常操作(不一定能还原)而没有问题,那这个位置就是「有效」的。',
            'The final position of the piece is the closest position in which it would normally fit within the puzzle mechanism, considering the current state of the puzzle. In other words: a position is valid if it is possible to operate (not necessarily solve) the puzzle without issues, when the piece is placed in such position.'
          )}
        </Callout>

        <h3 className="reg-sub-title">{t('几个前提', 'Things to keep in mind')}</h3>
        <RegList
          items={[
            t('完全脱落的块由 5b5a、5b5b、5b5c、5b5d 处理。', 'Pieces completely detached are covered by 5b5a, 5b5b, 5b5c and 5b5d.'),
            t('这套措辞旨在贴合通常的直觉:「块离它该在的地方足够近,就算还原」。', 'This wording aims to follow the usual intuition: "If the piece is near to where it should be, the piece is solved".'),
            t('块的最终状态,取决于魔方当前的整体状态。', 'The final state of the piece depends on the current state of the puzzle.'),
            t('确定最终位置之后,需要据此位置与朝向来判断魔方是否还原。', 'Once the final position has been determined, that position and orientation needs to be judged in order to know if the puzzle is either solved or not.'),
            t('个别情况可能需要由代表(Delegate)裁定 —— 就像接近临界的 +2 错位一样。', 'Some particular cases may need to be judged by a Delegate (just like a close +2 misalignment).'),
          ]}
        />

        {/* The 11 cases */}
        <h3 className="reg-sub-title">{t('11 个真实案例', '11 real cases')}</h3>
        <div className="reg-examples">
          {EXAMPLES.map((ex, i) => {
            const label = VERDICT_LABEL[ex.verdict];
            return (
              <div className="reg-ex" key={ex.img}>
                <div className="reg-ex-media">
                  <img
                    className="reg-ex-img"
                    src={`/images/regulation/${ex.img}.jpg`}
                    alt={t(`案例 ${i + 1}`, `Example ${i + 1}`)}
                    width={1341}
                    height={1500}
                    loading="lazy"
                  />
                </div>
                <div>
                  <div className="reg-ex-n">{t(`案例 ${i + 1}`, `Example ${i + 1}`)}</div>
                  <VerdictBadge verdict={ex.verdict}>{t(label.zh, label.en)}</VerdictBadge>
                  <p className="reg-ex-text">{t(ex.zh, ex.en)}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* The 4×4 vs 3×3 explanation */}
        <h3 className="reg-sub-title">
          {t('为什么 4×4 算还原,3×3 不算?', 'Why is the 4×4 solved, but the 3×3 not?')}
        </h3>
        <div className="reg-explain">
          <div className="reg-explain-text">
            <p>
              {t(
                '如你所见,前面那块翻转的 4×4 wing 被判还原,而结构相似的 3×3 角块却不算。差别在哪?',
                'As you have seen, the 4×4 is considered solved, but the 3×3 is not. But why?'
              )}
            </p>
            <p>
              {t(
                '原因很简单:从 4×4 上取下一块棱(比如橙蓝棱中的一块),再试着把它上下颠倒装回去。你会发现结构根本不允许 —— 这不是需要考虑的有效位置。',
                'The reason is simple: remove one edge piece from a 4×4 puzzle (i.e. one of the orange-blue edge pieces). Now try to put it back in the puzzle, but upside down. As you can see, the mechanism does not allow that. It is not a valid position to consider.'
              )}
            </p>
            <p>
              {t(
                '换成 3×3 的棱块做同样的实验:你会得到一个不可能的状态,但这块确实能装进那个位置。既然位置有效,它就可能是最终位置(而根据朝向,结果是一个未还原的魔方,DNF)。',
                'Try the same experiment, but with a 3×3 edge piece. You will get an impossible state, but the piece fits in such position. As it is a valid position, it may be the final one (and the result, given the orientation, is an unsolved puzzle — DNF).'
              )}
            </p>
          </div>
          <img
            className="reg-explain-img"
            src="/images/regulation/explanation.jpg"
            alt={t('4×4 与 3×3 棱块装入对比', '4×4 vs 3×3 edge-piece fit comparison')}
            width={1341}
            height={1500}
            loading="lazy"
          />
        </div>

        {/* Visual-Guide-specific attribution (general credit is in the footer) */}
        <p className="reg-revisions">
          {t(
            '5b5f Visual Guide — 移植自 WCA Regulations Committee《Regulation 5b5f Visual Guide》(Revision 5, 2025-10-04)',
            '5b5f Visual Guide — ported from the WCA Regulations Committee’s “Regulation 5b5f Visual Guide” (Revision 5, 2025-10-04)',
          )}
        </p>
      </section>
      <FullClauses data={clauses} />
    </RegArticleLayout>
  );
}

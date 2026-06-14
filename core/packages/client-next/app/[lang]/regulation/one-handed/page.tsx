'use client';

// /regulation/one-handed — Article C (One-Handed Solving).
//
// Illustrated guide to the one-handed event. The whole article is short: it
// inherits Article A's speed-solve procedure and only adds the "one hand only"
// rules. The visual centrepiece is a do / don't pair (one Hand icon = allowed,
// two = forbidden). Content paraphrases the official Article C verbatim source
// (regulations C1, C1b, C1b+, C1b++, C1b2, C1b3, C1b4, C1c).

import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Hand, Eye, Wrench, Timer } from 'lucide-react';
import Link from '@/components/AppLink';
import { useT } from '../../../../hooks/useT';
import RegArticleLayout from '../_components/RegArticleLayout';
import FullClauses from '../_components/FullClauses';
import clauses from '../_data/reg-clauses/C.json';
import { RegSection, Callout, RegQuote, RegList } from '../_components/primitives';
import './one-handed.css';

/** A do / don't hand panel: tone ok (one hand) / bad (two hands). */
function HandPanel({
  hands, tone, title, sub,
}: { hands: 1 | 2; tone: 'ok' | 'bad'; title: ReactNode; sub: ReactNode }) {
  return (
    <figure className={`oh-panel oh-panel-${tone}`}>
      <div className="oh-panel-icons" aria-hidden="true">
        <Hand size={46} strokeWidth={1.6} />
        {hands === 2 && <Hand size={46} strokeWidth={1.6} className="oh-hand-2" />}
      </div>
      <figcaption className="oh-panel-cap">
        <span className="oh-panel-title">{title}</span>
        <span className="oh-panel-sub">{sub}</span>
      </figcaption>
    </figure>
  );
}

export default function OneHandedChapter() {
  const { i18n } = useTranslation(); // subscribe to language toggle
  const isZh = i18n.language.startsWith('zh');
  const t = useT();

  return (
    <RegArticleLayout slug="one-handed">
      {/* ── 1. The one rule that matters ─────────────────────────── */}
      <RegSection
        eyebrow={t('一句话规则', 'The whole rule in one line')}
        title={t('一只手,从头到尾', 'One hand, start to finish')}
        lede={t(
          '单手还原(3×3×3 One-Handed,OH)的项目内容和速拧完全一样 —— 还是那个三阶、那 15 秒观察、那同一台计时器。唯一的不同:从开始转动到完成,你只能用一只手操作魔方。',
          'One-Handed (3×3×3 OH) is the same event as the speed solve — the same cube, the same 15-second inspection, the same timer. The one difference: from the first turn to the last, only one hand may operate the puzzle.'
        )}
      >
        <div className="oh-pair">
          <HandPanel
            hands={1}
            tone="ok"
            title={t('允许', 'Allowed')}
            sub={t('全程只用一只手操作魔方', 'Operate the puzzle with one hand only')}
          />
          <HandPanel
            hands={2}
            tone="bad"
            title={t('禁止', 'Not allowed')}
            sub={t('还原中用另一只手操作魔方 = DNF', 'Operating the puzzle with the other hand = DNF')}
          />
        </div>

        <RegQuote num="C1b">
          {t(
            '在还原过程中,选手只能用一只手操作魔方。违反则取消该次还原资格(DNF)。',
            'During the solve, the competitor must use only one hand to operate the puzzle. Penalty: disqualification of the attempt (DNF).'
          )}
        </RegQuote>

        <Callout tone="danger" label={t('另一只手不得操作魔方', 'The other hand may not operate the puzzle')}>
          {(isZh
              ? (<>关键限制在 <b>C1c</b>:还原一旦开始、某只手操作了魔方,<b>另一只手在整个这一次还原中都不能再操作魔方</b>。这意味着选手必须在开始前就选定用哪只手 —— 中途换手操作就是 DNF。注意限制的是“操作”,不是“碰到”:另一只手无意蹭到、又没造成转动,由裁判裁量,不算操作(<b>C1b3</b>)。</>)
              : (<>The key limit is <b>C1c</b>: once a hand operates the puzzle during the solve, <b>the other hand may not operate it for the rest of that attempt</b>. You commit to a hand before you start — switching hands to operate mid-solve is a DNF. Note the rule is about <i>operating</i>, not merely touching: if the other hand makes accidental contact and applies no move, the judge may rule it is not operating (<b>C1b3</b>).</>))}
        </Callout>
      </RegSection>

      {/* ── 2. What still counts as fair ─────────────────────────── */}
      <RegSection
        eyebrow={t('哪些不算犯规', 'What is still fine')}
        title={t('单手之外,还允许什么', 'The fine print around "one hand"')}
        lede={t(
          '“只用一只手”指的是操作魔方。规则对几种常见情况单独做了澄清,免得选手因为正常的、无意的动作被误判。',
          '"One hand only" is about operating the puzzle. The Regulations spell out a few common situations so that normal, unintentional movements are not wrongly penalized.'
        )}
      >
        <RegList
          items={[
            <span key="inspect">
              <Eye size={16} className="oh-li-icon" />
              <strong>{t('观察时可以用双手。', 'Both hands during inspection.')}</strong>{' '}
              {t(
                '15 秒观察阶段不受单手限制,选手可以双手拿起魔方查看(C1b+)。限制只在“开始还原”之后生效。',
                'The 15-second inspection is not restricted — you may pick the cube up with both hands to look at it (C1b+). The limit only applies once the solve has started.'
              )}{' '}
              <span className="oh-tag">C1b+</span>
            </span>,
            <span key="surface">
              <Hand size={16} className="oh-li-icon" />
              <strong>{t('可以借桌面辅助。', 'You may brace against the surface.')}</strong>{' '}
              {t(
                '可以把魔方抵在桌面/垫子上帮助单手转动,这是单手项目的标准技巧,完全合法(C1b4,见规则 7f1d)。魔方也可以一直放在垫子上滚动。',
                'You may hold the puzzle against the table or mat to help turn it one-handed — a standard OH technique and fully legal (C1b4, see Regulation 7f1d). The cube may also rest and roll on the mat throughout.'
              )}{' '}
              <span className="oh-tag">C1b4</span>
            </span>,
            <span key="contact">
              <Hand size={16} className="oh-li-icon" />
              <strong>{t('无意的碰触不算操作。', 'Accidental contact is not "operating".')}</strong>{' '}
              {t(
                '如果身体其他部位无意中碰到了魔方、又没有造成转动,裁判可酌情认定这不算“操作魔方”(C1b3)。掉了去捡、蹭到了不算犯规,刻意去转才算。',
                'If another body part touches the puzzle unintentionally and applies no move, the judge may rule it is not "operating" the puzzle (C1b3). Brushing it or picking up a drop is fine — deliberately turning with it is not.'
              )}{' '}
              <span className="oh-tag">C1b3</span>
            </span>,
            <span key="repair">
              <Wrench size={16} className="oh-li-icon" />
              <strong>{t('修故障只能用还原的那只手。', 'Repairs use the solving hand only.')}</strong>{' '}
              {t(
                '万一魔方掉块、解体,选手如果选择修复,必须只用还原的那只手修(C1b2);否则取消该次资格。',
                'If the puzzle pops or comes apart and the competitor chooses to repair it, they must do so with the solving hand only (C1b2); otherwise the attempt is disqualified.'
              )}{' '}
              <span className="oh-tag">C1b2</span>
            </span>,
            <span key="switch">
              <Hand size={16} className="oh-li-icon" />
              <strong>{t('不同次还原可以换手。', 'A different attempt may use a different hand.')}</strong>{' '}
              {t(
                '同一轮五次还原,选手不必每次都用同一只手(C1b++)。限制是“一次还原内不换手”,不是“整场只准用一只手”。',
                'Across the five attempts of a round, you need not use the same hand each time (C1b++). The rule is "no switching within one attempt", not "one hand for the whole round".'
              )}{' '}
              <span className="oh-tag">C1b++</span>
            </span>,
          ]}
        />
      </RegSection>

      {/* ── 3. Everything else is the speed solve ────────────────── */}
      <RegSection
        eyebrow={t('其余照速拧来', 'Otherwise, it is the speed solve')}
        title={t('观察、计时与赛制', 'Inspection, timing and format')}
        lede={t(
          '附则 C 很短:除了上面的单手限制,其它一切都直接沿用速拧规程。',
          'Article C is short: apart from the one-hand limit above, everything else is inherited straight from the speed-solve procedure.'
        )}
      >
        <Callout tone="info" label={t('和速拧共用的部分', 'Shared with the speed solve')} icon={<Timer size={17} />}>
          {(isZh
              ? (
                <>
                  15 秒观察、双手放计时器两侧启动、停表、还原态判定(对齐误差与 +2 / DNF)、罚时 —— 这些全部照 <Link href="/regulation/speed-solving">附则 A(速拧)</Link> 执行(C1)。<br />
                  赛制是 <b>五次取平均(去掉最好和最差,取中间三次)</b>,和三阶速拧一样。
                </>
              )
              : (
                <>
                  The 15-second inspection, hands on the timer to start and stop, the solved-state judging (misalignment, +2 / DNF) and the penalties all follow <Link href="/regulation/speed-solving">Article A (Speed Solving)</Link> (C1).<br />
                  The format is the <b>Average of 5 (drop best and worst, average the middle three)</b>, exactly as in the 3×3×3 speed event.
                </>
              ))}
        </Callout>
      </RegSection>
      <FullClauses data={clauses} />
    </RegArticleLayout>
  );
}

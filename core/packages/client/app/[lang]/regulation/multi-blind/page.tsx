'use client';

// /regulation/multi-blind — Appendix H (Multiple Blindfolded Solving).
// Illustrated guide to Multi-Blind: one competitor memorizes and solves many
// 3×3×3 cubes blindfolded in a single sitting, under one running clock with a
// cap of one hour. The score is (solved − unsolved); at least 2 cubes must be
// attempted to count. Shared shell + primitives do the chrome.

import { useTranslation } from 'react-i18next';
import { Layers, Clock, Hash, Ban } from 'lucide-react';
import Link from '@/components/AppLink';
import { useT } from '../../../../hooks/useT';
import { EventIcon } from '@/components/EventIcon';
import RegArticleLayout from '../_components/RegArticleLayout';
import { RegSection, Callout, RegQuote, RegList } from '../_components/primitives';
import './multi-blind.css';

// Worked example for the score visual: 8 solved − 2 unsolved = 6 points.
const EX_SOLVED = 8;
const EX_UNSOLVED = 2;
const EX_TOTAL = EX_SOLVED + EX_UNSOLVED;

export default function MultiBlindChapter() {
  useTranslation();
  const t = useT();

  return (
    <RegArticleLayout slug="multi-blind">
      {/* ── 1. What it is ────────────────────────────────────────── */}
      <RegSection
        eyebrow={t('一坐到底', 'All in one sitting')}
        title={t('一次蒙眼,还原一堆三阶', 'One blindfold, a whole pile of 3×3×3s')}
        lede={t(
          '多盲是把盲拧推到极限:选手先报出要挑战几个三阶魔方(至少 2 个),逐一睁眼记忆,然后戴上眼罩,凭记忆把它们一个接一个还原 —— 全程只有一块表在跑,最长 1 小时。',
          'Multi-Blind pushes Blindfolded to its limit: the competitor first declares how many 3×3×3 cubes they will attempt (at least 2), memorizes them one by one with eyes open, then dons a blindfold and solves them all from memory, one after another — under a single running clock, capped at one hour.'
        )}
      >
        <div className="mb-stack" aria-hidden="true">
          {Array.from({ length: 5 }).map((_, i) => (
            <span key={i} className="mb-stack-cube">
              <EventIcon event="333" />
            </span>
          ))}
        </div>

        <RegQuote num="H1">
          {t(
            '多盲沿用盲拧的标准流程,只在下列各条上另作规定。',
            'Multi-Blind follows the standard Blindfolded procedure, except where the rules below supersede it.'
          )}
        </RegQuote>
      </RegSection>

      {/* ── 2. The score: solved − unsolved ──────────────────────── */}
      <RegSection
        eyebrow={t('成绩怎么算', 'How the score works')}
        title={t('得分 = 还原数 − 未还原数', 'Score = solved − unsolved')}
        lede={t(
          '多盲不比谁拧得多,而比“净成功”:成功还原的个数,减去没还原的个数。多挑战不等于占便宜 —— 失败的每一个都要倒扣回来。',
          'Multi-Blind does not reward sheer volume; it rewards net success: the number of cubes solved minus the number not solved. Biting off more is not a free lunch — every failure counts against you.'
        )}
      >
        <figure className="mb-formula">
          <div className="mb-term mb-term-ok">
            <div className="mb-term-num">{EX_SOLVED}</div>
            <div className="mb-term-lab">{t('还原成功', 'Solved')}</div>
          </div>
          <div className="mb-op">−</div>
          <div className="mb-term mb-term-bad">
            <div className="mb-term-num">{EX_UNSOLVED}</div>
            <div className="mb-term-lab">{t('未还原', 'Unsolved')}</div>
          </div>
          <div className="mb-op">=</div>
          <div className="mb-term mb-term-res">
            <div className="mb-term-num">{EX_SOLVED - EX_UNSOLVED}</div>
            <div className="mb-term-lab">{t('得分', 'Points')}</div>
          </div>
          <figcaption className="mb-formula-cap">
            {t(
              `挑战 ${EX_TOTAL} 个,还原 ${EX_SOLVED} 个、失手 ${EX_UNSOLVED} 个 → ${EX_SOLVED} − ${EX_UNSOLVED} = ${EX_SOLVED - EX_UNSOLVED} 分。`,
              `Attempt ${EX_TOTAL}, solve ${EX_SOLVED}, miss ${EX_UNSOLVED} → ${EX_SOLVED} − ${EX_UNSOLVED} = ${EX_SOLVED - EX_UNSOLVED} points.`
            )}
          </figcaption>
        </figure>

        <RegList
          items={[
            <span key="min">
              <Hash size={16} className="mb-li-icon" />
              <strong>{t('至少挑战 2 个才算数。', 'At least 2 cubes to count.')}</strong>{' '}
              {t(
                '尝试前必须先向组织方报出要挑战的魔方数,且不少于 2 个;报数之后不得更改。',
                'Before the attempt the competitor must submit the number of cubes to the organization team, and it must be at least 2; the number cannot be changed once submitted.'
              )}{' '}
              <span className="mb-tag">H1a · H1a1</span>
            </span>,
            <span key="tie">
              <Clock size={16} className="mb-li-icon" />
              <strong>{t('同分比时间。', 'Ties broken by time.')}</strong>{' '}
              {t(
                '净得分相同的两名选手,用时短的排在前面;若净分和时间都相同,再比谁未还原的个数少(规则 9f12c)。所以多盲既要拧得对,也要拧得快。',
                'When two competitors have the same net score, the shorter total time ranks higher; if score and time are also equal, fewer unsolved cubes ranks higher (Regulation 9f12c). So Multi-Blind rewards being both correct and fast.'
              )}{' '}
              <span className="mb-tag">9f12c</span>
            </span>,
            <span key="square">
              <Layers size={16} className="mb-li-icon" />
              <strong>{t('魔方摆成方阵,不许叠放。', 'Cubes laid out square, never stacked.')}</strong>{' '}
              {t(
                '打乱好的魔方要尽量排成接近正方形的阵列、单层平铺,不得堆叠(例如 8 个排成 3+3+2)。',
                'The scrambled cubes are arranged as square as possible in a single layer, not stacked (e.g. 8 cubes as rows of 3, 3 and 2).'
              )}{' '}
              <span className="mb-tag">H1a3</span>
            </span>,
            <span key="memo">
              <Ban size={16} className="mb-li-icon" />
              <strong>{t('记忆阶段不得转动任何魔方。', 'No turning any cube during memo.')}</strong>{' '}
              {t(
                '记忆阶段对任一魔方施加转动即判该次尝试 DNF(WCA 代表可酌情只把该魔方算作未还原,而非作废整次)。',
                'Applying a move to any cube during the memorization phase is a DNF for the attempt (the Delegate may instead count just that cube as unsolved rather than voiding the whole attempt).'
              )}{' '}
              <span className="mb-tag">H1e</span>
            </span>,
          ]}
        />

        <Callout tone="danger" label={t('什么时候算 DNF', 'When the attempt is a DNF')} icon={<Ban size={17} />} style={{ marginTop: 30 }}>
          {t(
            '光看“成功几个”还不够:如果净得分小于 0(失败多于成功),或者只成功还原了 1 个魔方,整次尝试都记 DNF(规则 9f12c)。换句话说,多盲至少要成功还原 2 个、且成功数多于失败数,才算有成绩 —— 这也是挑战数量要量力而行的原因。',
            'Counting how many you solved is not the whole story: if the net score is below 0 (more failures than successes), or only a single cube is solved, the entire attempt is a DNF (Regulation 9f12c). In other words, a Multi-Blind result needs at least 2 cubes solved and more solved than not — which is why you should pick a count you can actually handle.'
          )}
        </Callout>
      </RegSection>

      {/* ── 3. The clock: up to one hour ─────────────────────────── */}
      <RegSection
        eyebrow={t('时间预算', 'The time budget')}
        title={t('一块表,最多 1 小时', 'One clock, up to one hour')}
        lede={t(
          '记忆和全部还原共用同一块从头跑到尾的计时器。时间上限按挑战数量定,但封顶就是 1 小时。',
          'Memorization and all the solves share a single clock that runs the whole way through. The time limit scales with how many cubes you take on, but it is capped at one hour.'
        )}
      >
        <Callout tone="info" label={t('1 小时封顶', 'Capped at one hour')} icon={<Clock size={17} />}>
          {t(
            '挑战不足 6 个时,时限是“10 分钟 × 魔方数”(例如 4 个 = 40 分钟);6 个及以上一律 60 分钟(规则 H1b)。选手可随时示意结束;到点未结束的,裁判叫停并按当时状态计分,时限本身就当作最终成绩时间。',
            'For fewer than 6 cubes the limit is “10 minutes × number of cubes” (e.g. 4 cubes = 40 minutes); for 6 or more it is a flat 60 minutes (Regulation H1b). The competitor may signal the end at any time; if the limit is reached first, the judge stops the attempt and scores it as it stands, with the time limit itself counting as the recorded time.'
          )}
        </Callout>

        <Callout tone="warn" label={t('罚时会累加', 'Penalties stack')} icon={<Clock size={17} />}>
          {t(
            '各魔方的罚时是累加的(规则 H1d)。例如:挑战 10 个、停表时间 59:57、有两次 +2 罚时 → 最终时间 59:57 + 2×2 = 60:01。',
            'Time penalties for the cubes in the attempt are cumulative (Regulation H1d). Example: attempt 10 cubes, stop at 59:57 with two +2 penalties → final time 59:57 + 2×2 = 60:01.'
          )}
        </Callout>

        <p className="mb-foot-note">
          {t(
            '单个魔方的盲拧流程(记忆、戴眼罩、不得偷看)见',
            'For the per-cube blindfolded procedure (memorize, blindfold on, no peeking) see '
          )}
          <Link href="/regulation/blindfolded">{t('附则 B:盲拧', 'Article B: Blindfolded')}</Link>
          {t('。', '.')}
        </p>
      </RegSection>
    </RegArticleLayout>
  );
}

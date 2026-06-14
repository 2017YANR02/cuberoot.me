'use client';

// /regulation/blindfolded — Appendix B (Blindfolded Solving).
// Illustrated guide to the two-phase blindfolded attempt: one running clock
// covers memorization and execution; the competitor studies the puzzle, then
// dons a blindfold and may never look at it again (looking = DNF). Applies to
// 3BLD, 4BLD and 5BLD. Shared shell + primitives do the chrome.

import { useTranslation } from 'react-i18next';
import { Eye, EyeOff, Clock, Ban, ShieldCheck, Hand } from 'lucide-react';
import Link from '@/components/AppLink';
import { useT } from '../../../../hooks/useT';
import { EventIcon } from '@/components/EventIcon';
import RegArticleLayout from '../_components/RegArticleLayout';
import FullClauses from '../_components/FullClauses';
import clauses from '../_data/reg-clauses/B.json';
import { RegSection, Callout, RegQuote, RegList } from '../_components/primitives';
import './blindfolded.css';

// The three official blindfolded events. Best of 3 is the usual format.
const BLD_EVENTS: { id: string; zh: string; en: string }[] = [
  { id: '333bf', zh: '三阶盲拧', en: '3×3×3 BLD' },
  { id: '444bf', zh: '四阶盲拧', en: '4×4×4 BLD' },
  { id: '555bf', zh: '五阶盲拧', en: '5×5×5 BLD' },
];

export default function BlindfoldedChapter() {
  useTranslation();
  const t = useT();

  return (
    <RegArticleLayout slug="blindfolded">
      {/* ── 1. One clock, two phases ─────────────────────────────── */}
      <RegSection
        eyebrow={t('一块表,两个阶段', 'One clock, two phases')}
        title={t('记忆,然后蒙眼还原', 'Memorize, then solve blindfolded')}
        lede={t(
          '盲拧没有 15 秒检查。计时从一开始就跑,把记忆和还原算进同一段时间里:选手先睁眼研究魔方背下它的状态,再戴上眼罩,从此不能再看魔方一眼,凭记忆把它还原。',
          'There is no 15-second inspection in Blindfolded. The clock runs from the very start and covers both phases under one time: the competitor studies the puzzle with eyes open and memorizes it, then dons a blindfold — never to see the puzzle again — and solves it from memory.'
        )}
      >
        <figure className="bld-phasebar" aria-hidden="false">
          <div className="bld-clock">
            <Clock size={16} />
            {t('一块计时器,全程不停', 'One timer, running the whole time')}
          </div>
          <div className="bld-phases">
            <div className="bld-phase bld-phase-memo">
              <div className="bld-phase-icon"><Eye size={26} /></div>
              <div className="bld-phase-name">{t('记忆', 'Memorize')}</div>
              <div className="bld-phase-desc">{t('睁眼研究并背下魔方', 'Study with eyes open')}</div>
            </div>
            <div className="bld-phase-arrow" aria-hidden>→</div>
            <div className="bld-phase bld-phase-solve">
              <div className="bld-phase-icon"><EyeOff size={26} /></div>
              <div className="bld-phase-name">{t('蒙眼还原', 'Solve blindfolded')}</div>
              <div className="bld-phase-desc">{t('戴上眼罩,凭记忆还原', 'Blindfold on, from memory')}</div>
            </div>
          </div>
          <figcaption className="bld-phasebar-cap">
            {t(
              '两个阶段之间没有暂停,选手自己决定何时戴眼罩转入还原 —— 但记忆用得越久,留给还原的时间就越少。',
              'There is no pause between the two phases. The competitor decides when to don the blindfold and switch to solving — but every second spent memorizing is a second less for the solve.'
            )}
          </figcaption>
        </figure>

        <RegQuote num="B1 · B1a">
          {t(
            '盲拧沿用速拧的标准流程,只在下列各条上另作规定。其中:盲拧没有检查时间 —— 还原与计时同时开始。',
            'Blindfolded follows the standard Speed Solving procedure, except where the rules below supersede it. In particular: there is no inspection period — the solve starts at the same time as the attempt.'
          )}
        </RegQuote>
      </RegSection>

      {/* ── 2. Looking after memo = DNF ──────────────────────────── */}
      <RegSection
        eyebrow={t('核心红线', 'The one red line')}
        title={t('戴上眼罩后再看魔方,直接 DNF', 'Look at the puzzle after the blindfold goes on — instant DNF')}
        lede={t(
          '盲拧之所以是盲拧,全靠一条铁律:进入蒙眼阶段后,选手在整个还原过程中都不得看到魔方。一旦看了,这次尝试立即作废(DNF)。',
          'What makes Blindfolded blind is a single hard rule: once the blindfolded phase begins, the competitor must not see the puzzle at any point during the solve. The moment they do, the attempt is dead (DNF).'
        )}
      >
        <Callout tone="danger" label={t('蒙眼阶段偷看 = DNF', 'Peeking during the blindfolded phase = DNF')} icon={<Ban size={17} />}>
          {t(
            '为了把这条守死,裁判会在选手对魔方落下第一步之后,在选手脸和魔方之间举一块挡板(一张纸或纸板就行)。眼罩本身也必须戴得够严:就算挡板不在,视线也仍然被完全挡住。两道防线只有一个目的 —— 让“偷看”物理上不可能。',
            'To enforce it, once the competitor makes their first move on the puzzle the judge holds up a sight blocker (a sheet of paper or cardboard) between the competitor’s face and the puzzle. The blindfold itself must also be worn so that the view would still be clearly blocked even without the sight blocker. Two layers, one purpose — to make peeking physically impossible.'
          )}
        </Callout>

        <RegList
          items={[
            <span key="memo">
              <Eye size={16} className="bld-li-icon" />
              <strong>{t('记忆阶段:可以拿起来看,但不能转。', 'Memo phase: pick it up and look, but do not turn it.')}</strong>{' '}
              {t(
                '选手可以拿起魔方观察,但不得使用任何实体记录(笔记),也不得对魔方施加转动或刻意改变对齐(允许在限度内对齐魔方面)。违者 DNF。',
                'The competitor may pick up the puzzle to study it, but may not use any physical notes, nor apply any move or intentional change in alignment (aligning faces within the allowed limit is fine). Otherwise: DNF.'
              )}{' '}
              <span className="bld-tag">B3</span>
            </span>,
            <span key="don">
              <EyeOff size={16} className="bld-li-icon" />
              <strong>{t('戴眼罩:落下第一步前可摘回去重记。', 'Blindfold on: until the first move, you may go back.')}</strong>{' '}
              {t(
                '选手戴上眼罩进入蒙眼阶段;只要还没对魔方落下第一步,都可以摘下眼罩回到记忆阶段再看。一旦动了第一步,就不能再回头。',
                'Donning the blindfold starts the blindfolded phase; until the first move is applied to the puzzle, the competitor may remove the blindfold and return to memorizing. After the first move, there is no going back.'
              )}{' '}
              <span className="bld-tag">B4a · B4a1</span>
            </span>,
            <span key="nolook">
              <Ban size={16} className="bld-li-icon" />
              <strong>{t('蒙眼阶段:全程不得看魔方。', 'Blindfolded phase: never look at the puzzle.')}</strong>{' '}
              {t(
                '从第一步到还原结束,选手在任何时刻都不得看到魔方。违者 DNF。三阶盲拧可以靠手摸来确认允许的 Logo 朝向,但这不算“看”。',
                'From the first move to the end of the solve, the competitor must not look at the puzzle at any point. Otherwise: DNF. (For 3×3×3 BLD, feeling for a permitted logo by touch is allowed — that is not “looking”.)'
              )}{' '}
              <span className="bld-tag">B4d · B4d+</span>
            </span>,
            <span key="blocker">
              <Hand size={16} className="bld-li-icon" />
              <strong>{t('挡板兜底。', 'The sight blocker as backstop.')}</strong>{' '}
              {t(
                '若裁判忘了举挡板而 WCA 代表也不怀疑选手违规偷看,原成绩可保留;反过来,挡板的摆位必须满足“即使没戴眼罩视线也被挡住”。',
                'If the judge forgot the sight blocker and the WCA Delegate has no reason to suspect a violation, the original attempt may stand; conversely, the sight blocker must be placed so the view would be clearly blocked even with no blindfold.'
              )}{' '}
              <span className="bld-tag">B4c · B4c2</span>
            </span>,
          ]}
        />

        <Callout tone="info" label={t('魔方也有讲究', 'Even the puzzle is restricted')} icon={<ShieldCheck size={17} />}>
          {t(
            '盲拧用的魔方不能有纹理、记号或其它能让人靠手感分辨相似块朝向的特征 —— 否则就成了“摸出来的小抄”。唯一的例外是三阶盲拧:魔方可以带一个规则允许的 Logo,供选手靠触觉确定方位。',
            'A Blindfolded puzzle must not have textures, markings or other features that let similar pieces be told apart by feel — that would be a tactile cheat sheet. The one exception is 3×3×3 BLD, where the puzzle may carry one permitted logo the competitor can locate by touch for orientation.'
          )}
        </Callout>
      </RegSection>

      {/* ── 3. Which events, what format ─────────────────────────── */}
      <RegSection
        eyebrow={t('用在哪些项目', 'Which events use it')}
        title={t('三阶、四阶、五阶盲拧', '3×3×3, 4×4×4 and 5×5×5 Blindfolded')}
        lede={t(
          '附则 B 的流程适用于全部三个单盲项目。盲拧通常采用“三取一”(Best of 3)赛制:三次尝试取最好的一次成绩,只要有一次成功就算有成绩。',
          'The Article B procedure applies to all three single-blind events. Blindfolded is usually held as Best of 3: three attempts, the best one counts — a single successful attempt is all it takes for a result.'
        )}
      >
        <div className="bld-evt-row">
          {BLD_EVENTS.map((e) => (
            <span key={e.id} className="bld-evt-chip">
              <EventIcon event={e.id} />
              {t(e.zh, e.en)}
            </span>
          ))}
        </div>
        <p className="bld-foot-note">
          {t(
            '多个魔方一次蒙眼连续还原是另一个项目 —— 见',
            'Solving many cubes in a single blindfolded sitting is a separate event — see '
          )}
          <Link href="/regulation/multi-blind">{t('附则 H:多盲', 'Article H: Multi-Blind')}</Link>
          {t('。', '.')}
        </p>
      </RegSection>
      <FullClauses data={clauses} />
    </RegArticleLayout>
  );
}

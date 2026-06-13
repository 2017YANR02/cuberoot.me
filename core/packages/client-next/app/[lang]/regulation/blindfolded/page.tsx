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
        eyebrow={t('一块表,两个阶段', 'One clock, two phases', "一塊表,兩個階段")}
        title={t('记忆,然后蒙眼还原', 'Memorize, then solve blindfolded', "記憶,然後矇眼還原")}
        lede={t(
          '盲拧没有 15 秒检查。计时从一开始就跑,把记忆和还原算进同一段时间里:选手先睁眼研究魔方背下它的状态,再戴上眼罩,从此不能再看魔方一眼,凭记忆把它还原。',
          'There is no 15-second inspection in Blindfolded. The clock runs from the very start and covers both phases under one time: the competitor studies the puzzle with eyes open and memorizes it, then dons a blindfold — never to see the puzzle again — and solves it from memory.', "盲擰沒有 15 秒檢查。計時從一開始就跑,把記憶和還原算進同一段時間裡:選手先睜眼研究魔方背下它的狀態,再戴上眼罩,從此不能再看魔方一眼,憑記憶把它還原。"
        )}
      >
        <figure className="bld-phasebar" aria-hidden="false">
          <div className="bld-clock">
            <Clock size={16} />
            {t('一块计时器,全程不停', 'One timer, running the whole time', "一塊計時器,全程不停")}
          </div>
          <div className="bld-phases">
            <div className="bld-phase bld-phase-memo">
              <div className="bld-phase-icon"><Eye size={26} /></div>
              <div className="bld-phase-name">{t('记忆', 'Memorize', "記憶")}</div>
              <div className="bld-phase-desc">{t('睁眼研究并背下魔方', 'Study with eyes open', "睜眼研究並背下魔方")}</div>
            </div>
            <div className="bld-phase-arrow" aria-hidden>→</div>
            <div className="bld-phase bld-phase-solve">
              <div className="bld-phase-icon"><EyeOff size={26} /></div>
              <div className="bld-phase-name">{t('蒙眼还原', 'Solve blindfolded', "矇眼還原")}</div>
              <div className="bld-phase-desc">{t('戴上眼罩,凭记忆还原', 'Blindfold on, from memory', "戴上眼罩,憑記憶還原")}</div>
            </div>
          </div>
          <figcaption className="bld-phasebar-cap">
            {t(
              '两个阶段之间没有暂停,选手自己决定何时戴眼罩转入还原 —— 但记忆用得越久,留给还原的时间就越少。',
              'There is no pause between the two phases. The competitor decides when to don the blindfold and switch to solving — but every second spent memorizing is a second less for the solve.', "兩個階段之間沒有暫停,選手自己決定何時戴眼罩轉入還原 —— 但記憶用得越久,留給還原的時間就越少。"
            )}
          </figcaption>
        </figure>

        <RegQuote num="B1 · B1a">
          {t(
            '盲拧沿用速拧的标准流程,只在下列各条上另作规定。其中:盲拧没有检查时间 —— 还原与计时同时开始。',
            'Blindfolded follows the standard Speed Solving procedure, except where the rules below supersede it. In particular: there is no inspection period — the solve starts at the same time as the attempt.', "盲擰沿用速擰的標準流程,只在下列各條上另作規定。其中:盲擰沒有檢查時間 —— 還原與計時同時開始。"
          )}
        </RegQuote>
      </RegSection>

      {/* ── 2. Looking after memo = DNF ──────────────────────────── */}
      <RegSection
        eyebrow={t('核心红线', 'The one red line', "核心紅線")}
        title={t('戴上眼罩后再看魔方,直接 DNF', 'Look at the puzzle after the blindfold goes on — instant DNF', "戴上眼罩後再看魔方,直接 DNF")}
        lede={t(
          '盲拧之所以是盲拧,全靠一条铁律:进入蒙眼阶段后,选手在整个还原过程中都不得看到魔方。一旦看了,这次尝试立即作废(DNF)。',
          'What makes Blindfolded blind is a single hard rule: once the blindfolded phase begins, the competitor must not see the puzzle at any point during the solve. The moment they do, the attempt is dead (DNF).', "盲擰之所以是盲擰,全靠一條鐵律:進入矇眼階段後,選手在整個還原過程中都不得看到魔方。一旦看了,這次嘗試立即作廢(DNF)。"
        )}
      >
        <Callout tone="danger" label={t('蒙眼阶段偷看 = DNF', 'Peeking during the blindfolded phase = DNF', "矇眼階段偷看 = DNF")} icon={<Ban size={17} />}>
          {t(
            '为了把这条守死,裁判会在选手对魔方落下第一步之后,在选手脸和魔方之间举一块挡板(一张纸或纸板就行)。眼罩本身也必须戴得够严:就算挡板不在,视线也仍然被完全挡住。两道防线只有一个目的 —— 让“偷看”物理上不可能。',
            'To enforce it, once the competitor makes their first move on the puzzle the judge holds up a sight blocker (a sheet of paper or cardboard) between the competitor’s face and the puzzle. The blindfold itself must also be worn so that the view would still be clearly blocked even without the sight blocker. Two layers, one purpose — to make peeking physically impossible.', "為了把這條守死,裁判會在選手對魔方落下第一步之後,在選手臉和魔方之間舉一塊擋板(一張紙或紙板就行)。眼罩本身也必須戴得夠嚴:就算擋板不在,視線也仍然被完全擋住。兩道防線只有一個目的 —— 讓“偷看”物理上不可能。"
          )}
        </Callout>

        <RegList
          items={[
            <span key="memo">
              <Eye size={16} className="bld-li-icon" />
              <strong>{t('记忆阶段:可以拿起来看,但不能转。', 'Memo phase: pick it up and look, but do not turn it.', "記憶階段:可以拿起來看,但不能轉。")}</strong>{' '}
              {t(
                '选手可以拿起魔方观察,但不得使用任何实体记录(笔记),也不得对魔方施加转动或刻意改变对齐(允许在限度内对齐魔方面)。违者 DNF。',
                'The competitor may pick up the puzzle to study it, but may not use any physical notes, nor apply any move or intentional change in alignment (aligning faces within the allowed limit is fine). Otherwise: DNF.', "選手可以拿起魔方觀察,但不得使用任何實體記錄(筆記),也不得對魔方施加轉動或刻意改變對齊(允許在限度內對齊魔方面)。違者 DNF。"
              )}{' '}
              <span className="bld-tag">B3</span>
            </span>,
            <span key="don">
              <EyeOff size={16} className="bld-li-icon" />
              <strong>{t('戴眼罩:落下第一步前可摘回去重记。', 'Blindfold on: until the first move, you may go back.', "戴眼罩:落下第一步前可摘回去重記。")}</strong>{' '}
              {t(
                '选手戴上眼罩进入蒙眼阶段;只要还没对魔方落下第一步,都可以摘下眼罩回到记忆阶段再看。一旦动了第一步,就不能再回头。',
                'Donning the blindfold starts the blindfolded phase; until the first move is applied to the puzzle, the competitor may remove the blindfold and return to memorizing. After the first move, there is no going back.', "選手戴上眼罩進入矇眼階段;只要還沒對魔方落下第一步,都可以摘下眼罩回到記憶階段再看。一旦動了第一步,就不能再回頭。"
              )}{' '}
              <span className="bld-tag">B4a · B4a1</span>
            </span>,
            <span key="nolook">
              <Ban size={16} className="bld-li-icon" />
              <strong>{t('蒙眼阶段:全程不得看魔方。', 'Blindfolded phase: never look at the puzzle.', "矇眼階段:全程不得看魔方。")}</strong>{' '}
              {t(
                '从第一步到还原结束,选手在任何时刻都不得看到魔方。违者 DNF。三阶盲拧可以靠手摸来确认允许的 Logo 朝向,但这不算“看”。',
                'From the first move to the end of the solve, the competitor must not look at the puzzle at any point. Otherwise: DNF. (For 3×3×3 BLD, feeling for a permitted logo by touch is allowed — that is not “looking”.)', "從第一步到還原結束,選手在任何時刻都不得看到魔方。違者 DNF。三階盲擰可以靠手摸來確認允許的 Logo 朝向,但這不算“看”。"
              )}{' '}
              <span className="bld-tag">B4d · B4d+</span>
            </span>,
            <span key="blocker">
              <Hand size={16} className="bld-li-icon" />
              <strong>{t('挡板兜底。', 'The sight blocker as backstop.', "擋板兜底。")}</strong>{' '}
              {t(
                '若裁判忘了举挡板而 WCA 代表也不怀疑选手违规偷看,原成绩可保留;反过来,挡板的摆位必须满足“即使没戴眼罩视线也被挡住”。',
                'If the judge forgot the sight blocker and the WCA Delegate has no reason to suspect a violation, the original attempt may stand; conversely, the sight blocker must be placed so the view would be clearly blocked even with no blindfold.', "若裁判忘了舉擋板而 WCA 代表也不懷疑選手違規偷看,原成績可保留;反過來,擋板的擺位必須滿足“即使沒戴眼罩視線也被擋住”。"
              )}{' '}
              <span className="bld-tag">B4c · B4c2</span>
            </span>,
          ]}
        />

        <Callout tone="info" label={t('魔方也有讲究', 'Even the puzzle is restricted', "魔方也有講究")} icon={<ShieldCheck size={17} />}>
          {t(
            '盲拧用的魔方不能有纹理、记号或其它能让人靠手感分辨相似块朝向的特征 —— 否则就成了“摸出来的小抄”。唯一的例外是三阶盲拧:魔方可以带一个规则允许的 Logo,供选手靠触觉确定方位。',
            'A Blindfolded puzzle must not have textures, markings or other features that let similar pieces be told apart by feel — that would be a tactile cheat sheet. The one exception is 3×3×3 BLD, where the puzzle may carry one permitted logo the competitor can locate by touch for orientation.', "盲擰用的魔方不能有紋理、記號或其它能讓人靠手感分辨相似塊朝向的特徵 —— 否則就成了“摸出來的小抄”。唯一的例外是三階盲擰:魔方可以帶一個規則允許的 Logo,供選手靠觸覺確定方位。"
          )}
        </Callout>
      </RegSection>

      {/* ── 3. Which events, what format ─────────────────────────── */}
      <RegSection
        eyebrow={t('用在哪些项目', 'Which events use it', "用在哪些項目")}
        title={t('三阶、四阶、五阶盲拧', '3×3×3, 4×4×4 and 5×5×5 Blindfolded', "三階、四階、五階盲擰")}
        lede={t(
          '附则 B 的流程适用于全部三个单盲项目。盲拧通常采用“三取一”(Best of 3)赛制:三次尝试取最好的一次成绩,只要有一次成功就算有成绩。',
          'The Article B procedure applies to all three single-blind events. Blindfolded is usually held as Best of 3: three attempts, the best one counts — a single successful attempt is all it takes for a result.', "附則 B 的流程適用於全部三個單盲項目。盲擰通常採用“三取一”(Best of 3)賽制:三次嘗試取最好的一次成績,只要有一次成功就算有成績。"
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
            'Solving many cubes in a single blindfolded sitting is a separate event — see ', "多個魔方一次矇眼連續還原是另一個項目 —— 見"
          )}
          <Link href="/regulation/multi-blind">{t('附则 H:多盲', 'Article H: Multi-Blind', "附則 H:多盲")}</Link>
          {t('。', '.')}
        </p>
      </RegSection>
      <FullClauses data={clauses} />
    </RegArticleLayout>
  );
}

'use client';

// /regulation/speed-solving — Appendix A (Speed Solving).
// Illustrated guide to the speed-solve procedure: the 15-second inspection with
// its 8/12-second calls and +2 / DNF cut-offs, the start ritual (palms flat on
// the timer, puzzle on the mat, solve begins when hands leave), the stop ritual
// (release the puzzle, stop the timer, hands back flat), and a penalty summary.
// Shared shell + primitives do the chrome; InspectionTimeline does the visual.

import { useTranslation } from 'react-i18next';
import {
  Hand, PlayCircle, StopCircle, Layers, Clock, MoveUpRight,
} from 'lucide-react';
import Link from '@/components/AppLink';
import { useT } from '../../../../hooks/useT';
import RegArticleLayout from '../_components/RegArticleLayout';
import FullClauses from '../_components/FullClauses';
import clauses from '../_data/reg-clauses/A.json';
import {
  RegSection, Callout, InspectionTimeline,
} from '../_components/primitives';
import './speed-solving.css';

export default function SpeedSolvingChapter() {
  useTranslation();
  const t = useT();

  // Start procedure, step by step (A4 region).
  const START_STEPS: { zh: string; en: string; zhDesc: string; enDesc: string }[] = [
    {
      zh: '魔方落桌', en: 'Puzzle on the mat',
      zhDesc: '观察结束后,把魔方放回桌垫上,任意朝向都行。还原全程魔方一直摆在桌面/桌垫上,不是悬在手里开计时。',
      enDesc: 'When inspection is over, set the puzzle back on the mat in any orientation. Throughout the solve the puzzle rests on the surface — you do not start the clock with it hovering in your hands.',
    },
    {
      zh: '手指放上计时器,掌心向下', en: 'Fingers on the timer, palms down',
      zhDesc: '用手指触到计时器凸起的感应区,掌心主体朝下,双手都放在计时器靠近自己的一侧。叠放式计时器的感应区本就凸起,用指尖按下是正常的,并不要求把手完全贴平。',
      enDesc: 'Touch the elevated sensor pads with your fingers, palms facing predominantly downward, both hands on the side of the timer nearer you. A stackmat-style timer has raised pads, so pressing them with your fingertips is normal — you are not required to lay the hands completely flat.',
    },
    {
      zh: '抬手即开始', en: 'Lift off — and you are solving',
      zhDesc: '把手从计时器抬起的那一刻,计时器启动,还原正式开始。在此之前,手必须一直按在计时器上,直到检查时间走完。',
      enDesc: 'The instant your hands leave the timer it starts and the solve is officially under way. Until then your hands must stay on the timer right up to the moment inspection time runs out.',
    },
  ];

  // Stop procedure, step by step (A6 region).
  const STOP_STEPS: { zh: string; en: string; zhDesc: string; enDesc: string }[] = [
    {
      zh: '先放下魔方', en: 'Let go of the puzzle first',
      zhDesc: '完成还原后,先把魔方放回桌面,松开手 —— 不能一只手还攥着魔方就去拍计时器。',
      enDesc: 'When the puzzle is solved, release it onto the surface first — you may not slap the timer while still gripping the puzzle in a hand.',
    },
    {
      zh: '停表', en: 'Stop the timer',
      zhDesc: '用双手停下计时器。计时器记录的时间就是这一次的成绩(再按罚时调整)。',
      enDesc: 'Stop the timer with both hands. The time it shows is your result for the attempt, before any penalty adjustment.',
    },
    {
      zh: '双手平放收尾', en: 'Hands flat to finish',
      zhDesc: '停表后两手再次平放、掌心向下(此时手指是否触到计时器都行),整个还原到此结束,等裁判判定。',
      enDesc: 'After stopping, lay both hands flat again, palms down (fingers touching the timer is now optional). The attempt is complete; the judge takes over to determine the result.',
    },
  ];

  return (
    <RegArticleLayout slug="speed-solving">
      {/* ── 1. The 15-second inspection ─────────────────────────── */}
      <RegSection
        eyebrow={t('开赛之前', 'Before the clock runs')}
        title={t('15 秒检查,过线就罚', '15 seconds to inspect, then it costs you')}
        lede={t(
          '选手先把已复原的魔方交给打乱员,打乱后接过盖着的魔方。准备好后,裁判掀开遮盖、按下检查秒表 —— 从这一刻起,你最多有 15 秒(不含 15 秒)去观察并开始还原。',
          'The competitor hands a solved puzzle to the scrambler and receives the scrambled puzzle back, covered. When ready, the judge lifts the cover and starts the inspection clock — from that moment you have up to (but not including) 15 seconds to inspect and begin your solve.'
        )}
      >
        <InspectionTimeline
          legend={[
            { tone: 'ok', label: t('0–15 秒 正常检查', '0–15 s — normal inspection') },
            { tone: 'tick', label: t('8 / 12 秒 裁判报时提醒', '8 / 12 s — judge calls the time') },
            { tone: 'warn', label: t('达到 15.00 秒但不到 17.00 秒 → +2 罚秒', '≥ 15.00 s but < 17.00 s → +2 penalty') },
            { tone: 'bad', label: t('达到或超过 17.00 秒 → DNF', '≥ 17.00 s → DNF') },
          ]}
        />

        <Callout tone="info" label={t('开始之前', 'Before you start')} icon={<Hand size={17} />}>
          {t(
            '开计时器时,双手手指触在计时器的感应区上、掌心主体朝下,放在计时器靠近自己的一侧;魔方摆在桌面/桌垫上,不攥在手里。把手从计时器抬起的那一刻,还原才正式开始。检查阶段你可以拿起魔方、翻转端详,但绝不能转动任何一层。',
            'When you start the timer, your fingers rest on its sensor pads with palms predominantly downward, both hands on the side of the timer nearer you; the puzzle sits on the mat, not in your hands. The solve only begins the moment your hands leave the timer. During inspection you may pick the puzzle up and rotate it to look around — but you may never turn a single layer.'
          )}
        </Callout>

        <p className="reg-foot-note">
          {t(
            '到了 8 秒和 12 秒,裁判会出声报时提醒你时间在走;这两次报时只是提示,不影响成绩。',
            'At 8 seconds and again at 12 seconds the judge calls the time aloud to warn you the clock is ticking; these calls are reminders only and do not affect your result.'
          )}
        </p>
      </RegSection>

      {/* ── 2. Starting and stopping ─────────────────────────────── */}
      <RegSection
        eyebrow={t('两个动作', 'Two rituals')}
        title={t('开始与停止', 'Starting and stopping')}
        lede={t(
          '速拧的起点和终点都有固定动作。计时是不是干净利落地启动、又是不是规范地停下,决定这次成绩算不算数 —— 流程没走对会吃罚时,甚至直接 DNF。',
          'A speed solve has a fixed gesture at both ends. Whether the timer starts cleanly and stops correctly decides whether the attempt counts — botch the procedure and you pick up a penalty, or even a DNF.'
        )}
      >
        <div className="ss-flow">
          <div className="ss-flow-head">
            <PlayCircle size={20} />
            <h3 className="ss-flow-title">{t('开始还原', 'Starting the solve')}</h3>
          </div>
          <ol className="ss-steps">
            {START_STEPS.map((s, i) => (
              <li key={i} className="ss-step">
                <span className="ss-step-n">{i + 1}</span>
                <div className="ss-step-body">
                  <div className="ss-step-title">{t(s.zh, s.en)}</div>
                  <p className="ss-step-text">{t(s.zhDesc, s.enDesc)}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="ss-flow">
          <div className="ss-flow-head">
            <StopCircle size={20} />
            <h3 className="ss-flow-title">{t('停止计时', 'Stopping the timer')}</h3>
          </div>
          <ol className="ss-steps">
            {STOP_STEPS.map((s, i) => (
              <li key={i} className="ss-step">
                <span className="ss-step-n">{i + 1}</span>
                <div className="ss-step-body">
                  <div className="ss-step-title">{t(s.zh, s.en)}</div>
                  <p className="ss-step-text">{t(s.zhDesc, s.enDesc)}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <Callout tone="warn" label={t('一个常见误区', 'A common slip')} icon={<MoveUpRight size={17} />}>
          {t(
            '“停表那一下”最容易出岔:还攥着魔方就去拍计时器、或者手没完全放平,都算停止动作不规范,会被加罚。停表后要看魔方的最终状态,只差一步没拧到位是 +2,差得更多则是 DNF —— 这一段由完成状态的规则来判。',
            'The stop is where things most often go wrong: hitting the timer while still holding the puzzle, or with hands not fully flat, counts as a faulty stop and earns a penalty. After the stop, the puzzle’s final state is judged — one move short is a +2, more than that is a DNF — and that call is made under the solved-state rules.'
          )}
        </Callout>
      </RegSection>

      {/* ── 3. Penalties at a glance ─────────────────────────────── */}
      <RegSection
        eyebrow={t('算账', 'Adding it up')}
        title={t('罚时一览', 'Penalties at a glance')}
        lede={t(
          '速拧的罚则只有两档:加罚 2 秒(+2)和不计成绩(DNF)。下面把检查、开始、停止三处最常见的判罚归到一起。',
          'Speed solving has just two penalty tiers: a two-second addition (+2) and a did-not-finish (DNF). Here are the most common calls across inspection, starting and stopping, gathered in one place.'
        )}
      >
        <div className="reg-pen-grid">
          <div className="reg-pen-card plus2">
            <div className="reg-pen-head">
              <Clock size={19} />
              {t('加罚 2 秒', '+2 seconds')}
              <span className="reg-pen-badge">+2</span>
            </div>
            <ul className="reg-pen-list">
              <li>{t('检查时间达到或超过 15.00 秒,但不到 17.00 秒。', 'Inspection reached 15.00 seconds or more, but was under 17.00 seconds.')}</li>
              <li>{t('开计时器时手指没触到计时器感应区,或掌心不是主体朝下、双手不在计时器靠自己一侧。', 'Starting the timer with fingers off the sensor pads, palms not predominantly down, or hands not on the side of the timer nearer you.')}</li>
              <li>{t('停表时还攥着魔方,或停表动作不规范。', 'Stopping with the puzzle still in hand, or with a faulty stopping motion.')}</li>
              <li>{t('魔方离还原只差一步:某一层的错位超出了对齐限度(错位不超过限度则视为已还原、不罚)。', 'The puzzle is one move from solved: a layer is misaligned beyond the alignment limit (misalignment within the limit counts as solved, with no penalty).')}</li>
            </ul>
          </div>

          <div className="reg-pen-card dnf">
            <div className="reg-pen-head">
              <Layers size={19} />
              {t('不计成绩', 'Did not finish')}
              <span className="reg-pen-badge ss-dnf-badge">DNF</span>
            </div>
            <ul className="reg-pen-list">
              <li>{t('检查时间达到或超过 17.00 秒。', 'Inspection reached 17.00 seconds or more.')}</li>
              <li>{t('在检查阶段转动了魔方的任何一层,或有意改变错位程度。', 'A layer was turned during inspection, or misalignment was deliberately altered.')}</li>
              <li>{t('检查时间走完前就开始还原(提前抬手开表)。', 'The solve began before inspection ended (hands lifted too early).')}</li>
              <li>{t('停表时魔方离完成还差不止一步。', 'At the stop the puzzle was more than one move from solved.')}</li>
            </ul>
          </div>
        </div>

        <p className="reg-foot-note">
          {t(
            '停表那一刻魔方到底算不算“还原好了”,以及单层错位的限度怎么量,统一看',
            'Whether the puzzle counts as “solved” at the stop, and how the single-layer misalignment limit is measured, are all decided in '
          )}
          <Link href="/regulation/solved-state">{t('第 10 章 完成状态', 'Article 10 (Solved State)')}</Link>
          {t(
            ';还原中途掉块、解体等魔方故障怎么处理,见', '; pops, breakage and other puzzle defects during a solve are handled in '
          )}
          <Link href="/regulation/defects">{t('第 5 章 魔方故障', 'Article 5 (Puzzle Defects)')}</Link>
          {t('。', '.')}
        </p>
      </RegSection>
      <FullClauses data={clauses} />
    </RegArticleLayout>
  );
}

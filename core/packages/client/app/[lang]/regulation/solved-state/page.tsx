'use client';

// /regulation/solved-state — Article 10 (Solved State).
// Illustrated guide to how a finished puzzle is judged: only the resting state
// after the timer stops counts; a puzzle is solved when every adjacent pair of
// layers sits within the per-puzzle misalignment limit; exactly one pair past
// the limit (one move from solved) → +2, more than one → DNF. Covers the
// per-puzzle limit table and the +2 / DNF boundary. Shared shell + primitives
// do the chrome (breadcrumb, hero, prev/next, footer).

import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Ban } from 'lucide-react';
import { EventIcon } from '@/components/EventIcon';
import Link from '@/components/AppLink';
import { useT } from '../../../../hooks/useT';
import RegArticleLayout from '../_components/RegArticleLayout';
import { RegSection, Callout, RegQuote, RegList, AngleFigure } from '../_components/primitives';

// Per-puzzle misalignment limits. Source: WCA Regulations 10f1–10f4.
// `value` is rendered through <span className="reg-num"> at the call site.
interface LimitRow {
  id: string;
  zh: string;
  en: string;
  // null `deg` → Square-1 has two thresholds, rendered as a composite cell.
  cells: { zh: ReactNode; en: ReactNode };
  reg: string;
}

export default function SolvedStateChapter() {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const t = useT();

  const LIMITS: LimitRow[] = [
    {
      id: '333', zh: '魔方(2–7 阶)', en: 'NxN cubes (2–7)',
      cells: {
        zh: <>≤ <span className="reg-num">45</span>°</>,
        en: <>≤ <span className="reg-num">45</span>°</>,
      },
      reg: '10f1',
    },
    {
      id: 'minx', zh: '五魔方', en: 'Megaminx',
      cells: {
        zh: <>≤ <span className="reg-num">36</span>°</>,
        en: <>≤ <span className="reg-num">36</span>°</>,
      },
      reg: '10f2',
    },
    {
      id: 'pyram', zh: '金字塔 / 斜转', en: 'Pyraminx / Skewb',
      cells: {
        zh: <>≤ <span className="reg-num">60</span>°</>,
        en: <>≤ <span className="reg-num">60</span>°</>,
      },
      reg: '10f3',
    },
    {
      id: 'sq1', zh: 'Square-1', en: 'Square-1',
      cells: {
        zh: <>层 ≤ <span className="reg-num">45</span>°,中层 ≤ <span className="reg-num">90</span>°</>,
        en: <>layers ≤ <span className="reg-num">45</span>°, slash ≤ <span className="reg-num">90</span>°</>,
      },
      reg: '10f4',
    },
  ];

  return (
    <RegArticleLayout slug="solved-state">
      {/* ── 1. Only the moment you stop counts ──────────────────── */}
      <RegSection
        eyebrow={t('判的是哪一刻', 'What gets judged')}
        title={t('还原与否,只看停表那一刻', 'Only the moment you stop counts')}
        lede={t(
          '裁判不问“还差几步才还原”,也不看你手忙脚乱的过程。停表之后魔方静止下来的那个状态,就是唯一被判定的依据。它看的是相邻两层之间被拧偏了多少角度 —— 对 NxN 魔方来说,这条界线是 45°。',
          'A judge does not ask “how many turns would fix it”, nor watch the scramble of your hands. The one thing judged is the resting state the puzzle settles into after the timer stops. What matters is how far adjacent layers are rotated apart — and for NxN cubes that line is drawn at 45°.'
        )}
      >
        <RegQuote num="10b · 10c">
          {t(
            '只考虑计时停止后魔方静止下来的状态;结束时魔方处于任何朝向都可以。',
            'Only the resting state of the puzzle, after the timer has stopped, is considered. The puzzle may be in any orientation at the end of the solve.'
          )}
        </RegQuote>

        <Callout tone="info" label={t('“相邻层错位”是什么', 'What “adjacent-layer misalignment” means')}>
          {t(
            '判定用的是外层转动度量(Outer Block Turn Metric)。每一对相邻部件,如果错位超过了该魔方的限度,就记作“还需要一步才能复原”。把这种“还需要的步数”加起来,就决定了结果:0 步、1 步、还是更多。',
            'Judging uses the Outer Block Turn Metric. For every pair of adjacent parts misaligned past the puzzle’s limit, the puzzle is counted as needing one more move to solve. The total of those needed moves decides the verdict: zero, one, or more.'
          )}
        </Callout>
      </RegSection>

      {/* ── 2. The 45° line, visualised ─────────────────────────── */}
      <RegSection
        eyebrow={t('看图', 'See it')}
        title={t('错位多少才算“没还原”', 'How much off-by counts as “not solved”')}
        lede={t(
          '同样是一层没拧到位,差一点点和差太多,判法完全不同。下面两张图以 NxN 的 45° 为例:左边在限度内,直接判还原;右边越过了限度,等于“差一步”。',
          'A layer that did not quite land can be judged in two very different ways. The figures below take the 45° NxN line: the left is within the limit and judged solved, the right has crossed it and counts as one move away.'
        )}
      >
        <div className="reg-angle-row">
          <AngleFigure
            deg={30}
            tone="ok"
            cap={<>{t('错位 ≤ 45° · 判定还原,不罚', '≤45° off · solved, no penalty')}</>}
          />
          <AngleFigure
            deg={62}
            tone="warn"
            cap={<>{t('错位 > 45° · 差一步 → +2', '>45° off · one move away → +2')}</>}
          />
        </div>

        <RegList
          items={[
            <span key="ok">
              <strong>{t('全部相邻层都在限度内', 'Every adjacent layer within the limit')}</strong>{' — '}
              {t('判定还原,不罚时。', 'judged solved, no penalty.')}
            </span>,
            <span key="plus2">
              <strong>{t('恰好一处越过限度(差一步)', 'Exactly one pair past the limit (one move away)')}</strong>{' — '}
              {t('仍判还原,但记 +2。', 'still solved, but recorded with a +2.')}
            </span>,
            <span key="dnf">
              <strong>{t('超过一处越过限度', 'More than one pair past the limit')}</strong>{' — '}
              {t('结果为 DNF。', 'the result is a DNF.')}
            </span>,
          ]}
        />
      </RegSection>

      {/* ── 3. Per-puzzle misalignment limits ───────────────────── */}
      <RegSection
        eyebrow={t('每种魔方一条线', 'A line per puzzle')}
        title={t('各魔方的错位限度', 'Per-puzzle misalignment limits')}
        lede={t(
          '不同魔方一步转的角度不一样,所以“算不算一步”的界线也不同 —— 通常取相邻两个稳定位置正中间的那个角度。',
          'Different puzzles turn by different angles per move, so the “does this count as a move” line differs too — usually it sits halfway between two adjacent resting positions.'
        )}
      >
        <table className="reg-table">
          <thead>
            <tr>
              <th>{t('魔方', 'Puzzle')}</th>
              <th>{t('错位限度', 'Misalignment limit')}</th>
              <th>{t('规则', 'Regulation')}</th>
            </tr>
          </thead>
          <tbody>
            {LIMITS.map((r) => (
              <tr key={r.id}>
                <td>
                  <span className="reg-evt">
                    <EventIcon event={r.id} />
                    {t(r.zh, r.en)}
                  </span>
                </td>
                <td>{(isZh ? (r.cells.zh) : (r.cells.en))}</td>
                <td className="reg-num">{r.reg}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="reg-foot-note">
          {t(
            'Square-1 的中层(/)一步是 180° 里的一半,所以限度放到 90°;层（U/D）则跟 NxN 一样按 45° 算,且 X、Y 两个方向分开判定。魔表则是另一套标准:十八个内表面全部指向 12 点才算还原(规则 10i)。',
            'On Square-1 a slash (/) move is half of 180°, so its limit is 90°; the U/D layers use the same 45° as NxN, with the X and Y directions judged separately. Clock uses a different rule entirely: it is solved only when all eighteen inner faces point to 12 o’clock (Regulation 10i).'
          )}
        </p>
      </RegSection>

      {/* ── 4. The +2 / DNF boundary ────────────────────────────── */}
      <RegSection
        eyebrow={t('界线在哪', 'Where the line is')}
        title={t('+2 与 DNF 的界线', 'The line between +2 and DNF')}
        lede={t(
          '同一把还原,落在 +2 还是 DNF,差别可能只是一个相邻层的角度,或者计时前后多了一下动作。下面把两类最常见的判罚摆在一起对照。',
          'Whether an attempt lands on a +2 or a DNF can come down to a single layer’s angle, or one stray move around the timer. Here are the most common cases of each, side by side.'
        )}
      >
        <div className="reg-pen-grid">
          <div className="reg-pen-card plus2">
            <div className="reg-pen-head">
              <span className="reg-pen-badge">+2</span>
              {t('加 2 秒', 'Two-second penalty')}
            </div>
            <ul className="reg-pen-list">
              <li>{t('检查超过 15 秒,但未超过 17 秒', 'Inspection over 15 s but not over 17 s')}</li>
              <li>{t('结束时恰好一处相邻层错位超过限度(差一步还原)', 'Exactly one pair of adjacent layers misaligned past the limit (one move from solved)')}</li>
              <li>{t('与开始计时相关的轻微违规(裁判/代表裁量)', 'Minor faults around starting the timer (judge/Delegate discretion)')}</li>
            </ul>
          </div>

          <div className="reg-pen-card dnf">
            <div className="reg-pen-head">
              <Ban size={19} />
              {t('DNF · 该把无效', 'DNF · attempt void')}
            </div>
            <ul className="reg-pen-list">
              <li>{t('检查超过 17 秒', 'Inspection over 17 s')}</li>
              <li>{t('结束时超过一步未还原,或根本没有还原', 'More than one move from solved, or simply not solved')}</li>
              <li>{t('计时停止后又转动了魔方', 'Applying a move after the timer has stopped')}</li>
              <li>{t('比赛中掉块/解体且无法在不增加步数的前提下复原', 'A pop that cannot be fixed without adding a move')}</li>
              <li>{t('盲拧中睁眼偷看', 'Looking at the puzzle during a blindfolded attempt')}</li>
              <li>{t('未按规程开始/停止计时', 'Failing to start or stop the timer per procedure')}</li>
              <li>{t('超过该轮时间上限仍未完成', 'Exceeding the round time limit without finishing')}</li>
            </ul>
          </div>
        </div>

        <p className="reg-foot-note">
          {t(
            '掉块、解体等“魔方故障”的细分判法见',
            'The fine-grained verdicts for pops, breakage and other puzzle defects live in '
          )}
          <Link href="/regulation/defects">{t('第 5 章 魔方故障', 'Article 5 (Puzzle Defects)')}</Link>
          {t(';检查计时、开始/停止计时的完整规程见', '; the full inspection and start/stop procedure is in ')}
          <Link href="/regulation/speed-solving">{t('附则 A 速拧', 'Article A (Speed Solving)')}</Link>
          {t('。', '.')}
        </p>

        <Callout tone="warn" label={t('成绩怎么记', 'How the result is recorded')} style={{ marginTop: 28 }}>
          {t(
            '+2 直接加进时间里,例如 12.34 秒变成 14.34 秒。最终成绩按精度截断(不是四舍五入):不足 10 分钟截到百分之一秒,达到或超过 10 分钟截到整秒(规则 9f)。',
            'A +2 is added straight into the time — 12.34 s becomes 14.34 s. The final result is truncated (not rounded) to its precision: under 10 minutes to hundredths of a second, at or over 10 minutes to whole seconds (Regulation 9f).'
          )}
        </Callout>
      </RegSection>
    </RegArticleLayout>
  );
}
